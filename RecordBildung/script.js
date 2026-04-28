const DB_NAME = "recordbildung-assistant";
const DB_VERSION = 1;
const SETTINGS_KEY = "settings";
const DEFAULT_LESSONS = ["Matematik", "Mekanik", "Mevzuat"];
const GEMINI_MODEL = "gemini-1.5-flash";
const ANALYSIS_PROMPT = `Sen bir Ausbildung asistanisin. Bu ses kaydindaki Almanca ders anlatimini transkript et. Mikrofonun hemen yanindaki ogrencilerin yaptigi ders disi, alakasiz konusmalari (geyik muhabbeti, ozel sohbetler) tamamen ayikla. Sadece ogretmenin anlattigi teknik bilgileri ve dersle ilgili mantikli ogrenci sorularini tut. Sonucu Turkce ozetle ve onemli Almanca teknik terimleri sozluk gibi acikla.`;

let db;
let mediaRecorder;
let activeStream;
let chunks = [];
let pendingRecording = null;
let startedAt = 0;
let durationTimer;
let wakeLock = null;
let controlsVisible = false;

const els = {
  app: document.querySelector("#app"),
  clock: document.querySelector("#clock"),
  dateLine: document.querySelector("#dateLine"),
  durationLine: document.querySelector("#durationLine"),
  recordingState: document.querySelector("#recordingState"),
  recordingDot: document.querySelector("#recordingDot"),
  statusLine: document.querySelector("#statusLine"),
  controlPanel: document.querySelector("#controlPanel"),
  stopButton: document.querySelector("#stopButton"),
  cancelButton: document.querySelector("#cancelButton"),
  startButton: document.querySelector("#startButton"),
  historyButton: document.querySelector("#historyButton"),
  settingsButton: document.querySelector("#settingsButton"),
  saveModal: document.querySelector("#saveModal"),
  saveForm: document.querySelector("#saveForm"),
  lessonSelect: document.querySelector("#lessonSelect"),
  newLessonInput: document.querySelector("#newLessonInput"),
  saveRecordingButton: document.querySelector("#saveRecordingButton"),
  discardRecordingButton: document.querySelector("#discardRecordingButton"),
  historyModal: document.querySelector("#historyModal"),
  historyList: document.querySelector("#historyList"),
  closeHistoryButton: document.querySelector("#closeHistoryButton"),
  settingsModal: document.querySelector("#settingsModal"),
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
  const existing = await getAll("lessons");
  if (existing.length) return;

  const tx = db.transaction("lessons", "readwrite");
  const store = tx.objectStore("lessons");
  for (const name of DEFAULT_LESSONS) {
    store.put({ id: crypto.randomUUID(), name, createdAt: new Date().toISOString() });
  }
  await transactionDone(tx);
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

  if (startedAt) {
    els.durationLine.textContent = formatDuration(Date.now() - startedAt);
  }
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

function showControls(show = !controlsVisible) {
  controlsVisible = show;
  els.controlPanel.classList.toggle("translate-y-full", !show);
  els.controlPanel.classList.toggle("opacity-0", !show);
  els.controlPanel.classList.toggle("pointer-events-none", !show);
  els.controlPanel.setAttribute("aria-hidden", String(!show));
}

async function refreshLessonSelect() {
  const lessons = (await getAll("lessons")).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  els.lessonSelect.innerHTML = lessons
    .map((lesson) => `<option value="${lesson.id}">${escapeHtml(lesson.name)}</option>`)
    .join("");
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
    durationTimer = window.setInterval(tickClock, 1000);
    await requestWakeLock();
    setRecordingState("REC", true);
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

  window.clearInterval(durationTimer);
  const durationMs = Date.now() - startedAt;
  startedAt = 0;
  await releaseWakeLock();
  setRecordingState("Kayit durdu", false);
  els.durationLine.textContent = "00:00:00";

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
  showDialog(els.saveModal);
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
  els.saveModal.close();
  setStatus("Kayit IndexedDB icine kaydedildi.");
  await renderHistory();
}

async function renderHistory() {
  const [lessons, recordings] = await Promise.all([getAll("lessons"), getAll("recordings")]);
  const lessonMap = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const grouped = lessons
    .map((lesson) => ({
      ...lesson,
      recordings: recordings
        .filter((recording) => recording.lessonId === lesson.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const orphanRecordings = recordings.filter((recording) => !lessonMap.has(recording.lessonId));
  if (orphanRecordings.length) {
    grouped.push({ id: "unknown", name: "Derssiz", recordings: orphanRecordings });
  }

  if (!recordings.length) {
    els.historyList.innerHTML = `<div class="rounded-3xl border border-slate-800 p-6 text-center text-sm text-slate-400">Henuz kayit yok.</div>`;
    return;
  }

  els.historyList.innerHTML = grouped
    .filter((lesson) => lesson.recordings.length)
    .map(
      (lesson) => `
        <article class="rounded-3xl border border-slate-800 bg-black/50 p-4">
          <h3 class="text-lg font-semibold">${escapeHtml(lesson.name)}</h3>
          <div class="mt-3 space-y-3">
            ${lesson.recordings.map(renderRecordingCard).join("")}
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
  return `
    <section class="rounded-2xl border border-slate-800 bg-slate-950 p-3" data-recording-id="${recording.id}">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold">${escapeHtml(recording.title || "Kayit")}</p>
          <p class="text-xs text-slate-500">${escapeHtml(date)} - ${formatDuration(recording.durationMs || 0)}</p>
        </div>
        <button class="delete-recording rounded-xl bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-200">Sil</button>
      </div>
      <audio class="mt-3 w-full" controls src="${safeUrl}"></audio>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <button class="analyze-recording rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-950">Analiz Et</button>
        <button class="download-recording rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold" data-url="${safeUrl}">Indir</button>
      </div>
      ${
        recording.analysis
          ? `<pre class="mt-3 whitespace-pre-wrap rounded-2xl bg-slate-900 p-3 text-xs leading-5 text-slate-200">${escapeHtml(recording.analysis)}</pre>`
          : `<p class="mt-3 text-xs text-slate-500">AI analizi henuz yok.</p>`
      }
    </section>
  `;
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
    showDialog(els.settingsModal);
    setStatus("Analiz icin once Settings icinde Gemini API key gir.");
    return;
  }

  const recording = await getOne("recordings", recordingId);
  if (!recording) return;

  button.disabled = true;
  button.textContent = "Analiz ediliyor...";
  setStatus("Ses Gemini 1.5 Flash ile analiz ediliyor.");

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
      throw new Error(payload.error?.message || "Gemini istegi basarisiz oldu.");
    }

    const text =
      payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("\n")
        .trim() || "Gemini bos yanit dondurdu.";

    await putOne("recordings", {
      ...recording,
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

async function downloadRecording(recordingId, url) {
  const recording = await getOne("recordings", recordingId);
  const ext = (recording?.mimeType || "").includes("mp4") ? "m4a" : "webm";
  const link = document.createElement("a");
  link.href = url;
  link.download = `${recordingId}.${ext}`;
  link.click();
}

function showDialog(dialog) {
  if (dialog.open) return;
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
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
  let lastTapAt = 0;

  els.app.addEventListener("dblclick", () => showControls());
  els.app.addEventListener(
    "touchend",
    () => {
      const now = Date.now();
      if (now - lastTapAt < 320) {
        showControls();
        lastTapAt = 0;
        return;
      }
      lastTapAt = now;
    },
    { passive: true },
  );
  els.stopButton.addEventListener("click", () => stopRecording({ save: true }));
  els.cancelButton.addEventListener("click", () => stopRecording({ save: false }));
  els.startButton.addEventListener("click", startRecording);
  els.historyButton.addEventListener("click", async () => {
    await renderHistory();
    showDialog(els.historyModal);
  });
  els.settingsButton.addEventListener("click", async () => {
    const settings = await getSettings();
    els.apiKeyInput.value = settings.geminiApiKey || "";
    showDialog(els.settingsModal);
  });

  els.saveForm.addEventListener("submit", (event) => {
    event.preventDefault();
    savePendingRecording();
  });
  els.discardRecordingButton.addEventListener("click", () => {
    pendingRecording = null;
    els.saveModal.close();
    setStatus("Bekleyen kayit silindi.");
  });

  els.closeHistoryButton.addEventListener("click", () => els.historyModal.close());
  els.settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveApiKey(els.apiKeyInput.value);
    els.settingsModal.close();
    setStatus("Gemini API key kaydedildi.");
  });
  els.closeSettingsButton.addEventListener("click", () => els.settingsModal.close());

  els.historyList.addEventListener("click", async (event) => {
    const card = event.target.closest("[data-recording-id]");
    if (!card) return;
    const recordingId = card.dataset.recordingId;

    if (event.target.closest(".analyze-recording")) {
      await analyzeRecording(recordingId, event.target.closest(".analyze-recording"));
    }
    if (event.target.closest(".delete-recording")) {
      await deleteRecording(recordingId);
    }
    if (event.target.closest(".download-recording")) {
      const button = event.target.closest(".download-recording");
      await downloadRecording(recordingId, button.dataset.url);
    }
  });

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && mediaRecorder?.state === "recording") {
      await requestWakeLock();
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
  await registerServiceWorker();
  await startRecording();
}

init().catch((error) => {
  console.error(error);
  setStatus("Uygulama baslatilirken hata olustu.");
});
