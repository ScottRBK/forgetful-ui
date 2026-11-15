import type { ConnectionState } from '../hooks/useConnection'
import { ConnectionBadge } from './ConnectionBadge'

interface TopbarProps {
  title: string
  subtitle: string
  connection: ConnectionState
}

export function Topbar({ title, subtitle, connection }: TopbarProps) {
  return (
    <header
      className={`
        flex min-h-16 items-center justify-between gap-4 border-b border-line
        bg-panel/80 px-4 py-3 backdrop-blur-sm sm:px-6
      `}
    >
      <div className="min-w-0">
        <h1 className="truncate text-[19px] font-semibold tracking-[-0.015em] text-ink">{title}</h1>
        <p className="truncate text-[11px] text-muted">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span
          className={`
            hidden text-[10px] font-medium uppercase tracking-[0.14em] text-muted
            sm:inline
          `}
        >
          Read-only
        </span>
        <ConnectionBadge state={connection} />
      </div>
    </header>
  )
}
