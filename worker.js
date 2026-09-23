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

    function json(data, status = 200) {
      return new Response(JSON.stringify(data), {
        status,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }

    // ---------------------------------------------------------
    // BASIC API HEALTH CHECK
    // ---------------------------------------------------------

    if (url.pathname === "/api" && request.method === "GET") {
      return new Response(
        "Sky Blue Community Service Centre API is running",
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }

    // ---------------------------------------------------------
    // WHATSAPP WEBHOOK VERIFICATION
    // ---------------------------------------------------------

    if (url.pathname === "/api/whatsapp" && request.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (
        mode === "subscribe" &&
        token &&
        env.WHATSAPP_VERIFY_TOKEN &&
        token === env.WHATSAPP_VERIFY_TOKEN
      ) {
        return new Response(challenge, {
          status: 200,
          headers: {
            "Content-Type": "text/plain"
          }
        });
      }

      return new Response("Forbidden", {
        status: 403,
        headers: corsHeaders
      });
    }

    // ---------------------------------------------------------
    // WHATSAPP SEND MESSAGE
    // ---------------------------------------------------------

    async function sendWhatsAppMessage(to, message) {
      if (
        !env.WHATSAPP_ACCESS_TOKEN ||
        !env.WHATSAPP_PHONE_NUMBER_ID
      ) {
        console.error("WhatsApp credentials are missing");
        return false;
      }

      try {
        const response = await fetch(
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
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: to,
              type: "text",
              text: {
                preview_url: false,
                body: message
              }
            })
          }
        );

        const result = await response.json();

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

    // ---------------------------------------------------------
    // GET OR CREATE WHATSAPP CONVERSATION
    // ---------------------------------------------------------

    async function getConversation(phone) {
      return await env.DB
        .prepare(`
          SELECT *
          FROM whatsapp_conversations
          WHERE phone = ?
            AND tenant_id = ?
          LIMIT 1
        `)
        .bind(phone, TENANT_ID)
        .first();
    }

    async function createConversation(phone) {
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

      return await getConversation(phone);
    }

    async function updateConversation(phone, state, data) {
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
          JSON.stringify(data || {}),
          phone,
          TENANT_ID
        )
        .run();
    }

    // ---------------------------------------------------------
    // GET OR CREATE RESIDENT
    // ---------------------------------------------------------

    async function getOrCreateResident(phone, name = null) {
      let resident = await env.DB
        .prepare(`
          SELECT *
          FROM residents
          WHERE tenant_id = ?
            AND phone = ?
          LIMIT 1
        `)
        .bind(TENANT_ID, phone)
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
            .bind(name, resident.id)
            .run();

          resident.name = name;
        }

        return resident;
      }

      const insert = await env.DB
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
        insert.meta?.last_row_id || null;

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

    // ---------------------------------------------------------
    // CREATE REPORT FROM WHATSAPP
    // ---------------------------------------------------------

    async function createWhatsAppReport(data, phone) {
      const categoryId =
        Number(data.category_id);

      const description =
        String(data.description || "").trim();

      const location =
        String(data.location || "").trim();

      const residentName =
        String(data.name || "").trim();

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

      const category = await env.DB
        .prepare(`
          SELECT *
          FROM categories
          WHERE id = ?
          LIMIT 1
        `)
        .bind(categoryId)
        .first();

      if (!category) {
        throw new Error("Category not found");
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

      let priority = "Normal";

      if (emergency) {
        priority = "Emergency";
      } else if (
        String(data.urgency || "").toLowerCase() ===
        "urgent"
      ) {
        priority = "Urgent";
      } else if (
        String(data.urgency || "").toLowerCase() ===
        "emergency"
      ) {
        priority = "Emergency";
      }

      // Department routing
      let departmentId = 5;

      const categoryNameLower =
        categoryName.toLowerCase();

      if (
        categoryNameLower.includes("electric") ||
        categoryNameLower.includes("power")
      ) {
        departmentId = 1;
      } else if (
        categoryNameLower.includes("water") ||
        categoryNameLower.includes("drain") ||
        categoryNameLower.includes("sewer")
      ) {
        departmentId = 2;
      } else if (
        categoryNameLower.includes("road") ||
        categoryNameLower.includes("pothole") ||
        categoryNameLower.includes("storm")
      ) {
        departmentId = 3;
      } else if (
        categoryNameLower.includes("waste") ||
        categoryNameLower.includes("dump") ||
        categoryNameLower.includes("rubbish")
      ) {
        departmentId = 4;
      }

      let departmentName = null;

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
        Number(existing?.total || 0) + 1;

      const reference =
        "SBS-AX-" +
        String(nextNumber).padStart(6, "0");

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
        insert.meta?.last_row_id || null;

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

    // ---------------------------------------------------------
    // WHATSAPP CATEGORY MENU
    // ---------------------------------------------------------

    async function sendCategoryMenu(phone) {
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
          message += " 🚨";
        }

        message += "\n";
      }

      message +=
        "\nReply *CANCEL* at any time to cancel.";

      await sendWhatsAppMessage(
        phone,
        message
      );
    }

    // ---------------------------------------------------------
    // WHATSAPP CONVERSATION ENGINE
    // ---------------------------------------------------------

    async function processWhatsAppMessage(
      phone,
      messageText
    ) {
      const text =
        String(messageText || "").trim();

      const lower =
        text.toLowerCase();

      let conversation =
        await getConversation(phone);

      if (!conversation) {
        conversation =
          await createConversation(phone);
      }

      let data = {};

      try {
        data =
          conversation.data
            ? JSON.parse(conversation.data)
            : {};
      } catch {
        data = {};
      }

      // CANCEL
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

      // START
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

        await sendCategoryMenu(phone);

        return;
      }

      // CATEGORY
      if (
        conversation.state ===
        "awaiting_category"
      ) {
        const categoryId =
          Number(text);

        if (
          !categoryId ||
          !Number.isInteger(categoryId)
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

      // DESCRIPTION
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

      // LOCATION
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

      // NAME
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

      // CONFIRMATION
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

          if (report.departmentName) {
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

      // FALLBACK
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

    // ---------------------------------------------------------
    // WHATSAPP WEBHOOK RECEIVER
    // ---------------------------------------------------------

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

        return new Response(
          "EVENT_RECEIVED",
          {
            status: 200
          }
        );
      }
    }

    // ---------------------------------------------------------
    // CATEGORIES
    // ---------------------------------------------------------

    if (
      url.pathname === "/api/categories" &&
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

    // ---------------------------------------------------------
    // DEPARTMENTS
    // ---------------------------------------------------------

    if (
      url.pathname === "/api/departments" &&
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

    // ---------------------------------------------------------
    // WEB REPORT CREATION
    // ---------------------------------------------------------

    if (
      url.pathname === "/api/report" &&
      request.method === "POST"
    ) {
      try {
        const body =
          await request.json();

        const categoryId =
          body.category_id
            ? Number(body.category_id)
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
          String(requestedUrgency)
            .toLowerCase() ===
          "urgent"
        ) {
          priority =
            "Urgent";
        } else if (
          String(requestedUrgency)
            .toLowerCase() ===
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
          categoryNameLower.includes("electric") ||
          categoryNameLower.includes("power")
        ) {
          departmentId = 1;

        } else if (
          categoryNameLower.includes("water") ||
          categoryNameLower.includes("drain") ||
          categoryNameLower.includes("sewer")
        ) {
          departmentId = 2;

        } else if (
          categoryNameLower.includes("road") ||
          categoryNameLower.includes("pothole") ||
          categoryNameLower.includes("storm")
        ) {
          departmentId = 3;

        } else if (
          categoryNameLower.includes("waste") ||
          categoryNameLower.includes("dump") ||
          categoryNameLower.includes("rubbish")
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
            Boolean(residentPhone)
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

    // ---------------------------------------------------------
    // GET ALL REPORTS
    // ---------------------------------------------------------

    if (
      url.pathname === "/api/reports" &&
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

    // ---------------------------------------------------------
    // GET SINGLE REPORT
    // ---------------------------------------------------------

    if (
      url.pathname.startsWith("/api/reports/") &&
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

    // ---------------------------------------------------------
    // UPDATE REPORT
    // ---------------------------------------------------------

    if (
      url.pathname.startsWith("/api/reports/") &&
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
          body.department_id !== undefined
            ? Number(body.department_id) || null
            : existing.assigned_department_id;

        const resolutionNotes =
          body.resolution_notes !== undefined
            ? body.resolution_notes
            : existing.resolution_notes;

        const comment =
          body.comment ||
          body.update ||
          "";

        let resolvedAt =
          existing.resolved_at;

        if (
          newStatus === "Resolved"
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
          newStatus !== existing.status
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

    // ---------------------------------------------------------
    // SERVE WEBSITE FILES FROM PUBLIC
    // ---------------------------------------------------------

    if (!url.pathname.startsWith("/api")) {
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response(
        "Website assets are not configured.",
        {
          status: 500,
          headers: {
            "Content-Type": "text/plain"
          }
        }
      );
    }

    // ---------------------------------------------------------
    // UNKNOWN API ENDPOINT
    // ---------------------------------------------------------

    return json({
      success: false,
      error:
        "Endpoint not found"
    }, 404);
  }
};
