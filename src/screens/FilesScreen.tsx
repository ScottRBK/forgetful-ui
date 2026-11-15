import { useEffect, useState } from 'react'
import { getFile, listFiles } from '../api/client'
import { DetailField } from '../components/DetailField'
import { EmptyPanel, ErrorPanel } from '../components/Feedback'
import { ProjectSelect } from '../components/ProjectSelect'
import { ResourceLayout } from '../components/ResourceLayout'
import { useApiData } from '../hooks/useApiData'
import { type CapabilityState, featureState } from '../hooks/useCapabilities'
import { formatDate } from '../lib/format'
import type { FilesRoute } from '../router'
import { filesHref, navigate } from '../router'

function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  if (value < 1024) return `${value} bytes`
  return `${(value / 1024).toFixed(1)} KiB`
}

function FileDetail({ fileId }: { fileId: number }) {
  const detail = useApiData(`file-${fileId}`, (signal) => getFile(fileId, signal))
  if (detail.state.status === 'loading')
    return <p className="p-4 text-[12px] text-muted">Loading file metadata…</p>
  if (detail.state.status === 'error') {
    if (detail.state.httpStatus === 404)
      return (
        <EmptyPanel title="File not found">
          <p>This file is unavailable.</p>
        </EmptyPanel>
      )
    return (
      <ErrorPanel
        title="Could not load file"
        message={detail.state.message}
        onRetry={detail.retry}
      />
    )
  }
  if (detail.state.status !== 'ready') return null
  const file = detail.state.data
  return (
    <div className="p-4">
      <h3 className="text-[16px] font-semibold text-ink">{file.filename}</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="chip bg-teal-soft text-teal-ink">{file.mime_type ?? 'unknown type'}</span>
        {(file.tags ?? []).map((tag) => (
          <span key={tag} className="chip bg-canvas text-muted">
            {tag}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-ink-soft">{file.description}</p>
      <p className="mt-3 rounded border border-line bg-canvas/60 p-3 text-[11px] text-muted">
        Binary content is not displayed.
      </p>
      <dl className="mt-4">
        <DetailField label="Size">{formatBytes(file.size_bytes)}</DetailField>
        <DetailField label="Project">{file.project_id ?? '—'}</DetailField>
        <DetailField label="Created">{formatDate(file.created_at)}</DetailField>
        <DetailField label="Updated">{formatDate(file.updated_at)}</DetailField>
      </dl>
    </div>
  )
}

export default function FilesScreen({
  route,
  capabilities,
  retryCapabilities,
}: {
  route: FilesRoute
  capabilities: CapabilityState
  retryCapabilities: () => void
}) {
  const [mimeInput, setMimeInput] = useState(route.mimeType ?? '')
  useEffect(() => setMimeInput(route.mimeType ?? ''), [route.mimeType])
  const files = featureState(capabilities, 'files')
  const canRead = files === 'enabled' || files === 'unknown'
  const list = useApiData(
    `files-${route.projectId ?? ''}-${route.mimeType ?? ''}`,
    (signal) => listFiles({ projectId: route.projectId, mimeType: route.mimeType }, signal),
    canRead,
  )
  const items = list.state.status === 'ready' ? list.state.data.files : []

  function update(params: { projectId?: number | null; mimeType?: string | null }) {
    navigate(
      filesHref({
        fileId: route.fileId,
        projectId: route.projectId,
        mimeType: route.mimeType,
        ...params,
      }),
    )
  }

  if (files === 'loading')
    return <div className="p-4 text-[12px] text-muted">Checking file availability…</div>
  if (files === 'disabled') {
    return (
      <div className="p-4 sm:p-5">
        <div className="rounded-md border border-line bg-panel p-5">
          <p className="text-[14px] font-semibold text-ink">Files are unavailable</p>
          <p className="mt-2 max-w-lg text-[12px] text-muted">
            This instance reports file support as disabled. File data and project filters were not
            requested.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4 sm:p-5">
      {files === 'unknown' && (
        <div
          className={`
          flex flex-wrap items-center gap-2 rounded border border-warn-ink/20
          bg-warn-soft px-3 py-2 text-[11px] text-warn-ink
        `}
        >
          <span>File availability is unknown. Attempting a read-only request.</span>
          <button type="button" onClick={retryCapabilities} className="btn-compact">
            Retry status
          </button>
        </div>
      )}
      <ResourceLayout
        listTitle="Files"
        listSummary={
          list.state.status === 'ready' ? (
            <span className="text-[10px] text-muted">{list.state.data.total} total</span>
          ) : null
        }
        detailTitle="File metadata"
        selectedId={route.fileId}
        backHref={filesHref({ projectId: route.projectId, mimeType: route.mimeType })}
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
                  update({ mimeType: mimeInput.trim() || null })
                }}
              >
                <label htmlFor="file-mime-filter" className="sr-only">
                  MIME type filter
                </label>
                <input
                  id="file-mime-filter"
                  aria-label="MIME type filter"
                  value={mimeInput}
                  onChange={(event) => setMimeInput(event.target.value)}
                  placeholder="MIME type"
                  className="field max-w-[150px]"
                />
                <button type="submit" aria-label="Apply MIME filter" className="btn-compact">
                  Apply
                </button>
              </form>
            </div>
            {list.state.status === 'loading' && (
              <p className="p-4 text-[12px] text-muted">Loading files…</p>
            )}
            {list.state.status === 'error' && (
              <ErrorPanel
                title="Could not load files"
                message={list.state.message}
                onRetry={list.retry}
              />
            )}
            {list.state.status === 'ready' && items.length === 0 && (
              <EmptyPanel title="No files found">
                <p>Try a different project or MIME type.</p>
              </EmptyPanel>
            )}
            {items.length > 0 && (
              <ul aria-label="Files" className="divide-y divide-line">
                {items.map((file) => (
                  <li key={file.id}>
                    <a
                      href={filesHref({
                        fileId: file.id,
                        projectId: route.projectId,
                        mimeType: route.mimeType,
                      })}
                      data-resource-id={file.id}
                      aria-current={route.fileId === file.id ? 'true' : undefined}
                      className={`block px-4 py-2.5 hover:bg-canvas/70 ${
                        route.fileId === file.id ? 'bg-teal-soft/50' : ''
                      }`}
                    >
                      <span className="block truncate text-[12.5px] font-medium text-ink">
                        {file.filename}
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-1.5 text-[10px] text-muted">
                        <span>{file.mime_type ?? 'unknown type'}</span>
                        <span>{formatBytes(file.size_bytes)}</span>
                        <span>project {file.project_id ?? '—'}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </>
        }
        detail={
          route.fileId !== null ? (
            <FileDetail fileId={route.fileId} />
          ) : (
            <div className="p-4">
              <p className="text-[13px] font-medium text-ink">Select a file</p>
              <p className="mt-1 text-[12px] text-muted">
                Choose a file to read its metadata. Binary content is not displayed.
              </p>
            </div>
          )
        }
      />
    </div>
  )
}
