import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listActivity } from '../api/client'
import type { ActivityEventRecord } from '../api/types'
import { EmptyPanel, ErrorPanel } from '../components/Feedback'
import { type ActivityStreamStatus, useActivityStream } from '../hooks/useActivityStream'
import { useApiData } from '../hooks/useApiData'
import { featureState, useCapabilities } from '../hooks/useCapabilities'
import { asNumber, asString, formatDate } from '../lib/format'
import { pageItems } from '../lib/pagination'
import type { TimelineRoute } from '../router'
import {
  codeHref,
  documentsHref,
  filesHref,
  memoriesHref,
  navigate,
  plansHref,
  projectsHref,
  skillsHref,
  timelineHref,
} from '../router'

const PAGE_SIZE = 20
const ENTITY_TYPES = [
  'memory',
  'project',
  'document',
  'code_artifact',
  'entity',
  'link',
  'entity_memory_link',
  'entity_relationship',
  'entity_project_link',
  'plan',
  'task',
  'criterion',
  'task_dependency',
  'file',
  'skill',
]
const ACTIONS = ['created', 'updated', 'deleted', 'read', 'queried']

function streamStatusLabel(status: ActivityStreamStatus): string {
  switch (status) {
    case 'connecting':
      return 'Connecting to live stream'
    case 'live':
      return 'Live activity stream'
    case 'reconnecting':
      return 'Reconnecting live stream'
    case 'paused':
      return 'Live stream paused'
    default:
      return 'Live stream disabled'
  }
}

function streamStatusTone(status: ActivityStreamStatus): { badge: string; dot: string } {
  switch (status) {
    case 'live':
      return { badge: 'bg-teal-soft text-teal-ink', dot: 'bg-teal' }
    case 'connecting':
    case 'reconnecting':
      return { badge: 'bg-warn-soft text-warn-ink', dot: 'bg-warn' }
    case 'paused':
      return { badge: 'bg-slate-100 text-muted', dot: 'bg-slate-400' }
    default:
      return { badge: 'bg-slate-100 text-muted', dot: 'bg-slate-400' }
  }
}

function eventLink(event: ActivityEventRecord): { href: string; label: string } | null {
  switch (event.entity_type) {
    case 'memory':
      return {
        href: memoriesHref({ memoryId: event.entity_id }),
        label: `Open memory #${event.entity_id}`,
      }
    case 'project':
      return {
        href: projectsHref({ projectId: event.entity_id }),
        label: `Open project #${event.entity_id}`,
      }
    case 'document':
      return {
        href: documentsHref({ documentId: event.entity_id }),
        label: `Open document #${event.entity_id}`,
      }
    case 'code_artifact':
      return {
        href: codeHref({ artifactId: event.entity_id }),
        label: `Open code artifact #${event.entity_id}`,
      }
    case 'file':
      return {
        href: filesHref({ fileId: event.entity_id }),
        label: `Open file #${event.entity_id}`,
      }
    case 'skill':
      return {
        href: skillsHref({ skillId: event.entity_id }),
        label: `Open skill #${event.entity_id}`,
      }
    case 'plan': {
      const planId = event.entity_id || asNumber(event.snapshot?.id)
      return planId ? { href: plansHref({ planId }), label: `Open plan #${planId}` } : null
    }
    case 'task': {
      const planId = asNumber(event.snapshot?.plan_id)
      return planId
        ? {
            href: plansHref({ planId, taskId: event.entity_id }),
            label: `Open task #${event.entity_id}`,
          }
        : null
    }
    default:
      return null
  }
}

function EventRow({ event }: { event: ActivityEventRecord }) {
  const link = eventLink(event)
  const title =
    asString(event.snapshot?.title) ??
    asString(event.snapshot?.name) ??
    asString(event.snapshot?.filename)
  return (
    <li className="border-b border-line last:border-0">
      <details className="group">
        <summary
          className={`
          flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1
          px-4 py-3 hover:bg-canvas/70
        `}
        >
          <span className="text-[11px] font-medium text-ink">
            {event.action} {event.entity_type} #{event.entity_id}
          </span>
          {title && <span className="min-w-0 flex-1 truncate text-[11px] text-muted">{title}</span>}
          <span className="text-[10px] text-muted">{event.actor ?? 'unknown actor'}</span>
          <span className="text-[10px] text-muted">{formatDate(event.created_at)}</span>
          <span className="text-[10px] text-muted group-open:hidden">Details</span>
          <span className="hidden text-[10px] text-muted group-open:inline">Close</span>
        </summary>
        <div className="border-t border-line bg-canvas/40 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-copper">
            Historical snapshot — not current state
          </p>
          <p className="mt-1 text-[10px] text-muted">
            A deleted or changed record may not match its current state or may no longer exist.
          </p>
          {link && (
            <a href={link.href} className="mt-2 inline-block text-[11px] font-medium text-teal">
              {link.label}
            </a>
          )}
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
                Snapshot
              </p>
              <pre className="detail-long-value mt-1">
                {JSON.stringify(event.snapshot ?? {}, null, 2)}
              </pre>
            </div>
            {event.changes && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
                  Changes
                </p>
                <pre className="detail-long-value mt-1">
                  {JSON.stringify(event.changes, null, 2)}
                </pre>
              </div>
            )}
            {event.metadata && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
                  Metadata
                </p>
                <pre className="detail-long-value mt-1">
                  {JSON.stringify(event.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </details>
    </li>
  )
}

export default function TimelineScreen({ route }: { route: TimelineRoute }) {
  const capabilities = useCapabilities()
  const activityStreamFeature = featureState(capabilities.state, 'activity')
  const activityStreamEnabled = activityStreamFeature === 'enabled'

  const [paused, setPaused] = useState(false)
  const [pendingLiveCount, setPendingLiveCount] = useState(0)
  const [livePrepended, setLivePrepended] = useState<ActivityEventRecord[]>([])
  const [liveTotalBoost, setLiveTotalBoost] = useState(0)
  const [catchUp, setCatchUp] = useState<{ events: ActivityEventRecord[]; total: number } | null>(
    null,
  )

  const offset = (route.page - 1) * PAGE_SIZE
  const query = useApiData(
    `timeline-${route.page}-${route.entityType ?? ''}-${route.action ?? ''}`,
    (signal) =>
      listActivity(
        {
          limit: PAGE_SIZE,
          offset,
          entityType: route.entityType,
          action: route.action,
        },
        signal,
      ),
  )
  const apiEvents = query.state.status === 'ready' ? query.state.data.events : []
  const apiTotal = query.state.status === 'ready' ? query.state.data.total : 0
  const events = catchUp?.events ?? apiEvents
  const total = catchUp?.total ?? apiTotal

  const eventsRef = useRef(events)
  eventsRef.current = events
  const livePrependedRef = useRef(livePrepended)
  livePrependedRef.current = livePrepended

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset live overlay when route filters change
  useEffect(() => {
    setPendingLiveCount(0)
    setLivePrepended([])
    setLiveTotalBoost(0)
    setCatchUp(null)
  }, [route.page, route.entityType, route.action])

  const handleLiveEvent = useCallback(
    (event: ActivityEventRecord) => {
      if (route.page !== 1) {
        setPendingLiveCount((count) => count + 1)
        return
      }
      const knownIds = new Set([
        ...eventsRef.current.map((item) => item.id),
        ...livePrependedRef.current.map((item) => item.id),
      ])
      if (knownIds.has(event.id)) return
      setLivePrepended((prev) => [event, ...prev])
      setLiveTotalBoost((boost) => boost + 1)
    },
    [route.page],
  )

  const handleGap = useCallback(() => {
    if (route.page !== 1) return
    void listActivity({
      limit: PAGE_SIZE,
      offset: 0,
      entityType: route.entityType,
      action: route.action,
    })
      .then((data) => {
        setCatchUp({ events: data.events, total: data.total })
        setLivePrepended([])
        setLiveTotalBoost(0)
      })
      .catch(() => {
        // Silent catch-up: keep the current list visible on failure.
      })
  }, [route.page, route.entityType, route.action])

  const streamStatus = useActivityStream({
    enabled: activityStreamEnabled && query.state.status === 'ready',
    paused,
    entityType: route.entityType ?? undefined,
    action: route.action ?? undefined,
    onEvent: handleLiveEvent,
    onGap: handleGap,
  })

  const renderedEvents = useMemo(() => {
    if (route.page !== 1) return events
    const seen = new Set(events.map((item) => item.id))
    const extras = livePrepended.filter((item) => !seen.has(item.id))
    return [...extras, ...events]
  }, [events, livePrepended, route.page])

  const renderedTotal = route.page === 1 ? total + liveTotalBoost : total
  const totalPages = Math.max(1, Math.ceil(renderedTotal / PAGE_SIZE))
  const pages = pageItems(route.page, totalPages)

  const streamTone = streamStatusTone(streamStatus)

  function update(params: { entityType?: string | null; action?: string | null }) {
    navigate(
      timelineHref({
        page: 1,
        entityType: params.entityType === undefined ? route.entityType : params.entityType,
        action: params.action === undefined ? route.action : params.action,
      }),
    )
  }

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <section className="panel-raised overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Activity history
          </h2>
          <label htmlFor="timeline-entity-filter" className="sr-only">
            Entity type filter
          </label>
          <select
            id="timeline-entity-filter"
            aria-label="Entity type filter"
            value={route.entityType ?? ''}
            onChange={(event) => update({ entityType: event.target.value || null })}
            className="field max-w-[170px]"
          >
            <option value="">All entity types</option>
            {ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <label htmlFor="timeline-action-filter" className="sr-only">
            Action filter
          </label>
          <select
            id="timeline-action-filter"
            aria-label="Action filter"
            value={route.action ?? ''}
            onChange={(event) => update({ action: event.target.value || null })}
            className="field max-w-[140px]"
          >
            <option value="">All actions</option>
            {ACTIONS.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
          {activityStreamEnabled && (
            <>
              <span
                className={`
                  inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px]
                  font-medium ${streamTone.badge}
                `}
                role="status"
                aria-live="polite"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${streamTone.dot}`} aria-hidden="true" />
                {streamStatusLabel(streamStatus)}
              </span>
              <button
                type="button"
                className="field px-2 py-1 text-[10px]"
                onClick={() => setPaused((value) => !value)}
              >
                {paused ? 'Resume live stream' : 'Pause live stream'}
              </button>
            </>
          )}
          <span className="ml-auto text-[10px] text-muted">
            {query.state.status === 'ready'
              ? `${renderedTotal.toLocaleString()} events`
              : 'Loading'}
          </span>
        </div>

        {pendingLiveCount > 0 && route.page > 1 && (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas/60 px-3 py-2 text-[11px] text-ink sm:px-4"
          >
            <span>
              {pendingLiveCount} new live event{pendingLiveCount === 1 ? '' : 's'}
            </span>
            <a
              href={timelineHref({
                page: 1,
                entityType: route.entityType,
                action: route.action,
              })}
              className="font-medium text-teal hover:underline"
            >
              Jump to page 1
            </a>
            <button
              type="button"
              className="text-muted underline decoration-dotted hover:text-ink"
              onClick={() => setPendingLiveCount(0)}
            >
              Dismiss
            </button>
          </div>
        )}

        {query.state.status === 'loading' && (
          <p className="p-4 text-[12px] text-muted">Loading activity history…</p>
        )}
        {query.state.status === 'error' && (
          <ErrorPanel
            title="Could not load activity history"
            message={query.state.message}
            onRetry={query.retry}
          />
        )}
        {query.state.status === 'ready' &&
          events.length === 0 &&
          (total > 0 ? (
            <EmptyPanel title="No activity events on this page">
              <p>
                {route.page > totalPages
                  ? `Page ${route.page} is outside the available range (1–${totalPages}).`
                  : `Page ${route.page} returned no activity events.`}
              </p>
              <p className="mt-3 flex flex-wrap items-center justify-center gap-3">
                <a
                  href={timelineHref({
                    page: 1,
                    entityType: route.entityType,
                    action: route.action,
                  })}
                  className="font-medium text-teal hover:underline"
                >
                  First page
                </a>
                <a
                  href={timelineHref({
                    page: totalPages,
                    entityType: route.entityType,
                    action: route.action,
                  })}
                  className="font-medium text-teal hover:underline"
                >
                  Last page ({totalPages})
                </a>
                {(route.entityType !== null || route.action !== null) && (
                  <a
                    href={timelineHref({ page: 1 })}
                    className="font-medium text-teal hover:underline"
                  >
                    Clear filters
                  </a>
                )}
              </p>
            </EmptyPanel>
          ) : (
            <EmptyPanel title="No activity events">
              <p>
                {route.entityType !== null || route.action !== null
                  ? 'No stored events match the current filters.'
                  : 'No stored activity events are available.'}
              </p>
            </EmptyPanel>
          ))}
        {renderedEvents.length > 0 && (
          <ul aria-label="Activity events">
            {renderedEvents.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        )}

        {query.state.status === 'ready' && renderedEvents.length > 0 && (
          <div className="pagination-bar">
            <p className="text-[11px] text-muted">
              Page {route.page} of {totalPages}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <nav aria-label="Timeline pages" className="page-nav">
                {pages.map((item, index) => {
                  const previous = pages[index - 1]
                  return item === 'gap' ? (
                    <span
                      key={`timeline-gap-after-${String(previous)}`}
                      className="page-gap"
                      aria-hidden="true"
                    >
                      …
                    </span>
                  ) : item === route.page ? (
                    <span key={item} className="page-current" aria-current="page">
                      {item}
                    </span>
                  ) : (
                    <a
                      key={item}
                      href={timelineHref({
                        page: item,
                        entityType: route.entityType,
                        action: route.action,
                      })}
                      aria-label={`Page ${item}`}
                      className="page-link"
                    >
                      {item}
                    </a>
                  )
                })}
              </nav>
            </div>
          </div>
        )}
      </section>
      <p className="text-[10px] leading-relaxed text-muted">
        {activityStreamEnabled
          ? 'Timeline lists stored activity history and subscribes to the live activity stream on page 1. Snapshots describe the record at the time of the event.'
          : activityStreamFeature === 'disabled'
            ? 'Timeline reads persisted activity history only. Live streaming is unavailable on this backend. Snapshots describe the record at the time of the event.'
            : 'Timeline reads persisted activity history. Live streaming availability is unknown until capability discovery completes. Snapshots describe the record at the time of the event.'}
      </p>
    </div>
  )
}
