import type { AppSettings } from '../types'

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export async function openaiJsonResponse(args: {
  settings: AppSettings
  system: string
  userText: string
  images?: string[]
  timeoutMs?: number
}): Promise<string> {
  const { settings, system, userText, images = [], timeoutMs = 30000 } = args
  if (!settings.apiKey.trim()) {
    throw new Error('Missing API key')
  }
  const base = settings.apiBase.replace(/\/$/, '')
  const content: ContentPart[] = [{ type: 'text', text: userText }]
  for (const url of images) {
    if (url) content.push({ type: 'image_url', image_url: { url } })
  }

  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  let res: Response
  try {
    try {
      res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model,
          temperature: 0.45,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content },
          ],
        }),
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw new Error('AI request timed out')
      }
      throw e
    }
  } finally {
    window.clearTimeout(timer)
  }

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(errText.slice(0, 500))
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content ?? '{}'
}
