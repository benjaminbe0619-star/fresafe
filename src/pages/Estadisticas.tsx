import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { formatMXN } from '../lib/money'
import { Card, PillSelector, StatTile } from '../components/ui'
import { BarChart, HBarChart, SERIES } from '../components/charts'
import { computeBreakdown, periodRange, startOfDay, topProducts, WEEKDAYS } from '../lib/finance'

const DAY = 86_400_000

type StatsPeriod = '14dias' | '30dias' | 'mes'
const PERIOD_OPTIONS: { key: StatsPeriod; label: string }[] = [
  { key: '14dias', label: 'Últimos 14 días' },
  { key: '30dias', label: 'Últimos 30 días' },
  { key: 'mes', label: 'Este mes' },
]

function statsRange(p: StatsPeriod, now = Date.now()): { start: number; end: number } {
  if (p === 'mes') return periodRange('mes', now)
  const days = p === '14dias' ? 14 : 30
  return { start: startOfDay(now) - (days - 1) * DAY, end: now }
}

// Formato corto para ejes: $1.2k en lugar de $1,200.00
const short = (cents: number): string => {
  const v = cents / 100
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`
  return `$${Math.round(v)}`
}

export default function Estadisticas() {
  const sales = useStore((s) => s.sales)
  const records = useStore((s) => s.records)
  const [period, setPeriod] = useState<StatsPeriod>('14dias')

  const range = useMemo(() => statsRange(period), [period])
  const inRange = useMemo(
    () => sales.filter((s) => s.timestamp >= range.start && s.timestamp <= range.end),
    [sales, range],
  )
  const b = useMemo(() => computeBreakdown(sales, records, range), [sales, records, range])

  const porDia = useMemo(() => {
    const days: { label: string; hint: string; value: number }[] = []
    for (let t = startOfDay(range.start); t <= range.end; t += DAY) {
      const d = new Date(t)
      days.push({
        label: d.toLocaleDateString('es-MX', { day: 'numeric' }),
        hint: d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
        value: 0,
      })
    }
    for (const s of inRange) {
      const i = Math.floor((startOfDay(s.timestamp) - startOfDay(range.start)) / DAY)
      if (days[i]) days[i].value += s.totalCents
    }
    return days
  }, [inRange, range])

  const porSemana = useMemo(() => {
    const acc = Array(7).fill(0)
    for (const s of inRange) acc[new Date(s.timestamp).getDay()] += s.totalCents
    // lunes primero
    return [1, 2, 3, 4, 5, 6, 0].map((i) => ({
      label: WEEKDAYS[i].slice(0, 3),
      hint: WEEKDAYS[i],
      value: acc[i],
    }))
  }, [inRange])

  const porHora = useMemo(() => {
    const acc = Array(24).fill(0)
    for (const s of inRange) acc[new Date(s.timestamp).getHours()] += s.totalCents
    let first = acc.findIndex((v) => v > 0)
    let last = 23 - [...acc].reverse().findIndex((v) => v > 0)
    if (first === -1) {
      first = 8
      last = 21
    }
    first = Math.max(0, Math.min(first, 8))
    last = Math.min(23, Math.max(last, 20))
    const out = []
    for (let h = first; h <= last; h++) out.push({ label: `${h}`, hint: `${h}:00–${h}:59`, value: acc[h] })
    return out
  }, [inRange])

  const metodos = useMemo(
    () => [
      {
        label: 'Efectivo',
        value: inRange.filter((s) => s.method === 'efectivo').reduce((a, s) => a + s.totalCents, 0),
        color: SERIES.pink,
      },
      {
        label: 'Tarjeta',
        value: inRange.filter((s) => s.method === 'tarjeta').reduce((a, s) => a + s.totalCents, 0),
        color: SERIES.violet,
      },
      {
        label: 'Apps (Rappi/Uber)',
        value: inRange.filter((s) => s.method === 'app').reduce((a, s) => a + s.totalCents, 0),
        color: SERIES.orange,
      },
    ],
    [inRange],
  )

  const canales = useMemo(
    () => [
      { label: 'Mostrador', value: b.ventasPorCanal.mostrador, color: SERIES.pink },
      { label: 'Rappi', value: b.ventasPorCanal.rappi, color: SERIES.orange },
      { label: 'Uber Eats', value: b.ventasPorCanal.uber, color: SERIES.emerald },
    ],
    [b],
  )

  const top = useMemo(
    () =>
      topProducts(sales, range)
        .slice(0, 8)
        .map((p) => ({ label: `${p.name} ×${p.qty}`, value: p.margenCents })),
    [sales, range],
  )

  return (
    <div>
      <div className="mb-4">
        <PillSelector options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatTile label="Vendido" value={formatMXN(b.ventasCents)} />
        <StatTile
          label="Ganancia real"
          value={formatMXN(b.gananciaNetaCents)}
          color={b.gananciaNetaCents >= 0 ? 'text-emerald-600' : 'text-red-600'}
        />
        <StatTile label="Ventas" value={String(b.numVentas)} />
        <StatTile label="Ticket promedio" value={formatMXN(b.ticketPromedioCents)} />
      </div>

      <div className="space-y-4">
        <Card title="Ventas por día">
          {b.numVentas === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Sin ventas en este periodo.</p>
          ) : (
            <BarChart data={porDia} color={SERIES.pink} width={1100} height={240} format={short} />
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Por día de la semana">
            <BarChart data={porSemana} color={SERIES.pink} height={170} format={short} />
          </Card>
          <Card title="Por hora del día">
            <BarChart data={porHora} color={SERIES.pink} height={170} format={short} />
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Métodos de pago">
            <HBarChart data={metodos} format={formatMXN} />
          </Card>
          <Card title="Canales de venta">
            <HBarChart data={canales} format={formatMXN} />
          </Card>
        </div>

        <Card title="Top productos por ganancia">
          {top.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Sin ventas en este periodo.</p>
          ) : (
            <HBarChart data={top} color={SERIES.pink} format={formatMXN} />
          )}
        </Card>
      </div>
    </div>
  )
}
