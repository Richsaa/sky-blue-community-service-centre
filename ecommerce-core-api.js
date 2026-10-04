/*
 * ============================================================
 * SKY BLUE DIGITAL SERVICE
 * ECOMMERCE CORE API
 * ============================================================
 *
 * Complete ecommerce engine for multi-business SaaS.
 *
 * Supports:
 * - Ecommerce stores
 * - Products
 * - Categories / subcategories
 * - SKU / barcode
 * - Cost / selling / sale prices
 * - VAT / tax
 * - Stock management
 * - Low-stock thresholds
 * - Product variants
 * - Images and videos
 * - WhatsApp media publishing
 * - Featured products
 * - Physical / digital products
 * - Weight / dimensions
 * - Delivery settings
 * - SEO
 * - Product slugs / URLs
 * - Related products
 * - Stock movement history
 * - Product status
 * - Product search/filtering
 * - Multi-tenant account isolation
 * - Ecommerce orders
 * - Ecommerce dashboard
 *
 * IMPORTANT:
 * This file does NOT send WhatsApp messages itself.
 * WhatsApp sending remains in the existing WhatsApp engine.
 * ============================================================
 */

/* ============================================================
 * HELPERS
 * ============================================================
 */

function clean(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function accountNumber(accountId) {
  const value = Number(accountId);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("Valid account_id is required");
  }

  return value;
}

function positiveId(value, field = "id") {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`Valid ${field} is required`);
  }

  return number;
}

function money(value, fallback = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return Number(fallback) || 0;
  }

  return Math.round(number * 100) / 100;
}

function integerValue(value, fallback = 0) {
  const number = Number(value);

  if (!Number.isInteger(number)) {
    return Number(fallback) || 0;
  }

  return number;
}

function parseJSON(value, fallback = {}) {
  if (!value) return fallback;

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function booleanValue(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true" ||
    value === "yes" ||
    value === "on"
  ) {
    return true;
  }

  if (
    value === false ||
    value === 0 ||
    value === "0" ||
    value === "false" ||
    value === "no" ||
    value === "off"
  ) {
    return false;
  }

  return fallback;
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function uniqueSlug(value, id = null) {
  const base = slugify(value);

  if (!base) {
    return `product-${id || Date.now()}`;
  }

  return base;
}

function nowISO() {
  return new Date().toISOString();
}

/* ============================================================
 * DATABASE HELPERS
 * ============================================================
 */

async function tableExists(env, tableName) {
  const result = await env.DB.prepare(
    `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = ?
      LIMIT 1
    `
  )
    .bind(tableName)
    .first();

  return !!result;
}

async function columnExists(env, tableName, columnName) {
  const result = await env.DB.prepare(
    `PRAGMA table_info(${tableName})`
  ).all();

  return (result.results || []).some(
    (column) => column.name === columnName
  );
}

async function ensureColumn(
  env,
  tableName,
  columnName,
  definition
) {
  const exists = await columnExists(
    env,
    tableName,
    columnName
  );

  if (!exists) {
    await env.DB.prepare(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`
    ).run();
  }
}

/* ============================================================
 * ENSURE ECOMMERCE TABLES
 * ============================================================
 */

export async function ensureEcommerceTables(env) {
  /*
   * ----------------------------------------------------------
   * STORES
   * ----------------------------------------------------------
   */

  await env.DB.prepare(
    `
      CREATE TABLE IF NOT EXISTS ecommerce_stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL UNIQUE,

        store_name TEXT,
        slug TEXT,

        email TEXT,
        phone TEXT,
        whatsapp TEXT,

        currency TEXT DEFAULT 'ZAR',

        description TEXT,

        logo_url TEXT,
        favicon_url TEXT,

        primary_color TEXT,
        secondary_color TEXT,

        design_code TEXT,

        domain TEXT,
        custom_domain TEXT,

        status TEXT DEFAULT 'active',

        published INTEGER DEFAULT 0,

        checkout_enabled INTEGER DEFAULT 1,
        delivery_enabled INTEGER DEFAULT 1,
        pickup_enabled INTEGER DEFAULT 1,

        delivery_fee REAL DEFAULT 0,

        whatsapp_enabled INTEGER DEFAULT 1,
        whatsapp_publish_enabled INTEGER DEFAULT 1,

        payment_provider TEXT,

        payment_settings_json TEXT,

        delivery_settings_json TEXT,

        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `
  ).run();

  /*
   * ----------------------------------------------------------
   * CATEGORIES
   * ----------------------------------------------------------
   */

  await env.DB.prepare(
    `
      CREATE TABLE IF NOT EXISTS ecommerce_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        account_id INTEGER NOT NULL,

        parent_id INTEGER,

        name TEXT NOT NULL,

        slug TEXT NOT NULL,

        description TEXT,

        image_url TEXT,

        sort_order INTEGER DEFAULT 0,

        active INTEGER DEFAULT 1,

        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(account_id, slug)
      )
    `
  ).run();

  /*
   * ----------------------------------------------------------
   * PRODUCT MEDIA
   * ----------------------------------------------------------
   */

  await env.DB.prepare(
    `
      CREATE TABLE IF NOT EXISTS ecommerce_product_media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        account_id INTEGER NOT NULL,

        product_id INTEGER NOT NULL,

        media_type TEXT DEFAULT 'image',

        media_url TEXT NOT NULL,

        thumbnail_url TEXT,

        mime_type TEXT,

        alt_text TEXT,

        caption TEXT,

        sort_order INTEGER DEFAULT 0,

        is_primary INTEGER DEFAULT 0,

        whatsapp_publish INTEGER DEFAULT 0,

        active INTEGER DEFAULT 1,

        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `
  ).run();

  /*
   * ----------------------------------------------------------
   * PRODUCT VARIANTS
   * ----------------------------------------------------------
   */

  await env.DB.prepare(
    `
      CREATE TABLE IF NOT EXISTS ecommerce_product_variants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        account_id INTEGER NOT NULL,

        product_id INTEGER NOT NULL,

        variant_name TEXT,

        sku TEXT,

        barcode TEXT,

        option_values_json TEXT,

        cost_price REAL DEFAULT 0,

        selling_price REAL DEFAULT 0,

        sale_price REAL,

        tax_rate REAL DEFAULT 0,

        stock_quantity INTEGER DEFAULT 0,

        low_stock_threshold INTEGER DEFAULT 0,

        weight REAL DEFAULT 0,

        length REAL DEFAULT 0,
        width REAL DEFAULT 0,
        height REAL DEFAULT 0,

        active INTEGER DEFAULT 1,

        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `
  ).run();

  /*
   * ----------------------------------------------------------
   * STOCK MOVEMENTS
   * ----------------------------------------------------------
   */

  await env.DB.prepare(
    `
      CREATE TABLE IF NOT EXISTS ecommerce_stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        account_id INTEGER NOT NULL,

        product_id INTEGER NOT NULL,

        variant_id INTEGER,

        movement_type TEXT NOT NULL,

        quantity INTEGER NOT NULL,

        quantity_before INTEGER DEFAULT 0,

        quantity_after INTEGER DEFAULT 0,

        reference_type TEXT,

        reference_id INTEGER,

        reason TEXT,

        notes TEXT,

        created_by INTEGER,

        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `
  ).run();

  /*
   * ----------------------------------------------------------
   * RELATED PRODUCTS
   * ----------------------------------------------------------
   */

  await env.DB.prepare(
    `
      CREATE TABLE IF NOT EXISTS ecommerce_related_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        account_id INTEGER NOT NULL,

        product_id INTEGER NOT NULL,

        related_product_id INTEGER NOT NULL,

        relation_type TEXT DEFAULT 'related',

        sort_order INTEGER DEFAULT 0,

        created_at TEXT DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(
          account_id,
          product_id,
          related_product_id,
          relation_type
        )
      )
    `
  ).run();

  /*
   * ----------------------------------------------------------
   * ORDERS
   * ----------------------------------------------------------
   */

  await env.DB.prepare(
    `
      CREATE TABLE IF NOT EXISTS ecommerce_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        account_id INTEGER NOT NULL,

        order_number TEXT NOT NULL,

        customer_id INTEGER,

        customer_name TEXT,
        customer_email TEXT,
        customer_phone TEXT,

        delivery_method TEXT,

        delivery_address TEXT,
        city TEXT,
        province TEXT,
        postal_code TEXT,

        subtotal REAL DEFAULT 0,
        delivery_fee REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        total_amount REAL DEFAULT 0,

        payment_method TEXT,
        payment_provider TEXT,
        payment_reference TEXT,

        payment_status TEXT DEFAULT 'pending',

        order_status TEXT DEFAULT 'pending',

        whatsapp_status TEXT,

        source TEXT DEFAULT 'web',

        notes TEXT,

        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(account_id, order_number)
      )
    `
  ).run();

  /*
   * ----------------------------------------------------------
   * ORDER ITEMS
   * ----------------------------------------------------------
   */

  await env.DB.prepare(
    `
      CREATE TABLE IF NOT EXISTS ecommerce_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        account_id INTEGER NOT NULL,

        order_id INTEGER NOT NULL,

        product_id INTEGER,

        variant_id INTEGER,

        product_name TEXT,

        sku TEXT,

        quantity INTEGER DEFAULT 1,

        unit_price REAL DEFAULT 0,

        total_amount REAL DEFAULT 0,

        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `
  ).run();

  /*
   * ----------------------------------------------------------
   * INDEXES
   * ----------------------------------------------------------
   */

  await env.DB.prepare(
    `
      CREATE INDEX IF NOT EXISTS
      idx_ecommerce_media_account_product
      ON ecommerce_product_media(account_id, product_id)
    `
  ).run();

  await env.DB.prepare(
    `
      CREATE INDEX IF NOT EXISTS
      idx_ecommerce_media_whatsapp
      ON ecommerce_product_media(
        account_id,
        whatsapp_publish,
        active
      )
    `
  ).run();

  await env.DB.prepare(
    `
      CREATE INDEX IF NOT EXISTS
      idx_ecommerce_variants_account_product
      ON ecommerce_product_variants(
        account_id,
        product_id
      )
    `
  ).run();

  await env.DB.prepare(
    `
      CREATE INDEX IF NOT EXISTS
      idx_ecommerce_stock_account_product
      ON ecommerce_stock_movements(
        account_id,
        product_id
      )
    `
  ).run();

  await env.DB.prepare(
    `
      CREATE INDEX IF NOT EXISTS
      idx_ecommerce_related_account_product
      ON ecommerce_related_products(
        account_id,
        product_id
      )
    `
  ).run();

  await env.DB.prepare(
    `
      CREATE INDEX IF NOT EXISTS
      idx_ecommerce_orders_account
      ON ecommerce_orders(account_id)
    `
  ).run();

  await env.DB.prepare(
    `
      CREATE INDEX IF NOT EXISTS
      idx_ecommerce_order_items_order
      ON ecommerce_order_items(
        account_id,
        order_id
      )
    `
  ).run();

  /*
   * ----------------------------------------------------------
   * REPAIR / UPGRADE OLDER ECOMMERCE INSTALLATIONS
   * ----------------------------------------------------------
   */

  if (await tableExists(env, "ecommerce_stores")) {
    await ensureColumn(
      env,
      "ecommerce_stores",
      "slug",
      "TEXT"
    );

    await ensureColumn(
      env,
      "ecommerce_stores",
      "logo_url",
      "TEXT"
    );

    await ensureColumn(
      env,
      "ecommerce_stores",
      "favicon_url",
      "TEXT"
    );

    await ensureColumn(
      env,
      "ecommerce_stores",
      "primary_color",
      "TEXT"
    );

    await ensureColumn(
      env,
      "ecommerce_stores",
      "secondary_color",
      "TEXT"
    );

    await ensureColumn(
      env,
      "ecommerce_stores",
      "design_code",
      "TEXT"
    );

    await ensureColumn(
      env,
      "ecommerce_stores",
      "domain",
      "TEXT"
    );

    await ensureColumn(
      env,
      "ecommerce_stores",
      "custom_domain",
      "TEXT"
    );

    await ensureColumn(
      env,
      "ecommerce_stores",
      "published",
      "INTEGER DEFAULT 0"
    );

    await ensureColumn(
      env,
      "ecommerce_stores",
      "checkout_enabled",
      "INTEGER DEFAULT 1"
    );

    await ensureColumn(
      env,
      "ecommerce_stores",
      "delivery_enabled",
      "INTEGER DEFAULT 1"
    );

    await ensureColumn(
      env,
      "ecommerce_stores",
      "pickup_enabled",
      "INTEGER DEFAULT 1"
    );

    await ensureColumn(
      env,
      "ecommerce_stores",
      "delivery_fee",
      "REAL DEFAULT 0"
    );

    await ensureColumn(
      env,
      "ecommerce_stores",
      "whatsapp_enabled",
      "INTEGER DEFAULT 1"
    );

    await ensureColumn(
      env,
      "ecommerce_stores",
      "whatsapp_publish_enabled",
      "INTEGER DEFAULT 1"
    );

    await ensureColumn(
      env,
      "ecommerce_stores",
      "payment_provider",
      "TEXT"
    );

    await ensureColumn(
      env,
      "ecommerce_stores",
      "payment_settings_json",
      "TEXT"
    );

    await ensureColumn(
      env,
      "ecommerce_stores",
      "delivery_settings_json",
      "TEXT"
    );
  }

  /*
   * Existing categories may not have parent_id.
   */

  if (await tableExists(env, "ecommerce_categories")) {
    await ensureColumn(
      env,
      "ecommerce_categories",
      "parent_id",
      "INTEGER"
    );

    await ensureColumn(
      env,
      "ecommerce_categories",
      "image_url",
      "TEXT"
    );

    await ensureColumn(
      env,
      "ecommerce_categories",
      "sort_order",
      "INTEGER DEFAULT 0"
    );

    await ensureColumn(
      env,
      "ecommerce_categories",
      "active",
      "INTEGER DEFAULT 1"
    );
  }

  /*
   * Existing media table upgrades.
   */

  if (await tableExists(env, "ecommerce_product_media")) {
    await ensureColumn(
      env,
      "ecommerce_product_media",
      "thumbnail_url",
      "TEXT"
    );

    await ensureColumn(
      env,
      "ecommerce_product_media",
      "mime_type",
      "TEXT"
    );

    await ensureColumn(
      env,
      "ecommerce_product_media",
      "alt_text",
      "TEXT"
    );

    await ensureColumn(
      env,
      "ecommerce_product_media",
      "caption",
      "TEXT"
    );

    await ensureColumn(
      env,
      "ecommerce_product_media",
      "sort_order",
      "INTEGER DEFAULT 0"
    );

    await ensureColumn(
      env,
      "ecommerce_product_media",
      "is_primary",
      "INTEGER DEFAULT 0"
    );

    await ensureColumn(
      env,
      "ecommerce_product_media",
      "whatsapp_publish",
      "INTEGER DEFAULT 0"
    );

    await ensureColumn(
      env,
      "ecommerce_product_media",
      "active",
      "INTEGER DEFAULT 1"
    );
  }

    await env.DB.prepare(
    `
      CREATE INDEX IF NOT EXISTS
      idx_ecommerce_categories_parent
      ON ecommerce_categories(account_id, parent_id)
    `
  ).run();

  /*
   * Existing orders table upgrades.
   */

  if (await tableExists(env, "ecommerce_orders")) {
    await ensureColumn(
      env,
      "ecommerce_orders",
      "discount_amount",
      "REAL DEFAULT 0"
    );

    await ensureColumn(
      env,
      "ecommerce_orders",
      "tax_amount",
      "REAL DEFAULT 0"
    );

    await ensureColumn(
      env,
      "ecommerce_orders",
      "payment_reference",
      "TEXT"
    );

    await ensureColumn(
      env,
      "ecommerce_orders",
      "whatsapp_status",
      "TEXT"
    );
  }
}

/* ============================================================
 * ENSURE / UPGRADE PRODUCTS
 *
 * Products live in saas_products because the Sky Blue SaaS
 * core already uses this table for business products.
 * ============================================================
 */

export async function ensureEcommerceProductColumns(env) {
  if (!(await tableExists(env, "saas_products"))) {
    return false;
  }

  const columns = [
    ["sku", "TEXT"],
    ["barcode", "TEXT"],
    ["short_description", "TEXT"],
    ["full_description", "TEXT"],
    ["cost_price", "REAL DEFAULT 0"],
    ["selling_price", "REAL DEFAULT 0"],
    ["sale_price", "REAL"],
    ["tax_rate", "REAL DEFAULT 0"],
    ["tax_inclusive", "INTEGER DEFAULT 1"],
    ["stock_quantity", "INTEGER DEFAULT 0"],
    ["low_stock_threshold", "INTEGER DEFAULT 0"],
    ["stock_status", "TEXT DEFAULT 'in_stock'"],
    ["category_id", "INTEGER"],
    ["subcategory_id", "INTEGER"],
    ["brand", "TEXT"],
    ["product_type", "TEXT DEFAULT 'physical'"],
    ["featured", "INTEGER DEFAULT 0"],
    ["digital_file_url", "TEXT"],
    ["weight", "REAL DEFAULT 0"],
    ["length", "REAL DEFAULT 0"],
    ["width", "REAL DEFAULT 0"],
    ["height", "REAL DEFAULT 0"],
    ["delivery_enabled", "INTEGER DEFAULT 1"],
    ["delivery_fee", "REAL DEFAULT 0"],
    ["seo_title", "TEXT"],
    ["seo_description", "TEXT"],
    ["seo_keywords", "TEXT"],
    ["product_slug", "TEXT"],
    ["visibility", "TEXT DEFAULT 'active'"],
    ["related_products_json", "TEXT"],
    ["tags_json", "TEXT"],
    ["attributes_json", "TEXT"],
    ["created_at", "TEXT DEFAULT CURRENT_TIMESTAMP"],
    ["updated_at", "TEXT DEFAULT CURRENT_TIMESTAMP"]
  ];

  for (const [column, definition] of columns) {
    await ensureColumn(
      env,
      "saas_products",
      column,
      definition
    );
  }

  return true;
}

/* ============================================================
 * STORE
 * ============================================================
 */

export async function getEcommerceStore(
  env,
  accountId
) {
  const account = accountNumber(accountId);

  await ensureEcommerceTables(env);

  return env.DB.prepare(
    `
      SELECT *
      FROM ecommerce_stores
      WHERE account_id = ?
      LIMIT 1
    `
  )
    .bind(account)
    .first();
}

export async function saveEcommerceStore(
  env,
  accountId,
  data = {}
) {
  const account = accountNumber(accountId);

  await ensureEcommerceTables(env);

  const existing = await getEcommerceStore(
    env,
    account
  );

  const storeName = clean(
    data.store_name ??
      data.name ??
      existing?.store_name
  );

  if (!storeName) {
    throw new Error("Store name is required");
  }

  const slug = uniqueSlug(
    data.slug ??
      data.store_slug ??
      storeName
  );

  const email = clean(
    data.email ??
      existing?.email
  );

  const phone = clean(
    data.phone ??
      data.store_phone ??
      existing?.phone
  );

  const whatsapp = clean(
    data.whatsapp ??
      data.whatsapp_number ??
      phone ??
      existing?.whatsapp
  );

  const currency = clean(
    data.currency ??
      existing?.currency ??
      "ZAR"
  );

  const description = clean(
    data.description ??
      existing?.description
  );

  const logoUrl = clean(
    data.logo_url ??
      existing?.logo_url
  );

  const faviconUrl = clean(
    data.favicon_url ??
      existing?.favicon_url
  );

  const primaryColor = clean(
    data.primary_color ??
      existing?.primary_color
  );

  const secondaryColor = clean(
    data.secondary_color ??
      existing?.secondary_color
  );

  const designCode = clean(
    data.design_code ??
      existing?.design_code
  );

  const domain = clean(
    data.domain ??
      existing?.domain
  );

  const customDomain = clean(
    data.custom_domain ??
      existing?.custom_domain
  );

  const status = clean(
    data.status ??
      existing?.status ??
      "active"
  );

  const published = booleanValue(
    data.published,
    booleanValue(existing?.published, false)
  );

  const checkoutEnabled = booleanValue(
    data.checkout_enabled,
    booleanValue(existing?.checkout_enabled, true)
  );

  const deliveryEnabled = booleanValue(
    data.delivery_enabled,
    booleanValue(existing?.delivery_enabled, true)
  );

  const pickupEnabled = booleanValue(
    data.pickup_enabled,
    booleanValue(existing?.pickup_enabled, true)
  );

  const deliveryFee = money(
    data.delivery_fee ??
      existing?.delivery_fee ??
      0
  );

  const whatsappEnabled = booleanValue(
    data.whatsapp_enabled,
    booleanValue(existing?.whatsapp_enabled, true)
  );

  const whatsappPublishEnabled = booleanValue(
    data.whatsapp_publish_enabled,
    booleanValue(
      existing?.whatsapp_publish_enabled,
      true
    )
  );

  const paymentProvider = clean(
    data.payment_provider ??
      existing?.payment_provider
  );

  const paymentSettings = JSON.stringify(
    data.payment_settings ??
      parseJSON(
        existing?.payment_settings_json,
        {}
      )
  );

  const deliverySettings = JSON.stringify(
    data.delivery_settings ??
      parseJSON(
        existing?.delivery_settings_json,
        {}
      )
  );

  if (existing) {
    await env.DB.prepare(
      `
        UPDATE ecommerce_stores
        SET
          store_name = ?,
          slug = ?,
          email = ?,
          phone = ?,
          whatsapp = ?,
          currency = ?,
          description = ?,
          logo_url = ?,
          favicon_url = ?,
          primary_color = ?,
          secondary_color = ?,
          design_code = ?,
          domain = ?,
          custom_domain = ?,
          status = ?,
          published = ?,
          checkout_enabled = ?,
          delivery_enabled = ?,
          pickup_enabled = ?,
          delivery_fee = ?,
          whatsapp_enabled = ?,
          whatsapp_publish_enabled = ?,
          payment_provider = ?,
          payment_settings_json = ?,
          delivery_settings_json = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE account_id = ?
      `
    )
      .bind(
        storeName,
        slug,
        email,
        phone,
        whatsapp,
        currency,
        description,
        logoUrl,
        faviconUrl,
        primaryColor,
        secondaryColor,
        designCode,
        domain,
        customDomain,
        status,
        published ? 1 : 0,
        checkoutEnabled ? 1 : 0,
        deliveryEnabled ? 1 : 0,
        pickupEnabled ? 1 : 0,
        deliveryFee,
        whatsappEnabled ? 1 : 0,
        whatsappPublishEnabled ? 1 : 0,
        paymentProvider,
        paymentSettings,
        deliverySettings,
        account
      )
      .run();
  } else {
    await env.DB.prepare(
      `
        INSERT INTO ecommerce_stores (
          account_id,
          store_name,
          slug,
          email,
          phone,
          whatsapp,
          currency,
          description,
          logo_url,
          favicon_url,
          primary_color,
          secondary_color,
          design_code,
          domain,
          custom_domain,
          status,
          published,
          checkout_enabled,
          delivery_enabled,
          pickup_enabled,
          delivery_fee,
          whatsapp_enabled,
          whatsapp_publish_enabled,
          payment_provider,
          payment_settings_json,
          delivery_settings_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
      .bind(
        account,
        storeName,
        slug,
        email,
        phone,
        whatsapp,
        currency,
        description,
        logoUrl,
        faviconUrl,
        primaryColor,
        secondaryColor,
        designCode,
        domain,
        customDomain,
        status,
        published ? 1 : 0,
        checkoutEnabled ? 1 : 0,
        deliveryEnabled ? 1 : 0,
        pickupEnabled ? 1 : 0,
        deliveryFee,
        whatsappEnabled ? 1 : 0,
        whatsappPublishEnabled ? 1 : 0,
        paymentProvider,
        paymentSettings,
        deliverySettings
      )
      .run();
  }

  return getEcommerceStore(
    env,
    account
  );
}

/* ============================================================
 * CATEGORIES
 * ============================================================
 */

export async function listEcommerceCategories(
  env,
  accountId,
  options = {}
) {
  const account = accountNumber(accountId);

  await ensureEcommerceTables(env);

  const activeOnly = booleanValue(
    options.active_only,
    false
  );

  if (activeOnly) {
    return env.DB.prepare(
      `
        SELECT *
        FROM ecommerce_categories
        WHERE account_id = ?
          AND active = 1
        ORDER BY
          sort_order ASC,
          name ASC
      `
    )
      .bind(account)
      .all();
  }

  return env.DB.prepare(
    `
      SELECT *
      FROM ecommerce_categories
      WHERE account_id = ?
      ORDER BY
        sort_order ASC,
        name ASC
    `
  )
    .bind(account)
    .all();
}

export async function createEcommerceCategory(
  env,
  accountId,
  data = {}
) {
  const account = accountNumber(accountId);

  await ensureEcommerceTables(env);

  const name = clean(data.name);

  if (!name) {
    throw new Error("Category name is required");
  }

  const slug = uniqueSlug(
    data.slug || name
  );

  const parentId = data.parent_id
    ? positiveId(data.parent_id, "parent_id")
    : null;

  const description = clean(
    data.description
  );

  const imageUrl = clean(
    data.image_url
  );

  const sortOrder = integerValue(
    data.sort_order,
    0
  );

  const active = booleanValue(
    data.active,
    true
  );

  const result = await env.DB.prepare(
    `
      INSERT INTO ecommerce_categories (
        account_id,
        parent_id,
        name,
        slug,
        description,
        image_url,
        sort_order,
        active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      account,
      parentId,
      name,
      slug,
      description,
      imageUrl,
      sortOrder,
      active ? 1 : 0
    )
    .run();

  return env.DB.prepare(
    `
      SELECT *
      FROM ecommerce_categories
      WHERE id = ?
        AND account_id = ?
    `
  )
    .bind(
      result.meta.last_row_id,
      account
    )
    .first();
}

export async function updateEcommerceCategory(
  env,
  accountId,
  categoryId,
  data = {}
) {
  const account = accountNumber(accountId);
  const id = positiveId(
    categoryId,
    "category_id"
  );

  await ensureEcommerceTables(env);

  const existing = await env.DB.prepare(
    `
      SELECT *
      FROM ecommerce_categories
      WHERE id = ?
        AND account_id = ?
      LIMIT 1
    `
  )
    .bind(id, account)
    .first();

  if (!existing) {
    throw new Error("Category not found");
  }

  const name = clean(
    data.name ??
      existing.name
  );

  const slug = uniqueSlug(
    data.slug ??
      existing.slug ??
      name
  );

  const parentId =
    data.parent_id === null
      ? null
      : data.parent_id !== undefined
      ? positiveId(
          data.parent_id,
          "parent_id"
        )
      : existing.parent_id;

  const description = clean(
    data.description ??
      existing.description
  );

  const imageUrl = clean(
    data.image_url ??
      existing.image_url
  );

  const sortOrder = integerValue(
    data.sort_order ??
      existing.sort_order,
    0
  );

  const active = booleanValue(
    data.active,
    booleanValue(existing.active, true)
  );

  await env.DB.prepare(
    `
      UPDATE ecommerce_categories
      SET
        parent_id = ?,
        name = ?,
        slug = ?,
        description = ?,
        image_url = ?,
        sort_order = ?,
        active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND account_id = ?
    `
  )
    .bind(
      parentId,
      name,
      slug,
      description,
      imageUrl,
      sortOrder,
      active ? 1 : 0,
      id,
      account
    )
    .run();

  return env.DB.prepare(
    `
      SELECT *
      FROM ecommerce_categories
      WHERE id = ?
        AND account_id = ?
    `
  )
    .bind(id, account)
    .first();
}

export async function deleteEcommerceCategory(
  env,
  accountId,
  categoryId
) {
  const account = accountNumber(accountId);
  const id = positiveId(
    categoryId,
    "category_id"
  );

  await ensureEcommerceTables(env);

  await env.DB.prepare(
    `
      UPDATE ecommerce_categories
      SET
        active = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND account_id = ?
    `
  )
    .bind(id, account)
    .run();

  return {
    success: true,
    id,
    deleted: true
  };
}

/* ============================================================
 * PRODUCT HELPERS
 * ============================================================
 */

function productStockStatus(
  quantity,
  threshold
) {
  const stock = integerValue(quantity, 0);
  const low = integerValue(threshold, 0);

  if (stock <= 0) {
    return "out_of_stock";
  }

  if (low > 0 && stock <= low) {
    return "low_stock";
  }

  return "in_stock";
}

async function getProductById(
  env,
  accountId,
  productId
) {
  const account = accountNumber(accountId);
  const id = positiveId(
    productId,
    "product_id"
  );

  return env.DB.prepare(
    `
      SELECT *
      FROM saas_products
      WHERE id = ?
        AND account_id = ?
      LIMIT 1
    `
  )
    .bind(id, account)
    .first();
}

async function getProductVariants(
  env,
  accountId,
  productId
) {
  const account = accountNumber(accountId);
  const id = positiveId(
    productId,
    "product_id"
  );

  return env.DB.prepare(
    `
      SELECT *
      FROM ecommerce_product_variants
      WHERE account_id = ?
        AND product_id = ?
      ORDER BY
        id ASC
    `
  )
    .bind(account, id)
    .all();
}

async function getProductMedia(
  env,
  accountId,
  productId
) {
  const account = accountNumber(accountId);
  const id = positiveId(
    productId,
    "product_id"
  );

  return env.DB.prepare(
    `
      SELECT *
      FROM ecommerce_product_media
      WHERE account_id = ?
        AND product_id = ?
      ORDER BY
        sort_order ASC,
        id ASC
    `
  )
    .bind(account, id)
    .all();
}

async function getRelatedProducts(
  env,
  accountId,
  productId
) {
  const account = accountNumber(accountId);
  const id = positiveId(
    productId,
    "product_id"
  );

  return env.DB.prepare(
    `
      SELECT
        rp.*,
        p.name,
        p.sku,
        p.selling_price,
        p.sale_price,
        p.product_slug
      FROM ecommerce_related_products rp
      LEFT JOIN saas_products p
        ON p.id = rp.related_product_id
       AND p.account_id = rp.account_id
      WHERE rp.account_id = ?
        AND rp.product_id = ?
      ORDER BY
        rp.sort_order ASC,
        rp.id ASC
    `
  )
    .bind(account, id)
    .all();
}

/* ============================================================
 * PRODUCT LIST
 * ============================================================
 */

export async function listEcommerceProducts(
  env,
  accountId,
  options = {}
) {
  const account = accountNumber(accountId);

  await ensureEcommerceTables(env);
  await ensureEcommerceProductColumns(env);

  const search = clean(
    options.search
  );

  const categoryId = options.category_id
    ? Number(options.category_id)
    : null;

  const status = clean(
    options.status ??
      options.visibility
  );

  const featured =
    options.featured !== undefined
      ? booleanValue(options.featured)
      : null;

  const limit = Math.min(
    Math.max(
      integerValue(options.limit, 100),
      1
    ),
    500
  );

  const offset = Math.max(
    integerValue(options.offset, 0),
    0
  );

  let sql = `
    SELECT
      p.*,

      c.name AS category_name,

      sc.name AS subcategory_name,

      (
        SELECT media_url
        FROM ecommerce_product_media m
        WHERE m.account_id = p.account_id
          AND m.product_id = p.id
          AND m.active = 1
        ORDER BY
          m.is_primary DESC,
          m.sort_order ASC,
          m.id ASC
        LIMIT 1
      ) AS primary_media_url,

      (
        SELECT media_type
        FROM ecommerce_product_media m
        WHERE m.account_id = p.account_id
          AND m.product_id = p.id
          AND m.active = 1
        ORDER BY
          m.is_primary DESC,
          m.sort_order ASC,
          m.id ASC
        LIMIT 1
      ) AS primary_media_type

    FROM saas_products p

    LEFT JOIN ecommerce_categories c
      ON c.id = p.category_id
     AND c.account_id = p.account_id

    LEFT JOIN ecommerce_categories sc
      ON sc.id = p.subcategory_id
     AND sc.account_id = p.account_id

    WHERE p.account_id = ?
      AND p.module_code = 'ecommerce'
  `;

  const bindings = [account];

  if (search) {
    sql += `
      AND (
        p.name LIKE ?
        OR p.sku LIKE ?
        OR p.barcode LIKE ?
        OR p.brand LIKE ?
        OR p.short_description LIKE ?
        OR p.full_description LIKE ?
      )
    `;

    const term = `%${search}%`;

    bindings.push(
      term,
      term,
      term,
      term,
      term,
      term
    );
  }

  if (categoryId) {
    sql += `
      AND (
        p.category_id = ?
        OR p.subcategory_id = ?
      )
    `;

    bindings.push(
      categoryId,
      categoryId
    );
  }

  if (status) {
    sql += `
      AND (
        p.visibility = ?
        OR p.status = ?
      )
    `;

    bindings.push(
      status,
      status
    );
  }

  if (featured !== null) {
    sql += `
      AND p.featured = ?
    `;

    bindings.push(
      featured ? 1 : 0
    );
  }

  sql += `
    ORDER BY
      p.updated_at DESC,
      p.id DESC
    LIMIT ?
    OFFSET ?
  `;

  bindings.push(
    limit,
    offset
  );

  return env.DB.prepare(sql)
    .bind(...bindings)
    .all();
}

/* ============================================================
 * GET COMPLETE PRODUCT
 * ============================================================
 */

export async function getEcommerceProduct(
  env,
  accountId,
  productId
) {
  const account = accountNumber(accountId);
  const id = positiveId(
    productId,
    "product_id"
  );

  await ensureEcommerceTables(env);
  await ensureEcommerceProductColumns(env);

  const product = await getProductById(
    env,
    account,
    id
  );

  if (!product) {
    return null;
  }

  const [
    variants,
    media,
    related
  ] = await Promise.all([
    getProductVariants(
      env,
      account,
      id
    ),
    getProductMedia(
      env,
      account,
      id
    ),
    getRelatedProducts(
      env,
      account,
      id
    )
  ]);

  return {
    ...product,

    tax_inclusive: booleanValue(
      product.tax_inclusive,
      true
    ),

    featured: booleanValue(
      product.featured,
      false
    ),

    delivery_enabled: booleanValue(
      product.delivery_enabled,
      true
    ),

    variants: variants.results || [],

    media: media.results || [],

    related_products:
      related.results || [],

    tags: parseJSON(
      product.tags_json,
      []
    ),

    attributes: parseJSON(
      product.attributes_json,
      {}
    )
  };
}

/* ============================================================
 * CREATE PRODUCT
 * ============================================================
 */

export async function createEcommerceProduct(
  env,
  accountId,
  data = {}
) {
  const account = accountNumber(accountId);

    await ensureEcommerceTables(env);
  await ensureEcommerceProductColumns(env);

  const organisation = await env.DB.prepare(`
    SELECT o.id
    FROM customer_accounts ca
    INNER JOIN saas_organisations o
      ON o.legacy_tenant_id = ca.tenant_id
    WHERE ca.id = ?
      AND o.status = 'active'
    LIMIT 1
  `).bind(account).first();

  if (!organisation?.id) {
    throw new Error("Active organisation not found for this account");
  }

  const organisationId = Number(organisation.id);

  const name = clean(data.name);

  if (!name) {
    throw new Error("Product name is required");
  }

  const sku = clean(
    data.sku
  );

  const barcode = clean(
    data.barcode
  );

  const shortDescription = clean(
    data.short_description
  );

  const fullDescription = clean(
    data.full_description ??
      data.description
  );

  const costPrice = money(
    data.cost_price,
    0
  );

  const sellingPrice = money(
    data.selling_price ??
      data.price,
    0
  );

  const salePrice =
    data.sale_price === undefined ||
    data.sale_price === null ||
    data.sale_price === ""
      ? null
      : money(data.sale_price);

  const taxRate = money(
    data.tax_rate,
    0
  );

  const taxInclusive = booleanValue(
    data.tax_inclusive,
    true
  );

  const stockQuantity = integerValue(
    data.stock_quantity ??
      data.stock,
    0
  );

  const lowStockThreshold = integerValue(
    data.low_stock_threshold,
    0
  );

  const categoryId =
    data.category_id
      ? positiveId(
          data.category_id,
          "category_id"
        )
      : null;

  const subcategoryId =
    data.subcategory_id
      ? positiveId(
          data.subcategory_id,
          "subcategory_id"
        )
      : null;

  const brand = clean(
    data.brand
  );

  const productType = clean(
    data.product_type,
    "physical"
  );

  const featured = booleanValue(
    data.featured,
    false
  );

  const digitalFileUrl = clean(
    data.digital_file_url
  );

  const weight = money(
    data.weight,
    0
  );

  const length = money(
    data.length,
    0
  );

  const width = money(
    data.width,
    0
  );

  const height = money(
    data.height,
    0
  );

  const deliveryEnabled = booleanValue(
    data.delivery_enabled,
    true
  );

  const deliveryFee = money(
    data.delivery_fee,
    0
  );

  const visibility = clean(
    data.visibility ??
      data.status ??
      "active"
  );

  const seoTitle = clean(
    data.seo_title ??
      name
  );

  const seoDescription = clean(
    data.seo_description ??
      shortDescription
  );

  const seoKeywords = clean(
    data.seo_keywords
  );

  const productSlug = uniqueSlug(
    data.product_slug ??
      data.slug ??
      name
  );

  const tagsJSON = JSON.stringify(
    Array.isArray(data.tags)
      ? data.tags
      : parseJSON(
          data.tags_json,
          []
        )
  );

  const attributesJSON =
    JSON.stringify(
      data.attributes ??
        parseJSON(
          data.attributes_json,
          {}
        )
    );

  const relatedProductsJSON =
    JSON.stringify(
      Array.isArray(
        data.related_product_ids
      )
        ? data.related_product_ids
        : []
    );

  const stockStatus =
    productStockStatus(
      stockQuantity,
      lowStockThreshold
    );

  const result = await env.DB.prepare(
    `
      INSERT INTO saas_products (
        account_id,
        module_code,

        name,
        sku,
        barcode,

        description,
        short_description,
        full_description,

        cost_price,
        selling_price,
        sale_price,

        tax_rate,
        tax_inclusive,

        stock_quantity,
        low_stock_threshold,
        stock_status,

        category_id,
        subcategory_id,

        brand,

        product_type,
        featured,

        digital_file_url,

        weight,
        length,
        width,
        height,

        delivery_enabled,
        delivery_fee,

        seo_title,
        seo_description,
        seo_keywords,
        product_slug,

        visibility,

        related_products_json,
        tags_json,
        attributes_json,

        active
      )
      VALUES (
        ?,
        'ecommerce',

        ?,
        ?,
        ?,

        ?,
        ?,
        ?,

        ?,
        ?,
        ?,

        ?,
        ?,

        ?,
        ?,
        ?,

        ?,
        ?,

        ?,

        ?,
        ?,

        ?,

        ?,
        ?,
        ?,
        ?,

        ?,
        ?,

        ?,
        ?,
        ?,
        ?,

        ?,

        ?,
        ?,
        ?,

        1
      )
    `
  )
    .bind(
      account,

      name,
      sku,
      barcode,

      fullDescription,
      shortDescription,
      fullDescription,

      costPrice,
      sellingPrice,
      salePrice,

      taxRate,
      taxInclusive ? 1 : 0,

      stockQuantity,
      lowStockThreshold,
      stockStatus,

      categoryId,
      subcategoryId,

      brand,

      productType,
      featured ? 1 : 0,

      digitalFileUrl,

      weight,
      length,
      width,
      height,

      deliveryEnabled ? 1 : 0,
      deliveryFee,

      seoTitle,
      seoDescription,
      seoKeywords,
      productSlug,

      visibility,

      relatedProductsJSON,
      tagsJSON,
      attributesJSON
    )
    .run();

  const productId =
    result.meta.last_row_id;

  /*
   * Record opening stock.
   */

  if (stockQuantity !== 0) {
    await env.DB.prepare(
      `
        INSERT INTO ecommerce_stock_movements (
          account_id,
          product_id,
          movement_type,
          quantity,
          quantity_before,
          quantity_after,
          reason
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
      .bind(
        account,
        productId,
        "initial",
        stockQuantity,
        0,
        stockQuantity,
        "Initial product stock"
      )
      .run();
  }

  /*
   * Save media supplied during creation.
   */

  if (
    Array.isArray(data.media)
  ) {
    for (
      let index = 0;
      index < data.media.length;
      index++
    ) {
      await createEcommerceMedia(
        env,
        account,
        {
          ...data.media[index],
          product_id: productId,
          sort_order:
            data.media[index].sort_order ??
            index
        }
      );
    }
  }

  /*
   * Save variants supplied during creation.
   */

  if (
    Array.isArray(data.variants)
  ) {
    for (
      const variant of data.variants
    ) {
      await createEcommerceVariant(
        env,
        account,
        productId,
        variant
      );
    }
  }

  return getEcommerceProduct(
    env,
    account,
    productId
  );
}

/* ============================================================
 * UPDATE PRODUCT
 * ============================================================
 */

export async function updateEcommerceProduct(
  env,
  accountId,
  productId,
  data = {}
) {
  const account = accountNumber(accountId);
  const id = positiveId(
    productId,
    "product_id"
  );

  await ensureEcommerceTables(env);
  await ensureEcommerceProductColumns(env);

  const existing = await getProductById(
    env,
    account,
    id
  );

  if (!existing) {
    throw new Error("Product not found");
  }

  const name = clean(
    data.name ??
      existing.name
  );

  const sku = clean(
    data.sku ??
      existing.sku
  );

  const barcode = clean(
    data.barcode ??
      existing.barcode
  );

  const shortDescription = clean(
    data.short_description ??
      existing.short_description
  );

  const fullDescription = clean(
    data.full_description ??
      data.description ??
      existing.full_description ??
      existing.description
  );

  const costPrice = money(
    data.cost_price ??
      existing.cost_price,
    0
  );

  const sellingPrice = money(
    data.selling_price ??
      data.price ??
      existing.selling_price,
    0
  );

  let salePrice =
    existing.sale_price;

  if (
    data.sale_price !== undefined
  ) {
    salePrice =
      data.sale_price === null ||
      data.sale_price === ""
        ? null
        : money(data.sale_price);
  }

  const taxRate = money(
    data.tax_rate ??
      existing.tax_rate,
    0
  );

  const taxInclusive = booleanValue(
    data.tax_inclusive,
    booleanValue(
      existing.tax_inclusive,
      true
    )
  );

  const oldStock = integerValue(
    existing.stock_quantity,
    0
  );

  const stockQuantity =
    data.stock_quantity !== undefined
      ? integerValue(
          data.stock_quantity,
          oldStock
        )
      : oldStock;

  const lowStockThreshold =
    integerValue(
      data.low_stock_threshold ??
        existing.low_stock_threshold,
      0
    );

  const categoryId =
    data.category_id === null
      ? null
      : data.category_id !== undefined
      ? positiveId(
          data.category_id,
          "category_id"
        )
      : existing.category_id;

  const subcategoryId =
    data.subcategory_id === null
      ? null
      : data.subcategory_id !== undefined
      ? positiveId(
          data.subcategory_id,
          "subcategory_id"
        )
      : existing.subcategory_id;

  const brand = clean(
    data.brand ??
      existing.brand
  );

  const productType = clean(
    data.product_type ??
      existing.product_type ??
      "physical"
  );

  const featured = booleanValue(
    data.featured,
    booleanValue(
      existing.featured,
      false
    )
  );

  const digitalFileUrl = clean(
    data.digital_file_url ??
      existing.digital_file_url
  );

  const weight = money(
    data.weight ??
      existing.weight,
    0
  );

  const length = money(
    data.length ??
      existing.length,
    0
  );

  const width = money(
    data.width ??
      existing.width,
    0
  );

  const height = money(
    data.height ??
      existing.height,
    0
  );

  const deliveryEnabled =
    booleanValue(
      data.delivery_enabled,
      booleanValue(
        existing.delivery_enabled,
        true
      )
    );

  const deliveryFee = money(
    data.delivery_fee ??
      existing.delivery_fee,
    0
  );

  const visibility = clean(
    data.visibility ??
      data.status ??
      existing.visibility ??
      existing.status ??
      "active"
  );

  const seoTitle = clean(
    data.seo_title ??
      existing.seo_title ??
      name
  );

  const seoDescription = clean(
    data.seo_description ??
      existing.seo_description ??
      shortDescription
  );

  const seoKeywords = clean(
    data.seo_keywords ??
      existing.seo_keywords
  );

  const productSlug = uniqueSlug(
    data.product_slug ??
      data.slug ??
      existing.product_slug ??
      name
  );

  const tagsJSON =
    data.tags !== undefined
      ? JSON.stringify(data.tags)
      : data.tags_json !== undefined
      ? clean(data.tags_json)
      : existing.tags_json;

  const attributesJSON =
    data.attributes !== undefined
      ? JSON.stringify(
          data.attributes
        )
      : data.attributes_json !== undefined
      ? clean(data.attributes_json)
      : existing.attributes_json;

  const relatedProductsJSON =
    data.related_product_ids !==
    undefined
      ? JSON.stringify(
          data.related_product_ids
        )
      : existing.related_products_json;

  const stockStatus =
    productStockStatus(
      stockQuantity,
      lowStockThreshold
    );

  await env.DB.prepare(
    `
      UPDATE saas_products
      SET
        name = ?,
        sku = ?,
        barcode = ?,

        description = ?,
        short_description = ?,
        full_description = ?,

        cost_price = ?,
        selling_price = ?,
        sale_price = ?,

        tax_rate = ?,
        tax_inclusive = ?,

        stock_quantity = ?,
        low_stock_threshold = ?,
        stock_status = ?,

        category_id = ?,
        subcategory_id = ?,

        brand = ?,

        product_type = ?,
        featured = ?,

        digital_file_url = ?,

        weight = ?,
        length = ?,
        width = ?,
        height = ?,

        delivery_enabled = ?,
        delivery_fee = ?,

        seo_title = ?,
        seo_description = ?,
        seo_keywords = ?,
        product_slug = ?,

        visibility = ?,

        related_products_json = ?,
        tags_json = ?,
        attributes_json = ?,

        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND account_id = ?
        AND module_code = 'ecommerce'
    `
  )
    .bind(
      name,
      sku,
      barcode,

      fullDescription,
      shortDescription,
      fullDescription,

      costPrice,
      sellingPrice,
      salePrice,

      taxRate,
      taxInclusive ? 1 : 0,

      stockQuantity,
      lowStockThreshold,
      stockStatus,

      categoryId,
      subcategoryId,

      brand,

      productType,
      featured ? 1 : 0,

      digitalFileUrl,

      weight,
      length,
      width,
      height,

      deliveryEnabled ? 1 : 0,
      deliveryFee,

      seoTitle,
      seoDescription,
      seoKeywords,
      productSlug,

      visibility,

      relatedProductsJSON,
      tagsJSON,
      attributesJSON,

      id,
      account
    )
    .run();

  /*
   * Stock history.
   */

  if (stockQuantity !== oldStock) {
    const difference =
      stockQuantity - oldStock;

    await env.DB.prepare(
      `
        INSERT INTO ecommerce_stock_movements (
          account_id,
          product_id,
          movement_type,
          quantity,
          quantity_before,
          quantity_after,
          reason
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
      .bind(
        account,
        id,
        "adjustment",
        difference,
        oldStock,
        stockQuantity,
        clean(
          data.stock_reason,
          "Product stock adjustment"
        )
      )
      .run();
  }

  /*
   * Replace submitted variants when supplied.
   */

  if (
    Array.isArray(data.variants)
  ) {
    await env.DB.prepare(
      `
        UPDATE ecommerce_product_variants
        SET active = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE account_id = ?
          AND product_id = ?
      `
    )
      .bind(account, id)
      .run();

    for (
      const variant of data.variants
    ) {
      await createEcommerceVariant(
        env,
        account,
        id,
        variant
      );
    }
  }

  /*
   * Add media when supplied.
   */

  if (
    Array.isArray(data.media)
  ) {
    for (
      let index = 0;
      index < data.media.length;
      index++
    ) {
      await createEcommerceMedia(
        env,
        account,
        {
          ...data.media[index],
          product_id: id,
          sort_order:
            data.media[index].sort_order ??
            index
        }
      );
    }
  }

  return getEcommerceProduct(
    env,
    account,
    id
  );
}

/* ============================================================
 * ARCHIVE / DELETE PRODUCT
 * ============================================================
 */

export async function deleteEcommerceProduct(
  env,
  accountId,
  productId
) {
  const account = accountNumber(accountId);
  const id = positiveId(
    productId,
    "product_id"
  );

  await ensureEcommerceTables(env);
  await ensureEcommerceProductColumns(env);

  const product = await getProductById(
    env,
    account,
    id
  );

  if (!product) {
    throw new Error("Product not found");
  }

  await env.DB.prepare(
    `
      UPDATE saas_products
      SET
        active = 0,
        visibility = 'hidden',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND account_id = ?
        AND module_code = 'ecommerce'
    `
  )
    .bind(id, account)
    .run();

  await env.DB.prepare(
    `
      UPDATE ecommerce_product_media
      SET
        active = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE product_id = ?
        AND account_id = ?
    `
  )
    .bind(id, account)
    .run();

  await env.DB.prepare(
    `
      UPDATE ecommerce_product_variants
      SET
        active = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE product_id = ?
        AND account_id = ?
    `
  )
    .bind(id, account)
    .run();

  return {
    success: true,
    id,
    archived: true
  };
}

/* ============================================================
 * PRODUCT VARIANTS
 * ============================================================
 */

export async function listEcommerceVariants(
  env,
  accountId,
  productId
) {
  const account = accountNumber(accountId);
  const id = positiveId(
    productId,
    "product_id"
  );

  await ensureEcommerceTables(env);

  return env.DB.prepare(
    `
      SELECT *
      FROM ecommerce_product_variants
      WHERE account_id = ?
        AND product_id = ?
        AND active = 1
      ORDER BY id ASC
    `
  )
    .bind(account, id)
    .all();
}

export async function createEcommerceVariant(
  env,
  accountId,
  productId,
  data = {}
) {
  const account = accountNumber(accountId);
  const id = positiveId(
    productId,
    "product_id"
  );

  await ensureEcommerceTables(env);

  const product =
    await getProductById(
      env,
      account,
      id
    );

  if (!product) {
    throw new Error("Product not found");
  }

  const variantName = clean(
    data.variant_name ??
      data.name
  );

  const sku = clean(
    data.sku
  );

  const barcode = clean(
    data.barcode
  );

  const optionValues =
    data.option_values ??
    data.options ??
    {};

  const costPrice = money(
    data.cost_price ??
      product.cost_price,
    0
  );

  const sellingPrice = money(
    data.selling_price ??
      product.selling_price,
    0
  );

  const salePrice =
    data.sale_price === undefined ||
    data.sale_price === null ||
    data.sale_price === ""
      ? null
      : money(data.sale_price);

  const taxRate = money(
    data.tax_rate ??
      product.tax_rate,
    0
  );

  const stockQuantity = integerValue(
    data.stock_quantity ??
      data.stock,
    0
  );

  const lowStockThreshold =
    integerValue(
      data.low_stock_threshold,
      0
    );

  const weight = money(
    data.weight,
    0
  );

  const length = money(
    data.length,
    0
  );

  const width = money(
    data.width,
    0
  );

  const height = money(
    data.height,
    0
  );

  const result = await env.DB.prepare(
    `
      INSERT INTO ecommerce_product_variants (
        account_id,
        product_id,
        variant_name,
        sku,
        barcode,
        option_values_json,
        cost_price,
        selling_price,
        sale_price,
        tax_rate,
        stock_quantity,
        low_stock_threshold,
        weight,
        length,
        width,
        height,
        active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `
  )
    .bind(
      account,
      id,
      variantName,
      sku,
      barcode,
      JSON.stringify(optionValues),
      costPrice,
      sellingPrice,
      salePrice,
      taxRate,
      stockQuantity,
      lowStockThreshold,
      weight,
      length,
      width,
      height
    )
    .run();

  if (stockQuantity !== 0) {
    await env.DB.prepare(
      `
        INSERT INTO ecommerce_stock_movements (
          account_id,
          product_id,
          variant_id,
          movement_type,
          quantity,
          quantity_before,
          quantity_after,
          reason
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
      .bind(
        account,
        id,
        result.meta.last_row_id,
        "initial",
        stockQuantity,
        0,
        stockQuantity,
        "Initial variant stock"
      )
      .run();
  }

  return env.DB.prepare(
    `
      SELECT *
      FROM ecommerce_product_variants
      WHERE id = ?
        AND account_id = ?
    `
  )
    .bind(
      result.meta.last_row_id,
      account
    )
    .first();
}

export async function updateEcommerceVariant(
  env,
  accountId,
  variantId,
  data = {}
) {
  const account = accountNumber(accountId);
  const id = positiveId(
    variantId,
    "variant_id"
  );

  await ensureEcommerceTables(env);

  const existing = await env.DB.prepare(
    `
      SELECT *
      FROM ecommerce_product_variants
      WHERE id = ?
        AND account_id = ?
      LIMIT 1
    `
  )
    .bind(id, account)
    .first();

  if (!existing) {
    throw new Error("Variant not found");
  }

  const oldStock = integerValue(
    existing.stock_quantity,
    0
  );

  const stockQuantity =
    data.stock_quantity !== undefined
      ? integerValue(
          data.stock_quantity,
          oldStock
        )
      : oldStock;

  await env.DB.prepare(
    `
      UPDATE ecommerce_product_variants
      SET
        variant_name = ?,
        sku = ?,
        barcode = ?,
        option_values_json = ?,
        cost_price = ?,
        selling_price = ?,
        sale_price = ?,
        tax_rate = ?,
        stock_quantity = ?,
        low_stock_threshold = ?,
        weight = ?,
        length = ?,
        width = ?,
        height = ?,
        active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND account_id = ?
    `
  )
    .bind(
      clean(
        data.variant_name ??
          data.name ??
          existing.variant_name
      ),

      clean(
        data.sku ??
          existing.sku
      ),

      clean(
        data.barcode ??
          existing.barcode
      ),

      JSON.stringify(
        data.option_values ??
          data.options ??
          parseJSON(
            existing.option_values_json,
            {}
          )
      ),

      money(
        data.cost_price ??
          existing.cost_price,
        0
      ),

      money(
        data.selling_price ??
          existing.selling_price,
        0
      ),

      data.sale_price === undefined
        ? existing.sale_price
        : data.sale_price === null ||
          data.sale_price === ""
        ? null
        : money(data.sale_price),

      money(
        data.tax_rate ??
          existing.tax_rate,
        0
      ),

      stockQuantity,

      integerValue(
        data.low_stock_threshold ??
          existing.low_stock_threshold,
        0
      ),

      money(
        data.weight ??
          existing.weight,
        0
      ),

      money(
        data.length ??
          existing.length,
        0
      ),

      money(
        data.width ??
          existing.width,
        0
      ),

      money(
        data.height ??
          existing.height,
        0
      ),

      booleanValue(
        data.active,
        booleanValue(
          existing.active,
          true
        )
      )
        ? 1
        : 0,

      id,
      account
    )
    .run();

  if (stockQuantity !== oldStock) {
    const difference =
      stockQuantity - oldStock;

    await env.DB.prepare(
      `
        INSERT INTO ecommerce_stock_movements (
          account_id,
          product_id,
          variant_id,
          movement_type,
          quantity,
          quantity_before,
          quantity_after,
          reason
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
      .bind(
        account,
        existing.product_id,
        id,
        "adjustment",
        difference,
        oldStock,
        stockQuantity,
        clean(
          data.stock_reason,
          "Variant stock adjustment"
        )
      )
      .run();
  }

  return env.DB.prepare(
    `
      SELECT *
      FROM ecommerce_product_variants
      WHERE id = ?
        AND account_id = ?
    `
  )
    .bind(id, account)
    .first();
}

export async function deleteEcommerceVariant(
  env,
  accountId,
  variantId
) {
  const account = accountNumber(accountId);
  const id = positiveId(
    variantId,
    "variant_id"
  );

  await ensureEcommerceTables(env);

  await env.DB.prepare(
    `
      UPDATE ecommerce_product_variants
      SET
        active = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND account_id = ?
    `
  )
    .bind(id, account)
    .run();

  return {
    success: true,
    id,
    deleted: true
  };
}

/* ============================================================
 * MEDIA
 * ============================================================
 */

export async function listEcommerceMedia(
  env,
  accountId,
  productId
) {
  const account = accountNumber(accountId);

  await ensureEcommerceTables(env);

  if (productId) {
    const id = positiveId(
      productId,
      "product_id"
    );

    return env.DB.prepare(
      `
        SELECT *
        FROM ecommerce_product_media
        WHERE account_id = ?
          AND product_id = ?
        ORDER BY
          sort_order ASC,
          id ASC
      `
    )
      .bind(account, id)
      .all();
  }

  return env.DB.prepare(
    `
      SELECT *
      FROM ecommerce_product_media
      WHERE account_id = ?
      ORDER BY
        product_id ASC,
        sort_order ASC,
        id ASC
    `
  )
    .bind(account)
    .all();
}

export async function createEcommerceMedia(
  env,
  accountId,
  data = {}
) {
  const account = accountNumber(accountId);

  await ensureEcommerceTables(env);

  const productId = positiveId(
    data.product_id,
    "product_id"
  );

  const product =
    await getProductById(
      env,
      account,
      productId
    );

  if (!product) {
    throw new Error("Product not found");
  }

  const mediaType = clean(
    data.media_type ??
      data.type ??
      "image"
  ).toLowerCase();

  if (
    mediaType !== "image" &&
    mediaType !== "video"
  ) {
    throw new Error(
      "media_type must be image or video"
    );
  }

  const mediaUrl = clean(
    data.media_url ??
      data.url
  );

  if (!mediaUrl) {
    throw new Error("Media URL is required");
  }

  const thumbnailUrl = clean(
    data.thumbnail_url
  );

  const mimeType = clean(
    data.mime_type
  );

  const altText = clean(
    data.alt_text
  );

  const caption = clean(
    data.caption
  );

  const sortOrder = integerValue(
    data.sort_order,
    0
  );

  const isPrimary = booleanValue(
    data.is_primary ??
      data.primary,
    false
  );

  const whatsappPublish =
    booleanValue(
      data.whatsapp_publish,
      false
    );

  const active = booleanValue(
    data.active,
    true
  );

  /*
   * If this media is primary, remove primary
   * from the other media for this product.
   */

  if (isPrimary) {
    await env.DB.prepare(
      `
        UPDATE ecommerce_product_media
        SET
          is_primary = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE account_id = ?
          AND product_id = ?
      `
    )
      .bind(
        account,
        productId
      )
      .run();
  }

  const result = await env.DB.prepare(
    `
      INSERT INTO ecommerce_product_media (
        account_id,
        product_id,
        media_type,
        media_url,
        thumbnail_url,
        mime_type,
        alt_text,
        caption,
        sort_order,
        is_primary,
        whatsapp_publish,
        active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      account,
      productId,
      mediaType,
      mediaUrl,
      thumbnailUrl,
      mimeType,
      altText,
      caption,
      sortOrder,
      isPrimary ? 1 : 0,
      whatsappPublish ? 1 : 0,
      active ? 1 : 0
    )
    .run();

  return env.DB.prepare(
    `
      SELECT *
      FROM ecommerce_product_media
      WHERE id = ?
        AND account_id = ?
    `
  )
    .bind(
      result.meta.last_row_id,
      account
    )
    .first();
}

export async function updateEcommerceMedia(
  env,
  accountId,
  mediaId,
  data = {}
) {
  const account = accountNumber(accountId);
  const id = positiveId(
    mediaId,
    "media_id"
  );

  await ensureEcommerceTables(env);

  const existing = await env.DB.prepare(
    `
      SELECT *
      FROM ecommerce_product_media
      WHERE id = ?
        AND account_id = ?
      LIMIT 1
    `
  )
    .bind(id, account)
    .first();

  if (!existing) {
    throw new Error("Media not found");
  }

  const mediaType = clean(
    data.media_type ??
      data.type ??
      existing.media_type
  ).toLowerCase();

  if (
    mediaType !== "image" &&
    mediaType !== "video"
  ) {
    throw new Error(
      "media_type must be image or video"
    );
  }

  const isPrimary = booleanValue(
    data.is_primary ??
      data.primary,
    booleanValue(
      existing.is_primary,
      false
    )
  );

  if (isPrimary) {
    await env.DB.prepare(
      `
        UPDATE ecommerce_product_media
        SET
          is_primary = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE account_id = ?
          AND product_id = ?
          AND id != ?
      `
    )
      .bind(
        account,
        existing.product_id,
        id
      )
      .run();
  }

  await env.DB.prepare(
    `
      UPDATE ecommerce_product_media
      SET
        media_type = ?,
        media_url = ?,
        thumbnail_url = ?,
        mime_type = ?,
        alt_text = ?,
        caption = ?,
        sort_order = ?,
        is_primary = ?,
        whatsapp_publish = ?,
        active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND account_id = ?
    `
  )
    .bind(
      mediaType,

      clean(
        data.media_url ??
          data.url ??
          existing.media_url
      ),

      clean(
        data.thumbnail_url ??
          existing.thumbnail_url
      ),

      clean(
        data.mime_type ??
          existing.mime_type
      ),

      clean(
        data.alt_text ??
          existing.alt_text
      ),

      clean(
        data.caption ??
          existing.caption
      ),

      integerValue(
        data.sort_order ??
          existing.sort_order,
        0
      ),

      isPrimary ? 1 : 0,

      booleanValue(
        data.whatsapp_publish,
        booleanValue(
          existing.whatsapp_publish,
          false
        )
      )
        ? 1
        : 0,

      booleanValue(
        data.active,
        booleanValue(
          existing.active,
          true
        )
      )
        ? 1
        : 0,

      id,
      account
    )
    .run();

  return env.DB.prepare(
    `
      SELECT *
      FROM ecommerce_product_media
      WHERE id = ?
        AND account_id = ?
    `
  )
    .bind(id, account)
    .first();
}

export async function deleteEcommerceMedia(
  env,
  accountId,
  mediaId
) {
  const account = accountNumber(accountId);
  const id = positiveId(
    mediaId,
    "media_id"
  );

  await ensureEcommerceTables(env);

  await env.DB.prepare(
    `
      UPDATE ecommerce_product_media
      SET
        active = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND account_id = ?
    `
  )
    .bind(id, account)
    .run();

  return {
    success: true,
    id,
    deleted: true
  };
}

/* ============================================================
 * WHATSAPP PRODUCT MEDIA
 * ============================================================
 */

export async function listWhatsAppProductMedia(
  env,
  accountId,
  options = {}
) {
  const account = accountNumber(accountId);

  await ensureEcommerceTables(env);
  await ensureEcommerceProductColumns(env);

  const productId = options.product_id
    ? positiveId(
        options.product_id,
        "product_id"
      )
    : null;

  let sql = `
    SELECT
      m.id,
      m.account_id,
      m.product_id,
      m.media_type,
      m.media_url,
      m.thumbnail_url,
      m.mime_type,
      m.alt_text,
      m.caption,
      m.sort_order,
      m.is_primary,
      m.whatsapp_publish,

      p.name AS product_name,
      p.sku,
      p.selling_price,
      p.sale_price,
      p.product_slug

    FROM ecommerce_product_media m

    INNER JOIN saas_products p
      ON p.id = m.product_id
     AND p.account_id = m.account_id

    WHERE m.account_id = ?
      AND m.active = 1
      AND m.whatsapp_publish = 1
      AND p.module_code = 'ecommerce'
      AND p.active = 1
  `;

  const bindings = [account];

  if (productId) {
    sql += `
      AND m.product_id = ?
    `;

    bindings.push(productId);
  }

  sql += `
    ORDER BY
      m.product_id ASC,
      m.sort_order ASC,
      m.id ASC
  `;

  return env.DB.prepare(sql)
    .bind(...bindings)
    .all();
}

/* ============================================================
 * STOCK HISTORY
 * ============================================================
 */

export async function listEcommerceStockMovements(
  env,
  accountId,
  options = {}
) {
  const account = accountNumber(accountId);

  await ensureEcommerceTables(env);

  const productId = options.product_id
    ? positiveId(
        options.product_id,
        "product_id"
      )
    : null;

  const variantId = options.variant_id
    ? positiveId(
        options.variant_id,
        "variant_id"
      )
    : null;

  let sql = `
    SELECT
      sm.*,
      p.name AS product_name,
      p.sku AS product_sku
    FROM ecommerce_stock_movements sm
    LEFT JOIN saas_products p
      ON p.id = sm.product_id
     AND p.account_id = sm.account_id
    WHERE sm.account_id = ?
  `;

  const bindings = [account];

  if (productId) {
    sql += `
      AND sm.product_id = ?
    `;

    bindings.push(productId);
  }

  if (variantId) {
    sql += `
      AND sm.variant_id = ?
    `;

    bindings.push(variantId);
  }

  sql += `
    ORDER BY
      sm.id DESC
    LIMIT 500
  `;

  return env.DB.prepare(sql)
    .bind(...bindings)
    .all();
}

/* ============================================================
 * RELATED PRODUCTS
 * ============================================================
 */

export async function setEcommerceRelatedProducts(
  env,
  accountId,
  productId,
  relatedProductIds = [],
  relationType = "related"
) {
  const account = accountNumber(accountId);
  const product = positiveId(
    productId,
    "product_id"
  );

  await ensureEcommerceTables(env);

  await env.DB.prepare(
    `
      DELETE FROM ecommerce_related_products
      WHERE account_id = ?
        AND product_id = ?
    `
  )
    .bind(
      account,
      product
    )
    .run();

  const ids = Array.isArray(
    relatedProductIds
  )
    ? relatedProductIds
        .map(Number)
        .filter(
          (id) =>
            Number.isInteger(id) &&
            id > 0 &&
            id !== product
        )
    : [];

  for (
    let index = 0;
    index < ids.length;
    index++
  ) {
    const relatedId = ids[index];

    const relatedProduct =
      await getProductById(
        env,
        account,
        relatedId
      );

    if (!relatedProduct) {
      continue;
    }

    await env.DB.prepare(
      `
        INSERT OR IGNORE INTO
        ecommerce_related_products (
          account_id,
          product_id,
          related_product_id,
          relation_type,
          sort_order
        )
        VALUES (?, ?, ?, ?, ?)
      `
    )
      .bind(
        account,
        product,
        relatedId,
        clean(
          relationType,
          "related"
        ),
        index
      )
      .run();
  }

  return getRelatedProducts(
    env,
    account,
    product
  );
}

/* ============================================================
 * ORDERS
 * ============================================================
 */

export async function listEcommerceOrders(
  env,
  accountId,
  options = {}
) {
  const account = accountNumber(accountId);

  await ensureEcommerceTables(env);

  const status = clean(
    options.status
  );

  const paymentStatus = clean(
    options.payment_status
  );

  const limit = Math.min(
    Math.max(
      integerValue(
        options.limit,
        100
      ),
      1
    ),
    500
  );

  let sql = `
    SELECT *
    FROM ecommerce_orders
    WHERE account_id = ?
  `;

  const bindings = [account];

  if (status) {
    sql += `
      AND order_status = ?
    `;

    bindings.push(status);
  }

  if (paymentStatus) {
    sql += `
      AND payment_status = ?
    `;

    bindings.push(paymentStatus);
  }

  sql += `
    ORDER BY
      created_at DESC,
      id DESC
    LIMIT ?
  `;

  bindings.push(limit);

  return env.DB.prepare(sql)
    .bind(...bindings)
    .all();
}

export async function getEcommerceOrder(
  env,
  accountId,
  orderId
) {
  const account = accountNumber(accountId);
  const id = positiveId(
    orderId,
    "order_id"
  );

  await ensureEcommerceTables(env);

  const order = await env.DB.prepare(
    `
      SELECT *
      FROM ecommerce_orders
      WHERE id = ?
        AND account_id = ?
      LIMIT 1
    `
  )
    .bind(id, account)
    .first();

  if (!order) {
    return null;
  }

  const items = await env.DB.prepare(
    `
      SELECT *
      FROM ecommerce_order_items
      WHERE order_id = ?
        AND account_id = ?
      ORDER BY id ASC
    `
  )
    .bind(id, account)
    .all();

  return {
    ...order,
    items: items.results || []
  };
}

function generateOrderNumber() {
  const timestamp =
    Date.now().toString();

  const random =
    Math.floor(
      Math.random() * 900
    ) + 100;

  return `SBS-ORD-${timestamp.slice(
    -8
  )}-${random}`;
}

export async function createEcommerceOrder(
  env,
  accountId,
  data = {}
) {
  const account = accountNumber(accountId);

  await ensureEcommerceTables(env);

  const items = Array.isArray(
    data.items
  )
    ? data.items
    : [];

  if (!items.length) {
    throw new Error(
      "At least one order item is required"
    );
  }

  let subtotal = 0;
  let taxAmount = 0;

  const preparedItems = [];

  for (const item of items) {
    const productId = positiveId(
      item.product_id,
      "product_id"
    );

    const product =
      await getProductById(
        env,
        account,
        productId
      );

    if (!product) {
      throw new Error(
        `Product ${productId} not found`
      );
    }

    const quantity = Math.max(
      integerValue(
        item.quantity,
        1
      ),
      1
    );

    const variantId =
      item.variant_id
        ? positiveId(
            item.variant_id,
            "variant_id"
          )
        : null;

    let variant = null;

    if (variantId) {
      variant =
        await env.DB.prepare(
          `
            SELECT *
            FROM ecommerce_product_variants
            WHERE id = ?
              AND product_id = ?
              AND account_id = ?
              AND active = 1
            LIMIT 1
          `
        )
          .bind(
            variantId,
            productId,
            account
          )
          .first();

      if (!variant) {
        throw new Error(
          "Product variant not found"
        );
      }
    }

    const unitPrice = money(
      item.unit_price ??
        variant?.sale_price ??
        variant?.selling_price ??
        product.sale_price ??
        product.selling_price,
      0
    );

    const lineTotal =
      money(
        unitPrice * quantity
      );

    const taxRate = money(
      variant?.tax_rate ??
        product.tax_rate ??
        0,
      0
    );

    const lineTax =
      money(
        lineTotal *
          (taxRate / 100)
      );

    subtotal += lineTotal;
    taxAmount += lineTax;

    preparedItems.push({
      product_id: productId,
      variant_id: variantId,
      product_name:
        product.name,
      sku:
        variant?.sku ??
        product.sku ??
        "",
      quantity,
      unit_price: unitPrice,
      total_amount: lineTotal
    });
  }

  const deliveryFee = money(
    data.delivery_fee,
    0
  );

  const discountAmount = money(
    data.discount_amount,
    0
  );

  const totalAmount =
    money(
      subtotal +
        deliveryFee +
        taxAmount -
        discountAmount
    );

  const orderNumber =
    clean(
      data.order_number
    ) ||
    generateOrderNumber();

  const result =
    await env.DB.prepare(
      `
        INSERT INTO ecommerce_orders (
          account_id,
          order_number,

          customer_id,
          customer_name,
          customer_email,
          customer_phone,

          delivery_method,

          delivery_address,
          city,
          province,
          postal_code,

          subtotal,
          delivery_fee,
          discount_amount,
          tax_amount,
          total_amount,

          payment_method,
          payment_provider,
          payment_reference,

          payment_status,
          order_status,

          whatsapp_status,

          source,
          notes
        )
        VALUES (
          ?,
          ?,

          ?,
          ?,
          ?,
          ?,

          ?,

          ?,
          ?,
          ?,
          ?,

          ?,
          ?,
          ?,
          ?,
          ?,

          ?,
          ?,
          ?,

          ?,
          ?,

          ?,

          ?,
          ?
        )
      `
    )
      .bind(
        account,
        orderNumber,

        data.customer_id
          ? positiveId(
              data.customer_id,
              "customer_id"
            )
          : null,

        clean(
          data.customer_name
        ),

        clean(
          data.customer_email
        ),

        clean(
          data.customer_phone
        ),

        clean(
          data.delivery_method,
          "delivery"
        ),

        clean(
          data.delivery_address
        ),

        clean(data.city),

        clean(data.province),

        clean(data.postal_code),

        money(subtotal),

        deliveryFee,

        discountAmount,

        money(taxAmount),

        totalAmount,

        clean(
          data.payment_method
        ),

        clean(
          data.payment_provider
        ),

        clean(
          data.payment_reference
        ),

        clean(
          data.payment_status,
          "pending"
        ),

        clean(
          data.order_status,
          "pending"
        ),

        clean(
          data.whatsapp_status
        ),

        clean(
          data.source,
          "web"
        ),

        clean(
          data.notes
        )
      )
      .run();

  const orderId =
    result.meta.last_row_id;

  for (
    const item of preparedItems
  ) {
    await env.DB.prepare(
      `
        INSERT INTO ecommerce_order_items (
          account_id,
          order_id,
          product_id,
          variant_id,
          product_name,
          sku,
          quantity,
          unit_price,
          total_amount
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
      .bind(
        account,
        orderId,
        item.product_id,
        item.variant_id,
        item.product_name,
        item.sku,
        item.quantity,
        item.unit_price,
        item.total_amount
      )
      .run();
  }

  return getEcommerceOrder(
    env,
    account,
    orderId
  );
}

export async function updateEcommerceOrder(
  env,
  accountId,
  orderId,
  data = {}
) {
  const account = accountNumber(accountId);
  const id = positiveId(
    orderId,
    "order_id"
  );

  await ensureEcommerceTables(env);

  const existing =
    await env.DB.prepare(
      `
        SELECT *
        FROM ecommerce_orders
        WHERE id = ?
          AND account_id = ?
        LIMIT 1
      `
    )
      .bind(id, account)
      .first();

  if (!existing) {
    throw new Error("Order not found");
  }

  await env.DB.prepare(
    `
      UPDATE ecommerce_orders
      SET
        customer_name = ?,
        customer_email = ?,
        customer_phone = ?,

        delivery_method = ?,

        delivery_address = ?,
        city = ?,
        province = ?,
        postal_code = ?,

        payment_method = ?,
        payment_provider = ?,
        payment_reference = ?,

        payment_status = ?,
        order_status = ?,

        whatsapp_status = ?,

        notes = ?,

        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND account_id = ?
    `
  )
    .bind(
      clean(
        data.customer_name ??
          existing.customer_name
      ),

      clean(
        data.customer_email ??
          existing.customer_email
      ),

      clean(
        data.customer_phone ??
          existing.customer_phone
      ),

      clean(
        data.delivery_method ??
          existing.delivery_method
      ),

      clean(
        data.delivery_address ??
          existing.delivery_address
      ),

      clean(
        data.city ??
          existing.city
      ),

      clean(
        data.province ??
          existing.province
      ),

      clean(
        data.postal_code ??
          existing.postal_code
      ),

      clean(
        data.payment_method ??
          existing.payment_method
      ),

      clean(
        data.payment_provider ??
          existing.payment_provider
      ),

      clean(
        data.payment_reference ??
          existing.payment_reference
      ),

      clean(
        data.payment_status ??
          existing.payment_status,
        "pending"
      ),

      clean(
        data.order_status ??
          existing.order_status,
        "pending"
      ),

      clean(
        data.whatsapp_status ??
          existing.whatsapp_status
      ),

      clean(
        data.notes ??
          existing.notes
      ),

      id,
      account
    )
    .run();

  return getEcommerceOrder(
    env,
    account,
    id
  );
}

/* ============================================================
 * ECOMMERCE DASHBOARD
 * ============================================================
 */

export async function getEcommerceDashboard(
  env,
  accountId
) {
  const account = accountNumber(accountId);

  await ensureEcommerceTables(env);
  await ensureEcommerceProductColumns(env);

  const store =
    await getEcommerceStore(
      env,
      account
    );

  const products =
    await env.DB.prepare(
      `
        SELECT
          COUNT(*) AS total,

          SUM(
            CASE
              WHEN active = 1
               AND visibility = 'active'
              THEN 1
              ELSE 0
            END
          ) AS active,

          SUM(
            CASE
              WHEN stock_status = 'low_stock'
              THEN 1
              ELSE 0
            END
          ) AS low_stock,

          SUM(
            CASE
              WHEN stock_status = 'out_of_stock'
              THEN 1
              ELSE 0
            END
          ) AS out_of_stock
        FROM saas_products
        WHERE account_id = ?
          AND module_code = 'ecommerce'
      `
    )
      .bind(account)
      .first();

  const categories =
    await env.DB.prepare(
      `
        SELECT COUNT(*) AS total
        FROM ecommerce_categories
        WHERE account_id = ?
          AND active = 1
      `
    )
      .bind(account)
      .first();

  const orders =
    await env.DB.prepare(
      `
        SELECT
          COUNT(*) AS total,

          COALESCE(
            SUM(total_amount),
            0
          ) AS revenue,

          SUM(
            CASE
              WHEN order_status IN (
                'pending',
                'processing'
              )
              THEN 1
              ELSE 0
            END
          ) AS pending_orders,

          SUM(
            CASE
              WHEN payment_status = 'paid'
              THEN 1
              ELSE 0
            END
          ) AS paid_orders
        FROM ecommerce_orders
        WHERE account_id = ?
      `
    )
      .bind(account)
      .first();

  const media =
    await env.DB.prepare(
      `
        SELECT
          COUNT(*) AS total,

          SUM(
            CASE
              WHEN media_type = 'image'
              THEN 1
              ELSE 0
            END
          ) AS images,

          SUM(
            CASE
              WHEN media_type = 'video'
              THEN 1
              ELSE 0
            END
          ) AS videos,

          SUM(
            CASE
              WHEN whatsapp_publish = 1
              THEN 1
              ELSE 0
            END
          ) AS whatsapp_media
        FROM ecommerce_product_media
        WHERE account_id = ?
          AND active = 1
      `
    )
      .bind(account)
      .first();

  return {
    success: true,

    account_id: account,

    store,

    products: {
      total:
        Number(
          products?.total
        ) || 0,

      active:
        Number(
          products?.active
        ) || 0,

      low_stock:
        Number(
          products?.low_stock
        ) || 0,

      out_of_stock:
        Number(
          products?.out_of_stock
        ) || 0
    },

    categories:
      Number(
        categories?.total
      ) || 0,

    orders: {
      total:
        Number(
          orders?.total
        ) || 0,

      revenue:
        money(
          orders?.revenue,
          0
        ),

      pending:
        Number(
          orders?.pending_orders
        ) || 0,

      paid:
        Number(
          orders?.paid_orders
        ) || 0
    },

    media: {
      total:
        Number(
          media?.total
        ) || 0,

      images:
        Number(
          media?.images
        ) || 0,

      videos:
        Number(
          media?.videos
        ) || 0,

      whatsapp:
        Number(
          media?.whatsapp_media
        ) || 0
    }
  };
}

/* ============================================================
 * DEFAULT EXPORT
 * ============================================================
 */

export default {
  ensureEcommerceTables,
  ensureEcommerceProductColumns,

  getEcommerceStore,
  saveEcommerceStore,

  listEcommerceCategories,
  createEcommerceCategory,
  updateEcommerceCategory,
  deleteEcommerceCategory,

  listEcommerceProducts,
  getEcommerceProduct,
  createEcommerceProduct,
  updateEcommerceProduct,
  deleteEcommerceProduct,

  listEcommerceVariants,
  createEcommerceVariant,
  updateEcommerceVariant,
  deleteEcommerceVariant,

  listEcommerceMedia,
  createEcommerceMedia,
  updateEcommerceMedia,
  deleteEcommerceMedia,

  listWhatsAppProductMedia,

  listEcommerceStockMovements,

  setEcommerceRelatedProducts,

  listEcommerceOrders,
  getEcommerceOrder,
  createEcommerceOrder,
  updateEcommerceOrder,

  getEcommerceDashboard
};
