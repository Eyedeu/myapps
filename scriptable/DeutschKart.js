// DeutschKart — Scriptable widget + Supabase (ana PWA ile ortak geçmiş)
// Yenile: üstte tam genişlik yatay şerit (scriptable + dkAction=refresh). Kelime kartları alt alta tam genişlik; stack.url = https PWA.
// large 3 / medium 2 / small 1 kelime; okunaklı punto oranı (de / tr / örnek).
// CONFIG'ü doldur → kaydet.

const CONFIG = {
  GEMINI_API_KEY: "",
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  /** Ana ekrana eklediğin PWA (sonunda / olsun). Kelime kartına dokununca açılır. */
  PWA_OPEN_URL: "https://eyedeu.github.io/myapps/dk/",
};

/** Kota/istek: yalnız 3.1 flash lite (2.0 kota hatası vermesin diye kaldırıldı) */
const GEMINI_MODELS = ["gemini-3.1-flash-lite-preview"];

/** ▶ Yenile / manuel üretimde tek seferde eklenen kelime sayısı (widget ile uyumlu) */
const WORDS_PER_GENERATE_RUN = 3;

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

/** Daha az kelime = daha büyük punto; widget yüksekliği sabit. */
function widgetWordLimit() {
  const wf = config.widgetFamily;
  if (wf === "large" || wf === "extraLarge") return 3;
  if (wf === "medium") return 2;
  if (wf === "small") return 1;
  return 2;
}

function widgetTypography() {
  const wf = config.widgetFamily;
  /** de biraz küçültüldü, örnek (ex) tr’ye yaklaştı — ekranda daha dengeli. */
  if (wf === "large" || wf === "extraLarge") {
    return { meta: 12, de: 22, tr: 17, ex: 15, title: 14 };
  }
  if (wf === "medium") {
    return { meta: 12, de: 20, tr: 16, ex: 14, title: 13 };
  }
  return { meta: 11, de: 19, tr: 15, ex: 13, title: 12 };
}

function wordCardChrome() {
  return {
    bg: new Color("#ffffff", 0.06),
    border: new Color("#7dd3fc", 0.12),
    radius: 9,
  };
}

/** MapGet ile aynı: içerikte .url yok; tıklanabilirlik dış kartın stack.url ile verilir. */
function fillWordLinkedStack(stack, word, ty) {
  const meta = stack.addText(`${word.level} · ${POS_TR[word.pos] || POS_TR.phrase}`);
  meta.textColor = new Color("#7dd3fc", 1);
  meta.font = Font.semiboldSystemFont(ty.meta);
  meta.lineLimit = 1;
  meta.minimumScaleFactor = 0.55;

  stack.addSpacer(3);
  const de = stack.addText(word.de);
  de.textColor = Color.white();
  de.font = Font.boldSystemFont(ty.de);
  de.minimumScaleFactor = 0.55;
  de.lineLimit = 1;

  stack.addSpacer(3);
  const tr = stack.addText(word.tr);
  tr.textColor = new Color("#e2e8f0", 1);
  tr.font = Font.systemFont(ty.tr);
  tr.minimumScaleFactor = 0.52;
  tr.lineLimit = 1;

  stack.addSpacer(3);
  const exOne = stack.addText(`Ö.: ${word.example || "—"}`);
  exOne.textColor = new Color("#cbd5e1", 1);
  exOne.font = Font.systemFont(ty.ex);
  exOne.lineLimit = 2;
  exOne.minimumScaleFactor = 0.5;
}

/** Üstte tam genişlik yatay yenile şeridi (orta+); ikon + yazı ortada, çok yüksek değil. */
function addRefreshBarFullWidth(parent, ru, widthPt) {
  const row = parent.addStack();
  row.layoutHorizontally();
  row.size = new Size(widthPt, 0);
  row.backgroundColor = new Color("#ffffff", 0.1);
  row.cornerRadius = 10;
  row.borderWidth = 1;
  row.borderColor = new Color("#7dd3fc", 0.22);
  row.setPadding(7, 12, 7, 12);
  row.centerAlignContent();
  row.url = ru;

  row.addSpacer(null);
  const inner = row.addStack();
  inner.layoutHorizontally();
  inner.spacing = 7;
  inner.centerAlignContent();
  inner.url = ru;

  const sym = SFSymbol.named("arrow.clockwise");
  sym.applyBoldWeight();
  const im = inner.addImage(sym.image);
  im.imageSize = new Size(17, 17);
  im.tintColor = new Color("#7dd3fc", 1);
  const lab = inner.addText("Yenile");
  lab.font = Font.semiboldSystemFont(11);
  lab.textColor = new Color("#bae6fd", 1);
  lab.lineLimit = 1;
  lab.minimumScaleFactor = 0.7;
  lab.url = ru;

  row.addSpacer(null);
  return row;
}

/** Widget genişliğine yakın pt (Scriptable tam flex yok); gri kart sağa kadar uzar. */
function approxFullBleedCardWidthPt() {
  const wf = config.widgetFamily;
  if (wf === "large" || wf === "extraLarge") return 364;
  if (wf === "medium") return 312;
  return 292;
}

/** 2. kelimeden itibaren tam genişlik kart (MapGet: yalnızca dış kart stack.url = https PWA) */
function buildFullWidthWordBlock(parent, word, ty, linksOk, addTopSpacer) {
  if (addTopSpacer) parent.addSpacer(3);
  const ch = wordCardChrome();
  const wrap = parent.addStack();
  wrap.layoutVertically();
  wrap.backgroundColor = ch.bg;
  wrap.cornerRadius = ch.radius;
  wrap.borderWidth = 1;
  wrap.borderColor = ch.border;
  wrap.setPadding(2, 2, 2, 2);
  const tap = wrap.addStack();
  tap.layoutVertically();
  tap.setPadding(6, 9, 6, 9);
  fillWordLinkedStack(tap, word, ty);
  const open = wordOpenUrl(word.id);
  if (linksOk && open) {
    wrap.url = open;
    wrap.size = new Size(approxFullBleedCardWidthPt(), 0);
  }
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

function pwaHomeUrl() {
  const raw = String(CONFIG.PWA_OPEN_URL || "").trim();
  if (!raw) return "";
  return raw.replace(/\/?$/, "/");
}

/** URL şemasından gelen parametre (Scriptable bazen anahtar büyük/küçük farkı üretebilir). */
function queryParamCI(name) {
  const want = String(name).toLowerCase();
  try {
    if (typeof args === "undefined" || !args.queryParameters) return "";
    const qp = args.queryParameters;
    for (const k of Object.keys(qp)) {
      if (String(k).toLowerCase() === want) return String(qp[k] != null ? qp[k] : "");
    }
  } catch (e) {}
  return "";
}

/** MapGet’teki Google Maps gibi: yalnızca https: sistem tarayıcısı / PWA açar, Scriptable scriptini yeniden çalıştırmaz. */
function wordOpenUrl(wordId) {
  const base = pwaHomeUrl();
  if (!base || !wordId) return "";
  return `${base}#/w/${encodeURIComponent(String(wordId))}`;
}

function homeOpenTapUrl() {
  return pwaHomeUrl();
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

function mapWordRow(row) {
  return {
    id: row.id,
    de: row.de,
    tr: row.tr,
    example: row.example,
    level: row.level,
    pos: normalizePos(row.pos),
    shownAt: row.shown_at,
  };
}

/** Widget: en yeni kayıtlar (tüm tabloyu çekme — hızlı). */
async function sbGetLatestWordsForWidget() {
  const base = CONFIG.SUPABASE_URL.replace(/\/+$/, "");
  const lim = 120;
  const req = new Request(
    `${base}/rest/v1/words?select=*&order=shown_at.desc&limit=${lim}`,
  );
  req.headers = sbHeaders();
  const data = await req.loadJSON();
  if (!Array.isArray(data)) return [];
  return data.map(mapWordRow);
}

/**
 * Üretim öncesi: veritabanındaki tüm Almanca lemmalar (yalnız `de`, sayfalı).
 * exclude listesi doğru kalsın; select=* ile tek istek yavaş / 1000 satır sınırına takılabilir.
 */
async function sbGetAllLemmaNormalizedSet() {
  const base = CONFIG.SUPABASE_URL.replace(/\/+$/, "");
  const lemmas = new Set();
  const page = 1000;
  let from = 0;
  for (;;) {
    const to = from + page - 1;
    const req = new Request(`${base}/rest/v1/words?select=de`);
    req.headers = { ...sbHeaders(), Range: `${from}-${to}` };
    const data = await req.loadJSON();
    if (!Array.isArray(data) || data.length === 0) break;
    for (const row of data) {
      if (row && row.de) lemmas.add(normalizeDe(row.de));
    }
    if (data.length < page) break;
    from += page;
  }
  return lemmas;
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
  const delay = Math.max(1, Math.floor(Number(ms) || 0));
  return new Promise((resolve) => {
    try {
      Timer.schedule(delay, false, resolve);
    } catch (e) {
      resolve();
    }
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
    `Bereits in der Datenbank gespeicherte verschiedene deutsche Lemmata (Anzahl): ${excludeSet.size}.`,
    "Das neue \"de\" darf keines dieser Lemmata sein (auch keine nahezu identische Schreibweise).",
    `Beispielliste (Auszug, normalisiert): ${excludeSample}`,
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
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        if (attempt > 0) await sleep(900 + 700 * attempt);
        return await fetchGeminiNewWordOnce(excludeSet, modelId);
      } catch (e) {
        lastErr = e;
        const msg = String(e.message || e);
        if (/Geçersiz/i.test(msg)) throw e;
        if (/Tekrar/i.test(msg)) continue;
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
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        if (attempt > 0) await sleep(500 + 450 * attempt);
        return await fetchGeminiNewWordsBatchOnce(excludeSet, count, modelId);
      } catch (e) {
        lastErr = e;
        const msg = String(e.message || e);
        if (/Geçersiz/i.test(msg)) throw e;
        if (/Duplikat|schon vorhanden|Batch unvollständig|unvollständig/i.test(msg)) continue;
        if (!isRetryableGeminiError(msg)) throw e;
      }
    }
  }
  throw lastErr;
}

/**
 * Önce tek istekte toplu kelime (hızlı). Çakışma / eksik yanıtta sırayla yedek (doğru ama daha yavaş).
 */
async function fetchNewWordsForRun(excludeSet, count) {
  try {
    return await fetchGeminiNewWordsBatch(excludeSet, count);
  } catch (batchErr) {
    const m = String(batchErr.message || batchErr);
    if (/Geçersiz/i.test(m)) throw batchErr;
    const seen = new Set(excludeSet);
    const out = [];
    for (let i = 0; i < count; i++) {
      const nw = await fetchGeminiNewWord(seen);
      seen.add(normalizeDe(nw.de));
      out.push(nw);
      if (i < count - 1) await sleep(280);
    }
    return out;
  }
}

async function fetchWidgetState() {
  try {
    const raw = await sbGetLatestWordsForWidget();
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
  w.setPadding(5, 10, 5, 10);

  const ty = widgetTypography();
  const ru = refreshRunUrl();
  const pwaBaseOk = Boolean(pwaHomeUrl());
  const linksOk = widgetSupportsStackLinks() && pwaBaseOk;
  const homeU = pwaHomeUrl();

  const head = w.addStack();
  head.layoutVertically();
  const title = head.addText("DeutschKart");
  title.textColor = new Color("#cbd5e1", 1);
  title.font = Font.semiboldSystemFont(ty.title);
  const homeTap = homeOpenTapUrl();
  if (linksOk && homeTap) {
    head.url = homeTap;
    title.url = homeTap;
  }

  if (!words || !words.length) {
    w.addSpacer(4);
    const t2 = w.addText(hint || "Ayarları kontrol edin.");
    t2.textColor = new Color("#94a3b8", 1);
    t2.font = Font.systemFont(12);
    t2.minimumScaleFactor = 0.65;
    if (linksOk && homeTap) t2.url = homeTap;
    return w;
  }

  w.addSpacer(2);

  const splitRefresh = widgetSupportsStackLinks() && Boolean(ru);
  const cardW = approxFullBleedCardWidthPt();

  if (splitRefresh) {
    addRefreshBarFullWidth(w, ru, cardW);
    w.addSpacer(4);
    for (let i = 0; i < words.length; i++) {
      buildFullWidthWordBlock(w, words[i], ty, linksOk, i > 0);
    }
  } else {
    for (let i = 0; i < words.length; i++) {
      buildFullWidthWordBlock(w, words[i], ty, linksOk, i > 0);
    }
    if (words.length && pwaBaseOk) {
      const u0 = wordOpenUrl(words[0].id);
      if (u0) w.url = u0;
    }
  }

  w.addSpacer(null);
  return w;
}

async function runGenerateFlow() {
  assertConfig();
  const exclude = await sbGetAllLemmaNormalizedSet();
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

  const isRefreshTap = queryParamCI("dkAction") === "refresh";
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
