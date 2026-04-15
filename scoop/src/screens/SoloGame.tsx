import { useCallback, useEffect, useRef, useState } from 'react'
import { AiQuestLoadingOverlay } from '../components/AiQuestLoadingOverlay'
import { judgeSolo, generateAiQuest } from '../ai/scoring'
import { compressImageToDataUrl } from '../lib/image'
import { formatRoundTime, getQuestRoundLimitSec, MAX_ROUND_SEC } from '../lib/roundTimer'
import { randomStaticQuest } from '../quests/static'
import { useAppI18n } from '../settings/useAppI18n'
import type { QuestSpec, SoloAiResult } from '../types'

type Phase = 'ready' | 'playing' | 'result'
type TimerMode = 'timed' | 'untimed'

export function SoloGame({ onBack }: { onBack: () => void }) {
  const { t, settings, locale } = useAppI18n()
  const [quest, setQuest] = useState<QuestSpec>(() => randomStaticQuest(locale, null))
  const [phase, setPhase] = useState<Phase>('ready')
  const [timerMode, setTimerMode] = useState<TimerMode>('timed')
  const [secondsLeft, setSecondsLeft] = useState(MAX_ROUND_SEC)
  const [text, setText] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [aiQuestLoading, setAiQuestLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<SoloAiResult | null>(null)
  const recentAiQuestsRef = useRef<string[]>([])
  const secondsLeftRef = useRef(MAX_ROUND_SEC)
  const limitSec = getQuestRoundLimitSec(quest)

  useEffect(() => {
    secondsLeftRef.current = secondsLeft
  }, [secondsLeft])

  useEffect(() => {
    if (phase !== 'playing' || timerMode !== 'timed') return
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [phase, timerMode])

  const nextStatic = useCallback(() => {
    const nextQuest = randomStaticQuest(locale, quest)
    setQuest(nextQuest)
    setTimerMode('timed')
    setPhase('playing')
    const nextLimit = getQuestRoundLimitSec(nextQuest)
    setSecondsLeft(nextLimit)
    secondsLeftRef.current = nextLimit
    setText('')
    setImage(null)
    setResult(null)
    setErr(null)
  }, [locale, quest])

  const aiQuest = useCallback(async () => {
    setErr(null)
    if (!settings.apiKey.trim()) {
      setErr(t.needApiKey)
      return
    }
    setAiQuestLoading(true)
    try {
      const q = await generateAiQuest(settings, locale, {
        avoidTexts: recentAiQuestsRef.current,
      })
      recentAiQuestsRef.current = [q.text, ...recentAiQuestsRef.current].slice(0, 8)
      setQuest(q)
      setTimerMode('timed')
      setPhase('playing')
      const nextLimit = getQuestRoundLimitSec(q)
      setSecondsLeft(nextLimit)
      secondsLeftRef.current = nextLimit
      setText('')
      setImage(null)
      setResult(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errorGeneric)
    } finally {
      setAiQuestLoading(false)
    }
  }, [settings, locale, t])

  const startTimer = useCallback(() => {
    setTimerMode('timed')
    const nextLimit = getQuestRoundLimitSec(quest)
    setSecondsLeft(nextLimit)
    secondsLeftRef.current = nextLimit
    setPhase('playing')
  }, [quest])

  const startUntimed = useCallback(() => {
    setTimerMode('untimed')
    setPhase('playing')
  }, [])

  const onPickImage = useCallback(async (file: File | null) => {
    if (!file) return
    try {
      const url = await compressImageToDataUrl(file)
      setImage(url)
    } catch {
      setErr(t.errorGeneric)
    }
  }, [t])

  const submit = useCallback(async () => {
    setErr(null)
    if (!settings.apiKey.trim()) {
      setErr(t.needApiKey)
      return
    }
    if (quest.preferPhoto && !image) {
      setErr(t.submitNeedPhoto)
      return
    }
    if (!quest.preferPhoto && !text.trim()) {
      setErr(t.submitNeedText)
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const elapsedSec = Math.min(
        limitSec,
        Math.max(0, limitSec - secondsLeftRef.current),
      )
      const timing =
        timerMode === 'timed' ? { limitSec, elapsedSec } : undefined

      const r = await judgeSolo({
        settings,
        locale,
        quest,
        answer: quest.preferPhoto ? '' : text,
        imageDataUrl: quest.preferPhoto ? image : null,
        timing,
      })
      setResult(r)
      setPhase('result')
      setText('')
      setImage(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errorGeneric)
    } finally {
      setBusy(false)
    }
  }, [settings, locale, quest, text, image, t, timerMode, limitSec])

  const blockUi = busy || aiQuestLoading

  const questBlock = (
    <>
      <p className="quest-label">{t.questLabel}</p>
      <p className="quest">{quest.text}</p>
      {quest.preferPhoto ? (
        <p className="photo-hint">{t.questPhotoOnly}</p>
      ) : (
        <p className="muted small">{t.questTextOnly}</p>
      )}
    </>
  )

  return (
    <div className="app">
      <AiQuestLoadingOverlay open={aiQuestLoading} message={t.aiQuestLoading} />
      <header className="header">
        <button type="button" className="linkish" onClick={onBack}>
          ← {t.back}
        </button>
        <p className="eyebrow">Solo</p>
        <h1 className="title">{t.soloTitle}</h1>
        <p className="lede">{t.soloIntro}</p>
      </header>

      <main className="card">
        {phase === 'ready' ? (
          <>
            {questBlock}
            <div className="actions">
              <button type="button" className="btn primary" onClick={startTimer} disabled={blockUi}>
                {t.startTimer} ({formatRoundTime(limitSec)})
              </button>
              <button type="button" className="btn ghost" onClick={startUntimed} disabled={blockUi}>
                {t.answerNow}
              </button>
              <button type="button" className="btn ghost" onClick={nextStatic} disabled={blockUi}>
                {t.newQuest}
              </button>
              <button type="button" className="btn ghost" onClick={() => void aiQuest()} disabled={blockUi}>
                {t.aiQuest}
              </button>
            </div>
          </>
        ) : (
          <>
            {questBlock}
            {phase === 'playing' && (
              <>
                {timerMode === 'timed' ? (
                  <div className="timer" aria-label={t.timer}>
                    <span className={secondsLeft <= 60 ? 'warn' : ''}>{formatRoundTime(secondsLeft)}</span>
                  </div>
                ) : (
                  <p className="muted small">{t.noTimerRound}</p>
                )}
                {quest.preferPhoto ? (
                  <label className="field">
                    <span className="field-label">{t.photoProofLabel}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
                    />
                  </label>
                ) : (
                  <label className="field">
                    <span className="field-label">{t.yourAnswer}</span>
                    <textarea
                      className="textarea"
                      rows={4}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      maxLength={2000}
                    />
                  </label>
                )}
                {err && <p className="error">{err}</p>}
                <div className="actions">
                  <button type="button" className="btn primary" onClick={() => void submit()} disabled={blockUi}>
                    {busy ? t.analyzing : t.submitAi}
                  </button>
                  <button type="button" className="btn ghost" onClick={nextStatic} disabled={blockUi}>
                    {t.newQuest}
                  </button>
                </div>
              </>
            )}
            {phase === 'result' && result && (
              <>
                <div className="result-block">
                  <p className="result-line">
                    <strong>{t.score}:</strong> {result.score}/10 ·{' '}
                    {result.completed ? t.completed : t.notCompleted}
                  </p>
                  <p className="result-line">
                    <strong>{t.feedback}:</strong> {result.feedback}
                  </p>
                </div>
                <div className="actions">
                  <button type="button" className="btn primary" onClick={nextStatic} disabled={blockUi}>
                    {t.newQuest}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
