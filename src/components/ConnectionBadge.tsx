import type { ConnectionState } from '../hooks/useConnection'

export function connectionLabel(state: ConnectionState): string {
  if (state.status === 'checking') return 'Checking backend'
  if (state.status === 'offline') return 'Backend unreachable'
  if (state.status === 'auth-required') return 'Sign-in required'
  if (state.status === 'access-blocked') {
    return state.reason === 'authentication' ? 'Authentication unavailable' : 'Access denied'
  }
  return state.auth === 'unknown' ? 'Connected · auth unknown' : 'Connected'
}

export function ConnectionBadge({ state }: { state: ConnectionState }) {
  const label = connectionLabel(state)
  const tone =
    state.status === 'online' && state.auth === 'disabled'
      ? 'bg-teal-soft text-teal-ink'
      : state.status === 'online'
        ? 'bg-warn-soft text-warn-ink'
        : state.status === 'checking'
          ? 'bg-slate-100 text-muted'
          : 'bg-copper-soft text-copper'

  const dot =
    state.status === 'online'
      ? 'bg-teal'
      : state.status === 'checking'
        ? 'bg-slate-400'
        : 'bg-copper'

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]
        font-medium ${tone}
      `}
      role="status"
      aria-live="polite"
      title="Backend connection state"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  )
}
