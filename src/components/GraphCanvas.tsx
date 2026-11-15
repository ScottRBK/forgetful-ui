import type { ReactHTMLElement } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ForceGraphMethods, LinkObject, NodeObject } from 'react-force-graph-2d'
import ForceGraph2D from 'react-force-graph-2d'
import type { SubgraphEdge, SubgraphNode } from '../api/types'
import { nodeColorFor } from '../lib/graphStyle'

interface GraphNode extends NodeObject {
  id: string
  type: string
  label: string
  depth: number
  importance: number
}

interface GraphLink extends LinkObject {
  id: string
  type: string
}

interface GraphCanvasProps {
  nodes: SubgraphNode[]
  edges: SubgraphEdge[]
  selectedId: string | null
  centerId: string | null
  onSelect: (id: string) => void
}

function importanceFrom(node: SubgraphNode): number {
  const value = node.data.importance
  return typeof value === 'number' && Number.isFinite(value) ? value : 5
}

function nodeRadius(node: GraphNode): number {
  if (node.type === 'memory') return 4.5 + Math.max(0, Math.min(10, node.importance)) * 0.45
  return 4
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
  const [size, setSize] = useState({ width: 0, height: 0 })

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
        depth: node.depth,
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
  }, [graphData])

  useEffect(() => {
    const graph = graphRef.current
    if (!graph || graphData.nodes.length === 0 || size.width === 0 || size.height === 0) return
    const charge = graph.d3Force('charge')
    charge?.strength?.(-320)
    const link = graph.d3Force('link') as { distance?: (value: number) => void } | undefined
    link?.distance?.(150)
    graph.d3ReheatSimulation()
  }, [graphData, size.width, size.height])

  const drawNode = useMemo(
    () =>
      (node: GraphNode, context: CanvasRenderingContext2D, globalScale: number): void => {
        const x = node.x ?? 0
        const y = node.y ?? 0
        const radius = nodeRadius(node)
        const selected = node.id === selectedId
        const isCenter = node.id === centerId

        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fillStyle = nodeColorFor(node.type)
        context.fill()
        context.lineWidth = selected ? 2.2 : isCenter ? 1.7 : 1
        context.strokeStyle = selected ? '#f6d7b6' : isCenter ? '#e8f5f2' : 'rgba(232,245,242,0.32)'
        context.stroke()

        if (isCenter) {
          context.beginPath()
          context.arc(x, y, radius + 3.5, 0, Math.PI * 2)
          context.strokeStyle = 'rgba(94,234,212,0.45)'
          context.lineWidth = 0.8
          context.stroke()
        }

        if (selected || isCenter) {
          const fontSize = Math.max(3.2, 10 / globalScale)
          context.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`
          context.textAlign = 'center'
          context.textBaseline = 'top'
          context.fillStyle = selected ? '#f8fafc' : '#cfdde2'
          context.fillText(shorten(node.label, selected ? 34 : 22), x, y + radius + 3 / globalScale)
        }
      },
    [centerId, selectedId],
  )

  const drawPointer = useMemo(
    () =>
      (node: GraphNode, color: string, context: CanvasRenderingContext2D): void => {
        context.beginPath()
        context.arc(node.x ?? 0, node.y ?? 0, nodeRadius(node) + 3, 0, Math.PI * 2)
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
          nodeVal={(node) => (node.type === 'memory' ? 1 + node.importance / 4 : 1.4)}
          nodeCanvasObjectMode={() => 'replace'}
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={drawPointer}
          linkColor={() => 'rgba(148,171,182,0.28)'}
          linkWidth={0.8}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowColor={() => 'rgba(170,195,205,0.5)'}
          linkDirectionalArrowRelPos={0.92}
          onNodeClick={(node) => {
            if (typeof node.id === 'string') onSelect(node.id)
          }}
          onEngineStop={() => {
            if (!autoFitPending.current) return
            autoFitPending.current = false
            const graph = graphRef.current
            if (!graph) return
            graph.zoomToFit(0, 52)
            if (graph.zoom() > 1.5) graph.zoom(1.5, 220)
          }}
          cooldownTicks={90}
          warmupTicks={20}
          d3AlphaDecay={0.035}
          d3VelocityDecay={0.32}
          minZoom={0.4}
          maxZoom={4}
          enableNodeDrag
          enableZoomInteraction
          enablePanInteraction
        />
      )}
    </div>
  )
}
