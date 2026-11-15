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
  plan: '#e7a76b',
  task: '#dc8e9f',
}

const nodeTypeSet = new Set<string>(Object.keys(NODE_TYPE_LABELS))

export function isGraphNodeType(value: string): value is GraphNodeType {
  return nodeTypeSet.has(value)
}

export function nodeColorFor(type: string): string {
  return isGraphNodeType(type) ? NODE_TYPE_COLORS[type] : '#9aadb8'
}

export function nodeTypeLabel(type: string): string {
  return isGraphNodeType(type) ? NODE_TYPE_LABELS[type] : type
}
