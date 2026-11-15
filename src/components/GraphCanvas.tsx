import type { ReactHTMLElement } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ForceGraphMethods, LinkObject, NodeObject } from 'react-force-graph-2d'
import ForceGraph2D from 'react-force-graph-2d'
import type { GraphNodeRecord, SubgraphEdge } from '../api/types'
import { nodeColorFor } from '../lib/graphStyle'

interface GraphNode extends NodeObject {
  id: string
  type: string
  label: string
  importance: number
}

interface GraphLink extends LinkObject {
  id: string
  type: string
}

interface GraphCanvasProps {
  nodes: GraphNodeRecord[]
  edges: SubgraphEdge[]
  selectedId: string | null
  centerId: string | null
  onSelect: (id: string) => void
}

function importanceFrom(node: GraphNodeRecord): number {
  const value = node.data.importance
  return typeof value === 'number' && Number.isFinite(value) ? value : 5
}

function nodeRadius(node: GraphNode): number {
  if (node.type === 'memory') return 4.5 + Math.max(0, Math.min(10, node.importance)) * 0.45
  if (node.type === 'project') return 9
  return 4.5
}

function drawRadius(node: GraphNode, globalScale: number): number {
  const minimumScreenRadius = node.type === 'project' ? 4.5 : 2.2
  return Math.max(nodeRadius(node), minimumScreenRadius / Math.max(globalScale, 0.001))
}

function endpointId(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' || typeof id === 'number' ? String(id) : null
  }
  return null
}

function shorten(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value
}

function safeTooltipLabel(node: GraphNode): ReactHTMLElement<HTMLElement> {
  // The graph library accepts a DOM element and appends it without parsing HTML.
  const element = document.createElement('span')
  element.textContent = `${node.label} · ${node.type}`
  return element as unknown as ReactHTMLElement<HTMLElement>
}

export default function GraphCanvas({
  nodes,
  edges,
  selectedId,
  centerId,
  onSelect,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined)
  const autoFitPending = useRef(true)
  const configuredData = useRef<typeof graphData | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize({ width: Math.max(1, Math.floor(width)), height: Math.max(1, Math.floor(height)) })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const graphData = useMemo(
    () => ({
      nodes: nodes.map((node) => ({
        ...node,
        id: node.id,
        label: node.label,
        type: node.type,
        importance: importanceFrom(node),
      })),
      links: edges.map((edge) => ({
        ...edge,
        id: edge.id,
        source: edge.source,
        target: edge.target,
      })),
    }),
    [nodes, edges],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new dataset starts a new fit
  useEffect(() => {
    autoFitPending.current = true
    setHoveredId(null)
    if (containerRef.current) containerRef.current.dataset.graphEngine = 'running'
  }, [graphData])

  useEffect(() => {
    const graph = graphRef.current
    if (!graph || graphData.nodes.length === 0 || size.width === 0 || size.height === 0) return
    if (configuredData.current === graphData) return
    configuredData.current = graphData
    const charge = graph.d3Force('charge')
    charge?.strength?.(-320)
    const link = graph.d3Force('link') as { distance?: (value: number) => void } | undefined
    link?.distance?.(150)
    graph.d3ReheatSimulation()
  }, [graphData, size.width, size.height])

  const activeId = hoveredId ?? selectedId
  const highlightedNodeIds = useMemo(() => {
    const ids = new Set<string>()
    if (activeId === null) return ids
    ids.add(activeId)
    for (const edge of edges) {
      const source = endpointId(edge.source)
      const target = endpointId(edge.target)
      if (source === activeId || target === activeId) {
        if (source !== null) ids.add(source)
        if (target !== null) ids.add(target)
      }
    }
    return ids
  }, [activeId, edges])

  function linkIsActive(link: GraphLink): boolean {
    if (activeId === null) return false
    return endpointId(link.source) === activeId || endpointId(link.target) === activeId
  }

  const drawNode = useMemo(
    () =>
      (node: GraphNode, context: CanvasRenderingContext2D, globalScale: number): void => {
        const x = node.x ?? 0
        const y = node.y ?? 0
        const radius = drawRadius(node, globalScale)
        const selected = node.id === selectedId
        const hovered = node.id === hoveredId
        const isCenter = node.id === centerId
        const highlighted = highlightedNodeIds.has(node.id)
        const showProjectLabel = node.type === 'project'
        const showMemoryLabel =
          node.type === 'memory' && (selected || hovered || globalScale >= 1.15)
        const showLabel = showProjectLabel || showMemoryLabel || selected || hovered

        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fillStyle = nodeColorFor(node.type)
        context.fill()
        context.lineWidth = selected || hovered ? 2.4 : highlighted ? 1.8 : isCenter ? 1.7 : 1
        context.strokeStyle =
          selected || hovered
            ? '#f6d7b6'
            : highlighted
              ? '#9ce7dc'
              : isCenter
                ? '#e8f5f2'
                : 'rgba(232,245,242,0.32)'
        context.stroke()

        if (isCenter || highlighted) {
          context.beginPath()
          context.arc(x, y, radius + 3.5, 0, Math.PI * 2)
          context.strokeStyle = highlighted ? 'rgba(156,231,220,0.65)' : 'rgba(94,234,212,0.45)'
          context.lineWidth = 0.8
          context.stroke()
        }

        if (showLabel) {
          const fontSize = Math.max(3.2, 10 / globalScale)
          context.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`
          context.textAlign = 'center'
          context.textBaseline = 'top'
          context.fillStyle = selected || hovered ? '#f8fafc' : '#cfdde2'
          const limit = selected || hovered ? 34 : 24
          context.fillText(shorten(node.label, limit), x, y + radius + 3 / globalScale)
        }
      },
    [centerId, highlightedNodeIds, hoveredId, selectedId],
  )

  const drawPointer = useMemo(
    () =>
      (
        node: GraphNode,
        color: string,
        context: CanvasRenderingContext2D,
        globalScale: number,
      ): void => {
        context.beginPath()
        context.arc(
          node.x ?? 0,
          node.y ?? 0,
          drawRadius(node, globalScale) + 4 / Math.max(globalScale, 0.001),
          0,
          Math.PI * 2,
        )
        context.fillStyle = color
        context.fill()
      },
    [],
  )

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      role="img"
      aria-label={`Knowledge graph with ${nodes.length} nodes and ${edges.length} edges`}
      onPointerLeave={() => setHoveredId(null)}
    >
      {size.width > 0 && size.height > 0 && (
        <ForceGraph2D<GraphNode, GraphLink>
          ref={graphRef}
          width={size.width}
          height={size.height}
          graphData={graphData}
          backgroundColor="#0c1722"
          nodeId="id"
          linkSource="source"
          linkTarget="target"
          nodeLabel={safeTooltipLabel}
          nodeColor={(node) => nodeColorFor(node.type)}
          nodeVal={(node) =>
            node.type === 'memory' ? 1 + node.importance / 4 : node.type === 'project' ? 4 : 1.4
          }
          nodeCanvasObjectMode={() => 'replace'}
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={drawPointer}
          linkColor={(link) =>
            linkIsActive(link) ? 'rgba(246,215,182,0.95)' : 'rgba(148,171,182,0.22)'
          }
          linkWidth={(link) => (linkIsActive(link) ? 1.8 : 0.6)}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowColor={(link) =>
            linkIsActive(link) ? 'rgba(246,215,182,0.95)' : 'rgba(170,195,205,0.38)'
          }
          linkDirectionalArrowRelPos={0.92}
          onNodeHover={(node) => setHoveredId(node ? String(node.id) : null)}
          onNodeClick={(node) => {
            if (typeof node.id === 'string') onSelect(node.id)
          }}
          onZoom={(transform) => {
            if (containerRef.current) {
              const camera = `${transform.k}:${transform.x}:${transform.y}`
              containerRef.current.dataset.graphCamera = camera
            }
          }}
          onEngineStop={() => {
            if (!autoFitPending.current) {
              if (containerRef.current) containerRef.current.dataset.graphEngine = 'stopped'
              return
            }
            autoFitPending.current = false
            const graph = graphRef.current
            if (!graph) return
            graph.zoomToFit(0, 72)
            if (graph.zoom() > 1.5) graph.zoom(1.5, 0)
            if (containerRef.current) containerRef.current.dataset.graphEngine = 'stopped'
          }}
          cooldownTicks={90}
          warmupTicks={20}
          d3AlphaDecay={0.035}
          d3VelocityDecay={0.32}
          minZoom={0.02}
          maxZoom={4}
          enableNodeDrag
          enableZoomInteraction
          enablePanInteraction
        />
      )}
    </div>
  )
}
