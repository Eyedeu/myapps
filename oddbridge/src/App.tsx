import { useCallback, useEffect, useMemo, useState } from 'react'
import { randomPair, type WordPair } from './wordPairs'

const ROUND_SECONDS = 180

type Phase = 'ready' | 'running' | 'review'

function formatTime(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function App() {
  const [pair, setPair] = useState<WordPair>(() => randomPair())
  const [phase, setPhase] = useState<Phase>('ready')
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS)
  const [bridge, setBridge] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'err'>('idle')

  const timerLabel = useMemo(() => formatTime(secondsLeft), [secondsLeft])

  useEffect(() => {
    if (phase !== 'running') return
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setPhase('review')
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [phase])

  const startRound = useCallback(() => {
    setSecondsLeft(ROUND_SECONDS)
    setBridge('')
    setPhase('running')
    setCopyState('idle')
  }, [])

  const newPair = useCallback(() => {
    setPair((p) => randomPair(p))
    setSecondsLeft(ROUND_SECONDS)
    setBridge('')
    setPhase('ready')
    setCopyState('idle')
  }, [])

  const finishEarly = useCallback(() => {
    setPhase('review')
  }, [])

  const onCopy = useCallback(async () => {
    const text = `${pair.a} ↔ ${pair.b}\n${bridge.trim()}`
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('ok')
      window.setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('err')
      window.setTimeout(() => setCopyState('idle'), 2500)
    }
  }, [bridge, pair.a, pair.b])

  const timeUp = phase === 'review' && secondsLeft <= 0 && !bridge.trim()

  return (
    <div className="app">
      <header className="header">
        <p className="eyebrow">Micro creative break</p>
        <h1 className="title">Oddbridge</h1>
        <p className="lede">
          Link the two words in <strong>one sentence</strong>. Funny, clever,
          absurd — anything goes. <span className="nowrap">~3 minutes.</span>
        </p>
      </header>

      <main className="card">
        <div className="pair-row" aria-live="polite">
          <span className="word-pill">{pair.a}</span>
          <span className="bridge-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 12h16M14 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="word-pill">{pair.b}</span>
        </div>

        {phase === 'ready' && (
          <div className="actions">
            <button type="button" className="btn primary" onClick={startRound}>
              Start timer
            </button>
            <button type="button" className="btn ghost" onClick={newPair}>
              Different pair
            </button>
          </div>
        )}

        {phase === 'running' && (
          <>
            <div className="timer" role="timer" aria-label="Time remaining">
              <span className={secondsLeft <= 30 ? 'timer-warn' : ''}>
                {timerLabel}
              </span>
            </div>
            <label className="field">
              <span className="field-label">Your bridge</span>
              <textarea
                className="textarea"
                value={bridge}
                onChange={(e) => setBridge(e.target.value)}
                placeholder="One sentence that connects both words…"
                rows={4}
                maxLength={400}
                autoFocus
              />
            </label>
            <div className="actions">
              <button type="button" className="btn primary" onClick={finishEarly}>
                I&apos;m done
              </button>
              <button type="button" className="btn ghost" onClick={newPair}>
                New pair (resets)
              </button>
            </div>
          </>
        )}

        {phase === 'review' && (
          <div className="review">
            {timeUp ? (
              <p className="review-hint">
                Time&apos;s up — want to try another pair?
              </p>
            ) : (
              <>
                <p className="review-label">Your bridge</p>
                <blockquote className="quote">
                  {bridge.trim() || '—'}
                </blockquote>
                <div className="actions">
                  <button type="button" className="btn secondary" onClick={onCopy}>
                    {copyState === 'ok'
                      ? 'Copied'
                      : copyState === 'err'
                        ? 'Copy failed'
                        : 'Copy'}
                  </button>
                  <button type="button" className="btn primary" onClick={newPair}>
                    New round
                  </button>
                </div>
              </>
            )}
            {timeUp && (
              <div className="actions">
                <button type="button" className="btn primary" onClick={newPair}>
                  New pair
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="footer">
        <p>No journaling — just one playful sentence when you have a gap.</p>
      </footer>
    </div>
  )
}

export default App
