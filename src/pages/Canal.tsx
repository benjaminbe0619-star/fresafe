import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import {Card, Field, inputCls, PageShell } from '../components/ui'

const META = {
  rappi: { label: 'Rappi', accent: 'text-orange-600', toggle: 'bg-orange-500' },
  uber: { label: 'Uber Eats', accent: 'text-emerald-700', toggle: 'bg-emerald-600' },
} as const

export default function Canal({ channel }: { channel: 'rappi' | 'uber' }) {
  const settings = useStore((s) => s.settings)
  const saveSettings = useStore((s) => s.saveSettings)
  const meta = META[channel]

  const enabled = channel === 'rappi' ? settings.channels.rappiEnabled : settings.channels.uberEnabled
  const percent = channel === 'rappi' ? settings.channels.rappiPercent : settings.channels.uberPercent

  const [pct, setPct] = useState(String(percent))
  const dirty = parseFloat(pct) !== percent

  const patch = (p: Partial<typeof settings.channels>) =>
    saveSettings({ ...settings, channels: { ...settings.channels, ...p } }).catch((e) =>
      alert('No se pudo guardar: ' + e.message),
    )

  const toggle = () =>
    patch(channel === 'rappi' ? { rappiEnabled: !enabled } : { uberEnabled: !enabled })

  const savePct = () => {
    const v = Math.max(0, Math.min(100, parseFloat(pct) || 0))
    patch(channel === 'rappi' ? { rappiPercent: v } : { uberPercent: v })
  }

  return (
    <PageShell width="max-w-4xl">
      <Link to="/administrar" className="text-sm font-semibold text-slate-400 hover:text-slate-700">
        ← Administrar
      </Link>
      <h2 className={`text-2xl lg:text-3xl font-bold mt-2 mb-5 lg:mb-6 ${meta.accent}`}>{meta.label}</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 items-start">
        <div className="space-y-4 lg:space-y-5">
        <Card title="Canal">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-800">
                {enabled ? 'Encendido' : 'Apagado'}
              </div>
              <p className="text-sm text-slate-500">
                {enabled
                  ? `Los pedidos de ${meta.label} se pueden registrar en Pedidos.`
                  : `El canal no aparece al registrar pedidos.`}
              </p>
            </div>
            <button
              onClick={toggle}
              className={
                'w-12 h-7 rounded-full relative transition shrink-0 ' +
                (enabled ? meta.toggle : 'bg-slate-300')
              }
              aria-label={enabled ? 'Apagar canal' : 'Encender canal'}
            >
              <span
                className={
                  'absolute top-1 w-5 h-5 bg-white rounded-full transition-all ' +
                  (enabled ? 'left-6' : 'left-1')
                }
              />
            </button>
          </div>
        </Card>

        <Card title="Comisión">
          <Field label={`Lo que ${meta.label} descuenta por pedido (%)`}>
            <input value={pct} onChange={(e) => setPct(e.target.value)} inputMode="decimal" className={inputCls} />
          </Field>
          <p className="text-xs text-slate-500 mt-2">
            Se descuenta sola de la ganancia en cada pedido de este canal. Ajústala al porcentaje de tu contrato.
          </p>
          <button
            onClick={savePct}
            disabled={!dirty}
            className="w-full mt-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg"
          >
            Guardar
          </button>
        </Card>
        </div>

        <div className="space-y-4 lg:space-y-5">
        <Card title="Integración automática">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" aria-hidden="true" />
            <span className="font-semibold text-slate-800 text-sm">Pendiente de conexión</span>
          </div>
          <p className="text-sm text-slate-500">
            El negocio ya está dado de alta en {meta.label}. Para que los pedidos caigan solos en la pantalla de
            Pedidos hay que solicitar acceso a su API de socios desde la cuenta del comercio. Mientras tanto, se
            registran a mano en unos segundos y las cuentas quedan exactas.
          </p>
        </Card>

        <p className="text-sm text-slate-400">
          Los números de este canal viven en{' '}
          <Link to="/reportes/estadisticas" className="font-semibold text-slate-900 hover:underline">
            Reportes
          </Link>
          .
        </p>
        </div>
      </div>
    </PageShell>
  )
}
