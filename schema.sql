CREATE TABLE IF NOT EXISTS valuation_drafts (
  employee_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_valuation_drafts_updated_at
  ON valuation_drafts(updated_at);
