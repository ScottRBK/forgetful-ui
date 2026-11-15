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

test('plans shows goal, plan-scoped tasks and task detail', async ({ page }) => {
  const requests = await installBaseApi(page, {
    projects: [syntheticProject],
    plans: [syntheticPlan],
    taskSummaries: [syntheticTaskSummary, syntheticTaskAllSummary],
    taskDetails: [syntheticTaskDetail, syntheticTaskAllDetail, syntheticWrongPlanTask],
  })

  await page.goto('/#/plans')
  await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible()
  await page.getByRole('link', { name: /Synthetic plan/ }).click()

  await expect(page.getByText('Synthetic plan goal.')).toBeVisible()
  await expect(page.getByText('Synthetic plan context.')).toBeVisible()
  await page.getByRole('link', { name: /Synthetic task/ }).click()

  await expect(page.getByText('Synthetic task description.')).toBeVisible()
  await expect(page.getByText('Synthetic criterion one')).toBeVisible()
  await expect(page.getByText('Synthetic criterion two')).toBeVisible()
  await expect(page.getByText('65')).toBeVisible()
  await expect(page.getByText('1/2 met')).toBeVisible()
  await expect(page).toHaveURL(/#\/plans\/55\?task=66/)

  const taskLists = requests.filter((url) => url.pathname === '/api/v1/tasks')
  expect(taskLists).toHaveLength(1)
  expect(taskLists[0]?.searchParams.get('plan_id')).toBe('55')
  const taskDetail = requests.filter((url) => url.pathname === '/api/v1/tasks/66')
  expect(taskDetail).toHaveLength(1)

  await page.getByRole('link', { name: /Synthetic all-met task/ }).click()
  await expect(page.getByText('2/2 met')).toBeVisible()
  await expect(page).toHaveURL(/#\/plans\/55\?task=67$/)

  const planStatusRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/plans' && url.searchParams.get('status') === 'active'
  })
  await page.getByLabel('Plan status filter').selectOption('active')
  const planStatusRequest = await planStatusRequestPromise
  await expect(page).toHaveURL(/#\/plans\/55\?task=67&status=active$/)
  expect(new URL(planStatusRequest.url()).searchParams.get('status')).toBe('active')

  const planProjectRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/plans' && url.searchParams.get('project_id') === '1'
  })
  await page.getByLabel('Project filter').selectOption('1')
  const planProjectRequest = await planProjectRequestPromise
  await expect(page).toHaveURL(/#\/plans\/55\?task=67&project=1&status=active$/)
  expect(new URL(planProjectRequest.url()).searchParams.get('project_id')).toBe('1')
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
  await page.getByRole('link', { name: /Synthetic task/ }).click()
  await expect(page.locator('[data-task-detail]')).toBeFocused()
  await expect(page.getByText('Synthetic task description.')).toBeVisible()
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
})

test('plans show the project name in list and detail from a deep link', async ({ page }) => {
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
  await expect(page.getByRole('heading', { name: 'Synthetic plan' })).toBeVisible()
  const detail = page.locator('[data-resource-detail]')
  await expect(detail.getByText('Synthetic project', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /Synthetic plan/ })).toContainText(
    'Synthetic project',
  )

  const projectListsBeforeSelection = requests.filter(
    (url) => url.pathname === '/api/v1/projects',
  ).length
  await page.getByRole('link', { name: /Second synthetic plan/ }).click()
  await expect(page.getByRole('heading', { name: 'Second synthetic plan' })).toBeVisible()
  await expect(detail.getByText('Synthetic project', { exact: true })).toBeVisible()
  expect(requests.filter((url) => url.pathname === '/api/v1/projects')).toHaveLength(
    projectListsBeforeSelection,
  )
  expect(requests.some((url) => /^\/api\/v1\/projects\/\d+$/.test(url.pathname))).toBe(false)
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
    { hash: '#/plans/55', list: 'Plans', detail: 'Synthetic plan' },
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
    const afterDrag = await detail.boundingBox()
    if (!afterDrag) throw new Error(`Missing resized detail for ${item.hash}`)
    expect(afterDrag.width).toBeGreaterThan(before.width + 40)

    const keyboardBefore = afterDrag.width
    await handle.focus()
    await page.keyboard.press('ArrowLeft')
    const afterLeft = await detail.boundingBox()
    if (!afterLeft) throw new Error(`Missing keyboard resize for ${item.hash}`)
    expect(afterLeft.width).toBeGreaterThan(keyboardBefore + 10)
    await page.keyboard.press('ArrowRight')
    const afterRight = await detail.boundingBox()
    if (!afterRight) throw new Error(`Missing keyboard restore for ${item.hash}`)
    expect(afterRight.width).toBeLessThan(afterLeft.width)
    await page.keyboard.press('Home')
    const atMin = await detail.boundingBox()
    const minWidth = Number(await handle.getAttribute('aria-valuemin'))
    if (!atMin) throw new Error(`Missing minimum width for ${item.hash}`)
    expect(atMin.width).toBeGreaterThanOrEqual(minWidth - 1)
    expect(atMin.width).toBeLessThanOrEqual(minWidth + 1)
    await page.keyboard.press('End')
    const atMax = await detail.boundingBox()
    const maxWidth = Number(await handle.getAttribute('aria-valuemax'))
    if (!atMax) throw new Error(`Missing maximum width for ${item.hash}`)
    expect(atMax.width).toBeLessThanOrEqual(maxWidth + 1)

    await page.getByRole('button', { name: 'Expand detail' }).click()
    await expect(page.locator('[data-resource-list]')).toBeHidden()
    const expanded = await detail.boundingBox()
    if (!expanded) throw new Error(`Missing expanded detail for ${item.hash}`)
    expect(expanded.width).toBeGreaterThan(atMax.width)
    await page.getByRole('button', { name: 'Restore detail' }).click()
    await expect(page.locator('[data-resource-list]')).toBeVisible()
    const restored = await detail.boundingBox()
    if (!restored) throw new Error(`Missing restored detail for ${item.hash}`)
    expect(restored.width).toBeLessThanOrEqual(maxWidth + 1)
    expect(Math.abs(restored.width - atMax.width)).toBeLessThanOrEqual(2)
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
    await handle.focus()
    await page.keyboard.press('End')
    const detail = await page.locator('[data-resource-detail]').boundingBox()
    const maxWidth = Number(await handle.getAttribute('aria-valuemax'))
    if (!detail) throw new Error(`Missing 1024 detail for ${item.hash}`)
    expect(detail.width).toBeLessThanOrEqual(maxWidth + 1)
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
    if (item.hash === '#/plans/55') {
      await expect(
        page.locator('[data-resource-detail]').getByText(longProjectName, { exact: true }),
      ).toBeVisible()
    }
    const detail = await page.locator('[data-resource-detail]').boundingBox()
    if (!detail) throw new Error(`Missing 390 detail for ${item.hash}`)
    expect(detail.width).toBeLessThanOrEqual(390)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  }
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

test('plans keep distinct project names across selection changes and delayed lookup', async ({
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
  await expect(page.getByRole('heading', { name: 'First named plan' })).toBeVisible()
  const detail = page.locator('[data-resource-detail]')
  await expect(detail.getByText('Project #1', { exact: true })).toBeVisible()
  releaseProjects?.()
  await expect(detail.getByText('Alpha project name', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /First named plan/ })).toContainText(
    'Alpha project name',
  )

  await page.getByRole('link', { name: /Second named plan/ }).click()
  await expect(page.getByRole('heading', { name: 'Second named plan' })).toBeVisible()
  await expect(detail.getByText('Beta project name', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /Second named plan/ })).toContainText(
    'Beta project name',
  )
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
  await expect(page.getByRole('heading', { name: 'Synthetic plan' })).toBeVisible()
  const detail = page.locator('[data-resource-detail]')
  await expect(detail.getByText('Project #1', { exact: true })).toBeVisible()
  await expect(page.getByText('Synthetic plan goal.')).toBeVisible()
  await expect(page.getByText('Project options unavailable')).toBeVisible()

  projectsAvailable = true
  await page.getByRole('button', { name: 'Retry project options' }).click()
  await expect(detail.getByText('Synthetic project', { exact: true })).toBeVisible()
  await expect(page.getByText('Synthetic plan goal.')).toBeVisible()
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

test('long unbroken project names wrap inside narrow resource detail panes', async ({ page }) => {
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
    { hash: '#/plans/55', role: 'link' as const },
    { hash: '#/projects/1', role: 'heading' as const },
  ]

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const target of targets) {
      await page.goto(target.hash)
      const detail = page.locator('[data-resource-detail]')
      const name = detail.getByRole(target.role, { name: projectName, exact: true })
      await expect(name).toBeVisible()
      if (width === 1440) {
        const handle = page.getByRole('separator', { name: 'Resize detail' })
        await handle.focus()
        await page.keyboard.press('Home')
      }
      const metrics = await name.evaluate((element) => {
        const panel = element.closest('[data-resource-detail]')
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
      })
      expect(metrics.fits).toBe(true)
      expect(metrics.lines).toBeGreaterThan(1)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(1)
    }
  }
})
