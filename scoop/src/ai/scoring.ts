import type { AppSettings, BattleJudgeResult, Locale, QuestSpec, SoloAiResult } from '../types'
import { llmJsonResponse } from './llm'

const langName: Record<Locale, string> = {
  en: 'English',
  tr: 'Turkish',
  de: 'German',
}

export async function generateAiQuest(
  settings: AppSettings,
  locale: Locale,
): Promise<QuestSpec> {
  const system =
    'You write short, safe micro-quests. Reply with JSON only, no markdown. Keys: quest (string), preferPhoto (boolean). preferPhoto true only when a photo proof is clearly useful.'
  const userText = `Create ONE micro-quest doable in about 3 minutes indoors or in everyday life. No danger, no medical claims, no illegal acts, no humiliation. Language: ${langName[locale]}.`
  const raw = await llmJsonResponse({ settings, system, userText })
  const parsed = JSON.parse(raw) as { quest?: string; preferPhoto?: boolean }
  const text = typeof parsed.quest === 'string' ? parsed.quest.trim() : ''
  if (!text) throw new Error('Invalid quest JSON')
  return { text, preferPhoto: Boolean(parsed.preferPhoto) }
}

export async function judgeSolo(args: {
  settings: AppSettings
  locale: Locale
  quest: QuestSpec
  answer: string
  imageDataUrl: string | null
}): Promise<SoloAiResult> {
  const { settings, locale, quest, answer, imageDataUrl } = args
  const system = `You are a fair, kind judge for a playful micro-quest. Be concise. Language for feedback: ${langName[locale]}. Reply JSON only with keys: score (integer 1-10), feedback (string,2-4 sentences), completed (boolean: did they plausibly complete the spirit of the quest?). If text is empty and no image, score low.`
  const userText = `Quest: ${quest.text}\nPrefer photo: ${quest.preferPhoto}\nUser text:\n${answer || '(none)'}\n(Photo attached if provided.)`
  const images = imageDataUrl ? [imageDataUrl] : []
  const raw = await llmJsonResponse({ settings, system, userText, images })
  const parsed = JSON.parse(raw) as Partial<SoloAiResult>
  const score = Math.min(10, Math.max(1, Number(parsed.score) || 1))
  const feedback = typeof parsed.feedback === 'string' ? parsed.feedback : ''
  const completed = Boolean(parsed.completed)
  return { score, feedback, completed }
}

export async function judgeBattle(args: {
  settings: AppSettings
  locale: Locale
  quest: QuestSpec
  players: { id: string; name: string; text: string; imageDataUrl: string | null }[]
}): Promise<BattleJudgeResult> {
  const { settings, locale, quest, players } = args
  const system = `You judge a friendly real-life micro-quest competition. Be fair and encouraging. Language: ${langName[locale]}. Reply JSON only with:
winnerId: string player id or "tie"
summary: string (2-3 sentences overall)
ranking: array of player ids from best to worst (all players included)
byPlayer: object mapping playerId -> { score: number 1-10, feedback: string short }
If evidence is weak for everyone, you may use tie. Never insult; critique gently.`

  const lines = players.map(
    (p, i) =>
      `${i + 1}. id=${p.id} name=${p.name}\n text: ${p.text || '(none)'}\n   photo: ${p.imageDataUrl ? 'yes' : 'no'}`,
  )
  const userText = `Quest: ${quest.text}\nPrefer photo: ${quest.preferPhoto}\nPlayers:\n${lines.join('\n')}`

  const images = players.map((p) => p.imageDataUrl).filter(Boolean) as string[]
  const raw = await llmJsonResponse({ settings, system, userText, images })
  const parsed = JSON.parse(raw) as {
    winnerId?: string
    summary?: string
    ranking?: string[]
    byPlayer?: Record<string, { score?: number; feedback?: string }>
  }

  let winnerId: string | 'tie' = 'tie'
  if (parsed.winnerId === 'tie') winnerId = 'tie'
  else if (
    typeof parsed.winnerId === 'string' &&
    players.some((p) => p.id === parsed.winnerId)
  ) {
    winnerId = parsed.winnerId
  }

  const summary = typeof parsed.summary === 'string' ? parsed.summary : ''
  const ranking = Array.isArray(parsed.ranking)
    ? parsed.ranking.filter((id) => players.some((p) => p.id === id))
    : players.map((p) => p.id)

  const byPlayer: BattleJudgeResult['byPlayer'] = {}
  for (const p of players) {
    const row = parsed.byPlayer?.[p.id]
    byPlayer[p.id] = {
      score: Math.min(10, Math.max(1, Number(row?.score) || 1)),
      feedback: typeof row?.feedback === 'string' ? row.feedback : '',
    }
  }

  return {
    winnerId: winnerId === 'tie' ? 'tie' : winnerId,
    summary,
    ranking,
    byPlayer,
  }
}
