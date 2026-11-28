import type { TaskSummaryRecord } from '../api/types'

export interface PlanDependencyInPlanEdge {
  kind: 'in-plan'
  from: number
  to: number
}

export interface PlanDependencyExternalEdge {
  kind: 'external'
  from: number
  to: number
}

export type PlanDependencyEdge = PlanDependencyInPlanEdge | PlanDependencyExternalEdge

export interface PlanDependencyNode {
  task: TaskSummaryRecord
  layer: number
  indexInLayer: number
}

export interface PlanDependencyGraphStats {
  totalTasks: number
  totalDependencyEdges: number
  inPlanEdgeCount: number
  externalEdgeCount: number
  rootTaskCount: number
  blockedTaskCount: number
  criticalPathDepth: number
}

export interface PlanDependencyGraphLayout {
  nodes: PlanDependencyNode[]
  edges: PlanDependencyEdge[]
  externalDependencyIds: number[]
  stats: PlanDependencyGraphStats
  hasCycle: boolean
  cyclicTaskIds: number[]
  layerCount: number
  maxNodesInLayer: number
}

export const PLAN_DEP_NODE_WIDTH = 176
export const PLAN_DEP_NODE_HEIGHT = 76
export const PLAN_DEP_LAYER_GAP = 88
export const PLAN_DEP_ROW_GAP = 14
export const PLAN_DEP_PADDING = 24

function uniqueSorted(ids: number[]): number[] {
  return [...new Set(ids)].sort((a, b) => a - b)
}

export function buildPlanDependencyGraph(tasks: TaskSummaryRecord[]): PlanDependencyGraphLayout {
  const taskById = new Map<number, TaskSummaryRecord>()
  for (const task of tasks) {
    taskById.set(task.id, task)
  }

  const edges: PlanDependencyEdge[] = []
  const externalIds = new Set<number>()
  const inPlanAdj = new Map<number, number[]>()
  const inDegree = new Map<number, number>()

  for (const task of tasks) {
    inDegree.set(task.id, 0)
    inPlanAdj.set(task.id, [])
  }

  for (const task of tasks) {
    const depIds = task.dependency_ids ?? []
    for (const depId of depIds) {
      if (taskById.has(depId)) {
        edges.push({ kind: 'in-plan', from: depId, to: task.id })
        inPlanAdj.get(depId)?.push(task.id)
        inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1)
      } else {
        edges.push({ kind: 'external', from: depId, to: task.id })
        externalIds.add(depId)
      }
    }
  }

  const layer = new Map<number, number>()
  for (const task of tasks) {
    layer.set(task.id, 0)
  }

  const queue: number[] = []
  for (const task of tasks) {
    if ((inDegree.get(task.id) ?? 0) === 0) queue.push(task.id)
  }
  queue.sort((a, b) => a - b)

  const order: number[] = []
  const inDegreeWork = new Map(inDegree)

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    order.push(current)
    const nextNodes = [...(inPlanAdj.get(current) ?? [])].sort((a, b) => a - b)
    for (const next of nextNodes) {
      const previousLayer = layer.get(current) ?? 0
      layer.set(next, Math.max(layer.get(next) ?? 0, previousLayer + 1))
      const nextDegree = (inDegreeWork.get(next) ?? 0) - 1
      inDegreeWork.set(next, nextDegree)
      if (nextDegree === 0) {
        queue.push(next)
        queue.sort((a, b) => a - b)
      }
    }
  }

  const cyclicTaskIds: number[] = []
  for (const task of tasks) {
    if ((inDegreeWork.get(task.id) ?? 0) > 0) cyclicTaskIds.push(task.id)
  }
  cyclicTaskIds.sort((a, b) => a - b)

  const hasCycle = cyclicTaskIds.length > 0
  let maxResolvedLayer = 0
  for (const taskId of order) {
    maxResolvedLayer = Math.max(maxResolvedLayer, layer.get(taskId) ?? 0)
  }
  const fallbackLayer = maxResolvedLayer + 1
  for (const taskId of cyclicTaskIds) {
    layer.set(taskId, fallbackLayer)
  }

  const byLayer = new Map<number, number[]>()
  for (const task of [...tasks].sort((a, b) => a.id - b.id)) {
    const taskLayer = layer.get(task.id) ?? 0
    const bucket = byLayer.get(taskLayer) ?? []
    bucket.push(task.id)
    byLayer.set(taskLayer, bucket)
  }

  const layers = [...byLayer.keys()].sort((a, b) => a - b)
  const nodes: PlanDependencyNode[] = []
  let maxNodesInLayer = 0
  for (const taskLayer of layers) {
    const ids = (byLayer.get(taskLayer) ?? []).sort((a, b) => a - b)
    maxNodesInLayer = Math.max(maxNodesInLayer, ids.length)
    ids.forEach((taskId, indexInLayer) => {
      const task = taskById.get(taskId)
      if (!task) return
      nodes.push({ task, layer: taskLayer, indexInLayer })
    })
  }

  const inPlanEdgeCount = edges.filter((edge) => edge.kind === 'in-plan').length
  const rootTaskCount = tasks.filter((task) => (task.dependency_ids ?? []).length === 0).length
  const blockedTaskCount = tasks.filter((task) => task.blocked).length
  const criticalPathDepth = layers.length > 0 ? Math.max(...layers) + 1 : 0

  return {
    nodes,
    edges,
    externalDependencyIds: uniqueSorted([...externalIds]),
    stats: {
      totalTasks: tasks.length,
      totalDependencyEdges: edges.length,
      inPlanEdgeCount,
      externalEdgeCount: edges.length - inPlanEdgeCount,
      rootTaskCount,
      blockedTaskCount,
      criticalPathDepth,
    },
    hasCycle,
    cyclicTaskIds,
    layerCount: layers.length,
    maxNodesInLayer,
  }
}

export function planDependencyGraphDimensions(layout: PlanDependencyGraphLayout): {
  width: number
  height: number
} {
  if (layout.nodes.length === 0) {
    return { width: 320, height: 120 }
  }
  const width =
    PLAN_DEP_PADDING * 2 +
    Math.max(1, layout.layerCount) * PLAN_DEP_NODE_WIDTH +
    Math.max(0, layout.layerCount - 1) * PLAN_DEP_LAYER_GAP
  const height =
    PLAN_DEP_PADDING * 2 +
    layout.maxNodesInLayer * PLAN_DEP_NODE_HEIGHT +
    Math.max(0, layout.maxNodesInLayer - 1) * PLAN_DEP_ROW_GAP
  return { width, height }
}

export function nodePosition(node: PlanDependencyNode): { x: number; y: number } {
  return {
    x: PLAN_DEP_PADDING + node.layer * (PLAN_DEP_NODE_WIDTH + PLAN_DEP_LAYER_GAP),
    y: PLAN_DEP_PADDING + node.indexInLayer * (PLAN_DEP_NODE_HEIGHT + PLAN_DEP_ROW_GAP),
  }
}

export function directDependencyHighlightIds(
  tasks: TaskSummaryRecord[],
  selectedTaskId: number | null,
): Set<number> {
  const highlighted = new Set<number>()
  if (selectedTaskId === null) return highlighted
  highlighted.add(selectedTaskId)
  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const selected = taskById.get(selectedTaskId)
  if (selected) {
    for (const depId of selected.dependency_ids ?? []) {
      if (taskById.has(depId)) highlighted.add(depId)
    }
  }
  for (const task of tasks) {
    if ((task.dependency_ids ?? []).includes(selectedTaskId)) highlighted.add(task.id)
  }
  return highlighted
}

export function downstreamDependentIds(tasks: TaskSummaryRecord[], taskId: number): number[] {
  return tasks
    .filter((task) => (task.dependency_ids ?? []).includes(taskId))
    .map((task) => task.id)
    .sort((a, b) => a - b)
}
