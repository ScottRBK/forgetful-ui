import type { GraphNodeType } from '../api/types'

export const NODE_TYPE_LABELS: Record<GraphNodeType, string> = {
  memory: 'Memory',
  entity: 'Entity',
  project: 'Project',
  document: 'Document',
  code_artifact: 'Code artifact',
  file: 'File',
  skill: 'Skill',
  plan: 'Plan',
  task: 'Task',
}

export const NODE_TYPE_COLORS: Record<GraphNodeType, string> = {
  memory: '#5eead4',
  entity: '#d7a47c',
  project: '#7aa7d8',
  document: '#e0be72',
  code_artifact: '#b9a1e6',
  file: '#9aadb8',
  skill: '#86d39b',
  plan: '#e879f9',
  task: '#dc8e9f',
}

const nodeTypeSet = new Set<string>(Object.keys(NODE_TYPE_LABELS))

export const GRAPH_NODE_TYPES: GraphNodeType[] = [
  'memory',
  'project',
  'entity',
  'document',
  'code_artifact',
  'file',
  'skill',
  'plan',
  'task',
]

export const CORE_GRAPH_NODE_TYPES: GraphNodeType[] = ['memory', 'project']

export function normalizeGraphNodeTypes(values: readonly string[]): GraphNodeType[] {
  const selected = new Set<GraphNodeType>(CORE_GRAPH_NODE_TYPES)
  for (const value of values) {
    if (isGraphNodeType(value)) selected.add(value)
  }
  return GRAPH_NODE_TYPES.filter((type) => selected.has(type))
}

export function normalizeHiddenGraphNodeTypes(values: readonly string[]): GraphNodeType[] {
  const hidden = new Set<string>(values)
  return CORE_GRAPH_NODE_TYPES.filter((type) => hidden.has(type))
}

export function isGraphNodeType(value: string): value is GraphNodeType {
  return nodeTypeSet.has(value)
}

export function nodeColorFor(type: string): string {
  return isGraphNodeType(type) ? NODE_TYPE_COLORS[type] : '#9aadb8'
}

export function nodeTypeLabel(type: string): string {
  return isGraphNodeType(type) ? NODE_TYPE_LABELS[type] : type
}

/** Split a graph node id such as `entity_9` into its type and numeric id. */
export function parseGraphNodeId(value: string): { type: GraphNodeType; id: number } | null {
  const match = /^([a-z_]+)_(\d+)$/.exec(value)
  if (match === null) return null
  const type = match[1]
  if (type === undefined || !isGraphNodeType(type)) return null
  const id = Number(match[2])
  return Number.isSafeInteger(id) && id > 0 ? { type, id } : null
}

/** Sentence-case label for a focused node, e.g. `entity #9`. */
export function nodeFocusLabel(type: GraphNodeType, id: number): string {
  const label = NODE_TYPE_LABELS[type]
  return `${label.charAt(0).toLowerCase()}${label.slice(1)} #${id}`
}
