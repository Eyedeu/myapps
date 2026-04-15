import type { AppSettings } from '../types'
import { geminiJsonWithFallback } from './gemini'
import { openaiJsonResponse } from './openai'

export async function llmJsonResponse(args: {
  settings: AppSettings
  system: string
  userText: string
  images?: string[]
  timeoutMs?: number
}): Promise<string> {
  const { settings, system, userText, images = [], timeoutMs } = args

  if (settings.aiProvider === 'gemini') {
    return geminiJsonWithFallback({
      apiKey: settings.apiKey,
      system,
      userText,
      images,
      timeoutMs,
    })
  }

  return openaiJsonResponse({ settings, system, userText, images, timeoutMs })
}
