import { render, screen, waitFor, within } from '@testing-library/react'
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
  {
    match: '/api/v1/projects',
    handler: () => jsonResponse({ projects: [project(7, 'Synthetic project')], total: 1 }),
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
