import { listActivity } from '../api/client'
import type { ActivityEventRecord } from '../api/types'
import { EmptyPanel, ErrorPanel } from '../components/Feedback'
import { useApiData } from '../hooks/useApiData'
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
  const events = query.state.status === 'ready' ? query.state.data.events : []
  const total = query.state.status === 'ready' ? query.state.data.total : 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pages = pageItems(route.page, totalPages)

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
          <span className="ml-auto text-[10px] text-muted">
            {query.state.status === 'ready' ? `${total.toLocaleString()} events` : 'Loading'}
          </span>
        </div>

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
        {events.length > 0 && (
          <ul aria-label="Activity events">
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        )}

        {query.state.status === 'ready' && events.length > 0 && (
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
        Timeline reads persisted activity history only. It does not open a live stream. Snapshots
        describe the record at the time of the event.
      </p>
    </div>
  )
}
