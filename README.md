# Forgetful UI mock-up

This is an experimental, read-only UI mock-up for
[Forgetful](https://github.com/ScottRBK/forgetful). It connects to a real Forgetful instance for
layout and workflow testing. It is not production-ready and is not yet part of Forgetful.

The mock-up includes:

- **Dashboard**: connection, feature status, bounded recent memories and activity.
- **Memories**: paginated list, filters, full memory detail, resize/expand.
- **Graph**: a paginated all-memory overview, plus bounded memory-centred neighbourhoods.
- **Projects**, **Plans** (a full-page Kanban board for each plan), **Documents**, **Code**,
  **Files**, **Skills**.
- **Timeline**: server-paginated stored activity history.

There are no write controls, no login flow, and no session screen. Login and Sessions stay hidden.

## Requirements

- Node.js 24.15 or newer and npm 11.
- A running Forgetful HTTP instance, version **0.8.0 or newer**. This UI uses the bounded
  resource-list pagination that v0.8.0 introduced. The default address is
  `http://127.0.0.1:8022`.
- No Python changes and no Node.js production server.

## Install and run

```bash
npm ci --ignore-scripts
cp .env.example .env    # optional; edit FORGETFUL_API_URL if needed
npm run dev
```

Open `http://127.0.0.1:5174/#/memories`. The server binds loopback only and uses a fixed
port. `FORGETFUL_API_URL` is read by the Vite **server** and used for its development proxy.
It is not a browser variable and is never bundled.

The start command for a browser review is:

```bash
cd forgetful-ui && npm run dev
```

## Commands

| Command                 | Purpose                                               |
| ----------------------- | ----------------------------------------------------- |
| `npm run dev`           | Development server on `127.0.0.1:5174`                |
| `npm run typecheck`     | Strict TypeScript check                               |
| `npm run lint`          | Biome lint and format check                           |
| `npm test`              | Vitest and React Testing Library workflows            |
| `npm run test:e2e`      | Playwright browser workflows with synthetic HTTP      |
| `npm run test:e2e:live` | Separate GET-only smoke test against the live backend |
| `npm run build`         | Type check and production build into `dist/`          |
| `npm run preview`       | Preview the built assets on `127.0.0.1:4174`          |

Playwright is configured to use Firefox. The browser is not installed by `npm ci`; on a fresh
machine, download the pinned browser once:

```bash
npx playwright install firefox
```

Playwright starts its own development server on `127.0.0.1:5174` and does not reuse an existing
server. Stop any manual `npm run dev` before running `npm run test:e2e`.

## Routing and API

The app uses hash routing:

- `#/dashboard`
- `#/memories`
- `#/memories/<id>?page=<n>&project=<id>&sort=...&order=...&importance=...&max=...&q=...&from=...&to=...`
- `#/graph?project=<id>&types=<comma-separated>&hide=<memory,project>`
- `#/graph?memory=<id>&depth=<1-3>`
- `#/projects?page=<n>&status=...&repo=...` and `#/projects/<id>?page=<n>&status=...&repo=...`
- `#/plans?page=<n>&project=...&status=...`
- `#/plans/<planId>?task=<taskId>&page=<n>&project=...&status=...`
- `#/documents?page=<n>&project=...&type=...` and `#/documents/<id>?page=<n>&...`
- `#/code?page=<n>&project=...&language=...` and `#/code/<id>?page=<n>&...`
- `#/files?page=<n>&project=...&mime=...` and `#/files/<id>?page=<n>&...`
- `#/skills?page=<n>&project=...&importance=...` and `#/skills/<id>?page=<n>&...`
- `#/entities/<id>?page=<n>&type=...`
- `#/timeline?page=<n>&entity=...&action=...`

The browser calls the API on the same server. In development, Vite proxies `/api`, `/health`,
and `/.well-known` to `FORGETFUL_API_URL`. In production, the app derives the API prefix from
its own path, so `/prefix/ui/` calls `/prefix/api/v1` and `/ui/` calls `/api/v1`. Built asset
URLs are relative, so the same files work under `/ui/` and `/prefix/ui/`.

The production bundle contains no backend address. Serve `dist/` as static files; no Node.js
runtime is required.

Static hosting must redirect `/ui` to `/ui/`, and `/prefix/ui` to `/prefix/ui/`. Built asset URLs
are relative to the directory, so the trailing slash is required. Integration into the Python
server remains future work.

Manual prefix contract: with `dist/` served at `/prefix/ui/`, assets load from
`/prefix/ui/assets/` and API calls use `/prefix/health` and `/prefix/api/v1/...`. No request should
use the unprefixed `/api/v1` path.

## Behaviour and limits

- Memories show 20 per page. The list uses the server `total`; it does not download everything.
- Projects, Plans, Documents, Code, Files, and Skills request bounded 20-record pages with
  explicit `limit`/`offset`, show first/last and nearby numbered controls with ellipses, and
  report the visible range from the rows actually received and the server `total`. Filter changes
  return to page 1. No ordinary list downloads a whole collection. An out-of-range page offers
  first/last recovery, and a later-page or metadata failure is an error with Retry, not an empty
  success.
- A page without v0.8.0 metadata (`total`, `limit`, or `offset`) fails with an actionable message
  naming Forgetful v0.8.0. Other inconsistencies, such as an invalid `total`, a non-array
  collection, or more rows than the requested limit, are rejected as errors without being
  described as an old backend. The UI does not fall back to an old unpaginated response.
- The list uses server-backed controls from Forgetful #214: project filter, minimum and maximum
  importance filters, text search (`q`), inclusive updated-at range (`from`/`to` in the URL,
  `updated_from`/`updated_to` on the API), and sorting by Updated, Importance, Memory title, or
  Project name in either direction (`sort=project` maps to `project_name`). Tag and obsolete filters
  are not exposed in this iteration; the UI does not fake unsupported controls.
- Project filter options are on-demand project summaries collected through sequential bounded
  pages, so more than 100 projects are available. They are not preloaded at startup and do not
  fetch each project's full detail. A failed or inconsistent collection offers no partial choice
  list; it shows Retry. A selected project outside the first page keeps its name. The option list
  loads when a screen needing it opens; a browser reload or a later visit loads it again. Ordinary
  paging, filter, or selection changes do not refetch it, and Memories Refresh does not refetch
  project options.
- Memories, Projects, Documents, Code, Files, and Skills have resizable wide-screen detail panes
  with pointer or keyboard control (Arrow keys, Home/End), bounded widths, and Expand/Restore.
  Narrow screens keep a full-width detail view with Back to list; resizing makes no API requests.
  The selected task panel on a Plan board has the same resize controls, with Back to board.
- Resource list projections stay as summaries, and full content is fetched only after selection.
  Separate page requests are not a transaction: concurrent changes can shift offsets, and ordinary
  page navigation may legitimately observe a different total between pages. Whole-collection
  consistency checks apply only to collections assembled in one run, such as project filter
  options and a plan board's task summaries. Those reject changed totals, repeated or
  non-progressing pages, duplicates, and malformed records, and Retry restarts the collection from
  its first page. [Forgetful issue #215](https://github.com/ScottRBK/forgetful/issues/215) is
  closed.
- Selecting a plan replaces the Plans list with a read-only Kanban board. Its columns are To do,
  Doing, Waiting, Done, and Cancelled, including empty columns. A blocked task keeps its state and
  gets a badge. Cards use task summaries only, so task detail is not downloaded until a card is
  selected. There is no dragging, editing, creation, or state change.
- A board collects every task summary page for its plan before it presents a complete board, so
  a plan with more than 100 tasks is not truncated to the first page. It validates page metadata
  and IDs and fails visibly on duplicates, empty or non-progressing pages, changed totals, wrong
  offsets, or malformed records; it does not retry automatically to hide an inconsistent read.
  Retry starts again from the first task page.
- The board header shows the plan title, status, goal, and its own project name from one
  `GET /api/v1/projects/{plan.project_id}` request. The ID is shown as a fallback when that lookup
  is loading or unavailable. Direct plan links do not load the Plans list or sweep project pages.
  Plan filters and page are restored by Back to plans.
- A selected task opens a resizable detail panel with description, acceptance criteria,
  dependencies, and metadata. A task belonging to another plan is rejected rather than shown as
  a child. Manual Refresh updates the plan, task summaries, and the selected task; there is no
  polling. While refreshing, the last complete board and selected pane stay visible with a
  refreshing label and previous data. Failures keep that view with an explicit error and retry.
  Focus, board scroll, and pane width are preserved. The panel uses the same stale-response and
  back/forward protections as other detail pages.
- Files and Skills are optional. Capability discovery is read once per relevant screen. Explicitly
  disabled features show an unavailable state and make no resource requests. Failed or malformed
  discovery means unknown, not disabled; unknown allows a careful read-only attempt and retry.
- Timeline uses `GET /api/v1/activity` with server limit/offset and supports all five stored action
  filters: created, updated, deleted, read, and queried. When `activity_stream: true`, page 1 also
  opens `GET /api/v1/activity/stream` (native `EventSource`) to prepend live events, with a pending
  banner on later pages. `activity_stream: false` disables the stream; stored history remains
  readable. Snapshots are labelled historical.
- Documents and skills are rendered as safe text. Code is inert text in a scrollable `pre`. Files
  show metadata only; binary/base64 content is not displayed or previewed.
- Each page loads its own screen chunk and list when opened. There is no all-list preload, hidden
  screen polling, or periodic refresh.
- Bare `#/graph` and the sidebar Graph link open an overview of all non-obsolete memories and all
  projects. It requests `GET /api/v1/graph` with explicit `node_types=memory,project`, 100 memories
  per page, stable created-at ordering, and deduplicates repeated projects and edges. It does not
  assemble the overview from `/memories`, fetch full records, or sweep per-memory subgraphs.
- Some memory connections between different pages are omitted by the current API. A persistent
  notice says: “Some connections between memories may be missing until Forgetful #221 is fixed.”
  Stored links are not lost. The overview never labels its connections complete. See
  [Forgetful issue #221](https://github.com/ScottRBK/forgetful/issues/221).
- Memory and Project are shown by default in the overview. Their checkboxes are local visibility
  controls: unchecking hides loaded nodes, incident edges, counts, and selected detail without
  changing requested core types, restarting pagination, or refetching. Project summaries remain
  loaded so project filtering and matching documents/code still work while Project is hidden.
  Both can be hidden, and selected optional records remain visible. The `hide` hash parameter
  accepts only Memory and Project. Focused neighbourhoods ignore overview visibility.
- Entity, document, code-artifact, file, skill, plan, and task nodes are optional and unchecked by
  default. Files, skills, plans, and tasks follow capability discovery; plans and tasks share the
  planning capability. Explicitly disabled types are not requested. Unknown discovery permits
  careful opt-in reads. The API caps entity results at 10,000 and the UI says so when relevant.
- A project filter applies only to memories in the API. Other node types are scoped after loading
  by project metadata or typed project edges; documents, code artifacts, and entities use their
  returned project edges. Tasks require Plans when filtering by project. The requested project
  remains visible when it has no memories.
- Overview progress reports loaded memories against the real total. Later-page failures and
  non-progressing pagination fail visibly with Retry; no partial result is labelled successful.
  Counts use loaded records, not fabricated totals. Pagination follows server totals without an
  arbitrary page cap and is not a transactional snapshot.
- The canvas fits the complete loaded dataset, including more than 1,000 nodes, with a low zoom
  floor. Project nodes are larger and labelled. Memory labels appear when zoomed in, hovered, or
  selected. Links are faint until hover or selection highlights every incident connection
  returned by the API, regardless of source/target direction, plus its associated nodes.
  Highlighting does not restart layout, refit, or fetch data.
- A focused view remains available from a memory's Open graph link. It requests depth 1-3 and at
  most 100 nodes, with Back to Memories context and an explicit Overview link. Selecting a memory
  in the overview opens detail only; Focus neighbourhood is explicit.
- The graph library and graph code are loaded in separate chunks. Opening Memories or other
  pages does not request them.
- Network failures are shown as failures. A 404 memory is shown as unavailable.
- Strict TypeScript, safe text rendering, and request cancellation are enabled.
- Authentication is not implemented. If the instance reports that auth is enabled, the app
  stops loading records and explains why.
- There is no persistent cache, offline mode, write operation, voice interaction, live SSE,
  file preview/download, or full-record graph preload.
- Tag and obsolete memory list filters remain out of scope; sorting and filtering from #214 (except
  tags and `include_obsolete`) are available when the connected Forgetful instance supports them.
- Development and preview use the Vite proxy. A production static deployment uses the API on
  its own origin and deployment prefix.

## Tests

Vitest workflow tests stub HTTP responses with synthetic records. Playwright tests exercise the
rendered app in Firefox, including every completed page, optional feature states, the real
force-graph canvas, navigation, reload/back/forward, list paging and filter resets, complete
multi-page boards, project options beyond the first 100 summaries, failures, and 390/1024/1440
widths. The live smoke test only issues GET requests and expects the local backend to be healthy
and to accept bounded list paging; files/skills disabled on the live instance are checked to make
no resource requests.

No test modifies the knowledge base. Test fixtures and screenshots do not contain live records.
Screenshots captured during development are kept outside the repository.

## Dependencies

Exact versions are pinned in `package.json` and `package-lock.json`. A supply-chain audit was
performed before installation: registry metadata, licences, package provenance, install
scripts, resolved transitive versions, and `npm audit`. The audit reports no known
vulnerabilities. Installation is documented with `--ignore-scripts`; the two declared install
scripts belong to `esbuild` and the optional macOS-only `fsevents` package.

The Forgetful elephant artwork is covered by [its MIT licence](./public/brand/LICENCE.txt).
