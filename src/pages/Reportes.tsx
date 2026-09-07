import { NavLink, Navigate, useParams } from 'react-router-dom'
import Ventas from './Ventas'
import Estadisticas from './Estadisticas'
import Finanzas from './Finanzas'
import ResumenDia from './ResumenDia'
import Cortes from './Cortes'

const VIEWS: { key: string; label: string }[] = [
  { key: 'resumen', label: 'Resumen del día' },
  { key: 'ventas', label: 'Ventas' },
  { key: 'estadisticas', label: 'Estadísticas' },
  { key: 'finanzas', label: 'Finanzas' },
  { key: 'cortes', label: 'Cortes de caja' },
]

export default function Reportes() {
  const { view } = useParams()
  if (!view || !VIEWS.some((v) => v.key === view)) {
    return <Navigate to="/reportes/resumen" replace />
  }
  return (
    <div className="h-full overflow-auto">
      <div className="max-w-6xl mx-auto p-4 lg:px-8 lg:py-7 pb-10">
        <h2 className="text-2xl lg:text-3xl font-bold mb-4">Reportes</h2>
        <div className="mb-6 overflow-x-auto pb-1 -mx-1 px-1">
          <div className="inline-flex gap-1 bg-slate-100 rounded-xl p-1">
            {VIEWS.map((v) => (
              <NavLink
                key={v.key}
                to={`/reportes/${v.key}`}
                className={({ isActive }) =>
                  'px-3.5 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition ' +
                  (isActive
                    ? 'bg-white shadow-sm text-slate-900'
                    : 'text-slate-500 hover:text-slate-800')
                }
              >
                {v.label}
              </NavLink>
            ))}
          </div>
        </div>
        {view === 'resumen' && <ResumenDia />}
        {view === 'ventas' && <Ventas />}
        {view === 'estadisticas' && <Estadisticas />}
        {view === 'finanzas' && <Finanzas />}
        {view === 'cortes' && <Cortes />}
      </div>
    </div>
  )
}
