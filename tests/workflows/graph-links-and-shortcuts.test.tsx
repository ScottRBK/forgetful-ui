import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../../src/App'
import type { GraphNodeRecord } from '../../src/api/types'
import { graphNodeHref } from '../../src/lib/graphNodeLinks'
import { installFetchStub, jsonResponse } from '../helpers/fetchStub'
import { memory, subgraph } from '../helpers/synthetic'

function node(
  type: GraphNodeRecord['type'],
  id: string,
  data: Record<string, unknown> = {},
): GraphNodeRecord {
  return { id, type, label: `Node ${id}`, data }
}

describe('graphNodeHref', () => {
  it.each<[GraphNodeRecord['type'], string, Record<string, unknown>, string, string]>([
    ['memory', 'memory_12', {}, '#/memories/12', 'Open in Memories'],
    ['entity', 'entity_3', {}, '#/entities/3', 'Open in Entities'],
    ['project', 'project_7', {}, '#/projects/7', 'Open in Projects'],
    ['plan', 'plan_8', {}, '#/plans/8', 'Open in Plans'],
    ['document', 'document_4', {}, '#/documents/4', 'Open in Documents'],
    ['code_artifact', 'code_artifact_5', {}, '#/code/5', 'Open in Code'],
    ['file', 'file_6', {}, '#/files/6', 'Open in Files'],
    ['skill', 'skill_9', {}, '#/skills/9', 'Open in Skills'],
  ])('maps %s nodes to the matching screen', (type, id, data, href, label) => {
    const link = graphNodeHref(node(type, id, data))
    expect(link).toEqual({ href, label })
  })

  it('links tasks when plan_id is present on node data', () => {
    expect(graphNodeHref(node('task', 'task_21', { plan_id: 4 }))).toEqual({
      href: '#/plans/4?task=21',
      label: 'Open in Plans',
    })
  })

  it('returns null for tasks without plan_id', () => {
    expect(graphNodeHref(node('task', 'task_21', {}))).toBeNull()
  })

  it('returns null when the node id has no numeric suffix', () => {
    expect(graphNodeHref(node('memory', 'memory_bad', {}))).toBeNull()
  })

  it('returns null for unknown node types', () => {
    const unknown = node('memory', 'memory_1', {})
    ;(unknown as { type: string }).type = 'widget'
    expect(graphNodeHref(unknown)).toBeNull()
  })
})

function focusedGraphStubs(extra: { match: string; handler: () => Response }[] = []) {
  return installFetchStub([
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
      match: '/api/v1/projects',
      handler: () => jsonResponse({ projects: [], total: 0, limit: 20, offset: 0 }),
    },
    {
      match: '/api/v1/memories/101',
      handler: () => jsonResponse(memory(101, { title: 'Synthetic graph memory' })),
    },
    {
      match: '/api/v1/memories',
      handler: () =>
        jsonResponse({
          memories: [memory(101, { title: 'Synthetic graph memory' })],
          total: 1,
          limit: 20,
          offset: 0,
        }),
    },
    {
      match: '/api/v1/graph/subgraph',
      handler: () => jsonResponse(subgraph()),
    },
    {
      match: '/api/v1/entities/9',
      handler: () =>
        jsonResponse({
          id: 9,
          name: 'Synthetic entity',
          entity_type: 'System',
          notes: 'Synthetic notes.',
        }),
    },
    ...extra,
  ])
}

describe('Graph node cross-links and Escape', () => {
  it('shows an entity cross-link with the correct hash URL', async () => {
    window.history.replaceState(null, '', '/#/graph?memory=101')
    focusedGraphStubs()

    render(<App />)

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Synthetic entity/ }))

    const link = screen.getByRole('link', { name: 'Open in Entities' })
    expect(link).toHaveAttribute('href', '#/entities/9')
  }, 15_000)

  it('shows a plan cross-link with the correct hash URL', async () => {
    window.history.replaceState(null, '', '/#/graph?memory=101')
    const planSubgraph = {
      ...subgraph(),
      nodes: [
        ...subgraph().nodes,
        {
          id: 'plan_8',
          type: 'plan' as const,
          label: 'Synthetic plan',
          depth: 1,
          data: { goal: 'Ship it', status: 'active' },
        },
      ],
    }
    installFetchStub([
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
        match: '/api/v1/projects',
        handler: () => jsonResponse({ projects: [], total: 0, limit: 20, offset: 0 }),
      },
      {
        match: '/api/v1/memories/101',
        handler: () => jsonResponse(memory(101, { title: 'Synthetic graph memory' })),
      },
      {
        match: '/api/v1/memories',
        handler: () =>
          jsonResponse({
            memories: [memory(101, { title: 'Synthetic graph memory' })],
            total: 1,
            limit: 20,
            offset: 0,
          }),
      },
      {
        match: '/api/v1/graph/subgraph',
        handler: () => jsonResponse(planSubgraph),
      },
      {
        match: '/api/v1/plans/8',
        handler: () =>
          jsonResponse({
            id: 8,
            goal: 'Synthetic plan goal',
            status: 'active',
            project_id: null,
          }),
      },
    ])

    render(<App />)

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Synthetic plan/ }))

    const link = screen.getByRole('link', { name: 'Open in Plans' })
    expect(link).toHaveAttribute('href', '#/plans/8')
  }, 15_000)

  it('clears graph node selection when Escape is pressed', async () => {
    window.history.replaceState(null, '', '/#/graph?memory=101')
    focusedGraphStubs()

    render(<App />)

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Synthetic entity/ }))
    expect(screen.getByRole('link', { name: 'Open in Entities' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.getByText('Select a node to inspect its record.')).toBeInTheDocument()
  })
})

describe('Search keyboard shortcut', () => {
  it('focuses the memories search input when / is pressed outside editable fields', async () => {
    window.history.replaceState(null, '', '/#/memories')
    installFetchStub([
      { match: '/health', handler: () => jsonResponse({ status: 'healthy' }) },
      {
        match: '/api/v1/auth/info',
        handler: () => jsonResponse({ authEnabled: false, authMode: 'disabled' }),
      },
      {
        match: '/api/v1/projects',
        handler: () => jsonResponse({ projects: [], total: 0, limit: 20, offset: 0 }),
      },
      {
        match: '/api/v1/memories',
        handler: () =>
          jsonResponse({
            memories: [memory(101)],
            total: 1,
            limit: 20,
            offset: 0,
          }),
      },
    ])

    render(<App />)
    await screen.findByLabelText('Search memories')

    const user = userEvent.setup()
    await user.click(document.body)
    await user.keyboard('/')

    expect(screen.getByLabelText('Search memories')).toHaveFocus()
  })

  it('does not hijack / while typing in the search input', async () => {
    window.history.replaceState(null, '', '/#/memories')
    installFetchStub([
      { match: '/health', handler: () => jsonResponse({ status: 'healthy' }) },
      {
        match: '/api/v1/auth/info',
        handler: () => jsonResponse({ authEnabled: false, authMode: 'disabled' }),
      },
      {
        match: '/api/v1/projects',
        handler: () => jsonResponse({ projects: [], total: 0, limit: 20, offset: 0 }),
      },
      {
        match: '/api/v1/memories',
        handler: () =>
          jsonResponse({
            memories: [memory(101)],
            total: 1,
            limit: 20,
            offset: 0,
          }),
      },
    ])

    render(<App />)
    const search = await screen.findByLabelText('Search memories')
    const user = userEvent.setup()
    await user.click(search)
    await user.type(search, 'alpha/beta')

    expect(search).toHaveValue('alpha/beta')
  })
})
