import { useCallback, useEffect, useRef, useState } from 'react'
import { AiQuestLoadingOverlay } from '../components/AiQuestLoadingOverlay'
import { judgeSolo, generateAiQuest } from '../ai/scoring'
import { compressImageToDataUrl } from '../lib/image'
import { randomStaticQuest } from '../quests/static'
import { useAppI18n } from '../settings/useAppI18n'
import type { QuestSpec, SoloAiResult } from '../types'

/** Five-minute cap; elapsed time is sent to the judge when the timed path is used. */
const ROUND_SEC = 300

type WrapTiming = { usedTimer: boolean; elapsedSec: number }

function formatTime(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SoloGame({ onBack }: { onBack: () => void }) {
  const { t, settings, locale } = useAppI18n()
  const [quest, setQuest] = useState<QuestSpec>(() => randomStaticQuest(locale, null))
  const [phase, setPhase] = useState<'ready' | 'running' | 'wrap'>('ready')
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SEC)
  const [text, setText] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [aiQuestLoading, setAiQuestLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<SoloAiResult | null>(null)
  const recentAiQuestsRef = useRef<string[]>([])
  const secondsLeftRef = useRef(ROUND_SEC)
  const wrapTimingRef = useRef<WrapTiming>({ usedTimer: false, elapsedSec: 0 })

  useEffect(() => {
    secondsLeftRef.current = secondsLeft
  }, [secondsLeft])

  useEffect(() => {
    if (phase !== 'running') return
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          wrapTimingRef.current = { usedTimer: true, elapsedSec: ROUND_SEC }
          setPhase('wrap')
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [phase])

  const nextStatic = useCallback(() => {
    setQuest((q) => randomStaticQuest(locale, q))
    setPhase('running')
    setSecondsLeft(ROUND_SEC)
    secondsLeftRef.current = ROUND_SEC
    setText('')
    setImage(null)
    setResult(null)
    setErr(null)
  }, [locale])

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
      setPhase('running')
      setSecondsLeft(ROUND_SEC)
      secondsLeftRef.current = ROUND_SEC
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
    setSecondsLeft(ROUND_SEC)
    secondsLeftRef.current = ROUND_SEC
    setPhase('running')
  }, [])

  const finishEarly = useCallback(() => {
    wrapTimingRef.current = {
      usedTimer: true,
      elapsedSec: Math.min(ROUND_SEC, Math.max(0, ROUND_SEC - secondsLeftRef.current)),
    }
    setPhase('wrap')
  }, [])

  const skipTimerToWrap = useCallback(() => {
    wrapTimingRef.current = { usedTimer: false, elapsedSec: 0 }
    setPhase('wrap')
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
    setBusy(true)
    setResult(null)
    try {
      const wt = wrapTimingRef.current
      const r = await judgeSolo({
        settings,
        locale,
        quest,
        answer: text,
        imageDataUrl: image,
        timing: wt.usedTimer ? { limitSec: ROUND_SEC, elapsedSec: wt.elapsedSec } : undefined,
      })
      setResult(r)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errorGeneric)
    } finally {
      setBusy(false)
    }
  }, [settings, locale, quest, text, image, t])

  const blockUi = busy || aiQuestLoading

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
        <p className="quest-label">{t.questLabel}</p>
        <p className="quest">{quest.text}</p>
        {quest.preferPhoto && <p className="photo-hint">{t.requirePhotoQuest}</p>}

        {phase === 'ready' && (
          <div className="actions">
            <button type="button" className="btn primary" onClick={startTimer} disabled={blockUi}>
              {t.startTimer} ({formatTime(ROUND_SEC)})
            </button>
            <button type="button" className="btn ghost" onClick={skipTimerToWrap} disabled={blockUi}>
              {t.answerNow}
            </button>
            <button type="button" className="btn ghost" onClick={nextStatic} disabled={blockUi}>
              {t.newQuest}
            </button>
            <button type="button" className="btn ghost" onClick={() => void aiQuest()} disabled={blockUi}>
              {t.aiQuest}
            </button>
          </div>
        )}

        {phase === 'running' && (
          <>
            <div className="timer" aria-label={t.timer}>
              <span className={secondsLeft <= 60 ? 'warn' : ''}>{formatTime(secondsLeft)}</span>
            </div>
            <div className="actions">
              <button type="button" className="btn primary" onClick={finishEarly}>
                {t.done}
              </button>
              <button type="button" className="btn ghost" onClick={nextStatic}>
                {t.newQuest}
              </button>
            </div>
          </>
        )}

        {(phase === 'wrap' || result) && (
          <>
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

            <label className="field">
              <span className="field-label">{t.photoOptional}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
              />
            </label>

            {err && <p className="error">{err}</p>}

            <div className="actions">
              <button type="button" className="btn primary" onClick={() => void submit()} disabled={blockUi}>
                {busy ? t.analyzing : t.submitAi}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  nextStatic()
                }}
                disabled={blockUi}
              >
                {t.newQuest}
              </button>
            </div>

            {result && (
              <div className="result-block">
                <p className="result-line">
                  <strong>{t.score}:</strong> {result.score}/10 ·{' '}
                  {result.completed ? t.completed : t.notCompleted}
                </p>
                <p className="result-line">
                  <strong>{t.feedback}:</strong> {result.feedback}
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
