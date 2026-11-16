import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, getMemory, isAbortError, listMemories, listProjects } from '../api/client'
import type { MemoryRecord, ProjectRecord } from '../api/types'
import { EmptyPanel, ErrorPanel, LoadingRows } from '../components/Feedback'
import { ArrowLeftIcon, ArrowRightIcon, ExternalIcon, RefreshIcon } from '../components/Icons'
import { useResizablePane } from '../hooks/useResizablePane'
import { formatDate, formatShortDate, pluralMemories, safeHttpUrl } from '../lib/format'
import {
  datetimeLocalValueToIso,
  hasActiveMemoryFilters,
  isoToDatetimeLocalValue,
} from '../lib/memoryFilters'
import { pageItems } from '../lib/pagination'
import type { MemoryRoute, MemorySortBy } from '../router'
import { graphHref, memoriesHref, navigate } from '../router'

const PAGE_SIZE = 20
const DETAIL_SKELETON = ['one', 'two', 'three', 'four', 'five'] as const

type ListState =
  | { status: 'loading' }
  | { status: 'ready'; memories: MemoryRecord[]; total: number; offset: number }
  | { status: 'error'; message: string }

type DetailState =
  | { status: 'idle' }
  | { status: 'loading'; memoryId: number }
  | { status: 'ready'; memoryId: number; memory: MemoryRecord }
  | { status: 'missing'; memoryId: number }
  | { status: 'error'; memoryId: number; message: string }

type SelectionContext = Pick<
  MemoryRoute,
  | 'page'
  | 'projectId'
  | 'sortBy'
  | 'sortOrder'
  | 'importanceMin'
  | 'importanceMax'
  | 'q'
  | 'updatedFrom'
  | 'updatedTo'
>

type ProjectState =
  | { status: 'loading' }
  | { status: 'ready'; projects: ProjectRecord[] }
  | { status: 'error'; message: string }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request failed.'
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line/80 py-2 last:border-0">
      <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-[12px] text-ink-soft">{children}</dd>
    </div>
  )
}

function DetailPane({
  state,
  projects,
  memoryId,
  route,
  onRetry,
}: {
  state: DetailState
  projects: ProjectRecord[]
  memoryId: number | null
  route: MemoryRoute
  onRetry: () => void
}) {
  const projectNames = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  )

  if (memoryId === null) {
    return (
      <div className="p-5">
        <p className="text-[13px] font-medium text-ink">Select a memory</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          Choose a row to read its full content and provenance. The graph opens around the selected
          memory.
        </p>
      </div>
    )
  }

  if (state.status === 'loading') {
    return (
      <div className="p-5" aria-busy="true">
        <span className="sr-only">Loading memory detail…</span>
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-slate-200/70" />
        <div className="mt-6 space-y-2">
          {DETAIL_SKELETON.map((row) => (
            <div key={row} className="h-3 animate-pulse rounded bg-slate-200/60" />
          ))}
        </div>
      </div>
    )
  }

  if (state.status === 'missing') {
    return (
      <div className="p-5">
        <p className="text-[13px] font-semibold text-copper">Memory not found</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          Memory #{memoryId} is unavailable. It may have been deleted after the list loaded.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-[12px]">
          <a
            href={memoriesHref({
              page: route.page,
              projectId: route.projectId,
              sortBy: route.sortBy,
              sortOrder: route.sortOrder,
              importanceMin: route.importanceMin,
              importanceMax: route.importanceMax,
              q: route.q,
              updatedFrom: route.updatedFrom,
              updatedTo: route.updatedTo,
            })}
            className="font-medium text-teal"
          >
            Return to list
          </a>
          <button
            type="button"
            onClick={onRetry}
            className="font-medium text-ink-soft hover:text-ink"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="p-3">
        <ErrorPanel title="Could not load memory" message={state.message} onRetry={onRetry} />
      </div>
    )
  }

  if (state.status !== 'ready') return null

  const memory = state.memory
  const sourceUrl = safeHttpUrl(memory.source_url)
  const projectsForMemory = (memory.project_ids ?? [])
    .map((id) => projectNames.get(id))
    .filter((name): name is string => Boolean(name))
  const tags = memory.tags ?? []
  const keywords = memory.keywords ?? []

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
            Memory #{memory.id}
          </p>
          <h2 className="detail-title mt-1.5" data-detail-heading tabIndex={-1}>
            {memory.title}
          </h2>
        </div>
        <a
          href={graphHref({
            memoryId: memory.id,
            page: route.page,
            projectId: route.projectId,
            depth: 1,
            sortBy: route.sortBy,
            sortOrder: route.sortOrder,
            importanceMin: route.importanceMin,
            importanceMax: route.importanceMax,
            q: route.q,
            updatedFrom: route.updatedFrom,
            updatedTo: route.updatedTo,
          })}
          className="btn-secondary shrink-0"
        >
          Open graph
        </a>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="chip bg-teal-soft text-teal-ink">Importance {memory.importance}/10</span>
        {memory.is_obsolete && <span className="chip bg-copper-soft text-copper">Obsolete</span>}
        {tags.slice(0, 5).map((tag) => (
          <span
            key={tag}
            className="rounded border border-line px-1.5 py-0.5 text-[10px] text-muted"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-4 rounded border border-line bg-canvas/60 p-3">
        <p className="prose-copy">{memory.content || 'No content recorded.'}</p>
      </div>

      {memory.context && (
        <div className="mt-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">Context</p>
          <p className="prose-copy mt-1">{memory.context}</p>
        </div>
      )}

      <dl className="mt-4">
        <DetailField label="Projects">
          {projectsForMemory.length > 0 ? projectsForMemory.join(', ') : 'None'}
        </DetailField>
        <DetailField label="Created">{formatDate(memory.created_at)}</DetailField>
        <DetailField label="Updated">{formatDate(memory.updated_at)}</DetailField>
        <DetailField label="Keywords">
          {keywords.length > 0 ? keywords.join(', ') : 'None'}
        </DetailField>
        <DetailField label="Linked memories">
          {(memory.linked_memory_ids ?? []).length > 0
            ? (memory.linked_memory_ids ?? []).join(', ')
            : 'None'}
        </DetailField>
        <DetailField label="Access count">{memory.access_count ?? 0}</DetailField>
        <DetailField label="Source repo">{memory.source_repo ?? '—'}</DetailField>
        <DetailField label="Source files">
          {(memory.source_files ?? []).length > 0 ? (memory.source_files ?? []).join(', ') : '—'}
        </DetailField>
        <DetailField label="Source URL">
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 break-all font-medium text-teal
                hover:underline"
            >
              {sourceUrl}
              <ExternalIcon className="h-3 w-3 shrink-0" />
            </a>
          ) : (
            memory.source_url || '—'
          )}
        </DetailField>
        <DetailField label="Encoding">
          {[memory.encoding_agent, memory.encoding_version].filter(Boolean).join(' · ') || '—'}
        </DetailField>
      </dl>
    </div>
  )
}

function SortHeader({
  label,
  shortLabel,
  column,
  route,
  onSort,
  className,
}: {
  label: string
  shortLabel: string
  column: MemorySortBy
  route: MemoryRoute
  onSort: (column: MemorySortBy) => void
  className: string
}) {
  const active = route.sortBy === column
  const ariaSort = active ? (route.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'
  const indicator = active ? (route.sortOrder === 'asc' ? '↑' : '↓') : '↕'
  return (
    <th aria-sort={ariaSort} className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="sort-button"
        aria-label={label}
        title={`Sort by ${label.toLowerCase()}`}
      >
        <span className="sort-label-full">{label}</span>
        <span className="sort-label-short" aria-hidden="true">
          {shortLabel}
        </span>
        <span aria-hidden="true" className="sort-indicator">
          {indicator}
        </span>
      </button>
    </th>
  )
}

export function MemoriesScreen({ route }: { route: MemoryRoute }) {
  const [listState, setListState] = useState<ListState>({ status: 'loading' })
  const [detailState, setDetailState] = useState<DetailState>({ status: 'idle' })
  const [projectState, setProjectState] = useState<ProjectState>({ status: 'loading' })
  const [refreshToken, setRefreshToken] = useState(0)
  const [searchInput, setSearchInput] = useState(route.q ?? '')
  const [updatedFromInput, setUpdatedFromInput] = useState(
    route.updatedFrom ? isoToDatetimeLocalValue(route.updatedFrom) : '',
  )
  const [updatedToInput, setUpdatedToInput] = useState(
    route.updatedTo ? isoToDatetimeLocalValue(route.updatedTo) : '',
  )
  const [rangeError, setRangeError] = useState<string | null>(null)
  const pane = useResizablePane({
    minWidth: 320,
    maxWidth: 720,
    defaultWidth: 380,
    minListWidth: 360,
    label: 'Resize memory detail',
    controlsId: 'memory-detail',
  })
  const effectiveExpanded = pane.expanded && route.memoryId !== null
  const listRef = useRef<HTMLElement | null>(null)
  const detailRef = useRef<HTMLElement | null>(null)
  const lastRevealedMemoryId = useRef<number | null>(null)
  const lastSelectedMemoryId = useRef<number | null>(null)
  const lastSelectionContext = useRef<SelectionContext | null>(null)

  const offset = (route.page - 1) * PAGE_SIZE

  useEffect(() => {
    setSearchInput(route.q ?? '')
    setUpdatedFromInput(route.updatedFrom ? isoToDatetimeLocalValue(route.updatedFrom) : '')
    setUpdatedToInput(route.updatedTo ? isoToDatetimeLocalValue(route.updatedTo) : '')
    setRangeError(null)
  }, [route.q, route.updatedFrom, route.updatedTo])

  useEffect(() => {
    if (route.memoryId === null) pane.setExpanded(false)
  }, [route.memoryId, pane.setExpanded])

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshToken triggers a reload
  useEffect(() => {
    const controller = new AbortController()
    let active = true

    setListState({ status: 'loading' })
    listMemories(
      {
        limit: PAGE_SIZE,
        offset,
        projectId: route.projectId,
        sortBy: route.sortBy,
        sortOrder: route.sortOrder,
        importanceMin: route.importanceMin,
        importanceMax: route.importanceMax,
        q: route.q,
        updatedFrom: route.updatedFrom,
        updatedTo: route.updatedTo,
      },
      controller.signal,
    )
      .then((response) => {
        if (!active || controller.signal.aborted) return
        setListState({
          status: 'ready',
          memories: Array.isArray(response.memories) ? response.memories : [],
          total: typeof response.total === 'number' ? response.total : 0,
          offset: typeof response.offset === 'number' ? response.offset : offset,
        })
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbortError(error)) return
        setListState({ status: 'error', message: errorMessage(error) })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [
    offset,
    route.projectId,
    route.sortBy,
    route.sortOrder,
    route.importanceMin,
    route.importanceMax,
    route.q,
    route.updatedFrom,
    route.updatedTo,
    refreshToken,
  ])

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshToken triggers a reload
  useEffect(() => {
    const controller = new AbortController()
    let active = true

    setProjectState({ status: 'loading' })
    listProjects({ status: null, repoName: null }, controller.signal)
      .then((response) => {
        if (!active || controller.signal.aborted) return
        setProjectState({
          status: 'ready',
          projects: Array.isArray(response.projects) ? response.projects : [],
        })
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbortError(error)) return
        setProjectState({ status: 'error', message: errorMessage(error) })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [refreshToken])

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshToken triggers a reload
  useEffect(() => {
    if (route.memoryId === null) {
      setDetailState({ status: 'idle' })
      return
    }

    const memoryId = route.memoryId
    const controller = new AbortController()
    let active = true

    setDetailState({ status: 'loading', memoryId })
    getMemory(memoryId, controller.signal)
      .then((memory) => {
        if (!active || controller.signal.aborted) return
        setDetailState({ status: 'ready', memoryId, memory })
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbortError(error)) return
        if (error instanceof ApiError && error.status === 404) {
          setDetailState({ status: 'missing', memoryId })
          return
        }
        setDetailState({ status: 'error', memoryId, message: errorMessage(error) })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [route.memoryId, refreshToken])

  useEffect(() => {
    const isNarrow =
      typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1023px)').matches

    if (route.memoryId === null) {
      const previousId = lastSelectedMemoryId.current
      const previousContext = lastSelectionContext.current
      lastSelectedMemoryId.current = null
      lastSelectionContext.current = null
      lastRevealedMemoryId.current = null
      const sameContext =
        previousContext !== null &&
        previousContext.page === route.page &&
        previousContext.projectId === route.projectId &&
        previousContext.sortBy === route.sortBy &&
        previousContext.sortOrder === route.sortOrder &&
        previousContext.importanceMin === route.importanceMin &&
        previousContext.importanceMax === route.importanceMax &&
        previousContext.q === route.q &&
        previousContext.updatedFrom === route.updatedFrom &&
        previousContext.updatedTo === route.updatedTo
      if (previousId !== null && sameContext && isNarrow) {
        const row = listRef.current?.querySelector<HTMLElement>(`[data-memory-id="${previousId}"]`)
        if (row) {
          row.scrollIntoView({ block: 'center' })
          row.focus({ preventScroll: true })
        } else {
          listRef.current?.scrollIntoView({ block: 'start' })
        }
      }
      return
    }

    lastSelectedMemoryId.current = route.memoryId
    lastSelectionContext.current = {
      page: route.page,
      projectId: route.projectId,
      sortBy: route.sortBy,
      sortOrder: route.sortOrder,
      importanceMin: route.importanceMin,
      importanceMax: route.importanceMax,
      q: route.q,
      updatedFrom: route.updatedFrom,
      updatedTo: route.updatedTo,
    }
    if (detailState.status === 'idle' || detailState.status === 'loading') return
    if (detailState.memoryId !== route.memoryId) return
    if (lastRevealedMemoryId.current === route.memoryId) return

    lastRevealedMemoryId.current = route.memoryId
    if (!isNarrow) return

    const aside = detailRef.current
    if (!aside) return
    aside.scrollIntoView({ block: 'start' })
    aside.querySelector<HTMLElement>('[data-detail-heading]')?.focus({ preventScroll: true })
  }, [
    route.memoryId,
    detailState,
    route.page,
    route.projectId,
    route.sortBy,
    route.sortOrder,
    route.importanceMin,
    route.importanceMax,
    route.q,
    route.updatedFrom,
    route.updatedTo,
  ])

  const projects = projectState.status === 'ready' ? projectState.projects : []
  const projectNames = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  )

  const total = listState.status === 'ready' ? listState.total : 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pages = pageItems(route.page, totalPages)
  const emptyState =
    listState.status === 'ready' && listState.memories.length === 0
      ? listState.total > 0
        ? 'page-empty'
        : hasActiveMemoryFilters(route)
          ? 'filter-empty'
          : 'instance-empty'
      : null

  function queryContext() {
    return {
      sortBy: route.sortBy,
      sortOrder: route.sortOrder,
      importanceMin: route.importanceMin,
      importanceMax: route.importanceMax,
      q: route.q,
      updatedFrom: route.updatedFrom,
      updatedTo: route.updatedTo,
      projectId: route.projectId,
    }
  }

  function handleProjectChange(value: string): void {
    const projectId = value === '' ? null : Number(value)
    navigate(memoriesHref({ page: 1, ...queryContext(), projectId }))
  }

  function handleImportanceMinChange(value: string): void {
    const importanceMin = value === '' ? null : Number(value)
    const importanceMax =
      importanceMin !== null && route.importanceMax !== null && importanceMin > route.importanceMax
        ? null
        : route.importanceMax
    navigate(memoriesHref({ page: 1, ...queryContext(), importanceMin, importanceMax }))
  }

  function handleImportanceMaxChange(value: string): void {
    const importanceMax = value === '' ? null : Number(value)
    if (
      importanceMax !== null &&
      route.importanceMin !== null &&
      route.importanceMin > importanceMax
    ) {
      setRangeError('Maximum importance must be at least the minimum.')
      return
    }
    setRangeError(null)
    navigate(memoriesHref({ page: 1, ...queryContext(), importanceMax }))
  }

  function applySearch(): void {
    const q = searchInput === '' ? null : searchInput
    navigate(memoriesHref({ page: 1, ...queryContext(), q }))
  }

  function applyUpdatedRange(): void {
    const updatedFrom = datetimeLocalValueToIso(updatedFromInput)
    const updatedTo = datetimeLocalValueToIso(updatedToInput)
    if (updatedFromInput !== '' && updatedFrom === null) {
      setRangeError('Updated from must be a valid date and time.')
      return
    }
    if (updatedToInput !== '' && updatedTo === null) {
      setRangeError('Updated to must be a valid date and time.')
      return
    }
    if (updatedFrom !== null && updatedTo !== null && new Date(updatedFrom) > new Date(updatedTo)) {
      setRangeError('Updated from must not be after updated to.')
      return
    }
    setRangeError(null)
    navigate(
      memoriesHref({
        page: 1,
        ...queryContext(),
        updatedFrom,
        updatedTo,
      }),
    )
  }

  function handleSort(column: MemorySortBy): void {
    const nextOrder =
      route.sortBy === column ? (route.sortOrder === 'desc' ? 'asc' : 'desc') : 'desc'
    navigate(memoriesHref({ page: 1, ...queryContext(), sortBy: column, sortOrder: nextOrder }))
  }

  function clearFiltersHref(): string {
    return memoriesHref({ page: 1, sortBy: route.sortBy, sortOrder: route.sortOrder })
  }

  function retry(): void {
    setRefreshToken((value) => value + 1)
  }

  return (
    <div
      ref={pane.layoutRef}
      className={`memories-layout${effectiveExpanded ? ' is-expanded' : ''}`}
      data-memories-layout
      style={pane.layoutStyle}
    >
      <section ref={listRef} className="memories-list panel-raised min-w-0 overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="project-filter" className="sr-only">
              Project filter
            </label>
            <select
              id="project-filter"
              aria-label="Project filter"
              value={route.projectId ?? ''}
              onChange={(event) => handleProjectChange(event.target.value)}
              className="field"
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
              {route.projectId !== null && !projectNames.has(route.projectId) && (
                <option value={route.projectId}>Project {route.projectId}</option>
              )}
            </select>

            <label htmlFor="importance-min-filter" className="sr-only">
              Minimum importance
            </label>
            <select
              id="importance-min-filter"
              aria-label="Minimum importance"
              value={route.importanceMin ?? ''}
              onChange={(event) => handleImportanceMinChange(event.target.value)}
              className="field max-w-[150px]"
            >
              <option value="">Any importance</option>
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  Importance {value}+
                </option>
              ))}
            </select>

            <label htmlFor="importance-max-filter" className="sr-only">
              Maximum importance
            </label>
            <select
              id="importance-max-filter"
              aria-label="Maximum importance"
              value={route.importanceMax ?? ''}
              onChange={(event) => handleImportanceMaxChange(event.target.value)}
              className="field max-w-[150px]"
            >
              <option value="">Any ceiling</option>
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  Up to {value}
                </option>
              ))}
            </select>

            {hasActiveMemoryFilters(route) && (
              <a
                href={clearFiltersHref()}
                className="text-[11px] font-medium text-teal hover:underline"
              >
                Clear filters
              </a>
            )}

            {projectState.status === 'error' && (
              <span className="text-[10px] text-copper" title={projectState.message}>
                Project filter unavailable
              </span>
            )}

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-[11px] text-muted sm:inline">
                {listState.status === 'ready' ? pluralMemories(total) : 'Loading'}
              </span>
              <button
                type="button"
                onClick={retry}
                aria-label="Refresh memories"
                title="Refresh memories"
                className="btn-secondary"
              >
                <RefreshIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <form
              className="flex min-w-0 flex-1 items-center gap-1.5 sm:max-w-md"
              onSubmit={(event) => {
                event.preventDefault()
                applySearch()
              }}
            >
              <label htmlFor="memory-search" className="sr-only">
                Search memories
              </label>
              <input
                id="memory-search"
                aria-label="Search memories"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search title, content, context"
                className="field min-w-0 flex-1"
              />
              <button type="submit" aria-label="Apply search" className="btn-compact">
                Apply
              </button>
            </form>

            <form
              className="flex flex-wrap items-end gap-1.5"
              onSubmit={(event) => {
                event.preventDefault()
                applyUpdatedRange()
              }}
            >
              <div>
                <label
                  htmlFor="updated-from-filter"
                  className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted"
                >
                  Updated from
                </label>
                <input
                  id="updated-from-filter"
                  aria-label="Updated from"
                  type="datetime-local"
                  value={updatedFromInput}
                  onChange={(event) => setUpdatedFromInput(event.target.value)}
                  className="field"
                />
              </div>
              <div>
                <label
                  htmlFor="updated-to-filter"
                  className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted"
                >
                  Updated to
                </label>
                <input
                  id="updated-to-filter"
                  aria-label="Updated to"
                  type="datetime-local"
                  value={updatedToInput}
                  onChange={(event) => setUpdatedToInput(event.target.value)}
                  className="field"
                />
              </div>
              <button type="submit" aria-label="Apply updated range" className="btn-compact">
                Apply
              </button>
            </form>
          </div>
          {rangeError && (
            <p className="text-[11px] text-copper" role="alert">
              {rangeError}
            </p>
          )}
        </div>

        {listState.status === 'loading' && <LoadingRows />}

        {listState.status === 'error' && (
          <ErrorPanel title="Could not load memories" message={listState.message} onRetry={retry} />
        )}

        {emptyState === 'page-empty' && (
          <EmptyPanel title="No memories on this page">
            <p>
              {route.page > totalPages
                ? `Page ${route.page} is outside the available range (1–${totalPages}).`
                : `Page ${route.page} returned no memories.`}
            </p>
            <p className="mt-3 flex flex-wrap items-center justify-center gap-3">
              <a
                href={memoriesHref({ page: 1, ...queryContext() })}
                className="font-medium text-teal hover:underline"
              >
                First page
              </a>
              <a
                href={memoriesHref({ page: totalPages, ...queryContext() })}
                className="font-medium text-teal hover:underline"
              >
                Last page ({totalPages})
              </a>
              {route.projectId !== null && (
                <a
                  href={memoriesHref({ ...queryContext(), projectId: null })}
                  className="font-medium text-teal hover:underline"
                >
                  Clear project filter
                </a>
              )}
            </p>
          </EmptyPanel>
        )}

        {emptyState === 'filter-empty' && (
          <EmptyPanel title="No memories found">
            {route.importanceMin !== null ||
            route.importanceMax !== null ||
            route.q !== null ||
            route.updatedFrom !== null ||
            route.updatedTo !== null ? (
              <p>
                No memories match the current filters.{' '}
                <a href={clearFiltersHref()} className="font-medium text-teal hover:underline">
                  Clear all filters
                </a>
                .
              </p>
            ) : (
              <p>
                This project has no memories in the current view.{' '}
                <a
                  href={memoriesHref({ ...queryContext(), projectId: null })}
                  className="font-medium text-teal hover:underline"
                >
                  Clear the project filter
                </a>
                .
              </p>
            )}
          </EmptyPanel>
        )}

        {emptyState === 'instance-empty' && (
          <EmptyPanel title="No memories found">
            <p>This instance has no memories available.</p>
          </EmptyPanel>
        )}

        {listState.status === 'ready' && listState.memories.length > 0 && (
          <>
            <div className="min-w-0">
              <table className="w-full table-fixed border-collapse" aria-label="Memories">
                <thead>
                  <tr className="border-b border-line bg-canvas/70 text-left">
                    <SortHeader
                      label="Memory"
                      shortLabel="Mem."
                      column="title"
                      route={route}
                      onSort={handleSort}
                      className="th-label memory-col px-3 sm:px-4"
                    />
                    <SortHeader
                      label="Project"
                      shortLabel="Proj."
                      column="project_name"
                      route={route}
                      onSort={handleSort}
                      className="th-label project-col hidden md:table-cell"
                    />
                    <SortHeader
                      label="Importance"
                      shortLabel="Imp."
                      column="importance"
                      route={route}
                      onSort={handleSort}
                      className="th-label importance-col"
                    />
                    <SortHeader
                      label="Updated"
                      shortLabel="Upd."
                      column="updated_at"
                      route={route}
                      onSort={handleSort}
                      className="th-label updated-col hidden sm:table-cell sm:px-4"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {listState.memories.map((memory) => {
                    const selected = route.memoryId === memory.id
                    const projectLabel = (memory.project_ids ?? [])
                      .map((id) => projectNames.get(id))
                      .filter((name): name is string => Boolean(name))
                      .join(', ')
                    return (
                      <tr
                        key={memory.id}
                        className={selected ? 'bg-teal-soft/50' : 'hover:bg-canvas/70'}
                      >
                        <td className="memory-cell px-3 py-2.5 align-middle sm:px-4">
                          <a
                            href={memoriesHref({
                              memoryId: memory.id,
                              page: route.page,
                              ...queryContext(),
                            })}
                            className="row-link"
                            data-memory-id={memory.id}
                            aria-current={selected ? 'true' : undefined}
                          >
                            {memory.title}
                          </a>
                          <span className="mt-0.5 flex items-center gap-1.5">
                            {(memory.tags ?? []).slice(0, 2).map((tag) => (
                              <span key={tag} className="text-[10px] text-muted">
                                {tag}
                              </span>
                            ))}
                            {memory.is_obsolete && (
                              <span className="text-[10px] font-medium text-copper">Obsolete</span>
                            )}
                          </span>
                        </td>
                        <td
                          className="project-cell hidden truncate py-2.5 text-[11px]
                          text-muted md:table-cell"
                        >
                          {projectLabel || '—'}
                        </td>
                        <td className="importance-cell py-2.5">
                          <span
                            className="chip min-w-7 justify-center bg-canvas text-ink-soft"
                            title={`Importance ${memory.importance} of 10`}
                          >
                            {memory.importance}
                          </span>
                        </td>
                        <td
                          className="updated-cell hidden truncate py-2.5 text-[10px]
                          text-muted sm:table-cell"
                        >
                          <span title={formatDate(memory.updated_at)}>
                            {formatShortDate(memory.updated_at)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="pagination-bar">
              <p className="text-[11px] text-muted">
                Page {route.page} of {totalPages}
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <nav aria-label="Memory pages" className="page-nav">
                  {pages.map((item, index) => {
                    const previous = pages[index - 1]
                    return item === 'gap' ? (
                      <span
                        key={`gap-after-${String(previous)}`}
                        className="page-gap"
                        aria-hidden="true"
                      >
                        …
                      </span>
                    ) : item === route.page ? (
                      <span key={item} className="page-current" aria-current="page">
                        {item}
                      </span>
                    ) : (
                      <a
                        key={item}
                        href={memoriesHref({ page: item, ...queryContext() })}
                        aria-label={`Page ${item}`}
                        className="page-link"
                      >
                        {item}
                      </a>
                    )
                  })}
                </nav>
                <div className="flex items-center gap-1.5">
                  {route.page > 1 ? (
                    <a
                      href={memoriesHref({ page: route.page - 1, ...queryContext() })}
                      className="btn-compact"
                    >
                      <ArrowLeftIcon className="h-3 w-3" />
                      Previous
                    </a>
                  ) : (
                    <span className="btn-disabled">
                      <ArrowLeftIcon className="h-3 w-3" />
                      Previous
                    </span>
                  )}
                  {route.page < totalPages ? (
                    <a
                      href={memoriesHref({ page: route.page + 1, ...queryContext() })}
                      aria-label="Next page"
                      className="btn-compact"
                    >
                      Next
                      <ArrowRightIcon className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="btn-disabled">
                      Next
                      <ArrowRightIcon className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <div data-resize-handle {...pane.handleProps} className="detail-resize-handle">
        <span className="detail-resize-grip" aria-hidden="true" />
      </div>

      <aside
        ref={detailRef}
        id="memory-detail"
        data-memory-detail
        className={`memories-detail panel-raised min-w-0 overflow-hidden ${
          effectiveExpanded ? '' : 'lg:sticky lg:top-4'
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Memory detail
          </p>
          {(route.memoryId !== null || effectiveExpanded) && (
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
        <DetailPane
          state={detailState}
          projects={projects}
          memoryId={route.memoryId}
          route={route}
          onRetry={retry}
        />
      </aside>
    </div>
  )
}
