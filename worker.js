// ================================================================
// SKY BLUE DIGITAL SERVICE - COMPLETE CLOUDFLARE WORKER
// Version: 2026.10.08
// ================================================================

const APP = "Sky Blue Digital Service";
const VERSION = "2026.10.08";
const PREFIX = "SBS";

const MODULES = [
  "whatsapp","website","ecommerce","salon","food","pharmacy",
  "school","councillor","civic","npo","ngo","church","undertaker",
  "hosting","cyber","voice","directory","retail","cloud-pbx"
];

const CATALOG = {
  core:{
    code:"core",name:"WhatsApp + Website",price:199,frequency:3,
    modules:["whatsapp","website"]
  },
  number:{
    code:"number",name:"Business Number",price:69,frequency:3,
    modules:["voice"]
  },
  ecommerce:{
    code:"ecommerce",name:"Ecommerce",price:399,frequency:3,
    modules:["ecommerce"]
  },
  pbx:{
    code:"pbx",name:"Cloud PBX",price:299,frequency:3,
    modules:["voice","cloud-pbx"]
  }
};

// ================================================================
// HELPERS
// ================================================================

const now=()=>new Date().toISOString();

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
    headers:{"content-type":"text/html; charset=utf-8"}
  });
}

async function bodyJSON(r){
  try{return await r.json()}catch{return {}}
}

function cookie(r,name){
  const c=r.headers.get("Cookie")||"";
  for(const p of c.split(";")){
    const x=p.trim();
    if(x.startsWith(name+"="))
      return decodeURIComponent(x.slice(name.length+1));
  }
  return "";
}

function sessionCookie(token){
  return `sbs_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}

function clearSessionCookie(){
  return "sbs_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

function baseUrl(request,env){
  return clean(env.PUBLIC_URL||new URL(request.url).origin,500).replace(/\/$/,"");
}

async function sha256(value){
  const b=new TextEncoder().encode(String(value));
  const h=await crypto.subtle.digest("SHA-256",b);
  return [...new Uint8Array(h)]
    .map(x=>x.toString(16).padStart(2,"0")).join("");
}

function money(v){
  return Number(v||0).toFixed(2);
}

function escapeHtml(v){
  return String(v??"")
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
  function rl(x,n){return(x<<n)|(x>>>(32-n))}
  function au(x,y){
    const x4=x&0x40000000,y4=y&0x40000000;
    const x8=x&0x80000000,y8=y&0x80000000;
    const r=(x&0x3fffffff)+(y&0x3fffffff);
    if(x4&y4)return r^0x80000000^x8^y8;
    if(x4|y4){
      if(r&0x40000000)return r^0xc0000000^x8^y8;
      return r^0x40000000^x8^y8;
    }
    return r^x8^y8;
  }
  function F(x,y,z){return(x&y)|(~x&z)}
  function G(x,y,z){return(x&z)|(y&~z)}
  function H(x,y,z){return x^y^z}
  function I(x,y,z){return y^(x|~z)}
  function step(fn,a,b,c,d,x,s,ac){
    a=au(a,au(au(fn(b,c,d),x),ac));
    return au(rl(a,s),b);
  }
  function words(str){
    const n=((str.length+8)>>6)+1;
    const a=new Array(n*16).fill(0);
    let i=0;
    while(i<str.length){
      a[i>>2]|=str.charCodeAt(i)<<((i%4)*8);i++;
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
  const x=words(unescape(encodeURIComponent(string)));
  let a=0x67452301,b=0xefcdab89,c=0x98badcfe,d=0x10325476;
  for(let k=0;k<x.length;k+=16){
    const A=a,B=b,C=c,D=d;

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

    a=au(a,A);b=au(b,B);c=au(c,C);d=au(d,D);
  }
  return(hex(a)+hex(b)+hex(c)+hex(d)).toLowerCase();
}

// ================================================================
// PAYFAST
// ================================================================

function payfastHost(env){
  return String(env.PAYFAST_SANDBOX).toLowerCase()==="true"
    ?"https://sandbox.payfast.co.za"
    :"https://www.payfast.co.za";
}

function payfastSignature(fields,passphrase=""){
  const keys=Object.keys(fields)
    .filter(k=>k!=="signature"&&fields[k]!==undefined&&fields[k]!==null)
    .sort();
  let s=keys.map(k=>{
    const v=encodeURIComponent(String(fields[k]).trim()).replace(/%20/g,"+");
    return `${k}=${v}`;
  }).join("&");
  if(passphrase)
    s+=`&passphrase=${encodeURIComponent(passphrase).replace(/%20/g,"+")}`;
  return md5(s);
}

function payfastFields(fields,env){
  const out={};
  for(const [k,v] of Object.entries(fields))
    if(v!==undefined&&v!==null&&v!=="")out[k]=String(v);
  out.signature=payfastSignature(out,env.PAYFAST_PASSPHRASE||"");
  return out;
}

function payfastForm(fields,env){
  const action=`${payfastHost(env)}/eng/process`;
  const inputs=Object.entries(fields)
    .map(([k,v])=>`<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`)
    .join("");
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sky Blue PayFast</title>
<style>
body{font-family:Arial;background:#f3f7fb;display:flex;align-items:center;
justify-content:center;min-height:100vh}.box{background:white;padding:30px;
border-radius:18px;text-align:center;box-shadow:0 10px 35px #0001}
button{background:#0866d8;color:white;border:0;padding:14px 25px;border-radius:10px}
</style></head><body><div class="box"><h2>Sky Blue Digital Service</h2>
<p>Redirecting to PayFast...</p><form id="pf" method="post" action="${action}">
${inputs}<noscript><button>Continue</button></noscript></form></div>
<script>document.getElementById("pf").submit()</script></body></html>`;
}

// ================================================================
// AUTH SCHEMA - CRITICAL FIX
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

  // Check actual live columns.
  const accountInfo=await db.prepare(
    `PRAGMA table_info(customer_accounts)`
  ).all();

  const accountCols=new Set(
    (accountInfo.results||[]).map(x=>x.name)
  );

  // Old databases may have status/updated_at missing.
  if(!accountCols.has("status")){
    try{
      await db.prepare(
        `ALTER TABLE customer_accounts ADD COLUMN status TEXT DEFAULT 'ACTIVE'`
      ).run();
    }catch{}
  }

  if(!accountCols.has("updated_at")){
    try{
      await db.prepare(
        `ALTER TABLE customer_accounts ADD COLUMN updated_at TEXT`
      ).run();
    }catch{}
  }

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

  const sessionInfo=await db.prepare(
    `PRAGMA table_info(customer_sessions)`
  ).all();

  const sessionCols=new Set(
    (sessionInfo.results||[]).map(x=>x.name)
  );

  if(!sessionCols.has("token")){
    /*
      Legacy sessions cannot safely be converted in-place if their
      primary key is TEXT. The current migration normally handles this.
      For a fresh database we simply add the column.
    */
    try{
      await db.prepare(
        `ALTER TABLE customer_sessions ADD COLUMN token TEXT`
      ).run();
    }catch{}
  }

  try{
    await db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      idx_customer_sessions_token
      ON customer_sessions(token)
    `).run();
  }catch{}
}

// ================================================================
// APPLICATION SCHEMA
// IMPORTANT: AUTH IS NEVER BLOCKED BY THIS.
// ================================================================

async function schema(db){
  const statements=[
`CREATE TABLE IF NOT EXISTS business_profiles(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 account_id INTEGER UNIQUE NOT NULL,
 business_name TEXT,owner_name TEXT,email TEXT,phone TEXT,whatsapp TEXT,
 address TEXT,city TEXT,province TEXT,website TEXT,logo_url TEXT,
 primary_color TEXT,secondary_color TEXT,created_at TEXT,updated_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS subscriptions(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 account_id INTEGER NOT NULL,product_code TEXT NOT NULL,product_name TEXT,
 amount REAL DEFAULT 0,frequency INTEGER DEFAULT 3,status TEXT DEFAULT 'PENDING',
 payfast_payment_id TEXT,started_at TEXT,next_billing_date TEXT,
 created_at TEXT,updated_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS saas_payments(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 account_id INTEGER NOT NULL,payment_id TEXT UNIQUE NOT NULL,
 amount REAL DEFAULT 0,status TEXT DEFAULT 'PENDING',raw_status TEXT,
 payment_data TEXT,created_at TEXT,updated_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS business_services(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 account_id INTEGER NOT NULL,service_name TEXT NOT NULL,description TEXT,
 price REAL DEFAULT 0,status TEXT DEFAULT 'ACTIVE',created_at TEXT,updated_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS products(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 account_id INTEGER NOT NULL,name TEXT NOT NULL,description TEXT,
 price REAL DEFAULT 0,stock INTEGER DEFAULT 0,sku TEXT,image_url TEXT,
 status TEXT DEFAULT 'ACTIVE',created_at TEXT,updated_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS ecommerce_stores(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 account_id INTEGER UNIQUE NOT NULL,store_name TEXT,slug TEXT UNIQUE,
 description TEXT,logo_url TEXT,primary_color TEXT DEFAULT '#0b63ce',
 secondary_color TEXT DEFAULT '#083b78',currency TEXT DEFAULT 'ZAR',
 delivery_enabled INTEGER DEFAULT 1,pickup_enabled INTEGER DEFAULT 1,
 status TEXT DEFAULT 'ACTIVE',created_at TEXT,updated_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS ecommerce_categories(
 id INTEGER PRIMARY KEY AUTOINCREMENT,account_id INTEGER NOT NULL,
 name TEXT NOT NULL,description TEXT,created_at TEXT,updated_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS ecommerce_orders(
 id INTEGER PRIMARY KEY AUTOINCREMENT,account_id INTEGER NOT NULL,
 order_number TEXT UNIQUE NOT NULL,customer_name TEXT,customer_email TEXT,
 customer_phone TEXT,items_json TEXT,subtotal REAL DEFAULT 0,
 delivery_fee REAL DEFAULT 0,total REAL DEFAULT 0,
 payment_status TEXT DEFAULT 'PENDING',order_status TEXT DEFAULT 'NEW',
 delivery_method TEXT,delivery_address TEXT,created_at TEXT,updated_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS reports(
 id INTEGER PRIMARY KEY AUTOINCREMENT,report_number TEXT UNIQUE NOT NULL,
 account_id INTEGER,category TEXT,description TEXT,location TEXT,
 priority TEXT DEFAULT 'Normal',source TEXT DEFAULT 'Web',
 status TEXT DEFAULT 'OPEN',created_at TEXT,updated_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS report_updates(
 id INTEGER PRIMARY KEY AUTOINCREMENT,report_id INTEGER NOT NULL,
 update_text TEXT,status TEXT,created_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS departments(
 id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE NOT NULL
)`,
`CREATE TABLE IF NOT EXISTS whatsapp_conversations(
 id INTEGER PRIMARY KEY AUTOINCREMENT,phone TEXT,direction TEXT,
 message_type TEXT,message_text TEXT,media_url TEXT,payload TEXT,created_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS saas_modules(
 id INTEGER PRIMARY KEY AUTOINCREMENT,account_id INTEGER NOT NULL,
 module_code TEXT NOT NULL,status TEXT DEFAULT 'ACTIVE',
 created_at TEXT,updated_at TEXT,UNIQUE(account_id,module_code)
)`,
`CREATE TABLE IF NOT EXISTS admin_support_sessions(
 id INTEGER PRIMARY KEY AUTOINCREMENT,admin_key_hash TEXT,
 account_id INTEGER NOT NULL,status TEXT DEFAULT 'ACTIVE',
 started_at TEXT,ended_at TEXT
)`,
`CREATE TABLE IF NOT EXISTS admin_audit_logs(
 id INTEGER PRIMARY KEY AUTOINCREMENT,account_id INTEGER,
 action TEXT,details TEXT,created_at TEXT
)`
  ];

  // Do NOT use one giant batch. One incompatible legacy table
  // must never prevent the rest of the application from starting.
  for(const sql of statements){
    try{await db.prepare(sql).run()}catch(e){
      console.error("Schema statement skipped:",e?.message||e);
    }
  }

  try{
    for(const n of [
      "Electricity","Water & Sewer","Roads & Stormwater",
      "Waste Management","General Services"
    ]){
      await db.prepare(
        `INSERT OR IGNORE INTO departments(name) VALUES(?)`
      ).bind(n).run();
    }
  }catch(e){
    console.error("Department initialization:",e?.message||e);
  }
}

// ================================================================
// AUTHENTICATION
// ================================================================

async function accountFromSession(request,db){
  const token=cookie(request,"sbs_session");
  if(!token)return null;

  try{
    return await db.prepare(`
      SELECT a.*
      FROM customer_accounts a
      JOIN customer_sessions s ON s.account_id=a.id
      WHERE s.token=? AND s.expires_at>? AND a.status='ACTIVE'
      LIMIT 1
    `).bind(token,now()).first();
  }catch(e){
    console.error("Session lookup:",e?.message||e);
    return null;
  }
}

async function register(request,db){
  await ensureAuthSchema(db);

  const d=await bodyJSON(request);
  const email=clean(d.email,200).toLowerCase();
  const password=String(d.password||"");

  if(!email||password.length<6)
    return json({
      ok:false,
      error:"A valid email and password of at least 6 characters are required."
    },400);

  const existing=await db.prepare(
    `SELECT id FROM customer_accounts WHERE LOWER(email)=? LIMIT 1`
  ).bind(email).first();

  if(existing)
    return json({
      ok:false,
      error:"An account with this email already exists."
    },409);

  const timestamp=now();
  const hash=await sha256(password);

  try{
    const result=await db.prepare(`
      INSERT INTO customer_accounts
      (email,password_hash,status,created_at,updated_at)
      VALUES(?,?,?,?,?)
    `).bind(email,hash,"ACTIVE",timestamp,timestamp).run();

    return json({
      ok:true,
      account_id:result.meta.last_row_id,
      message:"Account created successfully."
    });
  }catch(e){
    console.error("REGISTER:",e);
    return json({
      ok:false,
      error:"Account could not be created.",
      detail:String(e?.message||e)
    },500);
  }
}

async function login(request,db){
  /*
    CRITICAL:
    Login now initializes ONLY authentication tables.
    It does not depend on ecommerce, admin, WhatsApp or any
    other legacy table.
  */
  await ensureAuthSchema(db);

  const d=await bodyJSON(request);
  const email=clean(d.email,200).toLowerCase();
  const password=String(d.password||"");

  if(!email||!password)
    return json({
      ok:false,
      error:"Email and password are required."
    },400);

  const hash=await sha256(password);

  let account;

  try{
    account=await db.prepare(`
      SELECT id,email,status,created_at,updated_at
      FROM customer_accounts
      WHERE LOWER(email)=? AND password_hash=? AND status='ACTIVE'
      LIMIT 1
    `).bind(email,hash).first();
  }catch(e){
    console.error("LOGIN ACCOUNT QUERY:",e);
    return json({
      ok:false,
      error:"Login database error.",
      detail:String(e?.message||e)
    },500);
  }

  if(!account)
    return json({
      ok:false,
      error:"Invalid email or password."
    },401);

  const token=crypto.randomUUID()+crypto.randomUUID();
  const expires=new Date(Date.now()+2592000000).toISOString();

  try{
    await db.prepare(`
      INSERT INTO customer_sessions
      (account_id,token,expires_at,created_at)
      VALUES(?,?,?,?)
    `).bind(account.id,token,expires,now()).run();
  }catch(e){
    console.error("LOGIN SESSION INSERT:",e);
    return json({
      ok:false,
      error:"Login session could not be created.",
      detail:String(e?.message||e)
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

async function logout(request,db){
  await ensureAuthSchema(db);
  const token=cookie(request,"sbs_session");

  if(token){
    try{
      await db.prepare(
        `DELETE FROM customer_sessions WHERE token=?`
      ).bind(token).run();
    }catch{}
  }

  return json({ok:true,message:"Logged out."},200,{
    "Set-Cookie":clearSessionCookie()
  });
}

// ================================================================
// PROFILE
// ================================================================

async function saveProfile(request,db,account){
  const d=await bodyJSON(request);
  const old=await db.prepare(
    `SELECT * FROM business_profiles WHERE account_id=?`
  ).bind(account.id).first();

  const v={
    business_name:clean(d.business_name??old?.business_name,200),
    owner_name:clean(d.owner_name??old?.owner_name,200),
    email:clean(d.email??old?.email??account.email,200),
    phone:clean(d.phone??old?.phone,50),
    whatsapp:clean(d.whatsapp??old?.whatsapp,50),
    address:clean(d.address??old?.address,500),
    city:clean(d.city??old?.city,100),
    province:clean(d.province??old?.province,100),
    website:clean(d.website??old?.website,300),
    logo_url:clean(d.logo_url??old?.logo_url,500),
    primary_color:clean(d.primary_color??old?.primary_color||"#0b63ce",30),
    secondary_color:clean(d.secondary_color??old?.secondary_color||"#083b78",30)
  };

  if(old){
    await db.prepare(`
      UPDATE business_profiles SET
      business_name=?,owner_name=?,email=?,phone=?,whatsapp=?,address=?,
      city=?,province=?,website=?,logo_url=?,primary_color=?,secondary_color=?,
      updated_at=? WHERE account_id=?
    `).bind(
      v.business_name,v.owner_name,v.email,v.phone,v.whatsapp,v.address,
      v.city,v.province,v.website,v.logo_url,v.primary_color,v.secondary_color,
      now(),account.id
    ).run();
  }else{
    await db.prepare(`
      INSERT INTO business_profiles(
      account_id,business_name,owner_name,email,phone,whatsapp,address,city,
      province,website,logo_url,primary_color,secondary_color,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      account.id,v.business_name,v.owner_name,v.email,v.phone,v.whatsapp,
      v.address,v.city,v.province,v.website,v.logo_url,v.primary_color,
      v.secondary_color,now(),now()
    ).run();
  }

  return json({ok:true,profile:v});
}

// ================================================================
// MODULES
// ================================================================

async function activateModules(db,accountId,list){
  for(const code of Array.isArray(list)?list:[]){
    if(!MODULES.includes(code))continue;
    const t=now();
    await db.prepare(`
      INSERT INTO saas_modules
      (account_id,module_code,status,created_at,updated_at)
      VALUES(?,?,?,?,?)
      ON CONFLICT(account_id,module_code)
      DO UPDATE SET status='ACTIVE',updated_at=excluded.updated_at
    `).bind(accountId,code,"ACTIVE",t,t).run();
  }
}

async function getModules(db,id){
  const r=await db.prepare(`
    SELECT module_code,status,created_at,updated_at
    FROM saas_modules WHERE account_id=? ORDER BY module_code
  `).bind(id).all();
  return r.results||[];
}

// ================================================================
// ECOMMERCE
// ================================================================

function slugify(v){
  return clean(v,100).toLowerCase()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"").slice(0,80)||`store-${Date.now()}`;
}

async function createDefaultStore(db,accountId,name="My Store"){
  let s=await db.prepare(
    `SELECT * FROM ecommerce_stores WHERE account_id=?`
  ).bind(accountId).first();

  if(s)return s;

  let slug=slugify(name);
  const conflict=await db.prepare(
    `SELECT id FROM ecommerce_stores WHERE slug=?`
  ).bind(slug).first();

  if(conflict)slug=`${slug}-${accountId}`;

  await db.prepare(`
    INSERT INTO ecommerce_stores(
      account_id,store_name,slug,description,primary_color,
      secondary_color,currency,delivery_enabled,pickup_enabled,
      status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    accountId,clean(name,200),slug,
    "Online store powered by Sky Blue Digital Service.",
    "#0b63ce","#083b78","ZAR",1,1,"ACTIVE",now(),now()
  ).run();

  return db.prepare(
    `SELECT * FROM ecommerce_stores WHERE account_id=?`
  ).bind(accountId).first();
}

async function productAction(request,db,account){
  if(request.method==="GET"){
    const r=await db.prepare(
      `SELECT * FROM products WHERE account_id=? ORDER BY id DESC`
    ).bind(account.id).all();
    return json({ok:true,products:r.results||[]});
  }

  const d=await bodyJSON(request);
  const action=clean(d.action,30).toLowerCase();

  if(action==="delete"){
    await db.prepare(
      `DELETE FROM products WHERE id=? AND account_id=?`
    ).bind(Number(d.id),account.id).run();
    return json({ok:true,message:"Product deleted."});
  }

  if(action==="update"){
    await db.prepare(`
      UPDATE products SET name=?,description=?,price=?,stock=?,sku=?,
      image_url=?,status=?,updated_at=? WHERE id=? AND account_id=?
    `).bind(
      clean(d.name,200),clean(d.description,1000),Number(d.price||0),
      Number(d.stock||0),clean(d.sku,100),clean(d.image_url,500),
      clean(d.status||"ACTIVE",30),now(),Number(d.id),account.id
    ).run();
    return json({ok:true,message:"Product updated."});
  }

  await db.prepare(`
    INSERT INTO products(
      account_id,name,description,price,stock,sku,image_url,status,
      created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)
  `).bind(
    account.id,clean(d.name,200),clean(d.description,1000),
    Number(d.price||0),Number(d.stock||0),clean(d.sku,100),
    clean(d.image_url,500),"ACTIVE",now(),now()
  ).run();

  return json({ok:true,message:"Product added."});
}

async function saveStore(request,db,account){
  const d=await bodyJSON(request);
  let store=await db.prepare(
    `SELECT * FROM ecommerce_stores WHERE account_id=?`
  ).bind(account.id).first();

  if(!store)store=await createDefaultStore(
    db,account.id,d.store_name||"My Store"
  );

  let slug=slugify(d.slug??store.slug??d.store_name??store.store_name);

  const c=await db.prepare(`
    SELECT id FROM ecommerce_stores
    WHERE slug=? AND account_id!=?
  `).bind(slug,account.id).first();

  if(c)slug=`${slug}-${account.id}`;

  await db.prepare(`
    UPDATE ecommerce_stores SET
    store_name=?,slug=?,description=?,logo_url=?,primary_color=?,
    secondary_color=?,currency=?,delivery_enabled=?,pickup_enabled=?,
    status=?,updated_at=? WHERE account_id=?
  `).bind(
    clean(d.store_name??store.store_name,200),slug,
    clean(d.description??store.description,1000),
    clean(d.logo_url??store.logo_url,500),
    clean(d.primary_color??store.primary_color||"#0b63ce",30),
    clean(d.secondary_color??store.secondary_color||"#083b78",30),
    clean(d.currency??store.currency||"ZAR",10),
    d.delivery_enabled===undefined?store.delivery_enabled:d.delivery_enabled?1:0,
    d.pickup_enabled===undefined?store.pickup_enabled:d.pickup_enabled?1:0,
    clean(d.status??store.status||"ACTIVE",30),now(),account.id
  ).run();

  return json({
    ok:true,
    store:await db.prepare(
      `SELECT * FROM ecommerce_stores WHERE account_id=?`
    ).bind(account.id).first()
  });
}

// ================================================================
// CUSTOMER DASHBOARD
// ================================================================

async function customerDashboard(db,account){
  const q=async(sql,...p)=>db.prepare(sql).bind(...p).all();
  const first=async(sql,...p)=>db.prepare(sql).bind(...p).first();

  return {
    account:{
      id:account.id,email:account.email,status:account.status,
      created_at:account.created_at
    },
    profile:await first(
      `SELECT * FROM business_profiles WHERE account_id=?`,account.id
    ),
    subscriptions:(await q(
      `SELECT * FROM subscriptions WHERE account_id=? ORDER BY id DESC`,account.id
    )).results||[],
    payments:(await q(
      `SELECT id,payment_id,amount,status,raw_status,created_at,updated_at
       FROM saas_payments WHERE account_id=? ORDER BY id DESC`,account.id
    )).results||[],
    modules:await getModules(db,account.id),
    services:(await q(
      `SELECT * FROM business_services WHERE account_id=? ORDER BY id DESC`,account.id
    )).results||[],
    products:(await q(
      `SELECT * FROM products WHERE account_id=? ORDER BY id DESC`,account.id
    )).results||[],
    orders:(await q(
      `SELECT * FROM ecommerce_orders WHERE account_id=? ORDER BY id DESC`,account.id
    )).results||[],
    ecommerce:await first(
      `SELECT * FROM ecommerce_stores WHERE account_id=?`,account.id
    )
  };
}

// ================================================================
// CHECKOUT
// ================================================================

async function checkout(request,db,env,account){
  const d=await bodyJSON(request);

  let selected=Array.isArray(d.products)
    ?d.products
    :Array.isArray(d.product_codes)
      ?d.product_codes.map(code=>({code}))
      :[{code:"core"}];

  const products=selected
    .map(x=>CATALOG[clean(typeof x==="string"?x:x.code,50)])
    .filter(Boolean);

  if(!products.length)
    return json({ok:false,error:"No valid product selected."},400);

  let a=account;

  if(!a){
    const email=clean(d.email,200).toLowerCase();
    const password=String(d.password||"");

    if(!email||password.length<6)
      return json({ok:false,error:"Email and password are required for checkout."},400);

    a=await db.prepare(
      `SELECT * FROM customer_accounts WHERE email=?`
    ).bind(email).first();

    if(!a){
      const t=now();
      const r=await db.prepare(`
        INSERT INTO customer_accounts
        (email,password_hash,status,created_at,updated_at)
        VALUES(?,?,?,?,?)
      `).bind(email,await sha256(password),"ACTIVE",t,t).run();

      a=await db.prepare(
        `SELECT * FROM customer_accounts WHERE id=?`
      ).bind(r.meta.last_row_id).first();
    }
  }

  if(d.business_name||d.phone||d.whatsapp){
    const fake=new Request("https://internal/profile",{
      method:"POST",body:JSON.stringify(d)
    });
    await saveProfile(fake,db,a);
  }

  const paymentId=`${PREFIX}-${Date.now()}-${a.id}`;
  const total=products.reduce((s,p)=>s+Number(p.price),0);

  for(const p of products){
    await db.prepare(`
      INSERT INTO subscriptions(
      account_id,product_code,product_name,amount,frequency,status,
      payfast_payment_id,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?)
    `).bind(
      a.id,p.code,p.name,p.price,p.frequency,"PENDING",
      paymentId,now(),now()
    ).run();
  }

  await db.prepare(`
    INSERT INTO saas_payments(
    account_id,payment_id,amount,status,created_at,updated_at)
    VALUES(?,?,?,?,?,?)
  `).bind(a.id,paymentId,total,"PENDING",now(),now()).run();

  const token=crypto.randomUUID()+crypto.randomUUID();

  await db.prepare(`
    INSERT INTO customer_sessions(account_id,token,expires_at,created_at)
    VALUES(?,?,?,?)
  `).bind(
    a.id,token,new Date(Date.now()+2592000000).toISOString(),now()
  ).run();

  const bd=new Date();
  bd.setDate(bd.getDate()+1);

  const fields={
    merchant_id:env.PAYFAST_MERCHANT_ID||"",
    merchant_key:env.PAYFAST_MERCHANT_KEY||"",
    return_url:env.PAYFAST_RETURN_URL||`${baseUrl(request,env)}/?payment=success`,
    cancel_url:env.PAYFAST_CANCEL_URL||`${baseUrl(request,env)}/?payment=cancelled`,
    notify_url:env.PAYFAST_NOTIFY_URL||`${baseUrl(request,env)}/api/payfast/itn`,
    name_first:clean(d.owner_name||d.business_name||"Customer",100),
    email_address:a.email,
    m_payment_id:paymentId,
    amount:money(total),
    item_name:products.map(x=>x.name).join(" + "),
    subscription_type:"1",
    billing_date:bd.toISOString().slice(0,10),
    recurring_amount:money(total),
    frequency:String(products[0].frequency||3),
    cycles:"0"
  };

  return html(payfastForm(payfastFields(fields,env),env),200,{
    "Set-Cookie":sessionCookie(token)
  });
}

// ================================================================
// PAYFAST ITN
// ================================================================

async function validatePayFastITN(raw,env){
  try{
    const r=await fetch(`${payfastHost(env)}/eng/query/validate`,{
      method:"POST",
      headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:raw
    });
    const t=await r.text();
    return {ok:r.ok&&t.trim().toUpperCase()==="VALID",response:t.trim()};
  }catch(e){
    return {ok:false,response:String(e?.message||e)};
  }
}

async function payfastITN(request,db,env){
  const raw=await request.text();
  const params=new URLSearchParams(raw);
  const data=Object.fromEntries(params.entries());
  const paymentId=clean(data.m_payment_id,200);

  if(!paymentId)return text("Missing payment ID",400);

  if(env.PAYFAST_MERCHANT_ID &&
     String(data.merchant_id||"")!==String(env.PAYFAST_MERCHANT_ID))
    return text("Invalid merchant",400);

  const sig=payfastSignature(data,env.PAYFAST_PASSPHRASE||"");

  if(!data.signature||String(data.signature).toLowerCase()!==sig.toLowerCase())
    return text("Invalid signature",400);

  const valid=await validatePayFastITN(raw,env);
  if(!valid.ok)return text("PayFast validation failed",400);

  const payment=await db.prepare(
    `SELECT * FROM saas_payments WHERE payment_id=?`
  ).bind(paymentId).first();

  if(!payment)return text("Payment not found",404);

  const status=clean(data.payment_status||data.status||"UNKNOWN",50);

  await db.prepare(`
    UPDATE saas_payments SET status=?,raw_status=?,payment_data=?,updated_at=?
    WHERE payment_id=?
  `).bind(
    status==="COMPLETE"||status==="COMPLETED"?"COMPLETE":status,
    status,JSON.stringify(data),now(),paymentId
  ).run();

  if(status==="COMPLETE"||status==="COMPLETED"){
    const received=Number(data.amount_gross||data.amount||0);
    if(received>0&&Math.abs(received-Number(payment.amount||0))>.01)
      return text("Amount mismatch",400);

    const subs=await db.prepare(
      `SELECT * FROM subscriptions WHERE payfast_payment_id=?`
    ).bind(paymentId).all();

    const mods=new Set();

    for(const s of subs.results||[]){
      const p=CATALOG[s.product_code];
      if(p)p.modules.forEach(x=>mods.add(x));

      const next=new Date();
      next.setDate(next.getDate()+Number(s.frequency||3));

      await db.prepare(`
        UPDATE subscriptions SET status='ACTIVE',
        started_at=COALESCE(started_at,?),next_billing_date=?,updated_at=?
        WHERE id=?
      `).bind(
        now(),next.toISOString().slice(0,10),now(),s.id
      ).run();
    }

    await activateModules(db,payment.account_id,[...mods]);

    if(mods.has("ecommerce")){
      const p=await db.prepare(
        `SELECT business_name FROM business_profiles WHERE account_id=?`
      ).bind(payment.account_id).first();
      await createDefaultStore(
        db,payment.account_id,p?.business_name||"My Store"
      );
    }
  }

  return text("OK");
}

// ================================================================
// ORDERS
// ================================================================

async function ecommerceOrders(request,db,account){
  if(request.method==="GET"){
    const r=await db.prepare(
      `SELECT * FROM ecommerce_orders WHERE account_id=? ORDER BY id DESC`
    ).bind(account.id).all();
    return json({ok:true,orders:r.results||[]});
  }

  const d=await bodyJSON(request);
  const orderNumber=`${PREFIX}-ORDER-${Date.now()}-${account.id}`;
  const items=Array.isArray(d.items)?d.items:[];
  const subtotal=items.reduce(
    (s,x)=>s+Number(x.price||0)*Number(x.quantity||1),0
  );
  const delivery=Number(d.delivery_fee||0);

  await db.prepare(`
    INSERT INTO ecommerce_orders(
      account_id,order_number,customer_name,customer_email,customer_phone,
      items_json,subtotal,delivery_fee,total,payment_status,order_status,
      delivery_method,delivery_address,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    account.id,orderNumber,clean(d.customer_name,200),
    clean(d.customer_email,200),clean(d.customer_phone,50),
    JSON.stringify(items),subtotal,delivery,subtotal+delivery,
    "PENDING","NEW",clean(d.delivery_method,50),
    clean(d.delivery_address,500),now(),now()
  ).run();

  return json({
    ok:true,order_number:orderNumber,total:money(subtotal+delivery),
    payment_required:true,message:"Order created."
  });
}

// ================================================================
// WHATSAPP
// ================================================================

async function sendWhatsApp(env,phone,message){
  if(!env.WHATSAPP_ACCESS_TOKEN||!env.WHATSAPP_PHONE_NUMBER_ID)
    return {ok:false,error:"WhatsApp credentials are not configured."};

  const r=await fetch(
    `https://graph.facebook.com/v23.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method:"POST",
      headers:{
        "content-type":"application/json",
        authorization:`Bearer ${env.WHATSAPP_ACCESS_TOKEN}`
      },
      body:JSON.stringify({
        messaging_product:"whatsapp",
        to:phone,type:"text",
        text:{body:message}
      })
    }
  );

  let result={};
  try{result=await r.json()}catch{}
  return {ok:r.ok,result};
}

async function whatsappWebhook(request,db,env){
  if(request.method==="GET"){
    const u=new URL(request.url);
    if(
      u.searchParams.get("hub.mode")==="subscribe" &&
      u.searchParams.get("hub.verify_token")===env.WHATSAPP_VERIFY_TOKEN
    )return text(u.searchParams.get("hub.challenge")||"");
    return text("Verification failed",403);
  }

  const payload=await request.json();
  for(const entry of payload.entry||[])
    for(const change of entry.changes||[])
      for(const m of change.value?.messages||[]){
        const type=m.type||"";
        let messageText="",mediaUrl="";
        if(type==="text")messageText=m.text?.body||"";
        if(type==="image")mediaUrl=m.image?.id||"";
        if(type==="video")mediaUrl=m.video?.id||"";
        if(type==="audio")mediaUrl=m.audio?.id||"";

        try{
          await db.prepare(`
            INSERT INTO whatsapp_conversations(
            phone,direction,message_type,message_text,media_url,payload,created_at)
            VALUES(?,?,?,?,?,?,?)
          `).bind(
            m.from||"","INBOUND",type,messageText,mediaUrl,
            JSON.stringify(m),now()
          ).run();
        }catch(e){
          console.error("WhatsApp database:",e);
        }
      }

  return json({ok:true});
}

// ================================================================
// SERVICES / REPORTS
// ================================================================

async function serviceAction(request,db,account){
  const d=await bodyJSON(request);
  await db.prepare(`
    INSERT INTO business_services(
    account_id,service_name,description,price,status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?)
  `).bind(
    account.id,clean(d.service_name,200),clean(d.description,1000),
    Number(d.price||0),"ACTIVE",now(),now()
  ).run();
  return json({ok:true,message:"Service saved."});
}

function reportDepartment(c){
  const x=String(c||"").toLowerCase();
  if(x.includes("electric")||x.includes("power"))return 1;
  if(x.includes("water")||x.includes("drain")||x.includes("sewer"))return 2;
  if(x.includes("road")||x.includes("pothole")||x.includes("storm"))return 3;
  if(x.includes("waste")||x.includes("dump")||x.includes("rubbish"))return 4;
  return 5;
}

async function createReport(request,db,account){
  const d=await bodyJSON(request);
  const r=await db.prepare(
    `SELECT COUNT(*) AS total FROM reports`
  ).first();
  const n=Number(r?.total||0)+1;
  const number=`${PREFIX}-AX-${String(n).padStart(6,"0")}`;
  const category=clean(d.category,100);

  await db.prepare(`
    INSERT INTO reports(
    report_number,account_id,category,description,location,priority,
    source,status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)
  `).bind(
    number,account?.id||null,category,clean(d.description,2000),
    clean(d.location,500),clean(d.priority||"Normal",30),
    clean(d.source||"Web",30),"OPEN",now(),now()
  ).run();

  return json({
    ok:true,report_number:number,
    department_id:reportDepartment(category),status:"OPEN"
  });
}

// ================================================================
// ADMIN
// ================================================================

function adminAuthorized(request,env){
  const key=clean(env.ADMIN_KEY,500);
  if(!key)return false;

  const supplied=request.headers.get("X-Admin-Key")||
    request.headers.get("Authorization")?.replace(/^Bearer\s+/i,"")||"";

  return supplied===key;
}

function adminGuard(request,env){
  return adminAuthorized(request,env)
    ?null
    :json({ok:false,error:"Unauthorized."},401);
}

async function audit(db,id,action,details){
  try{
    await db.prepare(`
      INSERT INTO admin_audit_logs(account_id,action,details,created_at)
      VALUES(?,?,?,?)
    `).bind(
      id||null,clean(action,100),JSON.stringify(details||{}),now()
    ).run();
  }catch(e){
    console.error("Audit:",e);
  }
}

async function adminDashboard(db){
  const customers=await db.prepare(
    `SELECT COUNT(*) total FROM customer_accounts`
  ).first();
  const active=await db.prepare(
    `SELECT COUNT(*) total FROM subscriptions WHERE status='ACTIVE'`
  ).first();
  const revenue=await db.prepare(
    `SELECT COALESCE(SUM(amount),0) total FROM saas_payments WHERE status='COMPLETE'`
  ).first();
  const stores=await db.prepare(
    `SELECT COUNT(*) total FROM ecommerce_stores WHERE status='ACTIVE'`
  ).first();
  const orders=await db.prepare(
    `SELECT COUNT(*) total FROM ecommerce_orders`
  ).first();

  const list=await db.prepare(`
    SELECT a.id,a.email,a.status,a.created_at,
    p.business_name,p.phone,p.whatsapp
    FROM customer_accounts a
    LEFT JOIN business_profiles p ON p.account_id=a.id
    ORDER BY a.id DESC LIMIT 200
  `).all();

  return json({
    ok:true,
    stats:{
      customers:Number(customers?.total||0),
      active_subscriptions:Number(active?.total||0),
      revenue:Number(revenue?.total||0),
      ecommerce_stores:Number(stores?.total||0),
      orders:Number(orders?.total||0)
    },
    customers:list.results||[]
  });
}

async function adminActivity(db){
  const r=await db.prepare(
    `SELECT * FROM admin_audit_logs ORDER BY id DESC LIMIT 200`
  ).all();
  return json({ok:true,activity:r.results||[]});
}

async function adminCustomer(request,db){
  const id=Number(new URL(request.url).searchParams.get("account_id")||0);
  if(!id)return json({ok:false,error:"account_id is required."},400);

  const a=await db.prepare(
    `SELECT id,email,status,created_at,updated_at FROM customer_accounts WHERE id=?`
  ).bind(id).first();

  if(!a)return json({ok:false,error:"Customer not found."},404);

  return json({
    ok:true,
    customer:await customerDashboard(db,a)
  });
}

async function adminCustomerDashboard(db,id){
  const a=await db.prepare(
    `SELECT * FROM customer_accounts WHERE id=?`
  ).bind(id).first();

  if(!a)return json({ok:false,error:"Customer not found."},404);

  return json({
    ok:true,
    dashboard:await customerDashboard(db,a)
  });
}

// ================================================================
// PUBLIC STORE
// ================================================================

async function publicStore(db,slug){
  const store=await db.prepare(`
    SELECT * FROM ecommerce_stores
    WHERE slug=? AND status='ACTIVE'
  `).bind(slug).first();

  if(!store)
    return html(`
      <!doctype html><html><body style="font-family:Arial;padding:40px">
      <h1>Store not found</h1><p>This store is unavailable.</p>
      </body></html>`,404);

  const r=await db.prepare(`
    SELECT * FROM products
    WHERE account_id=? AND status='ACTIVE' ORDER BY id DESC
  `).bind(store.account_id).all();

  const cards=(r.results||[]).map(p=>`
    <article class="product">
      ${p.image_url?`<img src="${escapeHtml(p.image_url)}">`:""}
      <h3>${escapeHtml(p.name)}</h3>
      <p>${escapeHtml(p.description||"")}</p>
      <strong>R ${money(p.price)}</strong>
    </article>
  `).join("");

  return html(`<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(store.store_name)}</title>
<style>
body{margin:0;font-family:Arial;background:#f5f8fc;color:#172033}
header{background:${escapeHtml(store.primary_color||"#0b63ce")};color:white;padding:30px}
main{max-width:1100px;margin:auto;padding:25px 18px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px}
.product{background:white;border-radius:16px;padding:18px;box-shadow:0 4px 18px #0001}
.product img{width:100%;height:180px;object-fit:cover;border-radius:12px}
</style></head><body>
<header><main><h1>${escapeHtml(store.store_name)}</h1>
<p>${escapeHtml(store.description||"")}</p></main></header>
<main><h2>Products</h2><div class="grid">
${cards||"<p>No products available yet.</p>"}
</div></main></body></html>`);
}

// ================================================================
// CATALOG / HOME
// ================================================================

function catalogResponse(){
  return json({
    ok:true,app:APP,version:VERSION,
    products:Object.values(CATALOG),modules:MODULES
  });
}

function homePage(){
  return html(`<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${APP}</title>
<style>
body{margin:0;font-family:Arial;background:#f5f8fc;color:#152033}
header{background:linear-gradient(135deg,#0b63ce,#083b78);color:white;padding:55px 20px}
main{max-width:1000px;margin:auto;padding:25px 20px}
.card{background:white;padding:25px;border-radius:18px;box-shadow:0 5px 25px #0001;margin-bottom:20px}
.status{display:inline-block;background:#dff7e7;color:#146c35;padding:8px 13px;border-radius:30px;font-weight:bold}
</style></head><body>
<header><main><h1>${APP}</h1>
<p>Your business. One digital platform. Built to grow.</p>
<span class="status">API ONLINE</span></main></header>
<main><div class="card"><h2>Digital Business Platform</h2>
<p>WhatsApp, websites, ecommerce, business numbers, Cloud PBX,
customer dashboards and business tools.</p></div>
<div class="card"><h2>System Status</h2>
<p>Version: ${VERSION}</p><p>Cloudflare Worker API is running.</p></div>
</main></body></html>`);
}

// ================================================================
// STATIC ASSETS
// ================================================================

async function serveStaticAsset(request,env){
  if(!env.ASSETS)return null;

  const u=new URL(request.url);

  if(u.pathname==="/owner-dashboard.html"){
    const x=new URL(request.url);
    x.pathname="/skyblue-admin.html";
    const r=await env.ASSETS.fetch(new Request(x.toString(),request));
    if(r.status!==404)return r;
  }

  const r=await env.ASSETS.fetch(request);
  return r.status!==404?r:null;
}

// ================================================================
// ROUTER
// ================================================================

async function router(request,env){
  const db=env.DB;

  if(!db)
    return json({
      ok:false,
      error:"D1 database binding DB is missing."
    },500);

  const u=new URL(request.url);
  const path=u.pathname;
  const method=request.method;

  if(method==="OPTIONS")
    return new Response(null,{
      status:204,
      headers:{
        "access-control-allow-origin":"*",
        "access-control-allow-methods":"GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers":"Content-Type,Authorization,X-Admin-Key"
      }
    });

  // --------------------------------------------------------------
  // AUTH ROUTES FIRST - NEVER BLOCKED BY APPLICATION SCHEMA
  // --------------------------------------------------------------

  if(path==="/api/auth/register"&&method==="POST")
    return register(request,db);

  if(path==="/api/auth/login"&&method==="POST")
    return login(request,db);

  if(path==="/api/auth/logout"&&method==="POST")
    return logout(request,db);

  // Authentication check only.
  if(path==="/api/auth/me"&&method==="GET"){
    await ensureAuthSchema(db);
    const a=await accountFromSession(request,db);
    if(!a)return json({ok:false,authenticated:false},401);
    return json({
      ok:true,authenticated:true,
      account:{id:a.id,email:a.email,status:a.status}
    });
  }

  // --------------------------------------------------------------
  // APPLICATION SCHEMA
  // --------------------------------------------------------------

  await schema(db);

  // --------------------------------------------------------------
  // STATIC
  // --------------------------------------------------------------

  if(method==="GET"&&!path.startsWith("/api/")){
    const r=await serveStaticAsset(request,env);
    if(r)return r;
  }

  if(path==="/"&&method==="GET")return homePage();

  // --------------------------------------------------------------
  // HEALTH / CATALOG
  // --------------------------------------------------------------

  if(path==="/api/health")
    return json({
      ok:true,status:"online",app:APP,version:VERSION,
      message:"Sky Blue Digital Service API is running."
    });

  if(path==="/api/catalog")return catalogResponse();

  if(path==="/api/modules")
    return json({ok:true,modules:MODULES});

  // --------------------------------------------------------------
  // CHECKOUT
  // --------------------------------------------------------------

  if(path==="/api/checkout/start"&&method==="POST"){
    const a=await accountFromSession(request,db);
    return checkout(request,db,env,a);
  }

  if(path==="/api/payfast/itn"&&method==="POST")
    return payfastITN(request,db,env);

  // --------------------------------------------------------------
  // CUSTOMER DASHBOARD
  // --------------------------------------------------------------

  if(path==="/api/customer/dashboard"&&method==="GET"){
    const a=await accountFromSession(request,db);
    if(!a)return json({ok:false,error:"Authentication required."},401);
    return json({ok:true,dashboard:await customerDashboard(db,a)});
  }

  // --------------------------------------------------------------
  // PROFILE
  // --------------------------------------------------------------

  if(path==="/api/business/profile"&&method==="POST"){
    const a=await accountFromSession(request,db);
    if(!a)return json({ok:false,error:"Authentication required."},401);
    return saveProfile(request,db,a);
  }

  // --------------------------------------------------------------
  // PRODUCTS
  // --------------------------------------------------------------

  if(path==="/api/products"&&(method==="GET"||method==="POST")){
    const a=await accountFromSession(request,db);
    if(!a)return json({ok:false,error:"Authentication required."},401);
    return productAction(request,db,a);
  }

  // --------------------------------------------------------------
  // SERVICES
  // --------------------------------------------------------------

  if(path==="/api/services"&&method==="POST"){
    const a=await accountFromSession(request,db);
    if(!a)return json({ok:false,error:"Authentication required."},401);
    return serviceAction(request,db,a);
  }

  // --------------------------------------------------------------
  // STORE
  // --------------------------------------------------------------

  if(path==="/api/ecommerce/store"){
    const a=await accountFromSession(request,db);
    if(!a)return json({ok:false,error:"Authentication required."},401);

    if(method==="GET"){
      return json({
        ok:true,
        store:await db.prepare(
          `SELECT * FROM ecommerce_stores WHERE account_id=?`
        ).bind(a.id).first()
      });
    }

    if(method==="POST")return saveStore(request,db,a);
  }

  // --------------------------------------------------------------
  // ORDERS
  // --------------------------------------------------------------

  if(path==="/api/ecommerce/orders"&&(method==="GET"||method==="POST")){
    const a=await accountFromSession(request,db);
    if(!a)return json({ok:false,error:"Authentication required."},401);
    return ecommerceOrders(request,db,a);
  }

  // --------------------------------------------------------------
  // CIVIC REPORTS
  // --------------------------------------------------------------

  if(path==="/api/reports"&&method==="POST"){
    const a=await accountFromSession(request,db);
    return createReport(request,db,a);
  }

  // --------------------------------------------------------------
  // WHATSAPP
  // --------------------------------------------------------------

  if(path==="/api/whatsapp")
    return whatsappWebhook(request,db,env);

  // --------------------------------------------------------------
  // ADMIN
  // --------------------------------------------------------------

  if(path.startsWith("/api/admin/")){
    const denied=adminGuard(request,env);
    if(denied)return denied;
  }

  if(path==="/api/admin/dashboard"&&method==="GET")
    return adminDashboard(db);

  if(path==="/api/admin/activity"&&method==="GET")
    return adminActivity(db);

  if(path==="/api/admin/customer"&&method==="GET")
    return adminCustomer(request,db);

  const m=path.match(/^\/api\/admin\/customer\/(\d+)\/dashboard$/);

  if(m&&method==="GET")
    return adminCustomerDashboard(db,Number(m[1]));

  // --------------------------------------------------------------
  // PUBLIC STORE
  // --------------------------------------------------------------

  const sm=path.match(/^\/store\/([^/]+)$/);

  if(sm&&method==="GET")
    return publicStore(db,sm[1]);

  return json({
    ok:false,error:"Endpoint not found.",path
  },404);
}

// ================================================================
// WORKER ENTRY
// ================================================================

export default {
  async fetch(request,env){
    try{
      return await router(request,env);
    }catch(error){
      console.error("Sky Blue Worker Error:",error);

      return json({
        ok:false,
        error:"Internal server error.",
        message:String(error?.message||error)
      },500);
    }
  }
};
