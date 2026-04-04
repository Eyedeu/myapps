import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "ausbildung-webapp-v1";
const MODEL_OPTIONS = [
  ["gemini-3-flash-preview", "Gemini 3 Flash", "Resmi API model kodu dogrulanmis preview surumu"],
  ["gemini-3.1-flash-lite", "Gemini 3.1 Flash Lite", "AI Studio'daki kotaya gore uygun gorunen hafif model"],
  ["gemini-2.5-flash", "Gemini 2.5 Flash", "Hizli ve gunluk kullanim icin uygun"],
  ["gemini-2.5-pro", "Gemini 2.5 Pro", "Daha guclu ama kota kisitli olabilir"],
  ["gemma-3-27b-it", "Gemma 3 27B", "Alternatif metin modeli"],
  ["gemma-3-12b-it", "Gemma 3 12B", "Daha hafif alternatif model"],
  ["custom", "Ozel Model Kimligi", "AI Studio'da gordugun tam model adini elle girebilirsin"]
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
  notes: [],
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

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function fileToInlineData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      inlineData: {
        mimeType: file.type || "application/octet-stream",
        data: String(reader.result).split(",")[1]
      }
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeApiError(message, model) {
  const text = String(message || "");
  if (text.toLowerCase().includes("quota")) {
    return `${model} icin kota dolu veya bu key ile erisim yok. Ayarlardan Gemini 3 Flash, Gemini 3.1 Flash Lite ya da farkli bir model dene.`;
  }
  if (text.toLowerCase().includes("not found")) {
    return `${model} modeli bu API uzerinde bulunamadi. Ayarlardan farkli bir model sec.`;
  }
  if (text.toLowerCase().includes("api key")) {
    return "API anahtari gecersiz veya eksik. Ayarlardan yeniden gir.";
  }
  return text || "Gemini istegi sirasinda bir hata olustu.";
}

async function callGemini({ apiKey, prompt, files = [], model }) {
  if (!apiKey) throw new Error("Gemini API anahtari gerekli.");
  const fileParts = await Promise.all(files.map(fileToInlineData));
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, ...fileParts] }] })
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(normalizeApiError(data?.error?.message, model));
  }
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

function App() {
  const [state, setState] = useState(defaultState);
  const [activeCourseId, setActiveCourseId] = useState(null);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [tab, setTab] = useState("notes");
  const [showSettings, setShowSettings] = useState(false);
  const [courseTitle, setCourseTitle] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [analysisMode, setAnalysisMode] = useState("homework");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setState(loadState()), []);
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)), [state]);

  const activeCourse = useMemo(
    () => state.courses.find((course) => course.id === activeCourseId) || null,
    [state.courses, activeCourseId]
  );
  const activeNote = useMemo(
    () => state.notes.find((note) => note.id === activeNoteId) || null,
    [state.notes, activeNoteId]
  );
  const courseNotes = useMemo(
    () => state.notes.filter((note) => note.courseId === activeCourseId),
    [state.notes, activeCourseId]
  );
  const activeChat = useMemo(() => {
    if (!activeCourseId) return null;
    return state.chats.find((chat) => chat.courseId === activeCourseId) || {
      id: null,
      courseId: activeCourseId,
      title: activeCourse?.title ? `${activeCourse.title} Sohbeti` : "Sohbet",
      messages: []
    };
  }, [state.chats, activeCourseId, activeCourse?.title]);

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
    setTab("notes");
  }

  function addNote() {
    if (!activeCourseId) return;
    const title = noteTitle.trim();
    const body = noteBody.trim();
    if (!title && !body) return;
    const newNote = {
      id: uid(),
      courseId: activeCourseId,
      title: title || "Basliksiz not",
      body,
      source: "manual",
      createdAt: new Date().toISOString()
    };
    setState((current) => ({ ...current, notes: [newNote, ...current.notes] }));
    setNoteTitle("");
    setNoteBody("");
    setActiveNoteId(newNote.id);
  }

  function removeCourse(courseId) {
    setState((current) => ({
      ...current,
      courses: current.courses.filter((course) => course.id !== courseId),
      notes: current.notes.filter((note) => note.courseId !== courseId),
      chats: current.chats.filter((chat) => chat.courseId !== courseId)
    }));
    if (activeCourseId === courseId) {
      setActiveCourseId(null);
      setActiveNoteId(null);
    }
  }

  function removeNote(noteId) {
    setState((current) => ({ ...current, notes: current.notes.filter((note) => note.id !== noteId) }));
    if (activeNoteId === noteId) setActiveNoteId(null);
  }

  async function analyzeSelectedFiles() {
    if (!activeCourseId || selectedFiles.length === 0) return;
    setBusy(true);
    setError("");
    setStatus("Dosyalar analiz ediliyor...");
    const prompt = analysisMode === "homework"
      ? `Sen bir mesleki egitim asistani olarak yuklenen odevi analiz et.
Kaynak dil: ${state.settings.sourceLanguage}
Hedef dil: ${state.settings.targetLanguage}
Bolumler:
1. Kisa baslik
2. Ozet
3. Adim adim cozum veya aciklama
4. Onemli kavramlar
Yaniti temiz ve okunakli ver.`
      : `Sen bir mesleki egitim asistani olarak yuklenen materyalden konu anlatimi hazirla.
Kaynak dil: ${state.settings.sourceLanguage}
Hedef dil: ${state.settings.targetLanguage}
Bolumler:
1. Konu ozeti
2. Ana kavramlar
3. Calisma ipuclari
4. Kisa tekrar listesi
Yaniti temiz ve okunakli ver.`;
    try {
      const result = await callGemini({
        apiKey: state.settings.geminiApiKey,
        prompt,
        files: selectedFiles,
        model: resolvedModel
      });
      const newNote = {
        id: uid(),
        courseId: activeCourseId,
        title: analysisMode === "homework" ? "AI Odev Analizi" : "AI Konu Anlatimi",
        body: result,
        source: "ai",
        createdAt: new Date().toISOString()
      };
      setState((current) => ({ ...current, notes: [newNote, ...current.notes] }));
      setActiveNoteId(newNote.id);
      setSelectedFiles([]);
      setStatus("Analiz tamamlandi.");
      setTab("notes");
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
    const context = courseNotes.slice(0, 6).map((note) => `Baslik: ${note.title}\n${note.body}`).join("\n\n---\n\n");
    const nextMessages = [...(activeChat?.messages || []), userMessage];

    setState((current) => {
      const existing = current.chats.find((chat) => chat.courseId === activeCourseId);
      const updatedChat = existing
        ? { ...existing, messages: nextMessages }
        : {
            id: uid(),
            courseId: activeCourseId,
            title: activeCourse?.title ? `${activeCourse.title} Sohbeti` : "Sohbet",
            createdAt: new Date().toISOString(),
            messages: nextMessages
          };
      return {
        ...current,
        chats: existing
          ? current.chats.map((chat) => (chat.courseId === activeCourseId ? updatedChat : chat))
          : [updatedChat, ...current.chats]
      };
    });

    setChatInput("");
    setBusy(true);
    setError("");
    setStatus("AI cevap hazirliyor...");
    try {
      const answer = await callGemini({
        apiKey: state.settings.geminiApiKey,
        model: resolvedModel,
        prompt: `Sen bir Ausbildung ogrenme asistani olarak cevap ver.
Kaynak dil: ${state.settings.sourceLanguage}
Hedef dil: ${state.settings.targetLanguage}
Mevcut ders: ${activeCourse?.title || "Belirsiz"}

Not baglami:
${context || "Henuz not yok."}

Kullanici mesaji:
${text}`
      });
      const modelMessage = { id: uid(), role: "model", text: answer, createdAt: new Date().toISOString() };
      setState((current) => ({
        ...current,
        chats: current.chats.map((chat) =>
          chat.courseId === activeCourseId ? { ...chat, messages: [...chat.messages, modelMessage] } : chat
        )
      }));
      setStatus("AI cevabi eklendi.");
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
        setActiveCourseId(null);
        setActiveNoteId(null);
      } catch {
        setError("Ice aktarma dosyasi gecersiz.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  const activeModelMeta = MODEL_OPTIONS.find((item) => item[0] === state.settings.model);
  const resolvedModel = state.settings.model === "custom"
    ? state.settings.customModel.trim()
    : state.settings.model;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <p className="eyebrow">Ausbildung Workspace</p>
          <h1>Ausbildung<span>Pro</span></h1>
          <p className="muted">Derslerini, notlarini ve AI destekli analizlerini tek yerde tut.</p>
        </div>

        <div className="toolbar-grid">
          <button className="primary wide" onClick={() => setShowSettings(true)}>API ve Dil Ayarlari</button>
          <button className="secondary" onClick={() => downloadJson("ausbildung-backup.json", { ...state, exportedAt: new Date().toISOString() })}>Disa Aktar</button>
          <label className="secondary file-button">Ice Aktar<input type="file" accept=".json" onChange={importData} /></label>
        </div>

        <div className="panel sidebar-panel">
          <div className="panel-title">Yeni Ders</div>
          <input value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} placeholder="Orn. Rechnungswesen" />
          <button className="primary" onClick={addCourse}>Dersi Ekle</button>
        </div>

        <div className="panel sidebar-panel">
          <div className="row between">
            <div className="panel-title">Derslerim</div>
            <span className="badge">{state.courses.length}</span>
          </div>
          <div className="list course-list">
            {state.courses.length === 0 && <p className="empty">Baslamak icin ilk dersini olustur.</p>}
            {state.courses.map((course) => (
              <button key={course.id} className={`course-item ${activeCourseId === course.id ? "active" : ""}`} onClick={() => { setActiveCourseId(course.id); setTab("notes"); }}>
                <div className="row between full-width">
                  <strong>{course.title}</strong>
                  <span className="meta-date">{formatDate(course.createdAt)}</span>
                </div>
                <span className="preview">{state.notes.filter((note) => note.courseId === course.id).length} not</span>
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
            <div className="lang-pill">{state.settings.sourceLanguage} → {state.settings.targetLanguage}</div>
            <div className="tab-strip">
              {["notes", "analyze", "chat"].map((item) => (
                <button key={item} className={tab === item ? "tab active" : "tab"} onClick={() => setTab(item)}>
                  {item === "notes" ? "Notlar" : item === "analyze" ? "AI Analiz" : "Sohbet"}
                </button>
              ))}
            </div>
          </div>
        </header>

        {!activeCourse && (
          <section className="welcome-card">
            <div className="welcome-copy">
              <div className="panel-title">Yeni Ders Olustur</div>
              <p>Sol panelden bir ders ac, sonra notlarini ekle veya PDF ve gorselleri AI ile analiz et.</p>
            </div>
          </section>
        )}

        {activeCourse && tab === "notes" && (
          <section className="workspace-grid">
            <div className="panel emphasis">
              <div className="panel-title">Yeni Not</div>
              <input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} placeholder="Not basligi" />
              <textarea rows="9" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="Ders notunu buraya yaz..." />
              <button className="primary" onClick={addNote}>Notu Kaydet</button>
            </div>

            <div className="panel">
              <div className="row between">
                <div className="panel-title">Tum Notlar</div>
                <span className="badge">{courseNotes.length}</span>
              </div>
              <div className="list note-list">
                {courseNotes.length === 0 && <p className="empty">Bu ders icin henuz not olusturulmamis.</p>}
                {courseNotes.map((note) => (
                  <button key={note.id} className={`note-card ${activeNoteId === note.id ? "active" : ""}`} onClick={() => setActiveNoteId(note.id)}>
                    <div className="row between full-width">
                      <strong>{note.title}</strong>
                      <span className="source-pill">{note.source === "ai" ? "AI" : "Not"}</span>
                    </div>
                    <span className="preview">{note.body.slice(0, 150)}</span>
                    <div className="row between full-width">
                      <span className="meta-date">{formatDate(note.createdAt)}</span>
                      <span className="delete-link" onClick={(event) => { event.stopPropagation(); removeNote(note.id); }}>Sil</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel full">
              <div className="row between">
                <div className="panel-title">Secili Not</div>
                <span className="meta-date">{activeNote ? formatDate(activeNote.createdAt) : "Bir not sec"}</span>
              </div>
              <article className="note-output">{activeNote ? <pre>{activeNote.body}</pre> : <p className="empty">Not secilmedi.</p>}</article>
            </div>
          </section>
        )}

        {activeCourse && tab === "analyze" && (
          <section className="workspace-grid">
            <div className="panel emphasis">
              <div className="panel-title">AI Analiz</div>
              <div className="field-grid">
                <div>
                  <label>Analiz Turu</label>
                  <select value={analysisMode} onChange={(event) => setAnalysisMode(event.target.value)}>
                    <option value="homework">Odev Cozumu</option>
                    <option value="topic">Konu Anlatimi</option>
                  </select>
                </div>
                <div>
                  <label>Model</label>
                  <select value={state.settings.model} onChange={(event) => updateSettings({ model: event.target.value })}>
                    {MODEL_OPTIONS.map((option) => <option key={option[0]} value={option[0]}>{option[1]}</option>)}
                  </select>
                </div>
              </div>
              {state.settings.model === "custom" && (
                <>
                  <label>Ozel Model Kimligi</label>
                  <input
                    value={state.settings.customModel}
                    onChange={(event) => updateSettings({ customModel: event.target.value })}
                    placeholder="Orn. gemini-3.1-flash-lite"
                  />
                </>
              )}
              <label>Dosya Yukle</label>
              <input type="file" multiple accept=".pdf,image/*" onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))} />
              <div className="file-list">
                {selectedFiles.length === 0 && <p className="empty">PDF veya gorsel secmedin.</p>}
                {selectedFiles.map((file) => <div key={`${file.name}-${file.size}`} className="file-chip">{file.name}</div>)}
              </div>
              <button className="primary" onClick={analyzeSelectedFiles} disabled={busy}>{busy ? "Analiz suruyor..." : "Analizi Baslat"}</button>
            </div>

            <div className="panel">
              <div className="panel-title">Model Durumu</div>
              <div className="tip-card">
                <strong>{activeModelMeta?.[1]}</strong>
                <p>{activeModelMeta?.[2]}</p>
              </div>
              <ul className="plain-list">
                <li>Varsayilan model artik Gemini 3 Flash oldu.</li>
                <li>3.1 Flash Lite icin AI Studio'da gordugun model adi farkliysa ozel model kullanabilirsin.</li>
                <li>Secilen model dogrudan API isteginde kullanilir.</li>
              </ul>
            </div>
          </section>
        )}

        {activeCourse && tab === "chat" && (
          <section className="workspace-grid">
            <div className="panel full emphasis">
              <div className="row between">
                <div className="panel-title">Ders Sohbeti</div>
                <span className="source-pill">{activeModelMeta?.[1]}</span>
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
              <textarea rows="5" value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Derse dair soru sor..." />
              <button className="primary" onClick={sendChatMessage} disabled={busy}>{busy ? "Gonderiliyor..." : "Mesaji Gonder"}</button>
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
            <label>Kullanilacak Model</label>
            <select value={state.settings.model} onChange={(event) => updateSettings({ model: event.target.value })}>
              {MODEL_OPTIONS.map((option) => <option key={option[0]} value={option[0]}>{option[1]}</option>)}
            </select>
            {state.settings.model === "custom" && (
              <>
                <label>Ozel Model Kimligi</label>
                <input
                  value={state.settings.customModel}
                  onChange={(event) => updateSettings({ customModel: event.target.value })}
                  placeholder="Orn. gemini-3.1-flash-lite"
                />
              </>
            )}
            <p className="help">Varsayilan model Gemini 3 Flash yapildi. 3.1 Flash Lite veya baska bir model ismi senden farkli gorunuyorsa ozel model alaniyla elle girebilirsin.</p>
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
