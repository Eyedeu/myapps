// DeutschKart — Scriptable widget + Supabase (ana PWA ile ortak geçmiş)
// Orta/büyük widget: sağ üst ↻ → Scriptable açılır, 5 kelime üretilir (Evet/Hayır yok). iOS, iş bitince ana ekrana otomatik dönüşe izin vermez.
// CONFIG'ü doldur → kaydet. İlk kurulum veya küçük widget için ▶ menüden de çalıştırabilirsin.

const CONFIG = {
  GEMINI_API_KEY: "",
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
};

/** Önce bu, yoğunluk hatasında sırayla denenir */
const GEMINI_MODELS = ["gemini-3.1-flash-lite-preview", "gemini-2.0-flash"];

/** ▶ Evet ile tek seferde üretilecek yeni kelime sayısı */
const WORDS_PER_GENERATE_RUN = 5;

const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

/** Örnek cümle sığsın diye boyuta göre kelime sayısı */
function widgetWordLimit() {
  const wf = config.widgetFamily;
  if (wf === "large" || wf === "extraLarge") return 5;
  if (wf === "medium") return 4;
  if (wf === "small") return 2;
  return 4;
}

function widgetTypography() {
  const wf = config.widgetFamily;
  if (wf === "large" || wf === "extraLarge") {
    return { de: 12, tr: 10, ex: 9, exLines: 2, level: 9, title: 12 };
  }
  if (wf === "medium") {
    return { de: 11, tr: 9, ex: 8, exLines: 2, level: 8, title: 11 };
  }
  return { de: 10, tr: 9, ex: 8, exLines: 2, level: 8, title: 11 };
}

/** Scriptable: stack.url yalnızca medium+ ; küçük widget tek dokunuş = ListWidget.url */
function widgetSupportsStackLinks() {
  const wf = config.widgetFamily;
  return wf === "medium" || wf === "large" || wf === "extraLarge";
}

function refreshRunUrl() {
  try {
    const base = URLScheme.forRunningScript();
    const sep = base.indexOf("?") >= 0 ? "&" : "?";
    return `${base}${sep}dkAction=refresh`;
  } catch (e) {
    return "";
  }
}

function reloadHomeWidgets() {
  try {
    if (typeof refreshAllWidgets === "function") refreshAllWidgets();
  } catch (e) {}
}

function normalizeDe(de) {
  return String(de || "")
    .trim()
    .toLowerCase();
}

function assertConfig() {
  if (!CONFIG.GEMINI_API_KEY) throw new Error("CONFIG.GEMINI_API_KEY boş.");
  if (!CONFIG.SUPABASE_URL) throw new Error("CONFIG.SUPABASE_URL boş.");
  if (!CONFIG.SUPABASE_ANON_KEY) throw new Error("CONFIG.SUPABASE_ANON_KEY boş.");
}

function sbHeaders() {
  const k = CONFIG.SUPABASE_ANON_KEY;
  return {
    apikey: k,
    Authorization: `Bearer ${k}`,
    "Content-Type": "application/json",
  };
}

async function sbGetAllWords() {
  const base = CONFIG.SUPABASE_URL.replace(/\/+$/, "");
  const req = new Request(`${base}/rest/v1/words?select=*`);
  req.headers = sbHeaders();
  const data = await req.loadJSON();
  if (!Array.isArray(data)) return [];
  return data.map((row) => ({
    id: row.id,
    de: row.de,
    tr: row.tr,
    example: row.example,
    level: row.level,
    shownAt: row.shown_at,
  }));
}

async function sbInsertWord(word) {
  const base = CONFIG.SUPABASE_URL.replace(/\/+$/, "");
  const req = new Request(`${base}/rest/v1/words`);
  req.method = "POST";
  req.headers = { ...sbHeaders(), Prefer: "return=minimal" };
  req.body = JSON.stringify({
    id: word.id,
    de: word.de,
    tr: word.tr,
    example: word.example,
    level: word.level,
    shown_at: word.shownAt,
  });
  await req.load();
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function stripFence(t) {
  let s = String(t || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/```json/gi, "").replace(/```/g, "").trim();
  }
  return s;
}

function sliceJsonObject(text) {
  const i = text.indexOf("{");
  const j = text.lastIndexOf("}");
  if (i === -1 || j === -1 || j < i) return text;
  return text.slice(i, j + 1);
}

function isRetryableGeminiError(msg) {
  return /high demand|overloaded|429|503|try again|RESOURCE_EXHAUSTED|UNAVAILABLE|timeout/i.test(
    String(msg || ""),
  );
}

async function fetchGeminiNewWordOnce(excludeSet, modelId) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
  const excludeSample = Array.from(excludeSet)
    .sort()
    .slice(0, 120)
    .join(", ");

  const systemText = [
    'Du bist ein deutscher Sprachtrainer. Antworte NUR mit gültigem JSON exakt:',
    '{"de":"...","tr":"...","example":"...","level":"B1"}',
    '- "level": A1,A2,B1,B2,C1 oder C2.',
    `Keine Wiederholungen: ${excludeSample}`,
  ].join("\n");

  const body = {
    systemInstruction: { parts: [{ text: systemText }] },
    contents: [{ role: "user", parts: [{ text: "Neues JSON-Objekt." }] }],
    generationConfig: { temperature: 0.85, responseMimeType: "application/json" },
  };

  const req = new Request(url);
  req.method = "POST";
  req.headers = {
    "Content-Type": "application/json",
    "x-goog-api-key": CONFIG.GEMINI_API_KEY.trim(),
  };
  req.body = JSON.stringify(body);

  let data;
  try {
    data = await req.loadJSON();
  } catch (e) {
    throw new Error(String(e.message || e));
  }

  if (data.error) {
    throw new Error(data.error.message || "Gemini hata");
  }

  const rawText =
    data?.candidates
      ?.flatMap((c) => c?.content?.parts || [])
      .map((p) => p?.text)
      .filter(Boolean)
      .join("\n")
      .trim() || "";

  const payload = JSON.parse(sliceJsonObject(stripFence(rawText)));
  const de = String(payload.de || "").trim();
  const tr = String(payload.tr || "").trim();
  const example = String(payload.example || "").trim();
  const levelRaw = String(payload.level || "").trim().toUpperCase();
  if (!de || !tr || !example || !LEVEL_ORDER.includes(levelRaw)) {
    throw new Error("Geçersiz model yanıtı.");
  }
  if (excludeSet.has(normalizeDe(de))) throw new Error("Tekrar kelime.");

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    de,
    tr,
    example,
    level: levelRaw,
    shownAt: new Date().toISOString(),
  };
}

async function fetchGeminiNewWord(excludeSet) {
  let lastErr = new Error("Gemini yanıt vermedi.");
  for (const modelId of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        if (attempt > 0) await sleep(1800 * attempt);
        return await fetchGeminiNewWordOnce(excludeSet, modelId);
      } catch (e) {
        lastErr = e;
        const msg = String(e.message || e);
        if (/Geçersiz|Tekrar/i.test(msg)) throw e;
        if (!isRetryableGeminiError(msg)) throw e;
      }
    }
  }
  throw lastErr;
}

/** Aynı Almanca başlığı tekrar etmeden, en yeni kaydı tutar */
function dedupeWordsByDe(words) {
  const m = new Map();
  for (const x of words) {
    const key = normalizeDe(x.de);
    const prev = m.get(key);
    if (!prev || new Date(x.shownAt) > new Date(prev.shownAt)) m.set(key, x);
  }
  return [...m.values()];
}

function parseWordPayload(payload, idSuffix) {
  const de = String(payload.de || "").trim();
  const tr = String(payload.tr || "").trim();
  const example = String(payload.example || "").trim();
  const levelRaw = String(payload.level || "").trim().toUpperCase();
  if (!de || !tr || !example || !LEVEL_ORDER.includes(levelRaw)) {
    throw new Error("Geçersiz model yanıtı.");
  }
  const suf = idSuffix != null ? String(idSuffix) : Math.random().toString(36).slice(2, 9);
  return {
    id: `${Date.now()}-${suf}`,
    de,
    tr,
    example,
    level: levelRaw,
    shownAt: new Date().toISOString(),
  };
}

async function fetchGeminiNewWordsBatchOnce(excludeSet, count, modelId) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
  const excludeSample = Array.from(excludeSet)
    .sort()
    .slice(0, 200)
    .join(", ");

  const systemText = [
    "Du bist ein deutscher Sprachtrainer. Antworte NUR mit gültigem JSON (kein Markdown):",
    '{"words":[{"de":"...","tr":"...","example":"...","level":"B1"}, ...]}',
    `- Im Array "words" exakt ${count} Objekte.`,
    '- Jedes "de": ein deutsches Wort oder kurze Wendung (max. 4 Wörter).',
    '- Jedes "tr": türkische Übersetzung.',
    '- Jedes "example": ein deutscher Beispielsatz.',
    '- Jedes "level": A1,A2,B1,B2,C1 oder C2.',
    `Alle "de" müssen untereinander verschieden sein und dürfen nicht vorkommen in: ${excludeSample}`,
  ].join("\n");

  const body = {
    systemInstruction: { parts: [{ text: systemText }] },
    contents: [{ role: "user", parts: [{ text: `Gib genau ${count} neue Einträge in "words".` }] }],
    generationConfig: { temperature: 0.88, responseMimeType: "application/json" },
  };

  const req = new Request(url);
  req.method = "POST";
  req.headers = {
    "Content-Type": "application/json",
    "x-goog-api-key": CONFIG.GEMINI_API_KEY.trim(),
  };
  req.body = JSON.stringify(body);

  let data;
  try {
    data = await req.loadJSON();
  } catch (e) {
    throw new Error(String(e.message || e));
  }

  if (data.error) {
    throw new Error(data.error.message || "Gemini hata");
  }

  const rawText =
    data?.candidates
      ?.flatMap((c) => c?.content?.parts || [])
      .map((p) => p?.text)
      .filter(Boolean)
      .join("\n")
      .trim() || "";

  const root = JSON.parse(sliceJsonObject(stripFence(rawText)));
  const arr = root.words;
  if (!Array.isArray(arr) || arr.length < count) {
    throw new Error("Batch unvollständig.");
  }

  const out = [];
  const seen = new Set(excludeSet);
  let idx = 0;
  for (const item of arr) {
    const w = parseWordPayload(item, `${idx++}-${Math.random().toString(36).slice(2, 7)}`);
    const nd = normalizeDe(w.de);
    if (seen.has(nd)) throw new Error("Batch enthält Duplikat oder schon vorhandenes Wort.");
    seen.add(nd);
    out.push(w);
    if (out.length === count) break;
  }
  if (out.length < count) throw new Error("Batch unvollständig.");
  return out;
}

async function fetchGeminiNewWordsBatch(excludeSet, count) {
  let lastErr = new Error("Gemini yanıt vermedi.");
  for (const modelId of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        if (attempt > 0) await sleep(2000 * attempt);
        return await fetchGeminiNewWordsBatchOnce(excludeSet, count, modelId);
      } catch (e) {
        lastErr = e;
        const msg = String(e.message || e);
        if (/Geçersiz|Duplikat|schon vorhanden/i.test(msg)) throw e;
        if (!isRetryableGeminiError(msg)) throw e;
      }
    }
  }
  throw lastErr;
}

/** Önce batch (hızlı), olmazsa tek kelime */
async function fetchNewWordsForRun(excludeSet, count) {
  try {
    return await fetchGeminiNewWordsBatch(excludeSet, count);
  } catch (e1) {
    const one = await fetchGeminiNewWord(excludeSet);
    return [one];
  }
}

async function fetchWidgetState() {
  try {
    const raw = await sbGetAllWords();
    if (!raw.length) {
      return {
        words: [],
        hint: "Henüz kelime yok.\nScriptable → bu script → ▶ → Evet ile kelime üretin.",
      };
    }
    const limit = widgetWordLimit();
    const words = dedupeWordsByDe(raw)
      .sort((a, b) => new Date(b.shownAt) - new Date(a.shownAt))
      .slice(0, limit);
    return { words, hint: null };
  } catch (e) {
    const msg = String(e.message || e).slice(0, 180);
    return {
      words: [],
      hint: `Sunucu okunamadı:\n${msg}\nURL / Publishable / SQL tablosu kontrol.`,
    };
  }
}

function buildWidget(state) {
  const { words, hint } = state;
  const w = new ListWidget();
  const grad = new LinearGradient();
  grad.colors = [new Color("#161c28", 1), new Color("#0a0d12", 1)];
  grad.locations = [0, 1];
  w.backgroundGradient = grad;
  w.setPadding(10, 12, 10, 12);

  const ty = widgetTypography();
  const ru = refreshRunUrl();

  const head = w.addStack();
  head.layoutHorizontally();
  head.centerAlignContent();

  const titleStack = head.addStack();
  titleStack.layoutVertically();
  const title = titleStack.addText("DeutschKart");
  title.textColor = new Color("#cbd5e1", 1);
  title.font = Font.semiboldSystemFont(ty.title);

  head.addSpacer(null);

  if (widgetSupportsStackLinks() && ru) {
    const rb = head.addStack();
    rb.layoutVertically();
    rb.backgroundColor = new Color("#ffffff", 0.1);
    rb.cornerRadius = 10;
    rb.setPadding(6, 8, 6, 8);
    rb.url = ru;
    const sym = SFSymbol.named("arrow.clockwise");
    sym.applySemiboldWeight();
    const im = rb.addImage(sym.image);
    im.imageSize = new Size(17, 17);
    im.tintColor = new Color("#7dd3fc", 1);
  }

  if (!words || !words.length) {
    w.addSpacer(6);
    const t2 = w.addText(hint || "Ayarları kontrol edin.");
    t2.textColor = new Color("#94a3b8", 1);
    t2.font = Font.systemFont(10);
    t2.minimumScaleFactor = 0.65;
    if (config.widgetFamily === "small" && ru) w.url = ru;
    return w;
  }

  w.addSpacer(5);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (i > 0) w.addSpacer(5);

    const card = w.addStack();
    card.layoutVertically();
    card.backgroundColor = new Color("#ffffff", 0.06);
    card.cornerRadius = 10;
    card.borderWidth = 1;
    card.borderColor = new Color("#7dd3fc", 0.15);
    card.setPadding(7, 9, 7, 9);

    const top = card.addStack();
    top.layoutHorizontally();
    top.centerAlignContent();

    const lv = top.addText(word.level);
    lv.textColor = new Color("#7dd3fc", 1);
    lv.font = Font.boldSystemFont(ty.level);
    lv.minimumScaleFactor = 0.7;
    lv.lineLimit = 1;

    top.addSpacer(6);

    const titles = top.addStack();
    titles.layoutVertically();

    const de = titles.addText(word.de);
    de.textColor = Color.white();
    de.font = Font.boldSystemFont(ty.de);
    de.minimumScaleFactor = 0.6;
    de.lineLimit = 2;

    const tr = titles.addText(word.tr);
    tr.textColor = new Color("#e2e8f0", 1);
    tr.font = Font.systemFont(ty.tr);
    tr.minimumScaleFactor = 0.6;
    tr.lineLimit = 2;

    card.addSpacer(4);
    const exLabel = card.addText("Örnek");
    exLabel.textColor = new Color("#64748b", 1);
    exLabel.font = Font.mediumSystemFont(Math.max(7, ty.ex - 2));
    card.addSpacer(2);
    const ex = card.addText(word.example || "—");
    ex.textColor = new Color("#a8b4c4", 1);
    ex.font = Font.systemFont(ty.ex);
    ex.lineLimit = ty.exLines;
    ex.minimumScaleFactor = 0.55;
  }

  w.addSpacer(null);
  if (config.widgetFamily === "small" && ru) {
    w.url = ru;
  } else if (widgetSupportsStackLinks()) {
    const foot = w.addText("↻ Sağ üst: 5 yeni kelime");
    foot.textColor = new Color("#475569", 1);
    foot.font = Font.systemFont(8);
    foot.minimumScaleFactor = 0.7;
  }

  return w;
}

async function runGenerateFlow() {
  assertConfig();
  const words = await sbGetAllWords();
  const exclude = new Set(words.map((x) => normalizeDe(x.de)));
  const fresh = await fetchNewWordsForRun(exclude, WORDS_PER_GENERATE_RUN);
  const inserted = [];
  for (const newWord of fresh) {
    try {
      await sbInsertWord(newWord);
      inserted.push(newWord);
    } catch (e) {
      throw new Error(`Supabase yazılamadı: ${e.message || e}\nSQL (words tablosu) ve RLS kontrol.`);
    }
  }
  return inserted;
}

async function main() {
  try {
    assertConfig();
  } catch (e) {
    const w = new ListWidget();
    w.backgroundColor = new Color("#1a0a0a", 1);
    const t = w.addText(String(e.message || e));
    t.textColor = Color.lightGray();
    t.font = Font.systemFont(11);
    Script.setWidget(w);
    Script.complete();
    return;
  }

  const qp = (typeof args !== "undefined" && args.queryParameters) || {};
  const isRefreshTap = !config.runsInWidget && String(qp.dkAction || "") === "refresh";
  if (isRefreshTap) {
    try {
      await runGenerateFlow();
      reloadHomeWidgets();
    } catch (err) {
      const er = new Alert();
      er.title = "Yenileme hatası";
      er.message = String(err.message || err).slice(0, 400);
      er.addAction("Kapat");
      await er.present();
    }
    Script.complete();
    return;
  }

  if (config.runsInWidget) {
    const st = await fetchWidgetState();
    Script.setWidget(buildWidget(st));
    Script.complete();
    return;
  }

  const alert = new Alert();
  alert.title = "DeutschKart";
  alert.message = `${WORDS_PER_GENERATE_RUN} yeni kelime üretilsin mi? (Geçmişteki kelimeler tekrarlanmaz; yoğunlukta otomatik yeniden dener.)`;
  alert.addAction("Evet");
  alert.addCancelAction("Hayır");
  const choice = await alert.present();
  if (choice === 0) {
    try {
      const list = await runGenerateFlow();
      const preview = list
        .map((nw) => `${nw.de} — ${nw.tr}`)
        .join("\n")
        .slice(0, 500);
      const ok = new Alert();
      ok.title = "Tamam";
      ok.message = `${list.length} kelime eklendi.\n\n${preview}`;
      ok.addAction("Kapat");
      await ok.present();
    } catch (err) {
      const er = new Alert();
      er.title = "Hata";
      er.message = String(err.message || err).slice(0, 400);
      er.addAction("Kapat");
      await er.present();
    }
  }

  Script.complete();
}

await main();
