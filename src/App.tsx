import { lazy, Suspense, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { useCapabilities } from './hooks/useCapabilities'
import type { ConnectionState } from './hooks/useConnection'
import { useConnection } from './hooks/useConnection'
import { nodeFocusLabel } from './lib/graphStyle'
import { graphHref, memoriesHref, useHashRoute } from './router'
import { MemoriesScreen } from './screens/MemoriesScreen'

const GraphScreen = lazy(() => import('./screens/GraphScreen'))
const DashboardScreen = lazy(() => import('./screens/DashboardScreen'))
const ProjectsScreen = lazy(() => import('./screens/ProjectsScreen'))
const PlansScreen = lazy(() => import('./screens/PlansScreen'))
const DocumentsScreen = lazy(() => import('./screens/DocumentsScreen'))
const CodeScreen = lazy(() => import('./screens/CodeScreen'))
const FilesScreen = lazy(() => import('./screens/FilesScreen'))
const SkillsScreen = lazy(() => import('./screens/SkillsScreen'))
const EntitiesScreen = lazy(() => import('./screens/EntitiesScreen'))
const TimelineScreen = lazy(() => import('./screens/TimelineScreen'))

function screenDetails(route: ReturnType<typeof useHashRoute>): {
  title: string
  subtitle: string
} {
  if (route.kind === 'dashboard') {
    return { title: 'Dashboard', subtitle: 'Workspace overview' }
  }
  if (route.kind === 'projects') {
    return {
      title: 'Projects',
      subtitle: route.projectId ? `Project #${route.projectId}` : 'Browse projects',
    }
  }
  if (route.kind === 'plans') {
    return {
      title: 'Plans',
      subtitle: route.planId ? `Plan #${route.planId}` : 'Browse plans and tasks',
    }
  }
  if (route.kind === 'documents') {
    return {
      title: 'Documents',
      subtitle: route.documentId ? `Document #${route.documentId}` : 'Browse documents',
    }
  }
  if (route.kind === 'code') {
    return {
      title: 'Code',
      subtitle: route.artifactId ? `Code artifact #${route.artifactId}` : 'Browse code artifacts',
    }
  }
  if (route.kind === 'files') {
    return {
      title: 'Files',
      subtitle: route.fileId ? `File #${route.fileId}` : 'Browse file metadata',
    }
  }
  if (route.kind === 'skills') {
    return {
      title: 'Skills',
      subtitle: route.skillId ? `Skill #${route.skillId}` : 'Browse skills',
    }
  }
  if (route.kind === 'entities') {
    return {
      title: 'Entities',
      subtitle: route.entityId ? `Entity #${route.entityId}` : 'Browse entities',
    }
  }
  if (route.kind === 'timeline') {
    return { title: 'Timeline', subtitle: 'Stored activity history' }
  }
  if (route.kind === 'graph') {
    return {
      title: 'Graph',
      subtitle: route.focus
        ? `Neighbourhood around ${nodeFocusLabel(route.focus.type, route.focus.id)}`
        : 'Knowledge graph',
    }
  }
  if (route.kind === 'memories' && route.memoryId !== null) {
    return { title: 'Memories', subtitle: `Memory #${route.memoryId}` }
  }
  if (route.kind === 'memories') {
    return { title: 'Memories', subtitle: 'Browse the knowledge base' }
  }
  return { title: 'Not found', subtitle: 'Unknown screen' }
}

function AuthRequiredPanel() {
  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-xl rounded-md border border-copper/25 bg-copper-soft/60 p-5">
        <p className="text-[14px] font-semibold text-copper">Sign-in required</p>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
          This Forgetful instance reports that authentication is enabled. This read-only prototype
          has no sign-in flow, so it stopped loading records instead of bypassing the server.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Authenticated instances are not supported in this read-only prototype.
        </p>
      </div>
    </div>
  )
}

function AccessBlockedPanel({ reason }: { reason: 'authentication' | 'access' }) {
  const authentication = reason === 'authentication'
  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-xl rounded-md border border-copper/25 bg-copper-soft/60 p-5">
        <h2 className="text-[14px] font-semibold text-copper">
          {authentication ? 'Authentication unavailable' : 'Access denied'}
        </h2>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
          {authentication
            ? 'This instance did not accept the anonymous session. This read-only prototype ' +
              'does not support sign-in, so it stopped loading records.'
            : 'The instance refused this request. This read-only prototype cannot add ' +
              'credentials or permissions, so it stopped loading records.'}
        </p>
      </div>
    </div>
  )
}

function UnknownPanel() {
  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-xl rounded-md border border-line bg-panel p-5">
        <p className="text-[14px] font-semibold text-ink">Screen not found</p>
        <p className="mt-2 text-[12px] text-muted">This address does not match a screen.</p>
        <a href={memoriesHref({})} className="mt-4 inline-block text-[12px] font-medium text-teal">
          Go to Memories
        </a>
      </div>
    </div>
  )
}

function ScreenFallback() {
  return (
    <div className="p-4 sm:p-5">
      <div className="h-72 animate-pulse rounded-md border border-line bg-panel" />
      <span className="sr-only">Loading screen…</span>
    </div>
  )
}

function CheckingPanel() {
  return (
    <div className="p-4 sm:p-5" aria-busy="true">
      <div className="max-w-lg rounded-md border border-line bg-panel px-4 py-5">
        <p className="text-[12px] font-medium text-ink">Checking backend connection…</p>
        <p className="mt-1 text-[11px] text-muted">
          Records load after the instance health and authentication state are known.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const route = useHashRoute()
  const connection: ConnectionState = useConnection()
  const capabilityRoute =
    route.kind === 'dashboard' ||
    route.kind === 'plans' ||
    route.kind === 'files' ||
    route.kind === 'skills' ||
    route.kind === 'graph'
  const capabilityConnection =
    connection.status !== 'auth-required' && connection.status !== 'access-blocked'
  const capabilities = useCapabilities(capabilityRoute && capabilityConnection)
  const details = screenDetails(route)
  useEffect(() => {
    document.title = `${details.title} · Forgetful`
  }, [details.title])

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}#/memories`,
      )
    }
  }, [])

  const graphLink = graphHref({})

  return (
    <div className="flex min-h-dvh flex-col bg-canvas md:h-dvh md:flex-row md:overflow-hidden">
      <Sidebar route={route} graphHref={graphLink} />
      <div className="flex min-w-0 flex-1 flex-col md:overflow-hidden">
        <Topbar title={details.title} subtitle={details.subtitle} connection={connection} />
        <main className="min-w-0 flex-1 md:overflow-y-auto">
          {connection.status === 'checking' ? (
            <CheckingPanel />
          ) : connection.status === 'auth-required' ? (
            <AuthRequiredPanel />
          ) : connection.status === 'access-blocked' ? (
            <AccessBlockedPanel reason={connection.reason} />
          ) : route.kind === 'memories' ? (
            <MemoriesScreen route={route} />
          ) : route.kind === 'dashboard' ? (
            <Suspense fallback={<ScreenFallback />}>
              <DashboardScreen
                connection={connection}
                capabilities={capabilities.state}
                retryCapabilities={capabilities.retry}
              />
            </Suspense>
          ) : route.kind === 'projects' ? (
            <Suspense fallback={<ScreenFallback />}>
              <ProjectsScreen route={route} />
            </Suspense>
          ) : route.kind === 'plans' ? (
            <Suspense fallback={<ScreenFallback />}>
              <PlansScreen
                route={route}
                capabilities={capabilities.state}
                retryCapabilities={capabilities.retry}
              />
            </Suspense>
          ) : route.kind === 'documents' ? (
            <Suspense fallback={<ScreenFallback />}>
              <DocumentsScreen route={route} />
            </Suspense>
          ) : route.kind === 'code' ? (
            <Suspense fallback={<ScreenFallback />}>
              <CodeScreen route={route} />
            </Suspense>
          ) : route.kind === 'files' ? (
            <Suspense fallback={<ScreenFallback />}>
              <FilesScreen
                route={route}
                capabilities={capabilities.state}
                retryCapabilities={capabilities.retry}
              />
            </Suspense>
          ) : route.kind === 'skills' ? (
            <Suspense fallback={<ScreenFallback />}>
              <SkillsScreen
                route={route}
                capabilities={capabilities.state}
                retryCapabilities={capabilities.retry}
              />
            </Suspense>
          ) : route.kind === 'entities' ? (
            <Suspense fallback={<ScreenFallback />}>
              <EntitiesScreen route={route} />
            </Suspense>
          ) : route.kind === 'timeline' ? (
            <Suspense fallback={<ScreenFallback />}>
              <TimelineScreen route={route} />
            </Suspense>
          ) : route.kind === 'graph' ? (
            <Suspense fallback={<ScreenFallback />}>
              <GraphScreen
                route={route}
                capabilities={capabilities.state}
                retryCapabilities={capabilities.retry}
              />
            </Suspense>
          ) : (
            <UnknownPanel />
          )}
        </main>
      </div>
    </div>
  )
}
