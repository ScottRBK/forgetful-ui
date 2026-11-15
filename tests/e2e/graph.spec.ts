import { expect, type Page, test } from '@playwright/test'

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

async function findCopperCentroid(page: Page): Promise<{
  width: number
  height: number
  x: number
  y: number
} | null> {
  return page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas context missing')
    const { width, height } = canvas
    const pixels = context.getImageData(0, 0, width, height).data
    let count = 0
    let sumX = 0
    let sumY = 0
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4
        const red = pixels[index] ?? 0
        const green = pixels[index + 1] ?? 0
        const blue = pixels[index + 2] ?? 0
        if (red > 180 && green > 120 && green < 190 && blue < 160) {
          count += 1
          sumX += x
          sumY += y
        }
      }
    }
    return count > 0 ? { width, height, x: sumX / count, y: sumY / count } : null
  })
}

async function measureInkBounds(page: Page): Promise<{ width: number; height: number }> {
  return page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas context missing')
    const { width, height } = canvas
    const pixels = context.getImageData(0, 0, width, height).data
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const index = (y * width + x) * 4
        const red = pixels[index] ?? 0
        const green = pixels[index + 1] ?? 0
        const blue = pixels[index + 2] ?? 0
        if (green > 150 && blue > 120 && green > red + 30) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    return maxX < 0 ? { width: 0, height: 0 } : { width: maxX - minX + 1, height: maxY - minY + 1 }
  })
}

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
      id: 'memory_102',
      type: 'memory',
      label: 'Synthetic neighbour memory',
      depth: 1,
      data: { importance: 4, tags: [] },
    },
    {
      id: 'project_7',
      type: 'project',
      label: 'Synthetic project',
      depth: 1,
      data: { name: 'Synthetic project', status: 'active' },
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
      id: 'memory_101_memory_102',
      source: 'memory_101',
      target: 'memory_102',
      type: 'memory_link',
      data: null,
    },
    {
      id: 'memory_101_entity_9',
      source: 'memory_101',
      target: 'entity_9',
      type: 'entity_memory',
      data: null,
    },
    {
      id: 'dangling-edge',
      source: 'memory_101',
      target: 'memory_999',
      type: 'memory_link',
      data: null,
    },
  ],
  meta: {
    center_node_id: 'memory_101',
    depth: 1,
    node_types: ['memory', 'project'],
    max_nodes: 100,
    memory_count: 2,
    entity_count: 0,
    project_count: 1,
    document_count: 0,
    code_artifact_count: 0,
    file_count: 0,
    edge_count: 1,
    memory_link_count: 1,
    entity_relationship_count: 0,
    entity_memory_count: 0,
    entity_project_count: 0,
    memory_project_count: 0,
    document_project_count: 0,
    code_artifact_project_count: 0,
    memory_document_count: 0,
    memory_code_artifact_count: 0,
    memory_file_count: 0,
    file_project_count: 0,
    entity_file_count: 0,
    skill_count: 0,
    memory_skill_count: 0,
    skill_project_count: 0,
    skill_file_count: 0,
    skill_code_artifact_count: 0,
    skill_document_count: 0,
    plan_count: 0,
    task_count: 0,
    plan_project_count: 0,
    plan_task_count: 0,
    truncated: false,
  },
}

test('opens a selected memory graph, shows a real canvas and node details', async ({ page }) => {
  const requests: { url: string; method: string }[] = []
  page.on('request', (request) => {
    requests.push({ url: request.url(), method: request.method() })
  })

  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/projects') {
      await route.fulfill(json({ projects: [{ id: 7, name: 'Synthetic project' }], total: 1 }))
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
    if (url.pathname === '/api/v1/projects/7') {
      await route.fulfill(
        json({
          id: 7,
          name: 'Synthetic project',
          description: 'Synthetic project detail.',
          status: 'active',
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/memories')
  await page.getByRole('link', { name: 'Synthetic graph memory' }).click()
  await expect(page.getByRole('heading', { name: 'Synthetic graph memory' })).toBeVisible()
  await page.getByRole('link', { name: 'Open graph' }).click()

  await expect(page).toHaveURL(/#\/graph\?memory=101/)
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByRole('button', { name: /Synthetic project/ })).toBeVisible()
  await expect(
    page.getByText(/1 edge hidden because an endpoint is outside this view/),
  ).toBeVisible()

  await page.getByRole('button', { name: /Synthetic project/ }).click()
  await expect(page.getByText('Project detail', { exact: true })).toBeVisible()
  await expect(page.getByText('Synthetic project detail.')).toBeVisible()

  await page.getByRole('button', { name: /Synthetic entity/ }).click()
  await expect(page.getByText('Entity detail', { exact: true })).toBeVisible()
  await expect(page.getByText('Synthetic entity notes.')).toBeVisible()

  await page.getByRole('link', { name: 'Depth 2' }).click()
  await expect(page).toHaveURL(/depth=2/)
  await expect(page.locator('canvas')).toBeVisible()

  const graphRequests = requests.filter((request) => request.url.includes('/api/v1/graph/subgraph'))
  expect(graphRequests.at(-1)?.url).toContain('node_id=memory_101')
  expect(graphRequests.at(-1)?.url).toContain('depth=2')
  expect(graphRequests.at(-1)?.url).toContain('max_nodes=100')
  expect(graphRequests.at(-1)?.url).not.toContain('node_types=')
  expect(requests.every((request) => request.method === 'GET')).toBe(true)
})

test('directs the user to a memory without fetching a graph', async ({ page }) => {
  const graphRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/graph')) graphRequests.push(request.url())
  })

  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/auth/info', (route) =>
    route.fulfill(json({ authEnabled: false, authMode: 'disabled' })),
  )

  await page.goto('/#/graph')
  await expect(page.getByText('Choose a memory to explore')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Browse memories' })).toHaveAttribute(
    'href',
    '#/memories',
  )
  expect(graphRequests).toEqual([])
})

test('marks a truncated graph and filters dangling edges', async ({ page }) => {
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/memories/101') {
      await route.fulfill(json(memory))
      return
    }
    if (url.pathname === '/api/v1/graph/subgraph') {
      await route.fulfill(
        json({
          ...subgraph,
          meta: { ...subgraph.meta, truncated: true },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph?memory=101')
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByText(/node limit was reached/)).toBeVisible()
  await expect(
    page.getByText(/1 edge hidden because an endpoint is outside this view/),
  ).toBeVisible()
})

test('stops a pending graph request when the screen is left', async ({ page }) => {
  let releaseGraph: (() => void) | undefined
  const graphGate = new Promise<void>((resolve) => {
    releaseGraph = resolve
  })

  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/memories/101') {
      await route.fulfill(json(memory))
      return
    }
    if (url.pathname === '/api/v1/graph/subgraph') {
      await graphGate
      await route.fulfill(json(subgraph)).catch(() => undefined)
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph?memory=101')
  await expect(page.getByRole('link', { name: 'Back to memory' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to memory' }).click()
  await expect(page.getByRole('heading', { name: 'Synthetic graph memory' })).toBeVisible()

  releaseGraph?.()
  await page.waitForTimeout(400)

  await expect(page.getByRole('heading', { name: 'Synthetic graph memory' })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
})

test('renders hover tooltip labels as literal text, not HTML', async ({ page }) => {
  const title = '<b data-tooltip-probe="literal">Synthetic literal title</b>'
  const singleMemory = {
    ...memory,
    id: 99001,
    title,
    content: 'Synthetic content only.',
  }

  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/memories/99001') {
      await route.fulfill(json(singleMemory))
      return
    }
    if (url.pathname === '/api/v1/graph/subgraph') {
      await route.fulfill(
        json({
          nodes: [
            {
              id: 'memory_99001',
              type: 'memory',
              label: title,
              depth: 0,
              data: { importance: 5 },
            },
          ],
          edges: [],
          meta: {
            center_node_id: 'memory_99001',
            depth: 1,
            node_types: ['memory'],
            max_nodes: 100,
            edge_count: 0,
            truncated: false,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph?memory=99001')
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await page.waitForTimeout(800)

  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('Canvas has no box')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

  const tooltip = page.locator('.float-tooltip-kap')
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toHaveText(`${title} · memory`)
  await expect(tooltip.locator('b[data-tooltip-probe="literal"]')).toHaveCount(0)
})

test('spreads the initial graph layout instead of stacking nodes at the centre', async ({
  page,
}) => {
  const nodeCount = 6
  const graphNodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: `memory_${98000 + index}`,
    type: 'memory',
    label: `Synthetic spread node ${index}`,
    depth: index === 0 ? 0 : 1,
    data: { importance: 5 },
  }))
  const graphEdges = graphNodes.slice(1).map((node, index) => ({
    id: `spread-edge-${index}`,
    source: 'memory_98000',
    target: node.id,
    type: 'memory_link',
    data: null,
  }))

  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/memories/98000') {
      await route.fulfill(json(memory))
      return
    }
    if (url.pathname === '/api/v1/graph/subgraph') {
      await route.fulfill(
        json({
          nodes: graphNodes,
          edges: graphEdges,
          meta: {
            center_node_id: 'memory_98000',
            depth: 1,
            node_types: ['memory'],
            max_nodes: 100,
            edge_count: graphEdges.length,
            truncated: false,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph?memory=98000')
  await expect(page.locator('canvas')).toBeVisible()
  await page.waitForTimeout(1800)
  const bounds = await measureInkBounds(page)

  expect(bounds.width).toBeGreaterThan(220)
  expect(bounds.height).toBeGreaterThan(250)
})

test('preserves the camera when a node is dragged after zooming', async ({ page }) => {
  const original = memory
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/memories/101') {
      await route.fulfill(json(original))
      return
    }
    if (url.pathname === '/api/v1/graph/subgraph') {
      await route.fulfill(
        json({
          nodes: [
            {
              id: 'memory_101',
              type: 'memory',
              label: 'Synthetic camera node',
              depth: 0,
              data: { importance: 5 },
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
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph?memory=101')
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(1500)
  const initial = await measureInkBounds(page)

  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas has no box')
  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2

  await page.mouse.move(centerX, centerY)
  await page.mouse.wheel(0, -1000)
  await page.waitForTimeout(400)
  const zoomed = await measureInkBounds(page)
  expect(zoomed.width).toBeGreaterThan(initial.width * 1.25)

  await page.mouse.move(centerX, centerY)
  await page.mouse.down()
  await page.mouse.move(centerX + 100, centerY, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(2600)
  const afterDrag = await measureInkBounds(page)

  expect(afterDrag.width).toBeGreaterThan(initial.width * 1.25)
})

test('shows real plan goal/context and task state/description fields', async ({ page }) => {
  const nodes = [
    {
      id: 'memory_101',
      type: 'memory',
      label: 'Synthetic planning memory',
      depth: 0,
      data: { importance: 5 },
    },
    {
      id: 'project_7',
      type: 'project',
      label: 'Synthetic planning project',
      depth: 1,
      data: { name: 'Synthetic planning project', status: 'active' },
    },
    {
      id: 'plan_55',
      type: 'plan',
      label: 'Synthetic plan',
      depth: 1,
      data: { title: 'Synthetic plan', status: 'active' },
    },
    {
      id: 'task_66',
      type: 'task',
      label: 'Synthetic task',
      depth: 2,
      data: { title: 'Synthetic task', state: 'doing' },
    },
  ]
  const edges = [
    {
      id: 'memory-project',
      source: 'memory_101',
      target: 'project_7',
      type: 'memory_project',
      data: null,
    },
    {
      id: 'plan-project',
      source: 'plan_55',
      target: 'project_7',
      type: 'plan_project',
      data: null,
    },
    {
      id: 'plan-task',
      source: 'plan_55',
      target: 'task_66',
      type: 'plan_task',
      data: null,
    },
  ]

  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/memories/101') {
      await route.fulfill(json(memory))
      return
    }
    if (url.pathname === '/api/v1/graph/subgraph') {
      await route.fulfill(
        json({
          nodes,
          edges,
          meta: {
            center_node_id: 'memory_101',
            depth: 2,
            node_types: ['memory', 'project', 'plan', 'task'],
            max_nodes: 100,
            edge_count: edges.length,
            truncated: false,
          },
        }),
      )
      return
    }
    if (url.pathname === '/api/v1/plans/55') {
      await route.fulfill(
        json({
          id: 55,
          title: 'Synthetic plan',
          project_id: 7,
          goal: 'Synthetic plan goal.',
          context: 'Synthetic plan context.',
          status: 'active',
          external_ref: null,
          task_count: 1,
        }),
      )
      return
    }
    if (url.pathname === '/api/v1/tasks/66') {
      await route.fulfill(
        json({
          id: 66,
          plan_id: 55,
          title: 'Synthetic task',
          description: 'Synthetic task description.',
          state: 'doing',
          priority: 'P1',
          assigned_agent: null,
          version: 2,
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph?memory=101&depth=2')
  await expect(page.locator('canvas')).toBeVisible()
  await page.getByRole('button', { name: 'Synthetic plan Plan · d1' }).click()
  await expect(page.getByText('Plan detail', { exact: true })).toBeVisible()
  await expect(page.getByText('Synthetic plan goal.')).toBeVisible()
  await expect(page.getByText('Synthetic plan context.')).toBeVisible()

  await page.getByRole('button', { name: 'Synthetic task Task · d2' }).click()
  await expect(page.getByText('Task detail', { exact: true })).toBeVisible()
  await expect(page.getByText('Synthetic task description.')).toBeVisible()
  await expect(page.getByText('doing', { exact: true })).toBeVisible()
})

test('selects a visible canvas node by clicking it', async ({ page }) => {
  const center = {
    ...memory,
    id: 1301,
    title: 'Synthetic canvas center',
    content: 'Center detail.',
  }
  const entity = {
    id: 9,
    name: 'Synthetic canvas entity',
    entity_type: 'System',
    notes: 'Synthetic entity detail.',
  }

  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/memories/1301') {
      await route.fulfill(json(center))
      return
    }
    if (url.pathname === '/api/v1/entities/9') {
      await route.fulfill(json(entity))
      return
    }
    if (url.pathname === '/api/v1/graph/subgraph') {
      await route.fulfill(
        json({
          nodes: [
            {
              id: 'memory_1301',
              type: 'memory',
              label: center.title,
              depth: 0,
              data: { importance: 5 },
            },
            {
              id: 'entity_9',
              type: 'entity',
              label: entity.name,
              depth: 1,
              data: { name: entity.name, entity_type: entity.entity_type },
            },
          ],
          edges: [
            {
              id: 'canvas-edge',
              source: 'memory_1301',
              target: 'entity_9',
              type: 'entity_memory',
              data: null,
            },
          ],
          meta: {
            center_node_id: 'memory_1301',
            depth: 1,
            node_types: ['memory', 'entity'],
            max_nodes: 100,
            edge_count: 1,
            truncated: false,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  const canvas = page.locator('canvas')
  await page.goto('/#/graph?memory=1301')
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(2000)
  const target = await findCopperCentroid(page)
  const box = await canvas.boundingBox()
  if (!box || !target) throw new Error('Canvas entity node not found')

  const clickX = box.x + (target.x * box.width) / target.width
  const clickY = box.y + (target.y * box.height) / target.height
  await page.mouse.move(clickX, clickY)
  await page.waitForTimeout(120)
  await page.mouse.down()
  await page.mouse.up()

  await expect(page.getByRole('heading', { name: 'Synthetic canvas entity' })).toBeVisible()
  await expect(page.getByText('Synthetic entity detail.')).toBeVisible()
})

test('shows a graph API failure and retries successfully', async ({ page }) => {
  let attempts = 0
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/memories/101') {
      await route.fulfill(json(memory))
      return
    }
    if (url.pathname === '/api/v1/graph/subgraph') {
      attempts += 1
      if (attempts === 1) {
        await route.fulfill(json({ error: 'Synthetic graph failure' }, 500))
        return
      }
      await route.fulfill(
        json({
          nodes: [
            {
              id: 'memory_101',
              type: 'memory',
              label: 'Synthetic graph retry',
              depth: 0,
              data: { importance: 5 },
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
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph?memory=101')
  await expect(page.getByRole('alert')).toContainText('Could not load graph')
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.locator('canvas')).toBeVisible()
  expect(attempts).toBe(2)
})

test('ignores a late node-detail response for an earlier selection', async ({ page }) => {
  let releaseCenter: (() => void) | undefined
  const centerGate = new Promise<void>((resolve) => {
    releaseCenter = resolve
  })
  const center = {
    ...memory,
    id: 1401,
    title: 'Synthetic late center',
    content: 'Late center content.',
  }
  const neighbour = {
    ...memory,
    id: 1402,
    title: 'Synthetic late neighbour',
    content: 'Late neighbour content.',
  }

  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/memories/1401') {
      await centerGate
      await route.fulfill(json(center)).catch(() => undefined)
      return
    }
    if (url.pathname === '/api/v1/memories/1402') {
      await route.fulfill(json(neighbour))
      return
    }
    if (url.pathname === '/api/v1/graph/subgraph') {
      await route.fulfill(
        json({
          nodes: [
            {
              id: 'memory_1401',
              type: 'memory',
              label: center.title,
              depth: 0,
              data: { importance: 5 },
            },
            {
              id: 'memory_1402',
              type: 'memory',
              label: neighbour.title,
              depth: 1,
              data: { importance: 5 },
            },
          ],
          edges: [],
          meta: {
            center_node_id: 'memory_1401',
            depth: 1,
            node_types: ['memory'],
            max_nodes: 100,
            edge_count: 0,
            truncated: false,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph?memory=1401')
  await expect(page.locator('canvas')).toBeVisible()
  await page.getByRole('button', { name: 'Synthetic late neighbour Memory · d1' }).click()
  await expect(page.getByRole('heading', { name: 'Synthetic late neighbour' })).toBeVisible()

  releaseCenter?.()
  await page.waitForTimeout(400)

  await expect(page.getByRole('heading', { name: 'Synthetic late neighbour' })).toBeVisible()
  await expect(page.getByText('Late center content.')).toHaveCount(0)
})
