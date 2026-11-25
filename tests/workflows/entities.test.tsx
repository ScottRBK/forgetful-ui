import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../../src/App'
import {
  type FetchStub,
  installFetchStub,
  jsonResponse,
  pagedResponse,
  type RouteStub,
} from '../helpers/fetchStub'
import { project } from '../helpers/synthetic'

const PAGE_SIZE = 20

const connectionRoutes: RouteStub[] = [
  { match: '/health', handler: () => jsonResponse({ status: 'healthy' }) },
  {
    match: '/api/v1/auth/info',
    handler: () => jsonResponse({ authEnabled: false, authMode: 'disabled' }),
  },
  {
    match: '/api/v1/projects',
    handler: (request) => pagedResponse([project(1, 'Alpha project')], request, 'projects'),
  },
]

const pageOne = Array.from({ length: PAGE_SIZE }, (_, index) => ({
  id: 21 - index,
  name: `Entity page one ${21 - index}`,
  entity_type: 'Individual',
  tags: [],
  aka: [],
  project_ids: [1],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}))

const entityOldest = {
  id: 1,
  name: 'Entity on page two',
  entity_type: 'Organization',
  tags: [],
  aka: [],
  project_ids: [1],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const entityDetailOldest = {
  ...entityOldest,
  notes: 'Notes for entity on page two.',
}

const entity21Detail = {
  ...pageOne[0],
  notes: 'Detail for newest entity.',
}

function entitiesListHandler(request: { url: URL }) {
  const offset = Number(request.url.searchParams.get('offset') ?? 0)
  const limit = Number(request.url.searchParams.get('limit') ?? PAGE_SIZE)
  const entityType = request.url.searchParams.get('entity_type')
  const total = 21
  if (entityType === 'Organization') {
    return jsonResponse({ entities: [entityOldest], total: 1, limit, offset: 0 })
  }
  if (offset === 0) {
    return jsonResponse({ entities: pageOne, total, limit, offset: 0 })
  }
  return jsonResponse({ entities: [entityOldest], total, limit, offset })
}

function latestEntitiesListRequest(fetcher: FetchStub) {
  return [...fetcher.requests]
    .reverse()
    .find((request) => request.url.pathname === '/api/v1/entities')
}

function entityContextRoutes(
  entityId: number,
  options: {
    detail?: () => Response
    memories?: () => Response
    relationships?: () => Response
  } = {},
) {
  return [
    ...connectionRoutes,
    { match: '/api/v1/entities', handler: entitiesListHandler },
    {
      match: new RegExp(`^/api/v1/entities/${entityId}$`),
      handler: options.detail ?? (() => jsonResponse(entity21Detail)),
    },
    {
      match: `/api/v1/entities/${entityId}/memories`,
      handler: options.memories ?? (() => jsonResponse({ memory_ids: [], count: 0, memories: [] })),
    },
    {
      match: `/api/v1/entities/${entityId}/relationships`,
      handler: options.relationships ?? (() => jsonResponse({ relationships: [], total: 0 })),
    },
  ]
}

describe('Entities workflow', () => {
  it('paginates the list and resolves relationship entity names from GET', async () => {
    window.history.replaceState(null, '', '/#/entities/21')
    installFetchStub([
      ...connectionRoutes,
      { match: '/api/v1/entities', handler: entitiesListHandler },
      {
        match: /^\/api\/v1\/entities\/21$/,
        handler: () => jsonResponse(entity21Detail),
      },
      {
        match: /^\/api\/v1\/entities\/1$/,
        handler: () => jsonResponse(entityDetailOldest),
      },
      {
        match: '/api/v1/entities/21/memories',
        handler: () =>
          jsonResponse({
            memory_ids: [101],
            count: 1,
            memories: [{ id: 101, title: 'Synthetic linked memory' }],
          }),
      },
      {
        match: '/api/v1/entities/21/relationships',
        handler: () =>
          jsonResponse({
            relationships: [
              {
                id: 3,
                source_entity_id: 21,
                target_entity_id: 30,
                relationship_type: 'works_at',
              },
            ],
            total: 1,
          }),
      },
      {
        match: /^\/api\/v1\/entities\/30$/,
        handler: () =>
          jsonResponse({
            id: 30,
            name: 'Off-page relation target',
            entity_type: 'Team',
            notes: 'Related off list page.',
            tags: [],
            aka: [],
            project_ids: [1],
          }),
      },
    ])

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Entities' })).toBeInTheDocument()
    expect(await screen.findByText('21 total')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()

    expect(
      await screen.findByRole('heading', { name: 'Entity page one 21', level: 3 }),
    ).toBeInTheDocument()

    const memoryLink = within(screen.getByLabelText('Linked memories')).getByRole('link', {
      name: /Synthetic linked memory/,
    })
    expect(memoryLink).toHaveAttribute('href', '#/memories/101')

    const relationLink = await within(screen.getByLabelText('Relationships')).findByRole('link', {
      name: /Off-page relation target/,
    })
    expect(relationLink).toHaveTextContent('Team')
    expect(relationLink).toHaveAttribute('href', '#/entities/30')
  })

  it('uses Previous and numbered page links with matching list offsets', async () => {
    window.history.replaceState(null, '', '/#/entities?page=2')
    const fetcher = installFetchStub([
      ...connectionRoutes,
      { match: '/api/v1/entities', handler: entitiesListHandler },
    ])

    render(<App />)
    const user = userEvent.setup()

    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
    expect(latestEntitiesListRequest(fetcher)?.url.searchParams.get('offset')).toBe('20')

    await user.click(screen.getByRole('link', { name: 'Previous' }))
    expect(window.location.hash).toBe('#/entities')
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
    expect(latestEntitiesListRequest(fetcher)?.url.searchParams.get('offset')).toBe('0')

    await user.click(
      within(screen.getByLabelText('Entity pages')).getByRole('link', { name: 'Page 2' }),
    )
    expect(window.location.hash).toBe('#/entities?page=2')
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
    expect(latestEntitiesListRequest(fetcher)?.url.searchParams.get('offset')).toBe('20')
  })

  it('round-trips the entity type filter through the URL and list requests', async () => {
    window.history.replaceState(null, '', '/#/entities?page=2')
    const fetcher = installFetchStub([
      ...connectionRoutes,
      { match: '/api/v1/entities', handler: entitiesListHandler },
    ])

    render(<App />)
    const user = userEvent.setup()

    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Entity type filter'), 'Organization')

    expect(window.location.hash).toBe('#/entities?type=Organization')
    expect(await screen.findByText('Page 1 of 1')).toBeInTheDocument()
    const filtered = latestEntitiesListRequest(fetcher)
    expect(filtered?.url.searchParams.get('entity_type')).toBe('Organization')
    expect(filtered?.url.searchParams.get('offset')).toBe('0')
  })

  it('preselects the entity type filter from the URL hash', async () => {
    window.history.replaceState(null, '', '/#/entities?type=Team&page=2')
    installFetchStub([
      ...connectionRoutes,
      { match: '/api/v1/entities', handler: entitiesListHandler },
    ])

    render(<App />)

    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Entity type filter')).toHaveValue('Team')
  })

  it('shows an entity id fallback when a related entity GET fails', async () => {
    window.history.replaceState(null, '', '/#/entities/21')
    installFetchStub([
      ...entityContextRoutes(21, {
        relationships: () =>
          jsonResponse({
            relationships: [
              {
                id: 3,
                source_entity_id: 21,
                target_entity_id: 99,
                relationship_type: 'works_at',
              },
            ],
            total: 1,
          }),
      }),
      {
        match: /^\/api\/v1\/entities\/99$/,
        handler: () => jsonResponse({ error: 'Entity not found' }, 404),
      },
    ])

    render(<App />)

    expect(await screen.findByRole('link', { name: /Entity #99/ })).toBeInTheDocument()
    expect(screen.queryByText('Off-page relation target')).not.toBeInTheDocument()
  })

  it('deep-links to an entity that is not on the current list page (newest-first list)', async () => {
    window.history.replaceState(null, '', '/#/entities/1?page=1')
    installFetchStub(entityContextRoutes(1, { detail: () => jsonResponse(entityDetailOldest) }))

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Entity on page two', level: 3 }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Entity on page two/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Entity page one 21/ })).toBeInTheDocument()
  })

  it('shows empty and error states for the entity list', async () => {
    window.history.replaceState(null, '', '/#/entities')
    let attempts = 0
    installFetchStub([
      ...connectionRoutes,
      {
        match: '/api/v1/entities',
        handler: () => {
          attempts += 1
          if (attempts === 1) return jsonResponse({ error: 'Temporary failure' }, 503)
          return jsonResponse({ entities: [], total: 0, limit: PAGE_SIZE, offset: 0 })
        },
      },
    ])

    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load entities')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No entities found')).toBeInTheDocument()
    expect(attempts).toBe(2)
  })

  it('retries entity detail load after a failure', async () => {
    window.history.replaceState(null, '', '/#/entities/21')
    let attempts = 0
    installFetchStub([
      ...entityContextRoutes(21, {
        detail: () => {
          attempts += 1
          if (attempts === 1) return jsonResponse({ error: 'Temporary failure' }, 503)
          return jsonResponse(entity21Detail)
        },
      }),
    ])

    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load entity')
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(
      await screen.findByRole('heading', { name: 'Entity page one 21', level: 3 }),
    ).toBeInTheDocument()
    expect(attempts).toBe(2)
  })

  it('shows a 404 panel when entity detail is missing', async () => {
    window.history.replaceState(null, '', '/#/entities/404')
    installFetchStub([
      ...entityContextRoutes(404, {
        detail: () => jsonResponse({ error: 'Entity not found' }, 404),
      }),
    ])

    render(<App />)

    expect(await screen.findByText('Entity not found')).toBeInTheDocument()
    expect(screen.getByText('This entity is unavailable.')).toBeInTheDocument()
  })

  it('retries linked memories and relationships after section failures', async () => {
    window.history.replaceState(null, '', '/#/entities/21')
    let memoryAttempts = 0
    let relationshipAttempts = 0
    installFetchStub([
      ...entityContextRoutes(21, {
        memories: () => {
          memoryAttempts += 1
          if (memoryAttempts === 1) return jsonResponse({ error: 'Temporary failure' }, 503)
          return jsonResponse({
            memory_ids: [101],
            count: 1,
            memories: [{ id: 101, title: 'Recovered linked memory' }],
          })
        },
        relationships: () => {
          relationshipAttempts += 1
          if (relationshipAttempts === 1) return jsonResponse({ error: 'Temporary failure' }, 503)
          return jsonResponse({ relationships: [], total: 0 })
        },
      }),
    ])

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Entity page one 21', level: 3 }),
    ).toBeInTheDocument()

    const memoriesPanel = await within(screen.getByLabelText('Linked memories')).findByRole('alert')
    expect(memoriesPanel).toHaveTextContent('Could not load linked memories')
    await userEvent.setup().click(within(memoriesPanel).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Recovered linked memory')).toBeInTheDocument()
    expect(memoryAttempts).toBe(2)

    const relationshipsPanel = await within(screen.getByLabelText('Relationships')).findByRole(
      'alert',
    )
    expect(relationshipsPanel).toHaveTextContent('Could not load relationships')
    await userEvent.setup().click(within(relationshipsPanel).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No relationships recorded.')).toBeInTheDocument()
    expect(relationshipAttempts).toBe(2)
  })
})
