(() => {
  const GEMINI_MODELS = ["gemini-3.1-flash-lite-preview", "gemini-2.0-flash"];

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isRetryableGemini(msg) {
    return /high demand|overloaded|429|503|try again|RESOURCE_EXHAUSTED|UNAVAILABLE|timeout/i.test(String(msg || ""));
  }
  const LS_KEY = "deutschkart_gemini_api_key";
  const LS_SB_URL = "deutschkart_sb_url";
  const LS_SB_ANON = "deutschkart_sb_anon";
  const LS_HISTORY = "deutschkart_history_v1";
  const LS_CURRENT = "deutschkart_current_v1";
  const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

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

  function loadSbUrl() {
    try {
      return (localStorage.getItem(LS_SB_URL) || "").trim().replace(/\/+$/, "");
    } catch {
      return "";
    }
  }

  function loadSbAnon() {
    try {
      return (localStorage.getItem(LS_SB_ANON) || "").trim();
    } catch {
      return "";
    }
  }

  function saveSbUrl(v) {
    localStorage.setItem(LS_SB_URL, v.trim().replace(/\/+$/, ""));
  }

  function saveSbAnon(v) {
    localStorage.setItem(LS_SB_ANON, v.trim());
  }

  function clearSb() {
    localStorage.removeItem(LS_SB_URL);
    localStorage.removeItem(LS_SB_ANON);
  }

  function sbConfigured() {
    return Boolean(loadSbUrl() && loadSbAnon());
  }

  function sbHeaders() {
    const k = loadSbAnon();
    return {
      apikey: k,
      Authorization: `Bearer ${k}`,
      "Content-Type": "application/json",
    };
  }

  function rowToWord(row) {
    return {
      id: row.id,
      de: row.de,
      tr: row.tr,
      example: row.example,
      level: row.level,
      shownAt: row.shown_at || row.shownAt,
    };
  }

  function mergeByDedupe(words) {
    const m = new Map();
    for (const w of words) {
      const key = normalizeDe(w.de);
      const prev = m.get(key);
      if (!prev || new Date(w.shownAt) > new Date(prev.shownAt)) m.set(key, w);
    }
    return [...m.values()];
  }

  async function sbPullMerge() {
    if (!sbConfigured()) return;
    const base = loadSbUrl();
    const r = await fetch(`${base}/rest/v1/words?select=*`, { headers: sbHeaders() });
    const rows = await r.json().catch(() => []);
    if (!r.ok) throw new Error(rows?.message || rows?.hint || `Supabase ${r.status}`);
    const remote = Array.isArray(rows) ? rows.map(rowToWord) : [];
    const local = loadHistory();
    const merged = mergeByDedupe([...remote, ...local]);
    saveHistory(merged);
    const sorted = [...merged].sort((a, b) => new Date(b.shownAt) - new Date(a.shownAt));
    if (sorted[0]) saveCurrent(sorted[0]);
  }

  async function sbInsertWord(word) {
    if (!sbConfigured()) return;
    const base = loadSbUrl();
    const row = {
      id: word.id,
      de: word.de,
      tr: word.tr,
      example: word.example,
      level: word.level,
      shown_at: word.shownAt,
    };
    const r = await fetch(`${base}/rest/v1/words`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
    if (r.status === 201 || r.status === 204) return;
    if (r.status === 409) return;
    const t = await r.text();
    throw new Error(t || `Supabase ${r.status}`);
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

  function sliceJsonObject(text) {
    const i = text.indexOf("{");
    const j = text.lastIndexOf("}");
    if (i === -1 || j === -1 || j < i) return text;
    return text.slice(i, j + 1);
  }

  function headwordsFromHistory(history) {
    return new Set(history.map((w) => normalizeDe(w.de)));
  }

  async function fetchGeminiWordOnce(apiKey, excludeSet, modelId) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
    const excludeSample = Array.from(excludeSet)
      .sort()
      .slice(0, 120)
      .join(", ");

    const systemText = [
      'Du bist ein deutscher Sprachtrainer. Antworte NUR mit gültigem JSON (kein Markdown) exakt in dieser Form:',
      '{"de":"...","tr":"...","example":"...","level":"B1"}',
      '- "de": ein deutsches Wort oder kurze Wendung (max. 4 Wörter).',
      '- "tr": türkische Übersetzung.',
      '- "example": ein deutscher Beispielsatz.',
      '- "level": A1,A2,B1,B2,C1 oder C2.',
      `Keine Wiederholungen: ${excludeSample}`,
    ].join("\n");

    const body = {
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ role: "user", parts: [{ text: "Neues JSON-Objekt." }] }],
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
      const msg = data?.error?.message || res.statusText;
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
    const payload = JSON.parse(jsonStr);
    const de = String(payload.de || "").trim();
    const tr = String(payload.tr || "").trim();
    const example = String(payload.example || "").trim();
    const levelRaw = String(payload.level || "").trim().toUpperCase();
    if (!de || !tr || !example || !LEVEL_ORDER.includes(levelRaw)) {
      throw new Error("Geçersiz yanıt.");
    }
    if (excludeSet.has(normalizeDe(de))) throw new Error("Tekrar kelime; tekrar deneyin.");

    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      de,
      tr,
      example,
      level: levelRaw,
      shownAt: new Date().toISOString(),
    };
  }

  async function fetchGeminiWord(apiKey, excludeSet) {
    let lastErr = new Error("Gemini yanıt vermedi.");
    for (const modelId of GEMINI_MODELS) {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          if (attempt > 0) await sleep(1800 * attempt);
          return await fetchGeminiWordOnce(apiKey, excludeSet, modelId);
        } catch (e) {
          lastErr = e;
          const msg = String(e.message || e);
          if (/Geçersiz|Tekrar kelime/i.test(msg)) throw e;
          if (!isRetryableGemini(msg)) throw e;
        }
      }
    }
    throw lastErr;
  }

  async function commitNewWord() {
    const apiKey = loadApiKey();
    if (!apiKey.trim()) throw new Error("Önce Ayarlar → API anahtarı.");

    if (sbConfigured()) await sbPullMerge();

    const history = loadHistory();
    const exclude = headwordsFromHistory(history);
    const word = await fetchGeminiWord(apiKey, exclude);
    saveHistory([...history, word]);
    saveCurrent(word);

    if (sbConfigured()) {
      await sbInsertWord(word);
      await sbPullMerge();
    }
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
  const btnSunucu = document.getElementById("btn-sunucu");

  const gecmisRoot = document.getElementById("gecmis-root");
  const apiKeyInput = document.getElementById("api-key");
  const btnKaydet = document.getElementById("btn-kaydet");
  const btnSil = document.getElementById("btn-sil");
  const ayarMesaj = document.getElementById("ayar-mesaj");
  const sbUrlInput = document.getElementById("sb-url");
  const sbAnonInput = document.getElementById("sb-anon");
  const btnSbKaydet = document.getElementById("btn-sb-kaydet");
  const btnSbSil = document.getElementById("btn-sb-sil");

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
    if (which === "gecmis") void pullAndRenderGecmis();
    if (which === "ayarlar") loadSettingsForm();
  }

  async function pullAndRenderGecmis() {
    try {
      if (sbConfigured()) await sbPullMerge();
    } catch (e) {
      gecmisRoot.innerHTML = `<p class="error">${escapeHtml(e?.message || String(e))}</p>`;
      return;
    }
    renderHistory();
  }

  tabKart.addEventListener("click", () => selectTab("kart"));
  tabGecmis.addEventListener("click", () => selectTab("gecmis"));
  tabAyarlar.addEventListener("click", () => selectTab("ayarlar"));

  function showKartError(msg) {
    kartError.hidden = !msg;
    kartError.textContent = msg || "";
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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderHistory() {
    const history = loadHistory();
    const visible = groupedHistory(history).filter((g) => g.words.length > 0);
    if (visible.length === 0) {
      gecmisRoot.innerHTML = '<p class="empty">Henüz kayıt yok.</p>';
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

  function loadSettingsForm() {
    const k = loadApiKey();
    apiKeyInput.value = "";
    sbUrlInput.value = loadSbUrl();
    sbAnonInput.value = "";
    let msg = [];
    if (k) msg.push("Gemini: kayıtlı.");
    else msg.push("Gemini: yok.");
    if (sbConfigured()) msg.push("Supabase: URL kayıtlı, anahtar yeniden girilmeden gösterilmez.");
    else msg.push("Supabase: yok (isteğe bağlı).");
    ayarMesaj.textContent = msg.join(" ");
  }

  btnKaydet.addEventListener("click", () => {
    const v = apiKeyInput.value.trim();
    if (!v) {
      ayarMesaj.textContent = "Gemini boş olamaz.";
      return;
    }
    saveApiKey(v);
    apiKeyInput.value = "";
    ayarMesaj.textContent = "Gemini kaydedildi.";
  });

  btnSil.addEventListener("click", () => {
    clearApiKey();
    apiKeyInput.value = "";
    ayarMesaj.textContent = "Gemini silindi.";
  });

  btnSbKaydet.addEventListener("click", () => {
    const u = sbUrlInput.value.trim().replace(/\/+$/, "");
    const a = sbAnonInput.value.trim();
    if (!u || !a) {
      ayarMesaj.textContent = "Supabase URL ve anon key birlikte girilmeli.";
      return;
    }
    saveSbUrl(u);
    saveSbAnon(a);
    sbAnonInput.value = "";
    ayarMesaj.textContent = "Supabase kaydedildi. Geçmiş sekmesinden çekin.";
  });

  btnSbSil.addEventListener("click", () => {
    clearSb();
    sbUrlInput.value = "";
    sbAnonInput.value = "";
    ayarMesaj.textContent = "Supabase silindi.";
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

  btnSunucu.addEventListener("click", async () => {
    btnSunucu.disabled = true;
    showKartError("");
    try {
      if (!sbConfigured()) {
        showKartError("Önce Ayarlar’da Supabase URL ve anon key kaydedin.");
        return;
      }
      await sbPullMerge();
      renderKart();
      ayarMesaj.textContent = "Sunucu ile eşitlendi.";
    } catch (e) {
      showKartError(e?.message || String(e));
    } finally {
      btnSunucu.disabled = false;
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  (async function boot() {
    try {
      if (sbConfigured()) await sbPullMerge();
    } catch {
      /* ilk açılışta ağ yoksa sessiz */
    }
    renderKart();
  })();
})();
