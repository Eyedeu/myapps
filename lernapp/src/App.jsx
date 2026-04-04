import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "ausbildung-webapp-v1";
const GEMINI_API_KEY = "AIzaSyB1xn6hncf2TygWKFBWSdfZHdDdawkbDAo";

const defaultState = {
  settings: {
    sourceLanguage: "Almanca",
    targetLanguage: "Turkce"
  },
  courses: [],
  notes: [],
  chats: []
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      settings: {
        ...defaultState.settings,
        ...(parsed.settings || {})
      }
    };
  } catch {
    return defaultState;
  }
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
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
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1];
      resolve({
        inlineData: {
          mimeType: file.type || "application/octet-stream",
          data: base64
        }
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function callGemini({ apiKey, prompt, files = [] }) {
  if (!apiKey) {
    throw new Error("Gemini API anahtari gerekli.");
  }

  const fileParts = await Promise.all(files.map(fileToInlineData));
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }, ...fileParts]
          }
        ]
      })
    }
  );

  const data = await response.json();
  if (!response.ok) {
    const message =
      data?.error?.message || "Gemini istegi sirasinda bir hata olustu.";
    throw new Error(message);
  }

  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim() || ""
  );
}

function App() {
  const [state, setState] = useState(defaultState);
  const [activeCourseId, setActiveCourseId] = useState(null);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [tab, setTab] = useState("courses");
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

  useEffect(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const activeCourse = useMemo(
    () => state.courses.find((course) => course.id === activeCourseId) || null,
    [state.courses, activeCourseId]
  );

  const activeNote = useMemo(
    () => state.notes.find((note) => note.id === activeNoteId) || null,
    [state.notes, activeNoteId]
  );

  const courseNotes = useMemo(() => {
    if (!activeCourseId) return [];
    return state.notes.filter((note) => note.courseId === activeCourseId);
  }, [state.notes, activeCourseId]);

  const activeChat = useMemo(() => {
    if (!activeCourseId) return null;
    return (
      state.chats.find((chat) => chat.courseId === activeCourseId) || {
        id: null,
        courseId: activeCourseId,
        title: activeCourse?.title ? `${activeCourse.title} Sohbeti` : "Sohbet",
        messages: []
      }
    );
  }, [state.chats, activeCourseId, activeCourse?.title]);

  function updateSettings(patch) {
    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        ...patch
      }
    }));
  }

  function addCourse() {
    const title = courseTitle.trim();
    if (!title) return;
    const newCourse = {
      id: uid(),
      title,
      createdAt: new Date().toISOString()
    };
    setState((current) => ({
      ...current,
      courses: [newCourse, ...current.courses]
    }));
    setCourseTitle("");
    setActiveCourseId(newCourse.id);
    setTab("notes");
  }

  function addNote() {
    const title = noteTitle.trim();
    const body = noteBody.trim();
    if (!activeCourseId || (!title && !body)) return;
    const newNote = {
      id: uid(),
      courseId: activeCourseId,
      title: title || "Basliksiz Not",
      body,
      source: "manual",
      createdAt: new Date().toISOString()
    };
    setState((current) => ({
      ...current,
      notes: [newNote, ...current.notes]
    }));
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
      setTab("courses");
    }
  }

  function removeNote(noteId) {
    setState((current) => ({
      ...current,
      notes: current.notes.filter((note) => note.id !== noteId)
    }));
    if (activeNoteId === noteId) {
      setActiveNoteId(null);
    }
  }

  async function analyzeSelectedFiles() {
    if (!activeCourseId || selectedFiles.length === 0) return;
    setBusy(true);
    setError("");
    setStatus("Dosyalar analiz ediliyor...");

    const prompt =
      analysisMode === "homework"
        ? `Sen bir egitim asistani olarak yuklenen odevi analiz et.
Kaynak dil: ${state.settings.sourceLanguage}
Hedef dil: ${state.settings.targetLanguage}
Istenen cikti:
1. Baslik
2. Kisa ozet
3. Madde madde cozum veya aciklama
4. Gerekiyorsa tablo benzeri karsilastirmalar
Yaniti duz metin ve acik basliklarla ver.`
        : `Sen bir egitim asistani olarak yuklenen materyalden konu anlatimi hazirla.
Kaynak dil: ${state.settings.sourceLanguage}
Hedef dil: ${state.settings.targetLanguage}
Istenen cikti:
1. Konu ozeti
2. Temel kavramlar
3. Calisma ipuclari
4. Mini tekrar listesi
Yaniti duz metin ve anlasilir bolumlerle ver.`;

    try {
      const result = await callGemini({
        apiKey: GEMINI_API_KEY,
        prompt,
        files: selectedFiles
      });

      const newNote = {
        id: uid(),
        courseId: activeCourseId,
        title:
          analysisMode === "homework"
            ? "AI Odev Analizi"
            : "AI Konu Anlatimi",
        body: result,
        source: "ai",
        analysisMode,
        createdAt: new Date().toISOString()
      };

      setState((current) => ({
        ...current,
        notes: [newNote, ...current.notes]
      }));
      setActiveNoteId(newNote.id);
      setSelectedFiles([]);
      setStatus("Analiz tamamlandi.");
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

    const userMessage = {
      id: uid(),
      role: "user",
      text,
      createdAt: new Date().toISOString()
    };

    const context = courseNotes
      .slice(0, 6)
      .map((note) => `Baslik: ${note.title}\nIcerik:\n${note.body}`)
      .join("\n\n---\n\n");

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
          ? current.chats.map((chat) =>
              chat.courseId === activeCourseId ? updatedChat : chat
            )
          : [updatedChat, ...current.chats]
      };
    });

    setChatInput("");
    setBusy(true);
    setError("");
    setStatus("AI cevap hazirliyor...");

    try {
      const prompt = `Sen bir Ausbildung ogrenme asistani olarak cevap ver.
Kaynak dil: ${state.settings.sourceLanguage}
Hedef dil: ${state.settings.targetLanguage}
Mevcut ders: ${activeCourse?.title || "Belirsiz"}

Not baglami:
${context || "Henuz not yok."}

Kullanici mesaji:
${text}

Kisa, ogretici ve duzenli cevap ver.`;

      const answer = await callGemini({
        apiKey: GEMINI_API_KEY,
        prompt
      });

      const modelMessage = {
        id: uid(),
        role: "model",
        text: answer,
        createdAt: new Date().toISOString()
      };

      setState((current) => ({
        ...current,
        chats: current.chats.map((chat) =>
          chat.courseId === activeCourseId
            ? { ...chat, messages: [...chat.messages, modelMessage] }
            : chat
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
          settings: {
            ...defaultState.settings,
            ...(parsed.settings || {})
          }
        });
        setActiveCourseId(null);
        setActiveNoteId(null);
        setTab("courses");
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
        <div>
          <p className="eyebrow">GitHub Pages Uyumlu</p>
          <h1>Ausbildung Web App</h1>
          <p className="muted">
            Firebase kaldirildi. Tum veriler bu tarayicida saklanir.
          </p>
        </div>

        <div className="stack">
          <button className="primary" onClick={() => setShowSettings(true)}>
            Dil Ayarlari
          </button>
          <button
            className="secondary"
            onClick={() =>
              downloadJson("ausbildung-backup.json", {
                ...state,
                exportedAt: new Date().toISOString()
              })
            }
          >
            Verileri Disa Aktar
          </button>
          <label className="secondary file-button">
            Verileri Ice Aktar
            <input type="file" accept=".json" onChange={importData} />
          </label>
        </div>

        <div className="panel">
          <label>Ders Olustur</label>
          <input
            value={courseTitle}
            onChange={(event) => setCourseTitle(event.target.value)}
            placeholder="Orn. Rechnungswesen"
          />
          <button className="primary" onClick={addCourse}>
            Dersi Ekle
          </button>
        </div>

        <div className="panel">
          <div className="row between">
            <label>Dersler</label>
            <span className="badge">{state.courses.length}</span>
          </div>
          <div className="list">
            {state.courses.length === 0 && (
              <p className="empty">Henuz ders eklenmedi.</p>
            )}
            {state.courses.map((course) => (
              <button
                key={course.id}
                className={`course-item ${
                  activeCourseId === course.id ? "active" : ""
                }`}
                onClick={() => {
                  setActiveCourseId(course.id);
                  setTab("notes");
                }}
              >
                <span>{course.title}</span>
                <span
                  className="delete-link"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeCourse(course.id);
                  }}
                >
                  Sil
                </span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="content">
        <div className="topbar">
          <div>
            <p className="eyebrow">Calisma Alani</p>
            <h2>{activeCourse ? activeCourse.title : "Bir ders sec"}</h2>
          </div>
          <div className="row">
            <button
              className={tab === "notes" ? "tab active" : "tab"}
              onClick={() => setTab("notes")}
            >
              Notlar
            </button>
            <button
              className={tab === "analyze" ? "tab active" : "tab"}
              onClick={() => setTab("analyze")}
            >
              AI Analiz
            </button>
            <button
              className={tab === "chat" ? "tab active" : "tab"}
              onClick={() => setTab("chat")}
            >
              Sohbet
            </button>
          </div>
        </div>

        {!activeCourse && (
          <section className="hero">
            <h3>Baslamak icin soldan bir ders olustur.</h3>
            <p>
              API anahtarini ayarladiktan sonra PDF veya gorsel yukleyip AI
              analizi yapabilir, notlar uretebilir ve ders bazli sohbet
              kullanabilirsin.
            </p>
          </section>
        )}

        {activeCourse && tab === "notes" && (
          <section className="grid-two">
            <div className="panel">
              <label>Yeni Not</label>
              <input
                value={noteTitle}
                onChange={(event) => setNoteTitle(event.target.value)}
                placeholder="Not basligi"
              />
              <textarea
                rows="10"
                value={noteBody}
                onChange={(event) => setNoteBody(event.target.value)}
                placeholder="Ders notunu buraya yaz..."
              />
              <button className="primary" onClick={addNote}>
                Notu Kaydet
              </button>
            </div>

            <div className="panel">
              <div className="row between">
                <label>Not Listesi</label>
                <span className="badge">{courseNotes.length}</span>
              </div>
              <div className="list">
                {courseNotes.length === 0 && (
                  <p className="empty">Bu derste henuz not yok.</p>
                )}
                {courseNotes.map((note) => (
                  <button
                    key={note.id}
                    className={`note-card ${
                      activeNoteId === note.id ? "active" : ""
                    }`}
                    onClick={() => setActiveNoteId(note.id)}
                  >
                    <strong>{note.title}</strong>
                    <span>{note.source === "ai" ? "AI" : "Manuel"} not</span>
                    <span className="preview">{note.body.slice(0, 140)}</span>
                    <span
                      className="delete-link"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeNote(note.id);
                      }}
                    >
                      Sil
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel full">
              <div className="row between">
                <label>Secili Not</label>
                <span className="badge">
                  {activeNote ? new Date(activeNote.createdAt).toLocaleString() : "-"}
                </span>
              </div>
              <article className="note-output">
                {activeNote ? (
                  <pre>{activeNote.body}</pre>
                ) : (
                  <p className="empty">Goruntulemek icin bir not sec.</p>
                )}
              </article>
            </div>
          </section>
        )}

        {activeCourse && tab === "analyze" && (
          <section className="grid-two">
            <div className="panel">
              <label>Analiz Turu</label>
              <select
                value={analysisMode}
                onChange={(event) => setAnalysisMode(event.target.value)}
              >
                <option value="homework">Odev Cozumu</option>
                <option value="topic">Konu Anlatimi</option>
              </select>

              <label>Dosya Yukle</label>
              <input
                type="file"
                multiple
                accept=".pdf,image/*"
                onChange={(event) =>
                  setSelectedFiles(Array.from(event.target.files || []))
                }
              />

              <div className="file-list">
                {selectedFiles.length === 0 && (
                  <p className="empty">PDF veya gorsel secilmedi.</p>
                )}
                {selectedFiles.map((file) => (
                  <div key={`${file.name}-${file.size}`} className="file-chip">
                    {file.name}
                  </div>
                ))}
              </div>

              <button className="primary" onClick={analyzeSelectedFiles} disabled={busy}>
                Analizi Baslat
              </button>
            </div>

            <div className="panel">
              <label>Bu Surumde Ne Degisti?</label>
              <ul className="plain-list">
                <li>Firebase baglantisi kaldirildi.</li>
                <li>Kayitlar tarayici icindeki localStorage alaninda tutulur.</li>
                <li>API anahtari kod icine yazilmaz, arayuzden girilir.</li>
                <li>GitHub Pages icin statik olarak derlenebilir.</li>
              </ul>
            </div>
          </section>
        )}

        {activeCourse && tab === "chat" && (
          <section className="grid-two">
            <div className="panel full">
              <div className="chat-box">
                {(activeChat?.messages || []).length === 0 && (
                  <p className="empty">
                    Bu ders icin henuz sohbet yok. Ilk mesaji gonderebilirsin.
                  </p>
                )}
                {(activeChat?.messages || []).map((message) => (
                  <div
                    key={message.id}
                    className={`chat-message ${
                      message.role === "user" ? "user" : "model"
                    }`}
                  >
                    <strong>{message.role === "user" ? "Sen" : "AI"}</strong>
                    <p>{message.text}</p>
                  </div>
                ))}
              </div>
              <textarea
                rows="5"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Derse dair soru sor..."
              />
              <button className="primary" onClick={sendChatMessage} disabled={busy}>
                Mesaji Gonder
              </button>
            </div>
          </section>
        )}

        {(status || error) && (
          <div className={error ? "status error" : "status"}>
            {error || status}
          </div>
        )}
      </main>

      {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="row between">
              <h3>Dil Ayarlari</h3>
              <button className="ghost" onClick={() => setShowSettings(false)}>
                Kapat
              </button>
            </div>

            <label>Kaynak Dil</label>
            <select
              value={state.settings.sourceLanguage}
              onChange={(event) =>
                updateSettings({ sourceLanguage: event.target.value })
              }
            >
              <option>Almanca</option>
              <option>Ingilizce</option>
              <option>Turkce</option>
            </select>

            <label>Hedef Dil</label>
            <select
              value={state.settings.targetLanguage}
              onChange={(event) =>
                updateSettings({ targetLanguage: event.target.value })
              }
            >
              <option>Turkce</option>
              <option>Almanca</option>
              <option>Ingilizce</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
