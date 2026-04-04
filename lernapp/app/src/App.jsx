import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "ausbildung-webapp-v2";

const MODEL_OPTIONS = [
  ["gemini-3-flash-preview", "Gemini 3 Flash"],
  ["gemini-3.1-flash-lite", "Gemini 3.1 Flash Lite"],
  ["gemini-2.5-flash", "Gemini 2.5 Flash"],
  ["custom", "Ozel Model Kimligi"]
];

const defaultState = {
  settings: {
    geminiApiKey: "",
    sourceLanguage: "Almanca",
    targetLanguage: "Turkce",
    model: "gemini-3-flash-preview",
    customModel: ""
  },
  courses: [],
  entries: [],
  exams: [],
  chats: []
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      settings: { ...defaultState.settings, ...(parsed.settings || {}) }
    };
  } catch {
    return defaultState;
  }
}

function fileToInlineData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        inlineData: {
          mimeType: file.type || "application/octet-stream",
          data: String(reader.result).split(",")[1]
        }
      });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeError(message, model) {
  const text = String(message || "");
  if (text.toLowerCase().includes("quota")) {
    return `${model} icin kota dolu veya bu API key ile erisim yok. Ayarlardan Gemini 3 Flash ya da Gemini 3.1 Flash Lite dene.`;
  }
  if (text.toLowerCase().includes("not found")) {
    return `${model} modeli bulunamadi. Ozel model kimligini kontrol et.`;
  }
  if (text.toLowerCase().includes("api key")) {
    return "API anahtari gecersiz veya eksik.";
  }
  return text || "Gemini istegi sirasinda bir hata olustu.";
}

async function callGemini({ apiKey, model, prompt, files = [] }) {
  if (!apiKey) throw new Error("Gemini API anahtari gerekli.");
  if (!model) throw new Error("Gecerli bir model secilmedi.");
  const fileParts = await Promise.all(files.map(fileToInlineData));
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, ...fileParts] }]
      })
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(normalizeError(data?.error?.message, model));
  return data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim() || "";
}

function formatDate(value) {
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildHomeworkPrompt(settings) {
  return `Sen mesleki egitim odakli bir asistan olarak yuklenen sayfalari analiz et.
Kaynak dil: ${settings.sourceLanguage}
Hedef dil: ${settings.targetLanguage}

GOREV:
1. Sayfadaki duzeni, basliklari, maddeleri ve bosluk mantigini koru.
2. Sorularin veya bosluklarin bulundugu yerlere dogru cevaplari yerlestir.
3. Ciktin "sayfa sayfa" ilerlesin ve orijinal akisi bozulmasin.
4. Odev cozumleri dogrudan ilgili satirin altinda veya ayni blokta olsun.
5. Gereksiz uzun anlatim ekleme.

CIKTI FORMATI:
# Baslik
## Sayfa 1
[Orijinal yapinin korunmus cozumlu hali]

## Sayfa 2
[Orijinal yapinin korunmus cozumlu hali]

En sonda kisa bir "Kontrol Notlari" bolumu ekle.`;
}

function buildTopicPrompt(settings) {
  return `Sen mesleki egitim materyalini anlatan bir ogretmensin.
Kaynak dil: ${settings.sourceLanguage}
Hedef dil: ${settings.targetLanguage}

GOREV:
1. Yuklenen sayfalardan baglamdan kopmadan konu anlatimi hazirla.
2. Anlatim hedef dilde olsun.
3. Onemli terimleri "Kaynak Dil - Hedef Dil" seklinde listele.
4. Orijinal sayfa mantigina sadik kal ama daha temiz ve ogretici bir duzende sun.
5. Gerekiyorsa tablo benzeri karsilastirmalar kullan.

CIKTI FORMATI:
# Konu Ozeti
## Adim Adim Anlatim
## Onemli Terimler
- terim kaynak - terim hedef
## Kisa Tekrar`;
}

function buildExamPrompt(settings, contextText) {
  return `Sen bir sinav hazirlama asistani olarak calis.
Kaynak dil: ${settings.sourceLanguage}
Hedef dil: ${settings.targetLanguage}

KULLANILACAK MALZEME:
${contextText || "Yuklenen dosyalar"}

GOREV:
1. Gercek sinav yapisina uygun olabilecek en fazla sayida soru hazirla.
2. Sadece coktan secmeli degil; dogru-yanlis, bosluk doldurma, acik uclu, eslestirme, mini vaka, kisa yorum sorulari da kullan.
3. Sorular kaynak dilde olsun.
4. Her sorunun altinda dogru cevap ve kisa aciklama olsun.
5. Sorulari zorluk seviyesine gore ayir.

CIKTI FORMATI:
# Sinav Seti
## Kolay
## Orta
## Zor
Her soruda:
Soru Tipi:
Soru:
Secenekler:
Dogru Cevap:
Aciklama:`;
}

function App() {
  const [state, setState] = useState(defaultState);
  const [activeCourseId, setActiveCourseId] = useState(null);
  const [activeTab, setActiveTab] = useState("homework");
  const [showSettings, setShowSettings] = useState(false);
  const [courseTitle, setCourseTitle] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedEntryIds, setSelectedEntryIds] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setState(loadState()), []);
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)), [state]);

  const activeCourse = useMemo(
    () => state.courses.find((course) => course.id === activeCourseId) || null,
    [state.courses, activeCourseId]
  );
  const resolvedModel = state.settings.model === "custom"
    ? state.settings.customModel.trim()
    : state.settings.model;

  const courseEntries = useMemo(
    () => state.entries.filter((entry) => entry.courseId === activeCourseId),
    [state.entries, activeCourseId]
  );
  const homeworkEntries = courseEntries.filter((entry) => entry.kind === "homework");
  const topicEntries = courseEntries.filter((entry) => entry.kind === "topic");
  const courseExams = useMemo(
    () => state.exams.filter((exam) => exam.courseId === activeCourseId),
    [state.exams, activeCourseId]
  );
  const activeChat = useMemo(() => {
    if (!activeCourseId) return null;
    return state.chats.find((chat) => chat.courseId === activeCourseId) || {
      id: null,
      courseId: activeCourseId,
      messages: []
    };
  }, [state.chats, activeCourseId]);

  function updateSettings(patch) {
    setState((current) => ({
      ...current,
      settings: { ...current.settings, ...patch }
    }));
  }

  function addCourse() {
    const title = courseTitle.trim();
    if (!title) return;
    const newCourse = { id: uid(), title, createdAt: new Date().toISOString() };
    setState((current) => ({ ...current, courses: [newCourse, ...current.courses] }));
    setCourseTitle("");
    setActiveCourseId(newCourse.id);
  }

  function removeCourse(courseId) {
    setState((current) => ({
      ...current,
      courses: current.courses.filter((course) => course.id !== courseId),
      entries: current.entries.filter((entry) => entry.courseId !== courseId),
      exams: current.exams.filter((exam) => exam.courseId !== courseId),
      chats: current.chats.filter((chat) => chat.courseId !== courseId)
    }));
    if (activeCourseId === courseId) {
      setActiveCourseId(null);
      setSelectedEntryIds([]);
    }
  }

  async function createEntry(kind) {
    if (!activeCourseId || selectedFiles.length === 0) return;
    setBusy(true);
    setStatus(kind === "homework" ? "Odev cozumu hazirlaniyor..." : "Konu anlatimi hazirlaniyor...");
    setError("");
    try {
      const prompt = kind === "homework"
        ? buildHomeworkPrompt(state.settings)
        : buildTopicPrompt(state.settings);
      const output = await callGemini({
        apiKey: state.settings.geminiApiKey,
        model: resolvedModel,
        prompt,
        files: selectedFiles
      });
      const entry = {
        id: uid(),
        courseId: activeCourseId,
        kind,
        title: kind === "homework" ? "Cozumlu Odev" : "Konu Anlatimi",
        sourceFiles: selectedFiles.map((file) => file.name),
        output,
        createdAt: new Date().toISOString()
      };
      setState((current) => ({ ...current, entries: [entry, ...current.entries] }));
      setSelectedFiles([]);
      setStatus(kind === "homework" ? "Cozumlu odev olusturuldu." : "Konu anlatimi olusturuldu.");
    } catch (err) {
      setError(err.message);
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function createExam() {
    if (!activeCourseId) return;
    if (selectedFiles.length === 0 && selectedEntryIds.length === 0) return;
    setBusy(true);
    setStatus("Sinav seti olusturuluyor...");
    setError("");
    try {
      const pickedEntries = courseEntries.filter((entry) => selectedEntryIds.includes(entry.id));
      const contextText = pickedEntries
        .map((entry) => `Baslik: ${entry.title}\nIcerik:\n${entry.output}`)
        .join("\n\n---\n\n");
      const output = await callGemini({
        apiKey: state.settings.geminiApiKey,
        model: resolvedModel,
        prompt: buildExamPrompt(state.settings, contextText),
        files: selectedFiles
      });
      const exam = {
        id: uid(),
        courseId: activeCourseId,
        title: `Sinav Seti ${courseExams.length + 1}`,
        output,
        sourceEntryIds: selectedEntryIds,
        sourceFiles: selectedFiles.map((file) => file.name),
        createdAt: new Date().toISOString()
      };
      setState((current) => ({ ...current, exams: [exam, ...current.exams] }));
      setSelectedFiles([]);
      setSelectedEntryIds([]);
      setStatus("Sinav seti hazir.");
    } catch (err) {
      setError(err.message);
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || !activeCourseId) return;
    const userMessage = { id: uid(), role: "user", text, createdAt: new Date().toISOString() };
    const context = courseEntries.slice(0, 6).map((entry) => `${entry.title}\n${entry.output}`).join("\n\n---\n\n");
    const nextMessages = [...(activeChat?.messages || []), userMessage];
    setState((current) => {
      const existing = current.chats.find((chat) => chat.courseId === activeCourseId);
      const updated = existing
        ? { ...existing, messages: nextMessages }
        : { id: uid(), courseId: activeCourseId, messages: nextMessages };
      return {
        ...current,
        chats: existing
          ? current.chats.map((chat) => (chat.courseId === activeCourseId ? updated : chat))
          : [updated, ...current.chats]
      };
    });
    setChatInput("");
    setBusy(true);
    setStatus("Sohbet yaniti hazirlaniyor...");
    setError("");
    try {
      const answer = await callGemini({
        apiKey: state.settings.geminiApiKey,
        model: resolvedModel,
        prompt: `Sen destekleyici bir Ausbildung asistanisin.
Mevcut ders: ${activeCourse?.title || ""}
Kaynak dil: ${state.settings.sourceLanguage}
Hedef dil: ${state.settings.targetLanguage}
Baglam:
${context || "Henuz analiz edilmis materyal yok."}

Kullanici sorusu:
${text}

Kisa, acik ve pratik cevap ver. Gerekirse maddeler kullan.`
      });
      const modelMessage = { id: uid(), role: "model", text: answer, createdAt: new Date().toISOString() };
      setState((current) => ({
        ...current,
        chats: current.chats.map((chat) =>
          chat.courseId === activeCourseId ? { ...chat, messages: [...chat.messages, modelMessage] } : chat
        )
      }));
      setStatus("Yanıt hazir.");
    } catch (err) {
      setError(err.message);
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  function importData(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        setState({
          ...defaultState,
          ...parsed,
          settings: { ...defaultState.settings, ...(parsed.settings || {}) }
        });
      } catch {
        setError("Ice aktarma dosyasi gecersiz.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <p className="eyebrow">Mesleki Ogrenme Alani</p>
          <h1>Ausbildung<span>Pro</span></h1>
          <p className="muted">Her ders icin konu anlatimi, odev cozumu, sohbet ve sinav hazirligi alanlari.</p>
        </div>

        <div className="toolbar-grid">
          <button className="primary wide" onClick={() => setShowSettings(true)}>API ve Dil Ayarlari</button>
          <button className="secondary" onClick={() => downloadJson("ausbildung-backup.json", state)}>Disa Aktar</button>
          <label className="secondary file-button">Ice Aktar<input type="file" accept=".json" onChange={importData} /></label>
        </div>

        <div className="panel sidebar-panel">
          <div className="panel-title">Yeni Ders</div>
          <input value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} placeholder="Orn. WiSo" />
          <button className="primary compact" onClick={addCourse}>Dersi Ekle</button>
        </div>

        <div className="panel sidebar-panel">
          <div className="row between">
            <div className="panel-title">Derslerim</div>
            <span className="badge">{state.courses.length}</span>
          </div>
          <div className="list course-list">
            {state.courses.length === 0 && <p className="empty">Baslamak icin soldan yeni bir ders ac.</p>}
            {state.courses.map((course) => (
              <button
                key={course.id}
                className={`course-item ${activeCourseId === course.id ? "active" : ""}`}
                onClick={() => {
                  setActiveCourseId(course.id);
                  setSelectedEntryIds([]);
                }}
              >
                <div className="row between full-width">
                  <strong>{course.title}</strong>
                  <span className="meta-date">{formatDate(course.createdAt)}</span>
                </div>
                <span className="preview">
                  {state.entries.filter((entry) => entry.courseId === course.id).length} icerik
                </span>
                <span
                  className="delete-link"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeCourse(course.id);
                  }}
                >
                  Dersi sil
                </span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="content">
        <header className="hero-header">
          <div>
            <p className="eyebrow">Calisma Alani</p>
            <h2>{activeCourse ? activeCourse.title : "Bir ders sec"}</h2>
          </div>
          <div className="top-actions">
            <div className="lang-pill">{state.settings.sourceLanguage} → {state.settings.targetLanguage}</div>
            <div className="tab-strip">
              {[
                ["homework", "Odev Cozumu"],
                ["topic", "Konu Anlatimi"],
                ["exam", "Sinav Hazirligi"],
                ["chat", "Sohbet"]
              ].map((item) => (
                <button
                  key={item[0]}
                  className={activeTab === item[0] ? "tab active" : "tab"}
                  onClick={() => setActiveTab(item[0])}
                >
                  {item[1]}
                </button>
              ))}
            </div>
          </div>
        </header>

        {!activeCourse && (
          <section className="welcome-card">
            <div className="welcome-copy">
              <div className="panel-title">Yeni Ders Olustur</div>
              <p>Her ders acildiginda odev cozumu, konu anlatimi, sohbet ve sinav hazirligi alanlari otomatik hazir olur.</p>
            </div>
          </section>
        )}

        {activeCourse && activeTab === "homework" && (
          <section className="workspace-grid">
            <div className="panel emphasis">
              <div className="panel-title">Odev Cozumu</div>
              <p className="section-copy">Yukledigin PDF veya gorselleri analiz edip ayni sayfa akisini koruyarak cozumlu halde sunar.</p>
              <label>Dosya Yukle</label>
              <input type="file" multiple accept=".pdf,image/*" onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))} />
              <div className="file-list">
                {selectedFiles.length === 0 && <p className="empty">Henuz dosya secmedin.</p>}
                {selectedFiles.map((file) => <div key={`${file.name}-${file.size}`} className="file-chip">{file.name}</div>)}
              </div>
              <button className="primary" disabled={busy} onClick={() => createEntry("homework")}>
                {busy ? "Hazirlaniyor..." : "Cozumlu Odev Olustur"}
              </button>
            </div>
            <div className="panel">
              <div className="panel-title">Olusan Odevler</div>
              <div className="list note-list">
                {homeworkEntries.length === 0 && <p className="empty">Bu derste henuz cozumlu odev yok.</p>}
                {homeworkEntries.map((entry) => (
                  <article key={entry.id} className="output-card">
                    <div className="row between full-width">
                      <strong>{entry.title}</strong>
                      <span className="meta-date">{formatDate(entry.createdAt)}</span>
                    </div>
                    <span className="preview">{entry.sourceFiles.join(", ")}</span>
                    <pre>{entry.output}</pre>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeCourse && activeTab === "topic" && (
          <section className="workspace-grid">
            <div className="panel emphasis">
              <div className="panel-title">Konu Anlatimi</div>
              <p className="section-copy">Sayfanin baglamini koruyarak hedef dilde anlatim ve onemli terimlerin kaynak-hedef karsiliklarini olusturur.</p>
              <label>Dosya Yukle</label>
              <input type="file" multiple accept=".pdf,image/*" onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))} />
              <div className="file-list">
                {selectedFiles.length === 0 && <p className="empty">Henuz dosya secmedin.</p>}
                {selectedFiles.map((file) => <div key={`${file.name}-${file.size}`} className="file-chip">{file.name}</div>)}
              </div>
              <button className="primary" disabled={busy} onClick={() => createEntry("topic")}>
                {busy ? "Hazirlaniyor..." : "Konu Anlatimi Uret"}
              </button>
            </div>
            <div className="panel">
              <div className="panel-title">Anlatim Arsivi</div>
              <div className="list note-list">
                {topicEntries.length === 0 && <p className="empty">Bu derste henuz konu anlatimi yok.</p>}
                {topicEntries.map((entry) => (
                  <article key={entry.id} className="output-card">
                    <div className="row between full-width">
                      <strong>{entry.title}</strong>
                      <span className="meta-date">{formatDate(entry.createdAt)}</span>
                    </div>
                    <span className="preview">{entry.sourceFiles.join(", ")}</span>
                    <pre>{entry.output}</pre>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeCourse && activeTab === "exam" && (
          <section className="workspace-grid">
            <div className="panel emphasis">
              <div className="panel-title">Sinav Hazirligi</div>
              <p className="section-copy">Yeni dosya yukleyebilir veya onceki odev ve konu anlatimlarini secip gercege yakin soru tipleriyle kapsamli sinav seti uretebilirsin.</p>
              <label>Yeni Dosya Yukle</label>
              <input type="file" multiple accept=".pdf,image/*" onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))} />
              <label>Onceden Uretilen Icerikler</label>
              <div className="selection-list">
                {courseEntries.length === 0 && <p className="empty">Secilebilir onceki icerik yok.</p>}
                {courseEntries.map((entry) => (
                  <label key={entry.id} className="selection-item">
                    <input
                      type="checkbox"
                      checked={selectedEntryIds.includes(entry.id)}
                      onChange={(event) =>
                        setSelectedEntryIds((current) =>
                          event.target.checked
                            ? [...current, entry.id]
                            : current.filter((id) => id !== entry.id)
                        )
                      }
                    />
                    <span>{entry.title}</span>
                  </label>
                ))}
              </div>
              <button className="primary" disabled={busy} onClick={createExam}>
                {busy ? "Hazirlaniyor..." : "Sinav Seti Olustur"}
              </button>
            </div>
            <div className="panel">
              <div className="panel-title">Hazirlanan Sinavlar</div>
              <div className="list note-list">
                {courseExams.length === 0 && <p className="empty">Bu derste henuz sinav seti yok.</p>}
                {courseExams.map((exam) => (
                  <article key={exam.id} className="output-card">
                    <div className="row between full-width">
                      <strong>{exam.title}</strong>
                      <span className="meta-date">{formatDate(exam.createdAt)}</span>
                    </div>
                    <span className="preview">{exam.sourceFiles.join(", ") || "Onceden secilen icerikler"}</span>
                    <pre>{exam.output}</pre>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeCourse && activeTab === "chat" && (
          <section className="workspace-grid">
            <div className="panel full emphasis">
              <div className="row between">
                <div className="panel-title">Ders Sohbeti</div>
                <span className="source-pill">{resolvedModel || "Model sec"}</span>
              </div>
              <div className="chat-box">
                {(activeChat?.messages || []).length === 0 && <p className="empty">Bu ders icin henuz sohbet yok.</p>}
                {(activeChat?.messages || []).map((message) => (
                  <div key={message.id} className={`chat-message ${message.role === "user" ? "user" : "model"}`}>
                    <strong>{message.role === "user" ? "Sen" : "AI"}</strong>
                    <p>{message.text}</p>
                  </div>
                ))}
              </div>
              <textarea rows="5" value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Dersle ilgili soru sor, terim sor, odev mantigini sor..." />
              <button className="primary" disabled={busy} onClick={sendChatMessage}>
                {busy ? "Gonderiliyor..." : "Mesaji Gonder"}
              </button>
            </div>
          </section>
        )}

        {(status || error) && <div className={error ? "status error" : "status"}>{error || status}</div>}
      </main>

      {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="row between">
              <h3>Ayarlar</h3>
              <button className="ghost" onClick={() => setShowSettings(false)}>Kapat</button>
            </div>
            <label>Gemini API Anahtari</label>
            <input type="password" value={state.settings.geminiApiKey} onChange={(event) => updateSettings({ geminiApiKey: event.target.value.trim() })} placeholder="API key gir" />
            <label>Model</label>
            <select value={state.settings.model} onChange={(event) => updateSettings({ model: event.target.value })}>
              {MODEL_OPTIONS.map((item) => <option key={item[0]} value={item[0]}>{item[1]}</option>)}
            </select>
            {state.settings.model === "custom" && (
              <>
                <label>Ozel Model Kimligi</label>
                <input value={state.settings.customModel} onChange={(event) => updateSettings({ customModel: event.target.value })} placeholder="Orn. gemini-3.1-flash-lite" />
              </>
            )}
            <div className="field-grid">
              <div>
                <label>Kaynak Dil</label>
                <select value={state.settings.sourceLanguage} onChange={(event) => updateSettings({ sourceLanguage: event.target.value })}>
                  <option>Almanca</option>
                  <option>Ingilizce</option>
                  <option>Turkce</option>
                </select>
              </div>
              <div>
                <label>Hedef Dil</label>
                <select value={state.settings.targetLanguage} onChange={(event) => updateSettings({ targetLanguage: event.target.value })}>
                  <option>Turkce</option>
                  <option>Almanca</option>
                  <option>Ingilizce</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
