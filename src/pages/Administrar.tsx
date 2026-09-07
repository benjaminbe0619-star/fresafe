import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'

type Entry = { to: string; title: string; desc: string }

export default function Administrar() {
  const settings = useStore((s) => s.settings)

  const entries: Entry[] = [
    { to: '/menu', title: 'Menú', desc: 'Productos, precios, costos y categorías.' },
    { to: '/gastos', title: 'Gastos', desc: 'Fijos mensuales y compras del día.' },
    { to: '/sueldos', title: 'Sueldos', desc: 'Empleados, pagos y adelantos.' },
    { to: '/mermas', title: 'Mermas', desc: 'Registrar lo que se perdió.' },
    { to: '/socio', title: 'Socio', desc: `El trato con ${settings.partner.name}: su %, cortes y cuentas.` },
    { to: '/paletas', title: 'Paletas', desc: `La consignación con ${settings.paletero.name}.` },
    { to: '/rappi', title: 'Rappi', desc: 'Canal, comisión e integración.' },
    { to: '/uber', title: 'Uber Eats', desc: 'Canal, comisión e integración.' },
    { to: '/configuracion', title: 'Configuración', desc: 'Inversión, fondo, MP Point y respaldos.' },
  ]

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-4 lg:px-8 lg:py-7 pb-10">
        <div className="mb-6">
          <h2 className="text-2xl lg:text-3xl font-bold">Administrar</h2>
          <p className="hidden lg:block text-sm text-slate-500 mt-1">
            Cada cosa tiene su lugar. Entra, ajusta y sal.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          {entries.map((e) => (
            <Link
              key={e.to}
              to={e.to}
              className="group bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{e.title}</span>
                <span className="text-slate-300 group-hover:text-slate-500 transition" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">{e.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
