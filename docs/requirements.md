# Forgetful UI prototype requirements

Status: The read-only pages are implemented, including the Plan Kanban board. Login and Sessions
remain deferred. Use npm and the test tools listed under Validation.

## Agreed decisions

- Build a working UI against the existing Forgetful REST API.
- Use React and TypeScript with strict mode enabled.
- Use Tailwind CSS 4 for styling and `react-force-graph-2d` for the canvas graph.
- Use Vite for development and production builds.
- Use hash routing, with URLs such as `/ui/#/memories` and `/ui/#/graph`.
- Load screen-specific code and data when needed. Do not load the whole graph at startup.
- Defer login and voice interaction.
- The eventual UI belongs in the main Forgetful repository as an optional component.
- Support the UI only when Forgetful runs as an HTTP server. STDIO remains unchanged.
- Build static HTML, CSS, and JavaScript that Forgetful's Python server can serve.
- Node.js is a development and build dependency only. Production needs no Node.js server or
  server-side rendering. Future voice support must not require a Node.js runtime either.

The prototype runs separately during development. Integration into Forgetful's Python package
and Docker images is later work. The optional distribution mechanism is not decided yet.

## First delivery

Start with a read-only Memories screen and Graph screen, with shared navigation between them.
These screens use live API responses. Do not substitute sample data when a request fails.

The first workflow is:

1. Open Memories and load one page of results.
2. Select a memory and read its details.
3. Open a graph view around that memory.
4. Select a graph node and inspect its details.
5. Return to Memories without a full application reload.

Do not expose create, edit, delete, import, or other mutation controls in this delivery. Do not
seed, reset, or migrate the connected database.

### Memories

- Show paginated results from the API. Do not download every memory to paginate in the browser.
- Fetch full details when a memory is selected.
- Support filtering by project using the API.
- Support the list options shipped in
  [Forgetful issue #214](https://github.com/ScottRBK/forgetful/issues/214): minimum and maximum
  importance filtering, literal substring search (`q`), inclusive updated-at range, and sorting by
  updated time, importance, title, or project name, in either direction. Tag filtering and
  obsolete-record visibility are not exposed in this iteration.
- Use bounded numbered pagination with first/last and nearby pages. Keep filters and sorting in
  the route and reset to page 1 when they change.
- Allow the wide-screen detail pane to be resized and expanded. Keep the narrow layout stacked.
- Show loading, empty, and error states. Allow a failed request to be retried.
- Handle a memory that was deleted or became unavailable after the list loaded.

### Graph

- Load the graph library and graph data only when the Graph screen is opened.
- Bare `#/graph` and the sidebar Graph link open an overview. A selected memory's existing graph
  link opens a bounded focused neighbourhood. Selecting a node in the overview opens detail only;
  replacing the overview with a neighbourhood must be an explicit action.
- The overview shows all non-obsolete memories and all projects, including unlinked projects.
  Request `GET /api/v1/graph` with explicit `node_types=memory,project`, small bounded pages (100
  memories), stable created-at ordering, and server-returned pagination metadata. Do not assemble
  the overview from `/memories`, fetch full records, sweep per-memory links/subgraphs, increase
  caps, or fabricate connections.
- Memory pagination covers only memories. Deduplicate repeated projects, optional nodes, and
  repeated edges across pages, and render only edges whose endpoints are in the loaded scope.
  Keep isolated records. Accumulate IDs and edges from returned metadata rather than summing
  repeated per-page counts.
- Pagination is not a transactional snapshot. Stop with a visible error on empty, repeating,
  inconsistent, or non-progressing pages. Do not silently truncate or claim complete success.
  Do not impose an arbitrary page/total cap; follow server totals and finite progress checks.
- Current pages omit memory links whose endpoints are on different pages. Show a persistent
  overview notice:
  “Some connections between memories may be missing until Forgetful #221 is fixed.”
  Explain that page-local links are omitted and stored links are not lost. Do not repair this by
  downloading full memories or sweeping subgraphs. Never label the overview connections complete.
  Track this API limitation in
  [Forgetful issue #221](https://github.com/ScottRBK/forgetful/issues/221).
- Memory and Project are shown by default in the overview. Their visibility controls filter the
  already-loaded display data: hide their nodes, incident edges, counts, accessible list entries,
  and selected detail; restore them without refetching. Keep fetched core types unchanged and run
  project scoping on the full loaded data before visibility filtering, so hiding Project does not
  hide matching related records or disable project filtering. Both can be hidden; selected
  optional records remain visible. If all loaded records are hidden, show a visibility-empty state
  distinct from no data. Persist visibility in the hash with a `hide` parameter restricted to
  Memory and Project, and carry it through type/project changes, refresh, history/reload, and
  focused-view round trips. Focused neighbourhoods do not apply overview visibility to their
  centre.
- Entity, document, code-artifact, file, skill, plan, and task nodes are optional and unchecked by
  default. Files, skills, plans, and tasks follow capability discovery; plans and tasks share the
  planning capability. Explicitly disabled types are disabled in the UI and excluded from
  requests. Unknown or failed discovery permits opt-in reads. The backend caps entity results at
  10,000; disclose that limit when entities are requested.
- A project filter filters memories at the API only. Scope other node types client-side using
  returned project metadata and relations. Document and code-artifact graph nodes do not carry
  `project_id`; scope them only through their returned document-project and code-artifact-project
  edges. Keep the requested project visible when it has no memories. Tasks have no project ID, so
  require Plans when a project filter is active; do not silently fetch unchecked types or show
  unrelated tasks. Explain that the server does not filter these collections by project.
- Show real loaded counts and progress, and explicit incomplete/error states with Retry. A later
  page failure must not render as a successful overview. No default selected-memory detail fetch
  occurs in the overview.
- Support pan, zoom, node selection, and node dragging. Distinguish supported object types
  visually and identify the selected object in a details panel.
- All links are faint initially. Hover or selection highlights every incident connection
  returned by the API, regardless of source/target direction, and its associated nodes. Handle
  force-graph mutating edge endpoints to node objects. Highlighting redraws without restarting
  simulation, recentering, refitting, or fetching data. Clear hover on exit and dataset
  replacement.
- Project nodes are larger and visibly named. Memory labels appear when zoomed in, hovered, or
  selected. Plan nodes use a distinct magenta from copper entities, with labels retained so colour
  is not the only identifier. Keep tooltips inert and pointer areas reliable.
- Fit the complete loaded dataset, including realistic >1,000-node overviews; allow a low enough
  minimum zoom. Do not refit on hover, selection, detail loading, or ordinary resize. No perpetual
  decorative animation.
- Fetch full node content only on selection, rather than embedding it in every graph response.
- Allow focused depth selection within backend limits and preserve Back to Memories filter/page/
  sort context. Exclude connections whose endpoints are not present in the focused response.
- Stop animation and requests when leaving the screen. A late response must not replace a newer
  selection or filter.

## Remaining read-only pages

Build these pages in the existing visual style, one working and tested slice at a time:

- Dashboard: connection and feature status, recent memories, and recent activity. Use actual API
  totals where available. Do not fetch every resource list just to populate count cards.
- Projects: summaries, supported status/repository filters, and full project details. Link to the
  project's Memories view.
- Plans: summaries with supported project/status filters. Selecting a plan opens its full-page
  Kanban board, with task details available on selection. See the approved board scope below.
- Documents: summaries, supported project/type filters, and full document content on selection.
- Code: summaries, supported project/language filters, and readable source on selection.
- Files: summaries, supported project/MIME-type filters, and selected-file metadata. Do not execute
  or automatically preview file content. Uploads and file editing are outside this delivery.
- Skills: summaries, supported project/minimum-importance filters, and full skill content and
  available association metadata on selection.
- Timeline: server-paginated activity history, supported filters, and expandable event details.
  Distinguish historical snapshots from the current record. No live stream is required.

Keep content as safe text or code. Raw HTML, embedded scripts, and external content must not run.
Optional content formatting does not justify adding dependencies without an audit.

Login is deferred. Sessions waits for backend support. Hide unfinished pages from navigation.
Do not display invented live data or controls that appear to work but do nothing. Existing
Memories behaviour and the focused Graph workflow must remain intact.

### Plan Kanban board

- Selecting a plan replaces the Plans list with a full-page board for that plan.
- Keep the existing plan and task hash links. Back to plans restores the list's project/status
  filters. Direct links, reload, and browser Back/Forward must work.
- Show the plan name, actual owning project name, status, and goal above the board. Retain access
  to the plan's context and metadata rather than dropping existing details.
- Use the existing task states, in order: To do, Doing, Waiting, Done, Cancelled. Keep empty
  columns visible. A blocked task keeps its state and gets a separate badge.
- Cards show title, priority, assigned agent, and acceptance-criteria progress from task summaries.
  Load full task details only when selected. Do not fetch every task's full content.
- Selecting a card opens a resizable right-hand detail panel with Expand/Restore. On narrow
  screens, show full-width task details with Back to board and restore focus to the selected card.
- Show the task description, acceptance criteria, dependencies, and existing metadata. Reject a
  task detail response that belongs to another plan.
- Add a manual Refresh control for the current plan, task summaries, and any selected task detail.
  Keep the current board, selected pane, focus, and board scroll visible while the refresh is
  pending, and label the displayed data as previous. Show failures clearly, allow retries, and
  prevent older responses from replacing newer data. Do not add automatic polling or live
  subscriptions.
- Keep all operations read-only. Do not add card dragging, state changes, edits, or create controls.
- Keep horizontal scrolling inside the board on small screens, not on the whole page. Long names
  and task text must remain readable inside their panels.
- Preserve optional-feature and access-denial handling. No backend changes or new dependencies
  are needed for this board.

### Prototype-only list exception

The user approved using the current unpaginated summary responses for Projects, Plans, Documents,
Code, Files, and Skills in this prototype only. Tasks are loaded for the selected plan, not across
all plans. Load a list when its page opens; do not preload all lists at startup or fetch each listed
record's full content. Keep filters on the server where supported. Do not invent paging parameters
or display page controls that suggest the server has returned a bounded page.

Track server pagination for these lists, including tasks, in
[Forgetful issue #215](https://github.com/ScottRBK/forgetful/issues/215).
Replace this exception with bounded server requests before integrating these lists into the main
Forgetful UI. The exception does not apply to Memories, Timeline, or graph requests, which already
have server limits. Do not change the backend or rebuild/deploy Docker for this prototype delivery.

### Optional features

Use capability discovery for Plans, Files, and Skills. An explicitly disabled feature should show
an explanation without making resource requests or offering working controls. Completed pages can
remain visible with their unavailable state. A failed discovery request or a missing capability
means unknown, not disabled. Feature availability does not grant permission.

The `activity_stream` capability describes streaming, not access to stored history. Timeline must
still be able to query the paginated Activity endpoint when streaming is disabled.

## API connection and routing

The development backend is `http://127.0.0.1:8022` by default.

- Configure the development proxy target through an environment file read by Vite's server.
- Keep machine-specific environment files out of Git. Provide a safe configuration example.
- Make browser API requests through the Vite proxy during development.
- Keep connection setup and common request handling in a small shared API client module.
- Use the documented API. Raise missing backend operations rather than inventing endpoints.
- Keep business rules, data ownership checks, and authorization in Forgetful.
- Never connect the browser directly to SQLite, PostgreSQL, or embedding providers.

In production, the browser calls the API on the same server as the UI. Preserve any deployment
path prefix. Do not bake a developer's backend address into the production bundle.

Browser environment values are normally fixed at build time. Changing a server environment file
must not be presented as a way to reconfigure an existing browser bundle.

Hash routing changes the displayed screen without requesting another HTML document. Bookmarks,
refreshes, and Back/Forward navigation must work. Python only needs to serve the UI entry page
and its assets; it does not need a separate route for each screen.

## Data loading and screen behaviour

- Give Projects, Documents, Code, Files, Skills, and the Plan board's selected-task panel the same
  wide-screen detail controls as Memories: pointer and keyboard resizing, bounded widths, and
  Expand/Restore. Restore the previous width, keep narrow-screen selection/back behaviour, and
  make no requests during resizing. Dashboard and Timeline do not need a new side panel.
- Show the actual project name in the Plans list and board header, using the plan's project ID
  rather than the current filter. Reuse the project summary data needed for the filter; do not
  fetch every project's full detail. Keep an explicit ID fallback if a name is unavailable.
- Timeline shows stored events, not a reconstructed history. Support all API action types without
  inventing missing events or enabling server-side collection as part of this UI work.
- Mount a screen and start its requests when the user opens it.
- Cancel requests that are no longer needed where practical. A late response must not replace
  data for a newer selection.
- Keep requests bounded, apart from the explicit prototype-only summary-list exception above and
  the explicit graph-overview page exception above. The overview uses lightweight graph summary
  pages, not full records. Do not silently increase limits to fetch full records.
- Show API failures as failures, not as empty successful results.
- Clean up timers, subscriptions, and graph animation when their screen is unmounted.

Do not add a persistent browser cache or offline mode for the first delivery. Temporary in-memory
state is acceptable, but it must not cause hidden screens to keep fetching data.

## Local prototype limits

Production login and authentication design are deferred. Basic handling of real data still applies:

- Bind the development server to loopback. This prototype is not for public deployment.
- Do not disable or bypass authentication on the connected Forgetful instance.
- If the instance requires unsupported authentication, report that clearly and stop making requests.
- Do not put credentials or provider secrets in browser configuration, URLs, or source files.
- Do not weaken the backend's CORS or authorization rules to make the prototype work.

## Public repository rules

- Do not include private design-reference names or local reference-project paths in committed files.
- Do not commit real Forgetful records, API captures, or screenshots containing private data.
- Use synthetic records for fixtures and public screenshots.
- Check licences before reusing code or assets, and preserve any required notices.
- Audit dependencies before adding, installing, or upgrading them. Include licence compatibility,
  package provenance, known vulnerabilities, and install scripts in the check.
- Commit a dependency lockfile. Choose exact package versions after the audit.

Use npm and commit its lockfile.

## Validation

Write a failing test for each working behaviour before implementing it. Prefer workflow tests over
exhaustive tests of component internals.

Use Vitest with React Testing Library for frontend behaviour, and Playwright for browser workflows.
API failures and unusual responses can use stubbed HTTP responses. Verify the main read-only
workflow against the local Forgetful instance as a separate check.

Before a slice is ready for review:

- Type checking and the production build pass. Vite's build does not replace type checking.
- Relevant automated tests pass.
- Loading, empty results, API failures, and unavailable records have been checked.
- Direct hash links, refreshes, and Back/Forward navigation work in a browser.
- Opening Memories does not request graph data or download the graph library.
- Leaving Graph stops its work; a late response cannot reopen an old selection.
- Tests do not modify the live knowledge base. Any future write tests use isolated test data.

Document the actual development, build, type-check, and test commands once the scaffold exists.
Future voice support and production packaging need no implementation in this mockup.

## Approved delivery scope

- [x] Read-only operation for the first delivery.
- [x] Memories list/detail and a selected-memory Graph as the first working workflow.
- [x] Hide unfinished pages.
- [x] Use npm, Vitest, React Testing Library, and Playwright after dependency audits.
- [x] Use the Forgetful elephant artwork for the brand mark and favicon, with licence notice.
- [x] Add server-backed sorting/filtering only where the API supports it, with numbered pagination.
- [x] Add wide-screen detail resizing/expansion and keep the narrow layout stacked.
- [x] Build Dashboard, Projects, Plans, Documents, Code, Files, Skills, and Timeline as
  read-only pages.
- [x] Allow existing unpaginated summary lists for this prototype only, tracked by issue #215.
- [x] Open each plan as a read-only Kanban board with selected-task details and manual refresh.
- [x] Add a paginated all-memory/all-project Graph overview with optional types, project scoping,
  canvas highlighting, and a documented #221 partial-memory-link exception.
- [x] Distinguish Plan and Entity colours, and add local Memory/Project visibility toggles with
  URL persistence while keeping core summary pages loaded.
