import type {
  ActivityListResponse,
  AuthInfoResponse,
  CapabilitySet,
  CodeArtifactListResponse,
  CodeArtifactRecord,
  DocumentListResponse,
  DocumentRecord,
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
    sortBy: 'updated_at' | 'importance'
    sortOrder: 'asc' | 'desc'
    importanceMin: number | null
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

export function listProjects(
  params: { status: string | null; repoName: string | null } = { status: null, repoName: null },
  signal?: AbortSignal,
): Promise<ProjectListResponse> {
  return getJson<ProjectListResponse>(
    queryPath(`${apiRoot()}/projects`, {
      status: params.status,
      repo_name: params.repoName,
    }),
    signal,
  )
}

export function getProject(projectId: number, signal?: AbortSignal): Promise<ProjectRecord> {
  return getJson<ProjectRecord>(`${apiRoot()}/projects/${projectId}`, signal)
}

export function listPlans(
  params: { projectId: number | null; status: string | null; externalRef?: string | null },
  signal?: AbortSignal,
): Promise<PlanListResponse> {
  return getJson<PlanListResponse>(
    queryPath(`${apiRoot()}/plans`, {
      project_id: params.projectId,
      status: params.status,
      external_ref: params.externalRef ?? null,
    }),
    signal,
  )
}

export function getPlan(planId: number, signal?: AbortSignal): Promise<PlanRecord> {
  return getJson<PlanRecord>(`${apiRoot()}/plans/${planId}`, signal)
}

export function listTasks(
  params: { planId: number; state?: string | null; priority?: string | null },
  signal?: AbortSignal,
): Promise<TaskListResponse> {
  return getJson<TaskListResponse>(
    queryPath(`${apiRoot()}/tasks`, {
      plan_id: params.planId,
      state: params.state ?? null,
      priority: params.priority ?? null,
    }),
    signal,
  )
}

export function getTask(taskId: number, signal?: AbortSignal): Promise<TaskDetailRecord> {
  return getJson<TaskDetailRecord>(`${apiRoot()}/tasks/${taskId}`, signal)
}

export function listDocuments(
  params: { projectId: number | null; documentType: string | null },
  signal?: AbortSignal,
): Promise<DocumentListResponse> {
  return getJson<DocumentListResponse>(
    queryPath(`${apiRoot()}/documents`, {
      project_id: params.projectId,
      document_type: params.documentType,
    }),
    signal,
  )
}

export function getDocument(documentId: number, signal?: AbortSignal): Promise<DocumentRecord> {
  return getJson<DocumentRecord>(`${apiRoot()}/documents/${documentId}`, signal)
}

export function listCodeArtifacts(
  params: { projectId: number | null; language: string | null },
  signal?: AbortSignal,
): Promise<CodeArtifactListResponse> {
  return getJson<CodeArtifactListResponse>(
    queryPath(`${apiRoot()}/code-artifacts`, {
      project_id: params.projectId,
      language: params.language,
    }),
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
  params: { projectId: number | null; mimeType: string | null },
  signal?: AbortSignal,
): Promise<FileListResponse> {
  return getJson<FileListResponse>(
    queryPath(`${apiRoot()}/files`, {
      project_id: params.projectId,
      mime_type: params.mimeType,
    }),
    signal,
  )
}

export function getFile(fileId: number, signal?: AbortSignal): Promise<FileRecord> {
  return getJson<FileRecord>(`${apiRoot()}/files/${fileId}`, signal)
}

export function listSkills(
  params: { projectId: number | null; importanceThreshold: number | null },
  signal?: AbortSignal,
): Promise<SkillListResponse> {
  return getJson<SkillListResponse>(
    queryPath(`${apiRoot()}/skills`, {
      project_id: params.projectId,
      importance_threshold: params.importanceThreshold,
    }),
    signal,
  )
}

export function getSkill(skillId: number, signal?: AbortSignal): Promise<SkillRecord> {
  return getJson<SkillRecord>(`${apiRoot()}/skills/${skillId}`, signal)
}

export function getSkillLinks(skillId: number, signal?: AbortSignal): Promise<SkillLinks> {
  return getJson<SkillLinks>(`${apiRoot()}/skills/${skillId}/links`, signal)
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
