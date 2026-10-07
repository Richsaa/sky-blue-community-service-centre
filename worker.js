// ================================================================
// SKY BLUE DIGITAL SERVICE
// Complete Cloudflare Worker
// PayFast + SaaS + Customer Accounts + Business + Civic + WhatsApp
// ================================================================

const APP = "Sky Blue Digital Service";
const VERSION = "2026.10.07";

const MODULES = [
  "whatsapp","website","ecommerce","salon","food","pharmacy",
  "school","councillor","civic","npo","ngo","church","undertaker",
  "hosting","cyber","voice","directory","retail","hardware"
];

const PF_LIVE = "https://www.payfast.co.za/eng/process";
const PF_SANDBOX = "https://sandbox.payfast.co.za/eng/process";
const PF_VALIDATE_LIVE = "https://www.payfast.co.za/eng/query/validate";
const PF_VALIDATE_SANDBOX = "https://sandbox.payfast.co.za/eng/query/validate";

function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "content-type":"application/json;charset=UTF-8",
      "access-control-allow-origin":"*",
      "access-control-allow-headers":"Content-Type,Authorization",
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

async function bodyJSON(req){
  try{return await req.json();}
  catch{return {};}
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

// ================================================================
// MD5 - required by PayFast custom integration
// ================================================================

function md5(str){
  function r(x,n){return (x<<n)|(x>>>(32-n))}
  function add(x,y){
    const l=(x&65535)+(y&65535);
    return (((x>>>16)+(y>>>16)+(l>>>16))<<16)|(l&65535);
  }
  function cm(q,a,b,x,s,t){return add(r(add(add(a,q),add(x,t)),s),b)}
  function ff(a,b,c,d,x,s,t){return cm((b&c)|((~b)&d),a,b,x,s,t)}
  function gg(a,b,c,d,x,s,t){return cm((b&d)|(c&(~d)),a,b,x,s,t)}
  function hh(a,b,c,d,x,s,t){return cm(b^c^d,a,b,x,s,t)}
  function ii(a,b,c,d,x,s,t){return cm(c^(b|(~d)),a,b,x,s,t)}

  const bytes=[];
  for(let i=0;i<str.length;i++){
    let c=str.charCodeAt(i);
    if(c<128) bytes.push(c);
    else if(c<2048) bytes.push(192|(c>>6),128|(c&63));
    else bytes.push(224|(c>>12),128|((c>>6)&63),128|(c&63));
  }
  bytes.push(128);
  while(bytes.length%64!==56)bytes.push(0);

  const bit=str.length*8;
  for(let i=0;i<8;i++)bytes.push((bit/Math.pow(2,8*i))&255);

  let a=0x67452301,b=0xefcdab89,c=0x98badcfe,d=0x10325476;

  for(let i=0;i<bytes.length;i+=64){
    const x=[];
    for(let j=0;j<64;j+=4)
      x[j/4]=bytes[i+j]|bytes[i+j+1]<<8|bytes[i+j+2]<<16|bytes[i+j+3]<<24;

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

    a=add(a,A);b=add(b,B);c=add(c,C);d=add(d,D);
  }

  const out=[a,b,c,d];
  let s="";
  for(const n of out)
    for(let i=0;i<4;i++)
      s+=((n>>>(i*8))&255).toString(16).padStart(2,"0");
  return s;
}

// ================================================================
// PAYFAST
// ================================================================

function pfURL(env){
  return envBool(env.PAYFAST_SANDBOX)?PF_SANDBOX:PF_LIVE;
}

function pfValidateURL(env){
  return envBool(env.PAYFAST_SANDBOX)
    ?PF_VALIDATE_SANDBOX:PF_VALIDATE_LIVE;
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
  if(pass)s+="&passphrase="+pfEncode(pass);
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
    d.billing_date=p.billing_date||new Date().toISOString().slice(0,10);
    d.recurring_amount=money(p.recurring_amount||p.amount).toFixed(2);
    d.frequency=String(p.frequency||3);
    d.cycles=String(p.cycles??0);
    d.subscription_notify_email="true";
    d.subscription_notify_webhook="true";
    d.subscription_notify_buyer="true";
  }

  d.signature=pfSignature(d,env.PAYFAST_PASSPHRASE);
  return d;
}

function pfForm(fields,action){
  return `<!doctype html>
<html><head><meta charset="utf-8">
<title>Continue to PayFast</title>
</head><body>
<p>Redirecting to PayFast...</p>
<form id="pf" method="post" action="${action}">
${Object.entries(fields).map(([k,v])=>
`<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join("\n")}
</form><script>document.getElementById("pf").submit()</script>
</body></html>`;
}

function esc(v){
  return String(v??"")
    .replace(/&/g,"&amp;")
    .replace(/"/g,"&quot;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

// PayFast currently publishes these IPv4 ranges for ITN source validation.
function ip4(ip){
  return ip.split(".").map(Number);
}

function inCIDR(ip,cidr){
  const a=ip4(ip), [net,bits]=cidr.split("/");
  const n=ip4(net), b=Number(bits);
  if(a.length!==4||n.length!==4)return false;
  let x=0,y=0;
  for(let i=0;i<4;i++){
    x=(x<<8)|a[i];
    y=(y<<8)|n[i];
  }
  const mask=b===0?0:(0xffffffff<<(32-b));
  return (x&mask)===(y&mask);
}

function validPayfastIP(ip){
  if(!ip||ip.includes(":"))return false;
  return [
    "197.97.145.144/28",
    "41.74.179.192/27",
    "102.216.36.0/28",
    "102.216.36.128/28",
    "144.126.193.139/32"
  ].some(x=>inCIDR(ip,x));
}

async function validatePayfastITN(env,raw){
  const r=await fetch(pfValidateURL(env),{
    method:"POST",
    headers:{"content-type":"application/x-www-form-urlencoded"},
    body:raw
  });
  return (await r.text()).trim()==="VALID";
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
`CREATE TABLE IF NOT EXISTS business_records(
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL,
 type TEXT NOT NULL,
 title TEXT,
 data TEXT,
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
`CREATE TABLE IF NOT EXISTS ecommerce_orders(
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL,
 customer_name TEXT,
 customer_phone TEXT,
 items TEXT,
 total REAL,
 payment_status TEXT DEFAULT 'pending',
 order_status TEXT DEFAULT 'new',
 created_at TEXT NOT NULL
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
`CREATE TABLE IF NOT EXISTS payment_reminders(
 id TEXT PRIMARY KEY,
 account_id TEXT,
 subscription_id TEXT,
 sent_at TEXT,
 type TEXT
)`,
`CREATE TABLE IF NOT EXISTS saas_modules(
 id TEXT PRIMARY KEY,
 name TEXT UNIQUE,
 description TEXT,
 active INTEGER DEFAULT 1
)`
  ];
  for(const q of sql)await db.prepare(q).run();

  const deps=[
    [1,"Electricity & Power"],
    [2,"Water & Drainage"],
    [3,"Roads & Stormwater"],
    [4,"Waste & Illegal Dumping"],
    [5,"General Services"]
  ];
  for(const d of deps)
    await db.prepare(
      "INSERT OR IGNORE INTO departments(id,name) VALUES(?,?)"
    ).bind(d[0],d[1]).run();

  for(const m of MODULES)
    await db.prepare(
      "INSERT OR IGNORE INTO saas_modules(id,name,description) VALUES(?,?,?)"
    ).bind(id(),m,APP+" "+m+" module").run();
}

async function hash(password){
  const data=new TextEncoder().encode(password);
  const buf=await crypto.subtle.digest("SHA-256",data);
  return [...new Uint8Array(buf)]
    .map(x=>x.toString(16).padStart(2,"0")).join("");
}

async function session(req,env){
  const c=req.headers.get("Cookie")||"";
  const m=c.match(/sbs_session=([^;]+)/);
  if(!m)return null;
  return await env.DB.prepare(`
    SELECT a.* FROM customer_sessions s
    JOIN customer_accounts a ON a.id=s.account_id
    WHERE s.id=? AND s.expires_at>?
  `).bind(m[1],now()).first();
}

function cookie(name,value,max){
  return `${name}=${value}; Path=/; Max-Age=${max}; HttpOnly; Secure; SameSite=Lax`;
}

// ================================================================
// AUTH
// ================================================================

async function authRegister(req,env){
  const p=await bodyJSON(req);
  const name=clean(p.name,100);
  const email=clean(p.email,150).toLowerCase();
  const phone=clean(p.phone,40);
  const password=String(p.password||"");

  if(!name||!email||password.length<6)
    return json({error:"Name, email and password of at least 6 characters are required"},400);

  const exists=await env.DB.prepare(
    "SELECT id FROM customer_accounts WHERE email=?"
  ).bind(email).first();

  if(exists)return json({error:"Account already exists"},409);

  const account=id();
  await env.DB.prepare(`
    INSERT INTO customer_accounts
    (id,name,email,phone,password_hash,created_at)
    VALUES(?,?,?,?,?,?)
  `).bind(account,name,email,phone,await hash(password),now()).run();

  return json({ok:true,account_id:account});
}

async function authLogin(req,env){
  const p=await bodyJSON(req);
  const email=clean(p.email,150).toLowerCase();
  const password=String(p.password||"");

  const a=await env.DB.prepare(
    "SELECT * FROM customer_accounts WHERE email=?"
  ).bind(email).first();

  if(!a||a.password_hash!==(await hash(password)))
    return json({error:"Invalid email or password"},401);

  const sid=id();
  const exp=new Date(Date.now()+30*86400000).toISOString();

  await env.DB.prepare(`
    INSERT INTO customer_sessions(id,account_id,expires_at,created_at)
    VALUES(?,?,?,?)
  `).bind(sid,a.id,exp,now()).run();

  return new Response(JSON.stringify({
    ok:true,
    account:{id:a.id,name:a.name,email:a.email,phone:a.phone}
  }),{
    status:200,
    headers:{
      "content-type":"application/json",
      "set-cookie":cookie("sbs_session",sid,2592000),
      "access-control-allow-origin":"*"
    }
  });
}

async function authLogout(req,env){
  const c=req.headers.get("Cookie")||"";
  const m=c.match(/sbs_session=([^;]+)/);
  if(m)
    await env.DB.prepare("DELETE FROM customer_sessions WHERE id=?")
      .bind(m[1]).run();

  return new Response(JSON.stringify({ok:true}),{
    headers:{
      "content-type":"application/json",
      "set-cookie":cookie("sbs_session","",0),
      "access-control-allow-origin":"*"
    }
  });
}

// ================================================================
// BUSINESS / DASHBOARD
// ================================================================

async function dashboard(account,env){
  const [profile,subs,payments,services,products,orders]=await Promise.all([
    env.DB.prepare("SELECT * FROM business_profiles WHERE account_id=?")
      .bind(account.id).first(),
    env.DB.prepare("SELECT * FROM subscriptions WHERE account_id=? ORDER BY created_at DESC")
      .bind(account.id).all(),
    env.DB.prepare("SELECT * FROM saas_payments WHERE account_id=? ORDER BY created_at DESC LIMIT 50")
      .bind(account.id).all(),
    env.DB.prepare("SELECT * FROM business_services WHERE account_id=? ORDER BY created_at DESC")
      .bind(account.id).all(),
    env.DB.prepare("SELECT * FROM products WHERE account_id=? ORDER BY created_at DESC")
      .bind(account.id).all(),
    env.DB.prepare("SELECT * FROM ecommerce_orders WHERE account_id=? ORDER BY created_at DESC LIMIT 50")
      .bind(account.id).all()
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
    subscriptions:subs.results||[],
    payments:payments.results||[],
    services:services.results||[],
    products:products.results||[],
    orders:orders.results||[]
  });
}

// ================================================================
// PAYFAST CREATE PAYMENT
// ================================================================

async function payfastCreate(req,env){
  if(!env.PAYFAST_MERCHANT_ID||!env.PAYFAST_MERCHANT_KEY)
    return json({error:"PayFast merchant credentials are not configured"},500);

  const account=await session(req,env);
  if(!account)return json({error:"Login required"},401);

  const p=await bodyJSON(req);
  const amount=money(p.amount);

  if(amount<5)
    return json({error:"PayFast live minimum payment is R5.00"},400);

  const base=new URL(req.url).origin;

  const paymentId="SBS-"+Date.now()+"-"+crypto.randomUUID().slice(0,8);

  const subscription=Boolean(p.subscription);
  const item=clean(p.item_name||"Sky Blue Digital Service",100);
  const description=clean(
    p.item_description||"Sky Blue Digital Service subscription",255
  );

  const fields=pfFields(env,{
    return_url:p.return_url||base+"/payment-success",
    cancel_url:p.cancel_url||base+"/payment-cancelled",
    notify_url:p.notify_url||base+"/api/payfast/itn",
    name_first:clean(account.name.split(" ")[0],50),
    name_last:clean(account.name.split(" ").slice(1).join(" "),50),
    email_address:account.email,
    m_payment_id:paymentId,
    amount,
    item_name:item,
    item_description:description,
    subscription,
    recurring_amount:p.recurring_amount||amount,
    frequency:p.frequency||3,
    cycles:p.cycles??0,
    billing_date:p.billing_date
  });

  await env.DB.prepare(`
    INSERT INTO saas_payments
    (id,account_id,m_payment_id,amount,status,item_name,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?)
  `).bind(
    id(),account.id,paymentId,amount,"PENDING",item,now(),now()
  ).run();

  return html(pfForm(fields,pfURL(env)));
}

// ================================================================
// PAYFAST ITN
// ================================================================

async function payfastITN(req,env){
  const source=req.headers.get("CF-Connecting-IP")||"";
  if(!validPayfastIP(source))
    return text("Invalid source",403);

  const raw=await req.text();
  const params=new URLSearchParams(raw);
  const data={};

  for(const [k,v] of params.entries())data[k]=v;

  if(!data.merchant_id||data.merchant_id!==env.PAYFAST_MERCHANT_ID)
    return text("Invalid merchant",400);

  const received=data.signature||"";
  delete data.signature;

  const expected=pfSignature(data,env.PAYFAST_PASSPHRASE);

  if(received!==expected)
    return text("Invalid signature",400);

  if(!(await validatePayfastITN(env,raw)))
    return text("PayFast validation failed",400);

  const amount=money(data.amount_gross);
  const payment=await env.DB.prepare(`
    SELECT * FROM saas_payments
    WHERE m_payment_id=?
  `).bind(data.m_payment_id||"").first();

  if(payment && money(payment.amount)!==amount)
    return text("Amount mismatch",400);

  const status=clean(data.payment_status,30);
  const token=clean(data.token,100);

  if(payment){
    await env.DB.prepare(`
      UPDATE saas_payments
      SET pf_payment_id=?,fee=?,net=?,status=?,token=?,raw=?,updated_at=?
      WHERE m_payment_id=?
    `).bind(
      data.pf_payment_id||null,
      money(data.amount_fee),
      money(data.amount_net),
      status,
      token||null,
      raw,
      now(),
      data.m_payment_id
    ).run();
  }

  if(status==="COMPLETE" && payment){
    const sub=await env.DB.prepare(`
      SELECT * FROM subscriptions
      WHERE account_id=? AND status='PENDING'
      ORDER BY created_at DESC LIMIT 1
    `).bind(payment.account_id).first();

    if(sub){
      await env.DB.prepare(`
        UPDATE subscriptions
        SET status='ACTIVE',
            payfast_token=?,
            started_at=?,
            updated_at=?
        WHERE id=?
      `).bind(token||null,now(),now(),sub.id).run();
    }
  }

  return text("OK");
}

// ================================================================
// MODULES
// ================================================================

async function modules(env){
  return json({
    ok:true,
    modules:MODULES.map(name=>({
      name,
      active:true,
      monthly_from:
        name==="website"||name==="whatsapp"?"199.00":
        name==="ecommerce"?"399.00":
        name==="voice"?"299.00":"Custom"
    }))
  });
}

// ================================================================
// BUSINESS PROFILE
// ================================================================

async function businessProfile(req,env,account){
  const p=await bodyJSON(req);
  const t=now();

  const old=await env.DB.prepare(
    "SELECT id FROM business_profiles WHERE account_id=?"
  ).bind(account.id).first();

  if(old){
    await env.DB.prepare(`
      UPDATE business_profiles SET
      business_name=?,industry=?,phone=?,whatsapp=?,email=?,
      address=?,website=?,updated_at=?
      WHERE account_id=?
    `).bind(
      clean(p.business_name,150),
      clean(p.industry,100),
      clean(p.phone,50),
      clean(p.whatsapp,50),
      clean(p.email,150),
      clean(p.address,300),
      clean(p.website,300),
      t,account.id
    ).run();
  }else{
    await env.DB.prepare(`
      INSERT INTO business_profiles
      (id,account_id,business_name,industry,phone,whatsapp,email,address,website,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      id(),account.id,
      clean(p.business_name,150),
      clean(p.industry,100),
      clean(p.phone,50),
      clean(p.whatsapp,50),
      clean(p.email,150),
      clean(p.address,300),
      clean(p.website,300),
      t,t
    ).run();
  }

  return json({ok:true});
}

// ================================================================
// SERVICES
// ================================================================

async function addService(req,env,account){
  const p=await bodyJSON(req);
  await env.DB.prepare(`
    INSERT INTO business_services
    (id,account_id,name,description,price,duration,active,created_at)
    VALUES(?,?,?,?,?,?,?,?)
  `).bind(
    id(),account.id,
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
// PRODUCTS
// ================================================================

async function addProduct(req,env,account){
  const p=await bodyJSON(req);

  await env.DB.prepare(`
    INSERT INTO products
    (id,account_id,name,description,price,stock,image_url,active,created_at)
    VALUES(?,?,?,?,?,?,?,?,?)
  `).bind(
    id(),account.id,
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
// ECOMMERCE ORDER
// ================================================================

async function createOrder(req,env,account){
  const p=await bodyJSON(req);
  const items=JSON.stringify(p.items||[]);
  const total=money(p.total);

  const oid="SBO-"+Date.now();

  await env.DB.prepare(`
    INSERT INTO ecommerce_orders
    (id,account_id,customer_name,customer_phone,items,total,payment_status,order_status,created_at)
    VALUES(?,?,?,?,?,?,?,'new',?)
  `).bind(
    oid,account.id,
    clean(p.customer_name,100),
    clean(p.customer_phone,50),
    items,total,"pending",now()
  ).run();

  return json({
    ok:true,
    order_id:oid,
    payment_required:true,
    payment_provider:"PayFast"
  });
}

// ================================================================
// CIVIC REPORTS
// ================================================================

function department(category){
  const s=String(category||"").toLowerCase();

  if(/electric|power|light/.test(s))return 1;
  if(/water|drain|sewer/.test(s))return 2;
  if(/road|pothole|storm/.test(s))return 3;
  if(/waste|dump|rubbish|garbage/.test(s))return 4;
  return 5;
}

async function createReport(req,env,account){
  const p=await bodyJSON(req);
  const rid=id();
  const dept=department(p.category);

  const count=await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM reports"
  ).first();

  const number="SBS-AX-"+String(Number(count?.c||0)+1).padStart(6,"0");

  await env.DB.prepare(`
    INSERT INTO reports
    (id,report_number,account_id,category,description,location,
     priority,status,source,media_url,department_id,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    rid,number,account?.id||null,
    clean(p.category,100),
    clean(p.description,1000),
    clean(p.location,300),
    clean(p.priority||"Normal",30),
    "New",
    clean(p.source||"Web",30),
    clean(p.media_url,500),
    dept,
    now(),now()
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
    SELECT r.*,d.name department_name
    FROM reports r
    LEFT JOIN departments d ON d.id=r.department_id
    WHERE r.account_id=?
    ORDER BY r.created_at DESC
  `).bind(account.id).all();

  return json({ok:true,reports:r.results||[]});
}

// ================================================================
// WHATSAPP WEBHOOK
// ================================================================

async function whatsapp(req,env){
  if(req.method==="GET"){
    const u=new URL(req.url);
    const mode=u.searchParams.get("hub.mode");
    const token=u.searchParams.get("hub.verify_token");
    const challenge=u.searchParams.get("hub.challenge");

    if(mode==="subscribe"&&token===env.WHATSAPP_VERIFY_TOKEN)
      return text(challenge);

    return text("Forbidden",403);
  }

  const data=await bodyJSON(req);

  try{
    const entries=data.entry||[];

    for(const e of entries){
      for(const c of (e.changes||[])){
        const value=c.value||{};

        for(const m of (value.messages||[])){
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
            id(),phone,
            value.contacts?.[0]?.profile?.name||"",
            message,"IN",now()
          ).run();
        }
      }
    }
  }catch(e){
    console.log("WhatsApp error",e);
  }

  return text("EVENT_RECEIVED");
}

// ================================================================
// OWNER DASHBOARD
// ================================================================

async function owner(env,req){
  const key=env.ADMIN_KEY||"";

  if(key){
    const supplied=req.headers.get("X-Admin-Key")||
      new URL(req.url).searchParams.get("key");

    if(supplied!==key)return json({error:"Unauthorized"},401);
  }

  const [
    customers,
    subscriptions,
    payments,
    reports,
    orders
  ]=await Promise.all([
    env.DB.prepare("SELECT id,name,email,phone,created_at FROM customer_accounts ORDER BY created_at DESC").all(),
    env.DB.prepare("SELECT * FROM subscriptions ORDER BY created_at DESC").all(),
    env.DB.prepare("SELECT * FROM saas_payments ORDER BY created_at DESC").all(),
    env.DB.prepare(`
      SELECT r.*,d.name department_name
      FROM reports r LEFT JOIN departments d ON d.id=r.department_id
      ORDER BY r.created_at DESC
    `).all(),
    env.DB.prepare("SELECT * FROM ecommerce_orders ORDER BY created_at DESC").all()
  ]);

  const total=await env.DB.prepare(`
    SELECT COALESCE(SUM(amount),0) total
    FROM saas_payments
    WHERE status='COMPLETE'
  `).first();

  return json({
    ok:true,
    app:APP,
    version:VERSION,
    customers:customers.results||[],
    subscriptions:subscriptions.results||[],
    payments:payments.results||[],
    reports:reports.results||[],
    orders:orders.results||[],
    revenue:Number(total?.total||0)
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
    timestamp:now()
  });
}

// ================================================================
// ROUTER
// ================================================================

export default {
  async fetch(req,env){
    if(req.method==="OPTIONS")
      return new Response(null,{status:204,headers:{
        "access-control-allow-origin":"*",
        "access-control-allow-headers":"Content-Type,Authorization,X-Admin-Key",
        "access-control-allow-methods":"GET,POST,PUT,PATCH,DELETE,OPTIONS"
      }});

    try{
      await schema(env.DB);

      const u=new URL(req.url);
      const path=u.pathname;
      const method=req.method;

      // Health
      if(path==="/api/health")
        return health();

      // PayFast
      if(path==="/api/payfast/create"&&method==="POST")
        return payfastCreate(req,env);

      if(path==="/api/payfast/itn"&&method==="POST")
        return payfastITN(req,env);

      // WhatsApp
      if(path==="/api/whatsapp")
        return whatsapp(req,env);

      // Authentication
      if(path==="/api/auth/register"&&method==="POST")
        return authRegister(req,env);

      if(path==="/api/auth/login"&&method==="POST")
        return authLogin(req,env);

      if(path==="/api/auth/logout"&&method==="POST")
        return authLogout(req,env);

      const account=await session(req,env);

      if(path==="/api/auth/me"){
        if(!account)return json({authenticated:false});
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

      // Public module list
      if(path==="/api/modules"&&method==="GET")
        return modules(env);

      // Owner
      if(path==="/api/owner/dashboard"&&method==="GET")
        return owner(env,req);

      // Everything below requires login
      if(!account)
        return json({error:"Login required"},401);

      // Customer dashboard
      if(path==="/api/customer/dashboard"&&method==="GET")
        return dashboard(account,env);

      // Business
      if(path==="/api/business/profile"&&method==="POST")
        return businessProfile(req,env,account);

      if(path==="/api/business/services"&&method==="POST")
        return addService(req,env,account);

      if(path==="/api/products"&&method==="POST")
        return addProduct(req,env,account);

      if(path==="/api/orders"&&method==="POST")
        return createOrder(req,env,account);

      // Reports
      if(path==="/api/reports"&&method==="POST")
        return createReport(req,env,account);

      if(path==="/api/reports"&&method==="GET")
        return reports(req,env,account);

      // Subscription helper
      if(path==="/api/subscription/create"&&method==="POST"){
        const p=await bodyJSON(req);
        const amount=money(p.amount||199);

        if(amount<5)
          return json({error:"Minimum PayFast amount is R5.00"},400);

        const sid=id();

        await env.DB.prepare(`
          INSERT INTO subscriptions
          (id,account_id,module,plan,amount,status,created_at,updated_at)
          VALUES(?,?,?,?,?,'PENDING',?,?)
        `).bind(
          sid,account.id,
          clean(p.module||"website",50),
          clean(p.plan||"Monthly",100),
          amount,now(),now()
        ).run();

        return json({
          ok:true,
          subscription_id:sid,
          amount,
          next:"POST /api/payfast/create"
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
        message:String(e?.message||e)
      },500);
    }
  }
};
