import { useEffect, useRef } from 'react'
import { getPlan, getTask, listPlans, listProjects, listTasks } from '../api/client'
import type { PlanRecord } from '../api/types'
import { DetailField } from '../components/DetailField'
import { EmptyPanel, ErrorPanel } from '../components/Feedback'
import { ProjectSelectView } from '../components/ProjectSelect'
import { ResourceLayout } from '../components/ResourceLayout'
import { useApiData } from '../hooks/useApiData'
import { type CapabilityState, featureState } from '../hooks/useCapabilities'
import { formatDate } from '../lib/format'
import type { PlansRoute } from '../router'
import { memoriesHref, navigate, plansHref, projectsHref } from '../router'

function TaskDetail({ taskId, planId }: { taskId: number; planId: number }) {
  const detail = useApiData(`task-${taskId}`, (signal) => getTask(taskId, signal))
  if (detail.state.status === 'loading') {
    return <div className="p-4 text-[12px] text-muted">Loading task…</div>
  }
  if (detail.state.status === 'error') {
    if (detail.state.httpStatus === 404) {
      return (
        <EmptyPanel title="Task not found">
          <p>This task is unavailable.</p>
        </EmptyPanel>
      )
    }
    return (
      <ErrorPanel
        title="Could not load task"
        message={detail.state.message}
        onRetry={detail.retry}
      />
    )
  }
  if (detail.state.status !== 'ready') return null
  const task = detail.state.data
  if (task.plan_id !== planId) {
    return (
      <EmptyPanel title="Task not in this plan">
        <p>
          Task #{task.id} belongs to plan #{task.plan_id}, not the selected plan #{planId}.
        </p>
        <p className="mt-1">The task was not displayed under this plan.</p>
      </EmptyPanel>
    )
  }
  const criteria = task.criteria ?? []
  const metCriteria = criteria.filter((criterion) => criterion.met).length
  return (
    <div className="p-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
        Task #{task.id}
      </p>
      <h3 className="mt-1 text-[15px] font-semibold text-ink">{task.title}</h3>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="chip bg-teal-soft text-teal-ink">{task.state ?? 'unknown state'}</span>
        <span className="chip bg-canvas text-ink-soft">Priority {task.priority ?? '—'}</span>
      </div>
      {task.description && (
        <p className="prose-copy mt-3 rounded border border-line bg-canvas/60 p-3">
          {task.description}
        </p>
      )}
      <dl className="mt-4">
        <DetailField label="Assigned agent">{task.assigned_agent ?? '—'}</DetailField>
        <DetailField label="Criteria">
          {metCriteria}/{criteria.length} met
        </DetailField>
        <DetailField label="Dependencies">
          {(task.dependency_ids ?? []).length > 0 ? (task.dependency_ids ?? []).join(', ') : 'None'}
        </DetailField>
        <DetailField label="Version">{task.version ?? '—'}</DetailField>
        <DetailField label="Updated">{formatDate(task.updated_at)}</DetailField>
      </dl>
      {criteria.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
            Acceptance criteria
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {criteria.map((criterion) => (
              <li key={criterion.id} className="flex items-start gap-2 text-[11px]">
                <span className={criterion.met ? 'text-teal' : 'text-muted'} aria-hidden="true">
                  {criterion.met ? '✓' : '○'}
                </span>
                <span className="text-ink-soft">
                  {criterion.description}
                  <span className="sr-only">{criterion.met ? ' met' : ' not met'}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function PlanDetail({
  plan,
  route,
  projectName,
}: {
  plan: PlanRecord
  route: PlansRoute
  projectName: string
}) {
  const tasks = useApiData(`tasks-${plan.id}`, (signal) => listTasks({ planId: plan.id }, signal))
  const taskDetailRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (route.taskId === null) return
    if (typeof window.matchMedia !== 'function') return
    if (!window.matchMedia('(max-width: 1023px)').matches) return
    taskDetailRef.current?.scrollIntoView({ block: 'start' })
    taskDetailRef.current?.focus({ preventScroll: true })
  }, [route.taskId])

  return (
    <div className="p-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
        Plan #{plan.id}
      </p>
      <h3 className="mt-1 text-[16px] font-semibold text-ink">{plan.title}</h3>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="chip bg-teal-soft text-teal-ink">{plan.status ?? 'unknown status'}</span>
        <span className="chip bg-canvas text-ink-soft">{plan.task_count ?? 0} tasks</span>
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Project:{' '}
        <a
          href={projectsHref({ projectId: plan.project_id })}
          className="font-medium text-teal hover:underline"
        >
          {projectName}
        </a>
      </p>
      {plan.goal && (
        <div className="mt-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">Goal</p>
          <p className="prose-copy mt-1">{plan.goal}</p>
        </div>
      )}
      {plan.context && (
        <div className="mt-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">Context</p>
          <p className="prose-copy mt-1">{plan.context}</p>
        </div>
      )}
      <dl className="mt-4">
        <DetailField label="External reference">{plan.external_ref ?? '—'}</DetailField>
        <DetailField label="Updated">{formatDate(plan.updated_at)}</DetailField>
      </dl>
      <a
        href={memoriesHref({ projectId: plan.project_id, page: 1 })}
        className="btn-secondary mt-4"
      >
        View project memories
      </a>

      <section className="mt-5 overflow-hidden rounded border border-line">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Tasks
          </h4>
          {tasks.state.status === 'ready' && (
            <span className="text-[10px] text-muted">{tasks.state.data.total} total</span>
          )}
        </div>
        {tasks.state.status === 'loading' && (
          <p className="p-3 text-[12px] text-muted">Loading plan tasks…</p>
        )}
        {tasks.state.status === 'error' && (
          <ErrorPanel
            title="Could not load tasks"
            message={tasks.state.message}
            onRetry={tasks.retry}
          />
        )}
        {tasks.state.status === 'ready' && tasks.state.data.tasks.length === 0 && (
          <p className="p-3 text-[12px] text-muted">This plan has no tasks.</p>
        )}
        {tasks.state.status === 'ready' && tasks.state.data.tasks.length > 0 && (
          <ul className="divide-y divide-line">
            {tasks.state.data.tasks.map((task) => (
              <li key={task.id}>
                <a
                  href={plansHref({
                    planId: plan.id,
                    taskId: task.id,
                    projectId: route.projectId,
                    status: route.status,
                  })}
                  data-resource-id={task.id}
                  aria-current={route.taskId === task.id ? 'true' : undefined}
                  className={`block px-3 py-2 hover:bg-canvas/70 ${
                    route.taskId === task.id ? 'bg-teal-soft/50' : ''
                  }`}
                >
                  <span className="block truncate text-[12px] font-medium text-ink">
                    {task.title}
                  </span>
                  <span className="mt-0.5 flex flex-wrap gap-1.5 text-[10px] text-muted">
                    <span>{task.state ?? 'unknown'}</span>
                    <span>{task.priority ?? '—'}</span>
                    {task.blocked && <span className="text-copper">blocked</span>}
                    <span>
                      {task.criteria_met ?? 0}/{task.criteria_total ?? 0} criteria
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-4">
        {route.taskId !== null ? (
          <div ref={taskDetailRef} tabIndex={-1} data-task-detail>
            <TaskDetail taskId={route.taskId} planId={plan.id} />
          </div>
        ) : (
          <p className="text-[12px] text-muted">Select a task to read its full detail.</p>
        )}
      </div>
    </div>
  )
}

export default function PlansScreen({
  route,
  capabilities,
  retryCapabilities,
}: {
  route: PlansRoute
  capabilities: CapabilityState
  retryCapabilities: () => void
}) {
  const planning = featureState(capabilities, 'planning')
  const canRead = planning === 'enabled' || planning === 'unknown'
  const projectsQuery = useApiData(
    'project-options',
    (signal) => listProjects({ status: null, repoName: null }, signal),
    canRead,
  )
  const projects = projectsQuery.state.status === 'ready' ? projectsQuery.state.data.projects : []
  const projectNameFor = (projectId: number): string =>
    projects.find((project) => project.id === projectId)?.name ?? `Project #${projectId}`
  const list = useApiData(
    `plans-${route.projectId ?? ''}-${route.status ?? ''}`,
    (signal) => listPlans({ projectId: route.projectId, status: route.status }, signal),
    canRead,
  )
  const detail = useApiData(
    `plan-${route.planId ?? 'none'}`,
    (signal) => getPlan(route.planId ?? 0, signal),
    canRead && route.planId !== null,
  )
  const plans = list.state.status === 'ready' ? list.state.data.plans : []

  function updateRoute(params: { projectId?: number | null; status?: string | null }) {
    navigate(
      plansHref({
        planId: route.planId,
        taskId: route.taskId,
        projectId: params.projectId === undefined ? route.projectId : params.projectId,
        status: params.status === undefined ? route.status : params.status,
      }),
    )
  }

  if (planning === 'loading') {
    return <div className="p-4 text-[12px] text-muted">Checking planning availability…</div>
  }
  if (planning === 'disabled') {
    return (
      <div className="p-4 sm:p-5">
        <div className="rounded-md border border-line bg-panel p-5">
          <p className="text-[14px] font-semibold text-ink">Planning is unavailable</p>
          <p className="mt-2 max-w-lg text-[12px] text-muted">
            This instance reports planning as disabled. Plans and tasks were not requested.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4 sm:p-5">
      {planning === 'unknown' && (
        <div
          className={`
          flex flex-wrap items-center gap-2 rounded border border-warn-ink/20
          bg-warn-soft px-3 py-2 text-[11px] text-warn-ink
        `}
        >
          <span>Planning availability is unknown. Attempting a read-only request.</span>
          <button type="button" onClick={retryCapabilities} className="btn-compact">
            Retry status
          </button>
        </div>
      )}
      <ResourceLayout
        listTitle="Plans"
        listSummary={
          list.state.status === 'ready' ? (
            <span className="text-[10px] text-muted">{list.state.data.total} total</span>
          ) : null
        }
        detailTitle="Plan detail"
        selectedId={route.planId}
        backHref={plansHref({ projectId: route.projectId, status: route.status })}
        list={
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
              <ProjectSelectView
                value={route.projectId}
                onChange={(projectId) => updateRoute({ projectId })}
                projects={projects}
                loading={projectsQuery.state.status === 'loading'}
                error={projectsQuery.state.status === 'error' ? projectsQuery.state.message : null}
                onRetry={projectsQuery.retry}
              />
              <label htmlFor="plan-status-filter" className="sr-only">
                Plan status filter
              </label>
              <select
                id="plan-status-filter"
                aria-label="Plan status filter"
                value={route.status ?? ''}
                onChange={(event) => updateRoute({ status: event.target.value || null })}
                className="field"
              >
                <option value="">Any status</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            {list.state.status === 'loading' && (
              <p className="p-4 text-[12px] text-muted">Loading plans…</p>
            )}
            {list.state.status === 'error' && (
              <ErrorPanel
                title="Could not load plans"
                message={list.state.message}
                onRetry={list.retry}
              />
            )}
            {list.state.status === 'ready' && plans.length === 0 && (
              <EmptyPanel title="No plans found">
                <p>Try a different project or status filter.</p>
              </EmptyPanel>
            )}
            {plans.length > 0 && (
              <ul aria-label="Plans" className="divide-y divide-line">
                {plans.map((plan) => (
                  <li key={plan.id}>
                    <a
                      href={plansHref({
                        planId: plan.id,
                        projectId: route.projectId,
                        status: route.status,
                      })}
                      data-resource-id={plan.id}
                      aria-current={route.planId === plan.id ? 'true' : undefined}
                      className={`block px-4 py-2.5 hover:bg-canvas/70 ${
                        route.planId === plan.id ? 'bg-teal-soft/50' : ''
                      }`}
                    >
                      <span className="block truncate text-[12.5px] font-medium text-ink">
                        {plan.title}
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-1.5 text-[10px] text-muted">
                        <span>{plan.status ?? 'unknown'}</span>
                        <span className="max-w-full truncate">
                          {projectNameFor(plan.project_id)}
                        </span>
                        <span>{plan.task_count ?? 0} tasks</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </>
        }
        detail={
          route.planId !== null ? (
            detail.state.status === 'loading' ? (
              <p className="p-4 text-[12px] text-muted">Loading plan…</p>
            ) : detail.state.status === 'error' ? (
              detail.state.httpStatus === 404 ? (
                <EmptyPanel title="Plan not found">
                  <p>This plan is unavailable.</p>
                </EmptyPanel>
              ) : (
                <ErrorPanel
                  title="Could not load plan"
                  message={detail.state.message}
                  onRetry={detail.retry}
                />
              )
            ) : detail.state.status === 'ready' ? (
              <PlanDetail
                plan={detail.state.data}
                route={route}
                projectName={projectNameFor(detail.state.data.project_id)}
              />
            ) : null
          ) : (
            <div className="p-4">
              <p className="text-[13px] font-medium text-ink">Select a plan</p>
              <p className="mt-1 text-[12px] text-muted">
                Choose a plan to read its goal, context and plan-scoped tasks.
              </p>
            </div>
          )
        }
      />
    </div>
  )
}
