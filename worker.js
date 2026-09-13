export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --------------------------------------------------
    // CONFIGURATION
    // --------------------------------------------------

    const TENANT_ID = 1;
    const WARD_ID = 1;

    // --------------------------------------------------
    // HEALTH CHECK
    // GET /api
    // --------------------------------------------------

    if (request.method === "GET" && url.pathname === "/api") {
      return Response.json({
        success: true,
        message: "Sky Blue Community Service Centre SaaS API is running.",
        tenant_id: TENANT_ID,
        ward_id: WARD_ID
      });
    }

    // --------------------------------------------------
    // GET REPORT CATEGORIES
    // GET /api/categories
    // --------------------------------------------------

    if (
      request.method === "GET" &&
      url.pathname === "/api/categories"
    ) {
      try {
        const result = await env.DB
          .prepare(`
            SELECT
              id,
              name,
              description,
              emergency
            FROM categories
            WHERE status = 'active'
              AND (tenant_id IS NULL OR tenant_id = ?)
            ORDER BY id ASC
          `)
          .bind(TENANT_ID)
          .all();

        return Response.json({
          success: true,
          categories: result.results || []
        });

      } catch (error) {
        return Response.json(
          {
            success: false,
            message: "Could not load categories.",
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // --------------------------------------------------
    // GET DEPARTMENTS
    // GET /api/departments
    // --------------------------------------------------

    if (
      request.method === "GET" &&
      url.pathname === "/api/departments"
    ) {
      try {
        const result = await env.DB
          .prepare(`
            SELECT
              id,
              name,
              description,
              status
            FROM departments
            WHERE status = 'active'
            ORDER BY id ASC
          `)
          .all();

        return Response.json({
          success: true,
          departments: result.results || []
        });

      } catch (error) {
        return Response.json(
          {
            success: false,
            message: "Could not load departments.",
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // --------------------------------------------------
    // SUBMIT COMMUNITY REPORT
    // POST /api/report
    // --------------------------------------------------

    if (
      request.method === "POST" &&
      url.pathname === "/api/report"
    ) {
      try {
        const data = await request.json();

        const name = String(data.name || "").trim();
        const category = String(data.category || "").trim();
        const location = String(data.location || "").trim();
        const description = String(data.description || "").trim();

        if (!name || !category || !location || !description) {
          return Response.json(
            {
              success: false,
              message: "Please complete all required fields."
            },
            { status: 400 }
          );
        }

        // ------------------------------------------------
        // FIND CATEGORY
        // ------------------------------------------------

        const categoryResult = await env.DB
          .prepare(`
            SELECT
              id,
              name,
              emergency
            FROM categories
            WHERE name = ?
              AND status = 'active'
              AND (tenant_id IS NULL OR tenant_id = ?)
            ORDER BY tenant_id DESC
            LIMIT 1
          `)
          .bind(category, TENANT_ID)
          .first();

        let priority = "Normal";

        if (categoryResult) {
          if (Number(categoryResult.emergency) === 1) {
            priority = "Emergency";
          }
        }

        // ------------------------------------------------
        // FIND DEPARTMENT
        // ------------------------------------------------

        let departmentId = null;

        if (categoryResult) {
          const categoryName = categoryResult.name.toLowerCase();

          if (categoryName.includes("electricity")) {
            departmentId = 1;
          } else if (
            categoryName.includes("water") ||
            categoryName.includes("sewer") ||
            categoryName.includes("drain")
          ) {
            departmentId = 2;
          } else if (
            categoryName.includes("pothole") ||
            categoryName.includes("road") ||
            categoryName.includes("streetlight")
          ) {
            departmentId = 3;
          } else if (
            categoryName.includes("dumping")
          ) {
            departmentId = 4;
          } else if (
            categoryName.includes("traffic") ||
            categoryName.includes("crime")
          ) {
            departmentId = 5;
          }
        }

        // ------------------------------------------------
        // CREATE REPORT
        // ------------------------------------------------

        const result = await env.DB
          .prepare(`
            INSERT INTO reports (
              name,
              category,
              location,
              description,
              status,
              tenant_id,
              ward_id,
              department_id,
              assigned_department_id,
              reference_number,
              priority,
              escalation_status,
              source
            )
            VALUES (?, ?, ?, ?, 'New', ?, ?, ?, ?, ?, ?, 'Not Escalated', 'Web')
          `)
          .bind(
            name,
            category,
            location,
            description,
            TENANT_ID,
            WARD_ID,
            departmentId,
            departmentId,
            "TEMP",
            priority
          )
          .run();

        const reportId = result.meta.last_row_id;

        // ------------------------------------------------
        // CREATE REFERENCE NUMBER
        // ------------------------------------------------

        const referenceNumber =
          `SBS-AX-${String(reportId).padStart(6, "0")}`;

        await env.DB
          .prepare(`
            UPDATE reports
            SET reference_number = ?
            WHERE id = ?
          `)
          .bind(referenceNumber, reportId)
          .run();

        // ------------------------------------------------
        // CREATE INITIAL HISTORY ENTRY
        // ------------------------------------------------

        await env.DB
          .prepare(`
            INSERT INTO report_updates (
              report_id,
              status,
              comment
            )
            VALUES (?, 'New', 'Report received through the web portal.')
          `)
          .bind(reportId)
          .run();

        return Response.json({
          success: true,
          reportId: reportId,
          referenceNumber: referenceNumber,
          priority: priority
        });

      } catch (error) {
        return Response.json(
          {
            success: false,
            message: "Could not save the report.",
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // --------------------------------------------------
    // GET REPORTS
    // GET /api/reports
    // --------------------------------------------------

    if (
      request.method === "GET" &&
      url.pathname === "/api/reports"
    ) {
      try {
        const result = await env.DB
          .prepare(`
            SELECT
              r.id,
              r.reference_number,
              r.name,
              r.category,
              r.location,
              r.description,
              r.status,
              r.priority,
              r.escalation_status,
              r.source,
              r.created_at,
              r.resolved_at,
              r.resolution_notes,
              d.name AS department_name
            FROM reports r
            LEFT JOIN departments d
              ON r.assigned_department_id = d.id
            WHERE r.tenant_id = ?
              AND r.ward_id = ?
            ORDER BY r.id DESC
          `)
          .bind(TENANT_ID, WARD_ID)
          .all();

        return Response.json({
          success: true,
          reports: result.results || []
        });

      } catch (error) {
        return Response.json(
          {
            success: false,
            message: "Could not load reports.",
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // --------------------------------------------------
    // DEFAULT
    // --------------------------------------------------

    return new Response(
      "Sky Blue Community Service Centre SaaS API is running.",
      {
        status: 200,
        headers: {
          "Content-Type": "text/plain"
        }
      }
    );
  }
};
