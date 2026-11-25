import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../../src/App'
import { installFetchStub, jsonResponse } from '../helpers/fetchStub'

const connectionRoutes = [
  { match: '/health', handler: () => jsonResponse({ status: 'healthy' }) },
  {
    match: '/api/v1/auth/info',
    handler: () => jsonResponse({ authEnabled: false, authMode: 'disabled' }),
  },
]

function documentsRoute(handler: () => Response) {
  return { match: '/api/v1/documents', handler }
}

describe('Ordinary resource page contract', () => {
  it('fails visibly when a 200 page omits its total', async () => {
    window.history.replaceState(null, '', '/#/documents')
    installFetchStub([
      ...connectionRoutes,
      documentsRoute(() =>
        jsonResponse({
          documents: [{ id: 1, title: 'Synthetic contract document' }],
          limit: 20,
          offset: 0,
        }),
      ),
    ])

    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load documents')
    expect(alert).toHaveTextContent('v0.8.0')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
  })

  it.each([
    ['negative', -1],
    ['fractional', 1.5],
    ['unsafe', Number.MAX_SAFE_INTEGER + 1],
    ['string', '3'],
  ])('fails visibly when total is %s', async (_label, total) => {
    window.history.replaceState(null, '', '/#/documents')
    installFetchStub([
      ...connectionRoutes,
      documentsRoute(() => jsonResponse({ documents: [], total, limit: 20, offset: 0 })),
    ])

    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load documents')
    expect(alert).toHaveTextContent(/pagination metadata/i)
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
  })

  it.each([
    ['a null collection', { documents: null }],
    ['a missing collection', { offset: 0 }],
    ['a non-array collection', { documents: 'not-an-array' }],
  ])('fails visibly for %s', async (_label, override) => {
    window.history.replaceState(null, '', '/#/documents')
    installFetchStub([
      ...connectionRoutes,
      documentsRoute(() => jsonResponse({ total: 1, limit: 20, offset: 0, ...override })),
    ])

    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load documents')
    expect(alert).toHaveTextContent(/documents/i)
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Documents' })).not.toBeInTheDocument()
  })

  it('fails visibly when a page holds more rows than its requested limit', async () => {
    window.history.replaceState(null, '', '/#/documents')
    installFetchStub([
      ...connectionRoutes,
      documentsRoute(() =>
        jsonResponse({
          documents: Array.from({ length: 21 }, (_, index) => ({ id: index + 1 })),
          total: 21,
          limit: 20,
          offset: 0,
        }),
      ),
    ])

    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load documents')
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
  })

  it('does not reject a legitimate empty page beyond the total', async () => {
    window.history.replaceState(null, '', '/#/documents?page=3')
    installFetchStub([
      ...connectionRoutes,
      documentsRoute(() => jsonResponse({ documents: [], total: 0, limit: 20, offset: 40 })),
    ])

    render(<App />)

    expect(await screen.findByText('No documents found')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reports the rendered row count when a page is shorter than its limit', async () => {
    window.history.replaceState(null, '', '/#/documents?page=3')
    const shortRows = Array.from({ length: 4 }, (_, index) => ({
      id: 41 + index,
      title: `Synthetic short page document ${41 + index}`,
    }))
    installFetchStub([
      ...connectionRoutes,
      documentsRoute(() =>
        jsonResponse({ documents: shortRows, total: 45, limit: 20, offset: 40 }),
      ),
    ])

    render(<App />)

    expect(await screen.findByText('Page 3 of 3')).toBeInTheDocument()
    expect(screen.getByText('Showing 41–44 of 45')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Documents' }).children).toHaveLength(4)
    expect(screen.queryByText('Showing 41–45 of 45')).not.toBeInTheDocument()
  })

  it.each([
    ['null', null],
    ['an array', []],
  ])('fails visibly for a %s response body', async (_label, body) => {
    window.history.replaceState(null, '', '/#/documents')
    installFetchStub([...connectionRoutes, documentsRoute(() => jsonResponse(body))])

    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load documents')
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Documents' })).not.toBeInTheDocument()
  })
})
