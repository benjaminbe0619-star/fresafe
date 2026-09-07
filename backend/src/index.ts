const MP_BASE = 'https://api.mercadopago.com'

export interface Env {
  MP_ACCESS_TOKEN: string
  MP_WEBHOOK_SECRET?: string
  TERMINAL_ID: string
  EXPIRATION_TIME: string
  LATE_CONFIRMATIONS: KVNamespace
  DB: D1Database
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const uid = (): string => Math.random().toString(36).slice(2) + Date.now().toString(36)

type Product = {
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

type SaleItem = {
  productId: string
  name: string
  qty: number
  priceCents: number
  costCents: number
  owner?: 'propio' | 'paletero'
  paleteroCents?: number
}

type Sale = {
  id: string
  timestamp: number
  totalCents: number
  method: 'efectivo' | 'tarjeta' | 'app'
  receivedCents: number
  changeCents: number
  mpOrderId?: string | null
  commissionCents?: number | null
  isLate?: boolean
  channel?: 'mostrador' | 'rappi' | 'uber'
  channelFeeCents?: number | null
  refunded?: boolean
  items: SaleItem[]
  denominations?: { id?: string; cents: number; qty: number }[] | null
}

type RecordItem = {
  id: string
  kind: string
  ts: number
  data: Record<string, unknown>
}

type ConfigData = {
  investmentCents: number
  changeFundCents: number
  cardCommissionPercent: number
  settings: Record<string, unknown> | null
}

function rowToRecord(row: any): RecordItem {
  let data: Record<string, unknown> = {}
  try {
    data = row.data_json ? JSON.parse(row.data_json) : {}
  } catch {
    data = {}
  }
  return { id: row.id, kind: row.kind, ts: row.ts, data }
}

function rowToProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    costCents: row.cost_cents ?? 0,
    imageDataUrl: row.image_data_url ?? null,
    position: row.position ?? 0,
    category: row.category ?? null,
    owner: row.owner === 'paletero' ? 'paletero' : 'propio',
    active: row.active === undefined || row.active === null ? true : !!row.active,
  }
}

function rowToSale(row: any): Sale {
  return {
    id: row.id,
    timestamp: row.ts,
    totalCents: row.total_cents,
    method: row.method,
    receivedCents: row.received_cents,
    changeCents: row.change_cents,
    mpOrderId: row.mp_order_id ?? null,
    commissionCents: row.commission_cents ?? null,
    isLate: !!row.is_late,
    channel: row.channel === 'rappi' || row.channel === 'uber' ? row.channel : 'mostrador',
    channelFeeCents: row.channel_fee_cents ?? null,
    refunded: !!row.refunded,
    items: row.items_json ? JSON.parse(row.items_json) : [],
    denominations: row.denominations_json ? JSON.parse(row.denominations_json) : null,
  }
}

async function getAllData(env: Env) {
  const [productsRes, salesRes, configRes, recordsRes] = await Promise.all([
    env.DB.prepare('SELECT * FROM products ORDER BY position ASC, name ASC').all(),
    env.DB.prepare('SELECT * FROM sales ORDER BY ts DESC').all(),
    env.DB.prepare('SELECT * FROM config').all(),
    env.DB.prepare('SELECT * FROM records ORDER BY ts DESC').all(),
  ])
  const config: Partial<ConfigData> = {}
  for (const row of configRes.results as any[]) {
    if (row.key === 'investmentCents') config.investmentCents = parseInt(row.value, 10) || 0
    else if (row.key === 'changeFundCents') config.changeFundCents = parseInt(row.value, 10) || 0
    else if (row.key === 'cardCommissionPercent')
      config.cardCommissionPercent = parseFloat(row.value) || 4.06
    else if (row.key === 'settingsJson') {
      try {
        config.settings = JSON.parse(row.value)
      } catch {
        config.settings = null
      }
    }
  }
  return {
    products: (productsRes.results as any[]).map(rowToProduct),
    sales: (salesRes.results as any[]).map(rowToSale),
    records: (recordsRes.results as any[]).map(rowToRecord),
    investmentCents: config.investmentCents ?? 0,
    changeFundCents: config.changeFundCents ?? 0,
    cardCommissionPercent: config.cardCommissionPercent ?? 4.06,
    settings: config.settings ?? null,
  }
}

async function fetchOrder(env: Env, orderId: string): Promise<any | null> {
  try {
    const r = await fetch(`${MP_BASE}/v1/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` },
    })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

function paymentIsProcessed(order: any): boolean {
  if (!order) return false
  if (order.status === 'processed') return true
  const payments = order?.transactions?.payments
  if (Array.isArray(payments)) {
    return payments.some((p: any) => p?.status === 'processed')
  }
  return false
}

function paymentAmountCents(order: any): number {
  const amount = order?.transactions?.payments?.[0]?.amount
  if (!amount) return 0
  const n = parseFloat(String(amount))
  return Number.isNaN(n) ? 0 : Math.round(n * 100)
}

async function verifyWebhookSignature(
  req: Request,
  body: string,
  secret: string,
): Promise<boolean> {
  const xSignature = req.headers.get('x-signature') || ''
  const xRequestId = req.headers.get('x-request-id') || ''

  const parts = xSignature.split(',').reduce<Record<string, string>>((acc, p) => {
    const idx = p.indexOf('=')
    if (idx > 0) {
      const k = p.slice(0, idx).trim()
      const v = p.slice(idx + 1).trim()
      if (k && v) acc[k] = v
    }
    return acc
  }, {})

  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false

  let dataId = ''
  try {
    const data = JSON.parse(body)
    dataId = String(data?.data?.id ?? '')
  } catch {
    return false
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(manifest))
  const hex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return hex === v1
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const method = req.method

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      // ================== HEALTH ==================
      if (method === 'GET' && url.pathname === '/health') {
        return json({ ok: true, terminal: env.TERMINAL_ID })
      }

      // ================== DATA SYNC ==================
      if (method === 'GET' && url.pathname === '/data') {
        const data = await getAllData(env)
        return json(data)
      }

      // ================== PRODUCTS ==================
      if (method === 'POST' && url.pathname === '/products') {
        const body = (await req.json()) as Partial<Product>
        if (!body?.name) return json({ error: 'name required' }, 400)
        const id = body.id || uid()
        const positionRow = await env.DB.prepare(
          'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM products',
        ).first<{ next: number }>()
        const position = positionRow?.next ?? 0
        await env.DB.prepare(
          'INSERT INTO products (id, name, price_cents, cost_cents, image_data_url, position, category, owner, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
          .bind(
            id,
            body.name,
            body.priceCents ?? 0,
            body.costCents ?? 0,
            body.imageDataUrl ?? null,
            position,
            body.category ?? null,
            body.owner === 'paletero' ? 'paletero' : 'propio',
            body.active === false ? 0 : 1,
          )
          .run()
        const row = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first()
        return json(rowToProduct(row))
      }

      const productMatch = url.pathname.match(/^\/products\/([^/]+)$/)
      if (productMatch) {
        const id = productMatch[1]
        if (method === 'PUT') {
          const body = (await req.json()) as Partial<Product>
          await env.DB.prepare(
            `UPDATE products SET
               name = COALESCE(?, name),
               price_cents = COALESCE(?, price_cents),
               cost_cents = COALESCE(?, cost_cents),
               image_data_url = ?,
               category = COALESCE(?, category),
               owner = COALESCE(?, owner),
               active = COALESCE(?, active),
               updated_at = strftime('%s','now') * 1000
             WHERE id = ?`,
          )
            .bind(
              body.name ?? null,
              body.priceCents ?? null,
              body.costCents ?? null,
              body.imageDataUrl !== undefined ? body.imageDataUrl : null,
              body.category !== undefined ? body.category : null,
              body.owner ?? null,
              body.active === undefined ? null : body.active ? 1 : 0,
              id,
            )
            .run()
          const row = await env.DB.prepare('SELECT * FROM products WHERE id = ?')
            .bind(id)
            .first()
          return json(row ? rowToProduct(row) : null)
        }
        if (method === 'DELETE') {
          await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run()
          return json({ ok: true })
        }
      }

      // ================== SALES ==================
      if (method === 'POST' && url.pathname === '/sales') {
        const body = (await req.json()) as Partial<Sale>
        if (!body?.totalCents || !body?.method)
          return json({ error: 'totalCents and method required' }, 400)
        const id = body.id || uid()
        const ts = body.timestamp || Date.now()
        try {
          await env.DB.prepare(
            `INSERT INTO sales (id, ts, total_cents, method, received_cents, change_cents, mp_order_id, commission_cents, is_late, channel, channel_fee_cents, items_json, denominations_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
            .bind(
              id,
              ts,
              body.totalCents,
              body.method,
              body.receivedCents ?? body.totalCents,
              body.changeCents ?? 0,
              body.mpOrderId ?? null,
              body.commissionCents ?? null,
              body.isLate ? 1 : 0,
              body.channel === 'rappi' || body.channel === 'uber' ? body.channel : 'mostrador',
              body.channelFeeCents ?? null,
              JSON.stringify(body.items ?? []),
              body.denominations ? JSON.stringify(body.denominations) : null,
            )
            .run()
        } catch (e) {
          // UNIQUE constraint on mp_order_id — skip duplicate
          if (String(e).includes('UNIQUE')) {
            const existing = await env.DB.prepare(
              'SELECT * FROM sales WHERE mp_order_id = ?',
            )
              .bind(body.mpOrderId)
              .first()
            return json(existing ? rowToSale(existing) : { error: 'duplicate' }, 200)
          }
          throw e
        }
        const row = await env.DB.prepare('SELECT * FROM sales WHERE id = ?').bind(id).first()
        return json(row ? rowToSale(row) : null)
      }

      const saleMatch = url.pathname.match(/^\/sales\/([^/]+)$/)
      if (saleMatch && method === 'DELETE') {
        const id = saleMatch[1]
        await env.DB.prepare('DELETE FROM sales WHERE id = ?').bind(id).run()
        return json({ ok: true })
      }

      // Devolución total de una venta con tarjeta: reembolsa en MP y marca la venta.
      const refundMatch = url.pathname.match(/^\/sales\/([^/]+)\/refund$/)
      if (refundMatch && method === 'POST') {
        const id = refundMatch[1]
        const row = await env.DB.prepare('SELECT * FROM sales WHERE id = ?').bind(id).first()
        if (!row) return json({ error: 'Venta no encontrada' }, 404)
        if ((row as any).refunded) return json({ error: 'Esta venta ya fue devuelta' }, 400)
        const mpOrderId = (row as any).mp_order_id
        if (!mpOrderId) {
          return json(
            { error: 'Esta venta no tiene un pago de Mercado Pago asociado (solo se pueden devolver cobros con tarjeta).' },
            400,
          )
        }
        const res = await fetch(`${MP_BASE}/v1/orders/${mpOrderId}/refund`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
            'X-Idempotency-Key': crypto.randomUUID(),
            'Content-Type': 'application/json',
          },
        })
        const data = (await res.json().catch(() => ({}))) as any
        if (!res.ok) {
          const msg =
            data?.errors?.[0]?.message || data?.message || `Mercado Pago rechazó la devolución (HTTP ${res.status})`
          return json({ error: msg }, res.status)
        }
        await env.DB.prepare('UPDATE sales SET refunded = 1 WHERE id = ?').bind(id).run()
        const updated = await env.DB.prepare('SELECT * FROM sales WHERE id = ?').bind(id).first()
        return json(updated ? rowToSale(updated) : { ok: true })
      }

      // ================== CONFIG ==================
      if (method === 'PUT' && url.pathname === '/config') {
        const body = (await req.json()) as Partial<ConfigData>
        const stmts: D1PreparedStatement[] = []
        const set = (k: string, v: string) =>
          env.DB.prepare(
            'INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          ).bind(k, v)
        if (body.investmentCents !== undefined)
          stmts.push(set('investmentCents', String(body.investmentCents)))
        if (body.changeFundCents !== undefined)
          stmts.push(set('changeFundCents', String(body.changeFundCents)))
        if (body.cardCommissionPercent !== undefined)
          stmts.push(set('cardCommissionPercent', String(body.cardCommissionPercent)))
        if (body.settings !== undefined)
          stmts.push(set('settingsJson', JSON.stringify(body.settings ?? {})))
        if (stmts.length > 0) await env.DB.batch(stmts)
        const data = await getAllData(env)
        return json({
          investmentCents: data.investmentCents,
          changeFundCents: data.changeFundCents,
          cardCommissionPercent: data.cardCommissionPercent,
          settings: data.settings,
        })
      }

      // ================== RECORDS ==================
      if (method === 'POST' && url.pathname === '/records') {
        const body = (await req.json()) as Partial<RecordItem>
        if (!body?.kind) return json({ error: 'kind required' }, 400)
        const id = body.id || uid()
        const ts = body.ts || Date.now()
        await env.DB.prepare(
          'INSERT INTO records (id, kind, ts, data_json) VALUES (?, ?, ?, ?)',
        )
          .bind(id, body.kind, ts, JSON.stringify(body.data ?? {}))
          .run()
        const row = await env.DB.prepare('SELECT * FROM records WHERE id = ?').bind(id).first()
        return json(row ? rowToRecord(row) : null)
      }

      const recordMatch = url.pathname.match(/^\/records\/([^/]+)$/)
      if (recordMatch) {
        const id = recordMatch[1]
        if (method === 'PUT') {
          const body = (await req.json()) as Partial<RecordItem>
          await env.DB.prepare(
            `UPDATE records SET
               ts = COALESCE(?, ts),
               data_json = COALESCE(?, data_json),
               updated_at = strftime('%s','now') * 1000
             WHERE id = ?`,
          )
            .bind(body.ts ?? null, body.data !== undefined ? JSON.stringify(body.data) : null, id)
            .run()
          const row = await env.DB.prepare('SELECT * FROM records WHERE id = ?')
            .bind(id)
            .first()
          return json(row ? rowToRecord(row) : null)
        }
        if (method === 'DELETE') {
          await env.DB.prepare('DELETE FROM records WHERE id = ?').bind(id).run()
          return json({ ok: true })
        }
      }

      // ================== ADMIN: SEED ==================
      if (method === 'POST' && url.pathname === '/admin/seed') {
        const body = (await req.json()) as {
          products?: Product[]
          sales?: Sale[]
          investmentCents?: number
          changeFundCents?: number
          cardCommissionPercent?: number
          wipe?: boolean
        }
        if (body.wipe) {
          await env.DB.batch([
            env.DB.prepare('DELETE FROM products'),
            env.DB.prepare('DELETE FROM sales'),
            env.DB.prepare('DELETE FROM config'),
          ])
        }
        let pInserted = 0
        let sInserted = 0
        if (body.products) {
          for (let i = 0; i < body.products.length; i++) {
            const p = body.products[i]
            await env.DB.prepare(
              'INSERT OR REPLACE INTO products (id, name, price_cents, cost_cents, image_data_url, position) VALUES (?, ?, ?, ?, ?, ?)',
            )
              .bind(
                p.id,
                p.name,
                p.priceCents,
                p.costCents,
                p.imageDataUrl ?? null,
                p.position ?? i,
              )
              .run()
            pInserted++
          }
        }
        if (body.sales) {
          for (const s of body.sales) {
            await env.DB.prepare(
              `INSERT OR REPLACE INTO sales (id, ts, total_cents, method, received_cents, change_cents, mp_order_id, commission_cents, is_late, items_json, denominations_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
              .bind(
                s.id,
                s.timestamp,
                s.totalCents,
                s.method,
                s.receivedCents,
                s.changeCents,
                s.mpOrderId ?? null,
                s.commissionCents ?? null,
                s.isLate ? 1 : 0,
                JSON.stringify(s.items ?? []),
                s.denominations ? JSON.stringify(s.denominations) : null,
              )
              .run()
            sInserted++
          }
        }
        const cfg: D1PreparedStatement[] = []
        const setCfg = (k: string, v: string) =>
          env.DB.prepare(
            'INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          ).bind(k, v)
        if (body.investmentCents !== undefined)
          cfg.push(setCfg('investmentCents', String(body.investmentCents)))
        if (body.changeFundCents !== undefined)
          cfg.push(setCfg('changeFundCents', String(body.changeFundCents)))
        if (body.cardCommissionPercent !== undefined)
          cfg.push(setCfg('cardCommissionPercent', String(body.cardCommissionPercent)))
        if (cfg.length) await env.DB.batch(cfg)
        return json({ ok: true, productsInserted: pInserted, salesInserted: sInserted })
      }

      // ================== MP CHARGE FLOW ==================
      if (method === 'POST' && url.pathname === '/charge') {
        const body = (await req.json()) as {
          amount?: string
          externalRef?: string
          items?: Array<{ name: string; qty: number; priceCents: number; costCents?: number }>
        }
        if (!body?.amount) {
          return json({ error: 'amount is required' }, 400)
        }

        const idemKey = crypto.randomUUID()
        const externalRef = body.externalRef ?? `pos-${Date.now()}`

        const res = await fetch(`${MP_BASE}/v1/orders`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
            'X-Idempotency-Key': idemKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'point',
            external_reference: externalRef,
            expiration_time: env.EXPIRATION_TIME,
            transactions: { payments: [{ amount: body.amount }] },
            config: {
              point: {
                terminal_id: env.TERMINAL_ID,
                print_on_terminal: 'no_ticket',
              },
              payment_method: { default_type: 'credit_card' },
            },
          }),
        })

        const data = (await res.json()) as any
        if (res.ok && data?.id && body.items?.length) {
          await env.LATE_CONFIRMATIONS.put(
            'items:' + data.id,
            JSON.stringify(body.items),
            { expirationTtl: 60 * 60 * 24 },
          )
        }
        return json(data, res.status)
      }

      const cancelMatch = url.pathname.match(/^\/charge\/(ORD[\w]+)\/cancel$/)
      if (method === 'POST' && cancelMatch) {
        const orderId = cancelMatch[1]
        const res = await fetch(`${MP_BASE}/v1/orders/${orderId}/cancel`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
            'X-Idempotency-Key': crypto.randomUUID(),
            'Content-Type': 'application/json',
          },
        })
        const data = await res.json()
        return json(data, res.status)
      }

      const orderMatch = url.pathname.match(/^\/charge\/(ORD[\w]+)$/)
      if (method === 'GET' && orderMatch) {
        const orderId = orderMatch[1]
        const res = await fetch(`${MP_BASE}/v1/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` },
        })
        const data = await res.json()
        return json(data, res.status)
      }

      // ================== LATE CONFIRMATIONS ==================
      if (method === 'GET' && url.pathname === '/late-confirmations') {
        const list = await env.LATE_CONFIRMATIONS.list({ prefix: 'late:' })
        const entries: any[] = []
        for (const k of list.keys) {
          const v = await env.LATE_CONFIRMATIONS.get(k.name, 'json')
          if (v) entries.push(v)
        }
        return json({ confirmations: entries })
      }

      const ackMatch = url.pathname.match(/^\/late-confirmations\/(ORD[\w]+)\/ack$/)
      if (method === 'POST' && ackMatch) {
        const orderId = ackMatch[1]
        await env.LATE_CONFIRMATIONS.delete('late:' + orderId)
        await env.LATE_CONFIRMATIONS.delete('items:' + orderId)
        return json({ ok: true })
      }

      // ================== WEBHOOK ==================
      if (method === 'POST' && url.pathname === '/webhook') {
        const text = await req.text()
        console.log('[webhook]', text)

        if (env.MP_WEBHOOK_SECRET) {
          const valid = await verifyWebhookSignature(req, text, env.MP_WEBHOOK_SECRET)
          if (!valid) {
            console.warn('[webhook] invalid signature')
            return new Response('Invalid signature', { status: 401, headers: corsHeaders })
          }
        }

        try {
          const data: any = JSON.parse(text)
          let orderId: string | undefined =
            data?.data?.id ||
            (typeof data?.resource === 'string' ? data.resource.split('/').pop() : undefined) ||
            data?.id
          if (typeof orderId === 'string' && orderId.startsWith('ORD')) {
            const order = await fetchOrder(env, orderId)
            if (order && paymentIsProcessed(order)) {
              const items = await env.LATE_CONFIRMATIONS.get<any[]>(
                'items:' + orderId,
                'json',
              )
              const lateRecord = {
                orderId,
                amountCents: paymentAmountCents(order),
                externalReference: order?.external_reference,
                confirmedAt: Date.now(),
                items: items ?? undefined,
              }
              await env.LATE_CONFIRMATIONS.put(
                'late:' + orderId,
                JSON.stringify(lateRecord),
                { expirationTtl: 60 * 60 * 24 * 7 },
              )
            }
          }
        } catch (e) {
          console.error('[webhook] parse error', e)
        }

        return new Response('OK', { status: 200, headers: corsHeaders })
      }

      return json({ error: 'Not found', path: url.pathname }, 404)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      return json({ error: msg }, 500)
    }
  },
}
