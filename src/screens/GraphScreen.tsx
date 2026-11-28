import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, getGraphOverview, getNodeDetail, getSubgraph, isAbortError } from '../api/client'
import type {
  GraphNodeRecord,
  GraphNodeType,
  GraphOverviewMeta,
  NodeDetail,
  SubgraphEdge,
  SubgraphResponse,
} from '../api/types'
import { EmptyPanel, ErrorPanel } from '../components/Feedback'
import { AlertIcon, ArrowLeftIcon, RefreshIcon } from '../components/Icons'
import { type CapabilityState, featureState } from '../hooks/useCapabilities'
import { useGraphInspectorClear } from '../hooks/useKeyboardShortcuts'
import { asString, asStringList, nodeNumber } from '../lib/format'
import { graphNodeHref } from '../lib/graphNodeLinks'
import {
  CORE_GRAPH_NODE_TYPES,
  GRAPH_NODE_TYPES,
  isGraphNodeType,
  nodeColorFor,
  nodeTypeLabel,
  normalizeGraphNodeTypes,
  normalizeHiddenGraphNodeTypes,
} from '../lib/graphStyle'
import type { GraphRoute } from '../router'
import { graphHref, memoriesHref, navigate } from '../router'

const GraphCanvas = lazy(() => import('../components/GraphCanvas'))

const MAX_NODES = 100
const OVERVIEW_PAGE_SIZE = 100
const ENTITY_CAP = 10_000
const DETAIL_SKELETON = ['one', 'two', 'three', 'four', 'five'] as const
const OPTIONAL_GRAPH_TYPES = GRAPH_NODE_TYPES.filter(
  (type) => !CORE_GRAPH_NODE_TYPES.includes(type),
)

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

function graphNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isOverviewMeta(value: unknown): value is GraphOverviewMeta {
  if (!value || typeof value !== 'object') return false
  const meta = value as Record<string, unknown>
  return (
    typeof meta.memory_count === 'number' &&
    typeof meta.total_memory_count === 'number' &&
    typeof meta.offset === 'number' &&
    typeof meta.limit === 'number' &&
    typeof meta.has_more === 'boolean'
  )
}

function isOverviewNode(value: unknown): value is GraphNodeRecord {
  if (!value || typeof value !== 'object') return false
  const node = value as Record<string, unknown>
  return (
    typeof node.id === 'string' &&
    typeof node.label === 'string' &&
    typeof node.type === 'string' &&
    isGraphNodeType(node.type) &&
    !!node.data &&
    typeof node.data === 'object'
  )
}

function isOverviewEdge(value: unknown): value is SubgraphEdge {
  if (!value || typeof value !== 'object') return false
  const edge = value as Record<string, unknown>
  return (
    typeof edge.id === 'string' &&
    typeof edge.source === 'string' &&
    typeof edge.target === 'string' &&
    typeof edge.type === 'string'
  )
}

interface OverviewData {
  nodes: GraphNodeRecord[]
  edges: SubgraphEdge[]
  totalMemories: number
  loadedMemories: number
  pages: number
  maxEntityCount: number
}

interface OverviewProgress {
  loadedMemories: number
  totalMemories: number | null
  pages: number
}

type OverviewState =
  | ({ status: 'loading' } & OverviewProgress)
  | { status: 'ready'; data: OverviewData }
  | ({
      status: 'error'
      message: string
    } & OverviewProgress)

async function loadGraphOverview(
  nodeTypes: GraphNodeType[],
  projectId: number | null,
  signal: AbortSignal,
  onProgress: (progress: OverviewProgress) => void,
): Promise<OverviewData> {
  const nodeMap = new Map<string, GraphNodeRecord>()
  const edgeMap = new Map<string, SubgraphEdge>()
  const seenMemoryIds = new Set<string>()
  let offset = 0
  let pages = 0
  let totalMemories = 0
  let maxEntityCount = 0

  for (;;) {
    const response = await getGraphOverview(
      { nodeTypes, projectId, limit: OVERVIEW_PAGE_SIZE, offset },
      signal,
    )
    if (
      !Array.isArray(response.nodes) ||
      !Array.isArray(response.edges) ||
      !isOverviewMeta(response.meta)
    ) {
      throw new Error('The graph overview response was not valid.')
    }
    const meta = response.meta
    if (
      !Number.isInteger(meta.offset) ||
      !Number.isInteger(meta.total_memory_count) ||
      !Number.isInteger(meta.limit) ||
      !Number.isInteger(meta.memory_count) ||
      meta.offset !== offset ||
      meta.limit < 1 ||
      meta.total_memory_count < 0 ||
      meta.memory_count < 0
    ) {
      throw new Error('The graph overview returned inconsistent pagination metadata.')
    }
    const pageMemoryCount = response.nodes.filter((node) => node.type === 'memory').length
    if (pageMemoryCount !== meta.memory_count) {
      throw new Error('The graph overview memory count did not match the page.')
    }
    totalMemories = meta.total_memory_count
    let newMemoryCount = 0
    for (const candidate of response.nodes) {
      if (!isOverviewNode(candidate)) {
        throw new Error('The graph overview contained an invalid node.')
      }
      if (candidate.type === 'memory' && !seenMemoryIds.has(candidate.id)) {
        seenMemoryIds.add(candidate.id)
        newMemoryCount += 1
      }
      if (!nodeMap.has(candidate.id)) nodeMap.set(candidate.id, candidate)
    }
    for (const candidate of response.edges) {
      if (!isOverviewEdge(candidate)) {
        throw new Error('The graph overview contained an invalid connection.')
      }
      if (!edgeMap.has(candidate.id)) edgeMap.set(candidate.id, candidate)
    }
    pages += 1
    maxEntityCount = Math.max(maxEntityCount, graphNumber(meta.entity_count) ?? 0)
    onProgress({
      loadedMemories: seenMemoryIds.size,
      totalMemories,
      pages,
    })

    if (!meta.has_more) break
    if (pageMemoryCount === 0 || newMemoryCount === 0) {
      throw new Error('The graph overview pagination did not advance. Retry the overview.')
    }
    const nextOffset = meta.offset + pageMemoryCount
    if (nextOffset <= offset || nextOffset > totalMemories) {
      throw new Error('The graph overview pagination metadata was inconsistent. Retry.')
    }
    offset = nextOffset
  }

  if (seenMemoryIds.size !== totalMemories) {
    throw new Error(
      `The graph overview loaded ${seenMemoryIds.size} of ${totalMemories} memories. Retry.`,
    )
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
    totalMemories,
    loadedMemories: seenMemoryIds.size,
    pages,
    maxEntityCount,
  }
}

function projectIdFromData(node: GraphNodeRecord): number | null {
  return graphNumber(node.data.project_id)
}

function scopeOverviewData(
  data: OverviewData,
  projectId: number | null,
): { nodes: GraphNodeRecord[]; edges: SubgraphEdge[] } {
  if (projectId === null) {
    const ids = new Set(data.nodes.map((node) => node.id))
    return {
      nodes: data.nodes,
      edges: data.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
    }
  }

  const projectNodeId = `project_${projectId}`
  const planIds = new Set(
    data.nodes
      .filter((node) => node.type === 'plan' && projectIdFromData(node) === projectId)
      .map((node) => node.id),
  )
  const projectLinkedIds = new Set<string>()
  for (const edge of data.edges) {
    if (edge.target === projectNodeId) projectLinkedIds.add(edge.source)
    else if (edge.source === projectNodeId) projectLinkedIds.add(edge.target)
  }
  const keep = new Set<string>()

  for (const node of data.nodes) {
    let include = false
    if (node.type === 'memory') include = true
    else if (node.type === 'project') include = node.id === projectNodeId
    else if (node.type === 'entity') include = projectLinkedIds.has(node.id)
    else if (node.type === 'document' || node.type === 'code_artifact') {
      include = projectLinkedIds.has(node.id)
    } else if (node.type === 'task') {
      const planId = graphNumber(node.data.plan_id)
      include = planId !== null && planIds.has(`plan_${planId}`)
    } else {
      include = projectIdFromData(node) === projectId
    }
    if (include) keep.add(node.id)
  }

  return {
    nodes: data.nodes.filter((node) => keep.has(node.id)),
    edges: data.edges.filter((edge) => keep.has(edge.source) && keep.has(edge.target)),
  }
}

function useNodeDetail(
  selectedNode: GraphNodeRecord | null,
  refreshToken: number,
): { state: NodeDetailState; retry: () => void } {
  const [detailState, setDetailState] = useState<NodeDetailState>({ status: 'idle' })
  const [detailToken, setDetailToken] = useState(0)
  const nodeId = selectedNode?.id ?? null
  const nodeType = selectedNode?.type ?? null
  const numericId = nodeId === null ? null : nodeNumber(nodeId)

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh/detail tokens reload
  useEffect(() => {
    if (nodeId === null || nodeType === null || numericId === null) {
      setDetailState({ status: 'idle' })
      return
    }
    const controller = new AbortController()
    let active = true
    setDetailState({ status: 'loading' })
    getNodeDetail(nodeType, numericId, controller.signal)
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
  }, [nodeId, nodeType, numericId, refreshToken, detailToken])

  return { state: detailState, retry: () => setDetailToken((value) => value + 1) }
}

function featureForType(type: GraphNodeType): 'planning' | 'skills' | 'files' | null {
  if (type === 'plan' || type === 'task') return 'planning'
  if (type === 'skill') return 'skills'
  if (type === 'file') return 'files'
  return null
}

function typeDisabledByCapability(type: GraphNodeType, capabilities: CapabilityState): boolean {
  const feature = featureForType(type)
  if (feature === null) return false
  return featureState(capabilities, feature) === 'disabled'
}

function typeDisabledReason(
  type: GraphNodeType,
  capabilities: CapabilityState,
  projectId: number | null,
  effectiveTypes: GraphNodeType[],
): string | null {
  if (capabilities.status === 'loading') return 'Checking availability…'
  if (typeDisabledByCapability(type, capabilities)) return 'Unavailable on this instance'
  if (type === 'task' && projectId !== null && !effectiveTypes.includes('plan')) {
    return 'Select Plans to scope tasks by project'
  }
  return null
}

function GraphViewBody({
  nodes,
  edges,
  selectedId,
  onSelect,
  centerId,
  detailState,
  onRetryDetail,
  focusHref,
  hiddenEdgeCount = 0,
}: {
  nodes: GraphNodeRecord[]
  edges: SubgraphEdge[]
  selectedId: string | null
  onSelect: (id: string) => void
  centerId?: string
  detailState: NodeDetailState
  onRetryDetail: () => void
  focusHref?: (node: GraphNodeRecord) => string
  hiddenEdgeCount?: number
}) {
  const selectedNode = nodes.find((node) => node.id === selectedId) ?? null
  const resourceLink = selectedNode ? graphNodeHref(selectedNode) : null
  const types = Array.from(new Set(nodes.map((node) => node.type)))

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <section className="graph-panel">
        <div className="h-[420px] sm:h-[500px] lg:h-[calc(100dvh-280px)] lg:min-h-[420px]">
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
              edges={edges}
              selectedId={selectedId}
              centerId={centerId ?? null}
              onSelect={onSelect}
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
            <>
              <NodeDetailPanel
                state={detailState}
                nodeLabel={selectedNode.label}
                nodeType={selectedNode.type}
                onRetry={onRetryDetail}
              />
              {resourceLink && (
                <div className="border-t border-line p-3">
                  <a href={resourceLink.href} className="btn-secondary">
                    {resourceLink.label}
                  </a>
                </div>
              )}
              {focusHref && selectedNode.type === 'memory' && (
                <div className="border-t border-line p-3">
                  <a href={focusHref(selectedNode)} className="btn-secondary">
                    Focus neighbourhood
                  </a>
                </div>
              )}
            </>
          ) : (
            <div className="p-4 text-[12px] text-muted">Select a node to inspect its record.</div>
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
              const selected = node.id === selectedId
              const depth = typeof node.depth === 'number' ? ` · d${node.depth}` : ''
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(node.id)}
                    aria-pressed={selected}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5
                      text-left text-[11px] ${
                        selected ? 'bg-teal-soft text-teal-ink' : 'text-ink-soft hover:bg-canvas'
                      }`}
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: nodeColorFor(node.type) }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate">{node.label}</span>
                    <span className="shrink-0 text-[9px] uppercase tracking-[0.08em] text-muted">
                      {nodeTypeLabel(node.type)}
                      {depth}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {hiddenEdgeCount > 0 && (
            <p className="border-t border-line px-3 py-2 text-[10px] text-muted">
              {hiddenEdgeCount} edge{hiddenEdgeCount === 1 ? '' : 's'} hidden because an endpoint is
              outside this view.
            </p>
          )}
        </section>
      </aside>
    </div>
  )
}

function OverviewGraphView({
  route,
  capabilities,
  retryCapabilities,
}: {
  route: GraphRoute
  capabilities: CapabilityState
  retryCapabilities: () => void
}) {
  const [overviewState, setOverviewState] = useState<OverviewState>({
    status: 'loading',
    loadedMemories: 0,
    totalMemories: null,
    pages: 0,
  })
  const [refreshToken, setRefreshToken] = useState(0)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const clearNodeSelection = useCallback(() => setSelectedNodeId(null), [])
  useGraphInspectorClear(clearNodeSelection)

  const capabilityResolved = capabilities.status !== 'loading'
  const effectiveTypes = useMemo(() => {
    let types = normalizeGraphNodeTypes(route.nodeTypes)
    types = types.filter((type) => !typeDisabledByCapability(type, capabilities))
    if (route.projectId !== null && types.includes('task') && !types.includes('plan')) {
      types = types.filter((type) => type !== 'task')
    }
    return types
  }, [route.nodeTypes, route.projectId, capabilities])
  const typeKey = effectiveTypes.join(',')

  // biome-ignore lint/correctness/useExhaustiveDependencies: route/capability/type changes reload
  useEffect(() => {
    if (!capabilityResolved) {
      setOverviewState({
        status: 'loading',
        loadedMemories: 0,
        totalMemories: null,
        pages: 0,
      })
      return
    }
    const controller = new AbortController()
    let active = true
    let latestProgress: OverviewProgress = {
      loadedMemories: 0,
      totalMemories: null,
      pages: 0,
    }
    setOverviewState({ status: 'loading', ...latestProgress })
    loadGraphOverview(effectiveTypes, route.projectId, controller.signal, (progress) => {
      latestProgress = progress
      if (active && !controller.signal.aborted) {
        setOverviewState({ status: 'loading', ...progress })
      }
    })
      .then((data) => {
        if (!active || controller.signal.aborted) return
        setOverviewState({ status: 'ready', data })
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbortError(error)) return
        setOverviewState({
          status: 'error',
          message: errorMessage(error),
          ...latestProgress,
        })
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [route.projectId, typeKey, refreshToken, capabilityResolved])

  const rawData = overviewState.status === 'ready' ? overviewState.data : null
  const scoped = useMemo(
    () =>
      rawData
        ? scopeOverviewData(rawData, route.projectId)
        : { nodes: [] as GraphNodeRecord[], edges: [] as SubgraphEdge[] },
    [rawData, route.projectId],
  )
  const display = useMemo(() => {
    const hidden = new Set(route.hiddenNodeTypes)
    const nodes = scoped.nodes.filter((node) => !hidden.has(node.type))
    const ids = new Set(nodes.map((node) => node.id))
    return {
      nodes,
      edges: scoped.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
    }
  }, [scoped, route.hiddenNodeTypes])
  const visibilityEmpty =
    overviewState.status === 'ready' && display.nodes.length === 0 && scoped.nodes.length > 0
  const selectedNode = display.nodes.find((node) => node.id === selectedNodeId) ?? null
  const detail = useNodeDetail(selectedNode, refreshToken)

  useEffect(() => {
    setSelectedNodeId((current) =>
      current && display.nodes.some((node) => node.id === current) ? current : null,
    )
  }, [display.nodes])

  const projectNodes = rawData
    ? rawData.nodes
        .filter((node) => node.type === 'project')
        .sort((left, right) => left.label.localeCompare(right.label))
    : []
  const projectIsKnown = projectNodes.some((node) => node.id === `project_${route.projectId}`)
  const memoryCount = display.nodes.filter((node) => node.type === 'memory').length
  const projectCount = display.nodes.filter((node) => node.type === 'project').length
  const unavailableSelectedTypes = route.nodeTypes.filter((type) => !effectiveTypes.includes(type))
  const entityCapped =
    effectiveTypes.includes('entity') && (rawData?.maxEntityCount ?? 0) >= ENTITY_CAP

  function updateRoute(params: {
    nodeTypes?: GraphNodeType[]
    projectId?: number | null
    hiddenNodeTypes?: GraphNodeType[]
  }): void {
    const nextTypes = params.nodeTypes ?? effectiveTypes
    const hidden =
      params.hiddenNodeTypes === undefined ? route.hiddenNodeTypes : params.hiddenNodeTypes
    navigate(
      graphHref({
        page: route.page,
        projectId: params.projectId === undefined ? route.projectId : params.projectId,
        nodeTypes: nextTypes,
        hiddenNodeTypes: normalizeHiddenGraphNodeTypes(hidden),
        sortBy: route.sortBy,
        sortOrder: route.sortOrder,
        importanceMin: route.importanceMin,
      }),
    )
  }

  function setCoreVisible(type: GraphNodeType, visible: boolean): void {
    const hidden = new Set(route.hiddenNodeTypes)
    if (visible) hidden.delete(type)
    else hidden.add(type)
    updateRoute({ hiddenNodeTypes: Array.from(hidden) })
  }

  function toggleType(type: GraphNodeType, checked: boolean): void {
    let next = checked
      ? normalizeGraphNodeTypes([...effectiveTypes, type])
      : effectiveTypes.filter((candidate) => candidate !== type)
    if (!checked && type === 'plan') {
      next = next.filter((candidate) => candidate !== 'task')
    }
    updateRoute({ nodeTypes: next })
  }

  const overviewNotice = (
    <div className="notice-warn">
      <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>
        Some connections between memories may be missing until Forgetful #221 is fixed. Each memory
        page only includes links whose endpoints are on that page. Stored links are not lost.
      </p>
    </div>
  )

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="rounded-md border border-line bg-panel px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={memoriesHref({
              page: route.page,
              projectId: route.projectId,
              sortBy: route.sortBy,
              sortOrder: route.sortOrder,
              importanceMin: route.importanceMin,
            })}
            className="btn-secondary"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Back to memories
          </a>
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-ink">Graph overview</h2>
            <p className="text-[10px] text-muted">
              {overviewState.status === 'ready'
                ? `${memoryCount} ${memoryCount === 1 ? 'memory' : 'memories'} · ${projectCount} ${
                    projectCount === 1 ? 'project' : 'projects'
                  } · ${display.edges.length} ${
                    display.edges.length === 1 ? 'edge' : 'edges'
                  } · ${display.nodes.length} nodes`
                : overviewState.status === 'loading'
                  ? `Loaded ${overviewState.loadedMemories} of ${
                      overviewState.totalMemories ?? '…'
                    } memories`
                  : 'Overview load incomplete'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshToken((value) => value + 1)}
            aria-label="Refresh overview"
            className="btn-secondary ml-auto"
          >
            <RefreshIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3">
          <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
            Project filter
            <select
              value={route.projectId ?? ''}
              onChange={(event) =>
                updateRoute({ projectId: event.target.value ? Number(event.target.value) : null })
              }
              className="field mt-1 block"
              aria-label="Project filter"
            >
              <option value="">All projects</option>
              {projectNodes.map((node) => (
                <option key={node.id} value={node.id.replace('project_', '')}>
                  {node.label}
                </option>
              ))}
              {route.projectId !== null && !projectIsKnown && (
                <option value={route.projectId}>Project #{route.projectId}</option>
              )}
            </select>
          </label>

          <fieldset className="min-w-0">
            <legend className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
              Node types
            </legend>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1.5">
              {CORE_GRAPH_NODE_TYPES.map((type) => (
                <label key={type} className="inline-flex items-center gap-1.5 text-[11px]">
                  <input
                    type="checkbox"
                    checked={!route.hiddenNodeTypes.includes(type)}
                    onChange={(event) => setCoreVisible(type, event.target.checked)}
                    aria-label={nodeTypeLabel(type)}
                  />
                  {nodeTypeLabel(type)}
                </label>
              ))}
              {OPTIONAL_GRAPH_TYPES.map((type) => {
                const reason = typeDisabledReason(
                  type,
                  capabilities,
                  route.projectId,
                  effectiveTypes,
                )
                const checked = effectiveTypes.includes(type)
                return (
                  <label
                    key={type}
                    className={`inline-flex items-center gap-1.5 text-[11px] ${
                      reason ? 'text-muted' : 'text-ink-soft'
                    }`}
                    title={reason ?? undefined}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={reason !== null}
                      onChange={(event) => toggleType(type, event.target.checked)}
                      aria-label={`Include ${nodeTypeLabel(type)}`}
                    />
                    {nodeTypeLabel(type)}
                  </label>
                )
              })}
            </div>
          </fieldset>
        </div>

        <p className="mt-2 text-[10px] leading-relaxed text-muted">
          Memory and Project are shown by default. Unchecking one hides those loaded nodes from this
          view and its counts; summaries stay available for filtering. The project filter applies to
          memories in the API. Other node types are scoped after loading by their returned project
          links. Tasks require Plans when filtering by project.
        </p>
        {unavailableSelectedTypes.length > 0 && (
          <p className="mt-1 text-[10px] text-warn-ink">
            Some selected node types are unavailable or need Plans on this instance and were not
            requested.
          </p>
        )}
        {entityCapped && (
          <p className="mt-1 text-[10px] text-warn-ink">
            Entity results are capped at 10,000 by the API; some entities may be missing.
          </p>
        )}
        {capabilities.status === 'unknown' && (
          <p className="mt-1 text-[10px] text-warn-ink">
            Optional feature status is unknown. Optional node types remain available.{' '}
            <button type="button" onClick={retryCapabilities} className="font-medium underline">
              Retry status
            </button>
          </p>
        )}
      </div>

      {overviewNotice}

      {overviewState.status === 'loading' && (
        <div className="rounded-md border border-line bg-panel p-5" aria-busy="true">
          <p className="text-[12px] font-medium text-ink">Loading graph overview…</p>
          <p className="mt-1 text-[11px] text-muted">
            Loaded {overviewState.loadedMemories} of {overviewState.totalMemories ?? '…'} memories
            {' · '}page {overviewState.pages || 0}. Links between memories are only included when
            both endpoints are on the same page.
          </p>
        </div>
      )}

      {overviewState.status === 'error' && (
        <div className="rounded-md border border-line bg-panel">
          <ErrorPanel
            title="Could not finish loading overview"
            message={`${overviewState.message} Loaded ${overviewState.loadedMemories} of ${
              overviewState.totalMemories ?? '…'
            } memories before the failure.`}
            onRetry={() => setRefreshToken((value) => value + 1)}
          />
        </div>
      )}

      {overviewState.status === 'ready' &&
        (display.nodes.length === 0 ? (
          visibilityEmpty ? (
            <EmptyPanel title="No visible nodes">
              <p>
                The loaded records are hidden by the current Memory/Project visibility settings.
                Restore a node type to show them again.
              </p>
            </EmptyPanel>
          ) : (
            <EmptyPanel title="No graph records">
              <p>No memories or projects match this overview filter.</p>
            </EmptyPanel>
          )
        ) : (
          <GraphViewBody
            nodes={display.nodes}
            edges={display.edges}
            selectedId={selectedNodeId}
            onSelect={setSelectedNodeId}
            detailState={detail.state}
            onRetryDetail={detail.retry}
            focusHref={(node) =>
              graphHref({
                memoryId: nodeNumber(node.id),
                depth: 1,
                page: route.page,
                projectId: route.projectId,
                nodeTypes: effectiveTypes,
                hiddenNodeTypes: route.hiddenNodeTypes,
                sortBy: route.sortBy,
                sortOrder: route.sortOrder,
                importanceMin: route.importanceMin,
              })
            }
          />
        ))}
    </div>
  )
}

function FocusedGraphView({ route, memoryId }: { route: GraphRoute; memoryId: number }) {
  const [graphState, setGraphState] = useState<GraphState>({ status: 'loading' })
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const clearNodeSelection = useCallback(() => setSelectedNodeId(null), [])
  useGraphInspectorClear(clearNodeSelection)
  const [refreshToken, setRefreshToken] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshToken triggers a reload
  useEffect(() => {
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
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null
  const detail = useNodeDetail(selectedNode, refreshToken)
  const visibleEdges = useMemo(() => {
    if (graphState.status !== 'ready') return []
    const ids = new Set(graphState.data.nodes.map((node) => node.id))
    return graphState.data.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
  }, [graphState])
  const hiddenEdgeCount =
    graphState.status === 'ready' ? graphState.data.edges.length - visibleEdges.length : 0
  const centerId = `memory_${memoryId}`
  const overviewHref = graphHref({
    page: route.page,
    projectId: route.projectId,
    nodeTypes: route.nodeTypes,
    hiddenNodeTypes: route.hiddenNodeTypes,
    sortBy: route.sortBy,
    sortOrder: route.sortOrder,
    importanceMin: route.importanceMin,
  })

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
          <a href={overviewHref} className="btn-secondary">
            Overview
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
                      nodeTypes: route.nodeTypes,
                      hiddenNodeTypes: route.hiddenNodeTypes,
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
          <GraphViewBody
            nodes={nodes}
            edges={visibleEdges}
            selectedId={selectedNodeId}
            onSelect={setSelectedNodeId}
            centerId={centerId}
            detailState={detail.state}
            onRetryDetail={detail.retry}
            hiddenEdgeCount={hiddenEdgeCount}
          />
        </>
      )}
    </div>
  )
}

export default function GraphScreen({
  route,
  capabilities,
  retryCapabilities,
}: {
  route: GraphRoute
  capabilities: CapabilityState
  retryCapabilities: () => void
}) {
  if (route.memoryId === null) {
    return (
      <OverviewGraphView
        route={route}
        capabilities={capabilities}
        retryCapabilities={retryCapabilities}
      />
    )
  }
  return <FocusedGraphView route={route} memoryId={route.memoryId} />
}
