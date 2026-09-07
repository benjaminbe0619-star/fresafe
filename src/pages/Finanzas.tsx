import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { formatMXN } from '../lib/money'
import { Card, PillSelector, StatTile } from '../components/ui'
import { SERIES } from '../components/charts'
import {
  PeriodKey,
  PERIOD_LABELS,
  periodRange,
  computeBreakdown,
  partnerBaseCents,
  topProducts,
} from '../lib/finance'

const PERIOD_OPTIONS = (Object.keys(PERIOD_LABELS) as PeriodKey[]).map((k) => ({
  key: k,
  label: PERIOD_LABELS[k],
}))

export default function Finanzas() {
  const sales = useStore((s) => s.sales)
  const records = useStore((s) => s.records)
  const settings = useStore((s) => s.settings)
  const [period, setPeriod] = useState<PeriodKey>('mes')

  const range = useMemo(() => periodRange(period), [period])
  const b = useMemo(() => computeBreakdown(sales, records, range), [sales, records, range])
  const top = useMemo(() => topProducts(sales, range).slice(0, 5), [sales, range])

  const socioCents = Math.round(
    (Math.max(0, partnerBaseCents(b, settings.partner.base)) * settings.partner.percent) / 100,
  )
  const fresafeCents = b.gananciaNetaCents - (settings.partner.base === 'neta' ? socioCents : 0)

  const Row = ({
    label,
    cents,
    sign,
    note,
  }: {
    label: string
    cents: number
    sign?: '−'
    note?: string
  }) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-slate-600 text-sm">
        {label}
        {note && <span className="block text-xs text-slate-400 font-normal">{note}</span>}
      </span>
      <span
        className={
          'tabular-nums whitespace-nowrap text-sm font-semibold ' +
          (sign === '−' ? 'text-red-600' : 'text-slate-800')
        }
      >
        {sign === '−' && cents > 0 ? '−' : ''}
        {formatMXN(Math.abs(cents))}
      </span>
    </div>
  )

  return (
    <div>
      <div className="mb-4">
        <PillSelector options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card title={`Ganancia real · ${PERIOD_LABELS[period].toLowerCase()}`}>
          <Row label="Ventas" cents={b.ventasCents} />
          <Row label="Insumos (costo de lo vendido)" cents={b.insumosCents} sign="−" />
          <Row
            label={`Parte del ${settings.paletero.name.toLowerCase()} (paletas)`}
            cents={b.paleteroCents}
            sign="−"
          />
          <Row label="Comisión tarjeta (MP)" cents={b.comisionTarjetaCents} sign="−" />
          <Row label="Comisión Rappi / Uber" cents={b.comisionAppsCents} sign="−" />
          <Row label="Gastos variables" cents={b.gastosVariablesCents} sign="−" />
          <Row label="Gastos fijos" cents={b.gastosFijosCents} sign="−" note="prorrateados por día" />
          <Row label="Mermas" cents={b.mermasCents} sign="−" />
          <div className="flex items-baseline justify-between gap-3 border-t-2 border-slate-300 mt-2 pt-3">
            <span className="font-bold text-lg">Ganancia real</span>
            <span
              className={
                'font-bold text-2xl tabular-nums ' +
                (b.gananciaNetaCents >= 0 ? 'text-emerald-600' : 'text-red-600')
              }
            >
              {formatMXN(b.gananciaNetaCents)}
            </span>
          </div>
          <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-600">
                Para {settings.partner.name} ({settings.partner.percent}% de{' '}
                {settings.partner.base === 'neta'
                  ? 'ganancia real'
                  : settings.partner.base === 'bruta'
                    ? 'ganancia bruta'
                    : 'ventas'}
                )
              </span>
              <span className="font-bold text-slate-900 tabular-nums">{formatMXN(socioCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Para FresaFé</span>
              <span className="font-bold text-emerald-600 tabular-nums">{formatMXN(fresafeCents)}</span>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <StatTile label="Ventas" value={String(b.numVentas)} />
            <StatTile label="Ticket promedio" value={formatMXN(b.ticketPromedioCents)} />
          </div>

          <Card title="Ventas por canal">
            {(['mostrador', 'rappi', 'uber'] as const).map((c) => {
              const pct = b.ventasCents > 0 ? (b.ventasPorCanal[c] / b.ventasCents) * 100 : 0
              const label = c === 'mostrador' ? 'Mostrador' : c === 'rappi' ? 'Rappi' : 'Uber Eats'
              const color =
                c === 'mostrador' ? SERIES.pink : c === 'rappi' ? SERIES.orange : SERIES.emerald
              return (
                <div key={c} className="mb-2.5 last:mb-0">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{label}</span>
                    <span className="font-semibold tabular-nums">
                      {formatMXN(b.ventasPorCanal[c])}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </Card>

          <Card title="Top productos por ganancia">
            {top.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Sin ventas en este periodo.</p>
            ) : (
              <div className="space-y-2">
                {top.map((p) => (
                  <div key={p.productId} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-slate-700">
                      {p.name} <span className="text-slate-400">×{p.qty}</span>
                    </span>
                    <span className="font-semibold text-emerald-600 tabular-nums whitespace-nowrap">
                      {formatMXN(p.margenCents)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
