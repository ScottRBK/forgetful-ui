import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../../src/App'
import { installFetchStub, jsonResponse } from '../helpers/fetchStub'

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
})
