import type { ReactElement } from 'react'
import type { AppRoute } from '../router'
import { dashboardHref, filesHref, memoriesHref } from '../router'
import {
  CodeIcon,
  DashboardIcon,
  DocumentsIcon,
  FilesIcon,
  GraphIcon,
  MemoriesIcon,
  PlansIcon,
  ProjectsIcon,
  SkillsIcon,
  TimelineIcon,
} from './Icons'

interface SidebarProps {
  route: AppRoute
  graphHref: string
}

function navClass(active: boolean): string {
  return [
    'flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300',
    active
      ? 'bg-white/9 text-white shadow-[inset_2px_0_0_var(--color-teal-300)]'
      : 'text-sidebar-muted hover:bg-white/5 hover:text-slate-100',
  ].join(' ')
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md
        bg-[#e8eef0] p-0.5"
      >
        <img
          src="./brand/forgetful-128.png"
          srcSet="./brand/forgetful-128.png 1x, ./brand/forgetful-256.png 2x"
          width={32}
          height={32}
          alt="Forgetful"
          className="h-8 w-8 shrink-0"
          decoding="async"
        />
      </span>
      {!compact && (
        <div className="min-w-0">
          <p className="text-[15px] font-semibold tracking-[-0.01em] text-white">Forgetful</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-sidebar-muted">
            Memory workspace
          </p>
        </div>
      )}
    </div>
  )
}

function navItems(
  route: AppRoute,
  graphHref: string,
): {
  label: string
  href: string
  active: boolean
  icon: (props: { className?: string }) => ReactElement
}[] {
  return [
    {
      label: 'Dashboard',
      href: dashboardHref(),
      active: route.kind === 'dashboard',
      icon: DashboardIcon,
    },
    {
      label: 'Memories',
      href: memoriesHref({}),
      active: route.kind === 'memories',
      icon: MemoriesIcon,
    },
    {
      label: 'Projects',
      href: '#/projects',
      active: route.kind === 'projects',
      icon: ProjectsIcon,
    },
    { label: 'Plans', href: '#/plans', active: route.kind === 'plans', icon: PlansIcon },
    {
      label: 'Documents',
      href: '#/documents',
      active: route.kind === 'documents',
      icon: DocumentsIcon,
    },
    { label: 'Code', href: '#/code', active: route.kind === 'code', icon: CodeIcon },
    { label: 'Files', href: filesHref({}), active: route.kind === 'files', icon: FilesIcon },
    { label: 'Skills', href: '#/skills', active: route.kind === 'skills', icon: SkillsIcon },
    {
      label: 'Timeline',
      href: '#/timeline',
      active: route.kind === 'timeline',
      icon: TimelineIcon,
    },
    { label: 'Graph', href: graphHref, active: route.kind === 'graph', icon: GraphIcon },
  ]
}

export function Sidebar({ route, graphHref }: SidebarProps) {
  return (
    <aside
      className={`
        shrink-0 bg-sidebar md:flex md:h-full md:w-[232px] md:flex-col md:border-r
        md:border-sidebar-line
      `}
    >
      <div
        className={`
          flex items-center justify-between gap-4 border-b border-sidebar-line px-4 py-3
          md:border-0 md:px-5 md:py-5
        `}
      >
        <BrandMark />
        <span
          className={`
            rounded border border-sidebar-line px-1.5 py-0.5 text-[9px] font-medium
            uppercase tracking-[0.12em] text-sidebar-muted md:hidden
          `}
        >
          Read-only
        </span>
      </div>

      <nav
        aria-label="Main navigation"
        className={`
          flex gap-1 overflow-x-auto px-3 py-2
          md:flex-col md:overflow-visible md:px-3 md:py-1
        `}
      >
        {navItems(route, graphHref).map((item) => (
          <a
            key={item.label}
            href={item.href}
            className={navClass(item.active)}
            aria-current={item.active ? 'page' : undefined}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </a>
        ))}
      </nav>

      <div className="mt-auto hidden border-t border-sidebar-line px-5 py-4 md:block">
        <p className="text-[11px] font-medium text-slate-300">Read-only preview</p>
        <p className="mt-1 text-[10px] leading-relaxed text-sidebar-muted">
          Browse and inspect records. Nothing is written.
        </p>
      </div>
    </aside>
  )
}
