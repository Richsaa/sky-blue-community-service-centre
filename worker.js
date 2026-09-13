export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --------------------------------------------------
    // SUBMIT A NEW COMMUNITY REPORT
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

        const result = await env.DB
          .prepare(`
            INSERT INTO reports
            (name, category, location, description)
            VALUES (?, ?, ?, ?)
          `)
          .bind(
            name,
            category,
            location,
            description
          )
          .run();

        return Response.json({
          success: true,
          reportId: result.meta.last_row_id
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
    // GET ALL COMMUNITY REPORTS
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
              id,
              name,
              category,
              location,
              description,
              status,
              created_at
            FROM reports
            ORDER BY id DESC
          `)
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
    // API STATUS
    // --------------------------------------------------

    if (
      request.method === "GET" &&
      url.pathname === "/api"
    ) {
      return Response.json({
        success: true,
        message: "Sky Blue Community Service Centre API is running."
      });
    }


    // --------------------------------------------------
    // DEFAULT RESPONSE
    // --------------------------------------------------

    return new Response(
      "Sky Blue Community Service Centre API is running.",
      {
        status: 200,
        headers: {
          "Content-Type": "text/plain"
        }
      }
    );
  }
};
