import { useStore } from '../store/useStore'
import { formatMXN } from '../lib/money'

type Props = {
  onPayCash: () => void
  onPayCard: () => void
  onClose?: () => void
}

export default function Cart({ onPayCash, onPayCard, onClose }: Props) {
  const products = useStore((s) => s.products)
  const cart = useStore((s) => s.cart)
  const setCartQty = useStore((s) => s.setCartQty)
  const removeFromCart = useStore((s) => s.removeFromCart)
  const clearCart = useStore((s) => s.clearCart)

  const cartLines = cart
    .map((c) => {
      const p = products.find((x) => x.id === c.productId)
      if (!p) return null
      return { product: p, qty: c.qty, subtotal: p.priceCents * c.qty }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const totalCents = cartLines.reduce((acc, l) => acc + l.subtotal, 0)
  const totalQty = cartLines.reduce((acc, l) => acc + l.qty, 0)

  return (
    <div className="bg-white lg:rounded-xl lg:shadow lg:border lg:border-slate-200 flex flex-col h-full w-full overflow-hidden">
      <div className="px-4 py-3 lg:p-4 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden -ml-2 w-10 h-10 flex items-center justify-center rounded-full active:bg-slate-100 text-slate-500"
              aria-label="Cerrar carrito"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          )}
          <h3 className="font-bold text-lg">Carrito {totalQty > 0 && `(${totalQty})`}</h3>
        </div>
        <button
          onClick={clearCart}
          disabled={cart.length === 0}
          className={
            'text-sm font-semibold px-3 py-2 rounded-lg transition ' +
            (cart.length === 0
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-red-50 text-red-600 active:bg-red-100 lg:hover:bg-red-100')
          }
        >
          Limpiar
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 lg:p-4">
        {cartLines.length === 0 ? (
          <div className="text-slate-400 text-center py-12 text-sm">
            Vacío. Toca un producto para agregarlo.
          </div>
        ) : (
          cartLines.map((l) => (
            <div
              key={l.product.id}
              className="flex gap-3 py-3 first:pt-0 border-b border-slate-100 last:border-0"
            >
              <div className="w-16 h-16 lg:w-14 lg:h-14 shrink-0 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center">
                {l.product.imageDataUrl ? (
                  <img
                    src={l.product.imageDataUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] text-slate-400 text-center px-1 leading-tight">
                    Sin foto
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-[15px] lg:text-sm leading-tight truncate">
                      {l.product.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatMXN(l.product.priceCents)} c/u
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromCart(l.product.id)}
                    className="-mt-1 -mr-1 w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-slate-400 active:bg-red-50 active:text-red-600 lg:hover:bg-red-50 lg:hover:text-red-600"
                    aria-label={`Quitar ${l.product.name}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-4 h-4"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center bg-slate-100 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setCartQty(l.product.id, l.qty - 1)}
                      className="w-10 h-10 lg:w-8 lg:h-8 flex items-center justify-center font-bold text-lg text-slate-700 active:bg-slate-200 lg:hover:bg-slate-200"
                      aria-label="Restar uno"
                    >
                      −
                    </button>
                    <span className="w-9 lg:w-8 text-center font-bold text-sm tabular-nums">
                      {l.qty}
                    </span>
                    <button
                      onClick={() => setCartQty(l.product.id, l.qty + 1)}
                      className="w-10 h-10 lg:w-8 lg:h-8 flex items-center justify-center font-bold text-lg text-slate-700 active:bg-slate-200 lg:hover:bg-slate-200"
                      aria-label="Sumar uno"
                    >
                      +
                    </button>
                  </div>
                  <div className="font-bold text-[15px] lg:text-sm tabular-nums">
                    {formatMXN(l.subtotal)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-4 border-t border-slate-200 bg-slate-50 lg:rounded-b-xl shrink-0">
        <div className="flex items-baseline justify-between mb-3">
          <span className="font-bold text-base lg:text-lg">Total</span>
          <span className="text-2xl lg:text-3xl font-bold text-slate-900 tabular-nums">
            {formatMXN(totalCents)}
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
          <button
            onClick={onPayCard}
            disabled={cart.length === 0}
            className="bg-slate-900 active:bg-slate-800 lg:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-3.5 lg:py-3 px-2 rounded-xl lg:rounded-lg text-sm lg:text-base leading-tight"
          >
            Cobrar con tarjeta
          </button>
          <button
            onClick={onPayCash}
            disabled={cart.length === 0}
            className="bg-pink-600 active:bg-pink-700 lg:hover:bg-pink-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-3.5 lg:py-3 px-2 rounded-xl lg:rounded-lg text-sm lg:text-base leading-tight"
          >
            Cobrar en efectivo
          </button>
        </div>
      </div>
    </div>
  )
}
