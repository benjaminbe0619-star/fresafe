import { useEffect, useState } from 'react'
import { formatMXN } from '../lib/money'
import { useStore } from '../store/useStore'
import {
  chargeWithCard,
  getOrderStatus,
  cancelOrder,
  type OrderStatus,
  type ChargeItem,
} from '../payments/mercadopago'
import { loadPending, clearPending } from '../payments/pending'

type Props = {
  totalCents: number
  items: ChargeItem[]
  onCancel: () => void
  onConfirm: (orderId: string, commissionCents: number) => void
  // Avisa al padre cuando la orden queda creada (para la memoria persistente)
  onOrderCreated?: (orderId: string, expiresAt: number) => void
  // Reanudar una orden existente (recuperada tras refrescar la página)
  resume?: { orderId: string; expiresAt: number }
}

type State =
  | { kind: 'confirm' }
  | { kind: 'creating' }
  | {
      kind: 'waiting'
      orderId: string
      status: OrderStatus
      expiresAt: number
      cancelAttempted?: boolean
    }
  | { kind: 'failed'; reason: string }
  | { kind: 'error'; message: string }

export default function ModalCobroTarjeta({
  totalCents,
  items,
  onCancel,
  onConfirm,
  onOrderCreated,
  resume,
}: Props) {
  const [state, setState] = useState<State>(
    resume
      ? { kind: 'waiting', orderId: resume.orderId, status: 'at_terminal', expiresAt: resume.expiresAt }
      : { kind: 'confirm' },
  )
  const [now, setNow] = useState(Date.now())
  const [cancelling, setCancelling] = useState(false)
  const commissionPercent = useStore((s) => s.cardCommissionPercent)
  const commissionCents = Math.round((totalCents * commissionPercent) / 100)
  const netCents = totalCents - commissionCents

  const start = async () => {
    setState({ kind: 'creating' })
    // Auto-limpieza: si quedó una orden colgada de antes, cancelarla para no encimar montos.
    const stale = loadPending()
    if (stale) {
      await cancelOrder(stale.orderId).catch(() => {})
      clearPending()
    }
    const res = await chargeWithCard(totalCents, items)
    if (!res.ok) {
      setState({ kind: 'error', message: res.error })
      return
    }
    const expiresAt = Date.now() + res.expiresInSeconds * 1000
    onOrderCreated?.(res.orderId, expiresAt)
    setState({ kind: 'waiting', orderId: res.orderId, status: 'created', expiresAt })
  }

  const orderId = state.kind === 'waiting' ? state.orderId : null

  useEffect(() => {
    if (!orderId) return
    let cancelled = false

    const tick = async () => {
      const res = await getOrderStatus(orderId)
      if (cancelled) return
      if (!res.ok) return // network blip — keep retrying
      const s = res.status
      if (s === 'processed') {
        onConfirm(orderId, commissionCents)
        return
      }
      if (s === 'canceled' || s === 'expired') {
        setState({
          kind: 'failed',
          reason: s === 'expired' ? 'Tiempo agotado.' : 'Cobro cancelado.',
        })
        return
      }
      setState((prev) => (prev.kind === 'waiting' ? { ...prev, status: s } : prev))
    }

    tick()
    const interval = setInterval(tick, 2000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [orderId, onConfirm, commissionCents])

  useEffect(() => {
    if (state.kind !== 'waiting') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [state.kind])

  const handleCancelWaiting = async () => {
    if (state.kind !== 'waiting') return
    setCancelling(true)
    const res = await cancelOrder(state.orderId)
    setCancelling(false)
    if (res.ok) {
      onCancel()
    } else {
      setState((prev) =>
        prev.kind === 'waiting' ? { ...prev, cancelAttempted: true } : prev,
      )
    }
  }

  const secondsLeft =
    state.kind === 'waiting' ? Math.max(0, Math.ceil((state.expiresAt - now) / 1000)) : 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        {state.kind === 'confirm' && (
          <>
            <h3 className="text-xl font-bold mb-1">¿Cobrar con tarjeta?</h3>
            <div className="text-3xl font-bold text-slate-900">{formatMXN(totalCents)}</div>
            <div className="text-xs text-slate-500 mb-4">Lo que paga el cliente</div>

            <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 mb-4">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-slate-700 font-medium">Recibirás (a 1 mes)</span>
                <span className="text-xl font-bold text-slate-900">{formatMXN(netCents)}</span>
              </div>
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-xs text-slate-500">
                  Comisión MP ({commissionPercent.toFixed(2)}% IVA incluido)
                </span>
                <span className="text-xs text-slate-600 font-medium">
                  −{formatMXN(commissionCents)}
                </span>
              </div>
            </div>

            <p className="text-slate-600 text-sm mb-5">
              Al continuar, la terminal Point se activará y mostrará el monto. El cliente debe
              acercar o insertar su tarjeta.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 bg-slate-100 hover:bg-slate-200 font-semibold py-3 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={start}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg"
              >
                Sí, cobrar
              </button>
            </div>
          </>
        )}

        {state.kind === 'creating' && (
          <div className="text-center py-6">
            <Spinner />
            <div className="font-semibold mt-3">Conectando con la terminal...</div>
          </div>
        )}

        {state.kind === 'waiting' && (
          <>
            <h3 className="text-lg font-bold mb-1">Esperando pago</h3>
            <div className="text-3xl font-bold text-slate-900 mb-3">{formatMXN(totalCents)}</div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2">
                <Spinner small />
                <span className="text-sm font-semibold text-slate-800">
                  {state.status === 'created'
                    ? 'Enviando a la terminal...'
                    : 'El cliente debe pasar la tarjeta en la terminal.'}
                </span>
              </div>
              <div className="text-xs text-slate-700 mt-2">
                Tiempo restante: <span className="font-bold">{secondsLeft}s</span>
              </div>
            </div>

            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 mb-4">
              <div className="font-bold text-red-900 text-sm mb-1">
                Para cancelar este cobro:
              </div>
              <div className="text-xs text-slate-700 leading-relaxed">
                Presiona la <b className="text-red-700">flecha izquierda (←)</b> en la terminal
                Point — esa es la única forma de detener el cobro de inmediato. Mercado Pago no
                permite apagar la terminal desde el sistema una vez que recibió la orden. Si
                nadie hace nada, la orden expira sola en{' '}
                <span className="font-bold">{secondsLeft}s</span>.
              </div>
            </div>

            <button
              onClick={handleCancelWaiting}
              disabled={cancelling || state.cancelAttempted}
              className="w-full bg-slate-100 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-medium py-2.5 rounded text-sm"
              title="Solo funciona los primeros 2 segundos. Después usa la X de la terminal."
            >
              {cancelling
                ? 'Intentando cancelar...'
                : state.cancelAttempted
                  ? 'No se pudo cancelar — usa la flecha ← de la terminal'
                  : 'Intentar cancelar (solo si aún no llegó a la terminal)'}
            </button>
          </>
        )}

        {state.kind === 'failed' && (
          <>
            <h3 className="text-xl font-bold mb-2">Pago no completado</h3>
            <p className="text-slate-700 mb-5">{state.reason}</p>
            <button
              onClick={onCancel}
              className="w-full bg-slate-100 hover:bg-slate-200 font-semibold py-3 rounded-lg"
            >
              Volver
            </button>
          </>
        )}

        {state.kind === 'error' && (
          <>
            <h3 className="text-xl font-bold mb-2 text-red-600">Error</h3>
            <p className="text-slate-700 mb-5">{state.message}</p>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 bg-slate-100 hover:bg-slate-200 font-semibold py-3 rounded-lg"
              >
                Cerrar
              </button>
              <button
                onClick={start}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg"
              >
                Reintentar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Spinner({ small = false }: { small?: boolean }) {
  const size = small ? 'w-4 h-4 border-2' : 'w-12 h-12 border-4'
  return (
    <div
      className={`${size} ${small ? '' : 'mx-auto'} border-slate-200 border-t-slate-900 rounded-full animate-spin`}
    />
  )
}
