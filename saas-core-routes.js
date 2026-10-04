/*
 * ============================================================
 * SKY BLUE DIGITAL SERVICE
 * SAAS CORE ROUTES
 * ============================================================
 *
 * Central API router for the Sky Blue SaaS platform.
 *
 * Uses the ACTUAL exports from:
 *
 * - saas-core-api.js
 * - ecommerce-core-api.js
 *
 * Includes:
 * - Business profiles
 * - Customers
 * - Products
 * - Services
 * - Sales
 * - Expenses
 * - Payments
 * - Staff
 * - Documents
 * - Notifications
 * - Activity
 * - Dashboard
 * - Ecommerce
 *
 * Multi-tenant:
 * Every request is restricted to account_id.
 * ============================================================
 */

import {
  getCoreBusinessProfile,
  saveCoreBusinessProfile,

  listCoreCustomers,
  getCoreCustomer,
  createCoreCustomer,
  updateCoreCustomer,

  listCoreProducts,
  getCoreProduct,
  createCoreProduct,
  updateCoreProduct,

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

  getCoreSystemStatus,

  deactivateCoreProduct,
  deactivateCoreCustomer
} from "./saas-core-api.js";

import {
  ensureEcommerceTables,
  ensureEcommerceProductColumns,

  getEcommerceStore,
  saveEcommerceStore,

  listEcommerceCategories,
  createEcommerceCategory,
  updateEcommerceCategory,
  deleteEcommerceCategory,

  listEcommerceProducts,
  getEcommerceProduct,
  createEcommerceProduct,
  updateEcommerceProduct,
  deleteEcommerceProduct,

  listEcommerceVariants,
  createEcommerceVariant,
  updateEcommerceVariant,
  deleteEcommerceVariant,

  listEcommerceMedia,
  createEcommerceMedia,
  updateEcommerceMedia,
  deleteEcommerceMedia,

  listWhatsAppProductMedia,

  listEcommerceStockMovements,

  setEcommerceRelatedProducts,

  listEcommerceOrders,
  getEcommerceOrder,
  createEcommerceOrder,
  updateEcommerceOrder,

  getEcommerceDashboard
} from "./ecommerce-core-api.js";

/* ============================================================
 * HELPERS
 * ============================================================
 */

function clean(value, fallback = "") {
  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  return String(value).trim();
}

function accountIdFromAccount(account) {
  const id = Number(
    account?.id ??
    account?.account_id ??
    account
  );

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
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

function positiveId(
  value,
  field = "id"
) {
  const id = Number(value);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new Error(
      `Valid ${field} is required`
    );
  }

  return id;
}

function getModuleCode(request) {
  const url = new URL(request.url);

  return clean(
    url.searchParams.get(
      "module_code"
    )
  );
}

function requireModuleCode(request) {
  const moduleCode =
    getModuleCode(request);

  if (!moduleCode) {
    throw new Error(
      "module_code is required"
    );
  }

  return moduleCode;
}

function jsonResponse(
  data,
  status = 200
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8"
      }
    }
  );
}

/* ============================================================
 * MAIN ROUTER
 * ============================================================
 */

export async function handleSaaSCoreRoute(
  request,
  env,
  account
) {
  try {
    const accountId =
      accountIdFromAccount(account);

    if (!accountId) {
      return jsonResponse(
        {
          success: false,
          error:
            "Valid account session is required"
        },
        401
      );
    }

    const url =
      new URL(request.url);

    const path =
      url.pathname;

    const method =
      request.method.toUpperCase();

    /* ========================================================
     * ECOMMERCE INITIALISATION
     * ========================================================
     */

    if (
      path.startsWith(
        "/api/core/ecommerce"
      )
    ) {
      await ensureEcommerceTables(
        env
      );

      await ensureEcommerceProductColumns(
        env
      );
    }

    /* ========================================================
     * CORE STATUS
     * ========================================================
     */

    if (
      path === "/api/core/status" &&
      method === "GET"
    ) {
      const result =
        await getCoreSystemStatus(
          env,
          accountId
        );

      return jsonResponse(
        result
      );
    }

    /* ========================================================
     * BUSINESS PROFILE
     * ========================================================
     */

    if (
      path === "/api/core/business"
    ) {
      if (method === "GET") {
        const profile =
          await getCoreBusinessProfile(
            env,
            accountId
          );

        return jsonResponse({
          success: true,
          profile
        });
      }

      if (
        method === "POST" ||
        method === "PUT" ||
        method === "PATCH"
      ) {
        const body =
          await readJSON(request);

        const result =
          await saveCoreBusinessProfile(
            env,
            accountId,
            body
          );

        return jsonResponse(
          result
        );
      }
    }

    /* ========================================================
     * CORE DASHBOARD
     * ========================================================
     */

    if (
      path === "/api/core/dashboard" &&
      method === "GET"
    ) {
      const moduleCode =
        getModuleCode(request);

      const result =
        await getCoreDashboard(
          env,
          accountId,
          moduleCode || null
        );

      return jsonResponse(
        result
      );
    }

    /* ========================================================
     * CUSTOMERS
     * ========================================================
     */

    if (
      path === "/api/core/customers"
    ) {
      if (method === "GET") {
        const result =
          await listCoreCustomers(
            env,
            accountId,
            {
              search:
                url.searchParams.get(
                  "search"
                ),

              status:
                url.searchParams.get(
                  "status"
                ),

              limit:
                url.searchParams.get(
                  "limit"
                ),

              offset:
                url.searchParams.get(
                  "offset"
                )
            }
          );

        return jsonResponse(
          result
        );
      }

      if (method === "POST") {
        const body =
          await readJSON(request);

        const result =
          await createCoreCustomer(
            env,
            accountId,
            body
          );

        return jsonResponse(
          result,
          201
        );
      }
    }

    const customerMatch =
      path.match(
        /^\/api\/core\/customers\/(\d+)$/
      );

    if (customerMatch) {
      const customerId =
        positiveId(
          customerMatch[1],
          "customer_id"
        );

      if (method === "GET") {
        const customer =
          await getCoreCustomer(
            env,
            accountId,
            customerId
          );

        if (!customer) {
          return jsonResponse(
            {
              success: false,
              error:
                "Customer not found"
            },
            404
          );
        }

        return jsonResponse({
          success: true,
          customer
        });
      }

      if (
        method === "PUT" ||
        method === "PATCH"
      ) {
        const body =
          await readJSON(request);

        const result =
          await updateCoreCustomer(
            env,
            accountId,
            customerId,
            body
          );

        return jsonResponse(
          result
        );
      }

      if (method === "DELETE") {
        const result =
          await deactivateCoreCustomer(
            env,
            accountId,
            customerId
          );

        return jsonResponse(
          result
        );
      }
    }

    /* ========================================================
     * STANDARD PRODUCTS
     * ========================================================
     */

    if (
      path === "/api/core/products"
    ) {
      if (method === "GET") {
        const moduleCode =
          requireModuleCode(
            request
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
                ),

              active:
                url.searchParams.get(
                  "active"
                )
            }
          );

        return jsonResponse(
          result
        );
      }

      if (method === "POST") {
        const body =
          await readJSON(request);

        const moduleCode =
          clean(
            body.module_code ||
            body.moduleCode
          );

        if (!moduleCode) {
          throw new Error(
            "module_code is required"
          );
        }

        const result =
          await createCoreProduct(
            env,
            accountId,
            moduleCode,
            body
          );

        return jsonResponse(
          result,
          201
        );
      }
    }

    const productMatch =
      path.match(
        /^\/api\/core\/products\/(\d+)$/
      );

    if (productMatch) {
      const productId =
        positiveId(
          productMatch[1],
          "product_id"
        );

      if (method === "GET") {
        const product =
          await getCoreProduct(
            env,
            accountId,
            productId
          );

        if (!product) {
          return jsonResponse(
            {
              success: false,
              error:
                "Product not found"
            },
            404
          );
        }

        return jsonResponse({
          success: true,
          product
        });
      }

      if (
        method === "PUT" ||
        method === "PATCH"
      ) {
        const body =
          await readJSON(request);

        const result =
          await updateCoreProduct(
            env,
            accountId,
            productId,
            body
          );

        return jsonResponse(
          result
        );
      }

      if (method === "DELETE") {
        const result =
          await deactivateCoreProduct(
            env,
            accountId,
            productId
          );

        return jsonResponse(
          result
        );
      }
    }

    /* ========================================================
     * SERVICES
     * ========================================================
     */

    if (
      path === "/api/core/services"
    ) {
      if (method === "GET") {
        const moduleCode =
          requireModuleCode(
            request
          );

        const result =
          await listCoreServices(
            env,
            accountId,
            moduleCode
          );

        return jsonResponse(
          result
        );
      }

      if (method === "POST") {
        const body =
          await readJSON(request);

        const moduleCode =
          clean(
            body.module_code ||
            body.moduleCode
          );

        if (!moduleCode) {
          throw new Error(
            "module_code is required"
          );
        }

        const result =
          await createCoreService(
            env,
            accountId,
            moduleCode,
            body
          );

        return jsonResponse(
          result,
          201
        );
      }
    }

    /* ========================================================
     * SALES
     * ========================================================
     */

    if (
      path === "/api/core/sales"
    ) {
      if (method === "GET") {
        const moduleCode =
          requireModuleCode(
            request
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
                )
            }
          );

        return jsonResponse(
          result
        );
      }

      if (method === "POST") {
        const body =
          await readJSON(request);

        const moduleCode =
          clean(
            body.module_code ||
            body.moduleCode
          );

        if (!moduleCode) {
          throw new Error(
            "module_code is required"
          );
        }

        const result =
          await createCoreSale(
            env,
            accountId,
            moduleCode,
            body
          );

        return jsonResponse(
          result,
          201
        );
      }
    }

    const saleMatch =
      path.match(
        /^\/api\/core\/sales\/(\d+)$/
      );

    if (saleMatch) {
      const saleId =
        positiveId(
          saleMatch[1],
          "sale_id"
        );

      if (method === "GET") {
        const sale =
          await getCoreSale(
            env,
            accountId,
            saleId
          );

        if (!sale) {
          return jsonResponse(
            {
              success: false,
              error:
                "Sale not found"
            },
            404
          );
        }

        return jsonResponse({
          success: true,
          sale
        });
      }
    }

    /* ========================================================
     * EXPENSES
     * ========================================================
     */

    if (
      path === "/api/core/expenses"
    ) {
      if (method === "GET") {
        const moduleCode =
          requireModuleCode(
            request
          );

        const result =
          await listCoreExpenses(
            env,
            accountId,
            moduleCode
          );

        return jsonResponse(
          result
        );
      }

      if (method === "POST") {
        const body =
          await readJSON(request);

        const moduleCode =
          clean(
            body.module_code ||
            body.moduleCode
          );

        if (!moduleCode) {
          throw new Error(
            "module_code is required"
          );
        }

        const result =
          await createCoreExpense(
            env,
            accountId,
            moduleCode,
            body
          );

        return jsonResponse(
          result,
          201
        );
      }
    }

    /* ========================================================
     * PAYMENTS
     * ========================================================
     */

    if (
      path === "/api/core/payments"
    ) {
      if (method === "GET") {
        const result =
          await listCorePayments(
            env,
            accountId
          );

        return jsonResponse(
          result
        );
      }

      if (method === "POST") {
        const body =
          await readJSON(request);

        const result =
          await createCorePayment(
            env,
            accountId,
            body
          );

        return jsonResponse(
          result,
          201
        );
      }
    }

    /* ========================================================
     * STAFF
     * ========================================================
     */

    if (
      path === "/api/core/staff"
    ) {
      if (method === "GET") {
        const result =
          await listCoreStaff(
            env,
            accountId
          );

        return jsonResponse(
          result
        );
      }

      if (method === "POST") {
        const body =
          await readJSON(request);

        const result =
          await createCoreStaff(
            env,
            accountId,
            body
          );

        return jsonResponse(
          result,
          201
        );
      }
    }

    /* ========================================================
     * DOCUMENTS
     * ========================================================
     */

    if (
      path === "/api/core/documents" &&
      method === "GET"
    ) {
      const moduleCode =
        getModuleCode(request);

      const result =
        await listCoreDocuments(
          env,
          accountId,
          moduleCode || null
        );

      return jsonResponse(
        result
      );
    }

    /* ========================================================
     * NOTIFICATIONS
     * ========================================================
     */

    if (
      path ===
        "/api/core/notifications" &&
      method === "POST"
    ) {
      const body =
        await readJSON(request);

      const result =
        await createCoreNotification(
          env,
          accountId,
          body
        );

      return jsonResponse(
        result,
        201
      );
    }

    /* ========================================================
     * ACTIVITY
     * ========================================================
     */

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
              )
          }
        );

      return jsonResponse(
        result
      );
    }

    /* ========================================================
     * ========================================================
     * ECOMMERCE
     * ========================================================
     * ========================================================
     */

    /* ========================================================
     * ECOMMERCE DASHBOARD
     * ========================================================
     */

    if (
      path ===
        "/api/core/ecommerce/dashboard" &&
      method === "GET"
    ) {
      const result =
        await getEcommerceDashboard(
          env,
          accountId
        );

      return jsonResponse(
        result
      );
    }

    /* ========================================================
     * ECOMMERCE STATUS
     * ========================================================
     */

    if (
      path ===
        "/api/core/ecommerce/status" &&
      method === "GET"
    ) {
      const result =
        await getEcommerceDashboard(
          env,
          accountId
        );

      return jsonResponse({
        success: true,
        ecommerce: result
      });
    }

    /* ========================================================
     * ECOMMERCE STORE
     * ========================================================
     */

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

        return jsonResponse({
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
          await readJSON(request);

        const store =
          await saveEcommerceStore(
            env,
            accountId,
            body
          );

        return jsonResponse({
          success: true,
          store
        });
      }
    }

    /* ========================================================
     * ECOMMERCE CATEGORIES
     * ========================================================
     */

    if (
      path ===
        "/api/core/ecommerce/categories"
    ) {
      if (method === "GET") {
        const result =
          await listEcommerceCategories(
            env,
            accountId,
            {
              active_only:
                url.searchParams.get(
                  "active_only"
                )
            }
          );

        return jsonResponse({
          success: true,
          categories:
            result.results || []
        });
      }

      if (method === "POST") {
        const body =
          await readJSON(request);

        const category =
          await createEcommerceCategory(
            env,
            accountId,
            body
          );

        return jsonResponse({
          success: true,
          category
        }, 201);
      }
    }

    const ecommerceCategoryMatch =
      path.match(
        /^\/api\/core\/ecommerce\/categories\/(\d+)$/
      );

    if (ecommerceCategoryMatch) {
      const categoryId =
        positiveId(
          ecommerceCategoryMatch[1],
          "category_id"
        );

      if (
        method === "PUT" ||
        method === "PATCH"
      ) {
        const body =
          await readJSON(request);

        const category =
          await updateEcommerceCategory(
            env,
            accountId,
            categoryId,
            body
          );

        return jsonResponse({
          success: true,
          category
        });
      }

      if (method === "DELETE") {
        const result =
          await deleteEcommerceCategory(
            env,
            accountId,
            categoryId
          );

        return jsonResponse(
          result
        );
      }
    }

    /* ========================================================
     * ECOMMERCE PRODUCTS
     * ========================================================
     */

    if (
      path ===
        "/api/core/ecommerce/products"
    ) {
      if (method === "GET") {
        const result =
          await listEcommerceProducts(
            env,
            accountId,
            {
              search:
                url.searchParams.get(
                  "search"
                ),

              category_id:
                url.searchParams.get(
                  "category_id"
                ),

              status:
                url.searchParams.get(
                  "status"
                ),

              visibility:
                url.searchParams.get(
                  "visibility"
                ),

              featured:
                url.searchParams.get(
                  "featured"
                ),

              limit:
                url.searchParams.get(
                  "limit"
                ),

              offset:
                url.searchParams.get(
                  "offset"
                )
            }
          );

        return jsonResponse({
          success: true,
          products:
            result.results || [],
          count:
            result.results?.length || 0
        });
      }

      if (method === "POST") {
        const body =
          await readJSON(request);

        const product =
          await createEcommerceProduct(
            env,
            accountId,
            body
          );

        return jsonResponse({
          success: true,
          product
        }, 201);
      }
    }

    const ecommerceProductMatch =
      path.match(
        /^\/api\/core\/ecommerce\/products\/(\d+)$/
      );

    if (ecommerceProductMatch) {
      const productId =
        positiveId(
          ecommerceProductMatch[1],
          "product_id"
        );

      if (method === "GET") {
        const product =
          await getEcommerceProduct(
            env,
            accountId,
            productId
          );

        if (!product) {
          return jsonResponse(
            {
              success: false,
              error:
                "Product not found"
            },
            404
          );
        }

        return jsonResponse({
          success: true,
          product
        });
      }

      if (
        method === "PUT" ||
        method === "PATCH"
      ) {
        const body =
          await readJSON(request);

        const product =
          await updateEcommerceProduct(
            env,
            accountId,
            productId,
            body
          );

        return jsonResponse({
          success: true,
          product
        });
      }

      if (method === "DELETE") {
        const result =
          await deleteEcommerceProduct(
            env,
            accountId,
            productId
          );

        return jsonResponse(
          result
        );
      }
    }

    /* ========================================================
     * ECOMMERCE VARIANTS
     * ========================================================
     */

    const variantsProductMatch =
      path.match(
        /^\/api\/core\/ecommerce\/products\/(\d+)\/variants$/
      );

    if (variantsProductMatch) {
      const productId =
        positiveId(
          variantsProductMatch[1],
          "product_id"
        );

      if (method === "GET") {
        const result =
          await listEcommerceVariants(
            env,
            accountId,
            productId
          );

        return jsonResponse({
          success: true,
          variants:
            result.results || []
        });
      }

      if (method === "POST") {
        const body =
          await readJSON(request);

        const variant =
          await createEcommerceVariant(
            env,
            accountId,
            productId,
            body
          );

        return jsonResponse({
          success: true,
          variant
        }, 201);
      }
    }

    const ecommerceVariantMatch =
      path.match(
        /^\/api\/core\/ecommerce\/variants\/(\d+)$/
      );

    if (ecommerceVariantMatch) {
      const variantId =
        positiveId(
          ecommerceVariantMatch[1],
          "variant_id"
        );

      if (
        method === "PUT" ||
        method === "PATCH"
      ) {
        const body =
          await readJSON(request);

        const variant =
          await updateEcommerceVariant(
            env,
            accountId,
            variantId,
            body
          );

        return jsonResponse({
          success: true,
          variant
        });
      }

      if (method === "DELETE") {
        const result =
          await deleteEcommerceVariant(
            env,
            accountId,
            variantId
          );

        return jsonResponse(
          result
        );
      }
    }

    /* ========================================================
     * ECOMMERCE MEDIA
     * ========================================================
     */

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

        return jsonResponse({
          success: true,
          media:
            result.results || []
        });
      }

      if (method === "POST") {
        const body =
          await readJSON(request);

        const media =
          await createEcommerceMedia(
            env,
            accountId,
            body
          );

        return jsonResponse({
          success: true,
          media
        }, 201);
      }
    }

    const ecommerceMediaMatch =
      path.match(
        /^\/api\/core\/ecommerce\/media\/(\d+)$/
      );

    if (ecommerceMediaMatch) {
      const mediaId =
        positiveId(
          ecommerceMediaMatch[1],
          "media_id"
        );

      if (
        method === "PUT" ||
        method === "PATCH"
      ) {
        const body =
          await readJSON(request);

        const media =
          await updateEcommerceMedia(
            env,
            accountId,
            mediaId,
            body
          );

        return jsonResponse({
          success: true,
          media
        });
      }

      if (method === "DELETE") {
        const result =
          await deleteEcommerceMedia(
            env,
            accountId,
            mediaId
          );

        return jsonResponse(
          result
        );
      }
    }

    /* ========================================================
     * WHATSAPP PRODUCT MEDIA
     * ========================================================
     */

    if (
      path ===
        "/api/core/ecommerce/whatsapp-media" &&
      method === "GET"
    ) {
      const productId =
        url.searchParams.get(
          "product_id"
        );

      const result =
        await listWhatsAppProductMedia(
          env,
          accountId,
          {
            product_id:
              productId
          }
        );

      return jsonResponse({
        success: true,
        media:
          result.results || []
      });
    }

    /* ========================================================
     * STOCK HISTORY
     * ========================================================
     */

    if (
      path ===
        "/api/core/ecommerce/stock" &&
      method === "GET"
    ) {
      const result =
        await listEcommerceStockMovements(
          env,
          accountId,
          {
            product_id:
              url.searchParams.get(
                "product_id"
              ),

            variant_id:
              url.searchParams.get(
                "variant_id"
              )
          }
        );

      return jsonResponse({
        success: true,
        movements:
          result.results || []
      });
    }

    /* ========================================================
     * RELATED PRODUCTS
     * ========================================================
     */

    const relatedProductMatch =
      path.match(
        /^\/api\/core\/ecommerce\/products\/(\d+)\/related$/
      );

    if (relatedProductMatch) {
      const productId =
        positiveId(
          relatedProductMatch[1],
          "product_id"
        );

      if (
        method === "POST" ||
        method === "PUT" ||
        method === "PATCH"
      ) {
        const body =
          await readJSON(request);

        const relatedIds =
          Array.isArray(
            body.related_product_ids
          )
            ? body.related_product_ids
            : Array.isArray(
                body.products
              )
            ? body.products
            : [];

        const result =
          await setEcommerceRelatedProducts(
            env,
            accountId,
            productId,
            relatedIds,
            clean(
              body.relation_type,
              "related"
            )
          );

        return jsonResponse({
          success: true,
          related_products:
            result.results ||
            []
        });
      }
    }

    /* ========================================================
     * ECOMMERCE ORDERS
     * ========================================================
     */

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
                ),

              payment_status:
                url.searchParams.get(
                  "payment_status"
                ),

              limit:
                url.searchParams.get(
                  "limit"
                )
            }
          );

        return jsonResponse({
          success: true,
          orders:
            result.results || [],
          count:
            result.results?.length || 0
        });
      }

      if (method === "POST") {
        const body =
          await readJSON(request);

        const order =
          await createEcommerceOrder(
            env,
            accountId,
            body
          );

        return jsonResponse({
          success: true,
          order
        }, 201);
      }
    }

    const ecommerceOrderMatch =
      path.match(
        /^\/api\/core\/ecommerce\/orders\/(\d+)$/
      );

    if (ecommerceOrderMatch) {
      const orderId =
        positiveId(
          ecommerceOrderMatch[1],
          "order_id"
        );

      if (method === "GET") {
        const order =
          await getEcommerceOrder(
            env,
            accountId,
            orderId
          );

        if (!order) {
          return jsonResponse(
            {
              success: false,
              error:
                "Order not found"
            },
            404
          );
        }

        return jsonResponse({
          success: true,
          order
        });
      }

      if (
        method === "PUT" ||
        method === "PATCH"
      ) {
        const body =
          await readJSON(request);

        const order =
          await updateEcommerceOrder(
            env,
            accountId,
            orderId,
            body
          );

        return jsonResponse({
          success: true,
          order
        });
      }
    }

    /* ========================================================
     * UNKNOWN ECOMMERCE ROUTE
     * ========================================================
     */

    if (
      path.startsWith(
        "/api/core/ecommerce"
      )
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Ecommerce endpoint not found"
        },
        404
      );
    }

    /* ========================================================
     * UNKNOWN CORE ROUTE
     * ========================================================
     */

    return jsonResponse(
      {
        success: false,
        error:
          "Core API endpoint not found"
      },
      404
    );

  } catch (error) {
    return coreRouteError(
      error
    );
  }
}

/* ============================================================
 * ERROR HANDLER
 * ============================================================
 */

export function coreRouteError(
  error
) {
  console.error(
    "Sky Blue Core API Error:",
    error
  );

  const message =
    error?.message ||
    "Internal server error";

  let status = 500;

  if (
    message.includes("required") ||
    message.includes("not found")
  ) {
    status = 400;
  }

  return jsonResponse(
    {
      success: false,
      error: message
    },
    status
  );
  }
