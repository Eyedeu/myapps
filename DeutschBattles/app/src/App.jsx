import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRightCircle,
  Award,
  BarChart2,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  Edit3,
  FileText,
  Globe,
  GraduationCap,
  Headphones,
  History,
  Lightbulb,
  List,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquare,
  PenTool,
  Puzzle,
  RefreshCw,
  RotateCcw,
  Settings,
  Swords,
  Target,
  Trash2,
  Trophy,
  User,
  Users,
  X,
  XCircle
} from "lucide-react";
import { FAST_PRIMARY_MODEL, callGemini, readStoredJson, resolveStoredGeminiApiKey } from "./gemini.js";
const LOCAL_DB_KEY = "deutsch-battles-db";
const LOCAL_USER_KEY = "deutsch-battles-user";
const appId = import.meta.env.VITE_FIREBASE_DATA_APP_ID || "deutsch-battles";
const db = { kind: "local-db" };

const localSubscribers = new Map();

function createLocalId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `local_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function readLocalDb() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_DB_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeLocalDb(data) {
  localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(data));
}

function normalizePath(parts) {
  return parts.filter(Boolean).join("/");
}

function collection(...parts) {
  const pathParts = parts[0]?.kind ? parts.slice(1) : parts;
  return { kind: "collection", path: normalizePath(pathParts) };
}

function doc(...parts) {
  if (parts[0]?.kind === "collection") {
    return { kind: "doc", path: normalizePath([parts[0].path, ...parts.slice(1)]) };
  }
  const pathParts = parts[0]?.kind ? parts.slice(1) : parts;
  return { kind: "doc", path: normalizePath(pathParts) };
}

function getCollectionDocs(path) {
  const store = readLocalDb();
  const prefix = `${path}/`;
  return Object.entries(store)
    .filter(([key]) => key.startsWith(prefix) && key.slice(prefix.length).split("/").length === 1)
    .map(([key, value]) => ({
      id: key.split("/").at(-1),
      data: () => value,
      ref: { kind: "doc", path: key }
    }));
}

function getDocSnapshot(path) {
  const store = readLocalDb();
  const value = store[path];
  return {
    exists: () => value !== undefined,
    data: () => value
  };
}

function notifyPath(path) {
  const docCallbackSet = localSubscribers.get(path);
  if (docCallbackSet) {
    const snap = getDocSnapshot(path);
    docCallbackSet.forEach((callback) => callback(snap));
  }
  const segments = path.split("/");
  segments.pop();
  while (segments.length) {
    const collectionPath = segments.join("/");
    const collectionCallbackSet = localSubscribers.get(collectionPath);
    if (collectionCallbackSet) {
      const snap = { docs: getCollectionDocs(collectionPath) };
      collectionCallbackSet.forEach((callback) => callback(snap));
    }
    segments.pop();
  }
}

async function addDoc(collectionRef, data) {
  const id = createLocalId();
  const ref = doc(collectionRef, id);
  await setDoc(ref, data);
  return ref;
}

async function setDoc(docRef, data, options = {}) {
  const store = readLocalDb();
  store[docRef.path] = options.merge && store[docRef.path] ? { ...store[docRef.path], ...data } : data;
  writeLocalDb(store);
  notifyPath(docRef.path);
}

function setNestedValue(target, path, value) {
  const keys = path.split(".");
  let cursor = target;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    if (typeof cursor[key] !== "object" || cursor[key] === null) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[keys.at(-1)] = value;
}

async function updateDoc(docRef, updates) {
  const store = readLocalDb();
  const current = { ...(store[docRef.path] || {}) };
  Object.entries(updates).forEach(([key, value]) => {
    if (key.includes(".")) setNestedValue(current, key, value);
    else current[key] = value;
  });
  store[docRef.path] = current;
  writeLocalDb(store);
  notifyPath(docRef.path);
}

async function deleteDoc(docRef) {
  const store = readLocalDb();
  delete store[docRef.path];
  writeLocalDb(store);
  notifyPath(docRef.path);
}

async function getDoc(docRef) {
  return getDocSnapshot(docRef.path);
}

async function getDocs(collectionRef) {
  return {
    docs: getCollectionDocs(collectionRef.path),
    forEach(callback) {
      this.docs.forEach(callback);
    }
  };
}

function onSnapshot(ref, callback) {
  const key = ref.path;
  if (!localSubscribers.has(key)) localSubscribers.set(key, new Set());
  localSubscribers.get(key).add(callback);
  if (ref.kind === "doc") callback(getDocSnapshot(ref.path));
  else callback({ docs: getCollectionDocs(ref.path) });

  const handleStorage = (event) => {
    if (event.key === LOCAL_DB_KEY) {
      if (ref.kind === "doc") callback(getDocSnapshot(ref.path));
      else callback({ docs: getCollectionDocs(ref.path) });
    }
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    localSubscribers.get(key)?.delete(callback);
    window.removeEventListener("storage", handleStorage);
  };
}

const AI_STORAGE_KEY = "deutsch-battles-ai-settings";
const PROJECT_AI_STORAGE_KEYS = [AI_STORAGE_KEY];
const defaultAiSettings = {
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
  model: FAST_PRIMARY_MODEL
};

function resolveSharedGeminiApiKey() {
  return PROJECT_AI_STORAGE_KEYS
    .map((key) => resolveStoredGeminiApiKey(key, defaultAiSettings.geminiApiKey))
    .find(Boolean) || "";
}

function normalizeAiSettings(settings = {}) {
  return {
    geminiApiKey: String(settings.geminiApiKey || resolveSharedGeminiApiKey() || "").trim(),
    model: FAST_PRIMARY_MODEL
  };
}

function loadAiSettings() {
  return normalizeAiSettings(readStoredJson(AI_STORAGE_KEY) || {});
}

function safeJSONParse(text) {
  try {
    if (!text) return null;
    let cleanText = String(text).replace(/```json/g, "").replace(/```/g, "");
    const firstBrace = cleanText.indexOf("{");
    const firstBracket = cleanText.indexOf("[");
    let startIndex = -1;
    if (firstBrace !== -1 && firstBracket !== -1) startIndex = Math.min(firstBrace, firstBracket);
    else if (firstBrace !== -1) startIndex = firstBrace;
    else if (firstBracket !== -1) startIndex = firstBracket;
    if (startIndex !== -1) cleanText = cleanText.substring(startIndex);
    const lastBrace = cleanText.lastIndexOf("}");
    const lastBracket = cleanText.lastIndexOf("]");
    const endIndex = Math.max(lastBrace, lastBracket);
    if (endIndex !== -1) cleanText = cleanText.substring(0, endIndex + 1);
    return JSON.parse(cleanText);
  } catch {
    return null;
  }
}

function normalizeWordKey(value) {
  return String(value || "").trim().toLocaleLowerCase("de-DE");
}

async function generateContent(settings, prompt, type = "text") {
  const activeSettings = normalizeAiSettings(settings);
  if (!activeSettings.geminiApiKey) throw new Error("Gemini API key gerekli. Üst bardaki ayarlardan ekleyebilirsin.");
  const result = await callGemini({
    apiKey: activeSettings.geminiApiKey,
    model: FAST_PRIMARY_MODEL,
    prompt,
    mode: type,
    timeoutMs: 14000,
    retries: 1
  });
  return result.text;
}

const isStorageBlocked = () => {
  try {
    localStorage.setItem("__test", "1");
    localStorage.removeItem("__test");
    return false;
  } catch {
    return true;
  }
};

const storageObj = {
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }
};

function getDeviceId() {
  let id = storageObj.get("telc_device_id");
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2, 11)}${Date.now().toString(36)}`;
    storageObj.set("telc_device_id", id);
  }
  return id;
}

const storageIsBlocked = isStorageBlocked();
const localDeviceId = getDeviceId();

function generateIdOuter() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Math.random().toString(36).substring(2, 9)}${Date.now().toString(36)}`;
}

function shuffleOptionItem(question) {
  if (!question || !Array.isArray(question.options) || question.correct === undefined) return;
  const correctText = question.options[question.correct];
  const options = [...question.options];
  for (let i = options.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  question.options = options;
  question.correct = options.indexOf(correctText);
}

function createGameGenerators(aiSettings) {
  return {
    schreiben: async (level) => {
      const prompt = `TELC ${level} seviyesi için iki oyuncunun birbirine karşı yarıştığı bir Almanca yazma görevi üret. JSON formatında dön: {"title":"Görev Başlığı (Almanca)","situation":"Durum ve istenenler (Almanca)"}`;
      const res = await generateContent(aiSettings, prompt, "json");
      return safeJSONParse(res) || { title: "Einladung schreiben", situation: "Schreiben Sie eine Einladung zu Ihrer Geburtstagsparty." };
    },
    lesen_sprachbausteine: async (level) => {
      const prompt = `TELC ${level} seviyesi için tam 10 soruluk sınav üret.
Bölüm 1 (Lesen): Yaklaşık 200 kelimelik bir metin ve 5 adet çoktan seçmeli Almanca soru.
Bölüm 2 (Sprachbausteine): Yaklaşık 150 kelimelik, 5 boşluklu bir metin ve her boşluk için 3 Almanca seçenek.
JSON formati:
{"lesen":{"text":"...","questions":[{"id":"l1","q":"...","options":["A","B","C"],"correct":0}]},"sprach":{"text":"... [1] ...","questions":[{"id":"s1","q":"[1]","options":["A","B","C"],"correct":0}]}}`;
      const parsed = safeJSONParse(await generateContent(aiSettings, prompt, "json"));
      if (parsed) {
        parsed.lesen?.questions?.forEach(shuffleOptionItem);
        parsed.sprach?.questions?.forEach(shuffleOptionItem);
        return parsed;
      }
      return {
        lesen: { text: "Anna geht in die Schule.", questions: [{ id: "l1", q: "Wer geht in die Schule?", options: ["Anna", "Max", "Peter"], correct: 0 }] },
        sprach: { text: "Ich bin [1] Hause.", questions: [{ id: "s1", q: "[1]", options: ["zu", "in", "auf"], correct: 0 }] }
      };
    },
    fillblank: async (level) => {
      const categories = ["Alltag", "Beruf", "Reisen", "Gesundheit", "Umwelt", "Technik", "Kultur", "Sport", "Bildung", "Gesellschaft"];
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      const prompt = `TELC ${level} seviyesi için ${randomCategory} temalı 10 farklı Almanca kelime seç. Her biri için kelimeyi ___ ile gizleyen bir Almanca cümle ve Türkçe çeviri ver. Sadece JSON dön:
[{"word":"Hund","sentence":"Das ist mein ___.","translation":"Bu benim köpeğim."}]`;
      const parsed = safeJSONParse(await generateContent(aiSettings, prompt, "json"));
      if (Array.isArray(parsed) && parsed.length > 0) {
        const allWords = parsed.map((item) => item.word);
        return parsed.map((item) => {
          const options = [...allWords].sort(() => Math.random() - 0.5);
          return { sentence: item.sentence, translation: item.translation, options, correct: options.indexOf(item.word) };
        });
      }
      return Array.from({ length: 10 }, () => ({
        sentence: "Das ist ein ___.",
        translation: "Bu bir...",
        options: ["Auto", "Haus", "Hund", "Katze", "Baum"],
        correct: 2
      }));
    },
    syllable: async (level) => {
      const prompt = `TELC ${level} seviyesi için 5 adet Almanca kelime seç. Her kelime için Türkçe çeviri, heceler ve 4 yanıltıcı hece dön.
JSON:
[{"word":"Auto","meaning":"Araba","syllables":["Au","to"],"decoys":["ba","ka","la","ma"]}]`;
      return (
        safeJSONParse(await generateContent(aiSettings, prompt, "json")) ||
        Array.from({ length: 5 }, () => ({ word: "Auto", meaning: "Araba", syllables: ["Au", "to"], decoys: ["ba", "ka", "la", "ma"] }))
      );
    }
  };
}

async function evaluateSchreiben(aiSettings, text1, text2, task, level) {
  const prompt = `TELC ${level} yazma görevini değerlendir.
Görev: ${task.situation}
Oyuncu 1: "${text1}"
Oyuncu 2: "${text2}"
Katı kurallar: gramer, kelime dağarcığı, görevi yerine getirme ve özgünlük. Kopyaya sıfır tolerans.
JSON formatında dön: {"p1Score":85,"p1Feedback":"...","p2Score":90,"p2Feedback":"..."}`;
  return safeJSONParse(await generateContent(aiSettings, prompt, "json")) || { p1Score: 50, p1Feedback: "Değerlendirilemedi.", p2Score: 50, p2Feedback: "Değerlendirilemedi." };
}

function ConfirmModal({ isOpen, onClose, onConfirm, message }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <Trash2 className="text-red-600" size={24} />
          </div>
          <h3 className="mb-2 text-lg font-bold text-gray-900">Silmek istiyor musunuz?</h3>
          <p className="mb-6 text-sm text-gray-500">{message || "Bu islem geri alinamaz."}</p>
          <div className="flex w-full gap-3">
            <button onClick={onClose} className="flex-1 rounded-xl bg-gray-100 py-2.5 font-bold text-gray-700 transition hover:bg-gray-200">Vazgeç</button>
            <button onClick={onConfirm} className="flex-1 rounded-xl bg-red-600 py-2.5 font-bold text-white transition hover:bg-red-700">Sil</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ isOpen, onClose, aiSettings, setAiSettings }) {
  const [draft, setDraft] = useState(aiSettings);

  useEffect(() => {
    setDraft(aiSettings);
  }, [aiSettings, isOpen]);

  if (!isOpen) return null;

  const save = () => {
    const normalizedDraft = normalizeAiSettings(draft);
    setAiSettings(normalizedDraft);
    storageObj.set(AI_STORAGE_KEY, JSON.stringify(normalizedDraft));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900">AI Ayarları</h2>
            <p className="mt-1 text-sm text-slate-500">Uygulama önce Gemini 3.1 Flash Lite Preview kullanır. Yoğunluk olursa otomatik olarak hızlı bir yedek modele geçer.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-700">Gemini API Key</span>
            <input type="password" value={draft.geminiApiKey} onChange={(event) => setDraft((prev) => ({ ...prev, geminiApiKey: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="AIza..." />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-700">Model</span>
            <input value={FAST_MODEL_ID} disabled className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-600 outline-none" />
          </label>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Uygulama tüm verileri tarayıcıdaki localStorage içinde tutuyor. Gemini anahtarını burada saklayabilirsin.
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl bg-slate-100 py-3 font-bold text-slate-700 transition hover:bg-slate-200">Iptal</button>
          <button onClick={save} className="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white transition hover:bg-indigo-700">Kaydet</button>
        </div>
      </div>
    </div>
  );
}

function HighlightedText({ text, questions, title }) {
  if (!text) return null;
  let highlighted = text;
  const textColors = ["text-blue-600", "text-purple-600", "text-orange-600", "text-pink-600", "text-teal-600"];
  const sortedQuestions = [...questions].filter((q) => q.quote && q.quote.trim().length > 3).sort((a, b) => b.quote.length - a.quote.length);
  sortedQuestions.forEach((q, index) => {
    const colorClass = textColors[index % textColors.length];
    const safeQuote = q.quote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    highlighted = highlighted.replace(new RegExp(`(${safeQuote})`, "gi"), `<span class="${colorClass} font-bold underline decoration-2 underline-offset-4">$1 <sup class="ml-0.5 text-xs font-black opacity-80">[S. ${q.displayNum}]</sup></span>`);
  });
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-indigo-100 bg-indigo-50 p-4 font-bold text-indigo-900">
        <BookOpen size={18} /> {title} - Metin Kaynagi
      </div>
      <div className="prose max-w-none whitespace-pre-line p-6 text-lg leading-relaxed text-gray-800" dangerouslySetInnerHTML={{ __html: highlighted }} />
    </div>
  );
}

function UsernamePrompt({ user, onClose, onSave }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!db || name.trim().length < 3) return;
    setLoading(true);
    const safeName = name.trim().substring(0, 15);
    await setDoc(doc(db, "artifacts", appId, "public", "data", "profiles", user.uid), {
      uid: user.uid,
      username: safeName,
      wins: 0,
      h2h: {},
      createdAt: Date.now()
    });
    storageObj.set("telc_arena_username", safeName);
    storageObj.set("telc_arena_wins", "0");
    setLoading(false);
    onSave();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden rounded-3xl bg-slate-900 p-4">
      <button onClick={onClose} className="absolute left-4 top-4 z-[60] flex items-center gap-1 text-white transition-colors hover:text-gray-300">
        <ChevronLeft size={24} /> Menüye Dön
      </button>
      <div className="relative z-10 w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl md:p-8">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100">
          <User size={40} className="text-indigo-600" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-gray-800">Arenaya Hos Geldin</h2>
        <p className="mb-6 text-sm text-gray-500">Rakiplerinin seni tanıyabilmesi için bir kullanıcı adı belirle.</p>
        {storageIsBlocked && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-4 text-left text-xs text-red-600">
            <AlertCircle size={16} className="mb-1 mr-1 inline-block" />
            Tarayici gizlilik ayarlari yerel depolamayi engelliyor olabilir.
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Kullanici Adi" maxLength={15} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-lg font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
          <button disabled={name.trim().length < 3 || loading} type="submit" className="w-full rounded-xl bg-indigo-600 py-4 font-bold text-white shadow-lg transition hover:bg-indigo-700 disabled:opacity-50">
            {loading ? <Loader2 className="mx-auto animate-spin" /> : "Savasa Katil"}
          </button>
        </form>
      </div>
    </div>
  );
}

function EditUsernameModal({ user, currentName, onClose, onSave }) {
  const [name, setName] = useState(currentName || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!db) return;
    if (name.trim().length < 3 || name.trim() === currentName) return onClose();
    setLoading(true);
    const safeName = name.trim().substring(0, 15);
    await setDoc(doc(db, "artifacts", appId, "public", "data", "profiles", user.uid), { username: safeName }, { merge: true });
    storageObj.set("telc_arena_username", safeName);
    setLoading(false);
    onSave(safeName);
  };

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center rounded-3xl bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl md:p-8">
        <h2 className="mb-4 text-xl font-bold text-gray-800">Ismini Degistir</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Yeni Kullanici Adi" maxLength={15} autoFocus className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-lg font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-gray-100 py-3 font-bold text-gray-700 transition hover:bg-gray-200">Iptal</button>
            <button disabled={name.trim().length < 3 || loading} type="submit" className="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50">
              {loading ? <Loader2 className="mx-auto animate-spin" /> : "Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Lobby({ user, dbProfile, onlineUsers, mySentInvite, pendingIncomingInvites, onSendInvite, onCancelInvite, onAccept, onDecline, onRefresh, isRefreshing }) {
  return (
    <div className="relative mx-auto flex h-full w-full max-w-4xl flex-col px-4 pb-6 pt-6 md:px-0">
      {pendingIncomingInvites.map((invite) => (
        <div key={invite.id} className="absolute inset-0 z-50 flex items-center justify-center rounded-3xl bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl md:p-8">
            <div className="mx-auto mb-4 flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-indigo-100">
              <Swords size={32} className="text-indigo-600" />
            </div>
            <h3 className="mb-2 text-2xl font-black text-gray-800">Meydan Okuma</h3>
            <p className="mb-8 text-sm text-gray-600 md:text-base">
              <strong className="text-indigo-600">{invite.fromName}</strong> seni 1v1 düelloya davet ediyor.
            </p>
            <div className="flex gap-3">
              <button onClick={() => onDecline(invite.id)} className="flex-1 rounded-xl bg-gray-100 py-3 font-bold text-gray-700 transition hover:bg-gray-200">Reddet</button>
              <button onClick={() => onAccept(invite)} className="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-lg transition hover:bg-indigo-700">Kabul Et</button>
            </div>
          </div>
        </div>
      ))}

      <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-xl">
        <div className="flex flex-col items-start justify-between gap-5 bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white sm:flex-row sm:items-center sm:px-8">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-black"><Users /> Aktif Oyuncular</h2>
            <p className="mt-1 text-sm text-slate-400">Şu anda lobide rakip bekleyen savaşçılar.</p>
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <button onClick={onRefresh} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-bold transition hover:bg-slate-600 sm:flex-none">
              <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} /> Yenile
            </button>
            <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/20 px-4 py-2.5 font-bold text-green-400 sm:flex-none">
              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-400" />
              <span className="whitespace-nowrap">{onlineUsers.length} Online</span>
            </div>
          </div>
        </div>

        <div className="flex-1 divide-y divide-gray-100 overflow-y-auto p-2">
          {onlineUsers.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center text-gray-400">
              <Target size={48} className="mb-4 opacity-50" />
              <p>Su an lobide senden baska kimse yok.</p>
              <p className="mt-2 text-sm">Arkadasinla farkli cihazlardan baglanmayi deneyebilirsin.</p>
            </div>
          ) : (
            onlineUsers.map((onlineUser) => {
              const myWinsVSHim = dbProfile?.h2h?.[onlineUser.uid]?.wins || 0;
              const myLossesVSHim = dbProfile?.h2h?.[onlineUser.uid]?.losses || 0;
              const isMyself = onlineUser.uid === user.uid;
              return (
                <div key={onlineUser.connectionId} className="group flex flex-col items-start justify-between gap-4 rounded-xl p-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center md:p-6">
                  <div className="flex w-full items-center gap-4 sm:w-auto">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xl font-black text-indigo-700">{onlineUser.username.charAt(0).toUpperCase()}</div>
                    <div className="truncate">
                      <h3 className="truncate text-lg font-bold text-gray-800 transition-colors group-hover:text-indigo-600">
                        {onlineUser.username} {isMyself && <span className="text-xs font-normal text-gray-400">(Diger cihazin)</span>}
                      </h3>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex w-fit items-center gap-1 rounded-md bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-600"><Trophy size={12} /> {onlineUser.wins || 0} Zafer</div>
                        <div className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-500">Bana Karsi: <span className="text-green-600">{myWinsVSHim}G</span> - <span className="text-red-500">{myLossesVSHim}M</span></div>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => onSendInvite(onlineUser.connectionId)} disabled={Boolean(mySentInvite)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-bold text-white shadow-md transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2.5">
                    <Swords size={18} /> DÃ¯Â¿Â½elloya Davet Et
                  </button>
                </div>
              );
            })
          )}
        </div>

        {mySentInvite && (
          <div className="flex flex-col items-center justify-between gap-4 border-t border-indigo-100 bg-indigo-50 p-4 text-center sm:flex-row sm:px-8 sm:text-left">
            <div className="flex items-center justify-center gap-3 text-sm font-medium text-indigo-800 md:text-base">
              <Loader2 className="animate-spin" size={20} />
              İstek gönderildi, rakibin onayı bekleniyor...
            </div>
            <button onClick={onCancelInvite} className="w-full rounded-lg border border-red-100 bg-white px-4 py-2 font-bold text-red-500 transition hover:bg-red-50 sm:w-auto sm:border-none sm:bg-transparent">Iptal Et</button>
          </div>
        )}
      </div>
    </div>
  );
}

function GameSelection({ isHost, gameDoc, onGenerate }) {
  const [level, setLevel] = useState("B1");
  const [loading, setLoading] = useState(false);

  const selectGame = async (gameType) => {
    if (!db) return;
    setLoading(true);
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "games", gameDoc.id), { selectedGame: gameType, level, status: "generating" });
    const data = await onGenerate(gameType, level);
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "games", gameDoc.id), { gameData: data, status: "playing", startTime: Date.now() });
  };

  if (!isHost) {
    return (
      <div className="flex min-h-[400px] h-full flex-col items-center justify-center text-center text-gray-500">
        <Loader2 className="mb-6 h-16 w-16 animate-spin text-indigo-300" />
        <h2 className="mb-2 text-2xl font-bold text-gray-800">Oda Sahibi Bekleniyor</h2>
        <p>Rakibin oyun türünü ve TELC seviyesini seçiyor...</p>
      </div>
    );
  }

  const gamesList = [
    { id: "schreiben", title: "Yazma (Schreiben)", icon: PenTool, desc: "Yapay zeka konusuna gore en iyi metni kim yazacak?", color: "text-purple-600", bg: "bg-purple-100" },
    { id: "lesen_sprachbausteine", title: "Okuma & Gramer", icon: BookOpen, desc: "Okuma parcasi ve Sprachbausteine.", color: "text-blue-600", bg: "bg-blue-100" },
    { id: "fillblank", title: "Boşluk Doldurma", icon: Edit3, desc: "10 cümle. Tüm kelimeler şık olarak çıkar.", color: "text-green-600", bg: "bg-green-100" },
    { id: "syllable", title: "Hece Oyunu", icon: Puzzle, desc: "Kelimelerin hecelerini yanilticilara kanmadan bul.", color: "text-orange-600", bg: "bg-orange-100" }
  ];

  return (
    <div>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="mb-2 text-3xl font-black text-gray-900">Oyun Modunu Seç</h2>
          <p className="text-sm text-gray-500 md:text-base">Oda sahibi olarak kurallari sen belirlersin.</p>
        </div>
        <div className="flex w-full flex-col md:w-auto">
          <label className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">Seviye (A1-C2)</label>
          <select value={level} onChange={(event) => setLevel(event.target.value)} disabled={loading} className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xl font-black text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500">
            {["A1", "A2", "B1", "B2", "C1", "C2"].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {gamesList.map((game) => (
          <button key={game.id} onClick={() => selectGame(game.id)} disabled={loading} className="group relative overflow-hidden rounded-2xl border-2 border-transparent bg-slate-50 p-5 text-left transition-all hover:border-indigo-500 hover:bg-white hover:shadow-xl disabled:opacity-50 md:p-6">
            <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl ${game.bg} transition-transform group-hover:scale-110`}>
              <game.icon size={24} className={game.color} />
            </div>
            <h3 className="mb-2 text-lg font-bold text-gray-800 md:text-xl">{game.title}</h3>
            <p className="text-xs text-gray-500 md:text-sm">{game.desc}</p>
          </button>
        ))}
      </div>
      {loading && <div className="mt-6 text-center text-sm font-bold text-indigo-600 md:text-base">Yapay zeka {level} seviyesine uygun oyunu hazirliyor...</div>}
    </div>
  );
}

const GameGenerating = () => (
  <div className="flex min-h-[400px] h-full flex-col items-center justify-center text-center text-gray-500">
    <RefreshCw className="mb-6 h-16 w-16 animate-spin text-indigo-600" />
    <h2 className="mb-2 text-2xl font-bold text-gray-800">Savas Alani Hazirlaniyor</h2>
    <p>Yapay zeka seçilen seviyeye uygun yepyeni sorular üretiyor...</p>
  </div>
);

const GameEvaluating = () => (
  <div className="flex min-h-[400px] h-full flex-col items-center justify-center text-center text-gray-500">
    <div className="mb-6 flex gap-2">
      <div className="h-4 w-4 animate-bounce rounded-full bg-indigo-600" />
      <div className="h-4 w-4 animate-bounce rounded-full bg-purple-600" style={{ animationDelay: "0.1s" }} />
      <div className="h-4 w-4 animate-bounce rounded-full bg-pink-600" style={{ animationDelay: "0.2s" }} />
    </div>
    <h2 className="mb-2 text-2xl font-bold text-gray-800">Cevaplar Inceleniyor</h2>
    <p>Yapay zeka iki oyuncunun da performansini degerlendiriyor...</p>
  </div>
);

function GameSchreiben({ gameDoc, connectionId, ProgressHeader }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (!db) return;
    setSubmitting(true);
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "games", gameDoc.id), {
      [`players.${connectionId}.text`]: text,
      [`players.${connectionId}.progress`]: 1,
      [`players.${connectionId}.finished`]: true,
      [`players.${connectionId}.finishTime`]: Date.now()
    });
  };
  return (
    <div>
      <ProgressHeader />
      <div className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 md:p-6">
        <h3 className="mb-2 text-lg font-bold text-yellow-900 md:text-xl">{gameDoc.gameData.title}</h3>
        <p className="text-sm leading-relaxed text-yellow-800 md:text-base">{gameDoc.gameData.situation}</p>
      </div>
      <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Almanca metnini buraya yaz..." className="mb-4 h-64 w-full resize-none rounded-2xl border border-slate-300 p-4 font-serif text-base leading-relaxed outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 md:p-6 md:text-lg" />
      <button onClick={submit} disabled={text.length < 20 || submitting} className="w-full rounded-xl bg-indigo-600 py-4 font-bold text-white shadow-lg transition hover:bg-indigo-700 disabled:opacity-50">{submitting ? "Gonderiliyor..." : "Metni Gonder"}</button>
    </div>
  );
}

function GameLesen({ gameDoc, connectionId, ProgressHeader }) {
  const [answers, setAnswers] = useState({});
  const questions = [...(gameDoc.gameData.lesen?.questions || []), ...(gameDoc.gameData.sprach?.questions || [])];
  const currentProgress = Object.keys(answers).length;

  useEffect(() => {
    if (!db) return;
    updateDoc(doc(db, "artifacts", appId, "public", "data", "games", gameDoc.id), { [`players.${connectionId}.progress`]: currentProgress }).catch(() => {});
  }, [connectionId, currentProgress, gameDoc.id]);

  const submit = async () => {
    if (!db) return;
    let score = 0;
    questions.forEach((question) => {
      if (answers[question.id] === question.correct) score += 1;
    });
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "games", gameDoc.id), {
      [`players.${connectionId}.score`]: score,
      [`players.${connectionId}.finished`]: true,
      [`players.${connectionId}.finishTime`]: Date.now()
    });
  };

  return (
    <div>
      <ProgressHeader />
      <div className="space-y-6 md:space-y-8">
        {gameDoc.gameData.lesen && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b bg-slate-100 p-4 font-bold text-slate-700">Bölüm 1: Lesen</div>
            <div className="border-b p-6 leading-relaxed text-slate-800">{gameDoc.gameData.lesen.text}</div>
            <div className="space-y-6 bg-slate-50 p-6">
              {gameDoc.gameData.lesen.questions.map((question, index) => (
                <div key={question.id}>
                  <p className="mb-3 font-bold text-slate-800">{index + 1}. {question.q}</p>
                  <div className="flex flex-col flex-wrap gap-3 sm:flex-row">
                    {question.options.map((option, optionIndex) => (
                      <button key={option} onClick={() => setAnswers({ ...answers, [question.id]: optionIndex })} className={`rounded-lg border px-4 py-2 text-left transition-all sm:text-center ${answers[question.id] === optionIndex ? "border-indigo-600 bg-indigo-600 text-white shadow-md" : "bg-white text-slate-700 hover:bg-slate-100"}`}>{option}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {gameDoc.gameData.sprach && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b bg-slate-100 p-4 font-bold text-slate-700">Bölüm 2: Sprachbausteine</div>
            <div className="border-b whitespace-pre-wrap p-6 leading-relaxed text-slate-800">{gameDoc.gameData.sprach.text}</div>
            <div className="space-y-6 bg-slate-50 p-6">
              {gameDoc.gameData.sprach.questions.map((question) => (
                <div key={question.id}>
                  <p className="mb-3 font-bold text-slate-800">Bosluk {question.q}</p>
                  <div className="flex flex-col flex-wrap gap-3 sm:flex-row">
                    {question.options.map((option, optionIndex) => (
                      <button key={option} onClick={() => setAnswers({ ...answers, [question.id]: optionIndex })} className={`rounded-lg border px-4 py-2 text-left transition-all sm:text-center ${answers[question.id] === optionIndex ? "border-indigo-600 bg-indigo-600 text-white shadow-md" : "bg-white text-slate-700 hover:bg-slate-100"}`}>{option}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <button onClick={submit} disabled={currentProgress !== questions.length} className="mt-8 w-full rounded-xl bg-indigo-600 py-4 font-bold text-white shadow-lg transition hover:bg-indigo-700 disabled:opacity-50">Cevaplari Gonder</button>
    </div>
  );
}

function GameFillBlankArena({ gameDoc, connectionId, ProgressHeader }) {
  const me = gameDoc.players[connectionId];
  const currentIndex = me.progress;
  const questions = gameDoc.gameData;
  const [wrongPick, setWrongPick] = useState(null);
  const [correctPick, setCorrectPick] = useState(null);
  const [answered, setAnswered] = useState(false);

  const handleAnswer = async (optionIndex) => {
    if (!db || answered) return;
    setAnswered(true);
    const question = questions[currentIndex];
    const isCorrect = optionIndex === question.correct;
    if (isCorrect) setCorrectPick(optionIndex);
    else {
      setWrongPick(optionIndex);
      setCorrectPick(question.correct);
    }
    setTimeout(async () => {
      setCorrectPick(null);
      setWrongPick(null);
      setAnswered(false);
      const nextProgress = currentIndex + 1;
      const updates = { [`players.${connectionId}.progress`]: nextProgress, [`players.${connectionId}.score`]: me.score + (isCorrect ? 1 : 0) };
      if (nextProgress === questions.length) {
        updates[`players.${connectionId}.finished`] = true;
        updates[`players.${connectionId}.finishTime`] = Date.now();
      }
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "games", gameDoc.id), updates);
    }, 1500);
  };

  if (currentIndex >= questions.length) return null;
  const currentQuestion = questions[currentIndex];
  return (
    <div>
      <ProgressHeader />
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm md:p-8">
        <p className="mb-2 text-lg leading-relaxed text-indigo-900 md:text-2xl" dangerouslySetInnerHTML={{ __html: correctPick !== null ? currentQuestion.sentence.replace("___", `<span class="px-2 font-bold text-green-600 underline">${currentQuestion.options[currentQuestion.correct]}</span>`) : currentQuestion.sentence.replace("___", "________") }} />
        <p className="mb-8 text-sm font-bold uppercase tracking-wider text-slate-400">{currentQuestion.translation}</p>
        <div className="flex flex-col flex-wrap justify-center gap-4 sm:flex-row">
          {currentQuestion.options.map((option, index) => (
            <button key={option} onClick={() => handleAnswer(index)} disabled={answered} className={`rounded-xl border-2 px-4 py-2 text-sm font-bold transition-all md:text-base ${correctPick === index ? "scale-105 border-green-500 bg-green-500 text-white" : wrongPick === index ? "animate-bounce border-red-500 bg-red-500 text-white" : "border-slate-200 bg-white text-slate-700 shadow-sm hover:border-indigo-500 hover:text-indigo-600 hover:shadow-md"}`}>{option}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GameSyllableArena({ gameDoc, connectionId, ProgressHeader }) {
  const me = gameDoc.players[connectionId];
  const currentIndex = me.progress;
  const questions = gameDoc.gameData;
  const [syllables, setSyllables] = useState([]);
  const [selected, setSelected] = useState([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isFailed, setIsFailed] = useState(false);

  useEffect(() => {
    if (currentIndex < questions.length) {
      const current = questions[currentIndex];
      const correct = current.syllables.map((item, index) => ({ id: `c_${currentIndex}_${index}`, text: item }));
      const decoys = current.decoys.map((item, index) => ({ id: `d_${currentIndex}_${index}`, text: item }));
      setSyllables([...correct, ...decoys].sort(() => Math.random() - 0.5));
      setSelected([]);
      setIsSuccess(false);
      setIsFailed(false);
    }
  }, [currentIndex, questions]);

  const handleSelect = async (syllable) => {
    if (!db || isSuccess || isFailed) return;
    const nextSelected = [...selected, syllable];
    setSelected(nextSelected);
    setSyllables(syllables.filter((item) => item.id !== syllable.id));
    const built = nextSelected.map((item) => item.text).join("");
    const target = questions[currentIndex].word;
    if (built.length >= target.length) {
      const isCorrect = built.toLowerCase() === target.toLowerCase();
      if (isCorrect) setIsSuccess(true);
      else setIsFailed(true);
      setTimeout(async () => {
        const nextProgress = currentIndex + 1;
        const updates = { [`players.${connectionId}.progress`]: nextProgress, [`players.${connectionId}.score`]: me.score + (isCorrect ? 1 : 0) };
        if (nextProgress === questions.length) {
          updates[`players.${connectionId}.finished`] = true;
          updates[`players.${connectionId}.finishTime`] = Date.now();
        }
        await updateDoc(doc(db, "artifacts", appId, "public", "data", "games", gameDoc.id), updates);
      }, 1500);
    }
  };

  const handleDeselect = (syllable) => {
    if (isSuccess || isFailed) return;
    setSyllables([...syllables, syllable]);
    setSelected(selected.filter((item) => item.id !== syllable.id));
  };

  if (currentIndex >= questions.length) return null;
  const currentQuestion = questions[currentIndex];

  return (
    <div className="flex h-full flex-col">
      <ProgressHeader />
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h3 className="mb-2 text-2xl font-black text-indigo-600 md:text-3xl">{currentQuestion.meaning}</h3>
        <p className="mb-8 text-sm font-medium text-slate-500">Parçaları sırayla seçerek kelimeyi oluştur.</p>
        <div className={`mb-6 flex min-h-[70px] w-full max-w-lg flex-wrap justify-center gap-2 rounded-2xl border-2 p-4 transition-colors ${isSuccess ? "border-green-400 bg-green-50" : isFailed ? "border-red-400 bg-red-50" : "border-dashed border-slate-300 bg-slate-50"}`}>
          {selected.map((item) => (
            <button key={item.id} onClick={() => handleDeselect(item)} disabled={isSuccess || isFailed} className={`rounded-xl px-5 py-3 text-lg font-bold text-white shadow-md transition ${isSuccess ? "scale-105 bg-green-500" : isFailed ? "bg-red-500" : "bg-indigo-600 hover:bg-indigo-700"}`}>{item.text}</button>
          ))}
          {selected.length === 0 && <span className="flex items-center text-sm text-slate-400">Heceleri buraya tikla</span>}
        </div>
        {isFailed && <div className="mb-4 animate-bounce font-bold text-red-600">Yanlis! Dogrusu: {currentQuestion.word}</div>}
        <div className="flex w-full max-w-xl flex-wrap justify-center gap-4">
          {!isSuccess && !isFailed && syllables.map((item) => (
            <button key={item.id} onClick={() => handleSelect(item)} className="rounded-xl border-2 border-indigo-200 bg-white px-5 py-3 text-lg font-bold text-indigo-700 shadow-sm transition hover:border-indigo-400 hover:bg-indigo-50">{item.text}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GamePlayArea({ gameDoc, connectionId, isHost, opponentName, aiSettings }) {
  const gameType = gameDoc.selectedGame;
  const me = gameDoc.players[connectionId];
  const opponentId = Object.keys(gameDoc.players).find((id) => id !== connectionId);
  const opponent = gameDoc.players[opponentId];

  const ProgressHeader = ({ total, title }) => (
    <div className="mb-8">
      <h2 className="mb-6 text-center text-lg font-bold uppercase tracking-wider text-slate-800 md:text-xl">{title}</h2>
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <div className="flex items-center gap-3">
          <span className="w-12 text-xs font-bold text-indigo-700 md:text-sm">Sen</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${(me.progress / total) * 100}%` }} /></div>
          <span className="w-8 text-right text-xs font-bold md:text-sm">{me.progress}/{total}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-12 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold text-red-600 md:text-sm" title={opponentName}>{opponentName.substring(0, 4)}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${(opponent.progress / total) * 100}%` }} /></div>
          <span className="w-8 text-right text-xs font-bold md:text-sm">{opponent.progress}/{total}</span>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    if (!db) return;
    if (isHost && me.finished && opponent.finished && gameDoc.status === "playing") {
      const wrapUp = async () => {
        await updateDoc(doc(db, "artifacts", appId, "public", "data", "games", gameDoc.id), { status: "evaluating" });
        if (gameType === "schreiben") {
          const evaluation = await evaluateSchreiben(aiSettings, me.text, opponent.text, gameDoc.gameData, gameDoc.level);
          await updateDoc(doc(db, "artifacts", appId, "public", "data", "games", gameDoc.id), {
            [`players.${connectionId}.aiScore`]: evaluation.p1Score,
            [`players.${connectionId}.feedback`]: evaluation.p1Feedback,
            [`players.${opponentId}.aiScore`]: evaluation.p2Score,
            [`players.${opponentId}.feedback`]: evaluation.p2Feedback,
            status: "finished"
          });
        } else {
          await updateDoc(doc(db, "artifacts", appId, "public", "data", "games", gameDoc.id), { status: "finished" });
        }
      };
      wrapUp().catch(console.error);
    }
  }, [aiSettings, connectionId, gameDoc.gameData, gameDoc.id, gameDoc.level, gameDoc.status, gameType, isHost, me.finished, me.text, opponent.finished, opponent.text, opponentId]);

  if (me.finished && !opponent.finished) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center px-4 text-center">
        <CheckCircle size={64} className="mb-4 text-green-500" />
        <h3 className="mb-2 text-2xl font-bold text-gray-800">Bölümü Tamamladın</h3>
        <p className="mb-8 text-gray-500">Rakibinin bitirmesi bekleniyor...</p>
        <div className="w-full max-w-sm"><ProgressHeader total={gameType === "syllable" ? 5 : 10} title="Rakip Bekleniyor" /></div>
      </div>
    );
  }

  if (gameType === "schreiben") return <GameSchreiben gameDoc={gameDoc} connectionId={connectionId} ProgressHeader={() => <ProgressHeader total={1} title="Schreiben" />} />;
  if (gameType === "lesen_sprachbausteine") return <GameLesen gameDoc={gameDoc} connectionId={connectionId} ProgressHeader={() => <ProgressHeader total={10} title="Lesen & Gramer" />} />;
  if (gameType === "fillblank") return <GameFillBlankArena gameDoc={gameDoc} connectionId={connectionId} ProgressHeader={() => <ProgressHeader total={10} title="Boşluk Doldurma" />} />;
  if (gameType === "syllable") return <GameSyllableArena gameDoc={gameDoc} connectionId={connectionId} ProgressHeader={() => <ProgressHeader total={5} title="Hece Birlestirme" />} />;
  return <div>Oyun bulunamadi.</div>;
}

function GameResult({ gameDoc, user, connectionId, opponentConnectionId, onExit, opponentLeft }) {
  const me = gameDoc.players[connectionId];
  const opponent = gameDoc.players[opponentConnectionId];
  const processedRef = useRef(false);
  let amIWinner = false;
  let winReason = "";

  if (opponentLeft) {
    amIWinner = true;
    winReason = "Rakip arenadan çıktı. Hükmen galipsin.";
  } else if (gameDoc.selectedGame === "schreiben") {
    amIWinner = me.aiScore >= opponent.aiScore;
    winReason = amIWinner ? `Yapay zeka metnini daha yüksek puanladı (${me.aiScore} >= ${opponent.aiScore}).` : `Rakibinin metni daha yüksek puan aldı (${opponent.aiScore} > ${me.aiScore}).`;
  } else if (me.score > opponent.score) {
    amIWinner = true;
    winReason = `Daha çok doğru cevap verdin (${me.score} > ${opponent.score}).`;
  } else if (opponent.score > me.score) {
    winReason = `Rakibin daha çok doğru cevap verdi (${opponent.score} > ${me.score}).`;
  } else {
    const myTime = me.finishTime - gameDoc.startTime;
    const oppTime = opponent.finishTime - gameDoc.startTime;
    amIWinner = myTime <= oppTime;
    winReason = amIWinner ? `Puanlar esitti (${me.score}), ama sen daha hizli bitirdin.` : `Puanlar esitti (${me.score}), ama rakibin daha hizli bitirdi.`;
  }

  useEffect(() => {
    if (!db || processedRef.current) return;
    processedRef.current = true;
    const processStats = async () => {
      const profileRef = doc(db, "artifacts", appId, "public", "data", "profiles", user.uid);
      const snap = await getDoc(profileRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const opponentUid = opponent.uid;
      let newWins = data.wins || 0;
      const h2h = data.h2h || {};
      const oppH2h = h2h[opponentUid] || { wins: 0, losses: 0 };
      if (amIWinner) {
        newWins += 1;
        oppH2h.wins += 1;
      } else if (!opponentLeft) {
        oppH2h.losses += 1;
      }
      h2h[opponentUid] = oppH2h;
      await updateDoc(profileRef, { wins: newWins, h2h });
      storageObj.set("telc_arena_wins", String(newWins));
    };
    processStats().catch(console.error);
  }, [amIWinner, opponent.uid, opponentLeft, user.uid]);

  return (
    <div className="flex w-full flex-col items-center justify-center p-6 text-center md:p-10">
      {amIWinner ? <Trophy size={80} className="mb-6 text-yellow-400 drop-shadow-2xl md:h-[100px] md:w-[100px]" /> : <XCircle size={80} className="mb-6 text-red-400 drop-shadow-2xl md:h-[100px] md:w-[100px]" />}
      <h1 className={`mb-4 text-3xl font-black md:text-5xl ${amIWinner ? "text-indigo-600" : "text-slate-800"}`}>{amIWinner ? "ZAFER SENIN" : "KAYBETTIN"}</h1>
      <p className="mb-10 max-w-md text-base font-medium text-slate-500 md:text-xl">{winReason}</p>
      <div className="mb-10 grid w-full max-w-lg grid-cols-2 gap-4">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-6">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-indigo-400 md:text-sm">Senin Skorun</div>
          <div className="text-3xl font-black text-indigo-700 md:text-4xl">{gameDoc.selectedGame === "schreiben" ? me.aiScore : me.score}</div>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-red-400 md:text-sm">Rakibin Skoru</div>
          <div className="text-3xl font-black text-red-700 md:text-4xl">{opponentLeft ? "-" : gameDoc.selectedGame === "schreiben" ? opponent.aiScore : opponent.score}</div>
        </div>
      </div>
      {gameDoc.selectedGame === "schreiben" && !opponentLeft && (
        <div className="mb-10 w-full max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 p-6 text-left">
          <h4 className="mb-4 flex items-center gap-2 font-bold text-slate-700"><MessageSquare size={18} /> Yapay Zeka Yorumu</h4>
          <p className="text-sm leading-relaxed text-slate-600"><strong className="text-indigo-600">Sana:</strong> {me.feedback}</p>
          <div className="my-4 h-px bg-slate-200" />
          <p className="text-sm leading-relaxed text-slate-600"><strong className="text-red-500">Rakibine:</strong> {opponent.feedback}</p>
        </div>
      )}
      <button onClick={onExit} className="w-full rounded-xl bg-slate-900 px-12 py-4 text-lg font-bold text-white shadow-xl transition hover:bg-indigo-600 sm:w-auto">Lobiye Dön</button>
    </div>
  );
}

function ActiveGameRoom({ gameId, user, connectionId, dbProfile, onExit, aiSettings, onGenerate }) {
  const [gameDoc, setGameDoc] = useState(null);
  useEffect(() => {
    if (!db) return undefined;
    const unsubscribe = onSnapshot(doc(db, "artifacts", appId, "public", "data", "games", gameId), (snapshot) => {
      if (snapshot.exists()) setGameDoc(snapshot.data());
      else onExit();
    });
    return () => unsubscribe();
  }, [gameId, onExit]);

  const handleLeave = async () => {
    if (db && gameDoc && gameDoc.status !== "finished") {
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "games", gameId), { [`players.${connectionId}.left`]: true, status: "finished" });
    }
    onExit();
  };

  if (!gameDoc) return <div className="flex h-full flex-col items-center justify-center"><Loader2 className="mb-4 h-12 w-12 animate-spin text-indigo-600" />Yükleniyor...</div>;

  const isHost = gameDoc.hostConnectionId === connectionId;
  const opponentConnectionId = isHost ? gameDoc.guestConnectionId : gameDoc.hostConnectionId;
  const opponentName = isHost ? gameDoc.guestName : gameDoc.hostName;
  const opponentLeft = gameDoc.players[opponentConnectionId]?.left;
  if (opponentLeft && gameDoc.status !== "finished" && db) updateDoc(doc(db, "artifacts", appId, "public", "data", "games", gameId), { status: "finished" }).catch(() => {});

  if (gameDoc.status === "finished") return <GameResult gameDoc={gameDoc} user={user} connectionId={connectionId} opponentConnectionId={opponentConnectionId} onExit={handleLeave} opponentLeft={opponentLeft} />;

  return (
    <div className="relative mx-auto my-4 flex min-h-[500px] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-4 text-white md:px-6">
        <div className="flex items-center gap-4 overflow-hidden">
          <div className="flex items-center gap-2 truncate rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5"><span className="text-xs text-slate-400 md:text-sm">Sen:</span><span className="max-w-[120px] truncate text-sm font-bold text-indigo-400 md:text-base">{dbProfile.username}</span></div>
          <span className="text-xs font-black italic text-slate-500 md:text-base">VS</span>
          <div className="flex items-center gap-2 truncate rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5"><span className="text-xs text-slate-400 md:text-sm">Rakip:</span><span className="max-w-[120px] truncate text-sm font-bold text-red-400 md:text-base">{opponentName}</span></div>
        </div>
        <button onClick={handleLeave} className="flex items-center gap-1 whitespace-nowrap text-xs text-slate-400 transition hover:text-white md:text-sm"><LogOut size={16} /> Pes Et</button>
      </div>
      <div className="flex flex-1 flex-col p-4 md:p-8">
        {gameDoc.status === "selecting_game" && <GameSelection isHost={isHost} gameDoc={gameDoc} onGenerate={onGenerate} />}
        {gameDoc.status === "generating" && <GameGenerating />}
        {gameDoc.status === "playing" && <GamePlayArea gameDoc={gameDoc} connectionId={connectionId} isHost={isHost} opponentName={opponentName} aiSettings={aiSettings} />}
        {gameDoc.status === "evaluating" && <GameEvaluating />}
      </div>
    </div>
  );
}

function TELCArena({ user, onClose, aiSettings }) {
  const [dbProfile, setDbProfile] = useState(null);
  const [dbProfileLoading, setDbProfileLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [connectionId] = useState(() => `${localDeviceId}_${generateIdOuter()}`);
  const [lobbyUsers, setLobbyUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [activeGameId, setActiveGameId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const gameGenerators = createGameGenerators(aiSettings);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!db || !user) return undefined;
    const profileRef = doc(db, "artifacts", appId, "public", "data", "profiles", user.uid);
    const unsubProfile = onSnapshot(profileRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setDbProfile(data);
        storageObj.set("telc_arena_username", data.username);
        storageObj.set("telc_arena_wins", String(data.wins));
      } else {
        const savedName = storageObj.get("telc_arena_username");
        const savedWins = parseInt(storageObj.get("telc_arena_wins") || "0", 10);
        if (savedName) await setDoc(profileRef, { uid: user.uid, username: savedName, wins: savedWins, h2h: {}, createdAt: Date.now() });
        else setDbProfile(null);
      }
      setDbProfileLoading(false);
    });
    const unsubLobby = onSnapshot(collection(db, "artifacts", appId, "public", "data", "lobby"), (snap) => setLobbyUsers(snap.docs.map((item) => item.data())));
    const unsubInvites = onSnapshot(collection(db, "artifacts", appId, "public", "data", "invites"), (snap) => {
      const list = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      setInvites(list);
      const acceptedInvite = list.find((item) => item.fromConnectionId === connectionId && item.status === "accepted" && item.gameId);
      if (acceptedInvite && !activeGameId) {
        setActiveGameId(acceptedInvite.gameId);
        deleteDoc(doc(db, "artifacts", appId, "public", "data", "invites", acceptedInvite.id)).catch(() => {});
      }
    });
    return () => {
      unsubProfile();
      unsubLobby();
      unsubInvites();
    };
  }, [activeGameId, connectionId, user]);

  useEffect(() => {
    if (!db || !dbProfile || !user) return undefined;
    const lobbyDocRef = doc(db, "artifacts", appId, "public", "data", "lobby", connectionId);
    const ping = () => setDoc(lobbyDocRef, { connectionId, uid: user.uid, username: dbProfile.username, wins: dbProfile.wins || 0, lastActive: Date.now() }).catch(() => {});
    ping();
    const interval = setInterval(ping, 8000);
    const handleUnload = () => deleteDoc(lobbyDocRef).catch(() => {});
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      handleUnload();
    };
  }, [connectionId, dbProfile, user]);

  const onlineUsers = lobbyUsers.filter((item) => item.connectionId !== connectionId && Math.abs(now - (item.lastActive || 0)) < 15000);
  const pendingIncomingInvites = invites.filter((item) => item.toConnectionId === connectionId && item.status === "pending");
  const mySentInvite = invites.find((item) => item.fromConnectionId === connectionId && item.status === "pending");

  const handleRefresh = async () => {
    if (!db) return;
    setIsRefreshing(true);
    try {
      const snap = await getDocs(collection(db, "artifacts", appId, "public", "data", "lobby"));
      const deletions = [];
      snap.forEach((item) => {
        if (Date.now() - (item.data().lastActive || 0) > 20000) deletions.push(deleteDoc(item.ref));
      });
      await Promise.all(deletions);
      if (dbProfile && user) await setDoc(doc(db, "artifacts", appId, "public", "data", "lobby", connectionId), { connectionId, uid: user.uid, username: dbProfile.username, wins: dbProfile.wins || 0, lastActive: Date.now() }, { merge: true });
    } catch {}
    setNow(Date.now());
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const sendInvite = async (targetConnectionId) => {
    if (!db || mySentInvite) return;
    await addDoc(collection(db, "artifacts", appId, "public", "data", "invites"), { fromConnectionId: connectionId, fromUid: user.uid, fromName: dbProfile.username, toConnectionId: targetConnectionId, status: "pending", createdAt: Date.now() });
  };
  const cancelSentInvite = async () => { if (db && mySentInvite) await deleteDoc(doc(db, "artifacts", appId, "public", "data", "invites", mySentInvite.id)); };
  const acceptInvite = async (invite) => {
    if (!db) return;
    const gameId = `game_${Date.now()}_${invite.fromConnectionId}`;
    await setDoc(doc(db, "artifacts", appId, "public", "data", "games", gameId), {
      id: gameId,
      hostConnectionId: invite.fromConnectionId,
      hostName: invite.fromName,
      guestConnectionId: connectionId,
      guestName: dbProfile.username,
      status: "selecting_game",
      selectedGame: null,
      level: "B1",
      createdAt: Date.now(),
      players: {
        [invite.fromConnectionId]: { uid: invite.fromUid, progress: 0, score: 0, finished: false, text: "", aiScore: 0, left: false },
        [connectionId]: { uid: user.uid, progress: 0, score: 0, finished: false, text: "", aiScore: 0, left: false }
      }
    });
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "invites", invite.id), { status: "accepted", gameId });
    setActiveGameId(gameId);
  };
  const declineInvite = async (inviteId) => { if (db) await deleteDoc(doc(db, "artifacts", appId, "public", "data", "invites", inviteId)); };
  const exitGame = () => setActiveGameId(null);

  if (dbProfileLoading) return <div className="flex h-[80vh] min-h-[600px] items-center justify-center rounded-3xl bg-slate-100"><Loader2 className="h-12 w-12 animate-spin text-indigo-500" /></div>;
  if (user && dbProfile === null) return <div className="relative h-[80vh] min-h-[600px] overflow-hidden rounded-3xl"><UsernamePrompt user={user} onClose={onClose} onSave={() => {}} /></div>;

  return (
    <div className="relative flex min-h-[80vh] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-slate-100 text-slate-900 shadow-xl">
      {isEditingName && <EditUsernameModal user={user} currentName={dbProfile.username} onClose={() => setIsEditingName(false)} onSave={() => setIsEditingName(false)} />}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-slate-900 px-4 py-4 text-white shadow-xl md:px-6">
        <div className="flex flex-shrink-0 items-center gap-3">
          <button onClick={onClose} className="flex items-center gap-1 rounded-xl p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"><ChevronLeft size={20} /><span className="hidden text-sm font-bold sm:inline">Geri</span></button>
          <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-2"><Swords size={20} className="text-white" /></div>
          <span className="hidden whitespace-nowrap text-base font-black tracking-wide sm:block md:text-xl">TELC ARENA</span>
        </div>
        {dbProfile && (
          <div onClick={() => !activeGameId && setIsEditingName(true)} className={`ml-4 flex flex-1 items-center justify-end gap-4 overflow-hidden ${!activeGameId ? "group cursor-pointer transition hover:opacity-80" : ""}`}>
            <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-700 bg-slate-800 px-4 py-1.5"><Trophy size={14} className="text-yellow-400" /><span className="text-xs font-bold text-yellow-400 sm:text-sm">{dbProfile.wins || 0} Zafer</span></div>
            <div className="flex max-w-[200px] items-center gap-1 truncate text-xs font-bold text-slate-300 sm:text-sm">{dbProfile.username}{!activeGameId && <Edit3 size={12} className="opacity-0 transition group-hover:opacity-100" />}</div>
          </div>
        )}
      </header>
      <main className="flex flex-1 flex-col">
        {activeGameId ? <ActiveGameRoom gameId={activeGameId} user={user} connectionId={connectionId} dbProfile={dbProfile} onExit={exitGame} aiSettings={aiSettings} onGenerate={(gameType, level) => gameGenerators[gameType](level)} /> : <Lobby user={user} dbProfile={dbProfile} onlineUsers={onlineUsers} mySentInvite={mySentInvite} pendingIncomingInvites={pendingIncomingInvites} onSendInvite={sendInvite} onCancelInvite={cancelSentInvite} onAccept={acceptInvite} onDecline={declineInvite} onRefresh={handleRefresh} isRefreshing={isRefreshing} />}
      </main>
    </div>
  );
}

function Header({ level, setLevel, toggleSidebar, onOpenSettings }) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-4 shadow-sm md:px-6">
      <div className="flex items-center gap-3">
        <button onClick={toggleSidebar} className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100"><Menu size={24} /></button>
        <div className="rounded-lg bg-gradient-to-br from-red-600 to-yellow-500 p-2 text-xl font-bold text-white">TELC</div>
        <span className="hidden text-lg font-bold text-gray-800 md:block">Master AI Cloud</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1">
          <span className="hidden text-sm font-medium text-gray-500 sm:inline">Seviye:</span>
          <select value={level} onChange={(event) => setLevel(event.target.value)} className="cursor-pointer bg-transparent font-bold text-indigo-600 outline-none">
            {["A1", "A2", "B1", "B2", "C1", "C2"].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <button onClick={onOpenSettings} className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900" title="AI Ayarlari"><Settings size={18} /></button>
      </div>
    </header>
  );
}

function Sidebar({ activeTab, setActiveTab, isOpen, closeSidebar, isDesktopOpen }) {
  const menu = [
    { id: "dashboard", label: "Genel Bakis", icon: <BarChart2 /> },
    { id: "vocab", label: "Kelime Hazinesi", icon: <BookOpen /> },
    { id: "exam", label: "Sınav Simülasyonu", icon: <PenTool /> },
    { id: "tutor", label: "AI Koc", icon: <MessageCircle /> },
    { id: "strategy", label: "Strateji", icon: <Lightbulb /> }
  ];
  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={closeSidebar} />}
      <nav className={`fixed left-0 top-0 z-50 flex h-full flex-col overflow-hidden bg-slate-900 pt-20 text-slate-300 transition-all duration-300 md:translate-x-0 ${isOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full"} ${isDesktopOpen ? "md:w-64" : "md:w-20"}`}>
        <button onClick={closeSidebar} className="absolute right-4 top-4 text-white md:hidden"><X size={24} /></button>
        <div className="mt-2 flex flex-col gap-2 p-4">
          {menu.map((item) => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); closeSidebar(); }} className={`flex items-center rounded-xl p-3 transition-all ${activeTab === item.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/50" : "hover:bg-slate-800 hover:text-white"} ${isDesktopOpen ? "justify-start gap-4 px-4" : "justify-center gap-4 md:gap-0 md:px-0"}`} title={!isDesktopOpen ? item.label : ""}>
              <div className="h-6 w-6 flex-shrink-0">{item.icon}</div>
              <span className={`font-medium ${isDesktopOpen ? "md:block" : "md:hidden"}`}>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

function Dashboard({ level, onExecutePlan, user, aiSettings }) {
  const [stats, setStats] = useState({ known: 0, unknown: 0, totalWords: 0 });
  const [plan, setPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState("");

  useEffect(() => {
    if (!db || !user) return undefined;
    const historyCol = collection(db, "artifacts", appId, "users", user.uid, "vocab_history");
    const unknownsCol = collection(db, "artifacts", appId, "users", user.uid, "vocab_unknowns");
    const unsubHistory = onSnapshot(historyCol, (snap) => {
      const total = snap.docs.reduce((acc, item) => acc + (item.data().words?.length || 0), 0);
      setStats((prev) => ({ ...prev, totalWords: total, known: Math.max(0, total - prev.unknown) }));
    });
    const unsubUnknowns = onSnapshot(unknownsCol, (snap) => {
      const unknownCount = snap.docs.length;
      setStats((prev) => ({ ...prev, unknown: unknownCount, known: Math.max(0, Number(prev.totalWords || 0) - unknownCount) }));
    });
    return () => { unsubHistory(); unsubUnknowns(); };
  }, [user]);

  const generatePlan = async () => {
    setLoadingPlan(true);
    setPlanError("");
    try {
      const prompt = `Almanca TELC ${level} seviyesi için günlük çalışma planı hazırla. JSON: {"tasks":[{"title":"German Title","description":"Türkçe açıklama","duration":"15 dk"}]}`;
      const data = safeJSONParse(await generateContent(aiSettings, prompt, "json"));
      if (data?.tasks) setPlan(data);
      else throw new Error("Geçerli bir çalışma planı alınamadı.");
    } catch (error) {
      setPlanError(error.message || "Çalışma planı hazırlanamadı.");
    } finally {
      setLoadingPlan(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 to-purple-700 p-8 text-white shadow-xl">
        <div className="relative z-10">
          <h1 className="mb-2 text-3xl font-bold">Willkommen</h1>
          <p className="mb-6 text-lg opacity-90">TELC {level} hedefine bugün bir adım daha yaklaş.</p>
          <div className="flex gap-4">
            <button onClick={() => onExecutePlan({ title: "Kelime", description: "Vocab" })} className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-indigo-700 shadow-md"><BookOpen size={18} /> Kelime Çalış</button>
            <button onClick={() => onExecutePlan({ title: "Sınav", description: "Exam" })} className="flex items-center gap-2 rounded-xl border border-white/30 bg-indigo-500/40 px-6 py-3 font-bold text-white"><PenTool size={18} /> Sınav Pratiği</button>
          </div>
        </div>
        <div className="absolute bottom-0 right-0 opacity-10"><Globe size={200} /></div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100"><BookOpen className="text-blue-600" /></div><h3 className="text-lg font-bold text-gray-800">Kelime İstatistiği</h3><p className="mt-1 text-sm text-gray-500">Toplam: {stats.totalWords} Kelime</p><div className="mt-2 flex gap-3 text-xs font-bold"><span className="text-red-500">{stats.unknown} Bilinmeyen</span><span className="text-green-600">{Number.isFinite(stats.known) ? stats.known : 0} Bilinen</span></div></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100"><Brain className="text-purple-600" /></div><h3 className="text-lg font-bold text-gray-800">AI Tavsiyesi</h3><p className="mt-2 text-sm italic text-gray-600">"{stats.unknown > 5 ? "Bilinmeyen kelime kutun doluyor. Bugün tekrar yapmalısın." : `${level} seviyesi için gramer ağırlıklı gitmelisin.`}"</p></div>
      </div>
      <div>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-gray-800">AI Günlük Çalışma Planı</h2><button onClick={generatePlan} disabled={loadingPlan} className="flex items-center gap-1 rounded-lg px-3 py-1 text-sm font-bold text-indigo-600 hover:bg-indigo-50"><RefreshCw size={16} className={loadingPlan ? "animate-spin" : ""} /> {plan ? "Planı Yenile" : "Plan Oluştur"}</button></div>
        {!!planError && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{planError}</div>}
        {!plan && !loadingPlan && <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-10 text-center text-gray-500">Bugün için henüz bir planın yok.</div>}
        {loadingPlan && <div className="rounded-2xl border border-gray-100 bg-white py-10 text-center"><Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-indigo-600" /><p className="text-gray-500">Yapay zeka planını hazırlıyor...</p></div>}
        {plan && !loadingPlan && <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">{plan.tasks.map((item, index) => <div key={`${item.title}-${index}`} onClick={() => onExecutePlan(item)} className="group flex cursor-pointer items-center justify-between border-b p-4 transition last:border-0 hover:bg-gray-50"><div className="flex items-center gap-4"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-600">{index + 1}</div><div><h4 className="font-semibold text-gray-800 group-hover:text-indigo-600">{item.title}</h4><p className="text-xs text-gray-500">{item.description}</p></div></div><div className="flex items-center gap-2"><span className="rounded bg-gray-100 px-2 py-1 text-sm font-medium text-gray-500">{item.duration}</span><ArrowRightCircle size={18} className="text-gray-300 group-hover:text-indigo-600" /></div></div>)}</div>}
      </div>
    </div>
  );
}

function WordCard({ word, onUnknown, onKnown, isUnknownList }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`rounded-xl border bg-white shadow-sm ${isUnknownList ? "border-red-100" : "border-gray-200"}`}>
      <div onClick={() => setExpanded(!expanded)} className="flex cursor-pointer items-center justify-between rounded-t-xl p-4 hover:bg-gray-50/50">
        <div className="flex items-center gap-3">
          <span className={`rounded px-2 py-1 text-xs font-bold uppercase ${word.article === "der" ? "bg-blue-100 text-blue-700" : word.article === "die" ? "bg-pink-100 text-pink-700" : "bg-green-100 text-green-700"}`}>{word.article}</span>
          <h3 className="text-lg font-bold text-gray-800">{word.word}</h3>
        </div>
        {isUnknownList ? <AlertCircle size={16} className="text-red-500" /> : <ChevronDown size={16} className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />}
      </div>
      {expanded && <div className="mt-2 border-t border-gray-100 px-4 pb-4 pt-0"><div className="mt-2"><p className="font-medium text-gray-800">{word.meaning}</p><div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700"><span className="italic">"{word.example}"</span><br /><span className="mt-1 block text-xs text-gray-500">{word.translation}</span></div></div><div className="mt-4 flex gap-3">{isUnknownList ? <button onClick={(event) => { event.stopPropagation(); onKnown(); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 py-2 text-sm font-bold text-white"><CheckCircle size={16} /> Artik Biliyorum</button> : <><button onClick={(event) => { event.stopPropagation(); onKnown(); }} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 py-2.5 text-sm font-bold text-green-700"><CheckCircle size={16} /> Biliyorum</button><button onClick={(event) => { event.stopPropagation(); onUnknown(); }} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-bold text-red-700"><XCircle size={16} /> Bilmiyorum</button></>}</div></div>}
    </div>
  );
}

function HistoryBatchCard({ batch, onAddUnknown }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <button onClick={() => setExpanded((prev) => !prev)} className="flex w-full items-center justify-between text-left">
        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-indigo-500" />
          <span className="text-sm font-bold text-gray-700">{new Date(batch.date).toLocaleString("tr-TR")}</span>
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">{batch.level}</span>
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-600">{(batch.words || []).length} kelime</span>
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">{(batch.words || []).map((word, index) => <div key={`${batch.id}-${word.word}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"><div className="min-w-0 text-sm text-gray-700"><span className="mr-2 font-bold text-gray-900">{word.article} {word.word}</span>{word.meaning}</div><button onClick={() => onAddUnknown(word)} className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50">Bilinmeyenlere Ekle</button></div>)}</div>}
    </div>
  );
}

function UnknownWordQuiz({ words, onClose, onMarkKnown }) {
  const [items, setItems] = useState(() => [...words].sort(() => Math.random() - 0.5).slice(0, Math.min(10, words.length)));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);

  if (items.length === 0) return null;
  if (index >= items.length) {
    return (
      <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-xl">
        <Award size={56} className="mx-auto mb-4 text-yellow-500" />
        <h3 className="text-2xl font-bold text-gray-800">Oyun Tamamlandı</h3>
        <p className="mt-2 text-gray-500">Skorun: {score} / {items.length}</p>
        <button onClick={onClose} className="mt-6 rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white">Geri Dön</button>
      </div>
    );
  }

  const current = items[index];
  const options = [...new Set([current, ...items.filter((item) => normalizeWordKey(item.word) !== normalizeWordKey(current.word)).sort(() => Math.random() - 0.5).slice(0, 3)])].sort(() => Math.random() - 0.5);

  const choose = (word) => {
    if (selected) return;
    const isCorrect = normalizeWordKey(word.word) === normalizeWordKey(current.word);
    setSelected(word.word);
    if (isCorrect) setScore((prev) => prev + 1);
    window.setTimeout(() => {
      setSelected(null);
      setIndex((prev) => prev + 1);
    }, 900);
  };

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-xl">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-2xl font-bold text-gray-800">Bilinmeyen Kelime Oyunu</h3>
        <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={20} /></button>
      </div>
      <p className="mb-2 text-sm font-bold uppercase tracking-wide text-indigo-500">Türkçe anlam</p>
      <div className="mb-8 rounded-2xl bg-indigo-50 p-6 text-center text-2xl font-black text-indigo-700">{current.meaning}</div>
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((option) => {
          const isCorrect = normalizeWordKey(option.word) === normalizeWordKey(current.word);
          const isPicked = selected === option.word;
          return (
            <button key={option.word} onClick={() => choose(option)} className={`rounded-xl border px-4 py-3 text-left font-bold transition ${selected ? isCorrect ? "border-green-500 bg-green-50 text-green-700" : isPicked ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 bg-white text-gray-400" : "border-gray-200 bg-white text-gray-700 hover:border-indigo-400 hover:bg-indigo-50"}`}>
              {option.article} {option.word}
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
        <span>Soru {index + 1} / {items.length}</span>
        <span>Skor: {score}</span>
      </div>
      <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">İstersen bu kelimeyi öğrendiğinde listeden çıkarabilirsin.</p>
        <button onClick={() => onMarkKnown(current.firestoreId)} className="mt-3 rounded-xl bg-green-500 px-4 py-2 text-sm font-bold text-white">Bu Kelimeyi Artık Biliyorum</button>
      </div>
    </div>
  );
}

function VocabTrainer({ level, user, aiSettings }) {
  const [tab, setTab] = useState("new");
  const [loading, setLoading] = useState(false);
  const [currentBatch, setCurrentBatch] = useState([]);
  const [history, setHistory] = useState([]);
  const [unknowns, setUnknowns] = useState([]);
  const [arenaMode, setArenaMode] = useState(false);
  const [error, setError] = useState("");
  const [unknownGameOpen, setUnknownGameOpen] = useState(false);

  useEffect(() => {
    if (!db || !user) return undefined;
    const historyCol = collection(db, "artifacts", appId, "users", user.uid, "vocab_history");
    const unknownsCol = collection(db, "artifacts", appId, "users", user.uid, "vocab_unknowns");
    const unsubHistory = onSnapshot(historyCol, (snap) => {
      setHistory(snap.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => new Date(b.date) - new Date(a.date)));
    });
    const unsubUnknowns = onSnapshot(unknownsCol, (snap) => {
      setUnknowns(snap.docs.map((item) => ({ firestoreId: item.id, ...item.data() })));
    });
    return () => { unsubHistory(); unsubUnknowns(); };
  }, [user]);

  const generateWords = async () => {
    setLoading(true);
    setError("");
    try {
      const usedWords = new Set([
        ...history.flatMap((batch) => (batch.words || []).map((word) => normalizeWordKey(word.word))),
        ...currentBatch.map((word) => normalizeWordKey(word.word)),
        ...unknowns.map((word) => normalizeWordKey(word.word))
      ]);
      const blockedWords = Array.from(usedWords).filter(Boolean);
      const prompt = `Generate a JSON array of exactly 5 distinct German vocabulary words for TELC Level ${level}.
The words must be useful for exam study and must be completely different from all previously generated words.
Never use any of these words again: ${blockedWords.join(", ") || "none"}.
Format: [{"word":"GermanWord","article":"der/die/das","meaning":"TurkishMeaning","example":"GermanSentence","translation":"TurkishTranslationOfSentence"}]`;
      const data = safeJSONParse(await generateContent(aiSettings, prompt, "json"));
      const filteredData = Array.isArray(data) ? data.filter((word) => !usedWords.has(normalizeWordKey(word.word))) : [];
      if (filteredData.length !== 5) throw new Error("Yapay zeka tekrar eden kelimeler üretti. Lütfen yeniden dene.");
      setCurrentBatch(filteredData);
      if (db && user) {
        await addDoc(collection(db, "artifacts", appId, "users", user.uid, "vocab_history"), {
          date: new Date().toISOString(),
          level,
          words: filteredData
        });
      }
    } catch (requestError) {
      setError(requestError.message || "Kelime paketi oluşturulamadı.");
    } finally {
      setLoading(false);
    }
  };

  const markAsUnknown = async (word) => {
    const exists = unknowns.some((item) => normalizeWordKey(item.word) === normalizeWordKey(word.word));
    if (!exists && db && user) {
      await addDoc(collection(db, "artifacts", appId, "users", user.uid, "vocab_unknowns"), word);
    }
    setCurrentBatch((prev) => prev.filter((item) => item.word !== word.word));
  };

  const addHistoryWordToUnknowns = async (word) => {
    const exists = unknowns.some((item) => normalizeWordKey(item.word) === normalizeWordKey(word.word));
    if (!exists && db && user) {
      await addDoc(collection(db, "artifacts", appId, "users", user.uid, "vocab_unknowns"), word);
    }
  };

  const removeUnknownWord = async (firestoreId) => {
    if (db && user && firestoreId) {
      await deleteDoc(doc(db, "artifacts", appId, "users", user.uid, "vocab_unknowns", firestoreId));
    }
  };

  if (arenaMode) return <TELCArena user={user} onClose={() => setArenaMode(false)} aiSettings={aiSettings} />;
  if (unknownGameOpen) return <UnknownWordQuiz words={unknowns} onClose={() => setUnknownGameOpen(false)} onMarkKnown={removeUnknownWord} />;

  return (
    <div className="mx-auto max-w-4xl py-4">
      <div className="mb-6 flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex w-full overflow-x-auto rounded-xl bg-gray-100 p-1 md:w-auto">
          <button onClick={() => setTab("new")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "new" ? "bg-white text-indigo-600 shadow" : "text-gray-500"}`}>Yeni Kelimeler</button>
          <button onClick={() => setTab("history")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "history" ? "bg-white text-indigo-600 shadow" : "text-gray-500"}`}>Geçmiş Paketler</button>
          <button onClick={() => setTab("unknowns")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "unknowns" ? "bg-white text-red-600 shadow" : "text-gray-500"}`}>Bilinmeyenler ({unknowns.length})</button>
        </div>
        <div className="flex w-full gap-2 md:w-auto">
          <button onClick={() => setArenaMode(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white md:w-auto"><Swords size={16} /> 1v1 Düello</button>
          <button onClick={generateWords} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white md:w-auto">{loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />} Yeni Paket</button>
        </div>
      </div>
      {!!error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {tab === "new" && (
        <div className="space-y-4">
          {currentBatch.length === 0 && !loading
            ? <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-20 text-center text-gray-500">Açık paket yok.</div>
            : currentBatch.map((word, index) => <WordCard key={`${word.word}-${index}`} word={word} onUnknown={() => markAsUnknown(word)} onKnown={() => setCurrentBatch((prev) => prev.filter((item) => item.word !== word.word))} isUnknownList={false} />)}
        </div>
      )}
      {tab === "history" && <div className="space-y-4">{history.map((batch) => <HistoryBatchCard key={batch.id} batch={batch} onAddUnknown={addHistoryWordToUnknowns} />)}</div>}
      {tab === "unknowns" && (
        <div className="space-y-6">
          {unknowns.length > 0 && <div className="flex justify-end"><button onClick={() => setUnknownGameOpen(true)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Bilinmeyen Kelime Oyunu</button></div>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {unknowns.length === 0
              ? <div className="col-span-2 py-20 text-center text-gray-500">Tebrikler! Bilinmeyen kelime eklemedin.</div>
              : unknowns.map((word) => <WordCard key={word.firestoreId} word={word} onKnown={() => removeUnknownWord(word.firestoreId)} isUnknownList />)}
          </div>
        </div>
      )}
    </div>
  );
}

function ExamSimulator({ level, aiSettings, user }) {
  const [mode, setMode] = useState("menu");
  const [loading, setLoading] = useState(false);
  const [examData, setExamData] = useState(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState("");
  const [historyList, setHistoryList] = useState([]);

  useEffect(() => {
    if (!db || !user) return undefined;
    const historyCol = collection(db, "artifacts", appId, "users", user.uid, "exam_history");
    const unsubscribe = onSnapshot(historyCol, (snap) => {
      setHistoryList(snap.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => new Date(b.date) - new Date(a.date)));
    });
    return () => unsubscribe();
  }, [user]);

  const saveExamHistory = async (payload) => {
    if (!db || !user) return;
    await addDoc(collection(db, "artifacts", appId, "users", user.uid, "exam_history"), {
      ...payload,
      level,
      date: new Date().toISOString()
    });
  };

  const startReading = async (type) => {
    setLoading(true);
    setMode(type);
    setError("");
    try {
      const prompt = type === "lesen"
        ? `TELC ${level} Leseverstehen sınavı hazırla. JSON: {"teil1":{"text":"...","questions":[{"id":"t1_1","question":"...","options":["Richtig","Falsch"],"correct":0,"explanation":"...","quote":"..."}]},"teil2":{"text":"...","questions":[{"id":"t2_1","question":"...","options":["A","B","C"],"correct":0,"explanation":"...","quote":"..."}]}}`
        : `TELC ${level} Sprachbausteine görevi hazırla. JSON: {"text":"...","questions":[{"id":"1","question":"Boşluk 1","options":["weil","denn","da"],"correct":0,"explanation":"..."}]}`;
      const parsed = safeJSONParse(await generateContent(aiSettings, prompt, "json"));
      if (!parsed) throw new Error("Sınav verisi oluşturulamadı.");
      setExamData(parsed);
      setFeedback(null);
      setAnswers({});
    } catch (requestError) {
      setError(requestError.message || "Sınav hazırlanamadı.");
      setMode("menu");
    } finally {
      setLoading(false);
    }
  };

  const startWriting = async () => {
    setLoading(true);
    setMode("schreiben");
    setError("");
    try {
      const parsed = safeJSONParse(await generateContent(aiSettings, `TELC ${level} yazma görevi hazırla. JSON: {"title":"German Title","situation":"German Situation","points":["Point 1","Point 2","Point 3"]}`, "json"));
      if (!parsed) throw new Error("Yazma görevi oluşturulamadı.");
      setExamData(parsed);
      setFeedback(null);
      setUserAnswer("");
    } catch (requestError) {
      setError(requestError.message || "Yazma görevi hazırlanamadı.");
      setMode("menu");
    } finally {
      setLoading(false);
    }
  };

  const evaluateWriting = async () => {
    setLoading(true);
    setError("");
    try {
      const html = await generateContent(aiSettings, `Sen katı ama öğretici bir TELC değerlendiricisisin.
Seviye: ${level}
Görev: ${JSON.stringify(examData)}
Kullanıcının metni: "${userAnswer}"

Türkçe geri bildirim ver ve sonunda göreve uygun örnek bir Almanca metin yaz.
Yalnızca HTML dön.
Zorunlu yapı:
<div class="space-y-4">
  <div><strong>Puan:</strong> X/100</div>
  <div><strong>Güçlü Yönler:</strong> ...</div>
  <div><strong>Hatalar ve Düzeltmeler:</strong> ...</div>
  <div><strong>Geliştirme Tavsiyesi:</strong> ...</div>
  <div><strong>Örnek Metin:</strong><div>...</div></div>
</div>`);
      const nextFeedback = { html };
      setFeedback(nextFeedback);
      await saveExamHistory({ type: "schreiben", examData, userAnswer, feedback: nextFeedback });
    } catch (requestError) {
      setError(requestError.message || "Yazı değerlendirilemedi.");
    } finally {
      setLoading(false);
    }
  };

  const finishReading = () => {
    const allQuestions = examData?.teil1 ? [...examData.teil1.questions, ...examData.teil2.questions] : examData?.questions || [];
    const results = allQuestions.map((question, index) => ({
      ...question,
      userIdx: answers[question.id],
      isCorrect: answers[question.id] === question.correct,
      displayNum: index + 1
    }));
    const nextFeedback = { score: results.filter((item) => item.isCorrect).length, total: results.length, results };
    setFeedback(nextFeedback);
    saveExamHistory({ type: mode, examData, answers, feedback: nextFeedback }).catch(() => {});
  };

  const loadHistoryItem = (item) => {
    setMode(item.type || "menu");
    setExamData(item.examData || null);
    setUserAnswer(item.userAnswer || "");
    setAnswers(item.answers || {});
    setFeedback(item.feedback || null);
    setError("");
  };

  if (loading) return <div className="flex h-96 flex-col items-center justify-center"><Loader2 className="mb-4 h-12 w-12 animate-spin text-indigo-600" /><p className="text-gray-500">Sınav hazırlanıyor...</p></div>;

  if (mode === "menu") {
    return (
      <div className="space-y-6">
        {!!error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[{ id: "schreiben", title: "Schreiben", icon: PenTool, color: "text-indigo-600" }, { id: "lesen", title: "Lesen", icon: BookOpen, color: "text-blue-600" }, { id: "sprachbausteine", title: "Sprachbausteine", icon: List, color: "text-orange-600" }].map((item) => (
            <button key={item.id} onClick={() => item.id === "schreiben" ? startWriting() : startReading(item.id)} className="group rounded-2xl border border-gray-200 bg-white p-8 text-left transition hover:border-indigo-300 hover:shadow-xl">
              <item.icon size={48} className={`${item.color} mb-4 transition group-hover:scale-110`} />
              <h3 className="text-xl font-bold text-gray-800">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-500">TELC formatında pratik yap.</p>
            </button>
          ))}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-800"><History size={20} /> Geçmiş Sınavlar</div>
          {historyList.length === 0 ? <p className="text-sm text-gray-500">Henüz kayıtlı sınav yok.</p> : <div className="space-y-3">{historyList.map((item) => <button key={item.id} onClick={() => loadHistoryItem(item)} className="flex w-full items-center justify-between rounded-xl border border-gray-100 px-4 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50"><div><div className="font-bold text-gray-800">{item.type === "schreiben" ? "Schreiben" : item.type === "lesen" ? "Lesen" : "Sprachbausteine"}</div><div className="text-xs text-gray-500">{new Date(item.date).toLocaleString("tr-TR")} • {item.level}</div></div><span className="text-xs font-bold text-indigo-600">Aç</span></button>)}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <button onClick={() => setMode("menu")} className="mb-4 flex items-center gap-1 text-gray-500"><ChevronLeft size={16} /> Menü</button>
      {!!error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {mode === "schreiben" ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6"><h3 className="mb-2 text-xl font-bold text-yellow-900">{examData?.title}</h3><p className="mb-4 text-sm leading-relaxed text-yellow-800">{examData?.situation}</p><ul className="list-disc space-y-2 pl-5 text-sm text-yellow-800">{examData?.points?.map((point, index) => <li key={`${point}-${index}`}>{point}</li>)}</ul></div>
          <div>{!feedback?.html ? <><textarea className="mb-4 h-96 w-full resize-none rounded-xl border border-gray-300 p-5 font-mono leading-relaxed text-gray-800 shadow-inner outline-none focus:ring-2 focus:ring-indigo-500" value={userAnswer} onChange={(event) => setUserAnswer(event.target.value)} placeholder="Metnini buraya yaz..." /><button onClick={evaluateWriting} disabled={userAnswer.length < 10} className="w-full rounded-xl bg-indigo-600 py-4 font-bold text-white">Değerlendir</button></> : <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"><div className="bg-indigo-600 px-6 py-4 font-bold text-white">Sınav Sonucu</div><div className="prose max-w-none p-6" dangerouslySetInnerHTML={{ __html: feedback.html }} /></div>}</div>
        </div>
      ) : (
        <div className="space-y-6">
          {!feedback?.results ? (
            <>
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 bg-gray-50 p-6 leading-relaxed text-gray-800">{examData?.teil1 ? examData.teil1.text : examData?.text}</div>
                <div className="p-6">
                  {(examData?.teil1 ? [...examData.teil1.questions, ...examData.teil2.questions] : examData?.questions || []).map((question, index) => (
                    <div key={question.id} className="mb-6 rounded-xl border border-gray-100 p-6 shadow-sm">
                      <p className="mb-4 font-bold text-gray-800">{index + 1}. {question.question || question.q}</p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{question.options.map((option, optionIndex) => <button key={`${question.id}-${option}`} onClick={() => setAnswers({ ...answers, [question.id]: optionIndex })} className={`rounded-lg border px-4 py-3 text-left ${answers[question.id] === optionIndex ? "border-indigo-600 bg-indigo-600 text-white" : "text-gray-700 hover:bg-gray-50"}`}>{option}</button>)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={finishReading} className="w-full rounded-xl bg-indigo-600 py-4 text-lg font-bold text-white">Sınavı Bitir ve Sonuçları Gör</button>
            </>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-8 text-center shadow-sm"><Award size={48} className="mx-auto mb-2 text-indigo-400" /><h3 className="text-3xl font-bold text-indigo-900">Sonuç: {feedback.score} / {feedback.total}</h3></div>
              {feedback.results.map((result, index) => <div key={`${result.id}-${index}`} className={`rounded-2xl border p-5 shadow-sm ${result.isCorrect ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}`}><p className="mb-2 text-lg font-bold text-gray-900">Soru {result.displayNum}</p><p className="text-sm text-gray-700">Açıklama: {result.explanation}</p></div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function AICoach({ level, initialPrompt, onClearPrompt, aiSettings }) {
  const [messages, setMessages] = useState([{ role: "ai", text: `Merhaba! TELC ${level} sınavı için kişisel asistanınım.` }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (initialPrompt && !loading) { setInput(initialPrompt); onClearPrompt(); } }, [initialPrompt]);
  const handleSend = async (override = null) => {
    const textToSend = override || input;
    if (!textToSend.trim()) return;
    setMessages((prev) => [...prev, { role: "user", text: textToSend }]);
    setInput("");
    setLoading(true);
    try {
      const data = safeJSONParse(await generateContent(aiSettings, `Almanca TELC ${level} uzmanı olarak cevap ver. Soruyu Türkçe açıklayıp Almanca örnekler ver. JSON: {"response":"Markdown cevap..."}`, "json"));
      setMessages((prev) => [...prev, { role: "ai", text: data?.response || "Yanıt alınamadı." }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: "ai", text: `Şu anda yanıt oluşturulamadı: ${error.message || "Bilinmeyen hata"}` }]);
    } finally {
      setLoading(false);
    }
  };
  return <div className="relative flex h-[80vh] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"><div className="border-b bg-white p-4 font-bold text-gray-700">AI Tutor ({level})</div><div className="flex-1 space-y-6 overflow-y-auto bg-slate-50 p-4 md:p-8">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>{message.role === "user" ? <div className="max-w-[85%] rounded-2xl rounded-tr-none bg-indigo-600 px-6 py-3 text-white">{message.text}</div> : <div className="max-w-[95%] rounded-2xl rounded-tl-none border border-indigo-100 bg-white p-6 shadow-lg">{message.text}</div>}</div>)}{loading && <div className="text-sm text-gray-500">Yanıt hazırlanıyor...</div>}</div><div className="border-t bg-white p-4"><div className="flex gap-2"><input type="text" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleSend()} placeholder="Soru sor..." className="flex-1 rounded-xl border p-3 outline-none focus:ring-2 focus:ring-indigo-500" /><button onClick={() => handleSend()} className="rounded-xl bg-indigo-600 p-3 text-white"><MessageCircle /></button></div></div></div>;
}

const SPOTIFY_PLAYLISTS = [{ id: "09COUWWynrmjTzuK7Zl3dq", title: "German Learning Playlist 1" }, { id: "7A6hKqEgTODNZjXD5jTaJ1", title: "German Learning Playlist 2" }];
function StrategySection() {
  const [playlistIndex, setPlaylistIndex] = useState(0);
  const currentPlaylist = SPOTIFY_PLAYLISTS[playlistIndex];
  return <div className="space-y-8"><div className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-r from-green-900 to-slate-900 p-6 text-center text-white shadow-2xl md:p-8"><div className="absolute right-4 top-4 z-10 flex gap-2"><button onClick={() => setPlaylistIndex((prev) => (prev + 1) % SPOTIFY_PLAYLISTS.length)} className="flex items-center gap-2 rounded-xl bg-white/10 p-3 text-sm font-bold text-white"><RefreshCw size={18} /> Sıradaki Liste</button></div><div className="mb-4 mt-6 rounded-full bg-[#1DB954]/20 p-4"><Headphones size={48} className="text-[#1DB954]" /></div><h3 className="mb-2 text-2xl font-bold">Günün Spotify Önerisi</h3><p className="mb-6 text-sm font-medium uppercase tracking-wide text-green-200">Almanca Dinleme Pratiği</p><div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/5 bg-black/40 shadow-inner"><iframe title={currentPlaylist.title} src={`https://open.spotify.com/embed/playlist/${currentPlaylist.id}?utm_source=generator&theme=0`} width="100%" height="352" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" className="bg-transparent" /></div></div><div className="grid grid-cols-1 gap-6 md:grid-cols-2"><div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><h3 className="mb-2 flex items-center gap-2 font-bold text-gray-800"><RotateCcw className="text-[#1DB954]" /> Nasıl Çalışmalısın?</h3><p className="text-sm text-gray-600">Podcast'i ilk seferde sadece dinle ve genel konuyu anlamaya çalış.</p></div><div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><h3 className="mb-2 flex items-center gap-2 font-bold text-gray-800"><FileText className="text-orange-500" /> Sınav Taktikleri</h3><p className="text-sm text-gray-600">Hören bölümlerinde anahtar kelimelere ve bağlama odaklan.</p></div></div></div>;
}

function MissingSetup({ aiSettings, onOpenSettings }) {
  return <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center p-6"><div className="w-full rounded-3xl border border-amber-200 bg-white p-8 shadow-xl"><div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><AlertCircle size={32} /></div><h1 className="mb-3 text-3xl font-black text-slate-900">Kurulum Eksik</h1><p className="mb-6 text-slate-600">Uygulama localStorage ile çalışıyor. Gemini anahtarını burada eklemen gerekiyor.</p><div className="space-y-3 rounded-2xl bg-slate-50 p-5 text-sm text-slate-700"><p className="text-green-600">Veri kaydı: localStorage hazır.</p><p className={!aiSettings.geminiApiKey ? "font-bold text-red-600" : "text-green-600"}>{!aiSettings.geminiApiKey ? "Gemini API key eksik." : "Gemini API key hazır."}</p><p>Birincil model Gemini 3.1 Flash Lite Preview'dur; yoğunlukta otomatik olarak hızlı yedek modele geçilir.</p></div><div className="mt-6 flex gap-3"><button onClick={onOpenSettings} className="rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white">AI Ayarlarını Aç</button></div></div></div>;
}

export default function TELCMasterApp() {
  const [level, setLevel] = useState("B1");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(false);
  const [autoCoachPrompt, setAutoCoachPrompt] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState(loadAiSettings);

  useEffect(() => { storageObj.set(AI_STORAGE_KEY, JSON.stringify(normalizeAiSettings(aiSettings))); }, [aiSettings]);
  useEffect(() => {
    const syncAiSettings = () => setAiSettings(loadAiSettings());
    window.addEventListener("storage", syncAiSettings);
    window.addEventListener("focus", syncAiSettings);
    return () => {
      window.removeEventListener("storage", syncAiSettings);
      window.removeEventListener("focus", syncAiSettings);
    };
  }, []);
  useEffect(() => {
    const savedUser = storageObj.get(LOCAL_USER_KEY);
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      return undefined;
    }
    const localUser = { uid: createLocalId(), isLocal: true };
    storageObj.set(LOCAL_USER_KEY, JSON.stringify(localUser));
    setUser(localUser);
    return undefined;
  }, []);

  const toggleSidebar = () => { if (window.innerWidth >= 768) setDesktopSidebarOpen((prev) => !prev); else setSidebarOpen((prev) => !prev); };
  const closeSidebar = () => setSidebarOpen(false);
  const handleExecutePlan = (task) => { const lowerTitle = task.title.toLowerCase(); const lowerDesc = task.description.toLowerCase(); if (lowerTitle.includes("kelime") || lowerDesc.includes("kelime")) setActiveTab("vocab"); else if (lowerTitle.includes("sinav") || lowerTitle.includes("sınav") || lowerTitle.includes("yazma") || lowerTitle.includes("schreiben")) setActiveTab("exam"); else { setActiveTab("tutor"); setAutoCoachPrompt(`Günlük çalışma planımda şu görev var: "${task.title}". Açıklaması: "${task.description}". Bana bu konuyu anlatıp çalıştırabilir misin?`); } };

  const renderContent = () => {
    if (!aiSettings.geminiApiKey) return <MissingSetup aiSettings={aiSettings} onOpenSettings={() => setSettingsOpen(true)} />;
    if (!user) return <div className="flex h-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-indigo-600" /></div>;
    if (activeTab === "dashboard") return <Dashboard level={level} onExecutePlan={handleExecutePlan} user={user} aiSettings={aiSettings} />;
    if (activeTab === "vocab") return <VocabTrainer level={level} user={user} aiSettings={aiSettings} />;
    if (activeTab === "exam") return <ExamSimulator level={level} aiSettings={aiSettings} user={user} />;
    if (activeTab === "tutor") return <AICoach level={level} initialPrompt={autoCoachPrompt} onClearPrompt={() => setAutoCoachPrompt(null)} aiSettings={aiSettings} />;
    return <StrategySection />;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 md:flex">
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} aiSettings={aiSettings} setAiSettings={setAiSettings} />
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isOpen={sidebarOpen} closeSidebar={closeSidebar} isDesktopOpen={desktopSidebarOpen} />
      <div className={`w-full flex-1 transition-all duration-300 ${desktopSidebarOpen ? "md:ml-64" : "md:ml-20"}`}>
        <Header level={level} setLevel={setLevel} toggleSidebar={toggleSidebar} onOpenSettings={() => setSettingsOpen(true)} />
        <main className="mx-auto max-w-7xl p-4 md:p-10">{renderContent()}</main>
      </div>
    </div>
  );
}


