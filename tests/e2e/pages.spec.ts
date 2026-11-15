import { expect, type Page, test } from '@playwright/test'

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

interface PageApiOptions {
  capabilities?: Record<string, unknown>
  capabilitiesStatus?: number
  memories?: unknown[]
  activity?: unknown[]
  projects?: unknown[]
  plans?: unknown[]
  taskSummaries?: unknown[]
  taskDetails?: unknown[]
  documents?: unknown[]
  codeArtifacts?: unknown[]
  files?: unknown[]
  skills?: unknown[]
  skillLinks?: Record<string, unknown>
}

const syntheticProject = {
  id: 1,
  name: 'Synthetic project',
  description: 'Synthetic project description.',
  notes: 'Synthetic project notes.',
  project_type: 'development',
  status: 'active',
  repo_name: 'synthetic/repo',
  memory_count: 12,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const syntheticPlan = {
  id: 55,
  title: 'Synthetic plan',
  project_id: 1,
  goal: 'Synthetic plan goal.',
  context: 'Synthetic plan context.',
  status: 'active',
  external_ref: 'synthetic-ref',
  task_count: 2,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const syntheticTaskSummary = {
  id: 66,
  plan_id: 55,
  title: 'Synthetic task',
  state: 'doing',
  priority: 'P1',
  assigned_agent: 'synthetic-agent',
  version: 2,
  criteria_met: 1,
  criteria_total: 2,
  blocked: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const syntheticTaskDetail = {
  id: 66,
  plan_id: 55,
  title: 'Synthetic task',
  description: 'Synthetic task description.',
  state: 'doing',
  priority: 'P1',
  assigned_agent: 'synthetic-agent',
  version: 2,
  criteria: [
    { id: 1, task_id: 66, description: 'Synthetic criterion one', met: true },
    { id: 2, task_id: 66, description: 'Synthetic criterion two', met: false },
  ],
  dependency_ids: [65],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const syntheticTaskAllSummary = {
  ...syntheticTaskSummary,
  id: 67,
  title: 'Synthetic all-met task',
  criteria_met: 2,
  criteria_total: 2,
}

const syntheticTaskAllDetail = {
  ...syntheticTaskDetail,
  id: 67,
  title: 'Synthetic all-met task',
  criteria: [
    { id: 3, task_id: 67, description: 'All-met criterion one', met: true },
    { id: 4, task_id: 67, description: 'All-met criterion two', met: true },
  ],
}

const syntheticWrongPlanTask = {
  ...syntheticTaskDetail,
  id: 77,
  plan_id: 999,
  title: 'Task belonging to a different plan',
}

const syntheticDocument = {
  id: 73,
  title: 'Synthetic document',
  description: 'Synthetic document description.',
  content: '# Synthetic document\n\n<script>window.__xss = true</script>',
  document_type: 'markdown',
  filename: 'synthetic.md',
  size_bytes: 128,
  tags: ['fixture', 'document'],
  project_id: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const syntheticCode = {
  id: 74,
  title: 'Synthetic code artifact',
  description: 'Synthetic code description.',
  code: 'const synthetic = true\n'.repeat(20),
  language: 'typescript',
  tags: ['fixture', 'code'],
  project_id: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const syntheticFile = {
  id: 75,
  filename: 'synthetic.png',
  description: 'Synthetic file description.',
  mime_type: 'image/png',
  size_bytes: 2048,
  tags: ['fixture', 'file'],
  project_id: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const syntheticFileDetail = {
  ...syntheticFile,
  data: 'c2VjcmV0LWJpbmFyeS1kYXRh',
}

const syntheticSkill = {
  id: 76,
  name: 'synthetic-skill',
  description: 'Synthetic skill description.',
  content: '# Synthetic skill\n\nDo the synthetic steps.',
  license: 'MIT',
  compatibility: 'Synthetic environment.',
  allowed_tools: ['Read'],
  metadata: { author: 'fixture' },
  tags: ['fixture', 'skill'],
  importance: 8,
  project_id: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const syntheticSkillLinks = {
  memory_ids: [901],
  file_ids: [75],
  code_artifact_ids: [74],
  document_ids: [73],
}

async function installBaseApi(page: Page, options: PageApiOptions = {}) {
  const requests: URL[] = []
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/.well-known', (route) =>
    route.fulfill(
      json(
        options.capabilities ?? {
          schema_version: 1,
          capabilities: { planning: true, skills: false, files: false, activity_stream: false },
        },
        options.capabilitiesStatus ?? 200,
      ),
    ),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/memories') {
      await route.fulfill(
        json({
          memories: options.memories ?? [],
          total: options.memories?.length ?? 0,
          limit: Number(url.searchParams.get('limit') ?? 20),
          offset: Number(url.searchParams.get('offset') ?? 0),
        }),
      )
      return
    }
    if (url.pathname === '/api/v1/activity') {
      await route.fulfill(
        json({
          events: options.activity ?? [],
          total: options.activity?.length ?? 0,
          limit: Number(url.searchParams.get('limit') ?? 50),
          offset: Number(url.searchParams.get('offset') ?? 0),
        }),
      )
      return
    }
    if (url.pathname === '/api/v1/projects') {
      await route.fulfill(
        json({ projects: options.projects ?? [], total: options.projects?.length ?? 0 }),
      )
      return
    }
    const projectMatch = /^\/api\/v1\/projects\/(\d+)$/.exec(url.pathname)
    if (projectMatch?.[1]) {
      const id = Number(projectMatch[1])
      await route.fulfill(
        json(
          (options.projects ?? []).find((item) => (item as { id?: number }).id === id) ??
            syntheticProject,
        ),
      )
      return
    }
    if (url.pathname === '/api/v1/plans') {
      await route.fulfill(json({ plans: options.plans ?? [], total: options.plans?.length ?? 0 }))
      return
    }
    const planMatch = /^\/api\/v1\/plans\/(\d+)$/.exec(url.pathname)
    if (planMatch?.[1]) {
      const id = Number(planMatch[1])
      await route.fulfill(
        json(
          (options.plans ?? []).find((item) => (item as { id?: number }).id === id) ??
            syntheticPlan,
        ),
      )
      return
    }
    if (url.pathname === '/api/v1/tasks') {
      await route.fulfill(
        json({ tasks: options.taskSummaries ?? [], total: options.taskSummaries?.length ?? 0 }),
      )
      return
    }
    const taskMatch = /^\/api\/v1\/tasks\/(\d+)$/.exec(url.pathname)
    if (taskMatch?.[1]) {
      const id = Number(taskMatch[1])
      await route.fulfill(
        json(
          (options.taskDetails ?? []).find((item) => (item as { id?: number }).id === id) ??
            syntheticTaskDetail,
        ),
      )
      return
    }
    if (url.pathname === '/api/v1/documents') {
      const documentType = url.searchParams.get('document_type')
      const documents = (options.documents ?? []).filter(
        (item) =>
          documentType === null ||
          (item as { document_type?: string }).document_type === documentType,
      )
      await route.fulfill(json({ documents, total: documents.length }))
      return
    }
    const documentMatch = /^\/api\/v1\/documents\/(\d+)$/.exec(url.pathname)
    if (documentMatch?.[1]) {
      const id = Number(documentMatch[1])
      await route.fulfill(
        json(
          (options.documents ?? []).find((item) => (item as { id?: number }).id === id) ??
            syntheticDocument,
        ),
      )
      return
    }
    if (url.pathname === '/api/v1/code-artifacts') {
      await route.fulfill(
        json({
          code_artifacts: options.codeArtifacts ?? [],
          total: options.codeArtifacts?.length ?? 0,
        }),
      )
      return
    }
    const codeMatch = /^\/api\/v1\/code-artifacts\/(\d+)$/.exec(url.pathname)
    if (codeMatch?.[1]) {
      const id = Number(codeMatch[1])
      await route.fulfill(
        json(
          (options.codeArtifacts ?? []).find((item) => (item as { id?: number }).id === id) ??
            syntheticCode,
        ),
      )
      return
    }
    if (url.pathname === '/api/v1/files') {
      await route.fulfill(json({ files: options.files ?? [], total: options.files?.length ?? 0 }))
      return
    }
    const fileMatch = /^\/api\/v1\/files\/(\d+)$/.exec(url.pathname)
    if (fileMatch?.[1]) {
      const id = Number(fileMatch[1])
      await route.fulfill(
        json(
          (options.files ?? []).find((item) => (item as { id?: number }).id === id) ??
            syntheticFileDetail,
        ),
      )
      return
    }
    if (url.pathname === '/api/v1/skills') {
      await route.fulfill(
        json({ skills: options.skills ?? [], total: options.skills?.length ?? 0 }),
      )
      return
    }
    const skillLinksMatch = /^\/api\/v1\/skills\/(\d+)\/links$/.exec(url.pathname)
    if (skillLinksMatch?.[1]) {
      await route.fulfill(json(options.skillLinks ?? syntheticSkillLinks))
      return
    }
    const skillMatch = /^\/api\/v1\/skills\/(\d+)$/.exec(url.pathname)
    if (skillMatch?.[1]) {
      const id = Number(skillMatch[1])
      await route.fulfill(
        json(
          (options.skills ?? []).find((item) => (item as { id?: number }).id === id) ??
            syntheticSkill,
        ),
      )
      return
    }
    await route.fulfill(json({ error: 'Unexpected test request' }, 500))
  })
  return requests
}

const syntheticMemory = {
  id: 901,
  title: 'Synthetic dashboard memory',
  content: 'Synthetic dashboard content.',
  importance: 7,
  tags: ['fixture'],
  project_ids: [1],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const syntheticEvent = {
  id: 77,
  entity_type: 'memory',
  entity_id: 901,
  action: 'updated',
  changes: null,
  snapshot: { id: 901, title: 'Historical title' },
  actor: 'user',
  actor_id: null,
  metadata: null,
  created_at: '2026-01-03T00:00:00Z',
}

test('dashboard shows real status and bounded recent data', async ({ page }) => {
  const requests = await installBaseApi(page, {
    memories: [syntheticMemory],
    activity: [syntheticEvent],
  })

  await page.goto('/#/dashboard')

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText('Connected', { exact: true })).toBeVisible()
  await expect(page.getByText('Synthetic dashboard memory')).toBeVisible()
  await expect(page.getByText('Historical title')).toBeVisible()
  await expect(page.getByText('Planning').first()).toBeVisible()
  await expect(page.getByText('Skills').first()).toBeVisible()
  await expect(page.getByText('Files').first()).toBeVisible()
  await expect(page.getByText('Activity stream').first()).toBeVisible()

  const memories = requests.filter((url) => url.pathname === '/api/v1/memories')
  const activity = requests.filter((url) => url.pathname === '/api/v1/activity')
  expect(memories).toHaveLength(1)
  expect(memories[0]?.searchParams.get('limit')).toBe('5')
  expect(memories[0]?.searchParams.get('offset')).toBe('0')
  expect(activity).toHaveLength(1)
  expect(activity[0]?.searchParams.get('limit')).toBe('5')
  expect(activity[0]?.searchParams.get('offset')).toBe('0')
  expect(requests.some((url) => url.pathname === '/api/v1/projects')).toBe(false)
  expect(requests.some((url) => url.pathname === '/api/v1/documents')).toBe(false)
  expect(requests.some((url) => url.pathname === '/api/v1/code-artifacts')).toBe(false)
  expect(requests.some((url) => url.pathname === '/api/v1/files')).toBe(false)
  expect(requests.some((url) => url.pathname === '/api/v1/skills')).toBe(false)
  expect(requests.some((url) => url.pathname === '/api/v1/plans')).toBe(false)
})

test('projects supports filters, detail and project memory link', async ({ page }) => {
  const requests = await installBaseApi(page, { projects: [syntheticProject] })

  await page.goto('/#/projects')
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
  await page.getByRole('link', { name: /Synthetic project/ }).click()

  await expect(page.getByText('Synthetic project description.')).toBeVisible()
  await expect(page.getByText('Synthetic project notes.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'View project memories' })).toHaveAttribute(
    'href',
    '#/memories?project=1',
  )

  const statusRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/projects' && url.searchParams.get('status') === 'active'
  })
  await page.getByLabel('Status filter').selectOption('active')
  const statusRequest = await statusRequestPromise
  await expect(page).toHaveURL(/#\/projects\/1\?status=active$/)
  expect(new URL(statusRequest.url()).searchParams.get('status')).toBe('active')

  await page.getByRole('textbox', { name: 'Repository filter' }).fill('synthetic/repo')
  const repoRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      url.pathname === '/api/v1/projects' && url.searchParams.get('repo_name') === 'synthetic/repo'
    )
  })
  await page.getByRole('button', { name: 'Apply repository filter' }).click()
  const repoRequest = await repoRequestPromise
  await expect(page).toHaveURL(/#\/projects\/1\?status=active&repo=synthetic%2Frepo$/)
  expect(new URL(repoRequest.url()).searchParams.get('repo_name')).toBe('synthetic/repo')
  expect(requests.some((url) => url.pathname === '/api/v1/documents')).toBe(false)
})

test('plans filters open an active plan board and return with filters', async ({ page }) => {
  const requests = await installBaseApi(page, {
    projects: [syntheticProject],
    plans: [syntheticPlan],
    taskSummaries: [syntheticTaskSummary, syntheticTaskAllSummary],
    taskDetails: [syntheticTaskDetail, syntheticTaskAllDetail, syntheticWrongPlanTask],
  })

  await page.goto('/#/plans')
  await expect(page.getByRole('heading', { name: 'Plans', level: 2 })).toBeVisible()
  const statusRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/plans' && url.searchParams.get('status') === 'active'
  })
  await page.getByLabel('Plan status filter').selectOption('active')
  const statusRequest = await statusRequestPromise
  await expect(page).toHaveURL(/#\/plans\?status=active$/)
  expect(new URL(statusRequest.url()).searchParams.get('status')).toBe('active')

  const projectRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/plans' && url.searchParams.get('project_id') === '1'
  })
  await page.getByLabel('Project filter').selectOption('1')
  const projectRequest = await projectRequestPromise
  await expect(page).toHaveURL(/#\/plans\?project=1&status=active$/)
  expect(new URL(projectRequest.url()).searchParams.get('project_id')).toBe('1')

  await page.getByRole('link', { name: /Synthetic plan/ }).click()
  await expect(page).toHaveURL(/#\/plans\/55\?project=1&status=active$/)
  const header = page.locator('[data-plan-header]')
  await expect(header.getByRole('heading', { name: 'Synthetic plan' })).toBeVisible()
  await expect(header.getByText('Synthetic plan goal.')).toBeVisible()
  await header.getByText('Plan context and metadata').click()
  await expect(header.getByText('Synthetic plan context.')).toBeVisible()

  await page.getByRole('link', { name: /Synthetic task/ }).click()
  const detail = page.locator('[data-task-detail]')
  await expect(detail.getByText('Synthetic task description.')).toBeVisible()
  await expect(detail.getByText('Synthetic criterion one')).toBeVisible()
  await expect(detail.getByText('Synthetic criterion two')).toBeVisible()
  await expect(detail.getByText('65', { exact: true })).toBeVisible()
  await expect(detail.getByText('1/2 met')).toBeVisible()
  await expect(page).toHaveURL(/#\/plans\/55\?task=66&project=1&status=active$/)

  const taskLists = requests.filter((url) => url.pathname === '/api/v1/tasks')
  expect(taskLists).toHaveLength(1)
  expect(taskLists[0]?.searchParams.get('plan_id')).toBe('55')
  expect(requests.filter((url) => url.pathname === '/api/v1/tasks/66')).toHaveLength(1)

  await page.getByRole('link', { name: /Synthetic all-met task/ }).click()
  await expect(detail.getByText('2/2 met')).toBeVisible()
  await expect(page).toHaveURL(/#\/plans\/55\?task=67&project=1&status=active$/)

  await page.getByRole('link', { name: 'Back to plans' }).click()
  await expect(page).toHaveURL(/#\/plans\?project=1&status=active$/)
  await expect(page.getByRole('heading', { name: 'Plans', level: 2 })).toBeVisible()
  await expect(page.getByLabel('Project filter')).toHaveValue('1')
  await expect(page.getByLabel('Plan status filter')).toHaveValue('active')
  await expect(page.getByRole('link', { name: /Synthetic plan/ })).toBeVisible()
})

test('plan board shows five states, blocked badge and summary cards only', async ({ page }) => {
  const stateTasks = [
    {
      ...syntheticTaskSummary,
      id: 201,
      title: 'Synthetic to do task',
      state: 'todo',
      priority: 'P0',
      blocked: true,
    },
    { ...syntheticTaskSummary, id: 202, title: 'Synthetic doing task', state: 'doing' },
    { ...syntheticTaskSummary, id: 203, title: 'Synthetic waiting task', state: 'waiting' },
    { ...syntheticTaskSummary, id: 204, title: 'Synthetic done task', state: 'done' },
    { ...syntheticTaskSummary, id: 205, title: 'Synthetic cancelled task', state: 'cancelled' },
  ]
  const requests = await installBaseApi(page, {
    projects: [syntheticProject],
    plans: [syntheticPlan],
    taskSummaries: stateTasks,
    taskDetails: stateTasks.map((task) => ({
      ...syntheticTaskDetail,
      id: task.id,
      title: task.title,
      state: task.state,
    })),
  })

  await page.goto('/#/plans/55?project=1&status=active')
  const header = page.locator('[data-plan-header]')
  await expect(header.getByRole('heading', { name: 'Synthetic plan', level: 2 })).toBeVisible()
  await expect(header.getByText('Synthetic plan goal.')).toBeVisible()
  await expect(header.getByRole('link', { name: 'Synthetic project', exact: true })).toBeVisible()
  await expect(header.getByText('active', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to plans' })).toHaveAttribute(
    'href',
    '#/plans?project=1&status=active',
  )

  const states = [
    ['To do', 'Synthetic to do task'],
    ['Doing', 'Synthetic doing task'],
    ['Waiting', 'Synthetic waiting task'],
    ['Done', 'Synthetic done task'],
    ['Cancelled', 'Synthetic cancelled task'],
  ] as const
  for (const [column, title] of states) {
    const region = page.getByRole('region', { name: column, exact: true })
    await expect(region).toBeVisible()
    await expect(region.getByText('1 task', { exact: true })).toBeVisible()
    await expect(region.getByRole('link', { name: new RegExp(title) })).toBeVisible()
  }

  const todo = page.getByRole('region', { name: 'To do', exact: true })
  const todoCard = todo.getByRole('link', { name: /Synthetic to do task/ })
  await expect(todoCard.getByText('Blocked', { exact: true })).toBeVisible()
  await expect(todoCard.getByText('Priority P0', { exact: true })).toBeVisible()
  await expect(todoCard.getByText('Agent synthetic-agent', { exact: true })).toBeVisible()
  await expect(todoCard.getByText('1/2 criteria', { exact: true })).toBeVisible()

  expect(requests.filter((url) => url.pathname === '/api/v1/plans')).toHaveLength(0)
  expect(requests.filter((url) => url.pathname === '/api/v1/projects/1')).toHaveLength(0)
  expect(requests.filter((url) => url.pathname === '/api/v1/tasks')).toHaveLength(1)
  expect(requests.filter((url) => /^\/api\/v1\/tasks\/\d+$/.test(url.pathname))).toHaveLength(0)
  expect(
    new URL(requests.find((url) => url.pathname === '/api/v1/tasks')?.href ?? '').searchParams.get(
      'plan_id',
    ),
  ).toBe('55')
  await expect(page.locator('[data-task-detail]')).toHaveCount(0)
})

test('plan board preserves backend task order within a state', async ({ page }) => {
  const first = { ...syntheticTaskSummary, id: 211, title: 'First ordered task', state: 'doing' }
  const second = { ...syntheticTaskSummary, id: 212, title: 'Second ordered task', state: 'doing' }
  await installBaseApi(page, {
    projects: [syntheticProject],
    plans: [syntheticPlan],
    taskSummaries: [first, second],
  })

  await page.goto('/#/plans/55')
  const doing = page.getByRole('region', { name: 'Doing', exact: true })
  await expect(doing.getByText('2 tasks', { exact: true })).toBeVisible()
  const cards = doing.getByRole('link')
  await expect(cards).toHaveCount(2)
  await expect(cards.nth(0)).toContainText('First ordered task')
  await expect(cards.nth(1)).toContainText('Second ordered task')
})

test('plan board loads detail only on selection and keeps filters when closing', async ({
  page,
}) => {
  const requests = await installBaseApi(page, {
    projects: [syntheticProject],
    plans: [syntheticPlan],
    taskSummaries: [syntheticTaskSummary, syntheticTaskAllSummary],
    taskDetails: [syntheticTaskDetail, syntheticTaskAllDetail],
  })

  await page.goto('/#/plans?project=1&status=active')
  const planRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/plans/55'
  })
  await page.getByRole('link', { name: /Synthetic plan/ }).click()
  await planRequestPromise
  await expect(page.getByRole('region', { name: 'Doing', exact: true })).toBeVisible()
  expect(requests.filter((url) => /^\/api\/v1\/tasks\/\d+$/.test(url.pathname))).toHaveLength(0)

  const detailRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/tasks/66'
  })
  await page.getByRole('link', { name: /Synthetic task/ }).click()
  await detailRequestPromise
  const detail = page.locator('[data-task-detail]')
  await expect(detail.getByText('Synthetic task description.')).toBeVisible()
  await expect(detail.getByText('Synthetic criterion one')).toBeVisible()
  await expect(detail.getByText('Synthetic criterion two')).toBeVisible()
  await expect(detail.getByText('1/2 met')).toBeVisible()
  await expect(detail.getByText('65', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/#\/plans\/55\?task=66&project=1&status=active$/)
  expect(requests.filter((url) => url.pathname === '/api/v1/tasks/67')).toHaveLength(0)

  await page.reload()
  await expect(
    page.locator('[data-task-detail]').getByText('Synthetic task description.'),
  ).toBeVisible()
  await expect(page).toHaveURL(/#\/plans\/55\?task=66&project=1&status=active$/)

  const detailId = await detail.getAttribute('id')
  const handle = page.getByRole('separator', { name: 'Resize task details' })
  await expect(handle).toBeVisible()
  expect(await handle.getAttribute('aria-controls')).toBe(detailId)
  expect(Number(await handle.getAttribute('aria-valuenow'))).toBeGreaterThan(0)
  expect(Number(await handle.getAttribute('aria-valuemax'))).toBeGreaterThan(
    Number(await handle.getAttribute('aria-valuemin')),
  )
  const requestsBeforeResize = requests.length
  const before = await detail.boundingBox()
  const handleBox = await handle.boundingBox()
  if (!before || !handleBox) throw new Error('Missing task resize geometry')
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + 80)
  await page.mouse.down()
  await page.mouse.move(handleBox.x - 80, handleBox.y + 80, { steps: 8 })
  await page.mouse.up()
  await expect
    .poll(async () => (await detail.boundingBox())?.width ?? 0)
    .toBeGreaterThan(before.width + 40)

  const minWidth = Number(await handle.getAttribute('aria-valuemin'))
  await handle.press('Home')
  await expect.poll(async () => (await detail.boundingBox())?.width ?? 0).toBeCloseTo(minWidth, 0)
  await expect.poll(async () => Number(await handle.getAttribute('aria-valuenow'))).toBe(minWidth)
  const atMin = await detail.boundingBox()
  if (!atMin) throw new Error('Missing minimum task detail width')
  expect(atMin.width).toBeLessThanOrEqual(minWidth + 1)

  const maxWidth = Number(await handle.getAttribute('aria-valuemax'))
  await handle.press('End')
  await expect.poll(async () => (await detail.boundingBox())?.width ?? 0).toBeCloseTo(maxWidth, 0)
  await expect.poll(async () => Number(await handle.getAttribute('aria-valuenow'))).toBe(maxWidth)
  const atMax = await detail.boundingBox()
  if (!atMax) throw new Error('Missing maximum task detail width')
  expect(atMax.width).toBeLessThanOrEqual(maxWidth + 1)

  await page.getByRole('button', { name: 'Expand task details' }).click()
  await expect(page.locator('[data-plan-board]')).toBeHidden()
  await expect
    .poll(async () => (await detail.boundingBox())?.width ?? 0)
    .toBeGreaterThan(atMax.width)
  await page.getByRole('button', { name: 'Restore task details' }).click()
  await expect(page.locator('[data-plan-board]')).toBeVisible()
  await expect.poll(async () => (await detail.boundingBox())?.width ?? 0).toBeCloseTo(maxWidth, 0)
  expect(requests.length).toBe(requestsBeforeResize)

  await page.goBack()
  await expect(page).toHaveURL(/#\/plans\/55\?project=1&status=active$/)
  await expect(page.locator('[data-task-detail]')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Synthetic task/ })).toBeVisible()
  await page.goForward()
  await expect(page.locator('[data-task-detail]')).toBeVisible()
  await expect(page.getByText('Synthetic task description.')).toBeVisible()
  await page.getByRole('link', { name: 'Back to board' }).click()
  await expect(page).toHaveURL(/#\/plans\/55\?project=1&status=active$/)
  await expect(page.locator('[data-task-detail]')).toHaveCount(0)

  await page.getByRole('link', { name: 'Back to plans' }).click()
  await expect(page).toHaveURL(/#\/plans\?project=1&status=active$/)
  await expect(page.getByLabel('Project filter')).toHaveValue('1')
  await expect(page.getByLabel('Plan status filter')).toHaveValue('active')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/plans/55?task=66&project=1&status=active')
  const mobileDetail = page.locator('[data-task-detail]')
  await expect(mobileDetail.getByText('Synthetic task description.')).toBeVisible()
  await expect(page.locator('[data-plan-board]')).toBeHidden()
  await expect(page.getByRole('separator', { name: 'Resize task details' })).toBeHidden()
  const mobileBox = await mobileDetail.boundingBox()
  if (!mobileBox) throw new Error('Missing mobile task detail')
  expect(mobileBox.width).toBeLessThanOrEqual(390)
  let overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)

  await page.getByRole('link', { name: 'Back to board' }).click()
  await expect(page.locator('[data-plan-board]')).toBeVisible()
  await expect(page.locator('[data-task-id="66"]')).toBeFocused()
  await expect(page).toHaveURL(/#\/plans\/55\?project=1&status=active$/)
  overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
})

test('plan board manually refreshes plan, summaries and selected task detail', async ({ page }) => {
  const initialPlan = { ...syntheticPlan, title: 'Initial synthetic plan', goal: 'Initial goal.' }
  const refreshedPlan = {
    ...syntheticPlan,
    title: 'Refreshed synthetic plan',
    goal: 'Refreshed goal.',
  }
  const initialTask = { ...syntheticTaskSummary, title: 'Initial board task', state: 'doing' }
  const refreshedTask = {
    ...syntheticTaskSummary,
    title: 'Refreshed board task',
    state: 'done',
    criteria_met: 2,
    criteria_total: 2,
  }
  const initialDetail = { ...syntheticTaskDetail, description: 'Initial task description.' }
  const refreshedDetail = {
    ...syntheticTaskDetail,
    description: 'Refreshed task description.',
    state: 'done',
    criteria: [
      { id: 11, task_id: 66, description: 'Refreshed criterion one', met: true },
      { id: 12, task_id: 66, description: 'Refreshed criterion two', met: true },
    ],
  }
  let phase: 'initial' | 'refresh' = 'initial'
  let releaseRefresh: (() => void) | undefined
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve
  })
  await installBaseApi(page, { projects: [syntheticProject] })
  await page.route('**/api/v1/plans/55', async (route) => {
    if (phase === 'refresh') await refreshGate
    await route.fulfill(json(phase === 'refresh' ? refreshedPlan : initialPlan))
  })
  let summaryRequests = 0
  let detailRequests = 0
  await page.route('**/api/v1/tasks**', async (route) => {
    const url = new URL(route.request().url())
    if (phase === 'refresh') await refreshGate
    if (url.pathname === '/api/v1/tasks') {
      summaryRequests += 1
      const tasks = phase === 'refresh' ? [refreshedTask] : [initialTask]
      await route.fulfill(json({ tasks, total: tasks.length }))
      return
    }
    const match = /^\/api\/v1\/tasks\/(\d+)$/.exec(url.pathname)
    if (match?.[1] === '66') {
      detailRequests += 1
      await route.fulfill(json(phase === 'refresh' ? refreshedDetail : initialDetail))
      return
    }
    await route.fulfill(json({ error: 'Unexpected task request' }, 500))
  })

  await page.goto('/#/plans/55?task=66')
  await expect(page.getByRole('heading', { name: 'Initial synthetic plan' })).toBeVisible()
  await expect(page.getByText('Initial task description.')).toBeVisible()
  await expect(page.getByText('Initial board task')).toBeVisible()

  phase = 'refresh'
  const planRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/plans/55'
  })
  const summaryRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/tasks' && url.searchParams.get('plan_id') === '55'
  })
  const detailRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/tasks/66'
  })
  await page.getByRole('button', { name: 'Refresh board' }).click()
  await expect(page.getByText('Refreshing board…', { exact: true })).toBeVisible()
  releaseRefresh?.()
  await Promise.all([planRequestPromise, summaryRequestPromise, detailRequestPromise])

  await expect(page.getByRole('heading', { name: 'Refreshed synthetic plan' })).toBeVisible()
  await expect(page.getByText('Refreshed goal.')).toBeVisible()
  await expect(page.getByText('Refreshed board task')).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Done', exact: true }).getByText('Refreshed board task'),
  ).toBeVisible()
  await expect(page.getByText('Refreshed task description.')).toBeVisible()
  await expect(page.getByText('Refreshed criterion one')).toBeVisible()
  await expect(page.getByText('2/2 met')).toBeVisible()
  await expect(page.getByText('Refreshing board…', { exact: true })).toHaveCount(0)
  expect(summaryRequests).toBe(2)
  expect(detailRequests).toBe(2)
})

test('task detail bounds match the real board width at 1024', async ({ page }) => {
  await installBaseApi(page, {
    projects: [syntheticProject],
    plans: [syntheticPlan],
    taskSummaries: [syntheticTaskSummary],
    taskDetails: [syntheticTaskDetail],
  })

  await page.setViewportSize({ width: 1024, height: 900 })
  await page.goto('/#/plans/55?task=66')
  const layout = page.locator('[data-plan-board-layout]')
  const detail = page.locator('[data-task-detail]')
  const handle = page.getByRole('separator', { name: 'Resize task details' })
  await expect(detail.locator('h3')).toHaveText('Synthetic task')

  const layoutWidth = await layout.evaluate((element) => element.getBoundingClientRect().width)
  const expectedMax = Math.min(640, Math.max(300, layoutWidth - 360 - 9 - 32))
  await expect
    .poll(async () => Number(await handle.getAttribute('aria-valuemax')))
    .toBe(Math.round(expectedMax))
  await expect
    .poll(async () => (await detail.boundingBox())?.width ?? 0)
    .toBeCloseTo(expectedMax, 0)
  await expect
    .poll(async () => Number(await handle.getAttribute('aria-valuenow')))
    .toBe(Math.round(expectedMax))

  await handle.press('End')
  await expect
    .poll(async () => (await detail.boundingBox())?.width ?? 0)
    .toBeCloseTo(expectedMax, 0)
  expect(Number(await handle.getAttribute('aria-valuenow'))).toBe(Math.round(expectedMax))
  expect(Number(await handle.getAttribute('aria-valuemax'))).toBe(Math.round(expectedMax))

  await handle.press('ArrowRight')
  const narrowed = Math.round(expectedMax) - 20
  await expect.poll(async () => Number(await handle.getAttribute('aria-valuenow'))).toBe(narrowed)
  await expect.poll(async () => (await detail.boundingBox())?.width ?? 0).toBeCloseTo(narrowed, 0)

  const handleBox = await handle.boundingBox()
  if (!handleBox) throw new Error('Missing 1024 task handle')
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + 80)
  await page.mouse.down()
  await page.mouse.move(handleBox.x - 200, handleBox.y + 80, { steps: 8 })
  await page.mouse.up()
  await expect
    .poll(async () => (await detail.boundingBox())?.width ?? 0)
    .toBeCloseTo(expectedMax, 0)
  expect(Number(await handle.getAttribute('aria-valuenow'))).toBe(Math.round(expectedMax))

  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect.poll(async () => Number(await handle.getAttribute('aria-valuemax'))).toBe(640)
  await handle.press('End')
  await expect.poll(async () => (await detail.boundingBox())?.width ?? 0).toBeCloseTo(640, 0)
  await page.setViewportSize({ width: 1024, height: 900 })
  await expect
    .poll(async () => Number(await handle.getAttribute('aria-valuemax')))
    .toBe(Math.round(expectedMax))
  await expect
    .poll(async () => (await detail.boundingBox())?.width ?? 0)
    .toBeCloseTo(expectedMax, 0)
  await expect
    .poll(async () => Number(await handle.getAttribute('aria-valuenow')))
    .toBe(Math.round(expectedMax))

  const refreshPlanPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/plans/55'
  })
  const refreshTasksPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/tasks' && url.searchParams.get('plan_id') === '55'
  })
  const refreshDetailPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/tasks/66'
  })
  await page.getByRole('button', { name: 'Refresh board' }).click()
  await Promise.all([refreshPlanPromise, refreshTasksPromise, refreshDetailPromise])
  await expect(page.getByText('Refreshing board…', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Synthetic plan' })).toBeVisible()
  await expect
    .poll(async () => Number(await handle.getAttribute('aria-valuemax')))
    .toBe(Math.round(expectedMax))
  await expect
    .poll(async () => (await detail.boundingBox())?.width ?? 0)
    .toBeCloseTo(expectedMax, 0)
  expect(Number(await handle.getAttribute('aria-valuenow'))).toBe(Math.round(expectedMax))
})

test('manual refresh keeps board, focused control, scroll and pane width', async ({ page }) => {
  let holdRefresh = false
  let failRefresh = false
  let releaseRefresh: (() => void) | undefined
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve
  })
  await installBaseApi(page, {
    projects: [syntheticProject],
    plans: [syntheticPlan],
    taskSummaries: [syntheticTaskSummary],
    taskDetails: [syntheticTaskDetail],
  })
  await page.route('**/api/v1/plans/55', async (route) => {
    if (holdRefresh) await refreshGate
    if (failRefresh) {
      await route.fulfill(json({ error: 'Synthetic refresh failure' }, 500))
      return
    }
    await route.fallback()
  })

  await page.setViewportSize({ width: 1024, height: 900 })
  await page.goto('/#/plans/55?task=66')
  const board = page.locator('[data-plan-board]')
  const detail = page.locator('[data-task-detail]')
  const handle = page.getByRole('separator', { name: 'Resize task details' })
  const refresh = page.getByRole('button', { name: 'Refresh board' })
  const scroll = page.locator('[data-board-scroll]')
  await expect(board).toBeVisible()
  await expect(detail.locator('h3')).toHaveText('Synthetic task')

  const layoutWidth = await page
    .locator('[data-plan-board-layout]')
    .evaluate((element) => element.getBoundingClientRect().width)
  const expectedMax = Math.round(Math.min(640, Math.max(300, layoutWidth - 360 - 9 - 32)))
  await handle.press('End')
  await expect
    .poll(async () => (await detail.boundingBox())?.width ?? 0)
    .toBeCloseTo(expectedMax, 0)
  await scroll.evaluate((element) => {
    element.scrollLeft = 120
  })
  await refresh.focus()
  await expect(refresh).toBeFocused()

  holdRefresh = true
  const planRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/plans/55'
  })
  await refresh.click()
  await planRequestPromise
  await expect(page.getByText('Refreshing board…', { exact: true })).toBeVisible()
  await expect(board).toBeVisible()
  await expect(detail).toBeVisible()
  await expect(refresh).toBeFocused()
  expect(await scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
  expect((await detail.boundingBox())?.width ?? 0).toBeCloseTo(expectedMax, 0)

  holdRefresh = false
  releaseRefresh?.()
  await expect(page.getByText('Refreshing board…', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Synthetic plan' })).toBeVisible()
  await expect(refresh).toBeFocused()
  await expect(board).toBeVisible()
  await expect(detail.locator('h3')).toHaveText('Synthetic task')
  expect(await scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
  expect((await detail.boundingBox())?.width ?? 0).toBeCloseTo(expectedMax, 0)
  expect(Number(await handle.getAttribute('aria-valuenow'))).toBe(expectedMax)
  expect(Number(await handle.getAttribute('aria-valuemax'))).toBe(expectedMax)

  failRefresh = true
  const failedRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/plans/55'
  })
  await refresh.click()
  await failedRequestPromise
  await expect(page.getByRole('alert')).toContainText('Could not refresh plan')
  await expect(page.getByText(/Showing the previous plan/)).toBeVisible()
  await expect(board).toBeVisible()
  await expect(detail).toBeVisible()
  await expect(refresh).toBeFocused()

  failRefresh = false
  const retryRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/plans/55'
  })
  await page.getByRole('alert').getByRole('button', { name: 'Retry' }).click()
  await retryRequestPromise
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(board).toBeVisible()
  await expect(detail.locator('h3')).toHaveText('Synthetic task')
})

test('mobile task deep link focuses detail when plan data arrives', async ({ page }) => {
  await installBaseApi(page, {
    projects: [syntheticProject],
    plans: [syntheticPlan],
    taskSummaries: [syntheticTaskSummary],
    taskDetails: [syntheticTaskDetail],
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/plans/55?task=66')
  const detail = page.locator('[data-task-detail]')
  await expect(detail.getByText('Synthetic task description.')).toBeVisible()
  await expect(page.locator('[data-plan-board]')).toBeHidden()
  await expect(detail).toBeFocused()
  await expect(detail.getByRole('link', { name: 'Back to board' })).toBeVisible()

  const refresh = page.getByRole('button', { name: 'Refresh board' })
  const refreshRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/plans/55'
  })
  await refresh.focus()
  await expect(refresh).toBeFocused()
  await refresh.click()
  await refreshRequestPromise
  await expect(page.getByText('Refreshing board…', { exact: true })).toHaveCount(0)
  await expect(refresh).toBeFocused()
  await expect(detail).not.toBeFocused()
  await expect(detail.getByText('Synthetic task description.')).toBeVisible()
})

test('retained board data is scoped to the current plan', async ({ page }) => {
  let releaseSecond: (() => void) | undefined
  const secondGate = new Promise<void>((resolve) => {
    releaseSecond = resolve
  })
  const firstPlan = { ...syntheticPlan, id: 55, title: 'First retained plan' }
  const secondPlan = { ...syntheticPlan, id: 56, title: 'Second retained plan' }
  await installBaseApi(page, {
    projects: [syntheticProject],
    plans: [firstPlan, secondPlan],
    taskSummaries: [],
  })
  await page.route('**/api/v1/plans/56', async (route) => {
    await secondGate
    await route.fulfill(json(secondPlan))
  })

  await page.goto('/#/plans/55')
  await expect(page.getByRole('heading', { name: 'First retained plan' })).toBeVisible()
  await page.goto('/#/plans/56')
  await expect(page.getByText('Loading plan…')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'First retained plan' })).toHaveCount(0)
  await expect(page.locator('[data-plan-board]')).toHaveCount(0)

  releaseSecond?.()
  await expect(page.getByRole('heading', { name: 'Second retained plan' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'First retained plan' })).toHaveCount(0)
})

test('task detail bounds observe the layout after initial plan error recovery', async ({
  page,
}) => {
  let failPlan = true
  await installBaseApi(page, {
    projects: [syntheticProject],
    plans: [syntheticPlan],
    taskSummaries: [syntheticTaskSummary],
    taskDetails: [syntheticTaskDetail],
  })
  await page.route('**/api/v1/plans/55', async (route) => {
    if (failPlan) {
      await route.fulfill(json({ error: 'Synthetic initial plan failure' }, 500))
      return
    }
    await route.fallback()
  })

  await page.setViewportSize({ width: 1024, height: 900 })
  await page.goto('/#/plans/55?task=66')
  await expect(page.getByRole('alert')).toContainText('Could not load plan')
  failPlan = false
  const planRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/plans/55'
  })
  await page.getByRole('alert').getByRole('button', { name: 'Retry' }).click()
  await planRequestPromise

  const detail = page.locator('[data-task-detail]')
  const handle = page.getByRole('separator', { name: 'Resize task details' })
  await expect(detail.locator('h3')).toHaveText('Synthetic task')
  const layoutWidth = await page
    .locator('[data-plan-board-layout]')
    .evaluate((element) => element.getBoundingClientRect().width)
  const expectedMax = Math.round(Math.min(640, Math.max(300, layoutWidth - 360 - 9 - 32)))
  await expect
    .poll(async () => Number(await handle.getAttribute('aria-valuemax')))
    .toBe(expectedMax)
  await expect
    .poll(async () => (await detail.boundingBox())?.width ?? 0)
    .toBeCloseTo(expectedMax, 0)
  await expect
    .poll(async () => Number(await handle.getAttribute('aria-valuenow')))
    .toBe(expectedMax)
})

test('empty plan board keeps all five task columns visible', async ({ page }) => {
  await installBaseApi(page, {
    projects: [syntheticProject],
    plans: [syntheticPlan],
    taskSummaries: [],
    taskDetails: [],
  })

  await page.goto('/#/plans/55')
  const states = ['To do', 'Doing', 'Waiting', 'Done', 'Cancelled']
  for (const state of states) {
    const region = page.getByRole('region', { name: state, exact: true })
    await expect(region).toBeVisible()
    await expect(region.getByText('0 tasks', { exact: true })).toBeVisible()
    await expect(region.getByText('No tasks', { exact: true })).toBeVisible()
  }
  await expect(page.getByText('No tasks', { exact: true })).toHaveCount(5)
  await expect(
    page.locator('[data-plan-header]').getByText('0 tasks', { exact: true }),
  ).toBeVisible()
})

test('plan board task failure is not empty and retries', async ({ page }) => {
  let attempts = 0
  await installBaseApi(page, {
    projects: [syntheticProject],
    plans: [syntheticPlan],
    taskSummaries: [syntheticTaskSummary],
  })
  await page.route('**/api/v1/tasks**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/tasks') {
      attempts += 1
      if (attempts === 1) {
        await route.fulfill(json({ error: 'Synthetic task failure' }, 500))
        return
      }
      await route.fulfill(json({ tasks: [syntheticTaskSummary], total: 1 }))
      return
    }
    await route.fulfill(json(syntheticTaskDetail))
  })

  await page.goto('/#/plans/55')
  await expect(page.getByRole('alert')).toContainText('Could not load tasks')
  await expect(page.getByText('No tasks', { exact: true })).toHaveCount(0)
  const retryRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/tasks' && url.searchParams.get('plan_id') === '55'
  })
  await page.getByRole('alert').getByRole('button', { name: 'Retry' }).click()
  await retryRequestPromise
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Doing', exact: true })).toBeVisible()
  await expect(page.getByText('Synthetic task', { exact: true })).toBeVisible()
})

test('plan board handles plan and task 404 responses explicitly', async ({ page }) => {
  const requests = await installBaseApi(page, {
    projects: [syntheticProject],
    plans: [syntheticPlan],
    taskSummaries: [syntheticTaskSummary],
  })
  let failPlan = true
  await page.route('**/api/v1/plans/55', async (route) => {
    if (failPlan) {
      await route.fulfill(json({ error: 'Plan not found' }, 404))
      return
    }
    await route.fallback()
  })
  await page.route('**/api/v1/tasks/99', (route) =>
    route.fulfill(json({ error: 'Task not found' }, 404)),
  )

  await page.goto('/#/plans/55')
  await expect(page.getByText('Plan not found', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to plans' })).toBeVisible()
  expect(requests.some((url) => url.pathname === '/api/v1/tasks')).toBe(false)

  failPlan = false
  await page.goto('/#/plans')
  await page.goto('/#/plans/55?task=99')
  await expect(page.getByRole('heading', { name: 'Synthetic plan' })).toBeVisible()
  await expect(page.locator('[data-task-detail]').getByText('Task not found')).toBeVisible()
  await expect(page.getByText('Synthetic task description.')).toHaveCount(0)
})

test('plan board ignores a late task detail response after another card opens', async ({
  page,
}) => {
  let releaseFirst: (() => void) | undefined
  let firstHandled: (() => void) | undefined
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  const firstDone = new Promise<void>((resolve) => {
    firstHandled = resolve
  })
  const firstDetail = { ...syntheticTaskDetail, description: 'First stale task description.' }
  const secondDetail = {
    ...syntheticTaskAllDetail,
    description: 'Second current task description.',
  }
  await installBaseApi(page, {
    projects: [syntheticProject],
    plans: [syntheticPlan],
    taskSummaries: [syntheticTaskSummary, syntheticTaskAllSummary],
  })
  await page.route('**/api/v1/tasks/66', async (route) => {
    await firstGate
    await route.fulfill(json(firstDetail)).catch(() => undefined)
    firstHandled?.()
  })
  await page.route('**/api/v1/tasks/67', (route) => route.fulfill(json(secondDetail)))

  await page.goto('/#/plans/55')
  await expect(page.getByRole('region', { name: 'Doing', exact: true })).toBeVisible()
  await page.getByRole('link', { name: /Synthetic task/ }).click()
  await page.getByRole('link', { name: /Synthetic all-met task/ }).click()
  await expect(page.locator('[data-task-detail]').getByText('2/2 met')).toBeVisible()

  releaseFirst?.()
  await firstDone
  await expect(page.locator('[data-task-detail]').getByText('2/2 met')).toBeVisible()
  await expect(page.getByText('Second current task description.')).toBeVisible()
  await expect(page.getByText('First stale task description.')).toHaveCount(0)
  await expect(page.getByText('Synthetic criterion one')).toHaveCount(0)
})

test('plan board refresh failure shows an error and retries task summaries', async ({ page }) => {
  let failTasks = false
  await installBaseApi(page, {
    projects: [syntheticProject],
    plans: [syntheticPlan],
    taskSummaries: [syntheticTaskSummary],
  })
  await page.route('**/api/v1/tasks**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/tasks') {
      if (failTasks) {
        await route.fulfill(json({ error: 'Synthetic refresh failure' }, 500))
        return
      }
      await route.fulfill(json({ tasks: [syntheticTaskSummary], total: 1 }))
      return
    }
    await route.fulfill(json(syntheticTaskDetail))
  })

  await page.goto('/#/plans/55')
  await expect(page.getByRole('region', { name: 'Doing', exact: true })).toBeVisible()
  failTasks = true
  const refreshRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/tasks' && url.searchParams.get('plan_id') === '55'
  })
  await page.getByRole('button', { name: 'Refresh board' }).click()
  await refreshRequestPromise
  await expect(page.getByRole('alert')).toContainText('Could not refresh tasks')
  await expect(page.getByText(/Showing previous task summaries/)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Doing', exact: true })).toBeVisible()
  await expect(page.getByText('Synthetic task', { exact: true })).toBeVisible()

  failTasks = false
  const retryRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/tasks' && url.searchParams.get('plan_id') === '55'
  })
  await page.getByRole('alert').getByRole('button', { name: 'Retry' }).click()
  await retryRequestPromise
  await expect(page.getByRole('region', { name: 'Doing', exact: true })).toBeVisible()
  await expect(page.getByText('Synthetic task', { exact: true })).toBeVisible()
})

test('plan board selected task refresh failure is explicit and retryable', async ({ page }) => {
  let failDetail = false
  await installBaseApi(page, {
    projects: [syntheticProject],
    plans: [syntheticPlan],
    taskSummaries: [syntheticTaskSummary],
    taskDetails: [syntheticTaskDetail],
  })
  await page.route('**/api/v1/tasks/66', async (route) => {
    if (failDetail) {
      await route.fulfill(json({ error: 'Synthetic detail refresh failure' }, 500))
      return
    }
    await route.fulfill(json(syntheticTaskDetail))
  })

  await page.goto('/#/plans/55?task=66')
  await expect(page.getByText('Synthetic task description.')).toBeVisible()
  failDetail = true
  const refreshRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/tasks/66'
  })
  await page.getByRole('button', { name: 'Refresh board' }).click()
  await refreshRequestPromise
  const detailPanel = page.locator('[data-task-detail]')
  await expect(detailPanel.getByRole('alert')).toContainText('Could not load task')
  await expect(page.getByText('Synthetic task description.')).toHaveCount(0)

  failDetail = false
  const retryRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/tasks/66'
  })
  await detailPanel.getByRole('alert').getByRole('button', { name: 'Retry' }).click()
  await retryRequestPromise
  await expect(page.getByText('Synthetic task description.')).toBeVisible()
  await expect(detailPanel.getByText('1/2 met')).toBeVisible()
})

test('plan board refresh failure on plan metadata is explicit and retryable', async ({ page }) => {
  let failPlan = false
  await installBaseApi(page, {
    projects: [syntheticProject],
    plans: [syntheticPlan],
    taskSummaries: [syntheticTaskSummary],
  })
  await page.route('**/api/v1/plans/55', async (route) => {
    if (failPlan) {
      await route.fulfill(json({ error: 'Synthetic plan refresh failure' }, 500))
      return
    }
    await route.fallback()
  })

  await page.goto('/#/plans/55')
  await expect(page.getByRole('heading', { name: 'Synthetic plan' })).toBeVisible()
  failPlan = true
  const refreshRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/plans/55'
  })
  await page.getByRole('button', { name: 'Refresh board' }).click()
  await refreshRequestPromise
  await expect(page.getByRole('alert')).toContainText('Could not refresh plan')
  await expect(page.getByText(/Showing the previous plan/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Synthetic plan' })).toBeVisible()

  failPlan = false
  const retryRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/plans/55'
  })
  await page.getByRole('alert').getByRole('button', { name: 'Retry' }).click()
  await retryRequestPromise
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Synthetic plan' })).toBeVisible()
})

test('plan board wraps long unbroken names and task text inside panels', async ({ page }) => {
  const longProjectName = `Project${'P'.repeat(173)}`
  const longPlanTitle = `Plan${'L'.repeat(176)}`
  const longTaskTitle = `Task${'T'.repeat(176)}`
  const longAgent = `Agent${'A'.repeat(95)}`
  const longGoal = `Goal${'G'.repeat(176)}`
  const longDescription = `Description${'D'.repeat(170)}`
  const longCriterion = `Criterion${'C'.repeat(171)}`
  const project = { ...syntheticProject, name: longProjectName }
  const plan = { ...syntheticPlan, title: longPlanTitle, goal: longGoal, project_id: 1 }
  const summary = {
    ...syntheticTaskSummary,
    title: longTaskTitle,
    state: 'todo',
    assigned_agent: longAgent,
  }
  const detail = {
    ...syntheticTaskDetail,
    title: longTaskTitle,
    description: longDescription,
    assigned_agent: longAgent,
    criteria: [{ id: 31, task_id: 66, description: longCriterion, met: true }],
  }
  await installBaseApi(page, {
    projects: [project],
    plans: [plan],
    taskSummaries: [summary],
    taskDetails: [detail],
  })

  async function expectWrappedInside(
    text: ReturnType<Page['getByText']>,
    containerSelector: string,
  ) {
    await expect(text).toBeVisible()
    const metrics = await text.evaluate((element, selector) => {
      const container = element.closest(selector)
      if (!container) throw new Error(`Missing container ${selector}`)
      const box = container.getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(element)
      const rectangles = [...range.getClientRects()].filter((rect) => rect.width > 0)
      return {
        fits: rectangles.every((rect) => rect.left >= box.left - 1 && rect.right <= box.right + 1),
        lines: rectangles.length,
      }
    }, containerSelector)
    expect(metrics.fits).toBe(true)
    expect(metrics.lines).toBeGreaterThan(1)
  }

  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/#/plans/55?project=1&status=active')
    const header = page.locator('[data-plan-header]')
    await expectWrappedInside(
      header.getByRole('heading', { name: longPlanTitle, exact: true }),
      '[data-plan-header]',
    )
    await expectWrappedInside(
      header.getByRole('link', { name: longProjectName, exact: true }),
      '[data-plan-header]',
    )
    await expectWrappedInside(header.getByText(longGoal, { exact: true }), '[data-plan-header]')
    const card = page.locator('[data-task-id="66"]')
    await expectWrappedInside(card.getByText(longTaskTitle, { exact: true }), '[data-task-id="66"]')
    await expectWrappedInside(
      card.getByText(`Agent ${longAgent}`, { exact: true }),
      '[data-task-id="66"]',
    )
    let overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
    if (width === 390) {
      const scroll = await page.locator('[data-board-scroll]').evaluate((element) => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }))
      expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth)
    }

    await page.goto('/#/plans/55?task=66&project=1&status=active')
    const taskDetail = page.locator('[data-task-detail]')
    if (width >= 1024) {
      const handle = page.getByRole('separator', { name: 'Resize task details' })
      await handle.press('Home')
      const minWidth = Number(await handle.getAttribute('aria-valuemin'))
      await expect
        .poll(async () => (await taskDetail.boundingBox())?.width ?? 0)
        .toBeCloseTo(minWidth, 0)
    }
    await expectWrappedInside(
      taskDetail.getByRole('heading', { name: longTaskTitle, exact: true }),
      '[data-task-detail]',
    )
    await expectWrappedInside(
      taskDetail.getByText(longDescription, { exact: true }),
      '[data-task-detail]',
    )
    await expectWrappedInside(taskDetail.getByText(longCriterion), '[data-task-detail]')
    overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
    if (width === 390) {
      const box = await taskDetail.boundingBox()
      if (!box) throw new Error('Missing mobile task detail')
      expect(box.width).toBeLessThanOrEqual(390)
    }
  }
})

test('documents filters and renders content as inert text', async ({ page }) => {
  const requests = await installBaseApi(page, {
    projects: [syntheticProject],
    documents: [syntheticDocument],
  })

  await page.goto('/#/documents')
  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible()
  await page.getByRole('link', { name: /Synthetic document/ }).click()

  await expect(page.getByText('Synthetic document description.')).toBeVisible()
  await expect(page.getByText(/window\.__xss = true/)).toBeVisible()
  await expect(page.locator('main script')).toHaveCount(0)

  const documentProjectRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/documents' && url.searchParams.get('project_id') === '1'
  })
  await page.getByLabel('Project filter').selectOption('1')
  const documentProjectRequest = await documentProjectRequestPromise
  await expect(page).toHaveURL(/#\/documents\/73\?project=1$/)
  expect(new URL(documentProjectRequest.url()).searchParams.get('project_id')).toBe('1')

  await page.getByRole('textbox', { name: 'Document type filter' }).fill('markdown')
  const documentTypeRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      url.pathname === '/api/v1/documents' && url.searchParams.get('document_type') === 'markdown'
    )
  })
  await page.getByRole('button', { name: 'Apply document type filter' }).click()
  const documentTypeRequest = await documentTypeRequestPromise
  await expect(page).toHaveURL(/#\/documents\/73\?project=1&type=markdown$/)
  expect(new URL(documentTypeRequest.url()).searchParams.get('document_type')).toBe('markdown')
  expect(requests.every((url) => url.pathname !== '/api/v1/code-artifacts')).toBe(true)
})

test('code artifacts show readable inert source with project/language filters', async ({
  page,
}) => {
  await installBaseApi(page, {
    projects: [syntheticProject],
    codeArtifacts: [syntheticCode],
  })

  await page.goto('/#/code')
  await expect(page.getByRole('heading', { name: 'Code' })).toBeVisible()
  await page.getByRole('link', { name: /Synthetic code artifact/ }).click()
  await expect(page.getByText('Synthetic code description.')).toBeVisible()
  await expect(page.getByText('const synthetic = true').first()).toBeVisible()
  await expect(page.locator('main script')).toHaveCount(0)

  const codeProjectRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/code-artifacts' && url.searchParams.get('project_id') === '1'
  })
  await page.getByLabel('Project filter').selectOption('1')
  await codeProjectRequestPromise
  await expect(page).toHaveURL(/#\/code\/74\?project=1$/)

  await page.getByRole('textbox', { name: 'Language filter' }).fill('typescript')
  const codeLanguageRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      url.pathname === '/api/v1/code-artifacts' && url.searchParams.get('language') === 'typescript'
    )
  })
  await page.getByRole('button', { name: 'Apply language filter' }).click()
  const codeLanguageRequest = await codeLanguageRequestPromise
  await expect(page).toHaveURL(/#\/code\/74\?project=1&language=typescript$/)
  const codeLanguageUrl = new URL(codeLanguageRequest.url())
  expect(codeLanguageUrl.searchParams.get('project_id')).toBe('1')
  expect(codeLanguageUrl.searchParams.get('language')).toBe('typescript')
})

test('files shows metadata without binary data when enabled', async ({ page }) => {
  await installBaseApi(page, {
    capabilities: {
      schema_version: 1,
      capabilities: { planning: true, skills: false, files: true, activity_stream: false },
    },
    projects: [syntheticProject],
    files: [syntheticFile],
  })

  await page.goto('/#/files')
  await expect(page.getByRole('heading', { name: 'Files', level: 1 })).toBeVisible()
  await page.getByRole('link', { name: /synthetic\.png/ }).click()
  await expect(page.getByText('Synthetic file description.')).toBeVisible()
  await expect(page.getByText('image/png').last()).toBeVisible()
  await expect(page.getByText('c2VjcmV0LWJpbmFyeS1kYXRh')).toHaveCount(0)
  await expect(page.getByText('Binary content is not displayed.')).toBeVisible()

  const fileProjectRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/files' && url.searchParams.get('project_id') === '1'
  })
  await page.getByLabel('Project filter').selectOption('1')
  await fileProjectRequestPromise
  await expect(page).toHaveURL(/#\/files\/75\?project=1$/)

  await page.getByRole('textbox', { name: 'MIME type filter' }).fill('image/png')
  const fileMimeRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/files' && url.searchParams.get('mime_type') === 'image/png'
  })
  await page.getByRole('button', { name: 'Apply MIME filter' }).click()
  const fileMimeRequest = await fileMimeRequestPromise
  await expect(page).toHaveURL(/#\/files\/75\?project=1&mime=image%2Fpng$/)
  expect(new URL(fileMimeRequest.url()).searchParams.get('mime_type')).toBe('image/png')
})

test('files disabled blocks data and filter requests', async ({ page }) => {
  const requests = await installBaseApi(page, {
    capabilities: {
      schema_version: 1,
      capabilities: { planning: true, skills: false, files: false, activity_stream: false },
    },
    projects: [syntheticProject],
    files: [syntheticFile],
  })

  await page.goto('/#/files')
  await expect(page.getByText('Files are unavailable')).toBeVisible()
  await expect(page.getByText('not requested')).toBeVisible()
  expect(requests.some((url) => url.pathname === '/api/v1/files')).toBe(false)
  expect(requests.some((url) => url.pathname === '/api/v1/projects')).toBe(false)
})

test('skills shows content, associations and importance_threshold filter', async ({ page }) => {
  await installBaseApi(page, {
    capabilities: {
      schema_version: 1,
      capabilities: { planning: true, skills: true, files: false, activity_stream: false },
    },
    projects: [syntheticProject],
    skills: [syntheticSkill],
  })

  await page.goto('/#/skills')
  await expect(page.getByRole('heading', { name: 'Skills', level: 1 })).toBeVisible()
  await page.getByRole('link', { name: /synthetic-skill/ }).click()
  await expect(page.getByText('Synthetic skill description.')).toBeVisible()
  await expect(page.getByText(/Do the synthetic steps/)).toBeVisible()
  await expect(page.getByText('MIT')).toBeVisible()
  await expect(page.getByText('Linked memories')).toBeVisible()
  await expect(page.getByText('901')).toBeVisible()

  const skillProjectRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/skills' && url.searchParams.get('project_id') === '1'
  })
  await page.getByLabel('Project filter').selectOption('1')
  await skillProjectRequestPromise

  const skillImportanceRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/skills' && url.searchParams.get('importance_threshold') === '8'
  })
  await page.getByLabel('Minimum importance').selectOption('8')
  const skillImportanceRequest = await skillImportanceRequestPromise
  await expect(page).toHaveURL(/#\/skills\/76\?project=1&importance=8$/)
  const skillImportanceUrl = new URL(skillImportanceRequest.url())
  expect(skillImportanceUrl.searchParams.get('project_id')).toBe('1')
  expect(skillImportanceUrl.searchParams.get('importance_threshold')).toBe('8')
  expect(skillImportanceUrl.searchParams.has('importance_min')).toBe(false)
})

test('skills disabled blocks data requests', async ({ page }) => {
  const requests = await installBaseApi(page, {
    capabilities: {
      schema_version: 1,
      capabilities: { planning: true, skills: false, files: false, activity_stream: false },
    },
    projects: [syntheticProject],
    skills: [syntheticSkill],
  })

  await page.goto('/#/skills')
  await expect(page.getByText('Skills are unavailable')).toBeVisible()
  expect(requests.some((url) => url.pathname === '/api/v1/skills')).toBe(false)
  expect(requests.some((url) => url.pathname === '/api/v1/projects')).toBe(false)
})

test('timeline paginates activity and labels historical snapshots', async ({ page }) => {
  const requests = await installBaseApi(page, {
    activity: [syntheticEvent],
  })
  // Give the activity endpoint a real total so page controls are exercised.
  await page.unroute('**/api/v1/**')
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/activity') {
      await route.fulfill(
        json({
          events: [syntheticEvent],
          total: 45,
          limit: Number(url.searchParams.get('limit') ?? 50),
          offset: Number(url.searchParams.get('offset') ?? 0),
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'Unexpected test request' }, 500))
  })

  await page.goto('/#/timeline')
  await expect(page.getByRole('heading', { name: 'Timeline', level: 1 })).toBeVisible()
  await expect(page.getByText('updated memory #901')).toBeVisible()
  await page.locator('summary').first().click()
  await expect(page.getByText(/Historical snapshot/)).toBeVisible()
  await expect(page.locator('pre').filter({ hasText: 'Historical title' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open memory #901' })).toHaveAttribute(
    'href',
    '#/memories/901',
  )

  const firstList = requests.filter((url) => url.pathname === '/api/v1/activity').at(-1)
  expect(firstList?.searchParams.get('limit')).toBe('20')
  expect(firstList?.searchParams.get('offset')).toBe('0')

  const timelinePageRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/activity' && url.searchParams.get('offset') === '20'
  })
  await page.getByRole('link', { name: 'Page 2' }).click()
  const timelinePageRequest = await timelinePageRequestPromise
  await expect(page).toHaveURL(/#\/timeline\?page=2$/)
  expect(new URL(timelinePageRequest.url()).searchParams.get('offset')).toBe('20')

  const timelineEntityRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/activity' && url.searchParams.get('entity_type') === 'memory'
  })
  await page.getByLabel('Entity type filter').selectOption('memory')
  const timelineEntityRequest = await timelineEntityRequestPromise
  await expect(page).toHaveURL(/#\/timeline\?entity=memory$/)
  expect(new URL(timelineEntityRequest.url()).searchParams.get('entity_type')).toBe('memory')

  const timelineActionRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/activity' && url.searchParams.get('action') === 'updated'
  })
  await page.getByLabel('Action filter').selectOption('updated')
  const timelineActionRequest = await timelineActionRequestPromise
  await expect(page).toHaveURL(/#\/timeline\?entity=memory&action=updated$/)
  const timelineActionUrl = new URL(timelineActionRequest.url())
  expect(timelineActionUrl.searchParams.get('entity_type')).toBe('memory')
  expect(timelineActionUrl.searchParams.get('action')).toBe('updated')
})

test('planning disabled does not request plans, tasks or project options', async ({ page }) => {
  const requests = await installBaseApi(page, {
    capabilities: {
      schema_version: 1,
      capabilities: { planning: false, skills: false, files: false, activity_stream: false },
    },
    projects: [syntheticProject],
    plans: [syntheticPlan],
    taskSummaries: [syntheticTaskSummary, syntheticTaskAllSummary],
    taskDetails: [syntheticTaskDetail, syntheticTaskAllDetail, syntheticWrongPlanTask],
  })

  await page.goto('/#/plans')
  await expect(page.getByText('Planning is unavailable')).toBeVisible()
  expect(requests.some((url) => url.pathname === '/api/v1/plans')).toBe(false)
  expect(requests.some((url) => url.pathname === '/api/v1/tasks')).toBe(false)
  expect(requests.some((url) => url.pathname === '/api/v1/projects')).toBe(false)

  await page.goto('/#/plans/55')
  await expect(page.getByText('Planning is unavailable')).toBeVisible()
  expect(requests.some((url) => url.pathname === '/api/v1/plans')).toBe(false)
  expect(requests.some((url) => url.pathname === '/api/v1/tasks')).toBe(false)
  expect(requests.some((url) => /^\/api\/v1\/plans\/\d+$/.test(url.pathname))).toBe(false)
  expect(requests.some((url) => url.pathname === '/api/v1/projects')).toBe(false)
})

test('unknown capability discovery allows a careful files read', async ({ page }) => {
  const requests = await installBaseApi(page, {
    capabilitiesStatus: 500,
    projects: [syntheticProject],
    files: [syntheticFile],
  })

  await page.goto('/#/files')
  await expect(page.getByText(/File availability is unknown/)).toBeVisible()
  await expect(page.getByRole('link', { name: /synthetic\.png/ })).toBeVisible()
  expect(requests.some((url) => url.pathname === '/api/v1/files')).toBe(true)
  expect(requests.some((url) => url.pathname === '/api/v1/projects')).toBe(true)
})

test('remaining pages remain usable across 390, 1024 and 1440 widths', async ({ page }) => {
  await installBaseApi(page, {
    capabilities: {
      schema_version: 1,
      capabilities: { planning: true, skills: true, files: true, activity_stream: false },
    },
    projects: [syntheticProject],
    plans: [syntheticPlan],
    taskSummaries: [syntheticTaskSummary, syntheticTaskAllSummary],
    taskDetails: [syntheticTaskDetail, syntheticTaskAllDetail, syntheticWrongPlanTask],
    documents: [syntheticDocument],
    codeArtifacts: [syntheticCode],
    files: [syntheticFile],
    skills: [syntheticSkill],
    activity: [syntheticEvent],
  })

  const pages: { hash: string; heading: string; listTitle: string }[] = [
    { hash: '#/dashboard', heading: 'Dashboard', listTitle: '' },
    { hash: '#/projects', heading: 'Projects', listTitle: 'Projects' },
    { hash: '#/plans', heading: 'Plans', listTitle: 'Plans' },
    { hash: '#/documents', heading: 'Documents', listTitle: 'Documents' },
    { hash: '#/code', heading: 'Code', listTitle: 'Code artifacts' },
    { hash: '#/files', heading: 'Files', listTitle: 'Files' },
    { hash: '#/skills', heading: 'Skills', listTitle: 'Skills' },
    { hash: '#/timeline', heading: 'Timeline', listTitle: 'Activity history' },
  ]

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1024, height: 900 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport)
    for (const item of pages) {
      await page.goto(item.hash)
      await expect(page.getByRole('heading', { name: item.heading, level: 1 })).toBeVisible()
      if (item.listTitle) {
        await expect(
          page.getByRole('heading', { name: item.listTitle, level: 2 }).last(),
        ).toBeVisible()
      }
      if (item.hash === '#/dashboard') {
        await expect(
          page
            .getByText('No memories available', { exact: true })
            .or(page.getByRole('link', { name: /Synthetic memory/ })),
        ).toBeVisible()
        await expect(
          page
            .getByText('Historical title')
            .or(page.getByText('No activity history', { exact: true })),
        ).toBeVisible()
      } else if (item.hash === '#/projects') {
        await expect(
          page
            .getByRole('list', { name: 'Projects' })
            .or(page.getByText('No projects found', { exact: true })),
        ).toBeVisible()
      } else if (item.hash === '#/plans') {
        await expect(
          page
            .getByRole('list', { name: 'Plans' })
            .or(page.getByText('No plans found', { exact: true })),
        ).toBeVisible()
      } else if (item.hash === '#/documents') {
        await expect(
          page
            .getByRole('list', { name: 'Documents' })
            .or(page.getByText('No documents found', { exact: true })),
        ).toBeVisible()
      } else if (item.hash === '#/code') {
        await expect(
          page
            .getByRole('list', { name: 'Code artifacts' })
            .or(page.getByText('No code artifacts found', { exact: true })),
        ).toBeVisible()
      } else if (item.hash === '#/files') {
        await expect(
          page
            .getByRole('list', { name: 'Files' })
            .or(page.getByText('No files found', { exact: true })),
        ).toBeVisible()
      } else if (item.hash === '#/skills') {
        await expect(
          page
            .getByRole('list', { name: 'Skills' })
            .or(page.getByText('No skills found', { exact: true })),
        ).toBeVisible()
      } else if (item.hash === '#/timeline') {
        await expect(
          page
            .getByRole('list', { name: 'Activity events' })
            .or(page.getByText('No activity events', { exact: true })),
        ).toBeVisible()
      }
      await expect(page.getByRole('alert')).toHaveCount(0)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(1)
    }
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/projects')
  await page.getByRole('link', { name: /Synthetic project/ }).click()
  await expect(page.getByText('Synthetic project description.')).toBeVisible()
  await expect(page.locator('[data-resource-detail]')).toBeFocused()
  await expect(page.getByRole('link', { name: 'Back to list' })).toBeVisible()
  const detailOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(detailOverflow).toBeLessThanOrEqual(1)

  await page.getByRole('link', { name: 'Back to list' }).click()
  await expect(page.getByRole('link', { name: /Synthetic project/ })).toBeFocused()

  await page.goto('/#/plans')
  await page.getByRole('link', { name: /Synthetic plan/ }).click()
  await expect(page.getByRole('heading', { name: 'Synthetic plan' })).toBeVisible()
  await page.getByRole('link', { name: /Synthetic task/ }).click()
  await expect(page.locator('[data-task-detail]')).toBeFocused()
  await expect(page.getByText('Synthetic task description.')).toBeVisible()
  await page.getByRole('link', { name: 'Back to board' }).click()
  await expect(page.locator('[data-plan-board]')).toBeVisible()
  await expect(page.locator('[data-task-id="66"]')).toBeFocused()
})

test('new page routes survive reload and browser back/forward', async ({ page }) => {
  await installBaseApi(page, { projects: [syntheticProject] })
  await page.goto('/#/projects')
  await page.getByRole('link', { name: /Synthetic project/ }).click()
  await expect(page.getByText('Synthetic project description.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Synthetic project description.')).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Projects', level: 2 })).toBeVisible()
  await page.goForward()
  await expect(page.getByText('Synthetic project description.')).toBeVisible()
})

test('new page list errors retry and detail 404 are explicit', async ({ page }) => {
  let listAttempts = 0
  await page.route('**/health', (route) => route.fulfill(json({ status: 'healthy' })))
  await page.route('**/api/v1/auth/info', (route) =>
    route.fulfill(json({ authEnabled: false, authMode: 'disabled' })),
  )
  await page.route('**/api/v1/projects', (route) =>
    route.fulfill(json({ projects: [syntheticProject], total: 1 })),
  )
  await page.route('**/api/v1/documents', async (route) => {
    listAttempts += 1
    if (listAttempts === 1) {
      await route.fulfill(json({ error: 'Synthetic list failure' }, 500))
      return
    }
    await route.fulfill(json({ documents: [syntheticDocument], total: 1 }))
  })
  await page.route('**/api/v1/documents/73', (route) =>
    route.fulfill(json({ error: 'Document not found' }, 404)),
  )

  await page.goto('/#/documents')
  await expect(page.getByRole('alert')).toContainText('Could not load documents')
  await page.getByRole('button', { name: 'Retry' }).click()
  await page.getByRole('link', { name: /Synthetic document/ }).click()
  await expect(page.getByText('Document not found')).toBeVisible()
})

test('opening new pages does not load graph code or graph data', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await installBaseApi(page, {
    projects: [syntheticProject],
    plans: [syntheticPlan],
    documents: [syntheticDocument],
  })

  await page.goto('/#/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
  await page.goto('/#/projects')
  await expect(page.getByRole('heading', { name: 'Projects', level: 2 })).toBeVisible()
  await page.goto('/#/documents')
  await expect(page.getByRole('heading', { name: 'Documents', level: 2 })).toBeVisible()

  expect(requests.some((url) => url.includes('/api/v1/graph'))).toBe(false)
  expect(requests.some((url) => url.includes('GraphScreen'))).toBe(false)
  expect(requests.some((url) => url.includes('GraphCanvas'))).toBe(false)
})

test('new page detail ignores a late response for a previous selection', async ({ page }) => {
  const projectA = {
    ...syntheticProject,
    id: 1,
    name: 'Synthetic project A',
    description: 'Project A description.',
  }
  const projectB = {
    ...syntheticProject,
    id: 2,
    name: 'Synthetic project B',
    description: 'Project B description.',
  }
  let releaseA: (() => void) | undefined
  const gate = new Promise<void>((resolve) => {
    releaseA = resolve
  })

  await installBaseApi(page, { projects: [projectA, projectB] })
  await page.route('**/api/v1/projects/1', async (route) => {
    await gate
    await route.fulfill(json(projectA)).catch(() => undefined)
  })

  await page.goto('/#/projects')
  await page.getByRole('link', { name: /Synthetic project A/ }).click()
  await page.getByRole('link', { name: /Synthetic project B/ }).click()
  await expect(page.getByText('Project B description.')).toBeVisible()

  releaseA?.()
  await page.waitForTimeout(300)
  await expect(page.getByText('Project B description.')).toBeVisible()
  await expect(page.getByText('Project A description.')).toHaveCount(0)
})

test('task detail from another plan is not shown as a child of the selected plan', async ({
  page,
}) => {
  await installBaseApi(page, {
    projects: [syntheticProject],
    plans: [syntheticPlan],
    taskSummaries: [syntheticTaskSummary],
    taskDetails: [syntheticTaskDetail, syntheticWrongPlanTask],
  })

  await page.goto('/#/plans/55?task=77')
  await expect(page.getByText(/belongs to plan #999/)).toBeVisible()
  await expect(page.getByRole('main').getByText('Plan #55', { exact: true })).toBeVisible()
  await expect(page.getByText('Synthetic task description.')).toHaveCount(0)
  await expect(page.getByText('Synthetic criterion one')).toHaveCount(0)
})

test('timeline out-of-range page offers first/last recovery and preserves filters', async ({
  page,
}) => {
  const requests: URL[] = []
  await page.route('**/health', (route) => route.fulfill(json({ status: 'healthy' })))
  await page.route('**/.well-known', (route) =>
    route.fulfill(
      json({
        schema_version: 1,
        capabilities: { planning: true, skills: false, files: false, activity_stream: false },
      }),
    ),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/activity') {
      const offset = Number(url.searchParams.get('offset') ?? 0)
      await route.fulfill(
        json({
          events: offset === 0 ? [syntheticEvent] : [],
          total: 2,
          limit: 20,
          offset,
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'Unexpected test request' }, 500))
  })

  await page.goto('/#/timeline?page=999&entity=memory&action=updated')
  await expect(page.getByText('No activity events on this page')).toBeVisible()
  await expect(page.getByText(/Page 999 is outside the available range/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'First page' })).toHaveAttribute(
    'href',
    '#/timeline?entity=memory&action=updated',
  )
  await expect(page.getByRole('link', { name: 'Last page (1)' })).toHaveAttribute(
    'href',
    '#/timeline?entity=memory&action=updated',
  )
  const recoveryRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/activity' && url.searchParams.get('offset') === '0'
  })
  await page.getByRole('link', { name: 'Last page (1)' }).click()
  const recoveryRequest = await recoveryRequestPromise
  await expect(page).toHaveURL(/#\/timeline\?entity=memory&action=updated$/)
  const recoveryUrl = new URL(recoveryRequest.url())
  expect(recoveryUrl.searchParams.get('offset')).toBe('0')
  expect(recoveryUrl.searchParams.get('entity_type')).toBe('memory')
  expect(recoveryUrl.searchParams.get('action')).toBe('updated')
})

test('dashboard contains long memory and activity titles at all widths', async ({ page }) => {
  const longTitle = 'Synthetic dashboard title '.repeat(8)
  const longEventTitle = 'Synthetic dashboard event title '.repeat(8)
  await installBaseApi(page, {
    memories: [{ ...syntheticMemory, title: longTitle }],
    activity: [
      {
        ...syntheticEvent,
        snapshot: { id: 901, title: longEventTitle },
      },
    ],
  })

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1024, height: 900 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/#/dashboard')
    await expect(page.getByRole('link', { name: longTitle })).toBeVisible()
    await expect(page.getByText(longEventTitle)).toBeVisible()
    await expect(page.getByRole('link', { name: 'View memories' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'View timeline' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Features' })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  }
})

test('document type filter supports arbitrary current and custom values', async ({ page }) => {
  const architecture = { ...syntheticDocument, id: 88, document_type: 'architecture' }
  await installBaseApi(page, {
    projects: [syntheticProject],
    documents: [architecture],
  })

  const architectureRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      url.pathname === '/api/v1/documents' &&
      url.searchParams.get('document_type') === 'architecture'
    )
  })
  await page.goto('/#/documents?type=architecture')
  const architectureRequest = await architectureRequestPromise
  await expect(page.getByRole('list', { name: 'Documents' })).toBeVisible()
  const typeFilter = page.getByRole('textbox', { name: 'Document type filter' })
  await expect(typeFilter).toHaveValue('architecture')
  expect(new URL(architectureRequest.url()).searchParams.get('document_type')).toBe('architecture')

  await typeFilter.fill('whitepaper')
  const customTypeRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      url.pathname === '/api/v1/documents' && url.searchParams.get('document_type') === 'whitepaper'
    )
  })
  await page.getByRole('button', { name: 'Apply document type filter' }).click()
  const customTypeRequest = await customTypeRequestPromise
  await expect(page).toHaveURL(/#\/documents\?type=whitepaper$/)
  expect(new URL(customTypeRequest.url()).searchParams.get('document_type')).toBe('whitepaper')
  await expect(page.getByText('No documents found', { exact: true })).toBeVisible()
})

test('access denied stops later capability discovery on optional pages', async ({ page }) => {
  const requests: URL[] = []
  let wellKnownRequests = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/.well-known') wellKnownRequests += 1
  })
  await page.route('**/health', (route) => route.fulfill(json({ status: 'healthy' })))
  await page.route('**/.well-known', (route) =>
    route.fulfill(
      json({
        schema_version: 1,
        capabilities: { planning: true, skills: false, files: false, activity_stream: false },
      }),
    ),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/documents') {
      await route.fulfill(json({ error: 'Denied' }, 403))
      return
    }
    await route.fulfill(json({ error: 'Unexpected test request' }, 500))
  })

  await page.goto('/#/documents')
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible()
  const wellKnownAtBlock = wellKnownRequests
  await page.goto('/#/files')
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible()
  await page.waitForTimeout(300)
  expect(wellKnownRequests).toBe(wellKnownAtBlock)
  expect(requests.some((url) => url.pathname === '/api/v1/files')).toBe(false)
})

test('health 503 still allows capability discovery and optional pages', async ({ page }) => {
  await page.route('**/health', (route) => route.fulfill(json({ error: 'initialising' }, 503)))
  await page.route('**/.well-known', (route) =>
    route.fulfill(
      json({
        schema_version: 1,
        capabilities: { planning: true, skills: false, files: true, activity_stream: false },
      }),
    ),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/projects') {
      await route.fulfill(json({ projects: [syntheticProject], total: 1 }))
      return
    }
    if (url.pathname === '/api/v1/plans') {
      await route.fulfill(json({ plans: [syntheticPlan], total: 1 }))
      return
    }
    if (url.pathname === '/api/v1/plans/55') {
      await route.fulfill(json(syntheticPlan))
      return
    }
    if (url.pathname === '/api/v1/tasks') {
      await route.fulfill(json({ tasks: [], total: 0 }))
      return
    }
    if (url.pathname === '/api/v1/files') {
      await route.fulfill(json({ files: [syntheticFile], total: 1 }))
      return
    }
    if (url.pathname === '/api/v1/memories') {
      await route.fulfill(json({ memories: [syntheticMemory], total: 1, limit: 5, offset: 0 }))
      return
    }
    if (url.pathname === '/api/v1/activity') {
      await route.fulfill(json({ events: [syntheticEvent], total: 1, limit: 5, offset: 0 }))
      return
    }
    await route.fulfill(json({ error: 'Unexpected test request' }, 500))
  })

  await page.goto('/#/dashboard')
  const dashboard = page.getByRole('main')
  await expect(dashboard.getByText('Planning', { exact: true })).toBeVisible()
  await expect(dashboard.getByText('Enabled', { exact: true }).first()).toBeVisible()
  await expect(dashboard.getByText('Skills', { exact: true })).toBeVisible()
  await expect(dashboard.getByText('Disabled', { exact: true }).first()).toBeVisible()
  await expect(dashboard.getByText('Checking').first()).toBeHidden()

  await page.goto('/#/plans')
  await expect(page.getByRole('link', { name: /Synthetic plan/ })).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText('Checking planning availability…')).toHaveCount(0)

  await page.goto('/#/files')
  await expect(page.getByRole('link', { name: /synthetic\.png/ })).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText('Checking file availability…')).toHaveCount(0)

  await page.goto('/#/skills')
  await expect(page.getByText('Skills are unavailable')).toBeVisible()
})

test('network failure reaches unknown capability and retryable resource errors', async ({
  page,
}) => {
  let online = false
  await page.route('**/health', (route) =>
    online
      ? route.fulfill(json({ status: 'healthy' }))
      : route.fulfill(json({ error: 'down' }, 503)),
  )
  await page.route('**/.well-known', (route) =>
    online
      ? route.fulfill(
          json({
            schema_version: 1,
            capabilities: { planning: true, skills: false, files: false, activity_stream: false },
          }),
        )
      : route.fulfill(json({ error: 'down' }, 503)),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (!online) {
      await route.fulfill(json({ error: 'Network unavailable' }, 503))
      return
    }
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/projects') {
      await route.fulfill(json({ projects: [syntheticProject], total: 1 }))
      return
    }
    if (url.pathname === '/api/v1/plans') {
      await route.fulfill(json({ plans: [syntheticPlan], total: 1 }))
      return
    }
    if (url.pathname === '/api/v1/plans/55') {
      await route.fulfill(json(syntheticPlan))
      return
    }
    if (url.pathname === '/api/v1/tasks') {
      await route.fulfill(json({ tasks: [], total: 0 }))
      return
    }
    if (url.pathname === '/api/v1/memories') {
      await route.fulfill(json({ memories: [syntheticMemory], total: 1, limit: 5, offset: 0 }))
      return
    }
    if (url.pathname === '/api/v1/activity') {
      await route.fulfill(json({ events: [syntheticEvent], total: 1, limit: 5, offset: 0 }))
      return
    }
    await route.fulfill(json({ error: 'Unexpected test request' }, 500))
  })

  await page.goto('/#/dashboard')
  await expect(page.getByText(/Capability discovery is unavailable/)).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByRole('button', { name: 'Retry status' })).toBeVisible()
  await expect(page.getByText('Checking').first()).toBeHidden()

  await page.goto('/#/plans')
  await expect(page.getByText(/Planning availability is unknown/)).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Could not load plans')
  await expect(page.getByText('Checking planning availability…')).toHaveCount(0)

  online = true
  await page.getByRole('alert').getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByRole('link', { name: /Synthetic plan/ })).toBeVisible({
    timeout: 10_000,
  })

  await page.goto('/#/plans/55')
  await expect(page.getByText(/Planning availability is unknown/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Synthetic plan' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'To do', exact: true })).toBeVisible()
  await expect(page.getByText('No tasks', { exact: true })).toHaveCount(5)
})

test('plan board shows project names from a deep link without loading all plans', async ({
  page,
}) => {
  const requests = await installBaseApi(page, {
    capabilities: {
      schema_version: 1,
      capabilities: { planning: true, skills: false, files: false, activity_stream: false },
    },
    projects: [syntheticProject],
    plans: [syntheticPlan, { ...syntheticPlan, id: 56, title: 'Second synthetic plan' }],
    taskSummaries: [],
    taskDetails: [],
  })

  await page.goto('/#/plans/55')
  const header = page.locator('[data-plan-header]')
  await expect(header.getByRole('heading', { name: 'Synthetic plan' })).toBeVisible()
  await expect(header.getByRole('link', { name: 'Synthetic project', exact: true })).toBeVisible()
  expect(requests.filter((url) => url.pathname === '/api/v1/plans')).toHaveLength(0)

  const projectListsBeforeSelection = requests.filter(
    (url) => url.pathname === '/api/v1/projects',
  ).length
  await page.goto('/#/plans/56')
  await expect(header.getByRole('heading', { name: 'Second synthetic plan' })).toBeVisible()
  await expect(header.getByRole('link', { name: 'Synthetic project', exact: true })).toBeVisible()
  expect(requests.filter((url) => url.pathname === '/api/v1/projects')).toHaveLength(
    projectListsBeforeSelection + 1,
  )
  expect(requests.some((url) => /^\/api\/v1\/projects\/\d+$/.test(url.pathname))).toBe(false)
  expect(requests.filter((url) => url.pathname === '/api/v1/plans')).toHaveLength(0)
})

test('all resource pages resize, fit and expand/restore their detail pane', async ({ page }) => {
  const longProjectName =
    'Synthetic project with a deliberately long descriptive name for narrow screens'
  const requests = await installBaseApi(page, {
    capabilities: {
      schema_version: 1,
      capabilities: { planning: true, skills: true, files: true, activity_stream: false },
    },
    projects: [{ ...syntheticProject, name: longProjectName }],
    plans: [syntheticPlan],
    taskSummaries: [syntheticTaskSummary],
    taskDetails: [syntheticTaskDetail],
    documents: [syntheticDocument],
    codeArtifacts: [syntheticCode],
    files: [syntheticFile],
    skills: [syntheticSkill],
  })

  const pages = [
    { hash: '#/projects/1', list: 'Projects', detail: 'Synthetic project' },
    { hash: '#/documents/73', list: 'Documents', detail: 'Synthetic document' },
    { hash: '#/code/74', list: 'Code artifacts', detail: 'Synthetic code artifact' },
    { hash: '#/files/75', list: 'Files', detail: 'synthetic.png' },
    { hash: '#/skills/76', list: 'Skills', detail: 'synthetic-skill' },
  ]

  await page.setViewportSize({ width: 1440, height: 1000 })
  for (const item of pages) {
    await page.goto(item.hash)
    await expect(page.locator('[data-resource-detail] h3').first()).toBeVisible()
    const detail = page.locator('[data-resource-detail]')
    const detailId = await detail.getAttribute('id')
    const handle = page.getByRole('separator', { name: 'Resize detail' })
    await expect(handle).toBeVisible()
    expect(await handle.getAttribute('aria-controls')).toBe(detailId)
    expect(Number(await handle.getAttribute('aria-valuenow'))).toBeGreaterThan(0)
    expect(Number(await handle.getAttribute('aria-valuemax'))).toBeGreaterThan(
      Number(await handle.getAttribute('aria-valuemin')),
    )
    const requestsBefore = requests.length
    const before = await detail.boundingBox()
    const handleBox = await handle.boundingBox()
    if (!before || !handleBox) throw new Error(`Missing resize geometry for ${item.hash}`)
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + 80)
    await page.mouse.down()
    await page.mouse.move(handleBox.x - 80, handleBox.y + 80, { steps: 8 })
    await page.mouse.up()
    await expect
      .poll(async () => (await detail.boundingBox())?.width ?? 0)
      .toBeGreaterThan(before.width + 40)

    const keyboardBefore = (await detail.boundingBox())?.width ?? 0
    await handle.press('ArrowLeft')
    await expect
      .poll(async () => (await detail.boundingBox())?.width ?? 0)
      .toBeGreaterThan(keyboardBefore + 10)
    const afterLeft = (await detail.boundingBox())?.width ?? 0
    await handle.press('ArrowRight')
    await expect.poll(async () => (await detail.boundingBox())?.width ?? 0).toBeLessThan(afterLeft)

    const minWidth = Number(await handle.getAttribute('aria-valuemin'))
    await handle.press('Home')
    await expect.poll(async () => (await detail.boundingBox())?.width ?? 0).toBeCloseTo(minWidth, 0)
    await expect.poll(async () => Number(await handle.getAttribute('aria-valuenow'))).toBe(minWidth)
    const maxWidth = Number(await handle.getAttribute('aria-valuemax'))
    await handle.press('End')
    await expect.poll(async () => (await detail.boundingBox())?.width ?? 0).toBeCloseTo(maxWidth, 0)
    await expect.poll(async () => Number(await handle.getAttribute('aria-valuenow'))).toBe(maxWidth)
    const atMax = await detail.boundingBox()
    if (!atMax) throw new Error(`Missing maximum width for ${item.hash}`)

    await page.getByRole('button', { name: 'Expand detail' }).click()
    await expect(page.locator('[data-resource-list]')).toBeHidden()
    await expect
      .poll(async () => (await detail.boundingBox())?.width ?? 0)
      .toBeGreaterThan(atMax.width)
    await page.getByRole('button', { name: 'Restore detail' }).click()
    await expect(page.locator('[data-resource-list]')).toBeVisible()
    await expect.poll(async () => (await detail.boundingBox())?.width ?? 0).toBeCloseTo(maxWidth, 0)
    expect(requests.length).toBe(requestsBefore)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  }

  await page.setViewportSize({ width: 1024, height: 900 })
  for (const item of pages) {
    await page.goto(item.hash)
    await expect(page.locator('[data-resource-detail] h3').first()).toBeVisible()
    const handle = page.getByRole('separator', { name: 'Resize detail' })
    await expect(handle).toBeVisible()
    await handle.press('End')
    const maxWidth = Number(await handle.getAttribute('aria-valuemax'))
    await expect
      .poll(async () => (await page.locator('[data-resource-detail]').boundingBox())?.width ?? 0)
      .toBeCloseTo(maxWidth, 0)
    await expect.poll(async () => Number(await handle.getAttribute('aria-valuenow'))).toBe(maxWidth)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  }

  await page.setViewportSize({ width: 390, height: 844 })
  for (const item of pages) {
    await page.goto(item.hash)
    await expect(page.locator('[data-resource-detail] h3').first()).toBeVisible()
    await expect(page.locator('[data-resize-handle]')).toBeHidden()
    const detail = await page.locator('[data-resource-detail]').boundingBox()
    if (!detail) throw new Error(`Missing 390 detail for ${item.hash}`)
    expect(detail.width).toBeLessThanOrEqual(390)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  }

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/#/plans/55?task=66')
  const taskDetail = page.locator('[data-task-detail]')
  await expect(taskDetail.locator('h3')).toHaveText('Synthetic task')
  const taskDetailId = await taskDetail.getAttribute('id')
  const taskHandle = page.getByRole('separator', { name: 'Resize task details' })
  await expect(taskHandle).toBeVisible()
  expect(await taskHandle.getAttribute('aria-controls')).toBe(taskDetailId)
  expect(Number(await taskHandle.getAttribute('aria-valuenow'))).toBeGreaterThan(0)
  expect(Number(await taskHandle.getAttribute('aria-valuemax'))).toBeGreaterThan(
    Number(await taskHandle.getAttribute('aria-valuemin')),
  )
  const taskRequestsBefore = requests.length
  const taskBefore = await taskDetail.boundingBox()
  const taskHandleBox = await taskHandle.boundingBox()
  if (!taskBefore || !taskHandleBox) throw new Error('Missing task detail geometry')
  await page.mouse.move(taskHandleBox.x + taskHandleBox.width / 2, taskHandleBox.y + 80)
  await page.mouse.down()
  await page.mouse.move(taskHandleBox.x - 80, taskHandleBox.y + 80, { steps: 8 })
  await page.mouse.up()
  await expect
    .poll(async () => (await taskDetail.boundingBox())?.width ?? 0)
    .toBeGreaterThan(taskBefore.width + 40)

  const taskKeyboardBefore = (await taskDetail.boundingBox())?.width ?? 0
  await taskHandle.press('ArrowLeft')
  await expect
    .poll(async () => (await taskDetail.boundingBox())?.width ?? 0)
    .toBeGreaterThan(taskKeyboardBefore + 10)
  const taskAfterLeft = (await taskDetail.boundingBox())?.width ?? 0
  await taskHandle.press('ArrowRight')
  await expect
    .poll(async () => (await taskDetail.boundingBox())?.width ?? 0)
    .toBeLessThan(taskAfterLeft)
  await expect
    .poll(async () => {
      const width = (await taskDetail.boundingBox())?.width ?? 0
      const now = Number(await taskHandle.getAttribute('aria-valuenow'))
      return Math.abs(width - now)
    })
    .toBeLessThanOrEqual(1)

  const taskMinWidth = Number(await taskHandle.getAttribute('aria-valuemin'))
  await taskHandle.press('Home')
  await expect
    .poll(async () => (await taskDetail.boundingBox())?.width ?? 0)
    .toBeCloseTo(taskMinWidth, 0)
  await expect
    .poll(async () => Number(await taskHandle.getAttribute('aria-valuenow')))
    .toBe(taskMinWidth)
  const taskMaxWidth = Number(await taskHandle.getAttribute('aria-valuemax'))
  await taskHandle.press('End')
  await expect
    .poll(async () => (await taskDetail.boundingBox())?.width ?? 0)
    .toBeCloseTo(taskMaxWidth, 0)
  await expect
    .poll(async () => Number(await taskHandle.getAttribute('aria-valuenow')))
    .toBe(taskMaxWidth)
  const taskAtMax = await taskDetail.boundingBox()
  if (!taskAtMax) throw new Error('Missing maximum task detail width')

  await page.getByRole('button', { name: 'Expand task details' }).click()
  await expect(page.locator('[data-plan-board]')).toBeHidden()
  await expect
    .poll(async () => (await taskDetail.boundingBox())?.width ?? 0)
    .toBeGreaterThan(taskAtMax.width)
  await page.getByRole('button', { name: 'Restore task details' }).click()
  await expect(page.locator('[data-plan-board]')).toBeVisible()
  await expect
    .poll(async () => (await taskDetail.boundingBox())?.width ?? 0)
    .toBeCloseTo(taskMaxWidth, 0)
  expect(requests.length).toBe(taskRequestsBefore)

  await page.setViewportSize({ width: 1024, height: 900 })
  await page.goto('/#/plans/55?task=66')
  await expect(taskDetail.locator('h3')).toHaveText('Synthetic task')
  await expect(taskHandle).toBeVisible()
  await taskHandle.press('End')
  const taskMaxAt1024 = Number(await taskHandle.getAttribute('aria-valuemax'))
  await expect
    .poll(async () => (await taskDetail.boundingBox())?.width ?? 0)
    .toBeCloseTo(taskMaxAt1024, 0)
  await expect
    .poll(async () => Number(await taskHandle.getAttribute('aria-valuenow')))
    .toBe(taskMaxAt1024)
  let taskOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(taskOverflow).toBeLessThanOrEqual(1)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/plans/55?task=66')
  await expect(taskDetail.locator('h3')).toHaveText('Synthetic task')
  await expect(taskHandle).toBeHidden()
  await expect(taskDetail.getByRole('link', { name: 'Back to board' })).toBeVisible()
  await expect(
    page.locator('[data-plan-header]').getByText(longProjectName, { exact: true }),
  ).toBeVisible()
  const taskMobile = await taskDetail.boundingBox()
  if (!taskMobile) throw new Error('Missing 390 task detail')
  expect(taskMobile.width).toBeLessThanOrEqual(390)
  taskOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(taskOverflow).toBeLessThanOrEqual(1)
  await taskDetail.getByRole('link', { name: 'Back to board' }).click()
  await expect(page.locator('[data-task-id="66"]')).toBeFocused()
})

test('timeline displays and filters all five stored action types', async ({ page }) => {
  const actions = ['created', 'updated', 'deleted', 'read', 'queried']
  await page.route('**/health', (route) => route.fulfill(json({ status: 'healthy' })))
  await page.route('**/.well-known', (route) =>
    route.fulfill(
      json({
        schema_version: 1,
        capabilities: { planning: true, skills: false, files: false, activity_stream: false },
      }),
    ),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/activity') {
      const action = url.searchParams.get('action')
      const events = actions
        .filter((candidate) => action === null || action === candidate)
        .map((candidate, index) => ({
          ...syntheticEvent,
          id: 900 + index,
          action: candidate,
          snapshot: { id: 901, title: `Historical ${candidate} title` },
        }))
      await route.fulfill(
        json({
          events,
          total: events.length,
          limit: Number(url.searchParams.get('limit') ?? 50),
          offset: Number(url.searchParams.get('offset') ?? 0),
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'Unexpected test request' }, 500))
  })

  const initialRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/activity'
  })
  await page.goto('/#/timeline')
  const initialRequest = await initialRequestPromise
  await expect(page.getByRole('heading', { name: 'Activity history', level: 2 })).toBeVisible()
  const initialUrl = new URL(initialRequest.url())
  expect(initialUrl.searchParams.get('limit')).toBe('20')
  expect(initialUrl.searchParams.get('offset')).toBe('0')
  for (const action of actions) {
    await expect(page.getByText(`${action} memory #901`)).toBeVisible()
  }

  for (const action of actions) {
    const requestPromise = page.waitForRequest((request) => {
      const url = new URL(request.url())
      return url.pathname === '/api/v1/activity' && url.searchParams.get('action') === action
    })
    await page.getByLabel('Action filter').selectOption(action)
    await requestPromise
    await expect(page.getByText(`${action} memory #901`, { exact: true })).toBeVisible()
    for (const other of actions.filter((candidate) => candidate !== action)) {
      await expect(page.getByText(`${other} memory #901`, { exact: true })).toHaveCount(0)
    }
  }
})

test('plan board keeps distinct project names across deep links and delayed lookup', async ({
  page,
}) => {
  const alpha = { ...syntheticProject, id: 1, name: 'Alpha project name' }
  const beta = { ...syntheticProject, id: 2, name: 'Beta project name' }
  const firstPlan = { ...syntheticPlan, id: 55, project_id: 1, title: 'First named plan' }
  const secondPlan = { ...syntheticPlan, id: 56, project_id: 2, title: 'Second named plan' }
  let releaseProjects: (() => void) | undefined
  const gate = new Promise<void>((resolve) => {
    releaseProjects = resolve
  })

  await installBaseApi(page, {
    capabilities: {
      schema_version: 1,
      capabilities: { planning: true, skills: false, files: false, activity_stream: false },
    },
    projects: [alpha, beta],
    plans: [firstPlan, secondPlan],
    taskSummaries: [],
    taskDetails: [],
  })
  await page.route('**/api/v1/projects', async (route) => {
    await gate
    await route.fulfill(json({ projects: [alpha, beta], total: 2 })).catch(() => undefined)
  })

  await page.goto('/#/plans/55')
  const header = page.locator('[data-plan-header]')
  await expect(header.getByRole('heading', { name: 'First named plan' })).toBeVisible()
  await expect(header.getByText('Project #1', { exact: true })).toBeVisible()
  releaseProjects?.()
  await expect(header.getByRole('link', { name: 'Alpha project name', exact: true })).toBeVisible()

  await page.goto('/#/plans/56')
  await expect(header.getByRole('heading', { name: 'Second named plan' })).toBeVisible()
  await expect(header.getByRole('link', { name: 'Beta project name', exact: true })).toBeVisible()
})

test('plan content survives project lookup failure and names recover on retry', async ({
  page,
}) => {
  let projectsAvailable = false
  await installBaseApi(page, {
    capabilities: {
      schema_version: 1,
      capabilities: { planning: true, skills: false, files: false, activity_stream: false },
    },
    plans: [syntheticPlan],
    taskSummaries: [],
    taskDetails: [],
  })
  await page.route('**/api/v1/projects', async (route) => {
    if (!projectsAvailable) {
      await route.fulfill(json({ error: 'Project lookup failed' }, 500))
      return
    }
    await route.fulfill(json({ projects: [syntheticProject], total: 1 }))
  })

  await page.goto('/#/plans/55')
  const header = page.locator('[data-plan-header]')
  await expect(header.getByRole('heading', { name: 'Synthetic plan' })).toBeVisible()
  await expect(header.getByText('Project #1', { exact: true })).toBeVisible()
  await expect(header.getByText('Synthetic plan goal.')).toBeVisible()
  await expect(page.getByText('Project options unavailable')).toBeVisible()

  projectsAvailable = true
  await page.getByRole('button', { name: 'Retry project options' }).click()
  await expect(header.getByRole('link', { name: 'Synthetic project', exact: true })).toBeVisible()
  await expect(header.getByText('Synthetic plan goal.')).toBeVisible()
})

test('clearing a resource selection restores the list from expanded detail', async ({ page }) => {
  await installBaseApi(page, { projects: [syntheticProject] })
  await page.goto('/#/projects')
  await page.getByRole('link', { name: /Synthetic project/ }).click()
  await expect(page.getByRole('heading', { name: 'Synthetic project' })).toBeVisible()
  await page.getByRole('button', { name: 'Expand detail' }).click()
  await expect(page.locator('[data-resource-list]')).toBeHidden()
  await page.goBack()
  await expect(page.locator('[data-resource-list]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Expand detail' })).toHaveCount(0)
})

test('long unbroken project names wrap in resource details and plan headers', async ({ page }) => {
  const projectName = `Synthetic${'P'.repeat(171)}`
  const project = { ...syntheticProject, name: projectName }
  await installBaseApi(page, {
    capabilities: {
      schema_version: 1,
      capabilities: { planning: true, skills: false, files: false, activity_stream: false },
    },
    projects: [project],
    plans: [{ ...syntheticPlan, project_id: project.id }],
    taskSummaries: [],
    taskDetails: [],
    documents: [],
  })

  const targets = [
    { hash: '#/plans/55', role: 'link' as const, container: '[data-plan-header]' },
    { hash: '#/projects/1', role: 'heading' as const, container: '[data-resource-detail]' },
  ]

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const target of targets) {
      await page.goto(target.hash)
      const scope = page.locator(target.container)
      const name = scope.getByRole(target.role, { name: projectName, exact: true })
      await expect(name).toBeVisible()
      if (width === 1440 && target.container === '[data-resource-detail]') {
        const handle = page.getByRole('separator', { name: 'Resize detail' })
        await handle.press('Home')
        const minWidth = Number(await handle.getAttribute('aria-valuemin'))
        await expect
          .poll(
            async () => (await page.locator('[data-resource-detail]').boundingBox())?.width ?? 0,
          )
          .toBeCloseTo(minWidth, 0)
      }
      const metrics = await name.evaluate((element, selector) => {
        const panel = element.closest(selector)
        if (!panel) throw new Error('Detail panel missing')
        const panelBox = panel.getBoundingClientRect()
        const range = document.createRange()
        range.selectNodeContents(element)
        const rectangles = [...range.getClientRects()]
        return {
          fits: rectangles.every(
            (rect) => rect.left >= panelBox.left - 1 && rect.right <= panelBox.right + 1,
          ),
          lines: rectangles.length,
        }
      }, target.container)
      expect(metrics.fits).toBe(true)
      expect(metrics.lines).toBeGreaterThan(1)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(1)
    }
  }
})
