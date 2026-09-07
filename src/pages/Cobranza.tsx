import { useEffect, useMemo, useState } from 'react'
import { useStore, Sale, SaleItem } from '../store/useStore'
import { formatMXN } from '../lib/money'
import { playSaleSuccess } from '../lib/sounds'
import Cart from '../components/Cart'
import ModalEfectivo from '../components/ModalEfectivo'
import ModalCobroTarjeta from '../components/ModalCobroTarjeta'
import ModalCobroPersonalizado from '../components/ModalCobroPersonalizado'
import ModalVentaCompletada from '../components/ModalVentaCompletada'
import { cancelOrder, getOrderStatus } from '../payments/mercadopago'
import { loadPending, savePending, clearPending, PendingCharge } from '../payments/pending'

type ModalState = 'none' | 'efectivo' | 'tarjeta' | 'completada'

// Contexto del cobro con tarjeta en curso (del carrito, monto libre o recuperado)
type ChargeCtx = {
  totalCents: number
  items: SaleItem[]
  fromCart: boolean
  resume?: { orderId: string; expiresAt: number }
}

export default function Cobranza() {
  const products = useStore((s) => s.products)
  const cart = useStore((s) => s.cart)
  const settings = useStore((s) => s.settings)
  const addToCart = useStore((s) => s.addToCart)
  const removeFromCart = useStore((s) => s.removeFromCart)
  const clearCart = useStore((s) => s.clearCart)
  const addSale = useStore((s) => s.addSale)

  const [modal, setModal] = useState<ModalState>('none')
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [chargeCtx, setChargeCtx] = useState<ChargeCtx | null>(null)
  const [recovery, setRecovery] = useState<PendingCharge | null>(null)

  const activeProducts = useMemo(() => products.filter((p) => p.active !== false), [products])
  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const p of activeProducts) if (p.category) set.add(p.category)
    return [...set].sort()
  }, [activeProducts])
  const visibleProducts =
    category === null ? activeProducts : activeProducts.filter((p) => p.category === category)

  const cartLines = cart
    .map((c) => {
      const p = products.find((x) => x.id === c.productId)
      if (!p) return null
      return { product: p, qty: c.qty, subtotal: p.priceCents * c.qty }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const totalCents = cartLines.reduce((acc, l) => acc + l.subtotal, 0)
  const totalQty = cartLines.reduce((acc, l) => acc + l.qty, 0)

  const buildItems = (): SaleItem[] =>
    cartLines.map((l) => {
      const base: SaleItem = {
        productId: l.product.id,
        name: l.product.name,
        qty: l.qty,
        priceCents: l.product.priceCents,
        costCents: l.product.costCents,
      }
      if (l.product.owner === 'paletero') {
        base.owner = 'paletero'
        base.paleteroCents = Math.round(
          l.subtotal * (1 - settings.paletero.fresafePercent / 100),
        )
      }
      return base
    })

  const completeSale = (
    method: 'efectivo' | 'tarjeta',
    receivedCents: number,
    denominations?: { id?: string; cents: number; qty: number }[],
    mpOrderId?: string,
    commissionCents?: number,
  ) => {
    const sale: Sale = {
      id: 'temp',
      timestamp: Date.now(),
      items: buildItems(),
      totalCents,
      method,
      receivedCents,
      changeCents: Math.max(0, receivedCents - totalCents),
      denominations,
      mpOrderId,
      commissionCents,
      channel: 'mostrador',
      channelFeeCents: null,
    }
    addSale({
      items: sale.items,
      totalCents: sale.totalCents,
      method: sale.method,
      receivedCents: sale.receivedCents,
      changeCents: sale.changeCents,
      denominations: sale.denominations,
      mpOrderId: sale.mpOrderId,
      commissionCents: sale.commissionCents,
      channel: sale.channel,
      channelFeeCents: sale.channelFeeCents,
    })
    setLastSale(sale)
    clearCart()
    setMobileCartOpen(false)
    setModal('completada')
    playSaleSuccess()
  }

  // Registra una venta con tarjeta (del carrito, monto libre o recuperada tras refresh)
  const registerCardSale = (
    ctx: { totalCents: number; items: SaleItem[]; fromCart: boolean },
    orderId: string,
    commissionCents: number,
  ) => {
    const sale: Sale = {
      id: 'temp',
      timestamp: Date.now(),
      items: ctx.items,
      totalCents: ctx.totalCents,
      method: 'tarjeta',
      receivedCents: ctx.totalCents,
      changeCents: 0,
      mpOrderId: orderId,
      commissionCents,
      channel: 'mostrador',
      channelFeeCents: null,
    }
    addSale({
      items: sale.items,
      totalCents: sale.totalCents,
      method: sale.method,
      receivedCents: sale.receivedCents,
      changeCents: sale.changeCents,
      mpOrderId: sale.mpOrderId,
      commissionCents: sale.commissionCents,
      channel: sale.channel,
      channelFeeCents: sale.channelFeeCents,
    })
    clearPending()
    setChargeCtx(null)
    setLastSale(sale)
    if (ctx.fromCart) clearCart()
    setMobileCartOpen(false)
    setModal('completada')
    playSaleSuccess()
  }

  // Recuperación tras refrescar: ¿quedó un cobro con tarjeta en curso?
  const cardCommissionPercent = useStore((s) => s.cardCommissionPercent)
  useEffect(() => {
    const p = loadPending()
    if (!p) return
    let alive = true
    ;(async () => {
      const res = await getOrderStatus(p.orderId)
      if (!alive) return
      if (res.ok && res.status === 'processed') {
        // Se pagó mientras la página no estaba: registrar la venta para no perderla.
        registerCardSale(
          { totalCents: p.totalCents, items: p.items, fromCart: false },
          p.orderId,
          Math.round((p.totalCents * cardCommissionPercent) / 100),
        )
      } else if (res.ok && (res.status === 'canceled' || res.status === 'expired')) {
        clearPending()
      } else {
        setRecovery(p)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onPayCash = () => {
    setMobileCartOpen(false)
    setModal('efectivo')
  }
  const onPayCard = () => {
    setMobileCartOpen(false)
    setChargeCtx({ totalCents, items: buildItems(), fromCart: true })
    setModal('tarjeta')
  }

  return (
    <div className="relative h-full flex flex-col lg:flex-row gap-4 lg:gap-6 p-4 lg:p-6 overflow-hidden">
      <div className="flex-1 min-w-0 overflow-auto pr-1 pb-24 lg:pb-0">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-2xl lg:text-3xl font-bold">Cobranza</h2>
          <button
            onClick={() => setCustomOpen(true)}
            className="text-xs font-semibold text-slate-400 hover:text-slate-800 border border-slate-200 hover:border-slate-300 bg-white rounded-full px-3 py-1.5 transition"
            title="Cobrar un monto libre con tarjeta"
          >
            $ Monto personalizado
          </button>
        </div>
        {categories.length > 0 && (
          <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => setCategory(null)}
              className={
                'px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition ' +
                (category === null
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600')
              }
            >
              Todo
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={
                  'px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition ' +
                  (category === c
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600')
                }
              >
                {c}
              </button>
            ))}
          </div>
        )}
        {activeProducts.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            No hay productos. Agrega algunos en la pestaña Menú.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
            {visibleProducts.map((p) => {
              const inCart = cart.find((c) => c.productId === p.id)?.qty || 0
              return (
                <button
                  key={p.id}
                  onClick={() => (inCart > 0 ? removeFromCart(p.id) : addToCart(p.id))}
                  type="button"
                  className={
                    'relative rounded-xl shadow overflow-hidden hover:shadow-lg active:scale-[0.98] transition text-left border-2 cursor-pointer select-none ' +
                    (inCart > 0
                      ? 'bg-violet-50 border-violet-400 ring-2 ring-violet-200 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-900')
                  }
                >
                  <span className="pointer-events-none block">
                    {p.imageDataUrl ? (
                      <img
                        src={p.imageDataUrl}
                        alt={p.name}
                        draggable={false}
                        className="w-full h-28 lg:h-32 object-cover pointer-events-none select-none"
                      />
                    ) : (
                      <span className="w-full h-28 lg:h-32 bg-slate-100 flex items-center justify-center text-slate-400 text-sm">
                        Sin imagen
                      </span>
                    )}
                    {p.owner === 'paletero' && (
                      <span className="absolute top-1.5 right-1.5 bg-cyan-100 text-cyan-800 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded">
                        Paleta
                      </span>
                    )}
                    <span className="block p-2 lg:p-3">
                      <span className="block font-bold text-sm lg:text-base leading-tight">
                        {p.name}
                      </span>
                      <span className="block font-bold text-base lg:text-lg mt-1 text-slate-900">
                        {formatMXN(p.priceCents)}
                      </span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="hidden lg:flex w-96 shrink-0 flex-col h-full">
        <Cart onPayCash={onPayCash} onPayCard={onPayCard} />
      </div>

      {totalQty > 0 && !mobileCartOpen && (
        <button
          onClick={() => setMobileCartOpen(true)}
          className="lg:hidden absolute bottom-0 inset-x-0 bg-pink-600 hover:bg-pink-700 active:bg-pink-800 text-white shadow-2xl px-5 py-4 flex items-center justify-between z-30 transition"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
                />
              </svg>
              <span className="absolute -top-1.5 -right-2 bg-white text-slate-900 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {totalQty}
              </span>
            </div>
            <span className="font-semibold">Ver carrito</span>
          </div>
          <span className="text-xl font-bold">{formatMXN(totalCents)}</span>
        </button>
      )}

      {mobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col">
          <div
            className="flex-1 bg-black/50"
            onClick={() => setMobileCartOpen(false)}
            aria-hidden="true"
          />
          <div className="bg-white rounded-t-2xl shadow-2xl max-h-[88vh] flex flex-col">
            <div className="self-center w-12 h-1.5 bg-slate-200 rounded-full mt-2 mb-1 shrink-0" />
            <div className="min-h-0 flex-1 flex">
              <Cart
                onPayCash={onPayCash}
                onPayCard={onPayCard}
                onClose={() => setMobileCartOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {modal === 'efectivo' && (
        <ModalEfectivo
          totalCents={totalCents}
          onCancel={() => setModal('none')}
          onConfirm={(receivedCents, denominations) =>
            completeSale('efectivo', receivedCents, denominations)
          }
        />
      )}
      {modal === 'tarjeta' && chargeCtx && (
        <ModalCobroTarjeta
          totalCents={chargeCtx.totalCents}
          items={chargeCtx.items.map((i) => ({
            name: i.name,
            qty: i.qty,
            priceCents: i.priceCents,
            costCents: i.costCents,
          }))}
          resume={chargeCtx.resume}
          onOrderCreated={(orderId, expiresAt) =>
            savePending({
              orderId,
              totalCents: chargeCtx.totalCents,
              items: chargeCtx.items,
              expiresAt,
            })
          }
          onCancel={() => {
            clearPending()
            setChargeCtx(null)
            setModal('none')
          }}
          onConfirm={(orderId, commissionCents) =>
            registerCardSale(chargeCtx, orderId, commissionCents)
          }
        />
      )}

      {customOpen && (
        <ModalCobroPersonalizado
          onCancel={() => setCustomOpen(false)}
          onCharge={(amountCents, concept) => {
            setCustomOpen(false)
            setChargeCtx({
              totalCents: amountCents,
              items: [
                {
                  productId: 'custom',
                  name: concept || 'Monto personalizado',
                  qty: 1,
                  priceCents: amountCents,
                  costCents: 0,
                },
              ],
              fromCart: false,
            })
            setModal('tarjeta')
          }}
        />
      )}

      {recovery && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-2">
              Cobro en curso recuperado
            </h3>
            <div className="text-3xl font-bold text-slate-900 tabular-nums mb-1">
              {formatMXN(recovery.totalCents)}
            </div>
            <p className="text-sm text-slate-500 mb-5">
              La página se recargó con un cobro con tarjeta en curso (
              {recovery.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}). ¿Qué quieres hacer?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  cancelOrder(recovery.orderId).catch(() => {})
                  clearPending()
                  setRecovery(null)
                }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-red-600 font-semibold py-3 rounded-lg"
              >
                Cancelar cobro
              </button>
              <button
                onClick={() => {
                  setChargeCtx({
                    totalCents: recovery.totalCents,
                    items: recovery.items,
                    fromCart: false,
                    resume: { orderId: recovery.orderId, expiresAt: recovery.expiresAt },
                  })
                  setRecovery(null)
                  setModal('tarjeta')
                }}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg"
              >
                Continuar cobro
              </button>
            </div>
          </div>
        </div>
      )}
      {modal === 'completada' && lastSale && (
        <ModalVentaCompletada sale={lastSale} onClose={() => setModal('none')} />
      )}
    </div>
  )
}
