// DeutschKart — Scriptable widget + Supabase (ana PWA ile ortak geçmiş)
// Orta/büyük widget: sağ üst ↻ → Scriptable açılır, 5 kelime üretilir (Evet/Hayır yok). iOS, iş bitince ana ekrana otomatik dönüşe izin vermez.
// CONFIG'ü doldur → kaydet. İlk kurulum veya küçük widget için ▶ menüden de çalıştırabilirsin.

const CONFIG = {
  GEMINI_API_KEY: "",
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  /** Ana ekrana eklediğin PWA (sonunda / olsun). Kelime kartına dokununca açılır. */
  PWA_OPEN_URL: "https://eyedeu.github.io/myapps/dk/",
};

/** Önce bu, yoğunluk hatasında sırayla denenir */
const GEMINI_MODELS = ["gemini-3.1-flash-lite-preview", "gemini-2.0-flash"];

/** ▶ Evet ile tek seferde üretilecek yeni kelime sayısı */
const WORDS_PER_GENERATE_RUN = 5;

const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
const POS_ORDER = ["noun", "verb", "adj", "phrase", "prep", "conj", "adv", "other"];
const POS_TR = {
  noun: "İsim",
  verb: "Fiil",
  adj: "Sıfat",
  phrase: "Kalıp",
  prep: "Edat",
  conj: "Bağlaç",
  adv: "Zarf",
  other: "Diğer",
};

function normalizePos(raw) {
  const s = String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "");
  if (POS_ORDER.includes(s)) return s;
  const map = {
    substantive: "noun",
    nomen: "noun",
    noun: "noun",
    verb: "verb",
    verbum: "verb",
    adj: "adj",
    adjective: "adj",
    adjektiv: "adj",
    phrase: "phrase",
    redewendung: "phrase",
    ausdruck: "phrase",
    prep: "prep",
    präposition: "prep",
    preposition: "prep",
    conj: "conj",
    konjunktion: "conj",
    conjunction: "conj",
    adv: "adv",
    adverb: "adv",
    adverbium: "adv",
    other: "other",
    sonstiges: "other",
  };
  return map[s] || "phrase";
}

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
    return { de: 14, tr: 11, ex: 10, exLines: 3, level: 10, title: 13, pos: 8 };
  }
  if (wf === "medium") {
    return { de: 12, tr: 10, ex: 9, exLines: 2, level: 9, title: 12, pos: 8 };
  }
  return { de: 11, tr: 9, ex: 8, exLines: 2, level: 8, title: 11, pos: 7 };
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

function wordOpenUrl(wordId) {
  const raw = String(CONFIG.PWA_OPEN_URL || "").trim();
  if (!raw || !wordId) return "";
  const base = raw.replace(/\/?$/, "/");
  return `${base}#/w/${encodeURIComponent(String(wordId))}`;
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
    pos: normalizePos(row.pos),
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
    pos: word.pos || "phrase",
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
    '{"de":"...","tr":"...","example":"...","level":"B1","pos":"noun"}',
    '- "level": A1,A2,B1,B2,C1 oder C2.',
    `- "pos": genau einer von: ${POS_ORDER.join(",")} (Wortart des Haupteintrags).`,
    '- Substantive im Feld "de" mit korrektem Großbuchstaben beginnen.',
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
  const pos = normalizePos(payload.pos);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    de,
    tr,
    example,
    level: levelRaw,
    pos,
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
  const pos = normalizePos(payload.pos);
  return {
    id: `${Date.now()}-${suf}`,
    de,
    tr,
    example,
    level: levelRaw,
    pos,
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
    '{"words":[{"de":"...","tr":"...","example":"...","level":"B1","pos":"noun"}, ...]}',
    `- Im Array "words" exakt ${count} Objekte.`,
    '- Jedes "de": ein deutsches Wort oder kurze Wendung (max. 4 Wörter).',
    '- Jedes "tr": türkische Übersetzung.',
    '- Jedes "example": ein deutscher Beispielsatz.',
    '- Jedes "level": A1,A2,B1,B2,C1 oder C2.',
    `- Jedes "pos": einer von ${POS_ORDER.join(",")} (Wortart).`,
    '- Substantive in "de" mit großem Anfangsbuchstaben.',
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
  const pwaBaseOk = Boolean(String(CONFIG.PWA_OPEN_URL || "").trim());
  const linksOk = widgetSupportsStackLinks() && pwaBaseOk;

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
    return w;
  }

  w.addSpacer(5);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (i > 0) w.addSpacer(5);

    const card = w.addStack();
    card.layoutVertically();
    card.backgroundColor = new Color("#ffffff", 0.05);
    card.cornerRadius = 11;
    card.borderWidth = 1;
    card.borderColor = new Color("#7dd3fc", 0.12);
    card.setPadding(4, 4, 4, 4);

    const tap = card.addStack();
    tap.layoutVertically();
    tap.setPadding(8, 9, 8, 9);
    const open = wordOpenUrl(word.id);
    if (linksOk && open) tap.url = open;

    const posLine = tap.addText(POS_TR[word.pos] || POS_TR.phrase);
    posLine.textColor = new Color("#94a3b8", 1);
    posLine.font = Font.semiboldSystemFont(ty.pos);
    posLine.lineLimit = 1;
    posLine.minimumScaleFactor = 0.65;

    tap.addSpacer(3);
    const row1 = tap.addStack();
    row1.layoutHorizontally();
    row1.centerAlignContent();

    const lv = row1.addText(word.level);
    lv.textColor = new Color("#7dd3fc", 1);
    lv.font = Font.boldSystemFont(ty.level);
    lv.minimumScaleFactor = 0.65;
    lv.lineLimit = 1;

    row1.addSpacer(null);

    const de = row1.addText(word.de);
    de.textColor = Color.white();
    de.font = Font.boldSystemFont(ty.de);
    de.minimumScaleFactor = 0.55;
    de.lineLimit = 2;

    tap.addSpacer(4);
    const tr = tap.addText(word.tr);
    tr.textColor = new Color("#e2e8f0", 1);
    tr.font = Font.systemFont(ty.tr);
    tr.minimumScaleFactor = 0.58;
    tr.lineLimit = 2;

    tap.addSpacer(4);
    const exLabel = tap.addText("Örnek");
    exLabel.textColor = new Color("#64748b", 1);
    exLabel.font = Font.semiboldSystemFont(Math.max(8, ty.ex - 1));
    tap.addSpacer(2);
    const ex = tap.addText(word.example || "—");
    ex.textColor = new Color("#cbd5e1", 1);
    ex.font = Font.systemFont(ty.ex);
    ex.lineLimit = ty.exLines;
    ex.minimumScaleFactor = 0.52;
  }

  w.addSpacer(null);
  if (widgetSupportsStackLinks()) {
    const foot = w.addText(pwaBaseOk ? "Kart: uygulama · ↻ yalnız sağ üst" : "CONFIG.PWA_OPEN_URL ile kart linki");
    foot.textColor = new Color("#475569", 1);
    foot.font = Font.systemFont(8);
    foot.minimumScaleFactor = 0.65;
  } else if (config.widgetFamily === "small") {
    const foot = w.addText("Küçük widget: tür/URL yok; orta veya büyük kullanın.");
    foot.textColor = new Color("#475569", 1);
    foot.font = Font.systemFont(8);
    foot.minimumScaleFactor = 0.65;
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
