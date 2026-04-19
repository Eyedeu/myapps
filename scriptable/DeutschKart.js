// DeutschKart — Scriptable widget + Supabase (ana PWA ile ortak geçmiş)
// 1) Aşağıdaki CONFIG'ü doldur. 2) Scriptable'da bu dosyayı yeni script olarak yapıştırıp kaydet.
// 3) Ana ekran → + → Scriptable → bu scripti küçük/orta widget olarak ekle.
//
// Widget (arka plan yenilemesi): Supabase'teki son kelimeyi gösterir.
// Script'i Scriptable uygulamasından ▶ Çalıştır: "Yeni kelime?" → Evet ise Gemini + Supabase'e yazar; PWA Geçmiş'i de güncellenir.

const CONFIG = {
  GEMINI_API_KEY: "",
  SUPABASE_URL: "", // https://xxxxx.supabase.co (sonda / olmasın)
  SUPABASE_ANON_KEY: "",
};

const MODEL = "gemini-3.1-flash-lite-preview";
const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

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
  try {
    await req.load();
  } catch {
    /* 409 çakışma vb. */
  }
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

async function fetchGeminiNewWord(excludeSet) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
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

  const data = await req.loadJSON();
  if (data.error) throw new Error(data.error.message || "Gemini hata");

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

async function fetchLatestWord() {
  const words = await sbGetAllWords();
  if (!words.length) return null;
  return words.sort((a, b) => new Date(b.shownAt) - new Date(a.shownAt))[0];
}

function buildWidget(word) {
  const w = new ListWidget();
  w.backgroundColor = new Color("#0f1115", 1);
  w.setPadding(12, 12, 12, 12);

  if (!word) {
    const t = w.addText("DeutschKart");
    t.textColor = Color.lightGray();
    t.font = Font.semiboldSystemFont(13);
    w.addSpacer(6);
    const t2 = w.addText("Supabase boş veya ayar eksik. Scriptable'dan ▶ Çalıştır ile kelime üretin.");
    t2.textColor = Color.gray();
    t2.font = Font.systemFont(11);
    t2.minimumScaleFactor = 0.7;
    return w;
  }

  const badge = w.addText(word.level);
  badge.textColor = new Color("#7dd3fc", 1);
  badge.font = Font.boldSystemFont(11);

  w.addSpacer(4);
  const de = w.addText(word.de);
  de.textColor = Color.white();
  de.font = Font.boldSystemFont(16);
  de.minimumScaleFactor = 0.75;
  de.lineLimit = 2;

  w.addSpacer(4);
  const tr = w.addText(word.tr);
  tr.textColor = new Color("#b8c0d0", 1);
  tr.font = Font.systemFont(12);
  tr.lineLimit = 2;

  w.addSpacer(4);
  const ex = w.addText(word.example);
  ex.textColor = new Color("#9aa5b5", 1);
  ex.font = Font.systemFont(11);
  ex.lineLimit = 4;
  ex.minimumScaleFactor = 0.75;

  w.addSpacer(6);
  const hint = w.addText("Yeni kelime: Scriptable → bu script → ▶");
  hint.textColor = Color.darkGray();
  hint.font = Font.systemFont(10);

  return w;
}

async function runGenerateFlow() {
  assertConfig();
  const words = await sbGetAllWords();
  const exclude = new Set(words.map((w) => normalizeDe(w.de)));
  const newWord = await fetchGeminiNewWord(exclude);
  await sbInsertWord(newWord);
  return newWord;
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

  if (config.runsInWidget) {
    const latest = await fetchLatestWord();
    Script.setWidget(buildWidget(latest));
    Script.complete();
    return;
  }

  const alert = new Alert();
  alert.title = "DeutschKart";
  alert.message = "Yeni kelime Gemini ile üretilsin ve Supabase'e (PWA Geçmiş) yazılsın mı?";
  alert.addAction("Evet");
  alert.addCancelAction("Hayır");
  const choice = await alert.present();
  if (choice === 0) {
    const w = await runGenerateFlow();
    const ok = new Alert();
    ok.title = "Tamam";
    ok.message = `${w.de}\n${w.tr}`;
    ok.addAction("Kapat");
    await ok.present();
  }

  Script.complete();
}

await main();
