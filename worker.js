// ============================================================
// SKY BLUE SAAS SOLUTIONS - COMPLETE CLOUDFLARE WORKER
// Version: 2026.10.07
// ============================================================

const APP = "Sky Blue SaaS Solutions";
const VERSION = "2026.10.07";
const PREFIX = "SBS";

const MODULES = [
  "whatsapp","website","ecommerce","salon","food","pharmacy","school",
  "councillor","civic","npo","ngo","church","undertaker","hosting",
  "cyber","voice","directory","retail","cloud-pbx"
];

const CATALOG = [
  {
    code:"core",
    name:"WhatsApp + Website",
    price:199,
    frequency:3,
    modules:["whatsapp","website"],
    description:"Business website and WhatsApp business platform."
  },
  {
    code:"number",
    name:"Business Number",
    price:69,
    frequency:3,
    modules:["voice"],
    description:"Professional business communication number."
  },
  {
    code:"ecommerce",
    name:"Ecommerce",
    price:399,
    frequency:3,
    modules:["ecommerce"],
    description:"Online store, products, orders and customer checkout."
  },
  {
    code:"pbx",
    name:"Cloud PBX",
    price:299,
    frequency:3,
    modules:["voice","cloud-pbx"],
    description:"Cloud business telephone platform."
  }
];

// ------------------------------------------------------------
// BASIC HELPERS
// ------------------------------------------------------------

const json = (data,status=200,headers={}) =>
  new Response(JSON.stringify(data,null,2),{
    status,
    headers:{
      "content-type":"application/json;charset=UTF-8",
      "access-control-allow-origin":"*",
      "access-control-allow-methods":"GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers":"Content-Type,Authorization,X-Admin-Key",
      ...headers
    }
  });

const html = (data,status=200) =>
  new Response(data,{
    status,
    headers:{
      "content-type":"text/html;charset=UTF-8",
      "cache-control":"no-store"
    }
  });

const text = (data,status=200) =>
  new Response(data,{
    status,
    headers:{"content-type":"text/plain;charset=UTF-8"}
  });

const now = () => new Date().toISOString();

const id = (prefix="id") =>
  prefix+"_"+crypto.randomUUID().replaceAll("-","");

const clean = (v,max=500) =>
  String(v ?? "").trim().slice(0,max);

const money = v => Number(Number(v||0).toFixed(2));

const esc = v => String(v??"")
  .replaceAll("&","&amp;")
  .replaceAll("<","&lt;")
  .replaceAll(">","&gt;")
  .replaceAll('"',"&quot;")
  .replaceAll("'","&#039;");

async function bodyJSON(req){
  try{return await req.json()}catch{return {}}
}

function cookie(req,name){
  const c=req.headers.get("Cookie")||"";
  const m=c.match(new RegExp("(?:^|;\\s*)"+name+"=([^;]+)"));
  return m?decodeURIComponent(m[1]):"";
}

function sessionCookie(value,maxAge=604800){
  return `sbs_session=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function sha256(value){
  const b=new TextEncoder().encode(value);
  const h=await crypto.subtle.digest("SHA-256",b);
  return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("");
}

function baseUrl(req,env){
  return env.PUBLIC_URL || new URL(req.url).origin;
}

// ------------------------------------------------------------
// MD5 FOR PAYFAST SIGNATURE
// ------------------------------------------------------------

function md5(input){
  function cmn(q,a,b,x,s,t){
    a=(a+q+x+t)|0;
    return ((a<<s)|(a>>>(32-s)))+b|0;
  }
  function ff(a,b,c,d,x,s,t){return cmn((b&c)|(~b&d),a,b,x,s,t)}
  function gg(a,b,c,d,x,s,t){return cmn((b&d)|(c&~d),a,b,x,s,t)}
  function hh(a,b,c,d,x,s,t){return cmn(b^c^d,a,b,x,s,t)}
  function ii(a,b,c,d,x,s,t){return cmn(c^(b|~d),a,b,x,s,t)}

  const bytes=new TextEncoder().encode(input);
  const len=bytes.length;
  const n=((len+8>>6)+1)*16;
  const x=new Int32Array(n);

  for(let i=0;i<len;i++) x[i>>2]|=bytes[i]<<((i%4)*8);
  x[len>>2]|=0x80<<((len%4)*8);
  x[n-2]=len*8;

  let a=0x67452301,b=0xefcdab89,c=0x98badcfe,d=0x10325476;

  for(let i=0;i<n;i+=16){
    let A=a,B=b,C=c,D=d;

    A=ff(A,B,C,D,x[i],7,-680876936);
    D=ff(D,A,B,C,x[i+1],12,-389564586);
    C=ff(C,D,A,B,x[i+2],17,606105819);
    B=ff(B,C,D,A,x[i+3],22,-1044525330);
    A=ff(A,B,C,D,x[i+4],7,-176418897);
    D=ff(D,A,B,C,x[i+5],12,1200080426);
    C=ff(C,D,A,B,x[i+6],17,-1473231341);
    B=ff(B,C,D,A,x[i+7],22,-45705983);
    A=ff(A,B,C,D,x[i+8],7,1770035416);
    D=ff(D,A,B,C,x[i+9],12,-1958414417);
    C=ff(C,D,A,B,x[i+10],17,-42063);
    B=ff(B,C,D,A,x[i+11],22,-1990404162);
    A=ff(A,B,C,D,x[i+12],7,1804603682);
    D=ff(D,A,B,C,x[i+13],12,-40341101);
    C=ff(C,D,A,B,x[i+14],17,-1502002290);
    B=ff(B,C,D,A,x[i+15],22,1236535329);

    A=gg(A,B,C,D,x[i+1],5,-165796510);
    D=gg(D,A,B,C,x[i+6],9,-1069501632);
    C=gg(C,D,A,B,x[i+11],14,643717713);
    B=gg(B,C,D,A,x[i],20,-373897302);
    A=gg(A,B,C,D,x[i+5],5,-701558691);
    D=gg(D,A,B,C,x[i+10],9,38016083);
    C=gg(C,D,A,B,x[i+15],14,-660478335);
    B=gg(B,C,D,A,x[i+4],20,-405537848);
    A=gg(A,B,C,D,x[i+9],5,568446438);
    D=gg(D,A,B,C,x[i+14],9,-1019803690);
    C=gg(C,D,A,B,x[i+3],14,-187363961);
    B=gg(B,C,D,A,x[i+8],20,1163531501);
    A=gg(A,B,C,D,x[i+13],5,-1444681467);
    D=gg(D,A,B,C,x[i+2],9,-51403784);
    C=gg(C,D,A,B,x[i+7],14,1735328473);
    B=gg(B,C,D,A,x[i+12],20,-1926607734);

    A=hh(A,B,C,D,x[i+5],4,-378558);
    D=hh(D,A,B,C,x[i+8],11,-2022574463);
    C=hh(C,D,A,B,x[i+11],16,1839030562);
    B=hh(B,C,D,A,x[i+14],23,-35309556);
    A=hh(A,B,C,D,x[i+1],4,-1530992060);
    D=hh(D,A,B,C,x[i+4],11,1272893353);
    C=hh(C,D,A,B,x[i+7],16,-155497632);
    B=hh(B,C,D,A,x[i+10],23,-1094730640);
    A=hh(A,B,C,D,x[i+13],4,681279174);
    D=hh(D,A,B,C,x[i],11,-358537222);
    C=hh(C,D,A,B,x[i+3],16,-722521979);
    B=hh(B,C,D,A,x[i+6],23,76029189);
    A=hh(A,B,C,D,x[i+9],4,-640364487);
    D=hh(D,A,B,C,x[i+12],11,-421815835);
    C=hh(C,D,A,B,x[i+15],16,530742520);
    B=hh(B,C,D,A,x[i+2],23,-995338651);

    A=ii(A,B,C,D,x[i],6,-198630844);
    D=ii(D,A,B,C,x[i+7],10,1126891415);
    C=ii(C,D,A,B,x[i+14],15,-1416354905);
    B=ii(B,C,D,A,x[i+5],21,-57434055);
    A=ii(A,B,C,D,x[i+12],6,1700485571);
    D=ii(D,A,B,C,x[i+3],10,-1894986606);
    C=ii(C,D,A,B,x[i+10],15,-1051523);
    B=ii(B,C,D,A,x[i+1],21,-2054922799);
    A=ii(A,B,C,D,x[i+8],6,1873313359);
    D=ii(D,A,B,C,x[i+15],10,-30611744);
    C=ii(C,D,A,B,x[i+6],15,-1560198380);
    B=ii(B,C,D,A,x[i+13],21,1309151649);
    A=ii(A,B,C,D,x[i+4],6,-145523070);
    D=ii(D,A,B,C,x[i+11],10,-1120210379);
    C=ii(C,D,A,B,x[i+2],15,718787259);
    B=ii(B,C,D,A,x[i+9],21,-343485551);

    a=(a+A)|0;b=(b+B)|0;c=(c+C)|0;d=(d+D)|0;
  }

  return [a,b,c,d].map(v=>{
    let s="";
    for(let i=0;i<4;i++)s+=((v>>>(i*8))&255).toString(16).padStart(2,"0");
    return s;
  }).join("");
}

// ------------------------------------------------------------
// PAYFAST
// ------------------------------------------------------------

function pfUrl(env){
  return env.PAYFAST_SANDBOX==="true"
    ? "https://sandbox.payfast.co.za/eng/process"
    : "https://www.payfast.co.za/eng/process";
}

function pfValidateUrl(env){
  return env.PAYFAST_SANDBOX==="true"
    ? "https://sandbox.payfast.co.za/eng/query/validate"
    : "https://www.payfast.co.za/eng/query/validate";
}

function pfEncode(v){
  return encodeURIComponent(String(v??"")).replace(/%20/g,"+");
}

function pfSignature(fields,passphrase=""){
  const keys=Object.keys(fields)
    .filter(k=>k!=="signature" && fields[k]!==undefined && fields[k]!==null && fields[k]!=="")
    .sort();

  let s=keys.map(k=>`${k}=${pfEncode(fields[k])}`).join("&");
  if(passphrase)s+=`&passphrase=${pfEncode(passphrase)}`;
  return md5(s);
}

function pfForm(fields){
  return Object.entries(fields)
    .map(([k,v])=>`<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("");
}

function payfastPage(fields){
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Secure Payment</title></head>
<body style="font-family:Arial;text-align:center;padding:60px">
<h2>Redirecting to secure PayFast payment...</h2>
<p>Please wait.</p>
<form id="pf" method="post" action="${esc(pfUrl(fields.__env||{}))}">
${pfForm(fields)}
</form>
<script>document.getElementById("pf").submit()</script>
</body></html>`;
}

// ------------------------------------------------------------
// DATABASE
// ------------------------------------------------------------

async function schema(db){
  const sql=[
`CREATE TABLE IF NOT EXISTS customer_accounts(
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT UNIQUE NOT NULL,
 phone TEXT,
 password_hash TEXT NOT NULL,
 status TEXT DEFAULT 'active',
 created_at TEXT,
 updated_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS customer_sessions(
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 created_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS business_profiles(
 account_id TEXT PRIMARY KEY,
 business_name TEXT,
 registration_number TEXT,
 address TEXT,
 city TEXT,
 province TEXT,
 postal_code TEXT,
 email TEXT,
 phone TEXT,
 whatsapp TEXT,
 website TEXT,
 description TEXT,
 logo_url TEXT,
 updated_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS subscriptions(
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL,
 product_code TEXT,
 module TEXT,
 amount REAL DEFAULT 0,
 frequency INTEGER DEFAULT 3,
 status TEXT DEFAULT 'PENDING',
 payfast_payment_id TEXT,
 created_at TEXT,
 updated_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS saas_payments(
 id TEXT PRIMARY KEY,
 account_id TEXT,
 payment_id TEXT UNIQUE,
 amount REAL DEFAULT 0,
 status TEXT,
 raw TEXT,
 created_at TEXT,
 updated_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS business_services(
 id TEXT PRIMARY KEY,
 account_id TEXT,
 module TEXT,
 name TEXT,
 status TEXT DEFAULT 'active',
 settings TEXT,
 created_at TEXT,
 updated_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS products(
 id TEXT PRIMARY KEY,
 account_id TEXT,
 name TEXT,
 description TEXT,
 price REAL DEFAULT 0,
 stock INTEGER DEFAULT 0,
 category TEXT,
 image_url TEXT,
 status TEXT DEFAULT 'active',
 created_at TEXT,
 updated_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS ecommerce_stores(
 id TEXT PRIMARY KEY,
 account_id TEXT UNIQUE,
 store_name TEXT,
 slug TEXT UNIQUE,
 email TEXT,
 phone TEXT,
 whatsapp TEXT,
 currency TEXT DEFAULT 'ZAR',
 description TEXT,
 logo_url TEXT,
 primary_color TEXT DEFAULT '#0b63ce',
 secondary_color TEXT DEFAULT '#083b78',
 status TEXT DEFAULT 'active',
 published INTEGER DEFAULT 0,
 checkout_enabled INTEGER DEFAULT 1,
 delivery_enabled INTEGER DEFAULT 1,
 pickup_enabled INTEGER DEFAULT 1,
 delivery_fee REAL DEFAULT 0,
 payment_provider TEXT DEFAULT 'PayFast',
 created_at TEXT,
 updated_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS ecommerce_categories(
 id TEXT PRIMARY KEY,
 account_id TEXT,
 name TEXT,
 description TEXT,
 status TEXT DEFAULT 'active',
 created_at TEXT,
 updated_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS ecommerce_orders(
 id TEXT PRIMARY KEY,
 account_id TEXT,
 customer_name TEXT,
 customer_phone TEXT,
 customer_email TEXT,
 items TEXT,
 total REAL DEFAULT 0,
 payment_status TEXT DEFAULT 'pending',
 order_status TEXT DEFAULT 'new',
 delivery_method TEXT,
 delivery_address TEXT,
 payfast_payment_id TEXT,
 created_at TEXT,
 updated_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS reports(
 id TEXT PRIMARY KEY,
 account_id TEXT,
 report_number TEXT,
 category TEXT,
 description TEXT,
 location TEXT,
 priority TEXT,
 source TEXT,
 status TEXT DEFAULT 'Open',
 created_at TEXT,
 updated_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS report_updates(
 id TEXT PRIMARY KEY,
 report_id TEXT,
 status TEXT,
 comment TEXT,
 created_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS departments(
 id INTEGER PRIMARY KEY,
 name TEXT,
 description TEXT
)`,
`CREATE TABLE IF NOT EXISTS whatsapp_conversations(
 id TEXT PRIMARY KEY,
 account_id TEXT,
 phone TEXT,
 direction TEXT,
 message TEXT,
 media_type TEXT,
 created_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS saas_modules(
 account_id TEXT,
 module TEXT,
 status TEXT DEFAULT 'active',
 activated_at TEXT,
 PRIMARY KEY(account_id,module)
)`,
`CREATE TABLE IF NOT EXISTS admin_support_sessions(
 id TEXT PRIMARY KEY,
 admin_key_hash TEXT,
 account_id TEXT,
 status TEXT DEFAULT 'active',
 started_at TEXT,
 ended_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS admin_audit_logs(
 id TEXT PRIMARY KEY,
 account_id TEXT,
 action TEXT,
 details TEXT,
 created_at TEXT
)`
  ];

  for(const q of sql)await db.prepare(q).run();

  const departments=[
    [1,"Electricity & Power","Electricity and power issues"],
    [2,"Water & Drainage","Water, sewer and drainage"],
    [3,"Roads & Infrastructure","Roads, potholes and storm damage"],
    [4,"Waste","Dumping, rubbish and waste"],
    [5,"General Services","Other community services"]
  ];

  for(const d of departments)
    await db.prepare(
      "INSERT OR IGNORE INTO departments(id,name,description) VALUES(?,?,?)"
    ).bind(...d).run();
}

// ------------------------------------------------------------
// AUTH
// ------------------------------------------------------------

async function accountFromSession(req,env){
  const sid=cookie(req,"sbs_session");
  if(!sid)return null;

  const r=await env.DB.prepare(`
    SELECT a.* FROM customer_accounts a
    JOIN customer_sessions s ON s.account_id=a.id
    WHERE s.id=? AND s.expires_at>?
    LIMIT 1
  `).bind(sid,now()).first();

  return r||null;
}

async function register(env,data){
  const name=clean(data.name,120);
  const email=clean(data.email,180).toLowerCase();
  const phone=clean(data.phone,40);
  const password=String(data.password||"");

  if(!name||!email||password.length<6)
    return json({error:"Name, valid email and password of at least 6 characters are required"},400);

  const exists=await env.DB.prepare(
    "SELECT id FROM customer_accounts WHERE email=?"
  ).bind(email).first();

  if(exists)return json({error:"An account with this email already exists"},409);

  const aid=id("acct");
  await env.DB.prepare(`
    INSERT INTO customer_accounts
    (id,name,email,phone,password_hash,status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?)
  `).bind(
    aid,name,email,phone,await sha256(password),"active",now(),now()
  ).run();

  const sid=id("sess");
  await env.DB.prepare(`
    INSERT INTO customer_sessions(id,account_id,expires_at,created_at)
    VALUES(?,?,?,?)
  `).bind(
    sid,aid,new Date(Date.now()+604800000).toISOString(),now()
  ).run();

  return json({ok:true,account_id:aid},{
    "set-cookie":sessionCookie(sid)
  });
}

async function login(env,data){
  const email=clean(data.email,180).toLowerCase();
  const password=String(data.password||"");

  const a=await env.DB.prepare(
    "SELECT * FROM customer_accounts WHERE email=?"
  ).bind(email).first();

  if(!a || a.password_hash!==await sha256(password))
    return json({error:"Invalid email or password"},401);

  const sid=id("sess");
  await env.DB.prepare(`
    INSERT INTO customer_sessions(id,account_id,expires_at,created_at)
    VALUES(?,?,?,?)
  `).bind(
    sid,a.id,new Date(Date.now()+604800000).toISOString(),now()
  ).run();

  return json({ok:true,account:a},{
    "set-cookie":sessionCookie(sid)
  });
}

async function logout(req,env){
  const sid=cookie(req,"sbs_session");
  if(sid)await env.DB.prepare(
    "DELETE FROM customer_sessions WHERE id=?"
  ).bind(sid).run();

  return json({ok:true},{
    "set-cookie":sessionCookie("",0)
  });
}

// ------------------------------------------------------------
// CUSTOMER DASHBOARD
// ------------------------------------------------------------

async function dashboard(account,env){
  const [profile,subs,payments,services,products,orders,store,mods]=await Promise.all([
    env.DB.prepare("SELECT * FROM business_profiles WHERE account_id=?").bind(account.id).first(),
    env.DB.prepare("SELECT * FROM subscriptions WHERE account_id=? ORDER BY created_at DESC").bind(account.id).all(),
    env.DB.prepare("SELECT * FROM saas_payments WHERE account_id=? ORDER BY created_at DESC").bind(account.id).all(),
    env.DB.prepare("SELECT * FROM business_services WHERE account_id=? ORDER BY created_at DESC").bind(account.id).all(),
    env.DB.prepare("SELECT * FROM products WHERE account_id=? ORDER BY created_at DESC").bind(account.id).all(),
    env.DB.prepare("SELECT * FROM ecommerce_orders WHERE account_id=? ORDER BY created_at DESC").bind(account.id).all(),
    env.DB.prepare("SELECT * FROM ecommerce_stores WHERE account_id=?").bind(account.id).first(),
    env.DB.prepare("SELECT module,status,activated_at FROM saas_modules WHERE account_id=?").bind(account.id).all()
  ]);

  return {
    account:{
      id:account.id,
      name:account.name,
      email:account.email,
      phone:account.phone,
      status:account.status
    },
    profile:profile||null,
    subscriptions:subs.results||[],
    active_modules:(mods.results||[]).filter(x=>x.status==="active").map(x=>x.module),
    modules:mods.results||[],
    payments:payments.results||[],
    services:services.results||[],
    products:products.results||[],
    orders:orders.results||[],
    ecommerce:store||null
  };
}

// ------------------------------------------------------------
// PROFILE
// ------------------------------------------------------------

async function saveProfile(account,env,d){
  await env.DB.prepare(`
    INSERT INTO business_profiles
    (account_id,business_name,registration_number,address,city,province,
     postal_code,email,phone,whatsapp,website,description,logo_url,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(account_id) DO UPDATE SET
    business_name=excluded.business_name,
    registration_number=excluded.registration_number,
    address=excluded.address,
    city=excluded.city,
    province=excluded.province,
    postal_code=excluded.postal_code,
    email=excluded.email,
    phone=excluded.phone,
    whatsapp=excluded.whatsapp,
    website=excluded.website,
    description=excluded.description,
    logo_url=excluded.logo_url,
    updated_at=excluded.updated_at
  `).bind(
    account.id,
    clean(d.business_name,180),
    clean(d.registration_number,100),
    clean(d.address,300),
    clean(d.city,100),
    clean(d.province,100),
    clean(d.postal_code,20),
    clean(d.email,180),
    clean(d.phone,40),
    clean(d.whatsapp,40),
    clean(d.website,250),
    clean(d.description,1000),
    clean(d.logo_url,500),
    now()
  ).run();

  return json({ok:true});
}

// ------------------------------------------------------------
// MODULE ACTIVATION
// ------------------------------------------------------------

async function activateModules(env,accountId,modules){
  for(const module of [...new Set(modules||[])]) {
    if(!MODULES.includes(module) && module!=="cloud-pbx")continue;

    await env.DB.prepare(`
      INSERT INTO saas_modules(account_id,module,status,activated_at)
      VALUES(?,?,?,?)
      ON CONFLICT(account_id,module) DO UPDATE SET
      status='active',activated_at=excluded.activated_at
    `).bind(accountId,module,"active",now()).run();

    await env.DB.prepare(`
      INSERT INTO business_services
      (id,account_id,module,name,status,settings,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO NOTHING
    `).bind(
      id("svc"),accountId,module,
      module.replaceAll("-"," ").replace(/\b\w/g,x=>x.toUpperCase()),
      "active","{}",now(),now()
    ).run();
  }
}

// ------------------------------------------------------------
// CHECKOUT
// ------------------------------------------------------------

async function checkout(req,env){
  const d=await bodyJSON(req);

  const selected=(d.products||d.product_codes||[])
    .map(x=>String(x))
    .filter(Boolean);

  const codes=selected.length?selected:["core"];

  const chosen=CATALOG.filter(x=>codes.includes(x.code));

  if(!chosen.length)return json({error:"No valid product selected"},400);

  const name=clean(d.name,120);
  const email=clean(d.email,180).toLowerCase();
  const phone=clean(d.phone,40);
  const business=clean(d.business_name,180);
  const password=String(d.password||"");

  if(!name||!email||!business)
    return json({error:"Name, email and business name are required"},400);

  if(!env.PAYFAST_MERCHANT_ID||!env.PAYFAST_MERCHANT_KEY)
    return json({error:"PayFast is not configured on this Worker. Add PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY."},500);

  let account=await env.DB.prepare(
    "SELECT * FROM customer_accounts WHERE email=?"
  ).bind(email).first();

  if(account){
    if(password && account.password_hash!==await sha256(password))
      return json({error:"An account already exists. Please use the correct password or login first."},409);
  }else{
    if(password.length<6)
      return json({error:"New accounts require a password of at least 6 characters"},400);

    const aid=id("acct");

    await env.DB.prepare(`
      INSERT INTO customer_accounts
      (id,name,email,phone,password_hash,status,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?)
    `).bind(
      aid,name,email,phone,await sha256(password),"active",now(),now()
    ).run();

    account=await env.DB.prepare(
      "SELECT * FROM customer_accounts WHERE id=?"
    ).bind(aid).first();
  }

  await saveProfile(account,env,{
    business_name:business,
    email,
    phone,
    whatsapp:d.whatsapp||phone,
    address:d.address,
    city:d.city,
    province:d.province,
    postal_code:d.postal_code,
    website:d.website,
    description:d.description,
    logo_url:d.logo_url
  });

  const total=money(chosen.reduce((s,x)=>s+x.price,0));
  const paymentId=id("PF");

  const modules=[...new Set(chosen.flatMap(x=>x.modules))];

  for(const p of chosen){
    for(const m of p.modules){
      await env.DB.prepare(`
        INSERT INTO subscriptions
        (id,account_id,product_code,module,amount,frequency,status,payfast_payment_id,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?)
      `).bind(
        id("sub"),account.id,p.code,m,p.price,p.frequency,
        "PENDING",paymentId,now(),now()
      ).run();
    }
  }

  await env.DB.prepare(`
    INSERT INTO saas_payments
    (id,account_id,payment_id,amount,status,raw,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?)
  `).bind(
    id("pay"),account.id,paymentId,total,"PENDING","",now(),now()
  ).run();

  const sid=id("sess");
  await env.DB.prepare(`
    INSERT INTO customer_sessions(id,account_id,expires_at,created_at)
    VALUES(?,?,?,?)
  `).bind(
    sid,account.id,new Date(Date.now()+604800000).toISOString(),now()
  ).run();

  const returnUrl=env.PAYFAST_RETURN_URL||`${baseUrl(req,env)}/?payment=success`;
  const cancelUrl=env.PAYFAST_CANCEL_URL||`${baseUrl(req,env)}/?payment=cancelled`;
  const notifyUrl=env.PAYFAST_NOTIFY_URL||`${baseUrl(req,env)}/api/payfast/itn`;

  const fields={
    merchant_id:env.PAYFAST_MERCHANT_ID,
    merchant_key:env.PAYFAST_MERCHANT_KEY,
    return_url:returnUrl,
    cancel_url:cancelUrl,
    notify_url:notifyUrl,
    name_first:name.split(" ")[0],
    name_last:name.split(" ").slice(1).join(" "),
    email_address:email,
    m_payment_id:paymentId,
    amount:total.toFixed(2),
    item_name:chosen.map(x=>x.name).join(", "),
    item_description:`${business} - Sky Blue SaaS subscription`,
    subscription_type:"1",
    billing_date:new Date().toISOString().slice(0,10),
    recurring_amount:total.toFixed(2),
    frequency:String(chosen[0].frequency||3),
    cycles:"0",
    subscription_notify_email:"true",
    subscription_notify_webhook:"true",
    subscription_notify_buyer:"true"
  };

  fields.signature=pfSignature(fields,env.PAYFAST_PASSPHRASE||"");

  const form=pfForm(fields);

  return new Response(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>Sky Blue - PayFast</title>
</head>
<body style="font-family:Arial;text-align:center;padding:50px">
<h2>Secure PayFast Checkout</h2>
<p>Redirecting to PayFast...</p>
<form id="payfast" method="post" action="${pfUrl(env)}">${form}</form>
<script>document.getElementById("payfast").submit()</script>
</body>
</html>`,{
    status:200,
    headers:{
      "content-type":"text/html;charset=UTF-8",
      "set-cookie":sessionCookie(sid)
    }
  });
}

// ------------------------------------------------------------
// PAYFAST ITN
// ------------------------------------------------------------

async function payfastITN(req,env){
  const raw=await req.text();
  const params=new URLSearchParams(raw);
  const data={};

  for(const [k,v] of params.entries())data[k]=v;

  if(!data.m_payment_id)
    return text("INVALID",400);

  if(env.PAYFAST_MERCHANT_ID &&
     data.merchant_id!==env.PAYFAST_MERCHANT_ID)
    return text("INVALID MERCHANT",400);

  const signature=data.signature||"";
  const expected=pfSignature(data,env.PAYFAST_PASSPHRASE||"");

  if(signature && signature!==expected)
    return text("INVALID SIGNATURE",400);

  const payment=await env.DB.prepare(
    "SELECT * FROM saas_payments WHERE payment_id=?"
  ).bind(data.m_payment_id).first();

  if(!payment)return text("PAYMENT NOT FOUND",404);

  const status=String(data.payment_status||"").toUpperCase();

  await env.DB.prepare(`
    UPDATE saas_payments
    SET status=?,raw=?,updated_at=?
    WHERE payment_id=?
  `).bind(status,raw,now(),data.m_payment_id).run();

  if(["COMPLETE","COMPLETED"].includes(status)){
    const amount=money(data.amount_gross||data.amount||0);

    if(amount>0 && Math.abs(amount-payment.amount)>0.02)
      return text("AMOUNT MISMATCH",400);

    await env.DB.prepare(`
      UPDATE subscriptions
      SET status='ACTIVE',updated_at=?
      WHERE payfast_payment_id=?
    `).bind(now(),data.m_payment_id).run();

    const subs=await env.DB.prepare(`
      SELECT module FROM subscriptions
      WHERE payfast_payment_id=?
    `).bind(data.m_payment_id).all();

    await activateModules(
      env,
      payment.account_id,
      (subs.results||[]).map(x=>x.module)
    );

    const ec=await env.DB.prepare(`
      SELECT 1 FROM subscriptions
      WHERE account_id=? AND module='ecommerce' AND status='ACTIVE'
      LIMIT 1
    `).bind(payment.account_id).first();

    if(ec)await createDefaultStore(env,payment.account_id);
  }

  return text("OK");
}

// ------------------------------------------------------------
// PRODUCTS
// ------------------------------------------------------------

async function productAction(account,env,d){
  const action=d.action||"save";

  if(action==="delete"){
    await env.DB.prepare(
      "DELETE FROM products WHERE id=? AND account_id=?"
    ).bind(d.id,account.id).run();
    return json({ok:true});
  }

  const pid=d.id||id("prod");

  await env.DB.prepare(`
    INSERT INTO products
    (id,account_id,name,description,price,stock,category,image_url,status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
    name=excluded.name,
    description=excluded.description,
    price=excluded.price,
    stock=excluded.stock,
    category=excluded.category,
    image_url=excluded.image_url,
    status=excluded.status,
    updated_at=excluded.updated_at
  `).bind(
    pid,
    account.id,
    clean(d.name,180),
    clean(d.description,1000),
    money(d.price),
    Number(d.stock||0),
    clean(d.category,100),
    clean(d.image_url,500),
    d.status==="inactive"?"inactive":"active",
    now(),now()
  ).run();

  return json({ok:true,id:pid});
}

// ------------------------------------------------------------
// ECOMMERCE STORE
// ------------------------------------------------------------

async function createDefaultStore(env,accountId){
  const exists=await env.DB.prepare(
    "SELECT * FROM ecommerce_stores WHERE account_id=?"
  ).bind(accountId).first();

  if(exists)return exists;

  const p=await env.DB.prepare(
    "SELECT * FROM business_profiles WHERE account_id=?"
  ).bind(accountId).first();

  const slug=(p?.business_name||`store-${accountId.slice(-8)}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-|-$/g,"")
    .slice(0,60);

  const s={
    id:id("store"),
    account_id:accountId,
    store_name:p?.business_name||"My Online Store",
    slug,
    email:p?.email||"",
    phone:p?.phone||"",
    whatsapp:p?.whatsapp||p?.phone||"",
    currency:"ZAR",
    description:p?.description||"",
    logo_url:p?.logo_url||"",
    primary_color:"#0b63ce",
    secondary_color:"#083b78",
    status:"active",
    published:1,
    checkout_enabled:1,
    delivery_enabled:1,
    pickup_enabled:1,
    delivery_fee:0,
    payment_provider:"PayFast",
    created_at:now(),
    updated_at:now()
  };

  await env.DB.prepare(`
    INSERT INTO ecommerce_stores
    (id,account_id,store_name,slug,email,phone,whatsapp,currency,description,
     logo_url,primary_color,secondary_color,status,published,checkout_enabled,
     delivery_enabled,pickup_enabled,delivery_fee,payment_provider,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(...Object.values(s)).run();

  return s;
}

async function saveStore(account,env,d){
  const old=await env.DB.prepare(
    "SELECT * FROM ecommerce_stores WHERE account_id=?"
  ).bind(account.id).first();

  const slug=clean(d.slug||(old?.slug)||d.store_name,70)
    .toLowerCase().replace(/[^a-z0-9]+/g,"-")
    .replace(/^-|-$/g,"");

  const vals={
    id:old?.id||id("store"),
    account_id:account.id,
    store_name:clean(d.store_name||old?.store_name||"My Store",180),
    slug,
    email:clean(d.email??old?.email,180),
    phone:clean(d.phone??old?.phone,40),
    whatsapp:clean(d.whatsapp??old?.whatsapp,40),
    currency:"ZAR",
    description:clean(d.description??old?.description,1000),
    logo_url:clean(d.logo_url??old?.logo_url,500),
    primary_color:clean(d.primary_color??old?.primary_color||"#0b63ce",30),
    secondary_color:clean(d.secondary_color??old?.secondary_color||"#083b78",30),
    status:d.status==="inactive"?"inactive":"active",
    published:Number(d.published??old?.published??1),
    checkout_enabled:Number(d.checkout_enabled??old?.checkout_enabled??1),
    delivery_enabled:Number(d.delivery_enabled??old?.delivery_enabled??1),
    pickup_enabled:Number(d.pickup_enabled??old?.pickup_enabled??1),
    delivery_fee:money(d.delivery_fee??old?.delivery_fee??0),
    payment_provider:"PayFast",
    created_at:old?.created_at||now(),
    updated_at:now()
  };

  await env.DB.prepare(`
    INSERT INTO ecommerce_stores
    (id,account_id,store_name,slug,email,phone,whatsapp,currency,description,
     logo_url,primary_color,secondary_color,status,published,checkout_enabled,
     delivery_enabled,pickup_enabled,delivery_fee,payment_provider,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(account_id) DO UPDATE SET
    store_name=excluded.store_name,slug=excluded.slug,email=excluded.email,
    phone=excluded.phone,whatsapp=excluded.whatsapp,currency=excluded.currency,
    description=excluded.description,logo_url=excluded.logo_url,
    primary_color=excluded.primary_color,secondary_color=excluded.secondary_color,
    status=excluded.status,published=excluded.published,
    checkout_enabled=excluded.checkout_enabled,
    delivery_enabled=excluded.delivery_enabled,
    pickup_enabled=excluded.pickup_enabled,
    delivery_fee=excluded.delivery_fee,updated_at=excluded.updated_at
  `).bind(...Object.values(vals)).run();

  return json({ok:true,store:vals});
}

// ------------------------------------------------------------
// ECOMMERCE ORDERS
// ------------------------------------------------------------

async function createOrder(account,env,d){
  const items=Array.isArray(d.items)?d.items:[];

  if(!items.length)return json({error:"Cart is empty"},400);

  let total=0;
  const finalItems=[];

  for(const item of items){
    const p=await env.DB.prepare(
      "SELECT * FROM products WHERE id=? AND account_id=? AND status='active'"
    ).bind(item.product_id||item.id,account.id).first();

    if(!p)continue;

    const qty=Math.max(1,Number(item.quantity||1));
    const line=money(p.price*qty);
    total+=line;

    finalItems.push({
      product_id:p.id,
      name:p.name,
      quantity:qty,
      price:p.price,
      total:line
    });
  }

  if(!finalItems.length)return json({error:"No valid products in cart"},400);

  const store=await env.DB.prepare(
    "SELECT * FROM ecommerce_stores WHERE account_id=?"
  ).bind(account.id).first();

  if(d.delivery_method==="delivery")
    total+=money(store?.delivery_fee||0);

  const oid=id("order");

  await env.DB.prepare(`
    INSERT INTO ecommerce_orders
    (id,account_id,customer_name,customer_phone,customer_email,items,total,
     payment_status,order_status,delivery_method,delivery_address,
     created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    oid,account.id,
    clean(d.customer_name,150),
    clean(d.customer_phone,40),
    clean(d.customer_email,180),
    JSON.stringify(finalItems),
    money(total),
    "pending",
    "new",
    clean(d.delivery_method,30),
    clean(d.delivery_address,500),
    now(),now()
  ).run();

  return json({
    ok:true,
    order_id:oid,
    total:money(total),
    payment_required:true,
    payment_provider:"PayFast",
    message:"Order created. Payment checkout can now be initiated."
  });
}

// ------------------------------------------------------------
// PUBLIC STORE
// ------------------------------------------------------------

async function publicStore(slug,env){
  const store=await env.DB.prepare(`
    SELECT * FROM ecommerce_stores
    WHERE slug=? AND status='active' AND published=1
  `).bind(slug).first();

  if(!store)return json({error:"Store not found"},404);

  const products=await env.DB.prepare(`
    SELECT id,name,description,price,stock,category,image_url
    FROM products
    WHERE account_id=? AND status='active'
    ORDER BY created_at DESC
  `).bind(store.account_id).all();

  return html(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>${esc(store.store_name)}</title>
<style>
body{font-family:Arial;margin:0;background:#f4f7fb;color:#172033}
header{background:${esc(store.primary_color)};color:white;padding:30px}
main{max-width:1100px;margin:auto;padding:25px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px}
.card{background:white;border-radius:12px;padding:18px;box-shadow:0 2px 10px #0001}
img{max-width:100%;height:160px;object-fit:cover;border-radius:8px}
button{background:${esc(store.secondary_color)};color:white;border:0;padding:11px 16px;border-radius:7px}
.price{font-size:22px;font-weight:bold}
</style>
</head>
<body>
<header>
<h1>${esc(store.store_name)}</h1>
<p>${esc(store.description)}</p>
</header>
<main>
<h2>Products</h2>
<div class="grid">
${(products.results||[]).map(p=>`
<div class="card">
${p.image_url?`<img src="${esc(p.image_url)}">`:""}
<h3>${esc(p.name)}</h3>
<p>${esc(p.description||"")}</p>
<div class="price">R${money(p.price).toFixed(2)}</div>
<p>Stock: ${Number(p.stock||0)}</p>
<button onclick="add('${esc(p.id)}')">Add to Cart</button>
</div>`).join("")}
</div>
<h2>Cart</h2>
<pre id="cart">Your cart is empty.</pre>
</main>
<script>
let cart=[];
function add(id){
 const p=${JSON.stringify(products.results||[])}.find(x=>x.id===id);
 if(!p)return;
 const x=cart.find(x=>x.product_id===id);
 if(x)x.quantity++;
 else cart.push({product_id:id,name:p.name,price:p.price,quantity:1});
 document.getElementById("cart").textContent=JSON.stringify(cart,null,2);
}
</script>
</body>
</html>`);
}

// ------------------------------------------------------------
// WHATSAPP
// ------------------------------------------------------------

async function whatsappWebhook(req,env){
  if(req.method==="GET"){
    const u=new URL(req.url);
    const mode=u.searchParams.get("hub.mode");
    const token=u.searchParams.get("hub.verify_token");
    const challenge=u.searchParams.get("hub.challenge");

    if(mode==="subscribe" && token===env.WHATSAPP_VERIFY_TOKEN)
      return text(challenge||"");

    return text("Forbidden",403);
  }

  const data=await bodyJSON(req);

  try{
    const entries=data.entry||[];

    for(const entry of entries){
      for(const change of entry.changes||[]){
        const value=change.value||{};

        for(const m of value.messages||[]){
          const phone=m.from||"";
          let message="";
          let mediaType="";

          if(m.type==="text")message=m.text?.body||"";
          else if(m.type==="image"){
            mediaType="image";
            message=m.image?.caption||"[image]";
          }else if(m.type==="video"){
            mediaType="video";
            message=m.video?.caption||"[video]";
          }else if(m.type==="audio"){
            mediaType="audio";
            message="[audio]";
          }else{
            mediaType=m.type||"other";
            message="[media]";
          }

          await env.DB.prepare(`
            INSERT INTO whatsapp_conversations
            (id,account_id,phone,direction,message,media_type,created_at)
            VALUES(?,?,?,?,?,?,?)
          `).bind(
            id("wa"),null,phone,"inbound",message,mediaType,now()
          ).run();
        }
      }
    }
  }catch(e){
    console.log("WhatsApp webhook error",e);
  }

  return json({ok:true});
}

async function sendWhatsApp(env,to,message){
  if(!env.WHATSAPP_ACCESS_TOKEN||!env.WHATSAPP_PHONE_NUMBER_ID)
    throw new Error("WhatsApp environment variables are not configured");

  const url=`https://graph.facebook.com/v23.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const r=await fetch(url,{
    method:"POST",
    headers:{
      "Authorization":`Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      messaging_product:"whatsapp",
      recipient_type:"individual",
      to,
      type:"text",
      text:{body:message}
    })
  });

  const out=await r.json();
  if(!r.ok)throw new Error(JSON.stringify(out));
  return out;
}

// ------------------------------------------------------------
// ADMIN SECURITY
// ------------------------------------------------------------

async function adminAuthorized(req,env){
  if(!env.ADMIN_KEY)return false;

  const supplied=req.headers.get("X-Admin-Key")||
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"")||"";

  return supplied===env.ADMIN_KEY;
}

async function adminGuard(req,env){
  if(await adminAuthorized(req,env))return null;
  return json({error:"Admin authorization required"},401);
}

async function audit(env,accountId,action,details){
  await env.DB.prepare(`
    INSERT INTO admin_audit_logs
    (id,account_id,action,details,created_at)
    VALUES(?,?,?,?,?)
  `).bind(
    id("audit"),accountId,action,
    JSON.stringify(details||{}),now()
  ).run();
}

// ------------------------------------------------------------
// ADMIN DASHBOARD
// ------------------------------------------------------------

async function adminDashboard(env){
  const [
    customers,
    subscriptions,
    payments,
    stores,
    orders,
    active,
    revenue,
    reports
  ]=await Promise.all([
    env.DB.prepare("SELECT id,name,email,phone,status,created_at FROM customer_accounts ORDER BY created_at DESC").all(),
    env.DB.prepare("SELECT * FROM subscriptions ORDER BY created_at DESC").all(),
    env.DB.prepare("SELECT * FROM saas_payments ORDER BY created_at DESC").all(),
    env.DB.prepare("SELECT * FROM ecommerce_stores ORDER BY created_at DESC").all(),
    env.DB.prepare("SELECT * FROM ecommerce_orders ORDER BY created_at DESC").all(),
    env.DB.prepare("SELECT COUNT(DISTINCT account_id) c FROM subscriptions WHERE status='ACTIVE'").first(),
    env.DB.prepare("SELECT COALESCE(SUM(amount),0) total FROM saas_payments WHERE status IN ('COMPLETE','COMPLETED')").first(),
    env.DB.prepare("SELECT * FROM reports ORDER BY created_at DESC").all()
  ]);

  return json({
    ok:true,
    stats:{
      customers:(customers.results||[]).length,
      active_subscriptions:Number(active?.c||0),
      revenue:money(revenue?.total||0),
      ecommerce_stores:(stores.results||[]).length,
      orders:(orders.results||[]).length
    },
    customers:customers.results||[],
    subscriptions:subscriptions.results||[],
    payments:payments.results||[],
    ecommerce_stores:stores.results||[],
    orders:orders.results||[],
    reports:reports.results||[]
  });
}

async function adminCustomer(env,id){
  const account=await env.DB.prepare(
    "SELECT id,name,email,phone,status,created_at FROM customer_accounts WHERE id=?"
  ).bind(id).first();

  if(!account)return json({error:"Customer not found"},404);

  return json({
    account,
    dashboard:await dashboard(account,env)
  });
}

async function adminActivity(env){
  const logs=await env.DB.prepare(
    "SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 500"
  ).all();

  return json({ok:true,activity:logs.results||[]});
}

async function adminStartSupport(req,env){
  const d=await bodyJSON(req);
  const accountId=clean(d.account_id,100);

  const a=await env.DB.prepare(
    "SELECT id FROM customer_accounts WHERE id=?"
  ).bind(accountId).first();

  if(!a)return json({error:"Customer not found"},404);

  const supplied=req.headers.get("X-Admin-Key")||"";
  const sid=id("support");

  await env.DB.prepare(`
    INSERT INTO admin_support_sessions
    (id,admin_key_hash,account_id,status,started_at)
    VALUES(?,?,?,?,?)
  `).bind(
    sid,await sha256(supplied),accountId,"active",now()
  ).run();

  await audit(env,accountId,"support_start",{session_id:sid});

  return json({ok:true,session_id:sid,account_id:accountId});
}

async function adminEndSupport(req,env){
  const d=await bodyJSON(req);

  await env.DB.prepare(`
    UPDATE admin_support_sessions
    SET status='ended',ended_at=?
    WHERE id=? AND status='active'
  `).bind(now(),d.session_id).run();

  return json({ok:true});
}

// ------------------------------------------------------------
// ADMIN REMOTE CUSTOMER ACTIONS
// ------------------------------------------------------------

async function adminSupportAction(req,env){
  const d=await bodyJSON(req);
  const accountId=clean(d.account_id,100);
  const action=clean(d.action,80);

  const account=await env.DB.prepare(
    "SELECT * FROM customer_accounts WHERE id=?"
  ).bind(accountId).first();

  if(!account)return json({error:"Customer not found"},404);

  if(action==="update_profile"){
    await saveProfile(account,env,d.profile||{});
  }

  else if(action==="update_store"){
    await saveStore(account,env,d.store||{});
  }

  else if(action==="add_product"){
    await productAction(account,env,{
      ...(d.product||{}),
      action:"save"
    });
  }

  else if(action==="update_product"){
    await productAction(account,env,{
      ...(d.product||{}),
      action:"save"
    });
  }

  else if(action==="delete_product"){
    await productAction(account,env,{
      id:d.product_id,
      action:"delete"
    });
  }

  else if(action==="activate_module"){
    await activateModules(env,accountId,[d.module]);
  }

  else if(action==="deactivate_module"){
    await env.DB.prepare(`
      UPDATE saas_modules SET status='inactive'
      WHERE account_id=? AND module=?
    `).bind(accountId,d.module).run();

    await env.DB.prepare(`
      UPDATE business_services SET status='inactive'
      WHERE account_id=? AND module=?
    `).bind(accountId,d.module).run();
  }

  else if(action==="update_order"){
    await env.DB.prepare(`
      UPDATE ecommerce_orders
      SET order_status=?,payment_status=?,updated_at=?
      WHERE id=? AND account_id=?
    `).bind(
      clean(d.order_status,40),
      clean(d.payment_status,40),
      now(),
      d.order_id,
      accountId
    ).run();
  }

  else if(action==="send_whatsapp"){
    const result=await sendWhatsApp(
      env,
      clean(d.phone,40),
      clean(d.message,4000)
    );

    await audit(env,accountId,"send_whatsapp",{
      phone:d.phone
    });

    return json({ok:true,result});
  }

  else{
    return json({error:"Unknown support action"},400);
  }

  await audit(env,accountId,action,d);
  return json({
    ok:true,
    dashboard:await dashboard(account,env)
  });
}

// ------------------------------------------------------------
// SERVICES / CATEGORIES
// ------------------------------------------------------------

async function serviceAction(account,env,d){
  const sid=d.id||id("svc");

  await env.DB.prepare(`
    INSERT INTO business_services
    (id,account_id,module,name,status,settings,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
    name=excluded.name,status=excluded.status,
    settings=excluded.settings,updated_at=excluded.updated_at
  `).bind(
    sid,
    account.id,
    clean(d.module,80),
    clean(d.name,150),
    d.status==="inactive"?"inactive":"active",
    JSON.stringify(d.settings||{}),
    now(),now()
  ).run();

  return json({ok:true,id:sid});
}

// ------------------------------------------------------------
// CIVIC REPORTS
// ------------------------------------------------------------

function reportDepartment(description){
  const s=String(description||"").toLowerCase();

  if(/electric|power|light/.test(s))return 1;
  if(/water|drain|sewer|pipe/.test(s))return 2;
  if(/road|pothole|storm/.test(s))return 3;
  if(/waste|dump|rubbish|garbage/.test(s))return 4;
  return 5;
}

async function createReport(account,env,d){
  const num=await env.DB.prepare(
    "SELECT COUNT(*) c FROM reports"
  ).first();

  const n=Number(num?.c||0)+1;
  const reportNumber=`${PREFIX}-AX-${String(n).padStart(6,"0")}`;

  const priority=["Emergency","Urgent","Normal"].includes(d.priority)
    ? d.priority:"Normal";

  const rid=id("report");

  await env.DB.prepare(`
    INSERT INTO reports
    (id,account_id,report_number,category,description,location,
     priority,source,status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    rid,
    account.id,
    reportNumber,
    clean(d.category,120),
    clean(d.description,2000),
    clean(d.location,300),
    priority,
    clean(d.source||"Web",30),
    "Open",
    now(),now()
  ).run();

  return json({
    ok:true,
    report_id:rid,
    report_number:reportNumber,
    department_id:reportDepartment(d.description)
  });
}

// ------------------------------------------------------------
// ROUTER
// ------------------------------------------------------------

async function route(req,env){
  const u=new URL(req.url);
  const path=u.pathname;
  const method=req.method;

  if(method==="OPTIONS")
    return new Response(null,{status:204,headers:{
      "access-control-allow-origin":"*",
      "access-control-allow-methods":"GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers":"Content-Type,Authorization,X-Admin-Key"
    }});

  if(path==="/" && method==="GET")
    return html(`<h1>${APP}</h1><p>API ${VERSION} is running.</p>`);

  if(path==="/api/health")
    return json({ok:true,app:APP,version:VERSION,status:"running"});

  if(path==="/api/catalog")
    return json({catalog:CATALOG});

  if(path==="/api/modules")
    return json({modules:MODULES});

  if(path==="/api/auth/register" && method==="POST")
    return register(env,await bodyJSON(req));

  if(path==="/api/auth/login" && method==="POST")
    return login(env,await bodyJSON(req));

  if(path==="/api/auth/logout" && method==="POST")
    return logout(req,env);

  if(path==="/api/auth/me" && method==="GET"){
    const a=await accountFromSession(req,env);
    return a?json({ok:true,account:a}):json({authenticated:false},401);
  }

  if(path==="/api/checkout/start" && method==="POST")
    return checkout(req,env);

  if(path==="/api/payfast/itn" && method==="POST")
    return payfastITN(req,env);

  if(path==="/api/whatsapp" &&
    (method==="GET"||method==="POST"))
    return whatsappWebhook(req,env);

  // ---------------- CUSTOMER ----------------

  const account=await accountFromSession(req,env);

  if(path==="/api/customer/dashboard" && method==="GET"){
    if(!account)return json({error:"Login required"},401);
    return json(await dashboard(account,env));
  }

  if(path==="/api/business/profile" && method==="POST"){
    if(!account)return json({error:"Login required"},401);
    return saveProfile(account,env,await bodyJSON(req));
  }

  if(path==="/api/products" && method==="GET"){
    if(!account)return json({error:"Login required"},401);
    const r=await env.DB.prepare(
      "SELECT * FROM products WHERE account_id=? ORDER BY created_at DESC"
    ).bind(account.id).all();
    return json({products:r.results||[]});
  }

  if(path==="/api/products" && method==="POST"){
    if(!account)return json({error:"Login required"},401);
    return productAction(account,env,await bodyJSON(req));
  }

  if(path==="/api/services" && method==="POST"){
    if(!account)return json({error:"Login required"},401);
    return serviceAction(account,env,await bodyJSON(req));
  }

  if(path==="/api/ecommerce/store" && method==="GET"){
    if(!account)return json({error:"Login required"},401);
    return json({
      store:await env.DB.prepare(
        "SELECT * FROM ecommerce_stores WHERE account_id=?"
      ).bind(account.id).first()
    });
  }

  if(path==="/api/ecommerce/store" && method==="POST"){
    if(!account)return json({error:"Login required"},401);
    return saveStore(account,env,await bodyJSON(req));
  }

  if(path==="/api/ecommerce/orders" && method==="GET"){
    if(!account)return json({error:"Login required"},401);
    const r=await env.DB.prepare(
      "SELECT * FROM ecommerce_orders WHERE account_id=? ORDER BY created_at DESC"
    ).bind(account.id).all();
    return json({orders:r.results||[]});
  }

  if(path==="/api/ecommerce/orders" && method==="POST"){
    if(!account)return json({error:"Login required"},401);
    return createOrder(account,env,await bodyJSON(req));
  }

  if(path==="/api/reports" && method==="POST"){
    if(!account)return json({error:"Login required"},401);
    return createReport(account,env,await bodyJSON(req));
  }

  // ---------------- ADMIN ----------------

  if(path.startsWith("/api/admin/")){
    const guard=await adminGuard(req,env);
    if(guard)return guard;

    if(path==="/api/admin/dashboard" && method==="GET")
      return adminDashboard(env);

    if(path==="/api/admin/activity" && method==="GET")
      return adminActivity(env);

    if(path==="/api/admin/support/start" && method==="POST")
      return adminStartSupport(req,env);

    if(path==="/api/admin/support/end" && method==="POST")
      return adminEndSupport(req,env);

    if(path==="/api/admin/support/action" && method==="POST")
      return adminSupportAction(req,env);

    if(path==="/api/admin/customer" && method==="GET"){
      const aid=u.searchParams.get("account_id");
      if(!aid)return json({error:"account_id required"},400);
      return adminCustomer(env,aid);
    }

    const m=path.match(/^\/api\/admin\/customer\/([^/]+)\/dashboard$/);

    if(m && method==="GET")
      return adminCustomer(env,m[1]);
  }

  // ---------------- PUBLIC STORE ----------------

  const storeMatch=path.match(/^\/store\/([^/]+)$/);

  if(storeMatch && method==="GET")
    return publicStore(storeMatch[1],env);

  return json({
    error:"Endpoint not found",
    path,
    method
  },404);
}

// ------------------------------------------------------------
// WORKER ENTRY
// ------------------------------------------------------------

export default {
  async fetch(request,env,ctx){
    try{
      await schema(env.DB);
      return await route(request,env);
    }catch(error){
      console.error(error);
      return json({
        ok:false,
        error:"Internal server error",
        message:env.DEBUG==="true"
          ? String(error?.message||error)
          : "The server encountered an error."
      },500);
    }
  }
};
