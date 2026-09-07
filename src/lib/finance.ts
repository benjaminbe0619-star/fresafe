import { Sale, RecordItem, Settings, Channel } from '../store/useStore'

const DAY = 86_400_000
const AVG_MONTH_DAYS = 30.44

export type PeriodKey = 'hoy' | '7dias' | 'mes' | 'todo'

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  hoy: 'Hoy',
  '7dias': 'Últimos 7 días',
  mes: 'Este mes',
  todo: 'Todo',
}

export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function periodRange(key: PeriodKey, now = Date.now()): { start: number; end: number } {
  if (key === 'hoy') return { start: startOfDay(now), end: now }
  if (key === '7dias') return { start: startOfDay(now) - 6 * DAY, end: now }
  if (key === 'mes') {
    const d = new Date(now)
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return { start: d.getTime(), end: now }
  }
  return { start: 0, end: now }
}

export type Breakdown = {
  ventasCents: number
  insumosCents: number
  comisionTarjetaCents: number
  comisionAppsCents: number
  paleteroCents: number
  comisionPaletasCents: number
  gastosVariablesCents: number
  gastosFijosCents: number
  mermasCents: number
  gananciaBrutaCents: number
  gananciaNetaCents: number
  numVentas: number
  ticketPromedioCents: number
  ventasPorCanal: Record<Channel, number>
}

const inRange = (ts: number, r: { start: number; end: number }) => ts >= r.start && ts <= r.end

// Equivalente mensual de un sueldo según su frecuencia de pago.
export function monthlySalaryCents(salaryCents: number, frequency: string): number {
  if (frequency === 'semanal') return Math.round((salaryCents * 52) / 12)
  if (frequency === 'quincenal') return salaryCents * 2
  return salaryCents
}

// Gastos fijos y sueldos son montos MENSUALES; se prorratean por los días que
// cubre el periodo (contando cada uno solo desde su fecha de alta).
export function fixedExpensesForRange(
  records: RecordItem[],
  range: { start: number; end: number },
  now = Date.now(),
): number {
  const end = Math.min(range.end, now)
  let total = 0
  for (const r of records) {
    if (r.kind !== 'gasto-fijo' && r.kind !== 'empleado') continue
    if (r.data?.active === false) continue
    const monthly =
      r.kind === 'empleado'
        ? monthlySalaryCents(r.data?.salaryCents ?? 0, r.data?.frequency ?? 'mensual')
        : (r.data?.amountCents ?? 0)
    const from = Math.max(range.start, startOfDay(r.ts))
    const days = Math.max(0, (end - from) / DAY)
    total += (monthly * days) / AVG_MONTH_DAYS
  }
  return Math.round(total)
}

export function computeBreakdown(
  sales: Sale[],
  records: RecordItem[],
  range: { start: number; end: number },
  now = Date.now(),
): Breakdown {
  let ventas = 0
  let insumos = 0
  let comisionTarjeta = 0
  let comisionApps = 0
  let paletero = 0
  let paletasVendidas = 0
  let numVentas = 0
  const porCanal: Record<Channel, number> = { mostrador: 0, rappi: 0, uber: 0 }

  for (const s of sales) {
    if (s.refunded) continue
    if (!inRange(s.timestamp, range)) continue
    numVentas++
    ventas += s.totalCents
    comisionTarjeta += s.commissionCents ?? 0
    comisionApps += s.channelFeeCents ?? 0
    porCanal[s.channel ?? 'mostrador'] += s.totalCents
    for (const it of s.items) {
      const lineTotal = it.priceCents * it.qty
      if (it.owner === 'paletero') {
        paletero += it.paleteroCents ?? 0
        paletasVendidas += lineTotal
      } else {
        insumos += it.costCents * it.qty
      }
    }
  }

  let gastosVariables = 0
  let mermas = 0
  for (const r of records) {
    if (r.kind === 'gasto' && inRange(r.ts, range)) gastosVariables += r.data?.amountCents ?? 0
    if (r.kind === 'merma' && inRange(r.ts, range)) mermas += r.data?.costCents ?? 0
  }
  const gastosFijos = fixedExpensesForRange(records, range, now)

  const gananciaBruta = ventas - insumos - paletero
  const gananciaNeta =
    gananciaBruta - comisionTarjeta - comisionApps - gastosVariables - gastosFijos - mermas

  return {
    ventasCents: ventas,
    insumosCents: insumos,
    comisionTarjetaCents: comisionTarjeta,
    comisionAppsCents: comisionApps,
    paleteroCents: paletero,
    comisionPaletasCents: paletasVendidas - paletero,
    gastosVariablesCents: gastosVariables,
    gastosFijosCents: gastosFijos,
    mermasCents: mermas,
    gananciaBrutaCents: gananciaBruta,
    gananciaNetaCents: gananciaNeta,
    numVentas,
    ticketPromedioCents: numVentas > 0 ? Math.round(ventas / numVentas) : 0,
    ventasPorCanal: porCanal,
  }
}

// ---------- Socio ----------

// Periodo de corte actual del socio: desde el último día de corte hasta ahora.
export function currentCutRange(
  partner: Settings['partner'],
  now = Date.now(),
): { start: number; end: number } {
  const d = new Date(startOfDay(now))
  if (partner.frequency === 'semanal') {
    const target = Math.min(6, Math.max(0, partner.cutWeekday))
    while (d.getDay() !== target) d.setTime(d.getTime() - DAY)
    return { start: d.getTime(), end: now }
  }
  const target = Math.min(28, Math.max(1, partner.cutMonthday))
  if (d.getDate() < target) d.setMonth(d.getMonth() - 1)
  d.setDate(target)
  return { start: d.getTime(), end: now }
}

export function partnerBaseCents(b: Breakdown, base: Settings['partner']['base']): number {
  if (base === 'ventas') return b.ventasCents
  if (base === 'bruta') return b.gananciaBrutaCents
  return b.gananciaNetaCents
}

export type PartnerLedger = {
  prestamosCents: number
  aportacionesCents: number
  pagosPrestamoCents: number
  pagosGananciaCents: number
  saldoPrestamoCents: number
}

export function partnerLedger(records: RecordItem[]): PartnerLedger {
  let prestamos = 0
  let aportaciones = 0
  let pagosPrestamo = 0
  let pagosGanancia = 0
  for (const r of records) {
    if (r.kind !== 'socio-mov') continue
    const amount = r.data?.amountCents ?? 0
    switch (r.data?.type) {
      case 'prestamo':
        prestamos += amount
        break
      case 'aportacion':
        aportaciones += amount
        break
      case 'pago-prestamo':
        pagosPrestamo += amount
        break
      case 'pago-ganancia':
        pagosGanancia += amount
        break
    }
  }
  return {
    prestamosCents: prestamos,
    aportacionesCents: aportaciones,
    pagosPrestamoCents: pagosPrestamo,
    pagosGananciaCents: pagosGanancia,
    saldoPrestamoCents: prestamos - pagosPrestamo,
  }
}

// ---------- Paletero ----------

export type PaleteroLedger = {
  vendidoCents: number // total vendido de sus paletas (precio completo)
  suParteCents: number // lo que le corresponde a él
  comisionCents: number // lo que se queda FresaFé
  pagadoCents: number
  saldoCents: number // lo que se le debe
}

export function paleteroLedger(sales: Sale[], records: RecordItem[]): PaleteroLedger {
  let vendido = 0
  let suParte = 0
  for (const s of sales) {
    if (s.refunded) continue
    for (const it of s.items) {
      if (it.owner === 'paletero') {
        vendido += it.priceCents * it.qty
        suParte += it.paleteroCents ?? 0
      }
    }
  }
  let pagado = 0
  for (const r of records) {
    if (r.kind === 'paletero-pago') pagado += r.data?.amountCents ?? 0
  }
  return {
    vendidoCents: vendido,
    suParteCents: suParte,
    comisionCents: vendido - suParte,
    pagadoCents: pagado,
    saldoCents: suParte - pagado,
  }
}

// ---------- Top productos ----------

export type ProductStat = {
  productId: string
  name: string
  qty: number
  ventasCents: number
  margenCents: number
}

export function topProducts(sales: Sale[], range: { start: number; end: number }): ProductStat[] {
  const map = new Map<string, ProductStat>()
  for (const s of sales) {
    if (s.refunded) continue
    if (!inRange(s.timestamp, range)) continue
    for (const it of s.items) {
      const key = it.productId || it.name
      const cur = map.get(key) ?? {
        productId: key,
        name: it.name,
        qty: 0,
        ventasCents: 0,
        margenCents: 0,
      }
      const lineTotal = it.priceCents * it.qty
      cur.qty += it.qty
      cur.ventasCents += lineTotal
      cur.margenCents +=
        it.owner === 'paletero'
          ? lineTotal - (it.paleteroCents ?? 0)
          : lineTotal - it.costCents * it.qty
      map.set(key, cur)
    }
  }
  return [...map.values()].sort((a, b) => b.margenCents - a.margenCents)
}

export const WEEKDAYS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]
