import { listActivity, listMemories } from '../api/client'
import type { ActivityEventRecord, MemoryRecord } from '../api/types'
import { connectionLabel } from '../components/ConnectionBadge'
import { EmptyPanel, ErrorPanel } from '../components/Feedback'
import { useApiData } from '../hooks/useApiData'
import { type CapabilityState, featureState } from '../hooks/useCapabilities'
import type { ConnectionState } from '../hooks/useConnection'
import { asString, formatDate, pluralMemories } from '../lib/format'
import { memoriesHref, timelineHref } from '../router'

function FeatureStatus({
  label,
  state,
}: {
  label: string
  state: ReturnType<typeof featureState>
}) {
  const tone =
    state === 'enabled'
      ? 'bg-teal-soft text-teal-ink'
      : state === 'disabled'
        ? 'bg-canvas text-muted'
        : state === 'loading'
          ? 'bg-slate-100 text-muted'
          : 'bg-warn-soft text-warn-ink'
  return (
    <div
      className={`
          flex items-center justify-between gap-3 border-b border-line/70 py-2
          last:border-0
        `}
    >
      <span className="text-[11px] text-ink-soft">{label}</span>
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${tone}`}>
        {state === 'enabled'
          ? 'Enabled'
          : state === 'disabled'
            ? 'Disabled'
            : state === 'loading'
              ? 'Checking'
              : 'Unknown'}
      </span>
    </div>
  )
}

function RecentMemory({ memory }: { memory: MemoryRecord }) {
  return (
    <li className="min-w-0 border-b border-line/70 py-2.5 last:border-0">
      <a
        href={memoriesHref({ memoryId: memory.id })}
        className="block min-w-0 truncate text-[12px] font-medium text-ink hover:text-teal"
      >
        {memory.title}
      </a>
      <p className="mt-0.5 text-[10px] text-muted">
        Importance {memory.importance}/10 · {formatDate(memory.updated_at)}
      </p>
    </li>
  )
}

function RecentEvent({ event }: { event: ActivityEventRecord }) {
  const title = asString(event.snapshot?.title) ?? asString(event.snapshot?.name)
  return (
    <li className="min-w-0 border-b border-line/70 py-2.5 last:border-0">
      <p className="text-[11px] text-ink-soft">
        <span className="font-medium text-ink">{event.action}</span> {event.entity_type} #
        {event.entity_id}
      </p>
      {title && <p className="mt-0.5 truncate text-[11px] text-muted">{title}</p>}
      <p className="mt-0.5 text-[10px] text-muted">
        {event.actor ?? 'unknown actor'} · {formatDate(event.created_at)}
      </p>
    </li>
  )
}

export default function DashboardScreen({
  connection,
  capabilities,
  retryCapabilities,
}: {
  connection: ConnectionState
  capabilities: CapabilityState
  retryCapabilities: () => void
}) {
  const memoriesQuery = useApiData('dashboard-memories', (signal) =>
    listMemories(
      {
        limit: 5,
        offset: 0,
        projectId: null,
        sortBy: 'updated_at',
        sortOrder: 'desc',
        importanceMin: null,
      },
      signal,
    ),
  )
  const activityQuery = useApiData('dashboard-activity', (signal) =>
    listActivity({ limit: 5, offset: 0 }, signal),
  )
  const memoryTotal = memoriesQuery.state.status === 'ready' ? memoriesQuery.state.data.total : null
  const memoryCount =
    memoriesQuery.state.status === 'ready' ? memoriesQuery.state.data.memories.length : 0
  const activityTotal =
    activityQuery.state.status === 'ready' ? activityQuery.state.data.total : null

  return (
    <div className="min-w-0 space-y-4 p-4 sm:p-5">
      <section className="panel-raised p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
              Workspace
            </p>
            <h2 className="mt-1 text-[15px] font-semibold text-ink">Read-only overview</h2>
            <p className="mt-1 text-[11px] text-muted">
              Connection: {connectionLabel(connection)}. Data is read from the configured Forgetful
              instance; nothing is written.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded border border-line bg-canvas px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Memories</p>
              <p className="mt-0.5 text-[15px] font-semibold text-ink">
                {memoryTotal === null ? '—' : memoryTotal.toLocaleString()}
              </p>
            </div>
            <div className="rounded border border-line bg-canvas px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Activity events</p>
              <p className="mt-0.5 text-[15px] font-semibold text-ink">
                {activityTotal === null ? '—' : activityTotal.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="min-w-0 space-y-4">
          <section className="panel-raised min-w-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                Recent memories
              </h2>
              <a href={memoriesHref({})} className="text-[11px] font-medium text-teal">
                View memories
              </a>
            </div>
            {memoriesQuery.state.status === 'loading' && (
              <div className="p-4" aria-busy="true">
                <span className="sr-only">Loading recent memories…</span>
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
                <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-slate-200/70" />
              </div>
            )}
            {memoriesQuery.state.status === 'error' && (
              <ErrorPanel
                title="Could not load recent memories"
                message={memoriesQuery.state.message}
                onRetry={memoriesQuery.retry}
              />
            )}
            {memoriesQuery.state.status === 'ready' &&
              (memoriesQuery.state.data.memories.length === 0 ? (
                <EmptyPanel title="No memories available">
                  <p>This instance has no memories available.</p>
                </EmptyPanel>
              ) : (
                <ul className="min-w-0 px-4">
                  {memoriesQuery.state.data.memories.map((memory) => (
                    <RecentMemory key={memory.id} memory={memory} />
                  ))}
                </ul>
              ))}
          </section>

          <section className="panel-raised min-w-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                Recent activity
              </h2>
              <a href={timelineHref({})} className="text-[11px] font-medium text-teal">
                View timeline
              </a>
            </div>
            {activityQuery.state.status === 'loading' && (
              <div className="p-4" aria-busy="true">
                <span className="sr-only">Loading recent activity…</span>
                <div className="h-3 w-3/5 animate-pulse rounded bg-slate-200" />
                <div className="mt-3 h-3 w-2/5 animate-pulse rounded bg-slate-200/70" />
              </div>
            )}
            {activityQuery.state.status === 'error' && (
              <ErrorPanel
                title="Could not load recent activity"
                message={activityQuery.state.message}
                onRetry={activityQuery.retry}
              />
            )}
            {activityQuery.state.status === 'ready' &&
              (activityQuery.state.data.events.length === 0 ? (
                <EmptyPanel title="No activity history">
                  <p>No stored activity events are available.</p>
                </EmptyPanel>
              ) : (
                <ul className="min-w-0 px-4">
                  {activityQuery.state.data.events.map((event) => (
                    <RecentEvent key={event.id} event={event} />
                  ))}
                </ul>
              ))}
          </section>
        </div>

        <section className="panel-raised min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Features
            </h2>
            {capabilities.status === 'unknown' && (
              <button type="button" onClick={retryCapabilities} className="btn-compact">
                Retry status
              </button>
            )}
          </div>
          <div className="px-4 py-2">
            {capabilities.status === 'unknown' && (
              <p className="mb-2 rounded bg-warn-soft px-2 py-1.5 text-[10px] text-warn-ink">
                Capability discovery is unavailable. Feature status is unknown.
              </p>
            )}
            <FeatureStatus label="Planning" state={featureState(capabilities, 'planning')} />
            <FeatureStatus label="Skills" state={featureState(capabilities, 'skills')} />
            <FeatureStatus label="Files" state={featureState(capabilities, 'files')} />
            <FeatureStatus label="Activity stream" state={featureState(capabilities, 'activity')} />
            <p className="mt-2 text-[10px] leading-relaxed text-muted">
              A disabled activity stream does not disable stored activity history.
            </p>
          </div>
        </section>
      </div>

      {memoryTotal !== null && memoryCount > 0 && (
        <p className="text-[10px] text-muted">
          Showing the latest {memoryCount} of {pluralMemories(memoryTotal)}. No full collection is
          loaded.
        </p>
      )}
    </div>
  )
}
