import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_TAPS = 24

function paint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  taps: number,
  seed: number,
) {
  ctx.clearRect(0, 0, w, h)
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, w * 0.7)
  bg.addColorStop(0, '#1a2233')
  bg.addColorStop(1, '#0f1115')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  const hue = seed % 360
  const cx = w * 0.5
  const cy = h * 0.42
  const n = Math.min(taps, MAX_TAPS)

  ctx.strokeStyle = `hsl(${hue + 30}, 30%, 32%)`
  ctx.lineWidth = Math.max(3, w * 0.012)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx, cy + 18)
  ctx.quadraticCurveTo(
    cx + 20 + (seed % 18),
    h * 0.62,
    cx + ((seed * 7) % 24) - 12,
    h * 0.92,
  )
  ctx.stroke()

  if (n >= 4) {
    for (let i = 0; i < 2; i++) {
      const ly = h * (0.55 + i * 0.12)
      ctx.fillStyle = `hsla(${hue + 90}, 40%, 42%, 0.9)`
      ctx.beginPath()
      ctx.ellipse(cx + (i === 0 ? -18 : 18), ly, 18, 8, i === 0 ? -0.6 : 0.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  for (let i = 0; i < n; i++) {
    const t = (i / Math.max(n, 1)) * Math.PI * 2 + seed * 0.004
    const radius = 26 + (i % 5) * 3 + n * 0.35
    const px = cx + Math.cos(t) * radius * 0.35
    const py = cy + Math.sin(t) * radius * 0.35
    ctx.fillStyle = `hsla(${hue + i * 7}, 65%, ${52 + (i % 3) * 4}%, 0.92)`
    ctx.beginPath()
    ctx.ellipse(px, py, 14 + (i % 2) * 4, 22, t + Math.PI / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = `hsl(${hue + 18}, 75%, 46%)`
  ctx.beginPath()
  ctx.arc(cx, cy, 10 + Math.min(n, 14) * 0.35, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = `hsl(${hue}, 85%, 22%)`
  ctx.beginPath()
  ctx.arc(cx, cy, 5 + Math.min(n, 10) * 0.2, 0, Math.PI * 2)
  ctx.fill()
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [seed] = useState(() => Math.floor(Math.random() * 100000))
  const [taps, setTaps] = useState(0)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.floor(rect.width * dpr)
    canvas.height = Math.floor(rect.height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    paint(ctx, rect.width, rect.height, taps, seed)
  }, [taps, seed])

  useEffect(() => {
    redraw()
  }, [redraw])

  useEffect(() => {
    const ro = new ResizeObserver(() => redraw())
    const el = canvasRef.current
    if (el) ro.observe(el)
    return () => ro.disconnect()
  }, [redraw])

  return (
    <div className="app">
      <header className="header">
        <p className="eyebrow">Rhythm · canvas</p>
        <h1 className="title">Floret</h1>
        <p className="lede">
          Tap the canvas or the button. Each tap adds petals—no typing, no pressure.
        </p>
      </header>
      <div className="stage">
        <canvas
          ref={canvasRef}
          className="canvas"
          role="img"
          aria-label="Procedural flower"
          onClick={() => setTaps((t) => Math.min(t + 1, MAX_TAPS))}
        />
      </div>
      <div className="actions">
        <button
          type="button"
          className="btn primary"
          onClick={() => setTaps((t) => Math.min(t + 1, MAX_TAPS))}
        >
          Tap bloom
        </button>
        <button type="button" className="btn ghost" onClick={() => setTaps(0)}>
          Reset
        </button>
      </div>
      <p className="hint">
        Blooms: {taps} · id {seed % 10000}
      </p>
    </div>
  )
}
