import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore, SaleItem } from '../store/useStore'
import { formatMXN } from '../lib/money'
import { playSaleSuccess } from '../lib/sounds'
import { Card, PageHeader, PageShell } from '../components/ui'
import { periodRange } from '../lib/finance'

type AppChannel = 'rappi' | 'uber'

const META = {
  rappi: {
    label: 'Rappi',
    badge: 'bg-orange-100 text-orange-700',
    button: 'bg-orange-500 hover:bg-orange-600 active:bg-orange-600',
  },
  uber: {
    label: 'Uber Eats',
    badge: 'bg-emerald-100 text-emerald-800',
    button: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-700',
  },
} as const

export default function Pedidos() {
  const products = useStore((s) => s.products)
  const settings = useStore((s) => s.settings)
  const sales = useStore((s) => s.sales)
  const addSale = useStore((s) => s.addSale)

  const enabledChannels = useMemo(() => {
    const out: AppChannel[] = []
    if (settings.channels.rappiEnabled) out.push('rappi')
    if (settings.channels.uberEnabled) out.push('uber')
    return out
  }, [settings.channels])

  const [channel, setChannel] = useState<AppChannel | null>(null)
  const [qty, setQty] = useState<Record<string, number>>({})

  const activeProducts = products.filter((p) => p.active !== false)
  const totalCents = activeProducts.reduce(
    (a, p) => a + (qty[p.id] ?? 0) * p.priceCents,
    0,
  )
  const totalQty = Object.values(qty).reduce((a, n) => a + n, 0)
  const percent = channel === 'rappi' ? settings.channels.rappiPercent : settings.channels.uberPercent
  const feeCents = channel ? Math.round((totalCents * percent) / 100) : 0

  const setQtyFor = (id: string, n: number) =>
    setQty((q) => {
      const next = { ...q }
      if (n <= 0) delete next[id]
      else next[id] = n
      return next
    })

  const reset = () => {
    setChannel(null)
    setQty({})
  }

  const register = () => {
    if (!channel || totalQty === 0) return
    const items: SaleItem[] = activeProducts
      .filter((p) => (qty[p.id] ?? 0) > 0)
      .map((p) => {
        const it: SaleItem = {
          productId: p.id,
          name: p.name,
          qty: qty[p.id],
          priceCents: p.priceCents,
          costCents: p.costCents,
        }
        if (p.owner === 'paletero') {
          it.owner = 'paletero'
          it.paleteroCents = Math.round(
            p.priceCents * qty[p.id] * (1 - settings.paletero.fresafePercent / 100),
          )
        }
        return it
      })
    addSale({
      items,
      totalCents,
      method: 'app',
      receivedCents: totalCents,
      changeCents: 0,
      channel,
      channelFeeCents: feeCents,
    })
    playSaleSuccess()
    reset()
  }

  const hoy = periodRange('hoy')
  const pedidosHoy = sales.filter((s) => s.method === 'app' && s.timestamp >= hoy.start)

  return (
    <PageShell>
      <PageHeader
        title="Pedidos"
        subtitle="Los pedidos de Rappi y Uber Eats de hoy. El cliente ya pagó en la app: aquí solo se registran."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 items-start">
        <Card title="Registrar pedido">
          {enabledChannels.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">
              Ambos canales están apagados. Enciéndelos en{' '}
              <Link to="/administrar" className="font-semibold text-slate-900 hover:underline">
                Administrar
              </Link>
              .
            </p>
          ) : channel === null ? (
            <div>
              <p className="text-sm text-slate-500 mb-3">1 · ¿De qué app es el pedido?</p>
              <div className="grid grid-cols-2 gap-3">
                {enabledChannels.map((c) => (
                  <button
                    key={c}
                    onClick={() => setChannel(c)}
                    className={`${META[c].button} text-white font-bold py-6 rounded-xl text-lg`}
                  >
                    {META[c].label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-slate-500">
                  2 · Pedido de{' '}
                  <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${META[channel].badge}`}>
                    {META[channel].label}
                  </span>
                </p>
                <button onClick={reset} className="text-xs font-semibold text-slate-400 hover:text-slate-700">
                  Cambiar
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto -mx-1 px-1 space-y-1 mb-3">
                {activeProducts.map((p) => {
                  const n = qty[p.id] ?? 0
                  return (
                    <div
                      key={p.id}
                      className={
                        'flex items-center gap-2 rounded-lg border px-3 py-2 ' +
                        (n > 0 ? 'border-slate-400 bg-slate-50' : 'border-slate-200')
                      }
                    >
                      <div className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate">{p.name}</span>
                        <span className="block text-xs text-slate-500 tabular-nums">
                          {formatMXN(p.priceCents)}
                        </span>
                      </div>
                      {n > 0 ? (
                        <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => setQtyFor(p.id, n - 1)}
                            className="w-9 h-9 flex items-center justify-center font-bold text-slate-700 active:bg-slate-100"
                            aria-label="Restar uno"
                          >
                            −
                          </button>
                          <span className="w-7 text-center font-bold text-sm tabular-nums">{n}</span>
                          <button
                            onClick={() => setQtyFor(p.id, n + 1)}
                            className="w-9 h-9 flex items-center justify-center font-bold text-slate-700 active:bg-slate-100"
                            aria-label="Sumar uno"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setQtyFor(p.id, 1)}
                          className="text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-lg"
                        >
                          Agregar
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-slate-200 pt-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">Total del pedido</span>
                  <span className="font-bold tabular-nums">{formatMXN(totalCents)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 mb-3">
                  <span>
                    Comisión {META[channel].label} ({percent}%)
                  </span>
                  <span className="tabular-nums">−{formatMXN(feeCents)}</span>
                </div>
                <button
                  onClick={register}
                  disabled={totalQty === 0}
                  className={`w-full ${META[channel].button} disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg`}
                >
                  3 · Registrar pedido
                </button>
              </div>
            </div>
          )}
        </Card>

        <Card title={`Pedidos de hoy (${pedidosHoy.length})`}>
          {pedidosHoy.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Aún no hay pedidos de apps hoy.</p>
          ) : (
            <div className="space-y-1">
              {pedidosHoy.map((s) => (
                <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
                  <span
                    className={
                      'text-[10px] uppercase px-2 py-0.5 rounded font-bold shrink-0 ' +
                      META[(s.channel as AppChannel) ?? 'rappi'].badge
                    }
                  >
                    {META[(s.channel as AppChannel) ?? 'rappi'].label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="block truncate text-sm text-slate-800">
                      {s.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {new Date(s.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-sm tabular-nums">{formatMXN(s.totalCents)}</div>
                    <div className="text-xs text-slate-500 tabular-nums">
                      neto {formatMXN(s.totalCents - (s.channelFeeCents ?? 0))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  )
}
