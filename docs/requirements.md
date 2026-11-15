# Forgetful UI prototype requirements

Status: The read-only pages below are implemented. Login and Sessions remain deferred.
Use npm and the test tools listed under Validation.

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
- Support the list options the current API actually provides: minimum importance filtering and
  sorting by updated time or importance, in either direction.
- Defer title/project sorting, text search, and date filtering to the backend enhancement in
  [Forgetful issue #214](https://github.com/ScottRBK/forgetful/issues/214).
  Do not change the backend or rebuild its Docker image for this iteration. Tag filtering and
  obsolete-record visibility are not exposed in this iteration.
- Use bounded numbered pagination with first/last and nearby pages. Keep filters and sorting in
  the route and reset to page 1 when they change.
- Allow the wide-screen detail pane to be resized and expanded. Keep the narrow layout stacked.
- Show loading, empty, and error states. Allow a failed request to be retried.
- Handle a memory that was deleted or became unavailable after the list loaded.

### Graph

- Load the graph library and graph data only when the Graph screen is opened.
- Request a bounded neighbourhood around the selected memory. Respect the server's limits.
- Support pan, zoom, node selection, and node dragging.
- Distinguish supported object types visually and identify the selected object in a details panel.
- Fetch full node content on selection, rather than embedding it in every graph response.
- Allow depth selection within the limits supported by the backend.
- Exclude connections whose endpoints are not present in the current graph response.
- Stop animation and any subscriptions when leaving the screen.

Whole-database loading, live activity highlighting, elaborate motion effects, and voice-driven
animation are outside the proposed first delivery. Graph appearance remains open to visual review.

## Remaining read-only pages

Build these pages in the existing visual style, one working and tested slice at a time:

- Dashboard: connection and feature status, recent memories, and recent activity. Use actual API
  totals where available. Do not fetch every resource list just to populate count cards.
- Projects: summaries, supported status/repository filters, and full project details. Link to the
  project's Memories view.
- Plans: summaries with supported project/status filters, plan details, and tasks within the
  selected plan. Show task details, state, priority, criteria, and dependencies without edit
  controls.
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
Do not display invented live data or controls that appear to work but do nothing. Existing Memories
and Graph behaviour must remain intact; graph visual changes are outside this delivery.

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

- Give Projects, Plans, Documents, Code, Files, and Skills the same wide-screen detail controls
  as Memories: pointer and keyboard resizing, bounded widths, and Expand/Restore. Restore the
  previous width, keep narrow-screen selection/back behaviour, and make no requests during resizing.
  Dashboard and Timeline do not need a new side panel. Keep Graph unchanged for this iteration.
- Show the actual project name in the Plans list and selected-plan detail, using the plan's
  project ID rather than the current filter. Reuse the project summary data needed for the filter;
  do not fetch every project's full detail. Keep an explicit ID fallback if a name is unavailable.
- Timeline shows stored events, not a reconstructed history. Support all API action types without
  inventing missing events or enabling server-side collection as part of this UI work.
- Mount a screen and start its requests when the user opens it.
- Cancel requests that are no longer needed where practical. A late response must not replace
  data for a newer selection.
- Keep requests bounded, apart from the explicit prototype-only summary-list exception above.
  Do not silently increase limits to fetch the entire knowledge base.
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
