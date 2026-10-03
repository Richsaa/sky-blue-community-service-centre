/*
 * SKY BLUE SAAS CORE ENGINE
 *
 * Shared business engine for all Sky Blue SaaS modules.
 */

export const SKY_BLUE_SAAS_CORE_VERSION = "1.0.1";

export const SAAS_CORE_TABLES = [
  "saas_business_profiles",
  "saas_staff",
  "saas_roles",
  "saas_customers",
  "saas_products",
  "saas_services",
  "saas_sales",
  "saas_sale_items",
  "saas_business_payments",
  "saas_expenses",
  "saas_quotes",
  "saas_quote_items",
  "saas_invoices",
  "saas_invoice_items",
  "saas_documents",
  "saas_activity_log",
  "saas_notifications"
];

/* ---------------------------------------------------------
   DATABASE SCHEMA HELPERS
--------------------------------------------------------- */

async function hasColumn(db, tableName, columnName) {
  const result = await db.prepare(
    `PRAGMA table_info(${tableName})`
  ).all();

  const columns = result?.results || [];

  return columns.some(
    (column) => column.name === columnName
  );
}

async function ensureAccountIdColumn(db, tableName) {
  const exists = await hasColumn(
    db,
    tableName,
    "account_id"
  );

  if (exists) {
    return;
  }

  await db.prepare(`
    ALTER TABLE ${tableName}
    ADD COLUMN account_id INTEGER
  `).run();

  console.log(
    `Added account_id column to ${tableName}`
  );
}

async function repairSaaSCoreSchema(db) {
  const tables = [
    "saas_business_profiles",
    "saas_staff",
    "saas_roles",
    "saas_customers",
    "saas_products",
    "saas_services",
    "saas_sales",
    "saas_sale_items",
    "saas_business_payments",
    "saas_expenses",
    "saas_quotes",
    "saas_quote_items",
    "saas_invoices",
    "saas_invoice_items",
    "saas_documents",
    "saas_activity_log",
    "saas_notifications"
  ];

  /*
   * REPAIR account_id
   */

  for (const table of tables) {
    await ensureAccountIdColumn(
      db,
      table
    );
  }

  /*
   * REPAIR module_code
   */

  const moduleTables = [
    "saas_products",
    "saas_services",
    "saas_sales",
    "saas_expenses",
    "saas_quotes",
    "saas_invoices",
    "saas_documents",
    "saas_activity_log",
    "saas_notifications"
  ];

  for (const table of moduleTables) {
    const exists = await hasColumn(
      db,
      table,
      "module_code"
    );

    if (!exists) {
      await db.prepare(`
        ALTER TABLE ${table}
        ADD COLUMN module_code TEXT DEFAULT ''
      `).run();

      console.log(
        `Added module_code column to ${table}`
      );
    }
  }

  /*
   * REPAIR CUSTOMER TABLE
   */

  const customerColumns = [
    {
      name: "customer_code",
      definition: "TEXT DEFAULT ''"
    },
    {
      name: "customer_type",
      definition: "TEXT DEFAULT 'individual'"
    },
    {
      name: "first_name",
      definition: "TEXT DEFAULT ''"
    },
    {
      name: "last_name",
      definition: "TEXT DEFAULT ''"
    },
    {
      name: "business_name",
      definition: "TEXT DEFAULT ''"
    },
    {
      name: "email",
      definition: "TEXT DEFAULT ''"
    },
    {
      name: "phone",
      definition: "TEXT DEFAULT ''"
    },
    {
      name: "whatsapp",
      definition: "TEXT DEFAULT ''"
    },
    {
      name: "address",
      definition: "TEXT DEFAULT ''"
    },
    {
      name: "city",
      definition: "TEXT DEFAULT ''"
    },
    {
      name: "province",
      definition: "TEXT DEFAULT ''"
    },
    {
      name: "postal_code",
      definition: "TEXT DEFAULT ''"
    },
    {
      name: "notes",
      definition: "TEXT DEFAULT ''"
    },
    {
      name: "status",
      definition: "TEXT DEFAULT 'active'"
    }
  ];

  for (const column of customerColumns) {
    const exists = await hasColumn(
      db,
      "saas_customers",
      column.name
    );

    if (!exists) {
      await db.prepare(`
        ALTER TABLE saas_customers
        ADD COLUMN ${column.name} ${column.definition}
      `).run();

      console.log(
        `Added ${column.name} column to saas_customers`
      );
    }
  }

  /*
   * REPAIR PRODUCTS TABLE
   *
   * Older databases may not have product_code.
   */

  const productColumns = [
    {
      name: "product_code",
      definition: "TEXT DEFAULT ''"
    }
  ];

  for (const column of productColumns) {
    const exists = await hasColumn(
      db,
      "saas_products",
      column.name
    );

    if (!exists) {
      await db.prepare(`
        ALTER TABLE saas_products
        ADD COLUMN ${column.name} ${column.definition}
      `).run();

      console.log(
        `Added ${column.name} column to saas_products`
      );
    }
  }

  /*
   * REPAIR SERVICES TABLE
   *
   * Older databases may not have service_code.
   */

  const serviceColumns = [
    {
      name: "service_code",
      definition: "TEXT DEFAULT ''"
    }
  ];

  for (const column of serviceColumns) {
    const exists = await hasColumn(
      db,
      "saas_services",
      column.name
    );

    if (!exists) {
      await db.prepare(`
        ALTER TABLE saas_services
        ADD COLUMN ${column.name} ${column.definition}
      `).run();

      console.log(
        `Added ${column.name} column to saas_services`
      );
    }
  }

  /*
   * REPAIR STAFF TABLE
   *
   * Older databases may not have full_name.
   */

  const staffColumns = [
    {
      name: "full_name",
      definition: "TEXT DEFAULT ''"
    }
  ];

  for (const column of staffColumns) {
    const exists = await hasColumn(
      db,
      "saas_staff",
      column.name
    );

    if (!exists) {
      await db.prepare(`
        ALTER TABLE saas_staff
        ADD COLUMN ${column.name} ${column.definition}
      `).run();

      console.log(
        `Added ${column.name} column to saas_staff`
      );
    }
  }

  /*
   * REPAIR NOTIFICATIONS TABLE
   *
   * Older databases may not have customer_id.
   */

  const notificationColumns = [
    {
      name: "customer_id",
      definition: "INTEGER"
    }
  ];

  for (const column of notificationColumns) {
    const exists = await hasColumn(
      db,
      "saas_notifications",
      column.name
    );

    if (!exists) {
      await db.prepare(`
        ALTER TABLE saas_notifications
        ADD COLUMN ${column.name} ${column.definition}
      `).run();

      console.log(
        `Added ${column.name} column to saas_notifications`
      );
    }
  }
}

/* ---------------------------------------------------------
   DATABASE SETUP
--------------------------------------------------------- */

export async function ensureSaaSCoreTables(env) {
  const db = env.DB;

  /*
   * BUSINESS PROFILE
   */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS saas_business_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL UNIQUE,
      business_name TEXT NOT NULL DEFAULT '',
      trading_name TEXT DEFAULT '',
      business_type TEXT DEFAULT '',
      registration_number TEXT DEFAULT '',
      tax_number TEXT DEFAULT '',
      description TEXT DEFAULT '',
      logo_url TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      whatsapp TEXT DEFAULT '',
      website TEXT DEFAULT '',
      address TEXT DEFAULT '',
      city TEXT DEFAULT '',
      province TEXT DEFAULT '',
      postal_code TEXT DEFAULT '',
      country TEXT DEFAULT 'South Africa',
      currency TEXT DEFAULT 'ZAR',
      timezone TEXT DEFAULT 'Africa/Johannesburg',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  /*
   * STAFF
   */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS saas_staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      job_title TEXT DEFAULT '',
      department TEXT DEFAULT '',
      role_code TEXT DEFAULT 'staff',
      status TEXT NOT NULL DEFAULT 'active',
      start_date TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  /*
   * ROLES
   */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS saas_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      role_code TEXT NOT NULL,
      role_name TEXT NOT NULL,
      permissions_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, role_code)
    )
  `).run();

  /*
   * CUSTOMERS
   */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS saas_customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      customer_code TEXT DEFAULT '',
      customer_type TEXT DEFAULT 'individual',
      first_name TEXT DEFAULT '',
      last_name TEXT DEFAULT '',
      business_name TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      whatsapp TEXT DEFAULT '',
      address TEXT DEFAULT '',
      city TEXT DEFAULT '',
      province TEXT DEFAULT '',
      postal_code TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  /*
   * PRODUCTS
   */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS saas_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      module_code TEXT NOT NULL,
      product_code TEXT DEFAULT '',
      sku TEXT DEFAULT '',
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      description TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      unit TEXT DEFAULT 'unit',
      cost_price REAL NOT NULL DEFAULT 0,
      selling_price REAL NOT NULL DEFAULT 0,
      wholesale_price REAL NOT NULL DEFAULT 0,
      stock_quantity REAL NOT NULL DEFAULT 0,
      low_stock_level REAL NOT NULL DEFAULT 0,
      reorder_level REAL NOT NULL DEFAULT 0,
      track_inventory INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  /*
   * SERVICES
   */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS saas_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      module_code TEXT NOT NULL,
      service_code TEXT DEFAULT '',
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      description TEXT DEFAULT '',
      duration_minutes INTEGER DEFAULT 0,
      price REAL NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  /*
   * SALES
   */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS saas_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      module_code TEXT NOT NULL,
      sale_number TEXT NOT NULL,
      customer_id INTEGER,
      sale_type TEXT DEFAULT 'sale',
      status TEXT NOT NULL DEFAULT 'completed',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      subtotal REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      delivery_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT DEFAULT '',
      reference TEXT DEFAULT '',
      source TEXT DEFAULT 'dashboard',
      notes TEXT DEFAULT '',
      sale_date TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  /*
   * SALE ITEMS
   */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS saas_sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      sale_id INTEGER NOT NULL,
      product_id INTEGER,
      service_id INTEGER,
      description TEXT NOT NULL DEFAULT '',
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  /*
   * BUSINESS PAYMENTS
   */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS saas_business_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      customer_id INTEGER,
      sale_id INTEGER,
      invoice_id INTEGER,
      amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT '',
      payment_provider TEXT DEFAULT '',
      provider_reference TEXT DEFAULT '',
      internal_reference TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'paid',
      paid_at TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  /*
   * EXPENSES
   */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS saas_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      module_code TEXT NOT NULL,
      expense_number TEXT DEFAULT '',
      category TEXT DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      supplier_name TEXT DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT DEFAULT '',
      reference TEXT DEFAULT '',
      expense_date TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'paid',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  /*
   * QUOTATIONS
   */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS saas_quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      module_code TEXT NOT NULL,
      quote_number TEXT NOT NULL,
      customer_id INTEGER,
      status TEXT NOT NULL DEFAULT 'draft',
      subtotal REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      valid_until TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  /*
   * QUOTE ITEMS
   */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS saas_quote_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      quote_id INTEGER NOT NULL,
      product_id INTEGER,
      service_id INTEGER,
      description TEXT NOT NULL DEFAULT '',
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  /*
   * INVOICES
   */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS saas_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      module_code TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      customer_id INTEGER,
      quote_id INTEGER,
      sale_id INTEGER,
      status TEXT NOT NULL DEFAULT 'unpaid',
      subtotal REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      amount_paid REAL NOT NULL DEFAULT 0,
      balance_due REAL NOT NULL DEFAULT 0,
      issue_date TEXT DEFAULT CURRENT_TIMESTAMP,
      due_date TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  /*
   * INVOICE ITEMS
   */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS saas_invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      invoice_id INTEGER NOT NULL,
      product_id INTEGER,
      service_id INTEGER,
      description TEXT NOT NULL DEFAULT '',
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  /*
   * DOCUMENTS
   */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS saas_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      module_code TEXT NOT NULL,
      document_type TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      reference TEXT DEFAULT '',
      description TEXT DEFAULT '',
      document_url TEXT DEFAULT '',
      expiry_date TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  /*
   * ACTIVITY LOG
   */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS saas_activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      module_code TEXT DEFAULT '',
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT DEFAULT '',
      entity_id INTEGER,
      description TEXT DEFAULT '',
      metadata_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  /*
   * NOTIFICATIONS
   */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS saas_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      module_code TEXT DEFAULT '',
      customer_id INTEGER,
      channel TEXT NOT NULL DEFAULT 'dashboard',
      notification_type TEXT DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      sent_at TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  /*
   * REPAIR OLDER DATABASE SCHEMAS
   */

  await repairSaaSCoreSchema(db);

  /*
   * INDEXES
   */

  const indexes = [
    `
      CREATE INDEX IF NOT EXISTS idx_saas_business_profiles_account
      ON saas_business_profiles(account_id)
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_saas_staff_account
      ON saas_staff(account_id)
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_saas_customers_account
      ON saas_customers(account_id)
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_saas_customers_phone
      ON saas_customers(account_id, phone)
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_saas_products_account
      ON saas_products(account_id)
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_saas_products_module
      ON saas_products(account
