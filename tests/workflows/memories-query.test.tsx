import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App'
import {
  deferred,
  installFetchStub,
  jsonResponse,
  pagedResponse,
  type RouteStub,
} from '../helpers/fetchStub'
import { memory, project, subgraph } from '../helpers/synthetic'

const connectionRoutes: RouteStub[] = [
  { match: '/health', handler: () => jsonResponse({ status: 'healthy' }) },
  {
    match: '/api/v1/auth/info',
    handler: () => jsonResponse({ authEnabled: false, authMode: 'disabled' }),
  },
  {
    match: '/api/v1/projects',
    handler: (request) => pagedResponse([project(7, 'Synthetic project')], request, 'projects'),
  },
]

function memoryRequest(fetcher: ReturnType<typeof installFetchStub>) {
  return fetcher.requests.filter((request) => request.url.pathname === '/api/v1/memories').at(-1)
}

describe('Supported memory sorting and filtering', () => {
  it('defaults to updated desc and toggles supported column headers', async () => {
    window.history.replaceState(null, '', '/#/memories?page=2&project=7')
    const fetcher = installFetchStub([
      ...connectionRoutes,
      {
        match: '/api/v1/memories',
        handler: () =>
          jsonResponse({
            memories: [memory(101, { title: 'Synthetic sorted memory' })],
            total: 45,
            limit: 20,
            offset: 0,
          }),
      },
    ])

    render(<App />)
    expect(await screen.findByRole('link', { name: 'Synthetic sorted memory' })).toBeInTheDocument()
    const updatedHeader = screen.getByRole('columnheader', { name: /Updated/ })
    const importanceHeader = screen.getByRole('columnheader', { name: /Importance/ })
    expect(updatedHeader).toHaveAttribute('aria-sort', 'descending')
    expect(importanceHeader).toHaveAttribute('aria-sort', 'none')
    expect(memoryRequest(fetcher)?.url.searchParams.get('sort_by')).toBe('updated_at')
    expect(memoryRequest(fetcher)?.url.searchParams.get('sort_order')).toBe('desc')
    expect(memoryRequest(fetcher)?.url.searchParams.get('offset')).toBe('20')

    const user = userEvent.setup()
    await user.click(within(importanceHeader).getByRole('button', { name: /Importance/ }))
    await waitFor(() => {
      expect(memoryRequest(fetcher)?.url.searchParams.get('sort_by')).toBe('importance')
    })
    expect(memoryRequest(fetcher)?.url.searchParams.get('sort_order')).toBe('desc')
    expect(memoryRequest(fetcher)?.url.searchParams.get('offset')).toBe('0')
    expect(window.location.hash).toBe('#/memories?sort=importance&project=7')
    expect(importanceHeader).toHaveAttribute('aria-sort', 'descending')
    expect(updatedHeader).toHaveAttribute('aria-sort', 'none')

    await user.click(within(importanceHeader).getByRole('button', { name: /Importance/ }))
    await waitFor(() => {
      expect(memoryRequest(fetcher)?.url.searchParams.get('sort_order')).toBe('asc')
    })
    expect(window.location.hash).toBe('#/memories?sort=importance&order=asc&project=7')
    expect(importanceHeader).toHaveAttribute('aria-sort', 'ascending')

    await user.click(within(updatedHeader).getByRole('button', { name: /Updated/ }))
    await waitFor(() => {
      expect(memoryRequest(fetcher)?.url.searchParams.get('sort_by')).toBe('updated_at')
    })
    expect(window.location.hash).toBe('#/memories?project=7')
    expect(updatedHeader).toHaveAttribute('aria-sort', 'descending')
  })

  it('applies a minimum-importance filter and clears filters while keeping sort', async () => {
    window.history.replaceState(null, '', '/#/memories?page=2&project=7&sort=importance&order=asc')
    const fetcher = installFetchStub([
      ...connectionRoutes,
      {
        match: '/api/v1/memories',
        handler: () =>
          jsonResponse({
            memories: [memory(101, { title: 'Synthetic filtered memory' })],
            total: 1,
            limit: 20,
            offset: 0,
          }),
      },
    ])

    render(<App />)
    expect(
      await screen.findByRole('link', { name: 'Synthetic filtered memory' }),
    ).toBeInTheDocument()

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Minimum importance'), '7')
    await waitFor(() => {
      expect(memoryRequest(fetcher)?.url.searchParams.get('importance_min')).toBe('7')
    })
    expect(memoryRequest(fetcher)?.url.searchParams.get('offset')).toBe('0')
    expect(memoryRequest(fetcher)?.url.searchParams.get('sort_by')).toBe('importance')
    expect(memoryRequest(fetcher)?.url.searchParams.get('sort_order')).toBe('asc')
    expect(window.location.hash).toBe('#/memories?sort=importance&order=asc&project=7&importance=7')
    expect(
      screen.getByRole('link', { name: 'Synthetic filtered memory' }).getAttribute('href'),
    ).toBe('#/memories/101?sort=importance&order=asc&project=7&importance=7')

    const clear = screen.getByRole('link', { name: 'Clear filters' })
    expect(clear).toHaveAttribute('href', '#/memories?sort=importance&order=asc')

    await user.click(screen.getByRole('button', { name: 'Refresh memories' }))
    await waitFor(() => {
      expect(memoryRequest(fetcher)?.url.searchParams.get('importance_min')).toBe('7')
    })
    expect(memoryRequest(fetcher)?.url.searchParams.get('sort_by')).toBe('importance')
    expect(memoryRequest(fetcher)?.url.searchParams.get('sort_order')).toBe('asc')
    expect(memoryRequest(fetcher)?.url.searchParams.get('project_id')).toBe('7')
  })

  it('renders bounded numbered pages and preserves sort/filter context', async () => {
    window.history.replaceState(
      null,
      '',
      '/#/memories?page=42&project=7&sort=importance&order=asc&importance=8',
    )
    const fetcher = installFetchStub([
      ...connectionRoutes,
      {
        match: '/api/v1/memories',
        handler: (request) => {
          const offset = Number(request.url.searchParams.get('offset'))
          return jsonResponse({
            memories: [memory(offset + 1, { title: `Synthetic page row ${offset}` })],
            total: 1622,
            limit: 20,
            offset,
          })
        },
      },
    ])

    render(<App />)
    await screen.findByRole('link', { name: 'Synthetic page row 820' })
    const pages = screen.getByRole('navigation', { name: 'Memory pages' })
    expect(within(pages).getByRole('link', { name: 'Page 1' })).toBeInTheDocument()
    expect(within(pages).getByRole('link', { name: 'Page 41' })).toBeInTheDocument()
    expect(within(pages).getByRole('link', { name: 'Page 43' })).toBeInTheDocument()
    expect(within(pages).getByRole('link', { name: 'Page 82' })).toBeInTheDocument()
    expect(within(pages).queryByRole('link', { name: 'Page 40' })).not.toBeInTheDocument()
    expect(within(pages).queryByRole('link', { name: 'Page 42' })).not.toBeInTheDocument()
    expect(within(pages).getByText('42')).toHaveAttribute('aria-current', 'page')

    const user = userEvent.setup()
    await user.click(within(pages).getByRole('link', { name: 'Page 43' }))
    await waitFor(() => {
      expect(memoryRequest(fetcher)?.url.searchParams.get('offset')).toBe('840')
    })
    expect(memoryRequest(fetcher)?.url.searchParams.get('project_id')).toBe('7')
    expect(memoryRequest(fetcher)?.url.searchParams.get('sort_by')).toBe('importance')
    expect(memoryRequest(fetcher)?.url.searchParams.get('sort_order')).toBe('asc')
    expect(memoryRequest(fetcher)?.url.searchParams.get('importance_min')).toBe('8')

    await user.click(within(pages).getByRole('link', { name: 'Page 82' }))
    await waitFor(() => {
      expect(memoryRequest(fetcher)?.url.searchParams.get('offset')).toBe('1620')
    })
  })

  it('ignores a late list response after sort changes', async () => {
    const slowSort = deferred<Response>()
    window.history.replaceState(null, '', '/#/memories')
    installFetchStub([
      ...connectionRoutes,
      {
        match: '/api/v1/memories',
        handler: (request) => {
          const sortBy = request.url.searchParams.get('sort_by')
          const order = request.url.searchParams.get('sort_order')
          if (sortBy === 'importance' && order === 'desc') return slowSort.promise
          if (sortBy === 'importance' && order === 'asc') {
            return jsonResponse({
              memories: [memory(103, { title: 'Synthetic fresh sort' })],
              total: 1,
              limit: 20,
              offset: 0,
            })
          }
          return jsonResponse({
            memories: [memory(101, { title: 'Synthetic initial sort' })],
            total: 1,
            limit: 20,
            offset: 0,
          })
        },
      },
    ])

    render(<App />)
    expect(await screen.findByRole('link', { name: 'Synthetic initial sort' })).toBeInTheDocument()

    window.location.hash = '#/memories?sort=importance'
    await waitFor(() => {
      expect(window.location.hash).toBe('#/memories?sort=importance')
    })
    window.location.hash = '#/memories?sort=importance&order=asc'
    expect(await screen.findByRole('link', { name: 'Synthetic fresh sort' })).toBeInTheDocument()

    slowSort.resolve(
      jsonResponse({
        memories: [memory(102, { title: 'Synthetic stale sort' })],
        total: 1,
        limit: 20,
        offset: 0,
      }),
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByText('Synthetic stale sort')).not.toBeInTheDocument()
    expect(screen.getByText('Synthetic fresh sort')).toBeInTheDocument()
  })
})

describe('Graph filter context', () => {
  // jsdom has no ResizeObserver; the graph canvas only observes its container.
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    )
  })

  const filters = {
    page: '2',
    sort: 'importance',
    order: 'asc',
    project: '7',
    importance: '8',
    max: '8',
    q: 'teal notes',
    from: '2026-01-01T00:00:00.000Z',
    to: '2026-06-01T00:00:00.000Z',
  }
  const listQuery = new URLSearchParams(filters).toString()

  function expectFilterContext(hash: string): void {
    const params = new URLSearchParams(hash.split('?')[1] ?? '')
    for (const [key, value] of Object.entries(filters)) {
      expect(params.get(key), `hash parameter ${key}`).toBe(value)
    }
  }

  it('keeps search, max importance and the updated range through every graph link', async () => {
    window.history.replaceState(null, '', `/#/memories/101?${listQuery}`)
    const fetcher = installFetchStub([
      ...connectionRoutes,
      {
        match: '/.well-known',
        handler: () =>
          jsonResponse({
            schema_version: 1,
            capabilities: { planning: true, skills: true, files: true, activity_stream: false },
          }),
      },
      {
        match: '/api/v1/memories',
        handler: () =>
          jsonResponse({
            memories: [memory(101, { title: 'Synthetic context row' })],
            total: 65,
            limit: 20,
            offset: 20,
          }),
      },
      {
        match: '/api/v1/memories/101',
        handler: () => jsonResponse(memory(101, { title: 'Synthetic context row' })),
      },
      { match: '/api/v1/graph/subgraph', handler: () => jsonResponse(subgraph()) },
      {
        match: '/api/v1/graph',
        handler: () =>
          jsonResponse({
            nodes: [
              {
                id: 'memory_101',
                type: 'memory',
                label: 'Synthetic context row',
                data: { importance: 5 },
              },
            ],
            edges: [],
            meta: {
              memory_count: 1,
              total_memory_count: 1,
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
      },
    ])

    render(<App />)
    await screen.findByRole('heading', { name: 'Synthetic context row' })

    const openGraph = screen.getByRole('link', { name: 'Open graph' })
    const openGraphHref = openGraph.getAttribute('href') ?? ''
    expect(openGraphHref.startsWith('#/graph?memory=101&')).toBe(true)
    expectFilterContext(openGraphHref)

    const user = userEvent.setup()
    await user.click(openGraph)

    const backToMemory = await screen.findByRole('link', { name: 'Back to memory' })
    const backHref = backToMemory.getAttribute('href') ?? ''
    expect(backHref.startsWith('#/memories/101?')).toBe(true)
    expectFilterContext(backHref)
    expectFilterContext(screen.getByRole('link', { name: 'Overview' }).getAttribute('href') ?? '')
    expectFilterContext(screen.getByRole('link', { name: 'Depth 2' }).getAttribute('href') ?? '')

    await user.click(screen.getByRole('link', { name: 'Depth 2' }))
    await waitFor(() => {
      expect(window.location.hash).toContain('depth=2')
    })
    expectFilterContext(window.location.hash)

    await user.click(screen.getByRole('link', { name: 'Overview' }))
    await waitFor(() => {
      expect(window.location.hash.startsWith('#/graph?')).toBe(true)
      expect(window.location.hash).not.toContain('memory=')
    })
    expectFilterContext(window.location.hash)

    await user.click(await screen.findByRole('button', { name: /Synthetic context row/ }))
    const focus = await screen.findByRole('link', { name: 'Focus neighbourhood' })
    const focusHref = focus.getAttribute('href') ?? ''
    expect(focusHref.startsWith('#/graph?memory=101&')).toBe(true)
    expectFilterContext(focusHref)

    await user.click(screen.getByRole('link', { name: 'Back to memories' }))
    await waitFor(() => {
      expect(window.location.hash.startsWith('#/memories?')).toBe(true)
    })
    expectFilterContext(window.location.hash)

    await waitFor(() => {
      expect(memoryRequest(fetcher)?.url.searchParams.get('q')).toBe('teal notes')
    })
    const request = memoryRequest(fetcher)
    expect(request?.url.searchParams.get('offset')).toBe('20')
    expect(request?.url.searchParams.get('project_id')).toBe('7')
    expect(request?.url.searchParams.get('sort_by')).toBe('importance')
    expect(request?.url.searchParams.get('sort_order')).toBe('asc')
    expect(request?.url.searchParams.get('importance_min')).toBe('8')
    expect(request?.url.searchParams.get('importance_max')).toBe('8')
    expect(request?.url.searchParams.get('updated_from')).toBe(filters.from)
    expect(request?.url.searchParams.get('updated_to')).toBe(filters.to)
  })
})
