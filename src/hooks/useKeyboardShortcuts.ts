import { useEffect } from 'react'
import { memoriesHref, navigate } from '../router'

export const FORGETFUL_CLEAR_GRAPH_SELECTION = 'forgetful:clear-graph-selection'

export interface KeyboardShortcutHandlers {
  onEscape?: () => void
}

function isEditableElement(element: Element | null): boolean {
  if (!element) return false
  const tag = element.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (element instanceof HTMLElement && element.isContentEditable) return true
  return element.closest('[contenteditable="true"]') !== null
}

function isContentEditableTrue(element: Element | null): boolean {
  if (!element) return false
  if (element instanceof HTMLElement && element.isContentEditable) return true
  return element.closest('[contenteditable="true"]') !== null
}

export function focusPrimarySearch(): void {
  const tryFocus = (): void => {
    const input = document.querySelector<HTMLInputElement>('[data-shortcut-search]')
    if (input) {
      input.focus()
      input.select()
    }
  }

  const onMemories =
    window.location.hash === '#/memories' || window.location.hash.startsWith('#/memories?')
  if (!onMemories) {
    navigate(memoriesHref({}))
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(tryFocus)
    })
    return
  }
  tryFocus()
}

export function useGraphInspectorClear(clearSelection: () => void): void {
  useEffect(() => {
    const handler = (): void => clearSelection()
    window.addEventListener(FORGETFUL_CLEAR_GRAPH_SELECTION, handler)
    return () => window.removeEventListener(FORGETFUL_CLEAR_GRAPH_SELECTION, handler)
  }, [clearSelection])
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers, enabled = true): void {
  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target instanceof Element ? event.target : null

      if (event.key === 'Escape') {
        if (isContentEditableTrue(target)) {
          if (target instanceof HTMLElement) target.blur()
          return
        }
        if (target?.tagName === 'SELECT') return
        if (isEditableElement(target) && target instanceof HTMLElement) {
          target.blur()
          return
        }
        handlers.onEscape?.()
        return
      }

      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
      if (isEditableElement(target)) return

      event.preventDefault()
      focusPrimarySearch()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, handlers.onEscape])
}
