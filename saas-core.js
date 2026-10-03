/*
 * SKY BLUE SAAS CORE ENGINE
 *
 * Shared business engine for all Sky Blue SaaS modules.
 *
 * This file provides the common data foundation for:
 * - Community Service Centre
 * - NPO & NGO Management
 * - Church Management
 * - E-Commerce & Online Store
 * - Salon & Barber Management
 * - Laundry Management
 * - Food Business Management
 * - Wholesale & Grocery Management
 * - Driving School Management
 * - School Management
 * - Preschool & Day-care Management
 * - Pharmacy Management
 * - Transport Management
 * - IT Business Management
 * - Building Materials Management
 * - Other Service Businesses
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

/*
 * Check whether a column exists in a table.
 */
async function hasColumn(db, tableName, columnName) {
  const result = await db.prepare(
    `PRAGMA table_info(${tableName})`
  ).all();

  const columns = result?.results || [];

  return columns.some(
    (column) => column.name === columnName
  );
}

/*
 * Add account_id to older SaaS tables that were created
 * before the multi-account architecture was introduced.
 *
 * This does NOT delete existing data.
 */
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

/*
 * Repair older SaaS database tables.
 */
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

  for (const table of tables) {
    await ensureAccountIdColumn(
      db,
      table
    );
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
   * CUSTOMERS / CONTACTS
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
   * SALES / ORDERS
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
   * -------------------------------------------------------
   * REPAIR OLDER DATABASE SCHEMAS
   * -------------------------------------------------------
   *
   * IMPORTANT:
   * CREATE TABLE IF NOT EXISTS does not modify an existing
   * table. Older tables may therefore be missing account_id.
   *
   * We repair those tables before creating account indexes.
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
      ON saas_products(account_id, module_code)
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_saas_services_account
      ON saas_services(account_id)
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_saas_services_module
      ON saas_services(account_id, module_code)
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_saas_sales_account
      ON saas_sales(account_id)
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_saas_sales_module
      ON saas_sales(account_id, module_code)
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_saas_sale_items_sale
      ON saas_sale_items(sale_id)
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_saas_business_payments_account
      ON saas_business_payments(account_id)
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_saas_expenses_account
      ON saas_expenses(account_id)
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_saas_quotes_account
      ON saas_quotes(account_id)
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_saas_invoices_account
      ON saas_invoices(account_id)
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_saas_documents_account
      ON saas_documents(account_id)
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_saas_activity_account
      ON saas_activity_log(account_id)
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_saas_notifications_account
      ON saas_notifications(account_id)
    `
  ];

  for (const sql of indexes) {
    await db.prepare(sql).run();
  }

  return {
    success: true,
    version: SKY_BLUE_SAAS_CORE_VERSION,
    tables: SAAS_CORE_TABLES
  };
}

/* ---------------------------------------------------------
   BUSINESS PROFILE
--------------------------------------------------------- */

export async function getBusinessProfile(env, accountId) {
  if (!accountId) {
    throw new Error("accountId is required");
  }

  return await env.DB.prepare(`
    SELECT *
    FROM saas_business_profiles
    WHERE account_id = ?
    LIMIT 1
  `).bind(Number(accountId)).first();
}

export async function saveBusinessProfile(env, accountId, data = {}) {
  if (!accountId) {
    throw new Error("accountId is required");
  }

  await ensureSaaSCoreTables(env);

  const existing = await getBusinessProfile(env, accountId);

  const values = {
    businessName: String(data.business_name || data.businessName || ""),
    tradingName: String(data.trading_name || data.tradingName || ""),
    businessType: String(data.business_type || data.businessType || ""),
    registrationNumber: String(
      data.registration_number || data.registrationNumber || ""
    ),
    taxNumber: String(data.tax_number || data.taxNumber || ""),
    description: String(data.description || ""),
    logoUrl: String(data.logo_url || data.logoUrl || ""),
    email: String(data.email || ""),
    phone: String(data.phone || ""),
    whatsapp: String(data.whatsapp || ""),
    website: String(data.website || ""),
    address: String(data.address || ""),
    city: String(data.city || ""),
    province: String(data.province || ""),
    postalCode: String(data.postal_code || data.postalCode || ""),
    country: String(data.country || "South Africa"),
    currency: String(data.currency || "ZAR"),
    timezone: String(data.timezone || "Africa/Johannesburg"),
    status: String(data.status || "active")
  };

  if (existing) {
    await env.DB.prepare(`
      UPDATE saas_business_profiles
      SET
        business_name = ?,
        trading_name = ?,
        business_type = ?,
        registration_number = ?,
        tax_number = ?,
        description = ?,
        logo_url = ?,
        email = ?,
        phone = ?,
        whatsapp = ?,
        website = ?,
        address = ?,
        city = ?,
        province = ?,
        postal_code = ?,
        country = ?,
        currency = ?,
        timezone = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE account_id = ?
    `).bind(
      values.businessName,
      values.tradingName,
      values.businessType,
      values.registrationNumber,
      values.taxNumber,
      values.description,
      values.logoUrl,
      values.email,
      values.phone,
      values.whatsapp,
      values.website,
      values.address,
      values.city,
      values.province,
      values.postalCode,
      values.country,
      values.currency,
      values.timezone,
      values.status,
      Number(accountId)
    ).run();
  } else {
    await env.DB.prepare(`
      INSERT INTO saas_business_profiles (
        account_id,
        business_name,
        trading_name,
        business_type,
        registration_number,
        tax_number,
        description,
        logo_url,
        email,
        phone,
        whatsapp,
        website,
        address,
        city,
        province,
        postal_code,
        country,
        currency,
        timezone,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      Number(accountId),
      values.businessName,
      values.tradingName,
      values.businessType,
      values.registrationNumber,
      values.taxNumber,
      values.description,
      values.logoUrl,
      values.email,
      values.phone,
      values.whatsapp,
      values.website,
      values.address,
      values.city,
      values.province,
      values.postalCode,
      values.country,
      values.currency,
      values.timezone,
      values.status
    ).run();
  }

  return await getBusinessProfile(env, accountId);
}

/* ---------------------------------------------------------
   ACTIVITY
--------------------------------------------------------- */

export async function logSaaSActivity(
  env,
  {
    accountId,
    moduleCode = "",
    userId = null,
    action,
    entityType = "",
    entityId = null,
    description = "",
    metadata = {}
  }
) {
  if (!accountId) {
    throw new Error("accountId is required");
  }

  if (!action) {
    throw new Error("action is required");
  }

  await ensureSaaSCoreTables(env);

  await env.DB.prepare(`
    INSERT INTO saas_activity_log (
      account_id,
      module_code,
      user_id,
      action,
      entity_type,
      entity_id,
      description,
      metadata_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    Number(accountId),
    String(moduleCode || ""),
    userId ? Number(userId) : null,
    String(action),
    String(entityType || ""),
    entityId ? Number(entityId) : null,
    String(description || ""),
    JSON.stringify(metadata || {})
  ).run();

  return {
    success: true
  };
}

/* ---------------------------------------------------------
   DASHBOARD SUMMARY
--------------------------------------------------------- */

export async function getSaaSDashboardSummary(
  env,
  accountId,
  moduleCode = null
) {
  if (!accountId) {
    throw new Error("accountId is required");
  }

  await ensureSaaSCoreTables(env);

  const account = Number(accountId);

  let salesSql = `
    SELECT
      COUNT(*) AS total_sales,
      COALESCE(SUM(total_amount), 0) AS total_revenue
    FROM saas_sales
    WHERE account_id = ?
  `;

  let expenseSql = `
    SELECT
      COUNT(*) AS total_expenses,
      COALESCE(SUM(amount), 0) AS total_expense_amount
    FROM saas_expenses
    WHERE account_id = ?
  `;

  const customerSql = `
    SELECT COUNT(*) AS total_customers
    FROM saas_customers
    WHERE account_id = ?
  `;

  const productSql = `
    SELECT COUNT(*) AS total_products
    FROM saas_products
    WHERE account_id = ?
  `;

  if (moduleCode) {
    salesSql += `
      AND module_code = ?
    `;

    expenseSql += `
      AND module_code = ?
    `;
  }

  const sales = await env.DB.prepare(salesSql)
    .bind(
      ...(moduleCode
        ? [account, String(moduleCode)]
        : [account])
    )
    .first();

  const expenses = await env.DB.prepare(expenseSql)
    .bind(
      ...(moduleCode
        ? [account, String(moduleCode)]
        : [account])
    )
    .first();

  const customers = await env.DB.prepare(customerSql)
    .bind(account)
    .first();

  const products = await env.DB.prepare(productSql)
    .bind(account)
    .first();

  return {
    success: true,
    account_id: account,
    module_code: moduleCode || null,

    sales: {
      count: Number(sales?.total_sales || 0),
      revenue: Number(sales?.total_revenue || 0)
    },

    expenses: {
      count: Number(expenses?.total_expenses || 0),
      amount: Number(
        expenses?.total_expense_amount || 0
      )
    },

    customers: Number(
      customers?.total_customers || 0
    ),

    products: Number(
      products?.total_products || 0
    ),

    gross_balance:
      Number(sales?.total_revenue || 0) -
      Number(
        expenses?.total_expense_amount || 0
      )
  };
}

/* ---------------------------------------------------------
   MODULE DATA SUMMARY
--------------------------------------------------------- */

export async function getSaaSModuleSummary(
  env,
  accountId,
  moduleCode
) {
  if (!accountId) {
    throw new Error("accountId is required");
  }

  if (!moduleCode) {
    throw new Error("moduleCode is required");
  }

  await ensureSaaSCoreTables(env);

  const account = Number(accountId);
  const module = String(moduleCode);

  const customers = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM saas_customers
    WHERE account_id = ?
  `).bind(account).first();

  const products = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM saas_products
    WHERE account_id = ?
      AND module_code = ?
  `).bind(account, module).first();

  const services = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM saas_services
    WHERE account_id = ?
      AND module_code = ?
  `).bind(account, module).first();

  const sales = await env.DB.prepare(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(total_amount), 0) AS revenue
    FROM saas_sales
    WHERE account_id = ?
      AND module_code = ?
  `).bind(account, module).first();

  const expenses = await env.DB.prepare(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(amount), 0) AS amount
    FROM saas_expenses
    WHERE account_id = ?
      AND module_code = ?
  `).bind(account, module).first();

  return {
    success: true,
    account_id: account,
    module_code: module,

    customers: Number(
      customers?.total || 0
    ),

    products: Number(
      products?.total || 0
    ),

    services: Number(
      services?.total || 0
    ),

    sales: Number(
      sales?.total || 0
    ),

    revenue: Number(
      sales?.revenue || 0
    ),

    expenses: Number(
      expenses?.total || 0
    ),

    expense_amount: Number(
      expenses?.amount || 0
    ),

    net_amount:
      Number(sales?.revenue || 0) -
      Number(expenses?.amount || 0)
  };
}

/* ---------------------------------------------------------
   NUMBER HELPERS
--------------------------------------------------------- */

export function toMoney(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.round(number * 100) / 100;
}

export function toQuantity(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return number;
}

/* ---------------------------------------------------------
   SAFE JSON
--------------------------------------------------------- */

export function safeJSONParse(
  value,
  fallback = {}
) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
