/*
 * ============================================================
 * SKY BLUE DIGITAL SERVICE
 * CLEAN SAAS + ECOMMERCE + WHATSAPP + WEBSITE + PAYFAST WORKER
 * ============================================================
 *
 * Required wrangler bindings:
 *
 * D1:
 *   DB
 *
 * R2:
 *   MEDIA
 *
 * Environment / Secrets:
 *
 *   ADMIN_KEY
 *   PAYFAST_MERCHANT_ID
 *   PAYFAST_MERCHANT_KEY
 *   PAYFAST_PASSPHRASE
 *   PAYFAST_RETURN_URL
 *   PAYFAST_CANCEL_URL
 *   PAYFAST_NOTIFY_URL
 *
 *   WHATSAPP_VERIFY_TOKEN
 *   WHATSAPP_ACCESS_TOKEN
 *   WHATSAPP_PHONE_NUMBER_ID
 *
 * Optional:
 *
 *   PAYFAST_SANDBOX = "true"
 *
 * ============================================================
 */

const APP = "Sky Blue Digital Service";
const VERSION = "3.0.0";

const SESSION_DAYS = 30;
const MAX_MEDIA_SIZE = 100 * 1024 * 1024;

const PAYFAST_LIVE = "https://www.payfast.co.za/eng/process";
const PAYFAST_SANDBOX = "https://sandbox.payfast.co.za/eng/process";

const PAYFAST_VALIDATE_LIVE =
  "https://www.payfast.co.za/eng/query/validate";

const PAYFAST_VALIDATE_SANDBOX =
  "https://sandbox.payfast.co.za/eng/query/validate";

const ALLOWED_MEDIA = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf"
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS"
};

/* ============================================================
   BASIC HELPERS
   ============================================================ */

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...extra
    }
  });
}

function text(data, status = 200, extra = {}) {
  return new Response(data, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...CORS_HEADERS,
      ...extra
    }
  });
}

function html(data, status = 200) {
  return new Response(data, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...CORS_HEADERS
    }
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function clean(value, max = 5000) {
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, max);
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
    Date.now() + days * 86400000
  ).toISOString();
}

function escapeHtml(value) {
  return clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ============================================================
   PASSWORD SECURITY
   ============================================================ */

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)]
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(
      hex.substring(i * 2, i * 2 + 2),
      16
    );
  }

  return bytes;
}

async function hashPassword(password, saltHex = null) {
  const salt = saltHex
    ? hexToBytes(saltHex)
    : crypto.getRandomValues(new Uint8Array(16));

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
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

async function verifyPassword(password, salt, expectedHash) {
  const result = await hashPassword(password, salt);
  return result.hash === expectedHash;
}

/* ============================================================
   COOKIE / AUTHENTICATION
   ============================================================ */

function getCookies(request) {
  const output = {};

  const header = request.headers.get("Cookie") || "";

  for (const item of header.split(";")) {
    const index = item.indexOf("=");

    if (index === -1) continue;

    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();

    output[key] = decodeURIComponent(value);
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

function expiredSessionCookie() {
  return [
    "sbs_session=",
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0"
  ].join("; ");
}

async function getCustomer(request, env) {
  const cookies = getCookies(request);
  const token = cookies.sbs_session;

  if (!token) return null;

  const row = await env.DB.prepare(`
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

  return row || null;
}

async function requireCustomer(request, env) {
  const customer = await getCustomer(request, env);

  if (!customer) {
    return {
      error: json(
        { ok: false, error: "Authentication required" },
        401
      )
    };
  }

  return { customer };
}

function adminAuthorized(request, env) {
  const key =
    request.headers.get("Authorization")?.replace(
      /^Bearer\s+/i,
      ""
    ) ||
    request.headers.get("X-Admin-Key") ||
    "";

  return Boolean(
    env.ADMIN_KEY &&
    key &&
    key === env.ADMIN_KEY
  );
}

function requireAdmin(request, env) {
  if (!adminAuthorized(request, env)) {
    return json(
      { ok: false, error: "Owner authorization required" },
      401
    );
  }

  return null;
}

/* ============================================================
   DATABASE
   ============================================================ */

let schemaPromise = null;

async function ensureSchema(env) {
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    const statements = [

      `
      CREATE TABLE IF NOT EXISTS customer_accounts (
        id TEXT PRIMARY KEY,
        business_name TEXT NOT NULL,
        owner_name TEXT,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL
      )
      `,

      `
      CREATE TABLE IF NOT EXISTS customer_sessions (
        token TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
      `,

      `
      CREATE TABLE IF NOT EXISTS saas_modules (
        id TEXT PRIMARY KEY,
        module_key TEXT NOT NULL UNIQUE,
        module_name TEXT NOT NULL,
        description TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      )
      `,

      `
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        module_id TEXT NOT NULL,
        plan_name TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'ZAR',
        status TEXT NOT NULL DEFAULT 'pending',
        started_at TEXT,
        expires_at TEXT,
        payfast_token TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
      `,

      `
      CREATE TABLE IF NOT EXISTS saas_payments (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        subscription_id TEXT,
        pf_payment_id TEXT,
        amount REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'ZAR',
        status TEXT NOT NULL DEFAULT 'pending',
        payment_type TEXT,
        raw_status TEXT,
        paid_at TEXT,
        created_at TEXT NOT NULL
      )
      `,

      `
      CREATE TABLE IF NOT EXISTS payment_reminders (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        subscription_id TEXT,
        channel TEXT NOT NULL DEFAULT 'dashboard',
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        sent_at TEXT,
        created_at TEXT NOT NULL
      )
      `,

      `
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL DEFAULT 0,
        stock INTEGER NOT NULL DEFAULT 0,
        category TEXT,
        image_url TEXT,
        video_url TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
      `,

      `
      CREATE TABLE IF NOT EXISTS ecommerce_orders (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        customer_email TEXT,
        items_json TEXT NOT NULL,
        total REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        payment_status TEXT NOT NULL DEFAULT 'unpaid',
        payment_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
      `,

      `
      CREATE TABLE IF NOT EXISTS websites (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        site_name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        title TEXT,
        description TEXT,
        html TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
      `,

      `
      CREATE TABLE IF NOT EXISTS media_files (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        source TEXT,
        original_name TEXT,
        r2_key TEXT NOT NULL,
        content_type TEXT,
        size INTEGER DEFAULT 0,
        public_path TEXT,
        created_at TEXT NOT NULL
      )
      `,

      `
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        wa_message_id TEXT,
        from_phone TEXT,
        message_type TEXT,
        text_body TEXT,
        media_id TEXT,
        media_key TEXT,
        media_url TEXT,
        created_at TEXT NOT NULL
      )
      `,

      `
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        report_number TEXT UNIQUE,
        category TEXT,
        description TEXT,
        location TEXT,
        priority TEXT DEFAULT 'Normal',
        source TEXT DEFAULT 'Web',
        status TEXT DEFAULT 'Open',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
      `,

      `
      CREATE TABLE IF NOT EXISTS report_updates (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        status TEXT,
        note TEXT,
        created_at TEXT NOT NULL
      )
      `,

      `
      CREATE INDEX IF NOT EXISTS idx_subscriptions_account
      ON subscriptions(account_id)
      `,

      `
      CREATE INDEX IF NOT EXISTS idx_payments_account
      ON saas_payments(account_id)
      `,

      `
      CREATE INDEX IF NOT EXISTS idx_products_account
      ON products(account_id)
      `,

      `
      CREATE INDEX IF NOT EXISTS idx_orders_account
      ON ecommerce_orders(account_id)
      `
    ];

    for (const sql of statements) {
      await env.DB.prepare(sql).run();
    }

    const modules = [
      ["ecommerce", "E-Commerce", "Products, pictures, videos, orders and checkout"],
      ["whatsapp", "WhatsApp Business", "WhatsApp communication and media"],
      ["website", "Website Builder", "Create and publish a business website"],
      ["civic", "Community Service", "Community reports and service requests"],
      ["npo", "NPO / NGO", "Organisation and programme management"],
      ["hosting", "Hosting & Domains", "Hosting, domains and business services"],
      ["cyber", "Cyber Protection", "Business cyber protection services"]
    ];

    for (const [key, name, description] of modules) {
      await env.DB.prepare(`
        INSERT OR IGNORE INTO saas_modules
        (id, module_key, module_name, description, active, created_at)
        VALUES (?, ?, ?, ?, 1, ?)
      `)
        .bind(
          id("mod"),
          key,
          name,
          description,
          now()
        )
        .run();
    }
  })();

  return schemaPromise;
}

/* ============================================================
   CUSTOMER AUTH
   ============================================================ */

async function authRoutes(request, env, url) {

  if (url.pathname === "/api/auth/signup" &&
      request.method === "POST") {

    const body = await readJson(request);

    const businessName = clean(body.business_name || body.businessName);
    const ownerName = clean(body.owner_name || body.ownerName);
    const email = clean(body.email).toLowerCase();
    const phone = clean(body.phone);
    const password = String(body.password || "");

    if (!businessName || !email || password.length < 8) {
      return json({
        ok: false,
        error: "Business name, email and password of at least 8 characters are required"
      }, 400);
    }

    const existing = await env.DB.prepare(`
      SELECT id FROM customer_accounts WHERE email = ? LIMIT 1
    `)
      .bind(email)
      .first();

    if (existing) {
      return json({
        ok: false,
        error: "An account with this email already exists"
      }, 409);
    }

    const passwordData = await hashPassword(password);
    const accountId = id("acct");

    await env.DB.prepare(`
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

    return json({
      ok: true,
      account_id: accountId,
      message: "Customer account created"
    }, 201);
  }

  if (url.pathname === "/api/auth/login" &&
      request.method === "POST") {

    const body = await readJson(request);

    const email = clean(body.email).toLowerCase();
    const password = String(body.password || "");

    const account = await env.DB.prepare(`
      SELECT *
      FROM customer_accounts
      WHERE email = ?
      LIMIT 1
    `)
      .bind(email)
      .first();

    if (!account) {
      return json({
        ok: false,
        error: "Invalid email or password"
      }, 401);
    }

    const valid = await verifyPassword(
      password,
      account.password_salt,
      account.password_hash
    );

    if (!valid) {
      return json({
        ok: false,
        error: "Invalid email or password"
      }, 401);
    }

    const token = id("sess");

    await env.DB.prepare(`
      INSERT INTO customer_sessions
      (token, account_id, expires_at, created_at)
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
        message: "Login successful",
        account: {
          id: account.id,
          business_name: account.business_name,
          owner_name: account.owner_name,
          email: account.email,
          phone: account.phone
        }
      },
      200,
      {
        "Set-Cookie": sessionCookie(token)
      }
    );
  }

  if (url.pathname === "/api/auth/logout" &&
      request.method === "POST") {

    const cookies = getCookies(request);

    if (cookies.sbs_session) {
      await env.DB.prepare(`
        DELETE FROM customer_sessions
        WHERE token = ?
      `)
        .bind(cookies.sbs_session)
        .run();
    }

    return json(
      {
        ok: true,
        message: "Logged out"
      },
      200,
      {
        "Set-Cookie": expiredSessionCookie()
      }
    );
  }

  if (url.pathname === "/api/auth/me" &&
      request.method === "GET") {

    const customer = await getCustomer(request, env);

    if (!customer) {
      return json({
        ok: false,
        authenticated: false
      }, 401);
    }

    return json({
      ok: true,
      authenticated: true,
      account: {
        id: customer.id,
        business_name: customer.business_name,
        owner_name: customer.owner_name,
        email: customer.email,
        phone: customer.phone
      }
    });
  }

  return null;
}

/* ============================================================
   CUSTOMER DASHBOARD
   ============================================================ */

async function customerDashboard(request, env, url) {

  if (url.pathname !== "/api/customer/dashboard" ||
      request.method !== "GET") {
    return null;
  }

  const auth = await requireCustomer(request, env);

  if (auth.error) return auth.error;

  const customer = auth.customer;

  const subscriptions = await env.DB.prepare(`
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
    .bind(customer.id)
    .all();

  const payments = await env.DB.prepare(`
    SELECT *
    FROM saas_payments
    WHERE account_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `)
    .bind(customer.id)
    .all();

  const orders = await env.DB.prepare(`
    SELECT *
    FROM ecommerce_orders
    WHERE account_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `)
    .bind(customer.id)
    .all();

  return json({
    ok: true,
    customer: {
      id: customer.id,
      business_name: customer.business_name,
      owner_name: customer.owner_name,
      email: customer.email,
      phone: customer.phone
    },

    /*
     * The dashboard uses these active subscriptions
     * to determine which services the customer can see.
     */
    services: subscriptions.results.filter(
      x => x.status === "active"
    ),

    subscriptions: subscriptions.results,
    payments: payments.results,
    orders: orders.results
  });
}

/* ============================================================
   OWNER DASHBOARD
   ============================================================ */

async function ownerDashboard(request, env, url) {

  if (!url.pathname.startsWith("/api/owner/")) {
    return null;
  }

  const denied = requireAdmin(request, env);

  if (denied) return denied;

  if (
    url.pathname === "/api/owner/dashboard" &&
    request.method === "GET"
  ) {

    const subscribers = await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM customer_accounts
      WHERE status = 'active'
    `).first();

    const activeSubscriptions = await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM subscriptions
      WHERE status = 'active'
    `).first();

    const paid = await env.DB.prepare(`
      SELECT
        COUNT(*) AS payments,
        COALESCE(SUM(amount), 0) AS revenue
      FROM saas_payments
      WHERE status = 'paid'
    `).first();

    const unpaid = await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM subscriptions
      WHERE status IN ('pending', 'unpaid', 'overdue')
    `).first();

    const customers = await env.DB.prepare(`
      SELECT
        a.id,
        a.business_name,
        a.owner_name,
        a.email,
        a.phone,
        a.status,
        a.created_at,
        COUNT(s.id) AS subscription_count
      FROM customer_accounts a
      LEFT JOIN subscriptions s
        ON s.account_id = a.id
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `).all();

    return json({
      ok: true,
      summary: {
        subscribers: subscribers?.total || 0,
        active_subscriptions: activeSubscriptions?.total || 0,
        paid_transactions: paid?.payments || 0,
        revenue: paid?.revenue || 0,
        unpaid_subscriptions: unpaid?.total || 0
      },
      customers: customers.results
    });
  }

  if (
    url.pathname === "/api/owner/subscribers" &&
    request.method === "GET"
  ) {

    const rows = await env.DB.prepare(`
      SELECT
        a.id AS account_id,
        a.business_name,
        a.owner_name,
        a.email,
        a.phone,
        a.status AS account_status,
        a.created_at AS account_created,
        s.id AS subscription_id,
        s.plan_name,
        s.amount,
        s.status AS subscription_status,
        s.started_at,
        s.expires_at,
        s.updated_at,
        m.module_key,
        m.module_name,
        (
          SELECT MAX(p.paid_at)
          FROM saas_payments p
          WHERE p.account_id = a.id
            AND p.status = 'paid'
        ) AS last_payment
      FROM customer_accounts a
      LEFT JOIN subscriptions s
        ON s.account_id = a.id
      LEFT JOIN saas_modules m
        ON m.id = s.module_id
      ORDER BY a.created_at DESC
    `).all();

    return json({
      ok: true,
      subscribers: rows.results
    });
  }

  /*
   * CONNECT / ACTIVATE A SERVICE
   */
  if (
    url.pathname === "/api/owner/subscriptions/connect" &&
    request.method === "POST"
  ) {

    const body = await readJson(request);

    const accountId = clean(body.account_id);
    const moduleKey = clean(body.module_key);
    const planName = clean(body.plan_name || moduleKey);
    const amount = Number(body.amount || 0);

    const module = await env.DB.prepare(`
      SELECT *
      FROM saas_modules
      WHERE module_key = ?
      AND active = 1
      LIMIT 1
    `)
      .bind(moduleKey)
      .first();

    if (!module) {
      return json({
        ok: false,
        error: "Service module not found"
      }, 404);
    }

    const subscriptionId = id("sub");

    await env.DB.prepare(`
      INSERT INTO subscriptions
      (
        id,
        account_id,
        module_id,
        plan_name,
        amount,
        currency,
        status,
        started_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, 'ZAR', 'active', ?, ?, ?)
    `)
      .bind(
        subscriptionId,
        accountId,
        module.id,
        planName,
        amount,
        now(),
        now(),
        now()
      )
      .run();

    return json({
      ok: true,
      message: "Service connected",
      subscription_id: subscriptionId
    }, 201);
  }

  /*
   * DISCONNECT / DEACTIVATE A SERVICE
   */
  if (
    url.pathname === "/api/owner/subscriptions/disconnect" &&
    request.method === "POST"
  ) {

    const body = await readJson(request);

    const subscriptionId = clean(body.subscription_id);

    await env.DB.prepare(`
      UPDATE subscriptions
      SET status = 'cancelled',
          updated_at = ?
      WHERE id = ?
    `)
      .bind(now(), subscriptionId)
      .run();

    return json({
      ok: true,
      message: "Service disconnected"
    });
  }

  /*
   * CREATE PAYMENT REMINDER
   */
  if (
    url.pathname === "/api/owner/reminders" &&
    request.method === "POST"
  ) {

    const body = await readJson(request);

    const accountId = clean(body.account_id);
    const subscriptionId = clean(body.subscription_id);
    const message = clean(
      body.message ||
      "Your Sky Blue Digital Service payment is outstanding. Please make payment to keep your service active."
    );

    const reminderId = id("rem");

    await env.DB.prepare(`
      INSERT INTO payment_reminders
      (
        id,
        account_id,
        subscription_id,
        channel,
        message,
        status,
        created_at
      )
      VALUES (?, ?, ?, 'dashboard', ?, 'pending', ?)
    `)
      .bind(
        reminderId,
        accountId,
        subscriptionId || null,
        message,
        now()
      )
      .run();

    return json({
      ok: true,
      reminder_id: reminderId,
      message: "Payment reminder created"
    }, 201);
  }

  return null;
}

/* ============================================================
   PAYFAST
   ============================================================ */

function payfastUrl(env) {
  return String(env.PAYFAST_SANDBOX || "")
    .toLowerCase() === "true"
    ? PAYFAST_SANDBOX
    : PAYFAST_LIVE;
}

function payfastValidateUrl(env) {
  return String(env.PAYFAST_SANDBOX || "")
    .toLowerCase() === "true"
    ? PAYFAST_VALIDATE_SANDBOX
    : PAYFAST_VALIDATE_LIVE;
}

function encodePayFast(value) {
  return encodeURIComponent(String(value ?? ""));
}

async function md5(input) {
  /*
   * Cloudflare Workers does not provide native MD5
   * through crypto.subtle, so this compact implementation
   * is included for PayFast signature compatibility.
   */
  function add32(a, b) {
    return (a + b) | 0;
  }

  function cmn(q, a, b, x, s, t) {
    return add32(
      (add32(a, q) + add32(x, t) | 0) << s |
      (add32(a, q) + add32(x, t) | 0) >>> (32 - s),
      b
    );
  }

  function ff(a,b,c,d,x,s,t) {
    return cmn((b & c) | (~b & d),a,b,x,s,t);
  }

  function gg(a,b,c,d,x,s,t) {
    return cmn((b & d) | (c & ~d),a,b,x,s,t);
  }

  function hh(a,b,c,d,x,s,t) {
    return cmn(b ^ c ^ d,a,b,x,s,t);
  }

  function ii(a,b,c,d,x,s,t) {
    return cmn(c ^ (b | ~d),a,b,x,s,t);
  }

  const encoder = new TextEncoder();
  const bytes = [...encoder.encode(input)];

  const bitLen = bytes.length * 8;

  bytes.push(0x80);

  while (bytes.length % 64 !== 56) {
    bytes.push(0);
  }

  for (let i = 0; i < 8; i++) {
    bytes.push((bitLen >>> (8 * i)) & 0xff);
  }

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  for (let offset = 0; offset < bytes.length; offset += 64) {

    const x = [];

    for (let i = 0; i < 16; i++) {
      const p = offset + i * 4;

      x[i] =
        bytes[p] |
        bytes[p + 1] << 8 |
        bytes[p + 2] << 16 |
        bytes[p + 3] << 24;
    }

    const oa = a;
    const ob = b;
    const oc = c;
    const od = d;

    a = ff(a,b,c,d,x[0],7, -680876936);
    d = ff(d,a,b,c,x[1],12, -389564586);
    c = ff(c,d,a,b,x[2],17, 606105819);
    b = ff(b,c,d,a,x[3],22, -1044525330);
    a = ff(a,b,c,d,x[4],7, -176418897);
    d = ff(d,a,b,c,x[5],12, 1200080426);
    c = ff(c,d,a,b,x[6],17, -1473231341);
    b = ff(b,c,d,a,x[7],22, -45705983);
    a = ff(a,b,c,d,x[8],7, 1770035416);
    d = ff(d,a,b,c,x[9],12, -1958414417);
    c = ff(c,d,a,b,x[10],17, -42063);
    b = ff(b,c,d,a,x[11],22, -1990404162);
    a = ff(a,b,c,d,x[12],7, 1804603682);
    d = ff(d,a,b,c,x[13],12, -40341101);
    c = ff(c,d,a,b,x[14],17, -1502002290);
    b = ff(b,c,d,a,x[15],22, 1236535329);

    a = gg(a,b,c,d,x[1],5, -165796510);
    d = gg(d,a,b,c,x[6],9, -1069501632);
    c = gg(c,d,a,b,x[11],14, 643717713);
    b = gg(b,c,d,a,x[0],20, -373897302);
    a = gg(a,b,c,d,x[5],5, -701558691);
    d = gg(d,a,b,c,x[10],9, 38016083);
    c = gg(c,d,a,b,x[15],14, -660478335);
    b = gg(b,c,d,a,x[4],20, -405537848);
    a = gg(a,b,c,d,x[9],5, 568446438);
    d = gg(d,a,b,c,x[14],9, -1019803690);
    c = gg(c,d,a,b,x[3],14, -187363961);
    b = gg(b,c,d,a,x[8],20, 1163531501);
    a = gg(a,b,c,d,x[13],5, -1444681467);
    d = gg(d,a,b,c,x[2],9, -51403784);
    c = gg(c,d,a,b,x[7],14, 1735328473);
    b = gg(b,c,d,a,x[12],20, -1926607734);

    a = hh(a,b,c,d,x[5],4, -378558);
    d = hh(d,a,b,c,x[8],11, -2022574463);
    c = hh(c,d,a,b,x[11],16, 1839030562);
    b = hh(b,c,d,a,x[14],23, -35309556);
    a = hh(a,b,c,d,x[1],4, -1530992060);
    d = hh(d,a,b,c,x[4],11, 1272893353);
    c = hh(c,d,a,b,x[7],16, -155497632);
    b = hh(b,c,d,a,x[10],23, -1094730640);
    a = hh(a,b,c,d,x[13],4, 681279174);
    d = hh(d,a,b,c,x[0],11, -358537222);
    c = hh(c,d,a,b,x[3],16, -722521979);
    b = hh(b,c,d,a,x[6],23, 76029189);
    a = hh(a,b,c,d,x[9],4, -640364487);
    d = hh(d,a,b,c,x[12],11, -421815835);
    c = hh(c,d,a,b,x[15],16, 530742520);
    b = hh(b,c,d,a,x[2],23, -995338651);

    a = ii(a,b,c,d,x[0],6, -198630844);
    d = ii(d,a,b,c,x[7],10, 1126891415);
    c = ii(c,d,a,b,x[14],15, -1416354905);
    b = ii(b,c,d,a,x[5],21, -57434055);
    a = ii(a,b,c,d,x[12],6, 1700485571);
    d = ii(d,a,b,c,x[3],10, -1894986606);
    c = ii(c,d,a,b,x[10],15, -1051523);
    b = ii(b,c,d,a,x[1],21, -2054922799);
    a = ii(a,b,c,d,x[8],6, 1873313359);
    d = ii(d,a,b,c,x[15],10, -30611744);
    c = ii(c,d,a,b,x[6],15, -1560198380);
    b = ii(b,c,d,a,x[13],21, 1309151649);
    a = ii(a,b,c,d,x[4],6, -145523070);
    d = ii(d,a,b,c,x[11],10, -1120210379);
    c = ii(c,d,a,b,x[2],15, 718787259);
    b = ii(b,c,d,a,x[9],21, -343485551);

    a = add32(a, oa);
    b = add32(b, ob);
    c = add32(c, oc);
    d = add32(d, od);
  }

  const words = [a,b,c,d];
  let result = "";

  for (const word of words) {
    for (let i = 0; i < 4; i++) {
      result += ((word >>> (8 * i)) & 0xff)
        .toString(16)
        .padStart(2, "0");
    }
  }

  return result;
}

async function payfastSignature(fields, passphrase = "") {

  const keys = Object.keys(fields)
    .filter(key => key !== "signature")
    .sort();

  let query = "";

  for (const key of keys) {
    const value = fields[key];

    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      continue;
    }

    query += `${key}=${encodePayFast(value)}&`;
  }

  query = query.slice(0, -1);

  if (passphrase) {
    query += `&passphrase=${encodePayFast(passphrase)}`;
  }

  return md5(query);
}

async function payfastRoutes(request, env, url) {

  if (
    url.pathname === "/api/payfast/create" &&
    request.method === "POST"
  ) {

    const auth = await requireCustomer(request, env);

    if (auth.error) return auth.error;

    const body = await readJson(request);

    const moduleKey = clean(body.module_key);
    const planName = clean(body.plan_name || moduleKey);
    const amount = Number(body.amount || 0);
    const recurring =
      body.recurring === true ||
      body.recurring === "true";

    if (!env.PAYFAST_MERCHANT_ID ||
        !env.PAYFAST_MERCHANT_KEY) {

      return json({
        ok: false,
        error: "PayFast credentials have not been configured"
      }, 500);
    }

    if (!moduleKey || amount <= 0) {
      return json({
        ok: false,
        error: "module_key and a valid amount are required"
      }, 400);
    }

    const module = await env.DB.prepare(`
      SELECT *
      FROM saas_modules
      WHERE module_key = ?
      LIMIT 1
    `)
      .bind(moduleKey)
      .first();

    if (!module) {
      return json({
        ok: false,
        error: "Service module not found"
      }, 404);
    }

    const subscriptionId = id("sub");

    await env.DB.prepare(`
      INSERT INTO subscriptions
      (
        id,
        account_id,
        module_id,
        plan_name,
        amount,
        currency,
        status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, 'ZAR', 'pending', ?, ?)
    `)
      .bind(
        subscriptionId,
        auth.customer.id,
        module.id,
        planName,
        amount,
        now(),
        now()
      )
      .run();

    const paymentId = id("pf");

    const notifyUrl =
      env.PAYFAST_NOTIFY_URL ||
      `${url.origin}/api/payfast/itn`;

    const returnUrl =
      env.PAYFAST_RETURN_URL ||
      `${url.origin}/dashboard`;

    const cancelUrl =
      env.PAYFAST_CANCEL_URL ||
      `${url.origin}/dashboard`;

    const fields = {
      merchant_id: env.PAYFAST_MERCHANT_ID,
      merchant_key: env.PAYFAST_MERCHANT_KEY,

      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,

      name_first:
        clean(auth.customer.owner_name || "Customer")
          .split(" ")[0],

      email_address: auth.customer.email,

      m_payment_id: paymentId,

      amount: amount.toFixed(2),

      item_name:
        `${APP} - ${planName}`,

      custom_str1: auth.customer.id,
      custom_str2: subscriptionId,
      custom_str3: moduleKey
    };

    /*
     * PayFast recurring subscription.
     *
     * billing_cycle:
     * 3 = monthly
     *
     * billing_period:
     * 12 = monthly period according to PayFast's
     * recurring payment structure.
     */
    if (recurring) {
      fields.subscription_type = "1";
      fields.billing_date =
        new Date(Date.now() + 86400000)
          .toISOString()
          .slice(0, 10);

      fields.recurring_amount =
        amount.toFixed(2);

      fields.frequency = "3";
      fields.cycles = "0";
    }

    fields.signature = await payfastSignature(
      fields,
      env.PAYFAST_PASSPHRASE || ""
    );

    const payment = await env.DB.prepare(`
      INSERT INTO saas_payments
      (
        id,
        account_id,
        subscription_id,
        amount,
        currency,
        status,
        payment_type,
        created_at
      )
      VALUES (?, ?, ?, ?, 'ZAR', 'pending', ?, ?)
    `)
      .bind(
        paymentId,
        auth.customer.id,
        subscriptionId,
        amount,
        recurring ? "subscription" : "payment",
        now()
      )
      .run();

    return json({
      ok: true,
      payment_id: paymentId,
      subscription_id: subscriptionId,
      payfast_url: payfastUrl(env),
      fields
    });
  }

  /*
   * PAYFAST ITN
   */
  if (
    url.pathname === "/api/payfast/itn" &&
    request.method === "POST"
  ) {

    const raw = await request.text();

    const params = new URLSearchParams(raw);
    const data = {};

    for (const [key, value] of params.entries()) {
      data[key] = value;
    }

    if (!data.signature) {
      return text("Missing signature", 400);
    }

    const expectedSignature =
      await payfastSignature(
        data,
        env.PAYFAST_PASSPHRASE || ""
      );

    if (
      expectedSignature.toLowerCase() !==
      String(data.signature).toLowerCase()
    ) {
      return text("Invalid signature", 400);
    }

    /*
     * Validate the ITN directly with PayFast.
     */
    const validationResponse = await fetch(
      payfastValidateUrl(env),
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },
        body: raw
      }
    );

    const validationText =
      await validationResponse.text();

    if (validationText.trim() !== "VALID") {
      return text("PayFast validation failed", 400);
    }

    const paymentId =
      clean(data.m_payment_id);

    const paymentStatus =
      clean(data.payment_status);

    const amount =
      Number(data.amount_gross || data.amount || 0);

    const accountId =
      clean(data.custom_str1);

    const subscriptionId =
      clean(data.custom_str2);

    let localStatus = "pending";

    if (paymentStatus === "COMPLETE") {
      localStatus = "paid";
    } else if (paymentStatus === "FAILED") {
      localStatus = "failed";
    } else if (paymentStatus === "CANCELLED") {
      localStatus = "cancelled";
    }

    await env.DB.prepare(`
      UPDATE saas_payments
      SET
        status = ?,
        raw_status = ?,
        paid_at = CASE
          WHEN ? = 'paid' THEN ?
          ELSE paid_at
        END
      WHERE id = ?
    `)
      .bind(
        localStatus,
        paymentStatus,
        localStatus,
        now(),
        paymentId
      )
      .run();

    if (
      localStatus === "paid" &&
      accountId &&
      subscriptionId
    ) {

      await env.DB.prepare(`
        UPDATE subscriptions
        SET
          status = 'active',
          started_at =
            COALESCE(started_at, ?),
          updated_at = ?
        WHERE id = ?
          AND account_id = ?
      `)
        .bind(
          now(),
          now(),
          subscriptionId,
          accountId
        )
        .run();
    }

    return text("OK");
  }

  return null;
}

/* ============================================================
   MEDIA / R2
   ============================================================ */

async function uploadToR2(env, file, accountId, source = "web") {

  if (!file) {
    throw new Error("No file supplied");
  }

  if (file.size > MAX_MEDIA_SIZE) {
    throw new Error("File is larger than 100 MB");
  }

  if (
    file.type &&
    !ALLOWED_MEDIA.includes(file.type)
  ) {
    throw new Error(
      `File type not supported: ${file.type}`
    );
  }

  const extension =
    clean(
      file.name?.split(".").pop() || "bin",
      10
    ).toLowerCase();

  const key =
    `uploads/${accountId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  await env.MEDIA.put(
    key,
    file.stream(),
    {
      httpMetadata: {
        contentType:
          file.type || "application/octet-stream"
      }
    }
  );

  const mediaId = id("media");

  const publicPath =
    `/media/${encodeURIComponent(key)}`;

  await env.DB.prepare(`
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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      mediaId,
      accountId,
      source,
      clean(file.name),
      key,
      file.type || "application/octet-stream",
      file.size || 0,
      publicPath,
      now()
    )
    .run();

  return {
    id: mediaId,
    key,
    url: publicPath,
    content_type: file.type,
    size: file.size
  };
}

async function mediaRoutes(request, env, url) {

  if (
    url.pathname === "/api/media/upload" &&
    request.method === "POST"
  ) {

    const auth = await requireCustomer(request, env);

    if (auth.error) return auth.error;

    const form = await request.formData();
    const files = form.getAll("files");

    if (!files.length) {
      const single = form.get("file");

      if (single) files.push(single);
    }

    if (!files.length) {
      return json({
        ok: false,
        error: "No files uploaded"
      }, 400);
    }

    const uploaded = [];

    for (const file of files) {
      if (!(file instanceof File)) continue;

      uploaded.push(
        await uploadToR2(
          env,
          file,
          auth.customer.id,
          "customer"
        )
      );
    }

    return json({
      ok: true,
      files: uploaded
    }, 201);
  }

  /*
   * Public media delivery.
   */
  if (
    url.pathname.startsWith("/media/") &&
    request.method === "GET"
  ) {

    const key =
      decodeURIComponent(
        url.pathname.slice("/media/".length)
      );

    if (!key) {
      return text("Media not found", 404);
    }

    const object =
      await env.MEDIA.get(key);

    if (!object) {
      return text("Media not found", 404);
    }

    const headers = new Headers();

    object.writeHttpMetadata(headers);

    headers.set(
      "Cache-Control",
      "public, max-age=31536000"
    );

    return new Response(object.body, {
      headers
    });
  }

  return null;
}

/* ============================================================
   E-COMMERCE PRODUCTS
   ============================================================ */

async function ecommerceRoutes(request, env, url) {

  /*
   * Customer products.
   */
  if (
    url.pathname === "/api/products" &&
    request.method === "GET"
  ) {

    const accountId =
      url.searchParams.get("account_id");

    if (!accountId) {
      return json({
        ok: false,
        error: "account_id is required"
      }, 400);
    }

    const products = await env.DB.prepare(`
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
      products: products.results
    });
  }

  /*
   * Customer creates product.
   * Product pictures/videos can be uploaded first using
   * /api/media/upload, then their returned URLs are stored here.
   */
  if (
    url.pathname === "/api/products" &&
    request.method === "POST"
  ) {

    const auth = await requireCustomer(request, env);

    if (auth.error) return auth.error;

    const body = await readJson(request);

    const productId = id("prod");

    await env.DB.prepare(`
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `)
      .bind(
        productId,
        auth.customer.id,
        clean(body.name),
        clean(body.description),
        Number(body.price || 0),
        Number(body.stock || 0),
        clean(body.category),
        clean(body.image_url),
        clean(body.video_url),
        now(),
        now()
      )
      .run();

    return json({
      ok: true,
      product_id: productId
    }, 201);
  }

  /*
   * Upload product media and immediately return URLs.
   */
  if (
    url.pathname === "/api/products/media" &&
    request.method === "POST"
  ) {

    const auth = await requireCustomer(request, env);

    if (auth.error) return auth.error;

    const form = await request.formData();

    const files =
      form.getAll("files");

    const uploaded = [];

    for (const file of files) {
      if (!(file instanceof File)) continue;

      uploaded.push(
        await uploadToR2(
          env,
          file,
          auth.customer.id,
          "ecommerce"
        )
      );
    }

    return json({
      ok: true,
      media: uploaded
    }, 201);
  }

  /*
   * Update product.
   */
  const match =
    url.pathname.match(
      /^\/api\/products\/([^/]+)$/
    );

  if (
    match &&
    request.method === "PUT"
  ) {

    const auth = await requireCustomer(request, env);

    if (auth.error) return auth.error;

    const productId = match[1];
    const body = await readJson(request);

    await env.DB.prepare(`
      UPDATE products
      SET
        name = ?,
        description = ?,
        price = ?,
        stock = ?,
        category = ?,
        image_url = ?,
        video_url = ?,
        active = ?,
        updated_at = ?
      WHERE id = ?
        AND account_id = ?
    `)
      .bind(
        clean(body.name),
        clean(body.description),
        Number(body.price || 0),
        Number(body.stock || 0),
        clean(body.category),
        clean(body.image_url),
        clean(body.video_url),
        body.active === false ? 0 : 1,
        now(),
        productId,
        auth.customer.id
      )
      .run();

    return json({
      ok: true,
      message: "Product updated"
    });
  }

  /*
   * Create order.
   */
  if (
    url.pathname === "/api/orders" &&
    request.method === "POST"
  ) {

    const body = await readJson(request);

    const accountId = clean(body.account_id);

    if (!accountId) {
      return json({
        ok: false,
        error: "account_id is required"
      }, 400);
    }

    const orderId = id("order");

    await env.DB.prepare(`
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
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid', ?, ?)
    `)
      .bind(
        orderId,
        accountId,
        clean(body.customer_name),
        clean(body.customer_phone),
        clean(body.customer_email),
        JSON.stringify(body.items || []),
        Number(body.total || 0),
        now(),
        now()
      )
      .run();

    return json({
      ok: true,
      order_id: orderId
    }, 201);
  }

  return null;
}

/* ============================================================
   WEBSITE BUILDER
   ============================================================ */

async function websiteRoutes(request, env, url) {

  if (
    url.pathname === "/api/websites" &&
    request.method === "GET"
  ) {

    const auth = await requireCustomer(request, env);

    if (auth.error) return auth.error;

    const sites = await env.DB.prepare(`
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
      .bind(auth.customer.id)
      .all();

    return json({
      ok: true,
      websites: sites.results
    });
  }

  if (
    url.pathname === "/api/websites" &&
    request.method === "POST"
  ) {

    const auth = await requireCustomer(request, env);

    if (auth.error) return auth.error;

    const body = await readJson(request);

    const siteName =
      clean(body.site_name || body.siteName);

    let slug =
      clean(body.slug || siteName)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "");

    if (!slug) {
      slug = crypto.randomUUID().slice(0, 8);
    }

    const existing =
      await env.DB.prepare(`
        SELECT id FROM websites
        WHERE slug = ?
        LIMIT 1
      `)
        .bind(slug)
        .first();

    if (existing) {
      slug += "-" + Date.now().toString().slice(-5);
    }

    const websiteId = id("site");

    const title =
      clean(body.title || siteName);

    const description =
      clean(body.description);

    const suppliedHtml =
      clean(body.html, 50000);

    const safeName =
      escapeHtml(siteName);

    const htmlContent =
      suppliedHtml ||
      `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport"
content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description"
content="${escapeHtml(description)}">
<style>
body{
  margin:0;
  font-family:Arial,sans-serif;
  background:#f5f8fc;
  color:#172033;
}
header{
  background:#075bdb;
  color:white;
  padding:50px 20px;
  text-align:center;
}
main{
  max-width:1000px;
  margin:auto;
  padding:40px 20px;
}
.card{
  background:white;
  padding:25px;
  border-radius:15px;
  margin-bottom:20px;
}
</style>
</head>
<body>
<header>
<h1>${safeName}</h1>
<p>${escapeHtml(description)}</p>
</header>
<main>
<div class="card">
<h2>Welcome</h2>
<p>Your website is powered by Sky Blue Digital Service.</p>
</div>
</main>
</body>
</html>`;

    await env.DB.prepare(`
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
      VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)
    `)
      .bind(
        websiteId,
        auth.customer.id,
        siteName,
        slug,
        title,
        description,
        htmlContent,
        now(),
        now()
      )
      .run();

    return json({
      ok: true,
      website_id: websiteId,
      slug,
      public_url: `/site/${slug}`
    }, 201);
  }

  /*
   * Publish/update website.
   */
  const match =
    url.pathname.match(
      /^\/api\/websites\/([^/]+)$/
    );

  if (
    match &&
    request.method === "PUT"
  ) {

    const auth = await requireCustomer(request, env);

    if (auth.error) return auth.error;

    const body = await readJson(request);

    await env.DB.prepare(`
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
        clean(body.site_name),
        clean(body.title),
        clean(body.description),
        clean(body.html, 50000),
        clean(body.status || "published"),
        now(),
        match[1],
        auth.customer.id
      )
      .run();

    return json({
      ok: true,
      message: "Website updated"
    });
  }

  /*
   * Public website.
   */
  const publicMatch =
    url.pathname.match(
      /^\/site\/([^/]+)$/
    );

  if (
    publicMatch &&
    request.method === "GET"
  ) {

    const site =
      await env.DB.prepare(`
        SELECT *
        FROM websites
        WHERE slug = ?
          AND status = 'published'
        LIMIT 1
      `)
        .bind(publicMatch[1])
        .first();

    if (!site) {
      return html(
        "<h1>Website not found</h1>",
        404
      );
    }

    return html(site.html);
  }

  return null;
}

/* ============================================================
   WHATSAPP
   ============================================================ */

async function whatsappSendText(env, to, message) {

  if (
    !env.WHATSAPP_ACCESS_TOKEN ||
    !env.WHATSAPP_PHONE_NUMBER_ID
  ) {
    return {
      ok: false,
      error: "WhatsApp credentials are not configured"
    };
  }

  const endpoint =
    `https://graph.facebook.com/v23.0/` +
    `${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(endpoint, {
    method: "POST",

    headers: {
      "Authorization":
        `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,

      "Content-Type":
        "application/json"
    },

    body: JSON.stringify({
      messaging_product: "whatsapp",

      to,

      type: "text",

      text: {
        body: message
      }
    })
  });

  const data = await response.json();

  return {
    ok: response.ok,
    data
  };
}

async function downloadWhatsAppMedia(
  env,
  mediaId,
  accountId,
  messageId
) {

  if (!mediaId ||
      !env.WHATSAPP_ACCESS_TOKEN) {
    return null;
  }

  const infoResponse =
    await fetch(
      `https://graph.facebook.com/v23.0/${mediaId}`,
      {
        headers: {
          "Authorization":
            `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`
        }
      }
    );

  if (!infoResponse.ok) {
    return null;
  }

  const info =
    await infoResponse.json();

  if (!info.url) {
    return null;
  }

  const mediaResponse =
    await fetch(info.url, {
      headers: {
        "Authorization":
          `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`
      }
    });

  if (!mediaResponse.ok) {
    return null;
  }

  const blob =
    await mediaResponse.blob();

  const filename =
    `${mediaId}-${messageId}`;

  const file =
    new File(
      [blob],
      filename,
      {
        type:
          info.mime_type ||
          blob.type ||
          "application/octet-stream"
      }
    );

  const result =
    await uploadToR2(
      env,
      file,
      accountId || "whatsapp",
      "whatsapp"
    );

  return {
    ...result,
    media_id: mediaId
  };
}

async function whatsappRoutes(request, env, url) {

  /*
   * Meta webhook verification.
   */
  if (
    url.pathname === "/api/whatsapp" &&
    request.method === "GET"
  ) {

    const mode =
      url.searchParams.get(
        "hub.mode"
      );

    const token =
      url.searchParams.get(
        "hub.verify_token"
      );

    const challenge =
      url.searchParams.get(
        "hub.challenge"
      );

    if (
      mode === "subscribe" &&
      token === env.WHATSAPP_VERIFY_TOKEN
    ) {
      return text(challenge || "");
    }

    return text(
      "Webhook verification failed",
      403
    );
  }

  /*
   * WhatsApp webhook.
   */
  if (
    url.pathname === "/api/whatsapp" &&
    request.method === "POST"
  ) {

    const body = await readJson(request);

    try {

      const entries =
        body.entry || [];

      for (const entry of entries) {

        const changes =
          entry.changes || [];

        for (const change of changes) {

          const value =
            change.value || {};

          const messages =
            value.messages || [];

          for (const message of messages) {

            const waMessageId =
              clean(message.id);

            const from =
              clean(message.from);

            const type =
              clean(message.type);

            let textBody = "";

            if (type === "text") {
              textBody =
                clean(
                  message.text?.body
                );
            }

            let mediaId = null;
            let mediaResult = null;

            if (
              type === "image" &&
              message.image
            ) {
              mediaId =
                clean(message.image.id);
            }

            if (
              type === "video" &&
              message.video
            ) {
              mediaId =
                clean(message.video.id);
            }

            /*
             * Store the incoming message first.
             */
            const messageDbId =
              id("wamsg");

            await env.DB.prepare(`
              INSERT OR IGNORE INTO whatsapp_messages
              (
                id,
                account_id,
                wa_message_id,
                from_phone,
                message_type,
                text_body,
                media_id,
                created_at
              )
              VALUES (?, NULL, ?, ?, ?, ?, ?, ?)
            `)
              .bind(
                messageDbId,
                waMessageId,
                from,
                type,
                textBody,
                mediaId,
                now()
              )
              .run();

            /*
             * Automatically download images/videos
             * received through WhatsApp into R2.
             */
            if (mediaId) {

              mediaResult =
                await downloadWhatsAppMedia(
                  env,
                  mediaId,
                  "whatsapp",
                  messageDbId
                );

              if (mediaResult) {

                await env.DB.prepare(`
                  UPDATE whatsapp_messages
                  SET
                    media_key = ?,
                    media_url = ?
                  WHERE id = ?
                `)
                  .bind(
                    mediaResult.key,
                    mediaResult.url,
                    messageDbId
                  )
                  .run();
              }
            }
          }
        }
      }

    } catch (error) {

      /*
       * Webhook remains acknowledged even if processing
       * one message fails. This prevents repeated webhook
       * delivery storms.
       */
      console.error(
        "WhatsApp processing error:",
        error?.message
      );
    }

    return json({
      ok: true,
      received: true
    });
  }

  /*
   * Customer sends WhatsApp message.
   */
  if (
    url.pathname === "/api/whatsapp/send" &&
    request.method === "POST"
  ) {

    const auth =
      await requireCustomer(
        request,
        env
      );

    if (auth.error) return auth.error;

    const body =
      await readJson(request);

    const result =
      await whatsappSendText(
        env,
        clean(body.to),
        clean(body.message)
      );

    return json(result);
  }

  return null;
}

/* ============================================================
   CIVIC REPORTS
   ============================================================ */

function reportNumber() {
  return (
    "SBS-AX-" +
    Date.now()
      .toString()
      .slice(-8)
  );
}

function categoryFromText(value) {

  const textValue =
    clean(value)
      .toLowerCase();

  if (
    /electric|power|electricity|loadshedding/
      .test(textValue)
  ) {
    return "Electricity";
  }

  if (
    /water|drain|sewer|leak/
      .test(textValue)
  ) {
    return "Water";
  }

  if (
    /road|pothole|storm|street/
      .test(textValue)
  ) {
    return "Roads";
  }

  if (
    /waste|dump|rubbish|garbage|illegal dumping/
      .test(textValue)
  ) {
    return "Waste";
  }

  if (
    /fire|burn/
      .test(textValue)
  ) {
    return "Fire";
  }

  if (
    /vandal|theft|stolen|toilet|sidewalk|building/
      .test(textValue)
  ) {
    return "General";
  }

  return "General";
}

async function reportRoutes(request, env, url) {

  if (
    url.pathname === "/api/reports" &&
    request.method === "POST"
  ) {

    const body =
      await readJson(request);

    const description =
      clean(body.description);

    const location =
      clean(body.location);

    if (!description) {
      return json({
        ok: false,
        error: "Description is required"
      }, 400);
    }

    const reportId =
      id("report");

    const number =
      reportNumber();

    const category =
      clean(
        body.category ||
        categoryFromText(description)
      );

    const priority =
      clean(
        body.priority ||
        "Normal"
      );

    await env.DB.prepare(`
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?)
    `)
      .bind(
        reportId,
        body.account_id || null,
        number,
        category,
        description,
        location,
        priority,
        clean(body.source || "Web"),
        now(),
        now()
      )
      .run();

    return json({
      ok: true,
      report_id: reportId,
      report_number: number,
      category,
      status: "Open"
    }, 201);
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
      await env.DB.prepare(`
        SELECT *
        FROM reports
        WHERE report_number = ?
        LIMIT 1
      `)
        .bind(match[1])
        .first();

    if (!report) {
      return json({
        ok: false,
        error: "Report not found"
      }, 404);
    }

    const updates =
      await env.DB.prepare(`
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
      updates: updates.results
    });
  }

  return null;
}

/* ============================================================
   HEALTH / MODULES
   ============================================================ */

async function moduleRoutes(request, env, url) {

  if (
    url.pathname === "/api/modules" &&
    request.method === "GET"
  ) {

    const modules =
      await env.DB.prepare(`
        SELECT *
        FROM saas_modules
        WHERE active = 1
        ORDER BY module_name
      `).all();

    return json({
      ok: true,
      modules: modules.results
    });
  }

  return null;
}

async function healthRoute(request, env, url) {

  if (
    url.pathname === "/api/health" &&
    request.method === "GET"
  ) {

    return json({
      ok: true,
      service: APP,
      version: VERSION,
      status: "running",
      database: Boolean(env.DB),
      media_storage: Boolean(env.MEDIA),
      timestamp: now()
    });
  }

  return null;
}

/* ============================================================
   ROOT API ROUTER
   ============================================================ */

async function handleApi(request, env, url) {

  const routes = [
    healthRoute,
    authRoutes,
    customerDashboard,
    ownerDashboard,
    payfastRoutes,
    mediaRoutes,
    ecommerceRoutes,
    websiteRoutes,
    whatsappRoutes,
    reportRoutes,
    moduleRoutes
  ];

  for (const route of routes) {

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

  return json({
    ok: false,
    error: "API endpoint not found"
  }, 404);
}

/* ============================================================
   SIMPLE LANDING RESPONSE
   ============================================================ */

function landingPage() {

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport"
content="width=device-width,initial-scale=1">
<title>${APP}</title>

<style>
body{
  margin:0;
  font-family:Arial,Helvetica,sans-serif;
  background:#f4f8ff;
  color:#142033;
}

.hero{
  padding:70px 20px;
  text-align:center;
  background:#075bdb;
  color:white;
}

.hero h1{
  font-size:42px;
  margin:0 0 15px;
}

.hero p{
  font-size:18px;
  margin:0 auto;
  max-width:700px;
}

.grid{
  max-width:1100px;
  margin:40px auto;
  padding:0 20px;
  display:grid;
  grid-template-columns:
    repeat(auto-fit,minmax(220px,1fr));
  gap:20px;
}

.card{
  background:white;
  padding:25px;
  border-radius:15px;
  box-shadow:
    0 5px 20px rgba(0,0,0,.08);
}

.card h2{
  margin-top:0;
}

.footer{
  text-align:center;
  padding:30px;
  color:#667085;
}
</style>
</head>

<body>

<section class="hero">

<h1>${APP}</h1>

<p>
Smart technology, reliable business solutions.
Build your website, sell online, communicate through
WhatsApp and manage your digital services from one platform.
</p>

</section>

<section class="grid">

<div class="card">
<h2>E-Commerce</h2>
<p>
Products, pictures, videos, stock, orders and online sales.
</p>
</div>

<div class="card">
<h2>Website Builder</h2>
<p>
Create and publish your business website.
</p>
</div>

<div class="card">
<h2>WhatsApp</h2>
<p>
Connect WhatsApp Business and manage customer communication.
</p>
</div>

<div class="card">
<h2>SaaS Services</h2>
<p>
Subscribe to the services your business needs.
</p>
</div>

<div class="card">
<h2>PayFast</h2>
<p>
Secure online subscription and payment processing.
</p>
</div>

</section>

<div class="footer">
${APP} API v${VERSION}
</div>

</body>
</html>`;
}

/* ============================================================
   FETCH
   ============================================================ */

export default {

  async fetch(request, env) {

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    try {

      /*
       * Make sure the clean SaaS database structure exists.
       */
      await ensureSchema(env);

      const url =
        new URL(request.url);

      /*
       * API.
       */
      if (
        url.pathname.startsWith("/api/")
      ) {
        return await handleApi(
          request,
          env,
          url
        );
      }

      /*
       * R2 media.
       */
      if (
        url.pathname.startsWith("/media/")
      ) {
        return await mediaRoutes(
          request,
          env,
          url
        );
      }

      /*
       * Public customer websites.
       */
      if (
        url.pathname.startsWith("/site/")
      ) {
        return await websiteRoutes(
          request,
          env,
          url
        );
      }

      /*
       * Root.
       */
      return html(
        landingPage()
      );

    } catch (error) {

      console.error(
        "Worker error:",
        error?.stack || error
      );

      return json({
        ok: false,
        error: "Internal server error",
        message: error?.message || "Unknown error"
      }, 500);
    }
  }
};
