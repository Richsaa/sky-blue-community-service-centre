/*
 * ============================================================
 * SKY BLUE DIGITAL SERVICE
 * WORKER.JS — V2
 * ============================================================
 *
 * Main application entry point for:
 *
 *  - Sky Blue SaaS
 *  - Customer accounts
 *  - Customer authentication
 *  - SaaS module catalogue
 *  - NPO / NGO management
 *  - E-Commerce
 *  - Product management
 *  - Product image/video media
 *  - Cloudflare R2 media storage
 *  - WhatsApp engine
 *  - Industry WhatsApp router
 *  - Community Service Centre
 *  - SaaS Core API
 *  - Owner / Admin functions
 *
 * Existing project modules:
 *
 *  - saas-core-routes.js
 *  - whatsapp-engine.js
 *  - industry-whatsapp-router.js
 *
 * Cloudflare bindings expected:
 *
 *  - DB    = D1 database
 *  - MEDIA = R2 bucket
 *
 * ============================================================
 */

import {
  handleSaaSCoreRoute,
  coreRouteError
} from "./saas-core-routes.js";

import {
  ensureWhatsAppSaaSTables,
  getWhatsAppStatus,
  getWhatsAppContacts,
  getWhatsAppMessages,
  createOrUpdateWhatsAppContact,
  sendSaaSWhatsAppMessage,
  queueWhatsAppNotification,
  processWhatsAppNotification
} from "./whatsapp-engine.js";

import {
  ensureIndustryWhatsAppRouterTables,
  processIndustryWhatsAppValue
} from "./industry-whatsapp-router.js";

/* ============================================================
 * APPLICATION CONSTANTS
 * ============================================================
 */

const TENANT_ID = 1;
const WARD_ID = 1;

/* ============================================================
 * CORS
 * ============================================================
 */

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods":
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true"
  };
}

/* ============================================================
 * JSON RESPONSE
 * ============================================================
 */

function json(
  data,
  status = 200,
  extraHeaders = {}
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        ...getCorsHeaders(),
        ...extraHeaders
      }
    }
  );
}

/* ============================================================
 * TEXT RESPONSE
 * ============================================================
 */

function textResponse(
  text,
  status = 200,
  extraHeaders = {}
) {
  return new Response(
    String(text),
    {
      status,
      headers: {
        "Content-Type":
          "text/plain; charset=utf-8",
        ...getCorsHeaders(),
        ...extraHeaders
      }
    }
  );
}

/* ============================================================
 * SAFE REQUEST JSON
 * ============================================================
 */

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

/* ============================================================
 * SAFE TEXT
 * ============================================================
 */

function cleanText(
  value,
  maxLength = 500
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .trim()
    .slice(0, maxLength);
}

/* ============================================================
 * EMAIL NORMALISATION
 * ============================================================
 */

function normaliseEmail(value) {
  return cleanText(
    value,
    254
  ).toLowerCase();
}

/* ============================================================
 * PHONE NORMALISATION
 * ============================================================
 */

function normalisePhone(value) {
  return cleanText(
    value,
    40
  ).replace(
    /[^\d+]/g,
    ""
  );
}

/* ============================================================
 * COOKIE READER
 * ============================================================
 */

function getCookie(
  request,
  name
) {
  const cookieHeader =
    request.headers.get("Cookie");

  if (!cookieHeader) {
    return null;
  }

  for (
    const part of cookieHeader.split(";")
  ) {
    const index =
      part.indexOf("=");

    if (index === -1) {
      continue;
    }

    const key =
      part
        .slice(0, index)
        .trim();

    const value =
      part
        .slice(index + 1)
        .trim();

    if (key === name) {
      try {
        return decodeURIComponent(
          value
        );
      } catch {
        return value;
      }
    }
  }

  return null;
}

/* ============================================================
 * CRYPTO HELPERS
 * ============================================================
 */

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(
      byte =>
        byte
          .toString(16)
          .padStart(2, "0")
    )
    .join("");
}

function bytesToBase64(bytes) {
  let binary = "";

  for (
    const byte of bytes
  ) {
    binary += String.fromCharCode(
      byte
    );
  }

  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary =
    atob(base64);

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let i = 0;
    i < binary.length;
    i++
  ) {
    bytes[i] =
      binary.charCodeAt(i);
  }

  return bytes;
}

/* ============================================================
 * PASSWORD HASHING
 * ============================================================
 */

async function hashPassword(
  password,
  saltBytes
) {
  const encoder =
    new TextEncoder();

  const keyMaterial =
    await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

  const derivedBits =
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBytes,
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );

  return new Uint8Array(
    derivedBits
  );
}

async function createPasswordHash(
  password
) {
  const salt =
    crypto.getRandomValues(
      new Uint8Array(16)
    );

  const hash =
    await hashPassword(
      password,
      salt
    );

  return {
    hash:
      bytesToBase64(hash),
    salt:
      bytesToBase64(salt)
  };
}

async function verifyPassword(
  password,
  storedHash,
  storedSalt
) {
  try {
    const salt =
      base64ToBytes(
        storedSalt
      );

    const expected =
      base64ToBytes(
        storedHash
      );

    const actual =
      await hashPassword(
        password,
        salt
      );

    if (
      actual.length !==
      expected.length
    ) {
      return false;
    }

    let difference = 0;

    for (
      let i = 0;
      i < actual.length;
      i++
    ) {
      difference |=
        actual[i] ^
        expected[i];
    }

    return difference === 0;

  } catch (error) {
    console.error(
      "Password verification error:",
      error
    );

    return false;
  }
}

/* ============================================================
 * SESSION TOKEN HASH
 * ============================================================
 */

async function hashSessionToken(
  token
) {
  const data =
    new TextEncoder()
      .encode(token);

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      data
    );

  return bytesToHex(
    new Uint8Array(
      digest
    )
  );
}

/* ============================================================
 * SESSION COOKIE
 * ============================================================
 */

function createSessionCookie(
  token,
  maxAge =
    60 * 60 * 24 * 30
) {
  return [
    "sbs_session=" +
      encodeURIComponent(token),
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAge}`
  ].join("; ");
}

/* ============================================================
 * CUSTOMER AUTH TABLES
 * ============================================================
 */

async function ensureAuthTables(
  env
) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS customer_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      business_name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      plan TEXT,
      subscription_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS customer_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_customer_sessions_account
    ON customer_sessions(account_id)
  `).run();
}

/* ============================================================
 * CUSTOMER SESSION
 * ============================================================
 */

async function createCustomerSession(
  env,
  accountId
) {
  const sessionToken =
    bytesToHex(
      crypto.getRandomValues(
        new Uint8Array(32)
      )
    );

  const tokenHash =
    await hashSessionToken(
      sessionToken
    );

  const expiresAt =
    new Date(
      Date.now() +
      30 *
      24 *
      60 *
      60 *
      1000
    ).toISOString();

  await env.DB.prepare(`
    INSERT INTO customer_sessions
    (
      account_id,
      token_hash,
      expires_at,
      created_at
    )
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `)
  .bind(
    accountId,
    tokenHash,
    expiresAt
  )
  .run();

  return {
    token:
      sessionToken,
    expiresAt
  };
}

/* ============================================================
 * AUTHENTICATED CUSTOMER
 * ============================================================
 */

async function getAuthenticatedAccount(
  request,
  env
) {
  try {
    await ensureAuthTables(
      env
    );

    const sessionToken =
      getCookie(
        request,
        "sbs_session"
      );

    if (!sessionToken) {
      return null;
    }

    const tokenHash =
      await hashSessionToken(
        sessionToken
      );

    const session =
      await env.DB.prepare(`
        SELECT
          customer_sessions.*,
          customer_accounts.id
            AS account_id,
          customer_accounts.tenant_id,
          customer_accounts.business_name,
          customer_accounts.full_name,
          customer_accounts.email,
          customer_accounts.phone,
          customer_accounts.plan,
          customer_accounts.subscription_status,
          customer_accounts.created_at
            AS account_created_at
        FROM customer_sessions
        INNER JOIN customer_accounts
          ON customer_accounts.id =
             customer_sessions.account_id
        WHERE customer_sessions.token_hash = ?
          AND customer_sessions.expires_at >
              CURRENT_TIMESTAMP
        LIMIT 1
      `)
      .bind(
        tokenHash
      )
      .first();

    if (!session) {
      return null;
    }

    if (
      String(
        session.subscription_status ||
        ""
      ).toLowerCase() ===
      "suspended"
    ) {
      return null;
    }

    return session;

  } catch (error) {
    console.error(
      "Authentication lookup error:",
      error
    );

    return null;
  }
}

/* ============================================================
 * PUBLIC CUSTOMER ACCOUNT
 * ============================================================
 */

function publicAccount(
  account
) {
  if (!account) {
    return null;
  }

  return {
    id:
      account.account_id ||
      account.id,
    tenant_id:
      account.tenant_id,
    business_name:
      account.business_name,
    full_name:
      account.full_name,
    email:
      account.email,
    phone:
      account.phone,
    plan:
      account.plan,
    subscription_status:
      account.subscription_status,
    created_at:
      account.account_created_at ||
      account.created_at
  };
}

/* ============================================================
 * CUSTOMER LOGOUT
 * ============================================================
 */

async function logoutCustomer(
  request,
  env
) {
  try {
    const sessionToken =
      getCookie(
        request,
        "sbs_session"
      );

    if (sessionToken) {
      const tokenHash =
        await hashSessionToken(
          sessionToken
        );

      await env.DB.prepare(`
        DELETE FROM customer_sessions
        WHERE token_hash = ?
      `)
      .bind(
        tokenHash
      )
      .run();
    }

    return json(
      {
        success: true,
        message:
          "Logged out successfully"
      },
      200,
      {
        "Set-Cookie":
          createSessionCookie(
            "",
            0
          )
      }
    );

  } catch (error) {
    console.error(
      "Logout error:",
      error
    );

    return json(
      {
        success: false,
        error:
          "Unable to log out"
      },
      500
    );
  }
}

// ============================================================
// PART 2 — SAAS MODULE ENGINE + NPO / NGO ENGINE
// ============================================================

async function ensureSaaSModuleTables(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS saas_modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_code TEXT NOT NULL UNIQUE,
      module_name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      monthly_price REAL NOT NULL DEFAULT 0,
      icon TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      customer_visible INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const modules = [
    [
      "community-service-centre",
      "Community Service Centre",
      "Civic",
      "Community complaints, service requests, ward management and public reporting.",
      0,
      "🏛️",
      1
    ],
    [
      "npo-ngo",
      "NPO / NGO Management",
      "Non-Profit",
      "Manage beneficiaries, projects, donors, donations, grants, volunteers and documents.",
      0,
      "🤝",
      2
    ],
    [
      "church-management",
      "Church Management",
      "Community",
      "Manage members, events, communication and church administration.",
      0,
      "⛪",
      3
    ],
    [
      "ecommerce",
      "E-Commerce",
      "Commerce",
      "Online products, customers, orders, payments and product media.",
      0,
      "🛒",
      4
    ],
    [
      "salon-barber",
      "Salon & Barber",
      "Business",
      "Appointments, customers, services and business management.",
      0,
      "💇",
      5
    ],
    [
      "laundry",
      "Laundry Service",
      "Business",
      "Laundry orders, customers, collection and delivery management.",
      0,
      "🧺",
      6
    ],
    [
      "food-business",
      "Food Business",
      "Business",
      "Food ordering, menus, customers and order management.",
      0,
      "🍔",
      7
    ],
    [
      "wholesale-grocery",
      "Wholesale Grocery",
      "Business",
      "Wholesale products, customers, orders and stock management.",
      0,
      "📦",
      8
    ],
    [
      "driving-school",
      "Driving School",
      "Education",
      "Learners, lessons, instructors and driving-school administration.",
      0,
      "🚗",
      9
    ],
    [
      "school-management",
      "School Management",
      "Education",
      "Learners, teachers, classes, communication and administration.",
      0,
      "🏫",
      10
    ],
    [
      "preschool-daycare",
      "Preschool & Daycare",
      "Education",
      "Children, parents, attendance, fees and daycare administration.",
      0,
      "🧒",
      11
    ],
    [
      "pharmacy",
      "Pharmacy",
      "Healthcare",
      "Customer, product and pharmacy business management.",
      0,
      "💊",
      12
    ],
    [
      "transport",
      "Transport",
      "Transport",
      "Vehicle, driver, customer and transport-service management.",
      0,
      "🚐",
      13
    ],
    [
      "it-business",
      "IT Business",
      "Technology",
      "IT customers, services, tickets, assets and technology management.",
      0,
      "💻",
      14
    ],
    [
      "building-materials",
      "Building Materials",
      "Commerce",
      "Building products, customers, quotations, orders and stock.",
      0,
      "🧱",
      15
    ],
    [
      "other-services",
      "Other Services",
      "Business",
      "Flexible business management for other service providers.",
      0,
      "⚙️",
      16
    ]
  ];

  for (const module of modules) {
    await env.DB.prepare(`
      INSERT INTO saas_modules
      (
        module_code,
        module_name,
        category,
        description,
        monthly_price,
        icon,
        active,
        customer_visible,
        display_order
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?)
      ON CONFLICT(module_code)
      DO UPDATE SET
        module_name = excluded.module_name,
        category = excluded.category,
        description = excluded.description,
        icon = excluded.icon,
        display_order = excluded.display_order,
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(...module)
    .run();
  }

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS customer_modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      module_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      activated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, module_code)
    )
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_customer_modules_account
    ON customer_modules(account_id)
  `).run();
}


// ============================================================
// NPO / NGO ENGINE
// ============================================================

async function ensureNPOTables(env) {

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS npo_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL UNIQUE,
      organisation_name TEXT,
      registration_number TEXT,
      organisation_type TEXT,
      mission TEXT,
      vision TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      tax_number TEXT,
      bank_name TEXT,
      bank_account_name TEXT,
      bank_account_number TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS npo_beneficiaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT,
      id_number TEXT,
      phone TEXT,
      email TEXT,
      gender TEXT,
      date_of_birth TEXT,
      address TEXT,
      vulnerability_category TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS npo_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      location TEXT,
      start_date TEXT,
      end_date TEXT,
      budget REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'planned',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS npo_donors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      donor_name TEXT NOT NULL,
      organisation TEXT,
      email TEXT,
      phone TEXT,
      donor_type TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS npo_donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      donor_id INTEGER,
      project_id INTEGER,
      amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'ZAR',
      donation_type TEXT,
      payment_reference TEXT,
      donation_date TEXT,
      status TEXT NOT NULL DEFAULT 'received',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS npo_grants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      funder_name TEXT NOT NULL,
      grant_name TEXT,
      application_reference TEXT,
      amount_requested REAL NOT NULL DEFAULT 0,
      amount_awarded REAL NOT NULL DEFAULT 0,
      application_date TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS npo_volunteers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT,
      phone TEXT,
      email TEXT,
      role TEXT,
      skills TEXT,
      availability TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS npo_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      project_id INTEGER,
      description TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      category TEXT,
      supplier TEXT,
      expense_date TEXT,
      payment_reference TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS npo_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      document_name TEXT NOT NULL,
      document_type TEXT,
      file_key TEXT,
      file_url TEXT,
      description TEXT,
      uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS npo_governance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      position TEXT NOT NULL,
      person_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      appointment_date TEXT,
      term_end_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();


  // NPO indexes

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_npo_beneficiaries_account
    ON npo_beneficiaries(account_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_npo_projects_account
    ON npo_projects(account_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_npo_donors_account
    ON npo_donors(account_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_npo_donations_account
    ON npo_donations(account_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_npo_grants_account
    ON npo_grants(account_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_npo_volunteers_account
    ON npo_volunteers(account_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_npo_expenses_account
    ON npo_expenses(account_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_npo_documents_account
    ON npo_documents(account_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_npo_governance_account
    ON npo_governance(account_id)
  `).run();
}


// ============================================================
// INITIALISE BUSINESS ENGINES
// ============================================================

async function ensureBusinessEngines(env) {
  await ensureAuthTables(env);
  await ensureSaaSModuleTables(env);
  await ensureNPOTables(env);

  try {
    await ensureWhatsAppSaaSTables(env);
  } catch (error) {
    console.error(
      "WhatsApp SaaS table initialisation error:",
      error
    );
  }

  try {
    await ensureIndustryWhatsAppRouterTables(env);
  } catch (error) {
    console.error(
      "Industry WhatsApp router table initialisation error:",
      error
    );
  }
}


// ============================================================
// PUBLIC SAAS MODULE CATALOGUE
// ============================================================

async function handleSaaSModuleRoutes(request, env, url) {

  if (
    url.pathname === "/api/saas/modules" &&
    request.method === "GET"
  ) {
    await ensureSaaSModuleTables(env);

    const result = await env.DB.prepare(`
      SELECT
        id,
        module_code,
        module_name,
        category,
        description,
        monthly_price,
        icon,
        active,
        customer_visible,
        display_order
      FROM saas_modules
      WHERE active = 1
        AND customer_visible = 1
      ORDER BY display_order ASC, module_name ASC
    `).all();

    return json({
      success: true,
      modules: result.results || []
    });
  }

  return null;
}


// ============================================================
// CUSTOMER MODULE ROUTES
// ============================================================

async function handleCustomerModuleRoutes(
  request,
  env,
  url,
  account
) {
  if (
    url.pathname === "/api/customer/modules" &&
    request.method === "GET"
  ) {
    await ensureSaaSModuleTables(env);

    const result = await env.DB.prepare(`
      SELECT
        sm.id,
        sm.module_code,
        sm.module_name,
        sm.category,
        sm.description,
        sm.monthly_price,
        sm.icon,
        cm.status,
        cm.activated_at
      FROM saas_modules sm
      LEFT JOIN customer_modules cm
        ON cm.module_code = sm.module_code
       AND cm.account_id = ?
      WHERE sm.active = 1
      ORDER BY sm.display_order ASC
    `)
    .bind(account.account_id)
    .all();

    return json({
      success: true,
      modules: result.results || []
    });
  }


  if (
    url.pathname === "/api/customer/modules/activate" &&
    request.method === "POST"
  ) {
    await ensureSaaSModuleTables(env);

    const body = await readJson(request);
    const moduleCode = cleanText(
      body.module_code,
      100
    ).toLowerCase();

    if (!moduleCode) {
      return json(
        {
          success: false,
          error: "module_code is required"
        },
        400
      );
    }

    const module = await env.DB.prepare(`
      SELECT *
      FROM saas_modules
      WHERE module_code = ?
        AND active = 1
      LIMIT 1
    `)
    .bind(moduleCode)
    .first();

    if (!module) {
      return json(
        {
          success: false,
          error: "SaaS module not found"
        },
        404
      );
    }

    await env.DB.prepare(`
      INSERT INTO customer_modules
      (
        account_id,
        module_code,
        status,
        activated_at,
        updated_at
      )
      VALUES (?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(account_id, module_code)
      DO UPDATE SET
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(
      account.account_id,
      moduleCode
    )
    .run();

    return json({
      success: true,
      message: "Module activated successfully",
      module: {
        module_code: module.module_code,
        module_name: module.module_name,
        status: "active"
      }
    });
  }


  if (
    url.pathname === "/api/customer/modules/deactivate" &&
    request.method === "POST"
  ) {
    await ensureSaaSModuleTables(env);

    const body = await readJson(request);
    const moduleCode = cleanText(
      body.module_code,
      100
    ).toLowerCase();

    if (!moduleCode) {
      return json(
        {
          success: false,
          error: "module_code is required"
        },
        400
      );
    }

    await env.DB.prepare(`
      UPDATE customer_modules
      SET
        status = 'inactive',
        updated_at = CURRENT_TIMESTAMP
      WHERE account_id = ?
        AND module_code = ?
    `)
    .bind(
      account.account_id,
      moduleCode
    )
    .run();

    return json({
      success: true,
      message: "Module deactivated successfully"
    });
  }

  return null;
}


// ============================================================
// NPO PROFILE ROUTES
// ============================================================

async function handleNPOProfileRoutes(
  request,
  env,
  url,
  account
) {
  if (
    url.pathname === "/api/npo/profile" &&
    request.method === "GET"
  ) {
    await ensureNPOTables(env);

    const profile = await env.DB.prepare(`
      SELECT *
      FROM npo_profiles
      WHERE account_id = ?
      LIMIT 1
    `)
    .bind(account.account_id)
    .first();

    return json({
      success: true,
      profile: profile || null
    });
  }


  if (
    url.pathname === "/api/npo/profile" &&
    (
      request.method === "POST" ||
      request.method === "PUT" ||
      request.method === "PATCH"
    )
  ) {
    await ensureNPOTables(env);

    const body = await readJson(request);

    const organisationName = cleanText(
      body.organisation_name,
      200
    );

    if (!organisationName) {
      return json(
        {
          success: false,
          error: "organisation_name is required"
        },
        400
      );
    }

    await env.DB.prepare(`
      INSERT INTO npo_profiles
      (
        account_id,
        organisation_name,
        registration_number,
        organisation_type,
        mission,
        vision,
        address,
        phone,
        email,
        website,
        tax_number,
        bank_name,
        bank_account_name,
        bank_account_number
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id)
      DO UPDATE SET
        organisation_name = excluded.organisation_name,
        registration_number = excluded.registration_number,
        organisation_type = excluded.organisation_type,
        mission = excluded.mission,
        vision = excluded.vision,
        address = excluded.address,
        phone = excluded.phone,
        email = excluded.email,
        website = excluded.website,
        tax_number = excluded.tax_number,
        bank_name = excluded.bank_name,
        bank_account_name = excluded.bank_account_name,
        bank_account_number = excluded.bank_account_number,
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(
      account.account_id,
      organisationName,
      cleanText(body.registration_number, 100),
      cleanText(body.organisation_type, 100),
      cleanText(body.mission, 2000),
      cleanText(body.vision, 2000),
      cleanText(body.address, 1000),
      normalisePhone(body.phone),
      normaliseEmail(body.email),
      cleanText(body.website, 500),
      cleanText(body.tax_number, 100),
      cleanText(body.bank_name, 200),
      cleanText(body.bank_account_name, 200),
      cleanText(body.bank_account_number, 100)
    )
    .run();

    const profile = await env.DB.prepare(`
      SELECT *
      FROM npo_profiles
      WHERE account_id = ?
      LIMIT 1
    `)
    .bind(account.account_id)
    .first();

    return json({
      success: true,
      message: "NPO / NGO profile saved successfully",
      profile
    });
  }

  return null;
      }

//
// ============================================================
// PART 3 — E-COMMERCE ENGINE
// ============================================================

async function ensureEcommerceTables(env) {

  // ----------------------------------------------------------
  // PRODUCT CATEGORIES
  // ----------------------------------------------------------

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS ecommerce_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, name)
    )
  `).run();


  // ----------------------------------------------------------
  // PRODUCTS
  // ----------------------------------------------------------

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS ecommerce_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      category_id INTEGER,
      name TEXT NOT NULL,
      slug TEXT,
      description TEXT,
      sku TEXT,
      price REAL NOT NULL DEFAULT 0,
      compare_at_price REAL,
      cost_price REAL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      track_stock INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      featured INTEGER NOT NULL DEFAULT 0,
      product_type TEXT,
      brand TEXT,
      weight REAL,
      weight_unit TEXT DEFAULT 'kg',
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();


  // ----------------------------------------------------------
  // PRODUCT MEDIA
  // ----------------------------------------------------------

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS ecommerce_product_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      media_type TEXT NOT NULL,
      file_key TEXT,
      file_url TEXT,
      mime_type TEXT,
      file_name TEXT,
      file_size INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();


  // ----------------------------------------------------------
  // E-COMMERCE CUSTOMERS
  // ----------------------------------------------------------

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS ecommerce_customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      province TEXT,
      postal_code TEXT,
      country TEXT DEFAULT 'South Africa',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();


  // ----------------------------------------------------------
  // ORDERS
  // ----------------------------------------------------------

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS ecommerce_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      customer_id INTEGER,
      order_number TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      shipping_amount REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'ZAR',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      order_status TEXT NOT NULL DEFAULT 'pending',
      payment_method TEXT,
      payment_reference TEXT,
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      shipping_address TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, order_number)
    )
  `).run();


  // ----------------------------------------------------------
  // ORDER ITEMS
  // ----------------------------------------------------------

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS ecommerce_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      sku TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      total_price REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();


  // ----------------------------------------------------------
  // SHOPPING CARTS
  // ----------------------------------------------------------

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS ecommerce_carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      customer_id INTEGER,
      session_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();


  // ----------------------------------------------------------
  // CART ITEMS
  // ----------------------------------------------------------

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS ecommerce_cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      cart_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(cart_id, product_id)
    )
  `).run();


  // ----------------------------------------------------------
  // INDEXES
  // ----------------------------------------------------------

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_ecommerce_categories_account
    ON ecommerce_categories(account_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_ecommerce_products_account
    ON ecommerce_products(account_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_ecommerce_products_status
    ON ecommerce_products(account_id, status)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_ecommerce_product_media_product
    ON ecommerce_product_media(product_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_ecommerce_customers_account
    ON ecommerce_customers(account_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_ecommerce_orders_account
    ON ecommerce_orders(account_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_ecommerce_order_items_order
    ON ecommerce_order_items(order_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_ecommerce_carts_account
    ON ecommerce_carts(account_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_ecommerce_cart_items_cart
    ON ecommerce_cart_items(cart_id)
  `).run();
}


// ============================================================
// E-COMMERCE HELPERS
// ============================================================

function makeSlug(value) {
  return cleanText(value, 200)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
}


function generateOrderNumber() {
  const random = Math.floor(
    100000 + Math.random() * 900000
  );

  return `SBS-${Date.now().toString(36).toUpperCase()}-${random}`;
}


async function getProductById(env, accountId, productId) {
  return await env.DB.prepare(`
    SELECT
      p.*,
      c.name AS category_name
    FROM ecommerce_products p
    LEFT JOIN ecommerce_categories c
      ON c.id = p.category_id
     AND c.account_id = p.account_id
    WHERE p.id = ?
      AND p.account_id = ?
    LIMIT 1
  `)
  .bind(productId, accountId)
  .first();
}


async function getProductMedia(env, accountId, productId) {
  const result = await env.DB.prepare(`
    SELECT
      id,
      media_type,
      file_key,
      file_url,
      mime_type,
      file_name,
      file_size,
      sort_order,
      is_primary,
      created_at
    FROM ecommerce_product_media
    WHERE account_id = ?
      AND product_id = ?
    ORDER BY
      is_primary DESC,
      sort_order ASC,
      id ASC
  `)
  .bind(accountId, productId)
  .all();

  return result.results || [];
}


async function getPublicProduct(env, product) {
  if (!product) return null;

  const media = await getProductMedia(
    env,
    product.account_id,
    product.id
  );

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    sku: product.sku,
    price: product.price,
    compare_at_price: product.compare_at_price,
    stock_quantity: product.stock_quantity,
    track_stock: product.track_stock,
    status: product.status,
    featured: product.featured,
    product_type: product.product_type,
    brand: product.brand,
    weight: product.weight,
    weight_unit: product.weight_unit,
    category_id: product.category_id,
    category_name: product.category_name,
    media
  };
}


// ============================================================
// E-COMMERCE CATEGORY ROUTES
// ============================================================

async function handleEcommerceCategoryRoutes(
  request,
  env,
  url,
  account
) {

  if (
    url.pathname === "/api/ecommerce/categories" &&
    request.method === "GET"
  ) {
    await ensureEcommerceTables(env);

    const result = await env.DB.prepare(`
      SELECT *
      FROM ecommerce_categories
      WHERE account_id = ?
      ORDER BY name ASC
    `)
    .bind(account.account_id)
    .all();

    return json({
      success: true,
      categories: result.results || []
    });
  }


  if (
    url.pathname === "/api/ecommerce/categories" &&
    request.method === "POST"
  ) {
    await ensureEcommerceTables(env);

    const body = await readJson(request);

    const name = cleanText(
      body.name,
      150
    );

    const description = cleanText(
      body.description,
      1000
    );

    if (!name) {
      return json(
        {
          success: false,
          error: "Category name is required"
        },
        400
      );
    }

    try {
      const result = await env.DB.prepare(`
        INSERT INTO ecommerce_categories
        (
          account_id,
          name,
          description
        )
        VALUES (?, ?, ?)
      `)
      .bind(
        account.account_id,
        name,
        description
      )
      .run();

      return json({
        success: true,
        message: "Category created successfully",
        category_id: result.meta.last_row_id
      });
    } catch (error) {
      return json(
        {
          success: false,
          error: "Category already exists"
        },
        409
      );
    }
  }


  if (
    url.pathname.match(
      /^\/api\/ecommerce\/categories\/\d+$/
    ) &&
    (
      request.method === "PUT" ||
      request.method === "PATCH"
    )
  ) {
    await ensureEcommerceTables(env);

    const categoryId = Number(
      url.pathname.split("/").pop()
    );

    const body = await readJson(request);

    const name = cleanText(
      body.name,
      150
    );

    const description = cleanText(
      body.description,
      1000
    );

    if (!name) {
      return json(
        {
          success: false,
          error: "Category name is required"
        },
        400
      );
    }

    const result = await env.DB.prepare(`
      UPDATE ecommerce_categories
      SET
        name = ?,
        description = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND account_id = ?
    `)
    .bind(
      name,
      description,
      categoryId,
      account.account_id
    )
    .run();

    if (!result.meta.changes) {
      return json(
        {
          success: false,
          error: "Category not found"
        },
        404
      );
    }

    return json({
      success: true,
      message: "Category updated successfully"
    });
  }


  if (
    url.pathname.match(
      /^\/api\/ecommerce\/categories\/\d+$/
    ) &&
    request.method === "DELETE"
  ) {
    await ensureEcommerceTables(env);

    const categoryId = Number(
      url.pathname.split("/").pop()
    );

    const result = await env.DB.prepare(`
      UPDATE ecommerce_categories
      SET
        active = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND account_id = ?
    `)
    .bind(
      categoryId,
      account.account_id
    )
    .run();

    if (!result.meta.changes) {
      return json(
        {
          success: false,
          error: "Category not found"
        },
        404
      );
    }

    return json({
      success: true,
      message: "Category removed successfully"
    });
  }

  return null;
}


// ============================================================
// PUBLIC PRODUCT CATALOGUE
// ============================================================

async function handlePublicEcommerceRoutes(
  request,
  env,
  url
) {

  if (
    url.pathname === "/api/ecommerce/store" &&
    request.method === "GET"
  ) {
    await ensureEcommerceTables(env);

    const tenantId = Number(
      url.searchParams.get("tenant_id") || TENANT_ID
    );

    const products = await env.DB.prepare(`
      SELECT
        p.*,
        c.name AS category_name
      FROM ecommerce_products p
      LEFT JOIN ecommerce_categories c
        ON c.id = p.category_id
      WHERE p.status = 'active'
        AND p.account_id IN (
          SELECT id
          FROM customer_accounts
          WHERE tenant_id = ?
        )
      ORDER BY
        p.featured DESC,
        p.created_at DESC
    `)
    .bind(tenantId)
    .all();

    const output = [];

    for (const product of products.results || []) {
      output.push(
        await getPublicProduct(env, product)
      );
    }

    return json({
      success: true,
      products: output
    });
  }


  if (
    url.pathname.match(
      /^\/api\/ecommerce\/store\/product\/\d+$/
    ) &&
    request.method === "GET"
  ) {
    await ensureEcommerceTables(env);

    const productId = Number(
      url.pathname.split("/").pop()
    );

    const product = await env.DB.prepare(`
      SELECT
        p.*,
        c.name AS category_name
      FROM ecommerce_products p
      LEFT JOIN ecommerce_categories c
        ON c.id = p.category_id
      WHERE p.id = ?
        AND p.status = 'active'
      LIMIT 1
    `)
    .bind(productId)
    .first();

    if (!product) {
      return json(
        {
          success: false,
          error: "Product not found"
        },
        404
      );
    }

    return json({
      success: true,
      product:
        await getPublicProduct(env, product)
    });
  }

  return null;
}


// ============================================================
// CUSTOMER PRODUCT MANAGEMENT
// ============================================================

async function handleEcommerceProductRoutes(
  request,
  env,
  url,
  account
) {

  if (
    url.pathname === "/api/ecommerce/products" &&
    request.method === "GET"
  ) {
    await ensureEcommerceTables(env);

    const result = await env.DB.prepare(`
      SELECT
        p.*,
        c.name AS category_name
      FROM ecommerce_products p
      LEFT JOIN ecommerce_categories c
        ON c.id = p.category_id
       AND c.account_id = p.account_id
      WHERE p.account_id = ?
      ORDER BY p.created_at DESC
    `)
    .bind(account.account_id)
    .all();

    const products = [];

    for (const product of result.results || []) {
      products.push(
        await getPublicProduct(env, product)
      );
    }

    return json({
      success: true,
      products
    });
  }


  if (
    url.pathname === "/api/ecommerce/products" &&
    request.method === "POST"
  ) {
    await ensureEcommerceTables(env);

    const body = await readJson(request);

    const name = cleanText(
      body.name,
      200
    );

    if (!name) {
      return json(
        {
          success: false,
          error: "Product name is required"
        },
        400
      );
    }

    const price = Number(
      body.price || 0
    );

    const stockQuantity = Number.isFinite(
      Number(body.stock_quantity)
    )
      ? Math.max(
          0,
          Number(body.stock_quantity)
        )
      : 0;

    const categoryId =
      body.category_id
        ? Number(body.category_id)
        : null;

    const slug =
      makeSlug(body.slug || name);

    const result = await env.DB.prepare(`
      INSERT INTO ecommerce_products
      (
        account_id,
        category_id,
        name,
        slug,
        description,
        sku,
        price,
        compare_at_price,
        cost_price,
        stock_quantity,
        low_stock_threshold,
        track_stock,
        status,
        featured,
        product_type,
        brand,
        weight,
        weight_unit,
        metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      account.account_id,
      categoryId,
      name,
      slug,
      cleanText(body.description, 5000),
      cleanText(body.sku, 100),
      Number.isFinite(price) ? price : 0,
      body.compare_at_price !== undefined &&
      body.compare_at_price !== null &&
      body.compare_at_price !== ""
        ? Number(body.compare_at_price)
        : null,
      body.cost_price !== undefined &&
      body.cost_price !== null &&
      body.cost_price !== ""
        ? Number(body.cost_price)
        : null,
      stockQuantity,
      Math.max(
        0,
        Number(body.low_stock_threshold || 5)
      ),
      body.track_stock === false ? 0 : 1,
      body.status === "draft"
        ? "draft"
        : "active",
      body.featured ? 1 : 0,
      cleanText(body.product_type, 100),
      cleanText(body.brand, 150),
      body.weight !== undefined
        ? Number(body.weight)
        : null,
      cleanText(
        body.weight_unit || "kg",
        20
      ),
      typeof body.metadata === "string"
        ? body.metadata
        : JSON.stringify(
            body.metadata || {}
          )
    )
    .run();

    const product =
      await getProductById(
        env,
        account.account_id,
        result.meta.last_row_id
      );

    return json({
      success: true,
      message: "Product created successfully",
      product:
        await getPublicProduct(
          env,
          product
        )
    });
  }


  if (
    url.pathname.match(
      /^\/api\/ecommerce\/products\/\d+$/
    ) &&
    (
      request.method === "PUT" ||
      request.method === "PATCH"
    )
  ) {
    await ensureEcommerceTables(env);

    const productId = Number(
      url.pathname.split("/").pop()
    );

    const existing =
      await getProductById(
        env,
        account.account_id,
        productId
      );

    if (!existing) {
      return json(
        {
          success: false,
          error: "Product not found"
        },
        404
      );
    }

    const body = await readJson(request);

    const name =
      body.name !== undefined
        ? cleanText(body.name, 200)
        : existing.name;

    const price =
      body.price !== undefined
        ? Number(body.price)
        : existing.price;

    const stockQuantity =
      body.stock_quantity !== undefined
        ? Math.max(
            0,
            Number(body.stock_quantity)
          )
        : existing.stock_quantity;

    const categoryId =
      body.category_id !== undefined
        ? (
            body.category_id === null ||
            body.category_id === ""
              ? null
              : Number(body.category_id)
          )
        : existing.category_id;

    const result = await env.DB.prepare(`
      UPDATE ecommerce_products
      SET
        category_id = ?,
        name = ?,
        slug = ?,
        description = ?,
        sku = ?,
        price = ?,
        compare_at_price = ?,
        cost_price = ?,
        stock_quantity = ?,
        low_stock_threshold = ?,
        track_stock = ?,
        status = ?,
        featured = ?,
        product_type = ?,
        brand = ?,
        weight = ?,
        weight_unit = ?,
        metadata = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND account_id = ?
    `)
    .bind(
      categoryId,
      name,
      makeSlug(
        body.slug !== undefined
          ? body.slug
          : name
      ),
      body.description !== undefined
        ? cleanText(body.description, 5000)
        : existing.description,
      body.sku !== undefined
        ? cleanText(body.sku, 100)
        : existing.sku,
      Number.isFinite(price)
        ? price
        : existing.price,
      body.compare_at_price !== undefined
        ? (
            body.compare_at_price === null ||
            body.compare_at_price === ""
              ? null
              : Number(body.compare_at_price)
          )
        : existing.compare_at_price,
      body.cost_price !== undefined
        ? (
            body.cost_price === null ||
            body.cost_price === ""
              ? null
              : Number(body.cost_price)
          )
        : existing.cost_price,
      Number.isFinite(stockQuantity)
        ? stockQuantity
        : existing.stock_quantity,
      body.low_stock_threshold !== undefined
        ? Math.max(
            0,
            Number(body.low_stock_threshold)
          )
        : existing.low_stock_threshold,
      body.track_stock !== undefined
        ? (body.track_stock ? 1 : 0)
        : existing.track_stock,
      body.status !== undefined
        ? (
            body.status === "draft"
              ? "draft"
              : "active"
          )
        : existing.status,
      body.featured !== undefined
        ? (body.featured ? 1 : 0)
        : existing.featured,
      body.product_type !== undefined
        ? cleanText(body.product_type, 100)
        : existing.product_type,
      body.brand !== undefined
        ? cleanText(body.brand, 150)
        : existing.brand,
      body.weight !== undefined
        ? (
            body.weight === null ||
            body.weight === ""
              ? null
              : Number(body.weight)
          )
        : existing.weight,
      body.weight_unit !== undefined
        ? cleanText(body.weight_unit, 20)
        : existing.weight_unit,
      body.metadata !== undefined
        ? (
            typeof body.metadata === "string"
              ? body.metadata
              : JSON.stringify(body.metadata)
          )
        : existing.metadata,
      productId,
      account.account_id
    )
    .run();

    if (!result.meta.changes) {
      return json(
        {
          success: false,
          error: "Product was not updated"
        },
        404
      );
    }

    const product =
      await getProductById(
        env,
        account.account_id,
        productId
      );

    return json({
      success: true,
      message: "Product updated successfully",
      product:
        await getPublicProduct(
          env,
          product
        )
    });
  }


  if (
    url.pathname.match(
      /^\/api\/ecommerce\/products\/\d+$/
    ) &&
    request.method === "DELETE"
  ) {
    await ensureEcommerceTables(env);

    const productId = Number(
      url.pathname.split("/").pop()
    );

    const result = await env.DB.prepare(`
      UPDATE ecommerce_products
      SET
        status = 'archived',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND account_id = ?
    `)
    .bind(
      productId,
      account.account_id
    )
    .run();

    if (!result.meta.changes) {
      return json(
        {
          success: false,
          error: "Product not found"
        },
        404
      );
    }

    return json({
      success: true,
      message: "Product archived successfully"
    });
  }

  return null;

                 }


// ============================================================
// PART 4 — E-COMMERCE MEDIA / R2 UPLOADS
// ============================================================

async function handleEcommerceMediaRoutes(
  request,
  env,
  url,
  account
) {

  // ----------------------------------------------------------
  // UPLOAD PRODUCT IMAGE OR VIDEO
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/ecommerce/media/upload" &&
    request.method === "POST"
  ) {
    await ensureEcommerceTables(env);

    if (!env.MEDIA) {
      return json(
        {
          success: false,
          error:
            "MEDIA R2 storage is not configured. Add the MEDIA R2 binding in wrangler.toml."
        },
        500
      );
    }

    const formData = await request.formData();

    const productIdValue =
      formData.get("product_id");

    const file =
      formData.get("file");

    if (!productIdValue) {
      return json(
        {
          success: false,
          error: "product_id is required"
        },
        400
      );
    }

    if (!file || typeof file.arrayBuffer !== "function") {
      return json(
        {
          success: false,
          error:
            "Please select an image or video file."
        },
        400
      );
    }

    const productId =
      Number(productIdValue);

    if (!Number.isInteger(productId) || productId <= 0) {
      return json(
        {
          success: false,
          error: "Invalid product_id"
        },
        400
      );
    }

    const product =
      await getProductById(
        env,
        account.account_id,
        productId
      );

    if (!product) {
      return json(
        {
          success: false,
          error: "Product not found"
        },
        404
      );
    }


    // --------------------------------------------------------
    // FILE TYPE
    // --------------------------------------------------------

    const mimeType =
      cleanText(
        file.type || "",
        150
      ).toLowerCase();

    const originalName =
      cleanText(
        file.name || "upload",
        255
      );

    const isImage =
      mimeType.startsWith("image/");

    const isVideo =
      mimeType.startsWith("video/");

    if (!isImage && !isVideo) {
      return json(
        {
          success: false,
          error:
            "Only image and video files are allowed."
        },
        400
      );
    }


    // --------------------------------------------------------
    // FILE SIZE
    // --------------------------------------------------------

    const MAX_IMAGE_SIZE =
      20 * 1024 * 1024;

    const MAX_VIDEO_SIZE =
      100 * 1024 * 1024;

    const maxSize =
      isVideo
        ? MAX_VIDEO_SIZE
        : MAX_IMAGE_SIZE;

    if (file.size > maxSize) {
      return json(
        {
          success: false,
          error:
            isVideo
              ? "Video is too large. Maximum size is 100 MB."
              : "Image is too large. Maximum size is 20 MB."
        },
        413
      );
    }


    // --------------------------------------------------------
    // SAFE FILE EXTENSION
    // --------------------------------------------------------

    const extensionMap = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/svg+xml": "svg",

      "video/mp4": "mp4",
      "video/webm": "webm",
      "video/quicktime": "mov",
      "video/x-msvideo": "avi"
    };

    let extension =
      extensionMap[mimeType];

    if (!extension) {
      const nameParts =
        originalName.split(".");

      extension =
        nameParts.length > 1
          ? nameParts.pop()
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "")
          : "bin";
    }

    if (!extension) {
      extension = "bin";
    }


    // --------------------------------------------------------
    // UNIQUE R2 KEY
    // --------------------------------------------------------

    const randomBytes =
      crypto.getRandomValues(
        new Uint8Array(12)
      );

    const randomPart =
      bytesToHex(randomBytes);

    const mediaType =
      isVideo
        ? "video"
        : "image";

    const mediaKey =
      [
        "ecommerce",
        String(account.account_id),
        "products",
        String(productId),
        `${Date.now()}-${randomPart}.${extension}`
      ].join("/");


    // --------------------------------------------------------
    // STORE FILE IN R2
    // --------------------------------------------------------

    const arrayBuffer =
      await file.arrayBuffer();

    await env.MEDIA.put(
      mediaKey,
      arrayBuffer,
      {
        httpMetadata: {
          contentType: mimeType,
          cacheControl:
            "public, max-age=31536000"
        },
        customMetadata: {
          accountId:
            String(account.account_id),
          productId:
            String(productId),
          originalName
        }
      }
    );


    // --------------------------------------------------------
    // CREATE PUBLIC MEDIA URL
    // --------------------------------------------------------

    const fileUrl =
      `/media/${mediaKey}`;


    // --------------------------------------------------------
    // DETERMINE SORT ORDER
    // --------------------------------------------------------

    const sortResult =
      await env.DB.prepare(`
        SELECT
          COALESCE(
            MAX(sort_order),
            -1
          ) + 1 AS next_order
        FROM ecommerce_product_media
        WHERE account_id = ?
          AND product_id = ?
      `)
      .bind(
        account.account_id,
        productId
      )
      .first();

    const sortOrder =
      Number(
        sortResult?.next_order || 0
      );


    // --------------------------------------------------------
    // FIRST MEDIA BECOMES PRIMARY
    // --------------------------------------------------------

    const existingMedia =
      await env.DB.prepare(`
        SELECT id
        FROM ecommerce_product_media
        WHERE account_id = ?
          AND product_id = ?
        LIMIT 1
      `)
      .bind(
        account.account_id,
        productId
      )
      .first();

    const isPrimary =
      existingMedia ? 0 : 1;


    // --------------------------------------------------------
    // SAVE MEDIA RECORD
    // --------------------------------------------------------

    const result =
      await env.DB.prepare(`
        INSERT INTO ecommerce_product_media
        (
          account_id,
          product_id,
          media_type,
          file_key,
          file_url,
          mime_type,
          file_name,
          file_size,
          sort_order,
          is_primary
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        account.account_id,
        productId,
        mediaType,
        mediaKey,
        fileUrl,
        mimeType,
        originalName,
        Number(file.size || arrayBuffer.byteLength),
        sortOrder,
        isPrimary
      )
      .run();


    return json({
      success: true,
      message:
        isVideo
          ? "Video uploaded successfully"
          : "Image uploaded successfully",

      media: {
        id:
          result.meta.last_row_id,

        product_id:
          productId,

        media_type:
          mediaType,

        file_key:
          mediaKey,

        file_url:
          fileUrl,

        mime_type:
          mimeType,

        file_name:
          originalName,

        file_size:
          Number(
            file.size ||
            arrayBuffer.byteLength
          ),

        sort_order:
          sortOrder,

        is_primary:
          isPrimary
      }
    });
  }


  // ----------------------------------------------------------
  // LIST PRODUCT MEDIA
  // ----------------------------------------------------------

  const mediaListMatch =
    url.pathname.match(
      /^\/api\/ecommerce\/products\/(\d+)\/media$/
    );

  if (
    mediaListMatch &&
    request.method === "GET"
  ) {
    await ensureEcommerceTables(env);

    const productId =
      Number(mediaListMatch[1]);

    const product =
      await getProductById(
        env,
        account.account_id,
        productId
      );

    if (!product) {
      return json(
        {
          success: false,
          error: "Product not found"
        },
        404
      );
    }

    const media =
      await getProductMedia(
        env,
        account.account_id,
        productId
      );

    return json({
      success: true,
      media
    });
  }


  // ----------------------------------------------------------
  // DELETE PRODUCT MEDIA
  // ----------------------------------------------------------

  const mediaDeleteMatch =
    url.pathname.match(
      /^\/api\/ecommerce\/media\/(\d+)$/
    );

  if (
    mediaDeleteMatch &&
    request.method === "DELETE"
  ) {
    await ensureEcommerceTables(env);

    const mediaId =
      Number(mediaDeleteMatch[1]);

    const media =
      await env.DB.prepare(`
        SELECT *
        FROM ecommerce_product_media
        WHERE id = ?
          AND account_id = ?
        LIMIT 1
      `)
      .bind(
        mediaId,
        account.account_id
      )
      .first();

    if (!media) {
      return json(
        {
          success: false,
          error: "Media not found"
        },
        404
      );
    }


    // Delete from R2 when the file exists.

    if (
      env.MEDIA &&
      media.file_key
    ) {
      try {
        await env.MEDIA.delete(
          media.file_key
        );
      } catch (error) {
        console.error(
          "R2 media delete error:",
          error
        );
      }
    }


    await env.DB.prepare(`
      DELETE FROM ecommerce_product_media
      WHERE id = ?
        AND account_id = ?
    `)
    .bind(
      mediaId,
      account.account_id
    )
    .run();


    // If the deleted item was primary,
    // promote the next media item.

    if (Number(media.is_primary) === 1) {

      const nextMedia =
        await env.DB.prepare(`
          SELECT id
          FROM ecommerce_product_media
          WHERE account_id = ?
            AND product_id = ?
          ORDER BY
            sort_order ASC,
            id ASC
          LIMIT 1
        `)
        .bind(
          account.account_id,
          media.product_id
        )
        .first();

      if (nextMedia) {
        await env.DB.prepare(`
          UPDATE ecommerce_product_media
          SET is_primary = 1
          WHERE id = ?
            AND account_id = ?
        `)
        .bind(
          nextMedia.id,
          account.account_id
        )
        .run();
      }
    }


    return json({
      success: true,
      message:
        "Media deleted successfully"
    });
  }


  // ----------------------------------------------------------
  // SET PRIMARY MEDIA
  // ----------------------------------------------------------

  const primaryMatch =
    url.pathname.match(
      /^\/api\/ecommerce\/media\/(\d+)\/primary$/
    );

  if (
    primaryMatch &&
    request.method === "POST"
  ) {
    await ensureEcommerceTables(env);

    const mediaId =
      Number(primaryMatch[1]);

    const media =
      await env.DB.prepare(`
        SELECT *
        FROM ecommerce_product_media
        WHERE id = ?
          AND account_id = ?
        LIMIT 1
      `)
      .bind(
        mediaId,
        account.account_id
      )
      .first();

    if (!media) {
      return json(
        {
          success: false,
          error: "Media not found"
        },
        404
      );
    }


    await env.DB.prepare(`
      UPDATE ecommerce_product_media
      SET is_primary = 0
      WHERE account_id = ?
        AND product_id = ?
    `)
    .bind(
      account.account_id,
      media.product_id
    )
    .run();


    await env.DB.prepare(`
      UPDATE ecommerce_product_media
      SET is_primary = 1
      WHERE id = ?
        AND account_id = ?
    `)
    .bind(
      mediaId,
      account.account_id
    )
    .run();


    return json({
      success: true,
      message:
        "Primary media updated successfully"
    });
  }


  return null;
}


// ============================================================
// R2 MEDIA SERVING
// ============================================================

async function handleMediaServing(
  request,
  env,
  url
) {

  if (
    !url.pathname.startsWith("/media/") ||
    request.method !== "GET"
  ) {
    return null;
  }

  if (!env.MEDIA) {
    return new Response(
      "Media storage is not configured.",
      {
        status: 500,
        headers: getCorsHeaders()
      }
    );
  }

  const mediaKey =
    decodeURIComponent(
      url.pathname
        .slice("/media/".length)
    );

  if (!mediaKey) {
    return new Response(
      "Media file not found.",
      {
        status: 404,
        headers: getCorsHeaders()
      }
    );
  }

  const object =
    await env.MEDIA.get(mediaKey);

  if (!object) {
    return new Response(
      "Media file not found.",
      {
        status: 404,
        headers: getCorsHeaders()
      }
    );
  }


  const headers =
    new Headers(
      getCorsHeaders()
    );

  object.writeHttpMetadata(
    headers
  );

  headers.set(
    "ETag",
    object.httpEtag
  );

  headers.set(
    "Cache-Control",
    "public, max-age=31536000"
  );

  return new Response(
    object.body,
    {
      status: 200,
      headers
    }
  );
        }

// ============================================================
// PART 5 — E-COMMERCE CUSTOMERS, CART & ORDERS
// ============================================================


// ============================================================
// CUSTOMER MANAGEMENT
// ============================================================

async function handleEcommerceCustomerRoutes(
  request,
  env,
  url,
  account
) {
  await ensureEcommerceTables(env);

  // ----------------------------------------------------------
  // LIST CUSTOMERS
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/ecommerce/customers" &&
    request.method === "GET"
  ) {
    const result = await env.DB.prepare(`
      SELECT *
      FROM ecommerce_customers
      WHERE account_id = ?
      ORDER BY created_at DESC
    `)
    .bind(account.account_id)
    .all();

    return json({
      success: true,
      customers: result.results || []
    });
  }


  // ----------------------------------------------------------
  // CREATE CUSTOMER
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/ecommerce/customers" &&
    request.method === "POST"
  ) {
    const body = await readJson(request);

    const fullName = cleanText(
      body.full_name,
      200
    );

    if (!fullName) {
      return json(
        {
          success: false,
          error: "full_name is required"
        },
        400
      );
    }

    const result = await env.DB.prepare(`
      INSERT INTO ecommerce_customers
      (
        account_id,
        full_name,
        email,
        phone,
        address,
        city,
        province,
        postal_code,
        country,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      account.account_id,
      fullName,
      normaliseEmail(body.email),
      normalisePhone(body.phone),
      cleanText(body.address, 1000),
      cleanText(body.city, 100),
      cleanText(body.province, 100),
      cleanText(body.postal_code, 30),
      cleanText(
        body.country || "South Africa",
        100
      ),
      cleanText(body.notes, 2000)
    )
    .run();

    const customer =
      await env.DB.prepare(`
        SELECT *
        FROM ecommerce_customers
        WHERE id = ?
          AND account_id = ?
        LIMIT 1
      `)
      .bind(
        result.meta.last_row_id,
        account.account_id
      )
      .first();

    return json({
      success: true,
      message: "Customer created successfully",
      customer
    });
  }


  // ----------------------------------------------------------
  // UPDATE CUSTOMER
  // ----------------------------------------------------------

  const customerMatch =
    url.pathname.match(
      /^\/api\/ecommerce\/customers\/(\d+)$/
    );

  if (
    customerMatch &&
    (
      request.method === "PUT" ||
      request.method === "PATCH"
    )
  ) {
    const customerId =
      Number(customerMatch[1]);

    const existing =
      await env.DB.prepare(`
        SELECT *
        FROM ecommerce_customers
        WHERE id = ?
          AND account_id = ?
        LIMIT 1
      `)
      .bind(
        customerId,
        account.account_id
      )
      .first();

    if (!existing) {
      return json(
        {
          success: false,
          error: "Customer not found"
        },
        404
      );
    }

    const body = await readJson(request);

    await env.DB.prepare(`
      UPDATE ecommerce_customers
      SET
        full_name = ?,
        email = ?,
        phone = ?,
        address = ?,
        city = ?,
        province = ?,
        postal_code = ?,
        country = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND account_id = ?
    `)
    .bind(
      body.full_name !== undefined
        ? cleanText(body.full_name, 200)
        : existing.full_name,

      body.email !== undefined
        ? normaliseEmail(body.email)
        : existing.email,

      body.phone !== undefined
        ? normalisePhone(body.phone)
        : existing.phone,

      body.address !== undefined
        ? cleanText(body.address, 1000)
        : existing.address,

      body.city !== undefined
        ? cleanText(body.city, 100)
        : existing.city,

      body.province !== undefined
        ? cleanText(body.province, 100)
        : existing.province,

      body.postal_code !== undefined
        ? cleanText(body.postal_code, 30)
        : existing.postal_code,

      body.country !== undefined
        ? cleanText(body.country, 100)
        : existing.country,

      body.notes !== undefined
        ? cleanText(body.notes, 2000)
        : existing.notes,

      customerId,
      account.account_id
    )
    .run();

    return json({
      success: true,
      message: "Customer updated successfully"
    });
  }


  // ----------------------------------------------------------
  // DELETE CUSTOMER
  // ----------------------------------------------------------

  if (
    customerMatch &&
    request.method === "DELETE"
  ) {
    const customerId =
      Number(customerMatch[1]);

    const result =
      await env.DB.prepare(`
        DELETE FROM ecommerce_customers
        WHERE id = ?
          AND account_id = ?
      `)
      .bind(
        customerId,
        account.account_id
      )
      .run();

    if (!result.meta.changes) {
      return json(
        {
          success: false,
          error: "Customer not found"
        },
        404
      );
    }

    return json({
      success: true,
      message: "Customer deleted successfully"
    });
  }

  return null;
}


// ============================================================
// SHOPPING CART
// ============================================================

async function getOrCreateCart(
  env,
  accountId,
  customerId = null,
  sessionId = null
) {
  let cart = null;

  if (customerId) {
    cart =
      await env.DB.prepare(`
        SELECT *
        FROM ecommerce_carts
        WHERE account_id = ?
          AND customer_id = ?
          AND status = 'active'
        ORDER BY id DESC
        LIMIT 1
      `)
      .bind(
        accountId,
        customerId
      )
      .first();
  }

  if (!cart && sessionId) {
    cart =
      await env.DB.prepare(`
        SELECT *
        FROM ecommerce_carts
        WHERE account_id = ?
          AND session_id = ?
          AND status = 'active'
        ORDER BY id DESC
        LIMIT 1
      `)
      .bind(
        accountId,
        sessionId
      )
      .first();
  }

  if (cart) {
    return cart;
  }

  const result =
    await env.DB.prepare(`
      INSERT INTO ecommerce_carts
      (
        account_id,
        customer_id,
        session_id,
        status
      )
      VALUES (?, ?, ?, 'active')
    `)
    .bind(
      accountId,
      customerId,
      sessionId
    )
    .run();

  return await env.DB.prepare(`
    SELECT *
    FROM ecommerce_carts
    WHERE id = ?
    LIMIT 1
  `)
  .bind(
    result.meta.last_row_id
  )
  .first();
}


async function getCart(
  env,
  accountId,
  cartId
) {
  const cart =
    await env.DB.prepare(`
      SELECT *
      FROM ecommerce_carts
      WHERE id = ?
        AND account_id = ?
      LIMIT 1
    `)
    .bind(
      cartId,
      accountId
    )
    .first();

  if (!cart) {
    return null;
  }

  const items =
    await env.DB.prepare(`
      SELECT
        ci.*,
        p.name AS current_product_name,
        p.price AS current_product_price,
        p.stock_quantity,
        p.status AS product_status,
        p.sku
      FROM ecommerce_cart_items ci
      LEFT JOIN ecommerce_products p
        ON p.id = ci.product_id
       AND p.account_id = ci.account_id
      WHERE ci.cart_id = ?
        AND ci.account_id = ?
      ORDER BY ci.id ASC
    `)
    .bind(
      cartId,
      accountId
    )
    .all();

  let subtotal = 0;

  const cartItems = [];

  for (const item of items.results || []) {
    const price =
      Number(
        item.current_product_price || 0
      );

    const quantity =
      Number(
        item.quantity || 0
      );

    const total =
      price * quantity;

    subtotal += total;

    cartItems.push({
      id: item.id,
      product_id: item.product_id,
      product_name:
        item.current_product_name ||
        item.product_name,
      sku: item.sku,
      quantity,
      unit_price: price,
      total_price: total,
      stock_quantity:
        Number(item.stock_quantity || 0),
      product_status:
        item.product_status
    });
  }

  return {
    ...cart,
    items: cartItems,
    item_count: cartItems.reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0),
      0
    ),
    subtotal
  };
}


// ------------------------------------------------------------
// CART ROUTES
// ------------------------------------------------------------

async function handleEcommerceCartRoutes(
  request,
  env,
  url,
  account
) {
  await ensureEcommerceTables(env);

  // ----------------------------------------------------------
  // GET CART
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/ecommerce/cart" &&
    request.method === "GET"
  ) {
    const customerId =
      url.searchParams.get("customer_id")
        ? Number(
            url.searchParams.get(
              "customer_id"
            )
          )
        : null;

    const sessionId =
      cleanText(
        url.searchParams.get(
          "session_id"
        ),
        200
      ) || null;

    const cart =
      await getOrCreateCart(
        env,
        account.account_id,
        customerId,
        sessionId
      );

    return json({
      success: true,
      cart:
        await getCart(
          env,
          account.account_id,
          cart.id
        )
    });
  }


  // ----------------------------------------------------------
  // ADD TO CART
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/ecommerce/cart/items" &&
    request.method === "POST"
  ) {
    const body = await readJson(request);

    const productId =
      Number(body.product_id);

    const quantity =
      Math.max(
        1,
        Number(body.quantity || 1)
      );

    if (
      !Number.isInteger(productId) ||
      productId <= 0
    ) {
      return json(
        {
          success: false,
          error: "Valid product_id is required"
        },
        400
      );
    }

    const product =
      await getProductById(
        env,
        account.account_id,
        productId
      );

    if (
      !product ||
      product.status !== "active"
    ) {
      return json(
        {
          success: false,
          error: "Product is not available"
        },
        404
      );
    }

    if (
      Number(product.track_stock) === 1 &&
      Number(product.stock_quantity) <
        quantity
    ) {
      return json(
        {
          success: false,
          error: "Insufficient stock"
        },
        409
      );
    }

    const customerId =
      body.customer_id
        ? Number(body.customer_id)
        : null;

    const sessionId =
      cleanText(
        body.session_id,
        200
      ) || null;

    const cart =
      await getOrCreateCart(
        env,
        account.account_id,
        customerId,
        sessionId
      );

    const existing =
      await env.DB.prepare(`
        SELECT *
        FROM ecommerce_cart_items
        WHERE cart_id = ?
          AND product_id = ?
          AND account_id = ?
        LIMIT 1
      `)
      .bind(
        cart.id,
        productId,
        account.account_id
      )
      .first();

    const newQuantity =
      existing
        ? Number(existing.quantity) +
          quantity
        : quantity;

    if (
      Number(product.track_stock) === 1 &&
      Number(product.stock_quantity) <
        newQuantity
    ) {
      return json(
        {
          success: false,
          error:
            "Requested quantity exceeds available stock"
        },
        409
      );
    }

    if (existing) {
      await env.DB.prepare(`
        UPDATE ecommerce_cart_items
        SET
          quantity = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND account_id = ?
      `)
      .bind(
        newQuantity,
        existing.id,
        account.account_id
      )
      .run();
    } else {
      await env.DB.prepare(`
        INSERT INTO ecommerce_cart_items
        (
          account_id,
          cart_id,
          product_id,
          quantity
        )
        VALUES (?, ?, ?, ?)
      `)
      .bind(
        account.account_id,
        cart.id,
        productId,
        quantity
      )
      .run();
    }

    await env.DB.prepare(`
      UPDATE ecommerce_carts
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND account_id = ?
    `)
    .bind(
      cart.id,
      account.account_id
    )
    .run();

    return json({
      success: true,
      message: "Product added to cart",
      cart:
        await getCart(
          env,
          account.account_id,
          cart.id
        )
    });
  }


  // ----------------------------------------------------------
  // UPDATE CART ITEM
  // ----------------------------------------------------------

  const cartItemMatch =
    url.pathname.match(
      /^\/api\/ecommerce\/cart\/items\/(\d+)$/
    );

  if (
    cartItemMatch &&
    (
      request.method === "PUT" ||
      request.method === "PATCH"
    )
  ) {
    const itemId =
      Number(cartItemMatch[1]);

    const body = await readJson(request);

    const quantity =
      Math.max(
        0,
        Number(body.quantity)
      );

    const item =
      await env.DB.prepare(`
        SELECT
          ci.*,
          p.stock_quantity,
          p.track_stock,
          p.status
        FROM ecommerce_cart_items ci
        LEFT JOIN ecommerce_products p
          ON p.id = ci.product_id
         AND p.account_id = ci.account_id
        WHERE ci.id = ?
          AND ci.account_id = ?
        LIMIT 1
      `)
      .bind(
        itemId,
        account.account_id
      )
      .first();

    if (!item) {
      return json(
        {
          success: false,
          error: "Cart item not found"
        },
        404
      );
    }

    if (
      quantity > 0 &&
      item.status !== "active"
    ) {
      return json(
        {
          success: false,
          error: "Product is no longer available"
        },
        409
      );
    }

    if (
      quantity > 0 &&
      Number(item.track_stock) === 1 &&
      Number(item.stock_quantity) <
        quantity
    ) {
      return json(
        {
          success: false,
          error: "Insufficient stock"
        },
        409
      );
    }

    if (quantity === 0) {
      await env.DB.prepare(`
        DELETE FROM ecommerce_cart_items
        WHERE id = ?
          AND account_id = ?
      `)
      .bind(
        itemId,
        account.account_id
      )
      .run();
    } else {
      await env.DB.prepare(`
        UPDATE ecommerce_cart_items
        SET
          quantity = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND account_id = ?
      `)
      .bind(
        quantity,
        itemId,
        account.account_id
      )
      .run();
    }

    return json({
      success: true,
      message: "Cart updated successfully"
    });
  }


  // ----------------------------------------------------------
  // REMOVE CART ITEM
  // ----------------------------------------------------------

  if (
    cartItemMatch &&
    request.method === "DELETE"
  ) {
    const itemId =
      Number(cartItemMatch[1]);

    const result =
      await env.DB.prepare(`
        DELETE FROM ecommerce_cart_items
        WHERE id = ?
          AND account_id = ?
      `)
      .bind(
        itemId,
        account.account_id
      )
      .run();

    if (!result.meta.changes) {
      return json(
        {
          success: false,
          error: "Cart item not found"
        },
        404
      );
    }

    return json({
      success: true,
      message: "Item removed from cart"
    });
  }

  return null;
}


// ============================================================
// ORDER CREATION
// ============================================================

async function createEcommerceOrder(
  env,
  accountId,
  body
) {
  const items =
    Array.isArray(body.items)
      ? body.items
      : [];

  if (!items.length) {
    throw new Error(
      "Order must contain at least one item"
    );
  }

  let subtotal = 0;

  const preparedItems = [];

  for (const requestedItem of items) {
    const productId =
      Number(
        requestedItem.product_id
      );

    const quantity =
      Math.max(
        1,
        Number(
          requestedItem.quantity || 1
        )
      );

    if (
      !Number.isInteger(productId) ||
      productId <= 0
    ) {
      throw new Error(
        "Invalid product_id in order"
      );
    }

    const product =
      await getProductById(
        env,
        accountId,
        productId
      );

    if (
      !product ||
      product.status !== "active"
    ) {
      throw new Error(
        "One or more products are unavailable"
      );
    }

    if (
      Number(product.track_stock) === 1 &&
      Number(product.stock_quantity) <
        quantity
    ) {
      throw new Error(
        `Insufficient stock for ${product.name}`
      );
    }

    const unitPrice =
      Number(product.price || 0);

    const totalPrice =
      unitPrice * quantity;

    subtotal += totalPrice;

    preparedItems.push({
      product,
      quantity,
      unitPrice,
      totalPrice
    });
  }

  const shippingAmount =
    Math.max(
      0,
      Number(
        body.shipping_amount || 0
      )
    );

  const discountAmount =
    Math.max(
      0,
      Number(
        body.discount_amount || 0
      )
    );

  const taxAmount =
    Math.max(
      0,
      Number(
        body.tax_amount || 0
      )
    );

  const totalAmount =
    Math.max(
      0,
      subtotal +
      shippingAmount +
      taxAmount -
      discountAmount
    );

  const orderNumber =
    generateOrderNumber();

  const customerId =
    body.customer_id
      ? Number(body.customer_id)
      : null;

  const orderResult =
    await env.DB.prepare(`
      INSERT INTO ecommerce_orders
      (
        account_id,
        customer_id,
        order_number,
        subtotal,
        shipping_amount,
        discount_amount,
        tax_amount,
        total_amount,
        currency,
        payment_status,
        order_status,
        payment_method,
        payment_reference,
        customer_name,
        customer_email,
        customer_phone,
        shipping_address,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      accountId,
      customerId,
      orderNumber,
      subtotal,
      shippingAmount,
      discountAmount,
      taxAmount,
      totalAmount,
      cleanText(
        body.currency || "ZAR",
        10
      ),
      cleanText(
        body.payment_status ||
        "pending",
        50
      ),
      cleanText(
        body.order_status ||
        "pending",
        50
      ),
      cleanText(
        body.payment_method,
        100
      ),
      cleanText(
        body.payment_reference,
        200
      ),
      cleanText(
        body.customer_name,
        200
      ),
      normaliseEmail(
        body.customer_email
      ),
      normalisePhone(
        body.customer_phone
      ),
      cleanText(
        body.shipping_address,
        2000
      ),
      cleanText(
        body.notes,
        3000
      )
    )
    .run();

  const orderId =
    orderResult.meta.last_row_id;

  for (const item of preparedItems) {

    await env.DB.prepare(`
      INSERT INTO ecommerce_order_items
      (
        account_id,
        order_id,
        product_id,
        product_name,
        sku,
        quantity,
        unit_price,
        total_price
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      accountId,
      orderId,
      item.product.id,
      item.product.name,
      item.product.sku,
      item.quantity,
      item.unitPrice,
      item.totalPrice
    )
    .run();


    // Reduce stock when stock tracking is enabled.

    if (
      Number(
        item.product.track_stock
      ) === 1
    ) {
      await env.DB.prepare(`
        UPDATE ecommerce_products
        SET
          stock_quantity =
            CASE
              WHEN stock_quantity >= ?
              THEN stock_quantity - ?
              ELSE 0
            END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND account_id = ?
      `)
      .bind(
        item.quantity,
        item.quantity,
        item.product.id,
        accountId
      )
      .run();
    }
  }

  return {
    id: orderId,
    order_number: orderNumber,
    subtotal,
    shipping_amount: shippingAmount,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    currency: cleanText(
      body.currency || "ZAR",
      10
    ),
    payment_status:
      cleanText(
        body.payment_status ||
        "pending",
        50
      ),
    order_status:
      cleanText(
        body.order_status ||
        "pending",
        50
      )
  };
}


// ============================================================
// ORDER ROUTES
// ============================================================

async function handleEcommerceOrderRoutes(
  request,
  env,
  url,
  account
) {
  await ensureEcommerceTables(env);

  // ----------------------------------------------------------
  // LIST ORDERS
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/ecommerce/orders" &&
    request.method === "GET"
  ) {
    const result =
      await env.DB.prepare(`
        SELECT *
        FROM ecommerce_orders
        WHERE account_id = ?
        ORDER BY created_at DESC
      `)
      .bind(account.account_id)
      .all();

    return json({
      success: true,
      orders: result.results || []
    });
  }


  // ----------------------------------------------------------
  // CREATE ORDER
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/ecommerce/orders" &&
    request.method === "POST"
  ) {
    try {
      const body =
        await readJson(request);

      const order =
        await createEcommerceOrder(
          env,
          account.account_id,
          body
        );

      return json({
        success: true,
        message:
          "Order created successfully",
        order
      });
    } catch (error) {
      console.error(
        "Order creation error:",
        error
      );

      return json(
        {
          success: false,
          error:
            error.message ||
            "Unable to create order"
        },
        400
      );
    }
  }


  // ----------------------------------------------------------
  // GET ONE ORDER
  // ----------------------------------------------------------

  const orderMatch =
    url.pathname.match(
      /^\/api\/ecommerce\/orders\/(\d+)$/
    );

  if (
    orderMatch &&
    request.method === "GET"
  ) {
    const orderId =
      Number(orderMatch[1]);

    const order =
      await env.DB.prepare(`
        SELECT *
        FROM ecommerce_orders
        WHERE id = ?
          AND account_id = ?
        LIMIT 1
      `)
      .bind(
        orderId,
        account.account_id
      )
      .first();

    if (!order) {
      return json(
        {
          success: false,
          error: "Order not found"
        },
        404
      );
    }

    const items =
      await env.DB.prepare(`
        SELECT *
        FROM ecommerce_order_items
        WHERE order_id = ?
          AND account_id = ?
        ORDER BY id ASC
      `)
      .bind(
        orderId,
        account.account_id
      )
      .all();

    return json({
      success: true,
      order: {
        ...order,
        items:
          items.results || []
      }
    });
  }


  // ----------------------------------------------------------
  // UPDATE ORDER
  // ----------------------------------------------------------

  if (
    orderMatch &&
    (
      request.method === "PUT" ||
      request.method === "PATCH"
    )
  ) {
    const orderId =
      Number(orderMatch[1]);

    const existing =
      await env.DB.prepare(`
        SELECT *
        FROM ecommerce_orders
        WHERE id = ?
          AND account_id = ?
        LIMIT 1
      `)
      .bind(
        orderId,
        account.account_id
      )
      .first();

    if (!existing) {
      return json(
        {
          success: false,
          error: "Order not found"
        },
        404
      );
    }

    const body =
      await readJson(request);

    await env.DB.prepare(`
      UPDATE ecommerce_orders
      SET
        payment_status = ?,
        order_status = ?,
        payment_method = ?,
        payment_reference = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND account_id = ?
    `)
    .bind(
      body.payment_status !== undefined
        ? cleanText(
            body.payment_status,
            50
          )
        : existing.payment_status,

      body.order_status !== undefined
        ? cleanText(
            body.order_status,
            50
          )
        : existing.order_status,

      body.payment_method !== undefined
        ? cleanText(
            body.payment_method,
            100
          )
        : existing.payment_method,

      body.payment_reference !== undefined
        ? cleanText(
            body.payment_reference,
            200
          )
        : existing.payment_reference,

      body.notes !== undefined
        ? cleanText(
            body.notes,
            3000
          )
        : existing.notes,

      orderId,
      account.account_id
    )
    .run();

    return json({
      success: true,
      message:
        "Order updated successfully"
    });
  }

  return null;
}

// ============================================================
// PART 6 — AUTHENTICATION + NPO MANAGEMENT ROUTES
// ============================================================


// ============================================================
// CUSTOMER AUTHENTICATION ROUTES
// ============================================================

async function handleCustomerAuthRoutes(
  request,
  env,
  url
) {
  await ensureAuthTables(env);

  // ----------------------------------------------------------
  // CUSTOMER REGISTRATION
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/auth/register" &&
    request.method === "POST"
  ) {
    const body =
      await readJson(request);

    const businessName =
      cleanText(
        body.business_name,
        200
      );

    const fullName =
      cleanText(
        body.full_name,
        200
      );

    const email =
      normaliseEmail(
        body.email
      );

    const phone =
      normalisePhone(
        body.phone
      );

    const password =
      String(
        body.password || ""
      );

    if (
      !businessName ||
      !fullName ||
      !email ||
      !password
    ) {
      return json(
        {
          success: false,
          error:
            "business_name, full_name, email and password are required"
        },
        400
      );
    }

    if (password.length < 8) {
      return json(
        {
          success: false,
          error:
            "Password must contain at least 8 characters"
        },
        400
      );
    }

    const existing =
      await env.DB.prepare(`
        SELECT id
        FROM customer_accounts
        WHERE email = ?
        LIMIT 1
      `)
      .bind(email)
      .first();

    if (existing) {
      return json(
        {
          success: false,
          error:
            "An account with this email already exists"
        },
        409
      );
    }

    const passwordData =
      await createPasswordHash(
        password
      );

    const plan =
      cleanText(
        body.plan || "free",
        100
      );

    const subscriptionStatus =
      cleanText(
        body.subscription_status ||
        "pending",
        50
      );

    const result =
      await env.DB.prepare(`
        INSERT INTO customer_accounts
        (
          tenant_id,
          business_name,
          full_name,
          email,
          phone,
          password_hash,
          password_salt,
          plan,
          subscription_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        TENANT_ID,
        businessName,
        fullName,
        email,
        phone,
        passwordData.hash,
        passwordData.salt,
        plan,
        subscriptionStatus
      )
      .run();

    const account =
      await env.DB.prepare(`
        SELECT *
        FROM customer_accounts
        WHERE id = ?
        LIMIT 1
      `)
      .bind(
        result.meta.last_row_id
      )
      .first();

    // Give every new account access to the
    // ecommerce module by default when requested.

    if (
      body.module_code
    ) {
      await ensureSaaSModuleTables(env);

      const moduleCode =
        cleanText(
          body.module_code,
          100
        ).toLowerCase();

      const module =
        await env.DB.prepare(`
          SELECT module_code
          FROM saas_modules
          WHERE module_code = ?
            AND active = 1
          LIMIT 1
        `)
        .bind(moduleCode)
        .first();

      if (module) {
        await env.DB.prepare(`
          INSERT OR IGNORE INTO customer_modules
          (
            account_id,
            module_code,
            status
          )
          VALUES (?, ?, 'active')
        `)
        .bind(
          account.id,
          module.module_code
        )
        .run();
      }
    }

    const session =
      await createCustomerSession(
        env,
        account.id
      );

    return json(
      {
        success: true,
        message:
          "Customer account created successfully",
        account:
          publicAccount(account)
      },
      201,
      {
        "Set-Cookie":
          createSessionCookie(
            session.token
          )
      }
    );
  }


  // ----------------------------------------------------------
  // CUSTOMER LOGIN
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/auth/login" &&
    request.method === "POST"
  ) {
    const body =
      await readJson(request);

    const email =
      normaliseEmail(
        body.email
      );

    const password =
      String(
        body.password || ""
      );

    if (
      !email ||
      !password
    ) {
      return json(
        {
          success: false,
          error:
            "Email and password are required"
        },
        400
      );
    }

    const account =
      await env.DB.prepare(`
        SELECT *
        FROM customer_accounts
        WHERE email = ?
        LIMIT 1
      `)
      .bind(email)
      .first();

    if (!account) {
      return json(
        {
          success: false,
          error:
            "Invalid email or password"
        },
        401
      );
    }

    const valid =
      await verifyPassword(
        password,
        account.password_hash,
        account.password_salt
      );

    if (!valid) {
      return json(
        {
          success: false,
          error:
            "Invalid email or password"
        },
        401
      );
    }

    if (
      String(
        account.subscription_status ||
        ""
      ).toLowerCase() ===
      "suspended"
    ) {
      return json(
        {
          success: false,
          error:
            "This account has been suspended"
        },
        403
      );
    }

    const session =
      await createCustomerSession(
        env,
        account.id
      );

    return json(
      {
        success: true,
        message:
          "Login successful",
        account:
          publicAccount(account)
      },
      200,
      {
        "Set-Cookie":
          createSessionCookie(
            session.token
          )
      }
    );
  }


  // ----------------------------------------------------------
  // CURRENT CUSTOMER
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/auth/me" &&
    request.method === "GET"
  ) {
    const account =
      await getAuthenticatedAccount(
        request,
        env
      );

    if (!account) {
      return json(
        {
          success: false,
          authenticated: false,
          error:
            "Not authenticated"
        },
        401
      );
    }

    return json({
      success: true,
      authenticated: true,
      account:
        publicAccount(account)
    });
  }


  // ----------------------------------------------------------
  // CUSTOMER LOGOUT
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/auth/logout" &&
    request.method === "POST"
  ) {
    return await logoutCustomer(
      request,
      env
    );
  }

  return null;
}


// ============================================================
// NPO GENERIC CRUD HELPERS
// ============================================================

function npoTableConfig(type) {

  const configs = {

    beneficiaries: {
      table: "npo_beneficiaries",
      required: ["first_name"],
      fields: [
        "first_name",
        "last_name",
        "id_number",
        "phone",
        "email",
        "gender",
        "date_of_birth",
        "address",
        "vulnerability_category",
        "status",
        "notes"
      ]
    },

    projects: {
      table: "npo_projects",
      required: ["name"],
      fields: [
        "name",
        "description",
        "location",
        "start_date",
        "end_date",
        "budget",
        "status"
      ]
    },

    donors: {
      table: "npo_donors",
      required: ["donor_name"],
      fields: [
        "donor_name",
        "organisation",
        "email",
        "phone",
        "donor_type",
        "address",
        "notes"
      ]
    },

    donations: {
      table: "npo_donations",
      required: ["amount"],
      fields: [
        "donor_id",
        "project_id",
        "amount",
        "currency",
        "donation_type",
        "payment_reference",
        "donation_date",
        "status",
        "notes"
      ]
    },

    grants: {
      table: "npo_grants",
      required: ["funder_name"],
      fields: [
        "funder_name",
        "grant_name",
        "application_reference",
        "amount_requested",
        "amount_awarded",
        "application_date",
        "start_date",
        "end_date",
        "status",
        "notes"
      ]
    },

    volunteers: {
      table: "npo_volunteers",
      required: ["first_name"],
      fields: [
        "first_name",
        "last_name",
        "phone",
        "email",
        "role",
        "skills",
        "availability",
        "status"
      ]
    },

    expenses: {
      table: "npo_expenses",
      required: ["description", "amount"],
      fields: [
        "project_id",
        "description",
        "amount",
        "category",
        "supplier",
        "expense_date",
        "payment_reference"
      ]
    },

    documents: {
      table: "npo_documents",
      required: ["document_name"],
      fields: [
        "document_name",
        "document_type",
        "file_key",
        "file_url",
        "description"
      ]
    },

    governance: {
      table: "npo_governance",
      required: ["position", "person_name"],
      fields: [
        "position",
        "person_name",
        "phone",
        "email",
        "appointment_date",
        "term_end_date",
        "status",
        "notes"
      ]
    }

  };

  return configs[type] || null;
}


function cleanNPOValue(
  field,
  value
) {
  if (
    field === "amount" ||
    field === "budget" ||
    field === "amount_requested" ||
    field === "amount_awarded"
  ) {
    const number =
      Number(value || 0);

    return Number.isFinite(number)
      ? number
      : 0;
  }

  if (
    field === "donor_id" ||
    field === "project_id"
  ) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    const number =
      Number(value);

    return Number.isInteger(number)
      ? number
      : null;
  }

  if (
    field === "email"
  ) {
    return normaliseEmail(value);
  }

  if (
    field === "phone"
  ) {
    return normalisePhone(value);
  }

  return cleanText(
    value,
    3000
  );
}


// ============================================================
// NPO CRUD ROUTES
// ============================================================

async function handleNPOCrudRoutes(
  request,
  env,
  url,
  account
) {
  await ensureNPOTables(env);

  const match =
    url.pathname.match(
      /^\/api\/npo\/(beneficiaries|projects|donors|donations|grants|volunteers|expenses|documents|governance)(?:\/(\d+))?$/
    );

  if (!match) {
    return null;
  }

  const type =
    match[1];

  const recordId =
    match[2]
      ? Number(match[2])
      : null;

  const config =
    npoTableConfig(type);

  if (!config) {
    return json(
      {
        success: false,
        error:
          "Unsupported NPO resource"
      },
      400
    );
  }


  // ----------------------------------------------------------
  // LIST
  // ----------------------------------------------------------

  if (
    request.method === "GET" &&
    !recordId
  ) {
    const result =
      await env.DB.prepare(`
        SELECT *
        FROM ${config.table}
        WHERE account_id = ?
        ORDER BY created_at DESC
      `)
      .bind(
        account.account_id
      )
      .all();

    return json({
      success: true,
      [type]:
        result.results || []
    });
  }


  // ----------------------------------------------------------
  // GET ONE
  // ----------------------------------------------------------

  if (
    request.method === "GET" &&
    recordId
  ) {
    const record =
      await env.DB.prepare(`
        SELECT *
        FROM ${config.table}
        WHERE id = ?
          AND account_id = ?
        LIMIT 1
      `)
      .bind(
        recordId,
        account.account_id
      )
      .first();

    if (!record) {
      return json(
        {
          success: false,
          error:
            "Record not found"
        },
        404
      );
    }

    return json({
      success: true,
      [type.slice(0, -1)]:
        record
    });
  }


  // ----------------------------------------------------------
  // CREATE
  // ----------------------------------------------------------

  if (
    request.method === "POST" &&
    !recordId
  ) {
    const body =
      await readJson(request);

    for (
      const field of config.required
    ) {
      if (
        body[field] === undefined ||
        body[field] === null ||
        String(body[field]).trim() === ""
      ) {
        return json(
          {
            success: false,
            error:
              `${field} is required`
          },
          400
        );
      }
    }

    const columns = [
      "account_id",
      ...config.fields
    ];

    const placeholders =
      columns.map(
        () => "?"
      ).join(", ");

    const values = [
      account.account_id,
      ...config.fields.map(
        field =>
          cleanNPOValue(
            field,
            body[field]
          )
      )
    ];

    const result =
      await env.DB.prepare(`
        INSERT INTO ${config.table}
        (${columns.join(", ")})
        VALUES (${placeholders})
      `)
      .bind(...values)
      .run();

    const record =
      await env.DB.prepare(`
        SELECT *
        FROM ${config.table}
        WHERE id = ?
          AND account_id = ?
        LIMIT 1
      `)
      .bind(
        result.meta.last_row_id,
        account.account_id
      )
      .first();

    return json(
      {
        success: true,
        message:
          `${type} record created successfully`,
        record
      },
      201
    );
  }


  // ----------------------------------------------------------
  // UPDATE
  // ----------------------------------------------------------

  if (
    (
      request.method === "PUT" ||
      request.method === "PATCH"
    ) &&
    recordId
  ) {
    const existing =
      await env.DB.prepare(`
        SELECT *
        FROM ${config.table}
        WHERE id = ?
          AND account_id = ?
        LIMIT 1
      `)
      .bind(
        recordId,
        account.account_id
      )
      .first();

    if (!existing) {
      return json(
        {
          success: false,
          error:
            "Record not found"
        },
        404
      );
    }

    const body =
      await readJson(request);

    const setParts = [];
    const values = [];

    for (
      const field of config.fields
    ) {
      if (
        body[field] !== undefined
      ) {
        setParts.push(
          `${field} = ?`
        );

        values.push(
          cleanNPOValue(
            field,
            body[field]
          )
        );
      }
    }

    if (!setParts.length) {
      return json(
        {
          success: false,
          error:
            "No fields supplied for update"
        },
        400
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "first_name"
      ) &&
      !String(body.first_name).trim()
    ) {
      return json(
        {
          success: false,
          error:
            "first_name cannot be empty"
        },
        400
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "name"
      ) &&
      !String(body.name).trim()
    ) {
      return json(
        {
          success: false,
          error:
            "name cannot be empty"
        },
        400
      );
    }

    setParts.push(
      "updated_at = CURRENT_TIMESTAMP"
    );

    values.push(
      recordId,
      account.account_id
    );

    await env.DB.prepare(`
      UPDATE ${config.table}
      SET ${setParts.join(", ")}
      WHERE id = ?
        AND account_id = ?
    `)
    .bind(...values)
    .run();

    return json({
      success: true,
      message:
        `${type} record updated successfully`
    });
  }


  // ----------------------------------------------------------
  // DELETE
  // ----------------------------------------------------------

  if (
    request.method === "DELETE" &&
    recordId
  ) {
    const result =
      await env.DB.prepare(`
        DELETE FROM ${config.table}
        WHERE id = ?
          AND account_id = ?
      `)
      .bind(
        recordId,
        account.account_id
      )
      .run();

    if (!result.meta.changes) {
      return json(
        {
          success: false,
          error:
            "Record not found"
        },
        404
      );
    }

    return json({
      success: true,
      message:
        `${type} record deleted successfully`
    });
  }

  return json(
    {
      success: false,
      error: "Method not supported"
    },
    405
  );
}


// ============================================================
// NPO DASHBOARD SUMMARY
// ============================================================

async function handleNPOSummaryRoute(
  request,
  env,
  url,
  account
) {
  if (
    url.pathname !== "/api/npo/summary" ||
    request.method !== "GET"
  ) {
    return null;
  }

  await ensureNPOTables(env);

  const accountId =
    account.account_id;

  const [
    beneficiaries,
    projects,
    donors,
    volunteers,
    grants,
    donations,
    expenses
  ] = await Promise.all([

    env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM npo_beneficiaries
      WHERE account_id = ?
    `)
    .bind(accountId)
    .first(),

    env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM npo_projects
      WHERE account_id = ?
    `)
    .bind(accountId)
    .first(),

    env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM npo_donors
      WHERE account_id = ?
    `)
    .bind(accountId)
    .first(),

    env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM npo_volunteers
      WHERE account_id = ?
    `)
    .bind(accountId)
    .first(),

    env.DB.prepare(`
      SELECT
        COUNT(*) AS count,
        COALESCE(
          SUM(amount_awarded),
          0
        ) AS awarded
      FROM npo_grants
      WHERE account_id = ?
    `)
    .bind(accountId)
    .first(),

    env.DB.prepare(`
      SELECT
        COUNT(*) AS count,
        COALESCE(
          SUM(amount),
          0
        ) AS total
      FROM npo_donations
      WHERE account_id = ?
        AND status != 'cancelled'
    `)
    .bind(accountId)
    .first(),

    env.DB.prepare(`
      SELECT
        COUNT(*) AS count,
        COALESCE(
          SUM(amount),
          0
        ) AS total
      FROM npo_expenses
      WHERE account_id = ?
    `)
    .bind(accountId)
    .first()

  ]);

  return json({
    success: true,
    summary: {
      beneficiaries:
        Number(
          beneficiaries?.count || 0
        ),

      projects:
        Number(
          projects?.count || 0
        ),

      donors:
        Number(
          donors?.count || 0
        ),

      volunteers:
        Number(
          volunteers?.count || 0
        ),

      grants:
        Number(
          grants?.count || 0
        ),

      grants_awarded:
        Number(
          grants?.awarded || 0
        ),

      donations:
        Number(
          donations?.count || 0
        ),

      donations_total:
        Number(
          donations?.total || 0
        ),

      expenses:
        Number(
          expenses?.count || 0
        ),

      expenses_total:
        Number(
          expenses?.total || 0
        )
    }
  });
  }

// ============================================================
// PART 7 — WHATSAPP + COMMUNITY SERVICE CENTRE + CORE ROUTES
// ============================================================


// ============================================================
// WHATSAPP HELPERS
// ============================================================

async function ensureWhatsAppTables(env) {
  try {
    await ensureWhatsAppSaaSTables(env);
  } catch (error) {
    console.error(
      "WhatsApp SaaS table setup error:",
      error
    );
  }

  try {
    await ensureIndustryWhatsAppRouterTables(env);
  } catch (error) {
    console.error(
      "Industry WhatsApp router table setup error:",
      error
    );
  }
}


// ============================================================
// WHATSAPP WEBHOOK VERIFICATION
// ============================================================

async function handleWhatsAppWebhookVerification(
  request,
  env,
  url
) {
  if (
    url.pathname !== "/api/whatsapp/webhook" ||
    request.method !== "GET"
  ) {
    return null;
  }

  const mode =
    url.searchParams.get("hub.mode");

  const token =
    url.searchParams.get("hub.verify_token");

  const challenge =
    url.searchParams.get("hub.challenge");

  const expectedToken =
    env.WHATSAPP_VERIFY_TOKEN || "";

  if (
    mode === "subscribe" &&
    token &&
    expectedToken &&
    token === expectedToken
  ) {
    return textResponse(
      challenge || "",
      200
    );
  }

  return textResponse(
    "Forbidden",
    403
  );
}


// ============================================================
// WHATSAPP INCOMING WEBHOOK
// ============================================================

async function handleWhatsAppWebhook(
  request,
  env,
  url
) {
  if (
    url.pathname !== "/api/whatsapp/webhook" ||
    request.method !== "POST"
  ) {
    return null;
  }

  await ensureWhatsAppTables(env);

  const body =
    await readJson(request);

  try {
    const entries =
      Array.isArray(body.entry)
        ? body.entry
        : [];

    for (const entry of entries) {
      const changes =
        Array.isArray(entry.changes)
          ? entry.changes
          : [];

      for (const change of changes) {
        const value =
          change?.value || {};

        const metadata =
          value?.metadata || {};

        const phoneNumberId =
          metadata.phone_number_id ||
          env.WHATSAPP_PHONE_NUMBER_ID ||
          "";

        const contacts =
          Array.isArray(value.contacts)
            ? value.contacts
            : [];

        const messages =
          Array.isArray(value.messages)
            ? value.messages
            : [];

        for (const contact of contacts) {
          try {
            const waId =
              cleanText(
                contact.wa_id,
                100
              );

            if (!waId) continue;

            const profileName =
              cleanText(
                contact?.profile?.name,
                200
              );

            await createOrUpdateWhatsAppContact(
              env,
              TENANT_ID,
              waId,
              profileName,
              null
            );
          } catch (error) {
            console.error(
              "WhatsApp contact processing error:",
              error
            );
          }
        }

        for (const message of messages) {
          try {
            const from =
              cleanText(
                message.from,
                100
              );

            const messageId =
              cleanText(
                message.id,
                200
              );

            const messageType =
              cleanText(
                message.type,
                50
              );

            if (!from) continue;

            let messageText = "";

            if (
              messageType === "text"
            ) {
              messageText =
                cleanText(
                  message?.text?.body,
                  4000
                );
            } else if (
              messageType === "button"
            ) {
              messageText =
                cleanText(
                  message?.button?.text,
                  4000
                );
            } else if (
              messageType === "interactive"
            ) {
              messageText =
                cleanText(
                  message?.interactive?.button_reply?.title ||
                  message?.interactive?.list_reply?.title ||
                  "",
                  4000
                );
            } else if (
              messageType === "image"
            ) {
              messageText =
                "[Image received]";
            } else if (
              messageType === "video"
            ) {
              messageText =
                "[Video received]";
            } else if (
              messageType === "audio"
            ) {
              messageText =
                "[Audio received]";
            } else if (
              messageType === "document"
            ) {
              messageText =
                "[Document received]";
            } else {
              messageText =
                `[${messageType || "message"} received]`;
            }

            // Save incoming message in the WhatsApp
            // engine when the engine supports it.

            try {
              await createOrUpdateWhatsAppContact(
                env,
                TENANT_ID,
                from,
                "",
                messageText
              );
            } catch (contactError) {
              console.error(
                "WhatsApp contact update error:",
                contactError
              );
            }

            // ------------------------------------------------
            // INDUSTRY VALUE ROUTER
            // ------------------------------------------------

            try {
              await processIndustryWhatsAppValue(
                env,
                {
                  tenantId:
                    TENANT_ID,

                  wardId:
                    WARD_ID,

                  phoneNumberId,

                  from,

                  messageId,

                  messageType,

                  text:
                    messageText,

                  rawMessage:
                    message,

                  rawWebhook:
                    body
                }
              );
            } catch (routerError) {
              console.error(
                "Industry WhatsApp router error:",
                routerError
              );
            }
          } catch (messageError) {
            console.error(
              "WhatsApp message processing error:",
              messageError
            );
          }
        }
      }
    }

    return json({
      success: true,
      received: true
    });
  } catch (error) {
    console.error(
      "WhatsApp webhook error:",
      error
    );

    // WhatsApp generally expects a successful
    // response so that webhook delivery is not
    // repeatedly retried for application errors.

    return json({
      success: false,
      received: true
    });
  }
}


// ============================================================
// WHATSAPP API ROUTES
// ============================================================

async function handleWhatsAppApiRoutes(
  request,
  env,
  url,
  account
) {
  await ensureWhatsAppTables(env);

  const accountId =
    account?.account_id ||
    account?.id ||
    null;

  // ----------------------------------------------------------
  // WHATSAPP STATUS
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/whatsapp/status" &&
    request.method === "GET"
  ) {
    try {
      const status =
        await getWhatsAppStatus(
          env,
          TENANT_ID
        );

      return json({
        success: true,
        status:
          status || {
            configured:
              Boolean(
                env.WHATSAPP_ACCESS_TOKEN &&
                env.WHATSAPP_PHONE_NUMBER_ID
              ),

            phone_number_id:
              env.WHATSAPP_PHONE_NUMBER_ID ||
              null
          }
      });
    } catch (error) {
      console.error(
        "WhatsApp status error:",
        error
      );

      return json({
        success: true,
        status: {
          configured:
            Boolean(
              env.WHATSAPP_ACCESS_TOKEN &&
              env.WHATSAPP_PHONE_NUMBER_ID
            ),

          phone_number_id:
            env.WHATSAPP_PHONE_NUMBER_ID ||
            null,

          error:
            "Unable to load full WhatsApp status"
        }
      });
    }
  }


  // ----------------------------------------------------------
  // WHATSAPP CONTACTS
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/whatsapp/contacts" &&
    request.method === "GET"
  ) {
    if (!account) {
      return json(
        {
          success: false,
          error:
            "Authentication required"
        },
        401
      );
    }

    try {
      const contacts =
        await getWhatsAppContacts(
          env,
          TENANT_ID,
          accountId
        );

      return json({
        success: true,
        contacts:
          contacts || []
      });
    } catch (error) {
      console.error(
        "WhatsApp contacts error:",
        error
      );

      return json(
        {
          success: false,
          error:
            "Unable to load WhatsApp contacts"
        },
        500
      );
    }
  }


  // ----------------------------------------------------------
  // WHATSAPP MESSAGES
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/whatsapp/messages" &&
    request.method === "GET"
  ) {
    if (!account) {
      return json(
        {
          success: false,
          error:
            "Authentication required"
        },
        401
      );
    }

    const phone =
      cleanText(
        url.searchParams.get("phone"),
        100
      );

    try {
      const messages =
        await getWhatsAppMessages(
          env,
          TENANT_ID,
          phone,
          accountId
        );

      return json({
        success: true,
        messages:
          messages || []
      });
    } catch (error) {
      console.error(
        "WhatsApp messages error:",
        error
      );

      return json(
        {
          success: false,
          error:
            "Unable to load WhatsApp messages"
        },
        500
      );
    }
  }


  // ----------------------------------------------------------
  // SEND WHATSAPP MESSAGE
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/whatsapp/send" &&
    request.method === "POST"
  ) {
    if (!account) {
      return json(
        {
          success: false,
          error:
            "Authentication required"
        },
        401
      );
    }

    const body =
      await readJson(request);

    const to =
      normalisePhone(
        body.to ||
        body.phone
      );

    const message =
      cleanText(
        body.message ||
        body.text,
        4000
      );

    if (!to || !message) {
      return json(
        {
          success: false,
          error:
            "Recipient phone number and message are required"
        },
        400
      );
    }

    try {
      const result =
        await sendSaaSWhatsAppMessage(
          env,
          {
            tenantId:
              TENANT_ID,

            accountId,

            to,

            message,

            type:
              body.type ||
              "text"
          }
        );

      return json({
        success: true,
        result:
          result || null
      });
    } catch (error) {
      console.error(
        "WhatsApp send error:",
        error
      );

      return json(
        {
          success: false,
          error:
            error?.message ||
            "Unable to send WhatsApp message"
        },
        500
      );
    }
  }


  // ----------------------------------------------------------
  // QUEUE WHATSAPP NOTIFICATION
  // ----------------------------------------------------------

  if (
    url.pathname ===
      "/api/whatsapp/notifications/queue" &&
    request.method === "POST"
  ) {
    if (!account) {
      return json(
        {
          success: false,
          error:
            "Authentication required"
        },
        401
      );
    }

    const body =
      await readJson(request);

    const to =
      normalisePhone(
        body.to ||
        body.phone
      );

    const message =
      cleanText(
        body.message ||
        body.text,
        4000
      );

    if (!to || !message) {
      return json(
        {
          success: false,
          error:
            "Recipient phone number and message are required"
        },
        400
      );
    }

    try {
      const result =
        await queueWhatsAppNotification(
          env,
          {
            tenantId:
              TENANT_ID,

            accountId,

            to,

            message,

            type:
              body.type ||
              "text"
          }
        );

      return json(
        {
          success: true,
          queued: true,
          result:
            result || null
        },
        201
      );
    } catch (error) {
      console.error(
        "WhatsApp queue error:",
        error
      );

      return json(
        {
          success: false,
          error:
            error?.message ||
            "Unable to queue WhatsApp notification"
        },
        500
      );
    }
  }


  // ----------------------------------------------------------
  // PROCESS WHATSAPP NOTIFICATION
  // ----------------------------------------------------------

  if (
    url.pathname ===
      "/api/whatsapp/notifications/process" &&
    request.method === "POST"
  ) {
    if (!account) {
      return json(
        {
          success: false,
          error:
            "Authentication required"
        },
        401
      );
    }

    try {
      const result =
        await processWhatsAppNotification(
          env,
          {
            tenantId:
              TENANT_ID,

            accountId
          }
        );

      return json({
        success: true,
        result:
          result || null
      });
    } catch (error) {
      console.error(
        "WhatsApp notification processing error:",
        error
      );

      return json(
        {
          success: false,
          error:
            error?.message ||
            "Unable to process WhatsApp notifications"
        },
        500
      );
    }
  }

  return null;
}


// ============================================================
// COMMUNITY SERVICE CENTRE TABLES
// ============================================================

async function ensureCommunityTables(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      description TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      description TEXT,
      department_id INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS residents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      ward_id INTEGER,
      full_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      ward_id INTEGER,
      resident_id INTEGER,
      report_number TEXT,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      category_id INTEGER,
      department_id INTEGER,
      location TEXT,
      latitude REAL,
      longitude REAL,
      priority TEXT NOT NULL DEFAULT 'Normal',
      status TEXT NOT NULL DEFAULT 'Open',
      source TEXT NOT NULL DEFAULT 'Web',
      contact_phone TEXT,
      contact_email TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS report_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      status TEXT,
      comment TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS whatsapp_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      phone TEXT NOT NULL,
      direction TEXT,
      message TEXT,
      message_type TEXT DEFAULT 'text',
      message_id TEXT,
      status TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_reports_tenant
    ON reports(tenant_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_reports_status
    ON reports(status)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_reports_number
    ON reports(report_number)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_report_updates_report
    ON report_updates(report_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_community_whatsapp_phone
    ON whatsapp_conversations(phone)
  `).run();

  // Seed the standard Sky Blue departments.

  const departments = [
    [
      "Electricity",
      "Electricity and power-related services"
    ],
    [
      "Water",
      "Water, drainage and sewer services"
    ],
    [
      "Roads",
      "Roads, potholes and stormwater"
    ],
    [
      "Waste",
      "Waste, dumping and refuse services"
    ],
    [
      "Community Services",
      "General community service requests"
    ]
  ];

  for (const [
    name,
    description
  ] of departments) {
    await env.DB.prepare(`
      INSERT INTO departments
      (
        tenant_id,
        name,
        description,
        active
      )
      SELECT ?, ?, ?, 1
      WHERE NOT EXISTS (
        SELECT 1
        FROM departments
        WHERE tenant_id = ?
          AND name = ?
      )
    `)
    .bind(
      TENANT_ID,
      name,
      description,
      TENANT_ID,
      name
    )
    .run();
  }
}


// ============================================================
// COMMUNITY REPORT NUMBER
// ============================================================

async function generateCommunityReportNumber(
  env
) {
  const result =
    await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM reports
      WHERE tenant_id = ?
    `)
    .bind(TENANT_ID)
    .first();

  const next =
    Number(
      result?.count || 0
    ) + 1;

  return (
    "SBS-AX-" +
    String(next).padStart(
      6,
      "0"
    )
  );
}


// ============================================================
// COMMUNITY REPORT CREATION
// ============================================================

async function createCommunityReport(
  request,
  env
) {
  const body =
    await readJson(request);

  const title =
    cleanText(
      body.title ||
      body.subject ||
      "Community Service Report",
      300
    );

  const description =
    cleanText(
      body.description ||
      body.message ||
      "",
      5000
    );

  const category =
    cleanText(
      body.category ||
      "",
      200
    );

  const location =
    cleanText(
      body.location ||
      body.address ||
      "",
      500
    );

  const priority =
    cleanText(
      body.priority ||
      "Normal",
      50
    );

  const source =
    cleanText(
      body.source ||
      "Web",
      50
    );

  const contactPhone =
    normalisePhone(
      body.phone ||
      body.contact_phone
    );

  const contactEmail =
    normaliseEmail(
      body.email ||
      body.contact_email
    );

  if (
    !description &&
    !category &&
    !title
  ) {
    return json(
      {
        success: false,
        error:
          "Report information is required"
      },
      400
    );
  }

  let departmentId =
    body.department_id
      ? Number(body.department_id)
      : null;

  if (
    !departmentId &&
    category
  ) {
    const categoryLower =
      category.toLowerCase();

    if (
      categoryLower.includes("electric") ||
      categoryLower.includes("power")
    ) {
      departmentId = 1;
    } else if (
      categoryLower.includes("water") ||
      categoryLower.includes("drain") ||
      categoryLower.includes("sewer")
    ) {
      departmentId = 2;
    } else if (
      categoryLower.includes("road") ||
      categoryLower.includes("pothole") ||
      categoryLower.includes("storm")
    ) {
      departmentId = 3;
    } else if (
      categoryLower.includes("waste") ||
      categoryLower.includes("dump") ||
      categoryLower.includes("rubbish")
    ) {
      departmentId = 4;
    } else {
      departmentId = 5;
    }
  }

  const reportNumber =
    await generateCommunityReportNumber(
      env
    );

  const result =
    await env.DB.prepare(`
      INSERT INTO reports
      (
        tenant_id,
        ward_id,
        report_number,
        title,
        description,
        category,
        department_id,
        location,
        latitude,
        longitude,
        priority,
        status,
        source,
        contact_phone,
        contact_email
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      TENANT_ID,
      WARD_ID,
      reportNumber,
      title,
      description,
      category,
      departmentId,
      location,
      body.latitude ?? null,
      body.longitude ?? null,
      priority,
      "Open",
      source,
      contactPhone,
      contactEmail
    )
    .run();

  const report =
    await env.DB.prepare(`
      SELECT *
      FROM reports
      WHERE id = ?
      LIMIT 1
    `)
    .bind(
      result.meta.last_row_id
    )
    .first();

  return json(
    {
      success: true,
      message:
        "Community service report created successfully",
      report
    },
    201
  );
}


// ============================================================
// COMMUNITY SERVICE CENTRE ROUTES
// ============================================================

async function handleCommunityRoutes(
  request,
  env,
  url,
  account
) {
  await ensureCommunityTables(env);

  // ----------------------------------------------------------
  // PUBLIC CREATE REPORT
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/reports" &&
    request.method === "POST"
  ) {
    return await createCommunityReport(
      request,
      env
    );
  }


  // ----------------------------------------------------------
  // PUBLIC REPORT LOOKUP
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/reports/lookup" &&
    request.method === "GET"
  ) {
    const number =
      cleanText(
        url.searchParams.get("report_number"),
        100
      );

    if (!number) {
      return json(
        {
          success: false,
          error:
            "report_number is required"
        },
        400
      );
    }

    const report =
      await env.DB.prepare(`
        SELECT
          r.*,
          d.name AS department_name
        FROM reports r
        LEFT JOIN departments d
          ON d.id = r.department_id
        WHERE r.tenant_id = ?
          AND r.report_number = ?
        LIMIT 1
      `)
      .bind(
        TENANT_ID,
        number
      )
      .first();

    if (!report) {
      return json(
        {
          success: false,
          error:
            "Report not found"
        },
        404
      );
    }

    const updates =
      await env.DB.prepare(`
        SELECT *
        FROM report_updates
        WHERE report_id = ?
        ORDER BY created_at ASC
      `)
      .bind(
        report.id
      )
      .all();

    return json({
      success: true,
      report,
      updates:
        updates.results || []
    });
  }


  // ----------------------------------------------------------
  // ADMIN REPORT LIST
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/admin/reports" &&
    request.method === "GET"
  ) {
    if (!account) {
      return json(
        {
          success: false,
          error:
            "Authentication required"
        },
        401
      );
    }

    const status =
      cleanText(
        url.searchParams.get("status"),
        50
      );

    let query = `
      SELECT
        r.*,
        d.name AS department_name
      FROM reports r
      LEFT JOIN departments d
        ON d.id = r.department_id
      WHERE r.tenant_id = ?
    `;

    const params = [
      TENANT_ID
    ];

    if (status) {
      query += `
        AND r.status = ?
      `;

      params.push(status);
    }

    query += `
      ORDER BY r.created_at DESC
    `;

    const result =
      await env.DB.prepare(query)
      .bind(...params)
      .all();

    return json({
      success: true,
      reports:
        result.results || []
    });
  }


  // ----------------------------------------------------------
  // ADMIN REPORT UPDATE
  // ----------------------------------------------------------

  const updateMatch =
    url.pathname.match(
      /^\/api\/admin\/reports\/(\d+)$/
    );

  if (
    updateMatch &&
    (
      request.method === "PUT" ||
      request.method === "PATCH"
    )
  ) {
    if (!account) {
      return json(
        {
          success: false,
          error:
            "Authentication required"
        },
        401
      );
    }

    const reportId =
      Number(updateMatch[1]);

    const body =
      await readJson(request);

    const existing =
      await env.DB.prepare(`
        SELECT *
        FROM reports
        WHERE id = ?
          AND tenant_id = ?
        LIMIT 1
      `)
      .bind(
        reportId,
        TENANT_ID
      )
      .first();

    if (!existing) {
      return json(
        {
          success: false,
          error:
            "Report not found"
        },
        404
      );
    }

    const status =
      body.status !== undefined
        ? cleanText(
            body.status,
            50
          )
        : existing.status;

    const priority =
      body.priority !== undefined
        ? cleanText(
            body.priority,
            50
          )
        : existing.priority;

    const comment =
      cleanText(
        body.comment ||
        body.message ||
        "",
        5000
      );

    await env.DB.prepare(`
      UPDATE reports
      SET
        status = ?,
        priority = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND tenant_id = ?
    `)
    .bind(
      status,
      priority,
      reportId,
      TENANT_ID
    )
    .run();

    if (comment) {
      await env.DB.prepare(`
        INSERT INTO report_updates
        (
          report_id,
          status,
          comment,
          updated_by
        )
        VALUES (?, ?, ?, ?)
      `)
      .bind(
        reportId,
        status,
        comment,
        account.email ||
          account.full_name ||
          "Admin"
      )
      .run();
    }

    const updated =
      await env.DB.prepare(`
        SELECT *
        FROM reports
        WHERE id = ?
        LIMIT 1
      `)
      .bind(reportId)
      .first();

    return json({
      success: true,
      message:
        "Report updated successfully",
      report:
        updated
    });
  }


  // ----------------------------------------------------------
  // REPORT UPDATE HISTORY
  // ----------------------------------------------------------

  const historyMatch =
    url.pathname.match(
      /^\/api\/reports\/(\d+)\/updates$/
    );

  if (
    historyMatch &&
    request.method === "GET"
  ) {
    const reportId =
      Number(historyMatch[1]);

    const updates =
      await env.DB.prepare(`
        SELECT *
        FROM report_updates
        WHERE report_id = ?
        ORDER BY created_at ASC
      `)
      .bind(reportId)
      .all();

    return json({
      success: true,
      updates:
        updates.results || []
    });
  }


  // ----------------------------------------------------------
  // DEPARTMENTS
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/departments" &&
    request.method === "GET"
  ) {
    const result =
      await env.DB.prepare(`
        SELECT *
        FROM departments
        WHERE tenant_id = ?
          AND active = 1
        ORDER BY name ASC
      `)
      .bind(TENANT_ID)
      .all();

    return json({
      success: true,
      departments:
        result.results || []
    });
  }


  // ----------------------------------------------------------
  // CATEGORIES
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/categories" &&
    request.method === "GET"
  ) {
    const result =
      await env.DB.prepare(`
        SELECT
          c.*,
          d.name AS department_name
        FROM categories c
        LEFT JOIN departments d
          ON d.id = c.department_id
        WHERE c.tenant_id = ?
          AND c.active = 1
        ORDER BY c.name ASC
      `)
      .bind(TENANT_ID)
      .all();

    return json({
      success: true,
      categories:
        result.results || []
    });
  }


  // ----------------------------------------------------------
  // ADMIN DASHBOARD SUMMARY
  // ----------------------------------------------------------

  if (
    url.pathname === "/api/admin/summary" &&
    request.method === "GET"
  ) {
    if (!account) {
      return json(
        {
          success: false,
          error:
            "Authentication required"
        },
        401
      );
    }

    const [
      total,
      open,
      inProgress,
      resolved,
      emergency,
      urgent
    ] = await Promise.all([

      env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM reports
        WHERE tenant_id = ?
      `)
      .bind(TENANT_ID)
      .first(),

      env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM reports
        WHERE tenant_id = ?
          AND status = 'Open'
      `)
      .bind(TENANT_ID)
      .first(),

      env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM reports
        WHERE tenant_id = ?
          AND status IN (
            'In Progress',
            'Assigned'
          )
      `)
      .bind(TENANT_ID)
      .first(),

      env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM reports
        WHERE tenant_id = ?
          AND status IN (
            'Resolved',
            'Closed'
          )
      `)
      .bind(TENANT_ID)
      .first(),

      env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM reports
        WHERE tenant_id = ?
          AND priority = 'Emergency'
      `)
      .bind(TENANT_ID)
      .first(),

      env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM reports
        WHERE tenant_id = ?
          AND priority = 'Urgent'
      `)
      .bind(TENANT_ID)
      .first()

    ]);

    return json({
      success: true,
      summary: {
        total:
          Number(total?.count || 0),

        open:
          Number(open?.count || 0),

        in_progress:
          Number(
            inProgress?.count || 0
          ),

        resolved:
          Number(
            resolved?.count || 0
          ),

        emergency:
          Number(
            emergency?.count || 0
          ),

        urgent:
          Number(
            urgent?.count || 0
          )
      }
    });
  }

  return null;
}


// ============================================================
// CUSTOMER ACCOUNT PROFILE ROUTES
// ============================================================

async function handleCustomerAccountRoutes(
  request,
  env,
  url,
  account
) {
  if (
    url.pathname !== "/api/account" &&
    url.pathname !== "/api/customer/account"
  ) {
    return null;
  }

  if (!account) {
    return json(
      {
        success: false,
        error:
          "Authentication required"
      },
      401
    );
  }

  if (
    request.method === "GET"
  ) {
    const fresh =
      await env.DB.prepare(`
        SELECT *
        FROM customer_accounts
        WHERE id = ?
        LIMIT 1
      `)
      .bind(
        account.account_id
      )
      .first();

    return json({
      success: true,
      account:
        publicAccount(fresh)
    });
  }

  if (
    request.method === "PUT" ||
    request.method === "PATCH"
  ) {
    const body =
      await readJson(request);

    const businessName =
      body.business_name !== undefined
        ? cleanText(
            body.business_name,
            200
          )
        : null;

    const fullName =
      body.full_name !== undefined
        ? cleanText(
            body.full_name,
            200
          )
        : null;

    const phone =
      body.phone !== undefined
        ? normalisePhone(
            body.phone
          )
        : null;

    const updates = [];
    const values = [];

    if (
      businessName !== null
    ) {
      if (!businessName) {
        return json(
          {
            success: false,
            error:
              "business_name cannot be empty"
          },
          400
        );
      }

      updates.push(
        "business_name = ?"
      );

      values.push(
        businessName
      );
    }

    if (
      fullName !== null
    ) {
      if (!fullName) {
        return json(
          {
            success: false,
            error:
              "full_name cannot be empty"
          },
          400
        );
      }

      updates.push(
        "full_name = ?"
      );

      values.push(
        fullName
      );
    }

    if (
      phone !== null
    ) {
      updates.push(
        "phone = ?"
      );

      values.push(
        phone
      );
    }

    if (!updates.length) {
      return json(
        {
          success: false,
          error:
            "No account fields supplied"
        },
        400
      );
    }

    updates.push(
      "updated_at = CURRENT_TIMESTAMP"
    );

    values.push(
      account.account_id
    );

    await env.DB.prepare(`
      UPDATE customer_accounts
      SET ${updates.join(", ")}
      WHERE id = ?
    `)
    .bind(...values)
    .run();

    const updated =
      await env.DB.prepare(`
        SELECT *
        FROM customer_accounts
        WHERE id = ?
        LIMIT 1
      `)
      .bind(
        account.account_id
      )
      .first();

    return json({
      success: true,
      message:
        "Account updated successfully",
      account:
        publicAccount(updated)
    });
  }

  return json(
    {
      success: false,
      error:
        "Method not supported"
    },
    405
  );
}


// ============================================================
// BASIC SYSTEM / HEALTH ROUTES
// ============================================================

async function handleBasicSystemRoutes(
  request,
  env,
  url
) {
  if (
    url.pathname === "/health" ||
    url.pathname === "/api/health"
  ) {
    return json({
      success: true,
      status: "ok",
      service:
        "Sky Blue Digital Service API",
      version:
        "2.0.0"
    });
  }

  if (
    url.pathname === "/api"
  ) {
    return json({
      success: true,
      service:
        "Sky Blue Digital Service API",
      version:
        "2.0.0",

      modules: [
        "saas",
        "customer-auth",
        "ecommerce",
        "npo-ngo",
        "whatsapp",
        "community-service-centre",
        "media"
      ]
    });
  }

  if (
    url.pathname === "/favicon.ico"
  ) {
    return new Response(
      null,
      {
        status: 204,
        headers:
          getCorsHeaders()
      }
    );
  }

  return null;
}


// ============================================================
// ERROR NORMALISATION
// ============================================================

function normaliseRouteError(
  error,
  fallback =
    "An unexpected server error occurred"
) {
  if (!error) {
    return fallback;
  }

  if (
    typeof error === "string"
  ) {
    return error;
  }

  if (
    error.message
  ) {
    return String(
      error.message
    );
  }

  return fallback;
      }

// ============================================================
// PART 8 — MAIN ROUTER + FETCH HANDLER
// ============================================================


// ============================================================
// PUBLIC E-COMMERCE ROUTES
// ============================================================

async function handlePublicEcommerceRoutes(
  request,
  env,
  url
) {
  if (
    !url.pathname.startsWith(
      "/api/store"
    ) &&
    !url.pathname.startsWith(
      "/api/public/store"
    )
  ) {
    return null;
  }

  await ensureEcommerceTables(env);

  // ----------------------------------------------------------
  // PUBLIC STORE PRODUCTS
  // ----------------------------------------------------------

  if (
    (
      url.pathname ===
        "/api/store/products" ||
      url.pathname ===
        "/api/public/store/products"
    ) &&
    request.method === "GET"
  ) {
    const search =
      cleanText(
        url.searchParams.get("search"),
        200
      );

    const categoryId =
      url.searchParams.get(
        "category_id"
      );

    let query = `
      SELECT
        p.*,
        c.name AS category_name
      FROM ecommerce_products p
      LEFT JOIN ecommerce_categories c
        ON c.id = p.category_id
      WHERE p.tenant_id = ?
        AND p.status = 'active'
    `;

    const params = [
      TENANT_ID
    ];

    if (search) {
      query += `
        AND (
          p.name LIKE ?
          OR p.description LIKE ?
          OR p.sku LIKE ?
        )
      `;

      const pattern =
        `%${search}%`;

      params.push(
        pattern,
        pattern,
        pattern
      );
    }

    if (categoryId) {
      const id =
        Number(categoryId);

      if (
        Number.isInteger(id)
      ) {
        query += `
          AND p.category_id = ?
        `;

        params.push(id);
      }
    }

    query += `
      ORDER BY p.created_at DESC
    `;

    const result =
      await env.DB.prepare(query)
      .bind(...params)
      .all();

    const products =
      await Promise.all(
        (result.results || [])
          .map(
            product =>
              getPublicProduct(
                env,
                product
              )
          )
      );

    return json({
      success: true,
      products
    });
  }


  // ----------------------------------------------------------
  // PUBLIC SINGLE PRODUCT
  // ----------------------------------------------------------

  const productMatch =
    url.pathname.match(
      /^\/api\/(?:public\/)?store\/products\/(\d+)$/
    );

  if (
    productMatch &&
    request.method === "GET"
  ) {
    const productId =
      Number(
        productMatch[1]
      );

    const product =
      await env.DB.prepare(`
        SELECT
          p.*,
          c.name AS category_name
        FROM ecommerce_products p
        LEFT JOIN ecommerce_categories c
          ON c.id = p.category_id
        WHERE p.id = ?
          AND p.tenant_id = ?
          AND p.status = 'active'
        LIMIT 1
      `)
      .bind(
        productId,
        TENANT_ID
      )
      .first();

    if (!product) {
      return json(
        {
          success: false,
          error:
            "Product not found"
        },
        404
      );
    }

    return json({
      success: true,
      product:
        await getPublicProduct(
          env,
          product
        )
    });
  }


  // ----------------------------------------------------------
  // PUBLIC CATEGORIES
  // ----------------------------------------------------------

  if (
    (
      url.pathname ===
        "/api/store/categories" ||
      url.pathname ===
        "/api/public/store/categories"
    ) &&
    request.method === "GET"
  ) {
    const result =
      await env.DB.prepare(`
        SELECT *
        FROM ecommerce_categories
        WHERE tenant_id = ?
          AND active = 1
        ORDER BY name ASC
      `)
      .bind(TENANT_ID)
      .all();

    return json({
      success: true,
      categories:
        result.results || []
    });
  }

  return null;
}

// ============================================================
// OWNER / ADMIN ACCOUNT OVERVIEW
// ============================================================

async function handleOwnerOverviewRoutes(
  request,
  env,
  url,
  account
) {
  if (
    !url.pathname.startsWith(
      "/api/owner"
    )
  ) {
    return null;
  }

  if (!account) {
    return json(
      {
        success: false,
        error:
          "Authentication required"
      },
      401
    );
  }

  await ensureAuthTables(env);
  await ensureSaaSModuleTables(env);
  await ensureEcommerceTables(env);
  await ensureNPOTables(env);

  // ----------------------------------------------------------
  // OWNER OVERVIEW
  // ----------------------------------------------------------

  if (
    url.pathname ===
      "/api/owner/overview" &&
    request.method === "GET"
  ) {
    const [
      accounts,
      activeAccounts,
      modules,
      products,
      orders,
      orderTotals,
      npos
    ] = await Promise.all([

      env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM customer_accounts
        WHERE tenant_id = ?
      `)
      .bind(TENANT_ID)
      .first(),

      env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM customer_accounts
        WHERE tenant_id = ?
          AND subscription_status = 'active'
      `)
      .bind(TENANT_ID)
      .first(),

      env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM customer_modules cm
        INNER JOIN customer_accounts ca
          ON ca.id = cm.account_id
        WHERE ca.tenant_id = ?
          AND cm.status = 'active'
      `)
      .bind(TENANT_ID)
      .first(),

      env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM ecommerce_products
        WHERE tenant_id = ?
      `)
      .bind(TENANT_ID)
      .first(),

      env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM ecommerce_orders
        WHERE tenant_id = ?
      `)
      .bind(TENANT_ID)
      .first(),

      env.DB.prepare(`
        SELECT
          COALESCE(
            SUM(total),
            0
          ) AS total
        FROM ecommerce_orders
        WHERE tenant_id = ?
          AND status NOT IN (
            'cancelled',
            'refunded'
          )
      `)
      .bind(TENANT_ID)
      .first(),

      env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM npo_profiles
        WHERE account_id IN (
          SELECT id
          FROM customer_accounts
          WHERE tenant_id = ?
        )
      `)
      .bind(TENANT_ID)
      .first()

    ]);

    return json({
      success: true,

      overview: {
        total_customers:
          Number(
            accounts?.count || 0
          ),

        active_customers:
          Number(
            activeAccounts?.count || 0
          ),

        active_modules:
          Number(
            modules?.count || 0
          ),

        products:
          Number(
            products?.count || 0
          ),

        orders:
          Number(
            orders?.count || 0
          ),

        ecommerce_revenue:
          Number(
            orderTotals?.total || 0
          ),

        npo_profiles:
          Number(
            npos?.count || 0
          )
      }
    });
  }


  // ----------------------------------------------------------
  // OWNER CUSTOMER LIST
  // ----------------------------------------------------------

  if (
    url.pathname ===
      "/api/owner/customers" &&
    request.method === "GET"
  ) {
    const result =
      await env.DB.prepare(`
        SELECT
          id,
          tenant_id,
          business_name,
          full_name,
          email,
          phone,
          plan,
          subscription_status,
          created_at,
          updated_at
        FROM customer_accounts
        WHERE tenant_id = ?
        ORDER BY created_at DESC
      `)
      .bind(TENANT_ID)
      .all();

    return json({
      success: true,
      customers:
        result.results || []
    });
  }


  // ----------------------------------------------------------
  // OWNER CUSTOMER STATUS
  // ----------------------------------------------------------

  const customerStatusMatch =
    url.pathname.match(
      /^\/api\/owner\/customers\/(\d+)\/status$/
    );

  if (
    customerStatusMatch &&
    (
      request.method === "PUT" ||
      request.method === "PATCH"
    )
  ) {
    const customerId =
      Number(
        customerStatusMatch[1]
      );

    const body =
      await readJson(request);

    const status =
      cleanText(
        body.status,
        50
      );

    if (!status) {
      return json(
        {
          success: false,
          error:
            "status is required"
        },
        400
      );
    }

    const result =
      await env.DB.prepare(`
        UPDATE customer_accounts
        SET
          subscription_status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND tenant_id = ?
      `)
      .bind(
        status,
        customerId,
        TENANT_ID
      )
      .run();

    if (!result.meta.changes) {
      return json(
        {
          success: false,
          error:
            "Customer not found"
        },
        404
      );
    }

    return json({
      success: true,
      message:
        "Customer subscription status updated"
    });
  }

  return null;
}


// ============================================================
// SAAS CORE ROUTE ADAPTER
// ============================================================

async function handleCoreRoutes(
  request,
  env,
  url,
  account
) {
  if (
    !url.pathname.startsWith(
      "/api/core"
    ) &&
    !url.pathname.startsWith(
      "/api/saas/core"
    ) &&
    !url.pathname.startsWith(
      "/api/saas"
    )
  ) {
    return null;
  }

  try {
    const result =
      await handleSaaSCoreRoute(
        request,
        env,
        url,
        {
          tenantId:
            TENANT_ID,

          wardId:
            WARD_ID,

          account
        }
      );

    if (
      result !== null &&
      result !== undefined
    ) {
      return result;
    }

    return null;
  } catch (error) {
    console.error(
      "SaaS Core route error:",
      error
    );

    try {
      return await coreRouteError(
        error
      );
    } catch {
      return json(
        {
          success: false,
          error:
            normaliseRouteError(
              error,
              "SaaS Core route failed"
            )
        },
        500
      );
    }
  }
}


// ============================================================
// ROOT APPLICATION INFORMATION
// ============================================================

async function handleRootRoute(
  request,
  env,
  url
) {
  if (
    url.pathname !== "/" &&
    url.pathname !== "/api/info"
  ) {
    return null;
  }

  return json({
    success: true,

    service:
      "Sky Blue Digital Service",

    message:
      "Smart technology. Reliable business solutions.",

    version:
      "2.0.0",

    status:
      "running",

    modules: [
      {
        code:
          "community-service-centre",
        name:
          "Community Service Centre"
      },

      {
        code:
          "ecommerce",
        name:
          "E-Commerce"
      },

      {
        code:
          "npo-ngo",
        name:
          "NPO / NGO Management"
      },

      {
        code:
          "whatsapp",
        name:
          "WhatsApp Business"
      },

      {
        code:
          "saas",
        name:
          "Sky Blue SaaS"
      }
    ],

    endpoints: {
      health:
        "/health",

      modules:
        "/api/modules",

      store:
        "/api/store/products",

      authentication:
        "/api/auth/login",

      whatsapp:
        "/api/whatsapp/status",

      reports:
        "/api/reports"
    }
  });
}


// ============================================================
// 404 RESPONSE
// ============================================================

function notFoundResponse(
  request,
  url
) {
  return json(
    {
      success: false,
      error:
        "API endpoint not found",
      path:
        url.pathname,
      method:
        request.method
    },
    404
  );
}


// ============================================================
// GLOBAL ERROR RESPONSE
// ============================================================

function internalErrorResponse(
  error
) {
  console.error(
    "Sky Blue Worker Error:",
    error
  );

  return json(
    {
      success: false,
      error:
        normaliseRouteError(
          error,
          "Internal server error"
        )
    },
    500
  );
}


// ============================================================
// MAIN REQUEST ROUTER
// ============================================================

async function handleRequest(
  request,
  env,
  ctx
) {
  const url =
    new URL(
      request.url
    );

  // ----------------------------------------------------------
  // CORS PREFLIGHT
  // ----------------------------------------------------------

  if (
    request.method === "OPTIONS"
  ) {
    return new Response(
      null,
      {
        status: 204,
        headers:
          getCorsHeaders()
      }
    );
  }


  // ----------------------------------------------------------
  // STATIC MEDIA FROM R2
  // ----------------------------------------------------------

  const mediaResponse =
    await handleMediaServing(
      request,
      env,
      url
    );

  if (
    mediaResponse
  ) {
    return mediaResponse;
  }


  // ----------------------------------------------------------
  // BASIC SYSTEM ROUTES
  // ----------------------------------------------------------

  const basicResponse =
    await handleBasicSystemRoutes(
      request,
      env,
      url
    );

  if (
    basicResponse
  ) {
    return basicResponse;
  }


  // ----------------------------------------------------------
  // ROOT / INFORMATION
  // ----------------------------------------------------------

  const rootResponse =
    await handleRootRoute(
      request,
      env,
      url
    );

  if (
    rootResponse
  ) {
    return rootResponse;
  }


  // ----------------------------------------------------------
  // WHATSAPP WEBHOOK VERIFICATION
  // ----------------------------------------------------------

  const webhookVerification =
    await handleWhatsAppWebhookVerification(
      request,
      env,
      url
    );

  if (
    webhookVerification
  ) {
    return webhookVerification;
  }


  // ----------------------------------------------------------
  // WHATSAPP INCOMING WEBHOOK
  // ----------------------------------------------------------

  const webhookResponse =
    await handleWhatsAppWebhook(
      request,
      env,
      url
    );

  if (
    webhookResponse
  ) {
    return webhookResponse;
  }


  // ----------------------------------------------------------
  // AUTHENTICATION
  // ----------------------------------------------------------

  const authResponse =
    await handleCustomerAuthRoutes(
      request,
      env,
      url
    );

  if (
    authResponse
  ) {
    return authResponse;
  }


  // ----------------------------------------------------------
  // AUTHENTICATED CUSTOMER
  // ----------------------------------------------------------

  const account =
    await getAuthenticatedAccount(
      request,
      env
    );


  // ----------------------------------------------------------
  // CUSTOMER ACCOUNT
  // ----------------------------------------------------------

  const accountResponse =
    await handleCustomerAccountRoutes(
      request,
      env,
      url,
      account
    );

  if (
    accountResponse
  ) {
    return accountResponse;
  }


  // ----------------------------------------------------------
  // PUBLIC E-COMMERCE
  // ----------------------------------------------------------

  const publicStoreResponse =
    await handlePublicEcommerceRoutes(
      request,
      env,
      url
    );

  if (
    publicStoreResponse
  ) {
    return publicStoreResponse;
  }


  // ----------------------------------------------------------
  // CUSTOMER MODULES
  // ----------------------------------------------------------

  const moduleResponse =
    await handleCustomerModuleRoutes(
      request,
      env,
      url,
      account
    );

  if (
    moduleResponse
  ) {
    return moduleResponse;
  }


  // ----------------------------------------------------------
  // E-COMMERCE MEDIA
  // ----------------------------------------------------------

  const ecommerceMediaResponse =
    await handleEcommerceMediaRoutes(
      request,
      env,
      url,
      account
    );

  if (
    ecommerceMediaResponse
  ) {
    return ecommerceMediaResponse;
  }


  // ----------------------------------------------------------
  // E-COMMERCE CUSTOMERS
  // ----------------------------------------------------------

  const ecommerceCustomerResponse =
    await handleEcommerceCustomerRoutes(
      request,
      env,
      url,
      account
    );

  if (
    ecommerceCustomerResponse
  ) {
    return ecommerceCustomerResponse;
  }


  // ----------------------------------------------------------
  // E-COMMERCE CART
  // ----------------------------------------------------------

  const ecommerceCartResponse =
    await handleEcommerceCartRoutes(
      request,
      env,
      url,
      account
    );

  if (
    ecommerceCartResponse
  ) {
    return ecommerceCartResponse;
  }


  // ----------------------------------------------------------
  // E-COMMERCE ORDERS
  // ----------------------------------------------------------

  const ecommerceOrderResponse =
    await handleEcommerceOrderRoutes(
      request,
      env,
      url,
      account
    );

  if (
    ecommerceOrderResponse
  ) {
    return ecommerceOrderResponse;
  }


  // ----------------------------------------------------------
  // E-COMMERCE PRODUCTS
  // ----------------------------------------------------------

  const ecommerceProductResponse =
    await handleEcommerceProductRoutes(
      request,
      env,
      url,
      account
    );

  if (
    ecommerceProductResponse
  ) {
    return ecommerceProductResponse;
  }


  // ----------------------------------------------------------
  // E-COMMERCE CATEGORIES
  // ----------------------------------------------------------

  const ecommerceCategoryResponse =
    await handleEcommerceCategoryRoutes(
      request,
      env,
      url,
      account
    );

  if (
    ecommerceCategoryResponse
  ) {
    return ecommerceCategoryResponse;
  }


  // ----------------------------------------------------------
  // NPO SUMMARY
  // ----------------------------------------------------------

  if (
    url.pathname ===
      "/api/npo/summary"
  ) {
    if (!account) {
      return json(
        {
          success: false,
          error:
            "Authentication required"
        },
        401
      );
    }

    const response =
      await handleNPOSummaryRoute(
        request,
        env,
        url,
        account
      );

    if (
      response
    ) {
      return response;
    }
  }


  // ----------------------------------------------------------
  // NPO CRUD
  // ----------------------------------------------------------

  if (
    url.pathname.startsWith(
      "/api/npo/"
    )
  ) {
    if (!account) {
      return json(
        {
          success: false,
          error:
            "Authentication required"
        },
        401
      );
    }

    const response =
      await handleNPOCrudRoutes(
        request,
        env,
        url,
        account
      );

    if (
      response
    ) {
      return response;
    }
  }


  // ----------------------------------------------------------
  // COMMUNITY SERVICE CENTRE
  // ----------------------------------------------------------

  const communityResponse =
    await handleCommunityRoutes(
      request,
      env,
      url,
      account
    );

  if (
    communityResponse
  ) {
    return communityResponse;
  }


  // ----------------------------------------------------------
  // WHATSAPP API
  // ----------------------------------------------------------

  const whatsappResponse =
    await handleWhatsAppApiRoutes(
      request,
      env,
      url,
      account
    );

  if (
    whatsappResponse
  ) {
    return whatsappResponse;
  }


  // ----------------------------------------------------------
  // OWNER / ADMIN
  // ----------------------------------------------------------

  const ownerResponse =
    await handleOwnerOverviewRoutes(
      request,
      env,
      url,
      account
    );

  if (
    ownerResponse
  ) {
    return ownerResponse;
  }


  // ----------------------------------------------------------
  // SAAS CORE
  // ----------------------------------------------------------

  const coreResponse =
    await handleCoreRoutes(
      request,
      env,
      url,
      account
    );

  if (
    coreResponse
  ) {
    return coreResponse;
  }


  // ----------------------------------------------------------
  // NOT FOUND
  // ----------------------------------------------------------

  return notFoundResponse(
    request,
    url
  );
}


// ============================================================
// CLOUDFLARE WORKER ENTRY POINT
// ============================================================

export default {
  async fetch(
    request,
    env,
    ctx
  ) {
    try {
      return await handleRequest(
        request,
        env,
        ctx
      );
    } catch (error) {
      return internalErrorResponse(
        error
      );
    }
  }
};


