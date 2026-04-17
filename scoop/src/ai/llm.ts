import type { AppSettings } from '../types'
import { geminiJsonWithFallback } from './gemini'
import { openaiJsonResponse } from './openai'

/** Text + image segments in send order (e.g. per-player photo blocks). */
export type LlmInterleavedPart =
  | { type: 'text'; text: string }
  | { type: 'image'; dataUrl: string }

export async function llmJsonResponse(args: {
  settings: AppSettings
  system: string
  userText: string
  images?: string[]
  /** When set, appended after `userText` in order (text/image alternation). Overrides trailing flat `images`. */
  interleaved?: LlmInterleavedPart[]
  timeoutMs?: number
  retryOnTransient?: boolean
}): Promise<string> {
  const {
    settings,
    system,
    userText,
    images = [],
    interleaved,
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
        interleaved,
        timeoutMs: ms,
      })
    }

    return openaiJsonResponse({
      settings,
      system,
      userText,
      images,
      interleaved,
      timeoutMs: ms,
    })
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
