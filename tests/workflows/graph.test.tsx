import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../../src/App'
import { installFetchStub, jsonResponse } from '../helpers/fetchStub'

describe('Graph route without a selection', () => {
  it('asks the user to choose a memory and does not request graph data', async () => {
    window.history.replaceState(null, '', '/#/graph')
    const fetchStub = installFetchStub([
      { match: '/health', handler: () => jsonResponse({ status: 'healthy' }) },
      {
        match: '/api/v1/auth/info',
        handler: () => jsonResponse({ authEnabled: false, authMode: 'disabled' }),
      },
    ])

    render(<App />)

    expect(await screen.findByText('Choose a memory to explore')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse memories' })).toHaveAttribute(
      'href',
      '#/memories',
    )
    expect(
      fetchStub.requests.some((request) => request.url.pathname === '/api/v1/graph/subgraph'),
    ).toBe(false)
  })
})
