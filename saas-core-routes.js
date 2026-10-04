/*
 * SKY BLUE SAAS CORE ROUTES
 *
 * HTTP route layer for the shared Sky Blue SaaS Core API.
 *
 * Business Workspace
 *        ↓
 * SaaS Core Routes
 *        ↓
 * SaaS Core API
 *        ↓
 * D1 Database
 *
 * All customer data is isolated by authenticated account_id.
 */

import {
  getCoreBusinessProfile,
  saveCoreBusinessProfile,

  listCoreCustomers,
  getCoreCustomer,
  createCoreCustomer,
  updateCoreCustomer,
  deactivateCoreCustomer,

  listCoreProducts,
  getCoreProduct,
  createCoreProduct,
  updateCoreProduct,
  deactivateCoreProduct,

  listCoreServices,
  createCoreService,

  listCoreSales,
  getCoreSale,
  createCoreSale,

  listCoreExpenses,
  createCoreExpense,

  listCorePayments,
  createCorePayment,

  listCoreStaff,
  createCoreStaff,

  listCoreDocuments,

  createCoreNotification,

  listCoreActivity,

  getCoreDashboard,
  getCoreSystemStatus
} from "./saas-core-api.js";


/* =========================================================
   ECOMMERCE CORE API
========================================================= */

import {
  ensureEcommerceTables,

  getEcommerceStore,
  saveEcommerceStore,

  listEcommerceCategories,
  createEcommerceCategory,
  updateEcommerceCategory,
  deleteEcommerceCategory,

  listEcommerceMedia,
  createEcommerceMedia,
  updateEcommerceMedia,
  deleteEcommerceMedia,

  listWhatsAppProductMedia,

  listEcommerceOrders,
  getEcommerceOrder,
  createEcommerceOrder,
  updateEcommerceOrder,

  getEcommerceDashboard
} from "./ecommerce-core-api.js";


/* =========================================================
   HELPERS
========================================================= */

function clean(value) {
  return String(value ?? "").trim();
}


function accountIdFromAccount(account) {

  const id =
    Number(
      account?.account_id ||
      account?.id ||
      0
    );

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error(
      "Authenticated account is invalid"
    );
  }

  return id;
}


async function readJSON(request) {

  try {
    return await request.json();
  } catch {
    return {};
  }

}


function getModuleCode(url, body = {}) {

  return clean(
    url.searchParams.get("module_code") ||
    url.searchParams.get("module") ||
    body.module_code ||
    body.moduleCode ||
    ""
  );

}


function requireModuleCode(url, body = {}) {

  const moduleCode =
    getModuleCode(
      url,
      body
    );

  if (!moduleCode) {
    throw new Error(
      "module_code is required"
    );
  }

  return moduleCode;
}


/* =========================================================
   MAIN ROUTER
========================================================= */

export async function handleSaaSCoreRoute(
  env,
  request,
  url,
  account,
  json
) {

  const accountId =
    accountIdFromAccount(
      account
    );

  const path =
    url.pathname;

  const method =
    request.method.toUpperCase();


  /* =======================================================
     CORE STATUS
  ======================================================= */

  if (
    path === "/api/core/status" &&
    method === "GET"
  ) {

    const result =
      await getCoreSystemStatus(
        env,
        accountId
      );

    return json(
      result
    );

  }


  /* =======================================================
     BUSINESS PROFILE
  ======================================================= */

  if (
    path === "/api/core/business" &&
    method === "GET"
  ) {

    const profile =
      await getCoreBusinessProfile(
        env,
        accountId
      );

    return json({
      success: true,
      profile
    });

  }


  if (
    path === "/api/core/business" &&
    (
      method === "POST" ||
      method === "PUT" ||
      method === "PATCH"
    )
  ) {

    const body =
      await readJSON(
        request
      );

    const result =
      await saveCoreBusinessProfile(
        env,
        accountId,
        body
      );

    return json(
      result
    );

  }


  /* =======================================================
     CORE DASHBOARD
  ======================================================= */

  if (
    path === "/api/core/dashboard" &&
    method === "GET"
  ) {

    const moduleCode =
      getModuleCode(
        url
      );

    const result =
      await getCoreDashboard(
        env,
        accountId,
        moduleCode || null
      );

    return json({
      success: true,
      dashboard: result
    });

  }


  /* =======================================================
     CUSTOMERS
  ======================================================= */

  if (
    path === "/api/core/customers" &&
    method === "GET"
  ) {

    const result =
      await listCoreCustomers(
        env,
        accountId,
        {
          search:
            url.searchParams.get(
              "search"
            ) || "",

          status:
            url.searchParams.get(
              "status"
            ) || "",

          limit:
            url.searchParams.get(
              "limit"
            ) || 100,

          offset:
            url.searchParams.get(
              "offset"
            ) || 0
        }
      );

    return json(
      result
    );

  }


  if (
    path === "/api/core/customers" &&
    method === "POST"
  ) {

    const body =
      await readJSON(
        request
      );

    const result =
      await createCoreCustomer(
        env,
        accountId,
        body
      );

    return json(
      result,
      201
    );

  }


  const customerMatch =
    path.match(
      /^\/api\/core\/customers\/(\d+)$/
    );


  if (
    customerMatch &&
    method === "GET"
  ) {

    const customerId =
      Number(
        customerMatch[1]
      );

    const customer =
      await getCoreCustomer(
        env,
        accountId,
        customerId
      );

    if (!customer) {
      return json({
        success: false,
        error:
          "Customer not found"
      }, 404);
    }

    return json({
      success: true,
      customer
    });

  }


  if (
    customerMatch &&
    (
      method === "PATCH" ||
      method === "PUT"
    )
  ) {

    const customerId =
      Number(
        customerMatch[1]
      );

    const body =
      await readJSON(
        request
      );

    const result =
      await updateCoreCustomer(
        env,
        accountId,
        customerId,
        body
      );

    return json(
      result
    );

  }


  if (
    customerMatch &&
    method === "DELETE"
  ) {

    const customerId =
      Number(
        customerMatch[1]
      );

    const result =
      await deactivateCoreCustomer(
        env,
        accountId,
        customerId
      );

    return json(
      result
    );

  }


  /* =======================================================
     PRODUCTS
  ======================================================= */

  if (
    path === "/api/core/products" &&
    method === "GET"
  ) {

    const moduleCode =
      requireModuleCode(
        url
      );

    const result =
      await listCoreProducts(
        env,
        accountId,
        moduleCode,
        {
          search:
            url.searchParams.get(
              "search"
            ) || "",

          active:
            url.searchParams.has(
              "active"
            )
              ? url.searchParams.get(
                  "active"
                )
              : undefined
        }
      );

    return json(
      result
    );

  }


  if (
    path === "/api/core/products" &&
    method === "POST"
  ) {

    const body =
      await readJSON(
        request
      );

    const moduleCode =
      requireModuleCode(
        url,
        body
      );

    const result =
      await createCoreProduct(
        env,
        accountId,
        moduleCode,
        body
      );

    return json(
      result,
      201
    );

  }


  const productMatch =
    path.match(
      /^\/api\/core\/products\/(\d+)$/
    );


  if (
    productMatch &&
    method === "GET"
  ) {

    const productId =
      Number(
        productMatch[1]
      );

    const product =
      await getCoreProduct(
        env,
        accountId,
        productId
      );

    if (!product) {
      return json({
        success: false,
        error:
          "Product not found"
      }, 404);
    }

    return json({
      success: true,
      product
    });

  }


  if (
    productMatch &&
    (
      method === "PATCH" ||
      method === "PUT"
    )
  ) {

    const productId =
      Number(
        productMatch[1]
      );

    const body =
      await readJSON(
        request
      );

    const result =
      await updateCoreProduct(
        env,
        accountId,
        productId,
        body
      );

    return json(
      result
    );

  }


  if (
    productMatch &&
    method === "DELETE"
  ) {

    const productId =
      Number(
        productMatch[1]
      );

    const result =
      await deactivateCoreProduct(
        env,
        accountId,
        productId
      );

    return json(
      result
    );

  }


  /* =======================================================
     SERVICES
  ======================================================= */

  if (
    path === "/api/core/services" &&
    method === "GET"
  ) {

    const moduleCode =
      requireModuleCode(
        url
      );

    const result =
      await listCoreServices(
        env,
        accountId,
        moduleCode
      );

    return json(
      result
    );

  }


  if (
    path === "/api/core/services" &&
    method === "POST"
  ) {

    const body =
      await readJSON(
        request
      );

    const moduleCode =
      requireModuleCode(
        url,
        body
      );

    const result =
      await createCoreService(
        env,
        accountId,
        moduleCode,
        body
      );

    return json(
      result,
      201
    );

  }


  /* =======================================================
     SALES
  ======================================================= */

  if (
    path === "/api/core/sales" &&
    method === "GET"
  ) {

    const moduleCode =
      requireModuleCode(
        url
      );

    const result =
      await listCoreSales(
        env,
        accountId,
        moduleCode,
        {
          limit:
            url.searchParams.get(
              "limit"
            ) || 100
        }
      );

    return json(
      result
    );

  }


  if (
    path === "/api/core/sales" &&
    method === "POST"
  ) {

    const body =
      await readJSON(
        request
      );

    const moduleCode =
      requireModuleCode(
        url,
        body
      );

    const result =
      await createCoreSale(
        env,
        accountId,
        moduleCode,
        body
      );

    return json(
      result,
      201
    );

  }


  const saleMatch =
    path.match(
      /^\/api\/core\/sales\/(\d+)$/
    );


  if (
    saleMatch &&
    method === "GET"
  ) {

    const saleId =
      Number(
        saleMatch[1]
      );

    const sale =
      await getCoreSale(
        env,
        accountId,
        saleId
      );

    if (!sale) {
      return json({
        success: false,
        error:
          "Sale not found"
      }, 404);
    }

    return json({
      success: true,
      sale
    });

  }


  /* =======================================================
     EXPENSES
  ======================================================= */

  if (
    path === "/api/core/expenses" &&
    method === "GET"
  ) {

    const moduleCode =
      requireModuleCode(
        url
      );

    const result =
      await listCoreExpenses(
        env,
        accountId,
        moduleCode
      );

    return json(
      result
    );

  }


  if (
    path === "/api/core/expenses" &&
    method === "POST"
  ) {

    const body =
      await readJSON(
        request
      );

    const moduleCode =
      requireModuleCode(
        url,
        body
      );

    const result =
      await createCoreExpense(
        env,
        accountId,
        moduleCode,
        body
      );

    return json(
      result,
      201
    );

  }


  /* =======================================================
     PAYMENTS
  ======================================================= */

  if (
    path === "/api/core/payments" &&
    method === "GET"
  ) {

    const result =
      await listCorePayments(
        env,
        accountId
      );

    return json(
      result
    );

  }


  if (
    path === "/api/core/payments" &&
    method === "POST"
  ) {

    const body =
      await readJSON(
        request
      );

    const result =
      await createCorePayment(
        env,
        accountId,
        body
      );

    return json(
      result,
      201
    );

  }


  /* =======================================================
     STAFF
  ======================================================= */

  if (
    path === "/api/core/staff" &&
    method === "GET"
  ) {

    const result =
      await listCoreStaff(
        env,
        accountId
      );

    return json(
      result
    );

  }


  if (
    path === "/api/core/staff" &&
    method === "POST"
  ) {

    const body =
      await readJSON(
        request
      );

    const result =
      await createCoreStaff(
        env,
        accountId,
        body
      );

    return json(
      result,
      201
    );

  }


  /* =======================================================
     DOCUMENTS
  ======================================================= */

  if (
    path === "/api/core/documents" &&
    method === "GET"
  ) {

    const moduleCode =
      getModuleCode(
        url
      ) || null;

    const result =
      await listCoreDocuments(
        env,
        accountId,
        moduleCode
      );

    return json(
      result
    );

  }


  /* =======================================================
     NOTIFICATIONS
  ======================================================= */

  if (
    path === "/api/core/notifications" &&
    method === "POST"
  ) {

    const body =
      await readJSON(
        request
      );

    const result =
      await createCoreNotification(
        env,
        accountId,
        body
      );

    return json(
      result,
      201
    );

  }


  /* =======================================================
     ACTIVITY
  ======================================================= */

  if (
    path === "/api/core/activity" &&
    method === "GET"
  ) {

    const result =
      await listCoreActivity(
        env,
        accountId,
        {
          limit:
            url.searchParams.get(
              "limit"
            ) || 100
        }
      );

    return json(
      result
    );

  }


  /* =======================================================
     ECOMMERCE INITIALISATION
  ======================================================= */

  if (
    path.startsWith(
      "/api/core/ecommerce"
    )
  ) {

    /*
     * Make sure Ecommerce tables exist before
     * handling any Ecommerce request.
     */

    await ensureEcommerceTables(
      env
    );


    /* =====================================================
       ECOMMERCE DASHBOARD
    ===================================================== */

    if (
      (
        path ===
        "/api/core/ecommerce/dashboard"
      ) &&
      method === "GET"
    ) {

      const result =
        await getEcommerceDashboard(
          env,
          accountId
        );

      return json(
        result
      );

    }


    /* =====================================================
       ECOMMERCE STATUS
    ===================================================== */

    if (
      (
        path ===
        "/api/core/ecommerce/status"
      ) &&
      method === "GET"
    ) {

      const result =
        await getEcommerceDashboard(
          env,
          accountId
        );

      return json({
        success: true,
        ecommerce: result
      });

    }


    /* =====================================================
       ECOMMERCE STORE
    ===================================================== */

    if (
      path ===
      "/api/core/ecommerce/store"
    ) {

      if (method === "GET") {

        const store =
          await getEcommerceStore(
            env,
            accountId
          );

        return json({
          success: true,
          store
        });

      }


      if (
        method === "POST" ||
        method === "PUT" ||
        method === "PATCH"
      ) {

        const body =
          await readJSON(
            request
          );

        const result =
          await saveEcommerceStore(
            env,
            accountId,
            body
          );

        return json(
          result
        );

      }

    }


    /* =====================================================
       ECOMMERCE CATEGORIES
    ===================================================== */

    if (
      path ===
      "/api/core/ecommerce/categories"
    ) {

      if (method === "GET") {

        const result =
          await listEcommerceCategories(
            env,
            accountId
          );

        return json(
          result
        );

      }


      if (method === "POST") {

        const body =
          await readJSON(
            request
          );

        const result =
          await createEcommerceCategory(
            env,
            accountId,
            body
          );

        return json(
          result,
          201
        );

      }

    }


    const ecommerceCategoryMatch =
      path.match(
        /^\/api\/core\/ecommerce\/categories\/(\d+)$/
      );


    if (
      ecommerceCategoryMatch &&
      (
        method === "PATCH" ||
        method === "PUT"
      )
    ) {

      const categoryId =
        Number(
          ecommerceCategoryMatch[1]
        );

      const body =
        await readJSON(
          request
        );

      const result =
        await updateEcommerceCategory(
          env,
          accountId,
          categoryId,
          body
        );

      return json(
        result
      );

    }


    if (
      ecommerceCategoryMatch &&
      method === "DELETE"
    ) {

      const categoryId =
        Number(
          ecommerceCategoryMatch[1]
        );

      const result =
        await deleteEcommerceCategory(
          env,
          accountId,
          categoryId
        );

      return json(
        result
      );

    }


    /* =====================================================
       ECOMMERCE PRODUCT MEDIA
    ===================================================== */

    if (
      path ===
      "/api/core/ecommerce/media"
    ) {

      if (method === "GET") {

        const productId =
          url.searchParams.get(
            "product_id"
          );

        const result =
          await listEcommerceMedia(
            env,
            accountId,
            productId
          );

        return json(
          result
        );

      }


      if (method === "POST") {

        const body =
          await readJSON(
            request
          );

        const result =
          await createEcommerceMedia(
            env,
            accountId,
            body
          );

        return json(
          result,
          201
        );

      }

    }


    const ecommerceMediaMatch =
      path.match(
        /^\/api\/core\/ecommerce\/media\/(\d+)$/
      );


    if (
      ecommerceMediaMatch &&
      (
        method === "PATCH" ||
        method === "PUT"
      )
    ) {

      const mediaId =
        Number(
          ecommerceMediaMatch[1]
        );

      const body =
        await readJSON(
          request
        );

      const result =
        await updateEcommerceMedia(
          env,
          accountId,
          mediaId,
          body
        );

      return json(
        result
      );

    }


    if (
      ecommerceMediaMatch &&
      method === "DELETE"
    ) {

      const mediaId =
        Number(
          ecommerceMediaMatch[1]
        );

      const result =
        await deleteEcommerceMedia(
          env,
          accountId,
          mediaId
        );

      return json(
        result
      );

    }


    /* =====================================================
       WHATSAPP PRODUCT MEDIA
    ===================================================== */

    if (
      path ===
      "/api/core/ecommerce/whatsapp-media" &&
      method === "GET"
    ) {

      const result =
        await listWhatsAppProductMedia(
          env,
          accountId
        );

      return json(
        result
      );

    }


    /* =====================================================
       ECOMMERCE ORDERS
    ===================================================== */

    if (
      path ===
      "/api/core/ecommerce/orders"
    ) {

      if (method === "GET") {

        const result =
          await listEcommerceOrders(
            env,
            accountId,
            {
              status:
                url.searchParams.get(
                  "status"
                ) || "",

              payment_status:
                url.searchParams.get(
                  "payment_status"
                ) || "",

              limit:
                url.searchParams.get(
                  "limit"
                ) || 100,

              offset:
                url.searchParams.get(
                  "offset"
                ) || 0
            }
          );

        return json(
          result
        );

      }


      if (method === "POST") {

        const body =
          await readJSON(
            request
          );

        const result =
          await createEcommerceOrder(
            env,
            accountId,
            body
          );

        return json(
          result,
          201
        );

      }

    }


    const ecommerceOrderMatch =
      path.match(
        /^\/api\/core\/ecommerce\/orders\/(\d+)$/
      );


    if (
      ecommerceOrderMatch &&
      method === "GET"
    ) {

      const orderId =
        Number(
          ecommerceOrderMatch[1]
        );

      const result =
        await getEcommerceOrder(
          env,
          accountId,
          orderId
        );

      if (
        !result ||
        result.success === false
      ) {

        return json({
          success: false,
          error:
            "Order not found"
        }, 404);

      }

      return json(
        result
      );

    }


    if (
      ecommerceOrderMatch &&
      (
        method === "PATCH" ||
        method === "PUT"
      )
    ) {

      const orderId =
        Number(
          ecommerceOrderMatch[1]
        );

      const body =
        await readJSON(
          request
        );

      const result =
        await updateEcommerceOrder(
          env,
          accountId,
          orderId,
          body
        );

      return json(
        result
      );

    }


    /* =====================================================
       UNKNOWN ECOMMERCE ROUTE
    ===================================================== */

    return json({
      success: false,
      error:
        "Ecommerce endpoint not found"
    }, 404);

  }


  /* =======================================================
     NO CORE ROUTE MATCH
  ======================================================= */

  return null;

}


/* =========================================================
   CORE ROUTE ERROR HELPER
========================================================= */

export function coreRouteError(
  json,
  error
) {

  console.error(
    "SaaS Core route error:",
    error
  );

  const message =
    error?.message ||
    String(error);

  return json({
    success: false,
    error: message
  }, 400);

}
