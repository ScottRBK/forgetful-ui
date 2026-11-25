import type {
  ActivityListResponse,
  AuthInfoResponse,
  CapabilitySet,
  CodeArtifactListResponse,
  CodeArtifactRecord,
  DocumentListResponse,
  DocumentRecord,
  EntityListResponse,
  EntityMemoriesResponse,
  EntityRecord,
  EntityRelationshipsResponse,
  FileListResponse,
  FileRecord,
  GraphNodeType,
  GraphOverviewResponse,
  HealthResponse,
  MemoryListResponse,
  MemoryRecord,
  NodeDetail,
  PlanListResponse,
  PlanRecord,
  ProjectListResponse,
  ProjectRecord,
  SkillLinks,
  SkillListResponse,
  SkillRecord,
  SubgraphResponse,
  TaskDetailRecord,
  TaskListResponse,
} from './types'

export const ACCESS_DENIED_EVENT = 'forgetful:access-denied'

export interface AccessDeniedDetail {
  status: 401 | 403
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function deploymentPrefix(pathname: string): string {
  const clean = pathname.replace(/\/+$/, '')
  if (clean === '' || clean === '/') return ''
  const match = /^(.*)\/ui(?:\/index\.html)?$/.exec(clean)
  return match?.[1] ?? ''
}

export function appRoot(pathname = window.location.pathname): string {
  return deploymentPrefix(pathname)
}

export function apiRoot(pathname = window.location.pathname): string {
  return `${deploymentPrefix(pathname)}/api/v1`
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      window.dispatchEvent(
        new CustomEvent<AccessDeniedDetail>(ACCESS_DENIED_EVENT, {
          detail: { status: response.status },
        }),
      )
    }

    let message = `Request failed with status ${response.status}`
    try {
      const body = (await response.json()) as { error?: unknown; detail?: unknown }
      if (typeof body.error === 'string') message = body.error
      else if (typeof body.detail === 'string') message = body.detail
    } catch {
      // Keep the status-based message when the body is not JSON.
    }
    throw new ApiError(message, response.status)
  }

  return (await response.json()) as T
}

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return getJson<HealthResponse>(`${appRoot()}/health`, signal)
}

export function getAuthInfo(signal?: AbortSignal): Promise<AuthInfoResponse> {
  return getJson<AuthInfoResponse>(`${apiRoot()}/auth/info`, signal)
}

export function listMemories(
  params: {
    limit: number
    offset: number
    projectId: number | null
    sortBy: 'updated_at' | 'importance' | 'title' | 'project_name'
    sortOrder: 'asc' | 'desc'
    importanceMin: number | null
    importanceMax: number | null
    q: string | null
    updatedFrom: string | null
    updatedTo: string | null
  },
  signal?: AbortSignal,
): Promise<MemoryListResponse> {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
    sort_by: params.sortBy,
    sort_order: params.sortOrder,
  })
  if (params.projectId !== null) query.set('project_id', String(params.projectId))
  if (params.importanceMin !== null) query.set('importance_min', String(params.importanceMin))
  if (params.importanceMax !== null) query.set('importance_max', String(params.importanceMax))
  if (params.q !== null && params.q !== '') query.set('q', params.q)
  if (params.updatedFrom !== null) query.set('updated_from', params.updatedFrom)
  if (params.updatedTo !== null) query.set('updated_to', params.updatedTo)
  return getJson<MemoryListResponse>(`${apiRoot()}/memories?${query.toString()}`, signal)
}

export function getMemory(memoryId: number, signal?: AbortSignal): Promise<MemoryRecord> {
  return getJson<MemoryRecord>(`${apiRoot()}/memories/${memoryId}`, signal)
}

export function getGraphOverview(
  params: {
    nodeTypes: GraphNodeType[]
    projectId: number | null
    limit: number
    offset: number
  },
  signal?: AbortSignal,
): Promise<GraphOverviewResponse> {
  return getJson<GraphOverviewResponse>(
    queryPath(`${apiRoot()}/graph`, {
      node_types: params.nodeTypes.join(','),
      project_id: params.projectId,
      limit: params.limit,
      offset: params.offset,
      sort_by: 'created_at',
      sort_order: 'asc',
    }),
    signal,
  )
}

export function getSubgraph(
  params: { memoryId: number; depth: number; maxNodes: number },
  signal?: AbortSignal,
): Promise<SubgraphResponse> {
  const query = new URLSearchParams({
    node_id: `memory_${params.memoryId}`,
    depth: String(params.depth),
    max_nodes: String(params.maxNodes),
  })
  return getJson<SubgraphResponse>(`${apiRoot()}/graph/subgraph?${query.toString()}`, signal)
}

function queryPath(
  path: string,
  params: Record<string, string | number | null | undefined>,
): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') query.set(key, String(value))
  }
  const suffix = query.toString()
  return suffix ? `${path}?${suffix}` : path
}

export async function getCapabilities(signal?: AbortSignal): Promise<CapabilitySet> {
  const response = await getJson<{
    schema_version?: number
    capabilities?: Record<string, unknown>
  }>(`${appRoot()}/.well-known`, signal)
  const capabilities = response.capabilities ?? {}
  const asFlag = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null)
  return {
    schemaVersion: typeof response.schema_version === 'number' ? response.schema_version : 0,
    planning: asFlag(capabilities.planning),
    skills: asFlag(capabilities.skills),
    files: asFlag(capabilities.files),
    activityStream: asFlag(capabilities.activity_stream),
  }
}

function getResourcePage<T>(
  url: string,
  limit: number,
  offset: number,
  arrayKey: string,
  signal?: AbortSignal,
): Promise<T> {
  return getJson<T>(url, signal).then((response) => {
    if (response === null || typeof response !== 'object' || Array.isArray(response)) {
      throw new Error('The server returned a malformed resource page.')
    }
    const record = response as Record<string, unknown>
    if (
      record.limit === null ||
      record.limit === undefined ||
      record.offset === null ||
      record.offset === undefined ||
      record.total === null ||
      record.total === undefined
    ) {
      throw new Error(
        'This resource needs Forgetful v0.8.0 pagination metadata (total, limit and offset). ' +
          'Update the backend; the UI will not render an incomplete page.',
      )
    }
    if (
      typeof record.limit !== 'number' ||
      !Number.isSafeInteger(record.limit) ||
      typeof record.offset !== 'number' ||
      !Number.isSafeInteger(record.offset) ||
      typeof record.total !== 'number' ||
      !Number.isSafeInteger(record.total) ||
      record.total < 0
    ) {
      throw new Error('The server returned invalid resource pagination metadata.')
    }
    if (record.limit !== limit || record.offset !== offset) {
      throw new Error('The server returned unexpected resource pagination metadata.')
    }
    const rows = record[arrayKey]
    if (!Array.isArray(rows)) {
      throw new Error(`The server returned a resource page without its ${arrayKey} array.`)
    }
    if (rows.length > limit) {
      throw new Error(`The server returned more rows than the requested ${limit}-row page limit.`)
    }
    return response
  })
}

export function listProjects(
  params: {
    status: string | null
    repoName: string | null
    limit: number
    offset: number
  },
  signal?: AbortSignal,
): Promise<ProjectListResponse> {
  return getResourcePage<ProjectListResponse>(
    queryPath(`${apiRoot()}/projects`, {
      status: params.status,
      repo_name: params.repoName,
      limit: params.limit,
      offset: params.offset,
    }),
    params.limit,
    params.offset,
    'projects',
    signal,
  )
}

export function getProject(projectId: number, signal?: AbortSignal): Promise<ProjectRecord> {
  return getJson<ProjectRecord>(`${apiRoot()}/projects/${projectId}`, signal)
}

export function listPlans(
  params: {
    projectId: number | null
    status: string | null
    externalRef?: string | null
    limit: number
    offset: number
  },
  signal?: AbortSignal,
): Promise<PlanListResponse> {
  return getResourcePage<PlanListResponse>(
    queryPath(`${apiRoot()}/plans`, {
      project_id: params.projectId,
      status: params.status,
      external_ref: params.externalRef ?? null,
      limit: params.limit,
      offset: params.offset,
    }),
    params.limit,
    params.offset,
    'plans',
    signal,
  )
}

export function getPlan(planId: number, signal?: AbortSignal): Promise<PlanRecord> {
  return getJson<PlanRecord>(`${apiRoot()}/plans/${planId}`, signal)
}

export function listTasks(
  params: {
    planId: number
    state?: string | null
    priority?: string | null
    limit: number
    offset: number
  },
  signal?: AbortSignal,
): Promise<TaskListResponse> {
  return getResourcePage<TaskListResponse>(
    queryPath(`${apiRoot()}/tasks`, {
      plan_id: params.planId,
      state: params.state ?? null,
      priority: params.priority ?? null,
      limit: params.limit,
      offset: params.offset,
    }),
    params.limit,
    params.offset,
    'tasks',
    signal,
  )
}

export function getTask(taskId: number, signal?: AbortSignal): Promise<TaskDetailRecord> {
  return getJson<TaskDetailRecord>(`${apiRoot()}/tasks/${taskId}`, signal)
}

export function listDocuments(
  params: {
    projectId: number | null
    documentType: string | null
    limit: number
    offset: number
  },
  signal?: AbortSignal,
): Promise<DocumentListResponse> {
  return getResourcePage<DocumentListResponse>(
    queryPath(`${apiRoot()}/documents`, {
      project_id: params.projectId,
      document_type: params.documentType,
      limit: params.limit,
      offset: params.offset,
    }),
    params.limit,
    params.offset,
    'documents',
    signal,
  )
}

export function getDocument(documentId: number, signal?: AbortSignal): Promise<DocumentRecord> {
  return getJson<DocumentRecord>(`${apiRoot()}/documents/${documentId}`, signal)
}

export function listCodeArtifacts(
  params: {
    projectId: number | null
    language: string | null
    limit: number
    offset: number
  },
  signal?: AbortSignal,
): Promise<CodeArtifactListResponse> {
  return getResourcePage<CodeArtifactListResponse>(
    queryPath(`${apiRoot()}/code-artifacts`, {
      project_id: params.projectId,
      language: params.language,
      limit: params.limit,
      offset: params.offset,
    }),
    params.limit,
    params.offset,
    'code_artifacts',
    signal,
  )
}

export function getCodeArtifact(
  artifactId: number,
  signal?: AbortSignal,
): Promise<CodeArtifactRecord> {
  return getJson<CodeArtifactRecord>(`${apiRoot()}/code-artifacts/${artifactId}`, signal)
}

export function listFiles(
  params: {
    projectId: number | null
    mimeType: string | null
    limit: number
    offset: number
  },
  signal?: AbortSignal,
): Promise<FileListResponse> {
  return getResourcePage<FileListResponse>(
    queryPath(`${apiRoot()}/files`, {
      project_id: params.projectId,
      mime_type: params.mimeType,
      limit: params.limit,
      offset: params.offset,
    }),
    params.limit,
    params.offset,
    'files',
    signal,
  )
}

export function getFile(fileId: number, signal?: AbortSignal): Promise<FileRecord> {
  return getJson<FileRecord>(`${apiRoot()}/files/${fileId}`, signal)
}

export function listSkills(
  params: {
    projectId: number | null
    importanceThreshold: number | null
    limit: number
    offset: number
  },
  signal?: AbortSignal,
): Promise<SkillListResponse> {
  return getResourcePage<SkillListResponse>(
    queryPath(`${apiRoot()}/skills`, {
      project_id: params.projectId,
      importance_threshold: params.importanceThreshold,
      limit: params.limit,
      offset: params.offset,
    }),
    params.limit,
    params.offset,
    'skills',
    signal,
  )
}

export function getSkill(skillId: number, signal?: AbortSignal): Promise<SkillRecord> {
  return getJson<SkillRecord>(`${apiRoot()}/skills/${skillId}`, signal)
}

export function getSkillLinks(skillId: number, signal?: AbortSignal): Promise<SkillLinks> {
  return getJson<SkillLinks>(`${apiRoot()}/skills/${skillId}/links`, signal)
}

export function listEntities(
  params: { entityType: string | null; limit: number; offset: number },
  signal?: AbortSignal,
): Promise<EntityListResponse> {
  return getJson<EntityListResponse>(
    queryPath(`${apiRoot()}/entities`, {
      entity_type: params.entityType,
      limit: params.limit,
      offset: params.offset,
    }),
    signal,
  )
}

export function getEntity(entityId: number, signal?: AbortSignal): Promise<EntityRecord> {
  return getJson<EntityRecord>(`${apiRoot()}/entities/${entityId}`, signal)
}

export function getEntityMemories(
  entityId: number,
  signal?: AbortSignal,
): Promise<EntityMemoriesResponse> {
  return getJson<EntityMemoriesResponse>(`${apiRoot()}/entities/${entityId}/memories`, signal)
}

export function getEntityRelationships(
  entityId: number,
  signal?: AbortSignal,
): Promise<EntityRelationshipsResponse> {
  return getJson<EntityRelationshipsResponse>(
    `${apiRoot()}/entities/${entityId}/relationships`,
    signal,
  )
}

export function listActivity(
  params: {
    limit: number
    offset: number
    entityType?: string | null
    action?: string | null
  },
  signal?: AbortSignal,
): Promise<ActivityListResponse> {
  return getJson<ActivityListResponse>(
    queryPath(`${apiRoot()}/activity`, {
      limit: params.limit,
      offset: params.offset,
      entity_type: params.entityType ?? null,
      action: params.action ?? null,
    }),
    signal,
  )
}

const detailPaths: Record<GraphNodeType, string> = {
  memory: 'memories',
  entity: 'entities',
  project: 'projects',
  document: 'documents',
  code_artifact: 'code-artifacts',
  file: 'files',
  skill: 'skills',
  plan: 'plans',
  task: 'tasks',
}

export function getNodeDetail(
  type: GraphNodeType,
  id: number,
  signal?: AbortSignal,
): Promise<NodeDetail> {
  return getJson<NodeDetail>(`${apiRoot()}/${detailPaths[type]}/${id}`, signal)
}
