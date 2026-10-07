// ================================================================
// SKY BLUE DIGITAL SERVICE
// COMPLETE CLOUDFLARE WORKER
// SaaS + PAYFAST + SELF-ACTIVATION + ECOMMERCE + WHATSAPP
// ================================================================

const APP = "Sky Blue SaaS Solutions";
const VERSION = "2026.10.07";

const MODULES = [
  "whatsapp","website","ecommerce","salon","food","pharmacy",
  "school","councillor","civic","npo","ngo","church","undertaker",
  "hosting","cyber","voice","directory","retail"
];

const PF_LIVE = "https://www.payfast.co.za/eng/process";
const PF_SANDBOX = "https://sandbox.payfast.co.za/eng/process";
const PF_VALIDATE_LIVE = "https://www.payfast.co.za/eng/query/validate";
const PF_VALIDATE_SANDBOX = "https://sandbox.payfast.co.za/eng/query/validate";

const CATALOG = {
  core:{
    name:"WhatsApp + Website",
    amount:199,
    modules:["whatsapp","website"]
  },
  number:{
    name:"Business Number",
    amount:69,
    modules:["voice"]
  },
  ecommerce:{
    name:"Ecommerce",
    amount:399,
    modules:["ecommerce"]
  },
  pbx:{
    name:"Cloud PBX",
    amount:299,
    modules:["voice","cloud-pbx"]
  }
};

function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "content-type":"application/json;charset=UTF-8",
      "access-control-allow-origin":"*",
      "access-control-allow-headers":"Content-Type,Authorization,X-Admin-Key",
      "access-control-allow-methods":"GET,POST,PUT,PATCH,DELETE,OPTIONS"
    }
  });
}

function html(body,status=200){
  return new Response(body,{
    status,
    headers:{
      "content-type":"text/html;charset=UTF-8",
      "access-control-allow-origin":"*"
    }
  });
}

function text(body,status=200){
  return new Response(body,{
    status,
    headers:{"content-type":"text/plain;charset=UTF-8"}
  });
}

function now(){
  return new Date().toISOString();
}

function id(){
  return crypto.randomUUID();
}

function clean(v,max=500){
  return String(v??"").trim().slice(0,max);
}

function money(v){
  const n=Number(v);
  return Number.isFinite(n)?Number(n.toFixed(2)):0;
}

function envBool(v){
  return String(v||"").toLowerCase()==="true";
}

async function bodyJSON(req){
  try{return await req.json();}
  catch{return {};}
}

function cookie(name,value,max){
  return `${name}=${value}; Path=/; Max-Age=${max}; HttpOnly; Secure; SameSite=Lax`;
}

// ================================================================
// MD5
// ================================================================

function md5(str){
  function r(x,n){return (x<<n)|(x>>>(32-n))}
  function add(x,y){
    const l=(x&65535)+(y&65535);
    return (((x>>>16)+(y>>>16)+(l>>>16))<<16)|(l&65535);
  }
  function cm(q,a,b,x,s,t){
    return add(r(add(add(a,q),add(x,t)),s),b);
  }
  function ff(a,b,c,d,x,s,t){
    return cm((b&c)|((~b)&d),a,b,x,s,t);
  }
  function gg(a,b,c,d,x,s,t){
    return cm((b&d)|(c&(~d)),a,b,x,s,t);
  }
  function hh(a,b,c,d,x,s,t){
    return cm(b^c^d,a,b,x,s,t);
  }
  function ii(a,b,c,d,x,s,t){
    return cm(c^(b|(~d)),a,b,x,s,t);
  }

  const bytes=[];
  for(let i=0;i<str.length;i++){
    let c=str.charCodeAt(i);
    if(c<128)bytes.push(c);
    else if(c<2048)
      bytes.push(192|(c>>6),128|(c&63));
    else
      bytes.push(
        224|(c>>12),
        128|((c>>6)&63),
        128|(c&63)
      );
  }

  bytes.push(128);
  while(bytes.length%64!==56)bytes.push(0);

  const bit=str.length*8;
  for(let i=0;i<8;i++)
    bytes.push((bit/Math.pow(2,8*i))&255);

  let a=0x67452301;
  let b=0xefcdab89;
  let c=0x98badcfe;
  let d=0x10325476;

  for(let i=0;i<bytes.length;i+=64){
    const x=[];
    for(let j=0;j<64;j+=4){
      x[j/4]=
        bytes[i+j]|
        bytes[i+j+1]<<8|
        bytes[i+j+2]<<16|
        bytes[i+j+3]<<24;
    }

    let A=a,B=b,C=c,D=d;

    A=ff(A,B,C,D,x[0],7,0xd76aa478);
    D=ff(D,A,B,C,x[1],12,0xe8c7b756);
    C=ff(C,D,A,B,x[2],17,0x242070db);
    B=ff(B,C,D,A,x[3],22,0xc1bdceee);
    A=ff(A,B,C,D,x[4],7,0xf57c0faf);
    D=ff(D,A,B,C,x[5],12,0x4787c62a);
    C=ff(C,D,A,B,x[6],17,0xa8304613);
    B=ff(B,C,D,A,x[7],22,0xfd469501);
    A=ff(A,B,C,D,x[8],7,0x698098d8);
    D=ff(D,A,B,C,x[9],12,0x8b44f7af);
    C=ff(C,D,A,B,x[10],17,0xffff5bb1);
    B=ff(B,C,D,A,x[11],22,0x895cd7be);
    A=ff(A,B,C,D,x[12],7,0x6b901122);
    D=ff(D,A,B,C,x[13],12,0xfd987193);
    C=ff(C,D,A,B,x[14],17,0xa679438e);
    B=ff(B,C,D,A,x[15],22,0x49b40821);

    A=gg(A,B,C,D,x[1],5,0xf61e2562);
    D=gg(D,A,B,C,x[6],9,0xc040b340);
    C=gg(C,D,A,B,x[11],14,0x265e5a51);
    B=gg(B,C,D,A,x[0],20,0xe9b6c7aa);
    A=gg(A,B,C,D,x[5],5,0xd62f105d);
    D=gg(D,A,B,C,x[10],9,0x02441453);
    C=gg(C,D,A,B,x[15],14,0xd8a1e681);
    B=gg(B,C,D,A,x[4],20,0xe7d3fbc8);
    A=gg(A,B,C,D,x[9],5,0x21e1cde6);
    D=gg(D,A,B,C,x[14],9,0xc33707d6);
    C=gg(C,D,A,B,x[3],14,0xf4d50d87);
    B=gg(B,C,D,A,x[8],20,0x455a14ed);
    A=gg(A,B,C,D,x[13],5,0xa9e3e905);
    D=gg(D,A,B,C,x[2],9,0xfcefa3f8);
    C=gg(C,D,A,B,x[7],14,0x676f02d9);
    B=gg(B,C,D,A,x[12],20,0x8d2a4c8a);

    A=hh(A,B,C,D,x[5],4,0xfffa3942);
    D=hh(D,A,B,C,x[8],11,0x8771f681);
    C=hh(C,D,A,B,x[11],16,0x6d9d6122);
    B=hh(B,C,D,A,x[14],23,0xfde5380c);
    A=hh(A,B,C,D,x[1],4,0xa4beea44);
    D=hh(D,A,B,C,x[4],11,0x4bdecfa9);
    C=hh(C,D,A,B,x[7],16,0xf6bb4b60);
    B=hh(B,C,D,A,x[10],23,0xbebfbc70);
    A=hh(A,B,C,D,x[13],4,0x289b7ec6);
    D=hh(D,A,B,C,x[0],11,0xeaa127fa);
    C=hh(C,D,A,B,x[3],16,0xd4ef3085);
    B=hh(B,C,D,A,x[6],23,0x04881d05);
    A=hh(A,B,C,D,x[9],4,0xd9d4d039);
    D=hh(D,A,B,C,x[12],11,0xe6db99e5);
    C=hh(C,D,A,B,x[15],16,0x1fa27cf8);
    B=hh(B,C,D,A,x[2],23,0xc4ac5665);

    A=ii(A,B,C,D,x[0],6,0xf4292244);
    D=ii(D,A,B,C,x[7],10,0x432aff97);
    C=ii(C,D,A,B,x[14],15,0xab9423a7);
    B=ii(B,C,D,A,x[5],21,0xfc93a039);
    A=ii(A,B,C,D,x[12],6,0x655b59c3);
    D=ii(D,A,B,C,x[3],10,0x8f0ccc92);
    C=ii(C,D,A,B,x[10],15,0xffeff47d);
    B=ii(B,C,D,A,x[1],21,0x85845dd1);
    A=ii(A,B,C,D,x[8],6,0x6fa87e4f);
    D=ii(D,A,B,C,x[15],10,0xfe2ce6e0);
    C=ii(C,D,A,B,x[6],15,0xa3014314);
    B=ii(B,C,D,A,x[13],21,0x4e0811a1);
    A=ii(A,B,C,D,x[4],6,0xf7537e82);
    D=ii(D,A,B,C,x[11],10,0xbd3af235);
    C=ii(C,D,A,B,x[2],15,0x2ad7d2bb);
    B=ii(B,C,D,A,x[9],21,0xeb86d391);

    a=add(a,A);
    b=add(b,B);
    c=add(c,C);
    d=add(d,D);
  }

  const out=[a,b,c,d];
  let s="";

  for(const n of out){
    for(let i=0;i<4;i++)
      s+=((n>>>(i*8))&255)
        .toString(16).padStart(2,"0");
  }

  return s;
}

// ================================================================
// PAYFAST
// ================================================================

function pfURL(env){
  return envBool(env.PAYFAST_SANDBOX)
    ?PF_SANDBOX
    :PF_LIVE;
}

function pfValidateURL(env){
  return envBool(env.PAYFAST_SANDBOX)
    ?PF_VALIDATE_SANDBOX
    :PF_VALIDATE_LIVE;
}

function pfEncode(v){
  return encodeURIComponent(String(v).trim())
    .replace(/%20/g,"+");
}

function pfSignature(data,pass){
  const parts=[];

  for(const [k,v] of Object.entries(data)){
    if(v!==undefined&&v!==null&&String(v)!=="")
      parts.push(k+"="+pfEncode(v));
  }

  let s=parts.join("&");

  if(pass)
    s+="&passphrase="+pfEncode(pass);

  return md5(s);
}

function pfFields(env,p){
  const d={
    merchant_id:env.PAYFAST_MERCHANT_ID,
    merchant_key:env.PAYFAST_MERCHANT_KEY,
    return_url:p.return_url,
    cancel_url:p.cancel_url,
    notify_url:p.notify_url,
    name_first:p.name_first,
    name_last:p.name_last,
    email_address:p.email_address,
    m_payment_id:p.m_payment_id,
    amount:money(p.amount).toFixed(2),
    item_name:p.item_name,
    item_description:p.item_description
  };

  if(p.subscription){
    d.subscription_type="1";
    d.billing_date=
      p.billing_date||
      new Date().toISOString().slice(0,10);
    d.recurring_amount=
      money(p.recurring_amount||p.amount).toFixed(2);
    d.frequency=String(p.frequency||3);
    d.cycles=String(p.cycles??0);
    d.subscription_notify_email="true";
    d.subscription_notify_webhook="true";
    d.subscription_notify_buyer="true";
  }

  d.signature=pfSignature(
    d,
    env.PAYFAST_PASSPHRASE
  );

  return d;
}

function esc(v){
  return String(v??"")
    .replace(/&/g,"&amp;")
    .replace(/"/g,"&quot;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

function pfForm(fields,action){
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Continue to PayFast</title>
</head>
<body>
<p>Redirecting to PayFast...</p>
<form id="pf" method="post" action="${esc(action)}">
${Object.entries(fields).map(([k,v])=>
`<input type="hidden" name="${esc(k)}" value="${esc(v)}">`
).join("\n")}
</form>
<script>
document.getElementById("pf").submit();
</script>
</body>
</html>`;
}

async function validatePayfastITN(env,raw){
  const r=await fetch(pfValidateURL(env),{
    method:"POST",
    headers:{
      "content-type":
        "application/x-www-form-urlencoded"
    },
    body:raw
  });

  return (await r.text()).trim()==="VALID";
}

// ================================================================
// PAYFAST IP
// ================================================================

function ip4(ip){
  return ip.split(".").map(Number);
}

function inCIDR(ip,cidr){
  const a=ip4(ip);
  const [net,bits]=cidr.split("/");
  const n=ip4(net);
  const b=Number(bits);

  if(a.length!==4||n.length!==4)
    return false;

  let x=0;
  let y=0;

  for(let i=0;i<4;i++){
    x=(x<<8)|a[i];
    y=(y<<8)|n[i];
  }

  const mask=
    b===0
      ?0
      :(0xffffffff<<(32-b));

  return (x&mask)===(y&mask);
}

function validPayfastIP(ip){
  if(!ip||ip.includes(":"))
    return false;

  return [
    "197.97.145.144/28",
    "41.74.179.192/27",
    "102.216.36.0/28",
    "102.216.36.128/28",
    "144.126.193.139/32"
  ].some(x=>inCIDR(ip,x));
}

// ================================================================
// DATABASE
// ================================================================

async function schema(db){

  const sql=[

`CREATE TABLE IF NOT EXISTS customer_accounts(
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT UNIQUE NOT NULL,
 phone TEXT,
 password_hash TEXT NOT NULL,
 created_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS customer_sessions(
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS business_profiles(
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL,
 business_name TEXT,
 industry TEXT,
 phone TEXT,
 whatsapp TEXT,
 email TEXT,
 address TEXT,
 website TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS subscriptions(
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL,
 module TEXT NOT NULL,
 plan TEXT,
 amount REAL NOT NULL,
 status TEXT NOT NULL,
 payfast_token TEXT,
 payfast_payment_id TEXT,
 started_at TEXT,
 next_billing_date TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS saas_payments(
 id TEXT PRIMARY KEY,
 account_id TEXT,
 subscription_id TEXT,
 m_payment_id TEXT,
 pf_payment_id TEXT,
 amount REAL,
 fee REAL,
 net REAL,
 status TEXT,
 item_name TEXT,
 token TEXT,
 raw TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS business_services(
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL,
 name TEXT NOT NULL,
 description TEXT,
 price REAL DEFAULT 0,
 duration INTEGER DEFAULT 0,
 active INTEGER DEFAULT 1,
 created_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS products(
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL,
 name TEXT NOT NULL,
 description TEXT,
 price REAL NOT NULL,
 stock INTEGER DEFAULT 0,
 image_url TEXT,
 active INTEGER DEFAULT 1,
 created_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS ecommerce_stores(
 id TEXT PRIMARY KEY,
 account_id TEXT UNIQUE NOT NULL,
 store_name TEXT,
 slug TEXT UNIQUE,
 email TEXT,
 phone TEXT,
 whatsapp TEXT,
 currency TEXT DEFAULT 'ZAR',
 description TEXT,
 logo_url TEXT,
 primary_color TEXT DEFAULT '#0b5ed7',
 secondary_color TEXT DEFAULT '#082b5c',
 status TEXT DEFAULT 'active',
 published INTEGER DEFAULT 1,
 checkout_enabled INTEGER DEFAULT 1,
 delivery_enabled INTEGER DEFAULT 0,
 pickup_enabled INTEGER DEFAULT 1,
 delivery_fee REAL DEFAULT 0,
 payment_provider TEXT DEFAULT 'PayFast',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS ecommerce_categories(
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL,
 name TEXT NOT NULL,
 description TEXT,
 active INTEGER DEFAULT 1,
 created_at TEXT NOT NULL
)`,

`CREATE TABLE IF NOT EXISTS ecommerce_orders(
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL,
 customer_name TEXT,
 customer_phone TEXT,
 customer_email TEXT,
 items TEXT,
 total REAL,
 payment_status TEXT DEFAULT 'pending',
 order_status TEXT DEFAULT 'new',
 delivery_method TEXT,
 delivery_address TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT
)`,

`CREATE TABLE IF NOT EXISTS reports(
 id TEXT PRIMARY KEY,
 report_number TEXT UNIQUE,
 account_id TEXT,
 category TEXT,
 description TEXT,
 location TEXT,
 priority TEXT,
 status TEXT,
 source TEXT,
 media_url TEXT,
 department_id INTEGER,
 created_at TEXT,
 updated_at TEXT
)`,

`CREATE TABLE IF NOT EXISTS report_updates(
 id TEXT PRIMARY KEY,
 report_id TEXT,
 status TEXT,
 note TEXT,
 created_at TEXT
)`,

`CREATE TABLE IF NOT EXISTS departments(
 id INTEGER PRIMARY KEY,
 name TEXT UNIQUE
)`,

`CREATE TABLE IF NOT EXISTS whatsapp_conversations(
 id TEXT PRIMARY KEY,
 phone TEXT,
 name TEXT,
 message TEXT,
 direction TEXT,
 created_at TEXT
)`,

`CREATE TABLE IF NOT EXISTS saas_modules(
 id TEXT PRIMARY KEY,
 name TEXT UNIQUE,
 description TEXT,
 active INTEGER DEFAULT 1
)`

  ];

  for(const q of sql)
    await db.prepare(q).run();

  try{
    await db.prepare(
      "ALTER TABLE subscriptions ADD COLUMN payfast_payment_id TEXT"
    ).run();
  }catch{}

  try{
    await db.prepare(
      "ALTER TABLE ecommerce_orders ADD COLUMN customer_email TEXT"
    ).run();
  }catch{}

  try{
    await db.prepare(
      "ALTER TABLE ecommerce_orders ADD COLUMN delivery_method TEXT"
    ).run();
  }catch{}

  try{
    await db.prepare(
      "ALTER TABLE ecommerce_orders ADD COLUMN delivery_address TEXT"
    ).run();
  }catch{}

  try{
    await db.prepare(
      "ALTER TABLE ecommerce_orders ADD COLUMN updated_at TEXT"
    ).run();
  }catch{}

  const deps=[
    [1,"Electricity & Power"],
    [2,"Water & Drainage"],
    [3,"Roads & Stormwater"],
    [4,"Waste & Illegal Dumping"],
    [5,"General Services"]
  ];

  for(const d of deps){
    await db.prepare(
      "INSERT OR IGNORE INTO departments(id,name) VALUES(?,?)"
    ).bind(d[0],d[1]).run();
  }

  for(const m of MODULES){
    await db.prepare(
      `INSERT OR IGNORE INTO saas_modules
       (id,name,description)
       VALUES(?,?,?)`
    ).bind(
      id(),
      m,
      APP+" "+m+" module"
    ).run();
  }
}

// ================================================================
// AUTH
// ================================================================

async function hash(password){
  const data=new TextEncoder().encode(password);

  const buf=await crypto.subtle.digest(
    "SHA-256",
    data
  );

  return [...new Uint8Array(buf)]
    .map(x=>x.toString(16).padStart(2,"0"))
    .join("");
}

async function session(req,env){
  const c=req.headers.get("Cookie")||"";
  const m=c.match(/sbs_session=([^;]+)/);

  if(!m)
    return null;

  return await env.DB.prepare(`
    SELECT a.*
    FROM customer_sessions s
    JOIN customer_accounts a
      ON a.id=s.account_id
    WHERE s.id=?
      AND s.expires_at>?
  `).bind(
    m[1],
    now()
  ).first();
}

async function authRegister(req,env){
  const p=await bodyJSON(req);

  const name=clean(p.name,100);
  const email=clean(p.email,150).toLowerCase();
  const phone=clean(p.phone,50);
  const password=String(p.password||"");

  if(!name||!email||password.length<6)
    return json({
      error:"Name, email and password of at least 6 characters are required"
    },400);

  const exists=await env.DB.prepare(
    "SELECT id FROM customer_accounts WHERE email=?"
  ).bind(email).first();

  if(exists)
    return json({
      error:"Account already exists"
    },409);

  const account=id();

  await env.DB.prepare(`
    INSERT INTO customer_accounts
    (id,name,email,phone,password_hash,created_at)
    VALUES(?,?,?,?,?,?)
  `).bind(
    account,
    name,
    email,
    phone,
    await hash(password),
    now()
  ).run();

  return json({
    ok:true,
    account_id:account
  });
}

async function authLogin(req,env){
  const p=await bodyJSON(req);

  const email=clean(
    p.email,
    150
  ).toLowerCase();

  const password=String(p.password||"");

  const a=await env.DB.prepare(
    "SELECT * FROM customer_accounts WHERE email=?"
  ).bind(email).first();

  if(
    !a||
    a.password_hash!==(await hash(password))
  )
    return json({
      error:"Invalid email or password"
    },401);

  const sid=id();

  const exp=new Date(
    Date.now()+30*86400000
  ).toISOString();

  await env.DB.prepare(`
    INSERT INTO customer_sessions
    (id,account_id,expires_at,created_at)
    VALUES(?,?,?,?)
  `).bind(
    sid,
    a.id,
    exp,
    now()
  ).run();

  return new Response(
    JSON.stringify({
      ok:true,
      account:{
        id:a.id,
        name:a.name,
        email:a.email,
        phone:a.phone
      }
    }),
    {
      status:200,
      headers:{
        "content-type":"application/json",
        "set-cookie":cookie(
          "sbs_session",
          sid,
          2592000
        ),
        "access-control-allow-origin":"*"
      }
    }
  );
}

async function authLogout(req,env){
  const c=req.headers.get("Cookie")||"";
  const m=c.match(/sbs_session=([^;]+)/);

  if(m){
    await env.DB.prepare(
      "DELETE FROM customer_sessions WHERE id=?"
    ).bind(m[1]).run();
  }

  return new Response(
    JSON.stringify({ok:true}),
    {
      headers:{
        "content-type":"application/json",
        "set-cookie":cookie(
          "sbs_session",
          "",
          0
        ),
        "access-control-allow-origin":"*"
      }
    }
  );
}

// ================================================================
// BUSINESS PROFILE
// ================================================================

async function saveBusinessProfile(req,env,account,data){
  const p=data||await bodyJSON(req);
  const t=now();

  const old=await env.DB.prepare(
    "SELECT id FROM business_profiles WHERE account_id=?"
  ).bind(account.id).first();

  if(old){
    await env.DB.prepare(`
      UPDATE business_profiles SET
      business_name=?,
      industry=?,
      phone=?,
      whatsapp=?,
      email=?,
      address=?,
      website=?,
      updated_at=?
      WHERE account_id=?
    `).bind(
      clean(p.business_name,150),
      clean(p.industry,100),
      clean(p.phone,50),
      clean(p.whatsapp,50),
      clean(p.email,150),
      clean(p.address,300),
      clean(p.website,300),
      t,
      account.id
    ).run();
  }else{
    await env.DB.prepare(`
      INSERT INTO business_profiles
      (id,account_id,business_name,industry,phone,
       whatsapp,email,address,website,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      id(),
      account.id,
      clean(p.business_name,150),
      clean(p.industry,100),
      clean(p.phone,50),
      clean(p.whatsapp,50),
      clean(p.email,150),
      clean(p.address,300),
      clean(p.website,300),
      t,
      t
    ).run();
  }
}

// ================================================================
// SELF-ACTIVATION
// ================================================================

async function activateEcommerce(env,account){
  const profile=await env.DB.prepare(`
    SELECT * FROM business_profiles
    WHERE account_id=?
  `).bind(account.id).first();

  if(!profile)
    return;

  const existing=await env.DB.prepare(`
    SELECT id FROM ecommerce_stores
    WHERE account_id=?
  `).bind(account.id).first();

  if(existing){
    await env.DB.prepare(`
      UPDATE ecommerce_stores
      SET status='active',
          published=1,
          checkout_enabled=1,
          updated_at=?
      WHERE account_id=?
    `).bind(
      now(),
      account.id
    ).run();

    return;
  }

  const base=clean(
    profile.business_name||"Sky Blue Store",
    100
  );

  const slug=base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,60)
    ||("store-"+account.id.slice(0,8));

  await env.DB.prepare(`
    INSERT INTO ecommerce_stores
    (id,account_id,store_name,slug,email,phone,whatsapp,
     currency,description,status,published,checkout_enabled,
     pickup_enabled,payment_provider,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id(),
    account.id,
    base,
    slug,
    profile.email||account.email,
    profile.phone||account.phone||"",
    profile.whatsapp||profile.phone||"",
    "ZAR",
    "Online store powered by Sky Blue SaaS Solutions",
    "active",
    1,
    1,
    1,
    "PayFast",
    now(),
    now()
  ).run();
}

async function activatePaidModules(env,account,paymentId,token){
  const subs=await env.DB.prepare(`
    SELECT *
    FROM subscriptions
    WHERE account_id=?
      AND payfast_payment_id=?
  `).bind(
    account.id,
    paymentId
  ).all();

  for(const sub of subs.results||[]){
    await env.DB.prepare(`
      UPDATE subscriptions
      SET status='ACTIVE',
          payfast_token=?,
          started_at=COALESCE(started_at,?),
          updated_at=?
      WHERE id=?
    `).bind(
      token||null,
      now(),
      now(),
      sub.id
    ).run();
  }

  const ecommerce=(subs.results||[])
    .some(x=>x.module==="ecommerce");

  if(ecommerce)
    await activateEcommerce(env,account);
}

// ================================================================
// CHECKOUT
// ================================================================

async function checkoutStart(req,env){
  if(
    !env.PAYFAST_MERCHANT_ID||
    !env.PAYFAST_MERCHANT_KEY
  )
    return json({
      error:"PayFast merchant credentials are not configured"
    },500);

  const p=await bodyJSON(req);

  const selected=Array.isArray(p.products)
    ?p.products
    :String(p.products||"core")
      .split(",")
      .map(x=>x.trim())
      .filter(Boolean);

  const products=[];
  let total=0;
  const moduleSet=new Set();

  for(const key of selected){
    const item=CATALOG[key];

    if(!item)
      continue;

    products.push({
      key,
      name:item.name,
      amount:item.amount,
      modules:item.modules
    });

    total+=item.amount;

    for(const m of item.modules)
      moduleSet.add(m);
  }

  if(!products.length)
    return json({
      error:"Select at least one product"
    },400);

  const name=clean(p.name,100);
  const email=clean(
    p.email,
    150
  ).toLowerCase();
  const phone=clean(p.phone,50);
  const businessName=clean(
    p.business_name,
    150
  );
  const industry=clean(
    p.industry,
    100
  );
  const password=String(
    p.password||""
  );

  if(
    !name||
    !email||
    !phone||
    !businessName||
    password.length<6
  )
    return json({
      error:
        "Name, email, phone, business name and password are required"
    },400);

  let account=await env.DB.prepare(`
    SELECT * FROM customer_accounts
    WHERE email=?
  `).bind(email).first();

  if(account){
    if(account.password_hash!==(await hash(password)))
      return json({
        error:"An account already exists with this email"
      },409);
  }else{
    account={
      id:id(),
      name,
      email,
      phone
    };

    await env.DB.prepare(`
      INSERT INTO customer_accounts
      (id,name,email,phone,password_hash,created_at)
      VALUES(?,?,?,?,?,?)
    `).bind(
      account.id,
      name,
      email,
      phone,
      await hash(password),
      now()
    ).run();
  }

  await saveBusinessProfile(
    req,
    env,
    account,
    {
      business_name:businessName,
      industry,
      phone,
      whatsapp:clean(p.whatsapp||phone,50),
      email,
      address:clean(p.address,300),
      website:clean(p.website,300)
    }
  );

  const paymentId=
    "SBS-"+Date.now()+"-"+
    crypto.randomUUID().slice(0,8);

  for(const module of moduleSet){
    const product=products.find(
      x=>x.modules.includes(module)
    );

    const amount=
      module==="ecommerce"
        ?399
        :module==="voice"
          ?products.some(x=>x.key==="pbx")
            ?299
            :69
          :199;

    await env.DB.prepare(`
      INSERT INTO subscriptions
      (id,account_id,module,plan,amount,status,
       payfast_payment_id,created_at,updated_at)
      VALUES(?,?,?,?,?,'PENDING',?,?,?)
    `).bind(
      id(),
      account.id,
      module,
      product?.name||"Monthly",
      amount,
      paymentId,
      now(),
      now()
    ).run();
  }

  await env.DB.prepare(`
    INSERT INTO saas_payments
    (id,account_id,m_payment_id,amount,status,
     item_name,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?)
  `).bind(
    id(),
    account.id,
    paymentId,
    money(total),
    "PENDING",
    products.map(x=>x.name).join(" + "),
    now(),
    now()
  ).run();

  const sid=id();

  await env.DB.prepare(`
    INSERT INTO customer_sessions
    (id,account_id,expires_at,created_at)
    VALUES(?,?,?,?)
  `).bind(
    sid,
    account.id,
    new Date(
      Date.now()+30*86400000
    ).toISOString(),
    now()
  ).run();

  const base=new URL(req.url).origin;

  const fields=pfFields(env,{
    return_url:
      p.return_url||
      base+"/payment-success",
    cancel_url:
      p.cancel_url||
      base+"/payment-cancelled",
    notify_url:
      p.notify_url||
      base+"/api/payfast/itn",
    name_first:
      clean(name.split(" ")[0],50),
    name_last:
      clean(
        name.split(" ").slice(1).join(" "),
        50
      ),
    email_address:email,
    m_payment_id:paymentId,
    amount:total,
    item_name:
      products.map(x=>x.name).join(" + "),
    item_description:
      "Sky Blue SaaS Solutions monthly subscription",
    subscription:true,
    recurring_amount:total,
    frequency:3,
    cycles:0
  });

  return html(
    pfForm(fields,pfURL(env))
  );
}

// ================================================================
// PAYFAST CREATE
// ================================================================

async function payfastCreate(req,env){
  if(
    !env.PAYFAST_MERCHANT_ID||
    !env.PAYFAST_MERCHANT_KEY
  )
    return json({
      error:"PayFast merchant credentials are not configured"
    },500);

  const account=await session(req,env);

  if(!account)
    return json({
      error:"Login required"
    },401);

  const p=await bodyJSON(req);
  const amount=money(p.amount);

  if(amount<5)
    return json({
      error:"PayFast minimum payment is R5.00"
    },400);

  const base=new URL(req.url).origin;

  const paymentId=
    "SBS-"+Date.now()+"-"+
    crypto.randomUUID().slice(0,8);

  const fields=pfFields(env,{
    return_url:
      p.return_url||
      base+"/payment-success",
    cancel_url:
      p.cancel_url||
      base+"/payment-cancelled",
    notify_url:
      p.notify_url||
      base+"/api/payfast/itn",
    name_first:
      clean(account.name.split(" ")[0],50),
    name_last:
      clean(
        account.name.split(" ").slice(1).join(" "),
        50
      ),
    email_address:account.email,
    m_payment_id:paymentId,
    amount,
    item_name:
      clean(
        p.item_name||
        "Sky Blue SaaS Solutions",
        100
      ),
    item_description:
      clean(
        p.item_description||
        "Sky Blue SaaS Solutions subscription",
        255
      ),
    subscription:Boolean(p.subscription),
    recurring_amount:
      p.recurring_amount||amount,
    frequency:p.frequency||3,
    cycles:p.cycles??0
  });

  await env.DB.prepare(`
    INSERT INTO saas_payments
    (id,account_id,m_payment_id,amount,status,
     item_name,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?)
  `).bind(
    id(),
    account.id,
    paymentId,
    amount,
    "PENDING",
    clean(
      p.item_name||
      "Sky Blue SaaS Solutions",
      100
    ),
    now(),
    now()
  ).run();

  return html(
    pfForm(fields,pfURL(env))
  );
}

// ================================================================
// PAYFAST ITN
// ================================================================

async function payfastITN(req,env){
  const source=
    req.headers.get("CF-Connecting-IP")||"";

  if(
    source &&
    !validPayfastIP(source)
  )
    return text(
      "Invalid source",
      403
    );

  const raw=await req.text();
  const params=new URLSearchParams(raw);
  const data={};

  for(const [k,v] of params.entries())
    data[k]=v;

  if(
    !data.merchant_id||
    data.merchant_id!==env.PAYFAST_MERCHANT_ID
  )
    return text(
      "Invalid merchant",
      400
    );

  const received=data.signature||"";
  delete data.signature;

  const expected=pfSignature(
    data,
    env.PAYFAST_PASSPHRASE
  );

  if(received!==expected)
    return text(
      "Invalid signature",
      400
    );

  if(!(await validatePayfastITN(env,raw)))
    return text(
      "PayFast validation failed",
      400
    );

  const paymentId=
    data.m_payment_id||"";

  const payment=await env.DB.prepare(`
    SELECT * FROM saas_payments
    WHERE m_payment_id=?
  `).bind(paymentId).first();

  if(!payment)
    return text(
      "Payment not found",
      404
    );

  const amount=money(
    data.amount_gross
  );

  if(
    money(payment.amount)!==amount
  )
    return text(
      "Amount mismatch",
      400
    );

  const status=
    clean(
      data.payment_status,
      30
    );

  const token=
    clean(
      data.token,
      150
    );

  await env.DB.prepare(`
    UPDATE saas_payments
    SET pf_payment_id=?,
        fee=?,
        net=?,
        status=?,
        token=?,
        raw=?,
        updated_at=?
    WHERE m_payment_id=?
  `).bind(
    data.pf_payment_id||null,
    money(data.amount_fee),
    money(data.amount_net),
    status,
    token||null,
    raw,
    now(),
    paymentId
  ).run();

  if(
    status==="COMPLETE"
  ){
    const account=await env.DB.prepare(`
      SELECT * FROM customer_accounts
      WHERE id=?
    `).bind(
      payment.account_id
    ).first();

    if(account){
      await activatePaidModules(
        env,
        account,
        paymentId,
        token
      );
    }
  }

  return text("OK");
}

// ================================================================
// CUSTOMER DASHBOARD
// ================================================================

async function dashboard(account,env){
  const [
    profile,
    subs,
    payments,
    services,
    products,
    orders,
    store
  ]=await Promise.all([

    env.DB.prepare(`
      SELECT * FROM business_profiles
      WHERE account_id=?
    `).bind(account.id).first(),

    env.DB.prepare(`
      SELECT * FROM subscriptions
      WHERE account_id=?
      ORDER BY created_at DESC
    `).bind(account.id).all(),

    env.DB.prepare(`
      SELECT * FROM saas_payments
      WHERE account_id=?
      ORDER BY created_at DESC
      LIMIT 50
    `).bind(account.id).all(),

    env.DB.prepare(`
      SELECT * FROM business_services
      WHERE account_id=?
      ORDER BY created_at DESC
    `).bind(account.id).all(),

    env.DB.prepare(`
      SELECT * FROM products
      WHERE account_id=?
      ORDER BY created_at DESC
    `).bind(account.id).all(),

    env.DB.prepare(`
      SELECT * FROM ecommerce_orders
      WHERE account_id=?
      ORDER BY created_at DESC
      LIMIT 50
    `).bind(account.id).all(),

    env.DB.prepare(`
      SELECT * FROM ecommerce_stores
      WHERE account_id=?
    `).bind(account.id).first()
  ]);

  return json({
    ok:true,

    account:{
      id:account.id,
      name:account.name,
      email:account.email,
      phone:account.phone
    },

    profile:profile||null,

    subscriptions:
      subs.results||[],

    active_modules:
      (subs.results||[])
        .filter(x=>x.status==="ACTIVE")
        .map(x=>x.module),

    payments:
      payments.results||[],

    services:
      services.results||[],

    products:
      products.results||[],

    orders:
      orders.results||[],

    ecommerce:
      store||null
  });
}

// ================================================================
// PRODUCTS
// ================================================================

async function addProduct(req,env,account){
  const p=await bodyJSON(req);

  await env.DB.prepare(`
    INSERT INTO products
    (id,account_id,name,description,price,
     stock,image_url,active,created_at)
    VALUES(?,?,?,?,?,?,?,?,?)
  `).bind(
    id(),
    account.id,
    clean(p.name,150),
    clean(p.description,1000),
    money(p.price),
    Number(p.stock)||0,
    clean(p.image_url,500),
    p.active===false?0:1,
    now()
  ).run();

  return json({ok:true});
}

// ================================================================
// ECOMMERCE STORE
// ================================================================

async function ecommerceStore(req,env,account){
  const p=await bodyJSON(req);

  const old=await env.DB.prepare(`
    SELECT id FROM ecommerce_stores
    WHERE account_id=?
  `).bind(account.id).first();

  const profile=await env.DB.prepare(`
    SELECT * FROM business_profiles
    WHERE account_id=?
  `).bind(account.id).first();

  const storeName=
    clean(
      p.store_name||
      profile?.business_name||
      "My Online Store",
      150
    );

  const slug=
    clean(
      p.slug||
      storeName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g,"-")
        .replace(/^-+|-+$/g,""),
      80
    );

  if(old){
    await env.DB.prepare(`
      UPDATE ecommerce_stores SET
      store_name=?,
      slug=?,
      email=?,
      phone=?,
      whatsapp=?,
      description=?,
      logo_url=?,
      primary_color=?,
      secondary_color=?,
      delivery_enabled=?,
      pickup_enabled=?,
      delivery_fee=?,
      updated_at=?
      WHERE account_id=?
    `).bind(
      storeName,
      slug,
      clean(p.email||profile?.email,150),
      clean(p.phone||profile?.phone,50),
      clean(p.whatsapp||profile?.whatsapp,50),
      clean(p.description,500),
      clean(p.logo_url,500),
      clean(p.primary_color||"#0b5ed7",30),
      clean(p.secondary_color||"#082b5c",30),
      p.delivery_enabled?1:0,
      p.pickup_enabled===false?0:1,
      money(p.delivery_fee),
      now(),
      account.id
    ).run();
  }else{
    await env.DB.prepare(`
      INSERT INTO ecommerce_stores
      (id,account_id,store_name,slug,email,phone,whatsapp,
       currency,description,logo_url,primary_color,
       secondary_color,status,published,checkout_enabled,
       delivery_enabled,pickup_enabled,delivery_fee,
       payment_provider,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      id(),
      account.id,
      storeName,
      slug,
      clean(p.email||profile?.email,150),
      clean(p.phone||profile?.phone,50),
      clean(p.whatsapp||profile?.whatsapp,50),
      "ZAR",
      clean(p.description,500),
      clean(p.logo_url,500),
      clean(p.primary_color||"#0b5ed7",30),
      clean(p.secondary_color||"#082b5c",30),
      "active",
      1,
      1,
      p.delivery_enabled?1:0,
      p.pickup_enabled===false?0:1,
      money(p.delivery_fee),
      "PayFast",
      now(),
      now()
    ).run();
  }

  return json({
    ok:true,
    message:"Ecommerce store saved and active"
  });
}

// ================================================================
// ECOMMERCE ORDERS
// ================================================================

async function createOrder(req,env,account){
  const p=await bodyJSON(req);

  const oid=
    "SBO-"+Date.now();

  const total=money(p.total);

  await env.DB.prepare(`
    INSERT INTO ecommerce_orders
    (id,account_id,customer_name,customer_phone,
     customer_email,items,total,payment_status,
     order_status,delivery_method,delivery_address,
     created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,'pending','new',?,?,?,?)
  `).bind(
    oid,
    account.id,
    clean(p.customer_name,100),
    clean(p.customer_phone,50),
    clean(p.customer_email,150),
    JSON.stringify(p.items||[]),
    total,
    clean(p.delivery_method,30),
    clean(p.delivery_address,500),
    now(),
    now()
  ).run();

  return json({
    ok:true,
    order_id:oid,
    payment_required:true,
    payment_provider:"PayFast"
  });
}

// ================================================================
// SERVICES
// ================================================================

async function addService(req,env,account){
  const p=await bodyJSON(req);

  await env.DB.prepare(`
    INSERT INTO business_services
    (id,account_id,name,description,price,
     duration,active,created_at)
    VALUES(?,?,?,?,?,?,?,?)
  `).bind(
    id(),
    account.id,
    clean(p.name,150),
    clean(p.description,500),
    money(p.price),
    Number(p.duration)||0,
    p.active===false?0:1,
    now()
  ).run();

  return json({ok:true});
}

// ================================================================
// CIVIC
// ================================================================

function department(category){
  const s=String(
    category||""
  ).toLowerCase();

  if(/electric|power|light/.test(s))
    return 1;

  if(/water|drain|sewer/.test(s))
    return 2;

  if(/road|pothole|storm/.test(s))
    return 3;

  if(/waste|dump|rubbish|garbage/.test(s))
    return 4;

  return 5;
}

async function createReport(req,env,account){
  const p=await bodyJSON(req);

  const rid=id();

  const dept=department(
    p.category
  );

  const count=await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM reports"
  ).first();

  const number=
    "SBS-AX-"+
    String(
      Number(count?.c||0)+1
    ).padStart(6,"0");

  await env.DB.prepare(`
    INSERT INTO reports
    (id,report_number,account_id,category,
     description,location,priority,status,
     source,media_url,department_id,
     created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    rid,
    number,
    account?.id||null,
    clean(p.category,100),
    clean(p.description,1000),
    clean(p.location,300),
    clean(p.priority||"Normal",30),
    "New",
    clean(p.source||"Web",30),
    clean(p.media_url,500),
    dept,
    now(),
    now()
  ).run();

  return json({
    ok:true,
    report_number:number,
    department_id:dept,
    status:"New"
  });
}

async function reports(req,env,account){
  const r=await env.DB.prepare(`
    SELECT
      r.*,
      d.name department_name
    FROM reports r
    LEFT JOIN departments d
      ON d.id=r.department_id
    WHERE r.account_id=?
    ORDER BY r.created_at DESC
  `).bind(account.id).all();

  return json({
    ok:true,
    reports:r.results||[]
  });
}

// ================================================================
// WHATSAPP
// ================================================================

async function whatsapp(req,env){
  if(req.method==="GET"){
    const u=new URL(req.url);

    const mode=
      u.searchParams.get("hub.mode");

    const token=
      u.searchParams.get("hub.verify_token");

    const challenge=
      u.searchParams.get("hub.challenge");

    if(
      mode==="subscribe"&&
      token===env.WHATSAPP_VERIFY_TOKEN
    )
      return text(challenge);

    return text(
      "Forbidden",
      403
    );
  }

  const data=await bodyJSON(req);

  try{
    for(const e of data.entry||[]){
      for(const c of e.changes||[]){
        const value=c.value||{};

        for(const m of value.messages||[]){
          const phone=m.from||"";

          const message=
            m.text?.body||
            m.image?.caption||
            m.video?.caption||
            "[media]";

          await env.DB.prepare(`
            INSERT INTO whatsapp_conversations
            (id,phone,name,message,direction,created_at)
            VALUES(?,?,?,?,?,?)
          `).bind(
            id(),
            phone,
            value.contacts?.[0]?.profile?.name||"",
            message,
            "IN",
            now()
          ).run();
        }
      }
    }
  }catch(e){
    console.log(
      "WhatsApp error",
      e
    );
  }

  return text(
    "EVENT_RECEIVED"
  );
}

// ================================================================
// MODULES
// ================================================================

async function modules(){
  return json({
    ok:true,
    modules:MODULES.map(name=>({
      name,
      active:true,
      monthly_from:
        name==="website"||
        name==="whatsapp"
          ?"199.00":
        name==="ecommerce"
          ?"399.00":
        name==="voice"
          ?"69.00":
        "Custom"
    }))
  });
}

// ================================================================
// OWNER DASHBOARD
// ================================================================

async function owner(env,req){
  const key=env.ADMIN_KEY||"";

  if(key){
    const supplied=
      req.headers.get("X-Admin-Key")||
      new URL(req.url)
        .searchParams.get("key");

    if(supplied!==key)
      return json({
        error:"Unauthorized"
      },401);
  }

  const [
    customers,
    subscriptions,
    payments,
    reportsData,
    orders,
    stores
  ]=await Promise.all([

    env.DB.prepare(`
      SELECT id,name,email,phone,created_at
      FROM customer_accounts
      ORDER BY created_at DESC
    `).all(),

    env.DB.prepare(`
      SELECT *
      FROM subscriptions
      ORDER BY created_at DESC
    `).all(),

    env.DB.prepare(`
      SELECT *
      FROM saas_payments
      ORDER BY created_at DESC
    `).all(),

    env.DB.prepare(`
      SELECT
        r.*,
        d.name department_name
      FROM reports r
      LEFT JOIN departments d
        ON d.id=r.department_id
      ORDER BY r.created_at DESC
    `).all(),

    env.DB.prepare(`
      SELECT *
      FROM ecommerce_orders
      ORDER BY created_at DESC
    `).all(),

    env.DB.prepare(`
      SELECT *
      FROM ecommerce_stores
      ORDER BY created_at DESC
    `).all()
  ]);

  const total=await env.DB.prepare(`
    SELECT COALESCE(SUM(amount),0) total
    FROM saas_payments
    WHERE status='COMPLETE'
  `).first();

  const active=await env.DB.prepare(`
    SELECT COUNT(*) total
    FROM subscriptions
    WHERE status='ACTIVE'
  `).first();

  return json({
    ok:true,
    app:APP,
    version:VERSION,
    customers:
      customers.results||[],
    subscriptions:
      subscriptions.results||[],
    payments:
      payments.results||[],
    reports:
      reportsData.results||[],
    orders:
      orders.results||[],
    ecommerce_stores:
      stores.results||[],
    active_subscriptions:
      Number(active?.total||0),
    revenue:
      Number(total?.total||0)
  });
}

// ================================================================
// HEALTH
// ================================================================

async function health(){
  return json({
    ok:true,
    status:"online",
    service:APP,
    version:VERSION,
    payment_provider:"PayFast",
    self_activation:true,
    ecommerce:true,
    timestamp:now()
  });
}

// ================================================================
// ROUTER
// ================================================================

export default {

  async fetch(req,env){

    if(req.method==="OPTIONS"){
      return new Response(
        null,
        {
          status:204,
          headers:{
            "access-control-allow-origin":"*",
            "access-control-allow-headers":
              "Content-Type,Authorization,X-Admin-Key",
            "access-control-allow-methods":
              "GET,POST,PUT,PATCH,DELETE,OPTIONS"
          }
        }
      );
    }

    try{

      await schema(env.DB);

      const u=new URL(req.url);
      const path=u.pathname;
      const method=req.method;

      // ----------------------------------------------------------
      // HEALTH
      // ----------------------------------------------------------

      if(path==="/api/health")
        return health();

      // ----------------------------------------------------------
      // PUBLIC PRODUCT CATALOG
      // ----------------------------------------------------------

      if(
        path==="/api/modules"&&
        method==="GET"
      )
        return modules();

      if(
        path==="/api/catalog"&&
        method==="GET"
      )
        return json({
          ok:true,
          products:CATALOG
        });

      // ----------------------------------------------------------
      // SELF-SERVICE CHECKOUT
      // ----------------------------------------------------------

      if(
        path==="/api/checkout/start"&&
        method==="POST"
      )
        return checkoutStart(req,env);

      // ----------------------------------------------------------
      // PAYFAST
      // ----------------------------------------------------------

      if(
        path==="/api/payfast/create"&&
        method==="POST"
      )
        return payfastCreate(req,env);

      if(
        path==="/api/payfast/itn"&&
        method==="POST"
      )
        return payfastITN(req,env);

      // ----------------------------------------------------------
      // WHATSAPP
      // ----------------------------------------------------------

      if(path==="/api/whatsapp")
        return whatsapp(req,env);

      // ----------------------------------------------------------
      // AUTH
      // ----------------------------------------------------------

      if(
        path==="/api/auth/register"&&
        method==="POST"
      )
        return authRegister(req,env);

      if(
        path==="/api/auth/login"&&
        method==="POST"
      )
        return authLogin(req,env);

      if(
        path==="/api/auth/logout"&&
        method==="POST"
      )
        return authLogout(req,env);

      const account=
        await session(req,env);

      if(path==="/api/auth/me"){
        if(!account)
          return json({
            authenticated:false
          });

        return json({
          authenticated:true,
          account:{
            id:account.id,
            name:account.name,
            email:account.email,
            phone:account.phone
          }
        });
      }

      // ----------------------------------------------------------
      // OWNER
      // ----------------------------------------------------------

      if(
        path==="/api/owner/dashboard"&&
        method==="GET"
      )
        return owner(env,req);

      // ----------------------------------------------------------
      // LOGIN REQUIRED
      // ----------------------------------------------------------

      if(!account)
        return json({
          error:"Login required"
        },401);

      // ----------------------------------------------------------
      // CUSTOMER DASHBOARD
      // ----------------------------------------------------------

      if(
        path==="/api/customer/dashboard"&&
        method==="GET"
      )
        return dashboard(
          account,
          env
        );

      // ----------------------------------------------------------
      // BUSINESS PROFILE
      // ----------------------------------------------------------

      if(
        path==="/api/business/profile"&&
        method==="POST"
      )
        return saveBusinessProfile(
          req,
          env,
          account
        ).then(
          ()=>json({ok:true})
        );

      // ----------------------------------------------------------
      // BUSINESS SERVICES
      // ----------------------------------------------------------

      if(
        path==="/api/business/services"&&
        method==="POST"
      )
        return addService(
          req,
          env,
          account
        );

      // ----------------------------------------------------------
      // PRODUCTS
      // ----------------------------------------------------------

      if(
        path==="/api/products"&&
        method==="POST"
      )
        return addProduct(
          req,
          env,
          account
        );

      // ----------------------------------------------------------
      // ECOMMERCE STORE
      // ----------------------------------------------------------

      if(
        path==="/api/ecommerce/store"&&
        method==="POST"
      )
        return ecommerceStore(
          req,
          env,
          account
        );

      // ----------------------------------------------------------
      // ECOMMERCE ORDERS
      // ----------------------------------------------------------

      if(
        path==="/api/orders"&&
        method==="POST"
      )
        return createOrder(
          req,
          env,
          account
        );

      // ----------------------------------------------------------
      // CIVIC REPORTS
      // ----------------------------------------------------------

      if(
        path==="/api/reports"&&
        method==="POST"
      )
        return createReport(
          req,
          env,
          account
        );

      if(
        path==="/api/reports"&&
        method==="GET"
      )
        return reports(
          req,
          env,
          account
        );

      // ----------------------------------------------------------
      // MANUAL SUBSCRIPTION
      // ----------------------------------------------------------

      if(
        path==="/api/subscription/create"&&
        method==="POST"
      ){
        const p=await bodyJSON(req);

        const amount=
          money(p.amount||199);

        if(amount<5)
          return json({
            error:"Minimum PayFast amount is R5.00"
          },400);

        const sid=id();
        const paymentId=
          "SBS-"+Date.now()+"-"+
          crypto.randomUUID().slice(0,8);

        await env.DB.prepare(`
          INSERT INTO subscriptions
          (id,account_id,module,plan,amount,status,
           payfast_payment_id,created_at,updated_at)
          VALUES(?,?,?,?,?,'PENDING',?,?,?)
        `).bind(
          sid,
          account.id,
          clean(
            p.module||"website",
            50
          ),
          clean(
            p.plan||"Monthly",
            100
          ),
          amount,
          paymentId,
          now(),
          now()
        ).run();

        return json({
          ok:true,
          subscription_id:sid,
          payment_id:paymentId,
          amount,
          next:"POST /api/payfast/create"
        });
      }

      // ----------------------------------------------------------
      // PUBLIC ECOMMERCE STORE
      // ----------------------------------------------------------

      if(
        path.startsWith("/store/")&&
        method==="GET"
      ){
        const slug=
          clean(
            path.slice(7),
            80
          );

        const store=
          await env.DB.prepare(`
            SELECT *
            FROM ecommerce_stores
            WHERE slug=?
              AND status='active'
              AND published=1
          `).bind(slug).first();

        if(!store)
          return json({
            error:"Store not found"
          },404);

        const products=
          await env.DB.prepare(`
            SELECT *
            FROM products
            WHERE account_id=?
              AND active=1
            ORDER BY created_at DESC
          `).bind(
            store.account_id
          ).all();

        return json({
          ok:true,
          store,
          products:
            products.results||[]
        });
      }

      return json({
        error:"Endpoint not found",
        path
      },404);

    }catch(e){

      console.error(e);

      return json({
        error:"Internal server error",
        message:String(
          e?.message||e
        )
      },500);
    }
  }
};
