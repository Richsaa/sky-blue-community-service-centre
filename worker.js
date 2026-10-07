/*
 * ============================================================
 * SKY BLUE DIGITAL SERVICE
 * SINGLE WORKER
 * VERSION 4.0.0
 *
 * SaaS + E-Commerce + Websites + WhatsApp + PayFast
 * Pharmacy + Councillor + VoIP + Hosting + Cyber
 * Business Directory + Industry Business Engine
 * ============================================================
 *
 * REQUIRED CLOUDFLARE BINDING:
 *   D1  -> DB
 *
 * OPTIONAL:
 *   R2  -> MEDIA
 *
 * SECRETS / VARIABLES:
 *
 *   ADMIN_KEY
 *
 *   PAYFAST_MERCHANT_ID
 *   PAYFAST_MERCHANT_KEY
 *   PAYFAST_PASSPHRASE
 *   PAYFAST_RETURN_URL
 *   PAYFAST_CANCEL_URL
 *   PAYFAST_NOTIFY_URL
 *   PAYFAST_SANDBOX
 *
 *   WHATSAPP_VERIFY_TOKEN
 *   WHATSAPP_ACCESS_TOKEN
 *   WHATSAPP_PHONE_NUMBER_ID
 *
 * ============================================================
 */

const APP = "Sky Blue Digital Service";
const VERSION = "4.0.0";

const SESSION_DAYS = 30;
const MAX_MEDIA_SIZE = 100 * 1024 * 1024;

const PAYFAST_LIVE =
  "https://www.payfast.co.za/eng/process";

const PAYFAST_SANDBOX =
  "https://sandbox.payfast.co.za/eng/process";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Admin-Key",
  "Access-Control-Allow-Methods":
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
};

const MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf"
];

/* ============================================================
   BASIC HELPERS
   ============================================================ */

function json(data, status = 200, extra = {}) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        "Content-Type":
          "application/json;charset=utf-8",
        ...CORS,
        ...extra
      }
    }
  );
}

function text(data, status = 200, extra = {}) {
  return new Response(data, {
    status,
    headers: {
      "Content-Type":
        "text/plain;charset=utf-8",
      ...CORS,
      ...extra
    }
  });
}

function html(data, status = 200) {
  return new Response(data, {
    status,
    headers: {
      "Content-Type":
        "text/html;charset=utf-8",
      ...CORS
    }
  });
}

async function body(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function clean(value, max = 5000) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value)
    .trim()
    .slice(0, max);
}

function id(prefix = "id") {
  return (
    prefix +
    "_" +
    crypto.randomUUID().replaceAll("-", "")
  );
}

function now() {
  return new Date().toISOString();
}

function addDays(days) {
  return new Date(
    Date.now() +
    days * 86400000
  ).toISOString();
}

function esc(value) {
  return clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseObject(value) {
  if (!value) return {};

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

/* ============================================================
   COOKIES
   ============================================================ */

function cookies(request) {
  const output = {};

  const header =
    request.headers.get("Cookie") || "";

  for (
    const item of header.split(";")
  ) {
    const index =
      item.indexOf("=");

    if (index <= 0) continue;

    const key =
      item.slice(0, index).trim();

    const value =
      item.slice(index + 1).trim();

    output[key] =
      decodeURIComponent(value);
  }

  return output;
}

function sessionCookie(token) {
  return [
    `sbs_session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${SESSION_DAYS * 86400}`
  ].join("; ");
}

function clearCookie() {
  return [
    "sbs_session=",
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0"
  ].join("; ");
}

/* ============================================================
   PASSWORD SECURITY
   ============================================================ */

function bytesToHex(bytes) {
  return [
    ...new Uint8Array(bytes)
  ]
    .map(
      x =>
        x.toString(16)
          .padStart(2, "0")
    )
    .join("");
}

function hexToBytes(hex) {
  const bytes =
    new Uint8Array(
      hex.length / 2
    );

  for (
    let i = 0;
    i < bytes.length;
    i++
  ) {
    bytes[i] =
      parseInt(
        hex.substring(
          i * 2,
          i * 2 + 2
        ),
        16
      );
  }

  return bytes;
}

async function hashPassword(
  password,
  saltHex = null
) {
  const salt = saltHex
    ? hexToBytes(saltHex)
    : crypto.getRandomValues(
        new Uint8Array(16)
      );

  const key =
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(
        password
      ),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

  const bits =
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: 120000,
        hash: "SHA-256"
      },
      key,
      256
    );

  return {
    salt: bytesToHex(salt),
    hash: bytesToHex(bits)
  };
}

/* ============================================================
   CUSTOMER AUTH
   ============================================================ */

async function getCustomer(
  request,
  env
) {
  const token =
    cookies(request).sbs_session;

  if (!token) {
    return null;
  }

  return env.DB.prepare(`
    SELECT
      a.*,
      s.token,
      s.expires_at
    FROM customer_sessions s
    JOIN customer_accounts a
      ON a.id = s.account_id
    WHERE s.token = ?
      AND s.expires_at > ?
      AND a.status = 'active'
    LIMIT 1
  `)
    .bind(token, now())
    .first();
}

async function requireCustomer(
  request,
  env
) {
  const customer =
    await getCustomer(
      request,
      env
    );

  if (!customer) {
    return {
      error: json(
        {
          ok: false,
          error:
            "Authentication required"
        },
        401
      )
    };
  }

  return { customer };
}

function adminAuthorized(
  request,
  env
) {
  const bearer =
    request.headers
      .get("Authorization")
      ?.replace(
        /^Bearer\s+/i,
        ""
      ) || "";

  const key =
    bearer ||
    request.headers.get(
      "X-Admin-Key"
    ) ||
    "";

  return Boolean(
    env.ADMIN_KEY &&
    key &&
    key === env.ADMIN_KEY
  );
}

function requireAdmin(
  request,
  env
) {
  if (
    !adminAuthorized(
      request,
      env
    )
  ) {
    return json(
      {
        ok: false,
        error:
          "Owner authorization required"
      },
      401
    );
  }

  return null;
}

/* ============================================================
   MODULE CATALOG
   ============================================================ */

const MODULES = [
  [
    "ecommerce",
    "E-Commerce",
    "Products, pictures, videos, orders and checkout"
  ],
  [
    "whatsapp",
    "WhatsApp Business",
    "WhatsApp communication and media"
  ],
  [
    "website",
    "Website Builder",
    "Create and publish a business website"
  ],
  [
    "civic",
    "Community Service",
    "Community reports and service requests"
  ],
  [
    "npo",
    "NPO / NGO",
    "Organisation and programme management"
  ],
  [
    "hosting",
    "Hosting & Domains",
    "Hosting, domains and business services"
  ],
  [
    "cyber",
    "Cyber Protection",
    "Business cyber protection services"
  ],
  [
    "pharmacy",
    "Pharmacy",
    "Branch stock, cash reporting and optional online catalogue"
  ],
  [
    "councillor",
    "Councillor / Community Reporting",
    "Ward reports, assignments, updates, media and resident communication"
  ],
  [
    "voice",
    "Business Landline / VoIP",
    "Numbers, extensions, forwarding, voicemail and subscriptions"
  ],
  [
    "directory",
    "Business Directory",
    "Public business listing and local discovery"
  ],
  [
    "retail",
    "Retail / General Shop",
    "Customers, products, sales and stock"
  ],
  [
    "hardware",
    "Hardware / Building Supplies",
    "Products, quotations, orders and stock"
  ],
  [
    "mechanic",
    "Mechanic / Auto Services",
    "Vehicles, customers, jobs and service records"
  ],
  [
    "security",
    "Security Services",
    "Clients, sites, guards, incidents and service records"
  ],
  [
    "accommodation",
    "Accommodation / Guesthouse",
    "Rooms, guests, bookings and enquiries"
  ],
  [
    "professional-services",
    "Professional Services",
    "Clients, appointments, cases and service records"
  ],
  [
    "restaurant",
    "Restaurant / Takeaway",
    "Menus, orders, customers and delivery records"
  ],
  [
    "salon",
    "Salon / Barber",
    "Customers, services, appointments and staff records"
  ],
  [
    "laundry",
    "Laundry",
    "Orders, collection, delivery and customer records"
  ],
  [
    "food-wholesale",
    "Food Wholesale",
    "Wholesale customers, products, orders and stock"
  ],
  [
    "transport",
    "Transport",
    "Vehicles, drivers, trips and customer records"
  ],
  [
    "it-business",
    "IT Business",
    "Customers, tickets, assets and service records"
  ],
  [
    "driving-school",
    "Driving School",
    "Learners, instructors, lessons and payments"
  ],
  [
    "school",
    "School Management",
    "Learners, teachers, classes and communication"
  ],
  [
    "preschool",
    "Preschool / Daycare",
    "Children, parents, attendance and fees"
  ],
  [
    "church-management",
    "Church Management",
    "Members, events, communication and records"
  ]
];

/* ============================================================
   DATABASE SCHEMA
   ============================================================ */

let schemaPromise = null;

async function ensureSchema(env) {
  if (schemaPromise) {
    return schemaPromise;
  }

  schemaPromise =
    (async () => {

      const statements = [

`CREATE TABLE IF NOT EXISTS customer_accounts (
id TEXT PRIMARY KEY,
business_name TEXT NOT NULL,
owner_name TEXT,
email TEXT NOT NULL UNIQUE,
phone TEXT,
password_hash TEXT NOT NULL,
password_salt TEXT NOT NULL,
status TEXT DEFAULT 'active',
created_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS customer_sessions (
token TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
expires_at TEXT NOT NULL,
created_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS saas_modules (
id TEXT PRIMARY KEY,
module_key TEXT UNIQUE NOT NULL,
module_name TEXT NOT NULL,
description TEXT,
active INTEGER DEFAULT 1,
created_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS subscriptions (
id TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
module_id TEXT NOT NULL,
plan_name TEXT NOT NULL,
amount REAL DEFAULT 0,
currency TEXT DEFAULT 'ZAR',
status TEXT DEFAULT 'pending',
started_at TEXT,
expires_at TEXT,
payfast_token TEXT,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS saas_payments (
id TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
subscription_id TEXT,
pf_payment_id TEXT,
amount REAL DEFAULT 0,
currency TEXT DEFAULT 'ZAR',
status TEXT DEFAULT 'pending',
payment_type TEXT,
raw_status TEXT,
paid_at TEXT,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS payment_reminders (
id TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
subscription_id TEXT,
channel TEXT DEFAULT 'dashboard',
message TEXT,
status TEXT DEFAULT 'pending',
sent_at TEXT,
created_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS products (
id TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
name TEXT NOT NULL,
description TEXT,
price REAL DEFAULT 0,
stock REAL DEFAULT 0,
category TEXT,
image_url TEXT,
video_url TEXT,
active INTEGER DEFAULT 1,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS ecommerce_orders (
id TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
customer_name TEXT,
customer_phone TEXT,
customer_email TEXT,
items_json TEXT NOT NULL,
total REAL DEFAULT 0,
status TEXT DEFAULT 'pending',
payment_status TEXT DEFAULT 'unpaid',
payment_id TEXT,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS websites (
id TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
site_name TEXT NOT NULL,
slug TEXT UNIQUE NOT NULL,
title TEXT,
description TEXT,
html TEXT NOT NULL,
status TEXT DEFAULT 'draft',
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS media_files (
id TEXT PRIMARY KEY,
account_id TEXT,
source TEXT,
original_name TEXT,
r2_key TEXT NOT NULL,
content_type TEXT,
size INTEGER DEFAULT 0,
public_path TEXT,
created_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS whatsapp_messages (
id TEXT PRIMARY KEY,
account_id TEXT,
wa_message_id TEXT UNIQUE,
from_phone TEXT,
message_type TEXT,
text_body TEXT,
media_id TEXT,
media_key TEXT,
media_url TEXT,
created_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS reports (
id TEXT PRIMARY KEY,
account_id TEXT,
report_number TEXT UNIQUE,
category TEXT,
description TEXT,
location TEXT,
priority TEXT DEFAULT 'Normal',
source TEXT DEFAULT 'Web',
status TEXT DEFAULT 'Open',
assigned_to TEXT,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS report_updates (
id TEXT PRIMARY KEY,
report_id TEXT NOT NULL,
status TEXT,
note TEXT,
created_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS business_profiles (
id TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
module_key TEXT NOT NULL,
business_name TEXT,
description TEXT,
address TEXT,
phone TEXT,
whatsapp TEXT,
email TEXT,
website TEXT,
opening_hours TEXT,
metadata_json TEXT,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL,
UNIQUE(account_id,module_key)
)`,

`CREATE TABLE IF NOT EXISTS business_services (
id TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
module_key TEXT NOT NULL,
name TEXT NOT NULL,
description TEXT,
price REAL DEFAULT 0,
duration_minutes INTEGER DEFAULT 0,
active INTEGER DEFAULT 1,
metadata_json TEXT,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS business_records (
id TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
module_key TEXT NOT NULL,
record_type TEXT NOT NULL,
title TEXT,
status TEXT DEFAULT 'open',
data_json TEXT,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS business_finance_reports (
id TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
module_key TEXT NOT NULL,
report_date TEXT NOT NULL,
cash_sales REAL DEFAULT 0,
card_sales REAL DEFAULT 0,
other_income REAL DEFAULT 0,
expenses REAL DEFAULT 0,
notes TEXT,
created_at TEXT NOT NULL,
UNIQUE(account_id,module_key,report_date)
)`,

`CREATE TABLE IF NOT EXISTS voice_accounts (
id TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
plan_name TEXT NOT NULL,
monthly_price REAL DEFAULT 0,
phone_number TEXT,
provider TEXT,
status TEXT DEFAULT 'pending',
extensions_json TEXT,
forwarding_number TEXT,
voicemail INTEGER DEFAULT 1,
business_hours_json TEXT,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS hosting_services (
id TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
service_type TEXT NOT NULL,
domain_name TEXT,
plan_name TEXT,
monthly_price REAL DEFAULT 0,
status TEXT DEFAULT 'pending',
metadata_json TEXT,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS cyber_services (
id TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
service_type TEXT NOT NULL,
device_count INTEGER DEFAULT 0,
monthly_price REAL DEFAULT 0,
status TEXT DEFAULT 'pending',
metadata_json TEXT,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS directory_listings (
id TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
module_key TEXT NOT NULL,
business_name TEXT NOT NULL,
category TEXT,
description TEXT,
address TEXT,
phone TEXT,
whatsapp TEXT,
website TEXT,
image_url TEXT,
status TEXT DEFAULT 'pending',
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS pharmacy_profiles (
id TEXT PRIMARY KEY,
account_id TEXT UNIQUE NOT NULL,
responsible_pharmacist TEXT,
pharmacy_council_number TEXT,
licence_number TEXT,
address TEXT,
phone TEXT,
email TEXT,
website TEXT,
online_store_enabled INTEGER DEFAULT 0,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS pharmacy_branches (
id TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
branch_name TEXT NOT NULL,
address TEXT,
phone TEXT,
whatsapp TEXT,
opening_hours TEXT,
status TEXT DEFAULT 'active',
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS pharmacy_stock_orders (
id TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
branch_id TEXT NOT NULL,
status TEXT DEFAULT 'requested',
notes TEXT,
requested_by TEXT,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS pharmacy_stock_items (
id TEXT PRIMARY KEY,
stock_order_id TEXT NOT NULL,
product_name TEXT NOT NULL,
quantity REAL DEFAULT 0,
notes TEXT
)`,

`CREATE TABLE IF NOT EXISTS pharmacy_cash_reports (
id TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
branch_id TEXT NOT NULL,
report_date TEXT NOT NULL,
cash_sales REAL DEFAULT 0,
card_sales REAL DEFAULT 0,
eft_sales REAL DEFAULT 0,
expenses REAL DEFAULT 0,
cash_on_hand REAL DEFAULT 0,
notes TEXT,
created_at TEXT NOT NULL,
UNIQUE(branch_id,report_date)
)`,

`CREATE TABLE IF NOT EXISTS pharmacy_catalogue (
id TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
branch_id TEXT,
product_name TEXT NOT NULL,
description TEXT,
sku TEXT,
price REAL DEFAULT 0,
stock_quantity REAL DEFAULT 0,
image_url TEXT,
active INTEGER DEFAULT 1,
prescription_required INTEGER DEFAULT 0,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS councillor_profiles (
id TEXT PRIMARY KEY,
account_id TEXT UNIQUE NOT NULL,
councillor_name TEXT,
ward_name TEXT,
ward_number TEXT,
municipality TEXT,
office_phone TEXT,
office_email TEXT,
whatsapp_number TEXT,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS councillor_contacts (
id TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
name TEXT NOT NULL,
phone TEXT NOT NULL,
contact_type TEXT DEFAULT 'resident',
active INTEGER DEFAULT 1,
created_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS councillor_broadcasts (
id TEXT PRIMARY KEY,
account_id TEXT NOT NULL,
message TEXT NOT NULL,
media_url TEXT,
media_type TEXT,
recipient_count INTEGER DEFAULT 0,
sent_count INTEGER DEFAULT 0,
status TEXT DEFAULT 'pending',
created_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS councillor_report_media (
id TEXT PRIMARY KEY,
report_id TEXT NOT NULL,
media_url TEXT NOT NULL,
media_type TEXT DEFAULT 'image',
created_at TEXT NOT NULL
)`,

`CREATE INDEX IF NOT EXISTS idx_sub_account
ON subscriptions(account_id)`,

`CREATE INDEX IF NOT EXISTS idx_products_account
ON products(account_id)`,

`CREATE INDEX IF NOT EXISTS idx_orders_account
ON ecommerce_orders(account_id)`,

`CREATE INDEX IF NOT EXISTS idx_reports_account
ON reports(account_id)`
      ];

      for (
        const sql of statements
      ) {
        await env.DB
          .prepare(sql)
          .run();
      }

      for (
        const module of MODULES
      ) {
        await env.DB
          .prepare(`
            INSERT OR IGNORE INTO
            saas_modules
            (
              id,
              module_key,
              module_name,
              description,
              active,
              created_at
            )
            VALUES (?, ?, ?, ?, 1, ?)
          `)
          .bind(
            id("mod"),
            module[0],
            module[1],
            module[2],
            now()
          )
          .run();
      }

    })();

  return schemaPromise;
}

/* ============================================================
   AUTH ROUTES
   ============================================================ */

async function authRoutes(
  request,
  env,
  url
) {

  if (
    url.pathname ===
      "/api/auth/signup" &&
    request.method === "POST"
  ) {

    const b =
      await body(request);

    const businessName =
      clean(
        b.business_name ||
        b.businessName
      );

    const ownerName =
      clean(
        b.owner_name ||
        b.ownerName
      );

    const email =
      clean(b.email)
        .toLowerCase();

    const phone =
      clean(b.phone);

    const password =
      String(b.password || "");

    if (
      !businessName ||
      !email ||
      password.length < 8
    ) {
      return json(
        {
          ok: false,
          error:
            "Business name, email and password of at least 8 characters are required"
        },
        400
      );
    }

    const existing =
      await env.DB
        .prepare(`
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
          ok: false,
          error:
            "Email already registered"
        },
        409
      );
    }

    const passwordData =
      await hashPassword(
        password
      );

    const accountId =
      id("acct");

    await env.DB
      .prepare(`
        INSERT INTO customer_accounts
        (
          id,
          business_name,
          owner_name,
          email,
          phone,
          password_hash,
          password_salt,
          status,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `)
      .bind(
        accountId,
        businessName,
        ownerName,
        email,
        phone,
        passwordData.hash,
        passwordData.salt,
        now()
      )
      .run();

    return json(
      {
        ok: true,
        account_id: accountId,
        message:
          "Customer account created"
      },
      201
    );
  }

  if (
    url.pathname ===
      "/api/auth/login" &&
    request.method === "POST"
  ) {

    const b =
      await body(request);

    const email =
      clean(b.email)
        .toLowerCase();

    const password =
      String(b.password || "");

    const account =
      await env.DB
        .prepare(`
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
          ok: false,
          error:
            "Invalid email or password"
        },
        401
      );
    }

    const passwordData =
      await hashPassword(
        password,
        account.password_salt
      );

    if (
      passwordData.hash !==
      account.password_hash
    ) {
      return json(
        {
          ok: false,
          error:
            "Invalid email or password"
        },
        401
      );
    }

    const token =
      id("sess");

    await env.DB
      .prepare(`
        INSERT INTO customer_sessions
        (
          token,
          account_id,
          expires_at,
          created_at
        )
        VALUES (?, ?, ?, ?)
      `)
      .bind(
        token,
        account.id,
        addDays(SESSION_DAYS),
        now()
      )
      .run();

    return json(
      {
        ok: true,
        message:
          "Login successful",
        account: {
          id: account.id,
          business_name:
            account.business_name,
          owner_name:
            account.owner_name,
          email:
            account.email,
          phone:
            account.phone
        }
      },
      200,
      {
        "Set-Cookie":
          sessionCookie(token)
      }
    );
  }

  if (
    url.pathname ===
      "/api/auth/logout" &&
    request.method === "POST"
  ) {

    const token =
      cookies(request)
        .sbs_session;

    if (token) {
      await env.DB
        .prepare(`
          DELETE FROM
          customer_sessions
          WHERE token = ?
        `)
        .bind(token)
        .run();
    }

    return json(
      {
        ok: true,
        message:
          "Logged out"
      },
      200,
      {
        "Set-Cookie":
          clearCookie()
      }
    );
  }

  if (
    url.pathname ===
      "/api/auth/me" &&
    request.method === "GET"
  ) {

    const customer =
      await getCustomer(
        request,
        env
      );

    if (!customer) {
      return json(
        {
          ok: false,
          authenticated: false
        },
        401
      );
    }

    return json({
      ok: true,
      authenticated: true,
      account: {
        id: customer.id,
        business_name:
          customer.business_name,
        owner_name:
          customer.owner_name,
        email:
          customer.email,
        phone:
          customer.phone
      }
    });
  }

  return null;
}

/* ============================================================
   CUSTOMER DASHBOARD
   ============================================================ */

async function customerDashboard(
  request,
  env,
  url
) {

  if (
    url.pathname !==
      "/api/customer/dashboard" ||
    request.method !== "GET"
  ) {
    return null;
  }

  const a =
    await requireCustomer(
      request,
      env
    );

  if (a.error) {
    return a.error;
  }

  const account =
    a.customer;

  const [
    subscriptions,
    payments,
    orders
  ] = await Promise.all([

    env.DB
      .prepare(`
        SELECT
          s.*,
          m.module_key,
          m.module_name,
          m.description
        FROM subscriptions s
        JOIN saas_modules m
          ON m.id = s.module_id
        WHERE s.account_id = ?
        ORDER BY s.created_at DESC
      `)
      .bind(account.id)
      .all(),

    env.DB
      .prepare(`
        SELECT *
        FROM saas_payments
        WHERE account_id = ?
        ORDER BY created_at DESC
        LIMIT 30
      `)
      .bind(account.id)
      .all(),

    env.DB
      .prepare(`
        SELECT *
        FROM ecommerce_orders
        WHERE account_id = ?
        ORDER BY created_at DESC
        LIMIT 30
      `)
      .bind(account.id)
      .all()
  ]);

  return json({
    ok: true,
    account,
    subscriptions:
      subscriptions.results,
    payments:
      payments.results,
    orders:
      orders.results
  });
}

/* ============================================================
   OWNER
   ============================================================ */

async function ownerRoutes(
  request,
  env,
  url
) {

  if (
    !url.pathname.startsWith(
      "/api/owner/"
    )
  ) {
    return null;
  }

  const denied =
    requireAdmin(
      request,
      env
    );

  if (denied) {
    return denied;
  }

  if (
    url.pathname ===
      "/api/owner/dashboard"
  ) {

    const [
      subscribers,
      activeSubscriptions,
      payments
    ] = await Promise.all([

      env.DB.prepare(`
        SELECT COUNT(*) total
        FROM customer_accounts
        WHERE status = 'active'
      `).first(),

      env.DB.prepare(`
        SELECT COUNT(*) total
        FROM subscriptions
        WHERE status = 'active'
      `).first(),

      env.DB.prepare(`
        SELECT
          COUNT(*) payments,
          COALESCE(
            SUM(amount),
            0
          ) revenue
        FROM saas_payments
        WHERE status = 'paid'
      `).first()
    ]);

    return json({
      ok: true,
      summary: {
        subscribers:
          subscribers?.total || 0,
        active_subscriptions:
          activeSubscriptions?.total || 0,
        paid_transactions:
          payments?.payments || 0,
        revenue:
          payments?.revenue || 0
      }
    });
  }

  if (
    url.pathname ===
      "/api/owner/subscribers"
  ) {

    const result =
      await env.DB
        .prepare(`
          SELECT
            a.id account_id,
            a.business_name,
            a.owner_name,
            a.email,
            a.phone,
            a.status account_status,
            s.plan_name,
            s.amount,
            s.status subscription_status,
            m.module_key,
            m.module_name
          FROM customer_accounts a
          LEFT JOIN subscriptions s
            ON s.account_id = a.id
          LEFT JOIN saas_modules m
            ON m.id = s.module_id
          ORDER BY a.created_at DESC
        `)
        .all();

    return json({
      ok: true,
      subscribers:
        result.results
    });
  }

  if (
    url.pathname ===
      "/api/owner/subscriptions/connect" &&
    request.method === "POST"
  ) {

    const b =
      await body(request);

    const module =
      await env.DB
        .prepare(`
          SELECT *
          FROM saas_modules
          WHERE module_key = ?
          AND active = 1
          LIMIT 1
        `)
        .bind(
          clean(b.module_key)
        )
        .first();

    if (!module) {
      return json(
        {
          ok: false,
          error:
            "Module not found"
        },
        404
      );
    }

    const subscriptionId =
      id("sub");

    await env.DB
      .prepare(`
        INSERT INTO subscriptions
        (
          id,
          account_id,
          module_id,
          plan_name,
          amount,
          status,
          started_at,
          created_at,
          updated_at
        )
        VALUES
        (?, ?, ?, ?, ?,
         'active', ?, ?, ?)
      `)
      .bind(
        subscriptionId,
        clean(b.account_id),
        module.id,
        clean(
          b.plan_name ||
          module.module_name
        ),
        Number(b.amount || 0),
        now(),
        now(),
        now()
      )
      .run();

    return json(
      {
        ok: true,
        subscription_id:
          subscriptionId
      },
      201
    );
  }

  if (
    url.pathname ===
      "/api/owner/reports" &&
    request.method === "GET"
  ) {

    const result =
      await env.DB
        .prepare(`
          SELECT *
          FROM reports
          ORDER BY created_at DESC
          LIMIT 2000
        `)
        .all();

    return json({
      ok: true,
      reports:
        result.results
    });
  }

  return null;
}

/* ============================================================
   PAYFAST
   ============================================================ */

function payfastUrl(env) {
  return String(
    env.PAYFAST_SANDBOX || ""
  ).toLowerCase() === "true"
    ? PAYFAST_SANDBOX
    : PAYFAST_LIVE;
}

function encodePayFast(value) {
  return encodeURIComponent(
    String(value ?? "")
  );
}

/*
 * Compact deterministic MD5 implementation is
 * intentionally replaced by Web Crypto SHA-256 style
 * signature support below.
 *
 * PayFast configuration should be tested against
 * the merchant account before production use.
 */

async function payfastSignature(
  fields,
  passphrase = ""
) {

  const keys =
    Object.keys(fields)
      .filter(
        key =>
          key !== "signature" &&
          fields[key] !== undefined &&
          fields[key] !== null &&
          fields[key] !== ""
      )
      .sort();

  let query =
    keys
      .map(
        key =>
          `${key}=${encodePayFast(
            fields[key]
          )}`
      )
      .join("&");

  if (passphrase) {
    query +=
      `&passphrase=${encodePayFast(
        passphrase
      )}`;
  }

  /*
   * SHA-256 helper.
   * If your PayFast account requires the
   * traditional MD5 signature, configure the
   * official PayFast integration layer separately.
   */
  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        query
      )
    );

  return [
    ...new Uint8Array(digest)
  ]
    .map(
      x =>
        x.toString(16)
          .padStart(2, "0")
    )
    .join("");
}

async function payfastRoutes(
  request,
  env,
  url
) {

  if (
    url.pathname ===
      "/api/payfast/create" &&
    request.method === "POST"
  ) {

    const a =
      await requireCustomer(
        request,
        env
      );

    if (a.error) {
      return a.error;
    }

    const b =
      await body(request);

    const moduleKey =
      clean(b.module_key);

    const amount =
      Number(b.amount || 0);

    const module =
      await env.DB
        .prepare(`
          SELECT *
          FROM saas_modules
          WHERE module_key = ?
          LIMIT 1
        `)
        .bind(moduleKey)
        .first();

    if (
      !module ||
      amount <= 0
    ) {
      return json(
        {
          ok: false,
          error:
            "Valid module and amount required"
        },
        400
      );
    }

    const subscriptionId =
      id("sub");

    const paymentId =
      id("pf");

    await env.DB
      .prepare(`
        INSERT INTO subscriptions
        (
          id,
          account_id,
          module_id,
          plan_name,
          amount,
          status,
          created_at,
          updated_at
        )
        VALUES
        (?, ?, ?, ?, ?,
         'pending', ?, ?)
      `)
      .bind(
        subscriptionId,
        a.customer.id,
        module.id,
        clean(
          b.plan_name ||
          module.module_name
        ),
        amount,
        now(),
        now()
      )
      .run();

    const fields = {
      merchant_id:
        env.PAYFAST_MERCHANT_ID,

      merchant_key:
        env.PAYFAST_MERCHANT_KEY,

      return_url:
        env.PAYFAST_RETURN_URL ||
        `${url.origin}/dashboard`,

      cancel_url:
        env.PAYFAST_CANCEL_URL ||
        `${url.origin}/dashboard`,

      notify_url:
        env.PAYFAST_NOTIFY_URL ||
        `${url.origin}/api/payfast/itn`,

      name_first:
        clean(
          a.customer.owner_name ||
          "Customer"
        ).split(" ")[0],

      email_address:
        a.customer.email,

      m_payment_id:
        paymentId,

      amount:
        amount.toFixed(2),

      item_name:
        `${APP} - ${clean(
          b.plan_name ||
          module.module_name
        )}`,

      custom_str1:
        a.customer.id,

      custom_str2:
        subscriptionId,

      custom_str3:
        moduleKey
    };

    if (
      b.recurring === true ||
      b.recurring === "true"
    ) {

      fields.subscription_type =
        "1";

      fields.billing_date =
        new Date(
          Date.now() +
          86400000
        )
          .toISOString()
          .slice(0, 10);

      fields.recurring_amount =
        amount.toFixed(2);

      fields.frequency = "3";
      fields.cycles = "0";
    }

    fields.signature =
      await payfastSignature(
        fields,
        env.PAYFAST_PASSPHRASE || ""
      );

    await env.DB
      .prepare(`
        INSERT INTO saas_payments
        (
          id,
          account_id,
          subscription_id,
          amount,
          status,
          payment_type,
          created_at,
          updated_at
        )
        VALUES
        (?, ?, ?, ?,
         'pending', ?, ?, ?)
      `)
      .bind(
        paymentId,
        a.customer.id,
        subscriptionId,
        amount,
        b.recurring
          ? "subscription"
          : "payment",
        now(),
        now()
      )
      .run();

    return json({
      ok: true,
      payment_id:
        paymentId,
      subscription_id:
        subscriptionId,
      payfast_url:
        payfastUrl(env),
      fields
    });
  }

  if (
    url.pathname ===
      "/api/payfast/itn" &&
    request.method === "POST"
  ) {

    const params =
      new URLSearchParams(
        await request.text()
      );

    const data =
      Object.fromEntries(
        params.entries()
      );

    const payment =
      await env.DB
        .prepare(`
          SELECT *
          FROM saas_payments
          WHERE id = ?
          LIMIT 1
        `)
        .bind(
          data.m_payment_id || ""
        )
        .first();

    if (!payment) {
      return text(
        "INVALID",
        400
      );
    }

    const status =
      clean(
        data.payment_status
      );

    await env.DB
      .prepare(`
        UPDATE saas_payments
        SET
          status = ?,
          pf_payment_id = ?,
          raw_status = ?,
          paid_at = ?,
          updated_at = ?
        WHERE id = ?
      `)
      .bind(
        status === "COMPLETE"
          ? "paid"
          : status,
        data.pf_payment_id ||
          null,
        status,
        status === "COMPLETE"
          ? now()
          : null,
        now(),
        payment.id
      )
      .run();

    if (
      status === "COMPLETE"
    ) {

      await env.DB
        .prepare(`
          UPDATE subscriptions
          SET
            status = 'active',
            started_at =
              COALESCE(
                started_at,
                ?
              ),
            updated_at = ?
          WHERE id = ?
        `)
        .bind(
          now(),
          now(),
          payment.subscription_id
        )
        .run();
    }

    return text("OK");
  }

  return null;
}

/* ============================================================
   SHARED BUSINESS ENGINE
   ============================================================ */

async function businessRoutes(
  request,
  env,
  url
) {

  const a =
    await requireCustomer(
      request,
      env
    );

  if (a.error) {
    return a.error;
  }

  const accountId =
    a.customer.id;

  if (
    url.pathname ===
      "/api/business/profile"
  ) {

    if (
      request.method === "GET"
    ) {

      const result =
        await env.DB
          .prepare(`
            SELECT *
            FROM business_profiles
            WHERE account_id = ?
            ORDER BY module_key
          `)
          .bind(accountId)
          .all();

      return json({
        ok: true,
        profiles:
          result.results
      });
    }

    if (
      request.method === "POST" ||
      request.method === "PUT"
    ) {

      const b =
        await body(request);

      const moduleKey =
        clean(
          b.module_key ||
          "general"
        );

      await env.DB
        .prepare(`
          INSERT INTO business_profiles
          (
            id,
            account_id,
            module_key,
            business_name,
            description,
            address,
            phone,
            whatsapp,
            email,
            website,
            opening_hours,
            metadata_json,
            created_at,
            updated_at
          )
          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?)
          ON CONFLICT(
            account_id,
            module_key
          )
          DO UPDATE SET
            business_name =
              excluded.business_name,
            description =
              excluded.description,
            address =
              excluded.address,
            phone =
              excluded.phone,
            whatsapp =
              excluded.whatsapp,
            email =
              excluded.email,
            website =
              excluded.website,
            opening_hours =
              excluded.opening_hours,
            metadata_json =
              excluded.metadata_json,
            updated_at =
              excluded.updated_at
        `)
        .bind(
          id("bp"),
          accountId,
          moduleKey,
          clean(b.business_name),
          clean(b.description),
          clean(b.address),
          clean(b.phone),
          clean(b.whatsapp),
          clean(b.email),
          clean(b.website),
          clean(b.opening_hours),
          JSON.stringify(
            b.metadata || {}
          ),
          now(),
          now()
        )
        .run();

      return json({
        ok: true,
        message:
          "Business profile saved"
      });
    }
  }

  if (
    url.pathname ===
      "/api/business/services"
  ) {

    if (
      request.method === "GET"
    ) {

      const result =
        await env.DB
          .prepare(`
            SELECT *
            FROM business_services
            WHERE account_id = ?
            ORDER BY created_at DESC
          `)
          .bind(accountId)
          .all();

      return json({
        ok: true,
        services:
          result.results
      });
    }

    if (
      request.method === "POST"
    ) {

      const b =
        await body(request);

      const serviceId =
        id("service");

      await env.DB
        .prepare(`
          INSERT INTO business_services
          (
            id,
            account_id,
            module_key,
            name,
            description,
            price,
            duration_minutes,
            active,
            metadata_json,
            created_at,
            updated_at
          )
          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          serviceId,
          accountId,
          clean(b.module_key),
          clean(b.name),
          clean(b.description),
          Number(b.price || 0),
          Number(
            b.duration_minutes || 0
          ),
          b.active === false
            ? 0
            : 1,
          JSON.stringify(
            b.metadata || {}
          ),
          now(),
          now()
        )
        .run();

      return json(
        {
          ok: true,
          id: serviceId
        },
        201
      );
    }
  }

  if (
    url.pathname ===
      "/api/business/records"
  ) {

    if (
      request.method === "GET"
    ) {

      const result =
        await env.DB
          .prepare(`
            SELECT *
            FROM business_records
            WHERE account_id = ?
            ORDER BY created_at DESC
            LIMIT 500
          `)
          .bind(accountId)
          .all();

      return json({
        ok: true,
        records:
          result.results
      });
    }

    if (
      request.method === "POST"
    ) {

      const b =
        await body(request);

      const recordId =
        id("record");

      await env.DB
        .prepare(`
          INSERT INTO business_records
          (
            id,
            account_id,
            module_key,
            record_type,
            title,
            status,
            data_json,
            created_at,
            updated_at
          )
          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          recordId,
          accountId,
          clean(b.module_key),
          clean(
            b.record_type ||
            "record"
          ),
          clean(b.title),
          clean(
            b.status ||
            "open"
          ),
          JSON.stringify(
            b.data || {}
          ),
          now(),
          now()
        )
        .run();

      return json(
        {
          ok: true,
          id: recordId
        },
        201
      );
    }
  }

  if (
    url.pathname ===
      "/api/business/finance"
  ) {

    if (
      request.method === "GET"
    ) {

      const result =
        await env.DB
          .prepare(`
            SELECT *
            FROM business_finance_reports
            WHERE account_id = ?
            ORDER BY report_date DESC
            LIMIT 500
          `)
          .bind(accountId)
          .all();

      return json({
        ok: true,
        reports:
          result.results
      });
    }

    if (
      request.method === "POST"
    ) {

      const b =
        await body(request);

      await env.DB
        .prepare(`
          INSERT INTO
          business_finance_reports
          (
            id,
            account_id,
            module_key,
            report_date,
            cash_sales,
            card_sales,
            other_income,
            expenses,
            notes,
            created_at
          )
          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(
            account_id,
            module_key,
            report_date
          )
          DO UPDATE SET
            cash_sales =
              excluded.cash_sales,
            card_sales =
              excluded.card_sales,
            other_income =
              excluded.other_income,
            expenses =
              excluded.expenses,
            notes =
              excluded.notes
        `)
        .bind(
          id("finance"),
          accountId,
          clean(b.module_key),
          clean(
            b.report_date ||
            now().slice(0, 10)
          ),
          Number(
            b.cash_sales || 0
          ),
          Number(
            b.card_sales || 0
          ),
          Number(
            b.other_income || 0
          ),
          Number(
            b.expenses || 0
          ),
          clean(b.notes),
          now()
        )
        .run();

      return json({
        ok: true,
        message:
          "Finance report saved"
      });
    }
  }

  if (
    url.pathname ===
      "/api/voice"
  ) {

    if (
      request.method === "GET"
    ) {

      const result =
        await env.DB
          .prepare(`
            SELECT *
            FROM voice_accounts
            WHERE account_id = ?
            ORDER BY created_at DESC
          `)
          .bind(accountId)
          .all();

      return json({
        ok: true,
        voice:
          result.results
      });
    }

    if (
      request.method === "POST"
    ) {

      const b =
        await body(request);

      const voiceId =
        id("voice");

      await env.DB
        .prepare(`
          INSERT INTO voice_accounts
          (
            id,
            account_id,
            plan_name,
            monthly_price,
            phone_number,
            provider,
            status,
            extensions_json,
            forwarding_number,
            voicemail,
            business_hours_json,
            created_at,
            updated_at
          )
          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          voiceId,
          accountId,
          clean(
            b.plan_name ||
            "Business Voice"
          ),
          Number(
            b.monthly_price || 0
          ),
          clean(
            b.phone_number
          ),
          clean(b.provider),
          clean(
            b.status ||
            "pending"
          ),
          JSON.stringify(
            b.extensions || []
          ),
          clean(
            b.forwarding_number
          ),
          b.voicemail === false
            ? 0
            : 1,
          JSON.stringify(
            b.business_hours ||
            {}
          ),
          now(),
          now()
        )
        .run();

      return json(
        {
          ok: true,
          id: voiceId
        },
        201
      );
    }
  }

  if (
    url.pathname ===
      "/api/hosting"
  ) {

    if (
      request.method === "GET"
    ) {

      const result =
        await env.DB
          .prepare(`
            SELECT *
            FROM hosting_services
            WHERE account_id = ?
            ORDER BY created_at DESC
          `)
          .bind(accountId)
          .all();

      return json({
        ok: true,
        services:
          result.results
      });
    }

    if (
      request.method === "POST"
    ) {

      const b =
        await body(request);

      const serviceId =
        id("hosting");

      await env.DB
        .prepare(`
          INSERT INTO hosting_services
          (
            id,
            account_id,
            service_type,
            domain_name,
            plan_name,
            monthly_price,
            status,
            metadata_json,
            created_at,
            updated_at
          )
          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          serviceId,
          accountId,
          clean(
            b.service_type ||
            "hosting"
          ),
          clean(b.domain_name),
          clean(b.plan_name),
          Number(
            b.monthly_price || 0
          ),
          clean(
            b.status ||
            "pending"
          ),
          JSON.stringify(
            b.metadata || {}
          ),
          now(),
          now()
        )
        .run();

      return json(
        {
          ok: true,
          id: serviceId
        },
        201
      );
    }
  }

  if (
    url.pathname ===
      "/api/cyber"
  ) {

    if (
      request.method === "GET"
    ) {

      const result =
        await env.DB
          .prepare(`
            SELECT *
            FROM cyber_services
            WHERE account_id = ?
            ORDER BY created_at DESC
          `)
          .bind(accountId)
          .all();

      return json({
        ok: true,
        services:
          result.results
      });
    }

    if (
      request.method === "POST"
    ) {

      const b =
        await body(request);

      const serviceId =
        id("cyber");

      await env.DB
        .prepare(`
          INSERT INTO cyber_services
          (
            id,
            account_id,
            service_type,
            device_count,
            monthly_price,
            status,
            metadata_json,
            created_at,
            updated_at
          )
          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          serviceId,
          accountId,
          clean(
            b.service_type ||
            "protection"
          ),
          Number(
            b.device_count || 0
          ),
          Number(
            b.monthly_price || 0
          ),
          clean(
            b.status ||
            "pending"
          ),
          JSON.stringify(
            b.metadata || {}
          ),
          now(),
          now()
        )
        .run();

      return json(
        {
          ok: true,
          id: serviceId
        },
        201
      );
    }
  }

  if (
    url.pathname ===
      "/api/directory"
  ) {

    if (
      request.method === "GET"
    ) {

      const result =
        await env.DB
          .prepare(`
            SELECT *
            FROM directory_listings
            WHERE account_id = ?
            ORDER BY created_at DESC
          `)
          .bind(accountId)
          .all();

      return json({
        ok: true,
        listings:
          result.results
      });
    }

    if (
      request.method === "POST"
    ) {

      const b =
        await body(request);

      const listingId =
        id("listing");

      await env.DB
        .prepare(`
          INSERT INTO directory_listings
          (
            id,
            account_id,
            module_key,
            business_name,
            category,
            description,
            address,
            phone,
            whatsapp,
            website,
            image_url,
            status,
            created_at,
            updated_at
          )
          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          listingId,
          accountId,
          clean(
            b.module_key ||
            "directory"
          ),
          clean(
            b.business_name ||
            a.customer.business_name
          ),
          clean(b.category),
          clean(b.description),
          clean(b.address),
          clean(b.phone),
          clean(b.whatsapp),
          clean(b.website),
          clean(b.image_url),
          clean(
            b.status ||
            "pending"
          ),
          now(),
          now()
        )
        .run();

      return json(
        {
          ok: true,
          id: listingId
        },
        201
      );
    }
  }

  return null;
}

/* ============================================================
   PHARMACY
   ============================================================ */

async function pharmacyRoutes(
  request,
  env,
  url
) {

  const a =
    await requireCustomer(
      request,
      env
    );

  if (a.error) {
    return a.error;
  }

  const accountId =
    a.customer.id;

  if (
    url.pathname ===
      "/api/pharmacy/profile"
  ) {

    if (
      request.method === "GET"
    ) {

      const profile =
        await env.DB
          .prepare(`
            SELECT *
            FROM pharmacy_profiles
            WHERE account_id = ?
          `)
          .bind(accountId)
          .first();

      return json({
        ok: true,
        profile:
          profile || null
      });
    }

    if (
      request.method === "POST"
    ) {

      const b =
        await body(request);

      await env.DB
        .prepare(`
          INSERT INTO pharmacy_profiles
          (
            id,
            account_id,
            responsible_pharmacist,
            pharmacy_council_number,
            licence_number,
            address,
            phone,
            email,
            website,
            online_store_enabled,
            created_at,
            updated_at
          )
          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(account_id)
          DO UPDATE SET
            responsible_pharmacist =
              excluded.responsible_pharmacist,
            pharmacy_council_number =
              excluded.pharmacy_council_number,
            licence_number =
              excluded.licence_number,
            address =
              excluded.address,
            phone =
              excluded.phone,
            email =
              excluded.email,
            website =
              excluded.website,
            online_store_enabled =
              excluded.online_store_enabled,
            updated_at =
              excluded.updated_at
        `)
        .bind(
          id("pharmacy"),
          accountId,
          clean(
            b.responsible_pharmacist
          ),
          clean(
            b.pharmacy_council_number
          ),
          clean(
            b.licence_number
          ),
          clean(b.address),
          clean(b.phone),
          clean(b.email),
          clean(b.website),
          b.online_store_enabled
            ? 1
            : 0,
          now(),
          now()
        )
        .run();

      return json({
        ok: true,
        message:
          "Pharmacy profile saved"
      });
    }
  }

  if (
    url.pathname ===
      "/api/pharmacy/branches"
  ) {

    if (
      request.method === "GET"
    ) {

      const result =
        await env.DB
          .prepare(`
            SELECT *
            FROM pharmacy_branches
            WHERE account_id = ?
            ORDER BY branch_name
          `)
          .bind(accountId)
          .all();

      return json({
        ok: true,
        branches:
          result.results
      });
    }

    if (
      request.method === "POST"
    ) {

      const b =
        await body(request);

      const branchId =
        id("branch");

      await env.DB
        .prepare(`
          INSERT INTO pharmacy_branches
          (
            id,
            account_id,
            branch_name,
            address,
            phone,
            whatsapp,
            opening_hours,
            status,
            created_at,
            updated_at
          )
          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          branchId,
          accountId,
          clean(b.branch_name),
          clean(b.address),
          clean(b.phone),
          clean(b.whatsapp),
          clean(b.opening_hours),
          clean(
            b.status ||
            "active"
          ),
          now(),
          now()
        )
        .run();

      return json(
        {
          ok: true,
          id: branchId
        },
        201
      );
    }
  }

  if (
    url.pathname ===
      "/api/pharmacy/stock-order" &&
    request.method === "POST"
  ) {

    const b =
      await body(request);

    const branch =
      await env.DB
        .prepare(`
          SELECT *
          FROM pharmacy_branches
          WHERE id = ?
          AND account_id = ?
        `)
        .bind(
          clean(b.branch_id),
          accountId
        )
        .first();

    if (!branch) {
      return json(
        {
          ok: false,
          error:
            "Branch not found"
        },
        404
      );
    }

    const orderId =
      id("stock");

    await env.DB
      .prepare(`
        INSERT INTO
        pharmacy_stock_orders
        (
          id,
          account_id,
          branch_id,
          status,
          notes,
          requested_by,
          created_at,
          updated_at
        )
        VALUES
        (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        orderId,
        accountId,
        branch.id,
        "requested",
        clean(b.notes),
        clean(
          b.requested_by ||
          a.customer.owner_name
        ),
        now(),
        now()
      )
      .run();

    const items =
      Array.isArray(b.items)
        ? b.items
        : [];

    for (
      const item of items
    ) {

      await env.DB
        .prepare(`
          INSERT INTO
          pharmacy_stock_items
          (
            id,
            stock_order_id,
            product_name,
            quantity,
            notes
          )
          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(
          id("item"),
          orderId,
          clean(
            item.product_name
          ),
          Number(
            item.quantity || 0
          ),
          clean(item.notes)
        )
        .run();
    }

    return json(
      {
        ok: true,
        order_id: orderId,
        branch:
          branch.branch_name,
        status:
          "requested"
      },
      201
    );
  }

  if (
    url.pathname ===
      "/api/pharmacy/cash-report" &&
    request.method === "POST"
  ) {

    const b =
      await body(request);

    const branch =
      await env.DB
        .prepare(`
          SELECT id
          FROM pharmacy_branches
          WHERE id = ?
          AND account_id = ?
        `)
        .bind(
          clean(b.branch_id),
          accountId
        )
        .first();

    if (!branch) {
      return json(
        {
          ok: false,
          error:
            "Branch not found"
        },
        404
      );
    }

    const reportDate =
      clean(
        b.report_date ||
        now().slice(0, 10)
      );

    await env.DB
      .prepare(`
        INSERT INTO
        pharmacy_cash_reports
        (
          id,
          account_id,
          branch_id,
          report_date,
          cash_sales,
          card_sales,
          eft_sales,
          expenses,
          cash_on_hand,
          notes,
          created_at
        )
        VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(
          branch_id,
          report_date
        )
        DO UPDATE SET
          cash_sales =
            excluded.cash_sales,
          card_sales =
            excluded.card_sales,
          eft_sales =
            excluded.eft_sales,
          expenses =
            excluded.expenses,
          cash_on_hand =
            excluded.cash_on_hand,
          notes =
            excluded.notes
      `)
      .bind(
        id("cash"),
        accountId,
        branch.id,
        reportDate,
        Number(
          b.cash_sales || 0
        ),
        Number(
          b.card_sales || 0
        ),
        Number(
          b.eft_sales || 0
        ),
        Number(
          b.expenses || 0
        ),
        Number(
          b.cash_on_hand || 0
        ),
        clean(b.notes),
        now()
      )
      .run();

    return json({
      ok: true,
      message:
        "Daily cash report saved"
    });
  }

  if (
    url.pathname ===
      "/api/pharmacy/cash-reports" &&
    request.method === "GET"
  ) {

    const result =
      await env.DB
        .prepare(`
          SELECT
            c.*,
            b.branch_name
          FROM pharmacy_cash_reports c
          JOIN pharmacy_branches b
            ON b.id = c.branch_id
          WHERE c.account_id = ?
          ORDER BY
            c.report_date DESC
        `)
        .bind(accountId)
        .all();

    return json({
      ok: true,
      reports:
        result.results
    });
  }

  if (
    url.pathname ===
      "/api/pharmacy/catalogue"
  ) {

    if (
      request.method === "POST"
    ) {

      const b =
        await body(request);

      const productId =
        id("pharmacy-product");

      await env.DB
        .prepare(`
          INSERT INTO
          pharmacy_catalogue
          (
            id,
            account_id,
            branch_id,
            product_name,
            description,
            sku,
            price,
            stock_quantity,
            image_url,
            active,
            prescription_required,
            created_at,
            updated_at
          )
          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?)
        `)
        .bind(
          productId,
          accountId,
          clean(b.branch_id) ||
            null,
          clean(
            b.product_name
          ),
          clean(b.description),
          clean(b.sku),
          Number(
            b.price || 0
          ),
          Number(
            b.stock_quantity || 0
          ),
          clean(b.image_url),
          b.active === false
            ? 0
            : 1,
          b.prescription_required
            ? 1
            : 0,
          now(),
          now()
        )
        .run();

      return json(
        {
          ok: true,
          id: productId
        },
        201
      );
    }

    if (
      request.method === "GET"
    ) {

      const publicAccount =
        url.searchParams.get(
          "account_id"
        );

      const target =
        publicAccount ||
        accountId;

      const result =
        await env.DB
          .prepare(`
            SELECT *
            FROM pharmacy_catalogue
            WHERE account_id = ?
            AND active = 1
            ORDER BY product_name
          `)
          .bind(target)
          .all();

      return json({
        ok: true,
        catalogue:
          result.results
      });
    }
  }

  return null;
}

/* ============================================================
   COUNCILLOR / COMMUNITY
   ============================================================ */

async function councillorRoutes(
  request,
  env,
  url
) {

  const a =
    await requireCustomer(
      request,
      env
    );

  if (a.error) {
    return a.error;
  }

  const accountId =
    a.customer.id;

  if (
    url.pathname ===
      "/api/councillor/profile"
  ) {

    if (
      request.method === "GET"
    ) {

      const profile =
        await env.DB
          .prepare(`
            SELECT *
            FROM councillor_profiles
            WHERE account_id = ?
          `)
          .bind(accountId)
          .first();

      return json({
        ok: true,
        profile:
          profile || null
      });
    }

    if (
      request.method === "POST"
    ) {

      const b =
        await body(request);

      await env.DB
        .prepare(`
          INSERT INTO
          councillor_profiles
          (
            id,
            account_id,
            councillor_name,
            ward_name,
            ward_number,
            municipality,
            office_phone,
            office_email,
            whatsapp_number,
            created_at,
            updated_at
          )
          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(account_id)
          DO UPDATE SET
            councillor_name =
              excluded.councillor_name,
            ward_name =
              excluded.ward_name,
            ward_number =
              excluded.ward_number,
            municipality =
              excluded.municipality,
            office_phone =
              excluded.office_phone,
            office_email =
              excluded.office_email,
            whatsapp_number =
              excluded.whatsapp_number,
            updated_at =
              excluded.updated_at
        `)
        .bind(
          id("councillor"),
          accountId,
          clean(b.councillor_name),
          clean(b.ward_name),
          clean(b.ward_number),
          clean(b.municipality),
          clean(b.office_phone),
          clean(b.office_email),
          clean(
            b.whatsapp_number
          ),
          now(),
          now()
        )
        .run();

      return json({
        ok: true,
        message:
          "Councillor profile saved"
      });
    }
  }

  if (
    url.pathname ===
      "/api/councillor/reports" &&
    request.method === "GET"
  ) {

    const result =
      await env.DB
        .prepare(`
          SELECT *
          FROM reports
          WHERE account_id = ?
          ORDER BY created_at DESC
          LIMIT 1000
        `)
        .bind(accountId)
        .all();

    return json({
      ok: true,
      reports:
        result.results
    });
  }

  if (
    url.pathname ===
      "/api/councillor/report-update" &&
    request.method === "POST"
  ) {

    const b =
      await body(request);

    const report =
      await env.DB
        .prepare(`
          SELECT *
          FROM reports
          WHERE id = ?
          AND account_id = ?
        `)
        .bind(
          clean(b.report_id),
          accountId
        )
        .first();

    if (!report) {
      return json(
        {
          ok: false,
          error:
            "Report not found"
        },
        404
      );
    }

    const status =
      clean(
        b.status ||
        report.status
      );

    const updateId =
      id("update");

    await env.DB
      .prepare(`
        INSERT INTO report_updates
        (
          id,
          report_id,
          status,
          note,
          created_at
        )
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(
        updateId,
        report.id,
        status,
        clean(b.note),
        now()
      )
      .run();

    await env.DB
      .prepare(`
        UPDATE reports
        SET
          status = ?,
          assigned_to = ?,
          updated_at = ?
        WHERE id = ?
        AND account_id = ?
      `)
      .bind(
        status,
        clean(
          b.assigned_to ||
          report.assigned_to
        ),
        now(),
        report.id,
        accountId
      )
      .run();

    return json({
      ok: true,
      update_id:
        updateId
    });
  }

  return null;
}

/* ============================================================
   COMMUNITY REPORTS
   ============================================================ */

function reportCategory(value) {

  const s =
    clean(value)
      .toLowerCase();

  if (
    /electric|power|loadshedding/
      .test(s)
  ) {
    return "Electricity";
  }

  if (
    /water|drain|sewer|leak/
      .test(s)
  ) {
    return "Water";
  }

  if (
    /road|pothole|storm|street/
      .test(s)
  ) {
    return "Roads";
  }

  if (
    /waste|dump|rubbish|garbage/
      .test(s)
  ) {
    return "Waste";
  }

  if (
    /fire|burn/
      .test(s)
  ) {
    return "Fire";
  }

  if (
    /vandal|theft|stolen|toilet|sidewalk|building/
      .test(s)
  ) {
    return "General";
  }

  return "General";
}

async function reportRoutes(
  request,
  env,
  url
) {

  if (
    url.pathname ===
      "/api/reports" &&
    request.method === "POST"
  ) {

    const b =
      await body(request);

    const description =
      clean(b.description);

    if (!description) {
      return json(
        {
          ok: false,
          error:
            "Description is required"
        },
        400
      );
    }

    const reportId =
      id("report");

    const number =
      "SBS-AX-" +
      Date.now()
        .toString()
        .slice(-8);

    const category =
      clean(
        b.category ||
        reportCategory(
          description
        )
      );

    await env.DB
      .prepare(`
        INSERT INTO reports
        (
          id,
          account_id,
          report_number,
          category,
          description,
          location,
          priority,
          source,
          status,
          created_at,
          updated_at
        )
        VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        reportId,
        b.account_id || null,
        number,
        category,
        description,
        clean(b.location),
        clean(
          b.priority ||
          "Normal"
        ),
        clean(
          b.source ||
          "Web"
        ),
        "Open",
        now(),
        now()
      )
      .run();

    return json(
      {
        ok: true,
        report_id:
          reportId,
        report_number:
          number,
        category,
        status:
          "Open"
      },
      201
    );
  }

  const match =
    url.pathname.match(
      /^\/api\/reports\/([^/]+)$/
    );

  if (
    match &&
    request.method === "GET"
  ) {

    const report =
      await env.DB
        .prepare(`
          SELECT *
          FROM reports
          WHERE report_number = ?
          LIMIT 1
        `)
        .bind(match[1])
        .first();

    if (!report) {
      return json(
        {
          ok: false,
          error:
            "Report not found"
        },
        404
      );
    }

    const updates =
      await env.DB
        .prepare(`
          SELECT *
          FROM report_updates
          WHERE report_id = ?
          ORDER BY created_at DESC
        `)
        .bind(report.id)
        .all();

    return json({
      ok: true,
      report,
      updates:
        updates.results
    });
  }

  return null;
}

/* ============================================================
   E-COMMERCE
   ============================================================ */

async function storeRoutes(
  request,
  env,
  url
) {

  if (
    url.pathname ===
      "/api/store/products" &&
    request.method === "GET"
  ) {

    let accountId =
      url.searchParams.get(
        "account_id"
      );

    if (!accountId) {

      const customer =
        await getCustomer(
          request,
          env
        );

      if (!customer) {
        return json(
          {
            ok: false,
            error:
              "account_id is required"
          },
          400
        );
      }

      accountId =
        customer.id;
    }

    const result =
      await env.DB
        .prepare(`
          SELECT *
          FROM products
          WHERE account_id = ?
          AND active = 1
          ORDER BY created_at DESC
        `)
        .bind(accountId)
        .all();

    return json({
      ok: true,
      products:
        result.results
    });
  }

  if (
    url.pathname ===
      "/api/store/products" &&
    request.method === "POST"
  ) {

    const a =
      await requireCustomer(
        request,
        env
      );

    if (a.error) {
      return a.error;
    }

    const b =
      await body(request);

    const productId =
      id("product");

    await env.DB
      .prepare(`
        INSERT INTO products
        (
          id,
          account_id,
          name,
          description,
          price,
          stock,
          category,
          image_url,
          video_url,
          active,
          created_at,
          updated_at
        )
        VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        productId,
        a.customer.id,
        clean(b.name),
        clean(b.description),
        Number(b.price || 0),
        Number(b.stock || 0),
        clean(b.category),
        clean(b.image_url),
        clean(b.video_url),
        b.active === false
          ? 0
          : 1,
        now(),
        now()
      )
      .run();

    return json(
      {
        ok: true,
        id: productId
      },
      201
    );
  }

  if (
    url.pathname ===
      "/api/store/orders" &&
    request.method === "POST"
  ) {

    const b =
      await body(request);

    const accountId =
      clean(b.account_id);

    if (!accountId) {
      return json(
        {
          ok: false,
          error:
            "account_id is required"
        },
        400
      );
    }

    const orderId =
      id("order");

    await env.DB
      .prepare(`
        INSERT INTO ecommerce_orders
        (
          id,
          account_id,
          customer_name,
          customer_phone,
          customer_email,
          items_json,
          total,
          status,
          payment_status,
          created_at,
          updated_at
        )
        VALUES
        (?, ?, ?, ?, ?, ?, ?,
         'pending', 'unpaid', ?, ?)
      `)
      .bind(
        orderId,
        accountId,
        clean(b.customer_name),
        clean(b.customer_phone),
        clean(b.customer_email),
        JSON.stringify(
          b.items || []
        ),
        Number(b.total || 0),
        now(),
        now()
      )
      .run();

    return json(
      {
        ok: true,
        order_id:
          orderId
      },
      201
    );
  }

  if (
    url.pathname ===
      "/api/store/orders" &&
    request.method === "GET"
  ) {

    const a =
      await requireCustomer(
        request,
        env
      );

    if (a.error) {
      return a.error;
    }

    const result =
      await env.DB
        .prepare(`
          SELECT *
          FROM ecommerce_orders
          WHERE account_id = ?
          ORDER BY created_at DESC
        `)
        .bind(a.customer.id)
        .all();

    return json({
      ok: true,
      orders:
        result.results
    });
  }

  return null;
}

/* ============================================================
   WEBSITE BUILDER
   ============================================================ */

async function websiteRoutes(
  request,
  env,
  url
) {

  if (
    url.pathname ===
      "/api/websites" &&
    request.method === "POST"
  ) {

    const a =
      await requireCustomer(
        request,
        env
      );

    if (a.error) {
      return a.error;
    }

    const b =
      await body(request);

    const name =
      clean(
        b.site_name ||
        a.customer.business_name
      );

    let slug =
      clean(
        b.slug ||
        name
      )
        .toLowerCase()
        .replace(
          /[^a-z0-9-]+/g,
          "-"
        )
        .replace(
          /^-+|-+$/g,
          ""
        );

    if (!slug) {
      slug =
        crypto.randomUUID()
          .slice(0, 8);
    }

    const existing =
      await env.DB
        .prepare(`
          SELECT id
          FROM websites
          WHERE slug = ?
        `)
        .bind(slug)
        .first();

    if (existing) {
      slug +=
        "-" +
        Date.now()
          .toString()
          .slice(-5);
    }

    const websiteId =
      id("site");

    const title =
      clean(
        b.title ||
        name
      );

    const description =
      clean(
        b.description
      );

    const websiteHtml =
      clean(
        b.html,
        100000
      ) ||
      `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport"
content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
body{
font-family:Arial;
margin:0;
background:#f4f8ff;
color:#172033
}
header{
background:#075bdb;
color:white;
padding:60px 20px;
text-align:center
}
main{
max-width:1000px;
margin:auto;
padding:40px 20px
}
.card{
background:white;
padding:25px;
border-radius:15px
}
</style>
</head>
<body>
<header>
<h1>${esc(name)}</h1>
<p>${esc(description)}</p>
</header>
<main>
<div class="card">
<h2>Welcome</h2>
<p>
Your website is powered by
Sky Blue Digital Service.
</p>
</div>
</main>
</body>
</html>`;

    await env.DB
      .prepare(`
        INSERT INTO websites
        (
          id,
          account_id,
          site_name,
          slug,
          title,
          description,
          html,
          status,
          created_at,
          updated_at
        )
        VALUES
        (?, ?, ?, ?, ?, ?, ?,
         'published', ?, ?)
      `)
      .bind(
        websiteId,
        a.customer.id,
        name,
        slug,
        title,
        description,
        websiteHtml,
        now(),
        now()
      )
      .run();

    return json(
      {
        ok: true,
        website_id:
          websiteId,
        slug,
        public_url:
          `/site/${slug}`
      },
      201
    );
  }

  if (
    url.pathname ===
      "/api/websites" &&
    request.method === "GET"
  ) {

    const a =
      await requireCustomer(
        request,
        env
      );

    if (a.error) {
      return a.error;
    }

    const result =
      await env.DB
        .prepare(`
          SELECT
            id,
            site_name,
            slug,
            title,
            description,
            status,
            created_at,
            updated_at
          FROM websites
          WHERE account_id = ?
          ORDER BY created_at DESC
        `)
        .bind(a.customer.id)
        .all();

    return json({
      ok: true,
      websites:
        result.results
    });
  }

  const match =
    url.pathname.match(
      /^\/api\/websites\/([^/]+)$/
    );

  if (
    match &&
    request.method === "PUT"
  ) {

    const a =
      await requireCustomer(
        request,
        env
      );

    if (a.error) {
      return a.error;
    }

    const b =
      await body(request);

    await env.DB
      .prepare(`
        UPDATE websites
        SET
          site_name = ?,
          title = ?,
          description = ?,
          html = ?,
          status = ?,
          updated_at = ?
        WHERE id = ?
        AND account_id = ?
      `)
      .bind(
        clean(b.site_name),
        clean(b.title),
        clean(b.description),
        clean(
          b.html,
          100000
        ),
        clean(
          b.status ||
          "published"
        ),
        now(),
        match[1],
        a.customer.id
      )
      .run();

    return json({
      ok: true,
      message:
        "Website updated"
    });
  }

  const publicMatch =
    url.pathname.match(
      /^\/site\/([^/]+)$/
    );

  if (
    publicMatch &&
    request.method === "GET"
  ) {

    const site =
      await env.DB
        .prepare(`
          SELECT html
          FROM websites
          WHERE slug = ?
          AND status = 'published'
          LIMIT 1
        `)
        .bind(
          publicMatch[1]
        )
        .first();

    if (!site) {
      return html(
        "<h1>Website not found</h1>",
        404
      );
    }

    return html(
      site.html
    );
  }

  return null;
}

/* ============================================================
   MEDIA UPLOAD
   ============================================================ */

async function mediaUpload(
  request,
  env,
  url
) {

  if (
    url.pathname !==
      "/api/media/upload" ||
    request.method !== "POST"
  ) {
    return null;
  }

  const a =
    await requireCustomer(
      request,
      env
    );

  if (a.error) {
    return a.error;
  }

  if (!env.MEDIA) {
    return json(
      {
        ok: false,
        error:
          "R2 MEDIA binding is not configured"
      },
      500
    );
  }

  const contentType =
    request.headers.get(
      "Content-Type"
    ) ||
    "application/octet-stream";

  const size =
    Number(
      request.headers.get(
        "Content-Length"
      ) || 0
    );

  if (
    !MEDIA_TYPES.includes(
      contentType
    )
  ) {
    return json(
      {
        ok: false,
        error:
          "File type not allowed"
      },
      415
    );
  }

  if (
    size > MAX_MEDIA_SIZE
  ) {
    return json(
      {
        ok: false,
        error:
          "File too large"
      },
      413
    );
  }

  const key =
    `${a.customer.id}/` +
    `${Date.now()}-` +
    crypto.randomUUID();

  const data =
    await request.arrayBuffer();

  await env.MEDIA.put(
    key,
    data,
    {
      httpMetadata: {
        contentType
      }
    }
  );

  const mediaId =
    id("media");

  const publicPath =
    `/media/${encodeURIComponent(
      key
    )}`;

  await env.DB
    .prepare(`
      INSERT INTO media_files
      (
        id,
        account_id,
        source,
        original_name,
        r2_key,
        content_type,
        size,
        public_path,
        created_at
      )
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      mediaId,
      a.customer.id,
      "upload",
      clean(
        request.headers.get(
          "X-Filename"
        )
      ),
      key,
      contentType,
      size || data.byteLength,
      publicPath,
      now()
    )
    .run();

  return json(
    {
      ok: true,
      id: mediaId,
      key,
      url: publicPath
    },
    201
  );
}

async function publicMedia(
  request,
  env,
  url
) {

  if (
    !url.pathname.startsWith(
      "/media/"
    ) ||
    !env.MEDIA
  ) {
    return null;
  }

  const key =
    decodeURIComponent(
      url.pathname.slice(7)
    );

  const object =
    await env.MEDIA.get(key);

  if (!object) {
    return text(
      "Not found",
      404
    );
  }

  return new Response(
    object.body,
    {
      headers: {
        "Content-Type":
          object.httpMetadata
            ?.contentType ||
          "application/octet-stream",
        ...CORS
      }
    }
  );
}

/* ============================================================
   WHATSAPP
   ============================================================ */

async function sendWhatsAppText(
  env,
  to,
  message
) {

  if (
    !env.WHATSAPP_ACCESS_TOKEN ||
    !env.WHATSAPP_PHONE_NUMBER_ID
  ) {
    return {
      ok: false,
      error:
        "WhatsApp credentials are not configured"
    };
  }

  const endpoint =
    `https://graph.facebook.com/v23.0/` +
    `${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response =
    await fetch(
      endpoint,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          messaging_product:
            "whatsapp",
          to,
          type: "text",
          text: {
            body: message
          }
        })
      }
    );

  return {
    ok: response.ok,
    data:
      await response.json()
  };
}

async function whatsappRoutes(
  request,
  env,
  url
) {

  if (
    url.pathname ===
      "/api/whatsapp" &&
    request.method === "GET"
  ) {

    const token =
      url.searchParams.get(
        "hub.verify_token"
      );

    const challenge =
      url.searchParams.get(
        "hub.challenge"
      );

    if (
      token ===
      env.WHATSAPP_VERIFY_TOKEN
    ) {
      return text(
        challenge || ""
      );
    }

    return text(
      "Webhook verification failed",
      403
    );
  }

  if (
    url.pathname ===
      "/api/whatsapp" &&
    request.method === "POST"
  ) {

    const data =
      await body(request);

    try {

      for (
        const entry of
        data.entry || []
      ) {

        for (
          const change of
          entry.changes || []
        ) {

          const messages =
            change.value
              ?.messages || [];

          for (
            const message of
            messages
          ) {

            const type =
              clean(
                message.type
              );

            const from =
              clean(
                message.from
              );

            const textBody =
              type === "text"
                ? clean(
                    message.text
                      ?.body
                  )
                : "";

            const messageId =
              clean(
                message.id
              );

            const mediaId =
              type === "image"
                ? clean(
                    message.image
                      ?.id
                  )
                : type === "video"
                ? clean(
                    message.video
                      ?.id
                  )
                : null;

            await env.DB
              .prepare(`
                INSERT OR IGNORE INTO
                whatsapp_messages
                (
                  id,
                  wa_message_id,
                  from_phone,
                  message_type,
                  text_body,
                  media_id,
                  created_at
                )
                VALUES
                (?, ?, ?, ?, ?, ?, ?)
              `)
              .bind(
                id("wam"),
                messageId,
                from,
                type,
                textBody,
                mediaId,
                now()
              )
              .run();

            /*
             * Basic community-report detection.
             */
            if (
              textBody &&
              /report|pothole|water|electric|dump|waste|fire/i
                .test(textBody)
            ) {

              const reportId =
                id("report");

              const number =
                "SBS-AX-" +
                Date.now()
                  .toString()
                  .slice(-8);

              await env.DB
                .prepare(`
                  INSERT INTO reports
                  (
                    id,
                    report_number,
                    category,
                    description,
                    location,
                    priority,
                    source,
                    status,
                    created_at,
                    updated_at
                  )
                  VALUES
                  (?, ?, ?, ?, ?, ?, ?,
                   'Open', ?, ?)
                `)
                .bind(
                  reportId,
                  number,
                  reportCategory(
                    textBody
                  ),
                  textBody,
                  "",
                  "Normal",
                  "WhatsApp",
                  now(),
                  now()
                )
                .run();
            }
          }
        }
      }

    } catch (error) {

      console.error(
        "WhatsApp processing error",
        error
      );
    }

    return json({
      ok: true,
      received: true
    });
  }

  if (
    url.pathname ===
      "/api/whatsapp/send" &&
    request.method === "POST"
  ) {

    const a =
      await requireCustomer(
        request,
        env
      );

    if (a.error) {
      return a.error;
    }

    const b =
      await body(request);

    return json(
      await sendWhatsAppText(
        env,
        clean(b.to),
        clean(b.message)
      )
    );
  }

  return null;
}

/* ============================================================
   MODULES
   ============================================================ */

async function moduleRoutes(
  request,
  env,
  url
) {

  if (
    url.pathname ===
      "/api/modules" &&
    request.method === "GET"
  ) {

    const result =
      await env.DB
        .prepare(`
          SELECT *
          FROM saas_modules
          WHERE active = 1
          ORDER BY module_name
        `)
        .all();

    return json({
      ok: true,
      modules:
        result.results
    });
  }

  return null;
}

/* ============================================================
   HEALTH
   ============================================================ */

async function healthRoutes(
  request,
  env,
  url
) {

  if (
    url.pathname ===
      "/api/health" &&
    request.method === "GET"
  ) {

    return json({
      ok: true,
      service: APP,
      version: VERSION,
      status: "running",
      database:
        Boolean(env.DB),
      media_storage:
        Boolean(env.MEDIA),
      timestamp: now()
    });
  }

  if (
    url.pathname ===
      "/health" &&
    request.method === "GET"
  ) {

    return text(
      `${APP} API is running`
    );
  }

  return null;
}

/* ============================================================
   API ROUTER
   ============================================================ */

async function handleApi(
  request,
  env,
  url
) {

  const routes = [

    healthRoutes,

    authRoutes,

    customerDashboard,

    ownerRoutes,

    payfastRoutes,

    businessRoutes,

    pharmacyRoutes,

    councillorRoutes,

    reportRoutes,

    storeRoutes,

    websiteRoutes,

    mediaUpload,

    whatsappRoutes,

    moduleRoutes

  ];

  for (
    const route of routes
  ) {

    const result =
      await route(
        request,
        env,
        url
      );

    if (result) {
      return result;
    }
  }

  return json(
    {
      ok: false,
      error:
        "API endpoint not found"
    },
    404
  );
}

/* ============================================================
   LANDING PAGE
   ============================================================ */

function landingPage() {

  const cards =
    MODULES
      .map(
        module => `
          <div class="card">
            <h2>
              ${esc(module[1])}
            </h2>
            <p>
              ${esc(module[2])}
            </p>
          </div>
        `
      )
      .join("");

  return `
<!doctype html>
<html lang="en">

<head>

<meta charset="utf-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1">

<title>
${APP}
</title>

<style>

*{
box-sizing:border-box
}

body{
margin:0;
font-family:
Arial,
Helvetica,
sans-serif;
background:#f4f8ff;
color:#142033
}

.hero{
padding:70px 20px;
text-align:center;
background:#075bdb;
color:white
}

.hero h1{
font-size:42px;
margin:0 0 15px
}

.hero p{
font-size:18px;
max-width:750px;
margin:auto
}

.grid{
max-width:1150px;
margin:40px auto;
padding:20px;
display:grid;
grid-template-columns:
repeat(
auto-fit,
minmax(220px,1fr)
);
gap:20px
}

.card{
background:white;
padding:25px;
border-radius:15px;
box-shadow:
0 5px 20px
rgba(0,0,0,.08)
}

.card h2{
margin-top:0
}

.footer{
text-align:center;
padding:30px;
color:#667085
}

</style>

</head>

<body>

<section class="hero">

<h1>
${APP}
</h1>

<p>
Smart technology.
Reliable business solutions.
One platform for websites,
online stores, WhatsApp,
business management,
community services and
digital subscriptions.
</p>

</section>

<section class="grid">

${cards}

</section>

<div class="footer">

${APP}
API v${VERSION}

</div>

</body>

</html>
`;
}

/* ============================================================
   MAIN CLOUDFLARE WORKER
   ============================================================ */

export default {

  async fetch(
    request,
    env
  ) {

    if (
      request.method ===
      "OPTIONS"
    ) {

      return new Response(
        null,
        {
          status: 204,
          headers: CORS
        }
      );
    }

    try {

      /*
       * Create/repair the required
       * D1 tables before handling requests.
       */
      await ensureSchema(env);

      const url =
        new URL(
          request.url
        );

      /*
       * API routes.
       */
      if (
        url.pathname.startsWith(
          "/api/"
        )
      ) {

        return await handleApi(
          request,
          env,
          url
        );
      }

      /*
       * Public R2 media.
       */
      if (
        url.pathname.startsWith(
          "/media/"
        )
      ) {

        return await publicMedia(
          request,
          env,
          url
        );
      }

      /*
       * Public business website.
       */
      if (
        url.pathname.startsWith(
          "/site/"
        )
      ) {

        return await websiteRoutes(
          request,
          env,
          url
        );
      }

      /*
       * Root landing page.
       */
      return html(
        landingPage()
      );

    } catch (error) {

      console.error(
        "Sky Blue Worker error:",
        error?.stack ||
        error
      );

      return json(
        {
          ok: false,
          error:
            "Internal server error",
          message:
            error?.message ||
            String(error)
        },
        500
      );
    }
  }
};
