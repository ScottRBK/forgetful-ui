import { expect, type Page, test } from '@playwright/test'

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

type CopperCentroid = {
  width: number
  height: number
  x: number
  y: number
}

async function findCopperCentroid(page: Page): Promise<CopperCentroid | null> {
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

async function findMemoryCentroid(page: Page): Promise<CopperCentroid | null> {
  return page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas context missing')
    const { width, height } = canvas
    const pixels = context.getImageData(0, 0, width, height).data
    let count = 0
    let sumX = 0
    let sumY = 0
    for (let offset = 0; offset < pixels.length; offset += 4) {
      const red = pixels[offset] ?? 0
      const green = pixels[offset + 1] ?? 0
      const blue = pixels[offset + 2] ?? 0
      if (Math.abs(red - 94) < 3 && Math.abs(green - 234) < 3 && Math.abs(blue - 212) < 3) {
        count += 1
        const pixel = offset / 4
        sumX += pixel % width
        sumY += Math.floor(pixel / width)
      }
    }
    return count > 0 ? { width, height, x: sumX / count, y: sumY / count } : null
  })
}

async function findStableMemoryCentroid(page: Page): Promise<CopperCentroid> {
  let previous: CopperCentroid | null = null
  let stable: CopperCentroid | null = null
  let stableSamples = 0
  await expect
    .poll(
      async () => {
        const current = await findMemoryCentroid(page)
        const unchanged =
          current &&
          previous &&
          current.width === previous.width &&
          current.height === previous.height &&
          Math.abs(current.x - previous.x) <= 0.5 &&
          Math.abs(current.y - previous.y) <= 0.5
        stableSamples = unchanged ? stableSamples + 1 : 0
        stable = stableSamples >= 8 ? current : null
        previous = current
        return stable !== null
      },
      { timeout: 10_000, intervals: [250] },
    )
    .toBe(true)
  if (!stable) throw new Error('Canvas memory node did not stabilise')
  return stable
}

async function maxGreenNear(page: Page, x: number, y: number): Promise<number> {
  return page.locator('canvas').evaluate(
    (canvas: HTMLCanvasElement, point) => {
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas context missing')
      const { width, height } = canvas
      const pixels = context.getImageData(0, 0, width, height).data
      let maximum = 0
      for (let dx = -4; dx <= 4; dx += 1) {
        for (let dy = -4; dy <= 4; dy += 1) {
          const px = Math.round(point.x + dx)
          const py = Math.round(point.y + dy)
          if (px < 0 || py < 0 || px >= width || py >= height) continue
          maximum = Math.max(maximum, pixels[(py * width + px) * 4 + 1] ?? 0)
        }
      }
      return maximum
    },
    { x, y },
  )
}

async function lineWarmPixels(
  page: Page,
  first: CopperCentroid,
  second: CopperCentroid,
): Promise<number> {
  return page.locator('canvas').evaluate(
    (canvas: HTMLCanvasElement, endpoints) => {
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas context missing')
      const { width, height } = canvas
      const pixels = context.getImageData(0, 0, width, height).data
      const seen = new Set<number>()
      for (let step = 0; step <= 100; step += 1) {
        const t = 0.3 + step * 0.004
        const x = Math.round(endpoints.first.x * (1 - t) + endpoints.second.x * t)
        const y = Math.round(endpoints.first.y * (1 - t) + endpoints.second.y * t)
        for (let dx = -2; dx <= 2; dx += 1) {
          for (let dy = -2; dy <= 2; dy += 1) {
            if (x + dx < 0 || y + dy < 0 || x + dx >= width || y + dy >= height) continue
            seen.add(((y + dy) * width + x + dx) * 4)
          }
        }
      }
      let warm = 0
      for (const offset of seen) {
        const red = pixels[offset] ?? 0
        const green = pixels[offset + 1] ?? 0
        const blue = pixels[offset + 2] ?? 0
        if (red > 140 && red > green && red > blue * 1.12) warm += 1
      }
      return warm
    },
    { first, second },
  )
}

async function findProjectCentroid(page: Page): Promise<CopperCentroid | null> {
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
        if (red >= 100 && red <= 150 && green >= 145 && green <= 195 && blue >= 190) {
          count += 1
          sumX += x
          sumY += y
        }
      }
    }
    return count > 0 ? { width, height, x: sumX / count, y: sumY / count } : null
  })
}

async function findStableProjectCentroid(page: Page): Promise<CopperCentroid> {
  let previous: CopperCentroid | null = null
  let stable: CopperCentroid | null = null
  let stableSamples = 0
  await expect
    .poll(
      async () => {
        const current = await findProjectCentroid(page)
        const unchanged =
          current &&
          previous &&
          current.width === previous.width &&
          current.height === previous.height &&
          Math.abs(current.x - previous.x) <= 0.5 &&
          Math.abs(current.y - previous.y) <= 0.5
        stableSamples = unchanged ? stableSamples + 1 : 0
        stable = stableSamples >= 8 ? current : null
        previous = current
        return stable !== null
      },
      { timeout: 10_000, intervals: [250] },
    )
    .toBe(true)
  if (!stable) throw new Error('Canvas project node did not stabilise')
  return stable
}

async function findStableCopperCentroid(page: Page): Promise<CopperCentroid> {
  let previous: CopperCentroid | null = null
  let stable: CopperCentroid | null = null
  let stableSamples = 0
  await expect
    .poll(
      async () => {
        const current = await findCopperCentroid(page)
        const unchanged =
          current &&
          previous &&
          current.width === previous.width &&
          current.height === previous.height &&
          Math.abs(current.x - previous.x) <= 0.5 &&
          Math.abs(current.y - previous.y) <= 0.5
        stableSamples = unchanged ? stableSamples + 1 : 0
        stable = stableSamples >= 4 ? current : null
        previous = current
        return stable !== null
      },
      { timeout: 10_000, intervals: [250] },
    )
    .toBe(true)
  if (!stable) throw new Error('Canvas entity node did not stabilise')
  return stable
}

async function measureInkBox(page: Page): Promise<{
  width: number
  height: number
  minX: number
  minY: number
  maxX: number
  maxY: number
  canvasWidth: number
  canvasHeight: number
}> {
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
    return {
      width: maxX < 0 ? 0 : maxX - minX + 1,
      height: maxY < 0 ? 0 : maxY - minY + 1,
      minX,
      minY,
      maxX,
      maxY,
      canvasWidth: width,
      canvasHeight: height,
    }
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

test.beforeEach(async ({ page }) => {
  await page.route('**/.well-known', (route) =>
    route.fulfill(
      json({
        schema_version: 1,
        capabilities: { planning: true, skills: true, files: true, activity_stream: false },
      }),
    ),
  )
})

test('bare graph loads a paginated memory and project overview', async ({ page }) => {
  const requests: URL[] = []
  const project = {
    id: 'project_7',
    type: 'project',
    label: 'Synthetic overview project',
    data: { id: 7, name: 'Synthetic overview project', status: 'active' },
  }
  const memoryNode = (id: number, title: string) => ({
    id: `memory_${id}`,
    type: 'memory',
    label: title,
    data: { id, title, importance: 5, tags: [] },
  })
  const pages = [
    {
      nodes: [
        memoryNode(1, 'Synthetic overview memory one'),
        memoryNode(2, 'Synthetic overview memory two'),
        project,
      ],
      edges: [
        {
          id: 'memory_1_memory_2',
          source: 'memory_1',
          target: 'memory_2',
          type: 'memory_link',
        },
        {
          id: 'memory_1_project_7',
          source: 'memory_1',
          target: 'project_7',
          type: 'memory_project',
        },
        {
          id: 'dangling-overview-edge',
          source: 'memory_1',
          target: 'memory_999',
          type: 'memory_link',
        },
      ],
      meta: {
        memory_count: 2,
        total_memory_count: 3,
        offset: 0,
        limit: 2,
        has_more: true,
        project_count: 1,
        entity_count: 0,
        document_count: 0,
        code_artifact_count: 0,
        file_count: 0,
        skill_count: 0,
        plan_count: 0,
        task_count: 0,
        edge_count: 2,
      },
    },
    {
      nodes: [memoryNode(3, 'Synthetic overview memory three'), project],
      edges: [
        {
          id: 'memory_3_project_7',
          source: 'memory_3',
          target: 'project_7',
          type: 'memory_project',
        },
        {
          id: 'memory_1_project_7',
          source: 'memory_1',
          target: 'project_7',
          type: 'memory_project',
        },
      ],
      meta: {
        memory_count: 1,
        total_memory_count: 3,
        offset: 2,
        limit: 2,
        has_more: false,
        project_count: 1,
        entity_count: 0,
        document_count: 0,
        code_artifact_count: 0,
        file_count: 0,
        skill_count: 0,
        plan_count: 0,
        task_count: 0,
        edge_count: 1,
      },
    },
  ]

  let releasePageTwo: (() => void) | undefined
  const pageTwoGate = new Promise<void>((resolve) => {
    releasePageTwo = resolve
  })
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
    requests.push(url)
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      const offset = Number(url.searchParams.get('offset') ?? 0)
      if (offset === 2) await pageTwoGate
      const pageData = pages.find((candidate) => candidate.meta.offset === offset)
      await route.fulfill(json(pageData ?? { error: 'unexpected offset' }))
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph')
  await expect(page.getByRole('heading', { name: 'Graph overview' })).toBeVisible()
  await expect(page.getByText(/Loaded 2 of 3 memories/).first()).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
  releasePageTwo?.()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect(
    page.getByText(
      'Some connections between memories may be missing until Forgetful #221 is fixed.',
    ),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /Synthetic overview project/ })).toBeVisible()
  await expect(page.getByLabel('Include Entity')).not.toBeChecked()
  await expect(page.getByLabel('Include File')).not.toBeChecked()
  await expect(page.getByText(/^3 memories ·/)).toBeVisible()
  await expect(page.getByText(/1 project/)).toBeVisible()
  await expect(page.getByText(/3 edges/)).toBeVisible()
  await expect(page.getByText(/4 nodes/)).toBeVisible()

  const overviewRequests = requests.filter((url) => url.pathname === '/api/v1/graph')
  expect(overviewRequests.map((url) => url.searchParams.get('offset'))).toEqual(['0', '2'])
  for (const url of overviewRequests) {
    expect(url.searchParams.get('node_types')).toBe('memory,project')
    expect(url.searchParams.get('limit')).toBe('100')
    expect(url.searchParams.get('sort_by')).toBe('created_at')
    expect(url.searchParams.get('sort_order')).toBe('asc')
  }
  expect(requests.some((url) => url.pathname === '/api/v1/memories')).toBe(false)
  expect(requests.some((url) => url.pathname.startsWith('/api/v1/memories/'))).toBe(false)
  expect(requests.some((url) => url.pathname === '/api/v1/graph/subgraph')).toBe(false)
})

test('optional graph types load only when selected', async ({ page }) => {
  const requests: URL[] = []
  const nodes = [
    { id: 'memory_1', type: 'memory', label: 'Synthetic optional memory', data: { id: 1 } },
    { id: 'project_7', type: 'project', label: 'Synthetic optional project', data: { id: 7 } },
    { id: 'entity_9', type: 'entity', label: 'Synthetic optional entity', data: { id: 9 } },
    { id: 'document_3', type: 'document', label: 'Synthetic optional document', data: { id: 3 } },
    { id: 'code_artifact_4', type: 'code_artifact', label: 'Synthetic code', data: { id: 4 } },
    { id: 'file_5', type: 'file', label: 'synthetic-file.txt', data: { id: 5 } },
    { id: 'skill_6', type: 'skill', label: 'synthetic-skill', data: { id: 6 } },
    { id: 'plan_8', type: 'plan', label: 'Synthetic plan', data: { id: 8 } },
    { id: 'task_10', type: 'task', label: 'Synthetic task', data: { id: 10 } },
  ]
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes,
          edges: [],
          meta: {
            memory_count: 1,
            total_memory_count: 1,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 1,
            project_count: 1,
            document_count: 1,
            code_artifact_count: 1,
            file_count: 1,
            skill_count: 1,
            plan_count: 1,
            task_count: 1,
            edge_count: 0,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto(
    '/#/graph?types=memory,project,entity,document,code_artifact,file,skill,plan,task',
  )
  await expect(page.getByRole('heading', { name: 'Graph overview' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  for (const type of ['Entity', 'Document', 'Code artifact', 'File', 'Skill', 'Plan', 'Task']) {
    await expect(page.getByLabel(`Include ${type}`)).toBeChecked()
  }
  expect(requests.filter((url) => url.pathname === '/api/v1/graph')).toHaveLength(1)
  expect(
    requests.find((url) => url.pathname === '/api/v1/graph')?.searchParams.get('node_types'),
  ).toBe('memory,project,entity,document,code_artifact,file,skill,plan,task')
  expect(requests.some((url) => url.pathname.startsWith('/api/v1/entities/'))).toBe(false)
  expect(requests.some((url) => url.pathname.startsWith('/api/v1/plans/'))).toBe(false)
})

test('entity cap warning survives project scoping with no matching entities', async ({ page }) => {
  const entities = Array.from({ length: 10_000 }, (_, index) => ({
    id: `entity_${1000 + index}`,
    type: 'entity',
    label: `Contract entity ${index}`,
    data: { id: 1000 + index, name: `Contract entity ${index}`, entity_type: 'System' },
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
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes: [
            { id: 'project_1', type: 'project', label: 'Foreign project', data: { id: 1 } },
            { id: 'project_2', type: 'project', label: 'Scoped project', data: { id: 2 } },
            ...entities,
          ],
          edges: [],
          meta: {
            memory_count: 0,
            total_memory_count: 0,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 10000,
            project_count: 2,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 0,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph?project=2&types=entity')
  await expect(page.getByRole('heading', { name: 'Graph overview' })).toBeVisible()
  await expect(page.getByText(/Entity results are capped at 10,000 by the API/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Scoped project/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Contract entity 0/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Foreign project/ })).toHaveCount(0)
})

test('plan and entity colours are distinct on the canvas and node list', async ({ page }) => {
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes: [
            { id: 'memory_1', type: 'memory', label: 'Colour memory', data: { id: 1 } },
            { id: 'project_7', type: 'project', label: 'Colour project', data: { id: 7 } },
            { id: 'entity_9', type: 'entity', label: 'Colour entity', data: { id: 9 } },
            { id: 'plan_8', type: 'plan', label: 'Colour plan', data: { id: 8 } },
          ],
          edges: [],
          meta: {
            memory_count: 1,
            total_memory_count: 1,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 1,
            project_count: 1,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 1,
            task_count: 0,
            edge_count: 0,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph?types=memory,project,entity,plan')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-graph-engine]')).toHaveAttribute(
    'data-graph-engine',
    'stopped',
    {
      timeout: 15_000,
    },
  )
  const colours = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas context missing')
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    const count = (red: number, green: number, blue: number): number => {
      let matches = 0
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (
          Math.abs((pixels[offset] ?? 0) - red) < 3 &&
          Math.abs((pixels[offset + 1] ?? 0) - green) < 3 &&
          Math.abs((pixels[offset + 2] ?? 0) - blue) < 3
        ) {
          matches += 1
        }
      }
      return matches
    }
    return {
      plan: count(232, 121, 249),
      entity: count(215, 164, 124),
    }
  })
  expect(colours.plan).toBeGreaterThan(0)
  expect(colours.entity).toBeGreaterThan(0)

  const planButton = page.getByRole('button', { name: /Colour plan/ })
  const entityButton = page.getByRole('button', { name: /Colour entity/ })
  await expect(planButton.locator('span').first()).toHaveCSS(
    'background-color',
    'rgb(232, 121, 249)',
  )
  await expect(entityButton.locator('span').first()).toHaveCSS(
    'background-color',
    'rgb(215, 164, 124)',
  )
})

test('focused graph uses the same plan and entity colours', async ({ page }) => {
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/memories/1') {
      await route.fulfill(json({ id: 1, title: 'Focused colour memory', content: 'Focused.' }))
      return
    }
    if (url.pathname === '/api/v1/graph/subgraph') {
      await route.fulfill(
        json({
          nodes: [
            {
              id: 'memory_1',
              type: 'memory',
              label: 'Focused colour memory',
              depth: 0,
              data: { importance: 5 },
            },
            {
              id: 'entity_9',
              type: 'entity',
              label: 'Focused colour entity',
              depth: 1,
              data: { name: 'Focused colour entity' },
            },
            {
              id: 'plan_8',
              type: 'plan',
              label: 'Focused colour plan',
              depth: 1,
              data: { title: 'Focused colour plan' },
            },
          ],
          edges: [],
          meta: {
            center_node_id: 'memory_1',
            depth: 1,
            node_types: ['memory', 'entity', 'plan'],
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

  await page.goto('/#/graph?memory=1')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-graph-engine]')).toHaveAttribute(
    'data-graph-engine',
    'stopped',
    {
      timeout: 15_000,
    },
  )
  const colours = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas context missing')
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    const count = (red: number, green: number, blue: number): number => {
      let matches = 0
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (
          Math.abs((pixels[offset] ?? 0) - red) < 3 &&
          Math.abs((pixels[offset + 1] ?? 0) - green) < 3 &&
          Math.abs((pixels[offset + 2] ?? 0) - blue) < 3
        ) {
          matches += 1
        }
      }
      return matches
    }
    return { plan: count(232, 121, 249), entity: count(215, 164, 124) }
  })
  expect(colours.plan).toBeGreaterThan(0)
  expect(colours.entity).toBeGreaterThan(0)
  await expect(
    page
      .getByRole('button', { name: /Focused colour plan/ })
      .locator('span')
      .first(),
  ).toHaveCSS('background-color', 'rgb(232, 121, 249)')
  await expect(
    page
      .getByRole('button', { name: /Focused colour entity/ })
      .locator('span')
      .first(),
  ).toHaveCSS('background-color', 'rgb(215, 164, 124)')
})

test('disabled graph capabilities exclude optional node types from requests', async ({ page }) => {
  const requests: URL[] = []
  await page.route('**/.well-known', (route) =>
    route.fulfill(
      json({
        schema_version: 1,
        capabilities: { planning: false, skills: false, files: false, activity_stream: false },
      }),
    ),
  )
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes: [
            { id: 'project_7', type: 'project', label: 'Synthetic project', data: { id: 7 } },
            { id: 'entity_9', type: 'entity', label: 'Synthetic entity', data: { id: 9 } },
          ],
          edges: [],
          meta: {
            memory_count: 0,
            total_memory_count: 0,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 1,
            project_count: 1,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 0,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto(
    '/#/graph?types=memory,project,entity,file,skill,plan,task,document,code_artifact',
  )
  await expect(page.getByRole('heading', { name: 'Graph overview' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  for (const label of ['File', 'Skill', 'Plan', 'Task']) {
    await expect(page.getByLabel(`Include ${label}`)).toBeDisabled()
    await expect(page.getByLabel(`Include ${label}`)).not.toBeChecked()
  }
  await expect(page.getByLabel('Include Entity')).toBeChecked()
  await expect(page.getByLabel('Include Document')).toBeChecked()
  await expect(page.getByLabel('Include Code artifact')).toBeChecked()
  await expect(page.getByText(/Some selected node types are unavailable/)).toBeVisible()
  const graphRequest = requests.find((url) => url.pathname === '/api/v1/graph')
  expect(graphRequest?.searchParams.get('node_types')).toBe(
    'memory,project,entity,document,code_artifact',
  )
})

test('unknown graph capability permits optional reads with a retry notice', async ({ page }) => {
  const requests: URL[] = []
  await page.route('**/.well-known', (route) =>
    route.fulfill(json({ error: 'Capability unavailable' }, 500)),
  )
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes: [
            { id: 'memory_1', type: 'memory', label: 'Synthetic memory', data: { id: 1 } },
            { id: 'project_7', type: 'project', label: 'Synthetic project', data: { id: 7 } },
            { id: 'file_5', type: 'file', label: 'synthetic.txt', data: { id: 5 } },
          ],
          edges: [],
          meta: {
            memory_count: 1,
            total_memory_count: 1,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 0,
            project_count: 1,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 1,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 0,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph?types=memory,project,file')
  await expect(page.getByText(/Optional feature status is unknown/)).toBeVisible()
  await expect(page.getByLabel('Include File')).toBeChecked()
  await expect(page.getByRole('button', { name: 'Retry status' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  const graphRequest = requests.find((url) => url.pathname === '/api/v1/graph')
  expect(graphRequest?.searchParams.get('node_types')).toBe('memory,project,file')
})

test('project overview filters memories at the API and scopes optional records', async ({
  page,
}) => {
  const requests: URL[] = []
  const nodes = [
    { id: 'memory_2', type: 'memory', label: 'Synthetic project two memory', data: { id: 2 } },
    { id: 'project_1', type: 'project', label: 'Synthetic project one', data: { id: 1 } },
    { id: 'project_2', type: 'project', label: 'Synthetic project two', data: { id: 2 } },
    { id: 'entity_1', type: 'entity', label: 'Entity project one', data: { id: 1 } },
    { id: 'entity_2', type: 'entity', label: 'Entity project two', data: { id: 2 } },
    {
      id: 'document_1',
      type: 'document',
      label: 'Document project one',
      data: { id: 1, title: 'Document project one', document_type: 'note', tags: [] },
    },
    {
      id: 'document_2',
      type: 'document',
      label: 'Document project two',
      data: { id: 2, title: 'Document project two', document_type: 'note', tags: [] },
    },
    {
      id: 'code_artifact_1',
      type: 'code_artifact',
      label: 'Code project one',
      data: { id: 1, title: 'Code project one', language: 'typescript', tags: [] },
    },
    {
      id: 'code_artifact_2',
      type: 'code_artifact',
      label: 'Code project two',
      data: { id: 2, title: 'Code project two', language: 'typescript', tags: [] },
    },
    { id: 'file_1', type: 'file', label: 'file-one.txt', data: { id: 1, project_id: 1 } },
    { id: 'file_2', type: 'file', label: 'file-two.txt', data: { id: 2, project_id: 2 } },
    { id: 'skill_1', type: 'skill', label: 'skill-one', data: { id: 1, project_id: 1 } },
    { id: 'skill_2', type: 'skill', label: 'skill-two', data: { id: 2, project_id: 2 } },
    { id: 'plan_1', type: 'plan', label: 'Plan project one', data: { id: 1, project_id: 1 } },
    { id: 'plan_2', type: 'plan', label: 'Plan project two', data: { id: 2, project_id: 2 } },
    { id: 'task_1', type: 'task', label: 'Task plan one', data: { id: 1, plan_id: 1 } },
    { id: 'task_2', type: 'task', label: 'Task plan two', data: { id: 2, plan_id: 2 } },
  ]
  const edges = [
    ['memory_2_project_2', 'memory_2', 'project_2', 'memory_project'],
    ['entity_1_project_1', 'entity_1', 'project_1', 'entity_project'],
    ['entity_2_project_2', 'entity_2', 'project_2', 'entity_project'],
    ['document_1_project_1', 'document_1', 'project_1', 'document_project'],
    ['document_2_project_2', 'document_2', 'project_2', 'document_project'],
    ['code_artifact_1_project_1', 'code_artifact_1', 'project_1', 'code_artifact_project'],
    ['code_artifact_2_project_2', 'code_artifact_2', 'project_2', 'code_artifact_project'],
    ['file_1_project_1', 'file_1', 'project_1', 'file_project'],
    ['file_2_project_2', 'file_2', 'project_2', 'file_project'],
    ['skill_1_project_1', 'skill_1', 'project_1', 'skill_project'],
    ['skill_2_project_2', 'skill_2', 'project_2', 'skill_project'],
    ['plan_1_project_1', 'plan_1', 'project_1', 'plan_project'],
    ['plan_2_project_2', 'plan_2', 'project_2', 'plan_project'],
    ['plan_1_task_1', 'plan_1', 'task_1', 'plan_task'],
    ['plan_2_task_2', 'plan_2', 'task_2', 'plan_task'],
  ].map(([id, source, target, type]) => ({ id, source, target, type }))

  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes,
          edges,
          meta: {
            memory_count: 1,
            total_memory_count: 1,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 2,
            project_count: 2,
            document_count: 2,
            code_artifact_count: 2,
            file_count: 2,
            skill_count: 2,
            plan_count: 2,
            task_count: 2,
            edge_count: edges.length,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto(
    '/#/graph?project=2&types=memory,project,entity,document,code_artifact,file,skill,plan,task',
  )
  await expect(page.getByRole('heading', { name: 'Graph overview' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByLabel('Project filter')).toHaveValue('2')
  await expect(page.getByText(/The project filter applies to memories in the API/)).toBeVisible()
  for (const label of [
    'Synthetic project two memory',
    'Synthetic project two',
    'Entity project two',
    'Document project two',
    'Code project two',
    'file-two.txt',
    'skill-two',
    'Plan project two',
    'Task plan two',
  ]) {
    await expect(page.getByRole('button', { name: new RegExp(label) }).first()).toBeVisible()
  }
  for (const label of [
    'Synthetic project one',
    'Entity project one',
    'Document project one',
    'Code project one',
    'file-one.txt',
    'skill-one',
    'Plan project one',
    'Task plan one',
  ]) {
    await expect(page.getByRole('button', { name: new RegExp(label) })).toHaveCount(0)
  }
  await expect(page.getByText(/9 nodes/)).toBeVisible()
  const graphRequest = requests.find((url) => url.pathname === '/api/v1/graph')
  expect(graphRequest?.searchParams.get('project_id')).toBe('2')
  expect(requests.some((url) => url.pathname === '/api/v1/projects')).toBe(false)
  expect(requests.some((url) => /^\/api\/v1\/plans\/\d+$/.test(url.pathname))).toBe(false)
})

test('project overview keeps the requested project when it has no memories', async ({ page }) => {
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes: [
            { id: 'project_1', type: 'project', label: 'Project with memory', data: { id: 1 } },
            { id: 'project_2', type: 'project', label: 'Empty project', data: { id: 2 } },
          ],
          edges: [],
          meta: {
            memory_count: 0,
            total_memory_count: 0,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 0,
            project_count: 2,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 0,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph?project=2')
  await expect(page.getByRole('heading', { name: 'Graph overview' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: /Empty project/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Project with memory/ })).toHaveCount(0)
  await expect(page.getByText(/0 memories · 1 project/)).toBeVisible()
})

test('graph overview reports a later-page failure and retries from the start', async ({ page }) => {
  let pageTwoAttempts = 0
  const requests: URL[] = []
  const meta = (offset: number, memoryCount: number, hasMore: boolean) => ({
    memory_count: memoryCount,
    total_memory_count: 3,
    offset,
    limit: 2,
    has_more: hasMore,
    entity_count: 0,
    project_count: 1,
    document_count: 0,
    code_artifact_count: 0,
    file_count: 0,
    skill_count: 0,
    plan_count: 0,
    task_count: 0,
    edge_count: 0,
  })
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      const offset = Number(url.searchParams.get('offset') ?? 0)
      if (offset === 0) {
        await route.fulfill(
          json({
            nodes: [
              { id: 'memory_1', type: 'memory', label: 'Page one memory', data: { id: 1 } },
              { id: 'memory_2', type: 'memory', label: 'Page two memory', data: { id: 2 } },
              { id: 'project_7', type: 'project', label: 'Project', data: { id: 7 } },
            ],
            edges: [],
            meta: meta(0, 2, true),
          }),
        )
        return
      }
      pageTwoAttempts += 1
      if (pageTwoAttempts === 1) {
        await route.fulfill(json({ error: 'Synthetic page two failure' }, 500))
        return
      }
      await route.fulfill(
        json({
          nodes: [
            { id: 'memory_3', type: 'memory', label: 'Page three memory', data: { id: 3 } },
            { id: 'project_7', type: 'project', label: 'Project', data: { id: 7 } },
          ],
          edges: [],
          meta: meta(2, 1, false),
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph')
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Could not finish loading overview')
  await expect(alert).toContainText('Loaded 2 of 3 memories before the failure')
  await expect(page.locator('canvas')).toHaveCount(0)
  await expect(page.getByText(/^3 memories ·/)).toHaveCount(0)

  const retryRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/graph' && url.searchParams.get('offset') === '0'
  })
  await alert.getByRole('button', { name: 'Retry' }).click()
  await retryRequest
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/3 memories/)).toBeVisible()
  expect(requests.filter((url) => url.pathname === '/api/v1/graph')).toHaveLength(4)
})

test('graph overview follows one-memory pages beyond one thousand pages', async ({ page }) => {
  test.setTimeout(120_000)
  const total = 1001
  const offsets: number[] = []
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      const offset = Number(url.searchParams.get('offset') ?? 0)
      offsets.push(offset)
      await route.fulfill(
        json({
          nodes: [
            {
              id: `memory_${offset + 1}`,
              type: 'memory',
              label: `Effective page memory ${offset + 1}`,
              data: { id: offset + 1 },
            },
            { id: 'project_7', type: 'project', label: 'Effective page project', data: { id: 7 } },
          ],
          edges: [],
          meta: {
            memory_count: 1,
            total_memory_count: total,
            offset,
            limit: 1,
            has_more: offset + 1 < total,
            entity_count: 0,
            project_count: 1,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 0,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph')
  await expect(page.getByText(/^1001 memories ·/)).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  expect(offsets).toHaveLength(total)
  expect(offsets[0]).toBe(0)
  expect(offsets.at(-1)).toBe(total - 1)
  for (let index = 1; index < offsets.length; index += 1) {
    expect(offsets[index]).toBe((offsets[index - 1] ?? -1) + 1)
  }
})

test('graph overview fails visibly when pagination does not advance', async ({ page }) => {
  let graphRequests = 0
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      graphRequests += 1
      await route.fulfill(
        json({
          nodes: [
            { id: 'memory_1', type: 'memory', label: 'Repeated memory one', data: { id: 1 } },
            { id: 'memory_2', type: 'memory', label: 'Repeated memory two', data: { id: 2 } },
            { id: 'project_7', type: 'project', label: 'Project', data: { id: 7 } },
          ],
          edges: [],
          meta: {
            memory_count: 2,
            total_memory_count: 3,
            offset: graphRequests === 1 ? 0 : 2,
            limit: 2,
            has_more: true,
            entity_count: 0,
            project_count: 1,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 0,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph')
  await expect(page.getByRole('alert')).toContainText('pagination did not advance')
  await expect(page.locator('canvas')).toHaveCount(0)
  expect(graphRequests).toBe(2)
})

test('tasks require plans when a graph project filter is active', async ({ page }) => {
  const requests: URL[] = []
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes: [{ id: 'project_2', type: 'project', label: 'Scoped project', data: { id: 2 } }],
          edges: [],
          meta: {
            memory_count: 0,
            total_memory_count: 0,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 0,
            project_count: 1,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 0,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph?project=2&types=memory,project,task')
  await expect(page.getByRole('heading', { name: 'Graph overview' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByLabel('Include Task')).toBeDisabled()
  await expect(page.getByText(/Tasks require Plans when filtering by project/)).toBeVisible()
  const graphRequest = requests.find((url) => url.pathname === '/api/v1/graph')
  expect(graphRequest?.searchParams.get('node_types')).toBe('memory,project')
})

test('graph overview ignores a late page after a node-type change', async ({ page }) => {
  let releaseCore: (() => void) | undefined
  let coreHandled: (() => void) | undefined
  const coreGate = new Promise<void>((resolve) => {
    releaseCore = resolve
  })
  const coreDone = new Promise<void>((resolve) => {
    coreHandled = resolve
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
    if (url.pathname === '/api/v1/graph') {
      const nodeTypes = url.searchParams.get('node_types') ?? ''
      if (nodeTypes.includes('file')) {
        await route.fulfill(
          json({
            nodes: [
              { id: 'memory_2', type: 'memory', label: 'Fresh overview memory', data: { id: 2 } },
              { id: 'project_7', type: 'project', label: 'Project', data: { id: 7 } },
              { id: 'file_5', type: 'file', label: 'fresh.txt', data: { id: 5 } },
            ],
            edges: [],
            meta: {
              memory_count: 1,
              total_memory_count: 1,
              offset: 0,
              limit: 100,
              has_more: false,
              entity_count: 0,
              project_count: 1,
              document_count: 0,
              code_artifact_count: 0,
              file_count: 1,
              skill_count: 0,
              plan_count: 0,
              task_count: 0,
              edge_count: 0,
            },
          }),
        )
        return
      }
      await coreGate
      await route
        .fulfill(
          json({
            nodes: [
              { id: 'memory_1', type: 'memory', label: 'Stale overview memory', data: { id: 1 } },
              { id: 'project_7', type: 'project', label: 'Project', data: { id: 7 } },
            ],
            edges: [],
            meta: {
              memory_count: 1,
              total_memory_count: 1,
              offset: 0,
              limit: 100,
              has_more: false,
              entity_count: 0,
              project_count: 1,
              document_count: 0,
              code_artifact_count: 0,
              file_count: 0,
              skill_count: 0,
              plan_count: 0,
              task_count: 0,
              edge_count: 0,
            },
          }),
        )
        .catch(() => undefined)
      coreHandled?.()
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  const coreRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      url.pathname === '/api/v1/graph' && url.searchParams.get('node_types') === 'memory,project'
    )
  })
  await page.goto('/#/graph')
  await coreRequest
  await expect(page.getByLabel('Include File')).toBeEnabled()
  const fileRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      url.pathname === '/api/v1/graph' &&
      (url.searchParams.get('node_types') ?? '').includes('file')
    )
  })
  await page.getByLabel('Include File').check()
  await fileRequest
  await expect(page.getByText('Fresh overview memory')).toBeVisible()
  releaseCore?.()
  await coreDone
  await expect(page.getByText('Fresh overview memory')).toBeVisible()
  await expect(page.getByText('Stale overview memory')).toHaveCount(0)
})

test('graph overview stops pagination after access is denied', async ({ page }) => {
  const offsets: string[] = []
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      offsets.push(url.searchParams.get('offset') ?? '')
      if (offsets.length > 1) {
        await route.fulfill(json({ error: 'Denied' }, 403))
        return
      }
      await route.fulfill(
        json({
          nodes: [
            { id: 'memory_1', type: 'memory', label: 'Denied memory', data: { id: 1 } },
            { id: 'memory_2', type: 'memory', label: 'Denied memory two', data: { id: 2 } },
            { id: 'project_7', type: 'project', label: 'Project', data: { id: 7 } },
          ],
          edges: [],
          meta: {
            memory_count: 2,
            total_memory_count: 4,
            offset: 0,
            limit: 2,
            has_more: true,
            entity_count: 0,
            project_count: 1,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 0,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph')
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible()
  expect(offsets).toEqual(['0', '2'])
})

test('overview highlights every incident returned link for source and target nodes', async ({
  page,
}) => {
  const requests: URL[] = []
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
    requests.push(url)
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes: [
            {
              id: 'memory_1',
              type: 'memory',
              label: 'Synthetic source memory',
              data: { id: 1, importance: 5 },
            },
            {
              id: 'project_7',
              type: 'project',
              label: 'Synthetic project Alpha',
              data: { id: 7, name: 'Synthetic project Alpha', status: 'active' },
            },
            {
              id: 'entity_9',
              type: 'entity',
              label: 'Synthetic source entity',
              data: { id: 9, name: 'Synthetic source entity', entity_type: 'System' },
            },
          ],
          edges: [
            {
              id: 'memory_1_project_7',
              source: 'memory_1',
              target: 'project_7',
              type: 'memory_project',
            },
            {
              id: 'entity_9_memory_1',
              source: 'entity_9',
              target: 'memory_1',
              type: 'entity_memory',
            },
          ],
          meta: {
            memory_count: 1,
            total_memory_count: 1,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 1,
            project_count: 1,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 2,
          },
        }),
      )
      return
    }
    if (url.pathname === '/api/v1/memories/1') {
      await route.fulfill(
        json({
          id: 1,
          title: 'Synthetic source memory',
          content: 'Source memory detail.',
          importance: 5,
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph?types=memory,project,entity')
  const canvas = page.locator('canvas')
  const graphContainer = page.locator('[data-graph-engine]')
  await expect(canvas).toBeVisible({ timeout: 15_000 })
  await expect(graphContainer).toHaveAttribute('data-graph-engine', 'stopped', {
    timeout: 15_000,
  })
  const camera = await graphContainer.getAttribute('data-graph-camera')
  expect(camera).not.toBeNull()
  const memory = await findStableMemoryCentroid(page)
  const project = await findStableProjectCentroid(page)
  const entity = await findStableCopperCentroid(page)
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas has no box')
  const memoryProjectBaseline = await lineWarmPixels(page, memory, project)
  const entityMemoryBaseline = await lineWarmPixels(page, entity, memory)
  expect(memoryProjectBaseline).toBeLessThanOrEqual(2)
  expect(entityMemoryBaseline).toBeLessThanOrEqual(2)
  if (!camera) throw new Error('Canvas camera was not reported')
  const zoom = Number(camera.split(':')[0])
  const projectRadius = Math.max(9, 4.5 / zoom)
  const ringRadius = (projectRadius + 3.5) * zoom
  const ringPoints = [
    { x: project.x - ringRadius, y: project.y },
    { x: project.x + ringRadius, y: project.y },
    { x: project.x, y: project.y - ringRadius },
  ].filter(
    (point) =>
      point.x >= 6 && point.y >= 6 && point.x < project.width - 6 && point.y < project.height - 6,
  )
  if (ringPoints.length === 0) throw new Error('No project ring sample point')
  const ringGreen = async (): Promise<number> => {
    let maximum = 0
    for (const point of ringPoints) {
      maximum = Math.max(maximum, await maxGreenNear(page, point.x, point.y))
    }
    return maximum
  }
  const projectRingBefore = await ringGreen()

  const moveTo = async (node: CopperCentroid): Promise<void> => {
    await page.mouse.move(
      box.x + (node.x * box.width) / node.width,
      box.y + (node.y * box.height) / node.height,
    )
  }

  await moveTo(memory)
  await expect(page.getByText('Synthetic source memory · memory', { exact: true })).toBeVisible()
  await expect
    .poll(async () => lineWarmPixels(page, memory, project))
    .toBeGreaterThan(memoryProjectBaseline + 20)
  await expect
    .poll(async () => lineWarmPixels(page, entity, memory))
    .toBeGreaterThan(entityMemoryBaseline + 20)
  await expect.poll(ringGreen).toBeGreaterThan(projectRingBefore + 20)
  await expect(graphContainer).toHaveAttribute('data-graph-camera', camera ?? '')

  await moveTo(entity)
  await expect(page.getByText('Synthetic source entity · entity', { exact: true })).toBeVisible()
  await expect
    .poll(async () => lineWarmPixels(page, entity, memory))
    .toBeGreaterThan(entityMemoryBaseline + 20)

  await page.mouse.move(box.x + 6, box.y + 6)
  await expect
    .poll(async () => lineWarmPixels(page, memory, project))
    .toBeLessThanOrEqual(memoryProjectBaseline + 5)
  await expect
    .poll(async () => lineWarmPixels(page, entity, memory))
    .toBeLessThanOrEqual(entityMemoryBaseline + 5)

  await page.getByRole('button', { name: 'Synthetic source memory Memory', exact: true }).click()
  await expect(page.getByText('Source memory detail.')).toBeVisible()
  await expect(page).toHaveURL(/#\/graph\?types=memory,project,entity$/)
  await expect
    .poll(async () => lineWarmPixels(page, memory, project))
    .toBeGreaterThan(memoryProjectBaseline + 20)
  await expect
    .poll(async () => lineWarmPixels(page, entity, memory))
    .toBeGreaterThan(entityMemoryBaseline + 20)
  await expect(graphContainer).toHaveAttribute('data-graph-camera', camera ?? '')
  expect(requests.filter((url) => url.pathname === '/api/v1/graph')).toHaveLength(1)
  expect(requests.some((url) => url.pathname === '/api/v1/graph/subgraph')).toBe(false)

  await page.setViewportSize({ width: 1100, height: 900 })
  await expect(graphContainer).toHaveAttribute('data-graph-camera', camera ?? '')
})

test('overview highlights a returned link when hovering its target project', async ({ page }) => {
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes: [
            {
              id: 'memory_1',
              type: 'memory',
              label: 'Synthetic source memory',
              data: { id: 1, importance: 5 },
            },
            {
              id: 'project_7',
              type: 'project',
              label: 'Synthetic target project',
              data: { id: 7, name: 'Synthetic target project', status: 'active' },
            },
          ],
          edges: [
            {
              id: 'memory_1_project_7',
              source: 'memory_1',
              target: 'project_7',
              type: 'memory_project',
            },
          ],
          meta: {
            memory_count: 1,
            total_memory_count: 1,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 0,
            project_count: 1,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 1,
          },
        }),
      )
      return
    }
    if (url.pathname === '/api/v1/memories/1') {
      await route.fulfill(
        json({ id: 1, title: 'Synthetic source memory', content: 'Target hover detail.' }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph')
  const canvas = page.locator('canvas')
  const graphContainer = page.locator('[data-graph-engine]')
  await expect(canvas).toBeVisible({ timeout: 15_000 })
  await expect(graphContainer).toHaveAttribute('data-graph-engine', 'stopped', {
    timeout: 15_000,
  })
  const camera = await graphContainer.getAttribute('data-graph-camera')
  const memory = await findStableMemoryCentroid(page)
  const project = await findStableProjectCentroid(page)
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas has no box')
  const baseline = await lineWarmPixels(page, memory, project)
  expect(baseline).toBeLessThanOrEqual(2)
  const moveTo = async (node: CopperCentroid): Promise<void> => {
    await page.mouse.move(
      box.x + (node.x * box.width) / node.width,
      box.y + (node.y * box.height) / node.height,
    )
  }

  await moveTo(project)
  await expect(page.getByText('Synthetic target project · project', { exact: true })).toBeVisible()
  await expect
    .poll(async () => lineWarmPixels(page, memory, project))
    .toBeGreaterThan(baseline + 20)
  await expect(graphContainer).toHaveAttribute('data-graph-camera', camera ?? '')

  await page.getByRole('button', { name: 'Synthetic source memory Memory', exact: true }).click()
  await expect(page.getByText('Target hover detail.')).toBeVisible()
  await expect
    .poll(async () => lineWarmPixels(page, memory, project))
    .toBeGreaterThan(baseline + 20)
  await expect(graphContainer).toHaveAttribute('data-graph-camera', camera ?? '')
})

test('overview fits 1,500 memories loaded through real 100-memory pages', async ({ page }) => {
  const total = 1500
  const allNodes = Array.from({ length: total }, (_, index) => ({
    id: `memory_${50000 + index}`,
    type: 'memory',
    label: `Scaled overview memory ${index}`,
    data: { id: 50000 + index },
  }))
  const offsets: number[] = []
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      const offset = Number(url.searchParams.get('offset') ?? 0)
      offsets.push(offset)
      const pageNodes = allNodes.slice(offset, offset + 100)
      await route.fulfill(
        json({
          nodes: pageNodes,
          edges: [],
          meta: {
            memory_count: pageNodes.length,
            total_memory_count: total,
            offset,
            limit: 100,
            has_more: offset + pageNodes.length < total,
            entity_count: 0,
            project_count: 0,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 0,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph')
  const graphContainer = page.locator('[data-graph-engine]')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect(graphContainer).toHaveAttribute('data-graph-engine', 'stopped', {
    timeout: 30_000,
  })
  await expect(page.getByText(/^1500 memories ·/)).toBeVisible()
  expect(offsets).toHaveLength(15)
  expect(offsets[0]).toBe(0)
  expect(offsets.at(-1)).toBe(1400)
  for (let index = 1; index < offsets.length; index += 1) {
    expect(offsets[index]).toBe((offsets[index - 1] ?? -1) + 100)
  }
  const camera = await graphContainer.getAttribute('data-graph-camera')
  if (!camera) throw new Error('Canvas camera was not reported')
  expect(Number(camera.split(':')[0])).toBeLessThan(0.4)
  const ink = await measureInkBox(page)
  expect(ink.width).toBeGreaterThan(ink.canvasWidth * 0.4)
  expect(ink.height).toBeGreaterThan(ink.canvasHeight * 0.4)
  expect(ink.minX).toBeGreaterThan(2)
  expect(ink.minY).toBeGreaterThan(2)
  expect(ink.maxX).toBeLessThan(ink.canvasWidth - 2)
  expect(ink.maxY).toBeLessThan(ink.canvasHeight - 2)
})

test('overview selection opens detail without replacing the overview', async ({ page }) => {
  const requests: URL[] = []
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes: [
            {
              id: 'memory_1',
              type: 'memory',
              label: 'Synthetic focus memory',
              data: { id: 1, importance: 5 },
            },
            { id: 'project_7', type: 'project', label: 'Focus project', data: { id: 7 } },
          ],
          edges: [
            {
              id: 'memory_1_project_7',
              source: 'memory_1',
              target: 'project_7',
              type: 'memory_project',
            },
          ],
          meta: {
            memory_count: 1,
            total_memory_count: 1,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 0,
            project_count: 1,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 1,
          },
        }),
      )
      return
    }
    if (url.pathname === '/api/v1/memories/1') {
      await route.fulfill(
        json({
          id: 1,
          title: 'Synthetic focus memory',
          content: 'Focus memory content.',
          importance: 5,
          tags: [],
          project_ids: [7],
        }),
      )
      return
    }
    if (url.pathname === '/api/v1/graph/subgraph') {
      await route.fulfill(
        json({
          nodes: [
            {
              id: 'memory_1',
              type: 'memory',
              label: 'Synthetic focus memory',
              depth: 0,
              data: { importance: 5 },
            },
          ],
          edges: [],
          meta: {
            center_node_id: 'memory_1',
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

  await page.goto('/#/graph')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  expect(requests.some((url) => url.pathname === '/api/v1/graph/subgraph')).toBe(false)
  await page.getByRole('button', { name: /Synthetic focus memory/ }).click()
  await expect(page.getByRole('heading', { name: 'Synthetic focus memory' })).toBeVisible()
  await expect(page.getByText('Focus memory content.')).toBeVisible()
  await expect(page).toHaveURL(/#\/graph$/)
  expect(requests.some((url) => url.pathname === '/api/v1/graph/subgraph')).toBe(false)
  await expect(page.getByRole('link', { name: 'Focus neighbourhood' })).toHaveAttribute(
    'href',
    '#/graph?memory=1',
  )
  await expect(page.getByRole('link', { name: 'Graph' })).toHaveAttribute('href', '#/graph')

  const focusRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/graph/subgraph'
  })
  await page.getByRole('link', { name: 'Focus neighbourhood' }).click()
  await focusRequest
  await expect(page.getByRole('heading', { name: 'Graph around memory #1' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '#/graph')
  await page.getByRole('link', { name: 'Overview' }).click()
  await expect(page).toHaveURL(/#\/graph$/)
  await expect(page.getByRole('heading', { name: 'Graph overview' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
})

test('overview remains usable and contains long detail text at 390px', async ({ page }) => {
  const longName = `Project${'P'.repeat(170)}`
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes: [
            { id: 'memory_1', type: 'memory', label: `Memory${'M'.repeat(120)}`, data: { id: 1 } },
            { id: 'project_7', type: 'project', label: longName, data: { id: 7 } },
          ],
          edges: [],
          meta: {
            memory_count: 1,
            total_memory_count: 1,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 0,
            project_count: 1,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 0,
          },
        }),
      )
      return
    }
    if (url.pathname === '/api/v1/projects/7') {
      await route.fulfill(json({ id: 7, name: longName, description: 'Long project detail.' }))
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph')
  await expect(page.getByRole('heading', { name: 'Graph overview' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: new RegExp(longName) }).click()
  const heading = page.getByRole('heading', { name: longName, exact: true })
  await expect(heading).toBeVisible()
  const metrics = await heading.evaluate((element) => {
    const main = element.closest('main')
    if (!main) throw new Error('Main container missing')
    const box = main.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(element)
    const rectangles = [...range.getClientRects()].filter((rect) => rect.width > 0)
    return {
      fits: rectangles.every((rect) => rect.left >= box.left - 1 && rect.right <= box.right + 1),
      lines: rectangles.length,
    }
  })
  expect(metrics.fits).toBe(true)
  expect(metrics.lines).toBeGreaterThan(1)
  let overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
  await page.setViewportSize({ width: 1024, height: 900 })
  await expect(page.locator('canvas')).toBeVisible()
  overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
})

test('offline health does not gate the graph overview read', async ({ page }) => {
  const requests: URL[] = []
  await page.route('**/health', (route) => route.fulfill(json({ error: 'offline' }, 503)))
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes: [
            { id: 'memory_1', type: 'memory', label: 'Offline memory', data: { id: 1 } },
            { id: 'project_7', type: 'project', label: 'Offline project', data: { id: 7 } },
          ],
          edges: [],
          meta: {
            memory_count: 1,
            total_memory_count: 1,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 0,
            project_count: 1,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 0,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph')
  await expect(page.getByRole('heading', { name: 'Graph overview' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  expect(requests.some((url) => url.pathname === '/api/v1/graph')).toBe(true)
})

test('graph overview refreshes on demand without polling', async ({ page }) => {
  let phase = 0
  let graphRequests = 0
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      graphRequests += 1
      await route.fulfill(
        json({
          nodes: [
            {
              id: 'memory_1',
              type: 'memory',
              label: phase === 0 ? 'Initial overview memory' : 'Refreshed overview memory',
              data: { id: 1 },
            },
            { id: 'project_7', type: 'project', label: 'Refresh project', data: { id: 7 } },
          ],
          edges: [],
          meta: {
            memory_count: 1,
            total_memory_count: 1,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 0,
            project_count: 1,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 0,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph')
  await expect(page.getByText('Initial overview memory')).toBeVisible({ timeout: 15_000 })
  expect(graphRequests).toBe(1)
  await page.clock.install()
  phase = 1
  const refreshRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/graph' && url.searchParams.get('offset') === '0'
  })
  await page.getByRole('button', { name: 'Refresh overview' }).click()
  await refreshRequest
  await expect(page.getByText('Refreshed overview memory')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Initial overview memory')).toHaveCount(0)
  expect(graphRequests).toBe(2)
  await page.clock.fastForward(5000)
  expect(graphRequests).toBe(2)
})

test('authentication required stops graph reads', async ({ page }) => {
  const requests: URL[] = []
  page.on('request', (request) => requests.push(new URL(request.url())))
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
      await route.fulfill(json({ authEnabled: true, authMode: 'required' }))
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph')
  await expect(page.getByRole('main').getByText('Sign-in required')).toBeVisible()
  expect(requests.some((url) => url.pathname === '/api/v1/graph')).toBe(false)
})

test('overview core visibility hides nodes and incident edges without refetching', async ({
  page,
}) => {
  const requests: URL[] = []
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes: [
            { id: 'memory_1', type: 'memory', label: 'Visible memory', data: { id: 1 } },
            { id: 'project_7', type: 'project', label: 'Visible project', data: { id: 7 } },
          ],
          edges: [
            {
              id: 'memory_1_project_7',
              source: 'memory_1',
              target: 'project_7',
              type: 'memory_project',
            },
          ],
          meta: {
            memory_count: 1,
            total_memory_count: 1,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 0,
            project_count: 1,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 1,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph')
  await expect(page.getByText('Visible memory')).toBeVisible({ timeout: 15_000 })
  const memoryToggle = page.getByRole('checkbox', { name: 'Memory', exact: true })
  const projectToggle = page.getByRole('checkbox', { name: 'Project', exact: true })
  await expect(memoryToggle).toBeEnabled()
  await expect(memoryToggle).toBeChecked()
  await expect(projectToggle).toBeEnabled()
  await expect(projectToggle).toBeChecked()
  expect(requests.filter((url) => url.pathname === '/api/v1/graph')).toHaveLength(1)
  expect(
    requests.find((url) => url.pathname === '/api/v1/graph')?.searchParams.get('node_types'),
  ).toBe('memory,project')

  await memoryToggle.uncheck()
  await expect(page).toHaveURL(/#\/graph\?hide=memory$/)
  await expect(page.getByRole('button', { name: /Visible memory/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Visible project/ })).toBeVisible()
  await expect(page.getByText(/0 memories · 1 project · 0 edges · 1 nodes/)).toBeVisible()
  expect(requests.filter((url) => url.pathname === '/api/v1/graph')).toHaveLength(1)

  await projectToggle.uncheck()
  await expect(page).toHaveURL(/#\/graph\?hide=memory%2Cproject$/)
  await expect(page.getByText('No visible nodes', { exact: true })).toBeVisible()
  await expect(page.getByText('No graph records', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/0 memories · 0 projects · 0 edges · 0 nodes/)).toBeVisible()
  expect(requests.filter((url) => url.pathname === '/api/v1/graph')).toHaveLength(1)

  await memoryToggle.check()
  await projectToggle.check()
  await expect(page).toHaveURL(/#\/graph$/)
  await expect(page.getByRole('button', { name: /Visible memory/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Visible project/ })).toBeVisible()
  await expect(page.getByText(/1 memory · 1 project · 1 edge · 2 nodes/)).toBeVisible()
  expect(requests.filter((url) => url.pathname === '/api/v1/graph')).toHaveLength(1)
})

test('hiding a selected core node cancels and clears its detail', async ({ page }) => {
  const requests: URL[] = []
  let releaseDetail: (() => void) | undefined
  const detailGate = new Promise<void>((resolve) => {
    releaseDetail = resolve
  })
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes: [
            { id: 'memory_1', type: 'memory', label: 'Cancelled memory', data: { id: 1 } },
            { id: 'project_7', type: 'project', label: 'Surviving project', data: { id: 7 } },
          ],
          edges: [],
          meta: {
            memory_count: 1,
            total_memory_count: 1,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 0,
            project_count: 1,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 0,
          },
        }),
      )
      return
    }
    if (url.pathname === '/api/v1/memories/1') {
      await detailGate
      await route
        .fulfill(json({ id: 1, title: 'Cancelled memory', content: 'Should not appear.' }))
        .catch(() => undefined)
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph')
  await expect(page.getByText('Cancelled memory')).toBeVisible({ timeout: 15_000 })
  const detailRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/memories/1'
  })
  await page.getByRole('button', { name: 'Cancelled memory Memory', exact: true }).click()
  await detailRequest
  await page.getByRole('checkbox', { name: 'Memory', exact: true }).uncheck()
  await expect(page.getByText('Cancelled memory')).toHaveCount(0)
  await expect(page.getByText('Select a node to inspect its record.')).toBeVisible()
  releaseDetail?.()
  await expect(page.getByText('Should not appear.')).toHaveCount(0)
  expect(requests.filter((url) => url.pathname === '/api/v1/graph')).toHaveLength(1)
})

test('hiding projects keeps project-scoped documents and code from typed edges', async ({
  page,
}) => {
  const requests: URL[] = []
  const nodes = [
    { id: 'memory_2', type: 'memory', label: 'Scoped memory', data: { id: 2 } },
    { id: 'project_1', type: 'project', label: 'Foreign project', data: { id: 1 } },
    { id: 'project_2', type: 'project', label: 'Scoped project', data: { id: 2 } },
    {
      id: 'document_1',
      type: 'document',
      label: 'Foreign document',
      data: { id: 1, title: 'Foreign document', document_type: 'note', tags: [] },
    },
    {
      id: 'document_2',
      type: 'document',
      label: 'Scoped document',
      data: { id: 2, title: 'Scoped document', document_type: 'note', tags: [] },
    },
    {
      id: 'code_artifact_1',
      type: 'code_artifact',
      label: 'Foreign code',
      data: { id: 1, title: 'Foreign code', language: 'typescript', tags: [] },
    },
    {
      id: 'code_artifact_2',
      type: 'code_artifact',
      label: 'Scoped code',
      data: { id: 2, title: 'Scoped code', language: 'typescript', tags: [] },
    },
  ]
  const edges = [
    ['memory_2_project_2', 'memory_2', 'project_2', 'memory_project'],
    ['document_1_project_1', 'document_1', 'project_1', 'document_project'],
    ['document_2_project_2', 'document_2', 'project_2', 'document_project'],
    ['code_artifact_1_project_1', 'code_artifact_1', 'project_1', 'code_artifact_project'],
    ['code_artifact_2_project_2', 'code_artifact_2', 'project_2', 'code_artifact_project'],
  ].map(([id, source, target, type]) => ({ id, source, target, type }))
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes,
          edges,
          meta: {
            memory_count: 1,
            total_memory_count: 1,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 0,
            project_count: 2,
            document_count: 2,
            code_artifact_count: 2,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: edges.length,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph?project=2&types=document,code_artifact&hide=project')
  await expect(page.getByRole('heading', { name: 'Graph overview' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByLabel('Project filter')).toHaveValue('2')
  await expect(page.getByRole('option', { name: 'Scoped project' })).toBeAttached()
  await expect(page.getByRole('option', { name: 'Foreign project' })).toBeAttached()
  await expect(page.getByRole('button', { name: /Scoped memory/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Scoped document/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Scoped code/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Foreign document/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Foreign code/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Scoped project/ })).toHaveCount(0)
  await expect(page.getByText(/1 memory · 0 projects · 0 edges · 3 nodes/)).toBeVisible()

  await page.getByRole('checkbox', { name: 'Project', exact: true }).check()
  await expect(page.getByRole('button', { name: /Scoped project/ })).toBeVisible()
  await expect(page.getByText(/1 memory · 1 project · 3 edges · 4 nodes/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Foreign document/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Foreign code/ })).toHaveCount(0)
  expect(requests.filter((url) => url.pathname === '/api/v1/graph')).toHaveLength(1)
  expect(
    requests.some((url) => /^\/api\/v1\/(documents|code-artifacts)\/\d+$/.test(url.pathname)),
  ).toBe(false)
})

test('both core types can be hidden while optional records remain visible', async ({ page }) => {
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes: [
            { id: 'memory_1', type: 'memory', label: 'Hidden memory', data: { id: 1 } },
            { id: 'project_7', type: 'project', label: 'Hidden project', data: { id: 7 } },
            {
              id: 'document_3',
              type: 'document',
              label: 'Visible document',
              data: { id: 3, title: 'Visible document', document_type: 'note', tags: [] },
            },
            {
              id: 'code_artifact_4',
              type: 'code_artifact',
              label: 'Visible code',
              data: { id: 4, title: 'Visible code', language: 'typescript', tags: [] },
            },
          ],
          edges: [
            {
              id: 'document_3_project_7',
              source: 'document_3',
              target: 'project_7',
              type: 'document_project',
            },
            {
              id: 'code_artifact_4_project_7',
              source: 'code_artifact_4',
              target: 'project_7',
              type: 'code_artifact_project',
            },
          ],
          meta: {
            memory_count: 1,
            total_memory_count: 1,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 0,
            project_count: 1,
            document_count: 1,
            code_artifact_count: 1,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 2,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph?types=document,code_artifact&hide=memory,project')
  await expect(page.getByRole('heading', { name: 'Graph overview' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: /Visible document/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Visible code/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Hidden memory/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Hidden project/ })).toHaveCount(0)
  await expect(page.getByText(/0 memories · 0 projects · 0 edges · 2 nodes/)).toBeVisible()
  await expect(page.getByText('No visible nodes', { exact: true })).toHaveCount(0)
})

test('hiding memories keeps independently linked non-memory records', async ({ page }) => {
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes: [
            { id: 'memory_1', type: 'memory', label: 'Hidden memory', data: { id: 1 } },
            { id: 'project_7', type: 'project', label: 'Kept project', data: { id: 7 } },
            {
              id: 'document_3',
              type: 'document',
              label: 'Kept document',
              data: { id: 3, title: 'Kept document', document_type: 'note', tags: [] },
            },
          ],
          edges: [
            {
              id: 'memory_1_project_7',
              source: 'memory_1',
              target: 'project_7',
              type: 'memory_project',
            },
            {
              id: 'document_3_project_7',
              source: 'document_3',
              target: 'project_7',
              type: 'document_project',
            },
          ],
          meta: {
            memory_count: 1,
            total_memory_count: 1,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 0,
            project_count: 1,
            document_count: 1,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 2,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph?types=document&hide=memory')
  await expect(page.getByRole('heading', { name: 'Graph overview' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: /Kept document/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Kept project/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Hidden memory/ })).toHaveCount(0)
  await expect(page.getByText(/0 memories · 1 project · 1 edge · 2 nodes/)).toBeVisible()
})

test('visibility persists through reload, focus, depth, overview, refresh and history', async ({
  page,
}) => {
  const overviewRequests: URL[] = []
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      overviewRequests.push(url)
      await route.fulfill(
        json({
          nodes: [
            { id: 'memory_1', type: 'memory', label: 'Persistent memory', data: { id: 1 } },
            { id: 'project_7', type: 'project', label: 'Persistent project', data: { id: 7 } },
          ],
          edges: [],
          meta: {
            memory_count: 1,
            total_memory_count: 1,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 0,
            project_count: 1,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 0,
          },
        }),
      )
      return
    }
    if (url.pathname === '/api/v1/graph/subgraph') {
      await route.fulfill(
        json({
          nodes: [
            {
              id: 'memory_1',
              type: 'memory',
              label: 'Persistent memory',
              depth: 0,
              data: { importance: 5 },
            },
            {
              id: 'project_7',
              type: 'project',
              label: 'Persistent project',
              depth: 1,
              data: { name: 'Persistent project' },
            },
          ],
          edges: [],
          meta: {
            center_node_id: 'memory_1',
            depth: 1,
            node_types: ['memory', 'project'],
            max_nodes: 100,
            edge_count: 0,
            truncated: false,
          },
        }),
      )
      return
    }
    if (url.pathname === '/api/v1/memories/1') {
      await route.fulfill(json({ id: 1, title: 'Persistent memory', content: 'Persistent.' }))
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph?hide=project')
  await expect(page.getByText('Persistent memory')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: /Persistent project/ })).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Persistent memory')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: /Persistent project/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Persistent memory Memory', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Focus neighbourhood' })).toHaveAttribute(
    'href',
    '#/graph?memory=1&hide=project',
  )
  await page.getByRole('link', { name: 'Focus neighbourhood' }).click()
  await expect(page.getByRole('heading', { name: 'Graph around memory #1' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: /Persistent project/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Overview' })).toHaveAttribute(
    'href',
    '#/graph?hide=project',
  )
  await expect(page.getByRole('link', { name: 'Depth 2' })).toHaveAttribute(
    'href',
    '#/graph?memory=1&depth=2&hide=project',
  )

  await page.getByRole('link', { name: 'Overview' }).click()
  await expect(page.getByRole('heading', { name: 'Graph overview' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Persistent project/ })).toHaveCount(0)
  const refreshRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/graph' && url.searchParams.get('offset') === '0'
  })
  await page.getByRole('button', { name: 'Refresh overview' }).click()
  await refreshRequest
  await expect(page.getByRole('button', { name: /Persistent project/ })).toHaveCount(0)
  expect(overviewRequests.every((url) => !url.searchParams.has('hide'))).toBe(true)

  await page.getByRole('checkbox', { name: 'Memory', exact: true }).uncheck()
  await expect(page).toHaveURL(/#\/graph\?hide=memory%2Cproject$/)
  await page.goBack()
  await expect(page).toHaveURL(/#\/graph\?hide=project$/)
  await expect(page.getByRole('button', { name: /Persistent memory/ })).toBeVisible()
  await page.goForward()
  await expect(page).toHaveURL(/#\/graph\?hide=memory%2Cproject$/)
  await expect(page.getByText('No visible nodes', { exact: true })).toBeVisible()
})

test('visibility toggles do not restart a gated later page', async ({ page }) => {
  let releaseSecond: (() => void) | undefined
  const secondGate = new Promise<void>((resolve) => {
    releaseSecond = resolve
  })
  const offsets: number[] = []
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      const offset = Number(url.searchParams.get('offset') ?? 0)
      offsets.push(offset)
      if (offset === 1) await secondGate
      await route.fulfill(
        json({
          nodes: [
            {
              id: `memory_${offset + 1}`,
              type: 'memory',
              label: `Gated memory ${offset + 1}`,
              data: { id: offset + 1 },
            },
            { id: 'project_7', type: 'project', label: 'Gated project', data: { id: 7 } },
          ],
          edges: [],
          meta: {
            memory_count: 1,
            total_memory_count: 2,
            offset,
            limit: 1,
            has_more: offset === 0,
            entity_count: 0,
            project_count: 1,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 0,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  const secondPageRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/graph' && url.searchParams.get('offset') === '1'
  })
  await page.goto('/#/graph')
  await expect(page.getByText(/Loaded 1 of 2 memories/).first()).toBeVisible()
  await secondPageRequest
  expect(offsets).toEqual([0, 1])
  await page.getByRole('checkbox', { name: 'Memory', exact: true }).uncheck()
  await expect(page).toHaveURL(/#\/graph\?hide=memory$/)
  await expect(page.getByText(/Loaded 1 of 2 memories/).first()).toBeVisible()
  expect(offsets).toEqual([0, 1])
  expect(offsets.filter((offset) => offset === 0)).toHaveLength(1)

  releaseSecond?.()
  await expect(page.getByText(/^0 memories · 1 project · 0 edges · 1 nodes/)).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByRole('button', { name: /Gated project/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Gated memory/ })).toHaveCount(0)
  expect(offsets).toEqual([0, 1])
})

test('hide only accepts the two core node types', async ({ page }) => {
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes: [
            { id: 'memory_1', type: 'memory', label: 'Core memory', data: { id: 1 } },
            { id: 'project_7', type: 'project', label: 'Core project', data: { id: 7 } },
          ],
          edges: [],
          meta: {
            memory_count: 1,
            total_memory_count: 1,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 0,
            project_count: 1,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 0,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph?hide=entity,file')
  await expect(page.getByRole('button', { name: /Core memory/ })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByRole('button', { name: /Core project/ })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Memory', exact: true })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Project', exact: true })).toBeChecked()
  await page.getByRole('checkbox', { name: 'Memory', exact: true }).uncheck()
  await expect(page).toHaveURL(/#\/graph\?hide=memory$/)
})

test('visibility survives project and optional-type changes', async ({ page }) => {
  const requests: URL[] = []
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes: [
            { id: 'memory_1', type: 'memory', label: 'Change memory', data: { id: 1 } },
            { id: 'project_7', type: 'project', label: 'Change project', data: { id: 7 } },
            {
              id: 'document_3',
              type: 'document',
              label: 'Change document',
              data: { id: 3, title: 'Change document', document_type: 'note', tags: [] },
            },
          ],
          edges: [
            {
              id: 'document_3_project_7',
              source: 'document_3',
              target: 'project_7',
              type: 'document_project',
            },
          ],
          meta: {
            memory_count: 1,
            total_memory_count: 1,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 0,
            project_count: 1,
            document_count: 1,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 1,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph?hide=memory')
  await expect(page.getByRole('button', { name: /Change project/ })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByRole('button', { name: /Change memory/ })).toHaveCount(0)

  const projectRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/v1/graph' && url.searchParams.get('project_id') === '7'
  })
  await page.getByLabel('Project filter').selectOption('7')
  await projectRequest
  const projectHash = new URLSearchParams(new URL(page.url()).hash.split('?')[1] ?? '')
  expect(projectHash.get('project')).toBe('7')
  expect(projectHash.get('hide')).toBe('memory')
  await expect(page.getByRole('button', { name: /Change document/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Change memory/ })).toHaveCount(0)

  const typeRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      url.pathname === '/api/v1/graph' &&
      (url.searchParams.get('node_types') ?? '').includes('document')
    )
  })
  await page.getByRole('checkbox', { name: 'Include Document', exact: true }).check()
  const typeRequestUrl = await typeRequest
  const typeHash = new URLSearchParams(new URL(page.url()).hash.split('?')[1] ?? '')
  expect(typeHash.get('project')).toBe('7')
  expect(typeHash.get('hide')).toBe('memory')
  expect(typeHash.get('types')?.split(',')).toContain('document')
  expect(new URL(typeRequestUrl.url()).searchParams.get('project_id')).toBe('7')
  await expect(page.getByRole('button', { name: /Change memory/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Change document/ })).toBeVisible()
})

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

test('empty graph overview does not request a focused graph or node detail', async ({ page }) => {
  const requests: URL[] = []
  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/graph') {
      await route.fulfill(
        json({
          nodes: [],
          edges: [],
          meta: {
            memory_count: 0,
            total_memory_count: 0,
            offset: 0,
            limit: 100,
            has_more: false,
            entity_count: 0,
            project_count: 0,
            document_count: 0,
            code_artifact_count: 0,
            file_count: 0,
            skill_count: 0,
            plan_count: 0,
            task_count: 0,
            edge_count: 0,
          },
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'unexpected test request' }, 500))
  })

  await page.goto('/#/graph')
  await expect(page.getByRole('heading', { name: 'Graph overview' })).toBeVisible()
  await expect(page.getByText('No graph records', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to memories' })).toHaveAttribute(
    'href',
    '#/memories',
  )
  expect(requests.some((url) => url.pathname === '/api/v1/graph/subgraph')).toBe(false)
  expect(requests.some((url) => url.pathname === '/api/v1/memories')).toBe(false)
  expect(requests.some((url) => url.pathname.startsWith('/api/v1/memories/'))).toBe(false)
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
  const target = await findStableCopperCentroid(page)
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
