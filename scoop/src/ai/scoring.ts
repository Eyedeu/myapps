import type { AppSettings, BattleJudgeResult, Locale, QuestSpec, SoloAiResult } from '../types'
import { llmJsonResponse, type LlmInterleavedPart } from './llm'

const langName: Record<Locale, string> = {
  en: 'English',
  tr: 'Turkish',
  de: 'German',
}

/** English instructions to the model; quest text itself must be in `locale`. Photo tasks: no typing/caption in the quest. */
const PHOTO_AXES = [
  'COLOR SCAVENGER: one specific color; photograph one clear example in the room. Not a book.',
  'TWO-COLOR: two objects of different named colors in one frame. No books.',
  'SHAPES: one round and one angular everyday object in one photo. Not books.',
  'HEIGHT LINE: 3 non-book objects shortest to tallest; side-view photo.',
  'TEXTURE CONTRAST: matte vs glossy surfaces visible in one photo (no captions in instructions).',
  'WINDOW MIX: a bit of outdoor view plus one indoor object in the same frame.',
  'REFLECTION: a reflection in glass, screen, or metal.',
  'SMALL GRID: 3–5 small items in a simple pattern; top-down photo.',
  'ODD ONE OUT PHOTO: four small objects in frame where one clearly differs by type.',
  'BAG OR SHOE: one bag or pair of shoes clearly in frame.',
  'PLANT OR SNACK: a plant, fruit, or packaged food clearly in frame.',
  'SHADOW: a clear shadow shape in the photo.',
  'FABRIC PATTERN: stripes, dots, or checks on cloth in frame.',
  'PAIR: two clearly matching items (e.g. two mugs) in one photo.',
  'COUNT AREA: photograph a tight frame where counting one simple thing is obvious (e.g. legs of one chair).',
  'TRIANGLE LAYOUT: three objects in a triangle; top-down photo.',
] as const

/** Text-only micro-puzzles; preferPhoto must be false. */
const TEXT_AXES = [
  'LOGIC_CHAIN: All X are Y, all Y are Z — ask if every X must be Z; answer yes/no + one short reason.',
  'ODD_CATEGORY: four nouns where three share a category; user names the odd one and why (one phrase).',
  'MENTAL_MATH: two-step arithmetic with small integers; single numeric answer.',
  'NUMBER_SEQUENCE: four numbers with a simple pattern; user types the next number only.',
  'LINEUP_CLUES: three people and three distinct items/places; 2–3 clues give a unique match; one clear short answer (e.g. who has what).',
  'NET_STEPS: forward/back steps word problem; one integer answer.',
  'ORDER_LEFT_RIGHT: three labeled things and clues about left/right order; answer as a short ordered list.',
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

function pickPhotoAxis(): string {
  const i = Math.floor(Math.random() * PHOTO_AXES.length)
  return PHOTO_AXES[i]!
}

function pickTextAxis(): string {
  const i = Math.floor(Math.random() * TEXT_AXES.length)
  return TEXT_AXES[i]!
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
  const avoid = (options?.avoidTexts ?? [])
    .filter((s) => s.trim().length > 0)
    .slice(0, 6)
  const avoidBlock =
    avoid.length > 0
      ? `\nRecent quests to DIFFER from (new idea — do not paraphrase):\n${avoid.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      : ''

  const useTextQuest = Math.random() < 0.4

  if (useTextQuest) {
    const axis = pickTextAxis()
    const system = `You write TEXT-ONLY micro-puzzles (no photo). The user will type an answer; they cannot upload an image for this task.
Rules:
- Self-contained in one sentence when possible (max ~260 characters in target language). Clear, fair, one main correct answer or a small set of acceptable answers.
- preferPhoto MUST be false always.
- Types: tiny logic, categories, mental math, numeric pattern, ordering from clues, net steps — use TEXT_AXIS as structure.
- Forbidden: personal memories, feelings, "look around the room" without a photo task, medical claims, insults, illegal acts.
- Do not ask the user to photograph anything.
Reply JSON only. Keys: quest (string), preferPhoto (must be false).`
    const userText = `Create ONE text-only puzzle doable in under 5 minutes. Language: ${langName[locale]}.

TEXT_AXIS (translate fully into ${langName[locale]}):
${axis}${avoidBlock}`
    const raw = await llmJsonResponse({ settings, system, userText })
    const parsed = JSON.parse(raw) as { quest?: string; preferPhoto?: boolean }
    const text = typeof parsed.quest === 'string' ? parsed.quest.trim() : ''
    if (!text) throw new Error('Invalid quest JSON')
    return { text, preferPhoto: false }
  }

  const axis = pickPhotoAxis()
  const colorHint = pickScavengerColor()
  const system = `You write PHOTO-ONLY micro-quests. The user submits ONE image only — no text answer field. The quest must not say "write", "type", "label in text", or ask for transcription; everything must be judgeable from the photo alone.
Rules:
- preferPhoto MUST be true always.
- Observable, checkable from image: colors, shapes, arrangements, readable labels in the photo, reflections, textures, counts visible in frame.
- Forbidden: memories, emotions as deliverable, private acts, medical claims, danger, illegal acts, humiliation.
- ANTI-CLICHÉ: No books/book spines as main subject. No asking to copy quest into a text box.
- Follow PHOTO_AXIS; one sentence, under ~260 characters in target language.
Reply JSON only. Keys: quest (string), preferPhoto (must be true).`
  const userText = `Create ONE photo-only quest doable in about 5 minutes indoors. Language: ${langName[locale]}.

PHOTO_AXIS (translate fully into ${langName[locale]}):
${axis}
If the axis is a color scavenger, prefer this color unless impossible: ${colorHint}.${avoidBlock}`
  const raw = await llmJsonResponse({ settings, system, userText })
  const parsed = JSON.parse(raw) as { quest?: string; preferPhoto?: boolean }
  const text = typeof parsed.quest === 'string' ? parsed.quest.trim() : ''
  if (!text) throw new Error('Invalid quest JSON')
  return { text, preferPhoto: true }
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
      : '\nTimed round: user skipped the timer (went straight to answer). Do not reward or penalize for speed.'

  const photoMode = quest.preferPhoto
  const modeBlock = photoMode
    ? '\nSubmission mode: PHOTO ONLY. Judge strictly from the image. Ignore user text entirely (there is no text answer for this task). If the image is missing or does not show the quest, score very low. Do not treat pasted quest wording as proof.'
    : '\nSubmission mode: TEXT ONLY. Judge only the written answer for logic/math/pattern correctness. Do not use or ask for photos. If the answer is empty, score very low.'

  const system = `You are a fair judge for a micro-quest.${modeBlock}

PRIMARY: For photo tasks, objective visual evidence. For text tasks, correctness and reasoning quality of what they typed.

TIME (only when timed-round data is provided below): With strong proof, finishing faster than the limit may add a SMALL bonus (at most ~1 point on 1–10)—never let speed outweigh missing or weak evidence. If the user skipped the timer, ignore time.

Be kind and concise. Language for feedback: ${langName[locale]}. Reply JSON only: score (integer 1-10), feedback (2-4 sentences; mention timing only when timed data exists and relevant), completed (boolean).`

  const userText = `Quest: ${quest.text}\nTask type: ${photoMode ? 'photo-only' : 'text-only'}${timingBlock}\nUser text answer:\n${answer || '(none)'}\n(Image: ${photoMode ? (imageDataUrl ? 'provided' : 'missing') : 'not used for this task'})`
  const images = photoMode && imageDataUrl ? [imageDataUrl] : []
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
  players: { id: string; name: string; text: string; imageDataUrl: string | null; elapsedSec?: number }[]
}): Promise<BattleJudgeResult> {
  const { settings, locale, quest, players } = args
  const photoMode = quest.preferPhoto
  const ordered = [...players].sort((a, b) => a.id.localeCompare(b.id))
  const idList = ordered.map((p) => p.id).join(', ')
  const modeRules = photoMode
    ? 'This is a PHOTO task: judge mainly from each player photo; ignore empty or irrelevant text. Missing photo = weak submission.'
    : 'This is a TEXT task: judge mainly from written answers; ignore photos if any. Empty text = weak submission.'

  const photoBinding =
    photoMode && ordered.length > 0
      ? ` MULTI-PLAYER PHOTOS: After the preamble you will see repeated blocks. Each block starts with a line "### PLAYER_ID=..." — the very next image part belongs ONLY to that exact id. Never attribute one player's image to another player or to displayName. If you cannot tell which image belongs to whom, answer winnerId "tie" and explain briefly. JSON keys byPlayer / winnerId must use these exact ids only: ${idList}.`
      : ''

  const system = `Judge this micro-quest quickly and fairly. ${modeRules}${photoBinding}
Priority: correctness first, speed only tie-breaker for similar quality.
Output JSON only with:
winnerId ("tie" or player id), summary (max 2 short sentences), ranking (all ids), byPlayer {score 1-10, feedback short}.
Language: ${langName[locale]}.`

  const lines = ordered.map(
    (p, i) =>
      `${i + 1}. id=${p.id} name=${p.name}\n text: ${p.text || '(none)'}\n   photo: ${p.imageDataUrl ? 'yes' : 'no'}\n   elapsedSec: ${typeof p.elapsedSec === 'number' ? p.elapsedSec : 'unknown'}`,
  )
  const preamble = `Quest: ${quest.text}\nTask type: ${photoMode ? 'photo-only' : 'text-only'}\n${modeRules}\n`
  const userText = photoMode
    ? `${preamble}Player ids for JSON (verbatim): ${idList}\n\nPlayers (metadata):\n${lines.join(
        '\n',
      )}\n\nBelow, each section is HEADER text then that player's image only (or a [NO_IMAGE...] line). Judge each section independently; do not swap submissions.`
    : `${preamble}Players:\n${lines.join('\n')}`

  const interleaved: LlmInterleavedPart[] | undefined = photoMode
    ? ordered.flatMap((p) => {
        const header = `\n### PLAYER_ID=${p.id}\nDISPLAY_NAME=${p.name}\nTEXT_FIELD=${p.text || '(none)'}\nElapsedSec=${typeof p.elapsedSec === 'number' ? p.elapsedSec : 'unknown'}\nThe inline image immediately after this header belongs ONLY to PLAYER_ID=${p.id}.\n`
        if (p.imageDataUrl) {
          return [{ type: 'text' as const, text: header }, { type: 'image' as const, dataUrl: p.imageDataUrl }]
        }
        return [
          { type: 'text' as const, text: header },
          { type: 'text' as const, text: `[NO_IMAGE_SUBMITTED_FOR_PLAYER_ID=${p.id}]\n` },
        ]
      })
    : undefined

  const images = photoMode ? [] : []
  const fallback = quickBattleFallback({ locale, quest, players: ordered })
  let parsed: {
    winnerId?: string
    summary?: string
    ranking?: string[]
    byPlayer?: Record<string, { score?: number; feedback?: string }>
  }
  try {
    const raw = await llmJsonResponse({
      settings,
      system,
      userText,
      images,
      interleaved,
      timeoutMs: 30000,
      retryOnTransient: true,
    })
    parsed = JSON.parse(raw) as {
      winnerId?: string
      summary?: string
      ranking?: string[]
      byPlayer?: Record<string, { score?: number; feedback?: string }>
    }
  } catch {
    return fallback
  }

  let winnerId: string | 'tie' = 'tie'
  if (parsed.winnerId === 'tie') winnerId = 'tie'
  else if (
    typeof parsed.winnerId === 'string' &&
    ordered.some((p) => p.id === parsed.winnerId)
  ) {
    winnerId = parsed.winnerId
  }

  const summary = typeof parsed.summary === 'string' ? parsed.summary : fallback.summary
  const ranking = Array.isArray(parsed.ranking)
    ? parsed.ranking.filter((id) => ordered.some((p) => p.id === id))
    : fallback.ranking

  const byPlayer: BattleJudgeResult['byPlayer'] = {}
  for (const p of ordered) {
    const row = parsed.byPlayer?.[p.id]
    const fallbackRow = fallback.byPlayer[p.id]
    byPlayer[p.id] = {
      score: Math.min(10, Math.max(1, Number(row?.score) || fallbackRow.score)),
      feedback: typeof row?.feedback === 'string' ? row.feedback : fallbackRow.feedback,
    }
  }

  return {
    winnerId: winnerId === 'tie' ? fallback.winnerId : winnerId,
    summary,
    ranking,
    byPlayer,
  }
}

export async function localizeQuestText(args: {
  settings: AppSettings
  sourceLocale: Locale
  quest: QuestSpec
  targetLocales: Locale[]
}): Promise<Partial<Record<Locale, string>>> {
  const { settings, sourceLocale, quest, targetLocales } = args
  const unique = Array.from(new Set(targetLocales))
  const base: Partial<Record<Locale, string>> = { [sourceLocale]: quest.text }
  if (unique.every((l) => l === sourceLocale)) return base

  const system = `You translate one micro-quest into requested locales while preserving intent exactly.
Rules:
- Keep preferPhoto intent unchanged; do not add extra instructions.
- Keep tone concise and natural.
- Return JSON only: { "byLocale": { "en": "...", "tr": "...", "de": "..." } }`
  const userText = `Source locale: ${sourceLocale}
Source quest: ${quest.text}
Requested locales: ${unique.join(', ')}`
  try {
    const raw = await llmJsonResponse({
      settings,
      system,
      userText,
      timeoutMs: 5000,
    })
    const parsed = JSON.parse(raw) as { byLocale?: Partial<Record<Locale, string>> }
    const byLocale = parsed.byLocale ?? {}
    const out: Partial<Record<Locale, string>> = { ...base }
    for (const l of unique) {
      const v = byLocale[l]
      if (typeof v === 'string' && v.trim()) out[l] = v.trim()
    }
    return out
  } catch {
    return base
  }
}

export async function localizeBattleJudge(args: {
  settings: AppSettings
  judge: BattleJudgeResult
  playerLocales: Record<string, Locale>
}): Promise<BattleJudgeResult> {
  const { settings, judge, playerLocales } = args
  const locales = Array.from(new Set(Object.values(playerLocales)))
  if (locales.length === 0) return judge
  const system = `You localize battle results into multiple languages.
Return JSON only:
{
  "summaryByLocale": { "en": "...", "tr": "...", "de": "..." },
  "feedbackByPlayerLocale": {
    "playerId": { "en": "...", "tr": "...", "de": "..." }
  }
}
Preserve meaning and keep feedback concise.`
  const userText = `Target locales: ${locales.join(', ')}
Summary: ${judge.summary}
Per player feedback:
${Object.entries(judge.byPlayer)
  .map(([id, row]) => `${id}: ${row.feedback}`)
  .join('\n')}`
  try {
    const raw = await llmJsonResponse({
      settings,
      system,
      userText,
      timeoutMs: 4500,
    })
    const parsed = JSON.parse(raw) as {
      summaryByLocale?: Partial<Record<Locale, string>>
      feedbackByPlayerLocale?: Record<string, Partial<Record<Locale, string>>>
    }
    return {
      ...judge,
      summaryByLocale: parsed.summaryByLocale ?? judge.summaryByLocale,
      feedbackByPlayerLocale:
        parsed.feedbackByPlayerLocale ?? judge.feedbackByPlayerLocale,
    }
  } catch {
    return judge
  }
}

function quickBattleFallback(args: {
  locale: Locale
  quest: QuestSpec
  players: { id: string; name: string; text: string; imageDataUrl: string | null; elapsedSec?: number }[]
}): BattleJudgeResult {
  const { locale, quest, players } = args
  const allStrings = {
    en: {
      summary: 'Quick auto-result was used because AI analysis timed out. Correctness is prioritized, speed is used as tie-break.',
      photoGood: 'Photo submitted on time.',
      photoMissing: 'No valid photo was submitted before timeout.',
      textGood: 'Answer submitted on time.',
      textMissing: 'No valid text answer was submitted before timeout.',
    },
    tr: {
      summary: 'Yapay zeka analizi zaman asimina ugradigi icin hizli otomatik sonuc kullanildi. Oncelik dogrulukta, hiz esitlik bozucu olarak kullanildi.',
      photoGood: 'Fotograf zamaninda gonderildi.',
      photoMissing: 'Sure bitmeden gecerli fotograf gonderilmedi.',
      textGood: 'Cevap zamaninda gonderildi.',
      textMissing: 'Sure bitmeden gecerli metin cevabi gonderilmedi.',
    },
    de: {
      summary: 'Die KI-Analyse hat das Zeitlimit ueberschritten; daher wurde ein schnelles Auto-Ergebnis genutzt. Korrektheit hat Vorrang, Tempo dient als Tie-Breaker.',
      photoGood: 'Foto wurde rechtzeitig eingereicht.',
      photoMissing: 'Kein gueltiges Foto vor Ablauf eingereicht.',
      textGood: 'Antwort wurde rechtzeitig eingereicht.',
      textMissing: 'Keine gueltige Textantwort vor Ablauf eingereicht.',
    },
  } as const
  const localized = allStrings[locale]

  function feedbackText(hasContent: boolean, lang: Locale): string {
    const s = allStrings[lang]
    return hasContent
      ? quest.preferPhoto ? s.photoGood : s.textGood
      : quest.preferPhoto ? s.photoMissing : s.textMissing
  }

  const scored = players.map((p) => {
    const hasContent = quest.preferPhoto ? Boolean(p.imageDataUrl) : p.text.trim().length > 0
    const speedBonus =
      typeof p.elapsedSec === 'number' && Number.isFinite(p.elapsedSec)
        ? Math.max(0, Math.min(1.5, (300 - Math.max(0, p.elapsedSec)) / 200))
        : 0
    const base = hasContent ? 6 : 1
    const score = Math.min(10, Math.max(1, Math.round(base + speedBonus)))
    return { id: p.id, score, hasContent }
  })

  const ranking = scored
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((x) => x.id)

  const top = scored.filter((x) => x.score === scored[0]?.score)
  const winnerId: string | 'tie' = top.length === 1 ? top[0]!.id : 'tie'

  const byPlayer: BattleJudgeResult['byPlayer'] = {}
  const feedbackByPlayerLocale: NonNullable<BattleJudgeResult['feedbackByPlayerLocale']> = {}
  for (const s of scored) {
    byPlayer[s.id] = { score: s.score, feedback: feedbackText(s.hasContent, locale) }
    feedbackByPlayerLocale[s.id] = {
      en: feedbackText(s.hasContent, 'en'),
      tr: feedbackText(s.hasContent, 'tr'),
      de: feedbackText(s.hasContent, 'de'),
    }
  }

  return {
    winnerId,
    summary: localized.summary,
    summaryByLocale: {
      en: allStrings.en.summary,
      tr: allStrings.tr.summary,
      de: allStrings.de.summary,
    },
    ranking,
    byPlayer,
    feedbackByPlayerLocale,
  }
}
