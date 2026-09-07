-- Devoluciones: marca la venta como devuelta sin borrarla.
--   npx wrangler d1 execute culinaryfest-db --remote --file=migrations/0002_refunds.sql
ALTER TABLE sales ADD COLUMN refunded INTEGER NOT NULL DEFAULT 0;
