const DB_NAME = "recordbildung-assistant";
const DB_VERSION = 1;
const SETTINGS_KEY = "settings";
const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
const RECOVERY_KEY = "active-recording-session";
const ANALYSIS_PROMPT = `Sen bir Ausbildung ders asistanisin.
Asagidaki kurallara harfiyen uy:
1) Asla selamlama yazma. "Merhaba", "Selam", "Umarim" gibi cumleler kullanma.
2) Sadece ders icerigine odaklan.
3) Ciktin mutlaka GECERLI JSON olacak. JSON disinda hicbir metin yazma.
4) Almanca orijinal icerigi koru ve her bolum icin Turkce ceviri ver.
5) Ders disi, alakasiz, dedikodu turu konusmalari dahil etme.

Donus formati (anahtar adlarini degistirme):
{
  "title": "kisa baslik",
  "summary_tr": ["madde1", "madde2"],
  "summary_de": ["punkt1", "punkt2"],
  "key_points": [
    {
      "topic_tr": "konu",
      "topic_de": "thema",
      "detail_tr": "aciklama",
      "detail_de": "erklarung"
    }
  ],
  "terms": [
    {
      "term_de": "Fachbegriff",
      "meaning_tr": "Turkce karsiligi",
      "example_de": "Almanca kisa ornek",
      "example_tr": "Turkce kisa ceviri"
    }
  ]
}`;

let db;
let mediaRecorder;
let activeStream;
let chunks = [];
let pendingRecording = null;
let startedAt = 0;
let accumulatedDurationMs = 0;
let durationTimer;
let wakeLock = null;
let selectedHistoryLessonId = "all";
let recordingHeartbeatTimer;
let activeDetailLessonId = "";
let activeDetailRecordingId = "";

const els = {
  app: document.querySelector("#app"),
  mainView: document.querySelector("#mainView"),
  lessonDetailView: document.querySelector("#lessonDetailView"),
  lessonDetailTitle: document.querySelector("#lessonDetailTitle"),
  lessonDetailBackButton: document.querySelector("#lessonDetailBackButton"),
  lessonRecordingsList: document.querySelector("#lessonRecordingsList"),
  lessonRecordingContent: document.querySelector("#lessonRecordingContent"),
  clock: document.querySelector("#clock"),
  dateLine: document.querySelector("#dateLine"),
  durationLine: document.querySelector("#durationLine"),
  recordingState: document.querySelector("#recordingState"),
  recordingDot: document.querySelector("#recordingDot"),
  statusLine: document.querySelector("#statusLine"),
  controlPanel: document.querySelector("#controlPanel"),
  pauseButton: document.querySelector("#pauseButton"),
  saveButton: document.querySelector("#saveButton"),
  cancelButton: document.querySelector("#cancelButton"),
  startButton: document.querySelector("#startButton"),
  settingsToggleButton: document.querySelector("#settingsToggleButton"),
  savePanel: document.querySelector("#savePanel"),
  saveForm: document.querySelector("#saveForm"),
  lessonSelect: document.querySelector("#lessonSelect"),
  newLessonInput: document.querySelector("#newLessonInput"),
  saveRecordingButton: document.querySelector("#saveRecordingButton"),
  discardRecordingButton: document.querySelector("#discardRecordingButton"),
  settingsPanel: document.querySelector("#settingsPanel"),
  historyList: document.querySelector("#historyList"),
  historyLessonFilter: document.querySelector("#historyLessonFilter"),
  deleteLessonButton: document.querySelector("#deleteLessonButton"),
  settingsForm: document.querySelector("#settingsForm"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  closeSettingsButton: document.querySelector("#closeSettingsButton"),
};

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const nextDb = request.result;
      if (!nextDb.objectStoreNames.contains("lessons")) {
        nextDb.createObjectStore("lessons", { keyPath: "id" });
      }
      if (!nextDb.objectStoreNames.contains("recordings")) {
        const store = nextDb.createObjectStore("recordings", { keyPath: "id" });
        store.createIndex("lessonId", "lessonId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!nextDb.objectStoreNames.contains("settings")) {
        nextDb.createObjectStore("settings", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAll(storeName) {
  const tx = db.transaction(storeName, "readonly");
  return requestToPromise(tx.objectStore(storeName).getAll());
}

async function getOne(storeName, id) {
  const tx = db.transaction(storeName, "readonly");
  return requestToPromise(tx.objectStore(storeName).get(id));
}

async function putOne(storeName, value) {
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).put(value);
  await transactionDone(tx);
}

async function deleteOne(storeName, id) {
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).delete(id);
  await transactionDone(tx);
}

async function seedLessons() {
  return;
}

async function getSettings() {
  return (await getOne("settings", SETTINGS_KEY)) || { id: SETTINGS_KEY, geminiApiKey: "" };
}

async function saveApiKey(apiKey) {
  const current = await getSettings();
  await putOne("settings", { ...current, id: SETTINGS_KEY, geminiApiKey: apiKey.trim() });
}

function setStatus(message) {
  els.statusLine.textContent = message || "";
}

function setRecordingState(state, isRecording = false) {
  els.recordingState.textContent = state;
  els.recordingDot.classList.toggle("bg-red-500", isRecording);
  els.recordingDot.classList.toggle("bg-slate-600", !isRecording);
  els.recordingDot.classList.toggle("recording-dot", isRecording);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function formatPlaybackTime(seconds) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function tickClock() {
  const now = new Date();
  els.clock.textContent = now.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  els.dateLine.textContent = now.toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const isRecording = mediaRecorder?.state === "recording";
  const runningPart = isRecording && startedAt ? Date.now() - startedAt : 0;
  const totalMs = accumulatedDurationMs + runningPart;
  els.durationLine.textContent = formatDuration(totalMs);
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch {
    wakeLock = null;
  }
}

async function releaseWakeLock() {
  if (!wakeLock) return;
  try {
    await wakeLock.release();
  } catch {
    // Ignore release failures; the browser may have already released it.
  } finally {
    wakeLock = null;
  }
}

function showSavePanel(show) {
  els.savePanel.classList.toggle("hidden", !show);
}

function showSettingsPanel(show) {
  els.settingsPanel.classList.toggle("hidden", !show);
}

function setViewMode(detail) {
  els.mainView.classList.toggle("hidden", detail);
  els.lessonDetailView.classList.toggle("hidden", !detail);
}

async function refreshLessonSelect() {
  const lessons = (await getAll("lessons")).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  els.lessonSelect.innerHTML = lessons
    .map((lesson) => `<option value="${lesson.id}">${escapeHtml(lesson.name)}</option>`)
    .join("");
}

function refreshHistoryLessonFilter(lessons, recordings) {
  const sortedLessons = [...lessons].sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const options = [`<option value="all">Tum dersler</option>`];
  for (const lesson of sortedLessons) {
    options.push(`<option value="${lesson.id}">${escapeHtml(lesson.name)}</option>`);
  }
  const hasOrphans = recordings.some((recording) => !sortedLessons.some((lesson) => lesson.id === recording.lessonId));
  if (hasOrphans) {
    options.push(`<option value="unknown">Derssiz</option>`);
  }
  els.historyLessonFilter.innerHTML = options.join("");

  const validIds = new Set(["all", ...sortedLessons.map((lesson) => lesson.id), ...(hasOrphans ? ["unknown"] : [])]);
  if (!validIds.has(selectedHistoryLessonId)) {
    selectedHistoryLessonId = "all";
  }
  els.historyLessonFilter.value = selectedHistoryLessonId;
  const canDelete = selectedHistoryLessonId !== "all" && selectedHistoryLessonId !== "unknown";
  els.deleteLessonButton.disabled = !canDelete;
  els.deleteLessonButton.classList.toggle("opacity-50", !canDelete);
}

function setRecoveryState(state) {
  try {
    if (!state) {
      localStorage.removeItem(RECOVERY_KEY);
      return;
    }
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ ...state, updatedAt: Date.now() }));
  } catch {
    // Ignore storage failures in private mode.
  }
}

function getRecoveryState() {
  try {
    const raw = localStorage.getItem(RECOVERY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function stopRecordingHeartbeat() {
  if (!recordingHeartbeatTimer) return;
  window.clearInterval(recordingHeartbeatTimer);
  recordingHeartbeatTimer = undefined;
}

function startRecordingHeartbeat() {
  stopRecordingHeartbeat();
  recordingHeartbeatTimer = window.setInterval(() => {
    const active = mediaRecorder?.state === "recording" || mediaRecorder?.state === "paused";
    if (!active) return;
    setRecoveryState({
      active: true,
      mode: mediaRecorder.state,
      accumulatedDurationMs,
      startedAt,
    });
  }, 3000);
}

function bestMimeType() {
  if (!window.MediaRecorder) return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setRecordingState("Tarayici desteklemiyor", false);
    setStatus("Bu tarayici MediaRecorder destegini sunmuyor. iOS/Safari surumunu kontrol et.");
    return;
  }

  if (mediaRecorder?.state === "recording") {
    setStatus("Kayit zaten devam ediyor.");
    return;
  }

  try {
    activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    const mimeType = bestMimeType();
    mediaRecorder = new MediaRecorder(activeStream, mimeType ? { mimeType } : undefined);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      activeStream?.getTracks().forEach((track) => track.stop());
      activeStream = null;
    };

    mediaRecorder.start(1000);
    startedAt = Date.now();
    accumulatedDurationMs = 0;
    durationTimer = window.setInterval(tickClock, 1000);
    startRecordingHeartbeat();
    await requestWakeLock();
    setRecordingState("REC", true);
    updatePauseButton();
    setRecoveryState({
      active: true,
      mode: "recording",
      accumulatedDurationMs,
      startedAt,
    });
    setStatus("Kayit basladi.");
  } catch (error) {
    setRecordingState("Mikrofon izni gerekli", false);
    setStatus("Mikrofon baslatilamadi. Safari izinlerini kontrol et.");
    console.error(error);
  }
}

async function stopRecording({ save }) {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    setStatus("Aktif kayit yok.");
    return;
  }

  await new Promise((resolve) => {
    mediaRecorder.addEventListener("stop", resolve, { once: true });
    mediaRecorder.stop();
  });

  if (startedAt) {
    accumulatedDurationMs += Date.now() - startedAt;
  }
  window.clearInterval(durationTimer);
  stopRecordingHeartbeat();
  const durationMs = accumulatedDurationMs;
  startedAt = 0;
  accumulatedDurationMs = 0;
  await releaseWakeLock();
  setRecordingState("Kayit durdu", false);
  updatePauseButton();
  els.durationLine.textContent = "00:00:00";
  setRecoveryState(null);

  const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
  mediaRecorder = null;
  chunks = [];

  if (!save) {
    setStatus("Kayit silindi.");
    return;
  }

  if (!blob.size) {
    setStatus("Kayit bos gorunuyor, kaydedilmedi.");
    return;
  }

  pendingRecording = { blob, durationMs, mimeType: blob.type || "audio/webm" };
  await refreshLessonSelect();
  els.newLessonInput.value = "";
  showSavePanel(true);
  setStatus("Kaydi derse ekleyip kaydet.");
}

async function savePendingRecording() {
  if (!pendingRecording) return;

  const newLessonName = els.newLessonInput.value.trim();
  let lessonId = els.lessonSelect.value;

  if (newLessonName) {
    const lesson = {
      id: crypto.randomUUID(),
      name: newLessonName,
      createdAt: new Date().toISOString(),
    };
    await putOne("lessons", lesson);
    lessonId = lesson.id;
  }

  if (!lessonId) {
    setStatus("Once bir ders sec veya olustur.");
    return;
  }

  const now = new Date();
  await putOne("recordings", {
    id: crypto.randomUUID(),
    lessonId,
    blob: pendingRecording.blob,
    mimeType: pendingRecording.mimeType,
    durationMs: pendingRecording.durationMs,
    createdAt: now.toISOString(),
    title: `Kayit ${now.toLocaleString("tr-TR")}`,
    analysis: "",
    analyzedAt: "",
  });

  pendingRecording = null;
  showSavePanel(false);
  setStatus("Kayit IndexedDB icine kaydedildi.");
  await renderHistory();
}

async function renderHistory() {
  const [lessons, recordings] = await Promise.all([getAll("lessons"), getAll("recordings")]);
  refreshHistoryLessonFilter(lessons, recordings);

  const filteredRecordings =
    selectedHistoryLessonId === "all"
      ? recordings
      : selectedHistoryLessonId === "unknown"
        ? recordings.filter((recording) => !lessons.some((lesson) => lesson.id === recording.lessonId))
        : recordings.filter((recording) => recording.lessonId === selectedHistoryLessonId);

  if (!filteredRecordings.length) {
    const emptyMessage =
      selectedHistoryLessonId === "all" ? "Henuz kayit yok." : "Bu ders icin kayit yok.";
    els.historyList.innerHTML = `<div class="rounded-3xl border border-slate-800 p-6 text-center text-sm text-slate-400">${emptyMessage}</div>`;
    return;
  }

  const lessonMap = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  let grouped = lessons
    .map((lesson) => ({
      ...lesson,
      recordings: filteredRecordings
        .filter((recording) => recording.lessonId === lesson.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const orphanRecordings = filteredRecordings.filter((recording) => !lessonMap.has(recording.lessonId));
  if (orphanRecordings.length) {
    grouped.push({ id: "unknown", name: "Derssiz", recordings: orphanRecordings });
  }

  grouped = grouped.filter((lesson) => lesson.recordings.length);

  els.historyList.innerHTML = grouped
    .map(
      (lesson) => `
        <article class="rounded-3xl border border-slate-800 bg-black/50 p-4">
          <h3 class="text-lg font-semibold">${escapeHtml(lesson.name)}</h3>
          <div class="mt-3 space-y-3">
            ${lesson.recordings.map((recording) => renderRecordingListItem(recording, lesson.id)).join("")}
          </div>
        </article>
      `,
    )
    .join("");
}

function renderRecordingCard(recording) {
  const date = new Date(recording.createdAt).toLocaleString("tr-TR");
  const url = URL.createObjectURL(recording.blob);
  const safeUrl = escapeHtml(url);
  const totalSeconds = Math.max(0, Math.floor((recording.durationMs || 0) / 1000));
  const totalText = formatPlaybackTime(totalSeconds);
  return `
    <section class="rounded-2xl border border-slate-800 bg-slate-950 p-3" data-recording-id="${recording.id}">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold">${escapeHtml(recording.title || "Kayit")}</p>
          <p class="text-xs text-slate-500">${escapeHtml(date)} - ${totalText}</p>
        </div>
        <button class="delete-recording rounded-xl bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-200">Sil</button>
      </div>
      <audio class="recording-audio mt-3 w-full" controls src="${safeUrl}" data-recording-id="${recording.id}"></audio>
      <div class="mt-2">
        <input
          class="recording-progress w-full accent-emerald-500"
          data-recording-id="${recording.id}"
          type="range"
          min="0"
          max="${totalSeconds || 1}"
          value="0"
          step="1"
          dir="ltr"
        />
        <div class="mt-1 flex items-center justify-between text-[11px] text-slate-500">
          <span class="playback-current" data-recording-id="${recording.id}">00:00</span>
          <span class="playback-total" data-recording-id="${recording.id}">${totalText}</span>
        </div>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <button class="analyze-recording rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-950">Analiz Et</button>
        <button class="download-recording rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold" data-url="${safeUrl}">Indir</button>
      </div>
      ${recording.analysis ? renderAnalysisBlock(recording.analysis) : `<p class="mt-3 text-xs text-slate-500">AI analizi henuz yok.</p>`}
    </section>
  `;
}

function renderRecordingListItem(recording, lessonId) {
  const date = new Date(recording.createdAt).toLocaleString("tr-TR");
  return `
    <button
      class="open-recording-detail w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 text-left hover:border-emerald-500/50"
      data-detail-lesson-id="${lessonId}"
      data-detail-recording-id="${recording.id}"
      type="button"
    >
      <p class="text-sm font-semibold text-slate-100">${escapeHtml(recording.title || "Kayit")}</p>
      <p class="mt-1 text-xs text-slate-500">${escapeHtml(date)}</p>
    </button>
  `;
}

function parseAnalysisJson(rawAnalysis) {
  if (!rawAnalysis) return null;
  const cleaned = String(rawAnalysis)
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function renderBulletList(items, className) {
  if (!Array.isArray(items) || !items.length) return `<p class="${className} text-slate-500">-</p>`;
  return `<ul class="${className} list-disc space-y-1 pl-5">${items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
}

function renderAnalysisBlock(rawAnalysis) {
  const data = parseAnalysisJson(rawAnalysis);
  if (!data) {
    return `<pre class="mt-3 whitespace-pre-wrap rounded-2xl bg-slate-900 p-3 text-xs leading-5 text-slate-200">${escapeHtml(rawAnalysis)}</pre>`;
  }

  const summaryTr = renderBulletList(data.summary_tr, "mt-2 text-xs text-slate-100");
  const summaryDe = renderBulletList(data.summary_de, "mt-2 text-xs text-indigo-200");
  const keyPoints = Array.isArray(data.key_points)
    ? data.key_points
        .map((point) => {
          return `
            <article class="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <p class="text-xs font-semibold text-emerald-300">${escapeHtml(point.topic_tr || "-")}</p>
              <p class="mt-1 text-xs text-slate-200">${escapeHtml(point.detail_tr || "-")}</p>
              <p class="mt-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-300">${escapeHtml(point.topic_de || "-")}</p>
              <p class="mt-1 text-xs text-indigo-100">${escapeHtml(point.detail_de || "-")}</p>
            </article>
          `;
        })
        .join("")
    : "";

  const termsRows = Array.isArray(data.terms)
    ? data.terms
        .map((term) => {
          return `
            <tr class="border-t border-slate-800">
              <td class="px-2 py-2 align-top text-indigo-200">${escapeHtml(term.term_de || "-")}</td>
              <td class="px-2 py-2 align-top text-slate-200">${escapeHtml(term.meaning_tr || "-")}</td>
              <td class="px-2 py-2 align-top text-[11px] text-indigo-100">${escapeHtml(term.example_de || "-")}</td>
              <td class="px-2 py-2 align-top text-[11px] text-slate-300">${escapeHtml(term.example_tr || "-")}</td>
            </tr>
          `;
        })
        .join("")
    : "";

  return `
    <section class="mt-3 rounded-2xl border border-slate-700 bg-gradient-to-b from-slate-900 to-slate-950 p-3">
      <h4 class="text-sm font-semibold text-emerald-300">${escapeHtml(data.title || "Ders Analizi")}</h4>
      <div class="mt-3 grid gap-2 sm:grid-cols-2">
        <article class="rounded-xl bg-slate-950/70 p-3">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ozet (TR)</p>
          ${summaryTr}
        </article>
        <article class="rounded-xl bg-slate-950/70 p-3">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-indigo-300">Zusammenfassung (DE)</p>
          ${summaryDe}
        </article>
      </div>
      ${
        keyPoints
          ? `<div class="mt-3">
               <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Kritik Noktalar / Schwerpunkte</p>
               <div class="mt-2 space-y-2">${keyPoints}</div>
             </div>`
          : ""
      }
      ${
        termsRows
          ? `<div class="mt-3 overflow-x-auto rounded-xl border border-slate-800">
               <table class="min-w-full border-collapse text-xs">
                 <thead class="bg-slate-900">
                   <tr class="text-left text-slate-400">
                     <th class="px-2 py-2">DE Terim</th>
                     <th class="px-2 py-2">TR Anlam</th>
                     <th class="px-2 py-2">DE Ornek</th>
                     <th class="px-2 py-2">TR Ceviri</th>
                   </tr>
                 </thead>
                 <tbody>${termsRows}</tbody>
               </table>
             </div>`
          : ""
      }
    </section>
  `;
}

function updatePauseButton() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    els.pauseButton.textContent = "Durdur";
    els.pauseButton.disabled = true;
    els.pauseButton.classList.add("opacity-50");
    return;
  }

  if (mediaRecorder.state === "paused") {
    els.pauseButton.textContent = "Devam Et";
  } else {
    els.pauseButton.textContent = "Durdur";
  }
  els.pauseButton.disabled = false;
  els.pauseButton.classList.remove("opacity-50");
}

function togglePauseResume() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    setStatus("Duraklatmak icin aktif kayit olmali.");
    updatePauseButton();
    return;
  }
  if (mediaRecorder.state === "recording") {
    mediaRecorder.pause();
    if (startedAt) {
      accumulatedDurationMs += Date.now() - startedAt;
    }
    startedAt = 0;
    setRecordingState("Duraklatildi", false);
    setStatus("Kayit durduruldu. Devam Et ile surdur.");
    setRecoveryState({
      active: true,
      mode: "paused",
      accumulatedDurationMs,
      startedAt,
    });
  } else if (mediaRecorder.state === "paused") {
    mediaRecorder.resume();
    startedAt = Date.now();
    setRecordingState("REC", true);
    setStatus("Kayit devam ediyor.");
    setRecoveryState({
      active: true,
      mode: "recording",
      accumulatedDurationMs,
      startedAt,
    });
  }
  updatePauseButton();
}

function syncPlaybackUi(recordingId, audio) {
  if (!recordingId || !audio) return;
  const scope = audio.closest("[data-player-scope]") || document;
  const progress = scope.querySelector(`.recording-progress[data-recording-id="${recordingId}"]`);
  const current = scope.querySelector(`.playback-current[data-recording-id="${recordingId}"]`);
  const total = scope.querySelector(`.playback-total[data-recording-id="${recordingId}"]`);
  if (!progress || !current || !total) return;

  const durationSeconds = Number.isFinite(audio.duration) && audio.duration > 0 ? Math.floor(audio.duration) : Number(progress.max) || 0;
  progress.max = String(Math.max(durationSeconds, 1));
  progress.value = String(Math.min(Math.floor(audio.currentTime || 0), Number(progress.max)));
  current.textContent = formatPlaybackTime(audio.currentTime || 0);
  total.textContent = formatPlaybackTime(durationSeconds);
}

function attachPlaybackHandlers(scopeEl) {
  if (!scopeEl) return;
  const players = scopeEl.querySelectorAll(".recording-audio");
  for (const audio of players) {
    if (audio.dataset.playbackBound === "true") continue;
    audio.dataset.playbackBound = "true";
    const recordingId = audio.dataset.recordingId;
    audio.addEventListener("loadedmetadata", () => syncPlaybackUi(recordingId, audio));
    audio.addEventListener("timeupdate", () => syncPlaybackUi(recordingId, audio));
    audio.addEventListener("seeked", () => syncPlaybackUi(recordingId, audio));
    audio.addEventListener("durationchange", () => syncPlaybackUi(recordingId, audio));
    syncPlaybackUi(recordingId, audio);
  }

  const sliders = scopeEl.querySelectorAll(".recording-progress");
  for (const slider of sliders) {
    if (slider.dataset.sliderBound === "true") continue;
    slider.dataset.sliderBound = "true";
    slider.addEventListener("input", () => {
      const recordingId = slider.dataset.recordingId;
      const audio = scopeEl.querySelector(`.recording-audio[data-recording-id="${recordingId}"]`);
      if (!audio) return;
      audio.currentTime = Number(slider.value) || 0;
      syncPlaybackUi(recordingId, audio);
    });
  }
}

function renderLessonRecordingDetail(recording) {
  if (!recording) {
    els.lessonRecordingContent.innerHTML =
      `<div class="rounded-2xl border border-slate-800 p-6 text-center text-sm text-slate-400">Kayit secilmedi.</div>`;
    return;
  }
  const date = new Date(recording.createdAt).toLocaleString("tr-TR");
  const url = URL.createObjectURL(recording.blob);
  const safeUrl = escapeHtml(url);
  const totalSeconds = Math.max(0, Math.floor((recording.durationMs || 0) / 1000));
  const totalText = formatPlaybackTime(totalSeconds);
  els.lessonRecordingContent.setAttribute("data-player-scope", "detail");
  els.lessonRecordingContent.innerHTML = `
    <article class="rounded-2xl border border-slate-800 bg-slate-950 p-3">
      <p class="text-sm font-semibold">${escapeHtml(recording.title || "Kayit")}</p>
      <p class="text-xs text-slate-500">${escapeHtml(date)} - ${totalText}</p>
      <audio class="recording-audio mt-3 w-full" controls src="${safeUrl}" data-recording-id="${recording.id}"></audio>
      <div class="mt-2">
        <input class="recording-progress w-full accent-emerald-500" data-recording-id="${recording.id}" type="range" min="0" max="${totalSeconds || 1}" value="0" step="1" dir="ltr" />
        <div class="mt-1 flex items-center justify-between text-[11px] text-slate-500">
          <span class="playback-current" data-recording-id="${recording.id}">00:00</span>
          <span class="playback-total" data-recording-id="${recording.id}">${totalText}</span>
        </div>
      </div>
      ${recording.analysis ? renderAnalysisBlock(recording.analysis) : `<p class="mt-3 text-xs text-slate-500">AI analizi henuz yok.</p>`}
    </article>
  `;
  attachPlaybackHandlers(els.lessonRecordingContent);
}

async function renderLessonDetailView(lessonId, preferredRecordingId = "") {
  const [lesson, recordings] = await Promise.all([getOne("lessons", lessonId), getAll("recordings")]);
  if (!lesson) {
    els.lessonDetailTitle.textContent = "Ders bulunamadi";
    els.lessonRecordingsList.innerHTML =
      `<div class="rounded-2xl border border-slate-800 p-4 text-xs text-slate-400">Bu ders silinmis veya bulunamadi.</div>`;
    els.lessonRecordingContent.innerHTML = "";
    return;
  }
  activeDetailLessonId = lessonId;
  const lessonRecordings = recordings
    .filter((recording) => recording.lessonId === lessonId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  els.lessonDetailTitle.textContent = lesson.name;
  if (!lessonRecordings.length) {
    els.lessonRecordingsList.innerHTML =
      `<div class="rounded-2xl border border-slate-800 p-4 text-xs text-slate-400">Bu derste kayit yok.</div>`;
    els.lessonRecordingContent.innerHTML = "";
    return;
  }

  const selected =
    lessonRecordings.find((recording) => recording.id === preferredRecordingId) ||
    lessonRecordings.find((recording) => recording.id === activeDetailRecordingId) ||
    lessonRecordings[0];
  activeDetailRecordingId = selected.id;

  els.lessonRecordingsList.innerHTML = lessonRecordings
    .map((recording) => {
      const active = recording.id === activeDetailRecordingId;
      return `
        <button
          class="lesson-recording-item w-full rounded-xl border px-3 py-2 text-left ${active ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-900/60"}"
          data-detail-recording-id="${recording.id}"
          type="button"
        >
          <p class="text-xs font-semibold">${escapeHtml(recording.title || "Kayit")}</p>
          <p class="mt-1 text-[11px] text-slate-400">${formatPlaybackTime((recording.durationMs || 0) / 1000)}</p>
        </button>
      `;
    })
    .join("");

  renderLessonRecordingDetail(selected);
}

async function blobToBase64(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function analyzeRecording(recordingId, button) {
  const settings = await getSettings();
  if (!settings.geminiApiKey) {
    setStatus("Analiz icin once Settings icinde Gemini API key gir.");
    return;
  }

  const recording = await getOne("recordings", recordingId);
  if (!recording) return;

  button.disabled = true;
  button.textContent = "Analiz ediliyor...";
  setStatus(`Ses ${GEMINI_MODEL} ile analiz ediliyor.`);

  try {
    const base64Audio = await blobToBase64(recording.blob);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(settings.geminiApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: ANALYSIS_PROMPT },
                {
                  inlineData: {
                    mimeType: recording.mimeType || "audio/webm",
                    data: base64Audio,
                  },
                },
              ],
            },
          ],
        }),
      },
    );

    const payload = await response.json();
    if (!response.ok) {
      const providerMessage = payload.error?.message || "";
      const modelUnavailable =
        /model|not found|unsupported|permission|not available|does not exist|not allowed/i.test(providerMessage) ||
        response.status === 400 ||
        response.status === 404;
      if (modelUnavailable) {
        throw new Error(
          `${GEMINI_MODEL} su an kullanilamiyor. Baska bir model zorunluysa lutfen bana bildir.`,
        );
      }
      throw new Error(providerMessage || "Gemini istegi basarisiz oldu.");
    }

    const text =
      payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("\n")
        .trim() || "Gemini bos yanit dondurdu.";

    await putOne("recordings", {
      ...recording,
      title: parseAnalysisJson(text)?.title?.trim() || recording.title,
      analysis: text,
      analyzedAt: new Date().toISOString(),
    });
    await renderHistory();
    setStatus("Analiz kaydedildi.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Analiz sirasinda hata olustu.");
  } finally {
    button.disabled = false;
    button.textContent = "Analiz Et";
  }
}

async function deleteRecording(recordingId) {
  await deleteOne("recordings", recordingId);
  await renderHistory();
  setStatus("Kayit silindi.");
}

async function deleteLesson(lessonId) {
  if (!lessonId || lessonId === "all" || lessonId === "unknown") return;
  const lesson = await getOne("lessons", lessonId);
  if (!lesson) {
    setStatus("Ders bulunamadi.");
    return;
  }
  const ok = window.confirm(`"${lesson.name}" dersi ve bu derse ait tum kayitlar silinsin mi?`);
  if (!ok) return;

  const recordings = await getAll("recordings");
  const toDelete = recordings.filter((recording) => recording.lessonId === lessonId);
  for (const recording of toDelete) {
    await deleteOne("recordings", recording.id);
  }
  await deleteOne("lessons", lessonId);
  await refreshLessonSelect();
  selectedHistoryLessonId = "all";
  await renderHistory();
  setStatus(`"${lesson.name}" dersi silindi.`);
}

async function downloadRecording(recordingId, url) {
  const recording = await getOne("recordings", recordingId);
  const ext = (recording?.mimeType || "").includes("mp4") ? "m4a" : "webm";
  const link = document.createElement("a");
  link.href = url;
  link.download = `${recordingId}.${ext}`;
  link.click();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bindEvents() {
  updatePauseButton();
  els.pauseButton.addEventListener("click", togglePauseResume);
  els.saveButton.addEventListener("click", () => stopRecording({ save: true }));
  els.cancelButton.addEventListener("click", () => stopRecording({ save: false }));
  els.startButton.addEventListener("click", startRecording);
  els.settingsToggleButton.addEventListener("click", () => showSettingsPanel(true));
  els.closeSettingsButton.addEventListener("click", () => showSettingsPanel(false));

  els.saveForm.addEventListener("submit", (event) => {
    event.preventDefault();
    savePendingRecording();
  });
  els.discardRecordingButton.addEventListener("click", () => {
    pendingRecording = null;
    showSavePanel(false);
    setStatus("Bekleyen kayit silindi.");
  });

  els.settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveApiKey(els.apiKeyInput.value);
    setStatus("Gemini API key kaydedildi.");
    showSettingsPanel(false);
  });

  els.historyLessonFilter.addEventListener("change", async () => {
    selectedHistoryLessonId = els.historyLessonFilter.value || "all";
    await renderHistory();
  });
  els.deleteLessonButton.addEventListener("click", async () => {
    await deleteLesson(selectedHistoryLessonId);
  });

  els.lessonDetailBackButton.addEventListener("click", () => {
    setViewMode(false);
    activeDetailLessonId = "";
    activeDetailRecordingId = "";
  });

  els.lessonRecordingsList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-detail-recording-id]");
    if (!button || !activeDetailLessonId) return;
    activeDetailRecordingId = button.dataset.detailRecordingId;
    await renderLessonDetailView(activeDetailLessonId, activeDetailRecordingId);
  });

  els.historyList.addEventListener("click", async (event) => {
    const item = event.target.closest(".open-recording-detail");
    if (!item) return;
    setViewMode(true);
    await renderLessonDetailView(item.dataset.detailLessonId, item.dataset.detailRecordingId);
  });

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "hidden" && mediaRecorder?.state === "recording") {
      // Push buffered audio chunks before potential suspension.
      try {
        mediaRecorder.requestData();
      } catch {
        // Ignore requestData failures if recorder has just changed state.
      }
    }

    if (document.visibilityState === "visible") {
      if (mediaRecorder?.state === "recording") {
        await requestWakeLock();
      }
      const recovery = getRecoveryState();
      const hadActiveSession = recovery?.active && (recovery.mode === "recording" || recovery.mode === "paused");
      const recorderLost = !mediaRecorder || mediaRecorder.state === "inactive";
      if (hadActiveSession && recorderLost) {
        setStatus("Arka planda kayit kesilmis olabilir. Yeni kayit otomatik baslatiliyor...");
        await startRecording();
      }
    }
  });

  window.addEventListener("pagehide", () => {
    if (mediaRecorder?.state === "recording") {
      try {
        mediaRecorder.requestData();
      } catch {
        // Ignore at unload boundaries.
      }
    }
  });
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch (error) {
    console.warn("Service worker kaydi basarisiz:", error);
  }
}

async function init() {
  tickClock();
  window.setInterval(tickClock, 1000);
  bindEvents();
  db = await openDb();
  await seedLessons();
  const settings = await getSettings();
  els.apiKeyInput.value = settings.geminiApiKey || "";
  setViewMode(false);
  await renderHistory();
  showSavePanel(false);
  showSettingsPanel(false);
  await registerServiceWorker();
  const recovery = getRecoveryState();
  if (recovery?.active) {
    setStatus("Onceki oturumda aktif kayit algilandi. Otomatik kayit baslatiliyor...");
  }
  await startRecording();
}

init().catch((error) => {
  console.error(error);
  setStatus("Uygulama baslatilirken hata olustu.");
});
