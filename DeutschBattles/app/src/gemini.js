export const FAST_PRIMARY_MODEL = "gemini-3.1-flash-lite-preview";
const FAST_FALLBACK_MODELS = [FAST_PRIMARY_MODEL, "gemini-2.5-flash-lite", "gemini-2.5-flash"];

export function readStoredJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function resolveStoredGeminiApiKey(key, fallback = "") {
  const parsed = readStoredJson(key);
  if (typeof parsed?.geminiApiKey === "string" && parsed.geminiApiKey.trim()) return parsed.geminiApiKey.trim();
  if (typeof parsed?.settings?.geminiApiKey === "string" && parsed.settings.geminiApiKey.trim()) {
    return parsed.settings.geminiApiKey.trim();
  }
  return String(fallback || "").trim();
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeGeminiError(message, model) {
  const text = String(message || "");
  const lowered = text.toLowerCase();
  if (lowered.includes("high demand") || lowered.includes("overloaded")) {
    return `${model} şu anda yoğun. Uygulama otomatik olarak yedek modele geçmeyi deniyor.`;
  }
  if (lowered.includes("quota")) return `${model} için kota dolu veya bu anahtarla erişim yok.`;
  if (lowered.includes("api key")) return "Gemini API anahtarı eksik veya geçersiz.";
  if (lowered.includes("not found") || lowered.includes("not supported")) return `${model} modeli şu anda kullanılamıyor.`;
  return text || "Yapay zeka isteği tamamlanamadı.";
}

function isRetryableFailure(status, message) {
  const lowered = String(message || "").toLowerCase();
  return status === 0
    || status === 408
    || status === 429
    || status === 503
    || status >= 500
    || lowered.includes("high demand")
    || lowered.includes("overloaded")
    || lowered.includes("unavailable")
    || lowered.includes("timeout")
    || lowered.includes("network")
    || lowered.includes("fetch")
    || lowered.includes("not found")
    || lowered.includes("not supported");
}

async function tryGeminiCall({ apiKey, model, prompt, mode, timeoutMs }) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: mode === "json" ? "application/json" : "text/plain",
            temperature: mode === "json" ? 0.15 : 0.3,
            topP: 0.8,
            topK: 20,
            maxOutputTokens: mode === "json" ? 2048 : 3072,
            thinkingConfig: { thinkingBudget: 0 }
          }
        }),
        signal: controller.signal
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        model,
        message: data?.error?.message || "Gemini isteği başarısız oldu."
      };
    }
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim() || "";
    if (!text) return { ok: false, status: 204, model, message: "Yapay zeka boş yanıt döndürdü." };
    return { ok: true, model, text };
  } catch (error) {
    if (error.name === "AbortError") return { ok: false, status: 408, model, message: "Request timeout" };
    return { ok: false, status: 0, model, message: error?.message || "Ağ hatası" };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function callGemini({ apiKey, model = FAST_PRIMARY_MODEL, prompt, mode = "text", timeoutMs = 14000, retries = 1 }) {
  if (!apiKey) throw new Error("Gemini API anahtarı gerekli.");
  const candidates = [model, ...FAST_FALLBACK_MODELS].filter((value, index, array) => value && array.indexOf(value) === index);
  let lastFailure = null;

  for (const candidate of candidates) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const result = await tryGeminiCall({ apiKey, model: candidate, prompt, mode, timeoutMs });
      if (result.ok) return { text: result.text, usedModel: result.model, fallbackUsed: result.model !== model };

      lastFailure = result;
      const retryable = isRetryableFailure(result.status, result.message);
      if (retryable && attempt < retries) {
        await wait(800);
        continue;
      }
      if (!retryable) throw new Error(normalizeGeminiError(result.message, candidate));
      break;
    }
  }

  throw new Error(normalizeGeminiError(lastFailure?.message, lastFailure?.model || model));
}
