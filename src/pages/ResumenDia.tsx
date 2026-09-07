import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatMXN } from '../lib/money'
import { Card, StatTile } from '../components/ui'
import { computeBreakdown, periodRange, startOfDay, topProducts } from '../lib/finance'

const DAY = 86_400_000

export default function ResumenDia() {
  const sales = useStore((s) => s.sales)
  const records = useStore((s) => s.records)
  const changeFundCents = useStore((s) => s.changeFundCents)

  const now = Date.now()
  const hoy = useMemo(() => periodRange('hoy', now), [now])
  const b = useMemo(() => computeBreakdown(sales, records, hoy), [sales, records, hoy])

  const totalDe = (start: number, end: number) =>
    sales
      .filter((s) => s.timestamp >= start && s.timestamp <= end)
      .reduce((a, s) => a + s.totalCents, 0)

  const ayerCents = totalDe(startOfDay(now) - DAY, startOfDay(now) - 1)
  const semanaPasadaCents = totalDe(startOfDay(now) - 7 * DAY, startOfDay(now) - 6 * DAY - 1)

  const pedidosApps = sales.filter((s) => s.method === 'app' && s.timestamp >= hoy.start).length
  const efectivoEnCaja =
    changeFundCents +
    sales
      .filter((s) => s.method === 'efectivo')
      .reduce((a, s) => a + s.totalCents, 0)

  const topHoy = useMemo(() => topProducts(sales, hoy).slice(0, 5), [sales, hoy])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Vendido hoy" value={formatMXN(b.ventasCents)} sub={`${b.numVentas} venta${b.numVentas === 1 ? '' : 's'}`} />
        <StatTile
          label="Ganancia de hoy"
          value={formatMXN(b.gananciaNetaCents)}
          color={b.gananciaNetaCents >= 0 ? 'text-emerald-600' : 'text-red-600'}
          sub="con gastos del día"
        />
        <StatTile label="Pedidos de apps" value={String(pedidosApps)} sub="hoy" />
        <StatTile label="Efectivo en caja" value={formatMXN(efectivoEnCaja)} sub="fondo + ventas" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card title="¿Cómo vamos?">
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-600">Hoy</span>
              <span className="font-bold text-lg tabular-nums">{formatMXN(b.ventasCents)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-600">Ayer</span>
              <span className="font-semibold tabular-nums text-slate-700">{formatMXN(ayerCents)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-600">Hace una semana (mismo día)</span>
              <span className="font-semibold tabular-nums text-slate-700">{formatMXN(semanaPasadaCents)}</span>
            </div>
          </div>
        </Card>

        <Card title="Lo más vendido hoy">
          {topHoy.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Aún no hay ventas hoy.</p>
          ) : (
            <div className="space-y-2">
              {topHoy.map((p) => (
                <div key={p.productId} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-slate-700">
                    {p.name} <span className="text-slate-400">×{p.qty}</span>
                  </span>
                  <span className="font-semibold tabular-nums whitespace-nowrap">{formatMXN(p.ventasCents)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
