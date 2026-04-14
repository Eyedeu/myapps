export type Locale = 'en' | 'tr' | 'de'

export type Screen = 'home' | 'solo' | 'online' | 'local'

export type AiProvider = 'openai' | 'gemini'

export interface AppSettings {
  /** OpenAI-compatible chat/completions vs Google Gemini generateContent */
  aiProvider: AiProvider
  apiKey: string
  apiBase: string
  model: string
  firebaseJson: string
}

export interface SoloAiResult {
  score: number
  feedback: string
  completed: boolean
}

export interface PlayerJudge {
  score: number
  feedback: string
}

export interface BattleJudgeResult {
  winnerId: string | 'tie'
  summary: string
  byPlayer: Record<string, PlayerJudge>
  /** Best-first player ids */
  ranking: string[]
}

export interface QuestSpec {
  text: string
  /** true → photo-only submission; false → text-only (reasoning / puzzle), no photo. */
  preferPhoto: boolean
}
