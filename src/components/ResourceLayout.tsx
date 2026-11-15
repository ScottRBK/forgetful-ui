import type { ReactNode } from 'react'
import { useEffect, useId, useRef } from 'react'
import { useResizablePane } from '../hooks/useResizablePane'

interface ResourceLayoutProps {
  listTitle: string
  listSummary?: ReactNode
  detailTitle: string
  selectedId: number | null
  backHref: string
  list: ReactNode
  detail: ReactNode
}

export function ResourceLayout({
  listTitle,
  listSummary,
  detailTitle,
  selectedId,
  backHref,
  list,
  detail,
}: ResourceLayoutProps) {
  const listRef = useRef<HTMLElement | null>(null)
  const detailRef = useRef<HTMLElement | null>(null)
  const listHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const previousSelectedId = useRef<number | null>(null)
  const hasMounted = useRef(false)
  const hasSelection = selectedId !== null
  const detailId = useId()
  const pane = useResizablePane({
    minWidth: 280,
    maxWidth: 640,
    defaultWidth: 400,
    minListWidth: 300,
    label: 'Resize detail',
    controlsId: detailId,
  })
  const effectiveExpanded = pane.expanded && hasSelection

  useEffect(() => {
    if (!hasSelection) pane.setExpanded(false)
  }, [hasSelection, pane.setExpanded])

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      previousSelectedId.current = selectedId
      return
    }

    const isNarrow =
      typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1023px)').matches
    if (!isNarrow) {
      previousSelectedId.current = selectedId
      return
    }

    if (selectedId !== null) {
      previousSelectedId.current = selectedId
      detailRef.current?.scrollIntoView({ block: 'start' })
      detailRef.current?.focus({ preventScroll: true })
      return
    }

    const previousId = previousSelectedId.current
    previousSelectedId.current = null
    const row =
      previousId !== null
        ? listRef.current?.querySelector<HTMLElement>(`[data-resource-id="${previousId}"]`)
        : null
    if (row) {
      row.scrollIntoView({ block: 'center' })
      row.focus({ preventScroll: true })
    } else {
      listHeadingRef.current?.focus({ preventScroll: true })
    }
  }, [selectedId])

  return (
    <div
      ref={pane.layoutRef}
      data-resource-layout
      className={`resource-layout${hasSelection ? ' has-selection' : ''}${
        effectiveExpanded ? ' is-expanded' : ''
      }`}
      style={pane.layoutStyle}
    >
      <section
        ref={listRef}
        data-resource-list
        className="resource-list panel-raised min-w-0 overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h2
            ref={listHeadingRef}
            tabIndex={-1}
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
          >
            {listTitle}
          </h2>
          {listSummary}
        </div>
        {list}
      </section>
      <div data-resize-handle {...pane.handleProps} className="detail-resize-handle">
        <span className="detail-resize-grip" aria-hidden="true" />
      </div>

      <aside
        ref={detailRef}
        id={detailId}
        tabIndex={-1}
        data-resource-detail
        className={`
          resource-detail panel-raised min-w-0 overflow-hidden
          focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-teal lg:sticky lg:top-4
        `}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {detailTitle}
          </p>
          <div className="flex items-center gap-1.5">
            <a href={backHref} className="btn-compact lg:hidden">
              Back to list
            </a>
            {hasSelection && (
              <button
                type="button"
                onClick={() => pane.setExpanded((value) => !value)}
                className="btn-compact hidden lg:inline-flex"
                aria-pressed={effectiveExpanded}
              >
                {effectiveExpanded ? 'Restore detail' : 'Expand detail'}
              </button>
            )}
          </div>
        </div>
        {detail}
      </aside>
    </div>
  )
}
