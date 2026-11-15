import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ApiError, getNodeDetail, getSubgraph, isAbortError } from '../api/client'
import type { GraphNodeType, NodeDetail, SubgraphResponse } from '../api/types'
import { ErrorPanel } from '../components/Feedback'
import { AlertIcon, ArrowLeftIcon, RefreshIcon } from '../components/Icons'
import { asString, asStringList, nodeNumber } from '../lib/format'
import { nodeColorFor, nodeTypeLabel } from '../lib/graphStyle'
import type { GraphRoute } from '../router'
import { graphHref, memoriesHref } from '../router'

const GraphCanvas = lazy(() => import('../components/GraphCanvas'))

const MAX_NODES = 100
const DETAIL_SKELETON = ['one', 'two', 'three', 'four', 'five'] as const

type GraphState =
  | { status: 'loading' }
  | { status: 'ready'; data: SubgraphResponse }
  | { status: 'missing' }
  | { status: 'error'; message: string }

type NodeDetailState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; detail: NodeDetail }
  | { status: 'missing' }
  | { status: 'error'; message: string }

const detailFields: Record<GraphNodeType, string[]> = {
  memory: ['importance', 'content', 'context', 'tags', 'keywords', 'source_repo'],
  entity: ['entity_type', 'custom_type', 'notes', 'tags', 'aka'],
  project: ['description', 'status', 'project_type', 'repo_name', 'memory_count'],
  document: ['document_type', 'description', 'content', 'tags', 'source_files'],
  code_artifact: ['language', 'description', 'code', 'tags'],
  file: ['filename', 'mime_type', 'size_bytes', 'tags', 'description'],
  skill: ['description', 'content', 'tags'],
  plan: ['goal', 'context', 'status', 'project_id', 'external_ref', 'task_count'],
  task: ['state', 'priority', 'description', 'assigned_agent', 'plan_id', 'version'],
}

const longFields = new Set(['content', 'code', 'description', 'notes', 'context', 'goal'])

function fieldLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request failed.'
}

function DetailValue({ field, value }: { field: string; value: unknown }) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return <>{value ? 'Yes' : 'No'}</>
  if (typeof value === 'number') return <>{String(value)}</>
  if (Array.isArray(value)) {
    const items = asStringList(value)
    return <>{items.length > 0 ? items.join(', ') : '—'}</>
  }
  if (typeof value === 'object') return null
  const text = String(value)
  if (longFields.has(field) && text.length > 120) {
    return <span className="detail-long-value">{text}</span>
  }
  return <>{text}</>
}

function detailHeading(detail: NodeDetail, fallback: string): string {
  return asString(detail.title) ?? asString(detail.name) ?? asString(detail.filename) ?? fallback
}

function NodeDetailPanel({
  state,
  nodeLabel,
  nodeType,
  onRetry,
}: {
  state: NodeDetailState
  nodeLabel: string
  nodeType: GraphNodeType
  onRetry: () => void
}) {
  if (state.status === 'loading') {
    return (
      <div className="p-4" aria-busy="true">
        <span className="sr-only">Loading node detail…</span>
        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-slate-200/70" />
        <div className="mt-5 space-y-2">
          {DETAIL_SKELETON.map((row) => (
            <div key={row} className="h-3 animate-pulse rounded bg-slate-200/60" />
          ))}
        </div>
      </div>
    )
  }

  if (state.status === 'missing') {
    return (
      <div className="p-4">
        <p className="text-[13px] font-semibold text-copper">Node not found</p>
        <p className="mt-1 text-[12px] text-muted">
          The selected record is unavailable. It may have been deleted.
        </p>
        <button type="button" onClick={onRetry} className="mt-3 text-[12px] font-medium text-teal">
          Try again
        </button>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="p-3">
        <ErrorPanel title="Could not load node" message={state.message} onRetry={onRetry} />
      </div>
    )
  }

  if (state.status !== 'ready') return null

  const detail = state.detail
  const fields = detailFields[nodeType].filter((field) => field in detail)
  const heading = detailHeading(detail, nodeLabel)

  return (
    <div className="p-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
        {nodeTypeLabel(nodeType)} detail
      </p>
      <h3 className="mt-1.5 break-words text-[15px] font-semibold leading-snug text-ink">
        {heading}
      </h3>
      <dl className="mt-3">
        {fields.map((field) => {
          const rendered = <DetailValue field={field} value={detail[field]} />
          if (rendered === null) return null
          return (
            <div key={field} className="border-b border-line/80 py-2 last:border-0">
              <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                {fieldLabel(field)}
              </dt>
              <dd className="mt-0.5 break-words text-[12px] text-ink-soft">{rendered}</dd>
            </div>
          )
        })}
      </dl>
      {fields.length === 0 && (
        <p className="mt-3 text-[12px] text-muted">No further fields were returned.</p>
      )}
    </div>
  )
}

function Legend({ types }: { types: string[] }) {
  if (types.length === 0) return null
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-white/10
      px-3 py-2"
    >
      {types.map((type) => (
        <span key={type} className="inline-flex items-center gap-1.5 text-[10px] text-slate-300">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: nodeColorFor(type) }}
            aria-hidden="true"
          />
          {nodeTypeLabel(type)}
        </span>
      ))}
      <span className="ml-auto text-[10px] text-slate-400">Drag · scroll to zoom</span>
    </div>
  )
}

export default function GraphScreen({ route }: { route: GraphRoute }) {
  const [graphState, setGraphState] = useState<GraphState>({ status: 'loading' })
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [detailState, setDetailState] = useState<NodeDetailState>({ status: 'idle' })
  const [refreshToken, setRefreshToken] = useState(0)
  const [detailToken, setDetailToken] = useState(0)

  const memoryId = route.memoryId

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshToken triggers a reload
  useEffect(() => {
    if (memoryId === null) return

    const controller = new AbortController()
    let active = true

    setGraphState({ status: 'loading' })
    getSubgraph({ memoryId, depth: route.depth, maxNodes: MAX_NODES }, controller.signal)
      .then((data) => {
        if (!active || controller.signal.aborted) return
        if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
          setGraphState({ status: 'error', message: 'The graph response was not valid.' })
          return
        }
        const center = `memory_${memoryId}`
        setGraphState({ status: 'ready', data })
        setSelectedNodeId((current) =>
          current && data.nodes.some((node) => node.id === current) ? current : center,
        )
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbortError(error)) return
        if (error instanceof ApiError && error.status === 404) {
          setGraphState({ status: 'missing' })
          return
        }
        setGraphState({ status: 'error', message: errorMessage(error) })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [memoryId, route.depth, refreshToken])

  const nodes = graphState.status === 'ready' ? graphState.data.nodes : []
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )
  const numericSelectedId = selectedNode ? nodeNumber(selectedNode.id) : null

  // biome-ignore lint/correctness/useExhaustiveDependencies: detail/reload tokens trigger a reload
  useEffect(() => {
    if (!selectedNode || numericSelectedId === null) {
      setDetailState({ status: 'idle' })
      return
    }

    const controller = new AbortController()
    let active = true

    setDetailState({ status: 'loading' })
    getNodeDetail(selectedNode.type, numericSelectedId, controller.signal)
      .then((detail) => {
        if (!active || controller.signal.aborted) return
        setDetailState({ status: 'ready', detail })
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbortError(error)) return
        if (error instanceof ApiError && error.status === 404) {
          setDetailState({ status: 'missing' })
          return
        }
        setDetailState({ status: 'error', message: errorMessage(error) })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [numericSelectedId, selectedNode, detailToken, refreshToken])

  const visibleEdges = useMemo(() => {
    if (graphState.status !== 'ready') return []
    const ids = new Set(graphState.data.nodes.map((node) => node.id))
    return graphState.data.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
  }, [graphState])

  if (memoryId === null) {
    return (
      <div className="p-4 sm:p-5">
        <div className="rounded-md border border-line bg-panel p-6 sm:p-8">
          <p className="text-[14px] font-semibold text-ink">Choose a memory to explore</p>
          <p className="mt-2 max-w-lg text-[12px] leading-relaxed text-muted">
            The graph loads a bounded neighbourhood around one memory. Open a memory from the list
            and use its graph link, or return to the list to choose one.
          </p>
          <a href={memoriesHref({})} className="btn-secondary mt-4">
            Browse memories
          </a>
        </div>
      </div>
    )
  }

  const hiddenEdgeCount =
    graphState.status === 'ready' ? graphState.data.edges.length - visibleEdges.length : 0
  const types = Array.from(new Set(nodes.map((node) => node.type)))
  const centerId = `memory_${memoryId}`

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="rounded-md border border-line bg-panel px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={memoriesHref({
              memoryId,
              page: route.page,
              projectId: route.projectId,
              sortBy: route.sortBy,
              sortOrder: route.sortOrder,
              importanceMin: route.importanceMin,
            })}
            className="btn-secondary"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Back to memory
          </a>
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-semibold text-ink">
              Graph around memory #{memoryId}
            </h2>
            <p className="text-[10px] text-muted">
              {graphState.status === 'ready'
                ? `${nodes.length} nodes · ${visibleEdges.length} edges · depth ${route.depth}`
                : 'Bounded neighbourhood'}
            </p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
              Depth
            </span>
            <nav
              aria-label="Graph depth"
              className="flex overflow-hidden rounded border border-line"
            >
              {[1, 2, 3].map((depth) => {
                const active = route.depth === depth
                return (
                  <a
                    key={depth}
                    href={graphHref({
                      memoryId,
                      depth,
                      page: route.page,
                      projectId: route.projectId,
                      sortBy: route.sortBy,
                      sortOrder: route.sortOrder,
                      importanceMin: route.importanceMin,
                    })}
                    aria-current={active ? 'page' : undefined}
                    aria-label={`Depth ${depth}`}
                    className={`px-2.5 py-1 text-[11px] font-medium ${
                      active
                        ? 'bg-teal-soft text-teal-ink'
                        : 'bg-panel text-muted hover:bg-canvas hover:text-ink'
                    }`}
                  >
                    {depth}
                  </a>
                )
              })}
            </nav>
            <button
              type="button"
              onClick={() => setRefreshToken((value) => value + 1)}
              aria-label="Refresh graph"
              title="Refresh graph"
              className="btn-secondary"
            >
              <RefreshIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {graphState.status === 'loading' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]" aria-busy="true">
          <div className="h-[420px] animate-pulse rounded-md border border-line bg-sidebar/95" />
          <div className="h-64 animate-pulse rounded-md border border-line bg-panel" />
          <span className="sr-only">Loading graph…</span>
        </div>
      )}

      {graphState.status === 'missing' && (
        <div className="rounded-md border border-copper/25 bg-copper-soft/60 p-5">
          <p className="text-[13px] font-semibold text-copper">Memory not found</p>
          <p className="mt-1 text-[12px] text-ink-soft">
            Memory #{memoryId} is unavailable, so no graph can be loaded.
          </p>
          <a
            href={memoriesHref({})}
            className="mt-3 inline-block text-[12px] font-medium text-teal"
          >
            Return to memories
          </a>
        </div>
      )}

      {graphState.status === 'error' && (
        <div className="rounded-md border border-line bg-panel">
          <ErrorPanel
            title="Could not load graph"
            message={graphState.message}
            onRetry={() => setRefreshToken((value) => value + 1)}
          />
        </div>
      )}

      {graphState.status === 'ready' && (
        <>
          {graphState.data.meta.truncated && (
            <div className="notice-warn">
              <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                The node limit was reached, so this view is incomplete. Choose a nearby node or a
                lower depth to inspect a smaller neighbourhood.
              </p>
            </div>
          )}

          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <section className="graph-panel">
              <div className="h-[420px] sm:h-[500px] lg:h-[calc(100dvh-240px)] lg:min-h-[420px]">
                <Suspense
                  fallback={
                    <div
                      className="flex h-full items-center justify-center text-[12px]
                      text-sidebar-muted"
                    >
                      Loading graph library…
                    </div>
                  }
                >
                  <GraphCanvas
                    nodes={nodes}
                    edges={visibleEdges}
                    selectedId={selectedNodeId}
                    centerId={centerId}
                    onSelect={setSelectedNodeId}
                  />
                </Suspense>
              </div>
              <Legend types={types} />
            </section>

            <aside className="min-w-0 space-y-4 lg:sticky lg:top-4">
              <section className="overflow-hidden rounded-md border border-line bg-panel">
                <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                    Node detail
                  </p>
                  {selectedNode && (
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        color: nodeColorFor(selectedNode.type),
                        backgroundColor: '#16232e',
                      }}
                    >
                      {nodeTypeLabel(selectedNode.type)}
                    </span>
                  )}
                </div>
                {selectedNode ? (
                  <NodeDetailPanel
                    state={detailState}
                    nodeLabel={selectedNode.label}
                    nodeType={selectedNode.type}
                    onRetry={() => setDetailToken((value) => value + 1)}
                  />
                ) : (
                  <div className="p-4 text-[12px] text-muted">
                    Select a node to inspect its record.
                  </div>
                )}
              </section>

              <section className="overflow-hidden rounded-md border border-line bg-panel">
                <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                    Nodes in this view
                  </p>
                  <span className="text-[10px] text-muted">{nodes.length}</span>
                </div>
                <ul className="max-h-64 overflow-y-auto p-1.5" aria-label="Nodes in this graph">
                  {nodes.map((node) => {
                    const selected = node.id === selectedNodeId
                    return (
                      <li key={node.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedNodeId(node.id)}
                          aria-pressed={selected}
                          className={`flex w-full items-center gap-2 rounded px-2 py-1.5
                            text-left text-[11px] ${
                              selected
                                ? 'bg-teal-soft text-teal-ink'
                                : 'text-ink-soft hover:bg-canvas'
                            }`}
                        >
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: nodeColorFor(node.type) }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate">{node.label}</span>
                          <span
                            className="shrink-0 text-[9px] uppercase tracking-[0.08em]
                            text-muted"
                          >
                            {nodeTypeLabel(node.type)} · d{node.depth}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {hiddenEdgeCount > 0 && (
                  <p className="border-t border-line px-3 py-2 text-[10px] text-muted">
                    {hiddenEdgeCount} edge{hiddenEdgeCount === 1 ? '' : 's'} hidden because an
                    endpoint is outside this view.
                  </p>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  )
}
