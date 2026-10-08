// ================================================================
// SKY BLUE DIGITAL SERVICE - COMPLETE CLOUDFLARE WORKER
// Version: 2026.10.08-AUTH-PAYFAST-FIX
// ================================================================

const APP = "Sky Blue Digital Service";
const VERSION = "2026.10.08-AUTH-PAYFAST-FIX";
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
// BASIC HELPERS
// ================================================================

const now=()=>new Date().toISOString();

function clean(value,max=500){
  if(value===null||value===undefined)return "";
  return String(value).trim().slice(0,max);
}

function json(data,status=200,extra={}){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "content-type":"application/json; charset=utf-8",
      "access-control-allow-origin":"*",
      "access-control-allow-methods":
        "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers":
        "Content-Type,Authorization,X-Admin-Key",
      ...extra
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
  const header=request.headers.get("Cookie")||"";

  for(const part of header.split(";")){
    const p=part.trim();

    if(p.startsWith(name+"=")){
      try{
        return decodeURIComponent(
          p.slice(name.length+1)
        );
      }catch{
        return p.slice(name.length+1);
      }
    }
  }

  return "";
}

function sessionCookie(token){
  return [
    "sbs_session="+encodeURIComponent(token),
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
    env.PUBLIC_URL||new URL(request.url).origin,
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

function normalizePhone(value){
  let p=String(value||"").replace(/\D/g,"");

  if(p.startsWith("0027")){
    p="0"+p.slice(4);
  }else if(p.startsWith("27")){
    p="0"+p.slice(2);
  }

  return p;
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

async function randomToken(){
  return crypto.randomUUID()+"-"+crypto.randomUUID();
}

async function timingSafeEqual(a,b){
  const aa=new TextEncoder().encode(String(a));
  const bb=new TextEncoder().encode(String(b));

  if(aa.length!==bb.length)return false;

  let result=0;

  for(let i=0;i<aa.length;i++){
    result|=aa[i]^bb[i];
  }

  return result===0;
}

// ================================================================
// PASSWORD COMPATIBILITY
// ================================================================

async function pbkdf2Hash(
  password,
  salt,
  iterations=100000
){
  const material=
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

  const bits=
    await crypto.subtle.deriveBits(
      {
        name:"PBKDF2",
        salt:new TextEncoder().encode(salt),
        iterations:Number(iterations)||100000,
        hash:"SHA-256"
      },
      material,
      256
    );

  return [...new Uint8Array(bits)]
    .map(x=>x.toString(16).padStart(2,"0"))
    .join("");
}

async function passwordMatches(password,account){

  const modern=
    await sha256(password);

  if(
    account.password_hash &&
    await timingSafeEqual(
      modern,
      account.password_hash
    )
  ){
    return {
      ok:true,
      legacy:false
    };
  }

  if(
    account.password_salt &&
    account.password_iterations
  ){

    const legacy=
      await pbkdf2Hash(
        password,
        account.password_salt,
        account.password_iterations
      );

    if(
      await timingSafeEqual(
        legacy,
        account.password_hash||""
      )
    ){
      return {
        ok:true,
        legacy:true
      };
    }
  }

  return {
    ok:false,
    legacy:false
  };
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
      a[i>>2]|=
        str.charCodeAt(i)<<((i%4)*8);
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
    unescape(
      encodeURIComponent(string)
    )
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
  return String(
    env.PAYFAST_SANDBOX||""
  ).toLowerCase()==="true"
    ? "https://sandbox.payfast.co.za"
    : "https://www.payfast.co.za";
}

function payfastSignature(
  fields,
  passphrase=""
){

  const keys=Object.keys(fields)
    .filter(key=>
      key!=="signature" &&
      fields[key]!==undefined &&
      fields[key]!==null &&
      fields[key]!==""
    )
    .sort();

  let query=keys.map(key=>{
    const value=encodeURIComponent(
      String(fields[key]).trim()
    ).replace(/%20/g,"+");

    return key+"="+value;
  }).join("&");

  if(passphrase){
    query+="&passphrase="+
      encodeURIComponent(
        passphrase
      ).replace(/%20/g,"+");
  }

  return md5(query);
}

function payfastFields(fields,env){

  const result={};

  for(
    const [key,value]
    of Object.entries(fields)
  ){
    if(
      value!==undefined &&
      value!==null &&
      value!==""
    ){
      result[key]=String(value);
    }
  }

  result.signature=
    payfastSignature(
      result,
      env.PAYFAST_PASSPHRASE||""
    );

  return result;
}

function payfastForm(fields,env){

  const action=
    payfastHost(env)+"/eng/process";

  const inputs=
    Object.entries(fields)
      .map(([key,value])=>
        `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}">`
      ).join("");

  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sky Blue Digital Service</title>
<style>
body{
font-family:Arial,sans-serif;
background:#f3f7fb;
display:flex;
align-items:center;
justify-content:center;
min-height:100vh;
margin:0
}
.box{
background:#fff;
padding:35px;
border-radius:18px;
text-align:center;
box-shadow:0 10px 35px #0001;
max-width:420px
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
<noscript>
<button type="submit">Continue to PayFast</button>
</noscript>
</form>
</div>
<script>
document.getElementById("pf").submit();
</script>
</body>
</html>`;
}

// ================================================================
// DATABASE
// ================================================================

async function ensureAuthSchema(db){

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS customer_accounts(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT,
      password_iterations INTEGER,
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
    const info=
      await db.prepare(
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

    if(!cols.has("password_salt")){
      try{
        await db.prepare(
          `ALTER TABLE customer_accounts
           ADD COLUMN password_salt TEXT`
        ).run();
      }catch{}
    }

    if(!cols.has("password_iterations")){
      try{
        await db.prepare(
          `ALTER TABLE customer_accounts
           ADD COLUMN password_iterations INTEGER`
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

async function schema(db){

  const tables=[

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

  for(const sql of tables){
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

  const token=
    cookie(request,"sbs_session");

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
// REGISTER
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
      error:
        "Password must contain at least 8 characters."
    },400);
  }

  if(!businessName||!fullName||!phone){
    return json({
      ok:false,
      error:
        "Business name, full name and phone number are required."
    },400);
  }

  const existing=
    await db.prepare(`
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

    const result=
      await db.prepare(`
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

    accountId=
      Number(result.meta.last_row_id||0);

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

    console.error(
      "REGISTER:",
      error?.message||error
    );

    if(accountId){
      try{
        await db.prepare(
          `DELETE FROM customer_accounts WHERE id=?`
        ).bind(accountId).run();
      }catch{}
    }

    return json({
      ok:false,
      error:"Account creation failed.",
      detail:String(
        error?.message||error
      )
    },500);
  }
}

// ================================================================
// LOGIN
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
      error:
        "Email and password are required."
    },400);
  }

  let account;

  try{

    account=
      await db.prepare(`
        SELECT
          id,
          email,
          password_hash,
          password_salt,
          password_iterations,
          status,
          created_at,
          updated_at
        FROM customer_accounts
        WHERE LOWER(email)=?
        AND status='ACTIVE'
        LIMIT 1
      `).bind(email).first();

  }catch(error){

    console.error(
      "LOGIN QUERY:",
      error?.message||error
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
        "Email or password not recognized. If this is an older Sky Blue account, use Forgot Password."
    },401);
  }

  const matched=
    await passwordMatches(
      password,
      account
    );

  if(!matched.ok){

    return json({
      ok:false,
      error:
        "Email or password not recognized. If this is an older Sky Blue account, use Forgot Password."
    },401);
  }

  if(matched.legacy){

    try{

      const newHash=
        await sha256(password);

      await db.prepare(`
        UPDATE customer_accounts
        SET password_hash=?,
            password_salt=NULL,
            password_iterations=NULL,
            updated_at=?
        WHERE id=?
      `).bind(
        newHash,
        now(),
        account.id
      ).run();

    }catch{}
  }

  const token=
    await randomToken();

  const expires=
    new Date(
      Date.now()+30*24*60*60*1000
    ).toISOString();

  try{

    await db.prepare(`
      DELETE FROM customer_sessions
      WHERE account_id=?
    `).bind(account.id).run();

    await db.prepare(`
      INSERT INTO customer_sessions(
        account_id,
        token,
        expires_at,
        created_at
      )
      VALUES(?,?,?,?,?)
    `).bind(
      account.id,
      token,
      expires,
      now()
    ).run();

  }catch(error){

    console.error(
      "SESSION CREATE:",
      error?.message||error
    );

    return json({
      ok:false,
      error:"Unable to create login session."
    },500);
  }

  const profile=
    await db.prepare(`
      SELECT *
      FROM business_profiles
      WHERE account_id=?
      LIMIT 1
    `).bind(
      account.id
    ).first();

  return json({
    ok:true,
    authenticated:true,
    message:"Login successful.",
    account:{
      id:account.id,
      email:account.email,
      status:account.status
    },
    profile:profile||null
  },200,{
    "Set-Cookie":sessionCookie(token)
  });
}

// ================================================================
// LOGOUT
// ================================================================

async function logout(request,db){

  const token=
    cookie(request,"sbs_session");

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
    message:"Logged out successfully."
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

  const suppliedPhone=
    normalizePhone(
      d.phone
    );

  if(!email||!suppliedPhone){

    return json({
      ok:false,
      error:
        "Email and phone number are required."
    },400);
  }

  const account=
    await db.prepare(`
      SELECT
        a.id,
        a.email,
        a.status,
        p.phone
      FROM customer_accounts a
      LEFT JOIN business_profiles p
        ON p.account_id=a.id
      WHERE LOWER(a.email)=?
      AND a.status='ACTIVE'
      LIMIT 1
    `).bind(email).first();

  if(
    !account||
    normalizePhone(account.phone)!==suppliedPhone
  ){

    return json({
      ok:false,
      error:
        "The email address and phone number do not match an active account."
    },404);
  }

  try{

    await db.prepare(`
      DELETE FROM password_reset_tokens
      WHERE account_id=?
    `).bind(account.id).run();

  }catch{}

  const token=
    await randomToken();

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

  const origin=
    clean(
      globalThis.__SB_ENV?.PUBLIC_URL||
      "",
      500
    ).replace(/\/$/,"");

  const requestOrigin=
    origin||
    "";

  const resetUrl=
    requestOrigin
      ?requestOrigin+
       "/reset-password.html?token="+
       encodeURIComponent(token)
      :"/reset-password.html?token="+
       encodeURIComponent(token);

  return json({
    ok:true,
    message:
      "Password reset request created.",
    reset_url:resetUrl,
    token,
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
    d.password||
    d.new_password||
    ""
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

  const row=
    await db.prepare(`
      SELECT *
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
        "This password reset link is invalid or expired."
    },400);
  }

  const newHash=
    await sha256(password);

  await db.prepare(`
    UPDATE customer_accounts
    SET password_hash=?,
        password_salt=NULL,
        password_iterations=NULL,
        updated_at=?
    WHERE id=?
  `).bind(
    newHash,
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
      "Password changed successfully. Please sign in with your new password."
  });
}

// ================================================================
// CUSTOMER DASHBOARD
// ================================================================

async function customerDashboard(db,account){

  const profile=
    await db.prepare(`
      SELECT *
      FROM business_profiles
      WHERE account_id=?
      LIMIT 1
    `).bind(account.id).first();

  const subscriptions=
    await db.prepare(`
      SELECT *
      FROM subscriptions
      WHERE account_id=?
      ORDER BY id DESC
    `).bind(account.id).all();

  const payments=
    await db.prepare(`
      SELECT *
      FROM saas_payments
      WHERE account_id=?
      ORDER BY id DESC
      LIMIT 50
    `).bind(account.id).all();

  const products=
    await db.prepare(`
      SELECT *
      FROM products
      WHERE account_id=?
      ORDER BY id DESC
      LIMIT 100
    `).bind(account.id).all();

  const services=
    await db.prepare(`
      SELECT *
      FROM business_services
      WHERE account_id=?
      ORDER BY id DESC
    `).bind(account.id).all();

  const orders=
    await db.prepare(`
      SELECT *
      FROM ecommerce_orders
      WHERE account_id=?
      ORDER BY id DESC
      LIMIT 100
    `).bind(account.id).all();

  return {
    account:{
      id:account.id,
      email:account.email,
      status:account.status
    },
    profile:profile||null,
    subscriptions:
      subscriptions.results||[],
    payments:
      payments.results||[],
    products:
      products.results||[],
    services:
      services.results||[],
    orders:
      orders.results||[]
  };
}

// ================================================================
// PROFILE
// ================================================================

async function saveProfile(request,db,account){

  const d=await bodyJSON(request);

  const existing=
    await db.prepare(`
      SELECT id
      FROM business_profiles
      WHERE account_id=?
      LIMIT 1
    `).bind(account.id).first();

  const values=[
    clean(d.business_name||d.businessName,200),
    clean(d.owner_name||d.full_name||d.fullName,200),
    clean(d.phone,50),
    clean(d.whatsapp,50),
    clean(d.address,500),
    clean(d.city,100),
    clean(d.province,100),
    clean(d.website,500),
    clean(d.logo_url,1000),
    clean(d.primary_color,50),
    clean(d.secondary_color,50)
  ];

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
          logo_url=?,
          primary_color=?,
          secondary_color=?,
          updated_at=?
      WHERE account_id=?
    `).bind(
      ...values,
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
        logo_url,
        primary_color,
        secondary_color,
        created_at,
        updated_at
      )
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      account.id,
      values[0],
      values[1],
      account.email,
      values[2],
      values[3],
      values[4],
      values[5],
      values[6],
      values[7],
      values[8],
      values[9],
      values[10],
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

async function productAction(
  request,
  db,
  account
){

  if(request.method==="GET"){

    const result=
      await db.prepare(`
        SELECT *
        FROM products
        WHERE account_id=?
        ORDER BY id DESC
      `).bind(account.id).all();

    return json({
      ok:true,
      products:
        result.results||[]
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

  const price=Number(
    d.price||0
  );

  const stock=Number(
    d.stock||0
  );

  const result=
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
      price,
      stock,
      clean(d.sku,100),
      clean(d.image_url||d.imageUrl,1000),
      "ACTIVE",
      now(),
      now()
    ).run();

  return json({
    ok:true,
    product_id:
      Number(result.meta.last_row_id||0),
    message:"Product saved."
  });
}

// ================================================================
// SERVICES
// ================================================================

async function serviceAction(
  request,
  db,
  account
){

  const d=await bodyJSON(request);

  const name=clean(
    d.service_name||
    d.name,
    200
  );

  if(!name){

    return json({
      ok:false,
      error:"Service name is required."
    },400);
  }

  const result=
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
    service_id:
      Number(result.meta.last_row_id||0)
  });
}

// ================================================================
// ECOMMERCE STORE
// ================================================================

async function saveStore(
  request,
  db,
  account
){

  const d=await bodyJSON(request);

  const name=clean(
    d.store_name||
    d.name||
    d.business_name,
    200
  );

  const slug=
    clean(
      d.slug||
      name.toLowerCase()
        .replace(/[^a-z0-9]+/g,"-")
        .replace(/^-|-$/g,""),
      100
    );

  const existing=
    await db.prepare(`
      SELECT id
      FROM ecommerce_stores
      WHERE account_id=?
      LIMIT 1
    `).bind(account.id).first();

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
      name,
      slug,
      clean(d.description,1000),
      clean(d.logo_url,1000),
      clean(d.primary_color,50)||"#0b63ce",
      clean(d.secondary_color,50)||"#083b78",
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
      name,
      slug,
      clean(d.description,1000),
      clean(d.logo_url,1000),
      clean(d.primary_color,50)||"#0b63ce",
      clean(d.secondary_color,50)||"#083b78",
      "ACTIVE",
      now(),
      now()
    ).run();
  }

  return json({
    ok:true,
    message:"Online store saved.",
    slug
  });
}

// ================================================================
// ORDERS
// ================================================================

async function ecommerceOrders(
  request,
  db,
  account
){

  if(request.method==="GET"){

    const result=
      await db.prepare(`
        SELECT *
        FROM ecommerce_orders
        WHERE account_id=?
        ORDER BY id DESC
      `).bind(account.id).all();

    return json({
      ok:true,
      orders:
        result.results||[]
    });
  }

  const d=await bodyJSON(request);

  const orderNumber=
    "SBS-ORD-"+Date.now();

  const items=
    Array.isArray(d.items)
      ?d.items
      :[];

  const subtotal=Number(
    d.subtotal||d.total||0
  );

  const deliveryFee=Number(
    d.delivery_fee||0
  );

  const total=
    Number(
      d.total||
      subtotal+deliveryFee
    );

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
    deliveryFee,
    total,
    "PENDING",
    "NEW",
    clean(d.delivery_method,50),
    clean(d.delivery_address,1000),
    now(),
    now()
  ).run();

  return json({
    ok:true,
    order_number:orderNumber
  });
}

// ================================================================
// REPORTS
// ================================================================

async function createReport(
  request,
  db,
  account
){

  const d=await bodyJSON(request);

  const number=
    PREFIX+"-AX-"+Date.now();

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
    clean(d.category,100),
    clean(d.description,2000),
    clean(d.location,500),
    clean(d.priority,50)||"Normal",
    clean(d.source,50)||"Web",
    "OPEN",
    now(),
    now()
  ).run();

  return json({
    ok:true,
    report_number:number,
    message:"Report submitted successfully."
  });
}

// ================================================================
// WHATSAPP
// ================================================================

async function whatsappWebhook(
  request,
  db,
  env
){

  const url=
    new URL(request.url);

  if(request.method==="GET"){

    const mode=
      url.searchParams.get(
        "hub.mode"
      );

    const token=
      url.searchParams.get(
        "hub.verify_token"
      );

    const challenge=
      url.searchParams.get(
        "hub.challenge"
      );

    if(
      mode==="subscribe" &&
      token===env.WHATSAPP_VERIFY_TOKEN
    ){
      return new Response(
        challenge||"",
        {
          status:200,
          headers:{
            "content-type":"text/plain"
          }
        }
      );
    }

    return new Response(
      "Forbidden",
      {status:403}
    );
  }

  const payload=
    await bodyJSON(request);

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
      "",
      "INBOUND",
      "webhook",
      "",
      "",
      JSON.stringify(payload),
      now()
    ).run();

  }catch{}

  return json({
    ok:true
  });
}

// ================================================================
// CHECKOUT
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

  const code=
    clean(
      d.product_code||
      d.code,
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

  const amount=
    Number(
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

  const origin=
    baseUrl(request,env);

  const fields=
    payfastFields({
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
        clean(
          d.first_name||
          "Sky Blue",
          100
        ),
      name_last:
        clean(
          d.last_name||
          "Customer",
          100
        ),
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

  const raw=
    await request.text();

  const params=
    new URLSearchParams(raw);

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

  const received=
    data.signature||"";

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

  const amount=
    Number(
      data.amount_gross||0
    );

  const parts=
    String(
      data.m_payment_id
    ).split("-");

  const accountId=
    Number(parts[1]||0);

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
      error?.message||error
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

  const key=
    clean(env.ADMIN_KEY,500);

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
        p.owner_name,
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
    customers:
      list.results||[]
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
<head>
<meta name="viewport"
content="width=device-width,initial-scale=1">
<title>Store Not Found</title>
</head>
<body style="font-family:Arial;padding:40px">
<h1>Store not found</h1>
<p>This store is unavailable.</p>
</body>
</html>
`,404);
  }

  const products=
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
    (products.results||[])
      .map(product=>`
<article class="product">
${
  product.image_url
    ?`<img src="${escapeHtml(product.image_url)}">`
    :""
}
<h3>${escapeHtml(product.name)}</h3>
<p>${escapeHtml(product.description||"")}</p>
<strong>R ${money(product.price)}</strong>
</article>
`).join("");

  return html(`
<!doctype html>
<html>
<head>
<meta name="viewport"
content="width=device-width,initial-scale=1">
<title>${escapeHtml(store.store_name)}</title>
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
<h1>${escapeHtml(store.store_name)}</h1>
<p>${escapeHtml(store.description||"")}</p>
</header>
<main>
<h2>Products</h2>
<div class="grid">
${cards||"<p>No products available yet.</p>"}
</div>
</main>
</body>
</html>
`);
}

// ================================================================
// CATALOG / HEALTH
// ================================================================

function catalogResponse(){
  return json({
    ok:true,
    app:APP,
    version:VERSION,
    products:Object.values(CATALOG),
    modules:MODULES
  });
}

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

  if(!env.ASSETS)return null;

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
    await env.ASSETS.fetch(request);

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

  globalThis.__SB_ENV=env;

  const url=
    new URL(request.url);

  const path=
    url.pathname;

  const method=
    request.method;

  if(method==="OPTIONS"){

    return new Response(null,{
      status:204,
      headers:{
        "access-control-allow-origin":"*",
        "access-control-allow-methods":
          "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers":
          "Content-Type,Authorization,X-Admin-Key"
      }
    });
  }

  // --------------------------------------------------------------
  // AUTH - ALL COMPATIBLE ROUTES
  // --------------------------------------------------------------

  if(
    method==="POST" &&
    (
      path==="/api/auth/register"||
      path==="/api/customer-auth/register"||
      path==="/api/register"
    )
  ){
    return register(request,db);
  }

  if(
    method==="POST" &&
    (
      path==="/api/auth/login"||
      path==="/api/customer-auth/login"||
      path==="/api/login"
    )
  ){
    return login(request,db);
  }

  if(
    method==="POST" &&
    (
      path==="/api/auth/logout"||
      path==="/api/customer-auth/logout"
    )
  ){
    return logout(request,db);
  }

  if(
    method==="POST" &&
    (
      path==="/api/auth/forgot-password"||
      path==="/api/customer-auth/forgot-password"||
      path==="/api/forgot-password"
    )
  ){
    return forgotPassword(request,db);
  }

  if(
    method==="POST" &&
    (
      path==="/api/auth/reset-password"||
      path==="/api/customer-auth/reset-password"||
      path==="/api/reset-password"
    )
  ){
    return resetPassword(request,db);
  }

  if(
    method==="GET" &&
    (
      path==="/api/auth/me"||
      path==="/api/customer-auth/me"
    )
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

    const profile=
      await db.prepare(`
        SELECT *
        FROM business_profiles
        WHERE account_id=?
        LIMIT 1
      `).bind(account.id).first();

    return json({
      ok:true,
      authenticated:true,
      account:{
        id:account.id,
        email:account.email,
        status:account.status
      },
      profile:profile||null
    });
  }

  // --------------------------------------------------------------
  // DATABASE
  // --------------------------------------------------------------

  await ensureAuthSchema(db);
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
  // CHECKOUT
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

  // --------------------------------------------------------------
  // PAYFAST ITN
  // --------------------------------------------------------------

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
        `).bind(account.id).first();

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

  if(path==="/api/whatsapp"){

    return whatsappWebhook(
      request,
      db,
      env
    );
  }

  // --------------------------------------------------------------
  // ADMIN
  // --------------------------------------------------------------

  if(path.startsWith("/api/admin/")){

    if(!adminAuthorized(
      request,
      env
    )){
      return json({
        ok:false,
        error:"Unauthorized."
      },401);
    }
  }

  if(
    path==="/api/admin/dashboard" &&
    method==="GET"
  ){
    return adminDashboard(db);
  }

  if(
    path==="/api/admin/customers" &&
    method==="GET"
  ){

    const result=
      await db.prepare(`
        SELECT
          a.id,
          a.email,
          a.status,
          a.created_at,
          p.business_name,
          p.owner_name,
          p.phone,
          p.whatsapp
        FROM customer_accounts a
        LEFT JOIN business_profiles p
          ON p.account_id=a.id
        ORDER BY a.id DESC
        LIMIT 500
      `).all();

    return json({
      ok:true,
      customers:
        result.results||[]
    });
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
