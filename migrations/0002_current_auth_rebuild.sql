-- =========================================================
-- SKY BLUE DIGITAL SERVICE
-- DATABASE MIGRATION 0002
-- Rebuild customer authentication tables to current schema
-- Preserves existing customer email/password data
-- =========================================================

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- ---------------------------------------------------------
-- 1. Save mapping between old TEXT account IDs and new
--    INTEGER account IDs.
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS legacy_account_id_map (
  old_account_id TEXT PRIMARY KEY,
  new_account_id INTEGER NOT NULL
);

-- ---------------------------------------------------------
-- 2. Create the current customer_accounts structure.
-- ---------------------------------------------------------

CREATE TABLE customer_accounts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ---------------------------------------------------------
-- 3. Copy existing customer accounts.
-- ---------------------------------------------------------

INSERT INTO customer_accounts_new
(
  email,
  password_hash,
  status,
  created_at,
  updated_at
)
SELECT
  LOWER(TRIM(email)),
  password_hash,
  COALESCE(status, 'ACTIVE'),
  created_at,
  COALESCE(updated_at, created_at)
FROM customer_accounts
ORDER BY rowid;

-- ---------------------------------------------------------
-- 4. Build old-ID -> new-ID mapping.
-- ---------------------------------------------------------

INSERT OR REPLACE INTO legacy_account_id_map
(
  old_account_id,
  new_account_id
)
SELECT
  old.id,
  new.id
FROM customer_accounts old
JOIN customer_accounts_new new
  ON LOWER(TRIM(old.email)) = new.email;

-- ---------------------------------------------------------
-- 5. Create the current customer_sessions structure.
-- ---------------------------------------------------------

CREATE TABLE customer_sessions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ---------------------------------------------------------
-- 6. Preserve existing sessions.
--    Old session ID becomes the token when necessary.
-- ---------------------------------------------------------

INSERT INTO customer_sessions_new
(
  account_id,
  token,
  expires_at,
  created_at
)
SELECT
  m.new_account_id,
  COALESCE(NULLIF(s.token, ''), s.id),
  s.expires_at,
  s.created_at
FROM customer_sessions s
JOIN legacy_account_id_map m
  ON CAST(s.account_id AS TEXT) = m.old_account_id
WHERE s.expires_at IS NOT NULL
  AND COALESCE(NULLIF(s.token, ''), s.id) IS NOT NULL;

-- ---------------------------------------------------------
-- 7. Replace old sessions table.
-- ---------------------------------------------------------

DROP TABLE customer_sessions;

ALTER TABLE customer_sessions_new
RENAME TO customer_sessions;

-- ---------------------------------------------------------
-- 8. Replace old accounts table.
-- ---------------------------------------------------------

DROP TABLE customer_accounts;

ALTER TABLE customer_accounts_new
RENAME TO customer_accounts;

-- ---------------------------------------------------------
-- 9. Recreate indexes required by the current system.
-- ---------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS
idx_customer_sessions_token
ON customer_sessions(token);

CREATE INDEX IF NOT EXISTS
idx_customer_sessions_account_id
ON customer_sessions(account_id);

CREATE INDEX IF NOT EXISTS
idx_customer_sessions_expires_at
ON customer_sessions(expires_at);

CREATE INDEX IF NOT EXISTS
idx_customer_accounts_email
ON customer_accounts(email);

-- ---------------------------------------------------------
-- 10. Ensure every account has a valid status/date.
-- ---------------------------------------------------------

UPDATE customer_accounts
SET status = 'ACTIVE'
WHERE status IS NULL OR status = '';

UPDATE customer_accounts
SET updated_at = created_at
WHERE updated_at IS NULL OR updated_at = '';

COMMIT;

PRAGMA foreign_keys = ON;
