import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../../src/App'
import { deferred, installFetchStub, jsonResponse } from '../helpers/fetchStub'
import { memory, project } from '../helpers/synthetic'

const connectionRoutes = [
  { match: '/health', handler: () => jsonResponse({ status: 'healthy' }) },
  {
    match: '/api/v1/auth/info',
    handler: () => jsonResponse({ authEnabled: false, authMode: 'disabled' }),
  },
]

function projectsRoute() {
  return {
    match: '/api/v1/projects',
    handler: () => jsonResponse({ projects: [project(7, 'Synthetic project')], total: 1 }),
  }
}

describe('Loading and failure states', () => {
  it('shows an API failure and retries the memories request', async () => {
    let attempts = 0
    installFetchStub([
      ...connectionRoutes,
      projectsRoute(),
      {
        match: '/api/v1/memories',
        handler: () => {
          attempts += 1
          if (attempts === 1) return jsonResponse({ error: 'Temporary failure' }, 503)
          return jsonResponse({
            memories: [memory(101, { title: 'Synthetic retry memory' })],
            total: 1,
            limit: 20,
            offset: 0,
          })
        },
      },
    ])

    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load memories')
    expect(alert).toHaveTextContent('Temporary failure')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('link', { name: 'Synthetic retry memory' })).toBeInTheDocument()
    expect(attempts).toBe(2)
  })

  it('shows an honest empty state', async () => {
    installFetchStub([
      ...connectionRoutes,
      projectsRoute(),
      {
        match: '/api/v1/memories',
        handler: () => jsonResponse({ memories: [], total: 0, limit: 20, offset: 0 }),
      },
    ])

    render(<App />)

    expect(await screen.findByText('No memories found')).toBeInTheDocument()
    expect(screen.getByText('0 memories')).toBeInTheDocument()
  })

  it('reports a memory that disappears after the list loads', async () => {
    installFetchStub([
      ...connectionRoutes,
      projectsRoute(),
      {
        match: '/api/v1/memories',
        handler: () =>
          jsonResponse({
            memories: [memory(101, { title: 'Synthetic deleted memory' })],
            total: 1,
            limit: 20,
            offset: 0,
          }),
      },
      {
        match: '/api/v1/memories/101',
        handler: () => jsonResponse({ error: 'Memory not found' }, 404),
      },
    ])

    render(<App />)
    await userEvent
      .setup()
      .click(await screen.findByRole('link', { name: 'Synthetic deleted memory' }))

    expect(await screen.findByText('Memory not found')).toBeInTheDocument()
    expect(screen.getByText(/may have been deleted/)).toBeInTheDocument()
  })

  it('keeps the list usable when the project filter fails', async () => {
    installFetchStub([
      ...connectionRoutes,
      { match: '/api/v1/projects', handler: () => jsonResponse({ error: 'No projects' }, 500) },
      {
        match: '/api/v1/memories',
        handler: () =>
          jsonResponse({
            memories: [memory(101, { title: 'Synthetic filter fallback memory' })],
            total: 1,
            limit: 20,
            offset: 0,
          }),
      },
    ])

    render(<App />)

    expect(
      await screen.findByRole('link', { name: 'Synthetic filter fallback memory' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Project filter unavailable')).toBeInTheDocument()
  })

  it('stops loading and explains when the instance requires sign-in', async () => {
    const fetcher = installFetchStub([
      { match: '/health', handler: () => jsonResponse({ status: 'healthy' }) },
      {
        match: '/api/v1/auth/info',
        handler: () => jsonResponse({ authEnabled: true, authMode: 'bearer' }),
      },
    ])

    render(<App />)

    expect(
      await screen.findByText(/This Forgetful instance reports that authentication is enabled/),
    ).toBeInTheDocument()
    expect(fetcher.requests.some((request) => request.url.pathname === '/api/v1/memories')).toBe(
      false,
    )
  })

  it('shows an unreachable backend instead of a healthy status', async () => {
    installFetchStub([
      { match: '/health', handler: () => jsonResponse({ error: 'down' }, 503) },
      {
        match: '/api/v1/auth/info',
        handler: () => jsonResponse({ authEnabled: false, authMode: 'disabled' }),
      },
      projectsRoute(),
      {
        match: '/api/v1/memories',
        handler: () => jsonResponse({ error: 'Backend offline' }, 503),
      },
    ])

    render(<App />)

    expect(await screen.findByText('Backend unreachable')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Backend offline')
  })

  it('ignores a late detail response for a previous selection', async () => {
    const slowDetail = deferred<Response>()
    const fetcher = installFetchStub([
      ...connectionRoutes,
      projectsRoute(),
      {
        match: '/api/v1/memories',
        handler: () =>
          jsonResponse({
            memories: [
              memory(1, { title: 'Synthetic slow memory' }),
              memory(2, { title: 'Synthetic fast memory' }),
            ],
            total: 2,
            limit: 20,
            offset: 0,
          }),
      },
      {
        match: '/api/v1/memories/1',
        handler: () => slowDetail.promise,
      },
      {
        match: '/api/v1/memories/2',
        handler: () =>
          jsonResponse(
            memory(2, {
              title: 'Synthetic fast memory',
              content: 'Fast detail content.',
            }),
          ),
      },
    ])

    render(<App />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('link', { name: 'Synthetic slow memory' }))
    await waitFor(() => {
      expect(
        fetcher.requests.some((request) => request.url.pathname === '/api/v1/memories/1'),
      ).toBe(true)
    })
    await user.click(screen.getByRole('link', { name: 'Synthetic fast memory' }))
    expect(await screen.findByText('Fast detail content.')).toBeInTheDocument()

    slowDetail.resolve(
      jsonResponse(
        memory(1, {
          title: 'Synthetic slow memory',
          content: 'Stale detail content.',
        }),
      ),
    )
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(screen.queryByText('Stale detail content.')).not.toBeInTheDocument()
    expect(screen.getByText('Fast detail content.')).toBeInTheDocument()
  })

  it('aborts list requests when the screen unmounts', async () => {
    const fetcher = installFetchStub([
      ...connectionRoutes,
      projectsRoute(),
      {
        match: '/api/v1/memories',
        handler: () => deferred<Response>().promise,
      },
    ])

    const view = render(<App />)
    await waitFor(() => {
      expect(fetcher.requests.some((request) => request.url.pathname === '/api/v1/memories')).toBe(
        true,
      )
    })
    const listRequest = fetcher.requests.find(
      (request) => request.url.pathname === '/api/v1/memories',
    )
    expect(listRequest?.signal?.aborted).toBe(false)

    view.unmount()

    expect(listRequest?.signal?.aborted).toBe(true)
  })
})

describe('Refresh controls', () => {
  it('refetches the memory list when refresh is clicked', async () => {
    let requests = 0
    installFetchStub([
      ...connectionRoutes,
      projectsRoute(),
      {
        match: '/api/v1/memories',
        handler: () => {
          requests += 1
          return jsonResponse({
            memories: [memory(101, { title: `Synthetic refresh ${requests}` })],
            total: 1,
            limit: 20,
            offset: 0,
          })
        },
      },
    ])

    render(<App />)
    expect(await screen.findByRole('link', { name: 'Synthetic refresh 1' })).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Refresh memories' }))

    expect(await screen.findByRole('link', { name: 'Synthetic refresh 2' })).toBeInTheDocument()
    expect(requests).toBe(2)
  })
})

describe('Out-of-range pages', () => {
  it('offers first and last page recovery while keeping the project filter', async () => {
    window.history.replaceState(null, '', '/#/memories?page=999&project=7')
    const listRequests: URL[] = []
    installFetchStub([
      ...connectionRoutes,
      projectsRoute(),
      {
        match: '/api/v1/memories',
        handler: (request) => {
          listRequests.push(request.url)
          const offset = Number(request.url.searchParams.get('offset'))
          return jsonResponse({
            memories: offset === 40 ? [memory(101, { title: 'Synthetic last page memory' })] : [],
            total: 45,
            limit: 20,
            offset,
          })
        },
      },
    ])

    render(<App />)

    expect(await screen.findByText('No memories on this page')).toBeInTheDocument()
    expect(screen.getByText('Page 999 is outside the available range (1–3).')).toBeInTheDocument()
    expect(screen.queryByText('This instance has no memories available.')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'First page' }).getAttribute('href')).toBe(
      '#/memories?project=7',
    )
    const lastPage = screen.getByRole('link', { name: 'Last page (3)' })
    expect(lastPage.getAttribute('href')).toBe('#/memories?page=3&project=7')

    await userEvent.setup().click(lastPage)

    expect(
      await screen.findByRole('link', { name: 'Synthetic last page memory' }),
    ).toBeInTheDocument()
    expect(listRequests.at(-1)?.searchParams.get('offset')).toBe('40')
    expect(listRequests.at(-1)?.searchParams.get('project_id')).toBe('7')
  })
})

describe('Authentication messaging and precedence', () => {
  it('prefers an explicit auth requirement over an unhealthy health response', async () => {
    const fetcher = installFetchStub([
      { match: '/health', handler: () => jsonResponse({ error: 'down' }, 503) },
      {
        match: '/api/v1/auth/info',
        handler: () => jsonResponse({ authEnabled: true, authMode: 'bearer' }),
      },
    ])

    render(<App />)

    expect(
      await screen.findByText(/This Forgetful instance reports that authentication is enabled/),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Configure the instance without authentication/),
    ).not.toBeInTheDocument()
    expect(fetcher.requests.some((request) => request.url.pathname === '/api/v1/memories')).toBe(
      false,
    )
  })
})

describe('Access blocking after auth discovery failure', () => {
  it('blocks with an authentication message when data returns 401', async () => {
    const fetcher = installFetchStub([
      { match: '/health', handler: () => jsonResponse({ status: 'healthy' }) },
      { match: '/api/v1/auth/info', handler: () => jsonResponse({ error: 'down' }, 500) },
      projectsRoute(),
      {
        match: '/api/v1/memories',
        handler: () => jsonResponse({ error: 'Authentication required' }, 401),
      },
    ])

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Authentication unavailable' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/did not accept the anonymous session/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Refresh memories' })).not.toBeInTheDocument()

    const count = fetcher.requests.filter(
      (request) => request.url.pathname === '/api/v1/memories',
    ).length
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(
      fetcher.requests.filter((request) => request.url.pathname === '/api/v1/memories').length,
    ).toBe(count)
  })

  it('reports access denied for 403 without claiming sign-in will fix it', async () => {
    installFetchStub([
      { match: '/health', handler: () => jsonResponse({ status: 'healthy' }) },
      { match: '/api/v1/auth/info', handler: () => jsonResponse({ error: 'down' }, 500) },
      projectsRoute(),
      {
        match: '/api/v1/memories',
        handler: () => jsonResponse({ error: 'Forbidden' }, 403),
      },
    ])

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument()
    expect(screen.queryByText(/sign-in/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })
})
