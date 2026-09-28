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
           
