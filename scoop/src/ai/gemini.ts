/**
 * Model IDs from Google AI Studio / Gemini API (update if Google renames).
 * Scoop is pinned to Flash Lite only.
 */
export const GEMINI_MODEL_PRIMARY = 'gemini-3.1-flash-lite-preview'

const GEMINI_GENERATE_BASE = 'https://generativelanguage.googleapis.com/v1beta'

function splitDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim())
  if (!m) return null
  return { mimeType: m[1] ?? 'image/jpeg', data: m[2] ?? '' }
}

function buildUserParts(userText: string, images: string[]) {
  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [{ text: userText }]

  for (const img of images) {
    if (!img) continue
    const parsed = splitDataUrl(img)
    if (parsed) {
      parts.push({
        inlineData: { mimeType: parsed.mimeType, data: parsed.data },
      })
    }
  }
  return parts
}

async function geminiGenerateContent(args: {
  apiKey: string
  model: string
  system: string
  userText: string
  images: string[]
  timeoutMs: number
}): Promise<string> {
  const { apiKey, model, system, userText, images, timeoutMs } = args
  const url = `${GEMINI_GENERATE_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

  const body = {
    systemInstruction: {
      parts: [{ text: system }],
    },
    contents: [
      {
        role: 'user',
        parts: buildUserParts(userText, images),
      },
    ],
    generationConfig: {
      temperature: 0.45,
      responseMimeType: 'application/json',
    },
  }

  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  let res: Response
  try {
    try {
      res = await fetch(url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw new Error(`${model}: request timed out`)
      }
      throw e
    }
  } finally {
    window.clearTimeout(timer)
  }

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`${model}: ${errText.slice(0, 400)}`)
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
    error?: { message?: string }
  }

  if (data.error?.message) {
    throw new Error(`${model}: ${data.error.message}`)
  }

  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  return text.trim() || '{}'
}

export async function geminiJsonWithFallback(args: {
  apiKey: string
  system: string
  userText: string
  images?: string[]
  timeoutMs?: number
}): Promise<string> {
  const { apiKey, system, userText, images = [], timeoutMs = 30000 } = args
  if (!apiKey.trim()) throw new Error('Missing API key')

  const models = [GEMINI_MODEL_PRIMARY]
  let lastErr: Error | null = null

  for (const model of models) {
    try {
      return await geminiGenerateContent({ apiKey, model, system, userText, images, timeoutMs })
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }

  throw lastErr ?? new Error('Gemini request failed')
}
