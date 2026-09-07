// Backend de FresaFé — port del Cloudflare Worker a Node + PostgreSQL (Render).
import express from 'express'
import crypto from 'node:crypto'
import pg from 'pg'

const {
  DATABASE_URL,
  MP_ACCESS_TOKEN,
  MP_WEBHOOK_SECRET,
  TERMINAL_ID,
  EXPIRATION_TIME = 'PT3M',
  PORT = 10000,
} = process.env

const MP_BASE = 'https://api.mercadopago.com'

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL?.includes('render.com') || DATABASE_URL?.includes('sslmode')
    ? { rejectUnauthorized: false }
    : undefined,
})

const q = (text, params = []) => pool.query(text, params)
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

// ---------- esquema ----------
async function ensureSchema() {
  await q(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      cost_cents INTEGER NOT NULL DEFAULT 0,
      image_data_url TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      category TEXT,
      owner TEXT NOT NULL DEFAULT 'propio',
      active INTEGER NOT NULL DEFAULT 1,
      updated_at BIGINT NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      ts BIGINT NOT NULL,
      total_cents INTEGER NOT NULL,
      method TEXT NOT NULL,
      received_cents INTEGER NOT NULL,
      change_cents INTEGER NOT NULL,
      mp_order_id TEXT UNIQUE,
      commission_cents INTEGER,
      is_late INTEGER DEFAULT 0,
      channel TEXT NOT NULL DEFAULT 'mostrador',
      channel_fee_cents INTEGER,
      refunded INTEGER NOT NULL DEFAULT 0,
      items_json TEXT NOT NULL,
      denominations_json TEXT
    );
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      ts BIGINT NOT NULL,
      data_json TEXT NOT NULL,
      updated_at BIGINT NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at BIGINT
    );
    CREATE INDEX IF NOT EXISTS idx_sales_ts ON sales (ts DESC);
    CREATE INDEX IF NOT EXISTS idx_records_kind_ts ON records (kind, ts DESC);
  `)
}

// ---------- KV (confirmaciones tardías) ----------
async function kvGet(key) {
  const { rows } = await q('SELECT value, expires_at FROM kv_store WHERE key = $1', [key])
  if (!rows[0]) return null
  if (rows[0].expires_at && Number(rows[0].expires_at) < Date.now()) {
    await q('DELETE FROM kv_store WHERE key = $1', [key])
    return null
  }
  try {
    return JSON.parse(rows[0].value)
  } catch {
    return null
  }
}
async function kvPut(key, value, ttlSeconds) {
  const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null
  await q(
    `INSERT INTO kv_store (key, value, expires_at) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
    [key, JSON.stringify(value), expiresAt],
  )
}
async function kvDelete(key) {
  await q('DELETE FROM kv_store WHERE key = $1', [key])
}
async function kvListPrefix(prefix) {
  const { rows } = await q(
    'SELECT value, expires_at FROM kv_store WHERE key LIKE $1',
    [prefix + '%'],
  )
  const out = []
  for (const r of rows) {
    if (r.expires_at && Number(r.expires_at) < Date.now()) continue
    try {
      out.push(JSON.parse(r.value))
    } catch {
      /* ignorar */
    }
  }
  return out
}

// ---------- mapeo filas ----------
const rowToProduct = (r) => ({
  id: r.id,
  name: r.name,
  priceCents: r.price_cents,
  costCents: r.cost_cents ?? 0,
  imageDataUrl: r.image_data_url ?? null,
  position: r.position ?? 0,
  category: r.category ?? null,
  owner: r.owner === 'paletero' ? 'paletero' : 'propio',
  active: r.active === undefined || r.active === null ? true : !!r.active,
})

const rowToSale = (r) => ({
  id: r.id,
  timestamp: Number(r.ts),
  totalCents: r.total_cents,
  method: r.method,
  receivedCents: r.received_cents,
  changeCents: r.change_cents,
  mpOrderId: r.mp_order_id ?? null,
  commissionCents: r.commission_cents ?? null,
  isLate: !!r.is_late,
  channel: r.channel === 'rappi' || r.channel === 'uber' ? r.channel : 'mostrador',
  channelFeeCents: r.channel_fee_cents ?? null,
  refunded: !!r.refunded,
  items: r.items_json ? JSON.parse(r.items_json) : [],
  denominations: r.denominations_json ? JSON.parse(r.denominations_json) : null,
})

const rowToRecord = (r) => {
  let data = {}
  try {
    data = r.data_json ? JSON.parse(r.data_json) : {}
  } catch {
    data = {}
  }
  return { id: r.id, kind: r.kind, ts: Number(r.ts), data }
}

async function getAllData() {
  const [products, sales, config, records] = await Promise.all([
    q('SELECT * FROM products ORDER BY position ASC, name ASC'),
    q('SELECT * FROM sales ORDER BY ts DESC'),
    q('SELECT * FROM config'),
    q('SELECT * FROM records ORDER BY ts DESC'),
  ])
  const cfg = {}
  for (const row of config.rows) {
    if (row.key === 'investmentCents') cfg.investmentCents = parseInt(row.value, 10) || 0
    else if (row.key === 'changeFundCents') cfg.changeFundCents = parseInt(row.value, 10) || 0
    else if (row.key === 'cardCommissionPercent') cfg.cardCommissionPercent = parseFloat(row.value) || 4.06
    else if (row.key === 'settingsJson') {
      try {
        cfg.settings = JSON.parse(row.value)
      } catch {
        cfg.settings = null
      }
    }
  }
  return {
    products: products.rows.map(rowToProduct),
    sales: sales.rows.map(rowToSale),
    records: records.rows.map(rowToRecord),
    investmentCents: cfg.investmentCents ?? 0,
    changeFundCents: cfg.changeFundCents ?? 0,
    cardCommissionPercent: cfg.cardCommissionPercent ?? 4.06,
    settings: cfg.settings ?? null,
  }
}

// ---------- Mercado Pago ----------
async function fetchOrder(orderId) {
  try {
    const r = await fetch(`${MP_BASE}/v1/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

const paymentIsProcessed = (order) => {
  if (!order) return false
  if (order.status === 'processed') return true
  const payments = order?.transactions?.payments
  return Array.isArray(payments) && payments.some((p) => p?.status === 'processed')
}

const paymentAmountCents = (order) => {
  const amount = order?.transactions?.payments?.[0]?.amount
  if (!amount) return 0
  const n = parseFloat(String(amount))
  return Number.isNaN(n) ? 0 : Math.round(n * 100)
}

function verifyWebhookSignature(req, body, secret) {
  const xSignature = req.headers['x-signature'] || ''
  const xRequestId = req.headers['x-request-id'] || ''
  const parts = String(xSignature)
    .split(',')
    .reduce((acc, p) => {
      const idx = p.indexOf('=')
      if (idx > 0) acc[p.slice(0, idx).trim()] = p.slice(idx + 1).trim()
      return acc
    }, {})
  const { ts, v1 } = parts
  if (!ts || !v1) return false
  let dataId = ''
  try {
    dataId = String(JSON.parse(body)?.data?.id ?? '')
  } catch {
    return false
  }
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const hex = crypto.createHmac('sha256', secret).update(manifest).digest('hex')
  return hex === v1
}

// ---------- app ----------
const app = express()
// Se guarda el cuerpo crudo para poder validar la firma HMAC del webhook de MP.
app.use(
  express.json({
    limit: '15mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8')
    },
  }),
)
app.use((req, res, next) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  })
  if (req.method === 'OPTIONS') return res.status(204).end()
  next()
})

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'unknown error' })
  })

app.get('/health', (_req, res) => res.json({ ok: true, terminal: TERMINAL_ID }))

app.get('/data', wrap(async (_req, res) => res.json(await getAllData())))

// ---------- productos ----------
app.post('/products', wrap(async (req, res) => {
  const body = req.body ?? {}
  if (!body.name) return res.status(400).json({ error: 'name required' })
  const id = body.id || uid()
  const posRow = await q('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM products')
  await q(
    `INSERT INTO products (id, name, price_cents, cost_cents, image_data_url, position, category, owner, active, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      body.name,
      body.priceCents ?? 0,
      body.costCents ?? 0,
      body.imageDataUrl ?? null,
      posRow.rows[0].next ?? 0,
      body.category ?? null,
      body.owner === 'paletero' ? 'paletero' : 'propio',
      body.active === false ? 0 : 1,
      Date.now(),
    ],
  )
  const { rows } = await q('SELECT * FROM products WHERE id = $1', [id])
  res.json(rowToProduct(rows[0]))
}))

app.put('/products/:id', wrap(async (req, res) => {
  const body = req.body ?? {}
  await q(
    `UPDATE products SET
       name = COALESCE($1, name),
       price_cents = COALESCE($2, price_cents),
       cost_cents = COALESCE($3, cost_cents),
       image_data_url = $4,
       category = COALESCE($5, category),
       owner = COALESCE($6, owner),
       active = COALESCE($7, active),
       updated_at = $8
     WHERE id = $9`,
    [
      body.name ?? null,
      body.priceCents ?? null,
      body.costCents ?? null,
      body.imageDataUrl !== undefined ? body.imageDataUrl : null,
      body.category !== undefined ? body.category : null,
      body.owner ?? null,
      body.active === undefined ? null : body.active ? 1 : 0,
      Date.now(),
      req.params.id,
    ],
  )
  const { rows } = await q('SELECT * FROM products WHERE id = $1', [req.params.id])
  res.json(rows[0] ? rowToProduct(rows[0]) : null)
}))

app.delete('/products/:id', wrap(async (req, res) => {
  await q('DELETE FROM products WHERE id = $1', [req.params.id])
  res.json({ ok: true })
}))

// ---------- ventas ----------
app.post('/sales', wrap(async (req, res) => {
  const body = req.body ?? {}
  if (!body.totalCents || !body.method)
    return res.status(400).json({ error: 'totalCents and method required' })
  const id = body.id || uid()
  const ts = body.timestamp || Date.now()
  try {
    await q(
      `INSERT INTO sales (id, ts, total_cents, method, received_cents, change_cents, mp_order_id, commission_cents, is_late, channel, channel_fee_cents, items_json, denominations_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
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
      ],
    )
  } catch (e) {
    if (String(e).includes('duplicate') || String(e).includes('unique')) {
      const { rows } = await q('SELECT * FROM sales WHERE mp_order_id = $1', [body.mpOrderId])
      return res.json(rows[0] ? rowToSale(rows[0]) : { error: 'duplicate' })
    }
    throw e
  }
  const { rows } = await q('SELECT * FROM sales WHERE id = $1', [id])
  res.json(rows[0] ? rowToSale(rows[0]) : null)
}))

app.delete('/sales/:id', wrap(async (req, res) => {
  await q('DELETE FROM sales WHERE id = $1', [req.params.id])
  res.json({ ok: true })
}))

// Devolución total: reembolsa en MP y marca la venta.
app.post('/sales/:id/refund', wrap(async (req, res) => {
  const { rows } = await q('SELECT * FROM sales WHERE id = $1', [req.params.id])
  const row = rows[0]
  if (!row) return res.status(404).json({ error: 'Venta no encontrada' })
  if (row.refunded) return res.status(400).json({ error: 'Esta venta ya fue devuelta' })
  if (!row.mp_order_id)
    return res.status(400).json({
      error: 'Esta venta no tiene un pago de Mercado Pago asociado (solo se pueden devolver cobros con tarjeta).',
    })
  const r = await fetch(`${MP_BASE}/v1/orders/${row.mp_order_id}/refund`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      'X-Idempotency-Key': crypto.randomUUID(),
      'Content-Type': 'application/json',
    },
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = data?.errors?.[0]?.message || data?.message || `Mercado Pago rechazó la devolución (HTTP ${r.status})`
    return res.status(r.status).json({ error: msg })
  }
  await q('UPDATE sales SET refunded = 1 WHERE id = $1', [req.params.id])
  const updated = await q('SELECT * FROM sales WHERE id = $1', [req.params.id])
  res.json(updated.rows[0] ? rowToSale(updated.rows[0]) : { ok: true })
}))

// ---------- config ----------
app.put('/config', wrap(async (req, res) => {
  const body = req.body ?? {}
  const set = (k, v) =>
    q(
      `INSERT INTO config (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [k, v],
    )
  if (body.investmentCents !== undefined) await set('investmentCents', String(body.investmentCents))
  if (body.changeFundCents !== undefined) await set('changeFundCents', String(body.changeFundCents))
  if (body.cardCommissionPercent !== undefined)
    await set('cardCommissionPercent', String(body.cardCommissionPercent))
  if (body.settings !== undefined) await set('settingsJson', JSON.stringify(body.settings ?? {}))
  const data = await getAllData()
  res.json({
    investmentCents: data.investmentCents,
    changeFundCents: data.changeFundCents,
    cardCommissionPercent: data.cardCommissionPercent,
    settings: data.settings,
  })
}))

// ---------- records ----------
app.post('/records', wrap(async (req, res) => {
  const body = req.body ?? {}
  if (!body.kind) return res.status(400).json({ error: 'kind required' })
  const id = body.id || uid()
  const ts = body.ts || Date.now()
  await q('INSERT INTO records (id, kind, ts, data_json, updated_at) VALUES ($1,$2,$3,$4,$5)', [
    id,
    body.kind,
    ts,
    JSON.stringify(body.data ?? {}),
    Date.now(),
  ])
  const { rows } = await q('SELECT * FROM records WHERE id = $1', [id])
  res.json(rows[0] ? rowToRecord(rows[0]) : null)
}))

app.put('/records/:id', wrap(async (req, res) => {
  const body = req.body ?? {}
  await q(
    `UPDATE records SET
       ts = COALESCE($1, ts),
       data_json = COALESCE($2, data_json),
       updated_at = $3
     WHERE id = $4`,
    [body.ts ?? null, body.data !== undefined ? JSON.stringify(body.data) : null, Date.now(), req.params.id],
  )
  const { rows } = await q('SELECT * FROM records WHERE id = $1', [req.params.id])
  res.json(rows[0] ? rowToRecord(rows[0]) : null)
}))

app.delete('/records/:id', wrap(async (req, res) => {
  await q('DELETE FROM records WHERE id = $1', [req.params.id])
  res.json({ ok: true })
}))

// ---------- semilla / migración ----------
app.post('/admin/seed', wrap(async (req, res) => {
  const body = req.body ?? {}
  if (body.wipe) {
    await q('DELETE FROM products')
    await q('DELETE FROM sales')
    await q('DELETE FROM records')
    await q('DELETE FROM config')
  }
  let pInserted = 0
  let sInserted = 0
  let rInserted = 0
  for (const [i, p] of (body.products ?? []).entries()) {
    await q(
      `INSERT INTO products (id, name, price_cents, cost_cents, image_data_url, position, category, owner, active, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price_cents=EXCLUDED.price_cents, cost_cents=EXCLUDED.cost_cents,
         image_data_url=EXCLUDED.image_data_url, position=EXCLUDED.position, category=EXCLUDED.category,
         owner=EXCLUDED.owner, active=EXCLUDED.active`,
      [
        p.id,
        p.name,
        p.priceCents,
        p.costCents ?? 0,
        p.imageDataUrl ?? null,
        p.position ?? i,
        p.category ?? null,
        p.owner === 'paletero' ? 'paletero' : 'propio',
        p.active === false ? 0 : 1,
        Date.now(),
      ],
    )
    pInserted++
  }
  for (const s of body.sales ?? []) {
    await q(
      `INSERT INTO sales (id, ts, total_cents, method, received_cents, change_cents, mp_order_id, commission_cents, is_late, channel, channel_fee_cents, refunded, items_json, denominations_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (id) DO NOTHING`,
      [
        s.id,
        s.timestamp,
        s.totalCents,
        s.method,
        s.receivedCents,
        s.changeCents,
        s.mpOrderId ?? null,
        s.commissionCents ?? null,
        s.isLate ? 1 : 0,
        s.channel === 'rappi' || s.channel === 'uber' ? s.channel : 'mostrador',
        s.channelFeeCents ?? null,
        s.refunded ? 1 : 0,
        JSON.stringify(s.items ?? []),
        s.denominations ? JSON.stringify(s.denominations) : null,
      ],
    )
    sInserted++
  }
  for (const r of body.records ?? []) {
    await q(
      'INSERT INTO records (id, kind, ts, data_json, updated_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
      [r.id, r.kind, r.ts, JSON.stringify(r.data ?? {}), Date.now()],
    )
    rInserted++
  }
  const set = (k, v) =>
    q(
      `INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [k, v],
    )
  if (body.investmentCents !== undefined) await set('investmentCents', String(body.investmentCents))
  if (body.changeFundCents !== undefined) await set('changeFundCents', String(body.changeFundCents))
  if (body.cardCommissionPercent !== undefined)
    await set('cardCommissionPercent', String(body.cardCommissionPercent))
  if (body.settings !== undefined) await set('settingsJson', JSON.stringify(body.settings))
  res.json({ ok: true, productsInserted: pInserted, salesInserted: sInserted, recordsInserted: rInserted })
}))

// ---------- cobro con terminal Point ----------
app.post('/charge', wrap(async (req, res) => {
  const body = req.body ?? {}
  if (!body.amount) return res.status(400).json({ error: 'amount is required' })
  const externalRef = body.externalRef ?? `pos-${Date.now()}`
  const r = await fetch(`${MP_BASE}/v1/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      'X-Idempotency-Key': crypto.randomUUID(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'point',
      external_reference: externalRef,
      expiration_time: EXPIRATION_TIME,
      transactions: { payments: [{ amount: body.amount }] },
      config: {
        point: { terminal_id: TERMINAL_ID, print_on_terminal: 'no_ticket' },
        payment_method: { default_type: 'credit_card' },
      },
    }),
  })
  const data = await r.json()
  if (r.ok && data?.id && body.items?.length) {
    await kvPut('items:' + data.id, body.items, 60 * 60 * 24)
  }
  res.status(r.status).json(data)
}))

app.post('/charge/:orderId/cancel', wrap(async (req, res) => {
  const r = await fetch(`${MP_BASE}/v1/orders/${req.params.orderId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      'X-Idempotency-Key': crypto.randomUUID(),
      'Content-Type': 'application/json',
    },
  })
  const data = await r.json()
  res.status(r.status).json(data)
}))

app.get('/charge/:orderId', wrap(async (req, res) => {
  const r = await fetch(`${MP_BASE}/v1/orders/${req.params.orderId}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  })
  const data = await r.json()
  res.status(r.status).json(data)
}))

// ---------- confirmaciones tardías ----------
app.get('/late-confirmations', wrap(async (_req, res) => {
  res.json({ confirmations: await kvListPrefix('late:') })
}))

app.post('/late-confirmations/:orderId/ack', wrap(async (req, res) => {
  await kvDelete('late:' + req.params.orderId)
  await kvDelete('items:' + req.params.orderId)
  res.json({ ok: true })
}))

// ---------- webhook de Mercado Pago ----------
app.post('/webhook', wrap(async (req, res) => {
  const text = req.rawBody ?? JSON.stringify(req.body ?? {})
  console.log('[webhook]', text.slice(0, 500))
  if (MP_WEBHOOK_SECRET) {
    if (!verifyWebhookSignature(req, text, MP_WEBHOOK_SECRET)) {
      console.warn('[webhook] invalid signature')
      return res.status(401).send('Invalid signature')
    }
  }
  try {
    const data = JSON.parse(text)
    const orderId =
      data?.data?.id ||
      (typeof data?.resource === 'string' ? data.resource.split('/').pop() : undefined) ||
      data?.id
    if (typeof orderId === 'string' && orderId.startsWith('ORD')) {
      const order = await fetchOrder(orderId)
      if (order && paymentIsProcessed(order)) {
        const items = await kvGet('items:' + orderId)
        await kvPut(
          'late:' + orderId,
          {
            orderId,
            amountCents: paymentAmountCents(order),
            externalReference: order?.external_reference,
            confirmedAt: Date.now(),
            items: items ?? undefined,
          },
          60 * 60 * 24 * 7,
        )
      }
    }
  } catch (e) {
    console.error('[webhook] parse error', e)
  }
  res.send('OK')
}))

app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

// ---------- arranque ----------
ensureSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`FresaFé backend listo en :${PORT} (terminal ${TERMINAL_ID})`))
  })
  .catch((e) => {
    console.error('No se pudo preparar la base de datos:', e)
    process.exit(1)
  })
