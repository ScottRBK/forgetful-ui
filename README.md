# Forgetful UI mock-up

This is an experimental, read-only UI mock-up for
[Forgetful](https://github.com/ScottRBK/forgetful). It connects to a real Forgetful instance for
layout and workflow testing. It is not production-ready and is not yet part of Forgetful.

The mock-up includes:

- **Dashboard**: connection, feature status, bounded recent memories and activity.
- **Memories**: paginated list, filters, full memory detail, resize/expand.
- **Graph**: a bounded neighbourhood around the selected memory.
- **Projects**, **Plans** (with plan-scoped tasks), **Documents**, **Code**, **Files**, **Skills**.
- **Timeline**: server-paginated stored activity history.

There are no write controls, no login flow, and no session screen. Login and Sessions stay hidden.

## Requirements

- Node.js 24.15 or newer and npm 11.
- A running Forgetful HTTP instance. The default is `http://127.0.0.1:8022`.
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
- `#/memories/<id>?page=<n>&project=<id>&sort=...&order=...&importance=...`
- `#/graph?memory=<id>&depth=<1-3>`
- `#/projects/<id>?status=...&repo=...`
- `#/plans/<planId>?task=<taskId>&project=...&status=...`
- `#/documents/<id>?project=...&type=...`
- `#/code/<id>?project=...&language=...`
- `#/files/<id>?project=...&mime=...`
- `#/skills/<id>?project=...&importance=...`
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

- A page has 20 memories. The list uses the server `total`; it does not download everything.
- Numbered pagination shows first/last and nearby pages with ellipses. Previous/next remain.
- The list supports only server-backed controls: project filter, minimum importance filter, and
  sorting by Updated or Importance in either direction. Title/project sorting, text search, and
  date filtering wait for backend support. Tag and obsolete filters are not exposed in this
  iteration; the UI does not fake unsupported controls.
- A project is selected from the separate project list. The project endpoint is not paginated.
- Memories, Projects, Plans, Documents, Code, Files, and Skills have resizable wide-screen detail
  panes with pointer or keyboard control (Arrow keys, Home/End), bounded widths, and Expand/Restore.
  Narrow screens keep a full-width detail view with Back to list; resizing makes no API requests.
- Projects, Plans, Documents, Code, Files, and Skills use the existing summary-list responses
  without limit/offset. This is a prototype-only exception tracked by
  [Forgetful issue #215](https://github.com/ScottRBK/forgetful/issues/215). They are not presented
  as server-paginated lists, and full content is fetched only after selection.
- Plans show the selected plan's own project name from the project summary used by the filter,
  with an explicit ID fallback if that lookup is loading or unavailable. This is independent of
  the project filter. Tasks are fetched only for the selected plan. Task detail includes state,
  priority, criteria, dependencies, and optional description. No task transitions or edits are
  offered; a task belonging to another plan is rejected rather than shown as a child.
- Files and Skills are optional. Capability discovery is read once per relevant screen. Explicitly
  disabled features show an unavailable state and make no resource requests. Failed or malformed
  discovery means unknown, not disabled; unknown allows a careful read-only attempt and retry.
- Timeline uses `GET /api/v1/activity` with server limit/offset and supports all five stored action
  filters: created, updated, deleted, read, and queried. `activity_stream: false` disables new
  activity collection and live streaming; previously stored history remains readable and is not
  backfilled. Snapshots are labelled historical.
- Documents and skills are rendered as safe text. Code is inert text in a scrollable `pre`. Files
  show metadata only; binary/base64 content is not displayed or previewed.
- Each page loads its own screen chunk and list when opened. There is no all-list preload, hidden
  screen polling, or periodic refresh.
- Graph layout and behaviour are unchanged. The graph loads only after a memory is chosen; it
  requests depth 1-3 and at most 100 nodes.
- The graph library and graph code are loaded in separate chunks. Opening Memories or other
  pages does not request them.
- Network failures are shown as failures. A 404 memory is shown as unavailable.
- Strict TypeScript, safe text rendering, and request cancellation are enabled.
- Authentication is not implemented. If the instance reports that auth is enabled, the app
  stops loading records and explains why.
- There is no persistent cache, offline mode, write operation, voice interaction, live SSE,
  file preview/download, or full-graph download.
- Title/project memory sorting and text/date memory filters remain deferred to issue #214.
- Development and preview use the Vite proxy. A production static deployment uses the API on
  its own origin and deployment prefix.

## Tests

Vitest workflow tests stub HTTP responses with synthetic records. Playwright tests exercise the
rendered app in Firefox, including every completed page, optional feature states, the real
force-graph canvas, navigation, reload/back/forward, failures, and 390/1024/1440 widths. The live
smoke test only issues GET requests and expects the local backend to be healthy; files/skills
disabled on the live instance are checked to make no resource requests.

No test modifies the knowledge base. Test fixtures and screenshots do not contain live records.
Screenshots captured during development are kept outside the repository.

## Dependencies

Exact versions are pinned in `package.json` and `package-lock.json`. A supply-chain audit was
performed before installation: registry metadata, licences, package provenance, install
scripts, resolved transitive versions, and `npm audit`. The audit reports no known
vulnerabilities. Installation is documented with `--ignore-scripts`; the two declared install
scripts belong to `esbuild` and the optional macOS-only `fsevents` package.

The Forgetful elephant artwork is covered by [its MIT licence](./public/brand/LICENCE.txt).
