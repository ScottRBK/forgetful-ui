import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../../src/App'
import { installFetchStub, jsonResponse, pagedResponse, type RouteStub } from '../helpers/fetchStub'
import { memory, project } from '../helpers/synthetic'

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

describe('Memory list filters from #214', () => {
  it('round-trips search, range, and max importance through the URL and API', async () => {
    window.history.replaceState(null, '', '/#/memories?page=2&project=7')
    const fetcher = installFetchStub([
      ...connectionRoutes,
      {
        match: '/api/v1/memories',
        handler: () =>
          jsonResponse({
            memories: [memory(101, { title: 'Synthetic filter row' })],
            total: 1,
            limit: 20,
            offset: 0,
          }),
      },
    ])

    render(<App />)
    expect(await screen.findByRole('link', { name: 'Synthetic filter row' })).toBeInTheDocument()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Search memories'), 'teal notes')
    await user.click(screen.getByRole('button', { name: 'Apply search' }))
    await waitFor(() => {
      expect(memoryRequest(fetcher)?.url.searchParams.get('q')).toBe('teal notes')
    })
    expect(memoryRequest(fetcher)?.url.searchParams.get('offset')).toBe('0')
    expect(window.location.hash).toContain('q=teal+notes')

    await user.selectOptions(screen.getByLabelText('Maximum importance'), '8')
    await waitFor(() => {
      expect(memoryRequest(fetcher)?.url.searchParams.get('importance_max')).toBe('8')
    })
    expect(window.location.hash).toContain('max=8')
  })

  it('rejects an updated range when from is after to without calling the API', async () => {
    window.history.replaceState(null, '', '/#/memories')
    const fetcher = installFetchStub([
      ...connectionRoutes,
      {
        match: '/api/v1/memories',
        handler: () =>
          jsonResponse({
            memories: [memory(101, { title: 'Synthetic range guard' })],
            total: 1,
            limit: 20,
            offset: 0,
          }),
      },
    ])

    render(<App />)
    await screen.findByRole('link', { name: 'Synthetic range guard' })
    const before = fetcher.requests.length

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Updated from'), '2026-06-01T12:00')
    await user.type(screen.getByLabelText('Updated to'), '2026-01-01T12:00')
    await user.click(screen.getByRole('button', { name: 'Apply updated range' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Updated from must not be after updated to.',
    )
    expect(fetcher.requests.length).toBe(before)
  })

  it('sorts by title and project with URL params sort=title and sort=project', async () => {
    window.history.replaceState(null, '', '/#/memories')
    const fetcher = installFetchStub([
      ...connectionRoutes,
      {
        match: '/api/v1/memories',
        handler: () =>
          jsonResponse({
            memories: [memory(101, { title: 'Synthetic sort targets' })],
            total: 1,
            limit: 20,
            offset: 0,
          }),
      },
    ])

    render(<App />)
    expect(await screen.findByRole('link', { name: 'Synthetic sort targets' })).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Memory' }))
    await waitFor(() => {
      expect(memoryRequest(fetcher)?.url.searchParams.get('sort_by')).toBe('title')
    })
    expect(window.location.hash).toBe('#/memories?sort=title')

    await user.click(screen.getByRole('button', { name: 'Project' }))
    await waitFor(() => {
      expect(memoryRequest(fetcher)?.url.searchParams.get('sort_by')).toBe('project_name')
    })
    expect(window.location.hash).toBe('#/memories?sort=project')
  })

  it('clears an empty search q and does not send q to the API', async () => {
    window.history.replaceState(null, '', '/#/memories?q=hello')
    const fetcher = installFetchStub([
      ...connectionRoutes,
      {
        match: '/api/v1/memories',
        handler: () =>
          jsonResponse({
            memories: [memory(101, { title: 'Synthetic empty search' })],
            total: 1,
            limit: 20,
            offset: 0,
          }),
      },
    ])

    render(<App />)
    await screen.findByRole('link', { name: 'Synthetic empty search' })
    expect(memoryRequest(fetcher)?.url.searchParams.get('q')).toBe('hello')

    const user = userEvent.setup()
    await user.clear(screen.getByLabelText('Search memories'))
    await user.click(screen.getByRole('button', { name: 'Apply search' }))
    await waitFor(() => {
      expect(memoryRequest(fetcher)?.url.searchParams.has('q')).toBe(false)
    })
    expect(window.location.hash).toBe('#/memories')
  })
})
