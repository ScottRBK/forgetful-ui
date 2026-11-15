export type PageItem = number | 'gap'

export function pageItems(current: number, totalPages: number): PageItem[] {
  if (totalPages < 1) return []
  if (totalPages === 1) return [1]

  const pages = new Set<number>([1, totalPages])
  for (let page = current - 1; page <= current + 1; page += 1) {
    if (page >= 1 && page <= totalPages) pages.add(page)
  }

  if (current <= 3) {
    for (let page = 2; page <= Math.min(4, totalPages); page += 1) pages.add(page)
  }
  if (current >= totalPages - 2) {
    for (let page = Math.max(1, totalPages - 3); page < totalPages; page += 1) pages.add(page)
  }

  const sorted = Array.from(pages).sort((left, right) => left - right)
  const items: PageItem[] = []
  let previous = 0
  for (const page of sorted) {
    if (previous > 0 && page - previous > 1) items.push('gap')
    items.push(page)
    previous = page
  }
  return items
}
