// ================================================================
// SKY BLUE DIGITAL SERVICE - COMPLETE CLOUDFLARE WORKER
// Version: 2026.10.08-AUTH-FIX
// ================================================================

const APP = "Sky Blue Digital Service";
const VERSION = "2026.10.08-AUTH-FIX";
const PREFIX = "SBS";

const MODULES = [
  "whatsapp","website","ecommerce","salon","food","pharmacy",
  "school","councillor","civic","npo","ngo","church","undertaker",
  "hosting","cyber","voice","directory","retail","cloud-pbx"
];

const CATALOG = {
  core:{
    code:"core",
    name:"WhatsApp + Website",
    price:199,
    frequency:3,
    modules:["whatsapp","website"]
  },
  number:{
    code:"number",
    name:"Business Number",
    price:69,
    frequency:3,
    modules:["voice"]
  },
  ecommerce:{
    code:"ecommerce",
    name:"Ecommerce",
    price:399,
    frequency:3,
    modules:["ecommerce"]
  },
  pbx:{
    code:"pbx",
    name:"Cloud PBX",
    price:299,
    frequency:3,
    modules:["voice","cloud-pbx"]
  }
};

// ================================================================
// HELPERS
// ================================================================

const now = () => new Date().toISOString();

function clean(v,max=500){
  if(v===null||v===undefined)return "";
  return String(v).trim().slice(0,max);
}

function json(data,status=200,extra={}){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "content-type":"application/json; charset=utf-8",
      "access-control-allow-origin":"*",
      "access-control-allow-methods":"GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers":"Content-Type,Authorization,X-Admin-Key",
      ...extra
    }
  });
}

function text(data,status=200){
  return new Response(data,{
    status,
    headers:{
      "content-type":"text/plain; charset=utf-8",
      "access-control-allow-origin":"*"
    }
  });
}

function html(data,status=200){
  return new Response(data,{
    status,
    headers:{
      "content-type":"text/html; charset=utf-8"
    }
  });
}

async function bodyJSON(request){
  try{
    return await request.json();
  }catch{
    return {};
  }
}

function cookie(request,name){
  const value=request.headers.get("Cookie")||"";

  for(const part of value.split(";")){
    const p=part.trim();

    if(p.startsWith(name+"=")){
      return decodeURIComponent(
        p.slice(name.length+1)
      );
    }
  }

  return "";
}

function sessionCookie(token){
  return [
    `sbs_session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=2592000"
  ].join("; ");
}

function clearSessionCookie(){
  return [
    "sbs_session=",
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0"
  ].join("; ");
}

function baseUrl(request,env){
  return clean(
    env.PUBLIC_URL || new URL(request.url).origin,
    500
  ).replace(/\/$/,"");
}

async function sha256(value){
  const bytes=new TextEncoder().encode(String(value));

  const hash=await crypto.subtle.digest(
    "SHA-256",
    bytes
  );

  return [...new Uint8Array(hash)]
    .map(x=>x.toString(16).padStart(2,"0"))
    .join("");
}

function money(value){
  return Number(value||0).toFixed(2);
}

function escapeHtml(value){
  return String(value??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

// ================================================================
// PAYFAST MD5
// ================================================================

function md5(string){

  function rl(x,n){
    return (x<<n)|(x>>>(32-n));
  }

  function au(x,y){
    const x4=x&0x40000000;
    const y4=y&0x40000000;
    const x8=x&0x80000000;
    const y8=y&0x80000000;

    const r=(x&0x3fffffff)+(y&0x3fffffff);

    if(x4&y4)
      return r^0x80000000^x8^y8;

    if(x4|y4){
      if(r&0x40000000)
        return r^0xc0000000^x8^y8;

      return r^0x40000000^x8^y8;
    }

    return r^x8^y8;
  }

  function F(x,y,z){
    return (x&y)|(~x&z);
  }

  function G(x,y,z){
    return (x&z)|(y&~z);
  }

  function H(x,y,z){
    return x^y^z;
  }

  function I(x,y,z){
    return y^(x|~z);
  }

  function step(fn,a,b,c,d,x,s,ac){
    a=au(a,au(au(fn(b,c,d),x),ac));
    return au(rl(a,s),b);
  }

  function words(str){
    const n=((str.length+8)>>6)+1;
    const a=new Array(n*16).fill(0);

    let i=0;

    while(i<str.length){
      a[i>>2]|=str.charCodeAt(i)<<((i%4)*8);
      i++;
    }

    a[i>>2]|=0x80<<((i%4)*8);
    a[a.length-2]=str.length<<3;
    a[a.length-1]=str.length>>>29;

    return a;
  }

  function hex(v){
    let s="";

    for(let i=0;i<4;i++){
      const b=(v>>>(i*8))&255;
      s+=("0"+b.toString(16)).slice(-2);
    }

    return s;
  }

  const x=words(
    unescape(encodeURIComponent(string))
  );

  let a=0x67452301;
  let b=0xefcdab89;
  let c=0x98badcfe;
  let d=0x10325476;

  for(let k=0;k<x.length;k+=16){

    const A=a;
    const B=b;
    const C=c;
    const D=d;

    a=step(F,a,b,c,d,x[k],7,0xd76aa478);
    d=step(F,d,a,b,c,x[k+1],12,0xe8c7b756);
    c=step(F,c,d,a,b,x[k+2],17,0x242070db);
    b=step(F,b,c,d,a,x[k+3],22,0xc1bdceee);

    a=step(F,a,b,c,d,x[k+4],7,0xf57c0faf);
    d=step(F,d,a,b,c,x[k+5],12,0x4787c62a);
    c=step(F,c,d,a,b,x[k+6],17,0xa8304613);
    b=step(F,b,c,d,a,x[k+7],22,0xfd469501);

    a=step(F,a,b,c,d,x[k+8],7,0x698098d8);
    d=step(F,d,a,b,c,x[k+9],12,0x8b44f7af);
    c=step(F,c,d,a,b,x[k+10],17,0xffff5bb1);
    b=step(F,b,c,d,a,x[k+11],22,0x895cd7be);

    a=step(F,a,b,c,d,x[k+12],7,0x6b901122);
    d=step(F,d,a,b,c,x[k+13],12,0xfd987193);
    c=step(F,c,d,a,b,x[k+14],17,0xa679438e);
    b=step(F,b,c,d,a,x[k+15],22,0x49b40821);

    a=step(G,a,b,c,d,x[k+1],5,0xf61e2562);
    d=step(G,d,a,b,c,x[k+6],9,0xc040b340);
    c=step(G,c,d,a,b,x[k+11],14,0x265e5a51);
    b=step(G,b,c,d,a,x[k],20,0xe9b6c7aa);

    a=step(G,a,b,c,d,x[k+5],5,0xd62f105d);
    d=step(G,d,a,b,c,x[k+10],9,0x02441453);
    c=step(G,c,d,a,b,x[k+15],14,0xd8a1e681);
    b=step(G,b,c,d,a,x[k+4],20,0xe7d3fbc8);

    a=step(G,a,b,c,d,x[k+9],5,0x21e1cde6);
    d=step(G,d,a,b,c,x[k+14],9,0xc33707d6);
    c=step(G,c,d,a,b,x[k+3],14,0xf4d50d87);
    b=step(G,b,c,d,a,x[k+8],20,0x455a14ed);

    a=step(G,a,b,c,d,x[k+13],5,0xa9e3e905);
    d=step(G,d,a,b,c,x[k+2],9,0xfcefa3f8);
    c=step(G,c,d,a,b,x[k+7],14,0x676f02d9);
    b=step(G,b,c,d,a,x[k+12],20,0x8d2a4c8a);

    a=step(H,a,b,c,d,x[k+5],4,0xfffa3942);
    d=step(H,d,a,b,c,x[k+8],11,0x8771f681);
    c=step(H,c,d,a,b,x[k+11],16,0x6d9d6122);
    b=step(H,b,c,d,a,x[k+14],23,0xfde5380c);

    a=step(H,a,b,c,d,x[k+1],4,0xa4beea44);
    d=step(H,d,a,b,c,x[k+4],11,0x4bdecfa9);
    c=step(H,c,d,a,b,x[k+7],16,0xf6bb4b60);
    b=step(H,b,c,d,a,x[k+10],23,0xbebfbc70);

    a=step(H,a,b,c,d,x[k+13],4,0x289b7ec6);
    d=step(H,d,a,b,c,x[k],11,0xeaa127fa);
    c=step(H,c,d,a,b,x[k+3],16,0xd4ef3085);
    b=step(H,b,c,d,a,x[k+6],23,0x04881d05);

    a=step(H,a,b,c,d,x[k+9],4,0xd9d4d039);
    d=step(H,d,a,b,c,x[k+12],11,0xe6db99e5);
    c=step(H,c,d,a,b,x[k+15],16,0x1fa27cf8);
    b=step(H,b,c,d,a,x[k+2],23,0xc4ac5665);

    a=step(I,a,b,c,d,x[k],6,0xf4292244);
    d=step(I,d,a,b,c,x[k+7],10,0x432aff97);
    c=step(I,c,d,a,b,x[k+14],15,0xab9423a7);
    b=step(I,b,c,d,a,x[k+5],21,0xfc93a039);

    a=step(I,a,b,c,d,x[k+12],6,0x655b59c3);
    d=step(I,d,a,b,c,x[k+3],10,0x8f0ccc92);
    c=step(I,c,d,a,b,x[k+10],15,0xffeff47d);
    b=step(I,b,c,d,a,x[k+1],21,0x85845dd1);

    a=step(I,a,b,c,d,x[k+8],6,0x6fa87e4f);
    d=step(I,d,a,b,c,x[k+15],10,0xfe2ce6e0);
    c=step(I,c,d,a,b,x[k+6],15,0xa3014314);
    b=step(I,b,c,d,a,x[k+13],21,0x4e0811a1);

    a=step(I,a,b,c,d,x[k+4],6,0xf7537e82);
    d=step(I,d,a,b,c,x[k+11],10,0xbd3af235);
    c=step(I,c,d,a,b,x[k+2],15,0x2ad7d2bb);
    b=step(I,b,c,d,a,x[k+9],21,0xeb86d391);

    a=au(a,A);
    b=au(b,B);
    c=au(c,C);
    d=au(d,D);
  }

  return (
    hex(a)+hex(b)+hex(c)+hex(d)
  ).toLowerCase();
}

// ================================================================
// PAYFAST
// ================================================================

function payfastHost(env){
  return String(env.PAYFAST_SANDBOX||"")
    .toLowerCase()==="true"
    ? "https://sandbox.payfast.co.za"
    : "https://www.payfast.co.za";
}

function payfastSignature(fields,passphrase=""){
  const keys=Object.keys(fields)
    .filter(k=>
      k!=="signature" &&
      fields[k]!==undefined &&
      fields[k]!==null
    )
    .sort();

  let s=keys.map(k=>{
    const value=encodeURIComponent(
      String(fields[k]).trim()
    ).replace(/%20/g,"+");

    return `${k}=${value}`;
  }).join("&");

  if(passphrase){
    s+="&passphrase="+encodeURIComponent(
      passphrase
    ).replace(/%20/g,"+");
  }

  return md5(s);
}

function payfastFields(fields,env){
  const out={};

  for(const [key,value] of Object.entries(fields)){
    if(
      value!==undefined &&
      value!==null &&
      value!==""
    ){
      out[key]=String(value);
    }
  }

  out.signature=payfastSignature(
    out,
    env.PAYFAST_PASSPHRASE||""
  );

  return out;
}

function payfastForm(fields,env){
  const action=payfastHost(env)+"/eng/process";

  const inputs=Object.entries(fields)
    .map(([key,value])=>
      `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}">`
    ).join("");

  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sky Blue PayFast</title>
<style>
body{
font-family:Arial;
background:#f3f7fb;
display:flex;
align-items:center;
justify-content:center;
min-height:100vh
}
.box{
background:#fff;
padding:30px;
border-radius:18px;
text-align:center;
box-shadow:0 10px 35px #0001
}
button{
background:#0866d8;
color:#fff;
border:0;
padding:14px 25px;
border-radius:10px
}
</style>
</head>
<body>
<div class="box">
<h2>Sky Blue Digital Service</h2>
<p>Redirecting to PayFast...</p>
<form id="pf" method="post" action="${action}">
${inputs}
<noscript><button>Continue to PayFast</button></noscript>
</form>
</div>
<script>
document.getElementById("pf").submit();
</script>
</body>
</html>`;
}

// ================================================================
// AUTH DATABASE
// ================================================================

async function ensureAuthSchema(db){

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS customer_accounts(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS customer_sessions(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    )
  `).run();

  try{
    const info=await db.prepare(
      `PRAGMA table_info(customer_accounts)`
    ).all();

    const cols=new Set(
      (info.results||[]).map(x=>x.name)
    );

    if(!cols.has("status")){
      try{
        await db.prepare(
          `ALTER TABLE customer_accounts
           ADD COLUMN status TEXT DEFAULT 'ACTIVE'`
        ).run();
      }catch{}
    }

    if(!cols.has("updated_at")){
      try{
        await db.prepare(
          `ALTER TABLE customer_accounts
           ADD COLUMN updated_at TEXT`
        ).run();
      }catch{}
    }
  }catch{}

  await db.prepare(`
    UPDATE customer_accounts
    SET status='ACTIVE'
    WHERE status IS NULL OR status=''
  `).run();

  await db.prepare(`
    UPDATE customer_accounts
    SET updated_at=created_at
    WHERE updated_at IS NULL OR updated_at=''
  `).run();

  try{
    await db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      idx_customer_sessions_token
      ON customer_sessions(token)
    `).run();
  }catch{}
}

// ================================================================
// APPLICATION DATABASE
// ================================================================

async function schema(db){

  const statements=[

`CREATE TABLE IF NOT EXISTS business_profiles(
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
)`,

`CREATE TABLE IF NOT EXISTS subscriptions(
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
)`,

`CREATE TABLE IF NOT EXISTS saas_payments(
id INTEGER PRIMARY KEY AUTOINCREMENT,
account_id INTEGER NOT NULL,
payment_id TEXT UNIQUE NOT NULL,
amount REAL DEFAULT 0,
status TEXT DEFAULT 'PENDING',
raw_status TEXT,
payment_data TEXT,
created_at TEXT,
updated_at TEXT
)`,

`CREATE TABLE IF NOT EXISTS business_services(
id INTEGER PRIMARY KEY AUTOINCREMENT,
account_id INTEGER NOT NULL,
service_name TEXT NOT NULL,
description TEXT,
price REAL DEFAULT 0,
status TEXT DEFAULT 'ACTIVE',
created_at TEXT,
updated_at TEXT
)`,

`CREATE TABLE IF NOT EXISTS products(
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
)`,

`CREATE TABLE IF NOT EXISTS ecommerce_stores(
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
)`,

`CREATE TABLE IF NOT EXISTS ecommerce_categories(
id INTEGER PRIMARY KEY AUTOINCREMENT,
account_id INTEGER NOT NULL,
name TEXT NOT NULL,
description TEXT,
created_at TEXT,
updated_at TEXT
)`,

`CREATE TABLE IF NOT EXISTS ecommerce_orders(
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
)`,

`CREATE TABLE IF NOT EXISTS reports(
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
)`,

`CREATE TABLE IF NOT EXISTS report_updates(
id INTEGER PRIMARY KEY AUTOINCREMENT,
report_id INTEGER NOT NULL,
update_text TEXT,
status TEXT,
created_at TEXT
)`,

`CREATE TABLE IF NOT EXISTS departments(
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT UNIQUE NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS whatsapp_conversations(
id INTEGER PRIMARY KEY AUTOINCREMENT,
phone TEXT,
direction TEXT,
message_type TEXT,
message_text TEXT,
media_url TEXT,
payload TEXT,
created_at TEXT
)`,

`CREATE TABLE IF NOT EXISTS saas_modules(
id INTEGER PRIMARY KEY AUTOINCREMENT,
account_id INTEGER NOT NULL,
module_code TEXT NOT NULL,
status TEXT DEFAULT 'ACTIVE',
created_at TEXT,
updated_at TEXT,
UNIQUE(account_id,module_code)
)`,

`CREATE TABLE IF NOT EXISTS admin_audit_logs(
id INTEGER PRIMARY KEY AUTOINCREMENT,
account_id INTEGER,
action TEXT,
details TEXT,
created_at TEXT
)`
  ];

  for(const sql of statements){
    try{
      await db.prepare(sql).run();
    }catch(error){
      console.error(
        "Schema error:",
        error?.message||error
      );
    }
  }

  const departments=[
    "Electricity",
    "Water & Sewer",
    "Roads & Stormwater",
    "Waste Management",
    "General Services"
  ];

  for(const name of departments){
    try{
      await db.prepare(
        `INSERT OR IGNORE INTO departments(name)
         VALUES(?)`
      ).bind(name).run();
    }catch{}
  }
}

// ================================================================
// SESSION
// ================================================================

async function accountFromSession(request,db){

  const token=cookie(
    request,
    "sbs_session"
  );

  if(!token)return null;

  try{
    return await db.prepare(`
      SELECT a.*
      FROM customer_accounts a
      JOIN customer_sessions s
      ON s.account_id=a.id
      WHERE s.token=?
      AND s.expires_at>?
      AND a.status='ACTIVE'
      LIMIT 1
    `).bind(
      token,
      now()
    ).first();
  }catch(error){
    console.error(
      "Session lookup:",
      error?.message||error
    );

    return null;
  }
}

// ================================================================
// REGISTER - FIXED
// ================================================================

async function register(request,db){

  await ensureAuthSchema(db);
  await schema(db);

  const d=await bodyJSON(request);

  const email=clean(
    d.email,
    200
  ).toLowerCase();

  const password=String(
    d.password||""
  );

  const businessName=clean(
    d.business_name||
    d.businessName,
    200
  );

  const fullName=clean(
    d.full_name||
    d.fullName||
    d.owner_name,
    200
  );

  const phone=clean(
    d.phone,
    50
  );

  if(
    !email||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ){
    return json({
      ok:false,
      error:"A valid business email is required."
    },400);
  }

  if(password.length<8){
    return json({
      ok:false,
      error:"Password must contain at least 8 characters."
    },400);
  }

  if(!businessName||!fullName||!phone){
    return json({
      ok:false,
      error:
        "Business name, full name and phone number are required."
    },400);
  }

  const existing=await db.prepare(`
    SELECT id
    FROM customer_accounts
    WHERE LOWER(email)=?
    LIMIT 1
  `).bind(email).first();

  if(existing){
    return json({
      ok:false,
      error:
        "An account with this email already exists. Please sign in or use Forgot Password."
    },409);
  }

  const timestamp=now();
  const hash=await sha256(password);

  let accountId=0;

  try{

    const result=await db.prepare(`
      INSERT INTO customer_accounts(
        email,
        password_hash,
        status,
        created_at,
        updated_at
      )
      VALUES(?,?,?,?,?)
    `).bind(
      email,
      hash,
      "ACTIVE",
      timestamp,
      timestamp
    ).run();

    accountId=Number(
      result.meta.last_row_id||0
    );

    await db.prepare(`
      INSERT INTO business_profiles(
        account_id,
        business_name,
        owner_name,
        email,
        phone,
        created_at,
        updated_at
      )
      VALUES(?,?,?,?,?,?,?)
    `).bind(
      accountId,
      businessName,
      fullName,
      email,
      phone,
      timestamp,
      timestamp
    ).run();

    return json({
      ok:true,
      account_id:accountId,
      message:"Account created successfully."
    });

  }catch(error){

    if(accountId){
      try{
        await db.prepare(
          `DELETE FROM customer_accounts
           WHERE id=?`
        ).bind(accountId).run();
      }catch{}
    }

    console.error(
      "REGISTER:",
      error
    );

    return json({
      ok:false,
      error:"Account could not be created.",
      detail:String(
        error?.message||error
      )
    },500);
  }
}

// ================================================================
// LOGIN - FIXED
// ================================================================

async function login(request,db){

  await ensureAuthSchema(db);
  await schema(db);

  const d=await bodyJSON(request);

  const email=clean(
    d.email,
    200
  ).toLowerCase();

  const password=String(
    d.password||""
  );

  if(!email||!password){
    return json({
      ok:false,
      error:"Email and password are required."
    },400);
  }

  const hash=await sha256(password);

  let account;

  try{

    account=await db.prepare(`
      SELECT
        id,
        email,
        status,
        created_at,
        updated_at
      FROM customer_accounts
      WHERE LOWER(email)=?
      AND password_hash=?
      AND status='ACTIVE'
      LIMIT 1
    `).bind(
      email,
      hash
    ).first();

  }catch(error){

    console.error(
      "LOGIN QUERY:",
      error
    );

    return json({
      ok:false,
      error:"Login database error."
    },500);
  }

  if(!account){

    return json({
      ok:false,
      error:
        "Email or password not recognized. If this is an older Sky Blue account, use Forgot Password to reset it."
    },401);
  }

  // Automatically repair old accounts
  try{

    const profile=await db.prepare(`
      SELECT id
      FROM business_profiles
      WHERE account_id=?
      LIMIT 1
    `).bind(
      account.id
    ).first();

    if(!profile){

      await db.prepare(`
        INSERT INTO business_profiles(
          account_id,
          business_name,
          owner_name,
          email,
          phone,
          created_at,
          updated_at
        )
        VALUES(?,?,?,?,?,?,?)
      `).bind(
        account.id,
        "",
        "",
        account.email,
        "",
        now(),
        now()
      ).run();
    }

  }catch(error){

    console.error(
      "PROFILE MIGRATION:",
      error
    );
  }

  const token=
    crypto.randomUUID()+
    crypto.randomUUID();

  const expires=
    new Date(
      Date.now()+2592000000
    ).toISOString();

  try{

    await db.prepare(`
      INSERT INTO customer_sessions(
        account_id,
        token,
        expires_at,
        created_at
      )
      VALUES(?,?,?,?)
    `).bind(
      account.id,
      token,
      expires,
      now()
    ).run();

  }catch(error){

    console.error(
      "SESSION INSERT:",
      error
    );

    return json({
      ok:false,
      error:
        "Login session could not be created."
    },500);
  }

  return json({
    ok:true,
    authenticated:true,
    account:{
      id:account.id,
      email:account.email,
      status:account.status
    }
  },200,{
    "Set-Cookie":sessionCookie(token)
  });
}

// ================================================================
// LOGOUT
// ================================================================

async function logout(request,db){

  const token=cookie(
    request,
    "sbs_session"
  );

  if(token){

    try{
      await db.prepare(`
        DELETE FROM customer_sessions
        WHERE token=?
      `).bind(token).run();
    }catch{}
  }

  return json({
    ok:true,
    logged_out:true
  },200,{
    "Set-Cookie":clearSessionCookie()
  });
}

// ================================================================
// FORGOT PASSWORD
// ================================================================

async function forgotPassword(request,db){

  await ensureAuthSchema(db);
  await schema(db);

  const d=await bodyJSON(request);

  const email=clean(
    d.email,
    200
  ).toLowerCase();

  const phone=clean(
    d.phone,
    50
  );

  if(!email||!phone){
    return json({
      ok:false,
      error:"Email and phone number are required."
    },400);
  }

  const account=await db.prepare(`
    SELECT
      a.id,
      a.email,
      p.phone
    FROM customer_accounts a
    JOIN business_profiles p
      ON p.account_id=a.id
    WHERE LOWER(a.email)=?
      AND p.phone=?
      AND a.status='ACTIVE'
    LIMIT 1
  `).bind(
    email,
    phone
  ).first();

  if(!account){

    return json({
      ok:false,
      error:
        "We could not verify the email and phone number."
    },404);
  }

  await db.prepare(`
    DELETE FROM password_reset_tokens
    WHERE account_id=?
       OR expires_at<?
  `).bind(
    account.id,
    now()
  ).run();

  const token=
    crypto.randomUUID()+
    crypto.randomUUID();

  const tokenHash=
    await sha256(token);

  const expires=
    new Date(
      Date.now()+15*60*1000
    ).toISOString();

  await db.prepare(`
    INSERT INTO password_reset_tokens(
      account_id,
      token_hash,
      expires_at,
      created_at
    )
    VALUES(?,?,?,?)
  `).bind(
    account.id,
    tokenHash,
    expires,
    now()
  ).run();

  const resetUrl=
    baseUrl(request,globalThis.__SB_ENV||{})+
    "/reset-password.html?token="+
    encodeURIComponent(token);

  return json({
    ok:true,
    message:
      "Identity verified. Your password reset link is ready.",
    reset_url:resetUrl,
    expires_at:expires
  });
}

// ================================================================
// RESET PASSWORD
// ================================================================

async function resetPassword(request,db){

  await ensureAuthSchema(db);

  const d=await bodyJSON(request);

  const token=clean(
    d.token,
    500
  );

  const password=String(
    d.password||""
  );

  if(!token){
    return json({
      ok:false,
      error:"Reset token is required."
    },400);
  }

  if(password.length<8){
    return json({
      ok:false,
      error:
        "Password must contain at least 8 characters."
    },400);
  }

  const tokenHash=
    await sha256(token);

  const row=await db.prepare(`
    SELECT
      id,
      account_id
    FROM password_reset_tokens
    WHERE token_hash=?
      AND used_at IS NULL
      AND expires_at>?
    LIMIT 1
  `).bind(
    tokenHash,
    now()
  ).first();

  if(!row){
    return json({
      ok:false,
      error:
        "This reset link is invalid or has expired."
    },400);
  }

  const passwordHash=
    await sha256(password);

  await db.prepare(`
    UPDATE customer_accounts
    SET password_hash=?,
        updated_at=?
    WHERE id=?
  `).bind(
    passwordHash,
    now(),
    row.account_id
  ).run();

  await db.prepare(`
    UPDATE password_reset_tokens
    SET used_at=?
    WHERE id=?
  `).bind(
    now(),
    row.id
  ).run();

  await db.prepare(`
    DELETE FROM customer_sessions
    WHERE account_id=?
  `).bind(
    row.account_id
  ).run();

  return json({
    ok:true,
    message:
      "Password changed successfully. You can now sign in."
  });
}

// ================================================================
// CUSTOMER DASHBOARD
// ================================================================

async function customerDashboard(db,account){

  const profile=await db.prepare(`
    SELECT *
    FROM business_profiles
    WHERE account_id=?
    LIMIT 1
  `).bind(
    account.id
  ).first();

  const subscriptions=await db.prepare(`
    SELECT *
    FROM subscriptions
    WHERE account_id=?
    ORDER BY id DESC
  `).bind(
    account.id
  ).all();

  const modules=await db.prepare(`
    SELECT *
    FROM saas_modules
    WHERE account_id=?
    ORDER BY id DESC
  `).bind(
    account.id
  ).all();

  const products=await db.prepare(`
    SELECT COUNT(*) AS total
    FROM products
    WHERE account_id=?
  `).bind(
    account.id
  ).first();

  const orders=await db.prepare(`
    SELECT COUNT(*) AS total
    FROM ecommerce_orders
    WHERE account_id=?
  `).bind(
    account.id
  ).first();

  return {
    account:{
      id:account.id,
      email:account.email,
      status:account.status
    },
    profile:profile||null,
    subscriptions:subscriptions.results||[],
    modules:modules.results||[],
    statistics:{
      products:Number(products?.total||0),
      orders:Number(orders?.total||0)
    }
  };
}

// ================================================================
// PROFILE
// ================================================================

async function saveProfile(request,db,account){

  const d=await bodyJSON(request);

  const businessName=clean(
    d.business_name||d.businessName,
    200
  );

  const ownerName=clean(
    d.owner_name||d.full_name||d.fullName,
    200
  );

  const phone=clean(
    d.phone,
    50
  );

  const whatsapp=clean(
    d.whatsapp||phone,
    50
  );

  const address=clean(
    d.address,
    500
  );

  const city=clean(
    d.city,
    100
  );

  const province=clean(
    d.province,
    100
  );

  const website=clean(
    d.website,
    500
  );

  const existing=await db.prepare(`
    SELECT id
    FROM business_profiles
    WHERE account_id=?
    LIMIT 1
  `).bind(
    account.id
  ).first();

  if(existing){

    await db.prepare(`
      UPDATE business_profiles
      SET business_name=?,
          owner_name=?,
          phone=?,
          whatsapp=?,
          address=?,
          city=?,
          province=?,
          website=?,
          updated_at=?
      WHERE account_id=?
    `).bind(
      businessName,
      ownerName,
      phone,
      whatsapp,
      address,
      city,
      province,
      website,
      now(),
      account.id
    ).run();

  }else{

    await db.prepare(`
      INSERT INTO business_profiles(
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
        created_at,
        updated_at
      )
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      account.id,
      businessName,
      ownerName,
      account.email,
      phone,
      whatsapp,
      address,
      city,
      province,
      website,
      now(),
      now()
    ).run();
  }

  return json({
    ok:true,
    message:"Business profile saved."
  });
}

// ================================================================
// PRODUCTS
// ================================================================

async function productAction(request,db,account){

  if(request.method==="GET"){

    const result=await db.prepare(`
      SELECT *
      FROM products
      WHERE account_id=?
      ORDER BY id DESC
    `).bind(
      account.id
    ).all();

    return json({
      ok:true,
      products:result.results||[]
    });
  }

  const d=await bodyJSON(request);

  const name=clean(
    d.name,
    200
  );

  if(!name){
    return json({
      ok:false,
      error:"Product name is required."
    },400);
  }

  await db.prepare(`
    INSERT INTO products(
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
    name,
    clean(d.description,1000),
    Number(d.price||0),
    Number(d.stock||0),
    clean(d.sku,100),
    clean(d.image_url,1000),
    "ACTIVE",
    now(),
    now()
  ).run();

  return json({
    ok:true,
    message:"Product saved."
  });
}

// ================================================================
// SERVICES
// ================================================================

async function serviceAction(request,db,account){

  const d=await bodyJSON(request);

  const name=clean(
    d.service_name||d.name,
    200
  );

  if(!name){
    return json({
      ok:false,
      error:"Service name is required."
    },400);
  }

  await db.prepare(`
    INSERT INTO business_services(
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
    name,
    clean(d.description,1000),
    Number(d.price||0),
    "ACTIVE",
    now(),
    now()
  ).run();

  return json({
    ok:true,
    message:"Service saved."
  });
}

// ================================================================
// ECOMMERCE STORE
// ================================================================

async function saveStore(request,db,account){

  const d=await bodyJSON(request);

  const storeName=clean(
    d.store_name||d.storeName,
    200
  );

  let slug=clean(
    d.slug||storeName,
    100
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-|-$/g,"");

  if(!slug)
    slug="store-"+account.id;

  const existing=await db.prepare(`
    SELECT id
    FROM ecommerce_stores
    WHERE account_id=?
    LIMIT 1
  `).bind(
    account.id
  ).first();

  try{

    if(existing){

      await db.prepare(`
        UPDATE ecommerce_stores
        SET store_name=?,
            slug=?,
            description=?,
            logo_url=?,
            primary_color=?,
            secondary_color=?,
            updated_at=?
        WHERE account_id=?
      `).bind(
        storeName,
        slug,
        clean(d.description,1000),
        clean(d.logo_url,1000),
        clean(d.primary_color,30)||"#0b63ce",
        clean(d.secondary_color,30)||"#083b78",
        now(),
        account.id
      ).run();

    }else{

      await db.prepare(`
        INSERT INTO ecommerce_stores(
          account_id,
          store_name,
          slug,
          description,
          logo_url,
          primary_color,
          secondary_color,
          status,
          created_at,
          updated_at
        )
        VALUES(?,?,?,?,?,?,?,?,?,?)
      `).bind(
        account.id,
        storeName,
        slug,
        clean(d.description,1000),
        clean(d.logo_url,1000),
        clean(d.primary_color,30)||"#0b63ce",
        clean(d.secondary_color,30)||"#083b78",
        "ACTIVE",
        now(),
        now()
      ).run();
    }

  }catch(error){

    return json({
      ok:false,
      error:"Store could not be saved.",
      detail:String(
        error?.message||error
      )
    },500);
  }

  return json({
    ok:true,
    slug,
    url:`/store/${slug}`
  });
}

// ================================================================
// ORDERS
// ================================================================

async function ecommerceOrders(request,db,account){

  if(request.method==="GET"){

    const result=await db.prepare(`
      SELECT *
      FROM ecommerce_orders
      WHERE account_id=?
      ORDER BY id DESC
    `).bind(
      account.id
    ).all();

    return json({
      ok:true,
      orders:result.results||[]
    });
  }

  const d=await bodyJSON(request);

  const items=Array.isArray(d.items)
    ?d.items
    :[];

  const subtotal=items.reduce(
    (sum,item)=>
      sum+
      Number(item.price||0)*
      Number(item.quantity||1),
    0
  );

  const delivery=Number(
    d.delivery_fee||0
  );

  const orderNumber=
    "SBS-"+Date.now();

  await db.prepare(`
    INSERT INTO ecommerce_orders(
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
    clean(d.customer_name,200),
    clean(d.customer_email,200),
    clean(d.customer_phone,50),
    JSON.stringify(items),
    subtotal,
    delivery,
    subtotal+delivery,
    "PENDING",
    "NEW",
    clean(d.delivery_method,50),
    clean(d.delivery_address,500),
    now(),
    now()
  ).run();

  return json({
    ok:true,
    order_number:orderNumber,
    total:money(subtotal+delivery),
    payment_required:true
  });
}

// ================================================================
// REPORTS
// ================================================================

function reportDepartment(category){

  const x=String(
    category||""
  ).toLowerCase();

  if(
    x.includes("electric")||
    x.includes("power")
  )return 1;

  if(
    x.includes("water")||
    x.includes("drain")||
    x.includes("sewer")
  )return 2;

  if(
    x.includes("road")||
    x.includes("pothole")||
    x.includes("storm")
  )return 3;

  if(
    x.includes("waste")||
    x.includes("dump")||
    x.includes("rubbish")
  )return 4;

  return 5;
}

async function createReport(request,db,account){

  const d=await bodyJSON(request);

  const count=await db.prepare(`
    SELECT COUNT(*) AS total
    FROM reports
  `).first();

  const number=
    `${PREFIX}-AX-${String(
      Number(count?.total||0)+1
    ).padStart(6,"0")}`;

  const category=clean(
    d.category,
    100
  );

  await db.prepare(`
    INSERT INTO reports(
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
    number,
    account?.id||null,
    category,
    clean(d.description,2000),
    clean(d.location,500),
    clean(d.priority||"Normal",30),
    clean(d.source||"Web",30),
    "OPEN",
    now(),
    now()
  ).run();

  return json({
    ok:true,
    report_number:number,
    department_id:
      reportDepartment(category),
    status:"OPEN"
  });
}

// ================================================================
// WHATSAPP
// ================================================================

async function sendWhatsApp(
  env,
  phone,
  message
){

  if(
    !env.WHATSAPP_ACCESS_TOKEN||
    !env.WHATSAPP_PHONE_NUMBER_ID
  ){
    return {
      ok:false,
      error:
        "WhatsApp credentials are not configured."
    };
  }

  const response=await fetch(
    `https://graph.facebook.com/v23.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method:"POST",
      headers:{
        "content-type":"application/json",
        authorization:
          `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`
      },
      body:JSON.stringify({
        messaging_product:"whatsapp",
        to:phone,
        type:"text",
        text:{
          body:message
        }
      })
    }
  );

  let result={};

  try{
    result=await response.json();
  }catch{}

  return {
    ok:response.ok,
    result
  };
}

async function whatsappWebhook(
  request,
  db,
  env
){

  if(request.method==="GET"){

    const u=new URL(request.url);

    if(
      u.searchParams.get("hub.mode")==="subscribe" &&
      u.searchParams.get("hub.verify_token")===
        env.WHATSAPP_VERIFY_TOKEN
    ){
      return text(
        u.searchParams.get(
          "hub.challenge"
        )||""
      );
    }

    return text(
      "Verification failed",
      403
    );
  }

  let payload={};

  try{
    payload=await request.json();
  }catch{
    return json({
      ok:false,
      error:"Invalid WhatsApp payload."
    },400);
  }

  for(
    const entry of payload.entry||[]
  ){

    for(
      const change of entry.changes||[]
    ){

      for(
        const message of
        change.value?.messages||[]
      ){

        const type=message.type||"";
        let messageText="";
        let mediaUrl="";

        if(type==="text")
          messageText=
            message.text?.body||"";

        if(type==="image")
          mediaUrl=
            message.image?.id||"";

        if(type==="video")
          mediaUrl=
            message.video?.id||"";

        if(type==="audio")
          mediaUrl=
            message.audio?.id||"";

        try{

          await db.prepare(`
            INSERT INTO whatsapp_conversations(
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
            message.from||"",
            "INBOUND",
            type,
            messageText,
            mediaUrl,
            JSON.stringify(message),
            now()
          ).run();

        }catch(error){

          console.error(
            "WhatsApp DB:",
            error
          );
        }
      }
    }
  }

  return json({
    ok:true
  });
}

// ================================================================
// PAYFAST CHECKOUT
// ================================================================

async function checkout(
  request,
  db,
  env,
  account
){

  if(!account){

    return json({
      ok:false,
      error:"Authentication required."
    },401);
  }

  const d=await bodyJSON(request);

  const code=clean(
    d.product_code||d.code,
    50
  );

  const product=
    CATALOG[code];

  if(!product){

    return json({
      ok:false,
      error:"Invalid product."
    },400);
  }

  const amount=Number(
    d.amount||product.price
  );

  const reference=
    "SBS-"+account.id+"-"+Date.now();

  await db.prepare(`
    INSERT INTO subscriptions(
      account_id,
      product_code,
      product_name,
      amount,
      frequency,
      status,
      created_at,
      updated_at
    )
    VALUES(?,?,?,?,?,?,?,?)
  `).bind(
    account.id,
    product.code,
    product.name,
    amount,
    product.frequency,
    "PENDING",
    now(),
    now()
  ).run();

  const origin=baseUrl(
    request,
    env
  );

  const fields=payfastFields({
    merchant_id:
      env.PAYFAST_MERCHANT_ID||"",
    merchant_key:
      env.PAYFAST_MERCHANT_KEY||"",
    return_url:
      `${origin}/payment-success.html`,
    cancel_url:
      `${origin}/payment-cancelled.html`,
    notify_url:
      `${origin}/api/payfast/itn`,
    name_first:
      clean(d.first_name||"Sky Blue",100),
    name_last:
      clean(d.last_name||"Customer",100),
    email_address:
      account.email,
    m_payment_id:
      reference,
    amount:
      amount.toFixed(2),
    item_name:
      product.name,
    item_description:
      `Sky Blue Digital Service - ${product.name}`
  },env);

  return html(
    payfastForm(
      fields,
      env
    )
  );
}

// ================================================================
// PAYFAST ITN
// ================================================================

async function payfastITN(
  request,
  db,
  env
){

  const raw=await request.text();
  const params=new URLSearchParams(raw);
  const data={};

  for(
    const [key,value]
    of params.entries()
  ){
    data[key]=value;
  }

  if(!data.m_payment_id){

    return json({
      ok:false,
      error:"Missing payment ID."
    },400);
  }

  const received=data.signature||"";

  const calculated=
    payfastSignature(
      data,
      env.PAYFAST_PASSPHRASE||""
    );

  if(
    received &&
    received!==calculated
  ){

    return json({
      ok:false,
      error:"Invalid PayFast signature."
    },400);
  }

  const paymentId=
    data.pf_payment_id||
    data.m_payment_id;

  const status=
    data.payment_status||
    "COMPLETE";

  const amount=Number(
    data.amount_gross||0
  );

  const subscription=await db.prepare(`
    SELECT *
    FROM subscriptions
    WHERE account_id=?
    ORDER BY id DESC
    LIMIT 1
  `).bind(
    Number(
      String(
        data.m_payment_id
      ).split("-")[1]||0
    )
  ).first();

  const accountId=
    Number(
      String(
        data.m_payment_id
      ).split("-")[1]||0
    );

  try{

    await db.prepare(`
      INSERT OR REPLACE INTO saas_payments(
        account_id,
        payment_id,
        amount,
        status,
        raw_status,
        payment_data,
        created_at,
        updated_at
      )
      VALUES(?,?,?,?,?,?,?,?)
    `).bind(
      accountId,
      paymentId,
      amount,
      status==="COMPLETE"
        ?"COMPLETE"
        :status,
      status,
      JSON.stringify(data),
      now(),
      now()
    ).run();

    if(status==="COMPLETE"){

      await db.prepare(`
        UPDATE subscriptions
        SET status='ACTIVE',
            payfast_payment_id=?,
            started_at=?,
            updated_at=?
        WHERE account_id=?
        AND status='PENDING'
      `).bind(
        paymentId,
        now(),
        now(),
        accountId
      ).run();

    }

  }catch(error){

    console.error(
      "PAYFAST ITN:",
      error
    );

    return json({
      ok:false,
      error:"Payment update failed."
    },500);
  }

  return json({
    ok:true,
    payment_id:paymentId,
    status
  });
}

// ================================================================
// ADMIN
// ================================================================

function adminAuthorized(
  request,
  env
){

  const key=clean(
    env.ADMIN_KEY,
    500
  );

  if(!key)return false;

  const supplied=
    request.headers.get(
      "X-Admin-Key"
    )||
    (
      request.headers.get(
        "Authorization"
      )||""
    ).replace(
      /^Bearer\s+/i,
      ""
    );

  return supplied===key;
}

function adminGuard(
  request,
  env
){

  if(
    adminAuthorized(
      request,
      env
    )
  ){
    return null;
  }

  return json({
    ok:false,
    error:"Unauthorized."
  },401);
}

async function adminDashboard(db){

  const customers=
    await db.prepare(`
      SELECT COUNT(*) AS total
      FROM customer_accounts
    `).first();

  const active=
    await db.prepare(`
      SELECT COUNT(*) AS total
      FROM subscriptions
      WHERE status='ACTIVE'
    `).first();

  const revenue=
    await db.prepare(`
      SELECT COALESCE(
        SUM(amount),0
      ) AS total
      FROM saas_payments
      WHERE status='COMPLETE'
    `).first();

  const orders=
    await db.prepare(`
      SELECT COUNT(*) AS total
      FROM ecommerce_orders
    `).first();

  const list=
    await db.prepare(`
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
    ok:true,
    stats:{
      customers:
        Number(customers?.total||0),
      active_subscriptions:
        Number(active?.total||0),
      revenue:
        Number(revenue?.total||0),
      orders:
        Number(orders?.total||0)
    },
    customers:list.results||[]
  });
}

async function adminCustomer(
  request,
  db
){

  const id=Number(
    new URL(request.url)
      .searchParams
      .get("account_id")||0
  );

  if(!id){

    return json({
      ok:false,
      error:"account_id is required."
    },400);
  }

  const account=
    await db.prepare(`
      SELECT *
      FROM customer_accounts
      WHERE id=?
    `).bind(id).first();

  if(!account){

    return json({
      ok:false,
      error:"Customer not found."
    },404);
  }

  return json({
    ok:true,
    dashboard:
      await customerDashboard(
        db,
        account
      )
  });
}

async function adminActivity(db){

  const result=
    await db.prepare(`
      SELECT *
      FROM admin_audit_logs
      ORDER BY id DESC
      LIMIT 200
    `).all();

  return json({
    ok:true,
    activity:
      result.results||[]
  });
}

// ================================================================
// PUBLIC STORE
// ================================================================

async function publicStore(
  db,
  slug
){

  const store=
    await db.prepare(`
      SELECT *
      FROM ecommerce_stores
      WHERE slug=?
      AND status='ACTIVE'
      LIMIT 1
    `).bind(slug).first();

  if(!store){

    return html(`
      <!doctype html>
      <html>
      <body style="font-family:Arial;padding:40px">
      <h1>Store not found</h1>
      <p>This store is unavailable.</p>
      </body>
      </html>
    `,404);
  }

  const result=
    await db.prepare(`
      SELECT *
      FROM products
      WHERE account_id=?
      AND status='ACTIVE'
      ORDER BY id DESC
    `).bind(
      store.account_id
    ).all();

  const cards=
    (result.results||[])
      .map(product=>`
        <article class="product">
        ${
          product.image_url
          ?`<img src="${escapeHtml(product.image_url)}">`
          :""
        }
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(
          product.description||""
        )}</p>
        <strong>
          R ${money(product.price)}
        </strong>
        </article>
      `).join("");

  return html(`
<!doctype html>
<html>
<head>
<meta name="viewport"
content="width=device-width,initial-scale=1">
<title>${escapeHtml(
  store.store_name
)}</title>
<style>
body{
margin:0;
font-family:Arial;
background:#f5f8fc;
color:#172033
}
header{
background:${escapeHtml(
  store.primary_color||"#0b63ce"
)};
color:#fff;
padding:30px
}
main{
max-width:1100px;
margin:auto;
padding:25px 18px
}
.grid{
display:grid;
grid-template-columns:
repeat(auto-fit,minmax(230px,1fr));
gap:18px
}
.product{
background:#fff;
border-radius:16px;
padding:18px;
box-shadow:0 4px 18px #0001
}
.product img{
width:100%;
height:180px;
object-fit:cover;
border-radius:12px
}
</style>
</head>
<body>
<header>
<h1>${escapeHtml(
  store.store_name
)}</h1>
<p>${escapeHtml(
  store.description||""
)}</p>
</header>
<main>
<h2>Products</h2>
<div class="grid">
${
  cards||
  "<p>No products available yet.</p>"
}
</div>
</main>
</body>
</html>
`);
}

// ================================================================
// CATALOG
// ================================================================

function catalogResponse(){

  return json({
    ok:true,
    app:APP,
    version:VERSION,
    products:Object.values(
      CATALOG
    ),
    modules:MODULES
  });
}

// ================================================================
// HEALTH
// ================================================================

function healthResponse(){

  return json({
    ok:true,
    status:"online",
    app:APP,
    version:VERSION,
    message:
      "Sky Blue Digital Service API is running."
  });
}

// ================================================================
// STATIC FILES
// ================================================================

async function serveStatic(
  request,
  env
){

  if(!env.ASSETS)
    return null;

  const url=
    new URL(request.url);

  if(
    url.pathname===
    "/owner-dashboard.html"
  ){

    const copy=
      new URL(request.url);

    copy.pathname=
      "/skyblue-admin.html";

    const result=
      await env.ASSETS.fetch(
        new Request(
          copy.toString(),
          request
        )
      );

    if(result.status!==404)
      return result;
  }

  const result=
    await env.ASSETS.fetch(
      request
    );

  if(result.status!==404)
    return result;

  return null;
}

// ================================================================
// ROUTER
// ================================================================

async function router(
  request,
  env
){

  const db=env.DB;

  if(!db){

    return json({
      ok:false,
      error:
        "D1 database binding DB is missing."
    },500);
  }

  // Make env available to reset URL helper.
  globalThis.__SB_ENV=env;

  const url=
    new URL(request.url);

  const path=
    url.pathname;

  const method=
    request.method;

  if(method==="OPTIONS"){

    return new Response(
      null,
      {
        status:204,
        headers:{
          "access-control-allow-origin":"*",
          "access-control-allow-methods":
            "GET,POST,PUT,PATCH,DELETE,OPTIONS",
          "access-control-allow-headers":
            "Content-Type,Authorization,X-Admin-Key"
        }
      }
    );
  }

  // --------------------------------------------------------------
  // AUTH
  // --------------------------------------------------------------

  if(
    path==="/api/auth/register" &&
    method==="POST"
  ){
    return register(
      request,
      db
    );
  }

  if(
    path==="/api/auth/login" &&
    method==="POST"
  ){
    return login(
      request,
      db
    );
  }

  if(
    path==="/api/auth/logout" &&
    method==="POST"
  ){
    return logout(
      request,
      db
    );
  }

  if(
    path==="/api/auth/forgot-password" &&
    method==="POST"
  ){
    return forgotPassword(
      request,
      db
    );
  }

  if(
    path==="/api/auth/reset-password" &&
    method==="POST"
  ){
    return resetPassword(
      request,
      db
    );
  }

  if(
    path==="/api/auth/me" &&
    method==="GET"
  ){

    await ensureAuthSchema(db);

    const account=
      await accountFromSession(
        request,
        db
      );

    if(!account){

      return json({
        ok:false,
        authenticated:false
      },401);
    }

    return json({
      ok:true,
      authenticated:true,
      account:{
        id:account.id,
        email:account.email,
        status:account.status
      }
    });
  }

  // --------------------------------------------------------------
  // DATABASE
  // --------------------------------------------------------------

  await schema(db);

  // --------------------------------------------------------------
  // STATIC
  // --------------------------------------------------------------

  if(
    method==="GET" &&
    !path.startsWith("/api/")
  ){

    const staticResponse=
      await serveStatic(
        request,
        env
      );

    if(staticResponse)
      return staticResponse;
  }

  // --------------------------------------------------------------
  // HEALTH
  // --------------------------------------------------------------

  if(
    path==="/api/health" &&
    method==="GET"
  ){
    return healthResponse();
  }

  if(
    path==="/api/catalog" &&
    method==="GET"
  ){
    return catalogResponse();
  }

  if(
    path==="/api/modules" &&
    method==="GET"
  ){
    return json({
      ok:true,
      modules:MODULES
    });
  }

  // --------------------------------------------------------------
  // CHECKOUT / PAYFAST
  // --------------------------------------------------------------

  if(
    path==="/api/checkout/start" &&
    method==="POST"
  ){

    const account=
      await accountFromSession(
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

  if(
    path==="/api/payfast/itn" &&
    method==="POST"
  ){

    return payfastITN(
      request,
      db,
      env
    );
  }

  // --------------------------------------------------------------
  // CUSTOMER DASHBOARD
  // --------------------------------------------------------------

  if(
    path==="/api/customer/dashboard" &&
    method==="GET"
  ){

    const account=
      await accountFromSession(
        request,
        db
      );

    if(!account){

      return json({
        ok:false,
        error:"Authentication required."
      },401);
    }

    return json({
      ok:true,
      dashboard:
        await customerDashboard(
          db,
          account
        )
    });
  }

  // --------------------------------------------------------------
  // BUSINESS PROFILE
  // --------------------------------------------------------------

  if(
    path==="/api/business/profile" &&
    method==="POST"
  ){

    const account=
      await accountFromSession(
        request,
        db
      );

    if(!account){

      return json({
        ok:false,
        error:"Authentication required."
      },401);
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

  if(
    path==="/api/products" &&
    (
      method==="GET"||
      method==="POST"
    )
  ){

    const account=
      await accountFromSession(
        request,
        db
      );

    if(!account){

      return json({
        ok:false,
        error:"Authentication required."
      },401);
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

  if(
    path==="/api/services" &&
    method==="POST"
  ){

    const account=
      await accountFromSession(
        request,
        db
      );

    if(!account){

      return json({
        ok:false,
        error:"Authentication required."
      },401);
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

  if(
    path==="/api/ecommerce/store"
  ){

    const account=
      await accountFromSession(
        request,
        db
      );

    if(!account){

      return json({
        ok:false,
        error:"Authentication required."
      },401);
    }

    if(method==="GET"){

      const store=
        await db.prepare(`
          SELECT *
          FROM ecommerce_stores
          WHERE account_id=?
          LIMIT 1
        `).bind(
          account.id
        ).first();

      return json({
        ok:true,
        store:store||null
      });
    }

    if(method==="POST"){

      return saveStore(
        request,
        db,
        account
      );
    }
  }

  // --------------------------------------------------------------
  // ORDERS
  // --------------------------------------------------------------

  if(
    path==="/api/ecommerce/orders" &&
    (
      method==="GET"||
      method==="POST"
    )
  ){

    const account=
      await accountFromSession(
        request,
        db
      );

    if(!account){

      return json({
        ok:false,
        error:"Authentication required."
      },401);
    }

    return ecommerceOrders(
      request,
      db,
      account
    );
  }

  // --------------------------------------------------------------
  // REPORTS
  // --------------------------------------------------------------

  if(
    path==="/api/reports" &&
    method==="POST"
  ){

    const account=
      await accountFromSession(
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

  if(
    path==="/api/whatsapp"
  ){

    return whatsappWebhook(
      request,
      db,
      env
    );
  }

  // --------------------------------------------------------------
  // ADMIN
  // --------------------------------------------------------------

  if(
    path.startsWith(
      "/api/admin/"
    )
  ){

    const denied=
      adminGuard(
        request,
        env
      );

    if(denied)
      return denied;
  }

  if(
    path==="/api/admin/dashboard" &&
    method==="GET"
  ){

    return adminDashboard(db);
  }

  if(
    path==="/api/admin/activity" &&
    method==="GET"
  ){

    return adminActivity(db);
  }

  if(
    path==="/api/admin/customer" &&
    method==="GET"
  ){

    return adminCustomer(
      request,
      db
    );
  }

  // --------------------------------------------------------------
  // PUBLIC STORE
  // --------------------------------------------------------------

  const storeMatch=
    path.match(
      /^\/store\/([^/]+)$/
    );

  if(
    storeMatch &&
    method==="GET"
  ){

    return publicStore(
      db,
      storeMatch[1]
    );
  }

  // --------------------------------------------------------------
  // NOT FOUND
  // --------------------------------------------------------------

  return json({
    ok:false,
    error:"Endpoint not found.",
    path
  },404);
}

// ================================================================
// WORKER ENTRY
// ================================================================

export default {

  async fetch(
    request,
    env
  ){

    try{

      return await router(
        request,
        env
      );

    }catch(error){

      console.error(
        "Sky Blue Worker Error:",
        error
      );

      return json({
        ok:false,
        error:"Internal server error.",
        message:String(
          error?.message||error
        )
      },500);
    }
  }
};
