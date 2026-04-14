import type { AppSettings, BattleJudgeResult, Locale, QuestSpec, SoloAiResult } from '../types'
import { llmJsonResponse } from './llm'

const langName: Record<Locale, string> = {
  en: 'English',
  tr: 'Turkish',
  de: 'German',
}

/** English instructions to the model; quest text itself must be in `locale`. */
const CREATIVE_AXES = [
  'COLOR SCAVENGER: pick one specific color and ask for one clear example photographed in the room. Subject must NOT be a book.',
  'TWO-COLOR HUNT: two objects of different named colors in one frame. No books.',
  'SHAPES: one clearly round object and one clearly angular object in one photo. Everyday items, not books.',
  'HEIGHT LINE: line up 3 non-book everyday objects shortest→tallest; side-view photo.',
  'TEXTURE CONTRAST: matte vs glossy surfaces in one photo; user labels each with one word in text.',
  'WINDOW MIX: one bit of outdoor view plus one indoor object in the same frame.',
  'REFLECTION: photograph a reflection (glass, screen, metal); user names the object briefly.',
  'SMALL GRID: 3–5 similar small items (coins, buttons, pens) in a simple pattern; top-down photo. Not books.',
  'ODD ONE OUT: three similar objects and one different; photo; user names the odd one in text.',
  'BAG OR FOOTWEAR: photograph one bag or pair of shoes; user states color + type.',
  'PLANT OR SNACK: a plant, fruit, or packaged food in frame; one short identifying phrase in text.',
  'SHADOW OR LIGHT: a clear shadow or sun patch; user says what casts it.',
  'FABRIC PATTERN: visible stripes, dots, or checks on cloth; photo.',
  'PAIR: two clearly matching items (socks, gloves, mugs) in one photo.',
  'COUNT + PROOF: ask for a small countable visible feature (e.g. chair legs in frame) — number in text plus a photo showing the counted area.',
  'DIAGONAL OR TRIANGLE: arrange 3 objects in a triangle layout; top-down photo; name them in order.',
] as const

const SCAVENGER_COLORS = [
  'blue',
  'red',
  'green',
  'yellow',
  'orange',
  'purple',
  'white',
  'black',
  'brown',
  'pink',
] as const

export type GenerateQuestOptions = {
  /** Recent AI quest lines — model must not repeat the same idea or object family. */
  avoidTexts?: string[]
}

function pickCreativeAxis(): string {
  const i = Math.floor(Math.random() * CREATIVE_AXES.length)
  return CREATIVE_AXES[i]!
}

function pickScavengerColor(): string {
  const i = Math.floor(Math.random() * SCAVENGER_COLORS.length)
  return SCAVENGER_COLORS[i]!
}

export async function generateAiQuest(
  settings: AppSettings,
  locale: Locale,
  options?: GenerateQuestOptions,
): Promise<QuestSpec> {
  const axis = pickCreativeAxis()
  const colorHint = pickScavengerColor()
  const avoid = (options?.avoidTexts ?? [])
    .filter((s) => s.trim().length > 0)
    .slice(0, 6)
  const avoidBlock =
    avoid.length > 0
      ? `\nRecent quests to DIFFER from (new object family, new verb, new layout — do not paraphrase these):\n${avoid.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      : ''

  const system = `You write micro-quests that a judge can SCORE from the user's short text and/or one photo.
Rules:
- Ask only for observable, checkable things: counts, colors, shapes, arrangements, visible text, scavenger hunts, reflections, textures, light/shadow.
- preferPhoto must be true unless the answer is clearly verifiable from a short factual list the user types (e.g. list 3 visible brand names).
- Forbidden: memories, nostalgia, dreams, emotions or opinions as the main deliverable, meditation/breathing-only, private acts you cannot see (messages sent, water drunk), therapy-like prompts, medical claims, danger, illegal acts, humiliation.
- ANTI-CLICHÉ: Do NOT center the quest on books, book spines, bookshelves, magazines, encyclopedias, "largest/smallest books", stacking or lining up books, or reading. If you mention printed text, use a label, package, or screen — not a book as the main subject.
- CREATIVE MANDATE: Follow the CREATIVE_AXIS exactly for this request. Make it feel like a fresh mini-game, not "arrange three things again" unless the axis explicitly asks a new twist.
- One sentence, under ~230 characters in the target language.
Reply JSON only, no markdown. Keys: quest (string), preferPhoto (boolean).`
  const userText = `Create ONE micro-quest doable in about 5 minutes indoors. Language: ${langName[locale]}. The grader only sees text + optional photo—pass/fail must be obvious from evidence.

CREATIVE_AXIS (follow this structure and intent; translate fully into ${langName[locale]}):
${axis}
If the axis involves a color scavenger, prefer this color unless impossible: ${colorHint}.${avoidBlock}`
  const raw = await llmJsonResponse({ settings, system, userText })
  const parsed = JSON.parse(raw) as { quest?: string; preferPhoto?: boolean }
  const text = typeof parsed.quest === 'string' ? parsed.quest.trim() : ''
  if (!text) throw new Error('Invalid quest JSON')
  const preferPhoto = Boolean(parsed.preferPhoto)
  return { text, preferPhoto }
}

function formatMmSs(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export type SoloJudgeTiming = {
  /** Total time allowed for the round (seconds). */
  limitSec: number
  /** Seconds from start until the user tapped "done" or the timer ran out. */
  elapsedSec: number
}

export async function judgeSolo(args: {
  settings: AppSettings
  locale: Locale
  quest: QuestSpec
  answer: string
  imageDataUrl: string | null
  /** Set when the user used the timed round; omit if they skipped the timer from the first screen. */
  timing?: SoloJudgeTiming
}): Promise<SoloAiResult> {
  const { settings, locale, quest, answer, imageDataUrl, timing } = args
  const timingBlock =
    timing && timing.limitSec > 0
      ? `\nTimed round: limit ${timing.limitSec}s (${formatMmSs(timing.limitSec)}), elapsed ${timing.elapsedSec}s (${formatMmSs(timing.elapsedSec)}), about ${Math.round((timing.elapsedSec / timing.limitSec) * 100)}% of limit used.`
      : '\nTimed round: user skipped the timer (went straight to answer). Judge only photo/text; do not reward or penalize for speed.'

  const system = `You are a fair judge for a micro-quest. PRIMARY: score from objective evidence—does the photo/text plausibly satisfy the quest (counts, colors, arrangement, visible text, etc.)? If a photo was clearly expected and missing or useless, score low. Do not reward pure vibes.

TIME (only when timed-round data is provided): Finishing clearly faster than the limit with strong proof may add a SMALL bonus (at most ~1 point on the 1–10 scale) on top of quality—never let speed alone outweigh weak evidence. Using most of the limit with excellent proof is perfectly fine. Suspiciously fast + thin proof should not get a time bonus. If timed-round data says the user skipped the timer, ignore time completely.

Be kind and concise. Language for feedback: ${langName[locale]}. Reply JSON only: score (integer 1-10), feedback (string, 2-4 sentences; briefly mention timing only when timed data exists and it mattered), completed (boolean: evidence matches the quest well enough). If text is empty and no image, score low.`
  const userText = `Quest: ${quest.text}\nPrefer photo: ${quest.preferPhoto}${timingBlock}\nUser text:\n${answer || '(none)'}\n(Photo attached if provided.)`
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
  const system = `You judge a friendly micro-quest competition. Prefer objective evidence in photos/text (what the quest asked: layout, colors, counts, visible details). Tie or low scores if evidence is missing or subjective only. Be fair and encouraging. Language: ${langName[locale]}. Reply JSON only with:
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
