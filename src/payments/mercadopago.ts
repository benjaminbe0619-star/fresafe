const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? ''

export type OrderStatus =
  | 'created'
  | 'at_terminal'
  | 'processed'
  | 'canceled'
  | 'expired'
  | 'unknown'

export type ChargeResult =
  | { ok: true; orderId: string; expiresInSeconds: number }
  | { ok: false; error: string }

export type StatusResult =
  | { ok: true; status: OrderStatus; raw: unknown }
  | { ok: false; error: string }

const noBackend = (): { ok: false; error: string } => ({
  ok: false,
  error: 'Backend URL no configurada (revisa .env y reinicia el dev server).',
})

export type ChargeItem = {
  name: string
  qty: number
  priceCents: number
  costCents?: number
}

export async function chargeWithCard(
  amountCents: number,
  items?: ChargeItem[],
): Promise<ChargeResult> {
  if (!BACKEND_URL) return noBackend()
  try {
    const amount = (amountCents / 100).toFixed(2)
    const res = await fetch(`${BACKEND_URL}/charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, externalRef: `pos-${Date.now()}`, items }),
    })
    const data: any = await res.json()
    if (!res.ok) {
      const msg =
        data?.errors?.[0]?.message ||
        data?.error ||
        `Error ${res.status} al crear la orden`
      return { ok: false, error: msg }
    }
    const expMatch = /PT(\d+)M/.exec(String(data.expiration_time ?? ''))
    const expiresInSeconds = expMatch ? parseInt(expMatch[1], 10) * 60 : 180
    return { ok: true, orderId: data.id as string, expiresInSeconds }
  } catch {
    return { ok: false, error: 'Sin conexión a internet o backend caído.' }
  }
}

export async function getOrderStatus(orderId: string): Promise<StatusResult> {
  if (!BACKEND_URL) return noBackend()
  try {
    const res = await fetch(`${BACKEND_URL}/charge/${orderId}`)
    const data: any = await res.json()
    if (!res.ok) {
      return { ok: false, error: data?.error || `Error ${res.status}` }
    }
    return { ok: true, status: (data.status as OrderStatus) ?? 'unknown', raw: data }
  } catch {
    return { ok: false, error: 'Sin conexión a internet.' }
  }
}

export async function cancelOrder(
  orderId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!BACKEND_URL) return { ok: false, error: noBackend().error }
  try {
    const res = await fetch(`${BACKEND_URL}/charge/${orderId}/cancel`, { method: 'POST' })
    if (res.ok) return { ok: true }
    const data: any = await res.json().catch(() => ({}))
    const msg = data?.errors?.[0]?.message || data?.error || `Error ${res.status}`
    return { ok: false, error: msg }
  } catch {
    return { ok: false, error: 'Sin conexión a internet.' }
  }
}
