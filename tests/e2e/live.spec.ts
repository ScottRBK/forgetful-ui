import { expect, test } from '@playwright/test'

const enabled = process.env.LIVE === '1'

test.describe('Live GET-only smoke test', () => {
  test.skip(!enabled, 'Set LIVE=1 to run against the local Forgetful instance')

  test('reads a memory page and a bounded graph without mutations', async ({ page }) => {
    const mutations: string[] = []
    page.on('request', (request) => {
      const method = request.method()
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        mutations.push(`${method} ${request.url()}`)
      }
    })

    await page.goto('/#/memories')
    await expect(page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 10_000 })
    const importanceHeader = page.getByRole('columnheader', { name: /Importance/ })
    await importanceHeader.getByRole('button').click()
    await expect(importanceHeader).toHaveAttribute('aria-sort', 'descending')
    await page.getByLabel('Minimum importance').selectOption('5')
    await expect(page.locator('table tbody tr a').first()).toBeVisible({ timeout: 15_000 })

    const firstMemory = page.locator('table tbody tr a').first()
    await expect(firstMemory).toBeVisible({ timeout: 15_000 })
    await firstMemory.click()

    await expect(page.getByRole('link', { name: 'Open graph' })).toBeVisible()
    await page.getByRole('link', { name: 'Open graph' }).click()
    await expect(page.locator('canvas')).toBeVisible({ timeout: 20_000 })

    await page.getByRole('link', { name: 'Back to memory' }).click()
    await expect(page.getByRole('link', { name: 'Open graph' })).toBeVisible()
    expect(mutations).toEqual([])
  })
})

test('reads the available remaining pages without mutations', async ({ page }) => {
  test.skip(!enabled, 'Set LIVE=1 to run against the local Forgetful instance')
  const mutations: string[] = []
  const requests: URL[] = []
  const graphMetas: {
    memory_count: number
    total_memory_count: number
    offset: number
    limit: number
    has_more: boolean
  }[] = []
  page.on('response', (response) => {
    const url = new URL(response.url())
    if (url.pathname !== '/api/v1/graph') return
    response
      .json()
      .then((body: unknown) => {
        const meta = (body as { meta?: unknown }).meta
        if (!meta || typeof meta !== 'object') return
        const value = meta as Record<string, unknown>
        if (
          typeof value.memory_count === 'number' &&
          typeof value.total_memory_count === 'number' &&
          typeof value.offset === 'number' &&
          typeof value.limit === 'number' &&
          typeof value.has_more === 'boolean'
        ) {
          graphMetas.push({
            memory_count: value.memory_count,
            total_memory_count: value.total_memory_count,
            offset: value.offset,
            limit: value.limit,
            has_more: value.has_more,
          })
        }
      })
      .catch(() => undefined)
  })
  page.on('request', (request) => {
    const method = request.method()
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      mutations.push(`${method} ${request.url()}`)
    }
    requests.push(new URL(request.url()))
  })

  await page.goto('/#/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText('Connected', { exact: true })).toBeVisible()
  const recentMemoriesSection = page
    .getByRole('main')
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Recent memories' }) })
  await expect(
    recentMemoriesSection
      .getByRole('list')
      .or(recentMemoriesSection.getByText('No memories available', { exact: true })),
  ).toBeVisible({ timeout: 15_000 })
  const recentActivitySection = page
    .getByRole('main')
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Recent activity' }) })
  await expect(
    recentActivitySection
      .getByRole('list')
      .or(recentActivitySection.getByText('No activity history', { exact: true })),
  ).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('alert')).toHaveCount(0)

  const graphRequestStart = requests.length
  await page.goto('/#/graph')
  await expect(page.getByRole('heading', { name: 'Graph overview' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(
    page.getByText(
      'Some connections between memories may be missing until Forgetful #221 is fixed.',
    ),
  ).toBeVisible()
  await expect(
    page.locator('canvas').or(page.getByText('No graph records', { exact: true })),
  ).toBeVisible({ timeout: 45_000 })
  await expect(page.getByText(/\d+ (memory|memories) · \d+ (project|projects) · /)).toBeVisible()
  await expect.poll(() => graphMetas.length).toBeGreaterThan(0)
  const firstMeta = graphMetas[0]
  if (!firstMeta) throw new Error('Graph metadata was not returned')
  const expectedPages =
    firstMeta.total_memory_count === 0
      ? 1
      : Math.ceil(firstMeta.total_memory_count / firstMeta.limit)
  await expect.poll(() => graphMetas.length).toBe(expectedPages)
  expect(graphMetas.at(-1)?.has_more).toBe(false)
  for (let index = 0; index < graphMetas.length; index += 1) {
    const meta = graphMetas[index]
    if (!meta) continue
    if (index === 0) expect(meta.offset).toBe(0)
    else
      expect(meta.offset).toBe(
        (graphMetas[index - 1]?.offset ?? -1) + (graphMetas[index - 1]?.memory_count ?? 0),
      )
  }
  const graphRequests = requests
    .slice(graphRequestStart)
    .filter((url) => url.pathname === '/api/v1/graph')
  expect(graphRequests).toHaveLength(graphMetas.length)
  expect(
    graphRequests.every((url) => url.searchParams.get('node_types') === 'memory,project'),
  ).toBe(true)
  expect(
    requests
      .slice(graphRequestStart)
      .some(
        (url) =>
          url.pathname === '/api/v1/memories' || url.pathname.startsWith('/api/v1/memories/'),
      ),
  ).toBe(false)
  await expect(page.getByRole('alert')).toHaveCount(0)

  await page.goto('/#/projects')
  await expect(page.getByRole('heading', { name: 'Projects', level: 2 })).toBeVisible({
    timeout: 15_000,
  })
  await expect(
    page
      .getByRole('list', { name: 'Projects' })
      .or(page.getByText('No projects found', { exact: true })),
  ).toBeVisible({ timeout: 15_000 })
  const projectLink = page.getByRole('list', { name: 'Projects' }).getByRole('link').first()
  if ((await projectLink.count()) > 0) {
    await projectLink.click()
    await expect(page.getByRole('link', { name: 'View project memories' })).toBeVisible({
      timeout: 15_000,
    })
  }
  await expect(page.getByRole('alert')).toHaveCount(0)

  await page.goto('/#/plans')
  await expect(page.getByRole('heading', { name: 'Plans', level: 2 })).toBeVisible({
    timeout: 15_000,
  })
  await expect(
    page.getByRole('list', { name: 'Plans' }).or(page.getByText('No plans found', { exact: true })),
  ).toBeVisible({ timeout: 15_000 })
  const planLink = page.getByRole('list', { name: 'Plans' }).getByRole('link').first()
  if ((await planLink.count()) > 0) {
    await planLink.click()
    await expect(page.getByRole('link', { name: 'View project memories' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.locator('[data-plan-board]')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('region', { name: 'To do', exact: true })).toBeVisible()
    const taskCard = page.locator('[data-plan-board] [data-task-id]').first()
    if ((await taskCard.count()) > 0) {
      await taskCard.click()
      await expect(
        page.locator('[data-task-detail]').getByText('Criteria', { exact: true }),
      ).toBeVisible({ timeout: 15_000 })
    }
    await page.getByRole('link', { name: 'Back to plans' }).click()
    await expect(page.getByRole('heading', { name: 'Plans', level: 2 })).toBeVisible()
  }
  await expect(page.getByRole('alert')).toHaveCount(0)

  await page.goto('/#/documents')
  await expect(page.getByRole('heading', { name: 'Documents', level: 2 })).toBeVisible({
    timeout: 15_000,
  })
  await expect(
    page
      .getByRole('list', { name: 'Documents' })
      .or(page.getByText('No documents found', { exact: true })),
  ).toBeVisible({ timeout: 15_000 })
  const documentLink = page.getByRole('list', { name: 'Documents' }).getByRole('link').first()
  if ((await documentLink.count()) > 0) {
    await documentLink.click()
    await expect(page.locator('[data-resource-detail] h3').first()).toBeVisible({ timeout: 15_000 })
  }
  await expect(page.getByRole('alert')).toHaveCount(0)

  await page.goto('/#/code')
  await expect(page.getByRole('heading', { name: 'Code artifacts', level: 2 })).toBeVisible({
    timeout: 15_000,
  })
  await expect(
    page
      .getByRole('list', { name: 'Code artifacts' })
      .or(page.getByText('No code artifacts found', { exact: true })),
  ).toBeVisible({ timeout: 15_000 })
  const codeLink = page.getByRole('list', { name: 'Code artifacts' }).getByRole('link').first()
  if ((await codeLink.count()) > 0) {
    await codeLink.click()
    await expect(page.locator('[data-resource-detail] pre').first()).toBeVisible({
      timeout: 15_000,
    })
  }
  await expect(page.getByRole('alert')).toHaveCount(0)

  await page.goto('/#/timeline')
  await expect(page.getByRole('heading', { name: 'Timeline', level: 1 })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByRole('heading', { name: 'Activity history', level: 2 })).toBeVisible()
  await expect(
    page
      .getByRole('list', { name: 'Activity events' })
      .or(page.getByText('No activity events', { exact: true })),
  ).toBeVisible({ timeout: 15_000 })
  const eventSummary = page.locator('summary').first()
  if ((await eventSummary.count()) > 0) {
    await eventSummary.click()
    await expect(page.getByText(/Historical snapshot/).first()).toBeVisible()
  }
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(requests.some((url) => url.pathname === '/api/v1/activity')).toBe(true)

  const projectsBeforeFiles = requests.filter((url) => url.pathname === '/api/v1/projects').length
  await page.goto('/#/files')
  await expect(page.getByText('Files are unavailable')).toBeVisible({ timeout: 10_000 })
  expect(requests.some((url) => url.pathname === '/api/v1/files')).toBe(false)
  expect(requests.filter((url) => url.pathname === '/api/v1/projects')).toHaveLength(
    projectsBeforeFiles,
  )

  const filesBeforeSkills = requests.filter((url) => url.pathname === '/api/v1/files').length
  await page.goto('/#/skills')
  await expect(page.getByText('Skills are unavailable')).toBeVisible({ timeout: 10_000 })
  expect(requests.some((url) => url.pathname === '/api/v1/skills')).toBe(false)
  expect(requests.filter((url) => url.pathname === '/api/v1/files')).toHaveLength(filesBeforeSkills)

  expect(mutations).toEqual([])
})
