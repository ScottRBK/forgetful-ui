import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../../src/App'
import type { TaskSummaryRecord } from '../../src/api/types'
import { buildPlanDependencyGraph, downstreamDependentIds } from '../../src/lib/planDependencyGraph'
import { navigate, parseRoute, plansHref } from '../../src/router'
import { installFetchStub, jsonResponse } from '../helpers/fetchStub'
import { project } from '../helpers/synthetic'

function taskSummary(id: number, overrides: Partial<TaskSummaryRecord> = {}): TaskSummaryRecord {
  return {
    id,
    plan_id: 1,
    title: `Task ${id}`,
    state: 'todo',
    priority: 'P2',
    blocked: false,
    dependency_ids: [],
    ...overrides,
  }
}

describe('buildPlanDependencyGraph', () => {
  it('lays out a linear chain with increasing layers', () => {
    const tasks = [
      taskSummary(1),
      taskSummary(2, { dependency_ids: [1] }),
      taskSummary(3, { dependency_ids: [2] }),
    ]
    const graph = buildPlanDependencyGraph(tasks)
    expect(graph.stats.criticalPathDepth).toBe(3)
    expect(graph.stats.rootTaskCount).toBe(1)
    expect(graph.stats.inPlanEdgeCount).toBe(2)
    const layers = graph.nodes.map((node) => [node.task.id, node.layer])
    expect(layers).toEqual([
      [1, 0],
      [2, 1],
      [3, 2],
    ])
  })

  it('lays out a diamond DAG and counts blocked tasks', () => {
    const tasks = [
      taskSummary(1),
      taskSummary(2, { dependency_ids: [1] }),
      taskSummary(3, { dependency_ids: [1] }),
      taskSummary(4, { dependency_ids: [2, 3], blocked: true }),
    ]
    const graph = buildPlanDependencyGraph(tasks)
    expect(graph.stats.inPlanEdgeCount).toBe(4)
    expect(graph.stats.blockedTaskCount).toBe(1)
    expect(graph.nodes.find((node) => node.task.id === 4)?.layer).toBe(2)
  })

  it('keeps disconnected roots at layer zero', () => {
    const graph = buildPlanDependencyGraph([taskSummary(1), taskSummary(2), taskSummary(3)])
    expect(graph.stats.rootTaskCount).toBe(3)
    expect(graph.nodes.every((node) => node.layer === 0)).toBe(true)
  })

  it('flags cycles without hanging and assigns a fallback layer', () => {
    const tasks = [taskSummary(1, { dependency_ids: [2] }), taskSummary(2, { dependency_ids: [1] })]
    const started = performance.now()
    const graph = buildPlanDependencyGraph(tasks)
    expect(performance.now() - started).toBeLessThan(50)
    expect(graph.hasCycle).toBe(true)
    expect(graph.cyclicTaskIds).toEqual([1, 2])
  })

  it('tracks external dependency references', () => {
    const graph = buildPlanDependencyGraph([
      taskSummary(10, { dependency_ids: [999] }),
      taskSummary(11, { dependency_ids: [10, 888] }),
    ])
    expect(graph.externalDependencyIds).toEqual([888, 999])
    expect(graph.stats.externalEdgeCount).toBe(2)
    expect(graph.stats.inPlanEdgeCount).toBe(1)
  })

  it('lists downstream dependents for a task', () => {
    const tasks = [
      taskSummary(1),
      taskSummary(2, { dependency_ids: [1] }),
      taskSummary(3, { dependency_ids: [1] }),
    ]
    expect(downstreamDependentIds(tasks, 1)).toEqual([2, 3])
  })
})

describe('Plans dependency workflow', () => {
  const plan = {
    id: 55,
    title: 'Dependency plan',
    project_id: 7,
    goal: 'Plan goal',
    status: 'active',
    task_count: 3,
  }

  const summaries = [
    taskSummary(65, { title: 'Root task', state: 'done' }),
    taskSummary(66, { title: 'Mid task', state: 'doing', dependency_ids: [65] }),
    taskSummary(67, { title: 'Leaf task', state: 'todo', dependency_ids: [66] }),
  ]

  const detailFor = (id: number) => ({
    id,
    plan_id: 55,
    title: summaries.find((task) => task.id === id)?.title ?? `Task ${id}`,
    state: summaries.find((task) => task.id === id)?.state ?? 'todo',
    dependency_ids: summaries.find((task) => task.id === id)?.dependency_ids ?? [],
    criteria: [],
  })

  function installPlanningStub() {
    return installFetchStub([
      { match: '/health', handler: () => jsonResponse({ status: 'healthy' }) },
      {
        match: '/api/v1/auth/info',
        handler: () => jsonResponse({ authEnabled: false, authMode: 'disabled' }),
      },
      {
        match: '/.well-known',
        handler: () =>
          jsonResponse({
            schema_version: 1,
            capabilities: { planning: true, skills: false, files: false, activity_stream: false },
          }),
      },
      {
        match: '/api/v1/projects',
        handler: () => jsonResponse({ projects: [project(7, 'Synthetic project')], total: 1 }),
      },
      {
        match: '/api/v1/projects/7',
        handler: () => jsonResponse(project(7, 'Synthetic project')),
      },
      {
        match: '/api/v1/plans/55',
        handler: () => jsonResponse(plan),
      },
      {
        match: '/api/v1/tasks',
        handler: (request) => {
          const planId = request.url.searchParams.get('plan_id')
          if (planId !== '55') {
            return jsonResponse({ tasks: [], total: 0, limit: 100, offset: 0 })
          }
          return jsonResponse({ tasks: summaries, total: summaries.length, limit: 100, offset: 0 })
        },
      },
      {
        match: /\/api\/v1\/tasks\/\d+$/,
        handler: (request) => {
          const id = Number(request.url.pathname.split('/').at(-1))
          return jsonResponse(detailFor(id))
        },
      },
    ])
  }

  it('switches to dependency view, navigates nodes, and preserves view in URLs', async () => {
    window.history.replaceState(null, '', '/#/plans/55?view=deps&task=66')
    const fetchStub = installPlanningStub()
    render(<App />)

    expect(
      await screen.findByRole('img', { name: 'Plan task dependency graph' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Dependency graph')).toBeInTheDocument()

    const graph = document.querySelector('[data-plan-deps-graph]')
    expect(graph).not.toBeNull()

    const user = userEvent.setup()
    const leafLink = graph?.querySelector('[data-task-graph-id="67"]') as HTMLAnchorElement | null
    expect(leafLink?.getAttribute('href')).toBe('#/plans/55?task=67&view=deps')
    navigate(plansHref({ planId: 55, taskId: 67, view: 'deps' }))
    expect(await screen.findByRole('heading', { name: 'Leaf task' })).toBeInTheDocument()

    const detail = screen.getByLabelText('Task detail')
    await user.click(within(detail).getByRole('link', { name: /Mid task/i }))
    expect(window.location.hash).toBe('#/plans/55?task=66&view=deps')
    expect(await screen.findByRole('heading', { name: 'Mid task' })).toBeInTheDocument()

    const detailOnMid = screen.getByLabelText('Task detail')
    await user.click(within(detailOnMid).getByRole('link', { name: /Leaf task/i }))
    expect(window.location.hash).toBe('#/plans/55?task=67&view=deps')

    await user.click(screen.getByRole('link', { name: 'Board' }))
    expect(window.location.hash).toBe('#/plans/55?task=67')
    expect(screen.getByText('Task board')).toBeInTheDocument()

    expect(fetchStub.requests.every((request) => request.method === 'GET')).toBe(true)
    expect(plansHref({ planId: 55, view: 'deps' })).toBe('#/plans/55?view=deps')
    const parsed = parseRoute('#/plans/55?task=66&view=deps')
    expect(parsed.kind === 'plans' && parsed.view).toBe('deps')
  })
})
