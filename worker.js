import {
  ensureWhatsAppSaaSTables,
  getWhatsAppStatus,
  getWhatsAppContacts,
  getWhatsAppMessages,
  createOrUpdateWhatsAppContact,
  sendSaaSWhatsAppMessage,
  queueWhatsAppNotification,
  processWhatsAppNotification
} from "./whatsapp-engine.js";

import {
  ensureIndustryWhatsAppRouterTables,
  processIndustryWhatsAppValue
} from "./industry-whatsapp-router.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const TENANT_ID = 1;
    const WARD_ID = 1;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    function json(data, status = 200, extraHeaders = {}) {
      return new Response(JSON.stringify(data), {
        status,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
          ...extraHeaders
        }
      });
    }

    // =========================================================
    // BASIC API HEALTH CHECK
    // =========================================================

    if (url.pathname === "/api" && request.method === "GET") {
      return new Response(
        "Sky Blue Digital Service API is running",
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }

    // =========================================================
    // CUSTOMER AUTHENTICATION SYSTEM
    // =========================================================

    async function ensureAuthTables() {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS customer_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tenant_id INTEGER NOT NULL,
          business_name TEXT NOT NULL,
          full_name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          phone TEXT,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          plan TEXT,
          subscription_status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `).run();

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS customer_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
    }

    // =========================================================
    // SAAS MODULE ENGINE
    // =========================================================

    async function ensureSaaSModuleTables() {
      await env.DB.prepare(`
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
      `).run();

      const modules = [
        {
          code: "community-service-centre",
          name: "Community Service Centre",
          category: "Community & Civic",
          description: "Digital community issue reporting, case tracking, departments, WhatsApp reporting and service delivery management.",
          price: 199,
          icon: "🏘️",
          order: 1
        },
        {
          code: "npo-ngo",
          name: "NPO & NGO Management",
          category: "Organisation Management",
          description: "Manage beneficiaries, projects, donors, grants, volunteers, finances, documents, governance and reporting.",
          price: 199,
          icon: "🤝",
          order: 2
        },
        {
          code: "church-management",
          name: "Church Management",
          category: "Organisation Management",
          description: "Manage members, families, ministries, attendance, events, donations, offerings, communication and church records.",
          price: 199,
          icon: "⛪",
          order: 3
        },
        {
          code: "ecommerce",
          name: "E-Commerce & Online Store",
          category: "Retail & Commerce",
          description: "Create an online store with products, stock, orders, payments, customers, delivery and WhatsApp ordering.",
          price: 199,
          icon: "🛒",
          order: 4
        },
        {
          code: "salon-barber",
          name: "Salon & Barber Management",
          category: "Personal Services",
          description: "Manage customers, appointments, services, staff, payments, products and business reports.",
          price: 99,
          icon: "💇",
          order: 5
        },
        {
          code: "laundry",
          name: "Laundry Management",
          category: "Personal Services",
          description: "Manage customers, laundry orders, collections, deliveries, payments, pricing and order status.",
          price: 99,
          icon: "🧺",
          order: 6
        },
        {
          code: "food-business",
          name: "Food Business Management",
          category: "Food & Hospitality",
          description: "Manage food orders, menus, customers, stock, suppliers, payments and daily sales.",
          price: 99,
          icon: "🍔",
          order: 7
        },
        {
          code: "wholesale-grocery",
          name: "Wholesale & Grocery Management",
          category: "Retail & Commerce",
          description: "Manage inventory, suppliers, customers, sales, purchasing, invoices and stock movement.",
          price: 149,
          icon: "📦",
          order: 8
        },
        {
          code: "driving-school",
          name: "Driving School Management",
          category: "Education & Training",
          description: "Manage learners, lessons, instructors, bookings, payments, vehicles and learner progress.",
          price: 149,
          icon: "🚗",
          order: 9
        },
        {
          code: "school-management",
          name: "School Management",
          category: "Education & Training",
          description: "Manage learners, parents, teachers, attendance, fees, classes, communication and school records.",
          price: 199,
          icon: "🏫",
          order: 10
        },
        {
          code: "preschool-daycare",
          name: "Preschool & Day-care Management",
          category: "Education & Training",
          description: "Manage children, parents, attendance, fees, activities, staff and daily childcare records.",
          price: 149,
          icon: "🧒",
          order: 11
        },
        {
          code: "pharmacy",
          name: "Pharmacy Management",
          category: "Healthcare & Retail",
          description: "Manage products, stock, customers, sales, suppliers, expiry tracking and pharmacy reports.",
          price: 199,
          icon: "💊",
          order: 12
        },
        {
          code: "transport",
          name: "Transport Management",
          category: "Transport & Logistics",
          description: "Manage vehicles, drivers, trips, customers, bookings, payments, maintenance and transport records.",
          price: 149,
          icon: "🚚",
          order: 13
        },
        {
          code: "it-business",
          name: "IT Business Management",
          category: "Professional Services",
          description: "Manage IT customers, tickets, assets, services, quotations, invoices, contracts and support.",
          price: 149,
          icon: "💻",
          order: 14
        },
        {
          code: "building-materials",
          name: "Building Materials Management",
          category: "Retail & Commerce",
          description: "Manage building products, stock, customers, quotations, invoices, suppliers and deliveries.",
          price: 149,
          icon: "🧱",
          order: 15
        },
        {
          code: "other-services",
          name: "Other Service Businesses",
          category: "Professional Services",
          description: "Flexible business management for service businesses that do not fit into another specialist module.",
          price: 99,
          icon: "⚙️",
          order: 16
        }
      ];

      for (const module of modules) {
        await env.DB.prepare(`
          INSERT OR IGNORE INTO saas_modules
          (
            module_code,
            module_name,
            category,
            description,
            monthly_price,
            icon,
            active,
            customer_visible,
            display_order,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(
          module.code,
          module.name,
          module.category,
          module.description,
          module.price,
          module.icon,
          module.order
        ).run();
      }
    }

    // =========================================================
    // NPO / NGO MANAGEMENT ENGINE
    // =========================================================

    async function ensureNPOTables() {
      // -------------------------------------------------------
      // NPO ORGANISATION PROFILE
      // -------------------------------------------------------

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS npo_profiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER NOT NULL UNIQUE,
          tenant_id INTEGER NOT NULL,
          organisation_name TEXT NOT NULL,
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
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES customer_accounts(id)
        )
      `).run();

      // -------------------------------------------------------
      // BENEFICIARIES
      // -------------------------------------------------------

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS npo_beneficiaries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER NOT NULL,
          tenant_id INTEGER NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT,
          id_number TEXT,
          date_of_birth TEXT,
          gender TEXT,
          phone TEXT,
          email TEXT,
          address TEXT,
          category TEXT,
          vulnerability TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES customer_accounts(id)
        )
      `).run();

      // -------------------------------------------------------
      // PROJECTS / PROGRAMMES
      // -------------------------------------------------------

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS npo_projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER NOT NULL,
          tenant_id INTEGER NOT NULL,
          project_name TEXT NOT NULL,
          project_code TEXT,
          description TEXT,
          programme_type TEXT,
          start_date TEXT,
          end_date TEXT,
          target_beneficiaries INTEGER NOT NULL DEFAULT 0,
          budget REAL NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'planned',
          project_manager TEXT,
          location TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES customer_accounts(id)
        )
      `).run();

      // -------------------------------------------------------
      // DONORS
      // -------------------------------------------------------

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS npo_donors (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER NOT NULL,
          tenant_id INTEGER NOT NULL,
          donor_name TEXT NOT NULL,
          donor_type TEXT,
          organisation_name TEXT,
          email TEXT,
          phone TEXT,
          address TEXT,
          donor_reference TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES customer_accounts(id)
        )
      `).run();

      // -------------------------------------------------------
      // DONATIONS
      // -------------------------------------------------------

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS npo_donations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER NOT NULL,
          tenant_id INTEGER NOT NULL,
          donor_id INTEGER,
          project_id INTEGER,
          amount REAL NOT NULL DEFAULT 0,
          donation_type TEXT,
          payment_method TEXT,
          reference TEXT,
          donation_date TEXT,
          status TEXT NOT NULL DEFAULT 'received',
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES customer_accounts(id),
          FOREIGN KEY (donor_id) REFERENCES npo_donors(id),
          FOREIGN KEY (project_id) REFERENCES npo_projects(id)
        )
      `).run();

      // -------------------------------------------------------
      // GRANTS / FUNDING
      // -------------------------------------------------------

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS npo_grants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER NOT NULL,
          tenant_id INTEGER NOT NULL,
          grant_name TEXT NOT NULL,
          funder_name TEXT,
          grant_reference TEXT,
          project_id INTEGER,
          application_date TEXT,
          award_date TEXT,
          start_date TEXT,
          end_date TEXT,
          requested_amount REAL NOT NULL DEFAULT 0,
          awarded_amount REAL NOT NULL DEFAULT 0,
          spent_amount REAL NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'draft',
          reporting_requirements TEXT,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES customer_accounts(id),
          FOREIGN KEY (project_id) REFERENCES npo_projects(id)
        )
      `).run();

      // -------------------------------------------------------
      // VOLUNTEERS
      // -------------------------------------------------------

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS npo_volunteers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER NOT NULL,
          tenant_id INTEGER NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT,
          id_number TEXT,
          phone TEXT,
          email TEXT,
          address TEXT,
          skills TEXT,
          availability TEXT,
          start_date TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES customer_accounts(id)
        )
      `).run();

      // -------------------------------------------------------
      // EXPENSES
      // -------------------------------------------------------

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS npo_expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER NOT NULL,
          tenant_id INTEGER NOT NULL,
          project_id INTEGER,
          grant_id INTEGER,
          expense_category TEXT NOT NULL,
          description TEXT,
          amount REAL NOT NULL DEFAULT 0,
          payment_method TEXT,
          reference TEXT,
          expense_date TEXT,
          supplier TEXT,
          status TEXT NOT NULL DEFAULT 'approved',
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES customer_accounts(id),
          FOREIGN KEY (project_id) REFERENCES npo_projects(id),
          FOREIGN KEY (grant_id) REFERENCES npo_grants(id)
        )
      `).run();

      // -------------------------------------------------------
      // DOCUMENTS
      // -------------------------------------------------------

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS npo_documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER NOT NULL,
          tenant_id INTEGER NOT NULL,
          document_name TEXT NOT NULL,
          document_type TEXT,
          description TEXT,
          document_url TEXT,
          document_reference TEXT,
          expiry_date TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES customer_accounts(id)
        )
      `).run();

      // -------------------------------------------------------
      // GOVERNANCE
      // -------------------------------------------------------

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS npo_governance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER NOT NULL,
          tenant_id INTEGER NOT NULL,
          record_type TEXT NOT NULL,
          title TEXT NOT NULL,
          meeting_date TEXT,
          members_present TEXT,
          decisions TEXT,
          resolutions TEXT,
          notes TEXT,
          status TEXT NOT NULL DEFAULT 'recorded',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES customer_accounts(id)
        )
      `).run();

      // -------------------------------------------------------
      // NPO MODULE ACTIVATION
      // -------------------------------------------------------

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS customer_modules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER NOT NULL,
          module_code TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          activated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(account_id, module_code),
          FOREIGN KEY (account_id) REFERENCES customer_accounts(id)
        )
      `).run();

      // -------------------------------------------------------
      // INDEXES
      // -------------------------------------------------------

      await env.DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_npo_beneficiaries_account
        ON npo_beneficiaries(account_id)
      `).run();

      await env.DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_npo_projects_account
        ON npo_projects(account_id)
      `).run();

      await env.DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_npo_donors_account
        ON npo_donors(account_id)
      `).run();

      await env.DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_npo_donations_account
        ON npo_donations(account_id)
      `).run();

      await env.DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_npo_grants_account
        ON npo_grants(account_id)
      `).run();

      await env.DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_npo_volunteers_account
        ON npo_volunteers(account_id)
      `).run();

      await env.DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_npo_expenses_account
        ON npo_expenses(account_id)
      `).run();

      await env.DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_npo_documents_account
        ON npo_documents(account_id)
      `).run();

      await env.DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_npo_governance_account
        ON npo_governance(account_id)
      `).run();
    }

    // =========================================================
    // INITIALISE SAAS MODULE ENGINE
    // =========================================================

    try {
      await ensureSaaSModuleTables();
    } catch (error) {
      console.error(
        "SaaS module engine initialisation error:",
        error
      );
    }

    // =========================================================
    // INITIALISE NPO / NGO ENGINE
    // =========================================================

    try {
      await ensureNPOTables();
    } catch (error) {
      console.error(
        "NPO module initialisation error:",
        error
      );
    }

    // =========================================================
    // PUBLIC SAAS MODULE CATALOGUE
    // =========================================================

    if (
      url.pathname === "/api/saas/modules" &&
      request.method === "GET"
    ) {
      try {
        await ensureSaaSModuleTables();

        const result =
          await env.DB.prepare(`
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
            WHERE active = 1
              AND customer_visible = 1
            ORDER BY display_order ASC, id ASC
          `).all();

        return json({
          success: true,
          modules: result.results || []
        });

      } catch (error) {
        console.error(
          "SaaS modules error:",
          error
        );

        return json({
          success: false,
          error:
            "Unable to load SaaS modules",
          details:
            String(error)
        }, 500);
      }
    }

    function bytesToHex(bytes) {
      return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, "0"))
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

    function bytesToBase64(bytes) {
      let binary = "";

      for (const byte of bytes) {
        binary += String.fromCharCode(byte);
      }

      return btoa(binary);
    }

    function base64ToBytes(base64) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);

      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      return bytes;
    }

    async function hashPassword(password, saltBytes) {
      const encoder = new TextEncoder();

      const keyMaterial =
        await crypto.subtle.importKey(
          "raw",
          encoder.encode(password),
          "PBKDF2",
          false,
          ["deriveBits"]
        );

      const derivedBits =
        await crypto.subtle.deriveBits(
          {
            name: "PBKDF2",
            salt: saltBytes,
            iterations: 100000,
            hash: "SHA-256"
          },
          keyMaterial,
          256
        );

      return new Uint8Array(derivedBits);
    }

    async function createPasswordHash(password) {
      const salt = crypto.getRandomValues(
        new Uint8Array(16)
      );

      const hash =
        await hashPassword(
          password,
          salt
        );

      return {
        hash: bytesToBase64(hash),
        salt: bytesToBase64(salt)
      };
    }

    async function verifyPassword(
      password,
      storedHash,
      storedSalt
    ) {
      try {
        const salt =
          base64ToBytes(storedSalt);

        const expectedHash =
          base64ToBytes(storedHash);

        const actualHash =
          await hashPassword(
            password,
            salt
          );

        if (
          actualHash.length !==
          expectedHash.length
        ) {
          return false;
        }

        let difference = 0;

        for (
          let i = 0;
          i < actualHash.length;
          i++
        ) {
          difference |=
            actualHash[i] ^
            expectedHash[i];
        }

        return difference === 0;

      } catch (error) {
        console.error(
          "Password verification error:",
          error
        );

        return false;
      }
    }

    async function hashSessionToken(token) {
      const data =
        new TextEncoder().encode(token);

      const digest =
        await crypto.subtle.digest(
          "SHA-256",
          data
        );

      return bytesToHex(
        new Uint8Array(digest)
      );
    }

    function getCookie(request, name) {
      const cookieHeader =
        request.headers.get("Cookie");

      if (!cookieHeader) {
        return null;
      }

      const cookies =
        cookieHeader.split(";");

      for (const cookie of cookies) {
        const index =
          cookie.indexOf("=");

        if (index === -1) {
          continue;
        }

        const key =
          cookie.slice(0, index).trim();

        const value =
          cookie.slice(index + 1).trim();

        if (key === name) {
          return decodeURIComponent(value);
        }
      }

      return null;
    }

    async function getAuthenticatedAccount(request) {
      try {
        await ensureAuthTables();

        const sessionToken =
          getCookie(
            request,
            "sbs_session"
          );

        if (!sessionToken) {
          return null;
        }

        const tokenHash =
          await hashSessionToken(
            sessionToken
          );

        const session =
          await env.DB
            .prepare(`
              SELECT
                customer_sessions.*,
                customer_accounts.id AS account_id,
                customer_accounts.tenant_id,
                customer_accounts.business_name,
                customer_accounts.full_name,
                customer_accounts.email,
                customer_accounts.phone,
                customer_accounts.plan,
                customer_accounts.subscription_status,
                customer_accounts.created_at AS account_created_at
              FROM customer_sessions
              INNER JOIN customer_accounts
                ON customer_accounts.id =
                   customer_sessions.account_id
              WHERE customer_sessions.token_hash = ?
                AND customer_sessions.expires_at > CURRENT_TIMESTAMP
              LIMIT 1
            `)
            .bind(tokenHash)
            .first();

        if (
          session &&
          String(
            session.subscription_status || ""
          ).toLowerCase() === "suspended"
        ) {
          return null;
        }

        return session || null;

      } catch (error) {
        console.error(
          "Authentication lookup error:",
          error
        );

        return null;
      }
    }

    function publicAccount(account) {
      if (!account) {
        return null;
      }

      return {
        id: account.account_id || account.id,
        business_name: account.business_name,
        full_name: account.full_name,
        email: account.email,
        phone: account.phone,
        plan: account.plan,
        subscription_status:
          account.subscription_status,
        created_at:
          account.account_created_at ||
          account.created_at
      };
    }

    // =========================================================
    // CUSTOMER REGISTRATION
    // =========================================================

    if (
      url.pathname === "/api/auth/register" &&
      request.method === "POST"
    ) {
      try {
        await ensureAuthTables();

        const body =
          await request.json();

        const businessName =
          String(
            body.business_name || ""
          ).trim();

        const fullName =
          String(
            body.full_name || ""
          ).trim();

        const email =
          String(
            body.email || ""
          )
            .trim()
            .toLowerCase();

        const phone =
          String(
            body.phone || ""
          ).trim();

        const password =
          String(
            body.password || ""
          );

        if (!businessName) {
          return json({
            success: false,
            error:
              "Business name is required"
          }, 400);
        }

        if (!fullName) {
          return json({
            success: false,
            error:
              "Full name is required"
          }, 400);
        }

        if (!email) {
          return json({
            success: false,
            error:
              "Email address is required"
          }, 400);
        }

        if (!email.includes("@")) {
          return json({
            success: false,
            error:
              "Please enter a valid email address"
          }, 400);
        }

        if (password.length < 8) {
          return json({
            success: false,
            error:
              "Password must contain at least 8 characters"
          }, 400);
        }

        const existing =
          await env.DB
            .prepare(`
              SELECT id
              FROM customer_accounts
              WHERE email = ?
              LIMIT 1
            `)
            .bind(email)
            .first();

        if (existing) {
          return json({
            success: false,
            error:
              "An account with this email address already exists"
          }, 409);
        }

        const passwordData =
          await createPasswordHash(
            password
          );

        const insert =
          await env.DB
            .prepare(`
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
                subscription_status,
                created_at,
                updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `)
            .bind(
              TENANT_ID,
              businessName,
              fullName,
              email,
              phone,
              passwordData.hash,
              passwordData.salt,
              null,
              "pending"
            )
            .run();

        const accountId =
          insert.meta?.last_row_id ||
          null;

        return json({
          success: true,
          message:
            "Business account created successfully",
          account_id:
            accountId,
          subscription_status:
            "pending"
        }, 201);

      } catch (error) {
        console.error(
          "Registration error:",
          error
        );

        return json({
          success: false,
          error:
            "Unable to create account",
          details:
            String(error)
        }, 500);
      }
    }

    // =========================================================
    // CUSTOMER LOGIN
    // =========================================================

    if (
      url.pathname === "/api/auth/login" &&
      request.method === "POST"
    ) {
      try {
        await ensureAuthTables();

        const body =
          await request.json();

        const email =
          String(
            body.email || ""
          )
            .trim()
            .toLowerCase();

        const password =
          String(
            body.password || ""
          );

        if (!email || !password) {
          return json({
            success: false,
            error:
              "Email and password are required"
          }, 400);
        }

        const account =
          await env.DB
            .prepare(`
              SELECT *
              FROM customer_accounts
              WHERE email = ?
              LIMIT 1
            `)
            .bind(email)
            .first();

        if (!account) {
          return json({
            success: false,
            error:
              "Invalid email or password"
          }, 401);
        }

        const valid =
          await verifyPassword(
            password,
            account.password_hash,
            account.password_salt
          );

        if (!valid) {
          return json({
            success: false,
            error:
              "Invalid email or password"
          }, 401);
        }

        if (
          String(
            account.subscription_status || ""
          ).toLowerCase() === "suspended"
        ) {
          return json({
            success: false,
            error:
              "This account has been suspended. Please contact Sky Blue Solution."
          }, 403);
        }

        const sessionToken =
          bytesToHex(
            crypto.getRandomValues(
              new Uint8Array(32)
            )
          );

        const tokenHash =
          await hashSessionToken(
            sessionToken
          );

        const expiresAt =
          new Date(
            Date.now() +
            30 * 24 * 60 * 60 * 1000
          ).toISOString();

        await env.DB
          .prepare(`
            INSERT INTO customer_sessions
            (
              account_id,
              token_hash,
              expires_at,
              created_at
            )
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          `)
          .bind(
            account.id,
            tokenHash,
            expiresAt
          )
          .run();

        const cookie =
          "sbs_session=" +
          encodeURIComponent(
            sessionToken
          ) +
          "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000";

        return json(
          {
            success: true,
            message:
              "Login successful",
            account: {
              id:
                account.id,
              business_name:
                account.business_name,
              full_name:
                account.full_name,
              email:
                account.email,
              phone:
                account.phone,
              plan:
                account.plan,
              subscription_status:
                account.subscription_status
            }
          },
          200,
          {
            "Set-Cookie": cookie
          }
        );

      } catch (error) {
        console.error(
          "Login error:",
          error
        );

        return json({
          success: false,
          error:
            "Unable to sign in",
          details:
            String(error)
        }, 500);
      }
    }

    // =========================================================
    // CURRENT CUSTOMER
    // =========================================================

    if (
      url.pathname === "/api/auth/me" &&
      request.method === "GET"
    ) {
      const account =
        await getAuthenticatedAccount(
          request
        );

      if (!account) {
        return json({
          success: false,
          authenticated: false,
          error:
            "Not authenticated"
        }, 401);
      }

      return json({
        success: true,
        authenticated: true,
        account:
          publicAccount(account)
      });
    }

    // =========================================================
    // CUSTOMER LOGOUT
    // =========================================================

    if (
      url.pathname === "/api/auth/logout" &&
      request.method === "POST"
    ) {
      try {
        const sessionToken =
          getCookie(
            request,
            "sbs_session"
          );

        if (sessionToken) {
          const tokenHash =
            await hashSessionToken(
              sessionToken
            );

          await env.DB
            .prepare(`
              DELETE FROM customer_sessions
              WHERE token_hash = ?
            `)
            .bind(tokenHash)
            .run();
        }

        return json(
          {
            success: true,
            message:
              "Logged out successfully"
          },
          200,
          {
            "Set-Cookie":
              "sbs_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
          }
        );

      } catch (error) {
        console.error(
          "Logout error:",
          error
        );

        return json({
          success: false,
          error:
            "Unable to log out"
        }, 500);
      }
    }

    // =========================================================
    // OWNER / ADMIN DASHBOARD
    // =========================================================

    async function createAdminToken(
      email,
      password
    ) {
      const expiresAt =
        Date.now() +
        12 * 60 * 60 * 1000;

      const payload =
        JSON.stringify({
          email,
          expiresAt
        });

      const payloadBase64 =
        btoa(payload);

      const encoder =
        new TextEncoder();

      const key =
        await crypto.subtle.importKey(
          "raw",
          encoder.encode(password),
          {
            name: "HMAC",
            hash: "SHA-256"
          },
          false,
          ["sign"]
        );

      const signature =
        await crypto.subtle.sign(
          "HMAC",
          key,
          encoder.encode(
            payloadBase64
          )
        );

      return (
        payloadBase64 +
        "." +
        bytesToBase64(
          new Uint8Array(signature)
        )
      );
    }

    async function verifyAdminToken(
      token,
      configuredEmail,
      configuredPassword
    ) {
      try {
        if (!token) {
          return null;
        }

        const parts =
          token.split(".");

        if (parts.length !== 2) {
          return null;
        }

        const payloadBase64 =
          parts[0];

        const signatureBase64 =
          parts[1];

        const payload =
          JSON.parse(
            atob(payloadBase64)
          );

        if (
          !payload ||
          !payload.email ||
          !payload.expiresAt
        ) {
          return null;
        }

        if (
          String(
            payload.email
          ).toLowerCase() !==
          String(
            configuredEmail
          ).toLowerCase()
        ) {
          return null;
        }

        if (
          Number(
            payload.expiresAt
          ) <= Date.now()
        ) {
          return null;
        }

        const encoder =
          new TextEncoder();

        const key =
          await crypto.subtle.importKey(
            "raw",
            encoder.encode(
              configuredPassword
            ),
            {
              name: "HMAC",
              hash: "SHA-256"
            },
            false,
            ["verify"]
          );

        const valid =
          await crypto.subtle.verify(
            "HMAC",
            key,
            base64ToBytes(
              signatureBase64
            ),
            encoder.encode(
              payloadBase64
            )
          );

        if (!valid) {
          return null;
        }

        return {
          email:
            configuredEmail,
          expires_at:
            new Date(
              Number(
                payload.expiresAt
              )
            ).toISOString()
        };

      } catch (error) {
        console.error(
          "Admin token verification error:",
          error
        );

        return null;
      }
    }

    async function getAdminSession(request) {
      try {
        const configuredEmail =
          String(
            env.ADMIN_EMAIL || ""
          )
            .trim()
            .toLowerCase();

        const configuredPassword =
          String(
            env.ADMIN_PASSWORD || ""
          );

        if (
          !configuredEmail ||
          !configuredPassword
        ) {
          return null;
        }

        const token =
          getCookie(
            request,
            "sbs_admin"
          );

        if (!token) {
          return null;
        }

        return await verifyAdminToken(
          token,
          configuredEmail,
          configuredPassword
        );

      } catch (error) {
        console.error(
          "Admin session lookup error:",
          error
        );

        return null;
      }
    }

    async function requireAdmin(request) {
      const session =
        await getAdminSession(
          request
        );

      if (!session) {
        return json({
          success: false,
          authenticated: false,
          error:
            "Admin authentication required"
        }, 401);
      }

      return session;
    }

    // =========================================================
    // OWNER: CUSTOMER ACCESS CONTROL
    // =========================================================

    if (
      url.pathname === "/api/admin/customer-status" &&
      request.method === "POST"
    ) {
      try {
        const admin =
          await requireAdmin(request);

        if (admin instanceof Response) {
          return admin;
        }

        await ensureAuthTables();

        const body =
          await request.json();

        const accountId =
          Number(body.account_id || 0);

        const action =
          String(body.action || "")
            .trim()
            .toLowerCase();

        if (
          !Number.isInteger(accountId) ||
          accountId <= 0
        ) {
          return json({
            success: false,
            error:
              "A valid customer account ID is required."
          }, 400);
        }

        if (
          action !== "suspend" &&
          action !== "reactivate"
        ) {
          return json({
            success: false,
            error:
              "Action must be suspend or reactivate."
          }, 400);
        }

        const customer =
          await env.DB
            .prepare(`
              SELECT
                id,
                business_name,
                subscription_status
              FROM customer_accounts
              WHERE id = ?
              LIMIT 1
            `)
            .bind(accountId)
            .first();

        if (!customer) {
          return json({
            success: false,
            error:
              "Customer account not found."
          }, 404);
        }

        if (action === "suspend") {
          await env.DB
            .prepare(`
              UPDATE customer_accounts
              SET
                subscription_status = 'suspended',
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `)
            .bind(accountId)
            .run();

          await env.DB
            .prepare(`
              DELETE FROM customer_sessions
              WHERE account_id = ?
            `)
            .bind(accountId)
            .run();

          return json({
            success: true,
            action: "suspended",
            account_id: accountId,
            status: "suspended",
            message:
              "Customer access has been suspended."
          });
        }

        await env.DB
          .prepare(`
            UPDATE customer_accounts
            SET
              subscription_status = 'active',
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .bind(accountId)
          .run();

        return json({
          success: true,
          action: "reactivated",
          account_id: accountId,
          status: "active",
          message:
            "Customer access has been reactivated."
        });

      } catch (error) {
        console.error(
          "Customer access control error:",
          error
        );

        return json({
          success: false,
          error:
            "Unable to change customer access.",
          details:
            String(error)
        }, 500);
      }
    }

    // =========================================================
    // OWNER LOGIN
    // =========================================================

    if (
      url.pathname === "/api/admin/login" &&
      request.method === "POST"
    ) {
      try {
        const configuredEmail =
          String(
            env.ADMIN_EMAIL || ""
          )
            .trim()
            .toLowerCase();

        const configuredPassword =
          String(
            env.ADMIN_PASSWORD || ""
          );

        if (
          !configuredEmail ||
          !configuredPassword
        ) {
          return json({
            success: false,
            error:
              "Admin credentials are not configured in Cloudflare."
          }, 500);
        }

        const body =
          await request.json();

        const email =
          String(
            body.email || ""
          )
            .trim()
            .toLowerCase();

        const password =
          String(
            body.password || ""
          );

        if (
          !email ||
          !password
        ) {
          return json({
            success: false,
            error:
              "Email and password are required"
          }, 400);
        }

        if (
          email !== configuredEmail ||
          password !== configuredPassword
        ) {
          return json({
            success: false,
            error:
              "Invalid admin email or password"
          }, 401);
        }

        const token =
          await createAdminToken(
            configuredEmail,
            configuredPassword
          );

        return json(
          {
            success: true,
            authenticated: true,
            admin: {
              email:
                configuredEmail
            }
          },
          200,
          {
            "Set-Cookie":
              "sbs_admin=" +
              encodeURIComponent(
                token
              ) +
              "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200"
          }
        );

      } catch (error) {
        console.error(
          "Admin login error:",
          error
        );

        return json({
          success: false,
          error:
            "Unable to sign in as administrator",
          details:
            String(error)
        }, 500);
      }
    }

    // =========================================================
    // OWNER SESSION
    // =========================================================

    if (
      url.pathname === "/api/admin/me" &&
      request.method === "GET"
    ) {
      const session =
        await getAdminSession(
          request
        );

      if (!session) {
        return json({
          success: false,
          authenticated: false
        }, 401);
      }

      return json({
        success: true,
        authenticated: true,
        admin: {
          email:
            session.email
        }
      });
    }

    // =========================================================
    // OWNER LOGOUT
    // =========================================================

    if (
      url.pathname === "/api/admin/logout" &&
      request.method === "POST"
    ) {
      return json(
        {
          success: true,
          message:
            "Admin logged out"
        },
        200,
        {
          "Set-Cookie":
            "sbs_admin=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
        }
      );
    }

    // =========================================================
    // OWNER SAAS MODULE CATALOGUE
    // =========================================================

    if (
      url.pathname === "/api/admin/saas/modules" &&
      request.method === "GET"
    ) {
      try {
        const admin =
          await requireAdmin(request);

        if (admin instanceof Response) {
          return admin;
        }

        await ensureSaaSModuleTables();

        const result =
          await env.DB.prepare(`
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
              display_order,
              created_at,
              updated_at
            FROM saas_modules
            ORDER BY display_order ASC, id ASC
          `).all();

        return json({
          success: true,
          modules: result.results || []
        });

      } catch (error) {
        console.error(
          "Admin SaaS modules error:",
          error
        );

        return json({
          success: false,
          error:
            "Unable to load SaaS module catalogue",
          details:
            String(error)
        }, 500);
      }
    }

    // =========================================================
    // NPO MODULE ACTIVATION
    // =========================================================

    if (
      url.pathname === "/api/npo/activate" &&
      request.method === "POST"
    ) {
      try {
        const account =
          await getAuthenticatedAccount(
            request
          );

        if (!account) {
          return json({
            success: false,
            authenticated: false,
            error:
              "Customer authentication required"
          }, 401);
        }

        await ensureNPOTables();

        const existing =
          await env.DB
            .prepare(`
              SELECT *
              FROM customer_modules
              WHERE account_id = ?
                AND module_code = 'npo-ngo'
              LIMIT 1
            `)
            .bind(account.account_id)
            .first();

        if (!existing) {
          await env.DB
            .prepare(`
              INSERT INTO customer_modules
              (
                account_id,
                module_code,
                status,
                activated_at,
                updated_at
              )
              VALUES (?, 'npo-ngo', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `)
            .bind(account.account_id)
            .run();
        } else {
          await env.DB
            .prepare(`
              UPDATE customer_modules
              SET
                status = 'active',
                updated_at = CURRENT_TIMESTAMP
              WHERE account_id = ?
                AND module_code = 'npo-ngo'
            `)
            .bind(account.account_id)
            .run();
        }

        return json({
          success: true,
          module_code: "npo-ngo",
          status: "active",
          message:
            "NPO & NGO Management module activated."
        });

      } catch (error) {
        console.error(
          "NPO activation error:",
          error
        );

        return json({
          success: false,
          error:
            "Unable to activate NPO module.",
          details:
            String(error)
        }, 500);
      }
    }

    // =========================================================
    // NPO MODULE STATUS
    // =========================================================

    if (
      url.pathname === "/api/npo/status" &&
      request.method === "GET"
    ) {
      try {
        const account =
          await getAuthenticatedAccount(
            request
          );

        if (!account) {
          return json({
            success: false,
            authenticated: false,
            error:
              "Customer authentication required"
          }, 401);
        }

        await ensureNPOTables();

        const module =
          await env.DB
            .prepare(`
              SELECT *
              FROM customer_modules
              WHERE account_id = ?
                AND module_code = 'npo-ngo'
              LIMIT 1
            `)
            .bind(account.account_id)
            .first();

        return json({
          success: true,
          active:
            Boolean(
              module &&
              module.status === "active"
            ),
          module:
            module || null
        });

      } catch (error) {
        console.error(
          "NPO status error:",
          error
        );

        return json({
          success: false,
          error:
            "Unable to load NPO module status",
          details:
            String(error)
        }, 500);
      }
    }

    // =========================================================
    // NPO DASHBOARD
    // =========================================================

    if (
      url.pathname === "/api/npo/dashboard" &&
      request.method === "GET"
    ) {
      try {
        const account =
          await getAuthenticatedAccount(
            request
          );

        if (!account) {
          return json({
            success: false,
            authenticated: false,
            error:
              "Customer authentication required"
          }, 401);
        }

        await ensureNPOTables();

        const accountId =
          Number(account.account_id);

        const profile =
          await env.DB
            .prepare(`
              SELECT *
              FROM npo_profiles
              WHERE account_id = ?
              LIMIT 1
            `)
            .bind(accountId)
            .first();

        const beneficiaries =
          await env.DB
            .prepare(`
              SELECT COUNT(*) AS total
              FROM npo_beneficiaries
              WHERE account_id = ?
                AND LOWER(
                  COALESCE(status, 'active')
                ) != 'deleted'
            `)
            .bind(accountId)
            .first();

        const projects =
          await env.DB
            .prepare(`
              SELECT COUNT(*) AS total
              FROM npo_projects
              WHERE account_id = ?
                AND LOWER(
                  COALESCE(status, '')
                ) NOT IN (
                  'deleted',
                  'cancelled'
                )
            `)
            .bind(accountId)
            .first();

        const donors =
          await env.DB
            .prepare(`
              SELECT COUNT(*) AS total
              FROM npo_donors
              WHERE account_id = ?
                AND LOWER(
                  COALESCE(status, 'active')
                ) != 'deleted'
            `)
            .bind(accountId)
            .first();

        const volunteers =
          await env.DB
            .prepare(`
              SELECT COUNT(*) AS total
              FROM npo_volunteers
              WHERE account_id = ?
                AND LOWER(
                  COALESCE(status, 'active')
                ) != 'deleted'
            `)
            .bind(accountId)
            .first();

        const grants =
          await env.DB
            .prepare(`
              SELECT COUNT(*) AS total
              FROM npo_grants
              WHERE account_id = ?
                AND LOWER(
                  COALESCE(status, '')
                ) NOT IN (
                  'deleted',
                  'cancelled'
                )
            `)
            .bind(accountId)
            .first();

        const totalDonations =
          await env.DB
            .prepare(`
              SELECT
                COALESCE(
                  SUM(amount),
                  0
                ) AS total
              FROM npo_donations
              WHERE account_id = ?
                AND LOWER(
                  COALESCE(status, '')
                ) IN (
                  'received',
                  'completed',
                  'paid',
                  'approved'
                )
            `)
            .bind(accountId)
            .first();

        const totalExpenses =
          await env.DB
            .prepare(`
              SELECT
                COALESCE(
                  SUM(amount),
                  0
                ) AS total
              FROM npo_expenses
              WHERE account_id = ?
                AND LOWER(
                  COALESCE(status, '')
                ) NOT IN (
                  'deleted',
                  'cancelled'
                )
            `)
            .bind(accountId)
            .first();

        const totalGranted =
          await env.DB
            .prepare(`
              SELECT
                COALESCE(
                  SUM(awarded_amount),
                  0
                ) AS total
              FROM npo_grants
              WHERE account_id = ?
                AND LOWER(
                  COALESCE(status, '')
                ) IN (
                  'awarded',
                  'active',
                  'approved',
                  'completed'
                )
            `)
            .bind(accountId)
            .first();

        return json({
          success: true,

          organisation: profile || {
            organisation_name:
              account.business_name,
            contact_person:
              account.full_name,
            email:
              account.email,
            phone:
              account.phone
          },

          metrics: {
            beneficiaries:
              Number(
                beneficiaries?.total || 0
              ),

            projects:
              Number(
                projects?.total || 0
              ),

            donors:
              Number(
                donors?.total || 0
              ),

            volunteers:
              Number(
                volunteers?.total || 0
              ),

            grants:
              Number(
                grants?.total || 0
              ),

            total_donations:
              Number(
                totalDonations?.total || 0
              ),

            total_expenses:
              Number(
                totalExpenses?.total || 0
              ),

            total_grants_awarded:
              Number(
                totalGranted?.total || 0
              ),

            available_balance:
              Number(
                totalDonations?.total || 0
              ) -
              Number(
                totalExpenses?.total || 0
              )
          }
        });

      } catch (error) {
        console.error(
          "NPO dashboard error:",
          error
        );

        return json({
          success: false,
          error:
            "Unable to load NPO dashboard",
          details:
            String(error)
        }, 500);
      }
    }

    // =========================================================
    // NPO ORGANISATION PROFILE
    // =========================================================

    if (
      url.pathname === "/api/npo/profile" &&
      request.method === "GET"
    ) {
      try {
        const account =
          await getAuthenticatedAccount(
            request
          );

        if (!account) {
          return json({
            success: false,
            error:
              "Customer authentication required"
          }, 401);
        }

        await ensureNPOTables();

        const profile =
          await env.DB
            .prepare(`
              SELECT *
              FROM npo_profiles
              WHERE account_id = ?
              LIMIT 1
            `)
            .bind(account.account_id)
            .first();

        return json({
          success: true,
          profile:
            profile || {
              organisation_name:
                account.business_name,
              contact_person:
                account.full_name,
              email:
                account.email,
              phone:
                account.phone
            }
        });

      } catch (error) {
        console.error(
          "NPO profile error:",
          error
        );

        return json({
          success: false,
          error:
            "Unable to load NPO profile",
          details:
            String(error)
        }, 500);
      }
    }

    if (
      url.pathname === "/api/npo/profile" &&
      request.method === "POST"
    ) {
      try {
        const account =
          await getAuthenticatedAccount(
            request
          );

        if (!account) {
          return json({
            success: false,
            error:
              "Customer authentication required"
          }, 401);
        }

        await ensureNPOTables();

        const body =
          await request.json();

        const organisationName =
          String(
            body.organisation_name ||
            account.business_name ||
            ""
          ).trim();

        if (!organisationName) {
          return json({
            success: false,
            error:
              "Organisation name is required"
          }, 400);
        }

        const existing =
          await env.DB
            .prepare(`
              SELECT id
              FROM npo_profiles
              WHERE account_id = ?
              LIMIT 1
            `)
            .bind(account.account_id)
            .first();

        if (existing) {
          await env.DB
            .prepare(`
              UPDATE npo_profiles
              SET
                organisation_name = ?,
                registration_number = ?,
                organisation_type = ?,
                description = ?,
                mission = ?,
                vision = ?,
                contact_person = ?,
                email = ?,
                phone = ?,
                address = ?,
                province = ?,
                city = ?,
                website = ?,
                status = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE account_id = ?
            `)
            .bind(
              organisationName,
              String(body.registration_number || "").trim(),
              String(body.organisation_type || "").trim(),
              String(body.description || "").trim(),
              String(body.mission || "").trim(),
              String(body.vision || "").trim(),
              String(body.contact_person || account.full_name || "").trim(),
              String(body.email || account.email || "").trim(),
              String(body.phone || account.phone || "").trim(),
              String(body.address || "").trim(),
              String(body.province || "").trim(),
              String(body.city || "").trim(),
              String(body.website || "").trim(),
              String(body.status || "active").trim(),
              account.account_id
            )
            .run();

        } else {
          await env.DB
            .prepare(`
              INSERT INTO npo_profiles
              (
                account_id,
                tenant_id,
                organisation_name,
                registration_number,
                organisation_type,
                description,
                mission,
                vision,
                contact_person,
                email,
                phone,
                address,
                province,
                city,
                website,
                status,
                created_at,
                updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `)
            .bind(
              account.account_id,
              TENANT_ID,
              organisationName,
              String(body.registration_number || "").trim(),
              String(body.organisation_type || "").trim(),
              String(body.description || "").trim(),
              String(body.mission || "").trim(),
              String(body.vision || "").trim(),
              String(body.contact_person || account.full_name || "").trim(),
              String(body.email || account.email || "").trim(),
              String(body.phone || account.phone || "").trim(),
              String(body.address || "").trim(),
              String(body.province || "").trim(),
              String(body.city || "").trim(),
              String(body.website || "").trim(),
              String(body.status || "active").trim()
            )
            .run();
        }

        const profile =
          await env.DB
            .prepare(`
              SELECT *
              FROM npo_profiles
              WHERE account_id = ?
              LIMIT 1
            `)
            .bind(account.account_id)
            .first();

        return json({
          success: true,
          message:
            "NPO organisation profile saved successfully.",
          profile
        });

      } catch (error) {
        console.error(
          "NPO profile save error:",
          error
        );

        return json({
          success: false,
          error:
            "Unable to save NPO profile",
          details:
            String(error)
        }, 500);
      }
    }

    // =========================================================
    // OWNER DASHBOARD DATA
    // =========================================================

    if (
      url.pathname === "/api/admin/dashboard" &&
      request.method === "GET"
    ) {
      try {
        const admin =
          await requireAdmin(
            request
          );

        if (admin instanceof Response) {
          return admin;
        }

        await ensureAuthTables();

        const totalCustomers =
          await env.DB
            .prepare(`
              SELECT COUNT(*) AS total
              FROM customer_accounts
            `)
            .first();

        const activeSubscribers =
          await env.DB
            .prepare(`
              SELECT COUNT(*) AS total
              FROM customer_accounts
              WHERE LOWER(
                COALESCE(
                  subscription_status,
                  ''
                )
              ) = 'active'
            `)
            .first();

        const paidCustomers =
          await env.DB
            .prepare(`
              SELECT COUNT(
                DISTINCT customer_id
              ) AS total
              FROM saas_payments
              WHERE customer_id IS NOT NULL
                AND LOWER(
                  COALESCE(
                    payment_status,
                    ''
                  )
                ) IN (
                  'paid',
                  'complete',
                  'completed',
                  'success',
                  'successful'
                )
            `)
            .first();

        const pendingCustomers =
          await env.DB
            .prepare(`
              SELECT COUNT(*) AS total
              FROM customer_accounts
              WHERE LOWER(
                COALESCE(
                  subscription_status,
                  ''
                )
              ) IN (
                'pending',
                'unpaid',
                'awaiting_payment',
                'inactive'
              )
              OR subscription_status IS NULL
              OR TRIM(subscription_status) = ''
            `)
            .first();

        const cancelledSubscriptions =
          await env.DB
            .prepare(`
              SELECT COUNT(*) AS total
              FROM customer_accounts
              WHERE LOWER(
                COALESCE(
                  subscription_status,
                  ''
                )
              ) IN (
                'cancelled',
                'canceled'
              )
            `)
            .first();

        const failedPayments =
          await env.DB
            .prepare(`
              SELECT COUNT(*) AS total
              FROM saas_payments
              WHERE LOWER(
                COALESCE(
                  payment_status,
                  ''
                )
              ) IN (
                'failed',
                'failure',
                'declined',
                'cancelled',
                'canceled'
              )
            `)
            .first();

        const newCustomers =
          await env.DB
            .prepare(`
              SELECT COUNT(*) AS total
              FROM customer_accounts
              WHERE created_at >=
                datetime(
                  'now',
                  '-30 days'
                )
            `)
            .first();

        const revenueToday =
          await env.DB
            .prepare(`
              SELECT
                COALESCE(
                  SUM(amount),
                  0
                ) AS total
              FROM saas_payments
              WHERE LOWER(
                COALESCE(
                  payment_status,
                  ''
                )
              ) IN (
                'paid',
                'complete',
                'completed',
                'success',
                'successful'
              )
              AND date(
                COALESCE(
                  paid_at,
                  created_at
                )
              ) = date('now')
            `)
            .first();

        const revenueWeek =
          await env.DB
            .prepare(`
              SELECT
                COALESCE(
                  SUM(amount),
                  0
                ) AS total
              FROM saas_payments
              WHERE LOWER(
                COALESCE(
                  payment_status,
                  ''
                )
              ) IN (
                'paid',
                'complete',
                'completed',
                'success',
                'successful'
              )
              AND datetime(
                COALESCE(
                  paid_at,
                  created_at
                )
              ) >= datetime(
                'now',
                '-7 days'
              )
            `)
            .first();

        const revenueMonth =
          await env.DB
            .prepare(`
              SELECT
                COALESCE(
                  SUM(amount),
                  0
                ) AS total
              FROM saas_payments
              WHERE LOWER(
                COALESCE(
                  payment_status,
                  ''
                )
              ) IN (
                'paid',
                'complete',
                'completed',
                'success',
                'successful'
              )
              AND strftime(
                '%Y-%m',
                COALESCE(
                  paid_at,
                  created_at
                )
              ) =
              strftime(
                '%Y-%m',
                'now'
              )
            `)
            .first();

        const revenueLastMonth =
          await env.DB
            .prepare(`
              SELECT
                COALESCE(
                  SUM(amount),
                  0
                ) AS total
              FROM saas_payments
              WHERE LOWER(
                COALESCE(
                  payment_status,
                  ''
                )
              ) IN (
                'paid',
                'complete',
                'completed',
                'success',
                'successful'
              )
              AND strftime(
                '%Y-%m',
                COALESCE(
                  paid_at,
                  created_at
                )
              ) =
              strftime(
                '%Y-%m',
                date(
                  'now',
                  '-1 month'
                )
              )
            `)
            .first();

        const revenueYear =
          await env.DB
            .prepare(`
              SELECT
                COALESCE(
                  SUM(amount),
                  0
                ) AS total
              FROM saas_payments
              WHERE LOWER(
                COALESCE(
                  payment_status,
                  ''
                )
              ) IN (
                'paid',
                'complete',
                'completed',
                'success',
                'successful'
              )
              AND strftime(
                '%Y',
                COALESCE(
                  paid_at,
                  created_at
                )
              ) =
              strftime(
                '%Y',
                'now'
              )
            `)
            .first();

        const lifetimeRevenue =
          await env.DB
            .prepare(`
              SELECT
                COALESCE(
                  SUM(amount),
                  0
                ) AS total
              FROM saas_payments
              WHERE LOWER(
                COALESCE(
                  payment_status,
                  ''
                )
              ) IN (
                'paid',
                'complete',
                'completed',
                'success',
                'successful'
              )
            `)
            .first();

        const recurring = {
          total: 0
        };

        const planCounts =
          await env.DB
            .prepare(`
              SELECT
                COALESCE(
                  NULLIF(
                    plan,
                    ''
                  ),
                  'Unassigned'
                ) AS plan,
                COUNT(*) AS customers
              FROM customer_accounts
              GROUP BY
                COALESCE(
                  NULLIF(
                    plan,
                    ''
                  ),
                  'Unassigned'
                )
              ORDER BY customers DESC
            `)
            .all();

        const revenueByPlan = {
          results: []
        };

        const revenueChart =
          await env.DB
            .prepare(`
              SELECT
                date(
                  COALESCE(
                    paid_at,
                    created_at
                  )
                ) AS day,
                COALESCE(
                  SUM(amount),
                  0
                ) AS revenue
              FROM saas_payments
              WHERE LOWER(
                COALESCE(
                  payment_status,
                  ''
                )
              ) IN (
                'paid',
                'complete',
                'completed',
                'success',
                'successful'
              )
              AND datetime(
                COALESCE(
                  paid_at,
                  created_at
                )
              ) >= datetime(
                'now',
                '-14 days'
              )
              GROUP BY date(
                COALESCE(
                  paid_at,
                  created_at
                )
              )
              ORDER BY day ASC
            `)
            .all();

        const recentPayments =
          await env.DB
            .prepare(`
              SELECT
                p.id,
                p.organisation_id,
                p.record_id,
                p.customer_id,
                p.amount,
                p.payment_method,
                p.payment_status,
                p.reference,
                p.paid_at,
                p.notes,
                p.created_at
              FROM saas_payments p
              ORDER BY
                datetime(
                  COALESCE(
                    p.paid_at,
                    p.created_at
                  )
                ) DESC,
                p.id DESC
              LIMIT 100
            `)
            .all();

        const customers =
          await env.DB
            .prepare(`
              SELECT
                a.id,
                a.business_name,
                a.full_name,
                a.email,
                a.phone,
                a.plan,
                a.subscription_status,
                a.created_at,
                a.updated_at
              FROM customer_accounts a
              ORDER BY
                datetime(
                  a.created_at
                ) DESC,
                a.id DESC
              LIMIT 500
            `)
            .all();

        return json({
          success: true,

          generated_at:
            new Date().toISOString(),

          metrics: {
            total_customers:
              Number(
                totalCustomers?.total || 0
              ),

            active_subscribers:
              Number(
                activeSubscribers?.total || 0
              ),

            paid_customers:
              Number(
                paidCustomers?.total || 0
              ),

            pending_customers:
              Number(
                pendingCustomers?.total || 0
              ),

            cancelled_subscriptions:
              Number(
                cancelledSubscriptions?.total || 0
              ),

            failed_payments:
              Number(
                failedPayments?.total || 0
              ),

            new_customers_30_days:
              Number(
                newCustomers?.total || 0
              ),

            revenue_today:
              Number(
                revenueToday?.total || 0
              ),

            revenue_week:
              Number(
                revenueWeek?.total || 0
              ),

            revenue_month:
              Number(
                revenueMonth?.total || 0
              ),

            revenue_last_month:
              Number(
                revenueLastMonth?.total || 0
              ),

            revenue_year:
              Number(
                revenueYear?.total || 0
              ),

            lifetime_revenue:
              Number(
                lifetimeRevenue?.total || 0
              ),

            estimated_monthly_recurring_revenue:
              Number(
                recurring?.total || 0
              )
          },

          plan_counts:
            planCounts.results || [],

          revenue_by_plan:
            revenueByPlan.results || [],

          revenue_chart:
            revenueChart.results || [],

          recent_payments:
            recentPayments.results || [],

          customers:
            customers.results || []
        });

      } catch (error) {
        console.error(
          "Admin dashboard error:",
          error
        );

        return json({
          success: false,
          error:
            "Unable to load owner dashboard",
          details:
            String(error)
        }, 500);
      }
    }

        // =========================================================
    // SHARED SAAS WHATSAPP ENGINE
    // =========================================================

    if (
      url.pathname.startsWith("/api/whatsapp/") &&
      url.pathname !== "/api/whatsapp"
    ) {
      try {
        await ensureWhatsAppSaaSTables(env);

        const account =
          await getAuthenticatedAccount(request);

        if (!account) {
          return json({
            success: false,
            error: "Authentication required"
          }, 401);
        }

        const accountId =
          Number(account.account_id);

        // -----------------------------------------------------
        // WHATSAPP STATUS
        // -----------------------------------------------------

        if (
          url.pathname === "/api/whatsapp/status" &&
          request.method === "GET"
        ) {
          const status =
            await getWhatsAppStatus(
              env,
              accountId
            );

          return json({
            success: true,
            whatsapp: status
          });
        }

        // -----------------------------------------------------
        // WHATSAPP CONTACTS
        // -----------------------------------------------------

        if (
          url.pathname === "/api/whatsapp/contacts" &&
          request.method === "GET"
        ) {
          const moduleCode =
            url.searchParams.get(
              "module_code"
            );

          const search =
            url.searchParams.get(
              "search"
            );

          const contacts =
            await getWhatsAppContacts(
              env,
              {
                accountId,
                moduleCode,
                search
              }
            );

          return json({
            success: true,
            contacts
          });
        }

        // -----------------------------------------------------
        // CREATE / UPDATE WHATSAPP CONTACT
        // -----------------------------------------------------

        if (
          url.pathname === "/api/whatsapp/contacts" &&
          request.method === "POST"
        ) {
          const body =
            await request.json();

          const contact =
            await createOrUpdateWhatsAppContact(
              env,
              {
                accountId,
                phone:
                  body.phone,
                name:
                  body.name || null,
                email:
                  body.email || null,
                whatsappName:
                  body.whatsapp_name || null,
                moduleCode:
                  body.module_code || null,
                customerId:
                  body.customer_id || null,
                optIn:
                  body.opt_in !== false
              }
            );

          return json({
            success: true,
            contact
          }, 201);
        }

        // -----------------------------------------------------
        // WHATSAPP MESSAGE HISTORY
        // -----------------------------------------------------

        if (
          url.pathname === "/api/whatsapp/messages" &&
          request.method === "GET"
        ) {
          const moduleCode =
            url.searchParams.get(
              "module_code"
            );

          const phone =
            url.searchParams.get(
              "phone"
            );

          const limit =
            Number(
              url.searchParams.get(
                "limit"
              ) || 100
            );

          const messages =
            await getWhatsAppMessages(
              env,
              {
                accountId,
                moduleCode,
                phone,
                limit
              }
            );

          return json({
            success: true,
            messages
          });
        }

        // -----------------------------------------------------
        // SEND WHATSAPP MESSAGE
        // -----------------------------------------------------

        if (
          url.pathname === "/api/whatsapp/send" &&
          request.method === "POST"
        ) {
          const body =
            await request.json();

          if (!body.phone) {
            return json({
              success: false,
              error:
                "phone is required"
            }, 400);
          }

          if (!body.message) {
            return json({
              success: false,
              error:
                "message is required"
            }, 400);
          }

          const result =
            await sendSaaSWhatsAppMessage(
              env,
              {
                accountId,
                moduleCode:
                  body.module_code || null,
                customerId:
                  body.customer_id || null,
                contactId:
                  body.contact_id || null,
                phone:
                  body.phone,
                message:
                  body.message,
                messageType:
                  body.message_type || "text"
              }
            );

          return json(
            result,
            result.success
              ? 200
              : 400
          );
        }

        // -----------------------------------------------------
        // QUEUE WHATSAPP NOTIFICATION
        // -----------------------------------------------------

        if (
          url.pathname === "/api/whatsapp/notify" &&
          request.method === "POST"
        ) {
          const body =
            await request.json();

          if (!body.phone) {
            return json({
              success: false,
              error:
                "phone is required"
            }, 400);
          }

          if (!body.event_type) {
            return json({
              success: false,
              error:
                "event_type is required"
            }, 400);
          }

          if (!body.message) {
            return json({
              success: false,
              error:
                "message is required"
            }, 400);
          }

          const queued =
            await queueWhatsAppNotification(
              env,
              {
                accountId,
                moduleCode:
                  body.module_code ||
                  "other-services",
                phone:
                  body.phone,
                eventType:
                  body.event_type,
                message:
                  body.message,
                customerId:
                  body.customer_id || null,
                contactId:
                  body.contact_id || null,
                scheduledAt:
                  body.scheduled_at || null
              }
            );

          return json(
            queued,
            201
          );
        }

        // -----------------------------------------------------
        // SEND QUEUED WHATSAPP NOTIFICATION
        // -----------------------------------------------------

        if (
          url.pathname.startsWith(
            "/api/whatsapp/notify/"
          ) &&
          request.method === "POST"
        ) {
          const notificationId =
            Number(
              url.pathname
                .split("/")
                .pop()
            );

          if (!notificationId) {
            return json({
              success: false,
              error:
                "Invalid notification ID"
            }, 400);
          }

          const notification =
            await env.DB
              .prepare(`
                SELECT *
                FROM saas_whatsapp_notifications
                WHERE id = ?
                  AND account_id = ?
                LIMIT 1
              `)
              .bind(
                notificationId,
                accountId
              )
              .first();

          if (!notification) {
            return json({
              success: false,
              error:
                "Notificatìion not found"
            }, 404);
          }

          const result =
            await processWhatsAppNotification(
              env,
              notification
            );

          return json(
            result,
            result.success
              ? 200
              : 400
          );
        }

        return json({
          success: false,
          error:
            "WhatsApp SaaS endpoint not found"
        }, 404);

      } catch (error) {
        console.error(
          "SaaS WhatsApp API error:",
          error
        );

        return json({
          success: false,
          error:
            "WhatsApp service error",
          details:
            String(error)
        }, 500);
      }
            }

    // =========================================================
    // WHATSAPP WEBHOOK VERIFICATION
    // =========================================================

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
        token &&
        env.WHATSAPP_VERIFY_TOKEN &&
        token ===
          env.WHATSAPP_VERIFY_TOKEN
      ) {
        return new Response(
          challenge,
          {
            status: 200,
            headers: {
              "Content-Type":
                "text/plain"
            }
          }
        );
      }

      return new Response(
        "Forbidden",
        {
          status: 403,
          headers: corsHeaders
        }
      );
    }

    // =========================================================
    // WHATSAPP SEND MESSAGE
    // =========================================================

    async function sendWhatsAppMessage(
      to,
      message
    ) {
      if (
        !env.WHATSAPP_ACCESS_TOKEN ||
        !env.WHATSAPP_PHONE_NUMBER_ID
      ) {
        console.error(
          "WhatsApp credentials are missing"
        );

        return false;
      }

      try {
        const response =
          await fetch(
            `https://graph.facebook.com/v23.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
            {
              method: "POST",
              headers: {
                "Authorization":
                  `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
                "Content-Type":
                  "application/json"
              },
              body:
                JSON.stringify({
                  messaging_product:
                    "whatsapp",
                  recipient_type:
                    "individual",
                  to:
                    to,
                  type:
                    "text",
                  text: {
                    preview_url:
                      false,
                    body:
                      message
                  }
                })
            }
          );

        const result =
          await response.json();

        if (!response.ok) {
          console.error(
            "WhatsApp send error:",
            JSON.stringify(result)
          );

          return false;
        }

        console.log(
          "WhatsApp message sent:",
          JSON.stringify(result)
        );

        return true;

      } catch (error) {
        console.error(
          "WhatsApp API error:",
          error
        );

        return false;
      }
    }

    // =========================================================
    // GET OR CREATE WHATSAPP CONVERSATION
    // =========================================================

    async function getConversation(
      phone
    ) {
      return await env.DB
        .prepare(`
          SELECT *
          FROM whatsapp_conversations
          WHERE phone = ?
            AND tenant_id = ?
          LIMIT 1
        `)
        .bind(
          phone,
          TENANT_ID
        )
        .first();
    }

    async function createConversation(
      phone
    ) {
      await env.DB
        .prepare(`
          INSERT INTO whatsapp_conversations
          (
            tenant_id,
            ward_id,
            phone,
            state,
            data,
            last_message_at,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `)
        .bind(
          TENANT_ID,
          WARD_ID,
          phone,
          "start",
          JSON.stringify({})
        )
        .run();

      return await getConversation(
        phone
      );
    }

    async function updateConversation(
      phone,
      state,
      data
    ) {
      await env.DB
        .prepare(`
          UPDATE whatsapp_conversations
          SET
            state = ?,
            data = ?,
            last_message_at = CURRENT_TIMESTAMP
          WHERE phone = ?
            AND tenant_id = ?
        `)
        .bind(
          state,
          JSON.stringify(
            data || {}
          ),
          phone,
          TENANT_ID
        )
        .run();
    }

    // =========================================================
    // GET OR CREATE RESIDENT
    // =========================================================

    async function getOrCreateResident(
      phone,
      name = null
    ) {
      let resident =
        await env.DB
          .prepare(`
            SELECT *
            FROM residents
            WHERE tenant_id = ?
              AND phone = ?
            LIMIT 1
          `)
          .bind(
            TENANT_ID,
            phone
          )
          .first();

      if (resident) {
        if (
          name &&
          String(name).trim() &&
          resident.name !== name
        ) {
          await env.DB
            .prepare(`
              UPDATE residents
              SET name = ?
              WHERE id = ?
            `)
            .bind(
              name,
              resident.id
            )
            .run();

          resident.name =
            name;
        }

        return resident;
      }

      const insert =
        await env.DB
          .prepare(`
            INSERT INTO residents
            (
              tenant_id,
              ward_id,
              name,
              phone,
              created_at
            )
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          `)
          .bind(
            TENANT_ID,
            WARD_ID,
            name,
            phone
          )
          .run();

      const residentId =
        insert.meta?.last_row_id ||
        null;

      if (!residentId) {
        return null;
      }

      return await env.DB
        .prepare(`
          SELECT *
          FROM residents
          WHERE id = ?
          LIMIT 1
        `)
        .bind(residentId)
        .first();
    }

    // =========================================================
    // CREATE REPORT FROM WHATSAPP
    // =========================================================

    async function createWhatsAppReport(
      data,
      phone
    ) {
      const categoryId =
        Number(data.category_id);

      const description =
        String(
          data.description || ""
        ).trim();

      const location =
        String(
          data.location || ""
        ).trim();

      const residentName =
        String(
          data.name || ""
        ).trim();

      if (
        !categoryId ||
        !description ||
        !location ||
        !residentName
      ) {
        throw new Error(
          "Incomplete WhatsApp report data"
        );
      }

      const category =
        await env.DB
          .prepare(`
            SELECT *
            FROM categories
            WHERE id = ?
            LIMIT 1
          `)
          .bind(categoryId)
          .first();

      if (!category) {
        throw new Error(
          "Category not found"
        );
      }

      const categoryName =
        String(
          category.name ||
          category.category_name ||
          ""
        );

      const emergency =
        category.emergency === 1 ||
        category.emergency === true;

      let priority =
        "Normal";

      if (emergency) {
        priority =
          "Emergency";
      } else if (
        String(
          data.urgency || ""
        ).toLowerCase() ===
        "urgent"
      ) {
        priority =
          "Urgent";
      } else if (
        String(
          data.urgency || ""
        ).toLowerCase() ===
        "emergency"
      ) {
        priority =
          "Emergency";
      }

      let departmentId =
        5;

      const categoryNameLower =
        categoryName.toLowerCase();

      if (
        categoryNameLower.includes(
          "electric"
        ) ||
        categoryNameLower.includes(
          "power"
        )
      ) {
        departmentId = 1;

      } else if (
        categoryNameLower.includes(
          "water"
        ) ||
        categoryNameLower.includes(
          "drain"
        ) ||
        categoryNameLower.includes(
          "sewer"
        )
      ) {
        departmentId = 2;

      } else if (
        categoryNameLower.includes(
          "road"
        ) ||
        categoryNameLower.includes(
          "pothole"
        ) ||
        categoryNameLower.includes(
          "storm"
        )
      ) {
        departmentId = 3;

      } else if (
        categoryNameLower.includes(
          "waste"
        ) ||
        categoryNameLower.includes(
          "dump"
        ) ||
        categoryNameLower.includes(
          "rubbish"
        )
      ) {
        departmentId = 4;
      }

      let departmentName =
        null;

      const department =
        await env.DB
          .prepare(`
            SELECT *
            FROM departments
            WHERE id = ?
            LIMIT 1
          `)
          .bind(departmentId)
          .first();

      if (department) {
        departmentName =
          department.name ||
          department.department_name ||
          null;
      }

      const existing =
        await env.DB
          .prepare(`
            SELECT COUNT(*) AS total
            FROM reports
          `)
          .first();

      const nextNumber =
        Number(
          existing?.total || 0
        ) + 1;

      const reference =
        "SBS-AX-" +
        String(nextNumber)
          .padStart(6, "0");

      const resident =
        await getOrCreateResident(
          phone,
          residentName
        );

      const insert =
        await env.DB
          .prepare(`
            INSERT INTO reports
            (
              name,
              category,
              location,
              description,
              status,
              tenant_id,
              ward_id,
              department_id,
              reference_number,
              priority,
              escalation_status,
              assigned_department_id,
              source
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            residentName,
            categoryName,
            location,
            description,
            "New",
            TENANT_ID,
            WARD_ID,
            departmentId,
            reference,
            priority,
            "Not Escalated",
            departmentId,
            "WhatsApp"
          )
          .run();

      const reportId =
        insert.meta?.last_row_id ||
        null;

      if (reportId) {
        try {
          await env.DB
            .prepare(`
              INSERT INTO report_updates
              (
                report_id,
                status,
                comment
              )
              VALUES (?, ?, ?)
            `)
            .bind(
              reportId,
              "New",
              "Report created via WhatsApp"
            )
            .run();

        } catch (historyError) {
          console.error(
            "WhatsApp report history error:",
            historyError
          );
        }
      }

      return {
        reportId,
        reference,
        categoryName,
        departmentName,
        priority,
        residentId:
          resident?.id || null
      };
    }

    // =========================================================
    // WHATSAPP CATEGORY MENU
    // =========================================================

    async function sendCategoryMenu(
      phone
    ) {
      const result =
        await env.DB
          .prepare(`
            SELECT id, name, emergency
            FROM categories
            WHERE status = 'Active'
               OR status IS NULL
            ORDER BY id ASC
          `)
          .all();

      const categories =
        result.results || [];

      if (!categories.length) {
        await sendWhatsAppMessage(
          phone,
          "Sorry, the service categories are currently unavailable. Please try again later."
        );

        return;
      }

      let message =
        "🏘️ *Sky Blue Community Service Centre*\n\n" +
        "Please select the category of your report by replying with the number:\n\n";

      for (const category of categories) {
        message +=
          `${category.id}. ${category.name}`;

        if (
          category.emergency === 1 ||
          category.emergency === true
        ) {
          message +=
            " 🚨";
        }

        message +=
          "\n";
      }

      message +=
        "\nReply *CANCEL* at any time to cancel.";

      await sendWhatsAppMessage(
        phone,
        message
      );
    }

    // =========================================================
    // WHATSAPP CONVERSATION ENGINE
    // =========================================================

    async function processWhatsAppMessage(
      phone,
      messageText
    ) {
      const text =
        String(
          messageText || ""
        ).trim();

      const lower =
        text.toLowerCase();

      let conversation =
        await getConversation(
          phone
        );

      if (!conversation) {
        conversation =
          await createConversation(
            phone
          );
      }

      let data = {};

      try {
        data =
          conversation.data
            ? JSON.parse(
                conversation.data
              )
            : {};
      } catch {
        data = {};
      }

      if (
        lower === "cancel" ||
        lower === "stop" ||
        lower === "reset"
      ) {
        await updateConversation(
          phone,
          "start",
          {}
        );

        await sendWhatsAppMessage(
          phone,
          "Your report has been cancelled.\n\nSend *Hi* whenever you are ready to report a community service issue."
        );

        return;
      }

      if (
        conversation.state === "start" ||
        lower === "hi" ||
        lower === "hello" ||
        lower === "hey" ||
        lower === "start" ||
        lower === "report"
      ) {
        await updateConversation(
          phone,
          "awaiting_category",
          {}
        );

        await sendWhatsAppMessage(
          phone,
          "Welcome to *Sky Blue Community Service Centre*.\n\nI can help you report a community service issue and provide you with a reference number."
        );

        await sendCategoryMenu(
          phone
        );

        return;
      }

      if (
        conversation.state ===
        "awaiting_category"
      ) {
        const categoryId =
          Number(text);

        if (
          !categoryId ||
          !Number.isInteger(
            categoryId
          )
        ) {
          await sendWhatsAppMessage(
            phone,
            "Please reply with the *number* of the category you want to report.\n\nExample: *5*"
          );

          return;
        }

        const category =
          await env.DB
            .prepare(`
              SELECT *
              FROM categories
              WHERE id = ?
              LIMIT 1
            `)
            .bind(categoryId)
            .first();

        if (!category) {
          await sendWhatsAppMessage(
            phone,
            "That category number is not valid. Please choose a number from the category list."
          );

          return;
        }

        data.category_id =
          category.id;

        data.category_name =
          category.name;

        if (
          category.emergency === 1 ||
          category.emergency === true
        ) {
          data.urgency =
            "Emergency";
        }

        await updateConversation(
          phone,
          "awaiting_description",
          data
        );

        await sendWhatsAppMessage(
          phone,
          `You selected *${category.name}*.\n\nPlease describe the problem in as much detail as possible.`
        );

        return;
      }

      if (
        conversation.state ===
        "awaiting_description"
      ) {
        if (text.length < 3) {
          await sendWhatsAppMessage(
            phone,
            "Please provide a little more detail about the problem."
          );

          return;
        }

        data.description =
          text;

        await updateConversation(
          phone,
          "awaiting_location",
          data
        );

        await sendWhatsAppMessage(
          phone,
          "Thank you.\n\nNow send the *location/address* where the problem is happening."
        );

        return;
      }

      if (
        conversation.state ===
        "awaiting_location"
      ) {
        if (text.length < 3) {
          await sendWhatsAppMessage(
            phone,
            "Please provide the location or address so the issue can be routed correctly."
          );

          return;
        }

        data.location =
          text;

        await updateConversation(
          phone,
          "awaiting_name",
          data
        );

        await sendWhatsAppMessage(
          phone,
          "Almost done.\n\nPlease enter your *full name*."
        );

        return;
      }

      if (
        conversation.state ===
        "awaiting_name"
      ) {
        if (text.length < 2) {
          await sendWhatsAppMessage(
            phone,
            "Please enter your full name."
          );

          return;
        }

        data.name =
          text;

        await updateConversation(
          phone,
          "awaiting_confirmation",
          data
        );

        const confirmation =
          "Please check your report:\n\n" +
          `*Category:* ${data.category_name}\n` +
          `*Problem:* ${data.description}\n` +
          `*Location:* ${data.location}\n` +
          `*Name:* ${data.name}\n\n` +
          "Reply *YES* to submit or *CANCEL* to start again.";

        await sendWhatsAppMessage(
          phone,
          confirmation
        );

        return;
      }

      if (
        conversation.state ===
        "awaiting_confirmation"
      ) {
        if (
          lower !== "yes" &&
          lower !== "y" &&
          lower !== "confirm"
        ) {
          await sendWhatsAppMessage(
            phone,
            "Please reply *YES* to submit your report or *CANCEL* to cancel it."
          );

          return;
        }

        try {
          const report =
            await createWhatsAppReport(
              data,
              phone
            );

          await updateConversation(
            phone,
            "start",
            {}
          );

          let confirmationMessage =
            "✅ *Report submitted successfully!*\n\n" +
            `*Reference:* ${report.reference}\n` +
            `*Category:* ${report.categoryName}\n` +
            `*Priority:* ${report.priority}\n` +
            `*Status:* New`;

          if (
            report.departmentName
          ) {
            confirmationMessage +=
              `\n*Department:* ${report.departmentName}`;
          }

          confirmationMessage +=
            "\n\nKeep your reference number for future follow-up.\n\n" +
            "Send *Hi* if you need to submit another report.";

          if (
            report.priority ===
            "Emergency"
          ) {
            confirmationMessage +=
              "\n\n🚨 This report is marked as an emergency category. If there is immediate danger to life or safety, contact the appropriate emergency service directly.";
          }

          await sendWhatsAppMessage(
            phone,
            confirmationMessage
          );

        } catch (error) {
          console.error(
            "WhatsApp report creation failed:",
            error
          );

          await sendWhatsAppMessage(
            phone,
            "Sorry, we could not submit your report right now. Please try again shortly."
          );
        }

        return;
      }

      await updateConversation(
        phone,
        "start",
        {}
      );

      await sendWhatsAppMessage(
        phone,
        "I didn't understand that message.\n\nSend *Hi* to start a new community service report."
      );
    }

    // =========================================================
    // WHATSAPP WEBHOOK RECEIVER
    // =========================================================
    // =========================================================
    // WHATSAPP WEBHOOK RECEIVER
    // =========================================================

    if (
      url.pathname === "/api/whatsapp" &&
      request.method === "POST"
    ) {
      try {
        const body =
          await request.json();

        console.log(
          "WhatsApp webhook received:",
          JSON.stringify(body)
        );

        /*
          Initialise the industry WhatsApp router.

          This creates the mapping table used to identify
          which SaaS business/product owns an incoming
          WhatsApp number.
        */

        await ensureIndustryWhatsAppRouterTables(
          env
        );

        const entries =
          body?.entry || [];

        for (const entry of entries) {
          const changes =
            entry?.changes || [];

          for (const change of changes) {
            const value =
              change?.value;

            if (!value) {
              continue;
            }

            /*
              First give the message to the new
              industry WhatsApp router.

              If the WhatsApp phone number belongs to
              a SaaS industry account, the router handles
              the conversation.

              If no industry mapping exists, handled=false
              and the existing Community Service Centre
              system continues below.
            */

            let industryResult = null;

            try {
              industryResult =
                await processIndustryWhatsAppValue(
                  env,
                  value
                );

              console.log(
                "Industry WhatsApp result:",
                JSON.stringify(
                  industryResult
                )
              );

            } catch (industryError) {
              console.error(
                "Industry WhatsApp router error:",
                industryError
              );

              industryResult = {
                success: false,
                handled: false,
                error:
                  String(
                    industryError
                  )
              };
            }


            /*
              If the industry router handled the message,
              do NOT send it through the old civic workflow.

              This prevents salon, church, pharmacy,
              laundry, school, etc. messages from being
              incorrectly treated as community reports.
            */

            if (
              industryResult &&
              industryResult.handled === true
            ) {
              continue;
            }


            /*
              EXISTING COMMUNITY SERVICE CENTRE
              WHATSAPP WORKFLOW

              This remains intact.

              Only messages that are not mapped to an
              industry SaaS account reach this workflow.
            */

            const messages =
              value.messages || [];

            for (const message of messages) {
              const from =
                message?.from;

              if (!from) {
                continue;
              }

              if (
                message.type === "text" &&
                message.text?.body
              ) {
                await processWhatsAppMessage(
                  from,
                  message.text.body
                );

              } else {
                await sendWhatsAppMessage(
                  from,
                  "Please send your report information as a text message. Send *Hi* to start."
                );
              }
            }
          }
        }

        return new Response(
          "EVENT_RECEIVED",
          {
            status: 200
          }
        );

      } catch (error) {
        console.error(
          "WhatsApp webhook error:",
          error
        );

        /*
          Always acknowledge the Meta webhook.

          This prevents unnecessary webhook retries
          while the error is logged for investigation.
        */

        return new Response(
          "EVENT_RECEIVED",
          {
            status: 200
          }
        );
      }
    }
                

    // =========================================================
    // CATEGORIES
    // =========================================================

    if (
      url.pathname ===
        "/api/categories" &&
      request.method === "GET"
    ) {
      try {
        const result =
          await env.DB
            .prepare(`
              SELECT *
              FROM categories
              ORDER BY id ASC
            `)
            .all();

        return json(
          result.results || []
        );

      } catch (error) {
        return json({
          success: false,
          error:
            "Unable to load categories",
          details:
            String(error)
        }, 500);
      }
    }

    // =========================================================
    // DEPARTMENTS
    // =========================================================

    if (
      url.pathname ===
        "/api/departments" &&
      request.method === "GET"
    ) {
      try {
        const result =
          await env.DB
            .prepare(`
              SELECT *
              FROM departments
              ORDER BY id ASC
            `)
            .all();

        return json(
          result.results || []
        );

      } catch (error) {
        return json({
          success: false,
          error:
            "Unable to load departments",
          details:
            String(error)
        }, 500);
      }
    }

    // =========================================================
    // WEB REPORT CREATION
    // =========================================================

    if (
      url.pathname ===
        "/api/report" &&
      request.method === "POST"
    ) {
      try {
        const body =
          await request.json();

        const categoryId =
          body.category_id
            ? Number(
                body.category_id
              )
            : null;

        const description =
          body.description ||
          body.issue ||
          body.message ||
          "";

        const location =
          body.location ||
          body.address ||
          "";

        const residentName =
          body.resident_name ||
          body.name ||
          "";

        const residentPhone =
          body.resident_phone ||
          body.phone ||
          "";

        const requestedUrgency =
          body.urgency ||
          "Normal";

        if (!categoryId) {
          return json({
            success: false,
            error:
              "category_id is required"
          }, 400);
        }

        if (!residentName) {
          return json({
            success: false,
            error:
              "name is required"
          }, 400);
        }

        if (!description) {
          return json({
            success: false,
            error:
              "description is required"
          }, 400);
        }

        if (!location) {
          return json({
            success: false,
            error:
              "location is required"
          }, 400);
        }

        const category =
          await env.DB
            .prepare(`
              SELECT *
              FROM categories
              WHERE id = ?
              LIMIT 1
            `)
            .bind(categoryId)
            .first();

        if (!category) {
          return json({
            success: false,
            error:
              "Category not found"
          }, 404);
        }

        const categoryName =
          String(
            category.name ||
            category.category_name ||
            ""
          );

        const emergency =
          category.emergency === 1 ||
          category.emergency === true;

        let priority =
          "Normal";

        if (emergency) {
          priority =
            "Emergency";
        } else if (
          String(
            requestedUrgency
          ).toLowerCase() ===
          "urgent"
        ) {
          priority =
            "Urgent";
        } else if (
          String(
            requestedUrgency
          ).toLowerCase() ===
          "emergency"
        ) {
          priority =
            "Emergency";
        }

        let departmentId =
          null;

        let departmentName =
          null;

        const categoryNameLower =
          categoryName.toLowerCase();

        if (
          categoryNameLower.includes(
            "electric"
          ) ||
          categoryNameLower.includes(
            "power"
          )
        ) {
          departmentId = 1;

        } else if (
          categoryNameLower.includes(
            "water"
          ) ||
          categoryNameLower.includes(
            "drain"
          ) ||
          categoryNameLower.includes(
            "sewer"
          )
        ) {
          departmentId = 2;

        } else if (
          categoryNameLower.includes(
            "road"
          ) ||
          categoryNameLower.includes(
            "pothole"
          ) ||
          categoryNameLower.includes(
            "storm"
          )
        ) {
          departmentId = 3;

        } else if (
          categoryNameLower.includes(
            "waste"
          ) ||
          categoryNameLower.includes(
            "dump"
          ) ||
          categoryNameLower.includes(
            "rubbish"
          )
        ) {
          departmentId = 4;

        } else {
          departmentId = 5;
        }

        if (departmentId) {
          const department =
            await env.DB
              .prepare(`
                SELECT *
                FROM departments
                WHERE id = ?
                LIMIT 1
              `)
              .bind(departmentId)
              .first();

          if (department) {
            departmentName =
              department.name ||
              department.department_name ||
              null;
          }
        }

        const existing =
          await env.DB
            .prepare(`
              SELECT COUNT(*) AS total
              FROM reports
            `)
            .first();

        const nextNumber =
          Number(
            existing?.total || 0
          ) + 1;

        const reference =
          "SBS-AX-" +
          String(nextNumber)
            .padStart(6, "0");

        const insert =
          await env.DB
            .prepare(`
              INSERT INTO reports
              (
                name,
                category,
                location,
                description,
                status,
                tenant_id,
                ward_id,
                department_id,
                reference_number,
                priority,
                escalation_status,
                assigned_department_id,
                source
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
              residentName,
              categoryName,
              location,
              description,
              "New",
              TENANT_ID,
              WARD_ID,
              departmentId,
              reference,
              priority,
              "Not Escalated",
              departmentId,
              "Web"
            )
            .run();

        const reportId =
          insert.meta?.last_row_id ||
          null;

        if (reportId) {
          try {
            await env.DB
              .prepare(`
                INSERT INTO report_updates
                (
                  report_id,
                  status,
                  comment
                )
                VALUES (?, ?, ?)
              `)
              .bind(
                reportId,
                "New",
                "Report created"
              )
              .run();

          } catch (historyError) {
            console.error(
              "Report history error:",
              historyError
            );
          }
        }

        return json({
          success: true,
          message:
            "Report created successfully",
          report_id:
            reportId,
          reference_number:
            reference,
          category:
            categoryName,
          department:
            departmentName,
          priority,
          status:
            "New",
          source:
            "Web",
          phone_received:
            Boolean(
              residentPhone
            )
        }, 201);

      } catch (error) {
        console.error(
          "Report creation error:",
          error
        );

        return json({
          success: false,
          error:
            "Unable to create report",
          details:
            String(error)
        }, 500);
      }
    }

    // =========================================================
    // GET ALL REPORTS
    // =========================================================

    if (
      url.pathname ===
        "/api/reports" &&
      request.method === "GET"
    ) {
      try {
        const result =
          await env.DB
            .prepare(`
              SELECT *
              FROM reports
              ORDER BY id DESC
            `)
            .all();

        return json(
          result.results || []
        );

      } catch (error) {
        return json({
          success: false,
          error:
            "Unable to load reports",
          details:
            String(error)
        }, 500);
      }
    }

    // =========================================================
    // GET SINGLE REPORT
    // =========================================================

    if (
      url.pathname.startsWith(
        "/api/reports/"
      ) &&
      request.method === "GET"
    ) {
      try {
        const id =
          Number(
            url.pathname
              .split("/")
              .pop()
          );

        if (!id) {
          return json({
            success: false,
            error:
              "Invalid report ID"
          }, 400);
        }

        const report =
          await env.DB
            .prepare(`
              SELECT *
              FROM reports
              WHERE id = ?
              LIMIT 1
            `)
            .bind(id)
            .first();

        if (!report) {
          return json({
            success: false,
            error:
              "Report not found"
          }, 404);
        }

        let updates = [];

        try {
          const history =
            await env.DB
              .prepare(`
                SELECT *
                FROM report_updates
                WHERE report_id = ?
                ORDER BY id ASC
              `)
              .bind(id)
              .all();

          updates =
            history.results || [];

        } catch (historyError) {
          console.error(
            "Unable to load report history:",
            historyError
          );
        }

        return json({
          success: true,
          report,
          updates
        });

      } catch (error) {
        return json({
          success: false,
          error:
            "Unable to load report",
          details:
            String(error)
        }, 500);
      }
    }

    // =========================================================
    // UPDATE REPORT
    // =========================================================

    if (
      url.pathname.startsWith(
        "/api/reports/"
      ) &&
      request.method === "PATCH"
    ) {
      try {
        const id =
          Number(
            url.pathname
              .split("/")
              .pop()
          );

        if (!id) {
          return json({
            success: false,
            error:
              "Invalid report ID"
          }, 400);
        }

        const body =
          await request.json();

        const existing =
          await env.DB
            .prepare(`
              SELECT *
              FROM reports
              WHERE id = ?
              LIMIT 1
            `)
            .bind(id)
            .first();

        if (!existing) {
          return json({
            success: false,
            error:
              "Report not found"
          }, 404);
        }

        const newStatus =
          body.status ||
          existing.status;

        const newPriority =
          body.priority ||
          existing.priority;

        const newDepartmentId =
          body.department_id !==
          undefined
            ? Number(
                body.department_id
              ) || null
            : existing.assigned_department_id;

        const resolutionNotes =
          body.resolution_notes !==
          undefined
            ? body.resolution_notes
            : existing.resolution_notes;

        const comment =
          body.comment ||
          body.update ||
          "";

        let resolvedAt =
          existing.resolved_at;

        if (
          newStatus ===
          "Resolved"
        ) {
          resolvedAt =
            existing.resolved_at ||
            new Date().toISOString();

        } else {
          resolvedAt =
            null;
        }

        await env.DB
          .prepare(`
            UPDATE reports
            SET
              status = ?,
              priority = ?,
              assigned_department_id = ?,
              resolution_notes = ?,
              resolved_at = ?
            WHERE id = ?
          `)
          .bind(
            newStatus,
            newPriority,
            newDepartmentId,
            resolutionNotes,
            resolvedAt,
            id
          )
          .run();

        if (
          comment ||
          newStatus !==
            existing.status
        ) {
          try {
            await env.DB
              .prepare(`
                INSERT INTO report_updates
                (
                  report_id,
                  status,
                  comment
                )
                VALUES (?, ?, ?)
              `)
              .bind(
                id,
                newStatus,
                comment ||
                  "Status changed to " +
                  newStatus
              )
              .run();

          } catch (historyError) {
            console.error(
              "Update history error:",
              historyError
            );
          }
        }

        const updated =
          await env.DB
            .prepare(`
              SELECT *
              FROM reports
              WHERE id = ?
              LIMIT 1
            `)
            .bind(id)
            .first();

        return json({
          success: true,
          message:
            "Report updated successfully",
          report:
            updated
        });

      } catch (error) {
        console.error(
          "Report update error:",
          error
        );

        return json({
          success: false,
          error:
            "Unable to update report",
          details:
            String(error)
        }, 500);
      }
    }

    // =========================================================
    // SERVE WEBSITE FILES FROM PUBLIC
    // =========================================================

    if (
      !url.pathname.startsWith(
        "/api"
      )
    ) {
      if (env.ASSETS) {
        return env.ASSETS.fetch(
          request
        );
      }

      return new Response(
        "Website assets are not configured.",
        {
          status: 500,
          headers: {
            "Content-Type":
              "text/plain"
          }
        }
      );
    }

    // =========================================================
    // UNKNOWN API ENDPOINT
    // =========================================================

    return json({
      success: false,
      error:
        "Endpoint not found"
    }, 404);
  }
};
