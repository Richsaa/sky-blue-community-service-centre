// ================================================================
// SKY BLUE SAAS SOLUTIONS - COMPLETE CLOUDFLARE WORKER
// Version: 2026.10.07
// ================================================================

const APP = "Sky Blue SaaS Solutions";
const VERSION = "2026.10.07";
const PREFIX = "SBS";

const MODULES = [
  "whatsapp",
  "website",
  "ecommerce",
  "salon",
  "food",
  "pharmacy",
  "school",
  "councillor",
  "civic",
  "npo",
  "ngo",
  "church",
  "undertaker",
  "hosting",
  "cyber",
  "voice",
  "directory",
  "retail",
  "cloud-pbx"
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

// ================================================================
// BASIC HELPERS
// ================================================================

function now() {
  return new Date().toISOString();
}

function id(prefix = "ID") {
  return `${prefix}-${crypto.randomUUID()}`;
}

function clean(value, max = 500) {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, max);
}

function money(value) {
  const n = Number(value || 0);
  return n.toFixed(2);
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization, X-Admin-Key",
      ...extra
    }
  });
}

function text(data, status = 200) {
  return new Response(data, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "access-control-allow-origin": "*"
    }
  });
}

function html(data, status = 200) {
  return new Response(data, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
}

async function bodyJSON(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function cookie(request, name) {
  const value = request.headers.get("Cookie") || "";
  const parts = value.split(";");

  for (const part of parts) {
    const p = part.trim();
    if (p.startsWith(`${name}=`)) {
      return decodeURIComponent(p.slice(name.length + 1));
    }
  }

  return "";
}

function sessionCookie(token) {
  return `sbs_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}

function clearSessionCookie() {
  return "sbs_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

function baseUrl(request, env) {
  return clean(env.PUBLIC_URL || new URL(request.url).origin, 500).replace(/\/$/, "");
}

async function sha256(value) {
  const data = new TextEncoder().encode(String(value));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)]
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");
}

// ================================================================
// MD5 - PAYFAST SIGNATURE SUPPORT
// ================================================================

function md5(string) {
  function rotateLeft(lValue, iShiftBits) {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  }

  function addUnsigned(lX, lY) {
    const lX4 = lX & 0x40000000;
    const lY4 = lY & 0x40000000;
    const lX8 = lX & 0x80000000;
    const lY8 = lY & 0x80000000;
    const lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff);

    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) {
      if (lResult & 0x40000000) {
        return lResult ^ 0xc0000000 ^ lX8 ^ lY8;
      }
      return lResult ^ 0x40000000 ^ lX8 ^ lY8;
    }

    return lResult ^ lX8 ^ lY8;
  }

  function F(x, y, z) {
    return (x & y) | (~x & z);
  }

  function G(x, y, z) {
    return (x & z) | (y & ~z);
  }

  function H(x, y, z) {
    return x ^ y ^ z;
  }

  function I(x, y, z) {
    return y ^ (x | ~z);
  }

  function FF(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function GG(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function HH(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function II(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function convertToWordArray(str) {
    const lWordCount = ((str.length + 8) >> 6) + 1;
    const lWordArray = new Array(lWordCount * 16).fill(0);
    let lByteCount = 0;

    while (lByteCount < str.length) {
      const lWordCountIndex = lByteCount >> 2;
      const lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCountIndex] |=
        str.charCodeAt(lByteCount) << lBytePosition;
      lByteCount++;
    }

    const lWordCountIndex = lByteCount >> 2;
    const lBytePosition = (lByteCount % 4) * 8;

    lWordArray[lWordCountIndex] |= 0x80 << lBytePosition;
    lWordArray[lWordArray.length - 2] = str.length << 3;
    lWordArray[lWordArray.length - 1] = str.length >>> 29;

    return lWordArray;
  }

  function wordToHex(lValue) {
    let wordToHexValue = "";
    for (let lCount = 0; lCount <= 3; lCount++) {
      const lByte = (lValue >>> (lCount * 8)) & 255;
      wordToHexValue += `0${lByte.toString(16)}`.slice(-2);
    }
    return wordToHexValue;
  }

  const x = convertToWordArray(unescape(encodeURIComponent(string)));

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  for (let k = 0; k < x.length; k += 16) {
    const AA = a;
    const BB = b;
    const CC = c;
    const DD = d;

    a = FF(a,b,c,d,x[k+0],7,0xd76aa478);
    d = FF(d,a,b,c,x[k+1],12,0xe8c7b756);
    c = FF(c,d,a,b,x[k+2],17,0x242070db);
    b = FF(b,c,d,a,x[k+3],22,0xc1bdceee);
    a = FF(a,b,c,d,x[k+4],7,0xf57c0faf);
    d = FF(d,a,b,c,x[k+5],12,0x4787c62a);
    c = FF(c,d,a,b,x[k+6],17,0xa8304613);
    b = FF(b,c,d,a,x[k+7],22,0xfd469501);
    a = FF(a,b,c,d,x[k+8],7,0x698098d8);
    d = FF(d,a,b,c,x[k+9],12,0x8b44f7af);
    c = FF(c,d,a,b,x[k+10],17,0xffff5bb1);
    b = FF(b,c,d,a,x[k+11],22,0x895cd7be);
    a = FF(a,b,c,d,x[k+12],7,0x6b901122);
    d = FF(d,a,b,c,x[k+13],12,0xfd987193);
    c = FF(c,d,a,b,x[k+14],17,0xa679438e);
    b = FF(b,c,d,a,x[k+15],22,0x49b40821);

    a = GG(a,b,c,d,x[k+1],5,0xf61e2562);
    d = GG(d,a,b,c,x[k+6],9,0xc040b340);
    c = GG(c,d,a,b,x[k+11],14,0x265e5a51);
    b = GG(b,c,d,a,x[k+0],20,0xe9b6c7aa);
    a = GG(a,b,c,d,x[k+5],5,0xd62f105d);
    d = GG(d,a,b,c,x[k+10],9,0x02441453);
    c = GG(c,d,a,b,x[k+15],14,0xd8a1e681);
    b = GG(b,c,d,a,x[k+4],20,0xe7d3fbc8);
    a = GG(a,b,c,d,x[k+9],5,0x21e1cde6);
    d = GG(d,a,b,c,x[k+14],9,0xc33707d6);
    c = GG(c,d,a,b,x[k+3],14,0xf4d50d87);
    b = GG(b,c,d,a,x[k+8],20,0x455a14ed);
    a = GG(a,b,c,d,x[k+13],5,0xa9e3e905);
    d = GG(d,a,b,c,x[k+2],9,0xfcefa3f8);
    c = GG(c,d,a,b,x[k+7],14,0x676f02d9);
    b = GG(b,c,d,a,x[k+12],20,0x8d2a4c8a);

    a = HH(a,b,c,d,x[k+5],4,0xfffa3942);
    d = HH(d,a,b,c,x[k+8],11,0x8771f681);
    c = HH(c,d,a,b,x[k+11],16,0x6d9d6122);
    b = HH(b,c,d,a,x[k+14],23,0xfde5380c);
    a = HH(a,b,c,d,x[k+1],4,0xa4beea44);
    d = HH(d,a,b,c,x[k+4],11,0x4bdecfa9);
    c = HH(c,d,a,b,x[k+7],16,0xf6bb4b60);
    b = HH(b,c,d,a,x[k+10],23,0xbebfbc70);
    a = HH(a,b,c,d,x[k+13],4,0x289b7ec6);
    d = HH(d,a,b,c,x[k+0],11,0xeaa127fa);
    c = HH(c,d,a,b,x[k+3],16,0xd4ef3085);
    b = HH(b,c,d,a,x[k+6],23,0x04881d05);
    a = HH(a,b,c,d,x[k+9],4,0xd9d4d039);
    d = HH(d,a,b,c,x[k+12],11,0xe6db99e5);
    c = HH(c,d,a,b,x[k+15],16,0x1fa27cf8);
    b = HH(b,c,d,a,x[k+2],23,0xc4ac5665);

    a = II(a,b,c,d,x[k+0],6,0xf4292244);
    d = II(d,a,b,c,x[k+7],10,0x432aff97);
    c = II(c,d,a,b,x[k+14],15,0xab9423a7);
    b = II(b,c,d,a,x[k+5],21,0xfc93a039);
    a = II(a,b,c,d,x[k+12],6,0x655b59c3);
    d = II(d,a,b,c,x[k+3],10,0x8f0ccc92);
    c = II(c,d,a,b,x[k+10],15,0xffeff47d);
    b = II(b,c,d,a,x[k+1],21,0x85845dd1);
    a = II(a,b,c,d,x[k+8],6,0x6fa87e4f);
    d = II(d,a,b,c,x[k+15],10,0xfe2ce6e0);
    c = II(c,d,a,b,x[k+6],15,0xa3014314);
    b = II(b,c,d,a,x[k+13],21,0x4e0811a1);
    a = II(a,b,c,d,x[k+4],6,0xf7537e82);
    d = II(d,a,b,c,x[k+11],10,0xbd3af235);
    c = II(c,d,a,b,x[k+2],15,0x2ad7d2bb);
    b = II(b,c,d,a,x[k+9],21,0xeb86d391);

    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }

  return (
    wordToHex(a) +
    wordToHex(b) +
    wordToHex(c) +
    wordToHex(d)
  ).toLowerCase();
}

// ================================================================
// PAYFAST
// ================================================================

function payfastHost(env) {
  return String(env.PAYFAST_SANDBOX).toLowerCase() === "true"
    ? "https://sandbox.payfast.co.za"
    : "https://www.payfast.co.za";
}

function payfastSignature(fields, passphrase = "") {
  const keys = Object.keys(fields)
    .filter(k => k !== "signature" && fields[k] !== undefined && fields[k] !== null)
    .sort();

  const parts = [];

  for (const key of keys) {
    let value = String(fields[key]).trim();
    value = encodeURIComponent(value)
      .replace(/%20/g, "+");

    parts.push(`${key}=${value}`);
  }

  let payload = parts.join("&");

  if (passphrase) {
    payload += `&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, "+")}`;
  }

  return md5(payload);
}

function payfastFields(fields, env) {
  const result = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== "") {
      result[key] = String(value);
    }
  }

  result.signature = payfastSignature(
    result,
    env.PAYFAST_PASSPHRASE || ""
  );

  return result;
}

function payfastForm(fields, env) {
  const endpoint = `${payfastHost(env)}/eng/process`;
  const inputs = Object.entries(fields)
    .map(([key, value]) =>
      `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}">`
    )
    .join("");

  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Secure PayFast Checkout</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:Arial,sans-serif;background:#f3f7fb;
display:flex;align-items:center;justify-content:center;
min-height:100vh;margin:0}
.box{background:#fff;padding:30px;border-radius:18px;
box-shadow:0 10px 35px #0001;text-align:center;max-width:420px}
button{background:#0866d8;color:#fff;border:0;padding:14px 25px;
border-radius:10px;font-size:16px;font-weight:700}
</style>
</head>
<body>
<div class="box">
<h2>Sky Blue SaaS Solutions</h2>
<p>Redirecting to secure PayFast checkout...</p>
<form id="pf" method="post" action="${endpoint}">
${inputs}
<noscript><button>Continue to PayFast</button></noscript>
</form>
</div>
<script>document.getElementById("pf").submit();</script>
</body>
</html>`;
}

// ================================================================
// HTML ESCAPE
// ================================================================

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ================================================================
// DATABASE SCHEMA
// ================================================================

async function schema(db) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS customer_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        status TEXT DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `),

    db.prepare(`
      CREATE TABLE IF NOT EXISTS customer_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `),

    db.prepare(`
      CREATE TABLE IF NOT EXISTS business_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER UNIQUE NOT NULL,
        business_name TEXT,
        owner_name TEXT,
        email TEXT,
        phone TEXT,
        whatsapp TEXT,
        address TEXT,
        city TEXT,
        province TEXT,
        website TEXT,
        logo_url TEXT,
        primary_color TEXT,
        secondary_color TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `),

    db.prepare(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        product_code TEXT NOT NULL,
        product_name TEXT,
        amount REAL DEFAULT 0,
        frequency INTEGER DEFAULT 3,
        status TEXT DEFAULT 'PENDING',
        payfast_payment_id TEXT,
        started_at TEXT,
        next_billing_date TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `),

    db.prepare(`
      CREATE TABLE IF NOT EXISTS saas_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        payment_id TEXT UNIQUE NOT NULL,
        amount REAL DEFAULT 0,
        status TEXT DEFAULT 'PENDING',
        raw_status TEXT,
        payment_data TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `),

    db.prepare(`
      CREATE TABLE IF NOT EXISTS business_services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        service_name TEXT NOT NULL,
        description TEXT,
        price REAL DEFAULT 0,
        status TEXT DEFAULT 'ACTIVE',
        created_at TEXT,
        updated_at TEXT
      )
    `),

    db.prepare(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        price REAL DEFAULT 0,
        stock INTEGER DEFAULT 0,
        sku TEXT,
        image_url TEXT,
        status TEXT DEFAULT 'ACTIVE',
        created_at TEXT,
        updated_at TEXT
      )
    `),

    db.prepare(`
      CREATE TABLE IF NOT EXISTS ecommerce_stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER UNIQUE NOT NULL,
        store_name TEXT,
        slug TEXT UNIQUE,
        description TEXT,
        logo_url TEXT,
        primary_color TEXT DEFAULT '#0b63ce',
        secondary_color TEXT DEFAULT '#083b78',
        currency TEXT DEFAULT 'ZAR',
        delivery_enabled INTEGER DEFAULT 1,
        pickup_enabled INTEGER DEFAULT 1,
        status TEXT DEFAULT 'ACTIVE',
        created_at TEXT,
        updated_at TEXT
      )
    `),

    db.prepare(`
      CREATE TABLE IF NOT EXISTS ecommerce_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `),

    db.prepare(`
      CREATE TABLE IF NOT EXISTS ecommerce_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        order_number TEXT UNIQUE NOT NULL,
        customer_name TEXT,
        customer_email TEXT,
        customer_phone TEXT,
        items_json TEXT,
        subtotal REAL DEFAULT 0,
        delivery_fee REAL DEFAULT 0,
        total REAL DEFAULT 0,
        payment_status TEXT DEFAULT 'PENDING',
        order_status TEXT DEFAULT 'NEW',
        delivery_method TEXT,
        delivery_address TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `),

    db.prepare(`
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_number TEXT UNIQUE NOT NULL,
        account_id INTEGER,
        category TEXT,
        description TEXT,
        location TEXT,
        priority TEXT DEFAULT 'Normal',
        source TEXT DEFAULT 'Web',
        status TEXT DEFAULT 'OPEN',
        created_at TEXT,
        updated_at TEXT
      )
    `),

    db.prepare(`
      CREATE TABLE IF NOT EXISTS report_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id INTEGER NOT NULL,
        update_text TEXT,
        status TEXT,
        created_at TEXT
      )
    `),

    db.prepare(`
      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )
    `),

    db.prepare(`
      CREATE TABLE IF NOT EXISTS whatsapp_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT,
        direction TEXT,
        message_type TEXT,
        message_text TEXT,
        media_url TEXT,
        payload TEXT,
        created_at TEXT
      )
    `),

    db.prepare(`
      CREATE TABLE IF NOT EXISTS saas_modules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        module_code TEXT NOT NULL,
        status TEXT DEFAULT 'ACTIVE',
        created_at TEXT,
        updated_at TEXT,
        UNIQUE(account_id,module_code)
      )
    `),

    db.prepare(`
      CREATE TABLE IF NOT EXISTS admin_support_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_key_hash TEXT,
        account_id INTEGER NOT NULL,
        status TEXT DEFAULT 'ACTIVE',
        started_at TEXT,
        ended_at TEXT
      )
    `),

    db.prepare(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER,
        action TEXT,
        details TEXT,
        created_at TEXT
      )
    `)
  ]);

  const departments = [
    "Electricity",
    "Water & Sewer",
    "Roads & Stormwater",
    "Waste Management",
    "General Services"
  ];

  for (const name of departments) {
    await db.prepare(
      `INSERT OR IGNORE INTO departments(name) VALUES(?)`
    ).bind(name).run();
  }
}

// ================================================================
// AUTHENTICATION
// ================================================================

async function accountFromSession(request, db) {
  const token = cookie(request, "sbs_session");

  if (!token) return null;

  const result = await db.prepare(`
    SELECT a.*
    FROM customer_accounts a
    JOIN customer_sessions s ON s.account_id = a.id
    WHERE s.token = ?
      AND s.expires_at > ?
      AND a.status = 'ACTIVE'
    LIMIT 1
  `).bind(token, now()).first();

  return result || null;
}

async function register(request, db) {
  const d = await bodyJSON(request);

  const email = clean(d.email, 200).toLowerCase();
  const password = String(d.password || "");

  if (!email || !password || password.length < 6) {
    return json({
      ok: false,
      error: "A valid email and password of at least 6 characters are required."
    }, 400);
  }

  const existing = await db.prepare(
    `SELECT id FROM customer_accounts WHERE email = ?`
  ).bind(email).first();

  if (existing) {
    return json({
      ok: false,
      error: "An account with this email already exists."
    }, 409);
  }

  const passwordHash = await sha256(password);
  const timestamp = now();

  const result = await db.prepare(`
    INSERT INTO customer_accounts
    (email,password_hash,status,created_at,updated_at)
    VALUES(?,?,?,?,?)
  `).bind(
    email,
    passwordHash,
    "ACTIVE",
    timestamp,
    timestamp
  ).run();

  return json({
    ok: true,
    account_id: result.meta.last_row_id,
    message: "Account created successfully."
  });
}

async function login(request, db) {
  const d = await bodyJSON(request);

  const email = clean(d.email, 200).toLowerCase();
  const passwordHash = await sha256(String(d.password || ""));

  const account = await db.prepare(`
    SELECT *
    FROM customer_accounts
    WHERE email = ?
      AND password_hash = ?
      AND status = 'ACTIVE'
    LIMIT 1
  `).bind(email, passwordHash).first();

  if (!account) {
    return json({
      ok: false,
      error: "Invalid email or password."
    }, 401);
  }

  const token = crypto.randomUUID() + crypto.randomUUID();
  const expires = new Date(Date.now() + 2592000000).toISOString();

  await db.prepare(`
    INSERT INTO customer_sessions
    (account_id,token,expires_at,created_at)
    VALUES(?,?,?,?)
  `).bind(
    account.id,
    token,
    expires,
    now()
  ).run();

  return json({
    ok: true,
    account: {
      id: account.id,
      email: account.email
    }
  }, 200, {
    "Set-Cookie": sessionCookie(token)
  });
}

async function logout(request, db) {
  const token = cookie(request, "sbs_session");

  if (token) {
    await db.prepare(
      `DELETE FROM customer_sessions WHERE token = ?`
    ).bind(token).run();
  }

  return json({
    ok: true,
    message: "Logged out."
  }, 200, {
    "Set-Cookie": clearSessionCookie()
  });
}

// ================================================================
// BUSINESS PROFILE
// ================================================================

async function saveProfile(request, db, account) {
  const d = await bodyJSON(request);

  const old = await db.prepare(`
    SELECT *
    FROM business_profiles
    WHERE account_id = ?
  `).bind(account.id).first();

  const values = {
    business_name: clean(d.business_name ?? old?.business_name, 200),
    owner_name: clean(d.owner_name ?? old?.owner_name, 200),
    email: clean(d.email ?? old?.email ?? account.email, 200),
    phone: clean(d.phone ?? old?.phone, 50),
    whatsapp: clean(d.whatsapp ?? old?.whatsapp, 50),
    address: clean(d.address ?? old?.address, 500),
    city: clean(d.city ?? old?.city, 100),
    province: clean(d.province ?? old?.province, 100),
    website: clean(d.website ?? old?.website, 300),
    logo_url: clean(d.logo_url ?? old?.logo_url, 500),

    // Parentheses deliberately used so ?? and || are valid together.
    primary_color: clean(
      (d.primary_color ?? old?.primary_color) || "#0b63ce",
      30
    ),

    secondary_color: clean(
      (d.secondary_color ?? old?.secondary_color) || "#083b78",
      30
    )
  };

  const timestamp = now();

  if (old) {
    await db.prepare(`
      UPDATE business_profiles
      SET business_name=?,
          owner_name=?,
          email=?,
          phone=?,
          whatsapp=?,
          address=?,
          city=?,
          province=?,
          website=?,
          logo_url=?,
          primary_color=?,
          secondary_color=?,
          updated_at=?
      WHERE account_id=?
    `).bind(
      values.business_name,
      values.owner_name,
      values.email,
      values.phone,
      values.whatsapp,
      values.address,
      values.city,
      values.province,
      values.website,
      values.logo_url,
      values.primary_color,
      values.secondary_color,
      timestamp,
      account.id
    ).run();
  } else {
    await db.prepare(`
      INSERT INTO business_profiles
      (
        account_id,
        business_name,
        owner_name,
        email,
        phone,
        whatsapp,
        address,
        city,
        province,
        website,
        logo_url,
        primary_color,
        secondary_color,
        created_at,
        updated_at
      )
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      account.id,
      values.business_name,
      values.owner_name,
      values.email,
      values.phone,
      values.whatsapp,
      values.address,
      values.city,
      values.province,
      values.website,
      values.logo_url,
      values.primary_color,
      values.secondary_color,
      timestamp,
      timestamp
    ).run();
  }

  return json({
    ok: true,
    profile: values
  });
}

// ================================================================
// MODULES
// ================================================================

async function activateModules(db, accountId, modules) {
  const list = Array.isArray(modules) ? modules : [];

  for (const moduleCode of list) {
    if (!MODULES.includes(moduleCode)) continue;

    await db.prepare(`
      INSERT INTO saas_modules
      (account_id,module_code,status,created_at,updated_at)
      VALUES(?,?,?,?,?)
      ON CONFLICT(account_id,module_code)
      DO UPDATE SET
        status='ACTIVE',
        updated_at=excluded.updated_at
    `).bind(
      accountId,
      moduleCode,
      "ACTIVE",
      now(),
      now()
    ).run();
  }
}

async function deactivateModule(db, accountId, moduleCode) {
  await db.prepare(`
    UPDATE saas_modules
    SET status='INACTIVE',updated_at=?
    WHERE account_id=? AND module_code=?
  `).bind(
    now(),
    accountId,
    moduleCode
  ).run();
}

async function getModules(db, accountId) {
  return await db.prepare(`
    SELECT module_code,status,created_at,updated_at
    FROM saas_modules
    WHERE account_id=?
    ORDER BY module_code
  `).bind(accountId).all();
}

// ================================================================
// ECOMMERCE STORE
// ================================================================

function slugify(value) {
  return clean(value, 100)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `store-${Date.now()}`;
}

async function createDefaultStore(db, accountId, businessName = "My Store") {
  const existing = await db.prepare(`
    SELECT *
    FROM ecommerce_stores
    WHERE account_id=?
  `).bind(accountId).first();

  if (existing) return existing;

  let slug = slugify(businessName);

  const conflict = await db.prepare(`
    SELECT id FROM ecommerce_stores WHERE slug=?
  `).bind(slug).first();

  if (conflict) {
    slug = `${slug}-${accountId}`;
  }

  await db.prepare(`
    INSERT INTO ecommerce_stores
    (
      account_id,
      store_name,
      slug,
      description,
      primary_color,
      secondary_color,
      currency,
      delivery_enabled,
      pickup_enabled,
      status,
      created_at,
      updated_at
    )
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    accountId,
    clean(businessName, 200),
    slug,
    "Online store powered by Sky Blue SaaS Solutions.",
    "#0b63ce",
    "#083b78",
    "ZAR",
    1,
    1,
    "ACTIVE",
    now(),
    now()
  ).run();

  return await db.prepare(`
    SELECT *
    FROM ecommerce_stores
    WHERE account_id=?
  `).bind(accountId).first();
}

async function saveStore(request, db, account) {
  const d = await bodyJSON(request);

  let store = await db.prepare(`
    SELECT *
    FROM ecommerce_stores
    WHERE account_id=?
  `).bind(account.id).first();

  if (!store) {
    store = await createDefaultStore(
      db,
      account.id,
      d.store_name || "My Store"
    );
  }

  const name = clean(
    d.store_name ?? store.store_name,
    200
  );

  let slug = slugify(
    d.slug ?? store.slug ?? name
  );

  const conflict = await db.prepare(`
    SELECT id
    FROM ecommerce_stores
    WHERE slug=? AND account_id != ?
  `).bind(slug, account.id).first();

  if (conflict) {
    slug = `${slug}-${account.id}`;
  }

  await db.prepare(`
    UPDATE ecommerce_stores
    SET store_name=?,
        slug=?,
        description=?,
        logo_url=?,
        primary_color=?,
        secondary_color=?,
        currency=?,
        delivery_enabled=?,
        pickup_enabled=?,
        status=?,
        updated_at=?
    WHERE account_id=?
  `).bind(
    name,
    slug,
    clean(d.description ?? store.description, 1000),
    clean(d.logo_url ?? store.logo_url, 500),
    clean(
      (d.primary_color ?? store.primary_color) || "#0b63ce",
      30
    ),
    clean(
      (d.secondary_color ?? store.secondary_color) || "#083b78",
      30
    ),
    clean(d.currency ?? store.currency ?? "ZAR", 10),
    d.delivery_enabled === undefined
      ? store.delivery_enabled
      : d.delivery_enabled ? 1 : 0,
    d.pickup_enabled === undefined
      ? store.pickup_enabled
      : d.pickup_enabled ? 1 : 0,
    clean(d.status ?? store.status ?? "ACTIVE", 30),
    now(),
    account.id
  ).run();

  return json({
    ok: true,
    store: await db.prepare(`
      SELECT *
      FROM ecommerce_stores
      WHERE account_id=?
    `).bind(account.id).first()
  });
}

// ================================================================
// PRODUCTS
// ================================================================

async function productAction(request, db, account) {
  const d = await bodyJSON(request);
  const action = clean(d.action, 30).toLowerCase();

  if (request.method === "GET") {
    const result = await db.prepare(`
      SELECT *
      FROM products
      WHERE account_id=?
      ORDER BY id DESC
    `).bind(account.id).all();

    return json({
      ok: true,
      products: result.results || []
    });
  }

  if (action === "delete") {
    const productId = Number(d.id);

    await db.prepare(`
      DELETE FROM products
      WHERE id=? AND account_id=?
    `).bind(productId, account.id).run();

    return json({
      ok: true,
      message: "Product deleted."
    });
  }

  if (action === "update") {
    const productId = Number(d.id);

    await db.prepare(`
      UPDATE products
      SET name=?,
          description=?,
          price=?,
          stock=?,
          sku=?,
          image_url=?,
          status=?,
          updated_at=?
      WHERE id=? AND account_id=?
    `).bind(
      clean(d.name, 200),
      clean(d.description, 1000),
      Number(d.price || 0),
      Number(d.stock || 0),
      clean(d.sku, 100),
      clean(d.image_url, 500),
      clean(d.status || "ACTIVE", 30),
      now(),
      productId,
      account.id
    ).run();

    return json({
      ok: true,
      message: "Product updated."
    });
  }

  await db.prepare(`
    INSERT INTO products
    (
      account_id,
      name,
      description,
      price,
      stock,
      sku,
      image_url,
      status,
      created_at,
      updated_at
    )
    VALUES(?,?,?,?,?,?,?,?,?,?)
  `).bind(
    account.id,
    clean(d.name, 200),
    clean(d.description, 1000),
    Number(d.price || 0),
    Number(d.stock || 0),
    clean(d.sku, 100),
    clean(d.image_url, 500),
    "ACTIVE",
    now(),
    now()
  ).run();

  return json({
    ok: true,
    message: "Product added."
  });
}

// ================================================================
// CUSTOMER DASHBOARD
// ================================================================

async function customerDashboard(db, account) {
  const profile = await db.prepare(`
    SELECT *
    FROM business_profiles
    WHERE account_id=?
  `).bind(account.id).first();

  const subscriptions = await db.prepare(`
    SELECT *
    FROM subscriptions
    WHERE account_id=?
    ORDER BY id DESC
  `).bind(account.id).all();

  const payments = await db.prepare(`
    SELECT id,payment_id,amount,status,raw_status,created_at,updated_at
    FROM saas_payments
    WHERE account_id=?
    ORDER BY id DESC
  `).bind(account.id).all();

  const modules = await getModules(db, account.id);

  const services = await db.prepare(`
    SELECT *
    FROM business_services
    WHERE account_id=?
    ORDER BY id DESC
  `).bind(account.id).all();

  const products = await db.prepare(`
    SELECT *
    FROM products
    WHERE account_id=?
    ORDER BY id DESC
  `).bind(account.id).all();

  const orders = await db.prepare(`
    SELECT *
    FROM ecommerce_orders
    WHERE account_id=?
    ORDER BY id DESC
  `).bind(account.id).all();

  const ecommerce = await db.prepare(`
    SELECT *
    FROM ecommerce_stores
    WHERE account_id=?
  `).bind(account.id).first();

  return {
    account: {
      id: account.id,
      email: account.email,
      status: account.status,
      created_at: account.created_at
    },
    profile,
    subscriptions: subscriptions.results || [],
    payments: payments.results || [],
    modules: modules.results || [],
    services: services.results || [],
    products: products.results || [],
    orders: orders.results || [],
    ecommerce
  };
}

// ================================================================
// CHECKOUT
// ================================================================

async function checkout(request, db, env, account) {
  const d = await bodyJSON(request);

  let selected = [];

  if (Array.isArray(d.products)) {
    selected = d.products;
  } else if (Array.isArray(d.product_codes)) {
    selected = d.product_codes.map(code => ({
      code
    }));
  }

  if (!selected.length) {
    selected = [{ code: "core" }];
  }

  const products = [];

  for (const item of selected) {
    const code = clean(
      typeof item === "string" ? item : item.code,
      50
    );

    if (CATALOG[code]) {
      products.push(CATALOG[code]);
    }
  }

  if (!products.length) {
    return json({
      ok: false,
      error: "No valid product selected."
    }, 400);
  }

  let currentAccount = account;

  if (!currentAccount) {
    const email = clean(d.email, 200).toLowerCase();
    const password = String(d.password || "");

    if (!email || password.length < 6) {
      return json({
        ok: false,
        error: "Email and password are required for checkout."
      }, 400);
    }

    const existing = await db.prepare(`
      SELECT *
      FROM customer_accounts
      WHERE email=?
    `).bind(email).first();

    if (existing) {
      currentAccount = existing;
    } else {
      const timestamp = now();

      const result = await db.prepare(`
        INSERT INTO customer_accounts
        (email,password_hash,status,created_at,updated_at)
        VALUES(?,?,?,?,?)
      `).bind(
        email,
        await sha256(password),
        "ACTIVE",
        timestamp,
        timestamp
      ).run();

      currentAccount = await db.prepare(`
        SELECT *
        FROM customer_accounts
        WHERE id=?
      `).bind(result.meta.last_row_id).first();
    }
  }

  if (d.business_name || d.phone || d.whatsapp) {
    const fakeRequest = new Request(
      "https://internal/business-profile",
      {
        method: "POST",
        body: JSON.stringify(d)
      }
    );

    await saveProfile(fakeRequest, db, currentAccount);
  }

  const paymentId = `SBS-${Date.now()}-${currentAccount.id}`;
  const total = products.reduce(
    (sum, product) => sum + Number(product.price),
    0
  );

  const billingDate = new Date();
  billingDate.setDate(billingDate.getDate() + 1);

  for (const product of products) {
    await db.prepare(`
      INSERT INTO subscriptions
      (
        account_id,
        product_code,
        product_name,
        amount,
        frequency,
        status,
        payfast_payment_id,
        created_at,
        updated_at
      )
      VALUES(?,?,?,?,?,?,?,?,?)
    `).bind(
      currentAccount.id,
      product.code,
      product.name,
      product.price,
      product.frequency,
      "PENDING",
      paymentId,
      now(),
      now()
    ).run();
  }

  await db.prepare(`
    INSERT INTO saas_payments
    (
      account_id,
      payment_id,
      amount,
      status,
      created_at,
      updated_at
    )
    VALUES(?,?,?,?,?,?)
  `).bind(
    currentAccount.id,
    paymentId,
    total,
    "PENDING",
    now(),
    now()
  ).run();

  const modules = [
    ...new Set(
      products.flatMap(product => product.modules)
    )
  ];

  const token = crypto.randomUUID() + crypto.randomUUID();

  await db.prepare(`
    INSERT INTO customer_sessions
    (account_id,token,expires_at,created_at)
    VALUES(?,?,?,?)
  `).bind(
    currentAccount.id,
    token,
    new Date(Date.now() + 2592000000).toISOString(),
    now()
  ).run();

  const fields = {
    merchant_id: env.PAYFAST_MERCHANT_ID || "",
    merchant_key: env.PAYFAST_MERCHANT_KEY || "",
    return_url:
      env.PAYFAST_RETURN_URL ||
      `${baseUrl(request, env)}/?payment=success`,
    cancel_url:
      env.PAYFAST_CANCEL_URL ||
      `${baseUrl(request, env)}/?payment=cancelled`,
    notify_url:
      env.PAYFAST_NOTIFY_URL ||
      `${baseUrl(request, env)}/api/payfast/itn`,
    name_first: clean(d.owner_name || d.business_name || "Customer", 100),
    email_address: currentAccount.email,
    m_payment_id: paymentId,
    amount: money(total),
    item_name: products.map(x => x.name).join(" + "),
    subscription_type: "1",
    billing_date: billingDate.toISOString().slice(0, 10),
    recurring_amount: money(total),
    frequency: String(products[0].frequency || 3),
    cycles: "0"
  };

  const signed = payfastFields(fields, env);

  return html(payfastForm(signed, env), 200);
}

// ================================================================
// PAYFAST ITN
// ================================================================

async function payfastITN(request, db, env) {
  const raw = await request.text();
  const params = new URLSearchParams(raw);
  const data = {};

  for (const [key, value] of params.entries()) {
    data[key] = value;
  }

  const paymentId = clean(data.m_payment_id, 200);

  if (!paymentId) {
    return text("Missing payment ID", 400);
  }

  if (
    env.PAYFAST_MERCHANT_ID &&
    String(data.merchant_id || "") !==
      String(env.PAYFAST_MERCHANT_ID)
  ) {
    return text("Invalid merchant", 400);
  }

  const receivedSignature = clean(data.signature, 200);
  const calculatedSignature = payfastSignature(
    data,
    env.PAYFAST_PASSPHRASE || ""
  );

  if (
    receivedSignature &&
    receivedSignature.toLowerCase() !==
      calculatedSignature.toLowerCase()
  ) {
    return text("Invalid signature", 400);
  }

  const payment = await db.prepare(`
    SELECT *
    FROM saas_payments
    WHERE payment_id=?
  `).bind(paymentId).first();

  if (!payment) {
    return text("Payment not found", 404);
  }

  const status = clean(
    data.payment_status || data.status || "UNKNOWN",
    50
  );

  await db.prepare(`
    UPDATE saas_payments
    SET status=?,
        raw_status=?,
        payment_data=?,
        updated_at=?
    WHERE payment_id=?
  `).bind(
    status === "COMPLETE" || status === "COMPLETED"
      ? "COMPLETE"
      : status,
    status,
    JSON.stringify(data),
    now(),
    paymentId
  ).run();

  if (status === "COMPLETE" || status === "COMPLETED") {
    const expected = Number(payment.amount || 0);
    const received = Number(data.amount_gross || data.amount || 0);

    if (received > 0 && Math.abs(received - expected) > 0.01) {
      return text("Amount mismatch", 400);
    }

    const subscriptions = await db.prepare(`
      SELECT *
      FROM subscriptions
      WHERE payfast_payment_id=?
    `).bind(paymentId).all();

    const modules = new Set();

    for (const subscription of subscriptions.results || []) {
      const product = CATALOG[subscription.product_code];

      if (product) {
        for (const module of product.modules) {
          modules.add(module);
        }
      }

      await db.prepare(`
        UPDATE subscriptions
        SET status='ACTIVE',
            started_at=COALESCE(started_at,?),
            updated_at=?
        WHERE id=?
      `).bind(
        now(),
        now(),
        subscription.id
      ).run();
    }

    await activateModules(
      db,
      payment.account_id,
      [...modules]
    );

    const ecommerceActive = modules.has("ecommerce");

    if (ecommerceActive) {
      const profile = await db.prepare(`
        SELECT business_name
        FROM business_profiles
        WHERE account_id=?
      `).bind(payment.account_id).first();

      await createDefaultStore(
        db,
        payment.account_id,
        profile?.business_name || "My Store"
      );
    }
  }

  return text("OK");
}

// ================================================================
// ECOMMERCE ORDERS
// ================================================================

async function ecommerceOrders(request, db, account) {
  if (request.method === "GET") {
    const result = await db.prepare(`
      SELECT *
      FROM ecommerce_orders
      WHERE account_id=?
      ORDER BY id DESC
    `).bind(account.id).all();

    return json({
      ok: true,
      orders: result.results || []
    });
  }

  const d = await bodyJSON(request);

  const orderNumber =
    `${PREFIX}-ORDER-${Date.now()}-${account.id}`;

  const items = Array.isArray(d.items) ? d.items : [];

  let subtotal = 0;

  for (const item of items) {
    subtotal +=
      Number(item.price || 0) *
      Number(item.quantity || 1);
  }

  const deliveryFee = Number(d.delivery_fee || 0);
  const total = subtotal + deliveryFee;

  await db.prepare(`
    INSERT INTO ecommerce_orders
    (
      account_id,
      order_number,
      customer_name,
      customer_email,
      customer_phone,
      items_json,
      subtotal,
      delivery_fee,
      total,
      payment_status,
      order_status,
      delivery_method,
      delivery_address,
      created_at,
      updated_at
    )
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    account.id,
    orderNumber,
    clean(d.customer_name, 200),
    clean(d.customer_email, 200),
    clean(d.customer_phone, 50),
    JSON.stringify(items),
    subtotal,
    deliveryFee,
    total,
    "PENDING",
    "NEW",
    clean(d.delivery_method, 50),
    clean(d.delivery_address, 500),
    now(),
    now()
  ).run();

  return json({
    ok: true,
    order_number: orderNumber,
    total: money(total),
    payment_required: true,
    message: "Order created."
  });
}

// ================================================================
// PUBLIC ECOMMERCE STORE
// ================================================================

async function publicStore(request, db, slug) {
  const store = await db.prepare(`
    SELECT *
    FROM ecommerce_stores
    WHERE slug=? AND status='ACTIVE'
  `).bind(slug).first();

  if (!store) {
    return html(`
      <!doctype html>
      <html>
      <body style="font-family:Arial;padding:40px">
      <h1>Store not found</h1>
      <p>This store is unavailable.</p>
      </body>
      </html>
    `, 404);
  }

  const products = await db.prepare(`
    SELECT *
    FROM products
    WHERE account_id=? AND status='ACTIVE'
    ORDER BY id DESC
  `).bind(store.account_id).all();

  const cards = (products.results || []).map(product => `
    <article class="product">
      ${
        product.image_url
          ? `<img src="${escapeHtml(product.image_url)}" alt="">`
          : ""
      }
      <h3>${escapeHtml(product.name)}</h3>
      <p>${escapeHtml(product.description || "")}</p>
      <strong>R ${money(product.price)}</strong>
      <button
        onclick='addToCart(${JSON.stringify({
          id: product.id,
          name: product.name,
          price: Number(product.price)
        })})'>
        Add to cart
      </button>
    </article>
  `).join("");

  return html(`
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(store.store_name)}</title>
<style>
:root{
--primary:${escapeHtml(store.primary_color || "#0b63ce")};
--secondary:${escapeHtml(store.secondary_color || "#083b78")};
}
*{box-sizing:border-box}
body{margin:0;font-family:Arial,sans-serif;background:#f5f8fc;color:#172033}
header{background:var(--primary);color:white;padding:28px 20px}
header h1{margin:0}
.container{max-width:1100px;margin:auto;padding:25px 18px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px}
.product{background:white;border-radius:16px;padding:18px;box-shadow:0 4px 18px #00000010}
.product img{width:100%;height:180px;object-fit:cover;border-radius:12px}
.product button,.checkout button{
background:var(--secondary);color:white;border:0;
padding:11px 15px;border-radius:9px;margin-top:12px;
font-weight:700;cursor:pointer
}
.cart{background:white;padding:20px;border-radius:16px;margin-top:25px}
</style>
</head>
<body>
<header>
<div class="container">
<h1>${escapeHtml(store.store_name)}</h1>
<p>${escapeHtml(store.description || "")}</p>
</div>
</header>

<main class="container">
<h2>Products</h2>
<div class="grid">${cards || "<p>No products available yet.</p>"}</div>

<div class="cart">
<h2>Cart</h2>
<div id="cart">Your cart is empty.</div>
</div>
</main>

<script>
const cart=[];

function addToCart(product){
  const existing=cart.find(x=>x.id===product.id);
  if(existing) existing.quantity++;
  else cart.push({...product,quantity:1});
  renderCart();
}

function renderCart(){
  const box=document.getElementById("cart");

  if(!cart.length){
    box.innerHTML="Your cart is empty.";
    return;
  }

  let total=0;

  box.innerHTML=cart.map(item=>{
    total+=item.price*item.quantity;
    return "<div>"+
      item.name+
      " x "+item.quantity+
      " — R "+(item.price*item.quantity).toFixed(2)+
      "</div>";
  }).join("")+
  "<hr><strong>Total: R "+
  total.toFixed(2)+
  "</strong>";
}

renderCart();
</script>
</body>
</html>
`);
}

// ================================================================
// WHATSAPP
// ================================================================

async function sendWhatsApp(env, phone, message) {
  if (
    !env.WHATSAPP_ACCESS_TOKEN ||
    !env.WHATSAPP_PHONE_NUMBER_ID
  ) {
    return {
      ok: false,
      error: "WhatsApp credentials are not configured."
    };
  }

  const url =
    `https://graph.facebook.com/v23.0/` +
    `${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization":
        `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: {
        body: message
      }
    })
  });

  const result = await response.json();

  return {
    ok: response.ok,
    result
  };
}

async function whatsappWebhook(request, db, env) {
  if (request.method === "GET") {
    const url = new URL(request.url);

    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (
      mode === "subscribe" &&
      token &&
      token === env.WHATSAPP_VERIFY_TOKEN
    ) {
      return text(challenge || "");
    }

    return text("Verification failed", 403);
  }

  const payload = await request.json();

  const entries = payload.entry || [];

  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value || {};

      for (const message of value.messages || []) {
        const phone = message.from || "";
        const type = message.type || "";
        let messageText = "";
        let mediaUrl = "";

        if (type === "text") {
          messageText = message.text?.body || "";
        }

        if (type === "image") {
          mediaUrl = message.image?.id || "";
        }

        if (type === "video") {
          mediaUrl = message.video?.id || "";
        }

        if (type === "audio") {
          mediaUrl = message.audio?.id || "";
        }

        await db.prepare(`
          INSERT INTO whatsapp_conversations
          (
            phone,
            direction,
            message_type,
            message_text,
            media_url,
            payload,
            created_at
          )
          VALUES(?,?,?,?,?,?,?)
        `).bind(
          phone,
          "INBOUND",
          type,
          messageText,
          mediaUrl,
          JSON.stringify(message),
          now()
        ).run();
      }
    }
  }

  return json({
    ok: true
  });
}

// ================================================================
// SERVICES
// ================================================================

async function serviceAction(request, db, account) {
  const d = await bodyJSON(request);

  await db.prepare(`
    INSERT INTO business_services
    (
      account_id,
      service_name,
      description,
      price,
      status,
      created_at,
      updated_at
    )
    VALUES(?,?,?,?,?,?,?)
  `).bind(
    account.id,
    clean(d.service_name, 200),
    clean(d.description, 1000),
    Number(d.price || 0),
    "ACTIVE",
    now(),
    now()
  ).run();

  return json({
    ok: true,
    message: "Service saved."
  });
}

// ================================================================
// CIVIC REPORTS
// ================================================================

function reportDepartment(category) {
  const value = String(category || "").toLowerCase();

  if (
    value.includes("electric") ||
    value.includes("power")
  ) return 1;

  if (
    value.includes("water") ||
    value.includes("drain") ||
    value.includes("sewer")
  ) return 2;

  if (
    value.includes("road") ||
    value.includes("pothole") ||
    value.includes("storm")
  ) return 3;

  if (
    value.includes("waste") ||
    value.includes("dump") ||
    value.includes("rubbish")
  ) return 4;

  return 5;
}

async function createReport(request, db, account) {
  const d = await bodyJSON(request);

  const count = await db.prepare(`
    SELECT COUNT(*) AS total
    FROM reports
  `).first();

  const next = Number(count?.total || 0) + 1;

  const reportNumber =
    `${PREFIX}-AX-${String(next).padStart(6, "0")}`;

  const category = clean(d.category, 100);
  const priority =
    clean(d.priority || "Normal", 30);

  const departmentId = reportDepartment(category);

  await db.prepare(`
    INSERT INTO reports
    (
      report_number,
      account_id,
      category,
      description,
      location,
      priority,
      source,
      status,
      created_at,
      updated_at
    )
    VALUES(?,?,?,?,?,?,?,?,?,?)
  `).bind(
    reportNumber,
    account?.id || null,
    category,
    clean(d.description, 2000),
    clean(d.location, 500),
    priority,
    clean(d.source || "Web", 30),
    "OPEN",
    now(),
    now()
  ).run();

  return json({
    ok: true,
    report_number: reportNumber,
    department_id: departmentId,
    status: "OPEN"
  });
}

// ================================================================
// ADMIN
// ================================================================

function adminAuthorized(request, env) {
  const configured = clean(env.ADMIN_KEY, 500);

  if (!configured) return false;

  const supplied =
    request.headers.get("X-Admin-Key") ||
    request.headers.get("Authorization")?.replace(
      /^Bearer\s+/i,
      ""
    ) ||
    "";

  return supplied === configured;
}

function adminGuard(request, env) {
  if (!adminAuthorized(request, env)) {
    return json({
      ok: false,
      error: "Unauthorized."
    }, 401);
  }

  return null;
}

async function audit(db, accountId, action, details) {
  await db.prepare(`
    INSERT INTO admin_audit_logs
    (account_id,action,details,created_at)
    VALUES(?,?,?,?)
  `).bind(
    accountId || null,
    clean(action, 100),
    JSON.stringify(details || {}),
    now()
  ).run();
}

async function adminDashboard(db) {
  const customers = await db.prepare(`
    SELECT COUNT(*) AS total
    FROM customer_accounts
  `).first();

  const activeSubscriptions = await db.prepare(`
    SELECT COUNT(*) AS total
    FROM subscriptions
    WHERE status='ACTIVE'
  `).first();

  const revenue = await db.prepare(`
    SELECT COALESCE(SUM(amount),0) AS total
    FROM saas_payments
    WHERE status='COMPLETE'
  `).first();

  const stores = await db.prepare(`
    SELECT COUNT(*) AS total
    FROM ecommerce_stores
    WHERE status='ACTIVE'
  `).first();

  const orders = await db.prepare(`
    SELECT COUNT(*) AS total
    FROM ecommerce_orders
  `).first();

  const customerList = await db.prepare(`
    SELECT
      a.id,
      a.email,
      a.status,
      a.created_at,
      p.business_name,
      p.phone,
      p.whatsapp
    FROM customer_accounts a
    LEFT JOIN business_profiles p
      ON p.account_id=a.id
    ORDER BY a.id DESC
    LIMIT 200
  `).all();

  return json({
    ok: true,
    stats: {
      customers: Number(customers?.total || 0),
      active_subscriptions:
        Number(activeSubscriptions?.total || 0),
      revenue: Number(revenue?.total || 0),
      ecommerce_stores: Number(stores?.total || 0),
      orders: Number(orders?.total || 0)
    },
    customers: customerList.results || []
  });
}

async function adminActivity(db) {
  const result = await db.prepare(`
    SELECT *
    FROM admin_audit_logs
    ORDER BY id DESC
    LIMIT 200
  `).all();

  return json({
    ok: true,
    activity: result.results || []
  });
}

async function adminCustomer(request, db) {
  const url = new URL(request.url);
  const accountId =
    Number(url.searchParams.get("account_id") || 0);

  if (!accountId) {
    return json({
      ok: false,
      error: "account_id is required."
    }, 400);
  }

  const account = await db.prepare(`
    SELECT id,email,status,created_at,updated_at
    FROM customer_accounts
    WHERE id=?
  `).bind(accountId).first();

  if (!account) {
    return json({
      ok: false,
      error: "Customer not found."
    }, 404);
  }

  const dashboard = await customerDashboard(
    db,
    account
  );

  return json({
    ok: true,
    customer: dashboard
  });
}

async function adminCustomerDashboard(db, accountId) {
  const account = await db.prepare(`
    SELECT *
    FROM customer_accounts
    WHERE id=?
  `).bind(accountId).first();

  if (!account) {
    return json({
      ok: false,
      error: "Customer not found."
    }, 404);
  }

  return json({
    ok: true,
    dashboard: await customerDashboard(db, account)
  });
}

async function adminStartSupport(request, db, env) {
  const d = await bodyJSON(request);
  const accountId = Number(d.account_id || 0);

  if (!accountId) {
    return json({
      ok: false,
      error: "account_id is required."
    }, 400);
  }

  const customer = await db.prepare(`
    SELECT id,email
    FROM customer_accounts
    WHERE id=?
  `).bind(accountId).first();

  if (!customer) {
    return json({
      ok: false,
      error: "Customer not found."
    }, 404);
  }

  const adminHash =
    await sha256(env.ADMIN_KEY || "admin");

  const result = await db.prepare(`
    INSERT INTO admin_support_sessions
    (
      admin_key_hash,
      account_id,
      status,
      started_at
    )
    VALUES(?,?,?,?)
  `).bind(
    adminHash,
    accountId,
    "ACTIVE",
    now()
  ).run();

  await audit(
    db,
    accountId,
    "support_started",
    {
      session_id: result.meta.last_row_id
    }
  );

  return json({
    ok: true,
    session_id: result.meta.last_row_id,
    account_id: accountId,
    message: "Remote support session started."
  });
}

async function adminEndSupport(request, db) {
  const d = await bodyJSON(request);
  const sessionId = Number(d.session_id || 0);

  await db.prepare(`
    UPDATE admin_support_sessions
    SET status='ENDED',ended_at=?
    WHERE id=? AND status='ACTIVE'
  `).bind(
    now(),
    sessionId
  ).run();

  return json({
    ok: true,
    message: "Remote support session ended."
  });
}

// ================================================================
// ADMIN SUPPORT ACTIONS
// ================================================================

async function adminSupportAction(request, db, env) {
  const d = await bodyJSON(request);

  const accountId = Number(d.account_id || 0);
  const action = clean(d.action, 50);

  if (!accountId || !action) {
    return json({
      ok: false,
      error: "account_id and action are required."
    }, 400);
  }

  const account = await db.prepare(`
    SELECT *
    FROM customer_accounts
    WHERE id=?
  `).bind(accountId).first();

  if (!account) {
    return json({
      ok: false,
      error: "Customer not found."
    }, 404);
  }

  if (action === "update_profile") {
    const fakeRequest = new Request(
      "https://internal/profile",
      {
        method: "POST",
        body: JSON.stringify(d)
      }
    );

    const result = await saveProfile(
      fakeRequest,
      db,
      account
    );

    await audit(
      db,
      accountId,
      "support_update_profile",
      d
    );

    return result;
  }

  if (action === "update_store") {
    const fakeRequest = new Request(
      "https://internal/store",
      {
        method: "POST",
        body: JSON.stringify(d)
      }
    );

    const result = await saveStore(
      fakeRequest,
      db,
      account
    );

    await audit(
      db,
      accountId,
      "support_update_store",
      d
    );

    return result;
  }

  if (action === "add_product") {
    const fakeRequest = new Request(
      "https://internal/product",
      {
        method: "POST",
        body: JSON.stringify(d)
      }
    );

    const result = await productAction(
      fakeRequest,
      db,
      account
    );

    await audit(
      db,
      accountId,
      "support_add_product",
      d
    );

    return result;
  }

  if (action === "update_product") {
    const fakeRequest = new Request(
      "https://internal/product",
      {
        method: "POST",
        body: JSON.stringify({
          ...d,
          action: "update"
        })
      }
    );

    const result = await productAction(
      fakeRequest,
      db,
      account
    );

    await audit(
      db,
      accountId,
      "support_update_product",
      d
    );

    return result;
  }

  if (action === "delete_product") {
    const fakeRequest = new Request(
      "https://internal/product",
      {
        method: "POST",
        body: JSON.stringify({
          ...d,
          action: "delete"
        })
      }
    );

    const result = await productAction(
      fakeRequest,
      db,
      account
    );

    await audit(
      db,
      accountId,
      "support_delete_product",
      d
    );

    return result;
  }

  if (action === "activate_module") {
    const moduleCode = clean(d.module_code, 100);

    if (!MODULES.includes(moduleCode)) {
      return json({
        ok: false,
        error: "Invalid module."
      }, 400);
    }

    await activateModules(
      db,
      accountId,
      [moduleCode]
    );

    await audit(
      db,
      accountId,
      "support_activate_module",
      { module_code: moduleCode }
    );

    return json({
      ok: true,
      message: "Module activated."
    });
  }

  if (action === "deactivate_module") {
    const moduleCode = clean(d.module_code, 100);

    await deactivateModule(
      db,
      accountId,
      moduleCode
    );

    await audit(
      db,
      accountId,
      "support_deactivate_module",
      { module_code: moduleCode }
    );

    return json({
      ok: true,
      message: "Module deactivated."
    });
  }

  if (action === "update_order") {
    const orderId = Number(d.order_id || 0);

    await db.prepare(`
      UPDATE ecommerce_orders
      SET order_status=?,
          payment_status=?,
          updated_at=?
      WHERE id=? AND account_id=?
    `).bind(
      clean(d.order_status || "NEW", 50),
      clean(d.payment_status || "PENDING", 50),
      now(),
      orderId,
      accountId
    ).run();

    await audit(
      db,
      accountId,
      "support_update_order",
      d
    );

    return json({
      ok: true,
      message: "Order updated."
    });
  }

  if (action === "send_whatsapp") {
    const phone = clean(d.phone, 50);
    const message = clean(d.message, 4000);

    const result = await sendWhatsApp(
      env,
      phone,
      message
    );

    await audit(
      db,
      accountId,
      "support_send_whatsapp",
      {
        phone,
        success: result.ok
      }
    );

    if (result.ok) {
      await db.prepare(`
        INSERT INTO whatsapp_conversations
        (
          phone,
          direction,
          message_type,
          message_text,
          payload,
          created_at
        )
        VALUES(?,?,?,?,?,?)
      `).bind(
        phone,
        "OUTBOUND",
        "text",
        message,
        JSON.stringify(result.result || {}),
        now()
      ).run();
    }

    return json(result, result.ok ? 200 : 502);
  }

  return json({
    ok: false,
    error: "Unsupported support action."
  }, 400);
}

// ================================================================
// CATALOG
// ================================================================

function catalogResponse() {
  return json({
    ok: true,
    app: APP,
    version: VERSION,
    products: Object.values(CATALOG),
    modules: MODULES
  });
}

// ================================================================
// ROOT HEALTH PAGE
// ================================================================

function homePage() {
  return html(`
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${APP}</title>
<style>
body{
margin:0;
font-family:Arial,sans-serif;
background:#f5f8fc;
color:#152033;
}
header{
background:linear-gradient(135deg,#0b63ce,#083b78);
color:white;
padding:55px 20px;
}
main{
max-width:1000px;
margin:auto;
padding:30px 20px;
}
.card{
background:white;
padding:25px;
border-radius:18px;
box-shadow:0 5px 25px #00000012;
margin-bottom:20px;
}
.status{
display:inline-block;
background:#dff7e7;
color:#146c35;
padding:8px 13px;
border-radius:30px;
font-weight:bold;
}
</style>
</head>
<body>
<header>
<main>
<h1>${APP}</h1>
<p>Your business. One digital platform. Built to grow.</p>
<span class="status">API ONLINE</span>
</main>
</header>

<main>
<div class="card">
<h2>Digital Business Platform</h2>
<p>
WhatsApp, websites, ecommerce, business numbers,
Cloud PBX, customer dashboards and business tools.
</p>
</div>

<div class="card">
<h2>System Status</h2>
<p>Version: ${VERSION}</p>
<p>Cloudflare Worker API is running.</p>
</div>
</main>
</body>
</html>
`);
}

// ================================================================
// ROUTER
// ================================================================

async function router(request, env) {
  const db = env.DB;

  if (!db) {
    return json({
      ok: false,
      error: "D1 database binding DB is missing."
    }, 500);
  }

  await schema(db);

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods":
          "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers":
          "Content-Type, Authorization, X-Admin-Key"
      }
    });
  }

  if (path === "/" && method === "GET") {
    return homePage();
  }

  if (path === "/api/health") {
    return json({
      ok: true,
      status: "online",
      app: APP,
      version: VERSION,
      message: "Sky Blue SaaS Solutions API is running."
    });
  }

  if (path === "/api/catalog") {
    return catalogResponse();
  }

  if (path === "/api/modules") {
    return json({
      ok: true,
      modules: MODULES
    });
  }

  // --------------------------------------------------------------
  // AUTH
  // --------------------------------------------------------------

  if (path === "/api/auth/register" && method === "POST") {
    return register(request, db);
  }

  if (path === "/api/auth/login" && method === "POST") {
    return login(request, db);
  }

  if (path === "/api/auth/logout" && method === "POST") {
    return logout(request, db);
  }

  if (path === "/api/auth/me" && method === "GET") {
    const account = await accountFromSession(request, db);

    if (!account) {
      return json({
        ok: false,
        authenticated: false
      }, 401);
    }

    return json({
      ok: true,
      authenticated: true,
      account: {
        id: account.id,
        email: account.email,
        status: account.status
      }
    });
  }

  // --------------------------------------------------------------
  // PAYFAST CHECKOUT
  // --------------------------------------------------------------

  if (path === "/api/checkout/start" && method === "POST") {
    const account = await accountFromSession(
      request,
      db
    );

    return checkout(
      request,
      db,
      env,
      account
    );
  }

  if (path === "/api/payfast/itn" && method === "POST") {
    return payfastITN(
      request,
      db,
      env
    );
  }

  // --------------------------------------------------------------
  // CUSTOMER DASHBOARD
  // --------------------------------------------------------------

  if (
    path === "/api/customer/dashboard" &&
    method === "GET"
  ) {
    const account = await accountFromSession(
      request,
      db
    );

    if (!account) {
      return json({
        ok: false,
        error: "Authentication required."
      }, 401);
    }

    return json({
      ok: true,
      dashboard: await customerDashboard(
        db,
        account
      )
    });
  }

  // --------------------------------------------------------------
  // BUSINESS PROFILE
  // --------------------------------------------------------------

  if (
    path === "/api/business/profile" &&
    method === "POST"
  ) {
    const account = await accountFromSession(
      request,
      db
    );

    if (!account) {
      return json({
        ok: false,
        error: "Authentication required."
      }, 401);
    }

    return saveProfile(
      request,
      db,
      account
    );
  }

  // --------------------------------------------------------------
  // PRODUCTS
  // --------------------------------------------------------------

  if (
    path === "/api/products" &&
    (method === "GET" || method === "POST")
  ) {
    const account = await accountFromSession(
      request,
      db
    );

    if (!account) {
      return json({
        ok: false,
        error: "Authentication required."
      }, 401);
    }

    return productAction(
      request,
      db,
      account
    );
  }

  // --------------------------------------------------------------
  // SERVICES
  // --------------------------------------------------------------

  if (
    path === "/api/services" &&
    method === "POST"
  ) {
    const account = await accountFromSession(
      request,
      db
    );

    if (!account) {
      return json({
        ok: false,
        error: "Authentication required."
      }, 401);
    }

    return serviceAction(
      request,
      db,
      account
    );
  }

  // --------------------------------------------------------------
  // ECOMMERCE STORE
  // --------------------------------------------------------------

  if (
    path === "/api/ecommerce/store" &&
    method === "GET"
  ) {
    const account = await accountFromSession(
      request,
      db
    );

    if (!account) {
      return json({
        ok: false,
        error: "Authentication required."
      }, 401);
    }

    const store = await db.prepare(`
      SELECT *
      FROM ecommerce_stores
      WHERE account_id=?
    `).bind(account.id).first();

    return json({
      ok: true,
      store
    });
  }

  if (
    path === "/api/ecommerce/store" &&
    method === "POST"
  ) {
    const account = await accountFromSession(
      request,
      db
    );

    if (!account) {
      return json({
        ok: false,
        error: "Authentication required."
      }, 401);
    }

    return saveStore(
      request,
      db,
      account
    );
  }

  // --------------------------------------------------------------
  // ECOMMERCE ORDERS
  // --------------------------------------------------------------

  if (
    path === "/api/ecommerce/orders" &&
    (method === "GET" || method === "POST")
  ) {
    const account = await accountFromSession(
      request,
      db
    );

    if (!account) {
      return json({
        ok: false,
        error: "Authentication required."
      }, 401);
    }

    return ecommerceOrders(
      request,
      db,
      account
    );
  }

  // --------------------------------------------------------------
  // CIVIC REPORTS
  // --------------------------------------------------------------

  if (
    path === "/api/reports" &&
    method === "POST"
  ) {
    const account = await accountFromSession(
      request,
      db
    );

    return createReport(
      request,
      db,
      account
    );
  }

  // --------------------------------------------------------------
  // WHATSAPP
  // --------------------------------------------------------------

  if (path === "/api/whatsapp") {
    return whatsappWebhook(
      request,
      db,
      env
    );
  }

  // --------------------------------------------------------------
  // ADMIN
  // --------------------------------------------------------------

  if (path.startsWith("/api/admin/")) {
    const denied = adminGuard(
      request,
      env
    );

    if (denied) return denied;
  }

  if (
    path === "/api/admin/dashboard" &&
    method === "GET"
  ) {
    return adminDashboard(db);
  }

  if (
    path === "/api/admin/activity" &&
    method === "GET"
  ) {
    return adminActivity(db);
  }

  if (
    path === "/api/admin/customer" &&
    method === "GET"
  ) {
    return adminCustomer(
      request,
      db
    );
  }

  const customerDashboardMatch =
    path.match(/^\/api\/admin\/customer\/(\d+)\/dashboard$/);

  if (
    customerDashboardMatch &&
    method === "GET"
  ) {
    return adminCustomerDashboard(
      db,
      Number(customerDashboardMatch[1])
    );
  }

  if (
    path === "/api/admin/support/start" &&
    method === "POST"
  ) {
    return adminStartSupport(
      request,
      db,
      env
    );
  }

  if (
    path === "/api/admin/support/end" &&
    method === "POST"
  ) {
    return adminEndSupport(
      request,
      db
    );
  }

  if (
    path === "/api/admin/support/action" &&
    method === "POST"
  ) {
    return adminSupportAction(
      request,
      db,
      env
    );
  }

  // --------------------------------------------------------------
  // PUBLIC STORE
  // --------------------------------------------------------------

  const storeMatch =
    path.match(/^\/store\/([^/]+)$/);

  if (
    storeMatch &&
    method === "GET"
  ) {
    return publicStore(
      request,
      db,
      storeMatch[1]
    );
  }

  return json({
    ok: false,
    error: "Endpoint not found.",
    path
  }, 404);
}

// ================================================================
// CLOUDFLARE WORKER ENTRY
// ================================================================

export default {
  async fetch(request, env) {
    try {
      return await router(
        request,
        env
      );
    } catch (error) {
      console.error(
        "Sky Blue Worker Error:",
        error
      );

      return json({
        ok: false,
        error: "Internal server error.",
        message: String(error?.message || error)
      }, 500);
    }
  }
};
