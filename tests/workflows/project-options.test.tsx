import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../../src/App'
import {
  deferred,
  installFetchStub,
  jsonResponse,
  pagedResponse,
  type StubRequest,
} from '../helpers/fetchStub'
import { memory, project } from '../helpers/synthetic'

const connectionRoutes = [
  { match: '/health', handler: () => jsonResponse({ status: 'healthy' }) },
  {
    match: '/api/v1/auth/info',
    handler: () => jsonResponse({ authEnabled: false, authMode: 'disabled' }),
  },
]

const projects = Array.from({ length: 205 }, (_, index) => {
  const id = 1205 - index
  return project(id, `Synthetic project ${id}`)
})

function memoriesRoute() {
  return {
    match: '/api/v1/memories',
    handler: () =>
      jsonResponse({
        memories: [memory(101, { title: 'Synthetic options memory' })],
        total: 1,
        limit: 20,
        offset: 0,
      }),
  }
}

function projectRequests(fetcher: ReturnType<typeof installFetchStub>) {
  return fetcher.requests.filter((request) => request.url.pathname === '/api/v1/projects')
}

function projectPage(
  request: StubRequest,
  overrides: { item?: (item: (typeof projects)[number]) => unknown; total?: number } = {},
) {
  const limit = Number(request.url.searchParams.get('limit') ?? 20)
  const offset = Number(request.url.searchParams.get('offset') ?? 0)
  const page = projects
    .slice(offset, offset + limit)
    .map((item) => (overrides.item ? overrides.item(item) : item))
  return jsonResponse({
    projects: page,
    total: overrides.total ?? projects.length,
    limit,
    offset,
  })
}

describe('Complete project filter options', () => {
  it('loads every summary page and keeps a selected project from the last page', async () => {
    window.history.replaceState(null, '', '/#/memories?project=1001')
    const fetcher = installFetchStub([
      ...connectionRoutes,
      {
        match: '/api/v1/projects',
        handler: (request) => pagedResponse(projects, request, 'projects'),
      },
      memoriesRoute(),
    ])

    render(<App />)

    const select = (await screen.findByLabelText('Project filter')) as HTMLSelectElement
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Project filter' })).toHaveValue('1001'),
    )
    await waitFor(() => expect(select.querySelectorAll('option')).toHaveLength(206))
    expect(select.selectedOptions[0]?.textContent).toBe('Synthetic project 1001')

    const requests = projectRequests(fetcher)
    expect(requests.map((request) => request.url.searchParams.get('limit'))).toEqual([
      '100',
      '100',
      '100',
    ])
    expect(requests.map((request) => request.url.searchParams.get('offset'))).toEqual([
      '0',
      '100',
      '200',
    ])
  })

  it('shows no partial choices and retries from zero after a later page fails', async () => {
    window.history.replaceState(null, '', '/#/memories?project=1001')
    let failLaterPage = true
    const fetcher = installFetchStub([
      ...connectionRoutes,
      {
        match: '/api/v1/projects',
        handler: (request) => {
          const offset = Number(request.url.searchParams.get('offset') ?? 0)
          if (failLaterPage && offset > 0) {
            return jsonResponse({ error: 'Synthetic options failure' }, 503)
          }
          return pagedResponse(projects, request, 'projects')
        },
      },
      memoriesRoute(),
    ])

    render(<App />)

    expect(await screen.findByText('Project filter unavailable')).toBeInTheDocument()
    const select = screen.getByLabelText('Project filter') as HTMLSelectElement
    expect(select.querySelectorAll('option')).toHaveLength(2)
    expect(
      projectRequests(fetcher).map((request) => request.url.searchParams.get('offset')),
    ).toEqual(['0', '100'])

    failLaterPage = false
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry project options' }))

    await waitFor(() => expect(select.querySelectorAll('option')).toHaveLength(206))
    expect(select.selectedOptions[0]?.textContent).toBe('Synthetic project 1001')
    expect(screen.queryByText('Project filter unavailable')).not.toBeInTheDocument()
    expect(
      projectRequests(fetcher).map((request) => request.url.searchParams.get('offset')),
    ).toEqual(['0', '100', '0', '100', '200'])
  })

  it('rejects a malformed project summary instead of offering a partial choice', async () => {
    window.history.replaceState(null, '', '/#/memories?project=1001')
    installFetchStub([
      ...connectionRoutes,
      {
        match: '/api/v1/projects',
        handler: (request) =>
          projectPage(request, {
            item: (item) => (item.id === 1105 ? { ...item, id: 'bad' } : item),
          }),
      },
      memoriesRoute(),
    ])

    render(<App />)

    expect(await screen.findByText('Project filter unavailable')).toBeInTheDocument()
    expect(screen.getByLabelText('Project filter').querySelectorAll('option')).toHaveLength(2)
  })

  it('rejects a changed total instead of offering a partial choice', async () => {
    window.history.replaceState(null, '', '/#/memories?project=1001')
    installFetchStub([
      ...connectionRoutes,
      {
        match: '/api/v1/projects',
        handler: (request) =>
          projectPage(request, {
            total:
              Number(request.url.searchParams.get('offset') ?? 0) === 0
                ? projects.length
                : projects.length - 1,
          }),
      },
      memoriesRoute(),
    ])

    render(<App />)

    expect(await screen.findByText('Project filter unavailable')).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: 'Project filter' }).querySelectorAll('option'),
    ).toHaveLength(2)
  })

  it('does not reload project options when the memory page changes', async () => {
    window.history.replaceState(null, '', '/#/memories?project=1001')
    let memoryOffset = 0
    const fetcher = installFetchStub([
      ...connectionRoutes,
      {
        match: '/api/v1/projects',
        handler: (request) => pagedResponse(projects, request, 'projects'),
      },
      {
        match: '/api/v1/memories',
        handler: () => {
          const body = {
            memories: [memory(101, { title: `Synthetic page ${memoryOffset}` })],
            total: 45,
            limit: 20,
            offset: memoryOffset,
          }
          return jsonResponse(body)
        },
      },
    ])

    render(<App />)

    await screen.findByText('Synthetic page 0')
    await waitFor(() =>
      expect(screen.getByLabelText('Project filter').querySelectorAll('option')).toHaveLength(206),
    )
    const optionsRequestsBefore = projectRequests(fetcher).length

    memoryOffset = 20
    await userEvent.setup().click(screen.getByRole('link', { name: 'Next page' }))
    expect(await screen.findByText('Synthetic page 20')).toBeInTheDocument()

    expect(projectRequests(fetcher)).toHaveLength(optionsRequestsBefore)
  })

  it('cancels pending project option pages when its screen closes', async () => {
    window.history.replaceState(null, '', '/#/memories')
    const gate = deferred<Response>()
    const fetcher = installFetchStub([
      ...connectionRoutes,
      { match: '/api/v1/projects', handler: () => gate.promise },
      memoriesRoute(),
    ])

    render(<App />)

    await screen.findByText('Synthetic options memory')
    const request = fetcher.requests.find((item) => item.url.pathname === '/api/v1/projects')
    expect(request).toBeDefined()
    await userEvent.setup().click(screen.getByRole('link', { name: 'Dashboard' }))
    await waitFor(() => expect(request?.signal?.aborted).toBe(true))
    gate.resolve(jsonResponse({ projects: [], total: 0, limit: 100, offset: 0 }))
  })
})
