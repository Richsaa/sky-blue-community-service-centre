-- Sky Blue SaaS Payment Ledger
-- Records subscription/payment transactions for the owner dashboard.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS saas_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  account_id INTEGER,

  business_name TEXT,
  email TEXT,

  plan TEXT,

  amount REAL NOT NULL DEFAULT 0,

  currency TEXT NOT NULL DEFAULT 'ZAR',

  status TEXT NOT NULL DEFAULT 'pending',

  provider TEXT NOT NULL DEFAULT 'payfast',

  provider_reference TEXT,

  paid_at DATETIME,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (account_id)
    REFERENCES customer_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_saas_payments_account
ON saas_payments(account_id);

CREATE INDEX IF NOT EXISTS idx_saas_payments_status
ON saas_payments(status);

CREATE INDEX IF NOT EXISTS idx_saas_payments_paid_at
ON saas_payments(paid_at);

CREATE INDEX IF NOT EXISTS idx_saas_payments_provider_reference
ON saas_payments(provider_reference);
