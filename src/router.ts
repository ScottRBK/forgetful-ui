import { useSyncExternalStore } from 'react'
import type { GraphNodeType } from './api/types'
import {
  CORE_GRAPH_NODE_TYPES,
  normalizeGraphNodeTypes,
  normalizeHiddenGraphNodeTypes,
} from './lib/graphStyle'

export type MemorySortBy = 'updated_at' | 'importance'
export type MemorySortOrder = 'asc' | 'desc'

export interface MemoryQuery {
  sortBy: MemorySortBy
  sortOrder: MemorySortOrder
  importanceMin: number | null
}

export interface MemoryRoute extends MemoryQuery {
  kind: 'memories'
  memoryId: number | null
  page: number
  projectId: number | null
}

export interface GraphRoute extends MemoryQuery {
  kind: 'graph'
  memoryId: number | null
  depth: number
  page: number
  projectId: number | null
  nodeTypes: GraphNodeType[]
  hiddenNodeTypes: GraphNodeType[]
}

export interface DashboardRoute {
  kind: 'dashboard'
}

export interface ProjectsRoute {
  kind: 'projects'
  projectId: number | null
  status: string | null
  repoName: string | null
}

export interface PlansRoute {
  kind: 'plans'
  planId: number | null
  taskId: number | null
  projectId: number | null
  status: string | null
}

export interface DocumentsRoute {
  kind: 'documents'
  documentId: number | null
  projectId: number | null
  documentType: string | null
}

export interface CodeRoute {
  kind: 'code'
  artifactId: number | null
  projectId: number | null
  language: string | null
}

export interface FilesRoute {
  kind: 'files'
  fileId: number | null
  projectId: number | null
  mimeType: string | null
}

export interface SkillsRoute {
  kind: 'skills'
  skillId: number | null
  projectId: number | null
  importanceMin: number | null
}

export interface TimelineRoute {
  kind: 'timeline'
  page: number
  entityType: string | null
  action: string | null
}

export interface UnknownRoute {
  kind: 'unknown'
}

export type AppRoute =
  | MemoryRoute
  | GraphRoute
  | DashboardRoute
  | ProjectsRoute
  | PlansRoute
  | DocumentsRoute
  | CodeRoute
  | FilesRoute
  | SkillsRoute
  | TimelineRoute
  | UnknownRoute

function positiveInt(value: string | null, fallback: number): number {
  if (value === null) return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function optionalPositiveInt(value: string | null): number | null {
  if (value === null) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function paramsOf(query: string): URLSearchParams {
  return new URLSearchParams(query)
}

function textParam(params: URLSearchParams, key: string): string | null {
  const value = params.get(key)?.trim()
  return value ? value : null
}

function parseQuery(query: string, route: MemoryRoute | GraphRoute): void {
  const params = new URLSearchParams(query)
  route.page = positiveInt(params.get('page'), 1)
  route.projectId = optionalPositiveInt(params.get('project'))
  route.sortBy = params.get('sort') === 'importance' ? 'importance' : 'updated_at'
  route.sortOrder = params.get('order') === 'asc' ? 'asc' : 'desc'
  const importanceMin = optionalPositiveInt(params.get('importance'))
  route.importanceMin =
    importanceMin !== null && importanceMin >= 1 && importanceMin <= 10 ? importanceMin : null
  if (route.kind === 'graph') {
    const depth = positiveInt(params.get('depth'), 1)
    route.depth = Math.min(depth, 3)
  }
}

export function parseRoute(hash: string): AppRoute {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (raw === '' || raw === '/') {
    return {
      kind: 'memories',
      memoryId: null,
      page: 1,
      projectId: null,
      sortBy: 'updated_at',
      sortOrder: 'desc',
      importanceMin: null,
    }
  }

  const [rawPath = '', query = ''] = raw.split('?', 2)
  const segments = rawPath.split('/').filter(Boolean)
  const first = segments[0]

  if (first === 'memories' && segments.length <= 2) {
    const route: MemoryRoute = {
      kind: 'memories',
      memoryId: segments[1] ? optionalPositiveInt(segments[1]) : null,
      page: 1,
      projectId: null,
      sortBy: 'updated_at',
      sortOrder: 'desc',
      importanceMin: null,
    }
    parseQuery(query, route)
    return route
  }

  if (first === 'graph' && segments.length === 1) {
    const params = new URLSearchParams(query)
    const route: GraphRoute = {
      kind: 'graph',
      memoryId: optionalPositiveInt(params.get('memory')),
      depth: 1,
      page: 1,
      projectId: null,
      nodeTypes: normalizeGraphNodeTypes((params.get('types') ?? '').split(',').filter(Boolean)),
      hiddenNodeTypes: normalizeHiddenGraphNodeTypes(
        (params.get('hide') ?? '').split(',').filter(Boolean),
      ),
      sortBy: 'updated_at',
      sortOrder: 'desc',
      importanceMin: null,
    }
    parseQuery(query, route)
    return route
  }

  if (first === 'dashboard' && segments.length === 1) {
    return { kind: 'dashboard' }
  }

  if (first === 'projects' && segments.length <= 2) {
    const params = paramsOf(query)
    return {
      kind: 'projects',
      projectId: segments[1] ? optionalPositiveInt(segments[1]) : null,
      status: textParam(params, 'status'),
      repoName: textParam(params, 'repo'),
    }
  }

  if (first === 'plans' && segments.length <= 2) {
    const params = paramsOf(query)
    return {
      kind: 'plans',
      planId: segments[1] ? optionalPositiveInt(segments[1]) : null,
      taskId: optionalPositiveInt(params.get('task')),
      projectId: optionalPositiveInt(params.get('project')),
      status: textParam(params, 'status'),
    }
  }

  if (first === 'documents' && segments.length <= 2) {
    const params = paramsOf(query)
    return {
      kind: 'documents',
      documentId: segments[1] ? optionalPositiveInt(segments[1]) : null,
      projectId: optionalPositiveInt(params.get('project')),
      documentType: textParam(params, 'type'),
    }
  }

  if (first === 'code' && segments.length <= 2) {
    const params = paramsOf(query)
    return {
      kind: 'code',
      artifactId: segments[1] ? optionalPositiveInt(segments[1]) : null,
      projectId: optionalPositiveInt(params.get('project')),
      language: textParam(params, 'language'),
    }
  }

  if (first === 'files' && segments.length <= 2) {
    const params = paramsOf(query)
    return {
      kind: 'files',
      fileId: segments[1] ? optionalPositiveInt(segments[1]) : null,
      projectId: optionalPositiveInt(params.get('project')),
      mimeType: textParam(params, 'mime'),
    }
  }

  if (first === 'skills' && segments.length <= 2) {
    const params = paramsOf(query)
    return {
      kind: 'skills',
      skillId: segments[1] ? optionalPositiveInt(segments[1]) : null,
      projectId: optionalPositiveInt(params.get('project')),
      importanceMin: optionalPositiveInt(params.get('importance')),
    }
  }

  if (first === 'timeline' && segments.length === 1) {
    const params = paramsOf(query)
    return {
      kind: 'timeline',
      page: positiveInt(params.get('page'), 1),
      entityType: textParam(params, 'entity'),
      action: textParam(params, 'action'),
    }
  }

  return { kind: 'unknown' }
}

function queryString(values: Record<string, string | number | null>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== '') params.set(key, String(value))
  }
  const result = params.toString()
  return result ? `?${result}` : ''
}

export function memoriesHref(params: {
  memoryId?: number | null
  page?: number
  projectId?: number | null
  sortBy?: MemorySortBy
  sortOrder?: MemorySortOrder
  importanceMin?: number | null
}): string {
  const memoryId = params.memoryId ?? null
  const page = params.page ?? 1
  const sortBy = params.sortBy ?? 'updated_at'
  const sortOrder = params.sortOrder ?? 'desc'
  const query = queryString({
    page: page > 1 ? page : null,
    sort: sortBy === 'importance' ? sortBy : null,
    order: sortOrder === 'asc' ? 'asc' : null,
    project: params.projectId ?? null,
    importance: params.importanceMin ?? null,
  })
  return memoryId === null ? `#/memories${query}` : `#/memories/${memoryId}${query}`
}

export function graphHref(params: {
  memoryId?: number | null
  depth?: number
  page?: number
  projectId?: number | null
  nodeTypes?: readonly GraphNodeType[]
  hiddenNodeTypes?: readonly GraphNodeType[]
  sortBy?: MemorySortBy
  sortOrder?: MemorySortOrder
  importanceMin?: number | null
}): string {
  const depth = params.depth ?? 1
  const page = params.page ?? 1
  const sortBy = params.sortBy ?? 'updated_at'
  const sortOrder = params.sortOrder ?? 'desc'
  const nodeTypes = normalizeGraphNodeTypes(params.nodeTypes ?? [])
  const defaultTypes =
    nodeTypes.length === CORE_GRAPH_NODE_TYPES.length &&
    nodeTypes.every((type, index) => type === CORE_GRAPH_NODE_TYPES[index])
  const query = queryString({
    memory: params.memoryId ?? null,
    depth: depth > 1 ? depth : null,
    page: page > 1 ? page : null,
    sort: sortBy === 'importance' ? sortBy : null,
    order: sortOrder === 'asc' ? 'asc' : null,
    project: params.projectId ?? null,
    types: defaultTypes ? null : nodeTypes.join(','),
    hide: normalizeHiddenGraphNodeTypes(params.hiddenNodeTypes ?? []).join(','),
    importance: params.importanceMin ?? null,
  })
  return `#/graph${query}`
}

export function dashboardHref(): string {
  return '#/dashboard'
}

export function projectsHref(params: {
  projectId?: number | null
  status?: string | null
  repoName?: string | null
}): string {
  const query = queryString({
    status: params.status ?? null,
    repo: params.repoName ?? null,
  })
  const projectId = params.projectId ?? null
  return projectId === null ? `#/projects${query}` : `#/projects/${projectId}${query}`
}

export function plansHref(params: {
  planId?: number | null
  taskId?: number | null
  projectId?: number | null
  status?: string | null
}): string {
  const planId = params.planId ?? null
  const query = queryString({
    task: planId !== null ? (params.taskId ?? null) : null,
    project: params.projectId ?? null,
    status: params.status ?? null,
  })
  return planId === null ? `#/plans${query}` : `#/plans/${planId}${query}`
}

export function documentsHref(params: {
  documentId?: number | null
  projectId?: number | null
  documentType?: string | null
}): string {
  const documentId = params.documentId ?? null
  const query = queryString({
    project: params.projectId ?? null,
    type: params.documentType ?? null,
  })
  return documentId === null ? `#/documents${query}` : `#/documents/${documentId}${query}`
}

export function codeHref(params: {
  artifactId?: number | null
  projectId?: number | null
  language?: string | null
}): string {
  const artifactId = params.artifactId ?? null
  const query = queryString({
    project: params.projectId ?? null,
    language: params.language ?? null,
  })
  return artifactId === null ? `#/code${query}` : `#/code/${artifactId}${query}`
}

export function filesHref(params: {
  fileId?: number | null
  projectId?: number | null
  mimeType?: string | null
}): string {
  const fileId = params.fileId ?? null
  const query = queryString({
    project: params.projectId ?? null,
    mime: params.mimeType ?? null,
  })
  return fileId === null ? `#/files${query}` : `#/files/${fileId}${query}`
}

export function skillsHref(params: {
  skillId?: number | null
  projectId?: number | null
  importanceMin?: number | null
}): string {
  const skillId = params.skillId ?? null
  const query = queryString({
    project: params.projectId ?? null,
    importance: params.importanceMin ?? null,
  })
  return skillId === null ? `#/skills${query}` : `#/skills/${skillId}${query}`
}

export function timelineHref(params: {
  page?: number
  entityType?: string | null
  action?: string | null
}): string {
  const page = params.page ?? 1
  const query = queryString({
    page: page > 1 ? page : null,
    entity: params.entityType ?? null,
    action: params.action ?? null,
  })
  return `#/timeline${query}`
}

export function navigate(href: string): void {
  if (window.location.hash === href) return
  window.location.hash = href.startsWith('#') ? href.slice(1) : href
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

function getHash(): string {
  return window.location.hash
}

export function useHashRoute(): AppRoute {
  const hash = useSyncExternalStore(subscribe, getHash, () => '#/memories')
  return parseRoute(hash)
}
