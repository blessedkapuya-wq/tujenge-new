-- Cloudflare D1 Schema for Tujenge Hub (Zero-Firebase)
-- Apply locally:   npx wrangler d1 execute tujenge-db --local --file=./schema.sql
-- Apply remotely:  npx wrangler d1 execute tujenge-db --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS app_state (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
