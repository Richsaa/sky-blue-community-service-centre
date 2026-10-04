/*
 * ============================================================
 * SKY BLUE DIGITAL SERVICE
 * ECOMMERCE CORE API
 * ============================================================
 *
 * Persistent Ecommerce data layer.
 *
 * This file handles:
 *
 * 1. Online stores
 * 2. Store settings
 * 3. Categories
 * 4. Product media
 * 5. Product images
 * 6. Product videos
 * 7. WhatsApp media publishing settings
 * 8. Ecommerce orders
 * 9. Ecommerce order items
 *
 * IMPORTANT:
 * All records are isolated by account_id.
 *
 * Product information itself remains in:
 *
 *     saas_products
 *
 * Product media is stored here:
 *
 *     ecommerce_product_media
 *
 * WhatsApp sending itself remains handled by the
 * existing WhatsApp engine.
 *
 * ============================================================
 */


/* ============================================================
   BASIC HELPERS
============================================================ */

function accountNumber(accountId) {

  const id = Number(accountId);

  if (
    !Number.isFinite(id) ||
    id <= 0
  ) {
    throw new Error(
      "Valid accountId is required"
    );
  }

  return id;
}


function clean(value) {

  return String(
    value ?? ""
  ).trim();

}


function positiveId(
  value,
  field = "id"
) {

  const id =
    Number(value);

  if (
    !Number.isFinite(id) ||
    id <= 0
  ) {
    throw new Error(
      `${field} is required`
    );
  }

  return id;
}


function money(value) {

  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return 0;
  }

  return Math.round(
    number * 100
  ) / 100;

}


function parseJSON(
  value,
  fallback = {}
) {

  try {

    return value
      ? JSON.parse(value)
      : fallback;

  } catch {

    return fallback;

  }

}


function makeSlug(value) {

  return clean(value)

    .toLowerCase()

    .replace(
      /[^a-z0-9]+/g,
      "-"
    )

    .replace(
      /^-+|-+$/g,
      ""
    )

    .slice(
      0,
      80
    );

}


function booleanValue(
  value,
  defaultValue = true
) {

  if (
    value === undefined ||
    value === null
  ) {
    return defaultValue
      ? 1
      : 0;
  }

  if (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true" ||
    value === "yes" ||
    value === "on"
  ) {
    return 1;
  }

  return 0;

}


/* ============================================================
   DATABASE SETUP
============================================================ */

export async function ensureEcommerceTables(
  env
) {

  if (!env?.DB) {

    throw new Error(
      "DB binding is not available"
    );

  }

  const db =
    env.DB;


  /* ==========================================================
     ECOMMERCE STORES
  ========================================================== */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ecommerce_stores (

      id INTEGER PRIMARY KEY AUTOINCREMENT,

      account_id INTEGER NOT NULL UNIQUE,

      store_name TEXT NOT NULL DEFAULT '',

      slug TEXT NOT NULL DEFAULT '',

      email TEXT DEFAULT '',

      phone TEXT DEFAULT '',

      whatsapp TEXT DEFAULT '',

      currency TEXT NOT NULL DEFAULT 'ZAR',

      description TEXT DEFAULT '',

      logo_url TEXT DEFAULT '',

      favicon_url TEXT DEFAULT '',

      primary_color TEXT DEFAULT '#1565c0',

      secondary_color TEXT DEFAULT '#0d47a1',

      design_code TEXT DEFAULT 'modern',

      domain TEXT DEFAULT '',

      custom_domain TEXT DEFAULT '',

      status TEXT NOT NULL DEFAULT 'draft',

      published INTEGER NOT NULL DEFAULT 0,

      checkout_enabled INTEGER NOT NULL DEFAULT 1,

      delivery_enabled INTEGER NOT NULL DEFAULT 1,

      pickup_enabled INTEGER NOT NULL DEFAULT 1,

      delivery_fee REAL NOT NULL DEFAULT 0,

      whatsapp_enabled INTEGER NOT NULL DEFAULT 1,

      whatsapp_publish_enabled INTEGER NOT NULL DEFAULT 1,

      payment_provider TEXT DEFAULT '',

      payment_settings_json TEXT NOT NULL DEFAULT '{}',

      delivery_settings_json TEXT NOT NULL DEFAULT '{}',

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

    )
  `).run();


  /* ==========================================================
     ECOMMERCE CATEGORIES
  ========================================================== */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ecommerce_categories (

      id INTEGER PRIMARY KEY AUTOINCREMENT,

      account_id INTEGER NOT NULL,

      name TEXT NOT NULL DEFAULT '',

      slug TEXT NOT NULL DEFAULT '',

      description TEXT DEFAULT '',

      image_url TEXT DEFAULT '',

      sort_order INTEGER NOT NULL DEFAULT 0,

      active INTEGER NOT NULL DEFAULT 1,

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      UNIQUE(
        account_id,
        slug
      )

    )
  `).run();


  /* ==========================================================
     PRODUCT MEDIA
     
     Supports:
     
     image
     video
     
     WhatsApp publishing:
     
     whatsapp_publish = 1
  ========================================================== */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ecommerce_product_media (

      id INTEGER PRIMARY KEY AUTOINCREMENT,

      account_id INTEGER NOT NULL,

      product_id INTEGER NOT NULL,

      media_type TEXT NOT NULL DEFAULT 'image',

      media_url TEXT NOT NULL DEFAULT '',

      thumbnail_url TEXT DEFAULT '',

      mime_type TEXT DEFAULT '',

      alt_text TEXT DEFAULT '',

      caption TEXT DEFAULT '',

      sort_order INTEGER NOT NULL DEFAULT 0,

      whatsapp_publish INTEGER NOT NULL DEFAULT 0,

      active INTEGER NOT NULL DEFAULT 1,

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

    )
  `).run();


  /* ==========================================================
     ECOMMERCE ORDERS
  ========================================================== */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ecommerce_orders (

      id INTEGER PRIMARY KEY AUTOINCREMENT,

      account_id INTEGER NOT NULL,

      order_number TEXT NOT NULL DEFAULT '',

      customer_id INTEGER,

      customer_name TEXT DEFAULT '',

      customer_email TEXT DEFAULT '',

      customer_phone TEXT DEFAULT '',

      delivery_method TEXT NOT NULL DEFAULT 'pickup',

      delivery_address TEXT DEFAULT '',

      delivery_city TEXT DEFAULT '',

      delivery_province TEXT DEFAULT '',

      delivery_postal_code TEXT DEFAULT '',

      subtotal REAL NOT NULL DEFAULT 0,

      delivery_fee REAL NOT NULL DEFAULT 0,

      discount_amount REAL NOT NULL DEFAULT 0,

      tax_amount REAL NOT NULL DEFAULT 0,

      total_amount REAL NOT NULL DEFAULT 0,

      payment_method TEXT DEFAULT '',

      payment_provider TEXT DEFAULT '',

      payment_reference TEXT DEFAULT '',

      payment_status TEXT NOT NULL DEFAULT 'pending',

      order_status TEXT NOT NULL DEFAULT 'pending',

      whatsapp_status TEXT DEFAULT 'pending',

      source TEXT NOT NULL DEFAULT 'storefront',

      notes TEXT DEFAULT '',

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

    )
  `).run();


  /* ==========================================================
     ORDER ITEMS
  ========================================================== */

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ecommerce_order_items (

      id INTEGER PRIMARY KEY AUTOINCREMENT,

      account_id INTEGER NOT NULL,

      order_id INTEGER NOT NULL,

      product_id INTEGER,

      product_name TEXT NOT NULL DEFAULT '',

      sku TEXT DEFAULT '',

      quantity REAL NOT NULL DEFAULT 1,

      unit_price REAL NOT NULL DEFAULT 0,

      total_amount REAL NOT NULL DEFAULT 0,

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

    )
  `).run();


  /* ==========================================================
     INDEXES
  ========================================================== */

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_ecommerce_categories_account

    ON ecommerce_categories(
      account_id
    )
  `).run();


  await db.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_ecommerce_media_product

    ON ecommerce_product_media(
      account_id,
      product_id
    )
  `).run();


  await db.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_ecommerce_media_whatsapp

    ON ecommerce_product_media(
      account_id,
      whatsapp_publish,
      media_type
    )
  `).run();


  await db.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_ecommerce_orders_account

    ON ecommerce_orders(
      account_id,
      created_at
    )
  `).run();


  await db.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_ecommerce_order_items_order

    ON ecommerce_order_items(
      account_id,
      order_id
    )
  `).run();


  return {
    success: true,
    tables_ready: true
  };

}


/* ============================================================
   STORE
============================================================ */

export async function getEcommerceStore(
  env,
  accountId
) {

  const account =
    accountNumber(accountId);

  await ensureEcommerceTables(
    env
  );

  const store =
    await env.DB.prepare(`
      SELECT *
      FROM ecommerce_stores

      WHERE account_id = ?

      LIMIT 1
    `)
    .bind(account)
    .first();


  if (!store) {

    return {
      success: true,
      store: null
    };

  }


  return {
    success: true,

    store: {

      ...store,

      published:
        Number(
          store.published || 0
        ) === 1,

      checkout_enabled:
        Number(
          store.checkout_enabled || 0
        ) === 1,

      delivery_enabled:
        Number(
          store.delivery_enabled || 0
        ) === 1,

      pickup_enabled:
        Number(
          store.pickup_enabled || 0
        ) === 1,

      whatsapp_enabled:
        Number(
          store.whatsapp_enabled || 0
        ) === 1,

      whatsapp_publish_enabled:
        Number(
          store.whatsapp_publish_enabled || 0
        ) === 1,

      payment_settings:
        parseJSON(
          store.payment_settings_json
        ),

      delivery_settings:
        parseJSON(
          store.delivery_settings_json
        )

    }

  };

}


/* ============================================================
   SAVE STORE
============================================================ */

export async function saveEcommerceStore(
  env,
  accountId,
  data = {}
) {

  const account =
    accountNumber(accountId);

  await ensureEcommerceTables(
    env
  );


  const existing =
    await env.DB.prepare(`
      SELECT *
      FROM ecommerce_stores

      WHERE account_id = ?

      LIMIT 1
    `)
    .bind(account)
    .first();


  const storeName =
    clean(
      data.store_name ??
      data.storeName ??
      existing?.store_name
    );


  if (!storeName) {

    throw new Error(
      "Store name is required"
    );

  }


  const slug =
    makeSlug(
      data.slug ??
      data.store_slug ??
      data.storeSlug ??
      existing?.slug ??
      storeName
    ) ||
    `store-${account}`;


  const email =
    clean(
      data.email ??
      existing?.email
    );


  const phone =
    clean(
      data.phone ??
      existing?.phone
    );


  const whatsapp =
    clean(
      data.whatsapp ??
      data.whatsapp_number ??
      data.whatsappNumber ??
      existing?.whatsapp ??
      phone
    );


  const currency =
    clean(
      data.currency ??
      existing?.currency
    ) ||
    "ZAR";


  const description =
    clean(
      data.description ??
      existing?.description
    );


  const logoUrl =
    clean(
      data.logo_url ??
      data.logoUrl ??
      existing?.logo_url
    );


  const faviconUrl =
    clean(
      data.favicon_url ??
      data.faviconUrl ??
      existing?.favicon_url
    );


  const primaryColor =
    clean(
      data.primary_color ??
      data.primaryColor ??
      existing?.primary_color
    ) ||
    "#1565c0";


  const secondaryColor =
    clean(
      data.secondary_color ??
      data.secondaryColor ??
      existing?.secondary_color
    ) ||
    "#0d47a1";


  const designCode =
    clean(
      data.design_code ??
      data.designCode ??
      existing?.design_code
    ) ||
    "modern";


  const domain =
    clean(
      data.domain ??
      existing?.domain
    );


  const customDomain =
    clean(
      data.custom_domain ??
      data.customDomain ??
      existing?.custom_domain
    );


  const status =
    clean(
      data.status ??
      existing?.status
    ) ||
    "draft";


  const published =
    booleanValue(
      data.published,
      Number(
        existing?.published ?? 0
      ) === 1
    );


  const checkoutEnabled =
    booleanValue(
      data.checkout_enabled ??
      data.checkoutEnabled,
      existing
        ? Number(
            existing.checkout_enabled
          ) === 1
        : true
    );


  const deliveryEnabled =
    booleanValue(
      data.delivery_enabled ??
      data.deliveryEnabled,
      existing
        ? Number(
            existing.delivery_enabled
          ) === 1
        : true
    );


  const pickupEnabled =
    booleanValue(
      data.pickup_enabled ??
      data.pickupEnabled,
      existing
        ? Number(
            existing.pickup_enabled
          ) === 1
        : true
    );


  const deliveryFee =
    money(
      data.delivery_fee ??
      data.deliveryFee ??
      existing?.delivery_fee
    );


  const whatsappEnabled =
    booleanValue(
      data.whatsapp_enabled ??
      data.whatsappEnabled,
      existing
        ? Number(
            existing.whatsapp_enabled
          ) === 1
        : true
    );


  const whatsappPublishEnabled =
    booleanValue(
      data.whatsapp_publish_enabled ??
      data.whatsappPublishEnabled,
      existing
        ? Number(
            existing.whatsapp_publish_enabled
          ) === 1
        : true
    );


  const paymentProvider =
    clean(
      data.payment_provider ??
      data.paymentProvider ??
      existing?.payment_provider
    );


  const paymentSettings =
    data.payment_settings ??
    data.paymentSettings ??
    parseJSON(
      existing?.payment_settings_json
    );


  const deliverySettings =
    data.delivery_settings ??
    data.deliverySettings ??
    parseJSON(
      existing?.delivery_settings_json
    );


  if (existing) {

    await env.DB.prepare(`
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

    `)
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

      published,

      checkoutEnabled,

      deliveryEnabled,

      pickupEnabled,

      deliveryFee,

      whatsappEnabled,

      whatsappPublishEnabled,

      paymentProvider,

      JSON.stringify(
        paymentSettings
      ),

      JSON.stringify(
        deliverySettings
      ),

      account

    )
    .run();


  } else {

    await env.DB.prepare(`
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

      VALUES (

        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,

        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?

      )

    `)
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

      published,

      checkoutEnabled,

      deliveryEnabled,

      pickupEnabled,

      deliveryFee,

      whatsappEnabled,

      whatsappPublishEnabled,

      paymentProvider,

      JSON.stringify(
        paymentSettings
      ),

      JSON.stringify(
        deliverySettings
      )

    )
    .run();

  }


  return await getEcommerceStore(
    env,
    account
  );

}


/* ============================================================
   CATEGORIES
============================================================ */

export async function listEcommerceCategories(
  env,
  accountId
) {

  const account =
    accountNumber(accountId);

  await ensureEcommerceTables(
    env
  );


  const result =
    await env.DB.prepare(`
      SELECT *

      FROM ecommerce_categories

      WHERE account_id = ?

      ORDER BY
        sort_order ASC,
        name ASC,
        id ASC
    `)
    .bind(account)
    .all();


  return {
    success: true,
    categories:
      result.results || []
  };

}


/* ============================================================
   CREATE CATEGORY
============================================================ */

export async function createEcommerceCategory(
  env,
  accountId,
  data = {}
) {

  const account =
    accountNumber(accountId);

  const name =
    clean(
      data.name
    );


  if (!name) {

    throw new Error(
      "Category name is required"
    );

  }


  await ensureEcommerceTables(
    env
  );


  const slug =
    makeSlug(
      data.slug ||
      name
    ) ||
    `category-${Date.now()}`;


  const result =
    await env.DB.prepare(`
      INSERT INTO ecommerce_categories (

        account_id,

        name,

        slug,

        description,

        image_url,

        sort_order,

        active

      )

      VALUES (
        ?, ?, ?, ?, ?, ?, ?
      )

    `)
    .bind(

      account,

      name,

      slug,

      clean(
        data.description
      ),

      clean(
        data.image_url ??
        data.imageUrl
      ),

      Number(
        data.sort_order ??
        data.sortOrder ??
        0
      ),

      booleanValue(
        data.active,
        true
      )

    )
    .run();


  return {

    success: true,

    id:
      result.meta?.last_row_id ||
      null

  };

}


/* ============================================================
   UPDATE CATEGORY
============================================================ */

export async function updateEcommerceCategory(
  env,
  accountId,
  categoryId,
  data = {}
) {

  const account =
    accountNumber(accountId);

  const id =
    positiveId(
      categoryId,
      "categoryId"
    );


  await ensureEcommerceTables(
    env
  );


  const existing =
    await env.DB.prepare(`
      SELECT *

      FROM ecommerce_categories

      WHERE account_id = ?

      AND id = ?

      LIMIT 1
    `)
    .bind(
      account,
      id
    )
    .first();


  if (!existing) {

    throw new Error(
      "Category not found"
    );

  }


  const name =
    clean(
      data.name ??
      existing.name
    );


  const slug =
    makeSlug(
      data.slug ??
      existing.slug ??
      name
    );


  await env.DB.prepare(`
    UPDATE ecommerce_categories

    SET

      name = ?,

      slug = ?,

      description = ?,

      image_url = ?,

      sort_order = ?,

      active = ?,

      updated_at =
        CURRENT_TIMESTAMP

    WHERE account_id = ?

    AND id = ?

  `)
  .bind(

    name,

    slug,

    clean(
      data.description ??
      existing.description
    ),

    clean(
      data.image_url ??
      data.imageUrl ??
      existing.image_url
    ),

    Number(
      data.sort_order ??
      data.sortOrder ??
      existing.sort_order ??
      0
    ),

    data.active === undefined
      ? Number(
          existing.active || 0
        )
      : booleanValue(
          data.active,
          true
        ),

    account,

    id

  )
  .run();


  return {

    success: true,

    category:
      await env.DB.prepare(`
        SELECT *

        FROM ecommerce_categories

        WHERE account_id = ?

        AND id = ?

        LIMIT 1
      `)
      .bind(
        account,
        id
      )
      .first()

  };

}


/* ============================================================
   DELETE / DEACTIVATE CATEGORY
============================================================ */

export async function deleteEcommerceCategory(
  env,
  accountId,
  categoryId
) {

  const account =
    accountNumber(accountId);

  const id =
    positiveId(
      categoryId,
      "categoryId"
    );


  await ensureEcommerceTables(
    env
  );


  await env.DB.prepare(`
    UPDATE ecommerce_categories

    SET

      active = 0,

      updated_at =
        CURRENT_TIMESTAMP

    WHERE account_id = ?

    AND id = ?

  `)
  .bind(
    account,
    id
  )
  .run();


  return {

    success: true,

    id,

    active: false

  };

}


/* ============================================================
   PRODUCT MEDIA
============================================================ */

export async function listEcommerceMedia(
  env,
  accountId,
  productId = null
) {

  const account =
    accountNumber(accountId);


  await ensureEcommerceTables(
    env
  );


  let sql = `

    SELECT *

    FROM ecommerce_product_media

    WHERE account_id = ?

  `;


  const bindings =
    [account];


  if (productId) {

    sql += `
      AND product_id = ?
    `;

    bindings.push(
      positiveId(
        productId,
        "productId"
      )
    );

  }


  sql += `

    ORDER BY
      sort_order ASC,
      id ASC

  `;


  const result =
    await env.DB.prepare(
      sql
    )
    .bind(
      ...bindings
    )
    .all();


  return {

    success: true,

    media:
      result.results || []

  };

}


/* ============================================================
   CREATE PRODUCT MEDIA
============================================================ */

export async function createEcommerceMedia(
  env,
  accountId,
  data = {}
) {

  const account =
    accountNumber(accountId);


  const productId =
    positiveId(
      data.product_id ??
      data.productId,
      "productId"
    );


  const mediaUrl =
    clean(
      data.media_url ??
      data.mediaUrl ??
      data.url
    );


  if (!mediaUrl) {

    throw new Error(
      "Media URL is required"
    );

  }


  const mediaType =
    clean(
      data.media_type ??
      data.mediaType
    ) ||
    "image";


  if (
    mediaType !== "image" &&
    mediaType !== "video"
  ) {

    throw new Error(
      "media_type must be image or video"
    );

  }


  await ensureEcommerceTables(
    env
  );


  const result =
    await env.DB.prepare(`
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

        whatsapp_publish,

        active

      )

      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )

    `)
    .bind(

      account,

      productId,

      mediaType,

      mediaUrl,

      clean(
        data.thumbnail_url ??
        data.thumbnailUrl
      ),

      clean(
        data.mime_type ??
        data.mimeType
      ),

      clean(
        data.alt_text ??
        data.altText
      ),

      clean(
        data.caption
      ),

      Number(
        data.sort_order ??
        data.sortOrder ??
        0
      ),

      booleanValue(
        data.whatsapp_publish ??
        data.whatsappPublish,
        false
      ),

      booleanValue(
        data.active,
        true
      )

    )
    .run();


  return {

    success: true,

    id:
      result.meta?.last_row_id ||
      null

  };

}


/* ============================================================
   UPDATE PRODUCT MEDIA
============================================================ */

export async function updateEcommerceMedia(
  env,
  accountId,
  mediaId,
  data = {}
) {

  const account =
    accountNumber(accountId);

  const id =
    positiveId(
      mediaId,
      "mediaId"
    );


  await ensureEcommerceTables(
    env
  );


  const existing =
    await env.DB.prepare(`
      SELECT *

      FROM ecommerce_product_media

      WHERE account_id = ?

      AND id = ?

      LIMIT 1
    `)
    .bind(
      account,
      id
    )
    .first();


  if (!existing) {

    throw new Error(
      "Product media not found"
    );

  }


  const mediaType =
    clean(
      data.media_type ??
      data.mediaType ??
      existing.media_type
    );


  if (
    mediaType !== "image" &&
    mediaType !== "video"
  ) {

    throw new Error(
      "media_type must be image or video"
    );

  }


  await env.DB.prepare(`
    UPDATE ecommerce_product_media

    SET

      media_type = ?,

      media_url = ?,

      thumbnail_url = ?,

      mime_type = ?,

      alt_text = ?,

      caption = ?,

      sort_order = ?,

      whatsapp_publish = ?,

      active = ?,

      updated_at =
        CURRENT_TIMESTAMP

    WHERE account_id = ?

    AND id = ?

  `)
  .bind(

    mediaType,

    clean(
      data.media_url ??
      data.mediaUrl ??
      data.url ??
      existing.media_url
    ),

    clean(
      data.thumbnail_url ??
      data.thumbnailUrl ??
      existing.thumbnail_url
    ),

    clean(
      data.mime_type ??
      data.mimeType ??
      existing.mime_type
    ),

    clean(
      data.alt_text ??
      data.altText ??
      existing.alt_text
    ),

    clean(
      data.caption ??
      existing.caption
    ),

    Number(
      data.sort_order ??
      data.sortOrder ??
      existing.sort_order ??
      0
    ),

    data.whatsapp_publish === undefined &&
    data.whatsappPublish === undefined

      ? Number(
          existing.whatsapp_publish ||
          0
        )

      : booleanValue(
          data.whatsapp_publish ??
          data.whatsappPublish,
          false
        ),

    data.active === undefined

      ? Number(
          existing.active ||
          0
        )

      : booleanValue(
          data.active,
          true
        ),

    account,

    id

  )
  .run();


  return {

    success: true,

    media:
      await env.DB.prepare(`
        SELECT *

        FROM ecommerce_product_media

        WHERE account_id = ?

        AND id = ?

        LIMIT 1
      `)
      .bind(
        account,
        id
      )
      .first()

  };

}


/* ============================================================
   DELETE / DEACTIVATE PRODUCT MEDIA
============================================================ */

export async function deleteEcommerceMedia(
  env,
  accountId,
  mediaId
) {

  const account =
    accountNumber(accountId);

  const id =
    positiveId(
      mediaId,
      "mediaId"
    );


  await ensureEcommerceTables(
    env
  );


  await env.DB.prepare(`
    UPDATE ecommerce_product_media

    SET

      active = 0,

      updated_at =
        CURRENT_TIMESTAMP

    WHERE account_id = ?

    AND id = ?

  `)
  .bind(
    account,
    id
  )
  .run();


  return {

    success: true,

    id,

    active: false

  };

}


/* ============================================================
   WHATSAPP MEDIA
============================================================ */

export async function listWhatsAppProductMedia(
  env,
  accountId
) {

  const account =
    accountNumber(accountId);


  await ensureEcommerceTables(
    env
  );


  const result =
    await env.DB.prepare(`
      SELECT

        m.*,

        p.name AS product_name,

        p.sku AS product_sku,

        p.selling_price

      FROM ecommerce_product_media m

      LEFT JOIN saas_products p

        ON p.id = m.product_id

        AND p.account_id = m.account_id

      WHERE

        m.account_id = ?

        AND m.active = 1

        AND m.whatsapp_publish = 1

      ORDER BY

        m.created_at DESC,

        m.id DESC

    `)
    .bind(
      account
    )
    .all();


  return {

    success: true,

    media:
      result.results || []

  };

}


/* ============================================================
   ECOMMERCE ORDERS
============================================================ */

export async function listEcommerceOrders(
  env,
  accountId,
  options = {}
) {

  const account =
    accountNumber(accountId);


  await ensureEcommerceTables(
    env
  );


  const status =
    clean(
      options.status
    );


  const limit =
    Math.min(
      Math.max(
        Number(
          options.limit ||
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


  const bindings =
    [account];


  if (status) {

    sql += `
      AND order_status = ?
    `;

    bindings.push(
      status
    );

  }


  sql += `

    ORDER BY

      datetime(created_at) DESC,

      id DESC

    LIMIT ?

  `;


  bindings.push(
    limit
  );


  const result =
    await env.DB.prepare(
      sql
    )
    .bind(
      ...bindings
    )
    .all();


  return {

    success: true,

    orders:
      result.results || []

  };

}


/* ============================================================
   GET ORDER
============================================================ */

export async function getEcommerceOrder(
  env,
  accountId,
  orderId
) {

  const account =
    accountNumber(accountId);

  const id =
    positiveId(
      orderId,
      "orderId"
    );


  await ensureEcommerceTables(
    env
  );


  const order =
    await env.DB.prepare(`
      SELECT *

      FROM ecommerce_orders

      WHERE account_id = ?

      AND id = ?

      LIMIT 1

    `)
    .bind(
      account,
      id
    )
    .first();


  if (!order) {

    return null;

  }


  const items =
    await env.DB.prepare(`
      SELECT *

      FROM ecommerce_order_items

      WHERE account_id = ?

      AND order_id = ?

      ORDER BY id ASC

    `)
    .bind(
      account,
      id
    )
    .all();


  return {

    ...order,

    items:
      items.results || []

  };

}


/* ============================================================
   CREATE ORDER
============================================================ */

export async function createEcommerceOrder(
  env,
  accountId,
  data = {}
) {

  const account =
    accountNumber(accountId);


  await ensureEcommerceTables(
    env
  );


  const items =
    Array.isArray(
      data.items
    )
      ? data.items
      : [];


  if (!items.length) {

    throw new Error(
      "At least one order item is required"
    );

  }


  let subtotal =
    0;


  const prepared =
    [];


  for (
    const item
    of items
  ) {

    const quantity =
      Math.max(
        Number(
          item.quantity ||
          1
        ),
        0
      );


    const unitPrice =
      money(
        item.unit_price ??
        item.unitPrice ??
        item.price
      );


    if (
      quantity <= 0
    ) {
      continue;
    }


    const total =
      money(
        quantity *
        unitPrice
      );


    subtotal =
      money(
        subtotal +
        total
      );


    prepared.push({

      product_id:
        item.product_id ??
        item.productId ??
        null,

      product_name:
        clean(
          item.product_name ??
          item.productName ??
          item.name
        ),

      sku:
        clean(
          item.sku
        ),

      quantity,

      unit_price:
        unitPrice,

      total_amount:
        total

    });

  }


  if (!prepared.length) {

    throw new Error(
      "Order contains no valid items"
    );

  }


  const deliveryFee =
    money(
      data.delivery_fee ??
      data.deliveryFee
    );


  const discountAmount =
    money(
      data.discount_amount ??
      data.discountAmount
    );


  const taxAmount =
    money(
      data.tax_amount ??
      data.taxAmount
    );


  const calculatedTotal =
    money(

      subtotal +

      deliveryFee -

      discountAmount +

      taxAmount

    );


  const suppliedTotal =
    data.total_amount ??
    data.totalAmount;


  const totalAmount =
    suppliedTotal === undefined

      ? calculatedTotal

      : money(
          suppliedTotal
        );


  const orderNumber =
    clean(
      data.order_number ??
      data.orderNumber
    ) ||
    `ORD-${Date.now()}`;


  const customerIdValue =
    data.customer_id ??
    data.customerId;


  const customerId =
    customerIdValue === undefined ||
    customerIdValue === null ||
    customerIdValue === ""

      ? null

      : Number(
          customerIdValue
        );


  const result =
    await env.DB.prepare(`
      INSERT INTO ecommerce_orders (

        account_id,

        order_number,

        customer_id,

        customer_name,

        customer_email,

        customer_phone,

        delivery_method,

        delivery_address,

        delivery_city,

        delivery_province,

        delivery_postal_code,

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

        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,

        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?

      )

    `)
    .bind(

      account,

      orderNumber,

      customerId,

      clean(
        data.customer_name ??
        data.customerName
      ),

      clean(
        data.customer_email ??
        data.customerEmail
      ),

      clean(
        data.customer_phone ??
        data.customerPhone
      ),

      clean(
        data.delivery_method ??
        data.deliveryMethod
      ) ||
      "pickup",

      clean(
        data.delivery_address ??
        data.deliveryAddress
      ),

      clean(
        data.delivery_city ??
        data.deliveryCity
      ),

      clean(
        data.delivery_province ??
        data.deliveryProvince
      ),

      clean(
        data.delivery_postal_code ??
        data.deliveryPostalCode
      ),

      money(
        subtotal
      ),

      deliveryFee,

      discountAmount,

      taxAmount,

      totalAmount,

      clean(
        data.payment_method ??
        data.paymentMethod
      ),

      clean(
        data.payment_provider ??
        data.paymentProvider
      ),

      clean(
        data.payment_reference ??
        data.paymentReference
      ),

      clean(
        data.payment_status ??
        data.paymentStatus
      ) ||
      "pending",

      clean(
        data.order_status ??
        data.orderStatus
      ) ||
      "pending",

      clean(
        data.whatsapp_status ??
        data.whatsappStatus
      ) ||
      "pending",

      clean(
        data.source
      ) ||
      "storefront",

      clean(
        data.notes
      )

    )
    .run();


  const orderId =
    result.meta?.last_row_id ||
    null;


  if (orderId) {

    for (
      const item
      of prepared
    ) {

      await env.DB.prepare(`
        INSERT INTO ecommerce_order_items (

          account_id,

          order_id,

          product_id,

          product_name,

          sku,

          quantity,

          unit_price,

          total_amount

        )

        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?
        )

      `)
      .bind(

        account,

        orderId,

        item.product_id
          ? Number(
              item.product_id
            )
          : null,

        item.product_name,

        item.sku,

        item.quantity,

        item.unit_price,

        item.total_amount

      )
      .run();

    }

  }


  return {

    success: true,

    id:
      orderId,

    order:
      orderId

        ? await getEcommerceOrder(
            env,
            account,
            orderId
          )

        : null

  };

}


/* ============================================================
   UPDATE ORDER
============================================================ */

export async function updateEcommerceOrder(
  env,
  accountId,
  orderId,
  data = {}
) {

  const account =
    accountNumber(accountId);

  const id =
    positiveId(
      orderId,
      "orderId"
    );


  await ensureEcommerceTables(
    env
  );


  const existing =
    await env.DB.prepare(`
      SELECT *

      FROM ecommerce_orders

      WHERE account_id = ?

      AND id = ?

      LIMIT 1

    `)
    .bind(
      account,
      id
    )
    .first();


  if (!existing) {

    throw new Error(
      "Order not found"
    );

  }


  await env.DB.prepare(`
    UPDATE ecommerce_orders

    SET

      order_status = ?,

      payment_status = ?,

      payment_reference = ?,

      whatsapp_status = ?,

      notes = ?,

      updated_at =
        CURRENT_TIMESTAMP

    WHERE account_id = ?

    AND id = ?

  `)
  .bind(

    clean(
      data.order_status ??
      data.orderStatus ??
      existing.order_status
    ),

    clean(
      data.payment_status ??
      data.paymentStatus ??
      existing.payment_status
    ),

    clean(
      data.payment_reference ??
      data.paymentReference ??
      existing.payment_reference
    ),

    clean(
      data.whatsapp_status ??
      data.whatsappStatus ??
      existing.whatsapp_status
    ),

    clean(
      data.notes ??
      existing.notes
    ),

    account,

    id

  )
  .run();


  return {

    success: true,

    order:
      await getEcommerceOrder(
        env,
        account,
        id
      )

  };

}


/* ============================================================
   ECOMMERCE DASHBOARD SUMMARY
============================================================ */

export async function getEcommerceDashboard(
  env,
  accountId
) {

  const account =
    accountNumber(accountId);


  await ensureEcommerceTables(
    env
  );


  const store =
    await getEcommerceStore(
      env,
      account
    );


  const products =
    await env.DB.prepare(`
      SELECT COUNT(*) AS count

      FROM saas_products

      WHERE account_id = ?

      AND module_code = 'ecommerce'

      AND active = 1

    `)
    .bind(
      account
    )
    .first();


  const categories =
    await env.DB.prepare(`
      SELECT COUNT(*) AS count

      FROM ecommerce_categories

      WHERE account_id = ?

      AND active = 1

    `)
    .bind(
      account
    )
    .first();


  const orders =
    await env.DB.prepare(`
      SELECT

        COUNT(*) AS count,

        COALESCE(
          SUM(total_amount),
          0
        ) AS revenue

      FROM ecommerce_orders

      WHERE account_id = ?

    `)
    .bind(
      account
    )
    .first();


  const pendingOrders =
    await env.DB.prepare(`
      SELECT COUNT(*) AS count

      FROM ecommerce_orders

      WHERE account_id = ?

      AND order_status = 'pending'

    `)
    .bind(
      account
    )
    .first();


  return {

    success: true,

    store:
      store.store,

    products:
      Number(
        products?.count ||
        0
      ),

    categories:
      Number(
        categories?.count ||
        0
      ),

    orders:
      Number(
        orders?.count ||
        0
      ),

    revenue:
      money(
        orders?.revenue ||
        0
      ),

    pending_orders:
      Number(
        pendingOrders?.count ||
        0
      )

  };

  }
