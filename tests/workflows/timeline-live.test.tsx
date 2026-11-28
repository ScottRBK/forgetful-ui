import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App'
import { installEventSourceMock } from '../helpers/eventSourceMock'
import { installFetchStub, jsonResponse } from '../helpers/fetchStub'

const connectionRoutes = [
  { match: '/health', handler: () => jsonResponse({ status: 'healthy' }) },
  {
    match: '/api/v1/auth/info',
    handler: () => jsonResponse({ authEnabled: false, authMode: 'disabled' }),
  },
]

function capabilitiesRoute(activityStream: boolean) {
  return {
    match: '/.well-known',
    handler: () =>
      jsonResponse({
        schema_version: 1,
        capabilities: {
          planning: false,
          skills: false,
          files: false,
          activity_stream: activityStream,
        },
      }),
  }
}

const historicalEvent = {
  id: 77,
  entity_type: 'memory',
  entity_id: 901,
  action: 'updated',
  snapshot: { title: 'Historical title' },
  actor: 'user',
  created_at: '2026-01-03T00:00:00Z',
}

const liveEvent = {
  id: 88,
  seq: 11,
  entity_type: 'memory',
  entity_id: 902,
  action: 'created',
  snapshot: { title: 'Live title' },
  actor: 'stream',
  created_at: '2026-01-04T00:00:00Z',
}

function activityRoute(events = [historicalEvent], total = 1) {
  return {
    match: '/api/v1/activity',
    handler: (request: { url: URL }) =>
      jsonResponse({
        events,
        total,
        limit: Number(request.url.searchParams.get('limit') ?? 20),
        offset: Number(request.url.searchParams.get('offset') ?? 0),
      }),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Timeline live activity stream', () => {
  it('does not connect when activity_stream is false', async () => {
    window.history.replaceState(null, '', '/#/timeline')
    const eventSource = installEventSourceMock()
    installFetchStub([...connectionRoutes, capabilitiesRoute(false), activityRoute()])

    render(<App />)

    await screen.findByText('updated memory #901')
    expect(eventSource.instances).toHaveLength(0)
    expect(screen.getByText(/Live streaming is unavailable on this backend/i)).toBeInTheDocument()
  })

  it('prepends live events on page 1 and deduplicates ids', async () => {
    window.history.replaceState(null, '', '/#/timeline')
    const eventSource = installEventSourceMock()
    installFetchStub([...connectionRoutes, capabilitiesRoute(true), activityRoute()])

    render(<App />)

    await screen.findByText('updated memory #901')
    const source = eventSource.last()
    expect(source).toBeDefined()
    expect(source?.url).toContain('/api/v1/activity/stream')
    source?.dispatch('open')
    source?.dispatch('activity', JSON.stringify(liveEvent))
    await screen.findByText('created memory #902')
    expect(screen.getByText('2 events')).toBeInTheDocument()

    source?.dispatch('activity', JSON.stringify({ ...liveEvent, id: 88 }))
    expect(screen.getAllByText(/created memory #902/)).toHaveLength(1)
    expect(screen.getByText('2 events')).toBeInTheDocument()
  })

  it('reopens the stream when filters change', async () => {
    window.history.replaceState(null, '', '/#/timeline')
    const eventSource = installEventSourceMock()
    installFetchStub([...connectionRoutes, capabilitiesRoute(true), activityRoute()])

    render(<App />)
    await screen.findByText('updated memory #901')
    const first = eventSource.last()
    expect(first?.url).not.toContain('entity_type=')

    await userEvent.selectOptions(screen.getByLabelText('Entity type filter'), 'memory')
    await waitFor(() => expect(eventSource.instances.length).toBeGreaterThan(1))
    const second = eventSource.last()
    expect(first?.closed).toBe(true)
    expect(second?.url).toContain('entity_type=memory')
  })

  it('closes the stream while paused and reconnects on resume', async () => {
    window.history.replaceState(null, '', '/#/timeline')
    const eventSource = installEventSourceMock()
    installFetchStub([...connectionRoutes, capabilitiesRoute(true), activityRoute()])

    render(<App />)
    await screen.findByText('updated memory #901')
    const connected = eventSource.last()
    expect(connected).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: 'Pause live stream' }))
    await waitFor(() => expect(connected?.closed).toBe(true))
    expect(screen.getByText('Live stream paused')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Resume live stream' }))
    await waitFor(() => expect(eventSource.instances.length).toBe(2))
    expect(eventSource.last()?.closed).toBe(false)
  })

  it('shows a pending banner on page 2 without mutating the list', async () => {
    window.history.replaceState(null, '', '/#/timeline?page=2')
    const eventSource = installEventSourceMock()
    const pageTwoEvent = {
      ...historicalEvent,
      id: 78,
      entity_id: 902,
      action: 'read',
    }
    installFetchStub([
      ...connectionRoutes,
      capabilitiesRoute(true),
      {
        match: '/api/v1/activity',
        handler: (request) => {
          const offset = Number(request.url.searchParams.get('offset') ?? 0)
          const events = offset === 0 ? [historicalEvent] : [pageTwoEvent]
          return jsonResponse({
            events,
            total: 25,
            limit: 20,
            offset,
          })
        },
      },
    ])

    render(<App />)
    await screen.findByText('read memory #902')
    const source = eventSource.last()
    source?.dispatch('open')
    source?.dispatch('activity', JSON.stringify(liveEvent))
    expect(screen.queryByText('created memory #902')).not.toBeInTheDocument()
    expect(await screen.findByText(/1 new live event/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Jump to page 1' }))
    await waitFor(() => expect(screen.queryByText(/new live event/)).not.toBeInTheDocument())
  })

  it('triggers catch-up GET when a sequence gap is detected on page 1', async () => {
    window.history.replaceState(null, '', '/#/timeline')
    const eventSource = installEventSourceMock()
    const requests: URL[] = []
    const catchUpEvent = {
      ...liveEvent,
      id: 89,
      seq: 12,
    }
    installFetchStub([
      ...connectionRoutes,
      capabilitiesRoute(true),
      {
        match: '/api/v1/activity',
        handler: (request) => {
          requests.push(request.url)
          return jsonResponse({
            events: requests.length > 1 ? [catchUpEvent, historicalEvent] : [historicalEvent],
            total: requests.length > 1 ? 2 : 1,
            limit: Number(request.url.searchParams.get('limit') ?? 20),
            offset: Number(request.url.searchParams.get('offset') ?? 0),
          })
        },
      },
    ])

    render(<App />)
    await screen.findByText('updated memory #901')
    const source = eventSource.last()
    source?.dispatch('open')
    source?.dispatch('activity', JSON.stringify({ ...liveEvent, seq: 10 }))
    source?.dispatch('activity', JSON.stringify({ ...liveEvent, seq: 12 }))
    await waitFor(() =>
      expect(requests.filter((url) => url.pathname === '/api/v1/activity').length).toBeGreaterThan(
        1,
      ),
    )
    await screen.findByText('created memory #902')
  })

  it('closes EventSource on unmount', async () => {
    window.history.replaceState(null, '', '/#/timeline')
    const eventSource = installEventSourceMock()
    installFetchStub([...connectionRoutes, capabilitiesRoute(true), activityRoute()])

    const view = render(<App />)
    await screen.findByText('updated memory #901')
    const source = eventSource.last()
    expect(source?.closed).toBe(false)
    view.unmount()
    expect(source?.closed).toBe(true)
  })
})
