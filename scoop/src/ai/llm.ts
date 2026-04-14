import type { AppSettings } from '../types'
import { geminiJsonWithFallback } from './gemini'
import { openaiJsonResponse } from './openai'

export async function llmJsonResponse(args: {
  settings: AppSettings
  system: string
  userText: string
  images?: string[]
}): Promise<string> {
  const { settings, system, userText, images = [] } = args

  if (settings.aiProvider === 'gemini') {
    return geminiJsonWithFallback({
      apiKey: settings.apiKey,
      system,
      userText,
      images,
    })
  }

  return openaiJsonResponse({ settings, system, userText, images })
}
