/*
 * SKY BLUE SAAS CORE ROUTES
 *
 * HTTP route layer for the shared Sky Blue SaaS Core API.
 *
 * This file connects:
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


/*
 * The module code is required for records that belong
 * to a specific industry module.
 *
 * Examples:
 *
 * pharmacy
 * salon-barber
 * laundry
 * ecommerce
 * food-business
 * wholesale-grocery
 * etc.
 */
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
