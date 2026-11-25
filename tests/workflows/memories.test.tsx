import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../../src/App'
import { installFetchStub, jsonResponse, pagedResponse } from '../helpers/fetchStub'
import { memory, project } from '../helpers/synthetic'

describe('Memories workflow', () => {
  it('shows the first page of memories and the project filter', async () => {
    window.history.replaceState(null, '', '/#/memories')
    const fetchStub = installFetchStub([
      { match: '/health', handler: () => jsonResponse({ status: 'healthy' }) },
      {
        match: '/api/v1/auth/info',
        handler: () => jsonResponse({ authEnabled: false, authMode: 'disabled' }),
      },
      {
        match: '/api/v1/projects',
        handler: (request) => pagedResponse([project(7, 'Synthetic project')], request, 'projects'),
      },
      {
        match: '/api/v1/memories',
        handler: () =>
          jsonResponse({
            memories: [memory(101, { title: 'Synthetic teal release notes' })],
            total: 21,
            limit: 20,
            offset: 0,
          }),
      },
    ])

    render(<App />)

    expect(
      await screen.findByRole('link', { name: 'Synthetic teal release notes' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Memories' })).toBeInTheDocument()
    expect(screen.getByLabelText('Project filter')).toHaveValue('')
    expect(screen.getByText('21 memories')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh memories' })).toBeInTheDocument()
    expect(fetchStub.requests.some((item) => item.url.pathname === '/api/v1/memories')).toBe(true)
  })
})

describe('Memories filtering and pagination', () => {
  it('resets the offset when the project changes and pages with server totals', async () => {
    window.history.replaceState(null, '', '/#/memories?page=2&project=7')
    const memoryRequests: URL[] = []
    const fetchStub = installFetchStub([
      { match: '/health', handler: () => jsonResponse({ status: 'healthy' }) },
      {
        match: '/api/v1/auth/info',
        handler: () => jsonResponse({ authEnabled: false, authMode: 'disabled' }),
      },
      {
        match: '/api/v1/projects',
        handler: (request) =>
          pagedResponse(
            [project(7, 'Alpha project'), project(9, 'Beta project')],
            request,
            'projects',
          ),
      },
      {
        match: '/api/v1/memories',
        handler: (request) => {
          memoryRequests.push(request.url)
          const projectId = request.url.searchParams.get('project_id')
          const offset = Number(request.url.searchParams.get('offset'))
          return jsonResponse({
            memories: [
              memory(offset + Number(projectId ?? 0), {
                title: `Synthetic page memory ${projectId}-${offset}`,
              }),
            ],
            total: 45,
            limit: 20,
            offset,
          })
        },
      },
    ])

    render(<App />)

    expect(await screen.findByText('Synthetic page memory 7-20')).toBeInTheDocument()
    expect(memoryRequests.at(-1)?.searchParams.get('offset')).toBe('20')
    expect(memoryRequests.at(-1)?.searchParams.get('project_id')).toBe('7')
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Project filter'), '9')

    expect(await screen.findByText('Synthetic page memory 9-0')).toBeInTheDocument()
    expect(memoryRequests.at(-1)?.searchParams.get('offset')).toBe('0')
    expect(memoryRequests.at(-1)?.searchParams.get('project_id')).toBe('9')
    expect(window.location.hash).toBe('#/memories?project=9')

    await user.click(screen.getByRole('link', { name: 'Next page' }))

    expect(await screen.findByText('Synthetic page memory 9-20')).toBeInTheDocument()
    expect(memoryRequests.at(-1)?.searchParams.get('offset')).toBe('20')
    expect(memoryRequests.at(-1)?.searchParams.get('project_id')).toBe('9')
    expect(window.location.hash).toBe('#/memories?page=2&project=9')
    expect(fetchStub.requests.every((request) => request.method === 'GET')).toBe(true)
  })
})

describe('Route context', () => {
  it('keeps a project with id 1 in the URL on memory and graph links', async () => {
    window.history.replaceState(null, '', '/#/memories?project=1')
    const fetchStub = installFetchStub([
      { match: '/health', handler: () => jsonResponse({ status: 'healthy' }) },
      {
        match: '/api/v1/auth/info',
        handler: () => jsonResponse({ authEnabled: false, authMode: 'disabled' }),
      },
      {
        match: '/api/v1/projects',
        handler: (request) => pagedResponse([project(1, 'First project')], request, 'projects'),
      },
      {
        match: '/api/v1/memories',
        handler: (request) => {
          expect(request.url.searchParams.get('project_id')).toBe('1')
          return jsonResponse({
            memories: [memory(101, { title: 'Synthetic project one memory' })],
            total: 1,
            limit: 20,
            offset: 0,
          })
        },
      },
      {
        match: '/api/v1/memories/101',
        handler: () => jsonResponse(memory(101, { title: 'Synthetic project one memory' })),
      },
    ])

    render(<App />)

    const link = await screen.findByRole('link', { name: 'Synthetic project one memory' })
    expect(link).toHaveAttribute('href', '#/memories/101?project=1')
    expect(fetchStub.requests.some((request) => request.method !== 'GET')).toBe(false)

    const user = userEvent.setup()
    await user.click(link)
    expect(await screen.findByRole('link', { name: 'Open graph' })).toHaveAttribute(
      'href',
      '#/graph?memory=101&project=1',
    )
  })
})

describe('Application shell', () => {
  it('only exposes the screens included in this delivery', async () => {
    window.history.replaceState(null, '', '/#/memories')
    installFetchStub([
      { match: '/health', handler: () => jsonResponse({ status: 'healthy' }) },
      {
        match: '/api/v1/auth/info',
        handler: () => jsonResponse({ authEnabled: false, authMode: 'disabled' }),
      },
      {
        match: '/api/v1/projects',
        handler: (request) => pagedResponse([], request, 'projects'),
      },
      {
        match: '/api/v1/memories',
        handler: () =>
          jsonResponse({
            memories: [memory(101, { title: 'Synthetic shell memory' })],
            total: 1,
            limit: 20,
            offset: 0,
          }),
      },
    ])

    render(<App />)

    const navigation = await screen.findByRole('navigation', { name: 'Main navigation' })
    for (const label of [
      'Dashboard',
      'Memories',
      'Projects',
      'Plans',
      'Documents',
      'Code',
      'Files',
      'Skills',
      'Entities',
      'Timeline',
      'Graph',
    ]) {
      expect(within(navigation).getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(within(navigation).queryByRole('link', { name: 'Sessions' })).not.toBeInTheDocument()
    expect(within(navigation).queryByRole('link', { name: 'Login' })).not.toBeInTheDocument()
  })
})
