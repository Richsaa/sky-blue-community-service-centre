/*
 * SKY BLUE SOLUTION
 * Unified SaaS Backend
 *
 * Cloudflare Worker + D1
 *
 * Modules:
 * 1. Community Service Centre
 * 2. NPO & NGO Management
 * 3. Church Management
 * 4. E-Commerce & Online Store
 * 5. Salon & Barber Management
 * 6. Laundry Management
 * 7. Food Business Management
 * 8. Wholesale & Grocery Management
 * 9. Driving School Management
 * 10. School Management
 * 11. Preschool & Day-care Management
 * 12. Pharmacy Management
 * 13. Transport Management
 * 14. IT Business Management
 * 15. Building Materials Management
 * 16. Other Service Businesses
 */

const TENANT_ID = 1;
const WARD_ID = 1;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};

const MODULES = [
  {
    code: "community",
    name: "Community Service Centre",
    category: "Community",
    price: 199,
    icon: "🏘️",
    description: "Community reporting, service requests, departments and WhatsApp reporting."
  },
  {
    code: "npo",
    name: "NPO & NGO Management",
    category: "Organisation",
    price: 199,
    icon: "🤝",
    description: "Beneficiaries, projects, donors, grants, volunteers, expenses and governance."
  },
  {
    code: "church",
    name: "Church Management",
    category: "Organisation",
    price: 199,
    icon: "⛪",
    description: "Members, visitors, attendance, events, ministries, giving and communication."
  },
  {
    code: "ecommerce",
    name: "E-Commerce & Online Store",
    category: "Commerce",
    price: 199,
    icon: "🛒",
    description: "Online store, products, orders, customers, inventory and deliveries."
  },
  {
    code: "salon",
    name: "Salon & Barber Management",
    category: "Services",
    price: 99,
    icon: "💇",
    description: "Customers, staff, services, appointments, sales and stock."
  },
  {
    code: "laundry",
    name: "Laundry Management",
    category: "Services",
    price: 99,
    icon: "🧺",
    description: "Laundry orders, collection, delivery, pricing and payments."
  },
  {
    code: "food",
    name: "Food Business Management",
    category: "Commerce",
    price: 99,
    icon: "🍔",
    description: "Menu, orders, tables, stock, suppliers, sales and expenses."
  },
  {
    code: "wholesale",
    name: "Wholesale & Grocery Management",
    category: "Commerce",
    price: 149,
    icon: "📦",
    description: "Products, stock, suppliers, customers, sales, purchases and deliveries."
  },
  {
    code: "driving",
    name: "Driving School Management",
    category: "Education",
    price: 149,
    icon: "🚗",
    description: "Learners, instructors, vehicles, lessons, bookings and progress."
  },
  {
    code: "school",
    name: "School Management",
    category: "Education",
    price: 199,
    icon: "🏫",
    description: "Learners, parents, teachers, classes, attendance and fees."
  },
  {
    code: "preschool",
    name: "Preschool & Day-care Management",
    category: "Education",
    price: 149,
    icon: "🧸",
    description: "Children, parents, attendance, activities, fees and staff."
  },
  {
    code: "pharmacy",
    name: "Pharmacy Management",
    category: "Commerce",
    price: 199,
    icon: "💊",
    description: "Products, inventory, batches, expiry tracking, suppliers and sales."
  },
  {
    code: "transport",
    name: "Transport Management",
    category: "Transport",
    price: 149,
    icon: "🚚",
    description: "Vehicles, drivers, trips, bookings, maintenance and payments."
  },
  {
    code: "it",
    name: "IT Business Management",
    category: "Technology",
    price: 149,
    icon: "💻",
    description: "Customers, tickets, assets, quotations, invoices and support."
  },
  {
    code: "building",
    name: "Building Materials Management",
    category: "Commerce",
    price: 149,
    icon: "🧱",
    description: "Products, stock, customers, quotations, suppliers and deliveries."
  },
  {
    code: "services",
    name: "Other Service Businesses",
    category: "Services",
    price: 99,
    icon: "🛠️",
    description: "Flexible customer, service, booking, quotation and invoicing tools."
  }
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function text(data, status = 200) {
  return new Response(data, {
    status,
    headers: {
      ...CORS,
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}

function html(data, status = 200) {
  return new Response(data, {
    status,
    headers: {
      ...CORS,
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}

function cookie(name, value, maxAge) {
  return `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function deleteCookie(name) {
  return `${name}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const parts = header.split(";").map(x => x.trim());

  for (const part of parts) {
    const index = part.indexOf("=");

    if (index === -1) continue;

    const key = part.substring(0, index);
    const value = part.substring(index + 1);

    if (key === name) {
      return value;
    }
  }

  return null;
}

function makeToken() {
  return crypto.randomUUID() + "-" + crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

async function body(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomUUID();
  }

  const data = new TextEncoder().encode(`${salt}:${password}`);

  const digest = await crypto.subtle.digest("SHA-256", data);

  const hash = [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return {
    salt,
    hash
  };
}

async function verifyPassword(password, salt, expected) {
  const result = await hashPassword(password, salt);
  return result.hash === expected;
}

function safe(value) {
  if (value === undefined || value === null) return null;
  return String(value);
}

function cleanSearch(value) {
  return String(value || "")
    .replace(/[%_]/g, "")
    .trim()
    .substring(0, 100);
}

async function ensureBaseTables(env) {
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS customer_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL DEFAULT 1,
        business_name TEXT NOT NULL,
        full_name TEXT,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        plan TEXT,
        subscription_status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS customer_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(account_id) REFERENCES customer_accounts(id)
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS saas_modules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_code TEXT NOT NULL UNIQUE,
        module_name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        monthly_price REAL NOT NULL DEFAULT 0,
        icon TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        customer_visible INTEGER NOT NULL DEFAULT 1,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS customer_modules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        module_code TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        activated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(account_id, module_code)
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS saas_organisations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL DEFAULT 1,
        account_id INTEGER,
        business_name TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        city TEXT,
        province TEXT,
        website TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS saas_customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        address TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS saas_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        sku TEXT,
        category TEXT,
        description TEXT,
        price REAL NOT NULL DEFAULT 0,
        cost_price REAL NOT NULL DEFAULT 0,
        quantity REAL NOT NULL DEFAULT 0,
        minimum_quantity REAL NOT NULL DEFAULT 0,
        unit TEXT DEFAULT 'each',
        status TEXT NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS saas_services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        category TEXT,
        description TEXT,
        price REAL NOT NULL DEFAULT 0,
        duration_minutes INTEGER,
        status TEXT NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS saas_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        customer_id INTEGER,
        reference TEXT,
        description TEXT,
        amount REAL NOT NULL DEFAULT 0,
        payment_method TEXT,
        status TEXT NOT NULL DEFAULT 'paid',
        sale_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS saas_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        category TEXT,
        supplier TEXT,
        description TEXT,
        amount REAL NOT NULL DEFAULT 0,
        payment_method TEXT,
        reference TEXT,
        expense_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'paid',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS saas_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        customer_id INTEGER,
        service_id INTEGER,
        staff_name TEXT,
        booking_date TEXT,
        start_time TEXT,
        end_time TEXT,
        status TEXT NOT NULL DEFAULT 'scheduled',
        notes TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS saas_quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        customer_id INTEGER,
        quote_number TEXT,
        description TEXT,
        amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'draft',
        valid_until TEXT,
        notes TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS saas_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        customer_id INTEGER,
        invoice_number TEXT,
        description TEXT,
        amount REAL NOT NULL DEFAULT 0,
        paid_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'unpaid',
        due_date TEXT,
        invoice_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS saas_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organisation_id INTEGER NOT NULL,
        record_id INTEGER,
        customer_id INTEGER,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        payment_status TEXT NOT NULL DEFAULT 'paid',
        reference TEXT,
        paid_at DATETIME,
        notes TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS saas_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        module_code TEXT,
        action TEXT NOT NULL,
        description TEXT,
        record_type TEXT,
        record_id INTEGER,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS saas_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
  ]);

  for (let i = 0; i < MODULES.length; i++) {
    const m = MODULES[i];

    await env.DB.prepare(`
      INSERT OR IGNORE INTO saas_modules
      (
        module_code,
        module_name,
        category,
        description,
        monthly_price,
        icon,
        display_order
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      m.code,
      m.name,
      m.category,
      m.description,
      m.price,
      m.icon,
      i + 1
    ).run();
  }
}

async function ensureNpoTables(env) {
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS npo_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL UNIQUE,
        organisation_name TEXT,
        registration_number TEXT,
        organisation_type TEXT,
        description TEXT,
        mission TEXT,
        vision TEXT,
        contact_person TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        province TEXT,
        city TEXT,
        website TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS npo_beneficiaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        id_number TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        category TEXT,
        vulnerability TEXT,
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS npo_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        category TEXT,
        description TEXT,
        start_date TEXT,
        end_date TEXT,
        budget REAL DEFAULT 0,
        target TEXT,
        manager TEXT,
        location TEXT,
        status TEXT DEFAULT 'planned',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS npo_donors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        donor_type TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        reference TEXT,
        notes TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS npo_donations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        donor_id INTEGER,
        project_id INTEGER,
        amount REAL DEFAULT 0,
        payment_method TEXT,
        reference TEXT,
        donation_date TEXT,
        status TEXT DEFAULT 'received',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS npo_grants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        funder TEXT NOT NULL,
        grant_name TEXT,
        reference TEXT,
        requested_amount REAL DEFAULT 0,
        awarded_amount REAL DEFAULT 0,
        project_id INTEGER,
        application_date TEXT,
        reporting_requirements TEXT,
        status TEXT DEFAULT 'application',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS npo_volunteers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        skills TEXT,
        availability TEXT,
        start_date TEXT,
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS npo_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        category TEXT,
        supplier TEXT,
        description TEXT,
        amount REAL DEFAULT 0,
        project_id INTEGER,
        grant_id INTEGER,
        payment_method TEXT,
        reference TEXT,
        expense_date TEXT,
        status TEXT DEFAULT 'paid',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS npo_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        document_type TEXT,
        reference TEXT,
        expiry_date TEXT,
        status TEXT DEFAULT 'active',
        document_url TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS npo_governance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        meeting_date TEXT,
        meeting_type TEXT,
        attendees TEXT,
        agenda TEXT,
        decisions TEXT,
        resolutions TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  ]);
}

async function ensureChurchTables(env) {
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS church_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        surname TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        gender TEXT,
        date_of_birth TEXT,
        membership_date TEXT,
        family_id INTEGER,
        ministry TEXT,
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS church_families (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        family_name TEXT NOT NULL,
        contact_person TEXT,
        phone TEXT,
        address TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS church_visitors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        visit_date TEXT,
        follow_up_status TEXT DEFAULT 'new',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS church_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        event_date TEXT,
        start_time TEXT,
        end_time TEXT,
        location TEXT,
        organiser TEXT,
        description TEXT,
        status TEXT DEFAULT 'planned',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS church_prayer_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        name TEXT,
        phone TEXT,
        request TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS church_finance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        category TEXT,
        amount REAL DEFAULT 0,
        payment_method TEXT,
        reference TEXT,
        transaction_date TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS church_attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        member_id INTEGER,
        event_name TEXT,
        attendance_date TEXT,
        status TEXT DEFAULT 'present',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  ]);
}

async function ensureIndustryTables(env) {
  const tables = [
    ["ecommerce_orders", `
      CREATE TABLE IF NOT EXISTS ecommerce_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        customer_id INTEGER,
        order_number TEXT,
        total REAL DEFAULT 0,
        payment_status TEXT DEFAULT 'pending',
        order_status TEXT DEFAULT 'new',
        delivery_status TEXT DEFAULT 'pending',
        delivery_address TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `],

    ["ecommerce_store_settings", `
      CREATE TABLE IF NOT EXISTS ecommerce_store_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL UNIQUE,
        store_name TEXT,
        description TEXT,
        logo_url TEXT,
        custom_slug TEXT,
        whatsapp_number TEXT,
        delivery_enabled INTEGER DEFAULT 1,
        currency TEXT DEFAULT 'ZAR',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `],

    ["salon_staff", `
      CREATE TABLE IF NOT EXISTS salon_staff (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        role TEXT,
        commission_rate REAL DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `],

    ["laundry_orders", `
      CREATE TABLE IF NOT EXISTS laundry_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        customer_id INTEGER,
        order_number TEXT,
        service_type TEXT,
        item_description TEXT,
        quantity REAL DEFAULT 1,
        price REAL DEFAULT 0,
        pickup_date TEXT,
        delivery_date TEXT,
        status TEXT DEFAULT 'received',
        payment_status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `],

    ["food_orders", `
      CREATE TABLE IF NOT EXISTS food_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        customer_id INTEGER,
        order_number TEXT,
        order_type TEXT DEFAULT 'takeaway',
        table_number TEXT,
        total REAL DEFAULT 0,
        payment_status TEXT DEFAULT 'pending',
        status TEXT DEFAULT 'new',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `],

    ["driving_learners", `
      CREATE TABLE IF NOT EXISTS driving_learners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        licence_code TEXT,
        id_number TEXT,
        instructor TEXT,
        progress TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `],

    ["school_learners", `
      CREATE TABLE IF NOT EXISTS school_learners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        surname TEXT,
        admission_number TEXT,
        grade TEXT,
        parent_name TEXT,
        parent_phone TEXT,
        parent_email TEXT,
        address TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `],

    ["school_attendance", `
      CREATE TABLE IF NOT EXISTS school_attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        learner_id INTEGER,
        attendance_date TEXT,
        status TEXT DEFAULT 'present',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `],

    ["preschool_children", `
      CREATE TABLE IF NOT EXISTS preschool_children (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        surname TEXT,
        date_of_birth TEXT,
        parent_name TEXT,
        parent_phone TEXT,
        allergies TEXT,
        emergency_contact TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `],

    ["pharmacy_batches", `
      CREATE TABLE IF NOT EXISTS pharmacy_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        product_id INTEGER,
        batch_number TEXT,
        expiry_date TEXT,
        quantity REAL DEFAULT 0,
        supplier TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `],

    ["transport_vehicles", `
      CREATE TABLE IF NOT EXISTS transport_vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        registration_number TEXT NOT NULL,
        make TEXT,
        model TEXT,
        year TEXT,
        driver TEXT,
        mileage REAL DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `],

    ["transport_trips", `
      CREATE TABLE IF NOT EXISTS transport_trips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        vehicle_id INTEGER,
        driver TEXT,
        customer TEXT,
        origin TEXT,
        destination TEXT,
        trip_date TEXT,
        amount REAL DEFAULT 0,
        status TEXT DEFAULT 'planned',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `],

    ["it_tickets", `
      CREATE TABLE IF NOT EXISTS it_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        customer_id INTEGER,
        ticket_number TEXT,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT DEFAULT 'normal',
        status TEXT DEFAULT 'open',
        assigned_to TEXT,
        resolution TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `],

    ["it_assets", `
      CREATE TABLE IF NOT EXISTS it_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        customer_id INTEGER,
        asset_name TEXT NOT NULL,
        asset_type TEXT,
        serial_number TEXT,
        purchase_date TEXT,
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `],

    ["building_deliveries", `
      CREATE TABLE IF NOT EXISTS building_deliveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        customer_id INTEGER,
        delivery_number TEXT,
        address TEXT,
        driver TEXT,
        vehicle TEXT,
        delivery_date TEXT,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `],

    ["service_jobs", `
      CREATE TABLE IF NOT EXISTS service_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        customer_id INTEGER,
        service_id INTEGER,
        job_number TEXT,
        title TEXT NOT NULL,
        description TEXT,
        scheduled_date TEXT,
        assigned_to TEXT,
        amount REAL DEFAULT 0,
        status TEXT DEFAULT 'new',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `]
  ];

  for (const [, sql] of tables) {
    await env.DB.prepare(sql).run();
  }
}

async function ensureCommunityTables(env) {
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        active INTEGER DEFAULT 1
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        active INTEGER DEFAULT 1
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL DEFAULT 1,
        ward_id INTEGER NOT NULL DEFAULT 1,
        reference TEXT,
        category TEXT,
        description TEXT,
        location TEXT,
        name TEXT,
        phone TEXT,
        priority TEXT DEFAULT 'Normal',
        department_id INTEGER,
        status TEXT DEFAULT 'New',
        source TEXT DEFAULT 'Web',
        resolution_notes TEXT,
        resolved_at TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS report_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id INTEGER NOT NULL,
        status TEXT,
        note TEXT,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS residents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER DEFAULT 1,
        name TEXT,
        phone TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS whatsapp_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT,
        message TEXT,
        direction TEXT,
        state TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  ]);

  const categories = [
    "Electricity",
    "Water",
    "Drainage",
    "Potholes",
    "Roads",
    "Illegal Dumping",
    "Fire",
    "Vandalism",
    "Public Toilets",
    "Building on Sidewalk",
    "Theft",
    "Other"
  ];

  for (const name of categories) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO categories (id,name) VALUES (?,?)`
    ).bind(categories.indexOf(name) + 1, name).run();
  }

  const departments = [
    "Electricity",
    "Water",
    "Roads",
    "Waste",
    "Public Safety"
  ];

  for (const name of departments) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO departments (id,name) VALUES (?,?)`
    ).bind(departments.indexOf(name) + 1, name).run();
  }
}

async function ensureAllTables(env) {
  await ensureBaseTables(env);
  await ensureNpoTables(env);
  await ensureChurchTables(env);
  await ensureIndustryTables(env);
  await ensureCommunityTables(env);
}

async function getAccount(request, env) {
  const token = getCookie(request, "sbs_session");

  if (!token) {
    return null;
  }

  const result = await env.DB.prepare(`
    SELECT
      a.*,
      s.token,
      s.expires_at
    FROM customer_sessions s
    JOIN customer_accounts a ON a.id = s.account_id
    WHERE s.token = ?
      AND datetime(s.expires_at) > datetime('now')
    LIMIT 1
  `).bind(token).first();

  if (!result) return null;

  if (result.subscription_status === "suspended") {
    return null;
  }

  return result;
}

async function requireAccount(request, env) {
  const account = await getAccount(request, env);

  if (!account) {
    return json({
      success: false,
      error: "Authentication required"
    }, 401);
  }

  return account;
}

async function logActivity(env, accountId, moduleCode, action, description, type = null, recordId = null) {
  try {
    await env.DB.prepare(`
      INSERT INTO saas_activity
      (
        account_id,
        module_code,
        action,
        description,
        record_type,
        record_id
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      accountId,
      moduleCode,
      action,
      description,
      type,
      recordId
    ).run();
  } catch {}
}

async function moduleExists(env, code) {
  return !!await env.DB.prepare(`
    SELECT id
    FROM saas_modules
    WHERE module_code = ?
      AND active = 1
    LIMIT 1
  `).bind(code).first();
}

async function moduleEnabled(env, accountId, code) {
  if (code === "community") {
    return true;
  }

  const row = await env.DB.prepare(`
    SELECT id
    FROM customer_modules
    WHERE account_id = ?
      AND module_code = ?
      AND status = 'active'
    LIMIT 1
  `).bind(accountId, code).first();

  return !!row;
}

async function requireModule(request, env, code) {
  const account = await requireAccount(request, env);

  if (account instanceof Response) {
    return account;
  }

  const exists = await moduleExists(env, code);

  if (!exists) {
    return json({
      success: false,
      error: "Module not found"
    }, 404);
  }

  const enabled = await moduleEnabled(env, account.id, code);

  if (!enabled) {
    return json({
      success: false,
      error: "Module is not activated for this account",
      module_code: code
    }, 403);
  }

  return account;
}

async function activateModule(request, env) {
  const account = await requireAccount(request, env);

  if (account instanceof Response) {
    return account;
  }

  const data = await body(request);
  const code = safe(data.module_code);

  if (!code) {
    return json({
      success: false,
      error: "module_code is required"
    }, 400);
  }

  const module = await env.DB.prepare(`
    SELECT *
    FROM saas_modules
    WHERE module_code = ?
      AND active = 1
    LIMIT 1
  `).bind(code).first();

  if (!module) {
    return json({
      success: false,
      error: "Module not found"
    }, 404);
  }

  await env.DB.prepare(`
    INSERT INTO customer_modules
    (
      account_id,
      module_code,
      status
    )
    VALUES (?, ?, 'active')
    ON CONFLICT(account_id,module_code)
    DO UPDATE SET
      status='active',
      updated_at=CURRENT_TIMESTAMP
  `).bind(account.id, code).run();

  await logActivity(
    env,
    account.id,
    code,
    "module_activated",
    `Activated ${module.module_name}`
  );

  return json({
    success: true,
    message: "Module activated",
    module
  });
}

async function deactivateModule(request, env) {
  const account = await requireAccount(request, env);

  if (account instanceof Response) {
    return account;
  }

  const data = await body(request);

  if (!data.module_code) {
    return json({
      success: false,
      error: "module_code is required"
    }, 400);
  }

  await env.DB.prepare(`
    UPDATE customer_modules
    SET status='inactive',
        updated_at=CURRENT_TIMESTAMP
    WHERE account_id=?
      AND module_code=?
  `).bind(
    account.id,
    data.module_code
  ).run();

  return json({
    success: true,
    message: "Module deactivated"
  });
}

async function authRegister(request, env) {
  const data = await body(request);

  const businessName = safe(data.business_name || data.businessName);
  const fullName = safe(data.full_name || data.fullName);
  const email = safe(data.email).toLowerCase();
  const phone = safe(data.phone);
  const password = safe(data.password);
  const plan = safe(data.plan || "");

  if (!businessName || !email || !password) {
    return json({
      success: false,
      error: "Business name, email and password are required"
    }, 400);
  }

  if (password.length < 6) {
    return json({
      success: false,
      error: "Password must contain at least 6 characters"
    }, 400);
  }

  const existing = await env.DB.prepare(`
    SELECT id
    FROM customer_accounts
    WHERE email=?
    LIMIT 1
  `).bind(email).first();

  if (existing) {
    return json({
      success: false,
      error: "An account with this email already exists"
    }, 409);
  }

  const pass = await hashPassword(password);

  const result = await env.DB.prepare(`
    INSERT INTO customer_accounts
    (
      tenant_id,
      business_name,
      full_name,
      email,
      phone,
      password_hash,
      password_salt,
      plan,
      subscription_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).bind(
    TENANT_ID,
    businessName,
    fullName,
    email,
    phone,
    pass.hash,
    pass.salt,
    plan
  ).run();

  const accountId = result.meta.last_row_id;

  await env.DB.prepare(`
    INSERT INTO saas_organisations
    (
      tenant_id,
      account_id,
      business_name,
      email,
      phone
    )
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    TENANT_ID,
    accountId,
    businessName,
    email,
    phone
  ).run();

  return json({
    success: true,
    message: "Account created",
    account_id: accountId
  }, 201);
}

async function authLogin(request, env) {
  const data = await body(request);

  const email = safe(data.email).toLowerCase();
  const password = safe(data.password);

  if (!email || !password) {
    return json({
      success: false,
      error: "Email and password are required"
    }, 400);
  }

  const account = await env.DB.prepare(`
    SELECT *
    FROM customer_accounts
    WHERE email=?
    LIMIT 1
  `).bind(email).first();

  if (!account) {
    return json({
      success: false,
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
      success: false,
      error: "Invalid email or password"
    }, 401);
  }

  if (account.subscription_status === "suspended") {
    return json({
      success: false,
      error: "Your account has been suspended"
    }, 403);
  }

  const token = makeToken();

  await env.DB.prepare(`
    INSERT INTO customer_sessions
    (
      account_id,
      token,
      expires_at
    )
    VALUES (?, ?, datetime('now','+30 days'))
  `).bind(
    account.id,
    token
  ).run();

  const response = json({
    success: true,
    message: "Login successful",
    account: {
      id: account.id,
      business_name: account.business_name,
      full_name: account.full_name,
      email: account.email,
      phone: account.phone,
      plan: account.plan,
      subscription_status: account.subscription_status
    }
  });

  response.headers.set(
    "Set-Cookie",
    cookie("sbs_session", token, 60 * 60 * 24 * 30)
  );

  return response;
}

async function authMe(request, env) {
  const account = await getAccount(request, env);

  if (!account) {
    return json({
      success: false,
      authenticated: false
    }, 401);
  }

  return json({
    success: true,
    authenticated: true,
    account: {
      id: account.id,
      business_name: account.business_name,
      full_name: account.full_name,
      email: account.email,
      phone: account.phone,
      plan: account.plan,
      subscription_status: account.subscription_status,
      created_at: account.created_at
    }
  });
}

async function authLogout(request, env) {
  const token = getCookie(request, "sbs_session");

  if (token) {
    await env.DB.prepare(`
      DELETE FROM customer_sessions
      WHERE token=?
    `).bind(token).run();
  }

  const response = json({
    success: true,
    message: "Logged out"
  });

  response.headers.set(
    "Set-Cookie",
    deleteCookie("sbs_session")
  );

  return response;
}

async function customerStatus(request, env) {
  const data = await body(request);

  if (!data.account_id || !["suspend", "reactivate"].includes(data.action)) {
    return json({
      success: false,
      error: "account_id and action are required"
    }, 400);
  }

  if (data.action === "suspend") {
    await env.DB.prepare(`
      UPDATE customer_accounts
      SET subscription_status='suspended',
          updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).bind(data.account_id).run();

    await env.DB.prepare(`
      DELETE FROM customer_sessions
      WHERE account_id=?
    `).bind(data.account_id).run();
  } else {
    await env.DB.prepare(`
      UPDATE customer_accounts
      SET subscription_status='active',
          updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).bind(data.account_id).run();
  }

  return json({
    success: true,
    message: data.action === "suspend"
      ? "Customer suspended"
      : "Customer reactivated"
  });
}

async function getModules(request, env) {
  const modules = await env.DB.prepare(`
    SELECT
      id,
      module_code,
      module_name,
      category,
      description,
      monthly_price,
      icon,
      active,
      customer_visible,
      display_order
    FROM saas_modules
    WHERE active=1
      AND customer_visible=1
    ORDER BY display_order ASC
  `).all();

  return json({
    success: true,
    modules: modules.results || []
  });
}

async function getMyModules(request, env) {
  const account = await requireAccount(request, env);

  if (account instanceof Response) {
    return account;
  }

  const modules = await env.DB.prepare(`
    SELECT
      m.*,
      COALESCE(cm.status,'inactive') AS customer_status,
      cm.activated_at
    FROM saas_modules m
    LEFT JOIN customer_modules cm
      ON cm.module_code=m.module_code
      AND cm.account_id=?
    WHERE m.active=1
      AND m.customer_visible=1
    ORDER BY m.display_order
  `).bind(account.id).all();

  return json({
    success: true,
    modules: modules.results || []
  });
}

async function saasProfile(request, env) {
  const account = await requireAccount(request, env);

  if (account instanceof Response) return account;

  if (request.method === "GET") {
    const profile = await env.DB.prepare(`
      SELECT *
      FROM saas_organisations
      WHERE account_id=?
      LIMIT 1
    `).bind(account.id).first();

    return json({
      success: true,
      profile
    });
  }

  const data = await body(request);

  await env.DB.prepare(`
    UPDATE saas_organisations
    SET business_name=?,
        email=?,
        phone=?,
        address=?,
        city=?,
        province=?,
        website=?,
        updated_at=CURRENT_TIMESTAMP
    WHERE account_id=?
  `).bind(
    safe(data.business_name),
    safe(data.email),
    safe(data.phone),
    safe(data.address),
    safe(data.city),
    safe(data.province),
    safe(data.website),
    account.id
  ).run();

  await env.DB.prepare(`
    UPDATE customer_accounts
    SET business_name=?,
        phone=?,
        updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).bind(
    safe(data.business_name) || account.business_name,
    safe(data.phone) || account.phone,
    account.id
  ).run();

  return json({
    success: true,
    message: "Business profile updated"
  });
}

const RESOURCE_CONFIG = {
  customers: {
    table: "saas_customers",
    module: null,
    fields: [
      "name",
      "email",
      "phone",
      "address",
      "notes",
      "status"
    ],
    search: ["name", "email", "phone"]
  },

  products: {
    table: "saas_products",
    module: null,
    fields: [
      "name",
      "sku",
      "category",
      "description",
      "price",
      "cost_price",
      "quantity",
      "minimum_quantity",
      "unit",
      "status"
    ],
    search: ["name", "sku", "category"]
  },

  services: {
    table: "saas_services",
    module: null,
    fields: [
      "name",
      "category",
      "description",
      "price",
      "duration_minutes",
      "status"
    ],
    search: ["name", "category"]
  },

  sales: {
    table: "saas_sales",
    module: null,
    fields: [
      "customer_id",
      "reference",
      "description",
      "amount",
      "payment_method",
      "status",
      "sale_date",
      "notes"
    ],
    search: ["reference", "description"]
  },

  expenses: {
    table: "saas_expenses",
    module: null,
    fields: [
      "category",
      "supplier",
      "description",
      "amount",
      "payment_method",
      "reference",
      "expense_date",
      "status"
    ],
    search: ["category", "supplier", "description", "reference"]
  },

  bookings: {
    table: "saas_bookings",
    module: null,
    fields: [
      "customer_id",
      "service_id",
      "staff_name",
      "booking_date",
      "start_time",
      "end_time",
      "status",
      "notes"
    ],
    search: ["staff_name", "status"]
  },

  quotes: {
    table: "saas_quotes",
    module: null,
    fields: [
      "customer_id",
      "quote_number",
      "description",
      "amount",
      "status",
      "valid_until",
      "notes"
    ],
    search: ["quote_number", "description"]
  },

  invoices: {
    table: "saas_invoices",
    module: null,
    fields: [
      "customer_id",
      "invoice_number",
      "description",
      "amount",
      "paid_amount",
      "status",
      "due_date",
      "invoice_date",
      "notes"
    ],
    search: ["invoice_number", "description"]
  }
};

function quoteIdentifier(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error("Invalid identifier");
  }

  return `"${name}"`;
}

async function genericResource(request, env, resource) {
  const account = await requireAccount(request, env);

  if (account instanceof Response) {
    return account;
  }

  const config = RESOURCE_CONFIG[resource];

  if (!config) {
    return json({
      success: false,
      error: "Unknown resource"
    }, 404);
  }

  const table = quoteIdentifier(config.table);

  if (request.method === "GET") {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const search = cleanSearch(url.searchParams.get("search"));

    if (id) {
      const row = await env.DB.prepare(`
        SELECT *
        FROM ${table}
        WHERE id=?
          AND account_id=?
        LIMIT 1
      `).bind(
        id,
        account.id
      ).first();

      return json({
        success: true,
        record: row
      });
    }

    let sql = `
      SELECT *
      FROM ${table}
      WHERE account_id=?
    `;

    const values = [account.id];

    if (search && config.search.length) {
      sql += " AND (" +
        config.search.map(field => `${quoteIdentifier(field)} LIKE ?`).join(" OR ") +
        ")";

      for (const field of config.search) {
        values.push(`%${search}%`);
      }
    }

    sql += " ORDER BY id DESC LIMIT 500";

    const rows = await env.DB.prepare(sql).bind(...values).all();

    return json({
      success: true,
      records: rows.results || []
    });
  }

  if (request.method === "POST") {
    const data = await body(request);

    const provided = [];

    for (const field of config.fields) {
      if (data[field] !== undefined) {
        provided.push(field);
      }
    }

    if (resource === "customers" && !data.name) {
      return json({
        success: false,
        error: "Customer name is required"
      }, 400);
    }

    if (resource === "products" && !data.name) {
      return json({
        success: false,
        error: "Product name is required"
      }, 400);
    }

    if (resource === "services" && !data.name) {
      return json({
        success: false,
        error: "Service name is required"
      }, 400);
    }

    if (!provided.length) {
      return json({
        success: false,
        error: "No fields supplied"
      }, 400);
    }

    const columns = ["account_id", ...provided];
    const placeholders = columns.map(() => "?");

    const values = [
      account.id,
      ...provided.map(field => data[field])
    ];

    const result = await env.DB.prepare(`
      INSERT INTO ${table}
      (${columns.map(quoteIdentifier).join(",")})
      VALUES (${placeholders.join(",")})
    `).bind(...values).run();

    const id = result.meta.last_row_id;

    await logActivity(
      env,
      account.id,
      "core",
      "created",
      `Created ${resource} record`,
      resource,
      id
    );

    return json({
      success: true,
      id,
      message: "Record created"
    }, 201);
  }

  if (request.method === "PATCH") {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return json({
        success: false,
        error: "id is required"
      }, 400);
    }

    const data = await body(request);

    const fields = config.fields.filter(
      field => data[field] !== undefined
    );

    if (!fields.length) {
      return json({
        success: false,
        error: "No fields supplied"
      }, 400);
    }

    const values = fields.map(field => data[field]);

    const sets = fields.map(
      field => `${quoteIdentifier(field)}=?`
    );

    sets.push("updated_at=CURRENT_TIMESTAMP");

    await env.DB.prepare(`
      UPDATE ${table}
      SET ${sets.join(",")}
      WHERE id=?
        AND account_id=?
    `).bind(
      ...values,
      id,
      account.id
    ).run();

    await logActivity(
      env,
      account.id,
      "core",
      "updated",
      `Updated ${resource} record`,
      resource,
      id
    );

    return json({
      success: true,
      message: "Record updated"
    });
  }

  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return json({
        success: false,
        error: "id is required"
      }, 400);
    }

    await env.DB.prepare(`
      DELETE FROM ${table}
      WHERE id=?
        AND account_id=?
    `).bind(
      id,
      account.id
    ).run();

    await logActivity(
      env,
      account.id,
      "core",
      "deleted",
      `Deleted ${resource} record`,
      resource,
      id
    );

    return json({
      success: true,
      message: "Record deleted"
    });
  }

  return json({
    success: false,
    error: "Method not allowed"
  }, 405);
}

async function saasReports(request, env) {
  const account = await requireAccount(request, env);

  if (account instanceof Response) return account;

  const [
    customers,
    products,
    services,
    sales,
    expenses,
    invoices,
    quotes,
    bookings
  ] = await Promise.all([
    env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM saas_customers
      WHERE account_id=?
    `).bind(account.id).first(),

    env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM saas_products
      WHERE account_id=?
        AND status='active'
    `).bind(account.id).first(),

    env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM saas_services
      WHERE account_id=?
        AND status='active'
    `).bind(account.id).first(),

    env.DB.prepare(`
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(amount),0) AS total
      FROM saas_sales
      WHERE account_id=?
        AND status='paid'
    `).bind(account.id).first(),

    env.DB.prepare(`
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(amount),0) AS total
      FROM saas_expenses
      WHERE account_id=?
        AND status='paid'
    `).bind(account.id).first(),

    env.DB.prepare(`
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(amount),0) AS total,
        COALESCE(SUM(paid_amount),0) AS paid
      FROM saas_invoices
      WHERE account_id=?
    `).bind(account.id).first(),

    env.DB.prepare(`
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(amount),0) AS total
      FROM saas_quotes
      WHERE account_id=?
    `).bind(account.id).first(),

    env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM saas_bookings
      WHERE account_id=?
    `).bind(account.id).first()
  ]);

  return json({
    success: true,
    reports: {
      customers: customers?.total || 0,
      products: products?.total || 0,
      services: services?.total || 0,
      sales_count: sales?.count || 0,
      sales_total: sales?.total || 0,
      expenses_count: expenses?.count || 0,
      expenses_total: expenses?.total || 0,
      invoices_count: invoices?.count || 0,
      invoices_total: invoices?.total || 0,
      invoices_paid: invoices?.paid || 0,
      quotes_count: quotes?.count || 0,
      quotes_total: quotes?.total || 0,
      bookings: bookings?.total || 0,
      estimated_profit:
        Number(sales?.total || 0) -
        Number(expenses?.total || 0)
    }
  });
}

async function saasActivity(request, env) {
  const account = await requireAccount(request, env);

  if (account instanceof Response) return account;

  const rows = await env.DB.prepare(`
    SELECT *
    FROM saas_activity
    WHERE account_id=?
    ORDER BY id DESC
    LIMIT 200
  `).bind(account.id).all();

  return json({
    success: true,
    activity: rows.results || []
  });
}

async function notifications(request, env) {
  const account = await requireAccount(request, env);

  if (account instanceof Response) return account;

  if (request.method === "GET") {
    const rows = await env.DB.prepare(`
      SELECT *
      FROM saas_notifications
      WHERE account_id=?
      ORDER BY id DESC
      LIMIT 100
    `).bind(account.id).all();

    return json({
      success: true,
      notifications: rows.results || []
    });
  }

  if (request.method === "PATCH") {
    const data = await body(request);

    if (data.id) {
      await env.DB.prepare(`
        UPDATE saas_notifications
        SET is_read=1
        WHERE id=?
          AND account_id=?
      `).bind(
        data.id,
        account.id
      ).run();
    } else {
      await env.DB.prepare(`
        UPDATE saas_notifications
        SET is_read=1
        WHERE account_id=?
      `).bind(account.id).run();
    }

    return json({
      success: true
    });
  }

  return json({
    success: false,
    error: "Method not allowed"
  }, 405);
}

async function npoActivate(request, env) {
  const account = await requireAccount(request, env);

  if (account instanceof Response) return account;

  await env.DB.prepare(`
    INSERT INTO customer_modules
    (
      account_id,
      module_code,
      status
    )
    VALUES (?, 'npo', 'active')
    ON CONFLICT(account_id,module_code)
    DO UPDATE SET
      status='active',
      updated_at=CURRENT_TIMESTAMP
  `).bind(account.id).run();

  const existing = await env.DB.prepare(`
    SELECT id
    FROM npo_profiles
    WHERE account_id=?
    LIMIT 1
  `).bind(account.id).first();

  if (!existing) {
    await env.DB.prepare(`
      INSERT INTO npo_profiles
      (
        account_id,
        organisation_name,
        email,
        phone,
        status
      )
      VALUES (?, ?, ?, ?, 'active')
    `).bind(
      account.id,
      account.business_name,
      account.email,
      account.phone
    ).run();
  }

  return json({
    success: true,
    message: "NPO module activated"
  });
}

async function npoStatus(request, env) {
  const account = await requireAccount(request, env);

  if (account instanceof Response) return account;

  const module = await env.DB.prepare(`
    SELECT *
    FROM customer_modules
    WHERE account_id=?
      AND module_code='npo'
    LIMIT 1
  `).bind(account.id).first();

  const profile = await env.DB.prepare(`
    SELECT *
    FROM npo_profiles
    WHERE account_id=?
    LIMIT 1
  `).bind(account.id).first();

  return json({
    success: true,
    active: module?.status === "active",
    module,
    profile
  });
}

async function npoDashboard(request, env) {
  const account = await requireModule(request, env, "npo");

  if (account instanceof Response) return account;

  const [
    beneficiaries,
    projects,
    donors,
    volunteers,
    grants,
    donations,
    expenses,
    awarded
  ] = await Promise.all([
    env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM npo_beneficiaries
      WHERE account_id=?
    `).bind(account.id).first(),

    env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM npo_projects
      WHERE account_id=?
    `).bind(account.id).first(),

    env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM npo_donors
      WHERE account_id=?
    `).bind(account.id).first(),

    env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM npo_volunteers
      WHERE account_id=?
    `).bind(account.id).first(),

    env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM npo_grants
      WHERE account_id=?
    `).bind(account.id).first(),

    env.DB.prepare(`
      SELECT COALESCE(SUM(amount),0) AS total
      FROM npo_donations
      WHERE account_id=?
        AND status='received'
    `).bind(account.id).first(),

    env.DB.prepare(`
      SELECT COALESCE(SUM(amount),0) AS total
      FROM npo_expenses
      WHERE account_id=?
        AND status='paid'
    `).bind(account.id).first(),

    env.DB.prepare(`
      SELECT COALESCE(SUM(awarded_amount),0) AS total
      FROM npo_grants
      WHERE account_id=?
    `).bind(account.id).first()
  ]);

  const donationTotal = Number(donations?.total || 0);
  const expenseTotal = Number(expenses?.total || 0);
  const grantTotal = Number(awarded?.total || 0);

  return json({
    success: true,
    dashboard: {
      beneficiaries: Number(beneficiaries?.total || 0),
      projects: Number(projects?.total || 0),
      donors: Number(donors?.total || 0),
      volunteers: Number(volunteers?.total || 0),
      grants: Number(grants?.total || 0),
      total_donations: donationTotal,
      total_expenses: expenseTotal,
      total_grants_awarded: grantTotal,
      available_balance:
        donationTotal +
        grantTotal -
        expenseTotal
    }
  });
}

const NPO_CONFIG = {
  beneficiaries: {
    table: "npo_beneficiaries",
    fields: [
      "name",
      "id_number",
      "phone",
      "email",
      "address",
      "category",
      "vulnerability",
      "status",
      "notes"
    ]
  },

  projects: {
    table: "npo_projects",
    fields: [
      "name",
      "category",
      "description",
      "start_date",
      "end_date",
      "budget",
      "target",
      "manager",
      "location",
      "status"
    ]
  },

  donors: {
    table: "npo_donors",
    fields: [
      "name",
      "donor_type",
      "email",
      "phone",
      "address",
      "reference",
      "notes",
      "status"
    ]
  },

  donations: {
    table: "npo_donations",
    fields: [
      "donor_id",
      "project_id",
      "amount",
      "payment_method",
      "reference",
      "donation_date",
      "status",
      "notes"
    ]
  },

  grants: {
    table: "npo_grants",
    fields: [
      "funder",
      "grant_name",
      "reference",
      "requested_amount",
      "awarded_amount",
      "project_id",
      "application_date",
      "reporting_requirements",
      "status",
      "notes"
    ]
  },

  volunteers: {
    table: "npo_volunteers",
    fields: [
      "name",
      "phone",
      "email",
      "skills",
      "availability",
      "start_date",
      "status",
      "notes"
    ]
  },

  expenses: {
    table: "npo_expenses",
    fields: [
      "category",
      "supplier",
      "description",
      "amount",
      "project_id",
      "grant_id",
      "payment_method",
      "reference",
      "expense_date",
      "status"
    ]
  },

  documents: {
    table: "npo_documents",
    fields: [
      "name",
      "document_type",
      "reference",
      "expiry_date",
      "status",
      "document_url",
      "notes"
    ]
  },

  governance: {
    table: "npo_governance",
    fields: [
      "meeting_date",
      "meeting_type",
      "attendees",
      "agenda",
      "decisions",
      "resolutions",
      "notes"
    ]
  }
};

async function npoResource(request, env, resource) {
  const account = await requireModule(request, env, "npo");

  if (account instanceof Response) return account;

  const config = NPO_CONFIG[resource];

  if (!config) {
    return json({
      success: false,
      error: "Unknown NPO resource"
    }, 404);
  }

  const table = quoteIdentifier(config.table);

  if (request.method === "GET") {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const search = cleanSearch(url.searchParams.get("search"));

    if (id) {
      const record = await env.DB.prepare(`
        SELECT *
        FROM ${table}
        WHERE id=?
          AND account_id=?
        LIMIT 1
      `).bind(id, account.id).first();

      return json({
        success: true,
        record
      });
    }

    let sql = `
      SELECT *
      FROM ${table}
      WHERE account_id=?
    `;

    const values = [account.id];

    if (search) {
      sql += `
        AND (
          CAST(id AS TEXT) LIKE ?
          OR name LIKE ?
          OR description LIKE ?
          OR reference LIKE ?
          OR status LIKE ?
        )
      `;

      const term = `%${search}%`;

      values.push(
        term,
        term,
        term,
        term,
        term
      );
    }

    sql += " ORDER BY id DESC LIMIT 500";

    const rows = await env.DB.prepare(sql).bind(...values).all();

    return json({
      success: true,
      records: rows.results || []
    });
  }

  if (request.method === "POST") {
    const data = await body(request);

    const fields = config.fields.filter(
      field => data[field] !== undefined
    );

    if (!fields.length) {
      return json({
        success: false,
        error: "No fields supplied"
      }, 400);
    }

    if (
      ["beneficiaries", "projects", "donors", "volunteers"].includes(resource) &&
      !data.name
    ) {
      return json({
        success: false,
        error: "Name is required"
      }, 400);
    }

    if (resource === "grants" && !data.funder) {
      return json({
        success: false,
        error: "Funder is required"
      }, 400);
    }

    const values = fields.map(field => data[field]);

    const result = await env.DB.prepare(`
      INSERT INTO ${table}
      (
        account_id,
        ${fields.map(quoteIdentifier).join(",")}
      )
      VALUES (
        ?,
        ${fields.map(() => "?").join(",")}
      )
    `).bind(
      account.id,
      ...values
    ).run();

    await logActivity(
      env,
      account.id,
      "npo",
      "created",
      `Created NPO ${resource} record`,
      resource,
      result.meta.last_row_id
    );

    return json({
      success: true,
      id: result.meta.last_row_id
    }, 201);
  }

  if (request.method === "PATCH") {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return json({
        success: false,
        error: "id is required"
      }, 400);
    }

    const data = await body(request);

    const fields = config.fields.filter(
      field => data[field] !== undefined
    );

    if (!fields.length) {
      return json({
        success: false,
        error: "No fields supplied"
      }, 400);
    }

    await env.DB.prepare(`
      UPDATE ${table}
      SET
        ${fields.map(field => `${quoteIdentifier(field)}=?`).join(",")},
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
        AND account_id=?
    `).bind(
      ...fields.map(field => data[field]),
      id,
      account.id
    ).run();

    return json({
      success: true,
      message: "Record updated"
    });
  }

  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return json({
        success: false,
        error: "id is required"
      }, 400);
    }

    await env.DB.prepare(`
      DELETE FROM ${table}
      WHERE id=?
        AND account_id=?
    `).bind(
      id,
      account.id
    ).run();

    return json({
      success: true,
      message: "Record deleted"
    });
  }

  return json({
    success: false,
    error: "Method not allowed"
  }, 405);
}

async function npoProfile(request, env) {
  const account = await requireModule(request, env, "npo");

  if (account instanceof Response) return account;

  if (request.method === "GET") {
    const profile = await env.DB.prepare(`
      SELECT *
      FROM npo_profiles
      WHERE account_id=?
      LIMIT 1
    `).bind(account.id).first();

    return json({
      success: true,
      profile
    });
  }

  const data = await body(request);

  const fields = [
    "organisation_name",
    "registration_number",
    "organisation_type",
    "description",
    "mission",
    "vision",
    "contact_person",
    "email",
    "phone",
    "address",
    "province",
    "city",
    "website",
    "status"
  ];

  const supplied = fields.filter(
    field => data[field] !== undefined
  );

  if (!supplied.length) {
    return json({
      success: false,
      error: "No fields supplied"
    }, 400);
  }

  await env.DB.prepare(`
    UPDATE npo_profiles
    SET
      ${supplied.map(field => `${quoteIdentifier(field)}=?`).join(",")},
      updated_at=CURRENT_TIMESTAMP
    WHERE account_id=?
  `).bind(
    ...supplied.map(field => data[field]),
    account.id
  ).run();

  return json({
    success: true,
    message: "NPO profile updated"
  });
}

function departmentForCategory(category) {
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
    value.includes("dump") ||
    value.includes("waste") ||
    value.includes("rubbish")
  ) return 4;

  return 5;
}

function priorityForReport(textValue) {
  const value = String(textValue || "").toLowerCase();

  if (
    value.includes("fire") ||
    value.includes("danger") ||
    value.includes("emergency")
  ) return "Emergency";

  if (
    value.includes("urgent") ||
    value.includes("burst") ||
    value.includes("live wire")
  ) return "Urgent";

  return "Normal";
}

async function communityCategories(env) {
  const rows = await env.DB.prepare(`
    SELECT *
    FROM categories
    WHERE active=1
    ORDER BY id
  `).all();

  return json({
    success: true,
    categories: rows.results || []
  });
}

async function communityDepartments(env) {
  const rows = await env.DB.prepare(`
    SELECT *
    FROM departments
    WHERE active=1
    ORDER BY id
  `).all();

  return json({
    success: true,
    departments: rows.results || []
  });
}

async function createCommunityReport(request, env) {
  const data = await body(request);

  const category = safe(data.category);
  const description = safe(data.description);
  const location = safe(data.location);
  const name = safe(data.name);
  const phone = safe(data.phone);

  if (!category || !description || !location) {
    return json({
      success: false,
      error: "Category, description and location are required"
    }, 400);
  }

  const count = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM reports
  `).first();

  const sequence = Number(count?.total || 0) + 1;

  const reference =
    "SBS-AX-" +
    String(sequence).padStart(6, "0");

  const priority =
    safe(data.priority) ||
    priorityForReport(description);

  const departmentId =
    Number(data.department_id) ||
    departmentForCategory(category);

  const result = await env.DB.prepare(`
    INSERT INTO reports
    (
      tenant_id,
      ward_id,
      reference,
      category,
      description,
      location,
      name,
      phone,
      priority,
      department_id,
      status,
      source
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'Web')
  `).bind(
    TENANT_ID,
    WARD_ID,
    reference,
    category,
    description,
    location,
    name,
    phone,
    priority,
    departmentId
  ).run();

  return json({
    success: true,
    message: "Report submitted",
    reference,
    report_id: result.meta.last_row_id
  }, 201);
}

async function communityReports(request, env) {
  const rows = await env.DB.prepare(`
    SELECT
      r.*,
      d.name AS department_name
    FROM reports r
    LEFT JOIN departments d
      ON d.id=r.department_id
    ORDER BY r.id DESC
    LIMIT 500
  `).all();

  return json({
    success: true,
    reports: rows.results || []
  });
}

async function communityReport(request, env, id) {
  if (request.method === "GET") {
    const report = await env.DB.prepare(`
      SELECT
        r.*,
        d.name AS department_name
      FROM reports r
      LEFT JOIN departments d
        ON d.id=r.department_id
      WHERE r.id=?
      LIMIT 1
    `).bind(id).first();

    if (!report) {
      return json({
        success: false,
        error: "Report not found"
      }, 404);
    }

    const updates = await env.DB.prepare(`
      SELECT *
      FROM report_updates
      WHERE report_id=?
      ORDER BY id ASC
    `).bind(id).all();

    return json({
      success: true,
      report,
      updates: updates.results || []
    });
  }

  if (request.method === "PATCH") {
    const data = await body(request);

    const current = await env.DB.prepare(`
      SELECT *
      FROM reports
      WHERE id=?
      LIMIT 1
    `).bind(id).first();

    if (!current) {
      return json({
        success: false,
        error: "Report not found"
      }, 404);
    }

    const status =
      data.status !== undefined
        ? data.status
        : current.status;

    const priority =
      data.priority !== undefined
        ? data.priority
        : current.priority;

    const department =
      data.department_id !== undefined
        ? data.department_id
        : current.department_id;

    const resolutionNotes =
      data.resolution_notes !== undefined
        ? data.resolution_notes
        : current.resolution_notes;

    const resolvedAt =
      status === "Resolved"
        ? now()
        : current.resolved_at;

    await env.DB.prepare(`
      UPDATE reports
      SET
        status=?,
        priority=?,
        department_id=?,
        resolution_notes=?,
        resolved_at=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).bind(
      status,
      priority,
      department,
      resolutionNotes,
      resolvedAt,
      id
    ).run();

    await env.DB.prepare(`
      INSERT INTO report_updates
      (
        report_id,
        status,
        note,
        created_by
      )
      VALUES (?, ?, ?, ?)
    `).bind(
      id,
      status,
      data.note || data.resolution_notes || "",
      data.created_by || "Admin"
    ).run();

    return json({
      success: true,
      message: "Report updated"
    });
  }

  return json({
    success: false,
    error: "Method not allowed"
  }, 405);
}

async function adminDashboard(request, env) {
  const [
    customers,
    active,
    pending,
    suspended,
    revenue,
    payments
  ] = await Promise.all([
    env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM customer_accounts
    `).first(),

    env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM customer_accounts
      WHERE subscription_status='active'
    `).first(),

    env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM customer_accounts
      WHERE subscription_status='pending'
    `).first(),

    env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM customer_accounts
      WHERE subscription_status='suspended'
    `).first(),

    env.DB.prepare(`
      SELECT COALESCE(SUM(amount),0) AS total
      FROM saas_payments
      WHERE payment_status='paid'
    `).first(),

    env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM saas_payments
      WHERE payment_status='paid'
    `).first()
  ]);

  return json({
    success: true,
    dashboard: {
      total_customers: customers?.total || 0,
      active_subscribers: active?.total || 0,
      pending_customers: pending?.total || 0,
      suspended_customers: suspended?.total || 0,
      lifetime_revenue: revenue?.total || 0,
      successful_payments: payments?.total || 0
    }
  });
}

async function adminCustomers(request, env) {
  const rows = await env.DB.prepare(`
    SELECT
      id,
      business_name,
      full_name,
      email,
      phone,
      plan,
      subscription_status,
      created_at,
      updated_at
    FROM customer_accounts
    ORDER BY id DESC
    LIMIT 1000
  `).all();

  return json({
    success: true,
    customers: rows.results || []
  });
}

async function adminPayments(request, env) {
  const rows = await env.DB.prepare(`
    SELECT
      id,
      organisation_id,
      record_id,
      customer_id,
      amount,
      payment_method,
      payment_status,
      reference,
      paid_at,
      notes,
      created_at
    FROM saas_payments
    ORDER BY datetime(COALESCE(paid_at,created_at)) DESC,
             id DESC
    LIMIT 500
  `).all();

  return json({
    success: true,
    payments: rows.results || []
  });
}

async function adminModules(request, env) {
  const rows = await env.DB.prepare(`
    SELECT *
    FROM saas_modules
    ORDER BY display_order
  `).all();

  return json({
    success: true,
    modules: rows.results || []
  });
}

async function whatsappSend(env, to, message) {
  if (
    !env.WHATSAPP_ACCESS_TOKEN ||
    !env.WHATSAPP_PHONE_NUMBER_ID
  ) {
    return {
      success: false,
      error: "WhatsApp credentials are not configured"
    };
  }

  const url =
    `https://graph.facebook.com/v23.0/` +
    `${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization":
        `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
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

  const result = await response.json();

  return {
    success: response.ok,
    result
  };
}

async function whatsappWebhook(request, env) {
  const url = new URL(request.url);

  if (request.method === "GET") {
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

    return text("Forbidden", 403);
  }

  const payload = await request.json().catch(() => ({}));

  try {
    const entries = payload.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        const value = change.value || {};
        const messages = value.messages || [];

        for (const message of messages) {
          const from = message.from;

          let incoming = "";

          if (message.type === "text") {
            incoming = message.text?.body || "";
          }

          if (!from || !incoming) continue;

          await env.DB.prepare(`
            INSERT OR IGNORE INTO residents
            (
              tenant_id,
              name,
              phone
            )
            VALUES (?, ?, ?)
          `).bind(
            TENANT_ID,
            from,
            from
          ).run();

          await env.DB.prepare(`
            INSERT INTO whatsapp_conversations
            (
              phone,
              message,
              direction,
              state
            )
            VALUES (?, ?, 'incoming', 'received')
          `).bind(
            from,
            incoming
          ).run();

          const lower = incoming.toLowerCase();

          if (
            lower.includes("report") ||
            lower.includes("pothole") ||
            lower.includes("water") ||
            lower.includes("electric") ||
            lower.includes("dump")
          ) {
            await whatsappSend(
              env,
              from,
              "Thank you for contacting Sky Blue Community Service Centre. Please send the issue, location and any useful details. We will create a service report for you."
            );
          } else {
            await whatsappSend(
              env,
              from,
              "Welcome to Sky Blue Community Service Centre. Reply REPORT to report a community issue."
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("WhatsApp webhook error", error);
  }

  return json({
    success: true
  });
}

async function serveAsset(request, env) {
  if (!env.ASSETS) {
    return text(
      "Sky Blue Digital Service API is running"
    );
  }

  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: CORS
        });
      }

      await ensureAllTables(env);

      const url = new URL(request.url);
      const path = url.pathname;

      /*
       * HEALTH
       */

      if (path === "/api" || path === "/api/health") {
        return json({
          success: true,
          message: "Sky Blue Digital Service API is running",
          version: "2026.09",
          modules: MODULES.length
        });
      }

      /*
       * CUSTOMER AUTH
       */

      if (path === "/api/auth/register" && request.method === "POST") {
        return await authRegister(request, env);
      }

      if (path === "/api/auth/login" && request.method === "POST") {
        return await authLogin(request, env);
      }

      if (path === "/api/auth/me") {
        return await authMe(request, env);
      }

      if (path === "/api/auth/logout") {
        return await authLogout(request, env);
      }

      /*
       * MODULE ENGINE
       */

      if (
       
