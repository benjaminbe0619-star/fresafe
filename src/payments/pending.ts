import { SaleItem } from '../store/useStore'

// Memoria persistente del cobro con tarjeta en curso: si la página se
// refresca a media cobrada, la app recupera la orden en vez de perderla.

const KEY = 'fresafe-pending-charge-v1'

export type PendingCharge = {
  orderId: string
  totalCents: number
  items: SaleItem[]
  expiresAt: number
}

export function savePending(p: PendingCharge): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // sin almacenamiento disponible: la app sigue funcionando sin recuperación
  }
}

export function loadPending(): PendingCharge | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as PendingCharge
    if (!p?.orderId || !p?.totalCents) return null
    return p
  } catch {
    return null
  }
}

export function clearPending(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignorar
  }
}
