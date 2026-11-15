import { expect, type Page, test } from '@playwright/test'

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

interface ApiOptions {
  memories?: (
    url: URL,
    attempt: number,
  ) => { body: unknown; status?: number } | Promise<{ body: unknown; status?: number }>
  projects?: { body: unknown; status?: number }
  memoryDetail?: (id: number) => { body: unknown; status?: number }
  subgraph?: { body: unknown; status?: number }
}

interface ApiLog {
  url: URL
  method: string
}

async function installApi(page: Page, options: ApiOptions = {}): Promise<ApiLog[]> {
  const log: ApiLog[] = []
  let memoryAttempts = 0

  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    log.push({ url, method: request.method() })

    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/projects') {
      const result = options.projects ?? {
        body: {
          projects: [
            { id: 7, name: 'Alpha project' },
            { id: 9, name: 'Beta project' },
          ],
          total: 2,
        },
      }
      await route.fulfill(json(result.body, result.status ?? 200))
      return
    }
    if (url.pathname === '/api/v1/memories') {
      memoryAttempts += 1
      const result = options.memories
        ? await options.memories(url, memoryAttempts)
        : { body: { memories: [], total: 0, limit: 20, offset: 0 } }
      await route.fulfill(json(result.body, result.status ?? 200))
      return
    }
    const memoryMatch = /^\/api\/v1\/memories\/(\d+)$/.exec(url.pathname)
    if (memoryMatch?.[1]) {
      const id = Number(memoryMatch[1])
      const result = options.memoryDetail ? options.memoryDetail(id) : { body: syntheticMemory(id) }
      await route.fulfill(json(result.body, result.status ?? 200))
      return
    }
    if (url.pathname === '/api/v1/graph/subgraph') {
      const result = options.subgraph ?? { body: syntheticSubgraph() }
      await route.fulfill(json(result.body, result.status ?? 200))
      return
    }
    await route.fulfill(json({ error: 'Unexpected test request' }, 500))
  })

  return log
}

function syntheticSubgraph() {
  return {
    nodes: [
      {
        id: 'memory_101',
        type: 'memory',
        label: 'Synthetic history memory',
        depth: 0,
        data: { importance: 6 },
      },
    ],
    edges: [],
    meta: {
      center_node_id: 'memory_101',
      depth: 1,
      node_types: ['memory'],
      max_nodes: 100,
      edge_count: 0,
      truncated: false,
    },
  }
}

function syntheticMemory(
  id: number,
  title = `Synthetic memory ${id}`,
  overrides: { project_ids?: number[]; importance?: number } = {},
) {
  return {
    id,
    title,
    content: `Synthetic content for memory ${id}.`,
    context: null,
    keywords: ['synthetic'],
    tags: ['fixture'],
    importance: 6,
    created_at: '2026-01-02T10:00:00Z',
    updated_at: '2026-01-03T11:00:00Z',
    project_ids: [7],
    ...overrides,
    linked_memory_ids: [],
    source_repo: null,
    source_files: [],
    source_url: null,
    confidence: null,
    encoding_agent: null,
    encoding_version: null,
    is_obsolete: false,
    access_count: 2,
    last_accessed_at: null,
  }
}

test('filters by project, pages with server totals and keeps direct links', async ({ page }) => {
  const log = await installApi(page, {
    memories: (url) => {
      const project = url.searchParams.get('project_id') ?? 'none'
      const offset = url.searchParams.get('offset')
      return {
        body: {
          memories: [
            syntheticMemory(offset === '20' ? 220 : 210, `Synthetic page ${project}-${offset}`),
          ],
          total: 65,
          limit: 20,
          offset: Number(offset),
        },
      }
    },
  })

  await page.goto('/#/memories?page=2&project=7')
  await expect(page.getByRole('link', { name: 'Synthetic page 7-20' })).toBeVisible()
  await expect(page.getByText('Page 2 of 4')).toBeVisible()
  const lastMemoryRequest = () =>
    log.filter((entry) => entry.url.pathname === '/api/v1/memories').at(-1)
  expect(lastMemoryRequest()?.url.searchParams.get('project_id')).toBe('7')
  expect(lastMemoryRequest()?.url.searchParams.get('offset')).toBe('20')

  await page.getByLabel('Project filter').selectOption('9')
  await expect(page.getByRole('link', { name: 'Synthetic page 9-0' })).toBeVisible()
  await expect(page).toHaveURL(/#\/memories\?project=9$/)
  expect(lastMemoryRequest()?.url.searchParams.get('project_id')).toBe('9')
  expect(lastMemoryRequest()?.url.searchParams.get('offset')).toBe('0')

  await page.getByRole('link', { name: 'Next page' }).click()
  await expect(page.getByRole('link', { name: 'Synthetic page 9-20' })).toBeVisible()
  await expect(page).toHaveURL(/#\/memories\?page=2&project=9$/)

  await page.goto('/#/memories/301?page=2&project=9')
  await expect(page.getByRole('heading', { name: 'Synthetic memory 301' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Synthetic memory 301' })).toBeVisible()
  await expect(page).toHaveURL(/#\/memories\/301\?page=2&project=9$/)

  expect(log.every((entry) => entry.method === 'GET')).toBe(true)
})

test('does not load graph code or data before the graph is opened', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))

  await installApi(page, {
    memories: () => ({
      body: {
        memories: [syntheticMemory(101, 'Synthetic lazy memory')],
        total: 1,
        limit: 20,
        offset: 0,
      },
    }),
  })

  await page.goto('/#/memories')
  await expect(page.getByRole('link', { name: 'Synthetic lazy memory' })).toBeVisible()

  expect(requests.some((url) => url.includes('/api/v1/graph'))).toBe(false)
  expect(requests.some((url) => url.includes('GraphScreen'))).toBe(false)
  expect(requests.some((url) => url.includes('react-force-graph'))).toBe(false)

  await page.getByRole('link', { name: 'Synthetic lazy memory' }).click()
  await page.getByRole('link', { name: 'Open graph' }).click()
  await expect(page.locator('canvas')).toBeVisible()

  expect(requests.some((url) => url.includes('/api/v1/graph/subgraph'))).toBe(true)
  expect(requests.some((url) => url.includes('GraphScreen') || url.includes('GraphCanvas'))).toBe(
    true,
  )
})

test('shows an error, retries, handles empty results and a missing record', async ({ page }) => {
  let failing = true
  await installApi(page, {
    memories: () => {
      if (failing) return { body: { error: 'Temporary test failure' }, status: 503 }
      return {
        body: {
          memories: [syntheticMemory(101, 'Synthetic restored memory')],
          total: 1,
          limit: 20,
          offset: 0,
        },
      }
    },
  })

  await page.goto('/#/memories')
  await expect(page.getByRole('alert')).toContainText('Could not load memories')
  await expect(page.getByRole('alert')).toContainText('Temporary test failure')
  failing = false
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByRole('link', { name: 'Synthetic restored memory' })).toBeVisible()

  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await installApi(page, {
    memories: () => ({ body: { memories: [], total: 0, limit: 20, offset: 0 } }),
  })
  await page.goto('/#/memories?project=2')
  await expect(page.getByText('No memories found')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Clear the project filter' })).toBeVisible()

  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await installApi(page, {
    memories: () => ({
      body: {
        memories: [syntheticMemory(101, 'Synthetic deleted record')],
        total: 1,
        limit: 20,
        offset: 0,
      },
    }),
    memoryDetail: () => ({ body: { error: 'Memory not found' }, status: 404 }),
  })
  await page.goto('/#/memories')
  await page.getByRole('link', { name: 'Synthetic deleted record' }).click()
  await expect(page.getByText('Memory not found', { exact: true })).toBeVisible()
  await expect(page.getByText(/may have been deleted/)).toBeVisible()
})

test('supports browser back and forward through list, detail and graph', async ({ page }) => {
  await installApi(page, {
    memories: () => ({
      body: {
        memories: [syntheticMemory(101, 'Synthetic history memory')],
        total: 1,
        limit: 20,
        offset: 0,
      },
    }),
  })

  await page.goto('/#/memories')
  await page.getByRole('link', { name: 'Synthetic history memory' }).click()
  await expect(page.getByRole('heading', { name: 'Synthetic memory 101' })).toBeVisible()

  await page.getByRole('link', { name: 'Open graph' }).click()
  await expect(page.getByRole('button', { name: /Synthetic history memory/ }).first()).toBeVisible()

  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Synthetic memory 101' })).toBeVisible()

  await page.goBack()
  await expect(page.getByRole('link', { name: 'Synthetic history memory' })).toBeVisible()

  await page.goForward()
  await expect(page.getByRole('heading', { name: 'Synthetic memory 101' })).toBeVisible()
})

test('keeps a narrow layout inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installApi(page, {
    memories: () => ({
      body: {
        memories: [
          syntheticMemory(
            101,
            'Synthetic narrow layout memory with a title long enough to test wrapping behaviour',
          ),
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    }),
  })

  await page.goto('/#/memories')
  await expect(page.getByRole('link', { name: /Synthetic narrow layout memory/ })).toBeVisible()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
})

test('reveals a selected memory detail on a narrow screen and keeps back usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const rows = Array.from({ length: 20 }, (_, index) =>
    syntheticMemory(
      1000 + index,
      `Synthetic narrow row ${index + 1} with a descriptive title for wrapping`,
    ),
  )

  await installApi(page, {
    memories: () => ({
      body: { memories: rows, total: rows.length, limit: 20, offset: 0 },
    }),
    memoryDetail: (id) => ({
      body: rows.find((row) => row.id === id) ?? syntheticMemory(id),
    }),
  })

  await page.goto('/#/memories')
  const firstRow = page.getByRole('link', { name: rows[0]?.title })
  await expect(firstRow).toBeVisible()
  await firstRow.click()

  const detailHeading = page.getByRole('heading', { name: rows[0]?.title })
  await expect(detailHeading).toBeVisible()
  await expect(detailHeading).toBeFocused()
  await expect(detailHeading).toBeInViewport({ ratio: 1 })

  const refreshButton = page.getByRole('button', { name: 'Refresh memories' })
  await refreshButton.click()
  await expect(refreshButton).toBeFocused()
  await expect(detailHeading).not.toBeFocused()

  await page.goBack()
  await expect(page.getByRole('link', { name: rows[0]?.title })).toBeInViewport({ ratio: 1 })
})

test('focuses a successful detail after a previous missing record', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const rows = Array.from({ length: 20 }, (_, index) =>
    syntheticMemory(1100 + index, `Synthetic race row ${index + 1}`),
  )
  const missing = rows[0]
  const target = rows[1]
  if (!missing || !target) throw new Error('Synthetic rows missing')

  await installApi(page, {
    memories: () => ({
      body: { memories: rows, total: rows.length, limit: 20, offset: 0 },
    }),
    memoryDetail: (id) =>
      id === missing.id
        ? { body: { error: 'Memory not found' }, status: 404 }
        : { body: rows.find((row) => row.id === id) ?? syntheticMemory(id) },
  })

  await page.goto('/#/memories')
  await page.getByRole('link', { name: missing.title, exact: true }).click()
  await expect(page.getByText('Memory not found', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: target.title, exact: true }).click()
  const targetHeading = page.getByRole('heading', { name: target.title, exact: true })
  await expect(targetHeading).toBeVisible()
  await expect(targetHeading).toBeFocused()
  await expect(targetHeading).toBeInViewport({ ratio: 1 })
})

test('restores the selected row after browser Back from a lower row', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const rows = Array.from({ length: 20 }, (_, index) =>
    syntheticMemory(1200 + index, `Synthetic back row ${index + 1}`),
  )
  const target = rows[17]
  if (!target) throw new Error('Synthetic row missing')

  await installApi(page, {
    memories: () => ({
      body: { memories: rows, total: rows.length, limit: 20, offset: 0 },
    }),
    memoryDetail: (id) => ({
      body: rows.find((row) => row.id === id) ?? syntheticMemory(id),
    }),
  })

  await page.goto('/#/memories')
  const targetRow = page.getByRole('link', { name: target.title })
  await targetRow.click()
  await expect(page.getByRole('heading', { name: target.title })).toBeFocused()

  await page.goBack()
  await expect(page.getByRole('link', { name: target.title })).toBeFocused()
  await expect(page.getByRole('link', { name: target.title })).toBeInViewport({ ratio: 1 })
})

test('resizes, expands and restores the selected memory detail on wide screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const rows = Array.from({ length: 20 }, (_, index) =>
    syntheticMemory(121 + index, `Synthetic resizable row ${index + 21}`),
  )
  const selected = rows[0]
  if (!selected) throw new Error('Synthetic row missing')

  const log = await installApi(page, {
    memories: () => ({
      body: { memories: rows, total: 65, limit: 20, offset: 20 },
    }),
    memoryDetail: (id) => ({
      body: rows.find((row) => row.id === id) ?? syntheticMemory(id),
    }),
  })

  await page.goto('/#/memories/121?page=2&project=7')
  await expect(page.getByRole('heading', { name: selected.title })).toBeVisible()
  const detail = page.locator('[data-memory-detail]')
  const handle = page.locator('[data-resize-handle]')
  const layout = page.locator('[data-memories-layout]')
  await expect(handle).toBeVisible()

  const before = await detail.boundingBox()
  if (!before) throw new Error('Detail has no box')
  const handleBox = await handle.boundingBox()
  if (!handleBox) throw new Error('Handle has no box')
  const listRequestsBefore = log.filter((entry) => entry.url.pathname === '/api/v1/memories').length

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox.x - 120, handleBox.y + handleBox.height / 2, { steps: 8 })
  await page.mouse.up()

  const afterDrag = await detail.boundingBox()
  if (!afterDrag) throw new Error('Detail has no box after drag')
  expect(afterDrag.width).toBeGreaterThan(before.width + 80)
  expect(log.filter((entry) => entry.url.pathname === '/api/v1/memories').length).toBe(
    listRequestsBefore,
  )

  await handle.focus()
  const keyboardBefore = afterDrag.width
  await page.keyboard.press('ArrowLeft')
  const afterKey = await detail.boundingBox()
  if (!afterKey) throw new Error('Detail has no box after key')
  expect(afterKey.width).toBeGreaterThan(keyboardBefore + 10)

  const handleBox2 = await handle.boundingBox()
  if (!handleBox2) throw new Error('Handle has no box after key')
  await page.mouse.move(handleBox2.x + handleBox2.width / 2, handleBox2.y + handleBox2.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox2.x - 2000, handleBox2.y + handleBox2.height / 2, { steps: 8 })
  await page.mouse.up()
  const atMax = await detail.boundingBox()
  const maxWidth = Number(await handle.getAttribute('aria-valuemax'))
  if (!atMax) throw new Error('Detail has no box at max')
  expect(atMax.width).toBeLessThanOrEqual(maxWidth + 1)

  const minWidth = Number(await handle.getAttribute('aria-valuemin'))
  await handle.focus()
  await page.keyboard.press('Home')
  const atMin = await detail.boundingBox()
  if (!atMin) throw new Error('Detail has no box at min')
  expect(atMin.width).toBeGreaterThanOrEqual(minWidth - 1)
  expect(atMin.width).toBeLessThanOrEqual(minWidth + 1)

  const endMax = Number(await handle.getAttribute('aria-valuemax'))
  await page.keyboard.press('End')
  const atEnd = await detail.boundingBox()
  if (!atEnd) throw new Error('Detail has no box at End')
  expect(atEnd.width).toBeLessThanOrEqual(endMax + 1)

  await page.setViewportSize({ width: 1100, height: 900 })
  await page.waitForTimeout(200)
  const resized = await detail.boundingBox()
  const newMax = Number(await handle.getAttribute('aria-valuemax'))
  if (!resized) throw new Error('Detail has no box after resize')
  expect(resized.width).toBeLessThanOrEqual(newMax + 1)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
  expect(
    await layout.evaluate((element) => element.scrollWidth - element.clientWidth),
  ).toBeLessThanOrEqual(1)

  await page.setViewportSize({ width: 1024, height: 900 })
  await page.waitForTimeout(200)
  const compact = await detail.boundingBox()
  const compactMax = Number(await handle.getAttribute('aria-valuemax'))
  if (!compact) throw new Error('Detail has no box at 1024px')
  expect(compact.width).toBeLessThanOrEqual(compactMax + 1)
  expect(
    await layout.evaluate((element) => element.scrollWidth - element.clientWidth),
  ).toBeLessThanOrEqual(1)

  const expand = page.getByRole('button', { name: 'Expand detail' })
  await expand.click()
  await expect(page.getByRole('table', { name: 'Memories' })).toBeHidden()
  const expanded = await detail.boundingBox()
  const layoutBox = await layout.boundingBox()
  if (!expanded || !layoutBox) throw new Error('Expanded layout missing')
  expect(expanded.width).toBeGreaterThanOrEqual(layoutBox.width - 42)
  await expect(page).toHaveURL(/#\/memories\/121\?page=2&project=7$/)

  await page.getByRole('button', { name: 'Restore detail' }).click()
  await expect(page.getByRole('table', { name: 'Memories' })).toBeVisible()
  await expect(page.getByRole('heading', { name: selected.title })).toBeVisible()
  await expect(page).toHaveURL(/#\/memories\/121\?page=2&project=7$/)
  expect(log.filter((entry) => entry.url.pathname === '/api/v1/memories').length).toBe(
    listRequestsBefore,
  )
})

test('does not render a resize handle on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const row = syntheticMemory(151, 'Synthetic mobile resize row')
  await installApi(page, {
    memories: () => ({
      body: { memories: [row], total: 1, limit: 20, offset: 0 },
    }),
    memoryDetail: () => ({ body: row }),
  })

  await page.goto('/#/memories/151')
  await expect(page.getByRole('heading', { name: row.title })).toBeVisible()
  await expect(page.locator('[data-resize-handle]')).toBeHidden()
  const detail = await page.locator('[data-memory-detail]').boundingBox()
  if (!detail) throw new Error('Detail missing')
  expect(detail.width).toBeLessThanOrEqual(390)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
})

test('keeps focus on the project filter when changing context from a selected row', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const rows = Array.from({ length: 20 }, (_, index) =>
    syntheticMemory(1300 + index, `Synthetic context row ${index + 1}`),
  )
  let releaseProject: (() => void) | undefined
  const projectGate = new Promise<void>((resolve) => {
    releaseProject = resolve
  })

  await installApi(page, {
    memories: async (url) => {
      if (url.searchParams.get('project_id') === '9') {
        await projectGate
        return {
          body: {
            memories: [syntheticMemory(1401, 'Synthetic other-project row')],
            total: 1,
            limit: 20,
            offset: 0,
          },
        }
      }
      return {
        body: { memories: rows, total: rows.length, limit: 20, offset: 0 },
      }
    },
    memoryDetail: (id) => ({
      body: rows.find((row) => row.id === id) ?? syntheticMemory(id),
    }),
  })

  await page.goto('/#/memories')
  const target = rows[17]
  if (!target) throw new Error('Synthetic row missing')
  await page.getByRole('link', { name: target.title }).click()
  await expect(page.getByRole('heading', { name: target.title })).toBeFocused()

  const filter = page.getByLabel('Project filter')
  await filter.focus()
  await filter.selectOption('9')
  await expect(filter).toBeFocused()
  await page.waitForTimeout(120)
  await expect(filter).toBeFocused()

  releaseProject?.()
  await expect(page.getByRole('link', { name: 'Synthetic other-project row' })).toBeVisible()
  await expect(filter).toBeFocused()
  await expect(page.getByRole('heading', { name: target.title })).toHaveCount(0)
})

test('numbers pages without horizontal overflow at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installApi(page, {
    memories: (url) => {
      const offset = Number(url.searchParams.get('offset'))
      return {
        body: {
          memories: [syntheticMemory(offset + 1, `Synthetic wide pages ${offset}`)],
          total: 1622,
          limit: 20,
          offset,
        },
      }
    },
  })

  await page.goto('/#/memories?page=42&project=7&sort=importance&order=asc&importance=8')
  await expect(page.getByRole('link', { name: 'Synthetic wide pages 820' })).toBeVisible()
  const pages = page.getByRole('navigation', { name: 'Memory pages' })
  await expect(pages.getByRole('link', { name: 'Page 1' })).toBeVisible()
  await expect(pages.getByRole('link', { name: 'Page 82' })).toBeVisible()
  await expect(pages.getByText('42')).toHaveAttribute('aria-current', 'page')

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
  const navOverflow = await pages.evaluate((element) => element.scrollWidth - element.clientWidth)
  expect(navOverflow).toBeLessThanOrEqual(1)
})

test('preserves sort and filter context through Graph and back', async ({ page }) => {
  const row = syntheticMemory(1601, 'Synthetic context memory')
  const log = await installApi(page, {
    memories: () => ({
      body: { memories: [row], total: 65, limit: 20, offset: 20 },
    }),
    memoryDetail: () => ({ body: row }),
    subgraph: {
      body: {
        nodes: [
          {
            id: 'memory_1601',
            type: 'memory',
            label: row.title,
            depth: 0,
            data: { importance: 5 },
          },
        ],
        edges: [],
        meta: {
          center_node_id: 'memory_1601',
          depth: 1,
          node_types: ['memory'],
          max_nodes: 100,
          edge_count: 0,
          truncated: false,
        },
      },
    },
  })

  await page.goto('/#/memories/1601?page=2&project=7&sort=importance&order=asc&importance=8')
  await expect(page.getByRole('heading', { name: row.title })).toBeVisible()
  await page.getByRole('link', { name: 'Open graph' }).click()
  await expect(page).toHaveURL(
    /#\/graph\?memory=1601&page=2&sort=importance&order=asc&project=7&importance=8$/,
  )
  await expect(page.locator('canvas')).toBeVisible()

  await page.getByRole('link', { name: 'Back to memory' }).click()
  await expect(page).toHaveURL(
    /#\/memories\/1601\?page=2&sort=importance&order=asc&project=7&importance=8$/,
  )
  const lastList = log.filter((entry) => entry.url.pathname === '/api/v1/memories').at(-1)
  expect(lastList?.url.searchParams.get('offset')).toBe('20')
  expect(lastList?.url.searchParams.get('project_id')).toBe('7')
  expect(lastList?.url.searchParams.get('sort_by')).toBe('importance')
  expect(lastList?.url.searchParams.get('sort_order')).toBe('asc')
  expect(lastList?.url.searchParams.get('importance_min')).toBe('8')
})

test('does not call an importance-filtered empty result an empty instance', async ({ page }) => {
  const records = Array.from({ length: 65 }, (_, index) =>
    syntheticMemory(1700 + index, `Synthetic importance row ${index + 1}`),
  )
  const log = await installApi(page, {
    memories: (url) => {
      const minimum = Number(url.searchParams.get('importance_min') ?? 0)
      const filtered = records.filter(() => minimum <= 7)
      const offset = Number(url.searchParams.get('offset') ?? 0)
      return {
        body: {
          memories: filtered.slice(offset, offset + 20),
          total: filtered.length,
          limit: 20,
          offset,
        },
      }
    },
  })

  await page.goto('/#/memories?sort=importance&order=asc')
  await expect(
    page.getByRole('link', { name: 'Synthetic importance row 1', exact: true }),
  ).toBeVisible()

  await page.getByLabel('Minimum importance').selectOption('10')
  await expect(page.getByText('No memories match the current filters.')).toBeVisible()
  await expect(page.getByText('This instance has no memories available.')).toHaveCount(0)

  const lastFiltered = log.filter((entry) => entry.url.pathname === '/api/v1/memories').at(-1)
  expect(lastFiltered?.url.searchParams.get('importance_min')).toBe('10')
  expect(lastFiltered?.url.searchParams.get('sort_by')).toBe('importance')
  expect(lastFiltered?.url.searchParams.get('sort_order')).toBe('asc')

  await page.getByRole('link', { name: 'Clear all filters' }).click()
  await expect(
    page.getByRole('link', { name: 'Synthetic importance row 1', exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Minimum importance')).toHaveValue('')
  const lastCleared = log.filter((entry) => entry.url.pathname === '/api/v1/memories').at(-1)
  expect(lastCleared?.url.searchParams.has('importance_min')).toBe(false)
  expect(lastCleared?.url.searchParams.get('sort_by')).toBe('importance')
  expect(lastCleared?.url.searchParams.get('sort_order')).toBe('asc')
  await expect(page).toHaveURL(/#\/memories\?sort=importance&order=asc$/)
})

test('clears only the project from an out-of-range page and keeps sort/filter', async ({
  page,
}) => {
  const records = Array.from({ length: 65 }, (_, index) =>
    syntheticMemory(1800 + index, `Synthetic scoped row ${index + 1}`, {
      project_ids: [1],
      importance: 7,
    }),
  )
  const log = await installApi(page, {
    memories: (url) => {
      const project = url.searchParams.get('project_id')
      const minimum = Number(url.searchParams.get('importance_min') ?? 0)
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const filtered = records.filter(
        (record) =>
          (project === null || record.project_ids?.includes(Number(project))) &&
          record.importance >= minimum,
      )
      return {
        body: {
          memories: filtered.slice(offset, offset + 20),
          total: filtered.length,
          limit: 20,
          offset,
        },
      }
    },
  })

  await page.goto('/#/memories?page=999&project=1&importance=7&order=asc')
  await expect(page.getByText('No memories on this page')).toBeVisible()
  const clear = page.getByRole('link', { name: 'Clear project filter' })
  await clear.click()

  await expect(
    page.getByRole('link', { name: 'Synthetic scoped row 1', exact: true }),
  ).toBeVisible()
  const last = log.filter((entry) => entry.url.pathname === '/api/v1/memories').at(-1)
  expect(last?.url.searchParams.get('offset')).toBe('0')
  expect(last?.url.searchParams.has('project_id')).toBe(false)
  expect(last?.url.searchParams.get('importance_min')).toBe('7')
  expect(last?.url.searchParams.get('sort_order')).toBe('asc')
  expect(await page.getByLabel('Project filter').inputValue()).toBe('')
  expect(await page.getByLabel('Minimum importance').inputValue()).toBe('7')
  await expect(page.getByRole('columnheader', { name: /Updated/ })).toHaveAttribute(
    'aria-sort',
    'ascending',
  )
  await expect(page).toHaveURL(/#\/memories\?order=asc&importance=7$/)
})

test('keeps sortable headers readable at the minimum list width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const records = Array.from({ length: 65 }, (_, index) =>
    syntheticMemory(1900 + index, `Synthetic header row ${index + 1}`, {
      project_ids: [1],
      importance: 7,
    }),
  )
  await installApi(page, {
    memories: (url) => {
      const offset = Number(url.searchParams.get('offset') ?? 0)
      return {
        body: {
          memories: records.slice(offset, offset + 20),
          total: records.length,
          limit: 20,
          offset,
        },
      }
    },
  })

  await page.goto('/#/memories')
  await page.getByRole('link', { name: 'Synthetic header row 1', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Expand detail' })).toBeVisible()
  const handle = page.getByRole('separator', { name: 'Resize memory detail' })
  await handle.focus()
  await page.keyboard.press('End')

  const table = page.getByRole('table', { name: 'Memories' })
  const importance = page.getByRole('button', { name: 'Importance', exact: true })
  const updated = page.getByRole('button', { name: 'Updated', exact: true })

  const assertHeaderFits = async () => {
    const tableBox = await table.boundingBox()
    const importanceBox = await importance.boundingBox()
    const updatedBox = await updated.boundingBox()
    if (!tableBox || !importanceBox || !updatedBox) throw new Error('Header box missing')
    expect(importanceBox.x).toBeGreaterThanOrEqual(tableBox.x - 1)
    expect(importanceBox.x + importanceBox.width).toBeLessThanOrEqual(updatedBox.x + 1)
    expect(updatedBox.x + updatedBox.width).toBeLessThanOrEqual(tableBox.x + tableBox.width + 1)
    expect(updatedBox.y).toBeLessThan(tableBox.y + tableBox.height)
  }

  const narrowTable = await table.boundingBox()
  if (!narrowTable) throw new Error('Table missing')
  expect(narrowTable.width).toBeLessThan(500)
  await assertHeaderFits()

  const importanceRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/memories' && url.searchParams.get('sort_by') === 'importance'
  })
  await importance.click()
  const importanceRequest = await importanceRequestPromise
  expect(new URL(importanceRequest.url()).searchParams.get('sort_by')).toBe('importance')

  await page.setViewportSize({ width: 1024, height: 900 })
  await page.waitForTimeout(200)
  await expect(updated).toBeVisible()
  await assertHeaderFits()
  const updatedRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/memories' && url.searchParams.get('sort_by') === 'updated_at'
  })
  await updated.click()
  const updatedRequest = await updatedRequestPromise
  expect(new URL(updatedRequest.url()).searchParams.get('sort_by')).toBe('updated_at')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(200)
  await expect(updated).toBeHidden()
  await expect(importance).toBeVisible()
  const mobileTable = await table.boundingBox()
  const mobileImportance = await importance.boundingBox()
  if (!mobileTable || !mobileImportance) throw new Error('Mobile header box missing')
  expect(mobileImportance.x + mobileImportance.width).toBeLessThanOrEqual(
    mobileTable.x + mobileTable.width + 1,
  )
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
})
