/*
 * ============================================================
 * SKY BLUE DIGITAL SERVICE
 * SAAS CORE ROUTES
 * ============================================================
 *
 * Central API router for the Sky Blue SaaS platform.
 *
 * Includes:
 * - SaaS core
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
 *
 * Ecommerce:
 * - Store
 * - Categories
 * - Products
 * - Variants
 * - Images
 * - Videos
 * - WhatsApp media
 * - Stock history
 * - Related products
 * - Orders
 * - Ecommerce dashboard
 *
 * Multi-tenant:
 * Every request is restricted to account_id.
 * ============================================================
 */

import {
  getBusinessProfile,
  saveBusinessProfile,

  listCustomers,
  createCustomer,
  getCustomer,
  updateCustomer,
  deleteCustomer,

  listProducts,
  createProduct,
  getProduct,
  updateProduct,
  deleteProduct,

  listServices,
  createService,

  listSales,
  createSale,
  getSale,

  listExpenses,
  createExpense,

  listPayments,
  createPayment,

  listStaff,
  createStaff,

  listDocuments,

  createNotification,

  listActivity,

  getDashboard,

  getSystemStatus
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
  if (value === undefined || value === null) {
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

  if (!Number.isInteger(id) || id <= 0) {
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

function getModuleCode(request) {
  const url = new URL(request.url);

  return clean(
    url.searchParams.get(
      "module_code"
    )
  );
}

function requireModuleCode(
  request,
  expected = null
) {
  const moduleCode =
    getModuleCode(request);

  if (!moduleCode) {
    throw new Error(
      "module_code is required"
    );
  }

  if (
    expected &&
    moduleCode !== expected
  ) {
    throw new Error(
      `module_code must be ${expected}`
    );
  }

  return moduleCode;
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

    const url = new URL(
      request.url
    );

    const path =
      url.pathname;

    const method =
      request.method.toUpperCase();

    /*
     * ========================================================
     * INITIALISE ECOMMERCE SCHEMA
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
        await getSystemStatus(
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
          await getBusinessProfile(
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

        const profile =
          await saveBusinessProfile(
            env,
            accountId,
            body
          );

        return jsonResponse({
          success: true,
          profile
        });
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
      const result =
        await getDashboard(
          env,
          accountId
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
          await listCustomers(
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
          await createCustomer(
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
        const result =
          await getCustomer(
            env,
            accountId,
            customerId
          );

        return jsonResponse({
          success: true,
          customer: result
        });
      }

      if (
        method === "PUT" ||
        method === "PATCH"
      ) {
        const body =
          await readJSON(request);

        const result =
          await updateCustomer(
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
          await deleteCustomer(
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
     *
     * Kept for the general SaaS core.
     * Ecommerce uses the dedicated ecommerce routes below.
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
          await listProducts(
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
            body.module_code
          );

        if (!moduleCode) {
          throw new Error(
            "module_code is required"
          );
        }

        const result =
          await createProduct(
            env,
            accountId,
            {
              ...body,
              module_code:
                moduleCode
            }
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
        const moduleCode =
          requireModuleCode(
            request
          );

        const result =
          await getProduct(
            env,
            accountId,
            productId,
            moduleCode
          );

        return jsonResponse(
          result
        );
      }

      if (
        method === "PUT" ||
        method === "PATCH"
      ) {
        const body =
          await readJSON(request);

        const result =
          await updateProduct(
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
          await deleteProduct(
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
        const result =
          await listServices(
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
          await createService(
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
     * SALES
     * ========================================================
     */

    if (
      path === "/api/core/sales"
    ) {
      if (method === "GET") {
        const result =
          await listSales(
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
          await createSale(
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
        const result =
          await getSale(
            env,
            accountId,
            saleId
          );

        return jsonResponse(
          result
        );
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
        const result =
          await listExpenses(
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
          await createExpense(
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
     * PAYMENTS
     * ========================================================
     */

    if (
      path === "/api/core/payments"
    ) {
      if (method === "GET") {
        const result =
          await listPayments(
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
          await createPayment(
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
          await listStaff(
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
          await createStaff(
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
      const result =
        await listDocuments(
          env,
          accountId
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
        await createNotification(
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
        await listActivity(
          env,
          accountId
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
      const dashboard =
        await getEcommerceDashboard(
          env,
          accountId
        );

      return jsonResponse({
        success: true,
        ecommerce: dashboard
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
        const options = {
          active_only:
            url.searchParams.get(
              "active_only"
            )
        };

        const result =
          await listEcommerceCategories(
            env,
            accountId,
            options
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
        const options = {
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
        };

        const result =
          await listEcommerceProducts(
            env,
            accountId,
            options
          );

        return jsonResponse({
          success: true,
          products:
            result.results || [],
          count:
            result.results?.length ||
            0
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
     * WHATSAPP MEDIA
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
        "/api/core/ecommerce/stock"
      &&
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
            result.results?.length ||
            0
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

  const status =
    message.includes(
      "required"
    ) ||
    message.includes(
      "not found"
    )
      ? 400
      : 500;

  return jsonResponse(
    {
      success: false,
      error: message
    },
    status
  );
}
