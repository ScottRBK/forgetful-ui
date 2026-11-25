export const RESOURCE_PAGE_SIZE = 20
export const COLLECTION_PAGE_SIZE = 100

export interface ResourcePage<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface CollectedPages<T> {
  items: T[]
  total: number
}

export function resourceTotalPages(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, limit)))
}

export function resourceOffset(page: number, limit: number): number {
  return (Math.max(1, page) - 1) * limit
}

export async function collectResourcePages<T>(
  load: (limit: number, offset: number, signal: AbortSignal) => Promise<ResourcePage<T>>,
  signal: AbortSignal,
): Promise<CollectedPages<T>> {
  const items: T[] = []
  const seen = new Set<number>()
  let offset = 0
  let expectedTotal: number | null = null

  for (;;) {
    const page = await load(COLLECTION_PAGE_SIZE, offset, signal)
    if (
      !Number.isInteger(page.total) ||
      !Number.isInteger(page.limit) ||
      !Number.isInteger(page.offset) ||
      page.total < 0 ||
      page.limit !== COLLECTION_PAGE_SIZE ||
      page.offset !== offset ||
      !Array.isArray(page.items) ||
      page.items.length > page.limit
    ) {
      throw new Error('The server returned inconsistent collection pagination metadata.')
    }
    if (expectedTotal === null) expectedTotal = page.total
    else if (page.total !== expectedTotal) {
      throw new Error('The collection changed while it was loading. Refresh and try again.')
    }

    const ids = page.items.map((item) => (item as { id?: unknown }).id)
    if (ids.some((id) => !Number.isInteger(id) || Number(id) <= 0)) {
      throw new Error('The collection returned records without valid IDs. Refresh and retry.')
    }
    const validIds = ids as number[]
    if (new Set(validIds).size !== validIds.length || validIds.some((id) => seen.has(id))) {
      throw new Error('The collection returned duplicate records. Refresh and try again.')
    }
    if (page.items.length === 0 && offset < expectedTotal) {
      throw new Error('The collection stopped before all records were loaded. Refresh and retry.')
    }
    for (const id of validIds) seen.add(id)
    items.push(...page.items)
    offset += page.items.length

    if (offset >= expectedTotal) {
      if (offset !== expectedTotal) {
        throw new Error('The collection changed while it was loading. Refresh and try again.')
      }
      return { items, total: expectedTotal }
    }
  }
}
