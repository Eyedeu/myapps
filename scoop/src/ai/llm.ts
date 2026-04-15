import type { AppSettings } from '../types'
import { geminiJsonWithFallback } from './gemini'
import { openaiJsonResponse } from './openai'

export async function llmJsonResponse(args: {
  settings: AppSettings
  system: string
  userText: string
  images?: string[]
  timeoutMs?: number
  retryOnTransient?: boolean
}): Promise<string> {
  const {
    settings,
    system,
    userText,
    images = [],
    timeoutMs = 30000,
    retryOnTransient = true,
  } = args

  const call = async (ms: number) => {
    if (settings.aiProvider === 'gemini') {
      return geminiJsonWithFallback({
        apiKey: settings.apiKey,
        system,
        userText,
        images,
        timeoutMs: ms,
      })
    }

    return openaiJsonResponse({ settings, system, userText, images, timeoutMs: ms })
  }

  try {
    return await call(timeoutMs)
  } catch (firstErr) {
    if (!retryOnTransient) throw firstErr
    const m = firstErr instanceof Error ? firstErr.message.toLowerCase() : String(firstErr).toLowerCase()
    const retriable =
      m.includes('timed out') ||
      m.includes('abort') ||
      m.includes('network') ||
      m.includes('429') ||
      m.includes('quota')
    if (!retriable) throw firstErr
    // One retry with a wider timeout.
    return call(Math.max(timeoutMs + 12000, 42000))
  }
}
