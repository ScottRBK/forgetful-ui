import { listProjects } from '../api/client'
import type { ProjectRecord } from '../api/types'
import { collectResourcePages } from '../lib/resourcePages'
import { useApiData } from './useApiData'

export function useProjectOptions(enabled = true) {
  return useApiData(
    'project-options',
    async (signal) => {
      const result = await collectResourcePages<ProjectRecord>(
        async (limit, offset, pageSignal) => {
          const page = await listProjects(
            { status: null, repoName: null, limit, offset },
            pageSignal,
          )
          return {
            items: page.projects,
            total: page.total,
            limit: page.limit,
            offset: page.offset,
          }
        },
        signal,
      )
      return { projects: result.items, total: result.total }
    },
    enabled,
  )
}
