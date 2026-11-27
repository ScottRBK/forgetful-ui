import { getEntity, getEntityMemories, getEntityRelationships, listEntities } from '../api/client'
import {
  ENTITY_TYPE_OPTIONS,
  type EntityRelationshipRecord,
  type EntitySummary,
  type EntityTypeName,
} from '../api/types'
import { DetailField } from '../components/DetailField'
import { EmptyPanel, ErrorPanel } from '../components/Feedback'
import { ArrowLeftIcon, ArrowRightIcon } from '../components/Icons'
import { ResourceLayout } from '../components/ResourceLayout'
import { useApiData } from '../hooks/useApiData'
import { formatDate } from '../lib/format'
import { pageItems } from '../lib/pagination'
import type { EntitiesRoute } from '../router'
import { entitiesHref, memoriesHref, navigate } from '../router'

const PAGE_SIZE = 20

function projectLabel(projectIds: number[] | null | undefined): string {
  if (!projectIds || projectIds.length === 0) return '—'
  if (projectIds.length === 1) return String(projectIds[0])
  return `${projectIds[0]} +${projectIds.length - 1}`
}

function listQueryContext(route: EntitiesRoute) {
  return { page: route.page, entityType: route.entityType }
}

function RelatedEntityLink({
  relationship,
  selfId,
  route,
  summaries,
}: {
  relationship: EntityRelationshipRecord
  selfId: number
  route: EntitiesRoute
  summaries: Map<number, EntitySummary>
}) {
  const relatedId =
    relationship.source_entity_id === selfId
      ? relationship.target_entity_id
      : relationship.source_entity_id
  const direction = relationship.source_entity_id === selfId ? 'outgoing' : 'incoming'
  const summary = summaries.get(relatedId)

  // Names come from the entity summaries the list already loaded. A related
  // entity outside that page stays an id-only link: fetching it to print a name
  // would be an automatic detail sweep for a record nobody selected.
  return (
    <li>
      <a
        href={entitiesHref({ entityId: relatedId, ...listQueryContext(route) })}
        className={`
          block rounded px-2 py-2 hover:bg-canvas/70
          focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-teal-300
        `}
      >
        <span className="block text-[12px] font-medium text-ink">
          {summary?.name ?? `Entity #${relatedId}`}
        </span>
        <span className="mt-0.5 flex flex-wrap gap-1.5 text-[10px] text-muted">
          <span>{summary?.entity_type ?? '—'}</span>
          <span>{relationship.relationship_type}</span>
          <span>{direction}</span>
        </span>
      </a>
    </li>
  )
}

function EntityDetail({
  entityId,
  route,
  summaries,
}: {
  entityId: number
  route: EntitiesRoute
  summaries: Map<number, EntitySummary>
}) {
  const detail = useApiData(`entity-${entityId}`, (signal) => getEntity(entityId, signal))
  const memories = useApiData(`entity-memories-${entityId}`, (signal) =>
    getEntityMemories(entityId, signal),
  )
  const relationships = useApiData(`entity-relationships-${entityId}`, (signal) =>
    getEntityRelationships(entityId, signal),
  )

  if (detail.state.status === 'loading')
    return <p className="p-4 text-[12px] text-muted">Loading entity…</p>
  if (detail.state.status === 'error') {
    if (detail.state.httpStatus === 404) {
      return (
        <EmptyPanel title="Entity not found">
          <p>This entity is unavailable.</p>
        </EmptyPanel>
      )
    }
    return (
      <ErrorPanel
        title="Could not load entity"
        message={detail.state.message}
        onRetry={detail.retry}
      />
    )
  }
  if (detail.state.status !== 'ready') return null

  const entity = detail.state.data
  const typeLabel =
    entity.entity_type === 'Other' && entity.custom_type
      ? `Other (${entity.custom_type})`
      : entity.entity_type

  return (
    <div className="p-4">
      <h3 className="text-[16px] font-semibold text-ink">{entity.name}</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="chip bg-teal-soft text-teal-ink">{typeLabel}</span>
        {(entity.tags ?? []).map((tag) => (
          <span key={tag} className="chip bg-canvas text-muted">
            {tag}
          </span>
        ))}
      </div>
      {(entity.aka ?? []).length > 0 && (
        <p className="mt-2 text-[11px] text-muted">
          Also known as: {(entity.aka ?? []).join(', ')}
        </p>
      )}
      <p className="mt-3 text-[12px] text-ink-soft">{entity.notes || 'No notes recorded.'}</p>
      <dl className="mt-4">
        <DetailField label="Projects">
          {entity.project_ids && entity.project_ids.length > 0
            ? entity.project_ids.join(', ')
            : '—'}
        </DetailField>
        <DetailField label="Confidence">
          {entity.confidence !== null && entity.confidence !== undefined ? entity.confidence : '—'}
        </DetailField>
        <DetailField label="Created">{formatDate(entity.created_at)}</DetailField>
        <DetailField label="Updated">{formatDate(entity.updated_at)}</DetailField>
      </dl>

      <section className="mt-4 rounded border border-line" aria-label="Linked memories">
        <p
          className={`
          border-b border-line px-3 py-2 text-[10px] font-medium uppercase
          tracking-[0.12em] text-muted
        `}
        >
          Linked memories
        </p>
        {memories.state.status === 'loading' && (
          <p className="p-3 text-[11px] text-muted">Loading linked memories…</p>
        )}
        {memories.state.status === 'error' && (
          <ErrorPanel
            title="Could not load linked memories"
            message={memories.state.message}
            onRetry={memories.retry}
          />
        )}
        {memories.state.status === 'ready' && memories.state.data.memories.length === 0 && (
          <p className="p-3 text-[11px] text-muted">No linked memories.</p>
        )}
        {memories.state.status === 'ready' && memories.state.data.memories.length > 0 && (
          <ul className="divide-y divide-line px-1 py-1">
            {memories.state.data.memories.map((memory) => (
              <li key={memory.id}>
                <a
                  href={memoriesHref({ memoryId: memory.id })}
                  className={`
                    block rounded px-2 py-2 text-[12px] text-ink hover:bg-canvas/70
                    focus-visible:outline-2 focus-visible:outline-offset-2
                    focus-visible:outline-teal-300
                  `}
                >
                  <span className="font-medium">{memory.title}</span>
                  <span className="ml-2 text-[10px] text-muted">#{memory.id}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded border border-line" aria-label="Relationships">
        <p
          className={`
          border-b border-line px-3 py-2 text-[10px] font-medium uppercase
          tracking-[0.12em] text-muted
        `}
        >
          Relationships
        </p>
        {relationships.state.status === 'loading' && (
          <p className="p-3 text-[11px] text-muted">Loading relationships…</p>
        )}
        {relationships.state.status === 'error' && (
          <ErrorPanel
            title="Could not load relationships"
            message={relationships.state.message}
            onRetry={relationships.retry}
          />
        )}
        {relationships.state.status === 'ready' &&
          relationships.state.data.relationships.length === 0 && (
            <p className="p-3 text-[11px] text-muted">No relationships recorded.</p>
          )}
        {relationships.state.status === 'ready' &&
          relationships.state.data.relationships.length > 0 && (
            <ul className="divide-y divide-line px-1 py-1">
              {relationships.state.data.relationships.map((relationship) => (
                <RelatedEntityLink
                  key={relationship.id}
                  relationship={relationship}
                  selfId={entityId}
                  route={route}
                  summaries={summaries}
                />
              ))}
            </ul>
          )}
      </section>
    </div>
  )
}

export default function EntitiesScreen({ route }: { route: EntitiesRoute }) {
  const offset = (route.page - 1) * PAGE_SIZE
  const list = useApiData(`entities-${route.page}-${route.entityType ?? ''}`, (signal) =>
    listEntities({ entityType: route.entityType, limit: PAGE_SIZE, offset }, signal),
  )

  const entities = list.state.status === 'ready' ? list.state.data.entities : []
  const total = list.state.status === 'ready' ? list.state.data.total : 0
  // Names for related entities come from this page's summaries, never a fetch.
  const summaries = new Map(entities.map((entity) => [entity.id, entity]))
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pages = pageItems(route.page, totalPages)

  function updateType(entityType: EntityTypeName | null) {
    navigate(
      entitiesHref({
        entityId: route.entityId,
        page: 1,
        entityType,
      }),
    )
  }

  return (
    <ResourceLayout
      listTitle="Entities"
      listSummary={
        list.state.status === 'ready' ? (
          <span className="text-[10px] text-muted">{total.toLocaleString()} total</span>
        ) : null
      }
      detailTitle="Entity detail"
      selectedId={route.entityId}
      backHref={entitiesHref(listQueryContext(route))}
      list={
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
            <label htmlFor="entity-type-filter" className="sr-only">
              Entity type filter
            </label>
            <select
              id="entity-type-filter"
              aria-label="Entity type filter"
              value={route.entityType ?? ''}
              onChange={(event) => {
                const value = event.target.value
                updateType(value === '' ? null : (value as EntityTypeName))
              }}
              className="field max-w-[160px]"
            >
              <option value="">All types</option>
              {ENTITY_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          {list.state.status === 'loading' && (
            <p className="p-4 text-[12px] text-muted">Loading entities…</p>
          )}
          {list.state.status === 'error' && (
            <ErrorPanel
              title="Could not load entities"
              message={list.state.message}
              onRetry={list.retry}
            />
          )}
          {list.state.status === 'ready' &&
            entities.length === 0 &&
            (total > 0 ? (
              <EmptyPanel title="No entities on this page">
                <p>
                  {route.page > totalPages
                    ? `Page ${route.page} is outside the available range (1–${totalPages}).`
                    : `Page ${route.page} returned no entities.`}
                </p>
                <p className="mt-3 flex flex-wrap items-center justify-center gap-3">
                  <a
                    href={entitiesHref({ page: 1, entityType: route.entityType })}
                    className="font-medium text-teal hover:underline"
                  >
                    First page
                  </a>
                  <a
                    href={entitiesHref({ page: totalPages, entityType: route.entityType })}
                    className="font-medium text-teal hover:underline"
                  >
                    Last page ({totalPages})
                  </a>
                  {route.entityType !== null && (
                    <a
                      href={entitiesHref({ page: 1 })}
                      className="font-medium text-teal hover:underline"
                    >
                      Clear type filter
                    </a>
                  )}
                </p>
              </EmptyPanel>
            ) : (
              <EmptyPanel title="No entities found">
                <p>
                  {route.entityType !== null
                    ? 'No entities match the current type filter.'
                    : 'No entities are available.'}
                </p>
              </EmptyPanel>
            ))}
          {entities.length > 0 && (
            <>
              <ul aria-label="Entities" className="divide-y divide-line">
                {entities.map((entity) => (
                  <li key={entity.id}>
                    <a
                      href={entitiesHref({
                        entityId: entity.id,
                        ...listQueryContext(route),
                      })}
                      data-resource-id={entity.id}
                      aria-current={route.entityId === entity.id ? 'true' : undefined}
                      className={`block px-4 py-2.5 hover:bg-canvas/70 ${
                        route.entityId === entity.id ? 'bg-teal-soft/50' : ''
                      }`}
                    >
                      <span className="block truncate text-[12.5px] font-medium text-ink">
                        {entity.name}
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-1.5 text-[10px] text-muted">
                        <span>{entity.entity_type}</span>
                        <span>project {projectLabel(entity.project_ids)}</span>
                        <span>{formatDate(entity.updated_at)}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <div className="pagination-bar">
                <p className="text-[11px] text-muted">
                  Page {route.page} of {totalPages}
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <nav aria-label="Entity pages" className="page-nav">
                    {pages.map((item, index) => {
                      const previous = pages[index - 1]
                      return item === 'gap' ? (
                        <span
                          key={`entities-gap-after-${String(previous)}`}
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
                          href={entitiesHref({ page: item, entityType: route.entityType })}
                          aria-label={`Page ${item}`}
                          className="page-link"
                        >
                          {item}
                        </a>
                      )
                    })}
                  </nav>
                  <div className="flex items-center gap-1.5">
                    {route.page > 1 ? (
                      <a
                        href={entitiesHref({
                          page: route.page - 1,
                          entityId: route.entityId,
                          entityType: route.entityType,
                        })}
                        className="btn-compact"
                      >
                        <ArrowLeftIcon className="h-3 w-3" />
                        Previous
                      </a>
                    ) : (
                      <span className="btn-disabled">
                        <ArrowLeftIcon className="h-3 w-3" />
                        Previous
                      </span>
                    )}
                    {route.page < totalPages ? (
                      <a
                        href={entitiesHref({
                          page: route.page + 1,
                          entityId: route.entityId,
                          entityType: route.entityType,
                        })}
                        aria-label="Next page"
                        className="btn-compact"
                      >
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
            </>
          )}
        </>
      }
      detail={
        route.entityId !== null ? (
          <EntityDetail entityId={route.entityId} route={route} summaries={summaries} />
        ) : (
          <div className="p-4">
            <p className="text-[13px] font-medium text-ink">Select an entity</p>
            <p className="mt-1 text-[12px] text-muted">
              Choose an entity to read its notes, linked memories, and relationships.
            </p>
          </div>
        )
      }
    />
  )
}
