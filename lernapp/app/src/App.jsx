import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "ausbildung-webapp-v3";

const MODEL_OPTIONS = [
  ["gemini-3-flash-preview", "Gemini 3 Flash"],
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
  const lowered = text.toLowerCase();
  if (lowered.includes("high demand") || lowered.includes("overloaded")) {
    return `${model} modeli su anda yogun. Uygulama otomatik olarak yedek modele gecmeyi dener.`;
  }
  if (lowered.includes("quota")) {
    return `${model} icin kota dolu veya bu key ile erisim yok.`;
  }
  if (lowered.includes("not found") || lowered.includes("not supported")) {
    return `${model} modeli bulunamadi. Ozel model kimligini kontrol et.`;
  }
  if (lowered.includes("api key")) {
    return "API anahtari gecersiz veya eksik.";
  }
  return text || "Gemini istegi sirasinda bir hata olustu.";
}

async function tryGeminiCall({ apiKey, model, prompt, files = [] }) {
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
  if (!response.ok) {
    return { ok: false, status: response.status, model, message: data?.error?.message || "Hata" };
  }
  return {
    ok: true,
    model,
    text: data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim() || ""
  };
}

async function callGemini({ apiKey, model, prompt, files = [] }) {
  if (!apiKey) throw new Error("Gemini API anahtari gerekli.");
  if (!model) throw new Error("Gecerli bir model secilmedi.");

  const candidates = [model, "gemini-3-flash-preview", "gemini-2.5-flash"]
    .filter((value, index, array) => value && array.indexOf(value) === index);

  let lastFailure = null;
  for (const candidate of candidates) {
    const result = await tryGeminiCall({ apiKey, model: candidate, prompt, files });
    if (result.ok) {
      return { text: result.text, usedModel: result.model, fallbackUsed: result.model !== model };
    }

    lastFailure = result;
    const lowered = String(result.message || "").toLowerCase();
    const retryable =
      result.status === 429 ||
      result.status === 503 ||
      lowered.includes("high demand") ||
      lowered.includes("overloaded") ||
      lowered.includes("unavailable") ||
      lowered.includes("not found") ||
      lowered.includes("not supported");
    if (!retryable) throw new Error(normalizeError(result.message, candidate));
  }

  throw new Error(normalizeError(lastFailure?.message, lastFailure?.model || model));
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

function renderRichText(text) {
  if (!text) return null;
  return String(text).split("\n").map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={index} className="rt-space" />;
    if (trimmed.startsWith("# ")) return <h1 key={index} className="rt-h1">{trimmed.slice(2)}</h1>;
    if (trimmed.startsWith("## ")) return <h2 key={index} className="rt-h2">{trimmed.slice(3)}</h2>;
    if (trimmed.startsWith("### ")) return <h3 key={index} className="rt-h3">{trimmed.slice(4)}</h3>;
    if (/^\d+\.\s/.test(trimmed)) return <div key={index} className="rt-number">{trimmed}</div>;
    if (trimmed.startsWith("- ")) return <div key={index} className="rt-bullet">{trimmed.slice(2)}</div>;

    const parts = trimmed.split(/(\*\*.*?\*\*)/g);
    return (
      <p key={index} className="rt-p">
        {parts.map((part, partIndex) =>
          part.startsWith("**") && part.endsWith("**")
            ? <strong key={partIndex} className="rt-strong">{part.slice(2, -2)}</strong>
            : <span key={partIndex}>{part}</span>
        )}
      </p>
    );
  });
}

function buildHomeworkPrompt(settings) {
  return `GOREV: ODEV COZUMU (${settings.sourceLanguage} -> ${settings.targetLanguage})
TALIMATLAR:
1. Gorselleri veya PDF sayfalarini analiz et.
2. BIREBIR SAYFA YAPISI: Orijinal sayfadaki basliklari, paragraflari ve duzeni koruyarak Markdown formatinda yeniden olustur.
3. COZUM ENTEGRASYONU: Sorularin oldugu yerlere cozumleri dogru noktada yerlestir.
4. Onemli notlari ayri bir "Kontrol Notlari" bolumunde ver.

CIKTI DUZENI:
# Baslik
## Sayfa 1
[Sayfanin cozumlu hali]
## Sayfa 2
[Sayfanin cozumlu hali]
## Kontrol Notlari`;
}

function buildTopicPrompt(settings) {
  return `GOREV: KONU ANLATIMI (${settings.targetLanguage})
TALIMATLAR:
1. Icerigi detaylica ama temiz bir duzende anlat.
2. Asagidaki bolum basliklariyla ilerle:
   # Baslik
   ## Zusammenfassung
   ## Konu Ozeti
   ## Adim Adim Anlatim
   ## Onemli Terimler
   ## Kisa Tekrar
3. Onemli terimleri Kaynak Dil - Hedef Dil seklinde yaz.
4. Onemli yerleri **kalin** yap.
5. Gorseldeki baglamdan kopma.`;
}

function buildExamPrompt(settings, contextText) {
  return `GOREV: SINAV HAZIRLIGI (${settings.sourceLanguage})
KULLANILACAK MALZEME:
${contextText || "Yuklenen dosyalar"}

TALIMATLAR:
1. Sinavda cikabilecek olabilecek en fazla soru cesidini kullan.
2. Coktan secmeli, dogru-yanlis, bosluk doldurma, acik uclu, eslestirme, mini vaka sorulari hazirla.
3. Her soru icin dogru cevap ve kisa aciklama ver.
4. Sorulari Kolay, Orta, Zor basliklari altinda grupla.`;
}

function ArchiveList({ title, items, onOpen, emptyText }) {
  return (
    <div className="panel archive-panel">
      <div className="panel-title">{title}</div>
      <div className="archive-list">
        {items.length === 0 && <p className="empty">{emptyText}</p>}
        {items.map((item) => (
          <button key={item.id} className="archive-item" onClick={() => onOpen(item)}>
            <strong>{item.title}</strong>
            <div className="archive-meta">
              <span>{formatDate(item.createdAt)}</span>
              <span>{item.usedModel || "-"}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ContentViewer({ item, onClose, fullScreen, onToggleFullScreen }) {
  if (!item) return null;
  return (
    <div className={fullScreen ? "viewer-overlay full" : "viewer-overlay"}>
      <div className={fullScreen ? "viewer-card full" : "viewer-card"}>
        <div className="viewer-top">
          <div>
            <h2>{item.title}</h2>
            <div className="viewer-meta">
              <span>{formatDate(item.createdAt)}</span>
              <span>{item.usedModel || "-"}</span>
              <span>{item.kindLabel || item.typeLabel || "Icerik"}</span>
            </div>
          </div>
          <div className="viewer-actions">
            <button className="ghost" onClick={onToggleFullScreen}>
              {fullScreen ? "Kucult" : "Buyut"}
            </button>
            <button className="ghost" onClick={onClose}>Kapat</button>
          </div>
        </div>
        <div className="viewer-content">{renderRichText(item.output)}</div>
      </div>
    </div>
  );
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
  const [viewerItem, setViewerItem] = useState(null);
  const [viewerFullScreen, setViewerFullScreen] = useState(false);

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
  const homeworkEntries = courseEntries.filter((entry) => entry.kind === "homework").map((entry) => ({ ...entry, kindLabel: "Odev Cozumu" }));
  const topicEntries = courseEntries.filter((entry) => entry.kind === "topic").map((entry) => ({ ...entry, kindLabel: "Konu Anlatimi" }));
  const courseExams = useMemo(
    () => state.exams.filter((exam) => exam.courseId === activeCourseId).map((exam) => ({ ...exam, kindLabel: "Sinav Hazirligi" })),
    [state.exams, activeCourseId]
  );
  const activeChat = useMemo(() => {
    if (!activeCourseId) return null;
    return state.chats.find((chat) => chat.courseId === activeCourseId) || { id: null, courseId: activeCourseId, messages: [] };
  }, [state.chats, activeCourseId]);

  function updateSettings(patch) {
    setState((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
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
    if (activeCourseId === courseId) setActiveCourseId(null);
  }

  async function createEntry(kind) {
    if (!activeCourseId || selectedFiles.length === 0) return;
    setBusy(true);
    setStatus(kind === "homework" ? "Odev cozumu hazirlaniyor..." : "Konu anlatimi hazirlaniyor...");
    setError("");
    try {
      const result = await callGemini({
        apiKey: state.settings.geminiApiKey,
        model: resolvedModel,
        prompt: kind === "homework" ? buildHomeworkPrompt(state.settings) : buildTopicPrompt(state.settings),
        files: selectedFiles
      });
      const entry = {
        id: uid(),
        courseId: activeCourseId,
        kind,
        title: kind === "homework" ? "Cozumlu Odev" : "Konu Anlatimi",
        sourceFiles: selectedFiles.map((file) => file.name),
        output: result.text,
        usedModel: result.usedModel,
        createdAt: new Date().toISOString()
      };
      setState((current) => ({ ...current, entries: [entry, ...current.entries] }));
      setSelectedFiles([]);
      setViewerItem({ ...entry, kindLabel: kind === "homework" ? "Odev Cozumu" : "Konu Anlatimi" });
      setStatus(`${kind === "homework" ? "Cozumlu odev" : "Konu anlatimi"} olusturuldu.${result.fallbackUsed ? ` Kullanilan model: ${result.usedModel}.` : ""}`);
    } catch (err) {
      setError(err.message);
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function createExam() {
    if (!activeCourseId || (selectedFiles.length === 0 && selectedEntryIds.length === 0)) return;
    setBusy(true);
    setStatus("Sinav seti olusturuluyor...");
    setError("");
    try {
      const pickedEntries = courseEntries.filter((entry) => selectedEntryIds.includes(entry.id));
      const contextText = pickedEntries.map((entry) => `Baslik: ${entry.title}\n${entry.output}`).join("\n\n---\n\n");
      const result = await callGemini({
        apiKey: state.settings.geminiApiKey,
        model: resolvedModel,
        prompt: buildExamPrompt(state.settings, contextText),
        files: selectedFiles
      });
      const exam = {
        id: uid(),
        courseId: activeCourseId,
        title: `Sinav Seti ${courseExams.length + 1}`,
        output: result.text,
        usedModel: result.usedModel,
        sourceFiles: selectedFiles.map((file) => file.name),
        sourceEntryIds: selectedEntryIds,
        createdAt: new Date().toISOString()
      };
      setState((current) => ({ ...current, exams: [exam, ...current.exams] }));
      setSelectedFiles([]);
      setSelectedEntryIds([]);
      setViewerItem({ ...exam, kindLabel: "Sinav Hazirligi" });
      setStatus(`Sinav seti hazir.${result.fallbackUsed ? ` Kullanilan model: ${result.usedModel}.` : ""}`);
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
      const updated = existing ? { ...existing, messages: nextMessages } : { id: uid(), courseId: activeCourseId, messages: nextMessages };
      return { ...current, chats: existing ? current.chats.map((chat) => (chat.courseId === activeCourseId ? updated : chat)) : [updated, ...current.chats] };
    });

    setChatInput("");
    setBusy(true);
    setStatus("Sohbet yaniti hazirlaniyor...");
    setError("");

    try {
      const result = await callGemini({
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
      const modelMessage = {
        id: uid(),
        role: "model",
        text: result.text,
        usedModel: result.usedModel,
        createdAt: new Date().toISOString()
      };
      setState((current) => ({
        ...current,
        chats: current.chats.map((chat) =>
          chat.courseId === activeCourseId ? { ...chat, messages: [...chat.messages, modelMessage] } : chat
        )
      }));
      setStatus(`Yanit hazir.${result.fallbackUsed ? ` Kullanilan model: ${result.usedModel}.` : ""}`);
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
        setState({ ...defaultState, ...parsed, settings: { ...defaultState.settings, ...(parsed.settings || {}) } });
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
          <div className="archive-list">
            {state.courses.length === 0 && <p className="empty">Baslamak icin soldan yeni bir ders ac.</p>}
            {state.courses.map((course) => (
              <button
                key={course.id}
                className={`archive-item ${activeCourseId === course.id ? "active" : ""}`}
                onClick={() => {
                  setActiveCourseId(course.id);
                  setSelectedEntryIds([]);
                }}
              >
                <strong>{course.title}</strong>
                <div className="archive-meta">
                  <span>{formatDate(course.createdAt)}</span>
                  <span>{state.entries.filter((entry) => entry.courseId === course.id).length} icerik</span>
                </div>
                <span className="delete-link" onClick={(event) => { event.stopPropagation(); removeCourse(course.id); }}>Dersi sil</span>
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
            <div className="lang-pill">{state.settings.sourceLanguage} {"->"} {state.settings.targetLanguage}</div>
            <div className="tab-strip">
              {[
                ["homework", "Odev Cozumu"],
                ["topic", "Konu Anlatimi"],
                ["exam", "Sinav Hazirligi"],
                ["chat", "Sohbet"]
              ].map((item) => (
                <button key={item[0]} className={activeTab === item[0] ? "tab active" : "tab"} onClick={() => setActiveTab(item[0])}>
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
              <p className="section-copy">Yukledigin sayfalari ayni akisla, cozumleri dogru yerde olacak sekilde hazirlar.</p>
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
            <ArchiveList title="Odev Arsivi" items={homeworkEntries} onOpen={setViewerItem} emptyText="Bu derste henuz cozumlu odev yok." />
          </section>
        )}

        {activeCourse && activeTab === "topic" && (
          <section className="workspace-grid">
            <div className="panel emphasis">
              <div className="panel-title">Konu Anlatimi</div>
              <p className="section-copy">Baslikli, ozetli ve daha okunabilir bolumlere ayrilmis anlatim olusturur.</p>
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
            <ArchiveList title="Anlatim Arsivi" items={topicEntries} onOpen={setViewerItem} emptyText="Bu derste henuz konu anlatimi yok." />
          </section>
        )}

        {activeCourse && activeTab === "exam" && (
          <section className="workspace-grid">
            <div className="panel emphasis">
              <div className="panel-title">Sinav Hazirligi</div>
              <p className="section-copy">Yeni dosya yukleyebilir veya onceki icerikleri secip sinav seti olusturabilirsin.</p>
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
                          event.target.checked ? [...current, entry.id] : current.filter((id) => id !== entry.id)
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
            <ArchiveList title="Sinav Arsivi" items={courseExams} onOpen={setViewerItem} emptyText="Bu derste henuz sinav seti yok." />
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
                    <strong>{message.role === "user" ? "Sen" : `AI (${message.usedModel || resolvedModel})`}</strong>
                    <p>{message.text}</p>
                  </div>
                ))}
              </div>
              <textarea rows="5" value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Dersle ilgili soru sor..." />
              <button className="primary" disabled={busy} onClick={sendChatMessage}>
                {busy ? "Gonderiliyor..." : "Mesaji Gonder"}
              </button>
            </div>
          </section>
        )}

        {(status || error) && <div className={error ? "status error" : "status"}>{error || status}</div>}
      </main>

      <ContentViewer
        item={viewerItem}
        onClose={() => { setViewerItem(null); setViewerFullScreen(false); }}
        fullScreen={viewerFullScreen}
        onToggleFullScreen={() => setViewerFullScreen((current) => !current)}
      />

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
                <input value={state.settings.customModel} onChange={(event) => updateSettings({ customModel: event.target.value })} placeholder="API model kimligini buraya yaz" />
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
