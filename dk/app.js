(() => {
  const GEMINI_MODELS = ["gemini-3.1-flash-lite-preview"];

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
  const LS_GUIDES = "deutschkart_guides_v1";
  const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const POS_ORDER = ["noun", "verb", "adj", "phrase", "prep", "conj", "adv", "other"];
  const POS_LABEL_TR = {
    noun: "İsim",
    verb: "Fiil",
    adj: "Sıfat",
    phrase: "Kalıp / ifade",
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
      adjektiv: "adj",
      adjective: "adj",
      adverb: "adv",
      adverbium: "adv",
      präposition: "prep",
      preposition: "prep",
      konjunktion: "conj",
      conjunction: "conj",
      redewendung: "phrase",
      ausdruck: "phrase",
    };
    return map[s] || "phrase";
  }

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
      pos: normalizePos(row.pos),
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
      pos: word.pos || "phrase",
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

  function loadGuidesMap() {
    try {
      const raw = localStorage.getItem(LS_GUIDES);
      if (!raw) return {};
      const o = JSON.parse(raw);
      return o && typeof o === "object" ? o : {};
    } catch {
      return {};
    }
  }

  function saveGuidesMap(map) {
    localStorage.setItem(LS_GUIDES, JSON.stringify(map));
  }

  function getGuide(wordId) {
    return loadGuidesMap()[wordId] || null;
  }

  function setGuide(wordId, data) {
    const m = loadGuidesMap();
    m[wordId] = data;
    saveGuidesMap(m);
  }

  function clearGuide(wordId) {
    const m = loadGuidesMap();
    delete m[wordId];
    saveGuidesMap(m);
  }

  function findWordById(id) {
    return loadHistory().find((w) => w.id === id) || null;
  }

  async function fetchGeminiExplainOnce(apiKey, word, modelId) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
    const systemText = [
      "Du bist ein deutscher Sprachtrainer. Der Nutzer spricht Türkisch.",
      "Antworte NUR mit gültigem JSON (kein Markdown):",
      '{"ozetTr":"...","gramerTr":"...","ornekler":[{"de":"...","tr":"..."}],"ipucuTr":"..."}',
      "- ozetTr: 2-4 Sätze auf Türkisch (Bedeutung, typischer Kontext, Nuancen).",
      "- gramerTr: 1-3 Sätze auf Türkisch (Kasus, Verbform, trennbare Verben, Präpositionen …).",
      '- ornekler: genau 5 Objekte; "de" deutscher Satz, "tr" türkische Bedeutung.',
      "- ipucuTr: ein merkhilfreicher Satz auf Türkisch.",
      `Lemma (de): ${word.de}`,
      `Übersetzung (tr): ${word.tr}`,
      `Beispiel aus App: ${word.example}`,
      `Niveau: ${word.level}, Wortart-Code: ${word.pos || "phrase"}`,
    ].join("\n");

    const body = {
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ role: "user", parts: [{ text: "Erkläre dieses Lemma ausführlich." }] }],
      generationConfig: { temperature: 0.65, responseMimeType: "application/json" },
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
    const ozetTr = String(payload.ozetTr || "").trim();
    const gramerTr = String(payload.gramerTr || "").trim();
    const ipucuTr = String(payload.ipucuTr || "").trim();
    const ornekler = Array.isArray(payload.ornekler) ? payload.ornekler : [];
    if (!ozetTr || ornekler.length < 2) throw new Error("Geçersiz AI yanıtı.");

    return { ozetTr, gramerTr, ipucuTr, ornekler };
  }

  async function fetchGeminiExplain(apiKey, word) {
    let lastErr = new Error("AI yanıt vermedi.");
    for (const modelId of GEMINI_MODELS) {
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          if (attempt > 0) await sleep(1800 * attempt);
          return await fetchGeminiExplainOnce(apiKey, word, modelId);
        } catch (e) {
          lastErr = e;
          const msg = String(e.message || e);
          if (/Geçersiz/i.test(msg)) throw e;
          if (!isRetryableGemini(msg)) throw e;
        }
      }
    }
    throw lastErr;
  }

  async function fetchGeminiWordOnce(apiKey, excludeSet, modelId) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
    const excludeSample = Array.from(excludeSet)
      .sort()
      .slice(0, 120)
      .join(", ");

    const systemText = [
      'Du bist ein deutscher Sprachtrainer. Antworte NUR mit gültigem JSON (kein Markdown) exakt in dieser Form:',
      '{"de":"...","tr":"...","example":"...","level":"B1","pos":"noun"}',
      '- "de": ein deutsches Wort oder kurze Wendung (max. 4 Wörter). Substantive mit großem Anfangsbuchstaben.',
      '- "tr": türkische Übersetzung.',
      '- "example": ein deutscher Beispielsatz.',
      '- "level": A1,A2,B1,B2,C1 oder C2.',
      `- "pos": genau einer von: ${POS_ORDER.join(",")} (Wortart des Haupteintrags).`,
      `Bereits vorhandene verschiedene deutsche Lemmata (Anzahl): ${excludeSet.size}.`,
      'Das neue "de" darf keines dieser Lemmata sein.',
      `Beispielliste (Auszug): ${excludeSample}`,
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
    const pos = normalizePos(payload.pos);

    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      de,
      tr,
      example,
      level: levelRaw,
      pos,
      shownAt: new Date().toISOString(),
    };
  }

  async function fetchGeminiWord(apiKey, excludeSet) {
    let lastErr = new Error("Gemini yanıt vermedi.");
    for (const modelId of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        if (attempt > 0) await sleep(900 + 700 * attempt);
        return await fetchGeminiWordOnce(apiKey, excludeSet, modelId);
      } catch (e) {
        lastErr = e;
        const msg = String(e.message || e);
        if (/Geçersiz/i.test(msg)) throw e;
        if (/Tekrar kelime/i.test(msg)) continue;
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

  /** Seviye içinde POS grupları; filtre `gecmisPosFilter[level]` */
  let gecmisPosFilter = {};

  function buildLevelPosGroups(history) {
    const out = [];
    for (const level of LEVEL_ORDER) {
      const atLevel = history.filter((w) => (LEVEL_ORDER.includes(w.level) ? w.level : "B1") === level);
      if (!atLevel.length) continue;
      const groups = {};
      for (const p of POS_ORDER) groups[p] = [];
      for (const w of atLevel) {
        const p = normalizePos(w.pos);
        (groups[p] || groups.phrase).push(w);
      }
      for (const p of POS_ORDER) {
        groups[p].sort((a, b) => a.de.localeCompare(b.de, "de", { sensitivity: "base" }));
      }
      out.push({ level, groups });
    }
    return out;
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
  const detailRoot = document.getElementById("detail-root");
  const detailBack = document.getElementById("detail-back");
  const detailHead = document.getElementById("detail-head");
  const detailGuide = document.getElementById("detail-guide");
  const detailLoading = document.getElementById("detail-loading");
  const detailRegen = document.getElementById("detail-regen");
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

  gecmisRoot.addEventListener("click", (ev) => {
    const chip = ev.target.closest(".chip[data-level]");
    if (chip && chip.dataset.pos != null) {
      gecmisPosFilter[chip.dataset.level] = chip.dataset.pos;
      renderHistory();
      return;
    }
    const row = ev.target.closest(".history-item[data-word-id]");
    if (row && row.dataset.wordId) {
      location.hash = `#/w/${encodeURIComponent(row.dataset.wordId)}`;
    }
  });

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

  function renderGuideHtml(p) {
    const ex = (p.ornekler || [])
      .map(
        (o) =>
          `<li><span class="ex-de">${escapeHtml(o.de || "")}</span> — <span class="ex-tr">${escapeHtml(o.tr || "")}</span></li>`,
      )
      .join("");
    return (
      `<div class="guide-block"><h4>Özet</h4><p>${escapeHtml(p.ozetTr || "")}</p></div>` +
      (p.gramerTr
        ? `<div class="guide-block"><h4>Gramer</h4><p>${escapeHtml(p.gramerTr)}</p></div>`
        : "") +
      `<div class="guide-block"><h4>Örnek cümleler</h4><ul class="ex-list">${ex}</ul></div>` +
      (p.ipucuTr ? `<div class="guide-tip"><strong>İpucu:</strong> ${escapeHtml(p.ipucuTr)}</div>` : "")
    );
  }

  function renderHistory() {
    const history = loadHistory();
    const blocks = buildLevelPosGroups(history);
    if (blocks.length === 0) {
      gecmisRoot.innerHTML = '<p class="empty">Henüz kayıt yok.</p>';
      return;
    }
    gecmisRoot.innerHTML = blocks
      .map(({ level, groups }) => {
        const sel = gecmisPosFilter[level] || "all";
        const chips =
          `<div class="gecmis-chips" data-level="${escapeHtml(level)}">` +
          `<button type="button" class="chip${sel === "all" ? " active" : ""}" data-level="${escapeHtml(level)}" data-pos="all">Tümü</button>` +
          POS_ORDER.filter((pos) => (groups[pos] || []).length > 0)
            .map(
              (pos) =>
                `<button type="button" class="chip${sel === pos ? " active" : ""}" data-level="${escapeHtml(level)}" data-pos="${escapeHtml(pos)}">${escapeHtml(POS_LABEL_TR[pos] || pos)}</button>`,
            )
            .join("") +
          `</div>`;

        const wordsToShow =
          sel === "all"
            ? [...POS_ORDER.flatMap((pos) => groups[pos] || [])].sort((a, b) =>
                a.de.localeCompare(b.de, "de", { sensitivity: "base" }),
              )
            : groups[sel] || [];

        const list = wordsToShow
          .map(
            (w) =>
              `<button type="button" class="history-item" data-word-id="${escapeHtml(w.id)}">` +
              `<div class="history-de">${escapeHtml(w.de)}</div>` +
              `<div class="history-meta"><span class="mini-badge">${escapeHtml(w.level)}</span> ${escapeHtml(POS_LABEL_TR[normalizePos(w.pos)] || "")} · Türkçe: ${escapeHtml(w.tr)}</div>` +
              `<div class="history-ex">${escapeHtml(w.example)}</div>` +
              `</button>`,
          )
          .join("");

        return `<h3 class="section-title">${escapeHtml(level)}</h3>${chips}${list}`;
      })
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

  function closeDetailView() {
    if (!detailRoot) return;
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    detailRoot.hidden = true;
    document.body.classList.remove("detail-open");
    detailGuide.innerHTML = "";
    detailHead.innerHTML = "";
    detailLoading.hidden = true;
    detailRegen.hidden = true;
  }

  async function openWordDetailById(id) {
    if (!detailRoot) return;
    detailRoot.hidden = false;
    document.body.classList.add("detail-open");
    detailGuide.innerHTML = "";
    detailLoading.hidden = true;
    detailRegen.hidden = true;

    let w = findWordById(id);
    if (!w && sbConfigured()) {
      try {
        await sbPullMerge();
      } catch (_) {
        /* yoksay */
      }
      w = findWordById(id);
    }

    if (!w) {
      detailHead.innerHTML =
        '<p class="error">Kelime bulunamadı. Geçmişte yoksa <strong>Sunucudan çek</strong> deneyin.</p>';
      return;
    }

    detailHead.innerHTML =
      `<div class="detail-badges"><span class="badge">${escapeHtml(w.level)}</span>` +
      `<span class="badge badge-pos">${escapeHtml(POS_LABEL_TR[normalizePos(w.pos)])}</span></div>` +
      `<h2 class="word-de large">${escapeHtml(w.de)}</h2>` +
      `<p class="word-tr">${escapeHtml(w.tr)}</p>` +
      `<p class="word-ex"><em>${escapeHtml(w.example)}</em></p>`;

    const cached = getGuide(w.id);
    if (cached && cached.payload) {
      detailGuide.innerHTML = renderGuideHtml(cached.payload);
      detailRegen.hidden = false;
      return;
    }

    detailLoading.hidden = false;
    try {
      const apiKey = loadApiKey();
      if (!apiKey.trim()) throw new Error("Önce Ayarlar → API anahtarı.");
      const payload = await fetchGeminiExplain(apiKey, w);
      setGuide(w.id, { payload });
      detailGuide.innerHTML = renderGuideHtml(payload);
      detailRegen.hidden = false;
    } catch (e) {
      detailGuide.innerHTML = `<p class="error">${escapeHtml(e?.message || String(e))}</p>`;
      detailRegen.hidden = false;
    } finally {
      detailLoading.hidden = true;
    }
  }

  function syncHashToDetail() {
    if (!detailRoot) return;
    const m = location.hash.match(/^#\/?w\/([^/?#]+)/i);
    if (m) {
      const id = decodeURIComponent(m[1]);
      void openWordDetailById(id);
    } else {
      closeDetailView();
    }
  }

  if (detailBack) {
    detailBack.addEventListener("click", () => {
      closeDetailView();
      selectTab("gecmis");
    });
  }
  if (detailRegen) {
    detailRegen.addEventListener("click", async () => {
      const m = location.hash.match(/^#\/?w\/([^/?#]+)/i);
      if (!m) return;
      const id = decodeURIComponent(m[1]);
      clearGuide(id);
      detailGuide.innerHTML = "";
      await openWordDetailById(id);
    });
  }

  window.addEventListener("hashchange", () => syncHashToDetail());

  kartCard.addEventListener("click", (ev) => {
    if (ev.target.closest("button")) return;
    const cur = loadCurrent();
    if (cur && !kartCard.hidden) location.hash = `#/w/${encodeURIComponent(cur.id)}`;
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
    syncHashToDetail();
  })();
})();
