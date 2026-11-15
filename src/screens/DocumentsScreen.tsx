import { useEffect, useState } from 'react'
import { getDocument, listDocuments } from '../api/client'
import { DetailField } from '../components/DetailField'
import { EmptyPanel, ErrorPanel } from '../components/Feedback'
import { ProjectSelect } from '../components/ProjectSelect'
import { ResourceLayout } from '../components/ResourceLayout'
import { useApiData } from '../hooks/useApiData'
import { formatDate } from '../lib/format'
import type { DocumentsRoute } from '../router'
import { documentsHref, navigate } from '../router'

function DocumentDetail({ documentId }: { documentId: number }) {
  const detail = useApiData(`document-${documentId}`, (signal) => getDocument(documentId, signal))
  if (detail.state.status === 'loading')
    return <p className="p-4 text-[12px] text-muted">Loading document…</p>
  if (detail.state.status === 'error') {
    if (detail.state.httpStatus === 404) {
      return (
        <EmptyPanel title="Document not found">
          <p>This document is unavailable.</p>
        </EmptyPanel>
      )
    }
    return (
      <ErrorPanel
        title="Could not load document"
        message={detail.state.message}
        onRetry={detail.retry}
      />
    )
  }
  if (detail.state.status !== 'ready') return null
  const document = detail.state.data
  return (
    <div className="p-4">
      <h3 className="text-[16px] font-semibold text-ink">{document.title}</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="chip bg-teal-soft text-teal-ink">{document.document_type ?? 'text'}</span>
        {(document.tags ?? []).map((tag) => (
          <span key={tag} className="chip bg-canvas text-muted">
            {tag}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-ink-soft">{document.description}</p>
      <div className="mt-4 rounded border border-line bg-canvas/60 p-3">
        <p className="prose-copy">{document.content || 'No content recorded.'}</p>
      </div>
      <dl className="mt-4">
        <DetailField label="Project">{document.project_id ?? '—'}</DetailField>
        <DetailField label="Filename">{document.filename ?? '—'}</DetailField>
        <DetailField label="Size">
          {document.size_bytes ? `${document.size_bytes} bytes` : '—'}
        </DetailField>
        <DetailField label="Created">{formatDate(document.created_at)}</DetailField>
        <DetailField label="Updated">{formatDate(document.updated_at)}</DetailField>
      </dl>
    </div>
  )
}

export default function DocumentsScreen({ route }: { route: DocumentsRoute }) {
  const [typeInput, setTypeInput] = useState(route.documentType ?? '')
  useEffect(() => setTypeInput(route.documentType ?? ''), [route.documentType])
  const list = useApiData(
    `documents-${route.projectId ?? ''}-${route.documentType ?? ''}`,
    (signal) =>
      listDocuments({ projectId: route.projectId, documentType: route.documentType }, signal),
  )
  const documents = list.state.status === 'ready' ? list.state.data.documents : []

  function update(params: { projectId?: number | null; documentType?: string | null }) {
    navigate(
      documentsHref({
        documentId: route.documentId,
        projectId: route.projectId,
        documentType: route.documentType,
        ...params,
      }),
    )
  }

  return (
    <ResourceLayout
      listTitle="Documents"
      listSummary={
        list.state.status === 'ready' ? (
          <span className="text-[10px] text-muted">{list.state.data.total} total</span>
        ) : null
      }
      detailTitle="Document detail"
      selectedId={route.documentId}
      backHref={documentsHref({ projectId: route.projectId, documentType: route.documentType })}
      list={
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
            <ProjectSelect
              value={route.projectId}
              onChange={(projectId) => update({ projectId })}
            />
            <form
              className="flex min-w-0 items-center gap-1.5"
              onSubmit={(event) => {
                event.preventDefault()
                update({ documentType: typeInput.trim() || null })
              }}
            >
              <label htmlFor="document-type-filter" className="sr-only">
                Document type filter
              </label>
              <input
                id="document-type-filter"
                aria-label="Document type filter"
                value={typeInput}
                onChange={(event) => setTypeInput(event.target.value)}
                placeholder="Document type"
                className="field max-w-[180px]"
              />
              <button type="submit" aria-label="Apply document type filter" className="btn-compact">
                Apply
              </button>
            </form>
          </div>
          {list.state.status === 'loading' && (
            <p className="p-4 text-[12px] text-muted">Loading documents…</p>
          )}
          {list.state.status === 'error' && (
            <ErrorPanel
              title="Could not load documents"
              message={list.state.message}
              onRetry={list.retry}
            />
          )}
          {list.state.status === 'ready' && documents.length === 0 && (
            <EmptyPanel title="No documents found">
              <p>Try a different project or document type.</p>
            </EmptyPanel>
          )}
          {documents.length > 0 && (
            <ul aria-label="Documents" className="divide-y divide-line">
              {documents.map((document) => (
                <li key={document.id}>
                  <a
                    href={documentsHref({
                      documentId: document.id,
                      projectId: route.projectId,
                      documentType: route.documentType,
                    })}
                    data-resource-id={document.id}
                    aria-current={route.documentId === document.id ? 'true' : undefined}
                    className={`block px-4 py-2.5 hover:bg-canvas/70 ${
                      route.documentId === document.id ? 'bg-teal-soft/50' : ''
                    }`}
                  >
                    <span className="block truncate text-[12.5px] font-medium text-ink">
                      {document.title}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-1.5 text-[10px] text-muted">
                      <span>{document.document_type ?? 'text'}</span>
                      <span>project {document.project_id ?? '—'}</span>
                      <span>{formatDate(document.updated_at)}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      }
      detail={
        route.documentId !== null ? (
          <DocumentDetail documentId={route.documentId} />
        ) : (
          <div className="p-4">
            <p className="text-[13px] font-medium text-ink">Select a document</p>
            <p className="mt-1 text-[12px] text-muted">
              Choose a document to read its full safe-text content.
            </p>
          </div>
        )
      }
    />
  )
}
