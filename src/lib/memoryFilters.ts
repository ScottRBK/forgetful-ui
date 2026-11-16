import type { MemoryRoute } from '../router'

export function isoToDatetimeLocalValue(iso: string): string {
  const parsed = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
}

export function datetimeLocalValueToIso(value: string): string | null {
  if (value.trim() === '') return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export function hasActiveMemoryFilters(
  route: Pick<
    MemoryRoute,
    'projectId' | 'importanceMin' | 'importanceMax' | 'q' | 'updatedFrom' | 'updatedTo'
  >,
): boolean {
  return (
    route.projectId !== null ||
    route.importanceMin !== null ||
    route.importanceMax !== null ||
    route.q !== null ||
    route.updatedFrom !== null ||
    route.updatedTo !== null
  )
}
