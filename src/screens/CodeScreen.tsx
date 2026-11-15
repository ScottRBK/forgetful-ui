import { useEffect, useState } from 'react'
import { getCodeArtifact, listCodeArtifacts } from '../api/client'
import { DetailField } from '../components/DetailField'
import { EmptyPanel, ErrorPanel } from '../components/Feedback'
import { ProjectSelect } from '../components/ProjectSelect'
import { ResourceLayout } from '../components/ResourceLayout'
import { useApiData } from '../hooks/useApiData'
import { formatDate } from '../lib/format'
import type { CodeRoute } from '../router'
import { codeHref, navigate } from '../router'

function CodeDetail({ artifactId }: { artifactId: number }) {
  const detail = useApiData(`code-${artifactId}`, (signal) => getCodeArtifact(artifactId, signal))
  if (detail.state.status === 'loading')
    return <p className="p-4 text-[12px] text-muted">Loading code…</p>
  if (detail.state.status === 'error') {
    if (detail.state.httpStatus === 404)
      return (
        <EmptyPanel title="Code artifact not found">
          <p>This code artifact is unavailable.</p>
        </EmptyPanel>
      )
    return (
      <ErrorPanel
        title="Could not load code artifact"
        message={detail.state.message}
        onRetry={detail.retry}
      />
    )
  }
  if (detail.state.status !== 'ready') return null
  const artifact = detail.state.data
  return (
    <div className="p-4">
      <h3 className="text-[16px] font-semibold text-ink">{artifact.title}</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="chip bg-teal-soft text-teal-ink">{artifact.language ?? 'unknown'}</span>
        {(artifact.tags ?? []).map((tag) => (
          <span key={tag} className="chip bg-canvas text-muted">
            {tag}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-ink-soft">{artifact.description}</p>
      <pre
        className={`
          mt-4 max-h-[520px] overflow-auto rounded border border-line bg-sidebar
          p-3 font-mono text-[11px] leading-relaxed text-slate-100
        `}
      >
        <code>{artifact.code || 'No code recorded.'}</code>
      </pre>
      <dl className="mt-4">
        <DetailField label="Project">{artifact.project_id ?? '—'}</DetailField>
        <DetailField label="Created">{formatDate(artifact.created_at)}</DetailField>
        <DetailField label="Updated">{formatDate(artifact.updated_at)}</DetailField>
      </dl>
    </div>
  )
}

export default function CodeScreen({ route }: { route: CodeRoute }) {
  const [languageInput, setLanguageInput] = useState(route.language ?? '')
  useEffect(() => setLanguageInput(route.language ?? ''), [route.language])
  const list = useApiData(`code-list-${route.projectId ?? ''}-${route.language ?? ''}`, (signal) =>
    listCodeArtifacts({ projectId: route.projectId, language: route.language }, signal),
  )
  const artifacts = list.state.status === 'ready' ? list.state.data.code_artifacts : []

  function update(params: { projectId?: number | null; language?: string | null }) {
    navigate(
      codeHref({
        artifactId: route.artifactId,
        projectId: route.projectId,
        language: route.language,
        ...params,
      }),
    )
  }

  return (
    <ResourceLayout
      listTitle="Code artifacts"
      listSummary={
        list.state.status === 'ready' ? (
          <span className="text-[10px] text-muted">{list.state.data.total} total</span>
        ) : null
      }
      detailTitle="Code detail"
      selectedId={route.artifactId}
      backHref={codeHref({ projectId: route.projectId, language: route.language })}
      list={
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
            <ProjectSelect
              value={route.projectId}
              onChange={(projectId) => update({ projectId })}
            />
            <form
              className="flex min-w-0 items-center gap-1.5"
              onSubmit={(event) => {
                event.preventDefault()
                update({ language: languageInput.trim() || null })
              }}
            >
              <label htmlFor="code-language-filter" className="sr-only">
                Language filter
              </label>
              <input
                id="code-language-filter"
                aria-label="Language filter"
                value={languageInput}
                onChange={(event) => setLanguageInput(event.target.value)}
                placeholder="Language"
                className="field max-w-[140px]"
              />
              <button type="submit" aria-label="Apply language filter" className="btn-compact">
                Apply
              </button>
            </form>
          </div>
          {list.state.status === 'loading' && (
            <p className="p-4 text-[12px] text-muted">Loading code artifacts…</p>
          )}
          {list.state.status === 'error' && (
            <ErrorPanel
              title="Could not load code artifacts"
              message={list.state.message}
              onRetry={list.retry}
            />
          )}
          {list.state.status === 'ready' && artifacts.length === 0 && (
            <EmptyPanel title="No code artifacts found">
              <p>Try a different project or language.</p>
            </EmptyPanel>
          )}
          {artifacts.length > 0 && (
            <ul aria-label="Code artifacts" className="divide-y divide-line">
              {artifacts.map((artifact) => (
                <li key={artifact.id}>
                  <a
                    href={codeHref({
                      artifactId: artifact.id,
                      projectId: route.projectId,
                      language: route.language,
                    })}
                    data-resource-id={artifact.id}
                    aria-current={route.artifactId === artifact.id ? 'true' : undefined}
                    className={`block px-4 py-2.5 hover:bg-canvas/70 ${
                      route.artifactId === artifact.id ? 'bg-teal-soft/50' : ''
                    }`}
                  >
                    <span className="block truncate text-[12.5px] font-medium text-ink">
                      {artifact.title}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-1.5 text-[10px] text-muted">
                      <span>{artifact.language ?? 'unknown'}</span>
                      <span>project {artifact.project_id ?? '—'}</span>
                      <span>{formatDate(artifact.updated_at)}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      }
      detail={
        route.artifactId !== null ? (
          <CodeDetail artifactId={route.artifactId} />
        ) : (
          <div className="p-4">
            <p className="text-[13px] font-medium text-ink">Select a code artifact</p>
            <p className="mt-1 text-[12px] text-muted">
              Choose an artifact to read its source as inert text.
            </p>
          </div>
        )
      }
    />
  )
}
