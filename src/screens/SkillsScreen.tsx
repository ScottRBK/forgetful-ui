import { getSkill, getSkillLinks, listSkills } from '../api/client'
import { DetailField } from '../components/DetailField'
import { EmptyPanel, ErrorPanel } from '../components/Feedback'
import { ProjectSelect } from '../components/ProjectSelect'
import { ResourceLayout } from '../components/ResourceLayout'
import { useApiData } from '../hooks/useApiData'
import { type CapabilityState, featureState } from '../hooks/useCapabilities'
import { formatDate } from '../lib/format'
import type { SkillsRoute } from '../router'
import { navigate, skillsHref } from '../router'

function listLabel(values: number[] | undefined): string {
  return values && values.length > 0 ? values.join(', ') : 'None'
}

function SkillDetail({ skillId }: { skillId: number }) {
  const detail = useApiData(`skill-${skillId}`, (signal) => getSkill(skillId, signal))
  const links = useApiData(`skill-links-${skillId}`, (signal) => getSkillLinks(skillId, signal))
  if (detail.state.status === 'loading')
    return <p className="p-4 text-[12px] text-muted">Loading skill…</p>
  if (detail.state.status === 'error') {
    if (detail.state.httpStatus === 404)
      return (
        <EmptyPanel title="Skill not found">
          <p>This skill is unavailable.</p>
        </EmptyPanel>
      )
    return (
      <ErrorPanel
        title="Could not load skill"
        message={detail.state.message}
        onRetry={detail.retry}
      />
    )
  }
  if (detail.state.status !== 'ready') return null
  const skill = detail.state.data
  const metadata = skill.metadata ? JSON.stringify(skill.metadata, null, 2) : null
  return (
    <div className="p-4">
      <h3 className="text-[16px] font-semibold text-ink">{skill.name}</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="chip bg-teal-soft text-teal-ink">
          Importance {skill.importance ?? '—'}
        </span>
        {skill.license && <span className="chip bg-canvas text-muted">{skill.license}</span>}
        {(skill.tags ?? []).map((tag) => (
          <span key={tag} className="chip bg-canvas text-muted">
            {tag}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-ink-soft">{skill.description}</p>
      <div className="mt-4 rounded border border-line bg-canvas/60 p-3">
        <p className="prose-copy">{skill.content || 'No skill content recorded.'}</p>
      </div>
      <dl className="mt-4">
        <DetailField label="Compatibility">{skill.compatibility ?? '—'}</DetailField>
        <DetailField label="Allowed tools">
          {skill.allowed_tools && skill.allowed_tools.length > 0
            ? skill.allowed_tools.join(', ')
            : '—'}
        </DetailField>
        <DetailField label="Project">{skill.project_id ?? '—'}</DetailField>
        <DetailField label="Updated">{formatDate(skill.updated_at)}</DetailField>
      </dl>
      {metadata && (
        <div className="mt-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">Metadata</p>
          <pre className="detail-long-value mt-1">{metadata}</pre>
        </div>
      )}
      <section className="mt-4 rounded border border-line">
        <p
          className={`
          border-b border-line px-3 py-2 text-[10px] font-medium uppercase
          tracking-[0.12em] text-muted
        `}
        >
          Associations
        </p>
        {links.state.status === 'loading' && (
          <p className="p-3 text-[11px] text-muted">Loading associations…</p>
        )}
        {links.state.status === 'error' && (
          <p className="p-3 text-[11px] text-copper">Association metadata unavailable.</p>
        )}
        {links.state.status === 'ready' && (
          <dl className="px-3 py-1">
            <DetailField label="Linked memories">
              {listLabel(links.state.data.memory_ids)}
            </DetailField>
            <DetailField label="Linked files">{listLabel(links.state.data.file_ids)}</DetailField>
            <DetailField label="Linked code artifacts">
              {listLabel(links.state.data.code_artifact_ids)}
            </DetailField>
            <DetailField label="Linked documents">
              {listLabel(links.state.data.document_ids)}
            </DetailField>
          </dl>
        )}
      </section>
    </div>
  )
}

export default function SkillsScreen({
  route,
  capabilities,
  retryCapabilities,
}: {
  route: SkillsRoute
  capabilities: CapabilityState
  retryCapabilities: () => void
}) {
  const skillsState = featureState(capabilities, 'skills')
  const canRead = skillsState === 'enabled' || skillsState === 'unknown'
  const list = useApiData(
    `skills-${route.projectId ?? ''}-${route.importanceMin ?? ''}`,
    (signal) =>
      listSkills({ projectId: route.projectId, importanceThreshold: route.importanceMin }, signal),
    canRead,
  )
  const items = list.state.status === 'ready' ? list.state.data.skills : []

  function update(params: { projectId?: number | null; importanceMin?: number | null }) {
    navigate(
      skillsHref({
        skillId: route.skillId,
        projectId: route.projectId,
        importanceMin: route.importanceMin,
        ...params,
      }),
    )
  }

  if (skillsState === 'loading')
    return <div className="p-4 text-[12px] text-muted">Checking skill availability…</div>
  if (skillsState === 'disabled') {
    return (
      <div className="p-4 sm:p-5">
        <div className="rounded-md border border-line bg-panel p-5">
          <p className="text-[14px] font-semibold text-ink">Skills are unavailable</p>
          <p className="mt-2 max-w-lg text-[12px] text-muted">
            This instance reports skill support as disabled. Skill data and filter options were not
            requested.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4 sm:p-5">
      {skillsState === 'unknown' && (
        <div
          className={`
          flex flex-wrap items-center gap-2 rounded border border-warn-ink/20
          bg-warn-soft px-3 py-2 text-[11px] text-warn-ink
        `}
        >
          <span>Skill availability is unknown. Attempting a read-only request.</span>
          <button type="button" onClick={retryCapabilities} className="btn-compact">
            Retry status
          </button>
        </div>
      )}
      <ResourceLayout
        listTitle="Skills"
        listSummary={
          list.state.status === 'ready' ? (
            <span className="text-[10px] text-muted">{list.state.data.total} total</span>
          ) : null
        }
        detailTitle="Skill detail"
        selectedId={route.skillId}
        backHref={skillsHref({ projectId: route.projectId, importanceMin: route.importanceMin })}
        list={
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
              <ProjectSelect
                value={route.projectId}
                onChange={(projectId) => update({ projectId })}
              />
              <label htmlFor="skill-importance-filter" className="sr-only">
                Minimum importance
              </label>
              <select
                id="skill-importance-filter"
                aria-label="Minimum importance"
                value={route.importanceMin ?? ''}
                onChange={(event) =>
                  update({
                    importanceMin: event.target.value === '' ? null : Number(event.target.value),
                  })
                }
                className="field max-w-[150px]"
              >
                <option value="">Any importance</option>
                {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>
                    Importance {value}+
                  </option>
                ))}
              </select>
            </div>
            {list.state.status === 'loading' && (
              <p className="p-4 text-[12px] text-muted">Loading skills…</p>
            )}
            {list.state.status === 'error' && (
              <ErrorPanel
                title="Could not load skills"
                message={list.state.message}
                onRetry={list.retry}
              />
            )}
            {list.state.status === 'ready' && items.length === 0 && (
              <EmptyPanel title="No skills found">
                <p>Try a different project or importance threshold.</p>
              </EmptyPanel>
            )}
            {items.length > 0 && (
              <ul aria-label="Skills" className="divide-y divide-line">
                {items.map((skill) => (
                  <li key={skill.id}>
                    <a
                      href={skillsHref({
                        skillId: skill.id,
                        projectId: route.projectId,
                        importanceMin: route.importanceMin,
                      })}
                      data-resource-id={skill.id}
                      aria-current={route.skillId === skill.id ? 'true' : undefined}
                      className={`block px-4 py-2.5 hover:bg-canvas/70 ${
                        route.skillId === skill.id ? 'bg-teal-soft/50' : ''
                      }`}
                    >
                      <span className="block truncate text-[12.5px] font-medium text-ink">
                        {skill.name}
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-1.5 text-[10px] text-muted">
                        <span>importance {skill.importance ?? '—'}</span>
                        <span>project {skill.project_id ?? '—'}</span>
                        <span>{formatDate(skill.updated_at)}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </>
        }
        detail={
          route.skillId !== null ? (
            <SkillDetail skillId={route.skillId} />
          ) : (
            <div className="p-4">
              <p className="text-[13px] font-medium text-ink">Select a skill</p>
              <p className="mt-1 text-[12px] text-muted">
                Choose a skill to read its instructions and association metadata.
              </p>
            </div>
          )
        }
      />
    </div>
  )
}
