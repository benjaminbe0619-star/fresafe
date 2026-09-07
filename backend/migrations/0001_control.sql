-- Migración para bases existentes (ejecutar UNA vez contra la D1 desplegada):
--   npx wrangler d1 execute culinaryfest-db --remote --file=migrations/0001_control.sql
ALTER TABLE products ADD COLUMN category TEXT;
ALTER TABLE products ADD COLUMN owner TEXT NOT NULL DEFAULT 'propio';
ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1;

ALTER TABLE sales ADD COLUMN channel TEXT NOT NULL DEFAULT 'mostrador';
ALTER TABLE sales ADD COLUMN channel_fee_cents INTEGER;

CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  ts INTEGER NOT NULL,
  data_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_records_kind_ts ON records (kind, ts DESC);
