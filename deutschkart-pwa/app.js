(() => {
  const MODEL = "gemini-3.1-flash-lite-preview";
  const LS_KEY = "deutschkart_gemini_api_key";
  const LS_HISTORY = "deutschkart_history_v1";
  const LS_CURRENT = "deutschkart_current_v1";
  const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

  /** @typedef {{ id: string, de: string, tr: string, example: string, level: string, shownAt: string }} Word */

  function normalizeDe(de) {
    return String(de || "")
      .trim()
      .toLowerCase();
  }

  function loadApiKey() {
    try {
      return localStorage.getItem(LS_KEY) || "";
    } catch {
      return "";
    }
  }

  function saveApiKey(v) {
    localStorage.setItem(LS_KEY, v.trim());
  }

  function clearApiKey() {
    localStorage.removeItem(LS_KEY);
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(LS_HISTORY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveHistory(arr) {
    localStorage.setItem(LS_HISTORY, JSON.stringify(arr));
  }

  function loadCurrent() {
    try {
      const raw = localStorage.getItem(LS_CURRENT);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveCurrent(word) {
    localStorage.setItem(LS_CURRENT, JSON.stringify(word));
  }

  function stripFence(t) {
    let s = String(t || "").trim();
    if (s.startsWith("```")) {
      s = s.replace(/```json/gi, "").replace(/```/g, "").trim();
    }
    return s;
  }

  function sliceJsonObject(s) {
    const i = s.indexOf("{");
    const j = s.lastIndexOf("}");
    if (i === -1 || j === -1 || j < i) return s;
    return s.slice(i, j + 1);
  }

  function headwordsFromHistory(history) {
    return new Set(history.map((w) => normalizeDe(w.de)));
  }

  async function fetchGeminiWord(apiKey, excludeSet) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    const excludeSample = Array.from(excludeSet)
      .sort()
      .slice(0, 120)
      .join(", ");

    const systemText = [
      'Du bist ein deutscher Sprachtrainer. Antworte NUR mit gültigem JSON (kein Markdown) exakt in dieser Form:',
      '{"de":"...","tr":"...","example":"...","level":"B1"}',
      'Regeln:',
      '- "de": genau EIN deutsches Wort oder eine kurze Wendung (max. 4 Wörter), sinnvoll mit Artikel falls Nomen.',
      '- "tr": türkische Übersetzung/Gegenstück, knapp.',
      '- "example": EIN natürlicher deutscher Beispielsatz, der "de" sinnvoll verwendet.',
      '- "level": genau einer von: A1,A2,B1,B2,C1,C2 (CEFR).',
      `Wiederhole KEINES dieser bereits gezeigten Lemmata (normalisiert kleingeschrieben): ${excludeSample}`,
    ].join("\n");

    const body = {
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ role: "user", parts: [{ text: "Gib mir jetzt genau ein neues JSON-Objekt. Keine Wiederholungen aus der Liste." }] }],
      generationConfig: { temperature: 0.85, responseMimeType: "application/json" },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey.trim(),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || res.statusText || "Bilinmeyen hata";
      throw new Error(`Gemini ${res.status}: ${msg}`);
    }

    const rawText =
      data?.candidates
        ?.flatMap((c) => c?.content?.parts || [])
        .map((p) => p?.text)
        .filter(Boolean)
        .join("\n")
        .trim() || "";

    const jsonStr = sliceJsonObject(stripFence(rawText));
    let payload;
    try {
      payload = JSON.parse(jsonStr);
    } catch {
      throw new Error("Model geçerli JSON üretmedi.");
    }

    const de = String(payload.de || "").trim();
    const tr = String(payload.tr || "").trim();
    const example = String(payload.example || "").trim();
    const levelRaw = String(payload.level || "").trim().toUpperCase();
    if (!de || !tr || !example || !LEVEL_ORDER.includes(levelRaw)) {
      throw new Error("Eksik alan veya geçersiz seviye.");
    }
    if (excludeSet.has(normalizeDe(de))) {
      throw new Error("Model listedeki bir kelimeyi tekrarladı; tekrar deneyin.");
    }

    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      de,
      tr,
      example,
      level: levelRaw,
      shownAt: new Date().toISOString(),
    };
  }

  async function commitNewWord() {
    const apiKey = loadApiKey();
    if (!apiKey.trim()) throw new Error("Önce Ayarlar’dan Gemini API anahtarını kaydedin.");

    const history = loadHistory();
    const exclude = headwordsFromHistory(history);
    const word = await fetchGeminiWord(apiKey, exclude);

    if (exclude.has(normalizeDe(word.de))) throw new Error("Çakışma: kelime zaten geçmişte.");

    const next = [...history, word];
    saveHistory(next);
    saveCurrent(word);
    return word;
  }

  function groupedHistory(history) {
    const by = new Map();
    for (const lv of LEVEL_ORDER) by.set(lv, []);
    for (const w of history) {
      const lv = LEVEL_ORDER.includes(w.level) ? w.level : "B1";
      by.get(lv).push(w);
    }
    for (const lv of LEVEL_ORDER) {
      by.get(lv).sort((a, b) => a.de.localeCompare(b.de, "de", { sensitivity: "base" }));
    }
    return LEVEL_ORDER.map((level) => ({ level, words: by.get(level) }));
  }

  /* ——— UI ——— */
  const tabKart = document.getElementById("tab-kart");
  const tabGecmis = document.getElementById("tab-gecmis");
  const tabAyarlar = document.getElementById("tab-ayarlar");
  const panelKart = document.getElementById("panel-kart");
  const panelGecmis = document.getElementById("panel-gecmis");
  const panelAyarlar = document.getElementById("panel-ayarlar");

  const kartError = document.getElementById("kart-error");
  const kartEmpty = document.getElementById("kart-empty");
  const kartCard = document.getElementById("kart-card");
  const kartLevel = document.getElementById("kart-level");
  const kartDe = document.getElementById("kart-de");
  const kartTr = document.getElementById("kart-tr");
  const kartEx = document.getElementById("kart-ex");
  const btnYeni = document.getElementById("btn-yeni");

  const gecmisRoot = document.getElementById("gecmis-root");
  const apiKeyInput = document.getElementById("api-key");
  const btnKaydet = document.getElementById("btn-kaydet");
  const btnSil = document.getElementById("btn-sil");
  const ayarMesaj = document.getElementById("ayar-mesaj");

  function selectTab(which) {
    const items = [
      { key: "kart", btn: tabKart, panel: panelKart },
      { key: "gecmis", btn: tabGecmis, panel: panelGecmis },
      { key: "ayarlar", btn: tabAyarlar, panel: panelAyarlar },
    ];
    for (const { key, btn, panel } of items) {
      const active = key === which;
      btn.setAttribute("aria-selected", active ? "true" : "false");
      panel.classList.toggle("active", active);
      panel.toggleAttribute("hidden", !active);
    }
    if (which === "gecmis") renderHistory();
    if (which === "ayarlar") loadSettingsForm();
  }

  tabKart.addEventListener("click", () => selectTab("kart"));
  tabGecmis.addEventListener("click", () => selectTab("gecmis"));
  tabAyarlar.addEventListener("click", () => selectTab("ayarlar"));

  function showKartError(msg) {
    if (!msg) {
      kartError.hidden = true;
      kartError.textContent = "";
      return;
    }
    kartError.hidden = false;
    kartError.textContent = msg;
  }

  function renderKart() {
    const cur = loadCurrent();
    showKartError("");
    if (!cur) {
      kartEmpty.hidden = false;
      kartCard.hidden = true;
      return;
    }
    kartEmpty.hidden = true;
    kartCard.hidden = false;
    kartLevel.textContent = cur.level;
    kartDe.textContent = cur.de;
    kartTr.textContent = `Türkçe: ${cur.tr}`;
    kartEx.textContent = cur.example;
  }

  function renderHistory() {
    const history = loadHistory();
    const groups = groupedHistory(history);
    const visible = groups.filter((g) => g.words.length > 0);
    if (visible.length === 0) {
      gecmisRoot.innerHTML = '<p class="empty">Henüz kayıtlı kelime yok.</p>';
      return;
    }
    gecmisRoot.innerHTML = visible
      .map(
        ({ level, words }) =>
          `<h3 class="section-title">${level}</h3>` +
          words
            .map(
              (w) =>
                `<div class="history-item"><div class="history-de">${escapeHtml(w.de)}</div>` +
                `<div class="history-meta">Türkçe: ${escapeHtml(w.tr)}</div>` +
                `<div class="history-ex">${escapeHtml(w.example)}</div></div>`,
            )
            .join(""),
      )
      .join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadSettingsForm() {
    const k = loadApiKey();
    apiKeyInput.value = "";
    ayarMesaj.textContent = k ? "Kayıtlı anahtar var (güvenlik için yeniden gösterilmiyor)." : "Kayıtlı anahtar yok.";
  }

  btnKaydet.addEventListener("click", () => {
    const v = apiKeyInput.value.trim();
    if (!v) {
      ayarMesaj.textContent = "Boş anahtar kaydedilemez.";
      return;
    }
    saveApiKey(v);
    apiKeyInput.value = "";
    ayarMesaj.textContent = "Kaydedildi.";
  });

  btnSil.addEventListener("click", () => {
    clearApiKey();
    apiKeyInput.value = "";
    ayarMesaj.textContent = "Anahtar silindi.";
  });

  btnYeni.addEventListener("click", async () => {
    btnYeni.disabled = true;
    showKartError("");
    try {
      await commitNewWord();
      renderKart();
    } catch (e) {
      showKartError(e?.message || String(e));
    } finally {
      btnYeni.disabled = false;
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  renderKart();
})();
