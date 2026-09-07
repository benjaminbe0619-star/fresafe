import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { playSaleSuccess } from '../lib/sounds'

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? ''
const POLL_INTERVAL = 30_000

type LateConfirmationItem = {
  name: string
  qty: number
  priceCents: number
  costCents?: number
}

type LateConfirmation = {
  orderId: string
  amountCents: number
  externalReference?: string
  confirmedAt: number
  items?: LateConfirmationItem[]
}

export type LateToast = { orderId: string; amountCents: number }

export function useLateConfirmations(): {
  toast: LateToast | null
  dismissToast: () => void
} {
  const [toast, setToast] = useState<LateToast | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    if (!BACKEND_URL) return

    const ack = (orderId: string) => {
      fetch(`${BACKEND_URL}/late-confirmations/${orderId}/ack`, {
        method: 'POST',
      }).catch(() => {})
    }

    const check = async () => {
      if (inFlight.current) return
      inFlight.current = true
      try {
        const res = await fetch(`${BACKEND_URL}/late-confirmations`)
        if (!res.ok) return
        const data = (await res.json()) as { confirmations?: LateConfirmation[] }
        const confirmations = Array.isArray(data.confirmations) ? data.confirmations : []

        for (const conf of confirmations) {
          if (!conf?.orderId) continue
          const state = useStore.getState()
          const exists = state.sales.some((s) => s.mpOrderId === conf.orderId)

          if (!exists) {
            const totalCents = conf.amountCents
            const sourceItems: LateConfirmationItem[] =
              conf.items && conf.items.length > 0
                ? conf.items
                : [
                    {
                      name: 'Cobro tardío (sin detalle)',
                      qty: 1,
                      priceCents: totalCents,
                      costCents: 0,
                    },
                  ]
            const items = sourceItems.map((i) => ({
              productId: 'late',
              name: i.name,
              qty: i.qty,
              priceCents: i.priceCents,
              costCents: i.costCents ?? 0,
            }))
            const commissionCents = Math.round(
              (totalCents * state.cardCommissionPercent) / 100,
            )
            state.addSale({
              items,
              totalCents,
              method: 'tarjeta',
              receivedCents: totalCents,
              changeCents: 0,
              mpOrderId: conf.orderId,
              commissionCents,
              isLate: true,
            })
            playSaleSuccess()
            setToast({ orderId: conf.orderId, amountCents: totalCents })
          }
          ack(conf.orderId)
        }
      } catch {
        // network blip — try next tick
      } finally {
        inFlight.current = false
      }
    }

    check()
    const interval = setInterval(check, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  return { toast, dismissToast: () => setToast(null) }
}
