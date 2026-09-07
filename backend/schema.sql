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
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
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

-- Registros genéricos: gastos fijos/variables, mermas, movimientos del socio,
-- pagos al paletero. data_json guarda los campos propios de cada tipo.
CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  ts INTEGER NOT NULL,
  data_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_sales_ts ON sales (ts DESC);
CREATE INDEX IF NOT EXISTS idx_sales_mp_order ON sales (mp_order_id);
CREATE INDEX IF NOT EXISTS idx_products_position ON products (position);
CREATE INDEX IF NOT EXISTS idx_records_kind_ts ON records (kind, ts DESC);
