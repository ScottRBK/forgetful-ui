import { useEffect, useState } from 'react'
import { getProject, listProjects } from '../api/client'
import { DetailField } from '../components/DetailField'
import { EmptyPanel, ErrorPanel } from '../components/Feedback'
import { ResourceLayout } from '../components/ResourceLayout'
import { useApiData } from '../hooks/useApiData'
import { formatDate } from '../lib/format'
import type { ProjectsRoute } from '../router'
import { memoriesHref, navigate, projectsHref } from '../router'

function ProjectDetail({ projectId }: { projectId: number }) {
  const detail = useApiData(`project-${projectId}`, (signal) => getProject(projectId, signal))
  if (detail.state.status === 'loading') {
    return <div className="p-4 text-[12px] text-muted">Loading project…</div>
  }
  if (detail.state.status === 'error') {
    if (detail.state.httpStatus === 404) {
      return (
        <EmptyPanel title="Project not found">
          <p>This project is unavailable.</p>
        </EmptyPanel>
      )
    }
    return (
      <ErrorPanel
        title="Could not load project"
        message={detail.state.message}
        onRetry={detail.retry}
      />
    )
  }
  if (detail.state.status !== 'ready') return null
  const project = detail.state.data
  const lastEncodingPoint = project.last_encoding_point ?? '—'
  return (
    <div className="p-4">
      <h3 className="text-[16px] font-semibold text-ink">{project.name}</h3>
      <p className="mt-1 text-[11px] text-muted">
        {project.project_type ?? 'Project'} · {project.status ?? 'unknown status'}
      </p>
      <div className="mt-4 rounded border border-line bg-canvas/60 p-3">
        <p className="prose-copy">{project.description || 'No description recorded.'}</p>
      </div>
      {project.notes && (
        <div className="mt-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">Notes</p>
          <p className="prose-copy mt-1">{project.notes}</p>
        </div>
      )}
      <dl className="mt-4">
        <DetailField label="Repository">{project.repo_name ?? '—'}</DetailField>
        <DetailField label="Memory count">{project.memory_count ?? 0}</DetailField>
        <DetailField label="Last encoding point">{lastEncodingPoint}</DetailField>
        <DetailField label="Created">{formatDate(project.created_at)}</DetailField>
        <DetailField label="Updated">{formatDate(project.updated_at)}</DetailField>
      </dl>
      <a href={memoriesHref({ projectId: projectId, page: 1 })} className="btn-secondary mt-4">
        View project memories
      </a>
      <p className="mt-2 text-[10px] text-muted">
        Memory links use the existing project filter; no records are modified.
      </p>
    </div>
  )
}

export default function ProjectsScreen({ route }: { route: ProjectsRoute }) {
  const [repoInput, setRepoInput] = useState(route.repoName ?? '')
  useEffect(() => setRepoInput(route.repoName ?? ''), [route.repoName])

  const list = useApiData(`projects-${route.status ?? ''}-${route.repoName ?? ''}`, (signal) =>
    listProjects({ status: route.status, repoName: route.repoName }, signal),
  )
  const projects = list.state.status === 'ready' ? list.state.data.projects : []

  function updateRoute(params: { status?: string | null; repoName?: string | null }) {
    navigate(
      projectsHref({
        projectId: route.projectId,
        status: params.status === undefined ? route.status : params.status,
        repoName: params.repoName === undefined ? route.repoName : params.repoName,
      }),
    )
  }

  return (
    <ResourceLayout
      listTitle="Projects"
      listSummary={
        list.state.status === 'ready' ? (
          <span className="text-[10px] text-muted">{list.state.data.total} total</span>
        ) : null
      }
      detailTitle="Project detail"
      selectedId={route.projectId}
      backHref={projectsHref({ status: route.status, repoName: route.repoName })}
      list={
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
            <label htmlFor="project-status-filter" className="sr-only">
              Status filter
            </label>
            <select
              id="project-status-filter"
              aria-label="Status filter"
              value={route.status ?? ''}
              onChange={(event) => updateRoute({ status: event.target.value || null })}
              className="field"
            >
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="completed">Completed</option>
            </select>
            <form
              className="flex min-w-0 items-center gap-1.5"
              onSubmit={(event) => {
                event.preventDefault()
                updateRoute({ repoName: repoInput.trim() || null })
              }}
            >
              <label htmlFor="project-repo-filter" className="sr-only">
                Repository filter
              </label>
              <input
                id="project-repo-filter"
                aria-label="Repository filter"
                value={repoInput}
                onChange={(event) => setRepoInput(event.target.value)}
                placeholder="Repository"
                className="field max-w-[170px]"
              />
              <button type="submit" aria-label="Apply repository filter" className="btn-compact">
                Apply
              </button>
            </form>
          </div>
          {list.state.status === 'loading' && (
            <div className="p-4 text-[12px] text-muted">Loading projects…</div>
          )}
          {list.state.status === 'error' && (
            <ErrorPanel
              title="Could not load projects"
              message={list.state.message}
              onRetry={list.retry}
            />
          )}
          {list.state.status === 'ready' && projects.length === 0 && (
            <EmptyPanel title="No projects found">
              <p>Try a different status or repository filter.</p>
            </EmptyPanel>
          )}
          {projects.length > 0 && (
            <ul aria-label="Projects" className="divide-y divide-line">
              {projects.map((project) => (
                <li key={project.id}>
                  <a
                    href={projectsHref({
                      projectId: project.id,
                      status: route.status,
                      repoName: route.repoName,
                    })}
                    data-resource-id={project.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-canvas/70
                      focus-visible:outline-2 focus-visible:outline-offset-2
                      focus-visible:outline-teal"
                    aria-current={route.projectId === project.id ? 'true' : undefined}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-ink">
                        {project.name}
                      </span>
                      <span className="block truncate text-[10px] text-muted">
                        {project.project_type ?? 'project'} · {project.repo_name ?? 'no repo'}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] text-muted">
                      {project.status ?? 'unknown'}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted">
                      {project.memory_count ?? 0} memories
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      }
      detail={
        route.projectId !== null ? (
          <ProjectDetail projectId={route.projectId} />
        ) : (
          <div className="p-4">
            <p className="text-[13px] font-medium text-ink">Select a project</p>
            <p className="mt-1 text-[12px] text-muted">
              Choose a project to read its description, notes, repository and memory count.
            </p>
          </div>
        )
      }
    />
  )
}
