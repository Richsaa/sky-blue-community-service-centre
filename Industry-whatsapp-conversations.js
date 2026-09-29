// industry-whatsapp-conversations.js
// Sky Blue Solution
// Industry-specific WhatsApp conversation engine.
//
// This engine:
// - identifies the selected SaaS industry
// - displays the correct WhatsApp menu
// - starts industry-specific workflows
// - remembers the current conversation step
// - collects information from the user
// - prepares structured business records
//
// It does NOT replace the existing WhatsApp engine.
// It works alongside whatsapp-engine.js and industry-whatsapp.js.

import {
  getIndustryWhatsAppConfig,
  getIndustryWhatsAppMenu,
  buildIndustryWhatsAppWelcome,
  buildIndustryWorkflowStart,
  getIndustryWorkflow,
  detectIndustryCommand,
  buildIndustryHelp,
  buildIndustryCancel
} from "./industry-whatsapp.js";


// ============================================================
// CONVERSATION TABLE
// ============================================================

export async function ensureIndustryWhatsAppConversationTable(env) {

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS saas_whatsapp_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      module_code TEXT NOT NULL,
      phone TEXT NOT NULL,
      customer_id INTEGER,
      state TEXT NOT NULL DEFAULT 'menu',
      workflow_code TEXT,
      current_step INTEGER NOT NULL DEFAULT 0,
      data_json TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      last_message TEXT,
      last_message_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();


  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_saas_whatsapp_conversations_account_phone
    ON saas_whatsapp_conversations(
      account_id,
      phone
    )
  `).run();


  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_saas_whatsapp_conversations_status
    ON saas_whatsapp_conversations(
      status
    )
  `).run();
}


// ============================================================
// NORMALISE PHONE
// ============================================================

function normalisePhone(phone) {

  return String(phone || "")
    .replace(/[^\d+]/g, "")
    .replace(/^00/, "+");
}


// ============================================================
// GET CONVERSATION
// ============================================================

export async function getIndustryConversation(
  env,
  {
    accountId,
    phone
  }
) {

  const cleanPhone =
    normalisePhone(phone);

  if (
    !accountId ||
    !cleanPhone
  ) {
    return null;
  }

  return await env.DB
    .prepare(`
      SELECT *
      FROM saas_whatsapp_conversations
      WHERE account_id = ?
        AND phone = ?
        AND status = 'active'
      ORDER BY id DESC
      LIMIT 1
    `)
    .bind(
      Number(accountId),
      cleanPhone
    )
    .first();
}


// ============================================================
// SAVE CONVERSATION
// ============================================================

export async function saveIndustryConversation(
  env,
  {
    accountId,
    moduleCode,
    phone,
    customerId = null,
    state = "menu",
    workflowCode = null,
    currentStep = 0,
    data = {},
    status = "active",
    lastMessage = null
  }
) {

  const cleanPhone =
    normalisePhone(phone);

  const existing =
    await getIndustryConversation(
      env,
      {
        accountId,
        phone: cleanPhone
      }
    );


  const dataJson =
    JSON.stringify(
      data || {}
    );


  if (existing) {

    await env.DB.prepare(`
      UPDATE saas_whatsapp_conversations
      SET
        module_code = ?,
        customer_id = ?,
        state = ?,
        workflow_code = ?,
        current_step = ?,
        data_json = ?,
        status = ?,
        last_message = ?,
        last_message_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
      .bind(
        moduleCode,
        customerId,
        state,
        workflowCode,
        Number(currentStep) || 0,
        dataJson,
        status,
        lastMessage,
        existing.id
      )
      .run();


    return await env.DB
      .prepare(`
        SELECT *
        FROM saas_whatsapp_conversations
        WHERE id = ?
        LIMIT 1
      `)
      .bind(
        existing.id
      )
      .first();
  }


  const result =
    await env.DB.prepare(`
      INSERT INTO saas_whatsapp_conversations
      (
        account_id,
        module_code,
        phone,
        customer_id,
        state,
        workflow_code,
        current_step,
        data_json,
        status,
        last_message,
        last_message_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)
      .bind(
        accountId,
        moduleCode,
        cleanPhone,
        customerId,
        state,
        workflowCode,
        Number(currentStep) || 0,
        dataJson,
        status,
        lastMessage
      )
      .run();


  return await env.DB
    .prepare(`
      SELECT *
      FROM saas_whatsapp_conversations
      WHERE id = ?
      LIMIT 1
    `)
    .bind(
      result.meta?.last_row_id
    )
    .first();
}


// ============================================================
// PARSE DATA
// ============================================================

function parseConversationData(
  conversation
) {

  if (
    !conversation ||
    !conversation.data_json
  ) {
    return {};
  }

  try {

    return JSON.parse(
      conversation.data_json
    );

  } catch {

    return {};
  }
}


// ============================================================
// BUILD MENU
// ============================================================

export function buildConversationMenu(
  moduleCode,
  businessName = null
) {

  return buildIndustryWhatsAppWelcome(
    moduleCode,
    businessName
  );
}


// ============================================================
// START CONVERSATION
// ============================================================

export async function startIndustryConversation(
  env,
  {
    accountId,
    moduleCode,
    phone,
    customerId = null,
    businessName = null
  }
) {

  const cleanPhone =
    normalisePhone(phone);


  const config =
    getIndustryWhatsAppConfig(
      moduleCode
    );


  await saveIndustryConversation(
    env,
    {
      accountId,
      moduleCode,
      phone: cleanPhone,
      customerId,
      state: "menu",
      workflowCode: null,
      currentStep: 0,
      data: {},
      status: "active"
    }
  );


  return {
    success: true,

    state: "menu",

    module_code:
      moduleCode,

    message:
      buildIndustryWhatsAppWelcome(
        moduleCode,
        businessName ||
          config.name
      ),

    menu:
      getIndustryWhatsAppMenu(
        moduleCode
      )
  };
}


// ============================================================
// START WORKFLOW
// ============================================================

async function startWorkflow(
  env,
  conversation,
  workflowCode,
  userMessage
) {

  const data =
    parseConversationData(
      conversation
    );


  data.initial_message =
    userMessage;


  await saveIndustryConversation(
    env,
    {
      accountId:
        conversation.account_id,

      moduleCode:
        conversation.module_code,

      phone:
        conversation.phone,

      customerId:
        conversation.customer_id,

      state:
        "collecting",

      workflowCode,

      currentStep:
        1,

      data,

      status:
        "active",

      lastMessage:
        userMessage
    }
  );


  return {
    success: true,

    state:
      "collecting",

    workflow_code:
      workflowCode,

    step:
      1,

    data,

    message:
      buildIndustryWorkflowStart(
        conversation.module_code,
        workflowCode
      )
  };
}


// ============================================================
// GENERIC DATA COLLECTION
// ============================================================

async function collectWorkflowData(
  env,
  conversation,
  userMessage
) {

  const data =
    parseConversationData(
      conversation
    );


  const step =
    Number(
      conversation.current_step || 1
    );


  data[
    `step_${step}`
  ] =
    userMessage;


  const nextStep =
    step + 1;


  /*
   * These are the initial collection stages.
   *
   * Later, individual modules will replace
   * these generic questions with database-aware
   * workflows.
   */


  const questions = {

    // Salon
    salon_booking: [
      "What is your preferred date?",
      "What is your preferred time?",
      "Please provide your name and phone number."
    ],

    salon_waiting_list: [
      "What service are you waiting for?",
      "What date would you prefer?",
      "Please provide your name."
    ],

    // Church
    church_prayer: [
      "Would you like to provide your name? If yes, enter it now.",
      "Would you like someone from the prayer team to contact you? Reply YES or NO."
    ],

    // Pharmacy
    pharmacy_stock_request: [
      "How many units do you require?",
      "Which pharmacy branch are you requesting from?",
      "Please provide your name."
    ],

    pharmacy_low_stock: [
      "What is the current quantity?",
      "Which pharmacy branch is reporting the shortage?",
      "Please provide your name."
    ],

    pharmacy_daily_report: [
      "What were today's total sales?",
      "Were there any stock shortages? Reply YES or NO.",
      "Were there any damaged or expired products? Reply YES or NO.",
      "Are there any other issues Head Office should know about?"
    ],

    pharmacy_transfer: [
      "How many units are required?",
      "Which branch should send the stock?",
      "Please provide your name."
    ],

    // Laundry
    laundry_collection: [
      "What date should we collect your laundry?",
      "What is your address?",
      "Please provide your name."
    ],

    // Food
    food_order: [
      "What would you like to order?",
      "Collection or delivery?",
      "Please provide your name."
    ],

    // Driving school
    driving_register: [
      "What is your ID/passport number?",
      "What type of licence are you interested in?",
      "Please provide your preferred contact details."
    ],

    driving_lesson: [
      "What date would you prefer?",
      "What time would you prefer?",
      "Please provide your learner name."
    ],

    // School
    school_parent: [
      "What is the learner's name?",
      "What is the parent's name?",
      "Please describe your enquiry."
    ],

    // Daycare
    daycare_child: [
      "What is the child's name?",
      "What is the parent's/guardian's name?",
      "Please describe your enquiry."
    ],

    // Transport
    transport_booking: [
      "What is your pickup location?",
      "Where are you travelling to?",
      "What date and time do you need transport?",
      "Please provide your name."
    ],

    // IT
    it_ticket: [
      "What device or service is affected?",
      "Please describe the problem.",
      "How urgent is the problem?",
      "Please provide your name."
    ],

    // Building materials
    building_quote: [
      "Please list the materials you need.",
      "What quantities do you require?",
      "Please provide your delivery location.",
      "Please provide your name."
    ],

    // Wholesale
    wholesale_quote: [
      "Please list the products you need.",
      "What quantities do you require?",
      "Please provide your business name.",
      "Please provide your contact name."
    ],

    // NPO
    npo_assistance: [
      "Please describe the assistance you need.",
      "Please provide your name.",
      "Please provide your contact details."
    ],

    npo_volunteer: [
      "What is your name?",
      "What skills or experience do you have?",
      "Which programme would you like to volunteer for?"
    ],

    // Generic service
    service_request: [
      "Please describe the service you require.",
      "When do you need the service?",
      "Please provide your name."
    ],

    service_booking: [
      "What date would you prefer?",
      "What time would you prefer?",
      "Please provide your name."
    ],

    // E-commerce
    ecommerce_order: [
      "Which products would you like?",
      "What quantities do you require?",
      "Delivery or collection?",
      "Please provide your name."
    ]
  };


  const workflowQuestions =
    questions[
      conversation.workflow_code
    ] || [
      "Please provide any additional information.",
      "Please provide your name.",
      "Please provide your contact details."
    ];


  const questionIndex =
    nextStep - 2;


  if (
    questionIndex <
    workflowQuestions.length
  ) {

    await saveIndustryConversation(
      env,
      {
        accountId:
          conversation.account_id,

        moduleCode:
          conversation.module_code,

        phone:
          conversation.phone,

        customerId:
          conversation.customer_id,

        state:
          "collecting",

        workflowCode:
          conversation.workflow_code,

        currentStep:
          nextStep,

        data,

        status:
          "active",

        lastMessage:
          userMessage
      }
    );


    return {
      success: true,

      state:
        "collecting",

      workflow_code:
        conversation.workflow_code,

      step:
        nextStep,

      data,

      message:
        workflowQuestions[
          questionIndex
        ]
    };
  }


  // ========================================================
  // COMPLETE WORKFLOW
  // ========================================================

  await saveIndustryConversation(
    env,
    {
      accountId:
        conversation.account_id,

      moduleCode:
        conversation.module_code,

      phone:
        conversation.phone,

      customerId:
        conversation.customer_id,

      state:
        "completed",

      workflowCode:
        conversation.workflow_code,

      currentStep:
        nextStep,

      data,

      status:
        "completed",

      lastMessage:
        userMessage
    }
  );


  return {
    success: true,

    state:
      "completed",

    workflow_code:
      conversation.workflow_code,

    data,

    message:
      buildCompletionMessage(
        conversation.module_code,
        conversation.workflow_code
      )
  };
}


// ============================================================
// COMPLETION MESSAGE
// ============================================================

function buildCompletionMessage(
  moduleCode,
  workflowCode
) {

  const messages = {

    salon_booking:
      "✅ Your salon booking request has been captured. The salon will confirm your appointment shortly.",

    church_prayer:
      "🙏 Your prayer request has been received. The prayer team will receive it for follow-up.",

    pharmacy_stock_request:
      "📦 Your pharmacy stock request has been recorded and sent to the responsible team.",

    pharmacy_daily_report:
      "📊 Today's pharmacy report has been recorded and sent to Head Office.",

    pharmacy_low_stock:
      "⚠️ Your low-stock report has been recorded and sent to the responsible team.",

    pharmacy_transfer:
      "🔄 Your branch stock-transfer request has been recorded.",

    it_ticket:
      "💻 Your IT support request has been recorded. A technician can now follow up.",

    driving_lesson:
      "🚗 Your driving lesson request has been recorded. The driving school will confirm availability.",

    transport_booking:
      "🚐 Your transport booking request has been recorded.",

    ecommerce_order:
      "🛒 Your order information has been captured. The store will confirm the order.",

    food_order:
      "🍽️ Your food order information has been captured. The business will confirm it shortly.",

    laundry_collection:
      "🧺 Your laundry collection request has been recorded.",

    building_quote:
      "🧱 Your building-material quotation request has been recorded.",

    wholesale_quote:
      "📦 Your wholesale quotation request has been recorded.",

    npo_assistance:
      "🤝 Your assistance request has been recorded. The organisation will follow up.",

    npo_volunteer:
      "🙋 Your volunteer information has been recorded.",

    service_request:
      "✅ Your service request has been recorded.",

    service_booking:
      "📅 Your booking request has been recorded."
  };


  return (
    messages[workflowCode] ||
    `✅ Your ${moduleCode} request has been recorded.`
  );
}


// ============================================================
// PROCESS INCOMING MESSAGE
// ============================================================

export async function processIndustryWhatsAppMessage(
  env,
  {
    accountId,
    moduleCode,
    phone,
    message,
    customerId = null,
    businessName = null
  }
) {

  const cleanPhone =
    normalisePhone(phone);


  if (
    !accountId ||
    !moduleCode ||
    !cleanPhone
  ) {

    return {
      success: false,

      error:
        "accountId, moduleCode and phone are required"
    };
  }


  const text =
    String(message || "")
      .trim();


  if (!text) {

    return {
      success: false,

      error:
        "Message is required"
    };
  }


  const command =
    detectIndustryCommand(
      text
    );


  // ========================================================
  // MENU
  // ========================================================

  if (
    command === "menu"
  ) {

    return await startIndustryConversation(
      env,
      {
        accountId,
        moduleCode,
        phone: cleanPhone,
        customerId,
        businessName
      }
    );
  }


  // ========================================================
  // HELP
  // ========================================================

  if (
    command === "help"
  ) {

    return {
      success: true,

      state:
        "help",

      message:
        buildIndustryHelp(
          moduleCode
        )
    };
  }


  // ========================================================
  // CANCEL
  // ========================================================

  if (
    command === "cancel"
  ) {

    const conversation =
      await getIndustryConversation(
        env,
        {
          accountId,
          phone: cleanPhone
        }
      );


    if (conversation) {

      await env.DB.prepare(`
        UPDATE saas_whatsapp_conversations
        SET
          state = 'cancelled',
          status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
        .bind(
          conversation.id
        )
        .run();
    }


    return {
      success: true,

      state:
        "cancelled",

      message:
        buildIndustryCancel()
    };
  }


  // ========================================================
  // EXISTING CONVERSATION
  // ========================================================

  let conversation =
    await getIndustryConversation(
      env,
      {
        accountId,
        phone: cleanPhone
      }
    );


  // ========================================================
  // NEW CONVERSATION
  // ========================================================

  if (!conversation) {

    return await startIndustryConversation(
      env,
      {
        accountId,
        moduleCode,
        phone: cleanPhone,
        customerId,
        businessName
      }
    );
  }


  // ========================================================
  // MENU SELECTION
  // ========================================================

  if (
    conversation.state === "menu"
  ) {

    const workflow =
      getIndustryWorkflow(
        conversation.module_code,
        text
      );


    if (!workflow) {

      return {
        success: true,

        state:
          "menu",

        message:
          `I didn't recognise that option.\n\n` +
          buildConversationMenu(
            conversation.module_code,
            businessName
          )
      };
    }


    return await startWorkflow(
      env,
      conversation,
      workflow,
      text
    );
  }


  // ========================================================
  // COLLECTING INFORMATION
  // ========================================================

  if (
    conversation.state === "collecting"
  ) {

    return await collectWorkflowData(
      env,
      conversation,
      text
    );
  }


  // ========================================================
  // COMPLETED
  // ========================================================

  return {
    success: true,

    state:
      "completed",

    message:
      "Your previous request has been completed.\n\nReply MENU to start another request."
  };
    }
