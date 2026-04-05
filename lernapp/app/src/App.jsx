import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "ausbildung-webapp-v3";

const MODEL_OPTIONS = [
  ["gemini-3.1-flash-lite-preview", "Gemini 3.1 Flash Lite"],
  ["gemini-3-flash-preview", "Gemini 3 Flash"],
  ["gemini-2.5-flash", "Gemini 2.5 Flash"],
  ["gemini-2.5-flash-lite", "Gemini 2.5 Flash Lite"],
  ["custom", "Ozel Model Kimligi"]
];

const defaultState = {
  settings: {
    geminiApiKey: "",
    sourceLanguage: "Almanca",
    targetLanguage: "Turkce",
    model: "gemini-3.1-flash-lite-preview",
    customModel: ""
  },
  courses: [],
  entries: [],
  exams: [],
  chats: []
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function extractTitle(text, fallback) {
  const firstHeading = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("# "));
  return firstHeading ? firstHeading.replace(/^#\s+/, "").trim() : fallback;
}

function createChatTitle(text, count = 1) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return `Sohbet ${count}`;
  const words = cleaned.split(" ").slice(0, 6).join(" ");
  return words.length > 42 ? `${words.slice(0, 42)}...` : words;
}

function parseChatPayload(text, fallbackTitle) {
  try {
    const clean = String(text).replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (parsed && typeof parsed.answer === "string") {
      return {
        title: String(parsed.title || fallbackTitle || "Sohbet").trim(),
        answer: parsed.answer.trim()
      };
    }
  } catch {}
  return {
    title: fallbackTitle || createChatTitle(text),
    answer: String(text || "").trim()
  };
}

function parseExamJson(text) {
  try {
    const clean = String(text).replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (parsed && Array.isArray(parsed.questions)) return parsed;
    return null;
  } catch {
    return null;
  }
}

function renderInlineMarkup(text) {
  const parts = String(text || "").split(/(\*\*.*?\*\*)/g);
  return parts.map((part, partIndex) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={partIndex} className="rt-strong">{part.slice(2, -2)}</strong>
      : <span key={partIndex}>{part}</span>
  );
}

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
    return `${model} modeli şu anda yoğun. Uygulama otomatik olarak yedek modele geçmeyi dener.`;
  }
  if (lowered.includes("quota")) {
    return `${model} için kota dolu veya bu anahtarla erişim yok.`;
  }
  if (lowered.includes("not found") || lowered.includes("not supported")) {
    return `${model} modeli bulunamadı. Özel model kimliğini kontrol et.`;
  }
  if (lowered.includes("api key")) {
    return "API anahtarı geçersiz veya eksik.";
  }
  return text || "Gemini isteği sırasında bir hata oluştu.";
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
  if (!apiKey) throw new Error("Gemini API anahtarı gerekli.");
  if (!model) throw new Error("Geçerli bir model seçilmedi.");

  const shouldStayOnSelectedModel =
    model === "gemini-3.1-flash-lite-preview" || model === "custom";

  const candidates = shouldStayOnSelectedModel
    ? [model]
    : [model, "gemini-3.1-flash-lite-preview", "gemini-3-flash-preview", "gemini-2.5-flash"]
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
    const correctOptionMatch = trimmed.match(/^(?:\[(?:x|X)\]|[◉●⊙]|✅)\s*(.+)$/);
    const wrongOptionMatch = trimmed.match(/^(?:\[\s\]|[○◌◯])\s*(.+)$/);
    const reasonMatch = trimmed.match(/^(Dogru cevap neden dogru|Dogru cevap aciklamasi|Aciklama|Neden)\s*:\s*(.+)$/i);
    const wrongReasonMatch = trimmed.match(/^(Diger siklar neden yanlis|Yanlis secenekler)\s*:\s*(.+)$/i);
    const progressMatch = trimmed.match(/^\d+\s*\/\s*\d+$/);
    const categoryMatch = trimmed.match(/^Kategori\s*:\s*(.+)$/i);

    if (!trimmed) return <div key={index} className="rt-space" />;
    if (trimmed.startsWith("# ")) return <h1 key={index} className="rt-h1">{trimmed.slice(2)}</h1>;
    if (trimmed.startsWith("## ")) return <h2 key={index} className="rt-h2">{trimmed.slice(3)}</h2>;
    if (trimmed.startsWith("### ")) return <h3 key={index} className="rt-h3">{trimmed.slice(4)}</h3>;
    if (progressMatch) return <div key={index} className="rt-chip">{trimmed}</div>;
    if (categoryMatch) return <div key={index} className="rt-meta-line"><strong>Kategori:</strong> {renderInlineMarkup(categoryMatch[1])}</div>;
    if (correctOptionMatch) {
      return (
        <div key={index} className="rt-option rt-option-correct">
          <span className="rt-option-indicator">Dogru</span>
          <div className="rt-option-text">{renderInlineMarkup(correctOptionMatch[1])}</div>
        </div>
      );
    }
    if (wrongOptionMatch) {
      return (
        <div key={index} className="rt-option">
          <span className="rt-option-indicator muted">Secenek</span>
          <div className="rt-option-text">{renderInlineMarkup(wrongOptionMatch[1])}</div>
        </div>
      );
    }
    if (reasonMatch) {
      return (
        <div key={index} className="rt-note rt-note-correct">
          <strong>{reasonMatch[1]}:</strong> {renderInlineMarkup(reasonMatch[2])}
        </div>
      );
    }
    if (wrongReasonMatch) {
      return (
        <div key={index} className="rt-note rt-note-wrong">
          <strong>{wrongReasonMatch[1]}:</strong> {renderInlineMarkup(wrongReasonMatch[2])}
        </div>
      );
    }
    if (/^\d+\.\s/.test(trimmed)) return <div key={index} className="rt-number">{trimmed}</div>;
    if (trimmed.startsWith("- ")) return <div key={index} className="rt-bullet">{trimmed.slice(2)}</div>;
    return (
      <p key={index} className="rt-p">
        {renderInlineMarkup(trimmed)}
      </p>
    );
  });
}

function buildHomeworkPrompt(settings) {
  return `GOREV: ODEV COZUMU (Almanca -> Turkce)
TALIMATLAR:
1. Gorselleri veya PDF sayfalarini analiz et.
2. BIREBIR SAYFA YAPISI: Orijinal sayfadaki basliklari, paragraflari ve duzeni koruyarak Markdown formatinda yeniden olustur.
3. COZUM ENTEGRASYONU: Sorularin oldugu yerlere cozumleri dogru noktada yerlestir.
4. KULLANICIYA sureci aciklama, "bunu yaptim" gibi meta yorumlar, markdown kisitlari, teknik notlar veya kontrol notlari yazma.
5. Coktan secmeli sorularda sadece dogru secenegi [x] ile, digerlerini [ ] ile isaretle.
6. Her sorudan hemen sonra en fazla 1-2 cumleyle "Dogru cevap neden dogru:" ve gerekiyorsa "Diger siklar neden yanlis:" satirlarini ekle.
7. Sadece cozumlu nihai icerigi ver.

CIKTI DUZENI:
# Baslik
## Sayfa 1
[Sayfanin cozumlu hali]
## Sayfa 2
[Sayfanin cozumlu hali]`;
}

function buildTopicPrompt(settings) {
  return `GOREV: KONU ANLATIMI (Turkce)
TALIMATLAR:
1. Icerigi detaylica ama temiz bir duzende anlat.
2. Asagidaki bolum basliklariyla ilerle:
   # Baslik
   ## Zusammenfassung
   ## Konu Ozeti
   ## Adim Adim Anlatim
   ## Onemli Terimler
   ## Kisa Tekrar
3. Onemli terimleri Almanca - Turkce seklinde yaz.
4. Onemli yerleri **kalin** yap.
5. Gorseldeki baglamdan kopma.`;
}

function buildTranslationPrompt(settings) {
  return `GOREV: BIREBIR CEVIRI (Almanca -> Turkce)
TALIMATLAR:
0. Ilk satirda, cevirinin ana fikrini yansitan kisa ve anlamli bir # Baslik yaz.
1. Gorselleri veya PDF sayfalarini analiz et.
2. ORIJINAL SAYFA YAPISI: Basliklari, alt basliklari, tablo akisini, soru siralarini, madde yapisini ve sayfa bolumlerini olabildigince ayni sirada koru.
3. METINLERI DOGRUDAN CEVIR: Icerigi ozetleme, yorumlama, sadeleştirme veya yeniden yazma yapma.
4. Tum Almanca icerigi Turkceye cevir.
5. KULLANICIYA sureci aciklama, "bunu yaptim" gibi meta yorumlar, teknik notlar veya kontrol notlari yazma.
6. Sadece nihai ceviri icerigini ver.

CIKTI DUZENI:
# Baslik
## Sayfa 1
[Sayfanin Turkce cevirisi]
## Sayfa 2
[Sayfanin Turkce cevirisi]`;
}

function buildExamPrompt(settings, contextText) {
  return `GOREV: SINAV HAZIRLIGI (Almanca sorular, Turkce tercume parantez icinde)
KULLANILACAK MALZEME:
${contextText || "Yuklenen dosyalar"}

TALIMATLAR:
1. Sinavda cikabilecek olabilecek en fazla soru cesidini kullan.
2. Coktan secmeli, dogru-yanlis, bosluk doldurma, acik uclu, eslestirme, mini vaka sorulari hazirla.
3. Sorular ve cevaplar ALMANCA olsun. Turkce tercumeleri parantez icinde ekle.
4. Her soru icin neden dogru oldugunu kisa acikla. Yanlis secenekler varsa neden yanlis olduklarini da kisa not olarak ekle.
5. CIKTIYI SADECE GECERLI JSON olarak ver.
6. Coktan secmeli sorularda sadece 1 dogru cevap olsun.
7. Aciklamalar kisa, net ve ogrenci dostu olsun.

FORMAT:
{
  "title": "Sinava uygun baslik",
  "questions": [
    {
      "type": "multiple_choice",
      "difficulty": "Kolay",
      "question_de": "Frage auf Deutsch",
      "question_tr": "Turkce ceviri",
      "options": [
        {
          "de": "Antwort A",
          "tr": "Cevap A",
          "isCorrect": false,
          "reason": "Kisa aciklama"
        }
      ],
      "answer_de": "Richtige Antwort",
      "answer_tr": "Dogru cevap cevirisi",
      "explanation": "Dogru cevabin kisa aciklamasi"
    }
  ]
}`;
}

function ArchiveList({ title, items, onOpen, onDelete, emptyText, activeId = null }) {
  return (
    <div className="panel archive-panel">
      <div className="panel-title">{title}</div>
      <div className="archive-list">
        {items.length === 0 && <p className="empty">{emptyText}</p>}
        {items.map((item) => (
          <button key={item.id} className={`archive-item ${activeId === item.id ? "active" : ""}`} onClick={() => onOpen(item)}>
            <strong>{item.title}</strong>
            <div className="archive-meta">
              <span>{formatDate(item.createdAt)}</span>
              <span>{item.usedModel || "-"}</span>
            </div>
            <span className="delete-link" onClick={(event) => { event.stopPropagation(); onDelete(item); }}>Sil</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ExamQuestion({ question, index }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="exam-question">
      <div className="exam-q-head">
        <strong>{index + 1}. {question.question_de}</strong>
        <span className="exam-tr">({question.question_tr})</span>
      </div>
      <div className="exam-options">
        {(question.options || []).map((option, optionIndex) => (
          <div key={optionIndex} className={`exam-option ${open && option.isCorrect ? "correct" : open ? "reviewed" : ""}`}>
            <div className="exam-option-row">
              <span className={`exam-choice-dot ${open && option.isCorrect ? "correct" : ""}`} />
              <div className="exam-option-main">{option.de}</div>
              {open && option.isCorrect && <span className="exam-correct-badge">Dogru</span>}
            </div>
            <div className="exam-tr">({option.tr})</div>
            {open && option.reason && (
              <div className={`exam-reason ${option.isCorrect ? "correct" : "wrong"}`}>
                {option.isCorrect ? "Neden dogru: " : "Neden degil: "}
                {option.reason}
              </div>
            )}
          </div>
        ))}
      </div>
      <button className="ghost" onClick={() => setOpen((current) => !current)}>
        {open ? "Cevabı Gizle" : "Cevabı Göster"}
      </button>
      {open && (
        <div className="exam-answer">
          <strong className="exam-answer-title">Dogru Cevap:</strong> {question.answer_de} <span className="exam-tr">({question.answer_tr})</span>
          <div className="exam-reason">{question.explanation}</div>
        </div>
      )}
    </div>
  );
}

function ContentViewer({ item, onClose, fullScreen, onToggleFullScreen }) {
  if (!item) return null;
  const examData = item.questions ? item : parseExamJson(item.output);
  return (
    <div className={fullScreen ? "viewer-overlay full" : "viewer-overlay"}>
      <div className={fullScreen ? "viewer-card full" : "viewer-card"}>
        <div className="viewer-top">
          <div>
            <h2>{item.title}</h2>
            <div className="viewer-meta">
              <span>{formatDate(item.createdAt)}</span>
              <span>{item.usedModel || "-"}</span>
              <span>{item.kindLabel || item.typeLabel || "İçerik"}</span>
            </div>
          </div>
          <div className="viewer-actions">
            <button className="ghost" onClick={onToggleFullScreen}>
              {fullScreen ? "Küçült" : "Büyüt"}
            </button>
            <button className="ghost" onClick={onClose}>Kapat</button>
          </div>
        </div>
        <div className="viewer-content">
          {examData ? (
            <div className="exam-view">
              {(examData.questions || []).map((question, index) => (
                <ExamQuestion key={index} question={question} index={index} />
              ))}
            </div>
          ) : (
            renderRichText(item.output)
          )}
        </div>
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
  const [activeChatId, setActiveChatId] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [chatFullScreen, setChatFullScreen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [viewerItem, setViewerItem] = useState(null);
  const [viewerFullScreen, setViewerFullScreen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

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
  const homeworkEntries = courseEntries.filter((entry) => entry.kind === "homework").map((entry) => ({ ...entry, kindLabel: "Ödev Çözümü" }));
  const topicEntries = courseEntries.filter((entry) => entry.kind === "topic").map((entry) => ({ ...entry, kindLabel: "Konu Anlatımı" }));
  const translationEntries = courseEntries.filter((entry) => entry.kind === "translation").map((entry) => ({ ...entry, kindLabel: "Çeviri" }));
  const courseExams = useMemo(
    () => state.exams.filter((exam) => exam.courseId === activeCourseId).map((exam) => ({ ...exam, kindLabel: "Sınav Hazırlığı" })),
    [state.exams, activeCourseId]
  );
  const courseChats = useMemo(
    () =>
      state.chats
        .filter((chat) => chat.courseId === activeCourseId)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .map((chat) => ({
          ...chat,
          title: chat.title || "İsimsiz Sohbet",
          usedModel: chat.lastUsedModel || "-",
          createdAt: chat.updatedAt || chat.createdAt
        })),
    [state.chats, activeCourseId]
  );
  const activeChat = useMemo(() => {
    if (!activeCourseId) return null;
    return courseChats.find((chat) => chat.id === activeChatId) || courseChats[0] || null;
  }, [courseChats, activeChatId, activeCourseId]);

  useEffect(() => {
    if (!activeCourseId) {
      setActiveChatId(null);
      return;
    }
    if (courseChats.length === 0) {
      setActiveChatId(null);
      return;
    }
    if (!courseChats.some((chat) => chat.id === activeChatId)) {
      setActiveChatId(courseChats[0].id);
    }
  }, [activeCourseId, courseChats, activeChatId]);

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
    setDeleteTarget({ id: courseId, collection: "courses" });
  }

  function startNewChat() {
    if (!activeCourseId) return;
    const newChat = {
      id: uid(),
      courseId: activeCourseId,
      title: `Sohbet ${courseChats.length + 1}`,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastUsedModel: ""
    };
    setState((current) => ({ ...current, chats: [newChat, ...current.chats] }));
    setActiveChatId(newChat.id);
    setChatInput("");
  }

  async function createEntry(kind) {
    if (!activeCourseId || selectedFiles.length === 0) return;
    setBusy(true);
    setStatus(
      kind === "homework"
        ? "Ödev çözümü hazırlanıyor..."
        : kind === "topic"
          ? "Konu anlatımı hazırlanıyor..."
          : "Çeviri hazırlanıyor..."
    );
    setError("");
    try {
      const result = await callGemini({
        apiKey: state.settings.geminiApiKey,
        model: resolvedModel,
        prompt:
          kind === "homework"
            ? buildHomeworkPrompt(state.settings)
            : kind === "topic"
              ? buildTopicPrompt(state.settings)
              : buildTranslationPrompt(state.settings),
        files: selectedFiles
      });
      const entry = {
        id: uid(),
        courseId: activeCourseId,
        kind,
        title: extractTitle(
          result.text,
          kind === "homework" ? "Çözümlü Ödev" : kind === "topic" ? "Konu Anlatımı" : "Çeviri"
        ),
        sourceFiles: selectedFiles.map((file) => file.name),
        output: result.text,
        usedModel: result.usedModel,
        createdAt: new Date().toISOString()
      };
      setState((current) => ({ ...current, entries: [entry, ...current.entries] }));
      setSelectedFiles([]);
      setViewerItem({
        ...entry,
        kindLabel: kind === "homework" ? "Ödev Çözümü" : kind === "topic" ? "Konu Anlatımı" : "Çeviri"
      });
      setStatus(
        `${kind === "homework" ? "Çözümlü ödev" : kind === "topic" ? "Konu anlatımı" : "Çeviri"} oluşturuldu.${result.fallbackUsed ? ` Kullanılan model: ${result.usedModel}.` : ""}`
      );
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
    setStatus("Sınav seti oluşturuluyor...");
    setError("");
    try {
      const pickedEntries = courseEntries.filter((entry) => selectedEntryIds.includes(entry.id));
      const contextText = pickedEntries.map((entry) => `Başlık: ${entry.title}\n${entry.output}`).join("\n\n---\n\n");
      const result = await callGemini({
        apiKey: state.settings.geminiApiKey,
        model: resolvedModel,
        prompt: buildExamPrompt(state.settings, contextText),
        files: selectedFiles
      });
      const exam = {
        id: uid(),
        courseId: activeCourseId,
        title: parseExamJson(result.text)?.title || `Sınav Seti ${courseExams.length + 1}`,
        output: result.text,
        questions: parseExamJson(result.text)?.questions || null,
        usedModel: result.usedModel,
        sourceFiles: selectedFiles.map((file) => file.name),
        sourceEntryIds: selectedEntryIds,
        createdAt: new Date().toISOString()
      };
      setState((current) => ({ ...current, exams: [exam, ...current.exams] }));
      setSelectedFiles([]);
      setSelectedEntryIds([]);
      setViewerItem({ ...exam, kindLabel: "Sınav Hazırlığı" });
      setStatus(`Sınav seti hazır.${result.fallbackUsed ? ` Kullanılan model: ${result.usedModel}.` : ""}`);
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
    const targetChatId = activeChat?.id || uid();
    const isNewChat = !activeChat?.id;
    const baseChat = activeChat || {
      id: targetChatId,
      courseId: activeCourseId,
      title: createChatTitle(text, courseChats.length + 1),
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastUsedModel: ""
    };
    const nextMessages = [...(baseChat.messages || []), userMessage];

    setState((current) => {
      const existing = current.chats.find((chat) => chat.id === targetChatId);
      const updated = existing
        ? { ...existing, messages: nextMessages, updatedAt: new Date().toISOString() }
        : { ...baseChat, messages: nextMessages, updatedAt: new Date().toISOString() };
      return {
        ...current,
        chats: existing
          ? current.chats.map((chat) => (chat.id === targetChatId ? updated : chat))
          : [updated, ...current.chats]
      };
    });
    if (isNewChat) setActiveChatId(targetChatId);

    setChatInput("");
    setBusy(true);
    setStatus("Sohbet yanıtı hazırlanıyor...");
    setError("");

    try {
      const result = await callGemini({
        apiKey: state.settings.geminiApiKey,
        model: resolvedModel,
        prompt: `Sen destekleyici bir Ausbildung asistanısın.
Mevcut ders: ${activeCourse?.title || ""}
Kaynak dil: ${state.settings.sourceLanguage}
Hedef dil: ${state.settings.targetLanguage}
Baglam:
${context || "Henüz analiz edilmiş materyal yok."}

Kullanici sorusu:
${text}

GOREV:
1. Kullanıcıya kısa, açık, pratik ve düzenli bir cevap ver.
2. Gerekirse kısa başlıklar, maddeler ve **kalın** vurgular kullan.
3. Önemli terimleri **kalın** yazarak öne çıkar.
4. Sohbetin ana fikrini yansıtan kısa bir başlık üret.
5. CIKTIYI SADECE GECERLI JSON olarak ver.

FORMAT:
{
  "title": "Sohbetin ana fikrini yansitan kisa baslik",
  "answer": "Kullaniciya verilecek markdown destekli cevap"
}`
      });
      const chatPayload = parseChatPayload(result.text, baseChat.title || createChatTitle(text, courseChats.length + 1));
      const modelMessage = {
        id: uid(),
        role: "model",
        text: chatPayload.answer,
        usedModel: result.usedModel,
        createdAt: new Date().toISOString()
      };
      setState((current) => ({
        ...current,
        chats: current.chats.map((chat) =>
          chat.id === targetChatId
            ? {
                ...chat,
                title: chatPayload.title || chat.title || createChatTitle(text, courseChats.length + 1),
                messages: [...chat.messages, modelMessage],
                updatedAt: new Date().toISOString(),
                lastUsedModel: result.usedModel
              }
            : chat
        )
      }));
      setStatus(`Yanıt hazır.${result.fallbackUsed ? ` Kullanılan model: ${result.usedModel}.` : ""}`);
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
        setError("İçe aktarma dosyası geçersiz.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.collection === "courses") {
      setState((current) => ({
        ...current,
        courses: current.courses.filter((course) => course.id !== deleteTarget.id),
        entries: current.entries.filter((entry) => entry.courseId !== deleteTarget.id),
        exams: current.exams.filter((exam) => exam.courseId !== deleteTarget.id),
        chats: current.chats.filter((chat) => chat.courseId !== deleteTarget.id)
      }));
      if (activeCourseId === deleteTarget.id) {
        setActiveCourseId(null);
      }
    }
    if (deleteTarget.collection === "entries") {
      setState((current) => ({
        ...current,
        entries: current.entries.filter((entry) => entry.id !== deleteTarget.id)
      }));
    }
    if (deleteTarget.collection === "exams") {
      setState((current) => ({
        ...current,
        exams: current.exams.filter((exam) => exam.id !== deleteTarget.id)
      }));
    }
    if (deleteTarget.collection === "chats") {
      setState((current) => ({
        ...current,
        chats: current.chats.filter((chat) => chat.id !== deleteTarget.id)
      }));
      if (activeChatId === deleteTarget.id) {
        setActiveChatId(null);
      }
    }
    if (viewerItem?.id === deleteTarget.id) {
      setViewerItem(null);
      setViewerFullScreen(false);
    }
    setDeleteTarget(null);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <p className="eyebrow">Mesleki Öğrenme Alanı</p>
          <h1>Ausbildung<span>Pro</span></h1>
          <p className="muted">Her ders için konu anlatımı, ödev çözümü, sohbet ve sınav hazırlığı alanları.</p>
          <div className="brand-actions">
            <button className="secondary wide" onClick={() => setShowSettings(true)}>Ayarlar</button>
          </div>
        </div>

        <div className="panel sidebar-panel">
          <div className="panel-title">Yeni Ders</div>
          <input value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} placeholder="Örn. WiSo" />
          <button className="primary compact" onClick={addCourse}>Dersi Ekle</button>
        </div>

        <div className="panel sidebar-panel">
          <div className="row between">
            <div className="panel-title">Derslerim</div>
            <span className="badge">{state.courses.length}</span>
          </div>
          <div className="archive-list">
            {state.courses.length === 0 && <p className="empty">Başlamak için soldan yeni bir ders aç.</p>}
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
                  <span>{state.entries.filter((entry) => entry.courseId === course.id).length} içerik</span>
                </div>
                <span className="icon-delete" onClick={(event) => { event.stopPropagation(); removeCourse(course.id); }} title="Dersi sil" aria-label="Dersi sil">🗑</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="content">
        <header className="hero-header">
          <div className="hero-copy">
            <p className="eyebrow">Çalışma Alanı</p>
            <h2>{activeCourse ? activeCourse.title : "Bir ders seç"}</h2>
            <p className="hero-subtitle">
              {activeCourse
                ? "Materyallerini tek yerde topla, içerik üret ve arşivden hızlıca geri aç."
                : "Bir ders seçerek ödev, konu anlatımı, sınav ve sohbet alanlarını kullanmaya başla."}
            </p>
          </div>
          <div className="top-actions">
            <div className="lang-pill">Almanca → Türkçe</div>
          </div>
        </header>

        {activeCourse && (
          <div className="workspace-nav">
            <div className="tab-strip">
              {[
                ["homework", "Ödev Çözümü"],
                ["topic", "Konu Anlatımı"],
                ["translation", "Çeviri"],
                ["exam", "Sınav Hazırlığı"],
                ["chat", "Sohbet"]
              ].map((item) => (
                <button key={item[0]} className={activeTab === item[0] ? "tab active" : "tab"} onClick={() => setActiveTab(item[0])}>
                  {item[1]}
                </button>
              ))}
            </div>
          </div>
        )}

        {!activeCourse && (
          <section className="welcome-card">
            <div className="welcome-copy">
              <div className="panel-title">Yeni Ders Oluştur</div>
              <p>Her ders açıldığında ödev çözümü, konu anlatımı, sohbet ve sınav hazırlığı alanları otomatik hazır olur.</p>
            </div>
          </section>
        )}

        {activeCourse && activeTab === "homework" && (
          <section className="workspace-grid">
            <div className="panel emphasis">
              <div className="panel-title">Ödev Çözümü</div>
              <p className="section-copy">Yüklediğin sayfaları aynı akışla, çözümleri doğru yerde olacak şekilde hazırlar.</p>
              <label>Dosya Yükle</label>
              <input type="file" multiple accept=".pdf,image/*" onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))} />
              <div className="file-list">
                {selectedFiles.length === 0 && <p className="empty">Henüz dosya seçmedin.</p>}
                {selectedFiles.map((file) => <div key={`${file.name}-${file.size}`} className="file-chip">{file.name}</div>)}
              </div>
              <button className="primary" disabled={busy} onClick={() => createEntry("homework")}>
                {busy ? "Hazırlanıyor..." : "Çözümlü Ödev Oluştur"}
              </button>
            </div>
            <ArchiveList title="Ödev Arşivi" items={homeworkEntries} onOpen={setViewerItem} onDelete={(item) => setDeleteTarget({ id: item.id, collection: "entries" })} emptyText="Bu derste henüz çözümlü ödev yok." />
          </section>
        )}

        {activeCourse && activeTab === "topic" && (
          <section className="workspace-grid">
            <div className="panel emphasis">
              <div className="panel-title">Konu Anlatımı</div>
              <p className="section-copy">Başlıklı, özetli ve daha okunabilir bölümlere ayrılmış anlatım oluşturur.</p>
              <label>Dosya Yükle</label>
              <input type="file" multiple accept=".pdf,image/*" onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))} />
              <div className="file-list">
                {selectedFiles.length === 0 && <p className="empty">Henüz dosya seçmedin.</p>}
                {selectedFiles.map((file) => <div key={`${file.name}-${file.size}`} className="file-chip">{file.name}</div>)}
              </div>
              <button className="primary" disabled={busy} onClick={() => createEntry("topic")}>
                {busy ? "Hazırlanıyor..." : "Konu Anlatımı Üret"}
              </button>
            </div>
            <ArchiveList title="Anlatım Arşivi" items={topicEntries} onOpen={setViewerItem} onDelete={(item) => setDeleteTarget({ id: item.id, collection: "entries" })} emptyText="Bu derste henüz konu anlatımı yok." />
          </section>
        )}

        {activeCourse && activeTab === "translation" && (
          <section className="workspace-grid">
            <div className="panel emphasis">
              <div className="panel-title">Çeviri</div>
              <p className="section-copy">Yüklediğin PDF veya görselleri sayfa düzenini koruyarak birebir Türkçeye çevirir.</p>
              <label>Dosya Yükle</label>
              <input type="file" multiple accept=".pdf,image/*" onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))} />
              <div className="file-list">
                {selectedFiles.length === 0 && <p className="empty">Henüz dosya seçmedin.</p>}
                {selectedFiles.map((file) => <div key={`${file.name}-${file.size}`} className="file-chip">{file.name}</div>)}
              </div>
              <button className="primary" disabled={busy} onClick={() => createEntry("translation")}>
                {busy ? "Hazırlanıyor..." : "Çeviriyi Oluştur"}
              </button>
            </div>
            <ArchiveList title="Çeviri Arşivi" items={translationEntries} onOpen={setViewerItem} onDelete={(item) => setDeleteTarget({ id: item.id, collection: "entries" })} emptyText="Bu derste henüz çeviri yok." />
          </section>
        )}

        {activeCourse && activeTab === "exam" && (
          <section className="workspace-grid">
            <div className="panel emphasis">
              <div className="panel-title">Sınav Hazırlığı</div>
              <p className="section-copy">Yeni dosya yükleyebilir veya önceki içerikleri seçip sınav seti oluşturabilirsin.</p>
              <label>Yeni Dosya Yükle</label>
              <input type="file" multiple accept=".pdf,image/*" onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))} />
              <label>Önceden Üretilen İçerikler</label>
              <div className="selection-list">
                {courseEntries.length === 0 && <p className="empty">Seçilebilir önceki içerik yok.</p>}
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
                {busy ? "Hazırlanıyor..." : "Sınav Seti Oluştur"}
              </button>
            </div>
            <ArchiveList title="Sınav Arşivi" items={courseExams} onOpen={setViewerItem} onDelete={(item) => setDeleteTarget({ id: item.id, collection: "exams" })} emptyText="Bu derste henüz sınav seti yok." />
          </section>
        )}

        {activeCourse && activeTab === "chat" && (
          <section className="workspace-grid chat-layout">
            <div className={`panel emphasis chat-panel ${chatFullScreen ? "chat-panel-full" : ""}`}>
              <div className="chat-toolbar">
                <div>
                  <div className="panel-title">Ders Sohbeti</div>
                  <p className="section-copy">Her sohbet ayrı bir oturum olarak kaydedilir. İstediğin zaman eski sohbetleri yeniden açabilirsin.</p>
                </div>
                <div className="chat-toolbar-actions">
                  <span className="source-pill">{resolvedModel || "Model seç"}</span>
                  <button className="secondary" onClick={startNewChat}>Yeni Sohbet</button>
                  <button className="ghost" onClick={() => setChatFullScreen((current) => !current)}>
                    {chatFullScreen ? "Küçült" : "Büyüt"}
                  </button>
                </div>
              </div>
              <div className="chat-box">
                {!activeChat && <p className="empty">Henüz sohbet yok. Yeni sohbet başlatarak başlayabilirsin.</p>}
                {activeChat && (activeChat.messages || []).length === 0 && <p className="empty">Bu sohbet henüz boş. İlk mesajını göndererek başlayabilirsin.</p>}
                {(activeChat?.messages || []).map((message) => (
                  <div key={message.id} className={`chat-message ${message.role === "user" ? "user" : "model"}`}>
                    <strong>{message.role === "user" ? "Sen" : `AI (${message.usedModel || resolvedModel})`}</strong>
                    <div className="chat-message-body">
                      {message.role === "user" ? <p>{message.text}</p> : renderRichText(message.text)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="chat-composer">
                <textarea rows="4" value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Dersle ilgili soru sor..." />
                <button className="primary" disabled={busy} onClick={sendChatMessage}>
                  {busy ? "Gönderiliyor..." : "Mesajı Gönder"}
                </button>
              </div>
            </div>
            <ArchiveList
              title="Sohbet Listesi"
              items={courseChats}
              onOpen={(item) => setActiveChatId(item.id)}
              onDelete={(item) => setDeleteTarget({ id: item.id, collection: "chats" })}
              emptyText="Bu derste henüz kayıtlı sohbet yok."
              activeId={activeChat?.id || null}
            />
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
            <label>Gemini API Anahtarı</label>
            <input type="password" value={state.settings.geminiApiKey} onChange={(event) => updateSettings({ geminiApiKey: event.target.value.trim() })} placeholder="API anahtarını gir" />
            <label>Model</label>
            <select value={state.settings.model} onChange={(event) => updateSettings({ model: event.target.value })}>
              {MODEL_OPTIONS.map((item) => <option key={item[0]} value={item[0]}>{item[1]}</option>)}
            </select>
            <p className="muted">
              Varsayılan model `Gemini 3.1 Flash Lite` olarak ayarlandı. Bu model seçiliyken uygulama sessizce başka modele geçmez; başarısız olursa doğrudan hata gösterir.
            </p>
            {state.settings.model === "custom" && (
              <>
                <label>Özel Model Kimliği</label>
                <input value={state.settings.customModel} onChange={(event) => updateSettings({ customModel: event.target.value })} placeholder="API model kimliğini buraya yaz" />
                <div className="field-grid">
                  <button className="ghost" onClick={() => updateSettings({ customModel: "gemini-3.1-flash-lite-preview" })}>3.1 Flash Lite Dene</button>
                  <button className="ghost" onClick={() => updateSettings({ customModel: "gemini-2.5-flash-lite" })}>2.5 Flash Lite Dene</button>
                </div>
              </>
            )}
            <div className="settings-tools">
              <button className="secondary" onClick={() => downloadJson("ausbildung-backup.json", state)}>Dışa Aktar</button>
              <label className="secondary file-button">İçe Aktar<input type="file" accept=".json" onChange={importData} /></label>
            </div>
            <p className="muted">Bu uygulama Almanca materyalleri Türkçe anlatım üzerine optimize edildi.</p>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Silmek istediğine emin misin?</h3>
            <p className="muted">Bu işlem geri alınamaz.</p>
            <div className="row">
              <button className="ghost" onClick={() => setDeleteTarget(null)}>Vazgeç</button>
              <button className="primary" onClick={confirmDelete}>Sil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
