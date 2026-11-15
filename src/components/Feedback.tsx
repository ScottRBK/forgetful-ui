import type { ReactNode } from 'react'

const SKELETON_ROWS = ['one', 'two', 'three', 'four', 'five', 'six'] as const

import { AlertIcon } from './Icons'

export function LoadingRows({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" className="divide-y divide-line">
      <span className="sr-only">Loading memories…</span>
      {SKELETON_ROWS.slice(0, rows).map((row) => (
        <div key={row} className="flex items-center gap-4 px-4 py-4">
          <span className="h-3 w-2/5 animate-pulse rounded bg-slate-200/80" />
          <span className="h-3 w-16 animate-pulse rounded bg-slate-200/60" />
          <span className="ml-auto h-3 w-20 animate-pulse rounded bg-slate-200/60" />
        </div>
      ))}
    </div>
  )
}

export function ErrorPanel({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry?: () => void
}) {
  return (
    <div role="alert" className="m-3 rounded-md border border-danger-soft bg-danger-soft/60 p-4">
      <div className="flex items-start gap-2.5">
        <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-danger-ink" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-danger-ink">{title}</p>
          <p className="mt-1 break-words text-[12px] text-ink-soft">{message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className={`
                mt-3 rounded border border-danger-ink/25 bg-panel px-2.5 py-1 text-[11px]
                font-medium text-danger-ink hover:bg-white focus-visible:outline-2
                focus-visible:outline-offset-2 focus-visible:outline-danger-ink
              `}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function EmptyPanel({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-[13px] font-medium text-ink">{title}</p>
      {children && <div className="mx-auto mt-1.5 max-w-sm text-[12px] text-muted">{children}</div>}
    </div>
  )
}
