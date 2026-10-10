// ================================================================
// SKY BLUE DIGITAL SERVICE - CLOUDFLARE WORKER
// Version: 2026.10.10-D1-PAYFAST-AUTH-FIX
// ================================================================

const APP = "Sky Blue Digital Service";
const VERSION = "2026.10.10-D1-PAYFAST-AUTH-FIX";
const PREFIX = "SBS";

const MODULES = [
  "whatsapp","website","ecommerce","salon","food","pharmacy",
  "school","councillor","civic","npo","ngo","church","undertaker",
  "hosting","cyber","voice","directory","retail","cloud-pbx"
];

const CATALOG = {
  core: {
    code: "core",
    name: "WhatsApp + Website",
    price: 199,
    frequency: 3,
    modules: ["whatsapp", "website"]
  },
  number: {
    code: "number",
    name: "Business Number",
    price: 69,
    frequency: 3,
    modules: ["voice"]
  },
  ecommerce: {
    code: "ecommerce",
    name: "Ecommerce",
    price: 399,
    frequency: 3,
    modules: ["ecommerce"]
  },
  pbx: {
    code: "pbx",
    name: "Cloud PBX",
    price: 299,
    frequency: 3,
    modules: ["voice", "cloud-pbx"]
  }
};

const now = () => new Date().toISOString();

const clean = (v, max = 500) =>
  v === undefined || v === null ? "" : String(v).trim().slice(0, max);

const money = v => Number(v || 0).toFixed(2);

const esc = v =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const normalizePhone = v => {
  let p = String(v || "").replace(/\D/g, "");
  if (p.startsWith("0027")) p = "0" + p.slice(4);
  else if (p.startsWith("27")) p = "0" + p.slice(2);
  return p;
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "Content-Type,Authorization,X-Admin-Key",
      ...headers
    }
  });
}

function html(data, status = 200) {
  return new Response(data, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function bodyJSON(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function cookie(req, name) {
  for (const part of (req.headers.get("Cookie") || "").split(";")) {
    const p = part.trim();
    if (p.startsWith(name + "=")) {
      try {
        return decodeURIComponent(p.slice(name.length + 1));
      } catch {
        return p.slice(name.length + 1);
      }
    }
  }
  return "";
}

function setCookie(token) {
  return `sbs_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}

function clearCookie() {
  return "sbs_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

function baseUrl(req, env) {
  return clean(env.PUBLIC_URL || new URL(req.url).origin, 500).replace(/\/$/, "");
}

async function sha256(value) {
  const h = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(value))
  );
  return [...new Uint8Array(h)]
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");
}

async function randomToken() {
  return crypto.randomUUID() + "-" + crypto.randomUUID();
}

async function safeEqual(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));

  if (x.length !== y.length) return false;

  let n = 0;
  for (let i = 0; i < x.length; i++) n |= x[i] ^ y[i];

  return n === 0;
}

async function pbkdf2(password, salt, iterations = 100000) {
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
      salt: new TextEncoder().encode(salt),
      iterations: Number(iterations) || 100000,
      hash: "SHA-256"
    },
    key,
    256
  );

  return [...new Uint8Array(bits)]
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");
}

async function passwordMatches(password, account) {
  if (
    account.password_hash &&
    await safeEqual(await sha256(password), account.password_hash)
  ) {
    return { ok: true, legacy: false };
  }

  if (account.password_hash && account.password_salt) {
    const hash = await pbkdf2(
      password,
      account.password_salt,
      account.password_iterations || 100000
    );

    if (await safeEqual(hash, account.password_hash)) {
      return { ok: true, legacy: true };
    }
  }

  return { ok: false, legacy: false };
}

// ================================================================
// D1 SCHEMA HELPERS
// Existing tables are preserved.
// ================================================================

const colCache = new Map();

async function columns(db, table) {
  if (colCache.has(table)) return colCache.get(table);

  let rows = [];

  const first = await db.prepare(
    `PRAGMA table_info("${table.replace(/"/g, "")} ")`
  ).all().catch(() => null);

  rows = first?.results || [];

  if (!rows.length) {
    const second = await db.prepare(
      `PRAGMA table_info("${table.replace(/"/g, "")}")`
    ).all().catch(() => ({ results: [] }));

    rows = second.results || [];
  }

  const result = new Set(rows.map(x => x.name));
  colCache.set(table, result);

  return result;
}

async function tableExists(db, table) {
  const result = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).bind(table).first();

  return !!result;
}

async function insertAvailable(db, table, data) {
  const cols = await columns(db, table);

  const entries = Object.entries(data).filter(
    ([key, value]) => cols.has(key) && value !== undefined
  );

  if (!entries.length) {
    throw new Error(`No compatible columns for ${table}`);
  }

  const sql = `INSERT INTO "${table}" (${entries
    .map(([key]) => `"${key}"`)
    .join(",")}) VALUES (${entries.map(() => "?").join(",")})`;

  return db.prepare(sql).bind(
    ...entries.map(([, value]) => value)
  ).run();
}

async function updateAvailable(db, table, data, whereSql, whereArgs = []) {
  const cols = await columns(db, table);

  const entries = Object.entries(data).filter(
    ([key, value]) => cols.has(key) && value !== undefined
  );

  if (!entries.length) return null;

  const sql = `UPDATE "${table}" SET ${entries
    .map(([key]) => `"${key}"=?`)
    .join(",")} WHERE ${whereSql}`;

  return db.prepare(sql).bind(
    ...entries.map(([, value]) => value),
    ...whereArgs
  ).run();
}

async function ensureAuthSchema(db) {
  if (!(await tableExists(db, "customer_accounts"))) {
    await db.prepare(`
      CREATE TABLE customer_accounts (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        business_name TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        password_iterations INTEGER,
        status TEXT DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `).run();
  }

  if (!(await tableExists(db, "customer_sessions"))) {
    await db.prepare(`
      CREATE TABLE customer_sessions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `).run();
  }

  if (!(await tableExists(db, "password_reset_tokens"))) {
    await db.prepare(`
      CREATE TABLE password_reset_tokens (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL
      )
    `).run();
  }

  if (!(await tableExists(db, "business_profiles"))) {
    await db.prepare(`
      CREATE TABLE business_profiles (
        id TEXT PRIMARY KEY,
        account_id TEXT UNIQUE NOT NULL,
        business_name TEXT,
        industry TEXT,
        phone TEXT,
        whatsapp TEXT,
        email TEXT,
        address TEXT,
        website TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `).run();
  }

  if (!(await tableExists(db, "subscriptions"))) {
    await db.prepare(`
      CREATE TABLE subscriptions (
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
        updated_at TEXT NOT NULL,
        payfast_payment_id TEXT
      )
    `).run();
  }

  if (!(await tableExists(db, "saas_subscription_payments"))) {
    await db.prepare(`
      CREATE TABLE saas_subscription_payments (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        subscription_id TEXT NOT NULL,
        payment_reference TEXT UNIQUE NOT NULL,
        payfast_payment_id TEXT,
        amount REAL NOT NULL,
        status TEXT NOT NULL,
        raw_status TEXT,
        payment_data TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `).run();
  }

  if (!(await tableExists(db, "customer_modules"))) {
    await db.prepare(`
      CREATE TABLE customer_modules (
        account_id TEXT NOT NULL,
        module_code TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        activated_at TEXT,
        updated_at TEXT,
        UNIQUE(account_id, module_code)
      )
    `).run();
  }

  colCache.clear();
}

async function findAccountByEmail(db, email) {
  return db.prepare(
    "SELECT * FROM customer_accounts WHERE LOWER(email)=? LIMIT 1"
  ).bind(email).first();
}

async function accountFromSession(req, db) {
  const token = cookie(req, "sbs_session");
  if (!token) return null;

  const hash = await sha256(token);
  const sessionColumns = await columns(db, "customer_sessions");
  const tokenColumn = sessionColumns.has("token_hash")
    ? "token_hash"
    : sessionColumns.has("token")
      ? "token"
      : null;

  if (!tokenColumn) return null;

  const accountColumns = await columns(db, "customer_accounts");
  const statusFilter = accountColumns.has("status")
    ? " AND (a.status='ACTIVE' OR a.status='active')"
    : "";

  try {
    return await db.prepare(`
      SELECT a.*
      FROM customer_accounts a
      JOIN customer_sessions s
        ON CAST(s.account_id AS TEXT)=CAST(a.id AS TEXT)
      WHERE s."${tokenColumn}"=?
        AND s.expires_at>?
        ${statusFilter}
      LIMIT 1
    `).bind(tokenColumn === "token_hash" ? hash : token, now()).first();
  } catch (error) {
    console.error("Session lookup", error.message);
    return null;
  }
}

async function createSession(db, accountId, token) {
  await insertAvailable(db, "customer_sessions", {
    id: crypto.randomUUID(),
    account_id: String(accountId),
    token_hash: await sha256(token),
    token,
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    created_at: now()
  });
}

// ================================================================
// CUSTOMER REGISTRATION, LOGIN AND PASSWORD RESET
// ================================================================

async function register(req, db) {
  const data = await bodyJSON(req);

  const email = clean(data.email, 200).toLowerCase();
  const password = String(data.password || "");
  const business = clean(data.business_name || data.businessName, 200);
  const full = clean(
    data.full_name || data.fullName || data.owner_name,
    200
  );
  const phone = clean(data.phone, 50);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: "A valid business email is required." }, 400);
  }

  if (password.length < 8) {
    return json({
      ok: false,
      error: "Password must contain at least 8 characters."
    }, 400);
  }

  if (!business || !full || !phone) {
    return json({
      ok: false,
      error: "Business name, full name and phone number are required."
    }, 400);
  }

  const existing = await findAccountByEmail(db, email);

  if (existing) {
    return json({
      ok: false,
      error: "An account with this email already exists. Please sign in or use Forgot Password."
    }, 409);
  }

  const timestamp = now();
  const salt = await randomToken();
  const hash = await pbkdf2(password, salt, 100000);
  const id = crypto.randomUUID();

  try {
    const accountColumns = await columns(db, "customer_accounts");

    const accountData = {
      id,
      tenant_id: "1",
      business_name: business,
      full_name: full,
      email,
      phone,
      password_hash: hash,
      password_salt: salt,
      password_iterations: 100000,
      status: "ACTIVE",
      created_at: timestamp,
      updated_at: timestamp
    };

    if (accountColumns.has("id")) {
      const info = await db.prepare(
        "PRAGMA table_info(customer_accounts)"
      ).all();

      const idColumn = (info.results || []).find(x => x.name === "id");

      if (idColumn?.type && /INT/i.test(idColumn.type) && idColumn.pk) {
        delete accountData.id;
      }
    }

    await insertAvailable(db, "customer_accounts", accountData);

    const account = await findAccountByEmail(db, email);

    if (!account) {
      throw new Error("Account insert did not return a record.");
    }

    const profileData = {
      id: crypto.randomUUID(),
      account_id: String(account.id),
      business_name: business,
      owner_name: full,
      full_name: full,
      industry: clean(data.industry, 100),
      phone,
      whatsapp: clean(data.whatsapp || phone, 50),
      email,
      address: clean(data.address, 500),
      website: clean(data.website, 500),
      created_at: timestamp,
      updated_at: timestamp
    };

    const profile = await db.prepare(`
      SELECT account_id FROM business_profiles
      WHERE CAST(account_id AS TEXT)=?
      LIMIT 1
    `).bind(String(account.id)).first();

    if (!profile) {
      await insertAvailable(db, "business_profiles", profileData);
    }

    return json({
      ok: true,
      account_id: account.id,
      message: "Account created successfully. Please sign in."
    });
  } catch (error) {
    console.error("REGISTER", error.message);
    return json({
      ok: false,
      error: "Account creation failed. Check the Worker logs for the database schema error."
    }, 500);
  }
}

async function login(req, db) {
  const data = await bodyJSON(req);
  const email = clean(data.email, 200).toLowerCase();
  const password = String(data.password || "");

  if (!email || !password) {
    return json({ ok: false, error: "Email and password are required." }, 400);
  }

  let account;

  try {
    account = await findAccountByEmail(db, email);
  } catch (error) {
    console.error("LOGIN QUERY", error.message);
    return json({ ok: false, error: "Login database error." }, 500);
  }

  if (
    !account ||
    String(account.status || "ACTIVE").toUpperCase() !== "ACTIVE"
  ) {
    return json({
      ok: false,
      error: "Email or password not recognized. If this is an older account, use Forgot Password."
    }, 401);
  }

  const matched = await passwordMatches(password, account);

  if (!matched.ok) {
    return json({
      ok: false,
      error: "Email or password not recognized. If this is an older account, use Forgot Password."
    }, 401);
  }

  if (matched.legacy) {
    const salt = await randomToken();

    await updateAvailable(
      db,
      "customer_accounts",
      {
        password_hash: await pbkdf2(password, salt, 100000),
        password_salt: salt,
        password_iterations: 100000,
        updated_at: now()
      },
      "id=?",
      [account.id]
    ).catch(() => {});
  }

  const token = await randomToken();

  try {
    await db.prepare(`
      DELETE FROM customer_sessions
      WHERE CAST(account_id AS TEXT)=?
    `).bind(String(account.id)).run();

    await createSession(db, account.id, token);
  } catch (error) {
    console.error("SESSION CREATE", error.message);
    return json({
      ok: false,
      error: "Unable to create login session. Check customer_sessions schema."
    }, 500);
  }

  let profile = null;

  try {
    profile = await db.prepare(`
      SELECT * FROM business_profiles
      WHERE CAST(account_id AS TEXT)=?
      LIMIT 1
    `).bind(String(account.id)).first();
  } catch {}

  return json({
    ok: true,
    authenticated: true,
    message: "Login successful.",
    account: {
      id: account.id,
      email: account.email,
      status: account.status || "ACTIVE"
    },
    profile
  }, 200, { "Set-Cookie": setCookie(token) });
}

async function logout(req, db) {
  const token = cookie(req, "sbs_session");

  if (token) {
    const cols = await columns(db, "customer_sessions");
    const col = cols.has("token_hash")
      ? "token_hash"
      : cols.has("token")
        ? "token"
        : null;

    if (col) {
      await db.prepare(
        `DELETE FROM customer_sessions WHERE "${col}"=?`
      ).bind(col === "token_hash" ? await sha256(token) : token)
        .run().catch(() => {});
    }
  }

  return json(
    { ok: true, message: "Logged out successfully." },
    200,
    { "Set-Cookie": clearCookie() }
  );
}

async function forgotPassword(req, db, env) {
  const data = await bodyJSON(req);
  const email = clean(data.email, 200).toLowerCase();
  const phone = normalizePhone(data.phone);

  if (!email || !phone) {
    return json({
      ok: false,
      error: "Email and phone number are required."
    }, 400);
  }

  const account = await findAccountByEmail(db, email);

  if (!account) {
    return json({
      ok: true,
      message: "If the account details match, a reset link will be generated."
    });
  }

  let profile = null;

  try {
    profile = await db.prepare(`
      SELECT phone FROM business_profiles
      WHERE CAST(account_id AS TEXT)=?
      LIMIT 1
    `).bind(String(account.id)).first();
  } catch {}

  const storedPhone = normalizePhone(profile?.phone || account.phone);

  if (!storedPhone || storedPhone !== phone) {
    return json({
      ok: false,
      error: "The email address and phone number do not match an active account."
    }, 404);
  }

  const token = await randomToken();
  const hash = await sha256(token);
  const expiry = new Date(Date.now() + 15 * 60000).toISOString();

  await db.prepare(`
    DELETE FROM password_reset_tokens
    WHERE CAST(account_id AS TEXT)=?
  `).bind(String(account.id)).run().catch(() => {});

  await insertAvailable(db, "password_reset_tokens", {
    id: crypto.randomUUID(),
    account_id: String(account.id),
    token_hash: hash,
    expires_at: expiry,
    used_at: null,
    created_at: now()
  });

  const resetUrl =
    baseUrl(req, env) +
    "/reset-password.html?token=" +
    encodeURIComponent(token);

  const response = {
    ok: true,
    message: "Password reset link generated. Configure an email provider before exposing reset links publicly.",
    expires_at: expiry
  };

  if (String(env.RETURN_RESET_TOKEN || "").toLowerCase() === "true") {
    response.reset_url = resetUrl;
  }

  return json(response);
}

async function resetPassword(req, db) {
  const data = await bodyJSON(req);
  const token = clean(data.token, 500);
  const password = String(data.password || data.new_password || "");

  if (!token) {
    return json({ ok: false, error: "Reset token is required." }, 400);
  }

  if (password.length < 8) {
    return json({
      ok: false,
      error: "Password must contain at least 8 characters."
    }, 400);
  }

  const row = await db.prepare(`
    SELECT * FROM password_reset_tokens
    WHERE token_hash=?
      AND used_at IS NULL
      AND expires_at>?
    LIMIT 1
  `).bind(await sha256(token), now()).first();

  if (!row) {
    return json({
      ok: false,
      error: "This password reset link is invalid or expired."
    }, 400);
  }

  const salt = await randomToken();
  const hash = await pbkdf2(password, salt, 100000);

  await updateAvailable(
    db,
    "customer_accounts",
    {
      password_hash: hash,
      password_salt: salt,
      password_iterations: 100000,
      updated_at: now()
    },
    "id=?",
    [row.account_id]
  );

  await db.prepare(`
    UPDATE password_reset_tokens SET used_at=? WHERE id=?
  `).bind(now(), row.id).run();

  await db.prepare(`
    DELETE FROM customer_sessions
    WHERE CAST(account_id AS TEXT)=?
  `).bind(String(row.account_id)).run().catch(() => {});

  return json({
    ok: true,
    message: "Password changed successfully. Please sign in with your new password."
  });
}

// ================================================================
// PAYFAST
// ================================================================

function payfastHost(env) {
  return String(env.PAYFAST_SANDBOX || "").toLowerCase() === "true"
    ? "https://sandbox.payfast.co.za"
    : "https://www.payfast.co.za";
}

function md5(str) {
  const rot = [
    7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21
  ];

  const k = [];

  for (let i = 0; i < 64; i++) {
    k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
  }

  const bytes = Array.from(new TextEncoder().encode(str));
  const bitLen = bytes.length * 8;

  bytes.push(128);

  while (bytes.length % 64 !== 56) bytes.push(0);

  for (let i = 0; i < 8; i++) {
    bytes.push(i < 4 ? (bitLen >>> (8 * i)) & 255 : 0);
  }

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let off = 0; off < bytes.length; off += 64) {
    const m = [];

    for (let i = 0; i < 16; i++) {
      m[i] = (
        bytes[off + 4 * i] |
        (bytes[off + 4 * i + 1] << 8) |
        (bytes[off + 4 * i + 2] << 16) |
        (bytes[off + 4 * i + 3] << 24)
      ) >>> 0;
    }

    let a = a0, b = b0, c = c0, d = d0;

    for (let i = 0; i < 64; i++) {
      let f, g, s;

      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
        s = rot[i % 4];
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
        s = rot[4 + i % 4];
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
        s = rot[8 + i % 4];
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
        s = rot[12 + i % 4];
      }

      const sum = (a + f + k[i] + m[g]) >>> 0;
      const r = ((sum << s) | (sum >>> (32 - s))) >>> 0;

      a = d;
      d = c;
      c = b;
      b = (b + r) >>> 0;
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  return [a0, b0, c0, d0].map(n =>
    [0,8,16,24].map(s =>
      ((n >>> s) & 255).toString(16).padStart(2, "0")
    ).join("")
  ).join("");
}

function pfSignature(fields, passphrase = "") {
  const keys = Object.keys(fields)
    .filter(k =>
      k !== "signature" &&
      fields[k] !== undefined &&
      fields[k] !== null &&
      fields[k] !== ""
    )
    .sort();

  let query = keys.map(k =>
    `${k}=${encodeURIComponent(String(fields[k]).trim()).replace(/%20/g, "+")}`
  ).join("&");

  if (passphrase) {
    query += `&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, "+")}`;
  }

  return md5(query);
}

function pfFields(fields, env) {
  const result = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== "") {
      result[key] = String(value);
    }
  }

  result.signature = pfSignature(result, env.PAYFAST_PASSPHRASE || "");
  return result;
}

function pfForm(fields, env) {
  const action = payfastHost(env) + "/eng/process";

  const inputs = Object.entries(fields).map(([key, value]) =>
    `<input type="hidden" name="${esc(key)}" value="${esc(value)}">`
  ).join("");

  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sky Blue Digital Service payment</title>
</head>
<body style="font-family:Arial;background:#f3f7fb;display:grid;place-items:center;min-height:100vh">
<main style="background:white;padding:30px;border-radius:16px;text-align:center">
<h2>Sky Blue Digital Service</h2>
<p>Redirecting securely to PayFast…</p>
<form id="pf" method="post" action="${action}">
${inputs}
<noscript><button>Continue to PayFast</button></noscript>
</form>
</main>
<script>document.getElementById('pf').submit()</script>
</body>
</html>`;
}

async function checkout(req, db, env, account) {
  if (!account) {
    return json({ ok: false, error: "Authentication required." }, 401);
  }

  if (!env.PAYFAST_MERCHANT_ID || !env.PAYFAST_MERCHANT_KEY) {
    return json({
      ok: false,
      error: "PayFast merchant credentials are not configured in Worker secrets."
    }, 503);
  }

  const data = await bodyJSON(req);
  const code = clean(data.product_code || data.code, 50);
  const product = CATALOG[code];

  if (!product) {
    return json({ ok: false, error: "Invalid product." }, 400);
  }

  const amount = Number(product.price);
  const id = crypto.randomUUID();

  const reference =
    "SBS-" +
    String(account.id).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16) +
    "-" +
    id.replace(/-/g, "").slice(0, 16);

  const timestamp = now();

  try {
    await insertAvailable(db, "subscriptions", {
      id,
      account_id: String(account.id),
      module_id: product.modules.join(","),
      plan_name: product.name,
      amount,
      currency: "ZAR",
      status: "pending",
      created_at: timestamp,
      updated_at: timestamp
    });

    await insertAvailable(db, "saas_subscription_payments", {
      id: crypto.randomUUID(),
      account_id: String(account.id),
      subscription_id: id,
      payment_reference: reference,
      amount,
      status: "PENDING",
      created_at: timestamp,
      updated_at: timestamp
    });
  } catch (error) {
    console.error("CHECKOUT DB", error.message);
    return json({
      ok: false,
      error: "Could not create subscription checkout record."
    }, 500);
  }

  const origin = baseUrl(req, env);

  const fields = pfFields({
    merchant_id: env.PAYFAST_MERCHANT_ID,
    merchant_key: env.PAYFAST_MERCHANT_KEY,
    return_url: origin + "/payment-success.html",
    cancel_url: origin + "/payment-cancelled.html",
    notify_url: origin + "/api/payfast/itn",
    email_address: account.email,
    m_payment_id: reference,
    amount: amount.toFixed(2),
    item_name: product.name,
    item_description: `Sky Blue Digital Service - ${product.name}`
  }, env);

  return html(pfForm(fields, env));
}

async function payfastITN(req, db, env) {
  const raw = await req.text();
  const params = new URLSearchParams(raw);
  const data = {};

  for (const [key, value] of params.entries()) {
    data[key] = value;
  }

  if (!data.m_payment_id || !data.signature) {
    return json({
      ok: false,
      error: "Missing PayFast payment ID or signature."
    }, 400);
  }

  const expected = pfSignature(data, env.PAYFAST_PASSPHRASE || "");

  if (!(await safeEqual(
    String(data.signature).toLowerCase(),
    expected.toLowerCase()
  ))) {
    return json({ ok: false, error: "Invalid PayFast signature." }, 400);
  }

  if (String(data.merchant_id || "") !== String(env.PAYFAST_MERCHANT_ID || "")) {
    return json({ ok: false, error: "Merchant ID mismatch." }, 400);
  }

  let validation;

  try {
    const response = await fetch(
      payfastHost(env) + "/eng/query/validate",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body: raw
      }
    );

    validation = (await response.text()).trim();
  } catch (error) {
    console.error("PayFast validation request", error.message);
    return json({
      ok: false,
      error: "Could not validate notification with PayFast."
    }, 502);
  }

  if (validation !== "VALID") {
    return json({
      ok: false,
      error: "PayFast server validation failed."
    }, 400);
  }

  const reference = String(data.m_payment_id);

  const payment = await db.prepare(`
    SELECT * FROM saas_subscription_payments
    WHERE payment_reference=?
    LIMIT 1
  `).bind(reference).first();

  if (!payment) {
    return json({ ok: false, error: "Unknown payment reference." }, 404);
  }

  const paidAmount = Number(data.amount_gross || data.amount || 0);

  if (
    !Number.isFinite(paidAmount) ||
    Math.abs(paidAmount - Number(payment.amount)) > 0.01
  ) {
    return json({
      ok: false,
      error: "Payment amount does not match checkout."
    }, 400);
  }

  const status = String(data.payment_status || "").toUpperCase();
  const paymentId = clean(data.pf_payment_id || "", 200);

  if (status !== "COMPLETE") {
    await updateAvailable(
      db,
      "saas_subscription_payments",
      {
        status,
        raw_status: status,
        payfast_payment_id: paymentId,
        payment_data: JSON.stringify(data),
        updated_at: now()
      },
      "payment_reference=?",
      [reference]
    );

    return json({
      ok: true,
      status,
      message: "Payment notification recorded; subscription not activated."
    });
  }

  try {
    await updateAvailable(
      db,
      "saas_subscription_payments",
      {
        status: "COMPLETE",
        raw_status: status,
        payfast_payment_id: paymentId,
        payment_data: JSON.stringify(data),
        updated_at: now()
      },
      "payment_reference=?",
      [reference]
    );

    await updateAvailable(
      db,
      "subscriptions",
      {
        status: "active",
        payfast_payment_id: paymentId,
        started_at: now(),
        updated_at: now(),
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString()
      },
      "id=? AND account_id=?",
      [payment.subscription_id, String(payment.account_id)]
    );

    const subscription = await db.prepare(`
      SELECT module_id FROM subscriptions WHERE id=?
    `).bind(payment.subscription_id).first();

    for (const module of String(subscription?.module_id || "").split(",").filter(Boolean)) {
      await db.prepare(`
        INSERT INTO customer_modules
          (account_id,module_code,status,activated_at,updated_at)
        VALUES (?,?,'active',?,?)
        ON CONFLICT(account_id,module_code)
        DO UPDATE SET
          status='active',
          activated_at=excluded.activated_at,
          updated_at=excluded.updated_at
      `).bind(
        String(payment.account_id),
        module,
        now(),
        now()
      ).run().catch(error => console.error("Module activation", error.message));
    }
  } catch (error) {
    console.error("PAYFAST ITN DB", error.message);
    return json({
      ok: false,
      error: "Payment was validated but database activation failed; retry notification."
    }, 500);
  }

  return json({
    ok: true,
    status: "COMPLETE",
    payment_id: paymentId
  });
}

// ================================================================
// CUSTOMER DASHBOARD AND BUSINESS FEATURES
// ================================================================

async function customerDashboard(db, account) {
  const profile = await db.prepare(`
    SELECT * FROM business_profiles
    WHERE CAST(account_id AS TEXT)=?
    LIMIT 1
  `).bind(String(account.id)).first().catch(() => null);

  const subscriptions = await db.prepare(`
    SELECT * FROM subscriptions
    WHERE CAST(account_id AS TEXT)=?
    ORDER BY created_at DESC LIMIT 100
  `).bind(String(account.id)).all().catch(() => ({ results: [] }));

  const payments = await db.prepare(`
    SELECT * FROM saas_subscription_payments
    WHERE CAST(account_id AS TEXT)=?
    ORDER BY created_at DESC LIMIT 50
  `).bind(String(account.id)).all().catch(() => ({ results: [] }));

  const modules = await db.prepare(`
    SELECT * FROM customer_modules
    WHERE CAST(account_id AS TEXT)=?
  `).bind(String(account.id)).all().catch(() => ({ results: [] }));

  const products = await db.prepare(`
    SELECT * FROM products
    WHERE CAST(account_id AS TEXT)=?
    ORDER BY created_at DESC LIMIT 100
  `).bind(String(account.id)).all().catch(() => ({ results: [] }));

  const store = await db.prepare(`
    SELECT * FROM ecommerce_stores
    WHERE CAST(account_id AS TEXT)=?
    LIMIT 1
  `).bind(String(account.id)).first().catch(() => null);

  const orders = await db.prepare(`
    SELECT * FROM ecommerce_orders
    WHERE CAST(account_id AS TEXT)=?
    ORDER BY created_at DESC LIMIT 100
  `).bind(String(account.id)).all().catch(() => ({ results: [] }));

  return {
    account: {
      id: account.id,
      email: account.email,
      status: account.status || "ACTIVE"
    },
    profile,
    subscriptions: subscriptions.results || [],
    payments: payments.results || [],
    modules: modules.results || [],
    products: products.results || [],
    store,
    orders: orders.results || []
  };
}

async function saveProfile(req, db, account) {
  const data = await bodyJSON(req);
  const timestamp = now();

  const profileData = {
    business_name: clean(data.business_name || data.businessName, 200),
    owner_name: clean(data.owner_name || data.full_name || data.fullName, 200),
    full_name: clean(data.owner_name || data.full_name || data.fullName, 200),
    industry: clean(data.industry, 100),
    phone: clean(data.phone, 50),
    whatsapp: clean(data.whatsapp, 50),
    email: account.email,
    address: clean(data.address, 500),
    website: clean(data.website, 500),
    updated_at: timestamp
  };

  const existing = await db.prepare(`
    SELECT account_id FROM business_profiles
    WHERE CAST(account_id AS TEXT)=?
  `).bind(String(account.id)).first().catch(() => null);

  if (existing) {
    await updateAvailable(
      db,
      "business_profiles",
      profileData,
      "CAST(account_id AS TEXT)=?",
      [String(account.id)]
    );
  } else {
    await insertAvailable(db, "business_profiles", {
      id: crypto.randomUUID(),
      account_id: String(account.id),
      ...profileData,
      created_at: timestamp
    });
  }

  return json({ ok: true, message: "Business profile saved." });
}

async function productsRoute(req, db, account) {
  if (req.method === "GET") {
    const result = await db.prepare(`
      SELECT * FROM products
      WHERE CAST(account_id AS TEXT)=?
      ORDER BY created_at DESC LIMIT 200
    `).bind(String(account.id)).all();

    return json({ ok: true, products: result.results || [] });
  }

  const data = await bodyJSON(req);
  const name = clean(data.name, 200);
  const price = Number(data.price || 0);
  const stock = Number(data.stock || 0);

  if (
    !name ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isFinite(stock) ||
    stock < 0
  ) {
    return json({
      ok: false,
      error: "Valid product name, price and stock are required."
    }, 400);
  }

  const timestamp = now();
  const id = crypto.randomUUID();

  try {
    await insertAvailable(db, "products", {
      id,
      account_id: String(account.id),
      name,
      description: clean(data.description, 1000),
      price,
      stock,
      category: clean(data.category, 100),
      sku: clean(data.sku, 100),
      image_url: clean(data.image_url || data.imageUrl, 1000),
      video_url: clean(data.video_url || data.videoUrl, 1000),
      active: 1,
      status: "ACTIVE",
      created_at: timestamp,
      updated_at: timestamp
    });

    return json({ ok: true, product_id: id, message: "Product saved." });
  } catch (error) {
    console.error("PRODUCT", error.message);
    return json({ ok: false, error: "Could not save product." }, 500);
  }
}

async function storeRoute(req, db, account) {
  if (req.method === "GET") {
    const store = await db.prepare(`
      SELECT * FROM ecommerce_stores
      WHERE CAST(account_id AS TEXT)=?
      LIMIT 1
    `).bind(String(account.id)).first();

    return json({ ok: true, store: store || null });
  }

  const data = await bodyJSON(req);
  const name = clean(data.store_name || data.name || data.business_name, 200);

  if (!name) {
    return json({ ok: false, error: "Store name is required." }, 400);
  }

  const slug = clean(
    data.slug ||
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    100
  );

  const timestamp = now();

  const storeData = {
    store_name: name,
    slug,
    description: clean(data.description, 1000),
    logo_url: clean(data.logo_url, 1000),
    primary_color: clean(data.primary_color, 50) || "#0b63ce",
    secondary_color: clean(data.secondary_color, 50) || "#083b78",
    email: account.email,
    updated_at: timestamp
  };

  const existing = await db.prepare(`
    SELECT account_id FROM ecommerce_stores
    WHERE CAST(account_id AS TEXT)=?
  `).bind(String(account.id)).first().catch(() => null);

  try {
    if (existing) {
      await updateAvailable(
        db,
        "ecommerce_stores",
        storeData,
        "CAST(account_id AS TEXT)=?",
        [String(account.id)]
      );
    } else {
      await insertAvailable(db, "ecommerce_stores", {
        id: crypto.randomUUID(),
        account_id: String(account.id),
        ...storeData,
        currency: "ZAR",
        status: "ACTIVE",
        published: 0,
        checkout_enabled: 1,
        delivery_enabled: 1,
        pickup_enabled: 1,
        created_at: timestamp
      });
    }

    return json({ ok: true, message: "Online store saved.", slug });
  } catch (error) {
    console.error("STORE", error.message);
    return json({
      ok: false,
      error: "Could not save store. The slug may already be in use."
    }, 500);
  }
}

async function ordersRoute(req, db, account) {
  if (req.method === "GET") {
    const result = await db.prepare(`
      SELECT * FROM ecommerce_orders
      WHERE CAST(account_id AS TEXT)=?
      ORDER BY created_at DESC LIMIT 200
    `).bind(String(account.id)).all();

    return json({ ok: true, orders: result.results || [] });
  }

  const data = await bodyJSON(req);
  const items = Array.isArray(data.items) ? data.items : [];
  const subtotal = Number(data.subtotal || data.total || 0);
  const delivery = Number(data.delivery_fee || 0);
  const total = Number(data.total ?? subtotal + delivery);

  if (!Number.isFinite(total) || total < 0) {
    return json({ ok: false, error: "Invalid order total." }, 400);
  }

  const orderNumber =
    "SBS-ORD-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);

  const timestamp = now();

  try {
    await insertAvailable(db, "ecommerce_orders", {
      id: crypto.randomUUID(),
      account_id: String(account.id),
      order_number: orderNumber,
      customer_name: clean(data.customer_name, 200),
      customer_email: clean(data.customer_email, 200),
      customer_phone: clean(data.customer_phone, 50),
      delivery_method: clean(data.delivery_method, 50),
      delivery_address: clean(data.delivery_address || data.address, 1000),
      subtotal,
      delivery_fee: delivery,
      total_amount: total,
      total,
      notes: JSON.stringify(items),
      payment_status: "PENDING",
      payment_status_text: "PENDING",
      payment_method: clean(data.payment_method, 50),
      payment_provider: clean(data.payment_provider, 50),
      order_status: "NEW",
      source: "website",
      created_at: timestamp,
      updated_at: timestamp
    });

    return json({ ok: true, order_number: orderNumber });
  } catch (error) {
    console.error("ORDER", error.message);
    return json({ ok: false, error: "Could not create order." }, 500);
  }
}

async function publicStore(db, slug) {
  const store = await db.prepare(`
    SELECT * FROM ecommerce_stores
    WHERE slug=? AND (status='ACTIVE' OR status='active')
    LIMIT 1
  `).bind(slug).first();

  if (!store) {
    return html("<!doctype html><title>Store not found</title><h1>Store not found</h1>", 404);
  }

  const result = await db.prepare(`
    SELECT * FROM products
    WHERE CAST(account_id AS TEXT)=?
      AND (active=1 OR status='ACTIVE' OR status='active')
    ORDER BY created_at DESC
  `).bind(String(store.account_id)).all().catch(() => ({ results: [] }));

  const cards = (result.results || []).map(product =>
    `<article class="product">
      ${product.image_url ? `<img src="${esc(product.image_url)}" alt="">` : ""}
      <h3>${esc(product.name)}</h3>
      <p>${esc(product.description || "")}</p>
      <strong>R ${money(product.price)}</strong>
    </article>`
  ).join("");

  return html(`<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(store.store_name)}</title>
<style>
body{margin:0;font-family:Arial;background:#f5f8fc;color:#172033}
header{background:${esc(store.primary_color || "#0b63ce")};color:white;padding:30px}
main{max-width:1100px;margin:auto;padding:25px 18px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px}
.product{background:white;border-radius:16px;padding:18px;box-shadow:0 4px 18px #0001}
.product img{width:100%;height:180px;object-fit:cover;border-radius:12px}
</style>
</head>
<body>
<header><h1>${esc(store.store_name)}</h1><p>${esc(store.description || "")}</p></header>
<main><h2>Products</h2><div class="grid">${cards || "<p>No products available yet.</p>"}</div></main>
</body>
</html>`);
}

async function createReport(req, db, account) {
  const data = await bodyJSON(req);
  const timestamp = now();
  const number = PREFIX + "-AX-" + Date.now();

  try {
    await insertAvailable(db, "reports", {
      id: crypto.randomUUID(),
      report_number: number,
      account_id: account?.id ? String(account.id) : null,
      category: clean(data.category, 100),
      description: clean(data.description, 2000),
      location: clean(data.location, 500),
      priority: clean(data.priority, 50) || "Normal",
      source: clean(data.source, 50) || "Web",
      status: "OPEN",
      created_at: timestamp,
      updated_at: timestamp
    });

    return json({
      ok: true,
      report_number: number,
      message: "Report submitted successfully."
    });
  } catch (error) {
    console.error("REPORT", error.message);
    return json({ ok: false, error: "Could not submit report." }, 500);
  }
}

async function whatsappWebhook(req, db, env) {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (
      mode === "subscribe" &&
      token &&
      token === env.WHATSAPP_VERIFY_TOKEN
    ) {
      return new Response(challenge || "", {
        status: 200,
        headers: { "content-type": "text/plain" }
      });
    }

    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405);
  }

  const payload = await bodyJSON(req);

  try {
    if (await tableExists(db, "whatsapp_conversations")) {
      await insertAvailable(db, "whatsapp_conversations", {
        id: crypto.randomUUID(),
        organisation_id: "1",
        phone: "",
        direction: "INBOUND",
        message_type: "webhook",
        message_text: "",
        media_url: "",
        payload: JSON.stringify(payload),
        created_at: now()
      });
    }
  } catch (error) {
    console.error("WhatsApp log", error.message);
  }

  return json({ ok: true });
}

function adminAuthorized(req, env) {
  const key = clean(env.ADMIN_KEY, 500);
  if (!key) return false;

  const supplied =
    req.headers.get("X-Admin-Key") ||
    (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");

  return supplied === key;
}

async function adminDashboard(db) {
  const count = async sql =>
    Number((await db.prepare(sql).first())?.total || 0);

  const customers = await count(
    "SELECT COUNT(*) AS total FROM customer_accounts"
  );

  const active = await count(
    "SELECT COUNT(*) AS total FROM subscriptions WHERE lower(status)='active'"
  );

  const orders = await count(
    "SELECT COUNT(*) AS total FROM ecommerce_orders"
  );

  const revenue = await db.prepare(`
    SELECT COALESCE(SUM(amount),0) AS total
    FROM saas_subscription_payments WHERE status='COMPLETE'
  `).first().catch(() => ({ total: 0 }));

  const list = await db.prepare(`
    SELECT
      a.id,a.email,a.status,a.created_at,a.business_name,a.full_name,
      p.business_name AS profile_business_name,p.phone,p.whatsapp
    FROM customer_accounts a
    LEFT JOIN business_profiles p
      ON CAST(p.account_id AS TEXT)=CAST(a.id AS TEXT)
    ORDER BY a.created_at DESC LIMIT 200
  `).all();

  return json({
    ok: true,
    stats: {
      customers,
      active_subscriptions: active,
      revenue: Number(revenue?.total || 0),
      orders
    },
    customers: list.results || []
  });
}

async function serveStatic(req, env) {
  if (!env.ASSETS) return null;

  const url = new URL(req.url);

  if (url.pathname === "/owner-dashboard.html") {
    const adminUrl = new URL(req.url);
    adminUrl.pathname = "/skyblue-admin.html";

    const adminResponse = await env.ASSETS.fetch(
      new Request(adminUrl.toString(), req)
    );

    if (adminResponse.status !== 404) return adminResponse;
  }

  const response = await env.ASSETS.fetch(req);
  return response.status === 404 ? null : response;
}

// ================================================================
// REGISTRATION AND LOGIN WEB PAGES
// ================================================================

function authPage(kind) {
  const isRegister = kind === "register";

  const title = isRegister
    ? "Create your business account"
    : "Sign in to your account";

  const fields = isRegister
    ? `<label>Business name
         <input name="business_name" required autocomplete="organization">
       </label>
       <label>Full name
         <input name="full_name" required autocomplete="name">
       </label>
       <label>Phone number
         <input name="phone" required autocomplete="tel" inputmode="tel">
       </label>
       <label>Email address
         <input name="email" type="email" required autocomplete="email">
       </label>
       <label>Password (at least 8 characters)
         <input name="password" type="password" minlength="8" required autocomplete="new-password">
       </label>`
    : `<label>Email address
         <input name="email" type="email" required autocomplete="email">
       </label>
       <label>Password
         <input name="password" type="password" required autocomplete="current-password">
       </label>`;

  const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
  const next = isRegister ? "/login" : "/api/customer/dashboard";

  const link = isRegister
    ? `Already have an account? <a href="/login">Sign in</a>`
    : `New to Sky Blue Digital Service? <a href="/register">Create an account</a>`;

  return html(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | ${APP}</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#eef4fb;color:#14213d;font-family:Arial,sans-serif}
.wrap{max-width:480px;margin:5vh auto;padding:18px}
.brand{font-weight:800;color:#0866c6;font-size:22px;text-align:center;margin:16px 0}
.card{background:#fff;border-radius:18px;padding:24px;box-shadow:0 8px 30px #17365d14}
h1{font-size:25px;margin:0 0 8px}
p{color:#5b6474;line-height:1.5}
label{display:block;font-size:14px;font-weight:700;margin:15px 0}
input{display:block;width:100%;padding:13px;margin-top:7px;border:1px solid #cbd5e1;border-radius:9px;font-size:16px}
button{width:100%;padding:14px;border:0;border-radius:9px;background:#0866c6;color:white;font-size:16px;font-weight:700;margin-top:8px}
#msg{padding:10px;border-radius:8px;white-space:pre-wrap}
a{color:#0866c6}
.small{font-size:13px;text-align:center}
</style>
</head>
<body>
<div class="wrap">
  <div class="brand">SKY BLUE SOLUTION</div>
  <div class="card">
    <h1>${title}</h1>
    <p>Manage your business services in one place.</p>
    <form id="auth">${fields}<button type="submit">${isRegister ? "Create account" : "Sign in"}</button></form>
    <div id="msg" role="status"></div>
    <p class="small">${link}</p>
    ${isRegister ? "" : '<p class="small"><a href="/forgot-password">Forgot password?</a></p>'}
  </div>
</div>
<script>
const f=document.getElementById('auth');
const m=document.getElementById('msg');
f.addEventListener('submit',async e=>{
  e.preventDefault();
  m.textContent='Please wait…';
  const d=Object.fromEntries(new FormData(f).entries());
  try{
    const r=await fetch('${endpoint}',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'same-origin',
      body:JSON.stringify(d)
    });
    const j=await r.json();
    if(!r.ok||!j.ok){
      m.textContent=j.error||'Request failed. Please try again.';
      return;
    }
    m.textContent=j.message||'Success';
    setTimeout(()=>location.href='${next}',600);
  }catch(e){
    m.textContent='Could not connect. Please try again.';
  }
});
</script>
</body>
</html>`);
}

function catalogResponse() {
  return json({
    ok: true,
    app: APP,
    version: VERSION,
    products: Object.values(CATALOG),
    modules: MODULES
  });
}

function healthResponse() {
  return json({
    ok: true,
    status: "online",
    app: APP,
    version: VERSION,
    message: "Sky Blue Digital Service API is running."
  });
}

// ================================================================
// MAIN ROUTER
// ================================================================

async function router(req, env) {
  const db = env.DB;

  if (!db) {
    return json({
      ok: false,
      error: "D1 database binding DB is missing."
    }, 500);
  }

  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers": "Content-Type,Authorization,X-Admin-Key"
      }
    });
  }

  try {
    await ensureAuthSchema(db);
  } catch (error) {
    console.error("AUTH SCHEMA", error.message);
    return json({
      ok: false,
      error: "Database initialisation failed. Check D1 binding and schema."
    }, 500);
  }

  if (
    method === "POST" &&
    ["/api/auth/register", "/api/customer-auth/register", "/api/register"].includes(path)
  ) {
    return register(req, db);
  }

  if (
    method === "POST" &&
    ["/api/auth/login", "/api/customer-auth/login", "/api/login"].includes(path)
  ) {
    return login(req, db);
  }

  if (
    method === "POST" &&
    ["/api/auth/logout", "/api/customer-auth/logout", "/api/logout"].includes(path)
  ) {
    return logout(req, db);
  }

  if (
    method === "POST" &&
    ["/api/auth/forgot-password", "/api/customer-auth/forgot-password", "/api/forgot-password"].includes(path)
  ) {
    return forgotPassword(req, db, env);
  }

  if (
    method === "POST" &&
    ["/api/auth/reset-password", "/api/customer-auth/reset-password", "/api/reset-password"].includes(path)
  ) {
    return resetPassword(req, db);
  }

  if (
    method === "GET" &&
    ["/api/auth/me", "/api/customer-auth/me"].includes(path)
  ) {
    const account = await accountFromSession(req, db);

    if (!account) {
      return json({ ok: false, authenticated: false }, 401);
    }

    const profile = await db.prepare(`
      SELECT * FROM business_profiles
      WHERE CAST(account_id AS TEXT)=?
      LIMIT 1
    `).bind(String(account.id)).first().catch(() => null);

    return json({
      ok: true,
      authenticated: true,
      account: {
        id: account.id,
        email: account.email,
        status: account.status || "ACTIVE"
      },
      profile
    });
  }

  if (method === "GET" && !path.startsWith("/api/")) {
    const staticResponse = await serveStatic(req, env);
    if (staticResponse) return staticResponse;
  }

  if (method === "GET" && path === "/register") {
    return authPage("register");
  }

  if (method === "GET" && path === "/login") {
    return authPage("login");
  }

  if (method === "GET" && path === "/forgot-password") {
    return html(`<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Forgot password</title>
</head>
<body style="font-family:Arial;max-width:420px;margin:40px auto;padding:16px">
<h1>Forgot password</h1>
<p>Password reset currently requires the account email and phone number. An email delivery provider must be configured before reset links can be sent.</p>
<a href="/login">Back to sign in</a>
</body>
</html>`);
  }

  if (path === "/api/health" && method === "GET") {
    return healthResponse();
  }

  if (path === "/api/catalog" && method === "GET") {
    return catalogResponse();
  }

  if (path === "/api/modules" && method === "GET") {
    return json({ ok: true, modules: MODULES });
  }

  if (path === "/api/checkout/start" && method === "POST") {
    return checkout(req, db, env, await accountFromSession(req, db));
  }

  if (path === "/api/payfast/itn" && method === "POST") {
    return payfastITN(req, db, env);
  }

  if (path === "/api/customer/dashboard" && method === "GET") {
    const account = await accountFromSession(req, db);

    if (!account) {
      return json({ ok: false, error: "Authentication required." }, 401);
    }

    return json({
      ok: true,
      dashboard: await customerDashboard(db, account)
    });
  }

  if (path === "/api/business/profile" && method === "POST") {
    const account = await accountFromSession(req, db);

    if (!account) {
      return json({ ok: false, error: "Authentication required." }, 401);
    }

    return saveProfile(req, db, account);
  }

  if (path === "/api/products" && ["GET", "POST"].includes(method)) {
    const account = await accountFromSession(req, db);

    if (!account) {
      return json({ ok: false, error: "Authentication required." }, 401);
    }

    return productsRoute(req, db, account);
  }

  if (path === "/api/ecommerce/store" && ["GET", "POST"].includes(method)) {
    const account = await accountFromSession(req, db);

    if (!account) {
      return json({ ok: false, error: "Authentication required." }, 401);
    }

    return storeRoute(req, db, account);
  }

  if (path === "/api/ecommerce/orders" && ["GET", "POST"].includes(method)) {
    const account = await accountFromSession(req, db);

    if (!account) {
      return json({ ok: false, error: "Authentication required." }, 401);
    }

    return ordersRoute(req, db, account);
  }

  if (path === "/api/reports" && method === "POST") {
    return createReport(req, db, await accountFromSession(req, db));
  }

  if (path === "/api/whatsapp") {
    return whatsappWebhook(req, db, env);
  }

  if (path.startsWith("/api/admin/")) {
    if (!adminAuthorized(req, env)) {
      return json({ ok: false, error: "Unauthorized." }, 401);
    }

    if (path === "/api/admin/dashboard" && method === "GET") {
      return adminDashboard(db);
    }

    if (path === "/api/admin/customers" && method === "GET") {
      const result = await db.prepare(`
        SELECT
          a.id,a.email,a.status,a.created_at,a.business_name,a.full_name,
          p.business_name AS profile_business_name,p.phone,p.whatsapp
        FROM customer_accounts a
        LEFT JOIN business_profiles p
          ON CAST(p.account_id AS TEXT)=CAST(a.id AS TEXT)
        ORDER BY a.created_at DESC LIMIT 500
      `).all();

      return json({ ok: true, customers: result.results || [] });
    }
  }

  const storeMatch = path.match(/^\/store\/([^/]+)$/);

  if (storeMatch && method === "GET") {
    return publicStore(db, decodeURIComponent(storeMatch[1]));
  }

  return json({
    ok: false,
    error: "Endpoint not found.",
    path
  }, 404);
}

export default {
  async fetch(request, env) {
    try {
      return await router(request, env);
    } catch (error) {
      console.error("Sky Blue Worker Error", error?.stack || error);

      return json({
        ok: false,
        error: "Internal server error.",
        message: String(error?.message || error)
      }, 500);
    }
  }
};
