import {
  processIndustryWhatsAppMessage
} from "./Industry-whatsapp-conversations.js";

import {
  sendSaaSWhatsAppMessage
} from "./whatsapp-engine.js";

const COMMUNITY_MODULE = "community-service-centre";


/* =========================================================
   NORMALISE PHONE
========================================================= */

function normalisePhone(phone) {
  if (!phone) return "";

  return String(phone)
    .trim()
    .replace(/[^\d+]/g, "");
}


/* =========================================================
   ENSURE WHATSAPP ACCOUNT TABLE
========================================================= */

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


/* =========================================================
   REGISTER WHATSAPP ACCOUNT
========================================================= */

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

  const existing =
    await env.DB.prepare(`
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

  const result =
    await env.DB.prepare(`
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


/* =========================================================
   RESOLVE WHATSAPP ACCOUNT
========================================================= */

export async function resolveIndustryWhatsAppAccount(
  env,
  phoneNumberId
) {
  await ensureIndustryWhatsAppRouterTables(env);

  if (!phoneNumberId) {
    return null;
  }

  return await env.DB.prepare(`
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
}


/* =========================================================
   CHECK MESSAGE TYPE
========================================================= */

export function isIndustryWhatsAppMessage(message) {
  if (!message) {
    return false;
  }

  if (!message.from) {
    return false;
  }

  return (
    message.type === "text" ||
    message.type === "interactive" ||
    message.type === "button"
  );
}


/* =========================================================
   EXTRACT MESSAGE TEXT
========================================================= */

export function extractWhatsAppMessageText(message) {
  if (!message) {
    return "";
  }

  if (message.type === "text") {
    return String(
      message.text?.body || ""
    ).trim();
  }

  if (message.type === "button") {
    return String(
      message.button?.text ||
      message.button?.payload ||
      ""
    ).trim();
  }

  if (message.type === "interactive") {
    const interactive =
      message.interactive || {};

    if (
      interactive.type ===
      "button_reply"
    ) {
      return String(
        interactive.button_reply?.title ||
        interactive.button_reply?.id ||
        ""
      ).trim();
    }

    if (
      interactive.type ===
      "list_reply"
    ) {
      return String(
        interactive.list_reply?.title ||
        interactive.list_reply?.id ||
        ""
      ).trim();
    }
  }

  return "";
}


/* =========================================================
   PROCESS ONE INDUSTRY MESSAGE
========================================================= */

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
      error:
        "SaaS account could not be identified"
    };
  }

  if (!moduleCode) {
    return {
      success: false,
      handled: false,
      error:
        "SaaS module could not be identified"
    };
  }

  const cleanPhone =
    normalisePhone(phone);

  if (!cleanPhone) {
    return {
      success: false,
      handled: false,
      error:
        "WhatsApp phone number is missing"
    };
  }

  if (!messageText) {
    return {
      success: false,
      handled: false,
      error:
        "WhatsApp message text is empty"
    };
  }


  /*
    Community Service Centre remains on
    the existing civic WhatsApp workflow.
  */

  if (
    String(moduleCode).toLowerCase() ===
    COMMUNITY_MODULE
  ) {
    return {
      success: true,
      handled: false,
      legacy: true,
      module_code:
        COMMUNITY_MODULE
    };
  }


  /*
    Send the message into the industry
    conversation engine.
  */

  const conversation =
    await processIndustryWhatsAppMessage(
      env,
      {
        accountId: Number(accountId),
        moduleCode: String(moduleCode),
        phone: cleanPhone,
        message: String(messageText),
        profileName:
          profileName || "",
        messageId:
          messageId || null,
        timestamp:
          timestamp || null
      }
    );


  if (!conversation) {
    return {
      success: false,
      handled: true,
      error:
        "Industry conversation engine returned no response"
    };
  }


  /*
    Send the industry response back
    through the shared WhatsApp engine.
  */

  let sendResult = null;

  if (conversation.message) {
    try {
      sendResult =
        await sendSaaSWhatsAppMessage(
          env,
          {
            accountId:
              Number(accountId),
            moduleCode:
              String(moduleCode),
            phone:
              cleanPhone,
            message:
              conversation.message,
            messageType:
              "text"
          }
        );
    } catch (error) {
      sendResult = {
        success: false,
        error:
          error?.message ||
          String(error)
      };
    }
  }


  return {
    success: true,
    handled: true,
    account_id:
      Number(accountId),
    module_code:
      String(moduleCode),
    phone:
      cleanPhone,
    conversation,
    send:
      sendResult
  };
}


/* =========================================================
   PROCESS META WHATSAPP WEBHOOK VALUE
========================================================= */

export async function processIndustryWhatsAppValue(
  env,
  value
) {
  if (!value) {
    return {
      success: false,
      handled: false,
      error:
        "WhatsApp webhook value is missing"
    };
  }

  const metadata =
    value.metadata || {};

  const phoneNumberId =
    metadata.phone_number_id ||
    null;


  /*
    Find the SaaS business/product
    attached to this WhatsApp number.
  */

  const account =
    await resolveIndustryWhatsAppAccount(
      env,
      phoneNumberId
    );


  /*
    No mapping means this is not currently
    an industry SaaS WhatsApp number.

    The existing Community Service Centre
    workflow can continue handling it.
  */

  if (!account) {
    return {
      success: true,
      handled: false,
      reason:
        "No SaaS WhatsApp account mapping found",
      phone_number_id:
        phoneNumberId
    };
  }


  const contacts =
    value.contacts || [];

  const messages =
    value.messages || [];

  let processed = 0;
  let ignored = 0;

  const results = [];


  for (const message of messages) {

    if (
      !isIndustryWhatsAppMessage(
        message
      )
    ) {
      ignored++;
      continue;
    }


    const phone =
      message.from ||
      contacts?.[0]?.wa_id ||
      "";


    const profileName =
      contacts?.[0]?.profile?.name ||
      "";


    const messageText =
      extractWhatsAppMessageText(
        message
      );


    if (!messageText) {
      ignored++;
      continue;
    }


    const result =
      await processIndustryWhatsAppWebhook(
        env,
        {
          accountId:
            account.account_id,

          moduleCode:
            account.module_code,

          phone,

          messageText,

          messageId:
            message.id || null,

          timestamp:
            message.timestamp || null,

          profileName
        }
      );


    results.push(result);


    if (
      result &&
      result.handled === true
    ) {
      processed++;
    } else {
      ignored++;
    }
  }


  return {
    success: true,

    handled:
      processed > 0,

    account_id:
      account.account_id,

    module_code:
      account.module_code,

    phone_number_id:
      phoneNumberId,

    processed,

    ignored,

    results
  };
}


/* =========================================================
   LIST WHATSAPP ACCOUNT MAPPINGS
========================================================= */

export async function getIndustryWhatsAppAccounts(
  env,
  accountId = null
) {
  await ensureIndustryWhatsAppRouterTables(
    env
  );

  if (accountId) {
    const result =
      await env.DB.prepare(`
        SELECT
          id,
          account_id,
          module_code,
          phone_number_id,
          display_phone_number,
          business_name,
          active,
          created_at,
          updated_at
        FROM saas_whatsapp_accounts
        WHERE account_id = ?
        ORDER BY id DESC
      `)
        .bind(Number(accountId))
        .all();

    return result.results || [];
  }


  const result =
    await env.DB.prepare(`
      SELECT
        id,
        account_id,
        module_code,
        phone_number_id,
        display_phone_number,
        business_name,
        active,
        created_at,
        updated_at
      FROM saas_whatsapp_accounts
      ORDER BY id DESC
    `)
      .all();

  return result.results || [];
}


/* =========================================================
   DEACTIVATE WHATSAPP ACCOUNT
========================================================= */

export async function deactivateIndustryWhatsAppAccount(
  env,
  id
) {
  await ensureIndustryWhatsAppRouterTables(
    env
  );

  if (!id) {
    throw new Error(
      "WhatsApp account mapping ID is required"
    );
  }

  await env.DB.prepare(`
    UPDATE saas_whatsapp_accounts
    SET
      active = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
    .bind(Number(id))
    .run();

  return {
    success: true,
    id: Number(id),
    active: false
  };
}


/* =========================================================
   REACTIVATE WHATSAPP ACCOUNT
========================================================= */

export async function reactivateIndustryWhatsAppAccount(
  env,
  id
) {
  await ensureIndustryWhatsAppRouterTables(
    env
  );

  if (!id) {
    throw new Error(
      "WhatsApp account mapping ID is required"
    );
  }

  await env.DB.prepare(`
    UPDATE saas_whatsapp_accounts
    SET
      active = 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
    .bind(Number(id))
    .run();

  return {
    success: true,
    id: Number(id),
    active: true
  };
}


/* =========================================================
   ROUTER STATUS
========================================================= */

export async function getIndustryWhatsAppRouterStatus(
  env
) {
  try {
    await ensureIndustryWhatsAppRouterTables(
      env
    );

    const result =
      await env.DB.prepare(`
        SELECT COUNT(*) AS total
        FROM saas_whatsapp_accounts
        WHERE active = 1
      `)
        .first();

    return {
      success: true,
      active_accounts:
        Number(
          result?.total || 0
        )
    };

  } catch (error) {
    return {
      success: false,
      active_accounts: 0,
      error:
        error?.message ||
        String(error)
    };
  }
}
