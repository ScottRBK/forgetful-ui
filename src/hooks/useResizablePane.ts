import type {
  CSSProperties,
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefCallback,
  SetStateAction,
} from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

const HANDLE_WIDTH = 9
const COLUMN_GAP_TOTAL = 32
const KEYBOARD_STEP = 20

interface ResizablePaneOptions {
  minWidth: number
  maxWidth: number
  defaultWidth: number
  minListWidth: number
  label: string
  controlsId: string
}

interface ResizeHandleProps {
  role: 'separator'
  'aria-label': string
  'aria-orientation': 'vertical'
  'aria-valuemin': number
  'aria-valuemax': number
  'aria-valuenow': number
  'aria-controls': string
  tabIndex: 0
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void
}

interface ResizablePane {
  layoutRef: RefCallback<HTMLDivElement>
  width: number
  maxWidth: number
  expanded: boolean
  setExpanded: Dispatch<SetStateAction<boolean>>
  layoutStyle: CSSProperties
  handleProps: ResizeHandleProps
}

export function useResizablePane({
  minWidth,
  maxWidth,
  defaultWidth,
  minListWidth,
  label,
  controlsId,
}: ResizablePaneOptions): ResizablePane {
  const [width, setWidth] = useState(defaultWidth)
  const [actualMaxWidth, setActualMaxWidth] = useState(maxWidth)
  const [expanded, setExpanded] = useState(false)
  const widthRef = useRef(defaultWidth)
  const [layoutElement, setLayoutElement] = useState<HTMLDivElement | null>(null)
  const layoutRef = useCallback((element: HTMLDivElement | null) => {
    setLayoutElement(element)
  }, [])
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const resizeCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.()
    }
  }, [])

  useEffect(() => {
    const element = layoutElement
    if (!element) return

    const updateBounds = (): void => {
      const elementWidth = element.getBoundingClientRect().width
      if (
        elementWidth === 0 ||
        (typeof window.matchMedia === 'function' &&
          !window.matchMedia('(min-width: 1024px)').matches)
      ) {
        return
      }
      const style = window.getComputedStyle(element)
      const horizontalPadding =
        Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight)
      const contentWidth = elementWidth - horizontalPadding
      const upper = Math.max(
        minWidth,
        Math.min(maxWidth, contentWidth - minListWidth - HANDLE_WIDTH - COLUMN_GAP_TOTAL),
      )
      setActualMaxWidth(upper)
      const next = Math.min(Math.max(widthRef.current, minWidth), upper)
      widthRef.current = next
      setWidth(next)
    }

    if (typeof ResizeObserver === 'undefined') {
      updateBounds()
      return
    }

    const observer = new ResizeObserver(updateBounds)
    observer.observe(element)
    updateBounds()
    return () => observer.disconnect()
  }, [layoutElement, maxWidth, minListWidth, minWidth])

  function clamp(value: number): number {
    return Math.min(Math.max(value, minWidth), actualMaxWidth)
  }

  function applyWidth(value: number): void {
    const next = clamp(value)
    widthRef.current = next
    setWidth(next)
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return
    event.preventDefault()
    resizeCleanupRef.current?.()
    dragRef.current = { startX: event.clientX, startWidth: widthRef.current }

    const stop = (): void => {
      dragRef.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      resizeCleanupRef.current = null
    }
    const move = (pointerEvent: PointerEvent): void => {
      const drag = dragRef.current
      if (!drag) return
      pointerEvent.preventDefault()
      applyWidth(drag.startWidth + (drag.startX - pointerEvent.clientX))
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    resizeCleanupRef.current = stop
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    let next = widthRef.current
    if (event.key === 'ArrowLeft') next += KEYBOARD_STEP
    else if (event.key === 'ArrowRight') next -= KEYBOARD_STEP
    else if (event.key === 'Home') next = minWidth
    else if (event.key === 'End') next = actualMaxWidth
    else return
    event.preventDefault()
    applyWidth(next)
  }

  return {
    layoutRef,
    width,
    maxWidth: actualMaxWidth,
    expanded,
    setExpanded,
    layoutStyle: { '--detail-width': `${width}px` } as CSSProperties,
    handleProps: {
      role: 'separator',
      'aria-label': label,
      'aria-orientation': 'vertical',
      'aria-valuemin': minWidth,
      'aria-valuemax': Math.round(actualMaxWidth),
      'aria-valuenow': Math.round(width),
      'aria-controls': controlsId,
      tabIndex: 0,
      onPointerDown,
      onKeyDown,
    },
  }
}
