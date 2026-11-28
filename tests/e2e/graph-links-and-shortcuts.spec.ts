import { expect, test } from '@playwright/test'

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

const memory = {
  id: 101,
  title: 'Synthetic graph memory',
  content: 'Synthetic content used by the browser workflow test.',
  context: null,
  keywords: ['synthetic'],
  tags: ['fixture'],
  importance: 7,
  created_at: '2026-01-02T10:00:00Z',
  updated_at: '2026-01-03T11:00:00Z',
  project_ids: [7],
  linked_memory_ids: [102],
  source_repo: null,
  source_files: [],
  source_url: null,
  confidence: null,
  encoding_agent: null,
  encoding_version: null,
  is_obsolete: false,
  access_count: 0,
  last_accessed_at: null,
}

const subgraph = {
  nodes: [
    {
      id: 'memory_101',
      type: 'memory',
      label: 'Synthetic graph memory',
      depth: 0,
      data: { importance: 7, tags: ['fixture'] },
    },
    {
      id: 'entity_9',
      type: 'entity',
      label: 'Synthetic entity',
      depth: 1,
      data: { name: 'Synthetic entity', entity_type: 'System' },
    },
  ],
  edges: [
    {
      id: 'memory_101_entity_9',
      source: 'memory_101',
      target: 'entity_9',
      type: 'entity_memory',
      data: null,
    },
  ],
  meta: {
    center_node_id: 'memory_101',
    depth: 1,
    node_types: ['memory', 'entity'],
    max_nodes: 100,
    memory_count: 1,
    entity_count: 1,
    project_count: 0,
    document_count: 0,
    code_artifact_count: 0,
    file_count: 0,
    skill_count: 0,
    plan_count: 0,
    task_count: 0,
    edge_count: 1,
    truncated: false,
  },
}

async function installReadOnlyApi(page: import('@playwright/test').Page) {
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/.well-known', (route) =>
    route.fulfill(
      json({
        schema_version: 1,
        capabilities: { planning: true, skills: true, files: true, activity_stream: false },
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
      await route.fulfill(json({ projects: [], total: 0, limit: 20, offset: 0 }))
      return
    }
    if (url.pathname === '/api/v1/memories/101') {
      await route.fulfill(json(memory))
      return
    }
    if (url.pathname === '/api/v1/memories') {
      await route.fulfill(json({ memories: [memory], total: 1, limit: 20, offset: 0 }))
      return
    }
    if (url.pathname === '/api/v1/graph/subgraph') {
      await route.fulfill(json(subgraph))
      return
    }
    if (url.pathname === '/api/v1/entities/9') {
      await route.fulfill(
        json({
          id: 9,
          name: 'Synthetic entity',
          entity_type: 'System',
          notes: 'Synthetic entity notes.',
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'Unexpected test request' }, 500))
  })
}

test('graph entity cross-link navigates to Entities', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.method()))
  await installReadOnlyApi(page)

  await page.goto('/#/graph?memory=101')
  await page.getByRole('button', { name: /Synthetic entity/ }).click()
  await expect(page.getByRole('link', { name: 'Open in Entities' })).toHaveAttribute(
    'href',
    '#/entities/9',
  )
  await page.getByRole('link', { name: 'Open in Entities' }).click()
  await expect(page).toHaveURL(/#\/entities\/9$/)
  expect(requests.every((method) => method === 'GET')).toBe(true)
})

test('Escape closes graph node detail and / focuses memory search', async ({ page }) => {
  await installReadOnlyApi(page)

  await page.goto('/#/graph?memory=101')
  await page.getByRole('button', { name: /Synthetic entity/ }).click()
  await expect(page.getByText('Entity detail', { exact: true })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByText('Select a node to inspect its record.')).toBeVisible()

  await page.goto('/#/memories')
  await expect(page.getByLabel('Search memories')).toBeVisible()
  await page.locator('body').click()
  await page.keyboard.press('/')
  await expect(page.getByLabel('Search memories')).toBeFocused()
})
