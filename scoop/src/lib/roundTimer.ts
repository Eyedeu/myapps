import type { QuestSpec } from '../types'

export const MIN_ROUND_SEC = 180
export const MAX_ROUND_SEC = 300

const EXTRA_COMPLEXITY_RE =
  /why|because|neden|gerekce|gerekçe|warum|explain|acikla|açıkla|list|order|sirala|sırala|reihenfolge|sentence|cumle|cümle/i

/**
 * Estimates a fair online/solo round length from quest complexity.
 * Returns a value between 3 and 5 minutes.
 */
export function getQuestRoundLimitSec(quest: QuestSpec): number {
  if (quest.preferPhoto) return MAX_ROUND_SEC

  let limit = MIN_ROUND_SEC
  const text = quest.text.trim()

  if (text.length > 90) limit += 60
  if (EXTRA_COMPLEXITY_RE.test(text)) limit += 60

  return Math.min(MAX_ROUND_SEC, Math.max(MIN_ROUND_SEC, limit))
}

export function formatRoundTime(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
