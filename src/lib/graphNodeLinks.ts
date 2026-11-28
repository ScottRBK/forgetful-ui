import type { GraphNodeRecord } from '../api/types'
import {
  codeHref,
  documentsHref,
  entitiesHref,
  filesHref,
  memoriesHref,
  plansHref,
  projectsHref,
  skillsHref,
} from '../router'
import { asNumber, nodeNumber } from './format'

export type GraphNodeScreenLink = { href: string; label: string }

export function graphNodeHref(node: GraphNodeRecord): GraphNodeScreenLink | null {
  const numericId = nodeNumber(node.id)
  if (numericId === null) return null

  switch (node.type) {
    case 'memory':
      return { href: memoriesHref({ memoryId: numericId }), label: 'Open in Memories' }
    case 'entity':
      return { href: entitiesHref({ entityId: numericId }), label: 'Open in Entities' }
    case 'project':
      return { href: projectsHref({ projectId: numericId }), label: 'Open in Projects' }
    case 'plan':
      return { href: plansHref({ planId: numericId }), label: 'Open in Plans' }
    case 'task': {
      const planId = asNumber(node.data.plan_id)
      if (planId === null) return null
      return { href: plansHref({ planId, taskId: numericId }), label: 'Open in Plans' }
    }
    case 'document':
      return { href: documentsHref({ documentId: numericId }), label: 'Open in Documents' }
    case 'code_artifact':
      return { href: codeHref({ artifactId: numericId }), label: 'Open in Code' }
    case 'file':
      return { href: filesHref({ fileId: numericId }), label: 'Open in Files' }
    case 'skill':
      return { href: skillsHref({ skillId: numericId }), label: 'Open in Skills' }
    default:
      return null
  }
}
