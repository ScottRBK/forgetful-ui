import type { ReactNode } from 'react'

export function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-line/80 py-2 last:border-0">
      <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-[12px] text-ink-soft">{children}</dd>
    </div>
  )
}
