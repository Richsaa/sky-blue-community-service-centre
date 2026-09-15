export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================================================
    // CONFIGURATION
    // =========================================================

    const TENANT_ID = 1;
    const WARD_ID = 1;

    // =========================================================
    // CORS
    // =========================================================

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // =========================================================
    // HELPER: JSON RESPONSE
    // =========================================================

    function json(data, status = 200) {
      return new Response(JSON.stringify(data), {
        status,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }

    // =========================================================
    // HEALTH CHECK
    // =========================================================

    if (url.pathname === "/api" && request.method === "GET") {
      return new Response(
        "Sky Blue Community Service Centre API is running",
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }

    // =========================================================
    // WHATSAPP WEBHOOK VERIFICATION
    // =========================================================

    if (
      url.pathname === "/api/whatsapp" &&
      request.method === "GET"
    ) {
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
        status: 403
      });
    }

    // =========================================================
    // WHATSAPP WEBHOOK - INCOMING EVENTS
    // =========================================================

    if (
      url.pathname === "/api/whatsapp" &&
      request.method === "POST"
    ) {
      try {
        const body = await request.json();

        console.log(
          "WhatsApp webhook received:",
          JSON.stringify(body)
        );

        /*
          WhatsApp normally sends events in this structure:

          entry
            -> changes
              -> value
                -> messages

          We are deliberately keeping this first webhook stage
          simple. Once Meta successfully reaches this endpoint,
          we will connect the conversation engine and D1 reporting
          workflow.
        */

        if (body?.entry) {
          for (const entry of body.entry) {
            for (const change of entry.changes || []) {
              const value = change.value || {};

              const messages = value.messages || [];

              for (const message of messages) {
                console.log(
                  "WhatsApp message:",
                  JSON.stringify(message)
                );
              }
            }
          }
        }

        return new Response("EVENT_RECEIVED", {
          status: 200
        });

      } catch (error) {
        console.error(
          "WhatsApp webhook error:",
          error
        );

        // WhatsApp should receive a successful response where
        // possible so it does not repeatedly retry malformed events.
        return new Response("EVENT_RECEIVED", {
          status: 200
        });
      }
    }

    // =========================================================
    // GET CATEGORIES
    // =========================================================

    if (
      url.pathname === "/api/categories" &&
      request.method === "GET"
    ) {
      try {
        const result = await env.DB
          .prepare(`
            SELECT *
            FROM categories
            ORDER BY id ASC
          `)
          .all();

        return json(result.results || []);
      } catch (error) {
        console.error(error);

        return json(
          {
            success: false,
            error: "Unable to load categories"
          },
          500
        );
      }
    }

    // =========================================================
    // GET DEPARTMENTS
    // =========================================================

    if (
      url.pathname === "/api/departments" &&
      request.method === "GET"
    ) {
      try {
        const result = await env.DB
          .prepare(`
            SELECT *
            FROM departments
            ORDER BY id ASC
          `)
          .all();

        return json(result.results || []);
      } catch (error) {
        console.error(error);

        return json(
          {
            success: false,
            error: "Unable to load departments"
          },
          500
        );
      }
    }

    // =========================================================
    // CREATE REPORT
    // =========================================================

    if (
      url.pathname === "/api/report" &&
      request.method === "POST"
    ) {
      try {
        const body = await request.json();

        const categoryId = body.category_id
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

        if (!categoryId) {
          return json(
            {
              success: false,
              error: "category_id is required"
            },
            400
          );
        }

        if (!description) {
          return json(
            {
              success: false,
              error: "description is required"
            },
            400
          );
        }

        // -----------------------------------------------------
        // Find category
        // -----------------------------------------------------

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
          return json(
            {
              success: false,
              error: "Category not found"
            },
            404
          );
        }

        // -----------------------------------------------------
        // Determine priority
        // -----------------------------------------------------

        const emergency =
          category.emergency === 1 ||
          category.emergency === true;

        const priority = emergency
          ? "Emergency"
          : "Normal";

        // -----------------------------------------------------
        // Determine department
        // -----------------------------------------------------

        let departmentId = null;
        let departmentName = null;

        const categoryName =
          String(
            category.name ||
            category.category_name ||
            ""
          ).toLowerCase();

        if (
          categoryName.includes("electric") ||
          categoryName.includes("power")
        ) {
          departmentId = 1;
        } else if (
          categoryName.includes("water") ||
          categoryName.includes("drain") ||
          categoryName.includes("sewer")
        ) {
          departmentId = 2;
        } else if (
          categoryName.includes("road") ||
          categoryName.includes("pothole") ||
          categoryName.includes("storm")
        ) {
          departmentId = 3;
        } else if (
          categoryName.includes("waste") ||
          categoryName.includes("dump") ||
          categoryName.includes("rubbish")
        ) {
          departmentId = 4;
        } else {
          departmentId = 5;
        }

        if (departmentId) {
          const department = await env.DB
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

        // -----------------------------------------------------
        // Generate reference number
        // -----------------------------------------------------

        const existing = await env.DB
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

        // -----------------------------------------------------
        // Insert report
        // -----------------------------------------------------

        const insert = await env.DB
          .prepare(`
            INSERT INTO reports
            (
              tenant_id,
              ward_id,
              category_id,
              department_id,
              reference_number,
              description,
              location,
              priority,
              status,
              resident_name,
              resident_phone
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            TENANT_ID,
            WARD_ID,
            categoryId,
            departmentId,
            reference,
            description,
            location,
            priority,
            "New",
            residentName,
            residentPhone
          )
          .run();

        const reportId =
          insert.meta?.last_row_id || null;

        // -----------------------------------------------------
        // Add report history
        // -----------------------------------------------------

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

        return json(
          {
            success: true,
            message: "Report created successfully",
            report_id: reportId,
            reference_number: reference,
            category: category.name || null,
            department: departmentName,
            priority,
            status: "New"
          },
          201
        );

      } catch (error) {
        console.error(
          "Report creation error:",
          error
        );

        return json(
          {
            success: false,
            error: "Unable to create report",
            details: String(error)
          },
          500
        );
      }
    }

    // =========================================================
    // GET REPORTS
    // =========================================================

    if (
      url.pathname === "/api/reports" &&
      request.method === "GET"
    ) {
      try {
        const result = await env.DB
          .prepare(`
            SELECT *
            FROM reports
            ORDER BY id DESC
          `)
          .all();

        return json(result.results || []);
      } catch (error) {
        console.error(error);

        return json(
          {
            success: false,
            error: "Unable to load reports"
          },
          500
        );
      }
    }

    // =========================================================
    // 404
    // =========================================================

    return json(
      {
        success: false,
        error: "Endpoint not found"
      },
      404
    );
  }
};
