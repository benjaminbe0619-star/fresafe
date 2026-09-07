import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore, Sale } from '../store/useStore'
import { formatMXN } from '../lib/money'

function MethodBadge({ sale, small }: { sale: Sale; small?: boolean }) {
  const size = small
    ? 'text-[10px] uppercase px-2 py-0.5 rounded font-bold '
    : 'text-xs px-2 py-1 rounded font-semibold '
  if (sale.refunded) {
    return <span className={size + 'bg-slate-100 text-slate-500 line-through'}>Devuelta</span>
  }
  if (sale.method === 'app') {
    return sale.channel === 'uber' ? (
      <span className={size + 'bg-emerald-100 text-emerald-800'}>Uber Eats</span>
    ) : (
      <span className={size + 'bg-orange-100 text-orange-700'}>Rappi</span>
    )
  }
  return sale.method === 'efectivo' ? (
    <span className={size + 'bg-pink-100 text-pink-700'}>Efectivo</span>
  ) : (
    <span className={size + 'bg-slate-900 text-white'}>Tarjeta</span>
  )
}

export default function Ventas() {
  const sales = useStore((s) => s.sales)
  const deleteSale = useStore((s) => s.deleteSale)
  const refundSale = useStore((s) => s.refundSale)
  const investmentCents = useStore((s) => s.investmentCents)
  const changeFundCents = useStore((s) => s.changeFundCents)

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmRefund, setConfirmRefund] = useState<Sale | null>(null)
  const [refunding, setRefunding] = useState(false)
  const [openMoney, setOpenMoney] = useState(false)
  const [mobileLimit, setMobileLimit] = useState(4)

  const netOf = (s: {
    totalCents: number
    commissionCents?: number | null
    channelFeeCents?: number | null
  }) => s.totalCents - (s.commissionCents ?? 0) - (s.channelFeeCents ?? 0)

  // Las ventas devueltas se conservan en el historial pero no cuentan en el dinero.
  const activeSales = sales.filter((s) => !s.refunded)
  const totalSalesNetCents = activeSales.reduce((acc, s) => acc + netOf(s), 0)
  const cashSalesNetCents = activeSales
    .filter((s) => s.method === 'efectivo')
    .reduce((acc, s) => acc + netOf(s), 0)
  const cardSalesNetCents = activeSales
    .filter((s) => s.method === 'tarjeta')
    .reduce((acc, s) => acc + netOf(s), 0)
  const appSalesNetCents = activeSales
    .filter((s) => s.method === 'app')
    .reduce((acc, s) => acc + netOf(s), 0)
  const totalCommissionCents = activeSales.reduce((acc, s) => acc + (s.commissionCents ?? 0), 0)
  const totalChannelFeeCents = activeSales.reduce((acc, s) => acc + (s.channelFeeCents ?? 0), 0)

  const canRefund = (s: Sale) => s.method === 'tarjeta' && !!s.mpOrderId && !s.refunded
  const doRefund = async () => {
    if (!confirmRefund) return
    setRefunding(true)
    const res = await refundSale(confirmRefund.id)
    setRefunding(false)
    if (!res.ok) {
      alert('No se pudo devolver: ' + (res.error ?? 'error desconocido'))
      return
    }
    setConfirmRefund(null)
  }
  const cashOnHand = changeFundCents + cashSalesNetCents
  const totalDinero = cashOnHand + cardSalesNetCents + appSalesNetCents

  const ganancia = Math.max(0, totalSalesNetCents - investmentCents)
  const faltaParaInversion = Math.max(0, investmentCents - totalSalesNetCents)
  const progresoInversion =
    investmentCents > 0 ? Math.min(100, (totalSalesNetCents / investmentCents) * 100) : 0

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => setOpenMoney(true)}
          type="button"
          className="group bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:shadow-md shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition p-5 text-left cursor-pointer"
        >
          <div className="text-[11px] uppercase font-bold tracking-[0.08em] text-slate-400">Dinero total</div>
          <div className="text-3xl font-bold mt-1 text-slate-900">{formatMXN(totalDinero)}</div>
          <div className="text-xs text-slate-900 font-medium mt-1.5 underline-offset-2 group-hover:underline">
            Toca para ver desglose
          </div>
        </button>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
          <div className="text-[11px] uppercase font-bold tracking-[0.08em] text-slate-400 mb-2">Ganancia</div>
          {investmentCents === 0 ? (
            <div className="text-sm text-slate-500">
              Define la inversión en{' '}
              <span className="font-semibold text-slate-700">Configuración</span> para ver
              progreso.
            </div>
          ) : ganancia > 0 ? (
            <div className="flex items-center gap-3">
              <div className="shrink-0 bg-emerald-500 text-white rounded-full w-11 h-11 flex items-center justify-center">
                <svg
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  viewBox="0 0 24 24"
                  className="w-6 h-6"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-sm text-slate-700 font-medium">¡Ya estás ganando!</div>
                <div className="text-2xl font-bold text-slate-900 leading-tight">
                  {formatMXN(ganancia)}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-sm text-slate-700">Faltan para ganar</span>
                <span className="font-bold text-orange-600">
                  {formatMXN(faltaParaInversion)}
                </span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${progresoInversion}%` }}
                />
              </div>
              <div className="text-xs text-slate-500 mt-1.5">
                {progresoInversion.toFixed(0)}% del camino a recuperar la inversión
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
            Histórico de ventas
          </h3>
          <span className="text-xs text-slate-400">{sales.length} venta(s)</span>
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="text-left p-3">Hora</th>
                <th className="text-left p-3">Productos</th>
                <th className="text-right p-3">Total</th>
                <th className="text-left p-3">Método</th>
                <th className="text-right p-3">Recibido</th>
                <th className="text-right p-3">Cambio</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    Aún no hay ventas registradas
                  </td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="font-medium">
                          {new Date(s.timestamp).toLocaleTimeString('es-MX', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        {s.isLate && (
                          <span
                            className="text-[10px] uppercase font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded"
                            title="Cobro confirmado después del timeout — se registró automáticamente al recibir el webhook tardío de Mercado Pago."
                          >
                            tardío
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(s.timestamp).toLocaleDateString('es-MX')}
                      </div>
                    </td>
                    <td className="p-3">
                      {s.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                    </td>
                    <td className="p-3 text-right">
                      <div className="font-bold">{formatMXN(s.totalCents)}</div>
                      {(s.commissionCents ?? 0) + (s.channelFeeCents ?? 0) > 0 && (
                        <div className="text-xs text-slate-900 font-medium">
                          neto {formatMXN(netOf(s))}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <MethodBadge sale={s} />
                    </td>
                    <td className="p-3 text-right">{formatMXN(s.receivedCents)}</td>
                    <td className="p-3 text-right">{formatMXN(s.changeCents)}</td>
                    <td className="p-3 text-right">
                      <RowActions onDelete={() => setConfirmDelete(s.id)} onRefund={canRefund(s) ? () => setConfirmRefund(s) : undefined} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden">
          {sales.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Aún no hay ventas registradas
            </div>
          ) : (
            sales.slice(0, mobileLimit).map((s) => (
              <div
                key={s.id}
                className="border-t border-slate-100 first:border-0 p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="font-semibold">
                        {new Date(s.timestamp).toLocaleTimeString('es-MX', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      {s.isLate && (
                        <span
                          className="text-[10px] uppercase font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded"
                          title="Cobro tardío"
                        >
                          tardío
                        </span>
                      )}
                      <MethodBadge sale={s} small />
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {new Date(s.timestamp).toLocaleDateString('es-MX')}
                    </div>
                  </div>
                  <div className="shrink-0 -mt-1.5 -mr-1.5">
                    <RowActions onDelete={() => setConfirmDelete(s.id)} onRefund={canRefund(s) ? () => setConfirmRefund(s) : undefined} />
                  </div>
                </div>

                <div className="text-sm text-slate-700 mb-3">
                  {s.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                </div>

                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[11px] uppercase font-bold tracking-[0.08em] text-slate-400">
                    Total
                  </span>
                  <div className="text-right">
                    <div className="text-lg font-bold">{formatMXN(s.totalCents)}</div>
                    {(s.commissionCents ?? 0) + (s.channelFeeCents ?? 0) > 0 && (
                      <div className="text-xs text-slate-900 font-medium">
                        neto {formatMXN(netOf(s))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-2 flex justify-between text-xs text-slate-600">
                  <span>
                    Recibido:{' '}
                    <span className="font-semibold text-slate-900">
                      {formatMXN(s.receivedCents)}
                    </span>
                  </span>
                  <span>
                    Cambio:{' '}
                    <span className="font-semibold text-slate-900">
                      {formatMXN(s.changeCents)}
                    </span>
                  </span>
                </div>
              </div>
            ))
          )}
          {sales.length > mobileLimit && (
            <button
              onClick={() => setMobileLimit((l) => l + 4)}
              className="w-full py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition border-t border-slate-100"
            >
              Cargar más ({sales.length - mobileLimit}{' '}
              {sales.length - mobileLimit === 1 ? 'restante' : 'restantes'})
            </button>
          )}
        </div>
      </div>

      {openMoney && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setOpenMoney(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[11px] uppercase font-bold tracking-[0.08em] text-slate-400">Dinero total</div>
            <div className="text-3xl font-bold text-slate-900">{formatMXN(totalDinero)}</div>

            <div className="mt-5 border-t border-slate-200 pt-5 space-y-5">
              <div>
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-slate-900">Efectivo en caja</span>
                  <span className="font-bold text-lg text-slate-900">
                    {formatMXN(cashOnHand)}
                  </span>
                </div>
                <div className="mt-2 pl-3 border-l-2 border-pink-200 space-y-2.5">
                  <div className="flex justify-between items-baseline gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800">Para dar cambio</div>
                      <div className="text-xs text-slate-500">
                        Lo que apartaste al inicio del día.
                      </div>
                    </div>
                    <span className="font-semibold text-slate-900 whitespace-nowrap">
                      {formatMXN(changeFundCents)}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800">De las ventas</div>
                      <div className="text-xs text-slate-500">
                        Lo que han pagado en efectivo los clientes.
                      </div>
                    </div>
                    <span className="font-semibold text-slate-900 whitespace-nowrap">
                      {formatMXN(cashSalesNetCents)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-baseline gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900">Recibirás de tarjeta</div>
                    <div className="text-xs text-slate-500">
                      Neto a 1 mes (después de comisión MP). Va al banco.
                    </div>
                  </div>
                  <span className="font-bold text-lg text-slate-900 whitespace-nowrap">
                    {formatMXN(cardSalesNetCents)}
                  </span>
                </div>
                {totalCommissionCents > 0 && (
                  <div className="text-xs text-slate-500 mt-2 flex justify-between">
                    <span>Comisión MP descontada</span>
                    <span className="font-medium">−{formatMXN(totalCommissionCents)}</span>
                  </div>
                )}
              </div>

              {appSalesNetCents + totalChannelFeeCents > 0 && (
                <div>
                  <div className="flex justify-between items-baseline gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-orange-600">De Rappi / Uber Eats</div>
                      <div className="text-xs text-slate-500">
                        Neto después de la comisión de la app. Lo deposita la plataforma.
                      </div>
                    </div>
                    <span className="font-bold text-lg text-orange-600 whitespace-nowrap">
                      {formatMXN(appSalesNetCents)}
                    </span>
                  </div>
                  {totalChannelFeeCents > 0 && (
                    <div className="text-xs text-slate-500 mt-2 flex justify-between">
                      <span>Comisión de apps descontada</span>
                      <span className="font-medium">−{formatMXN(totalChannelFeeCents)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setOpenMoney(false)}
              className="w-full mt-6 bg-slate-100 hover:bg-slate-200 font-semibold py-2.5 rounded"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {confirmRefund && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-2">
              Devolver dinero
            </h3>
            <div className="text-3xl font-bold text-slate-900 tabular-nums mb-1">
              {formatMXN(confirmRefund.totalCents)}
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Se devolverá el monto completo a la tarjeta del cliente (
              {confirmRefund.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}). La venta quedará
              marcada como «Devuelta» y dejará de contar en los totales.
            </p>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-5 text-xs text-amber-900">
              Esta acción no se puede deshacer. Mercado Pago procesa la devolución y el dinero
              regresa al cliente en unos días, según su banco.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmRefund(null)}
                disabled={refunding}
                className="flex-1 bg-slate-100 hover:bg-slate-200 font-semibold py-3 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={doRefund}
                disabled={refunding}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg"
              >
                {refunding ? 'Devolviendo…' : 'Devolver dinero'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-lg mb-2">¿Estás seguro?</h3>
            <p className="text-slate-600 mb-5">
              Esta venta se eliminará y los totales de arriba se recalcularán automáticamente.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 font-semibold py-2 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  deleteSale(confirmDelete)
                  setConfirmDelete(null)
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RowActions({ onDelete, onRefund }: { onDelete: () => void; onRefund?: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setOpen((o) => !o)
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggle}
        type="button"
        aria-label="Acciones"
        className="w-9 h-9 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-5 h-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"
          />
        </svg>
      </button>
      {open &&
        createPortal(
          <>
            <div
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40"
              aria-hidden="true"
            />
            <div
              style={{ top: pos.top, right: pos.right }}
              className="fixed z-50 bg-white rounded-md shadow-xl border border-slate-200 min-w-[140px] overflow-hidden"
              role="menu"
            >
              {onRefund && (
                <button
                  onClick={() => {
                    onRefund()
                    setOpen(false)
                  }}
                  className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-50 font-medium text-sm"
                  role="menuitem"
                >
                  Devolver dinero
                </button>
              )}
              <button
                onClick={() => {
                  onDelete()
                  setOpen(false)
                }}
                className="w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 font-medium text-sm"
                role="menuitem"
              >
                Eliminar
              </button>
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
