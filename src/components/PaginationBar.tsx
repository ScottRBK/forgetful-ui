import { pageItems } from '../lib/pagination'
import { ArrowLeftIcon, ArrowRightIcon } from './Icons'

interface PaginationBarProps {
  page: number
  totalPages: number
  total: number
  limit: number
  received: number
  label: string
  hrefForPage: (page: number) => string
}

export function PaginationBar({
  page,
  totalPages,
  total,
  limit,
  received,
  label,
  hrefForPage,
}: PaginationBarProps) {
  const pages = pageItems(page, totalPages)
  const start = total === 0 || received === 0 ? 0 : (page - 1) * limit + 1
  const end = total === 0 || received === 0 ? 0 : Math.min(start + received - 1, total)
  return (
    <div className="pagination-bar">
      <div className="min-w-0">
        <p className="text-[11px] text-muted">
          Page {page} of {totalPages}
        </p>
        <p className="text-[10px] text-muted">
          Showing {start}–{end} of {total}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <nav aria-label={`${label} pages`} className="page-nav">
          {pages.map((item, index) => {
            const previous = pages[index - 1]
            return item === 'gap' ? (
              <span
                key={`${label}-gap-after-${String(previous)}`}
                className="page-gap"
                aria-hidden="true"
              >
                …
              </span>
            ) : item === page ? (
              <span key={item} className="page-current" aria-current="page">
                {item}
              </span>
            ) : (
              <a
                key={item}
                href={hrefForPage(item)}
                aria-label={`Page ${item}`}
                className="page-link"
              >
                {item}
              </a>
            )
          })}
        </nav>
        <div className="flex items-center gap-1.5">
          {page > 1 ? (
            <a href={hrefForPage(page - 1)} className="btn-compact">
              <ArrowLeftIcon className="h-3 w-3" />
              Previous
            </a>
          ) : (
            <span className="btn-disabled">
              <ArrowLeftIcon className="h-3 w-3" />
              Previous
            </span>
          )}
          {page < totalPages ? (
            <a href={hrefForPage(page + 1)} aria-label="Next page" className="btn-compact">
              Next
              <ArrowRightIcon className="h-3 w-3" />
            </a>
          ) : (
            <span className="btn-disabled">
              Next
              <ArrowRightIcon className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
