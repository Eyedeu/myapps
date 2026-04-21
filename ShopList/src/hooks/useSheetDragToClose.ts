import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'

const DISMISS_PX = 100
const MAX_DRAG_PX = 720

type DragAreaProps = {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void
}

/**
 * Alt sheet’te tutamak + başlık bölgesinden aşağı çekince İptal ile aynı şekilde kapanır.
 */
export function useSheetDragToClose(canInteract: boolean, onClose: () => void): {
  dragAreaProps: DragAreaProps
  panelStyle: CSSProperties
} {
  const startYRef = useRef(0)
  const offsetRef = useRef(0)
  const pointerIdRef = useRef<number | null>(null)
  const draggingRef = useRef(false)

  const [pullY, setPullY] = useState(0)
  const [dragging, setDragging] = useState(false)

  const endPointer = useCallback(
    (target: HTMLElement, pointerId: number) => {
      try {
        target.releasePointerCapture(pointerId)
      } catch {
        /* already released */
      }
      pointerIdRef.current = null

      const shouldClose = offsetRef.current >= DISMISS_PX
      const lastPull = offsetRef.current
      offsetRef.current = 0
      draggingRef.current = false

      if (shouldClose) {
        setDragging(false)
        setPullY(0)
        onClose()
        return
      }

      setDragging(false)
      if (lastPull > 0) {
        requestAnimationFrame(() => {
          setPullY(0)
        })
      } else {
        setPullY(0)
      }
    },
    [onClose],
  )

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!canInteract) return
      const t = e.target as HTMLElement
      if (t.closest('button, a, input, textarea, select, [data-sheet-no-drag]')) return

      pointerIdRef.current = e.pointerId
      draggingRef.current = true
      startYRef.current = e.clientY
      offsetRef.current = 0
      setPullY(0)
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [canInteract],
  )

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (pointerIdRef.current !== e.pointerId || !draggingRef.current) return
    const dy = e.clientY - startYRef.current
    const y = Math.max(0, Math.min(dy, MAX_DRAG_PX))
    offsetRef.current = y
    setPullY(y)
  }, [])

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (pointerIdRef.current !== e.pointerId) return
      endPointer(e.currentTarget, e.pointerId)
    },
    [endPointer],
  )

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (pointerIdRef.current !== e.pointerId) return
      endPointer(e.currentTarget, e.pointerId)
    },
    [endPointer],
  )

  const panelStyle: CSSProperties = {
    transform: pullY > 0 ? `translateY(${pullY}px)` : undefined,
    transition: dragging ? 'none' : 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
  }

  return {
    dragAreaProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    panelStyle,
  }
}
