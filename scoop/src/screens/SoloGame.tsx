import { useCallback, useEffect, useState } from 'react'
import { judgeSolo, generateAiQuest } from '../ai/scoring'
import { compressImageToDataUrl } from '../lib/image'
import { randomStaticQuest } from '../quests/static'
import { useAppI18n } from '../settings/useAppI18n'
import type { QuestSpec, SoloAiResult } from '../types'

const ROUND_SEC = 180

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
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<SoloAiResult | null>(null)

  useEffect(() => {
    if (phase !== 'running') return
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
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
    setPhase('ready')
    setSecondsLeft(ROUND_SEC)
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
    setBusy(true)
    try {
      const q = await generateAiQuest(settings, locale)
      setQuest(q)
      setPhase('ready')
      setSecondsLeft(ROUND_SEC)
      setText('')
      setImage(null)
      setResult(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errorGeneric)
    } finally {
      setBusy(false)
    }
  }, [settings, locale, t])

  const startTimer = useCallback(() => {
    setSecondsLeft(ROUND_SEC)
    setPhase('running')
  }, [])

  const finishEarly = useCallback(() => {
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
      const r = await judgeSolo({
        settings,
        locale,
        quest,
        answer: text,
        imageDataUrl: image,
      })
      setResult(r)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errorGeneric)
    } finally {
      setBusy(false)
    }
  }, [settings, locale, quest, text, image, t])

  return (
    <div className="app">
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
            <button type="button" className="btn primary" onClick={startTimer} disabled={busy}>
              {t.startTimer} ({formatTime(ROUND_SEC)})
            </button>
            <button type="button" className="btn ghost" onClick={() => setPhase('wrap')} disabled={busy}>
              {t.answerNow}
            </button>
            <button type="button" className="btn ghost" onClick={nextStatic} disabled={busy}>
              {t.newQuest}
            </button>
            <button type="button" className="btn ghost" onClick={() => void aiQuest()} disabled={busy}>
              {t.aiQuest}
            </button>
          </div>
        )}

        {phase === 'running' && (
          <>
            <div className="timer" aria-label={t.timer}>
              <span className={secondsLeft <= 30 ? 'warn' : ''}>{formatTime(secondsLeft)}</span>
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
              <button type="button" className="btn primary" onClick={() => void submit()} disabled={busy}>
                {busy ? t.analyzing : t.submitAi}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  nextStatic()
                  setPhase('ready')
                }}
                disabled={busy}
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
