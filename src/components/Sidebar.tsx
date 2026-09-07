import { NavLink, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

const iconClass = 'w-6 h-6'

const CobrarIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className={iconClass}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
    />
  </svg>
)

const PedidosIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className={iconClass}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
    />
  </svg>
)

const ReportesIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className={iconClass}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
    />
  </svg>
)

const AdministrarIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className={iconClass}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
    />
  </svg>
)

const ConfigIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className={iconClass}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.213-1.281Z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
)

export type NavItem = { to: string; label: string; icon: ReactNode; match?: string[] }

// Rutas de administración: activan la pestaña "Administrar"
const ADMIN_PATHS = [
  '/administrar',
  '/menu',
  '/gastos',
  '/sueldos',
  '/mermas',
  '/socio',
  '/paletas',
  '/rappi',
  '/uber',
  '/configuracion',
]

const NAV: NavItem[] = [
  { to: '/cobranza', label: 'Cobrar', icon: CobrarIcon },
  { to: '/pedidos', label: 'Pedidos', icon: PedidosIcon },
  { to: '/reportes', label: 'Reportes', icon: ReportesIcon, match: ['/reportes'] },
  { to: '/administrar', label: 'Administrar', icon: AdministrarIcon, match: ADMIN_PATHS },
]

function isActivePath(pathname: string, item: NavItem): boolean {
  const targets = item.match ?? [item.to]
  return targets.some((t) => pathname === t || pathname.startsWith(t + '/'))
}

function getPageTitle(pathname: string): string {
  const titles: [string, string][] = [
    ['/cobranza', 'Cobrar'],
    ['/pedidos', 'Pedidos'],
    ['/reportes', 'Reportes'],
    ['/administrar', 'Administrar'],
    ['/menu', 'Menú'],
    ['/gastos', 'Gastos'],
    ['/sueldos', 'Sueldos'],
    ['/mermas', 'Mermas'],
    ['/socio', 'Socio'],
    ['/paletas', 'Paletas'],
    ['/rappi', 'Rappi'],
    ['/uber', 'Uber Eats'],
    ['/configuracion', 'Configuración'],
  ]
  return titles.find(([p]) => pathname.startsWith(p))?.[1] ?? 'FresaFé'
}

export default function Sidebar() {
  const location = useLocation()

  return (
    <>
      <aside className="hidden md:flex w-16 shrink-0 bg-pink-200 text-pink-900 py-3 px-2 flex-col gap-1 overflow-y-auto">
        <img
          src="/imagenes/logo.png"
          alt="Fresa Fé"
          className="w-12 h-12 mx-auto mb-2 object-contain select-none"
          draggable={false}
        />
        {NAV.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={
              'group relative flex items-center justify-center h-12 rounded-lg transition ' +
              (isActivePath(location.pathname, it)
                ? 'bg-white/80 text-pink-600 shadow-sm'
                : 'text-pink-900/60 hover:bg-pink-300/50 hover:text-pink-900')
            }
            aria-label={it.label}
          >
            {it.icon}
            <span
              className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-pink-900 text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50"
              role="tooltip"
            >
              {it.label}
            </span>
          </NavLink>
        ))}
        <div className="mt-auto pt-3 border-t border-pink-300 flex flex-col gap-1">
          <NavLink
            to="/configuracion"
            className={({ isActive }) =>
              'group relative flex items-center justify-center h-12 rounded-lg transition ' +
              (isActive
                ? 'bg-white/80 text-pink-600 shadow-sm'
                : 'text-pink-900/60 hover:bg-pink-300/50 hover:text-pink-900')
            }
            aria-label="Configuración"
          >
            {ConfigIcon}
            <span
              className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-pink-900 text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50"
              role="tooltip"
            >
              Configuración
            </span>
          </NavLink>
        </div>
      </aside>

      <header className="md:hidden flex items-center gap-3 h-14 px-4 bg-pink-200 text-pink-900 shrink-0 z-20">
        <img
          src="/imagenes/logo.png"
          alt="Fresa Fé"
          className="w-9 h-9 object-contain select-none"
          draggable={false}
        />
        <span className="font-semibold text-lg">{getPageTitle(location.pathname)}</span>
      </header>
    </>
  )
}

export function MobileTabBar() {
  const location = useLocation()
  return (
    <nav className="md:hidden shrink-0 bg-white border-t border-slate-200 grid grid-cols-4 pb-[env(safe-area-inset-bottom)] z-30">
      {NAV.map((it) => {
        const active = isActivePath(location.pathname, it)
        return (
          <NavLink
            key={it.to}
            to={it.to}
            className={
              'flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition ' +
              (active ? 'text-pink-600' : 'text-slate-400 active:text-slate-600')
            }
          >
            {it.icon}
            {it.label}
          </NavLink>
        )
      })}
    </nav>
  )
}
