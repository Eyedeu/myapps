import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BadgePlus,
  BookOpen,
  BrainCircuit,
  Camera,
  Check,
  ChevronRight,
  Download,
  Eraser,
  ExternalLink,
  ImagePlus,
  Info,
  Loader2,
  PencilLine,
  RefreshCw,
  Save,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  Wrench,
  X,
} from "lucide-react";

const STORAGE_KEYS = {
  apiKey: "autoteile.apiKey",
  dictionary: "autoteile.dictionary",
  sellerId: "autoteile.sellerId",
};

const TABS = [
  { id: "studio", label: "Stüdyo", icon: BrainCircuit },
  { id: "camera", label: "Kamera", icon: Camera },
  { id: "dictionary", label: "Sözlük", icon: BookOpen },
  { id: "settings", label: "Ayarlar", icon: Settings },
];

const PART_SYSTEMS = [
  "Motor",
  "Elektrik",
  "Soğutma",
  "Şanzıman",
  "Süspansiyon",
  "Fren",
  "Direksiyon",
  "Kaporta",
  "İç Mekan",
  "Egzoz",
];

const DEFAULT_SELLER = "baytemuer";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readLocalStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function callGemini({ apiKey, model, payload }) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Gemini isteği başarısız oldu.");
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error("Gemini yanıtı boş döndü.");
  }

  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

async function analyzePartByName({ apiKey, query, context, count = 5 }) {
  const prompt = `
Sen deneyimli bir Alman oto yedek parça uzmanısın.
Kullanıcı girdisi: "${query}"
Ek bağlam: "${context || "Yok"}"

Sadece geçerli JSON dön. Markdown kullanma.
{
  "standardName": "Parçanın en doğru Almanca teknik adı",
  "alternativeNames": ["Toplam ${count} adet Almanca alternatif isim"],
  "category": "Türkçe kategori",
  "summary": "Türkçe kısa özet",
  "function": "Türkçe detaylı işlev açıklaması",
  "worksWith": ["Birlikte çalışan parçalar"],
  "failureSymptoms": ["Arıza belirtileri"],
  "searchKeywords": ["Arama için Almanca kelimeler"],
  "confidenceNote": "Tespitin neden bu yönde olduğu"
}
Alternatif isimler birbirini tekrar etmesin.
`;

  return callGemini({
    apiKey,
    model: "gemini-3.1-flash-lite-preview",
    payload: {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    },
  });
}

async function analyzePartByImage({ apiKey, imageDataUrl, mimeType }) {
  const base64Data = imageDataUrl.split(",")[1];
  const prompt = `
Bu görseldeki otomotiv parçasını analiz et.
Yalnızca JSON dön:
{
  "standardName": "En olası Almanca teknik isim",
  "alternativeNames": ["5 Almanca alternatif isim"],
  "category": "Türkçe kategori",
  "summary": "Türkçe kısa açıklama",
  "function": "Türkçe detaylı işlev açıklaması",
  "worksWith": ["Birlikte çalışan parçalar"],
  "failureSymptoms": ["Bozulduğunda görülen belirtiler"],
  "searchKeywords": ["Arama anahtar kelimeleri"],
  "confidenceNote": "Neden bu parçaya benzettiğin",
  "visibleClues": ["Görselde ayırt etmene yardımcı olan ipuçları"]
}
`;

  return callGemini({
    apiKey,
    model: "gemini-3.1-flash-lite-preview",
    payload: {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json" },
    },
  });
}

function normalizeRecord({ source, manualQuery, imageDataUrl, mimeType, analysis }) {
  return {
    id: uid(),
    source,
    manualQuery: manualQuery || "",
    preferredName: analysis.standardName,
    detectedName: analysis.standardName,
    alternativeNames: analysis.alternativeNames || [],
    category: analysis.category || "",
    summary: analysis.summary || "",
    function: analysis.function || "",
    worksWith: analysis.worksWith || [],
    failureSymptoms: analysis.failureSymptoms || [],
    searchKeywords: analysis.searchKeywords || [],
    confidenceNote: analysis.confidenceNote || "",
    visibleClues: analysis.visibleClues || [],
    imageDataUrl: imageDataUrl || "",
    mimeType: mimeType || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function exportDictionary(records) {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          records,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `autoteile-dictionary-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function StatCard({ value, label }) {
  return (
    <div className="stat-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function InfoBlock({ title, icon: Icon, content, danger = false }) {
  return (
    <div className={`info-block ${danger ? "danger" : ""}`}>
      <div className="info-head">
        <Icon size={16} />
        <span>{title}</span>
      </div>
      <p>{content || "Bilgi yok."}</p>
    </div>
  );
}

function ResultCard({ result, onSave, onClear }) {
  return (
    <article className="result-card">
      <div className="result-header">
        <div>
          <span className="panel-kicker">Tespit edilen isim</span>
          <h2>{result.preferredName}</h2>
          <p>{result.summary}</p>
        </div>
        <span className="category-badge">{result.category || "Kategori yok"}</span>
      </div>

      {result.imageDataUrl ? (
        <div className="result-image-wrap">
          <img src={result.imageDataUrl} alt={result.preferredName} />
        </div>
      ) : null}

      <div className="detail-grid">
        <InfoBlock title="İşlevi" icon={Info} content={result.function} />
        <InfoBlock title="Birlikte Çalıştığı Parçalar" icon={Wrench} content={result.worksWith.join(", ")} />
        <InfoBlock title="Arıza Belirtileri" icon={AlertCircle} content={result.failureSymptoms.join(", ")} danger />
      </div>

      {result.alternativeNames.length ? (
        <div className="chip-section">
          <h3>Alternatif Almanca İsimler</h3>
          <div className="chip-wrap">
            {result.alternativeNames.map((item) => (
              <span key={item} className="chip">{item}</span>
            ))}
          </div>
        </div>
      ) : null}

      {result.searchKeywords.length ? (
        <div className="chip-section">
          <h3>Arama Anahtar Kelimeleri</h3>
          <div className="chip-wrap">
            {result.searchKeywords.map((item) => (
              <span key={item} className="chip soft">{item}</span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="confidence-note">
        <Sparkles size={16} />
        <span>{result.confidenceNote}</span>
      </div>

      <div className="action-row">
        <button className="primary-button" onClick={onSave}>
          <Save size={16} />
          Sözlüğe Kaydet
        </button>
        <button className="secondary-button" onClick={onClear}>
          <Eraser size={16} />
          Temizle
        </button>
      </div>
    </article>
  );
}

function StudioTab({
  draftQuery,
  setDraftQuery,
  latestResult,
  loadingMode,
  onAnalyze,
  onSave,
  onClear,
  onSwitchTab,
}) {
  return (
    <section className="stack-lg">
      <div className="feature-grid">
        <article className="panel panel-accent">
          <div className="panel-head">
            <span className="panel-kicker">Manuel analiz</span>
            <BrainCircuit size={18} />
          </div>
          <h2>Parça adını yaz, AI teknik Almanca adını çıkarsın</h2>
          <p>Türkçe, İngilizce ya da hatalı yazılmış isimden doğru Alman terminolojisine yaklaşsın.</p>
          <div className="query-box">
            <input
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="Örn: alternatör, aks kafası, direksiyon sargısı"
            />
            <button className="primary-button" disabled={loadingMode === "name"} onClick={() => onAnalyze(draftQuery)}>
              {loadingMode === "name" ? <Loader2 className="spin" size={18} /> : "Analiz Et"}
            </button>
          </div>
        </article>

        <article className="panel panel-dark">
          <div className="panel-head">
            <span className="panel-kicker">Görselle başla</span>
            <Camera size={18} />
          </div>
          <h2>Fotoğraf çek veya yükle</h2>
          <p>Kamera sekmesinde parçanın fotoğrafını gönder, AI adı ve işleviyle birlikte yorumlasın.</p>
          <button className="secondary-button" onClick={() => onSwitchTab("camera")}>
            Kamera akışına git
            <ChevronRight size={16} />
          </button>
        </article>
      </div>

      {latestResult ? (
        <ResultCard result={latestResult} onSave={onSave} onClear={onClear} />
      ) : (
        <div className="empty-state">
          <Sparkles size={28} />
          <div>
            <h3>Henüz analiz yok</h3>
            <p>Bir parça adı gir veya kamera sekmesinden görsel yükle.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function CameraTab({ loadingMode, onAnalyzeImage, onAnalyzeByName }) {
  const fileUploadRef = useRef(null);
  const cameraRef = useRef(null);
  const [manualFallback, setManualFallback] = useState("");
  const [preview, setPreview] = useState("");

  const handleSelection = async (event, captureMode) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setPreview(await toDataUrl(file));
    onAnalyzeImage({ file, captureMode });
    event.target.value = "";
  };

  return (
    <section className="stack-lg">
      <div className="capture-grid">
        <button className="capture-card" onClick={() => cameraRef.current?.click()}>
          <Camera size={22} />
          <strong>Fotoğraf Çek</strong>
          <span>Telefon kamerasını aç ve parçayı canlı çek.</span>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => handleSelection(event, true)} />
        </button>

        <button className="capture-card" onClick={() => fileUploadRef.current?.click()}>
          <ImagePlus size={22} />
          <strong>Galeriden Yükle</strong>
          <span>Önceden çekilmiş parça fotoğrafını seç.</span>
          <input ref={fileUploadRef} type="file" accept="image/*" hidden onChange={(event) => handleSelection(event, false)} />
        </button>
      </div>

      {preview ? (
        <div className="preview-panel">
          <img src={preview} alt="Parça önizleme" />
          <div className="preview-caption">
            {loadingMode === "camera" || loadingMode === "upload" ? (
              <>
                <Loader2 className="spin" size={16} />
                <span>Görsel AI tarafından inceleniyor...</span>
              </>
            ) : (
              <span>Önizleme hazır.</span>
            )}
          </div>
        </div>
      ) : null}

      <div className="panel">
        <div className="panel-head">
          <span className="panel-kicker">Yedek yol</span>
          <RefreshCw size={18} />
        </div>
        <h2>Parça adı belirsizse tarif yaz</h2>
        <p>Örneğin “motor üstünde yuvarlak sensör” gibi serbest tarif de girebilirsin.</p>
        <div className="query-box">
          <input value={manualFallback} onChange={(event) => setManualFallback(event.target.value)} placeholder="Örn: turbo girişindeki plastik boru" />
          <button className="primary-button" onClick={() => onAnalyzeByName(manualFallback)}>
            AI ile yorumla
          </button>
        </div>
      </div>
    </section>
  );
}

function DictionaryItem({ record, sellerId, apiKey, expanded, onToggle, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(record.preferredName);
  const [aiSuggestions, setAiSuggestions] = useState(record.alternativeNames.slice(0, 5));
  const [suggestionCount, setSuggestionCount] = useState(5);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    setDraftName(record.preferredName);
  }, [record.preferredName]);

  const ebayUrl = `https://www.ebay.de/sch/i.html?_ssn=${sellerId}&_nkw=${encodeURIComponent(record.preferredName)}`;

  const fetchSuggestions = async (count) => {
    if (!apiKey) {
      return;
    }
    setLoadingSuggestions(true);
    try {
      const analysis = await analyzePartByName({
        apiKey,
        query: record.preferredName,
        context: `${record.summary} ${record.function}`,
        count,
      });
      setAiSuggestions(analysis.alternativeNames || []);
    } catch {
      setAiSuggestions(record.alternativeNames || []);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  return (
    <article className="dictionary-card">
      <button className="dictionary-head" onClick={onToggle}>
        <div className="dictionary-head-copy">
          <span className="panel-kicker">{record.category || "Parça"}</span>
          <h3>{record.preferredName}</h3>
          <p>{record.summary}</p>
        </div>
        <ChevronRight size={18} className={expanded ? "rotate-90" : ""} />
      </button>

      {expanded ? (
        <div className="dictionary-body">
          {record.imageDataUrl ? (
            <div className="dictionary-image">
              <img src={record.imageDataUrl} alt={record.preferredName} />
            </div>
          ) : null}

          <div className="inline-actions">
            {editing ? (
              <>
                <input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
                <button
                  className="mini-button"
                  onClick={() => {
                    onUpdate(record.id, { preferredName: draftName || record.preferredName });
                    setEditing(false);
                  }}
                >
                  <Check size={14} />
                  Kaydet
                </button>
              </>
            ) : (
              <>
                <button className="mini-button" onClick={() => setEditing(true)}>
                  <PencilLine size={14} />
                  İsmi Düzenle
                </button>
                <button className="mini-button danger" onClick={() => onDelete(record.id)}>
                  <Trash2 size={14} />
                  Sil
                </button>
              </>
            )}
          </div>

          <div className="detail-grid">
            <InfoBlock title="İşlevi" icon={Info} content={record.function} />
            <InfoBlock title="Birlikte Çalıştığı Parçalar" icon={Wrench} content={(record.worksWith || []).join(", ")} />
            <InfoBlock title="Arıza Belirtileri" icon={AlertCircle} content={(record.failureSymptoms || []).join(", ")} danger />
          </div>

          <div className="panel subtle-panel">
            <div className="panel-head">
              <span className="panel-kicker">İsim yardımcısı</span>
              <BadgePlus size={18} />
            </div>
            <h2>AI alternatif isim önerileri</h2>
            <p>Doğru adı bulmak için önerilerden birini seçip kayıt adını güncelleyebilirsin.</p>
            <div className="chip-wrap">
              {aiSuggestions.map((item) => (
                <button
                  key={item}
                  className="chip button-chip"
                  onClick={() => {
                    setDraftName(item);
                    setEditing(true);
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="inline-actions">
              <button
                className="mini-button"
                disabled={loadingSuggestions}
                onClick={() => {
                  setSuggestionCount(5);
                  fetchSuggestions(5);
                }}
              >
                {loadingSuggestions ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
                5 öneri getir
              </button>
              <button
                className="mini-button"
                disabled={loadingSuggestions}
                onClick={() => {
                  const nextCount = suggestionCount + 5;
                  setSuggestionCount(nextCount);
                  fetchSuggestions(nextCount);
                }}
              >
                <RefreshCw size={14} />
                Daha fazla ver
              </button>
            </div>
          </div>

          {(record.searchKeywords || []).length ? (
            <div className="chip-section">
              <h3>Arama kelimeleri</h3>
              <div className="chip-wrap">
                {record.searchKeywords.map((item) => (
                  <span key={item} className="chip soft">{item}</span>
                ))}
              </div>
            </div>
          ) : null}

          <a className="primary-button full-width" href={ebayUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={16} />
            eBay mağazada ara
          </a>
        </div>
      ) : null}
    </article>
  );
}

function DictionaryTab({ dictionary, sellerId, apiKey, onUpdate, onDelete }) {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return dictionary;
    }
    return dictionary.filter((item) => {
      const haystack = [item.preferredName, item.detectedName, ...(item.alternativeNames || []), ...(item.searchKeywords || [])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [dictionary, query]);

  return (
    <section className="stack-lg">
      <div className="panel">
        <div className="search-inline">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sözlükte isim, alternatif isim veya anahtar kelime ara" />
        </div>
      </div>

      {filtered.length ? (
        <div className="stack-md">
          {filtered.map((record) => (
            <DictionaryItem
              key={record.id}
              record={record}
              sellerId={sellerId}
              apiKey={apiKey}
              expanded={expandedId === record.id}
              onToggle={() => setExpandedId(expandedId === record.id ? "" : record.id)}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <BookOpen size={28} />
          <div>
            <h3>Sözlük boş</h3>
            <p>Kaydedilen parçalar burada tutulur. Veriler cihazında localStorage içinde kalır.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function SettingsTab({ apiKey, sellerId, onApiKeyChange, onSellerIdChange, onExport, onImport }) {
  const importRef = useRef(null);

  return (
    <section className="stack-lg">
      <div className="panel">
        <div className="panel-head">
          <span className="panel-kicker">AI bağlantısı</span>
          <Settings size={18} />
        </div>
        <h2>Gemini API anahtarı</h2>
        <p>GitHub Pages üzerinde çalışan statik uygulama olduğu için anahtar bu cihazın localStorage alanında tutulur.</p>
        <input className="settings-input" type="password" value={apiKey} onChange={(event) => onApiKeyChange(event.target.value)} placeholder="AIza..." />
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-kicker">Mağaza bağlantısı</span>
          <ExternalLink size={18} />
        </div>
        <h2>Varsayılan eBay seller ID</h2>
        <input className="settings-input" value={sellerId} onChange={(event) => onSellerIdChange(event.target.value)} placeholder={DEFAULT_SELLER} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-kicker">Yedekleme</span>
          <Download size={18} />
        </div>
        <h2>Sözlük verisini dışa aktar veya içe al</h2>
        <div className="action-row">
          <button className="secondary-button" onClick={onExport}>
            <Download size={16} />
            JSON indir
          </button>
          <button className="secondary-button" onClick={() => importRef.current?.click()}>
            <Upload size={16} />
            JSON yükle
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onImport(file);
              }
              event.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-kicker">Kategori sözlüğü</span>
          <BookOpen size={18} />
        </div>
        <h2>Kapsanan sistem alanları</h2>
        <div className="chip-wrap">
          {PART_SYSTEMS.map((item) => (
            <span key={item} className="chip">{item}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState("studio");
  const [apiKey, setApiKey] = useState(() => readLocalStorage(STORAGE_KEYS.apiKey, ""));
  const [sellerId, setSellerId] = useState(() => readLocalStorage(STORAGE_KEYS.sellerId, DEFAULT_SELLER));
  const [dictionary, setDictionary] = useState(() => readLocalStorage(STORAGE_KEYS.dictionary, []));
  const [draftQuery, setDraftQuery] = useState("");
  const [latestResult, setLatestResult] = useState(null);
  const [loadingMode, setLoadingMode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.apiKey, apiKey);
  }, [apiKey]);

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.sellerId, sellerId);
  }, [sellerId]);

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.dictionary, dictionary);
  }, [dictionary]);

  const stats = useMemo(() => {
    const categories = new Set(dictionary.map((item) => item.category).filter(Boolean));
    return {
      total: dictionary.length,
      categories: categories.size,
      photos: dictionary.filter((item) => item.imageDataUrl).length,
    };
  }, [dictionary]);

  const handleNameAnalysis = async (query, context = "") => {
    if (!apiKey) {
      setError("Önce Ayarlar sekmesinden Gemini API anahtarını girmen gerekiyor.");
      setActiveTab("settings");
      return;
    }
    if (!query.trim()) {
      setError("Önce bir parça adı gir.");
      return;
    }

    setLoadingMode("name");
    setError("");
    try {
      const analysis = await analyzePartByName({ apiKey, query, context });
      setLatestResult(normalizeRecord({ source: "manual", manualQuery: query, analysis }));
      setActiveTab("studio");
    } catch (err) {
      setError(err.message || "Analiz sırasında hata oluştu.");
    } finally {
      setLoadingMode("");
    }
  };

  const handleImageAnalysis = async ({ file, captureMode = false }) => {
    if (!apiKey) {
      setError("Önce Ayarlar sekmesinden Gemini API anahtarını girmen gerekiyor.");
      setActiveTab("settings");
      return;
    }
    setLoadingMode(captureMode ? "camera" : "upload");
    setError("");
    try {
      const imageDataUrl = await toDataUrl(file);
      const analysis = await analyzePartByImage({
        apiKey,
        imageDataUrl,
        mimeType: file.type || "image/jpeg",
      });
      setLatestResult(normalizeRecord({ source: captureMode ? "camera" : "upload", imageDataUrl, mimeType: file.type || "image/jpeg", analysis }));
      setActiveTab("studio");
    } catch (err) {
      setError(err.message || "Görsel analizi sırasında hata oluştu.");
    } finally {
      setLoadingMode("");
    }
  };

  const saveLatestResult = () => {
    if (!latestResult) {
      return;
    }
    setDictionary((current) => [{ ...latestResult, updatedAt: new Date().toISOString() }, ...current]);
    setLatestResult(null);
    setDraftQuery("");
    setActiveTab("dictionary");
  };

  const updateRecord = (recordId, changes) => {
    setDictionary((current) =>
      current.map((item) => (item.id === recordId ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item)),
    );
  };

  const deleteRecord = (recordId) => {
    setDictionary((current) => current.filter((item) => item.id !== recordId));
  };

  const importRecords = async (file) => {
    const text = await file.text();
    const data = JSON.parse(text);
    const imported = Array.isArray(data.records) ? data.records : [];
    setDictionary((current) => [...imported, ...current]);
  };

  return (
    <div className="app-shell">
      <div className="backdrop-orb orb-one" />
      <div className="backdrop-orb orb-two" />
      <header className="topbar">
        <div>
          <p className="eyebrow">AI parça laboratuvarı</p>
          <h1>Autoteile Studio</h1>
          <p className="subtitle">Fotoğrafla tanı, Almanca ismi öğren, parçaları sözlükte biriktir.</p>
        </div>
        <div className="hero-stats">
          <StatCard value={stats.total} label="Kayıt" />
          <StatCard value={stats.categories} label="Kategori" />
          <StatCard value={stats.photos} label="Foto" />
        </div>
      </header>

      <main className="content">
        {error ? (
          <div className="alert-card">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={() => setError("")} className="ghost-icon">
              <X size={16} />
            </button>
          </div>
        ) : null}

        {activeTab === "studio" ? (
          <StudioTab
            draftQuery={draftQuery}
            setDraftQuery={setDraftQuery}
            latestResult={latestResult}
            loadingMode={loadingMode}
            onAnalyze={handleNameAnalysis}
            onSave={saveLatestResult}
            onClear={() => setLatestResult(null)}
            onSwitchTab={setActiveTab}
          />
        ) : null}

        {activeTab === "camera" ? (
          <CameraTab loadingMode={loadingMode} onAnalyzeImage={handleImageAnalysis} onAnalyzeByName={handleNameAnalysis} />
        ) : null}

        {activeTab === "dictionary" ? (
          <DictionaryTab dictionary={dictionary} sellerId={sellerId} apiKey={apiKey} onUpdate={updateRecord} onDelete={deleteRecord} />
        ) : null}

        {activeTab === "settings" ? (
          <SettingsTab
            apiKey={apiKey}
            sellerId={sellerId}
            onApiKeyChange={setApiKey}
            onSellerIdChange={setSellerId}
            onExport={() => exportDictionary(dictionary)}
            onImport={importRecords}
          />
        ) : null}
      </main>

      <nav className="bottom-nav">
        {TABS.map((tab) => (
          <button key={tab.id} className={`nav-item ${activeTab === tab.id ? "active" : ""}`} onClick={() => setActiveTab(tab.id)}>
            <tab.icon size={20} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
