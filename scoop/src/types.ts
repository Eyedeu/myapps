export type Locale = 'en' | 'tr' | 'de'

export type Screen = 'home' | 'solo' | 'online' | 'local'

export interface AppSettings {
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
  /** If true, user should upload a photo proof when possible */
  preferPhoto: boolean
}
