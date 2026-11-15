import { listProjects } from '../api/client'
import type { ProjectRecord } from '../api/types'
import { useApiData } from '../hooks/useApiData'

interface ProjectSelectViewProps {
  value: number | null
  onChange: (projectId: number | null) => void
  projects: ProjectRecord[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}

export function ProjectSelectView({
  value,
  onChange,
  projects,
  loading = false,
  error = null,
  onRetry,
}: ProjectSelectViewProps) {
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
      <label htmlFor="resource-project-filter" className="sr-only">
        Project filter
      </label>
      <select
        id="resource-project-filter"
        aria-label="Project filter"
        value={value ?? ''}
        onChange={(event) =>
          onChange(event.target.value === '' ? null : Number(event.target.value))
        }
        className="field"
      >
        <option value="">All projects</option>
        {loading && (
          <option value="" disabled>
            Loading projects…
          </option>
        )}
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
        {value !== null && !projects.some((project) => project.id === value) && (
          <option value={value}>Project {value}</option>
        )}
      </select>
      {error && (
        <span className="inline-flex items-center gap-1.5 text-[10px] text-copper">
          <span title={error}>Project options unavailable</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="font-medium text-teal"
              aria-label="Retry project options"
            >
              Retry
            </button>
          )}
        </span>
      )}
    </span>
  )
}

interface ProjectSelectProps {
  value: number | null
  onChange: (projectId: number | null) => void
}

export function ProjectSelect({ value, onChange }: ProjectSelectProps) {
  const { state, retry } = useApiData('project-options', (signal) =>
    listProjects({ status: null, repoName: null }, signal),
  )
  return (
    <ProjectSelectView
      value={value}
      onChange={onChange}
      projects={state.status === 'ready' ? state.data.projects : []}
      loading={state.status === 'loading'}
      error={state.status === 'error' ? state.message : null}
      onRetry={retry}
    />
  )
}
