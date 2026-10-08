-- =========================================================
-- SKY BLUE DIGITAL SERVICE
-- DATABASE MIGRATION 0001
-- Customer authentication compatibility
-- =========================================================

-- Add the columns required by the current Worker
ALTER TABLE customer_accounts
ADD COLUMN status TEXT DEFAULT 'ACTIVE';

ALTER TABLE customer_accounts
ADD COLUMN updated_at TEXT;

-- Fill the new columns for existing accounts
UPDATE customer_accounts
SET status = 'ACTIVE'
WHERE status IS NULL;

UPDATE customer_accounts
SET updated_at = created_at
WHERE updated_at IS NULL;

-- Add the session token column required by the current Worker
ALTER TABLE customer_sessions
ADD COLUMN token TEXT;

-- Preserve existing session IDs as tokens
UPDATE customer_sessions
SET token = id
WHERE token IS NULL;

-- Make tokens unique for the current session lookup
CREATE UNIQUE INDEX IF NOT EXISTS
idx_customer_sessions_token
ON customer_sessions(token);
