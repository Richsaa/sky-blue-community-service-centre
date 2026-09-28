// whatsapp-engine.js
// Sky Blue Solution — Shared WhatsApp SaaS Engine
// Supports all 16 SaaS modules

const SAAS_WHATSAPP_MODULES = [
  "community-service-centre",
  "npo-ngo",
  "church-management",
  "ecommerce",
  "salon-barber",
  "laundry",
  "food-business",
  "wholesale-grocery",
  "driving-school",
  "school-management",
  "preschool-daycare",
  "pharmacy",
  "transport",
  "it-business",
  "building-materials",
  "other-services"
];

export async function ensureWhatsAppSaaSTables(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS saas_whatsapp_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      module_code TEXT,
      customer_id INTEGER,
      phone TEXT NOT NULL,
      name TEXT,
      email TEXT,
      whatsapp_name TEXT,
      opt_in INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      last_message_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, phone, module_code)
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS saas_whatsapp_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      module_code TEXT,
      contact_id INTEGER,
      customer_id INTEGER,
      phone TEXT NOT NULL,
      direction TEXT NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'text',
      message_body TEXT,
      external_message_id TEXT,
      delivery_status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS saas_whatsapp_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      module_code TEXT,
      template_name TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'en',
      category TEXT,
      body TEXT,
      meta_status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, template_name, language)
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS saas_whatsapp_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      module_code TEXT NOT NULL,
      contact_id INTEGER,
      customer_id INTEGER,
      phone TEXT NOT NULL,
      event_type TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      scheduled_at TEXT,
      sent_at TEXT,
      external_message_id TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_saas_whatsapp_contacts_account
    ON saas_whatsapp_contacts(account_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_saas_whatsapp_contacts_phone
    ON saas_whatsapp_contacts(phone)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_saas_whatsapp_messages_account
    ON saas_whatsapp_messages(account_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_saas_whatsapp_messages_phone
    ON saas_whatsapp_messages(phone)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_saas_whatsapp_notifications_status
    ON saas_whatsapp_notifications(status)
  `).run();
}

function normalisePhone(phone) {
  return String(phone || "")
    .replace(/[^\d+]/g, "")
    .replace(/^00/, "+");
}

function normaliseModule(moduleCode) {
  const code = String(moduleCode || "").trim();

  if (SAAS_WHATSAPP_MODULES.includes(code)) {
    return code;
  }

  return "other-services";
}

export async function getWhatsAppContact(
  env,
  accountId,
  phone,
  moduleCode = null
) {
  const cleanPhone = normalisePhone(phone);

  if (!cleanPhone) {
    return null;
  }

  let query = `
    SELECT *
    FROM saas_whatsapp_contacts
    WHERE account_id = ?
      AND phone = ?
  `;

  const values = [
    Number(accountId),
    cleanPhone
  ];

  if (moduleCode) {
    query += `
      AND module_code = ?
    `;

    values.push(
      normaliseModule(moduleCode)
    );
  }

  query += `
    ORDER BY id DESC
    LIMIT 1
  `;

  return await env.DB
    .prepare(query)
    .bind(...values)
    .first();
}

export async function createOrUpdateWhatsAppContact(
  env,
  {
    accountId,
    phone,
    name = null,
    email = null,
    whatsappName = null,
    moduleCode = null,
    customerId = null,
    optIn = true
  }
) {
  const cleanPhone =
    normalisePhone(phone);

  if (!accountId) {
    throw new Error(
      "accountId is required"
    );
  }

  if (!cleanPhone) {
    throw new Error(
      "WhatsApp phone number is required"
    );
  }

  const module =
    moduleCode
      ? normaliseModule(moduleCode)
      : null;

  const existing =
    await getWhatsAppContact(
      env,
      accountId,
      cleanPhone,
      module
    );

  if (existing) {
    await env.DB.prepare(`
      UPDATE saas_whatsapp_contacts
      SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        whatsapp_name = COALESCE(?, whatsapp_name),
        customer_id = COALESCE(?, customer_id),
        opt_in = ?,
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
      .bind(
        name,
        email,
        whatsappName,
        customerId,
        optIn ? 1 : 0,
        existing.id
      )
      .run();

    return await env.DB
      .prepare(`
        SELECT *
        FROM saas_whatsapp_contacts
        WHERE id = ?
        LIMIT 1
      `)
      .bind(existing.id)
      .first();
  }

  const result =
    await env.DB.prepare(`
      INSERT INTO saas_whatsapp_contacts
      (
        account_id,
        module_code,
        customer_id,
        phone,
        name,
        email,
        whatsapp_name,
        opt_in,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `)
      .bind(
        accountId,
        module,
        customerId,
        cleanPhone,
        name,
        email,
        whatsappName,
        optIn ? 1 : 0
      )
      .run();

  return await env.DB
    .prepare(`
      SELECT *
      FROM saas_whatsapp_contacts
      WHERE id = ?
      LIMIT 1
    `)
    .bind(
      result.meta?.last_row_id
    )
    .first();
}

export async function recordWhatsAppMessage(
  env,
  {
    accountId = null,
    moduleCode = null,
    contactId = null,
    customerId = null,
    phone,
    direction,
    messageType = "text",
    messageBody = null,
    externalMessageId = null,
    deliveryStatus = "pending",
    errorMessage = null
  }
) {
  const cleanPhone =
    normalisePhone(phone);

  if (!cleanPhone) {
    return null;
  }

  const result =
    await env.DB.prepare(`
      INSERT INTO saas_whatsapp_messages
      (
        account_id,
        module_code,
        contact_id,
        customer_id,
        phone,
        direction,
        message_type,
        message_body,
        external_message_id,
        delivery_status,
        error_message
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        accountId,
        moduleCode
          ? normaliseModule(moduleCode)
          : null,
        contactId,
        customerId,
        cleanPhone,
        direction,
        messageType,
        messageBody,
        externalMessageId,
        deliveryStatus,
        errorMessage
      )
      .run();

  if (contactId) {
    await env.DB.prepare(`
      UPDATE saas_whatsapp_contacts
      SET
        last_message_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
      .bind(contactId)
      .run();
  }

  return result.meta?.last_row_id || null;
}

export async function sendSaaSWhatsAppMessage(
  env,
  {
    accountId = null,
    moduleCode = null,
    customerId = null,
    contactId = null,
    phone,
    message,
    messageType = "text"
  }
) {
  const cleanPhone =
    normalisePhone(phone);

  if (!cleanPhone) {
    return {
      success: false,
      error:
        "WhatsApp phone number is required"
    };
  }

  if (!message) {
    return {
      success: false,
      error:
        "WhatsApp message is required"
    };
  }

  if (
    !env.WHATSAPP_ACCESS_TOKEN ||
    !env.WHATSAPP_PHONE_NUMBER_ID
  ) {
    return {
      success: false,
      error:
        "WhatsApp credentials are not configured"
    };
  }

  const contact =
    await createOrUpdateWhatsAppContact(
      env,
      {
        accountId,
        phone: cleanPhone,
        moduleCode,
        customerId,
        optIn: true
      }
    );

  const messageRecord =
    await recordWhatsAppMessage(
      env,
      {
        accountId,
        moduleCode,
        contactId:
          contact?.id || contactId,
        customerId,
        phone: cleanPhone,
        direction: "outgoing",
        messageType,
        messageBody: message,
        deliveryStatus: "pending"
      }
    );

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
          body: JSON.stringify({
            messaging_product:
              "whatsapp",
            recipient_type:
              "individual",
            to:
              cleanPhone,
            type:
              "text",
            text: {
              preview_url:
                false,
              body:
                String(message)
            }
          })
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      await env.DB.prepare(`
        UPDATE saas_whatsapp_messages
        SET
          delivery_status = 'failed',
          error_message = ?
        WHERE id = ?
      `)
        .bind(
          JSON.stringify(result),
          messageRecord
        )
        .run();

      return {
        success: false,
        error:
          "WhatsApp message could not be sent",
        details:
          result
      };
    }

    const externalMessageId =
      result?.messages?.[0]?.id ||
      null;

    await env.DB.prepare(`
      UPDATE saas_whatsapp_messages
      SET
        delivery_status = 'sent',
        external_message_id = ?
      WHERE id = ?
    `)
      .bind(
        externalMessageId,
        messageRecord
      )
      .run();

    return {
      success: true,
      message_id:
        messageRecord,
      external_message_id:
        externalMessageId
    };

  } catch (error) {
    await env.DB.prepare(`
      UPDATE saas_whatsapp_messages
      SET
        delivery_status = 'failed',
        error_message = ?
      WHERE id = ?
    `)
      .bind(
        String(error),
        messageRecord
      )
      .run();

    return {
      success: false,
      error:
        "WhatsApp API request failed",
      details:
        String(error)
    };
  }
}

export async function queueWhatsAppNotification(
  env,
  {
    accountId,
    moduleCode,
    phone,
    eventType,
    message,
    customerId = null,
    contactId = null,
    scheduledAt = null
  }
) {
  const cleanPhone =
    normalisePhone(phone);

  if (!accountId) {
    throw new Error(
      "accountId is required"
    );
  }

  if (!cleanPhone) {
    throw new Error(
      "phone is required"
    );
  }

  const module =
    normaliseModule(moduleCode);

  const result =
    await env.DB.prepare(`
      INSERT INTO saas_whatsapp_notifications
      (
        account_id,
        module_code,
        contact_id,
        customer_id,
        phone,
        event_type,
        message,
        status,
        scheduled_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?)
    `)
      .bind(
        accountId,
        module,
        contactId,
        customerId,
        cleanPhone,
        eventType,
        message,
        scheduledAt
      )
      .run();

  return {
    success: true,
    notification_id:
      result.meta?.last_row_id || null
  };
}

export async function processWhatsAppNotification(
  env,
  notification
) {
  if (!notification) {
    return {
      success: false,
      error:
        "Notification not found"
    };
  }

  if (
    notification.status === "sent"
  ) {
    return {
      success: true,
      already_sent: true
    };
  }

  const result =
    await sendSaaSWhatsAppMessage(
      env,
      {
        accountId:
          notification.account_id,
        moduleCode:
          notification.module_code,
        customerId:
          notification.customer_id,
        contactId:
          notification.contact_id,
        phone:
          notification.phone,
        message:
          notification.message
      }
    );

  if (result.success) {
    await env.DB.prepare(`
      UPDATE saas_whatsapp_notifications
      SET
        status = 'sent',
        sent_at = CURRENT_TIMESTAMP,
        external_message_id = ?
      WHERE id = ?
    `)
      .bind(
        result.external_message_id || null,
        notification.id
      )
      .run();

  } else {
    await env.DB.prepare(`
      UPDATE saas_whatsapp_notifications
      SET
        status = 'failed',
        error_message = ?
      WHERE id = ?
    `)
      .bind(
        result.error ||
          "Unable to send WhatsApp message",
        notification.id
      )
      .run();
  }

  return result;
}

export async function getWhatsAppMessages(
  env,
  {
    accountId,
    moduleCode = null,
    phone = null,
    limit = 100
  }
) {
  let query = `
    SELECT
      m.*,
      c.name AS contact_name,
      c.whatsapp_name
    FROM saas_whatsapp_messages m
    LEFT JOIN saas_whatsapp_contacts c
      ON c.id = m.contact_id
    WHERE m.account_id = ?
  `;

  const values = [
    Number(accountId)
  ];

  if (moduleCode) {
    query += `
      AND m.module_code = ?
    `;

    values.push(
      normaliseModule(moduleCode)
    );
  }

  if (phone) {
    query += `
      AND m.phone = ?
    `;

    values.push(
      normalisePhone(phone)
    );
  }

  query += `
    ORDER BY datetime(m.created_at) DESC,
             m.id DESC
    LIMIT ?
  `;

  values.push(
    Math.min(
      Math.max(
        Number(limit) || 100,
        1
      ),
      500
    )
  );

  const result =
    await env.DB
      .prepare(query)
      .bind(...values)
      .all();

  return result.results || [];
}

export async function getWhatsAppContacts(
  env,
  {
    accountId,
    moduleCode = null,
    search = null
  }
) {
  let query = `
    SELECT *
    FROM saas_whatsapp_contacts
    WHERE account_id = ?
  `;

  const values = [
    Number(accountId)
  ];

  if (moduleCode) {
    query += `
      AND module_code = ?
    `;

    values.push(
      normaliseModule(moduleCode)
    );
  }

  if (search) {
    query += `
      AND (
        name LIKE ?
        OR whatsapp_name LIKE ?
        OR phone LIKE ?
        OR email LIKE ?
      )
    `;

    const term =
      `%${String(search).trim()}%`;

    values.push(
      term,
      term,
      term,
      term
    );
  }

  query += `
    ORDER BY datetime(
      COALESCE(last_message_at, created_at)
    ) DESC,
    id DESC
    LIMIT 500
  `;

  const result =
    await env.DB
      .prepare(query)
      .bind(...values)
      .all();

  return result.results || [];
}

export async function getWhatsAppStatus(
  env,
  accountId
) {
  const contacts =
    await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM saas_whatsapp_contacts
      WHERE account_id = ?
    `)
      .bind(accountId)
      .first();

  const messages =
    await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM saas_whatsapp_messages
      WHERE account_id = ?
    `)
      .bind(accountId)
      .first();

  const sent =
    await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM saas_whatsapp_messages
      WHERE account_id = ?
        AND direction = 'outgoing'
        AND delivery_status = 'sent'
    `)
      .bind(accountId)
      .first();

  const failed =
    await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM saas_whatsapp_messages
      WHERE account_id = ?
        AND delivery_status = 'failed'
    `)
      .bind(accountId)
      .first();

  return {
    configured:
      Boolean(
        env.WHATSAPP_ACCESS_TOKEN &&
        env.WHATSAPP_PHONE_NUMBER_ID
      ),

    contacts:
      Number(
        contacts?.total || 0
      ),

    messages:
      Number(
        messages?.total || 0
      ),

    sent:
      Number(
        sent?.total || 0
      ),

    failed:
      Number(
        failed?.total || 0
      ),

    supported_modules:
      SAAS_WHATSAPP_MODULES
  };
}
