import { expect, test } from '@playwright/test'

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

const syntheticProject = {
  id: 1,
  name: 'Synthetic project',
  status: 'active',
  memory_count: 1,
}

const syntheticPlan = {
  id: 55,
  title: 'Dependency graph plan',
  project_id: 1,
  goal: 'Exercise dependency graph.',
  status: 'active',
  task_count: 3,
}

const task65 = {
  id: 65,
  plan_id: 55,
  title: 'Root prerequisite',
  state: 'done',
  priority: 'P3',
  dependency_ids: [],
  blocked: false,
}

const task66 = {
  id: 66,
  plan_id: 55,
  title: 'Middle task',
  state: 'doing',
  priority: 'P1',
  dependency_ids: [65],
  blocked: false,
}

const task67 = {
  id: 67,
  plan_id: 55,
  title: 'Final task',
  state: 'todo',
  priority: 'P2',
  dependency_ids: [66],
  blocked: true,
}

test('plan dependency graph toggles, renders DAG, and stays GET-only', async ({ page }) => {
  const methods: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/')) methods.push(request.method())
  })

  await page.route('**/health', async (route) => {
    await route.fulfill(json({ status: 'healthy', service: 'Forgetful' }))
  })
  await page.route('**/.well-known', async (route) => {
    await route.fulfill(
      json({
        schema_version: 1,
        capabilities: { planning: true, skills: false, files: false, activity_stream: false },
      }),
    )
  })
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/projects') {
      await route.fulfill(json({ projects: [syntheticProject], total: 1, limit: 50, offset: 0 }))
      return
    }
    if (url.pathname === '/api/v1/projects/1') {
      await route.fulfill(json(syntheticProject))
      return
    }
    if (url.pathname === '/api/v1/plans/55') {
      await route.fulfill(json(syntheticPlan))
      return
    }
    if (url.pathname === '/api/v1/tasks') {
      await route.fulfill(
        json({ tasks: [task65, task66, task67], total: 3, limit: 100, offset: 0 }),
      )
      return
    }
    const taskMatch = /^\/api\/v1\/tasks\/(\d+)$/.exec(url.pathname)
    if (taskMatch) {
      const id = Number(taskMatch[1])
      const detail =
        id === 65
          ? { ...task65, criteria: [] }
          : id === 66
            ? { ...task66, criteria: [] }
            : { ...task67, criteria: [] }
      await route.fulfill(json(detail))
      return
    }
    await route.fulfill(json({}))
  })

  await page.goto('/#/plans/55?view=deps')
  await expect(page.locator('[data-plan-deps-graph]')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Plan task dependency graph' })).toBeVisible()
  await expect(page.locator('[data-plan-deps-graph] path')).not.toHaveCount(0)

  await page.locator('[data-task-graph-id="66"]').click()
  await expect(page).toHaveURL(/task=66&view=deps/)
  await expect(page.getByRole('heading', { name: 'Middle task' })).toBeVisible()

  const detail = page.locator('[data-task-detail]')
  await detail.getByRole('link', { name: /Root prerequisite/i }).click()
  await expect(page).toHaveURL(/task=65&view=deps/)

  const nonGet = [...new Set(methods.filter((method) => method !== 'GET'))]
  expect(nonGet).toEqual([])
})
