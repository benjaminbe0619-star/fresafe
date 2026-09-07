import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? ''

export type Product = {
  id: string
  name: string
  priceCents: number
  costCents: number
  imageDataUrl?: string | null
  position?: number
  category?: string | null
  owner?: 'propio' | 'paletero'
  active?: boolean
}

export type CartItem = {
  productId: string
  qty: number
}

export type SaleItem = {
  productId: string
  name: string
  qty: number
  priceCents: number
  costCents: number
  owner?: 'propio' | 'paletero'
  // Lo que le corresponde al paletero por este renglón (snapshot al momento de la venta)
  paleteroCents?: number
}

export type Channel = 'mostrador' | 'rappi' | 'uber'

export type Sale = {
  id: string
  timestamp: number
  items: SaleItem[]
  totalCents: number
  // 'app' = pedido pagado dentro de Rappi / Uber Eats
  method: 'efectivo' | 'tarjeta' | 'app'
  receivedCents: number
  changeCents: number
  denominations?: { id?: string; cents: number; qty: number }[] | null
  mpOrderId?: string | null
  commissionCents?: number | null
  channel?: Channel
  channelFeeCents?: number | null
  // Venta devuelta al cliente (reembolso total en MP): se conserva pero no cuenta
  refunded?: boolean
  isLate?: boolean
}

export type RecordKind =
  | 'gasto-fijo'
  | 'gasto'
  | 'merma'
  | 'socio-mov'
  | 'paletero-pago'
  | 'empleado'
  | 'sueldo-pago'
  | 'sueldo-adelanto'
  | 'corte'

// data por tipo:
//  gasto-fijo      { name, amountCents, active }            — mensual, se prorratea
//  gasto           { name, amountCents, category? }         — variable, ts = fecha
//  merma           { name, qty, costCents, reason }         — ts = fecha
//  socio-mov       { type: 'prestamo'|'aportacion'|'pago-prestamo'|'pago-ganancia',
//                    concept, amountCents }                 — ts = fecha
//  paletero-pago   { amountCents, note }                    — ts = fecha
//  empleado        { name, role, salaryCents,
//                    frequency: 'semanal'|'quincenal'|'mensual', active }
//                    — el sueldo cuenta como gasto fijo prorrateado desde ts
//  sueldo-pago     { employeeId, amountCents, esAbonoAdelanto? } — ts = fecha
//  sueldo-adelanto { employeeId, amountCents, concept }     — ts = fecha
//  corte           { expectedCents, countedCents, note? }   — cierre de caja, ts = fecha
export type RecordItem = {
  id: string
  kind: RecordKind
  ts: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
}

export type Settings = {
  partner: {
    name: string
    percent: number
    base: 'neta' | 'bruta' | 'ventas'
    frequency: 'semanal' | 'mensual'
    cutWeekday: number // 0=domingo … 6=sábado (si frequency = semanal)
    cutMonthday: number // 1–28 (si frequency = mensual)
  }
  paletero: {
    name: string
    fresafePercent: number // % del precio de cada paleta que se queda FresaFé
  }
  channels: {
    rappiPercent: number
    uberPercent: number
    rappiEnabled: boolean
    uberEnabled: boolean
  }
}

export const DEFAULT_SETTINGS: Settings = {
  partner: {
    name: 'Socio',
    percent: 20,
    base: 'neta',
    frequency: 'semanal',
    cutWeekday: 1,
    cutMonthday: 1,
  },
  paletero: { name: 'Paletero', fresafePercent: 20 },
  channels: { rappiPercent: 30, uberPercent: 30, rappiEnabled: true, uberEnabled: true },
}

export function mergeSettings(raw: unknown): Settings {
  const r = (raw ?? {}) as Partial<Settings>
  return {
    partner: { ...DEFAULT_SETTINGS.partner, ...(r.partner ?? {}) },
    paletero: { ...DEFAULT_SETTINGS.paletero, ...(r.paletero ?? {}) },
    channels: { ...DEFAULT_SETTINGS.channels, ...(r.channels ?? {}) },
  }
}

type Store = {
  products: Product[]
  cart: CartItem[]
  sales: Sale[]
  records: RecordItem[]
  settings: Settings
  investmentCents: number
  changeFundCents: number
  cardCommissionPercent: number

  loading: boolean
  lastSyncAt: number
  syncError: string | null

  syncFromServer: () => Promise<void>

  addProduct: (p: Omit<Product, 'id'>) => Promise<void>
  updateProduct: (id: string, patch: Partial<Omit<Product, 'id'>>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>

  addToCart: (productId: string) => void
  setCartQty: (productId: string, qty: number) => void
  removeFromCart: (productId: string) => void
  clearCart: () => void

  addSale: (sale: Omit<Sale, 'id' | 'timestamp'>) => Promise<Sale | null>
  deleteSale: (id: string) => Promise<void>
  refundSale: (id: string) => Promise<{ ok: boolean; error?: string }>

  addRecord: (kind: RecordKind, data: RecordItem['data'], ts?: number) => Promise<void>
  updateRecord: (id: string, patch: { ts?: number; data?: RecordItem['data'] }) => Promise<void>
  deleteRecord: (id: string) => Promise<void>

  saveSettings: (next: Settings) => Promise<void>

  setInvestmentCents: (c: number) => Promise<void>
  setChangeFundCents: (c: number) => Promise<void>
  setCardCommissionPercent: (p: number) => Promise<void>
}

const uid = (): string => Math.random().toString(36).slice(2) + Date.now().toString(36)

async function api(path: string, init?: RequestInit): Promise<Response> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${BACKEND_URL}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      })
      if (res.ok) return res
      if (res.status >= 400 && res.status < 500) return res
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (e) {
      lastErr = e
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
  }
  throw lastErr instanceof Error ? lastErr : new Error('Network error')
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      products: [],
      cart: [],
      sales: [],
      records: [],
      settings: DEFAULT_SETTINGS,
      investmentCents: 0,
      changeFundCents: 0,
      cardCommissionPercent: 4.06,
      loading: true,
      lastSyncAt: 0,
      syncError: null,

      syncFromServer: async () => {
        try {
          const res = await api('/data')
          if (!res.ok) {
            set({ syncError: `Error ${res.status} al sincronizar` })
            return
          }
          const data = (await res.json()) as {
            products: Product[]
            sales: Sale[]
            records?: RecordItem[]
            settings?: unknown
            investmentCents: number
            changeFundCents: number
            cardCommissionPercent: number
          }
          set({
            products: data.products ?? [],
            sales: data.sales ?? [],
            records: data.records ?? [],
            settings: mergeSettings(data.settings),
            investmentCents: data.investmentCents ?? 0,
            changeFundCents: data.changeFundCents ?? 0,
            cardCommissionPercent: data.cardCommissionPercent ?? 4.06,
            loading: false,
            lastSyncAt: Date.now(),
            syncError: null,
          })
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'unknown'
          set({ syncError: `Sin conexión (${msg})`, loading: false })
        }
      },

      addProduct: async (p) => {
        const tempId = uid()
        const optimistic: Product = { id: tempId, ...p }
        set((s) => ({ products: [...s.products, optimistic] }))
        try {
          const res = await api('/products', { method: 'POST', body: JSON.stringify(p) })
          if (!res.ok) throw new Error('Failed')
          const created = (await res.json()) as Product
          set((s) => ({
            products: s.products.map((x) => (x.id === tempId ? created : x)),
          }))
        } catch (e) {
          set((s) => ({ products: s.products.filter((x) => x.id !== tempId) }))
          throw e
        }
      },

      updateProduct: async (id, patch) => {
        const prev = get().products.find((p) => p.id === id)
        set((s) => ({
          products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }))
        try {
          const res = await api(`/products/${id}`, {
            method: 'PUT',
            body: JSON.stringify(patch),
          })
          if (!res.ok) throw new Error('Failed')
          const updated = (await res.json()) as Product
          if (updated)
            set((s) => ({
              products: s.products.map((p) => (p.id === id ? updated : p)),
            }))
        } catch (e) {
          if (prev) {
            set((s) => ({
              products: s.products.map((p) => (p.id === id ? prev : p)),
            }))
          }
          throw e
        }
      },

      deleteProduct: async (id) => {
        const prev = get().products
        set((s) => ({
          products: s.products.filter((p) => p.id !== id),
          cart: s.cart.filter((c) => c.productId !== id),
        }))
        try {
          await api(`/products/${id}`, { method: 'DELETE' })
        } catch (e) {
          set({ products: prev })
          throw e
        }
      },

      addToCart: (productId) =>
        set((s) => {
          const existing = s.cart.find((c) => c.productId === productId)
          if (existing) {
            return {
              cart: s.cart.map((c) =>
                c.productId === productId ? { ...c, qty: c.qty + 1 } : c,
              ),
            }
          }
          return { cart: [...s.cart, { productId, qty: 1 }] }
        }),
      setCartQty: (productId, qty) =>
        set((s) => ({
          cart:
            qty <= 0
              ? s.cart.filter((c) => c.productId !== productId)
              : s.cart.map((c) => (c.productId === productId ? { ...c, qty } : c)),
        })),
      removeFromCart: (productId) =>
        set((s) => ({ cart: s.cart.filter((c) => c.productId !== productId) })),
      clearCart: () => set({ cart: [] }),

      addSale: async (sale) => {
        if (sale.mpOrderId) {
          const existing = get().sales.find((x) => x.mpOrderId === sale.mpOrderId)
          if (existing) return existing
        }
        const id = uid()
        const timestamp = Date.now()
        const full: Sale = { ...sale, id, timestamp } as Sale
        set((s) => ({ sales: [full, ...s.sales] }))
        try {
          const res = await api('/sales', {
            method: 'POST',
            body: JSON.stringify(full),
          })
          if (!res.ok) throw new Error('Failed')
          const created = (await res.json()) as Sale | { error: string }
          if (created && !('error' in created)) {
            set((s) => ({
              sales: s.sales.map((x) => (x.id === id ? (created as Sale) : x)),
            }))
            return created as Sale
          }
          return full
        } catch (e) {
          console.error('addSale failed; keeping local copy', e)
          return full
        }
      },

      deleteSale: async (id) => {
        const prev = get().sales
        set((s) => ({ sales: s.sales.filter((x) => x.id !== id) }))
        try {
          await api(`/sales/${id}`, { method: 'DELETE' })
        } catch (e) {
          set({ sales: prev })
          throw e
        }
      },

      // Reembolso total en Mercado Pago; solo marca la venta si MP lo acepta.
      refundSale: async (id) => {
        try {
          const res = await api(`/sales/${id}/refund`, { method: 'POST' })
          const data = (await res.json()) as Sale & { error?: string }
          if (!res.ok || data.error) {
            return { ok: false, error: data.error ?? `Error ${res.status}` }
          }
          set((s) => ({ sales: s.sales.map((x) => (x.id === id ? data : x)) }))
          return { ok: true }
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'Sin conexión' }
        }
      },

      addRecord: async (kind, data, ts) => {
        const tempId = uid()
        const optimistic: RecordItem = { id: tempId, kind, ts: ts ?? Date.now(), data }
        set((s) => ({ records: [optimistic, ...s.records] }))
        try {
          const res = await api('/records', {
            method: 'POST',
            body: JSON.stringify({ kind, ts: optimistic.ts, data }),
          })
          if (!res.ok) throw new Error('Failed')
          const created = (await res.json()) as RecordItem
          set((s) => ({
            records: s.records.map((r) => (r.id === tempId ? created : r)),
          }))
        } catch (e) {
          set((s) => ({ records: s.records.filter((r) => r.id !== tempId) }))
          throw e
        }
      },

      updateRecord: async (id, patch) => {
        const prev = get().records.find((r) => r.id === id)
        set((s) => ({
          records: s.records.map((r) =>
            r.id === id
              ? { ...r, ts: patch.ts ?? r.ts, data: patch.data ?? r.data }
              : r,
          ),
        }))
        try {
          const res = await api(`/records/${id}`, {
            method: 'PUT',
            body: JSON.stringify(patch),
          })
          if (!res.ok) throw new Error('Failed')
        } catch (e) {
          if (prev) {
            set((s) => ({ records: s.records.map((r) => (r.id === id ? prev : r)) }))
          }
          throw e
        }
      },

      deleteRecord: async (id) => {
        const prev = get().records
        set((s) => ({ records: s.records.filter((r) => r.id !== id) }))
        try {
          await api(`/records/${id}`, { method: 'DELETE' })
        } catch (e) {
          set({ records: prev })
          throw e
        }
      },

      saveSettings: async (next) => {
        const prev = get().settings
        set({ settings: next })
        try {
          const res = await api('/config', {
            method: 'PUT',
            body: JSON.stringify({ settings: next }),
          })
          if (!res.ok) throw new Error('Failed')
        } catch (e) {
          set({ settings: prev })
          throw e
        }
      },

      setInvestmentCents: async (c) => {
        const safe = Math.max(0, c)
        set({ investmentCents: safe })
        try {
          await api('/config', {
            method: 'PUT',
            body: JSON.stringify({ investmentCents: safe }),
          })
        } catch (e) {
          console.error('setInvestmentCents failed', e)
        }
      },
      setChangeFundCents: async (c) => {
        const safe = Math.max(0, c)
        set({ changeFundCents: safe })
        try {
          await api('/config', {
            method: 'PUT',
            body: JSON.stringify({ changeFundCents: safe }),
          })
        } catch (e) {
          console.error('setChangeFundCents failed', e)
        }
      },
      setCardCommissionPercent: async (p) => {
        const safe = Math.max(0, Math.min(100, p))
        set({ cardCommissionPercent: safe })
        try {
          await api('/config', {
            method: 'PUT',
            body: JSON.stringify({ cardCommissionPercent: safe }),
          })
        } catch (e) {
          console.error('setCardCommissionPercent failed', e)
        }
      },
    }),
    {
      name: 'abi-pos-cache-v1',
      // El caché local es solo para abrir rápido; el servidor es la fuente de verdad.
      // Si el navegador se queda sin espacio, se ignora en silencio — nunca bloquea un guardado.
      storage: createJSONStorage(() => ({
        getItem: (k: string) => {
          try {
            return localStorage.getItem(k)
          } catch {
            return null
          }
        },
        setItem: (k: string, v: string) => {
          try {
            localStorage.setItem(k, v)
          } catch {
            /* cuota llena: continuar sin caché */
          }
        },
        removeItem: (k: string) => {
          try {
            localStorage.removeItem(k)
          } catch {
            /* ignorar */
          }
        },
      })),
      partialize: (state) => ({
        // Las fotos NO se cachean (pesan demasiado); llegan del servidor al sincronizar.
        products: state.products.map((p) => ({ ...p, imageDataUrl: null })),
        sales: state.sales,
        records: state.records,
        settings: state.settings,
        investmentCents: state.investmentCents,
        changeFundCents: state.changeFundCents,
        cardCommissionPercent: state.cardCommissionPercent,
      }),
    },
  ),
)
