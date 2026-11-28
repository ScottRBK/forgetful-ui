import { useMemo } from 'react'
import type { TaskSummaryRecord } from '../api/types'
import {
  buildPlanDependencyGraph,
  directDependencyHighlightIds,
  nodePosition,
  PLAN_DEP_NODE_HEIGHT,
  PLAN_DEP_NODE_WIDTH,
  planDependencyGraphDimensions,
} from '../lib/planDependencyGraph'
import type { PlansRoute } from '../router'
import { plansHref } from '../router'

function shorten(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value
}

function stateChipClass(state: string | null | undefined): string {
  switch (state) {
    case 'done':
      return 'fill-[var(--color-teal-soft)]'
    case 'doing':
      return 'fill-[var(--color-teal-soft)]'
    case 'waiting':
      return 'fill-[var(--color-warn-soft)]'
    case 'cancelled':
      return 'fill-[var(--color-danger-soft)]'
    default:
      return 'fill-[var(--color-canvas)]'
  }
}

interface PlanDependencyGraphProps {
  tasks: TaskSummaryRecord[]
  planId: number
  route: PlansRoute
  selectedTaskId: number | null
}

export default function PlanDependencyGraph({
  tasks,
  planId,
  route,
  selectedTaskId,
}: PlanDependencyGraphProps) {
  const layout = useMemo(() => buildPlanDependencyGraph(tasks), [tasks])
  const { width, height } = useMemo(() => planDependencyGraphDimensions(layout), [layout])
  const highlighted = useMemo(
    () => directDependencyHighlightIds(tasks, selectedTaskId),
    [tasks, selectedTaskId],
  )

  const nodeById = useMemo(() => {
    const map = new Map<number, (typeof layout.nodes)[number]>()
    for (const node of layout.nodes) map.set(node.task.id, node)
    return map
  }, [layout.nodes])

  const inPlanEdges = layout.edges.filter((edge) => edge.kind === 'in-plan')

  if (tasks.length === 0) {
    return (
      <div
        data-plan-deps-graph
        className="flex min-h-[160px] items-center justify-center p-6 text-center"
      >
        <p className="text-[12px] text-muted">This plan has no tasks yet.</p>
      </div>
    )
  }

  const noInPlanDeps = layout.stats.inPlanEdgeCount === 0

  return (
    <div data-plan-deps-graph className="plan-deps-scroll max-w-full overflow-x-auto p-3">
      {layout.hasCycle && (
        <p className="mb-2 rounded border border-warn-ink/25 bg-warn-soft px-2.5 py-1.5 text-[11px] text-warn-ink">
          A dependency cycle was detected among in-plan tasks. Cyclic tasks are shown in a separate
          column.
        </p>
      )}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] text-muted">
        <span>{layout.stats.totalTasks} tasks</span>
        <span>{layout.stats.inPlanEdgeCount} in-plan dependencies</span>
        {layout.stats.externalEdgeCount > 0 && (
          <span>{layout.stats.externalEdgeCount} external references</span>
        )}
        <span>Depth {layout.stats.criticalPathDepth}</span>
      </div>
      {noInPlanDeps && (
        <p className="mb-2 text-[11px] text-muted">No task dependencies defined yet.</p>
      )}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Plan task dependency graph"
        className="block max-w-none rounded border border-line bg-panel"
      >
        <defs>
          <marker
            id="plan-dep-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L8,4 L0,8 z" fill="var(--color-muted)" />
          </marker>
          <marker
            id="plan-dep-arrow-active"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L8,4 L0,8 z" fill="var(--color-teal)" />
          </marker>
        </defs>

        {inPlanEdges.map((edge) => {
          const fromNode = nodeById.get(edge.from)
          const toNode = nodeById.get(edge.to)
          if (!fromNode || !toNode) return null
          const from = nodePosition(fromNode)
          const to = nodePosition(toNode)
          const x1 = from.x + PLAN_DEP_NODE_WIDTH
          const y1 = from.y + PLAN_DEP_NODE_HEIGHT / 2
          const x2 = to.x
          const y2 = to.y + PLAN_DEP_NODE_HEIGHT / 2
          const bend = Math.max(28, (x2 - x1) * 0.45)
          const path = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`
          const edgeActive =
            selectedTaskId !== null &&
            (edge.from === selectedTaskId ||
              edge.to === selectedTaskId ||
              (highlighted.has(edge.from) && highlighted.has(edge.to)))
          const dimmed = selectedTaskId !== null && !edgeActive
          return (
            <path
              key={`${edge.from}-${edge.to}`}
              d={path}
              fill="none"
              stroke={edgeActive ? 'var(--color-teal)' : 'var(--color-line-strong)'}
              strokeWidth={edgeActive ? 2 : 1.25}
              markerEnd={edgeActive ? 'url(#plan-dep-arrow-active)' : 'url(#plan-dep-arrow)'}
              opacity={dimmed ? 0.25 : 1}
            />
          )
        })}

        {layout.nodes.map((node) => {
          const { x, y } = nodePosition(node)
          const task = node.task
          const href = plansHref({
            planId,
            taskId: task.id,
            page: route.page,
            projectId: route.projectId,
            status: route.status,
            view: 'deps',
          })
          const selected = selectedTaskId === task.id
          const related = highlighted.has(task.id)
          const dimmed = selectedTaskId !== null && !related
          const title = task.title
          return (
            <a
              key={task.id}
              href={href}
              data-task-id={task.id}
              data-task-graph-id={task.id}
              className="plan-dep-node-link cursor-pointer"
            >
              <g transform={`translate(${x} ${y})`} opacity={dimmed ? 0.35 : 1}>
                <title>{title}</title>
                <rect
                  width={PLAN_DEP_NODE_WIDTH}
                  height={PLAN_DEP_NODE_HEIGHT}
                  rx={6}
                  className={
                    selected
                      ? 'fill-[var(--color-teal-soft)] stroke-[var(--color-teal)]'
                      : 'fill-[var(--color-panel)] stroke-[var(--color-line)]'
                  }
                  strokeWidth={selected ? 2 : 1}
                />
                <text
                  x={10}
                  y={18}
                  className="fill-[var(--color-ink)]"
                  fontSize={11}
                  fontWeight={600}
                >
                  {shorten(title, 22)}
                </text>
                <rect
                  x={10}
                  y={28}
                  width={52}
                  height={16}
                  rx={8}
                  className={stateChipClass(task.state)}
                />
                <text x={16} y={39.5} className="fill-[var(--color-ink-soft)]" fontSize={9}>
                  {task.state ?? 'todo'}
                </text>
                <text x={68} y={39.5} className="fill-[var(--color-muted)]" fontSize={9}>
                  P{task.priority ?? '—'}
                </text>
                {task.blocked && (
                  <>
                    <rect
                      x={10}
                      y={52}
                      width={48}
                      height={14}
                      rx={7}
                      className="fill-[var(--color-copper-soft)]"
                    />
                    <text x={14} y={62.5} className="fill-[var(--color-copper)]" fontSize={8.5}>
                      blocked
                    </text>
                  </>
                )}
              </g>
            </a>
          )
        })}
      </svg>
    </div>
  )
}
