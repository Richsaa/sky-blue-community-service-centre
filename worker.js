export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const TENANT_ID = 1;
    const WARD_ID = 1;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
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

    // ---------------------------------------------------------
    // INITIALISE MODULE ENGINE
    // ---------------------------------------------------------

    try {
      await ensureSaaSModuleTables();
    } catch (error) {
      console.error(
        "SaaS module engine initialisation error:",
        error
      );
    }

    // ---------------------------------------------------------
    // PUBLIC SAAS MODULE CATALOGUE
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // OWNER SAAS MODULE CATALOGUE
    // ---------------------------------------------------------

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

    function base64ToBytes(base
