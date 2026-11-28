import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App'
import {
  type FetchStub,
  installFetchStub,
  jsonResponse,
  type RouteStub,
} from '../helpers/fetchStub'

// jsdom has no ResizeObserver; the canvas only observes its container.
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = (): void => {}
      unobserve = (): void => {}
      disconnect = (): void => {}
    },
  )
})

describe('Graph overview route', () => {
  it('loads an empty overview without requesting a focused graph or memory list', async () => {
    window.history.replaceState(null, '', '/#/graph')
    const fetchStub = installFetchStub([
      { match: '/health', handler: () => jsonResponse({ status: 'healthy' }) },
      {
        match: '/api/v1/auth/info',
        handler: () => jsonResponse({ authEnabled: false, authMode: 'disabled' }),
      },
      {
        match: '/.well-known',
        handler: () =>
          jsonResponse({
            schema_version: 1,
            capabilities: { planning: true, skills: true, files: true, activity_stream: false },
          }),
      },
      {
        match: '/api/v1/graph',
        handler: () =>
          jsonResponse({
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
      },
    ])

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Graph overview' })).toBeInTheDocument()
    expect(await screen.findByText('No graph records')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to memories' })).toHaveAttribute(
      'href',
      '#/memories',
    )
    expect(fetchStub.requests.some((request) => request.url.pathname === '/api/v1/memories')).toBe(
      false,
    )
    expect(
      fetchStub.requests.some((request) => request.url.pathname === '/api/v1/graph/subgraph'),
    ).toBe(false)
  })

  it('focuses an entity node from the overview', async () => {
    window.history.replaceState(null, '', '/#/graph?types=entity')
    const fetcher = installFetchStub([
      { match: '/health', handler: () => jsonResponse({ status: 'healthy' }) },
      {
        match: '/api/v1/auth/info',
        handler: () => jsonResponse({ authEnabled: false, authMode: 'disabled' }),
      },
      {
        match: '/.well-known',
        handler: () =>
          jsonResponse({
            schema_version: 1,
            capabilities: { planning: true, skills: true, files: true, activity_stream: false },
          }),
      },
      {
        match: '/api/v1/graph',
        handler: () =>
          jsonResponse({
            nodes: [
              {
                id: 'memory_1',
                type: 'memory',
                label: 'Overview memory',
                data: { id: 1, importance: 5 },
              },
              {
                id: 'entity_9',
                type: 'entity',
                label: 'Overview entity',
                data: { id: 9, name: 'Overview entity', entity_type: 'System' },
              },
            ],
            edges: [
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
              project_count: 0,
              document_count: 0,
              code_artifact_count: 0,
              file_count: 0,
              skill_count: 0,
              plan_count: 0,
              task_count: 0,
              edge_count: 1,
            },
          }),
      },
      {
        match: '/api/v1/entities/9',
        handler: () =>
          jsonResponse({ id: 9, name: 'Overview entity', entity_type: 'System', notes: null }),
      },
    ])

    render(<App />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Overview entity/ }))

    const focus = await screen.findByRole('link', { name: 'Focus neighbourhood' })
    expect(focus).toHaveAttribute('href', '#/graph?node=entity_9&types=memory%2Cproject%2Centity')
    expect(
      fetcher.requests.some((request) => request.url.pathname === '/api/v1/graph/subgraph'),
    ).toBe(false)

    await user.click(focus)
    expect(await screen.findByRole('heading', { name: 'Graph around entity #9' })).toBeVisible()
    const subgraph = subgraphRequest(fetcher)
    expect(subgraph?.url.searchParams.get('node_id')).toBe('entity_9')
  })

  it('focuses a node from a canonical node reference', async () => {
    window.history.replaceState(null, '', '/#/graph?node=entity_9')
    const fetcher = installFetchStub(graphFocusRoutes())

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Graph around entity #9' })).toBeVisible()
    expect(subgraphRequest(fetcher)?.url.searchParams.get('node_id')).toBe('entity_9')
    expect(screen.getByRole('link', { name: 'Back to memories' })).toHaveAttribute(
      'href',
      '#/memories',
    )
    expect(screen.getByRole('link', { name: 'Depth 2' })).toHaveAttribute(
      'href',
      '#/graph?node=entity_9&depth=2',
    )
  })

  it('still accepts the memory parameter on older links', async () => {
    window.history.replaceState(null, '', '/#/graph?memory=5')
    const fetcher = installFetchStub(graphFocusRoutes())

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Graph around memory #5' })).toBeVisible()
    expect(subgraphRequest(fetcher)?.url.searchParams.get('node_id')).toBe('memory_5')
    expect(screen.getByRole('link', { name: 'Back to memory' })).toHaveAttribute(
      'href',
      '#/memories/5',
    )
  })
})

function subgraphRequest(fetcher: FetchStub) {
  return fetcher.requests.find((request) => request.url.pathname === '/api/v1/graph/subgraph')
}

// A focused view needs the subgraph, the centre record, and the shell routes.
function graphFocusRoutes(): RouteStub[] {
  return [
    { match: '/health', handler: () => jsonResponse({ status: 'healthy' }) },
    {
      match: '/api/v1/auth/info',
      handler: () => jsonResponse({ authEnabled: false, authMode: 'disabled' }),
    },
    {
      match: '/.well-known',
      handler: () =>
        jsonResponse({
          schema_version: 1,
          capabilities: { planning: true, skills: true, files: true, activity_stream: false },
        }),
    },
    {
      match: '/api/v1/graph/subgraph',
      handler: () =>
        jsonResponse({
          nodes: [
            {
              id: 'entity_9',
              type: 'entity',
              label: 'Overview entity',
              depth: 0,
              data: { id: 9, name: 'Overview entity', entity_type: 'System' },
            },
            {
              id: 'memory_5',
              type: 'memory',
              label: 'Linked memory',
              depth: 1,
              data: { id: 5, importance: 4 },
            },
          ],
          edges: [],
          meta: {
            center_node_id: 'entity_9',
            depth: 1,
            node_types: [],
            max_nodes: 100,
            edge_count: 0,
            truncated: false,
          },
        }),
    },
    {
      match: /^\/api\/v1\/entities\/\d+$/,
      handler: () =>
        jsonResponse({ id: 9, name: 'Overview entity', entity_type: 'System', notes: null }),
    },
    {
      match: /^\/api\/v1\/memories\/\d+$/,
      handler: () =>
        jsonResponse({
          id: 5,
          title: 'Linked memory',
          content: 'Content.',
          importance: 4,
          tags: [],
        }),
    },
  ]
}
