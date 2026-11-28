import { expect, type Page, test } from '@playwright/test'

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

const historicalEvent = {
  id: 77,
  entity_type: 'memory',
  entity_id: 901,
  action: 'updated',
  snapshot: { id: 901, title: 'Historical title' },
  actor: 'user',
  created_at: '2026-01-03T00:00:00Z',
}

const liveEvent = {
  id: 88,
  seq: 2,
  entity_type: 'memory',
  entity_id: 902,
  action: 'created',
  snapshot: { id: 902, title: 'Streamed live title' },
  actor: 'stream',
  created_at: '2026-01-04T00:00:00Z',
}

const pageTwoEvent = {
  id: 78,
  entity_type: 'memory',
  entity_id: 903,
  action: 'read',
  snapshot: { id: 903, title: 'Paged historical title' },
  actor: 'user',
  created_at: '2026-01-02T00:00:00Z',
}

async function installTimelineLiveApi(page: Page) {
  const nonGet: string[] = []
  const requests: URL[] = []
  let streamCount = 0
  const streamEvents = [
    liveEvent,
    {
      ...liveEvent,
      id: 99,
      seq: 3,
      entity_id: 904,
      action: 'deleted',
      snapshot: { id: 904, title: 'Second stream event' },
    },
  ]

  page.on('request', (request) => {
    const method = request.method()
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      nonGet.push(`${method} ${request.url()}`)
    }
    requests.push(new URL(request.url()))
  })

  await page.route('**/health', (route) =>
    route.fulfill(json({ status: 'healthy', service: 'Forgetful' })),
  )
  await page.route('**/.well-known', (route) =>
    route.fulfill(
      json({
        schema_version: 1,
        capabilities: { planning: false, skills: false, files: false, activity_stream: true },
      }),
    ),
  )
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/auth/info') {
      await route.fulfill(json({ authEnabled: false, authMode: 'disabled' }))
      return
    }
    if (url.pathname === '/api/v1/activity/stream') {
      const payload = streamEvents[Math.min(streamCount, streamEvents.length - 1)]
      streamCount += 1
      const body = `event: activity\ndata: ${JSON.stringify(payload)}\n\n`
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body,
      })
      return
    }
    if (url.pathname === '/api/v1/activity') {
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const events = offset === 0 ? [historicalEvent] : [pageTwoEvent]
      await route.fulfill(
        json({
          events,
          total: 25,
          limit: Number(url.searchParams.get('limit') ?? 20),
          offset,
        }),
      )
      return
    }
    await route.fulfill(json({ error: 'Unexpected test request' }, 500))
  })

  return { nonGet, requests }
}

test('timeline live stream is GET-only and updates the UI', async ({ page }) => {
  const { nonGet } = await installTimelineLiveApi(page)

  await page.goto('/#/timeline')
  await expect(page.getByRole('heading', { name: 'Timeline', level: 1 })).toBeVisible()
  await expect(page.getByText('Live activity stream')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('created memory #902')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('updated memory #901')).toBeVisible()

  const pause = page.getByRole('button', { name: 'Pause live stream' })
  await expect(pause).toBeVisible()
  await pause.click()
  await expect(page.getByText('Live stream paused')).toBeVisible()
  await page.getByRole('link', { name: 'Page 2' }).click()
  await expect(page).toHaveURL(/#\/timeline\?page=2$/)
  await expect(page.getByText('read memory #903')).toBeVisible()
  await page.getByRole('button', { name: 'Resume live stream' }).click()
  await expect(page.getByText(/1 new live event/)).toBeVisible({ timeout: 10_000 })

  expect(nonGet).toEqual([])
})
