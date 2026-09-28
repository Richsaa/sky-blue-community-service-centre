import {
  getIndustryWhatsAppConfig,
  processIndustryWhatsAppMessage
} from "./industry-whatsapp-conversations.js";

import {
  sendSaaSWhatsAppMessage,
  recordWhatsAppMessage,
  createOrUpdateWhatsAppContact
} from "./whatsapp-engine.js";

/*
  SKY BLUE SOLUTION
  INDUSTRY WHATSAPP ROUTER

  Purpose:
  Connect incoming WhatsApp messages to the correct SaaS industry.

  Flow:

  WhatsApp
      ↓
  Webhook
      ↓
  Industry Router
      ↓
  Correct SaaS Module
      ↓
  Industry Conversation Engine
      ↓
  Correct WhatsApp Response
*/


const COMMUNITY_MODULE = "community-service-centre";


/* ---------------------------------------------------------
   NORMALISE PHONE
--------------------------------------------------------- */

function normalisePhone(phone) {
  if (!phone) return "";

  return String(phone)
    .trim()
    .replace(/[^\d+]/g, "");
}


/* ---------------------------------------------------------
   ENSURE ROUTER TABLES
--------------------------------------------------------- */

export async function ensureIndustryWhatsAppRouterTables(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS saas_whatsapp_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      module_code TEXT NOT NULL,
      phone_number_id TEXT NOT NULL UNIQUE,
      display_phone_number TEXT,
      business_name TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_saas_whatsapp_accounts_account
    ON saas_whatsapp_accounts(account_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_saas_whatsapp_accounts_module
    ON saas_whatsapp_accounts(module_code)
  `).run();

  return true;
}


/* ---------------------------------------------------------
   REGISTER WHATSAPP ACCOUNT
--------------------------------------------------------- */

export async function registerIndustryWhatsAppAccount(
  env,
  {
    accountId,
    moduleCode,
    phoneNumberId,
    displayPhoneNumber = "",
    businessName = ""
  }
) {
  await ensureIndustryWhatsAppRouterTables(env);

  if (!accountId) {
    throw new Error("accountId is required");
  }

  if (!moduleCode) {
    throw new Error("moduleCode is required");
  }

  if (!phoneNumberId) {
    throw new Error("phoneNumberId is required");
  }

  const existing = await env.DB.prepare(`
    SELECT id
    FROM saas_whatsapp_accounts
    WHERE phone_number_id = ?
    LIMIT 1
  `)
    .bind(String(phoneNumberId))
    .first();

  if (existing) {
    await env.DB.prepare(`
      UPDATE saas_whatsapp_accounts
      SET
        account_id = ?,
        module_code = ?,
        display_phone_number = ?,
        business_name = ?,
        active = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE phone_number_id = ?
    `)
      .bind(
        Number(accountId),
        String(moduleCode),
        String(displayPhoneNumber || ""),
        String(businessName || ""),
        String(phoneNumberId)
      )
      .run();

    return {
      success: true,
      updated: true,
      id: existing.id
    };
  }

  const result = await env.DB.prepare(`
    INSERT INTO saas_whatsapp_accounts (
      account_id,
      module_code,
      phone_number_id,
      display_phone_number,
      business_name,
      active
    )
    VALUES (?, ?, ?, ?, ?, 1)
  `)
    .bind(
      Number(accountId),
      String(moduleCode),
      String(phoneNumberId),
      String(displayPhoneNumber || ""),
      String(businessName || "")
    )
    .run();

  return {
    success: true,
    created: true,
    id: result.meta?.last_row_id || null
  };
}


/* ---------------------------------------------------------
   RESOLVE INCOMING WHATSAPP ACCOUNT
--------------------------------------------------------- */

export async function resolveIndustryWhatsAppAccount(
  env,
  phoneNumberId
) {
  await ensureIndustryWhatsAppRouterTables(env);

  if (!phoneNumberId) {
    return null;
  }

  const account = await env.DB.prepare(`
    SELECT
      id,
      account_id,
      module_code,
      phone_number_id,
      display_phone_number,
      business_name,
      active
    FROM saas_whatsapp_accounts
    WHERE phone_number_id = ?
      AND active = 1
    LIMIT 1
  `)
    .bind(String(phoneNumberId))
    .first();

  return account || null;
}


/* ---------------------------------------------------------
   CHECK IF MESSAGE IS AN INDUSTRY MESSAGE
--------------------------------------------------------- */

export function isIndustryWhatsAppMessage(message) {
  if (!message) return false;

  if (!message.from) return false;

  return Boolean(
    message.type === "text" ||
    message.type === "interactive" ||
    message.type === "button"
  );
}


/* ---------------------------------------------------------
   EXTRACT MESSAGE TEXT
--------------------------------------------------------- */

export function extractWhatsAppMessageText(message) {
  if (!message) return "";

  if (message.type === "text") {
    return String(message.text?.body || "").trim();
  }

  if (message.type === "button") {
    return String(
      message.button?.text ||
      message.button?.payload ||
      ""
    ).trim();
  }

  if (message.type === "interactive") {
    const interactive = message.interactive || {};

    if (interactive.type === "button_reply") {
      return String(
        interactive.button_reply?.title ||
        interactive.button_reply?.id ||
        ""
      ).trim();
    }

    if (interactive.type === "list_reply") {
      return String(
        interactive.list_reply?.title ||
        interactive.list_reply?.id ||
        ""
      ).trim();
    }
  }

  return "";
}


/* ---------------------------------------------------------
   PROCESS INDUSTRY MESSAGE
--------------------------------------------------------- */

export async function processIndustryWhatsAppWebhook(
  env,
  {
    accountId,
    moduleCode,
    phone,
    messageText,
    messageId = null,
    timestamp = null,
    profileName = ""
  }
) {
  if (!accountId) {
    return {
      success: false,
      handled: false,
      error: "SaaS account could not be identified"
    };
  }

  if (!moduleCode) {
    return {
      success: false,
      handled: false,
      error: "SaaS module could not be identified"
    };
  }

  const cleanPhone = normalisePhone(phone);

  if (!cleanPhone) {
    return {
      success: false,
      handled: false,
      error: "WhatsApp phone number is missing"
    };
  }

  if (!messageText) {
    return {
      success: false,
      handled: false,
      error: "WhatsApp message text is empty"
    };
  }


  /* -------------------------------------------------------
     COMMUNITY SERVICE CENTRE

     This is deliberately NOT processed here.

     The existing civic WhatsApp webhook remains responsible
     for Community Service Centre reporting.
  ------------------------------------------------------- */

  if (
    String(moduleCode).toLowerCase() ===
    COMMUNITY_MODULE
  ) {
    return {
      success: true,
      handled: false,
      legacy: true,
      module_code: COMMUNITY_MODULE
    };
  }


  /* -------------------------------------------------------
     SAVE / UPDATE WHATSAPP CONTACT
  ------------------------------------------------------- */

  try {
    await createOrUpdateWhatsAppContact(env, {
      accountId: Number(accountId),
      moduleCode: String(moduleCode),
      phone: cleanPhone,
      profileName: profileName || ""
    });
  } catch (error) {
    console.log(
      "WhatsApp contact save warning:",
      error?.message || error
    );
  }


  /* -------------------------------------------------------
     RECORD INCOMING MESSAGE
  ------------------------------------------------------- */

  try {
    await recordWhatsAppMessage(env, {
      accountId: Number(accountId),
      moduleCode: String(moduleCode),
      phone: cleanPhone,
      direction: "inbound",
      messageType: "text",
      message: messageText,
      externalMessageId: messageId,
      status: "received",
      metadata: {
        timestamp: timestamp || null,
        profile_name: profileName || ""
      }
    });
  } catch (error) {
    console.log(
      "WhatsApp inbound message record warning:",
      error?.message || error
    );
  }


  /* -------------------------------------------------------
     INDUSTRY CONVERSATION ENGINE
  ------------------------------------------------------- */

 
