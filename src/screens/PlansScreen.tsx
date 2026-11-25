import { useEffect, useId, useRef, useState } from 'react'
import { getPlan, getProject, getTask, listPlans, listTasks } from '../api/client'
import type { PlanRecord, TaskDetailRecord, TaskSummaryRecord } from '../api/types'
import { DetailField } from '../components/DetailField'
import { EmptyPanel, ErrorPanel } from '../components/Feedback'
import { OutOfRangePanel } from '../components/OutOfRangePanel'
import { PaginationBar } from '../components/PaginationBar'
import { ProjectSelectView } from '../components/ProjectSelect'
import { type ApiDataState, useApiData } from '../hooks/useApiData'
import { type CapabilityState, featureState } from '../hooks/useCapabilities'
import { useProjectOptions } from '../hooks/useProjectOptions'
import { useResizablePane } from '../hooks/useResizablePane'
import { formatDate } from '../lib/format'
import {
  collectResourcePages,
  RESOURCE_PAGE_SIZE,
  resourceOffset,
  resourceTotalPages,
} from '../lib/resourcePages'
import type { PlansRoute } from '../router'
import { memoriesHref, navigate, plansHref, projectsHref } from '../router'

const TASK_STATES = [
  { value: 'todo', label: 'To do' },
  { value: 'doing', label: 'Doing' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
] as const

function PlanningUnknownNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className={`
        flex flex-wrap items-center gap-2 rounded border border-warn-ink/20
        bg-warn-soft px-3 py-2 text-[11px] text-warn-ink
      `}
    >
      <span>Planning availability is unknown. Attempting a read-only request.</span>
      <button type="button" onClick={onRetry} className="btn-compact">
        Retry status
      </button>
    </div>
  )
}

function TaskCard({
  task,
  planId,
  route,
}: {
  task: TaskSummaryRecord
  planId: number
  route: PlansRoute
}) {
  const selected = route.taskId === task.id
  return (
    <a
      href={plansHref({
        planId,
        taskId: task.id,
        page: route.page,
        projectId: route.projectId,
        status: route.status,
      })}
      data-task-id={task.id}
      aria-current={selected ? 'true' : undefined}
      className={`
        block rounded border border-line bg-panel px-2.5 py-2
        hover:border-line-strong hover:bg-canvas/60
        focus-visible:outline-2 focus-visible:outline-offset-2
        focus-visible:outline-teal ${selected ? 'border-teal bg-teal-soft/50' : ''}
      `}
    >
      <span className="task-card-title block text-[12px] font-medium text-ink">{task.title}</span>
      <span className="mt-1 block text-[10px] text-muted">Priority {task.priority ?? '—'}</span>
      <span className="block text-[10px] text-muted">
        Agent {task.assigned_agent ?? 'Unassigned'}
      </span>
      <span className="block text-[10px] text-muted">
        {task.criteria_met ?? 0}/{task.criteria_total ?? 0} criteria
      </span>
      {task.blocked && (
        <span className="chip mt-1.5 inline-block bg-copper-soft text-copper">Blocked</span>
      )}
    </a>
  )
}

function TaskColumn({
  state,
  label,
  tasks,
  planId,
  route,
}: {
  state: string
  label: string
  tasks: TaskSummaryRecord[]
  planId: number
  route: PlansRoute
}) {
  const headingId = useId()
  return (
    <section
      data-board-column={state}
      aria-labelledby={headingId}
      className="plan-board-column rounded border border-line bg-canvas/40"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-2.5 py-2">
        <h3 id={headingId} className="text-[11px] font-semibold text-ink">
          {label}
        </h3>
        <span className="text-[10px] text-muted">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </span>
      </div>
      {tasks.length === 0 ? (
        <p className="px-2.5 py-3 text-[11px] text-muted">No tasks</p>
      ) : (
        <ul className="space-y-2 p-2">
          {tasks.map((task) => (
            <li key={task.id}>
              <TaskCard task={task} planId={planId} route={route} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function TaskDetailContent({
  state,
  planId,
  retry,
}: {
  state: ApiDataState<TaskDetailRecord>
  planId: number
  retry: () => void
}) {
  if (state.status === 'loading' || state.status === 'idle') {
    return <p className="p-4 text-[12px] text-muted">Loading task…</p>
  }
  if (state.status === 'error') {
    if (state.httpStatus === 404) {
      return (
        <EmptyPanel title="Task not found">
          <p>This task is unavailable.</p>
        </EmptyPanel>
      )
    }
    return <ErrorPanel title="Could not load task" message={state.message} onRetry={retry} />
  }
  const task = state.data
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

function PlanBoard({
  route,
  planId,
  canRead,
  unknownPlanning,
  retryCapabilities,
}: {
  route: PlansRoute
  planId: number
  canRead: boolean
  unknownPlanning: boolean
  retryCapabilities: () => void
}) {
  const [planToken, setPlanToken] = useState(0)
  const [dataToken, setDataToken] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const sawRefreshLoading = useRef(false)
  const planRefreshPending = useRef(false)
  const dataRefreshPending = useRef(false)
  const sawDataLoading = useRef(false)
  const boardRef = useRef<HTMLElement | null>(null)
  const detailRef = useRef<HTMLElement | null>(null)
  const previousTaskId = useRef<number | null>(null)
  const previousPlanId = useRef(planId)
  const pendingTaskFocus = useRef<number | null>(null)
  const hasMounted = useRef(false)
  const retainedPlan = useRef<{ planId: number; plan: PlanRecord } | null>(null)
  const retainedTasks = useRef<{
    planId: number
    tasks: TaskSummaryRecord[]
    total: number
  } | null>(null)
  const detailId = useId()
  const pane = useResizablePane({
    minWidth: 300,
    maxWidth: 640,
    defaultWidth: 400,
    minListWidth: 360,
    label: 'Resize task details',
    controlsId: detailId,
  })

  const plan = useApiData(
    `plan-${planId}-${planToken}`,
    (signal) => getPlan(planId, signal),
    canRead,
  )
  const retainedPlanForCurrent =
    retainedPlan.current?.planId === planId ? retainedPlan.current.plan : null
  const currentPlanData =
    plan.state.status === 'ready' && plan.state.data.id === planId ? plan.state.data : null
  const planForView = currentPlanData ?? retainedPlanForCurrent
  const planRefreshing = plan.state.status === 'loading'
  const planError = plan.state.status === 'error' ? plan.state : null
  const tasks = useApiData(
    `tasks-${planId}-${dataToken}`,
    async (signal) => {
      const result = await collectResourcePages<TaskSummaryRecord>(
        async (limit, offset, pageSignal) => {
          const page = await listTasks({ planId, limit, offset }, pageSignal)
          return {
            items: page.tasks,
            total: page.total,
            limit: page.limit,
            offset: page.offset,
          }
        },
        signal,
      )
      return { tasks: result.items, total: result.total }
    },
    canRead && planForView !== null,
  )
  const taskId = route.taskId
  const taskDetail = useApiData(
    `task-${planId}-${taskId ?? 'none'}-${dataToken}`,
    (signal) => getTask(taskId ?? 0, signal),
    canRead && planForView !== null && taskId !== null,
  )
  const retainedTasksForCurrent =
    retainedTasks.current?.planId === planId ? retainedTasks.current : null
  const taskData = tasks.state.status === 'ready' ? tasks.state.data : retainedTasksForCurrent
  const taskSummaries = taskData?.tasks ?? []
  const hasTask = taskId !== null
  const taskBusy = hasTask && taskDetail.state.status === 'loading'
  const detailAvailable = planForView !== null && hasTask
  const busy =
    plan.state.status === 'loading' || tasks.state.status === 'loading' || taskBusy || refreshing
  const effectiveExpanded = pane.expanded && hasTask
  const planProjectId = planForView?.project_id ?? null
  const project = useApiData(
    `plan-project-${planProjectId ?? 'none'}-${dataToken}`,
    (signal) => getProject(planProjectId ?? 0, signal),
    canRead && planProjectId !== null,
  )

  useEffect(() => {
    if (plan.state.status !== 'ready' || plan.state.data.id !== planId) return
    retainedPlan.current = { planId, plan: plan.state.data }
  }, [planId, plan.state])

  useEffect(() => {
    if (tasks.state.status !== 'ready') return
    retainedTasks.current = {
      planId,
      tasks: tasks.state.data.tasks,
      total: tasks.state.data.total,
    }
  }, [planId, tasks.state])

  useEffect(() => {
    if (!planRefreshPending.current || plan.state.status !== 'ready') return
    planRefreshPending.current = false
    dataRefreshPending.current = true
    sawDataLoading.current = false
    setDataToken((value) => value + 1)
  }, [plan.state.status])

  useEffect(() => {
    if (!refreshing) return
    if (plan.state.status === 'loading') {
      sawRefreshLoading.current = true
      return
    }
    if (dataRefreshPending.current) {
      if (tasks.state.status === 'loading' || taskBusy) {
        sawDataLoading.current = true
        return
      }
      if (!sawDataLoading.current) return
      dataRefreshPending.current = false
      sawDataLoading.current = false
      sawRefreshLoading.current = false
      setRefreshing(false)
      return
    }
    if (sawRefreshLoading.current && tasks.state.status !== 'loading' && !taskBusy) {
      sawRefreshLoading.current = false
      setRefreshing(false)
    }
  }, [refreshing, plan.state.status, tasks.state.status, taskBusy])

  useEffect(() => {
    if (!hasTask) pane.setExpanded(false)
  }, [hasTask, pane.setExpanded])

  useEffect(() => {
    const isNarrow =
      typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1023px)').matches
    const planChanged = previousPlanId.current !== planId
    previousPlanId.current = planId

    if (!hasMounted.current) {
      hasMounted.current = true
      previousTaskId.current = taskId
      if (isNarrow && taskId !== null) pendingTaskFocus.current = taskId
      return
    }

    if (!isNarrow) {
      previousTaskId.current = taskId
      pendingTaskFocus.current = null
      return
    }

    if (taskId !== null) {
      const taskChanged = previousTaskId.current !== taskId
      previousTaskId.current = taskId
      if (taskChanged || planChanged) pendingTaskFocus.current = taskId
      return
    }

    pendingTaskFocus.current = null
    const previousId = previousTaskId.current
    previousTaskId.current = null
    const card =
      previousId !== null
        ? boardRef.current?.querySelector<HTMLElement>(`[data-task-id="${previousId}"]`)
        : null
    if (card) {
      card.scrollIntoView({ block: 'center', inline: 'center' })
      card.focus({ preventScroll: true })
    } else {
      boardRef.current?.focus({ preventScroll: true })
    }
  }, [taskId, planId])

  useEffect(() => {
    if (taskId === null || pendingTaskFocus.current === null || !detailAvailable) return
    if (
      typeof window.matchMedia === 'function' &&
      !window.matchMedia('(max-width: 1023px)').matches
    ) {
      return
    }
    if (!detailRef.current) return
    pendingTaskFocus.current = null
    detailRef.current.scrollIntoView({ block: 'start' })
    detailRef.current.focus({ preventScroll: true })
  }, [taskId, detailAvailable])

  function refresh(): void {
    if (busy) return
    setRefreshing(true)
    planRefreshPending.current = true
    setPlanToken((value) => value + 1)
  }

  const backToPlans = plansHref({
    page: route.page,
    projectId: route.projectId,
    status: route.status,
  })
  const backToBoard = plansHref({
    planId,
    page: route.page,
    projectId: route.projectId,
    status: route.status,
  })

  if (planForView === null) {
    if (planError) {
      return (
        <div className="space-y-3 p-4 sm:p-5">
          {unknownPlanning && <PlanningUnknownNotice onRetry={retryCapabilities} />}
          <a href={backToPlans} className="btn-compact">
            Back to plans
          </a>
          {planError.httpStatus === 404 ? (
            <EmptyPanel title="Plan not found">
              <p>This plan is unavailable.</p>
            </EmptyPanel>
          ) : (
            <ErrorPanel
              title="Could not load plan"
              message={planError.message}
              onRetry={plan.retry}
            />
          )}
        </div>
      )
    }
    return (
      <div className="space-y-3 p-4 sm:p-5">
        {unknownPlanning && <PlanningUnknownNotice onRetry={retryCapabilities} />}
        <a href={backToPlans} className="btn-compact">
          Back to plans
        </a>
        <p className="text-[12px] text-muted">Loading plan…</p>
      </div>
    )
  }

  const planRecord = planForView
  const projectName =
    project.state.status === 'ready' ? project.state.data.name : `Project #${planRecord.project_id}`
  const taskCount = taskData?.total ?? planRecord.task_count ?? 0

  return (
    <div className="space-y-3 p-4 sm:p-5">
      {unknownPlanning && <PlanningUnknownNotice onRetry={retryCapabilities} />}
      <div>
        <a href={backToPlans} className="btn-compact">
          Back to plans
        </a>
      </div>

      <header data-plan-header className="plan-board-header panel-raised p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
              Plan #{planRecord.id}
            </p>
            <h2 className="plan-board-title mt-1 text-[18px] font-semibold text-ink">
              {planRecord.title}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="chip bg-teal-soft text-teal-ink">
                {planRecord.status ?? 'unknown status'}
              </span>
              <a
                href={projectsHref({ projectId: planRecord.project_id })}
                className="font-medium text-teal hover:underline"
              >
                {projectName}
              </a>
              <span className="chip bg-canvas text-ink-soft">{taskCount} tasks</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(refreshing || planRefreshing) && (
              <span role="status" className="text-[10px] text-muted">
                {refreshing ? 'Refreshing board…' : 'Refreshing plan…'}
              </span>
            )}
            <button
              type="button"
              onClick={refresh}
              aria-disabled={busy ? 'true' : undefined}
              className={`btn-secondary ${busy ? 'opacity-50' : ''}`}
            >
              Refresh board
            </button>
          </div>
        </div>

        {planError && (
          <ErrorPanel
            title="Could not refresh plan"
            message={
              planError.httpStatus === 404
                ? 'This plan is unavailable. Showing the previous plan.'
                : `${planError.message} Showing the previous plan.`
            }
            onRetry={plan.retry}
          />
        )}

        {planRecord.goal && (
          <div className="mt-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">Goal</p>
            <p className="prose-copy mt-1">{planRecord.goal}</p>
          </div>
        )}

        {project.state.status === 'error' && (
          <p className="mt-2 text-[11px] text-warn-ink">
            Project name unavailable.{' '}
            <button type="button" onClick={project.retry} className="font-medium underline">
              Retry project name
            </button>
          </p>
        )}

        <a
          href={memoriesHref({ projectId: planRecord.project_id, page: 1 })}
          className="btn-secondary mt-3"
        >
          View project memories
        </a>

        <details className="mt-3 rounded border border-line bg-canvas/40 px-3 py-2">
          <summary className="cursor-pointer text-[11px] font-medium text-ink-soft">
            Plan context and metadata
          </summary>
          {planRecord.context && (
            <div className="mt-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                Context
              </p>
              <p className="prose-copy mt-1">{planRecord.context}</p>
            </div>
          )}
          <dl className="mt-2">
            <DetailField label="External reference">{planRecord.external_ref ?? '—'}</DetailField>
            <DetailField label="Created">{formatDate(planRecord.created_at)}</DetailField>
            <DetailField label="Updated">{formatDate(planRecord.updated_at)}</DetailField>
          </dl>
        </details>
      </header>

      <div
        ref={pane.layoutRef}
        data-plan-board-layout
        className={`plan-board-layout${hasTask ? ' has-task' : ''}${
          effectiveExpanded ? ' is-expanded' : ''
        }`}
        style={pane.layoutStyle}
        aria-busy={busy}
      >
        <section
          ref={boardRef}
          tabIndex={-1}
          data-plan-board
          aria-label="Task board"
          className="plan-board-area panel-raised min-w-0 overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Task board
            </p>
            {taskData && <span className="text-[10px] text-muted">{taskData.total} total</span>}
          </div>
          {taskData === null ? (
            tasks.state.status === 'error' ? (
              <ErrorPanel
                title="Could not load tasks"
                message={tasks.state.message}
                onRetry={tasks.retry}
              />
            ) : (
              <p className="p-4 text-[12px] text-muted">Loading plan tasks…</p>
            )
          ) : (
            <>
              {tasks.state.status === 'loading' && (
                <p role="status" className="px-3 py-2 text-[10px] text-muted">
                  Refreshing task summaries…
                </p>
              )}
              {tasks.state.status === 'error' && (
                <ErrorPanel
                  title="Could not refresh tasks"
                  message={`${tasks.state.message} Showing previous task summaries.`}
                  onRetry={tasks.retry}
                />
              )}
              <div data-board-scroll className="plan-board-scroll">
                <div className="plan-board-columns">
                  {TASK_STATES.map((taskState) => (
                    <TaskColumn
                      key={taskState.value}
                      state={taskState.value}
                      label={taskState.label}
                      tasks={taskSummaries.filter((task) => task.state === taskState.value)}
                      planId={planId}
                      route={route}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        {hasTask && (
          <>
            <div data-resize-handle {...pane.handleProps} className="detail-resize-handle">
              <span className="detail-resize-grip" aria-hidden="true" />
            </div>
            <aside
              ref={detailRef}
              id={detailId}
              tabIndex={-1}
              data-task-detail
              data-resource-detail
              aria-label="Task detail"
              className={`
                task-detail resource-detail panel-raised min-w-0 overflow-hidden
                focus-visible:outline-2 focus-visible:outline-offset-2
                focus-visible:outline-teal lg:sticky lg:top-4
              `}
            >
              <div
                className={`
                  flex items-center justify-between gap-2 border-b border-line px-4 py-2.5
                `}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Task detail
                </p>
                <div className="flex items-center gap-1.5">
                  <a href={backToBoard} className="btn-compact">
                    Back to board
                  </a>
                  <button
                    type="button"
                    onClick={() => pane.setExpanded((value) => !value)}
                    className="btn-compact hidden lg:inline-flex"
                    aria-pressed={effectiveExpanded}
                  >
                    {effectiveExpanded ? 'Restore task details' : 'Expand task details'}
                  </button>
                </div>
              </div>
              <TaskDetailContent
                state={taskDetail.state}
                planId={planId}
                retry={taskDetail.retry}
              />
            </aside>
          </>
        )}
      </div>
    </div>
  )
}

function PlansList({
  route,
  canRead,
  unknownPlanning,
  retryCapabilities,
}: {
  route: PlansRoute
  canRead: boolean
  unknownPlanning: boolean
  retryCapabilities: () => void
}) {
  const projectsQuery = useProjectOptions(canRead)
  const projects = projectsQuery.state.status === 'ready' ? projectsQuery.state.data.projects : []
  const projectNameFor = (projectId: number): string =>
    projects.find((project) => project.id === projectId)?.name ?? `Project #${projectId}`
  const offset = resourceOffset(route.page, RESOURCE_PAGE_SIZE)
  const list = useApiData(
    `plans-${route.page}-${route.projectId ?? ''}-${route.status ?? ''}`,
    (signal) =>
      listPlans(
        {
          projectId: route.projectId,
          status: route.status,
          limit: RESOURCE_PAGE_SIZE,
          offset,
        },
        signal,
      ),
    canRead,
  )
  const plans = list.state.status === 'ready' ? list.state.data.plans : []
  const total = list.state.status === 'ready' ? list.state.data.total : 0
  const totalPages = resourceTotalPages(total, RESOURCE_PAGE_SIZE)

  function updateRoute(params: { projectId?: number | null; status?: string | null }) {
    navigate(
      plansHref({
        projectId: params.projectId === undefined ? route.projectId : params.projectId,
        status: params.status === undefined ? route.status : params.status,
      }),
    )
  }

  return (
    <div className="space-y-3 p-4 sm:p-5">
      {unknownPlanning && <PlanningUnknownNotice onRetry={retryCapabilities} />}
      <section className="panel-raised min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Plans
          </h2>
          {list.state.status === 'ready' && (
            <span className="text-[10px] text-muted">{list.state.data.total} total</span>
          )}
        </div>
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
        {list.state.status === 'ready' &&
          plans.length === 0 &&
          (total > 0 ? (
            <OutOfRangePanel
              page={route.page}
              totalPages={totalPages}
              itemName="plans"
              firstHref={plansHref({ projectId: route.projectId, status: route.status })}
              lastHref={plansHref({
                page: totalPages,
                projectId: route.projectId,
                status: route.status,
              })}
            />
          ) : (
            <EmptyPanel title="No plans found">
              <p>Try a different project or status filter.</p>
            </EmptyPanel>
          ))}
        {plans.length > 0 && (
          <ul aria-label="Plans" className="divide-y divide-line">
            {plans.map((plan) => (
              <li key={plan.id}>
                <a
                  href={plansHref({
                    planId: plan.id,
                    page: route.page,
                    projectId: route.projectId,
                    status: route.status,
                  })}
                  data-resource-id={plan.id}
                  className="block px-4 py-2.5 hover:bg-canvas/70"
                >
                  <span className="block truncate text-[12.5px] font-medium text-ink">
                    {plan.title}
                  </span>
                  <span className="mt-0.5 flex flex-wrap gap-1.5 text-[10px] text-muted">
                    <span>{plan.status ?? 'unknown'}</span>
                    <span className="max-w-full truncate">{projectNameFor(plan.project_id)}</span>
                    <span>{plan.task_count ?? 0} tasks</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {plans.length > 0 && (
          <PaginationBar
            page={route.page}
            totalPages={totalPages}
            total={total}
            limit={RESOURCE_PAGE_SIZE}
            received={plans.length}
            label="Plan"
            hrefForPage={(page) =>
              plansHref({
                page,
                projectId: route.projectId,
                status: route.status,
              })
            }
          />
        )}
      </section>
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
  const unknownPlanning = planning === 'unknown'

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

  if (route.planId !== null) {
    return (
      <PlanBoard
        key={route.planId}
        route={route}
        planId={route.planId}
        canRead={canRead}
        unknownPlanning={unknownPlanning}
        retryCapabilities={retryCapabilities}
      />
    )
  }

  return (
    <PlansList
      route={route}
      canRead={canRead}
      unknownPlanning={unknownPlanning}
      retryCapabilities={retryCapabilities}
    />
  )
}
