export interface MemoryRecord {
  id: number
  title: string
  content: string
  context?: string | null
  keywords?: string[]
  tags?: string[]
  importance: number
  created_at: string
  updated_at: string
  project_ids?: number[]
  linked_memory_ids?: number[]
  code_artifact_ids?: number[]
  document_ids?: number[]
  file_ids?: number[]
  skill_ids?: number[]
  source_repo?: string | null
  source_files?: string[] | null
  source_url?: string | null
  confidence?: number | null
  encoding_agent?: string | null
  encoding_version?: string | null
  is_obsolete?: boolean
  obsolete_reason?: string | null
  superseded_by?: number | null
  obsoleted_at?: string | null
  access_count?: number
  last_accessed_at?: string | null
}

export interface MemoryListResponse {
  memories: MemoryRecord[]
  total: number
  limit: number
  offset: number
}

export interface ProjectRecord {
  id: number
  name: string
  project_type?: string | null
  status?: string | null
  repo_name?: string | null
  memory_count?: number
}

export interface ProjectListResponse {
  projects: ProjectRecord[]
  total: number
}

export interface HealthResponse {
  status?: string
  service?: string
  version?: string
}

export interface AuthInfoResponse {
  authEnabled?: boolean
  authMode?: string | null
}

export type GraphNodeType =
  | 'memory'
  | 'entity'
  | 'project'
  | 'document'
  | 'code_artifact'
  | 'file'
  | 'skill'
  | 'plan'
  | 'task'

export interface GraphNodeRecord {
  id: string
  type: GraphNodeType
  label: string
  data: Record<string, unknown>
  depth?: number
}

export interface SubgraphNode extends GraphNodeRecord {
  depth: number
}

export interface SubgraphEdge {
  id: string
  source: string
  target: string
  type: string
  data?: Record<string, unknown> | null
}

export interface SubgraphMeta {
  center_node_id: string
  depth: number
  node_types: string[]
  max_nodes: number
  edge_count: number
  truncated: boolean
  [key: string]: unknown
}

export interface SubgraphResponse {
  nodes: SubgraphNode[]
  edges: SubgraphEdge[]
  meta: SubgraphMeta
}

export interface GraphOverviewMeta {
  memory_count: number
  total_memory_count: number
  offset: number
  limit: number
  has_more: boolean
  entity_count: number
  project_count: number
  document_count: number
  code_artifact_count: number
  file_count: number
  skill_count: number
  plan_count: number
  task_count: number
  edge_count: number
  [key: string]: unknown
}

export interface GraphOverviewResponse {
  nodes: GraphNodeRecord[]
  edges: SubgraphEdge[]
  meta: GraphOverviewMeta
}

export type NodeDetail = Record<string, unknown>

export interface CapabilitySet {
  schemaVersion: number
  planning: boolean | null
  skills: boolean | null
  files: boolean | null
  activityStream: boolean | null
}

export interface ProjectRecord {
  id: number
  name: string
  description?: string | null
  notes?: string | null
  project_type?: string | null
  status?: string | null
  repo_name?: string | null
  last_encoding_point?: string | null
  memory_count?: number
  created_at?: string
  updated_at?: string
}

export interface PlanRecord {
  id: number
  title: string
  project_id: number
  goal?: string | null
  context?: string | null
  status?: string | null
  external_ref?: string | null
  task_count?: number
  created_at?: string
  updated_at?: string
}

export interface TaskCriterion {
  id: number
  task_id: number
  description: string
  met: boolean
  met_at?: string | null
}

export interface TaskSummaryRecord {
  id: number
  plan_id: number
  title: string
  state?: string | null
  priority?: string | null
  assigned_agent?: string | null
  version?: number
  criteria_met?: number
  criteria_total?: number
  blocked?: boolean
  created_at?: string
  updated_at?: string
}

export interface TaskDetailRecord {
  id: number
  plan_id: number
  title: string
  description?: string | null
  state?: string | null
  priority?: string | null
  assigned_agent?: string | null
  version?: number
  criteria?: TaskCriterion[]
  dependency_ids?: number[]
  created_at?: string
  updated_at?: string
}

export interface DocumentRecord {
  id: number
  title: string
  description?: string | null
  content?: string | null
  document_type?: string | null
  filename?: string | null
  size_bytes?: number | null
  tags?: string[]
  project_id?: number | null
  created_at?: string
  updated_at?: string
}

export interface CodeArtifactRecord {
  id: number
  title: string
  description?: string | null
  code?: string | null
  language?: string | null
  tags?: string[]
  project_id?: number | null
  created_at?: string
  updated_at?: string
}

export interface FileRecord {
  id: number
  filename: string
  description?: string | null
  mime_type?: string | null
  size_bytes?: number | null
  tags?: string[]
  project_id?: number | null
  data?: string
  created_at?: string
  updated_at?: string
}

export interface SkillRecord {
  id: number
  name: string
  description?: string | null
  content?: string | null
  license?: string | null
  compatibility?: string | null
  allowed_tools?: string[] | null
  metadata?: Record<string, unknown> | null
  tags?: string[]
  importance?: number
  project_id?: number | null
  created_at?: string
  updated_at?: string
}

export interface SkillLinks {
  memory_ids?: number[]
  file_ids?: number[]
  code_artifact_ids?: number[]
  document_ids?: number[]
}

export type EntityTypeName = 'Organization' | 'Individual' | 'Team' | 'Device' | 'System' | 'Other'

export const ENTITY_TYPE_OPTIONS = [
  'Organization',
  'Individual',
  'Team',
  'Device',
  'System',
  'Other',
] as const satisfies readonly EntityTypeName[]

export function parseEntityTypeName(value: string | null): EntityTypeName | null {
  if (!value) return null
  return (ENTITY_TYPE_OPTIONS as readonly string[]).includes(value)
    ? (value as EntityTypeName)
    : null
}

export interface EntitySummary {
  id: number
  name: string
  entity_type: EntityTypeName
  custom_type?: string | null
  tags?: string[]
  aka?: string[]
  project_ids?: number[] | null
  created_at?: string
  updated_at?: string
}

export interface EntityRecord extends EntitySummary {
  notes?: string | null
  source_repo?: string | null
  source_files?: string[] | null
  source_url?: string | null
  confidence?: number | null
  encoding_agent?: string | null
  encoding_version?: string | null
  agent_id?: string | null
  agent_version?: string | null
  agent_model?: string | null
}

export interface EntityListResponse {
  entities: EntitySummary[]
  total: number
  limit: number
  offset: number
}

export interface EntityLinkedMemory {
  id: number
  title: string
}

export interface EntityMemoriesResponse {
  memory_ids: number[]
  count: number
  memories: EntityLinkedMemory[]
}

export interface EntityRelationshipRecord {
  id: number
  source_entity_id: number
  target_entity_id: number
  relationship_type: string
  strength?: number | null
  confidence?: number | null
  metadata?: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
}

export interface EntityRelationshipsResponse {
  relationships: EntityRelationshipRecord[]
  total: number
}

export interface ActivityEventRecord {
  id: number
  seq?: number
  entity_type: string
  entity_id: number
  action: string
  changes?: Record<string, unknown> | null
  snapshot?: Record<string, unknown> | null
  actor?: string | null
  actor_id?: string | null
  metadata?: Record<string, unknown> | null
  created_at?: string
}

export interface ProjectListResponse {
  projects: ProjectRecord[]
  total: number
  limit: number
  offset: number
}
export interface PlanListResponse {
  plans: PlanRecord[]
  total: number
  limit: number
  offset: number
}
export interface TaskListResponse {
  tasks: TaskSummaryRecord[]
  total: number
  limit: number
  offset: number
}
export interface DocumentListResponse {
  documents: DocumentRecord[]
  total: number
  limit: number
  offset: number
}
export interface CodeArtifactListResponse {
  code_artifacts: CodeArtifactRecord[]
  total: number
  limit: number
  offset: number
}
export interface FileListResponse {
  files: FileRecord[]
  total: number
  limit: number
  offset: number
}
export interface SkillListResponse {
  skills: SkillRecord[]
  total: number
  limit: number
  offset: number
}
export interface ActivityListResponse {
  events: ActivityEventRecord[]
  total: number
  limit: number
  offset: number
}
