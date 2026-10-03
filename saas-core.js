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
      website
