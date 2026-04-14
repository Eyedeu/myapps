import { useCallback, useEffect, useState } from 'react'
import { QUESTS, randomQuestIndex } from './quests'

const ROUND_SEC = 180

function formatTime(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function App() {
  const [idx, setIdx] = useState(() => randomQuestIndex(null))
  const [phase, setPhase] = useState<'ready' | 'running' | 'wrap'>('ready')
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SEC)

  const quest = QUESTS[idx] ?? 'Take a slow breath.'

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

  const nextQuest = useCallback(() => {
    setIdx((i) => randomQuestIndex(i))
    setPhase('ready')
    setSecondsLeft(ROUND_SEC)
  }, [])

  const startTimer = useCallback(() => {
    setSecondsLeft(ROUND_SEC)
    setPhase('running')
  }, [])

  const finishEarly = useCallback(() => {
    setPhase('wrap')
  }, [])

  return (
    <div className="app">
      <header className="header">
        <p className="eyebrow">Micro quest</p>
        <h1 className="title">Scoop</h1>
        <p className="lede">
          A tiny real-world mission for a short break—optional timer, no journaling.
        </p>
      </header>

      <main className="card">
        <p className="quest-label">Your quest</p>
        <p className="quest">{quest}</p>

        {phase === 'ready' && (
          <div className="actions">
            <button type="button" className="btn primary" onClick={startTimer}>
              Start {formatTime(ROUND_SEC)} timer
            </button>
            <button type="button" className="btn ghost" onClick={nextQuest}>
              Different quest
            </button>
          </div>
        )}

        {phase === 'running' && (
          <>
            <div className="timer" aria-label="Time remaining">
              <span className={secondsLeft <= 30 ? 'warn' : ''}>
                {formatTime(secondsLeft)}
              </span>
            </div>
            <div className="actions">
              <button type="button" className="btn primary" onClick={finishEarly}>
                I&apos;m done
              </button>
              <button type="button" className="btn ghost" onClick={nextQuest}>
                New quest (resets)
              </button>
            </div>
          </>
        )}

        {phase === 'wrap' && (
          <div className="wrap-up">
            <p className="wrap-text">Nice. Want another scoop?</p>
            <div className="actions">
              <button type="button" className="btn primary" onClick={nextQuest}>
                Next quest
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
