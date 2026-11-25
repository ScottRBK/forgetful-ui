import { describe, expect, it } from 'vitest'
import {
  apiRoot,
  deploymentPrefix,
  getNodeDetail,
  getSubgraph,
  listDocuments,
  listMemories,
  listProjects,
} from '../../src/api/client'
import type { GraphNodeType } from '../../src/api/types'
import { installFetchStub, jsonResponse } from '../helpers/fetchStub'

describe('API client', () => {
  it('maps memory list filters to API query parameters', async () => {
    const fetcher = installFetchStub([
      {
        match: '/api/v1/memories',
        handler: () => jsonResponse({ memories: [], total: 0, limit: 20, offset: 0 }),
      },
    ])

    await listMemories({
      limit: 20,
      offset: 0,
      projectId: 3,
      sortBy: 'project_name',
      sortOrder: 'asc',
      importanceMin: 4,
      importanceMax: 9,
      q: 'release',
      updatedFrom: '2026-01-01T00:00:00.000Z',
      updatedTo: '2026-12-31T23:59:59.000Z',
    })

    const request = fetcher.requests[0]
    expect(request?.url.searchParams.get('sort_by')).toBe('project_name')
    expect(request?.url.searchParams.get('importance_max')).toBe('9')
    expect(request?.url.searchParams.get('q')).toBe('release')
    expect(request?.url.searchParams.get('updated_from')).toBe('2026-01-01T00:00:00.000Z')
    expect(request?.url.searchParams.get('updated_to')).toBe('2026-12-31T23:59:59.000Z')
  })

  it('derives the API prefix from the UI deployment path', () => {
    expect(deploymentPrefix('/')).toBe('')
    expect(deploymentPrefix('/ui/')).toBe('')
    expect(deploymentPrefix('/prefix/ui/')).toBe('/prefix')
    expect(deploymentPrefix('/deep/prefix/ui/')).toBe('/deep/prefix')
    expect(deploymentPrefix('/prefix/ui/index.html')).toBe('/prefix')
    expect(apiRoot('/ui/')).toBe('/api/v1')
    expect(apiRoot('/prefix/ui/')).toBe('/prefix/api/v1')
  })

  it('requests a bounded subgraph without optional node types', async () => {
    const fetcher = installFetchStub([
      {
        match: '/api/v1/graph/subgraph',
        handler: () =>
          jsonResponse({
            nodes: [],
            edges: [],
            meta: {
              center_node_id: 'memory_42',
              depth: 2,
              node_types: [],
              max_nodes: 100,
              edge_count: 0,
              truncated: false,
            },
          }),
      },
    ])

    await getSubgraph({ memoryId: 42, depth: 2, maxNodes: 100 })
    const request = fetcher.requests[0]
    expect(request?.url.searchParams.get('node_id')).toBe('memory_42')
    expect(request?.url.searchParams.get('depth')).toBe('2')
    expect(request?.url.searchParams.get('max_nodes')).toBe('100')
    expect(request?.url.searchParams.has('node_types')).toBe(false)
  })

  it.each<[GraphNodeType, number, string]>([
    ['memory', 1, '/api/v1/memories/1'],
    ['entity', 2, '/api/v1/entities/2'],
    ['project', 3, '/api/v1/projects/3'],
    ['document', 4, '/api/v1/documents/4'],
    ['code_artifact', 5, '/api/v1/code-artifacts/5'],
    ['file', 6, '/api/v1/files/6'],
    ['skill', 7, '/api/v1/skills/7'],
    ['plan', 8, '/api/v1/plans/8'],
    ['task', 9, '/api/v1/tasks/9'],
  ])('maps a %s node to its detail route', async (type, id, path) => {
    const fetcher = installFetchStub([
      {
        match: path,
        handler: () => jsonResponse({ id }),
      },
    ])

    await getNodeDetail(type, id)
    expect(fetcher.requests[0]?.url.pathname).toBe(path)
  })
})

describe('Resource list pagination contract', () => {
  it('requests an explicit bounded project page', async () => {
    const fetcher = installFetchStub([
      {
        match: '/api/v1/projects',
        handler: () => jsonResponse({ projects: [], total: 0, limit: 20, offset: 40 }),
      },
    ])

    await listProjects({ status: null, repoName: null, limit: 20, offset: 40 })
    const request = fetcher.requests[0]
    expect(request?.url.searchParams.get('limit')).toBe('20')
    expect(request?.url.searchParams.get('offset')).toBe('40')
  })

  it('rejects a project response without v0.8 pagination metadata', async () => {
    installFetchStub([
      {
        match: '/api/v1/projects',
        handler: () => jsonResponse({ projects: [], total: 0 }),
      },
    ])

    await expect(
      listProjects({ status: null, repoName: null, limit: 20, offset: 0 }),
    ).rejects.toThrow(/v0\.8\.0/)
  })

  it('rejects pagination metadata that does not match the request', async () => {
    installFetchStub([
      {
        match: '/api/v1/projects',
        handler: () => jsonResponse({ projects: [], total: 0, limit: 20, offset: 0 }),
      },
    ])

    await expect(
      listProjects({ status: null, repoName: null, limit: 20, offset: 40 }),
    ).rejects.toThrow(/unexpected resource pagination metadata/)
  })

  it('rejects a documents page without its total', async () => {
    installFetchStub([
      {
        match: '/api/v1/documents',
        handler: () => jsonResponse({ documents: [], limit: 20, offset: 0 }),
      },
    ])

    await expect(
      listDocuments({ projectId: null, documentType: null, limit: 20, offset: 0 }),
    ).rejects.toThrow(/v0\.8\.0/)
  })

  it('rejects a documents page without its documents array', async () => {
    installFetchStub([
      {
        match: '/api/v1/documents',
        handler: () => jsonResponse({ total: 0, limit: 20, offset: 0 }),
      },
    ])

    await expect(
      listDocuments({ projectId: null, documentType: null, limit: 20, offset: 0 }),
    ).rejects.toThrow(/documents array/)
  })

  it('rejects invalid documents pagination metadata', async () => {
    installFetchStub([
      {
        match: '/api/v1/documents',
        handler: () => jsonResponse({ documents: [], total: -1, limit: 20, offset: 0 }),
      },
    ])

    await expect(
      listDocuments({ projectId: null, documentType: null, limit: 20, offset: 0 }),
    ).rejects.toThrow(/invalid resource pagination metadata/)
  })
})
