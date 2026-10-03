/*
 * SKY BLUE SAAS CORE API
 *
 * Shared API/business functions for all Sky Blue SaaS products.
 *
 * This file sits above saas-core.js and provides reusable
 * operations for:
 *
 * - Business profiles
 * - Customers
 * - Products
 * - Services
 * - Sales
 * - Payments
 * - Expenses
 * - Quotes
 * - Invoices
 * - Staff
 * - Documents
 * - Notifications
 * - Activity
 * - Dashboard summaries
 */

import {
  ensureSaaSCoreTables,
  getBusinessProfile,
  saveBusinessProfile,
  getSaaSDashboardSummary,
  getSaaSModuleSummary,
  logSaaSActivity,
  toMoney,
  toQuantity
} from "./saas-core.js";

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */

function accountNumber(accountId) {
  const id = Number(accountId);

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Valid accountId is required");
  }

  return id;
}

function clean(value) {
  return String(value ?? "").trim();
}

function positiveId(value, field = "id") {
  const id = Number(value);

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error(`${field} is required`);
  }

  return id;
}

function nowDate() {
  return new Date().toISOString();
}

/* ---------------------------------------------------------
   ORGANISATION RESOLUTION
--------------------------------------------------------- */

/*
 * Resolves the SaaS organisation belonging to the
 * authenticated customer account.
 *
 * Current architecture:
 *
 * customer_accounts.tenant_id
 *          ↓
 * saas_organisations.legacy_tenant_id
 *          ↓
 * saas_organisations.id
 *
 * This intentionally does NOT hard-code organisation ID 1.
 */

async function getOrganisationIdForAccount(
  env,
  accountId
) {
  const account = accountNumber(accountId);

  const organisation = await env.DB.prepare(`
    SELECT o.id
    FROM customer_accounts ca
    INNER JOIN saas_organisations o
      ON o.legacy_tenant_id = ca.tenant_id
    WHERE ca.id = ?
      AND o.status = 'active'
    LIMIT 1
  `).bind(account).first();

  if (!organisation?.id) {
    throw new Error(
      "Active organisation not found for this account"
    );
  }

  return Number(organisation.id);
}

/* ---------------------------------------------------------
   BUSINESS PROFILE
--------------------------------------------------------- */

export async function getCoreBusinessProfile(
  env,
  accountId
) {
  await ensureSaaSCoreTables(env);

  return await getBusinessProfile(
    env,
    accountNumber(accountId)
  );
}

export async function saveCoreBusinessProfile(
  env,
  accountId,
  data = {}
) {
  const account = accountNumber(accountId);

  const profile = await saveBusinessProfile(
    env,
    account,
    data
  );

  await logSaaSActivity(env, {
    accountId: account,
    action: "business_profile_updated",
    entityType: "business_profile",
    description: "Business profile updated"
  });

  return {
    success: true,
    profile
  };
}

/* ---------------------------------------------------------
   CUSTOMERS
--------------------------------------------------------- */

export async function listCoreCustomers(
  env,
  accountId,
  options = {}
) {
  const account = accountNumber(accountId);

  await ensureSaaSCoreTables(env);

  const search = clean(options.search);
  const status = clean(options.status);

  const limit = Math.min(
    Math.max(Number(options.limit || 100), 1),
    500
  );

  const offset = Math.max(
    Number(options.offset || 0),
    0
  );

  let sql = `
    SELECT *
    FROM saas_customers
    WHERE account_id = ?
  `;

  const bindings = [account];

  if (status) {
    sql += ` AND status = ?`;
    bindings.push(status);
  }

  if (search) {
    sql += `
      AND (
        first_name LIKE ?
        OR last_name LIKE ?
        OR business_name LIKE ?
        OR email LIKE ?
        OR phone LIKE ?
        OR whatsapp LIKE ?
        OR customer_code LIKE ?
      )
    `;

    const term = `%${search}%`;

    bindings.push(
      term,
      term,
      term,
      term,
      term,
      term,
      term
    );
  }

  sql += `
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT ? OFFSET ?
  `;

  bindings.push(limit, offset);

  const result = await env.DB.prepare(sql)
    .bind(...bindings)
    .all();

  return {
    success: true,
    customers: result.results || [],
    limit,
    offset
  };
}

export async function getCoreCustomer(
  env,
  accountId,
  customerId
) {
  const account = accountNumber(accountId);
  const customer = positiveId(
    customerId,
    "customerId"
  );

  await ensureSaaSCoreTables(env);

  return await env.DB.prepare(`
    SELECT *
    FROM saas_customers
    WHERE account_id = ?
      AND id = ?
    LIMIT 1
  `).bind(
    account,
    customer
  ).first();
}

export async function createCoreCustomer(
  env,
  accountId,
  data = {}
) {
  const account = accountNumber(accountId);

  await ensureSaaSCoreTables(env);

  /*
   * Resolve the organisation automatically.
   */
  const organisationId =
    await getOrganisationIdForAccount(
      env,
      account
    );

  const firstName = clean(
    data.first_name ||
    data.firstName
  );

  const lastName = clean(
    data.last_name ||
    data.lastName
  );

  const businessName = clean(
    data.business_name ||
    data.businessName
  );

  if (
    !firstName &&
    !lastName &&
    !businessName
  ) {
    throw new Error(
      "Customer name or business name is required"
    );
  }

  const customerCode =
    clean(
      data.customer_code ||
      data.customerCode
    ) ||
    `CUS-${Date.now()}`;

  const customerType =
    clean(
      data.customer_type ||
      data.customerType
    ) ||
    "individual";

  const email = clean(data.email);
  const phone = clean(data.phone);
  const whatsapp = clean(data.whatsapp);
  const address = clean(data.address);
  const city = clean(data.city);
  const province = clean(data.province);

  const postalCode = clean(
    data.postal_code ||
    data.postalCode
  );

  const notes = clean(data.notes);

  const status =
    clean(data.status) ||
    "active";

  const result = await env.DB.prepare(`
    INSERT INTO saas_customers (
      organisation_id,
      account_id,
      name,
      customer_code,
      customer_type,
      first_name,
      last_name,
      business_name,
      email,
      phone,
      whatsapp,
      address,
      city,
      province,
      postal_code,
      notes,
      status
    )
    VALUES (
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?
    )
  `).bind(
    organisationId,
    account,
    businessName ||
      `${firstName} ${lastName}`.trim(),
    customerCode,
    customerType,
    firstName,
    lastName,
    businessName,
    email,
    phone,
    whatsapp,
    address,
    city,
    province,
    postalCode,
    notes,
    status
  ).run();

  const id =
    result.meta?.last_row_id ||
    null;

  await logSaaSActivity(env, {
    accountId: account,
    action: "customer_created",
    entityType: "customer",
    entityId: id,
    description: "Customer created"
  });

  return {
    success: true,
    id,
    customer: id
      ? await getCoreCustomer(
          env,
          account,
          id
        )
      : null
  };
}

export async function updateCoreCustomer(
  env,
  accountId,
  customerId,
  data = {}
) {
  const account = accountNumber(accountId);

  const customer = positiveId(
    customerId,
    "customerId"
  );

  await ensureSaaSCoreTables(env);

  const existing =
    await getCoreCustomer(
      env,
      account,
      customer
    );

  if (!existing) {
    throw new Error(
      "Customer not found"
    );
  }

  const values = {
    customerType:
      data.customer_type ??
      data.customerType ??
      existing.customer_type,

    firstName:
      data.first_name ??
      data.firstName ??
      existing.first_name,

    lastName:
      data.last_name ??
      data.lastName ??
      existing.last_name,

    businessName:
      data.business_name ??
      data.businessName ??
      existing.business_name,

    email:
      data.email ??
      existing.email,

    phone:
      data.phone ??
      existing.phone,

    whatsapp:
      data.whatsapp ??
      existing.whatsapp,

    address:
      data.address ??
      existing.address,

    city:
      data.city ??
      existing.city,

    province:
      data.province ??
      existing.province,

    postalCode:
      data.postal_code ??
      data.postalCode ??
      existing.postal_code,

    notes:
      data.notes ??
      existing.notes,

    status:
      data.status ??
      existing.status
  };

  await env.DB.prepare(`
    UPDATE saas_customers
    SET
      customer_type = ?,
      first_name = ?,
      last_name = ?,
      business_name = ?,
      email = ?,
      phone = ?,
      whatsapp = ?,
      address = ?,
      city = ?,
      province = ?,
      postal_code = ?,
      notes = ?,
      status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE account_id = ?
      AND id = ?
  `).bind(
    clean(values.customerType),
    clean(values.firstName),
    clean(values.lastName),
    clean(values.businessName),
    clean(values.email),
    clean(values.phone),
    clean(values.whatsapp),
    clean(values.address),
    clean(values.city),
    clean(values.province),
    clean(values.postalCode),
    clean(values.notes),
    clean(values.status),
    account,
    customer
  ).run();

  await logSaaSActivity(env, {
    accountId: account,
    action: "customer_updated",
    entityType: "customer",
    entityId: customer,
    description: "Customer updated"
  });

  return {
    success: true,
    customer:
      await getCoreCustomer(
        env,
        account,
        customer
      )
  };
}

/* ---------------------------------------------------------
   PRODUCTS
--------------------------------------------------------- */

export async function listCoreProducts(
  env,
  accountId,
  moduleCode,
  options = {}
) {
  const account = accountNumber(accountId);
  const module = clean(moduleCode);

  if (!module) {
    throw new Error(
      "moduleCode is required"
    );
  }

  await ensureSaaSCoreTables(env);

  const search = clean(options.search);

  const active =
    options.active === undefined
      ? null
      : Number(options.active);

  let sql = `
    SELECT *
    FROM saas_products
    WHERE account_id = ?
      AND module_code = ?
  `;

  const bindings = [
    account,
    module
  ];

  if (active !== null) {
    sql += ` AND active = ?`;
    bindings.push(active);
  }

  if (search) {
    sql += `
      AND (
        name LIKE ?
        OR sku LIKE ?
        OR product_code LIKE ?
        OR category LIKE ?
      )
    `;

    const term = `%${search}%`;

    bindings.push(
      term,
      term,
      term,
      term
    );
  }

  sql += `
    ORDER BY name ASC, id DESC
    LIMIT 500
  `;

  const result =
    await env.DB.prepare(sql)
      .bind(...bindings)
      .all();

  return {
    success: true,
    products:
      result.results || []
  };
}

export async function getCoreProduct(
  env,
  accountId,
  productId
) {
  const account =
    accountNumber(accountId);

  const product =
    positiveId(
      productId,
      "productId"
    );

  await ensureSaaSCoreTables(env);

  return await env.DB.prepare(`
    SELECT *
    FROM saas_products
    WHERE account_id = ?
      AND id = ?
    LIMIT 1
  `).bind(
    account,
    product
  ).first();
}

export async function createCoreProduct(
  env,
  accountId,
  moduleCode,
  data = {}
) {
  const account =
    accountNumber(accountId);

  const module =
    clean(moduleCode);

  if (!module) {
    throw new Error(
      "moduleCode is required"
    );
  }

  const name =
    clean(data.name);

  if (!name) {
    throw new Error(
      "Product name is required"
    );
  }

  await ensureSaaSCoreTables(env);

  const result =
    await env.DB.prepare(`
      INSERT INTO saas_products (
        account_id,
        module_code,
        product_code,
        sku,
        name,
        category,
        description,
        image_url,
        unit,
        cost_price,
        selling_price,
        wholesale_price,
        stock_quantity,
        low_stock_level,
        reorder_level,
        track_inventory,
        active
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).bind(
      account,
      module,
      clean(
        data.product_code ||
        data.productCode
      ),
      clean(data.sku),
      name,
      clean(data.category),
      clean(data.description),
      clean(
        data.image_url ||
        data.imageUrl
      ),
      clean(data.unit) ||
        "unit",
      toMoney(
        data.cost_price ??
        data.costPrice
      ),
      toMoney(
        data.selling_price ??
        data.sellingPrice
      ),
      toMoney(
        data.wholesale_price ??
        data.wholesalePrice
      ),
      toQuantity(
        data.stock_quantity ??
        data.stockQuantity
      ),
      toQuantity(
        data.low_stock_level ??
        data.lowStockLevel
      ),
      toQuantity(
        data.reorder_level ??
        data.reorderLevel
      ),
      data.track_inventory === false ||
      data.trackInventory === false
        ? 0
        : 1,
      data.active === 0 ||
      data.active === false
        ? 0
        : 1
    ).run();

  const id =
    result.meta?.last_row_id ||
    null;

  await logSaaSActivity(env, {
    accountId: account,
    moduleCode: module,
    action: "product_created",
    entityType: "product",
    entityId: id,
    description:
      `Product created: ${name}`
  });

  return {
    success: true,
    id,
    product: id
      ? await getCoreProduct(
          env,
          account,
          id
        )
      : null
  };
}

export async function updateCoreProduct(
  env,
  accountId,
  productId,
  data = {}
) {
  const account =
    accountNumber(accountId);

  const product =
    positiveId(
      productId,
      "productId"
    );

  await ensureSaaSCoreTables(env);

  const existing =
    await getCoreProduct(
      env,
      account,
      product
    );

  if (!existing) {
    throw new Error(
      "Product not found"
    );
  }

  await env.DB.prepare(`
    UPDATE saas_products
    SET
      product_code = ?,
      sku = ?,
      name = ?,
      category = ?,
      description = ?,
      image_url = ?,
      unit = ?,
      cost_price = ?,
      selling_price = ?,
      wholesale_price = ?,
      stock_quantity = ?,
      low_stock_level = ?,
      reorder_level = ?,
      track_inventory = ?,
      active = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE account_id = ?
      AND id = ?
  `).bind(
    clean(
      data.product_code ??
      data.productCode ??
      existing.product_code
    ),
    clean(
      data.sku ??
      existing.sku
    ),
    clean(
      data.name ??
      existing.name
    ),
    clean(
      data.category ??
      existing.category
    ),
    clean(
      data.description ??
      existing.description
    ),
    clean(
      data.image_url ??
      data.imageUrl ??
      existing.image_url
    ),
    clean(
      data.unit ??
      existing.unit
    ),
    toMoney(
      data.cost_price ??
      data.costPrice ??
      existing.cost_price
    ),
    toMoney(
      data.selling_price ??
      data.sellingPrice ??
      existing.selling_price
    ),
    toMoney(
      data.wholesale_price ??
      data.wholesalePrice ??
      existing.wholesale_price
    ),
    toQuantity(
      data.stock_quantity ??
      data.stockQuantity ??
      existing.stock_quantity
    ),
    toQuantity(
      data.low_stock_level ??
      data.lowStockLevel ??
      existing.low_stock_level
    ),
    toQuantity(
      data.reorder_level ??
      data.reorderLevel ??
      existing.reorder_level
    ),
    data.track_inventory === undefined &&
    data.trackInventory === undefined
      ? Number(
          existing.track_inventory || 0
        )
      : (
          data.track_inventory === false ||
          data.trackInventory === false
            ? 0
            : 1
        ),
    data.active === undefined
      ? Number(existing.active || 0)
      : (
          data.active === false ||
          data.active === 0
            ? 0
            : 1
        ),
    account,
    product
  ).run();

  await logSaaSActivity(env, {
    accountId: account,
    action: "product_updated",
    entityType: "product",
    entityId: product,
    description:
      "Product updated"
  });

  return {
    success: true,
    product:
      await getCoreProduct(
        env,
        account,
        product
      )
  };
}

/* ---------------------------------------------------------
   SERVICES
--------------------------------------------------------- */

export async function listCoreServices(
  env,
  accountId,
  moduleCode
) {
  const account =
    accountNumber(accountId);

  const module =
    clean(moduleCode);

  if (!module) {
    throw new Error(
      "moduleCode is required"
    );
  }

  await ensureSaaSCoreTables(env);

  const result =
    await env.DB.prepare(`
      SELECT *
      FROM saas_services
      WHERE account_id = ?
        AND module_code = ?
      ORDER BY name ASC, id DESC
    `).bind(
      account,
      module
    ).all();

  return {
    success: true,
    services:
      result.results || []
  };
}

export async function createCoreService(
  env,
  accountId,
  moduleCode,
  data = {}
) {
  const account =
    accountNumber(accountId);

  const module =
    clean(moduleCode);

  const name =
    clean(data.name);

  if (!module) {
    throw new Error(
      "moduleCode is required"
    );
  }

  if (!name) {
    throw new Error(
      "Service name is required"
    );
  }

  await ensureSaaSCoreTables(env);

  const result =
    await env.DB.prepare(`
      INSERT INTO saas_services (
        account_id,
        module_code,
        service_code,
        name,
        category,
        description,
        duration_minutes,
        price,
        active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      account,
      module,
      clean(
        data.service_code ||
        data.serviceCode
      ),
      name,
      clean(data.category),
      clean(data.description),
      Number(
        data.duration_minutes ??
        data.durationMinutes ??
        0
      ),
      toMoney(data.price),
      data.active === false
        ? 0
        : 1
    ).run();

  const id =
    result.meta?.last_row_id ||
    null;

  await logSaaSActivity(env, {
    accountId: account,
    moduleCode: module,
    action: "service_created",
    entityType: "service",
    entityId: id,
    description:
      `Service created: ${name}`
  });

  return {
    success: true,
    id
  };
}

/* ---------------------------------------------------------
   SALES
--------------------------------------------------------- */

export async function listCoreSales(
  env,
  accountId,
  moduleCode,
  options = {}
) {
  const account =
    accountNumber(accountId);

  const module =
    clean(moduleCode);

  if (!module) {
    throw new Error(
      "moduleCode is required"
    );
  }

  await ensureSaaSCoreTables(env);

  const limit =
    Math.min(
      Math.max(
        Number(options.limit || 100),
        1
      ),
      500
    );

  const result =
    await env.DB.prepare(`
      SELECT
        s.*,
        c.first_name,
        c.last_name,
        c.business_name,
        c.phone AS customer_phone
      FROM saas_sales s
      LEFT JOIN saas_customers c
        ON c.id = s.customer_id
       AND c.account_id = s.account_id
      WHERE s.account_id = ?
        AND s.module_code = ?
      ORDER BY
        datetime(s.created_at) DESC,
        s.id DESC
      LIMIT ?
    `).bind(
      account,
      module,
      limit
    ).all();

  return {
    success: true,
    sales:
      result.results || []
  };
}

export async function getCoreSale(
  env,
  accountId,
  saleId
) {
  const account =
    accountNumber(accountId);

  const sale =
    positiveId(
      saleId,
      "saleId"
    );

  await ensureSaaSCoreTables(env);

  const header =
    await env.DB.prepare(`
      SELECT *
      FROM saas_sales
      WHERE account_id = ?
        AND id = ?
      LIMIT 1
    `).bind(
      account,
      sale
    ).first();

  if (!header) {
    return null;
  }

  const items =
    await env.DB.prepare(`
      SELECT *
      FROM saas_sale_items
      WHERE account_id = ?
        AND sale_id = ?
      ORDER BY id ASC
    `).bind(
      account,
      sale
    ).all();

  return {
    ...header,
    items:
      items.results || []
  };
}

export async function createCoreSale(
  env,
  accountId,
  moduleCode,
  data = {}
) {
  const account =
    accountNumber(accountId);

  const module =
    clean(moduleCode);

  if (!module) {
    throw new Error(
      "moduleCode is required"
    );
  }

  await ensureSaaSCoreTables(env);

  const saleNumber =
    clean(
      data.sale_number ||
      data.saleNumber
    ) ||
    `SALE-${Date.now()}`;

  const items =
    Array.isArray(data.items)
      ? data.items
      : [];

  let subtotal = 0;

  for (const item of items) {
    const quantity =
      toQuantity(
        item.quantity || 1
      );

    const unitPrice =
      toMoney(
        item.unit_price ??
        item.unitPrice
      );

    const discount =
      toMoney(
        item.discount_amount ??
        item.discountAmount
      );

    subtotal +=
      quantity * unitPrice -
      discount;
  }

  subtotal =
    toMoney(subtotal);

  const discountAmount =
    toMoney(
      data.discount_amount ??
      data.discountAmount
    );

  const taxAmount =
    toMoney(
      data.tax_amount ??
      data.taxAmount
    );

  const deliveryAmount =
    toMoney(
      data.delivery_amount ??
      data.deliveryAmount
    );

  const totalAmount =
    toMoney(
      data.total_amount ??
      data.totalAmount ??
      (
        subtotal -
        discountAmount +
        taxAmount +
        deliveryAmount
      )
    );

  const customerId =
    data.customer_id ??
    data.customerId;

  const result =
    await env.DB.prepare(`
      INSERT INTO saas_sales (
        account_id,
        module_code,
        sale_number,
        customer_id,
        sale_type,
        status,
        payment_status,
        subtotal,
        discount_amount,
        tax_amount,
        delivery_amount,
        total_amount,
        payment_method,
        reference,
        source,
        notes,
        sale_date
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?
      )
    `).bind(
      account,
      module,
      saleNumber,
      customerId
        ? Number(customerId)
        : null,
      clean(
        data.sale_type ||
        data.saleType
      ) || "sale",
      clean(data.status) ||
        "completed",
      clean(
        data.payment_status ||
        data.paymentStatus
      ) || "pending",
      subtotal,
      discountAmount,
      taxAmount,
      deliveryAmount,
      totalAmount,
      clean(
        data.payment_method ||
        data.paymentMethod
      ),
      clean(data.reference),
      clean(data.source) ||
        "dashboard",
      clean(data.notes),
      clean(
        data.sale_date ||
        data.saleDate
      ) || nowDate()
    ).run();

  const saleId =
    result.meta?.last_row_id ||
    null;

  if (saleId) {
    for (const item of items) {
      const quantity =
        toQuantity(
          item.quantity || 1
        );

      const unitPrice =
        toMoney(
          item.unit_price ??
          item.unitPrice
        );

      const discount =
        toMoney(
          item.discount_amount ??
          item.discountAmount
        );

      const tax =
        toMoney(
          item.tax_amount ??
          item.taxAmount
        );

      const total =
        toMoney(
          item.total_amount ??
          item.totalAmount ??
          (
            quantity *
              unitPrice -
            discount +
            tax
          )
        );

      const productId =
        item.product_id ??
        item.productId;

      const serviceId =
        item.service_id ??
        item.serviceId;

      await env.DB.prepare(`
        INSERT INTO saas_sale_items (
          account_id,
          sale_id,
          product_id,
          service_id,
          description,
          quantity,
          unit_price,
          discount_amount,
          tax_amount,
          total_amount
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        account,
        saleId,
        productId
          ? Number(productId)
          : null,
        serviceId
          ? Number(serviceId)
          : null,
        clean(item.description),
        quantity,
        unitPrice,
        discount,
        tax,
        total
      ).run();
    }
  }

  await logSaaSActivity(env, {
    accountId: account,
    moduleCode: module,
    action: "sale_created",
    entityType: "sale",
    entityId: saleId,
    description:
      `Sale created: ${saleNumber}`,
    metadata: {
      total_amount:
        totalAmount
    }
  });

  return {
    success: true,
    id: saleId,
    sale: saleId
      ? await getCoreSale(
          env,
          account,
          saleId
        )
      : null
  };
}

/* ---------------------------------------------------------
   EXPENSES
--------------------------------------------------------- */

export async function listCoreExpenses(
  env,
  accountId,
  moduleCode
) {
  const account =
    accountNumber(accountId);

  const module =
    clean(moduleCode);

  if (!module) {
    throw new Error(
      "moduleCode is required"
    );
  }

  await ensureSaaSCoreTables(env);

  const result =
    await env.DB.prepare(`
      SELECT *
      FROM saas_expenses
      WHERE account_id = ?
        AND module_code = ?
      ORDER BY
        datetime(created_at) DESC,
        id DESC
      LIMIT 500
    `).bind(
      account,
      module
    ).all();

  return {
    success: true,
    expenses:
      result.results || []
  };
}

export async function createCoreExpense(
  env,
  accountId,
  moduleCode,
  data = {}
) {
  const account =
    accountNumber(accountId);

  const module =
    clean(moduleCode);

  if (!module) {
    throw new Error(
      "moduleCode is required"
    );
  }

  const amount =
    toMoney(data.amount);

  if (amount < 0) {
    throw new Error(
      "Expense amount cannot be negative"
    );
  }

  await ensureSaaSCoreTables(env);

  const expenseNumber =
    clean(
      data.expense_number ||
      data.expenseNumber
    ) ||
    `EXP-${Date.now()}`;

  const result =
    await env.DB.prepare(`
      INSERT INTO saas_expenses (
        account_id,
        module_code,
        expense_number,
        category,
        description,
        supplier_name,
        amount,
        payment_method,
        reference,
        expense_date,
        status,
        notes
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).bind(
      account,
      module,
      expenseNumber,
      clean(data.category),
      clean(data.description),
      clean(
        data.supplier_name ||
        data.supplierName
      ),
      amount,
      clean(
        data.payment_method ||
        data.paymentMethod
      ),
      clean(data.reference),
      clean(
        data.expense_date ||
        data.expenseDate
      ) || nowDate(),
      clean(data.status) ||
        "paid",
      clean(data.notes)
    ).run();

  const id =
    result.meta?.last_row_id ||
    null;

  await logSaaSActivity(env, {
    accountId: account,
    moduleCode: module,
    action: "expense_created",
    entityType: "expense",
    entityId: id,
    description:
      `Expense created: ${expenseNumber}`,
    metadata: {
      amount
    }
  });

  return {
    success: true,
    id
  };
}

/* ---------------------------------------------------------
   PAYMENTS
--------------------------------------------------------- */

export async function listCorePayments(
  env,
  accountId
) {
  const account =
    accountNumber(accountId);

  await ensureSaaSCoreTables(env);

  const result =
    await env.DB.prepare(`
      SELECT *
      FROM saas_business_payments
      WHERE account_id = ?
      ORDER BY
        datetime(created_at) DESC,
        id DESC
      LIMIT 500
    `).bind(account).all();

  return {
    success: true,
    payments:
      result.results || []
  };
}

export async function createCorePayment(
  env,
  accountId,
  data = {}
) {
  const account =
    accountNumber(accountId);

  const amount =
    toMoney(data.amount);

  if (amount <= 0) {
    throw new Error(
      "Payment amount must be greater than zero"
    );
  }

  await ensureSaaSCoreTables(env);

  const customerId =
    data.customer_id ??
    data.customerId;

  const saleId =
    data.sale_id ??
    data.saleId;

  const invoiceId =
    data.invoice_id ??
    data.invoiceId;

  const result =
    await env.DB.prepare(`
      INSERT INTO saas_business_payments (
        account_id,
        customer_id,
        sale_id,
        invoice_id,
        amount,
        payment_method,
        payment_provider,
        provider_reference,
        internal_reference,
        status,
        paid_at,
        notes
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).bind(
      account,
      customerId
        ? Number(customerId)
        : null,
      saleId
        ? Number(saleId)
        : null,
      invoiceId
        ? Number(invoiceId)
        : null,
      amount,
      clean(
        data.payment_method ||
        data.paymentMethod
      ),
      clean(
        data.payment_provider ||
        data.paymentProvider
      ),
      clean(
        data.provider_reference ||
        data.providerReference
      ),
      clean(
        data.internal_reference ||
        data.internalReference
      ),
      clean(data.status) ||
        "paid",
      clean(
        data.paid_at ||
        data.paidAt
      ) || nowDate(),
      clean(data.notes)
    ).run();

  const id =
    result.meta?.last_row_id ||
    null;

  await logSaaSActivity(env, {
    accountId: account,
    action: "payment_recorded",
    entityType: "payment",
    entityId: id,
    description:
      "Business payment recorded",
    metadata: {
      amount
    }
  });

  return {
    success: true,
    id
  };
}

/* ---------------------------------------------------------
   STAFF
--------------------------------------------------------- */

export async function listCoreStaff(
  env,
  accountId
) {
  const account =
    accountNumber(accountId);

  await ensureSaaSCoreTables(env);

  const result =
    await env.DB.prepare(`
      SELECT *
      FROM saas_staff
      WHERE account_id = ?
      ORDER BY full_name ASC, id ASC
    `).bind(account).all();

  return {
    success: true,
    staff:
      result.results || []
  };
}

export async function createCoreStaff(
  env,
  accountId,
  data = {}
) {
  const account =
    accountNumber(accountId);

  const name =
    clean(
      data.full_name ||
      data.fullName
    );

  if (!name) {
    throw new Error(
      "Staff name is required"
    );
  }

  await ensureSaaSCoreTables(env);

  const result =
    await env.DB.prepare(`
      INSERT INTO saas_staff (
        account_id,
        full_name,
        email,
        phone,
        job_title,
        department,
        role_code,
        status,
        start_date,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      account,
      name,
      clean(data.email),
      clean(data.phone),
      clean(
        data.job_title ||
        data.jobTitle
      ),
      clean(data.department),
      clean(
        data.role_code ||
        data.roleCode
      ) || "staff",
      clean(data.status) ||
        "active",
      clean(
        data.start_date ||
        data.startDate
      ),
      clean(data.notes)
    ).run();

  const id =
    result.meta?.last_row_id ||
    null;

  await logSaaSActivity(env, {
    accountId: account,
    action: "staff_created",
    entityType: "staff",
    entityId: id,
    description:
      `Staff member created: ${name}`
  });

  return {
    success: true,
    id
  };
}

/* ---------------------------------------------------------
   DOCUMENTS
--------------------------------------------------------- */

export async function listCoreDocuments(
  env,
  accountId,
  moduleCode = null
) {
  const account =
    accountNumber(accountId);

  await ensureSaaSCoreTables(env);

  let sql = `
    SELECT *
    FROM saas_documents
    WHERE account_id = ?
  `;

  const bindings = [account];

  if (moduleCode) {
    sql +=
      ` AND module_code = ?`;

    bindings.push(
      clean(moduleCode)
    );
  }

  sql += `
    ORDER BY
      datetime(created_at) DESC,
      id DESC
    LIMIT 500
  `;

  const result =
    await env.DB.prepare(sql)
      .bind(...bindings)
      .all();

  return {
    success: true,
    documents:
      result.results || []
  };
}

/* ---------------------------------------------------------
   NOTIFICATIONS
--------------------------------------------------------- */

export async function createCoreNotification(
  env,
  accountId,
  data = {}
) {
  const account =
    accountNumber(accountId);

  const title =
    clean(data.title);

  if (!title) {
    throw new Error(
      "Notification title is required"
    );
  }

  const message =
    clean(data.message);

  if (!message) {
    throw new Error(
      "Notification message is required"
    );
  }

  await ensureSaaSCoreTables(env);

  const customerId =
    data.customer_id ??
    data.customerId;

  const result =
    await env.DB.prepare(`
      INSERT INTO saas_notifications (
        account_id,
        module_code,
        customer_id,
        channel,
        notification_type,
        title,
        message,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      account,
      clean(
        data.module_code ||
        data.moduleCode
      ),
      customerId
        ? Number(customerId)
        : null,
      clean(data.channel) ||
        "dashboard",
      clean(
        data.notification_type ||
        data.notificationType
      ),
      title,
      message,
      clean(data.status) ||
        "pending"
    ).run();

  return {
    success: true,
    id:
      result.meta?.last_row_id ||
      null
  };
}

/* ---------------------------------------------------------
   ACTIVITY
--------------------------------------------------------- */

export async function listCoreActivity(
  env,
  accountId,
  options = {}
) {
  const account =
    accountNumber(accountId);

  await ensureSaaSCoreTables(env);

  const limit =
    Math.min(
      Math.max(
        Number(options.limit || 100),
        1
      ),
      500
    );

  const result =
    await env.DB.prepare(`
      SELECT *
      FROM saas_activity_log
      WHERE account_id = ?
      ORDER BY
        datetime(created_at) DESC,
        id DESC
      LIMIT ?
    `).bind(
      account,
      limit
    ).all();

  return {
    success: true,
    activity:
      result.results || []
  };
}

/* ---------------------------------------------------------
   DASHBOARD
--------------------------------------------------------- */

export async function getCoreDashboard(
  env,
  accountId,
  moduleCode = null
) {
  const account =
    accountNumber(accountId);

  if (moduleCode) {
    return await getSaaSModuleSummary(
      env,
      account,
      clean(moduleCode)
    );
  }

  return await getSaaSDashboardSummary(
    env,
    account
  );
}

/* ---------------------------------------------------------
   COMPLETE CORE STATUS
--------------------------------------------------------- */

export async function getCoreSystemStatus(
  env,
  accountId
) {
  const account =
    accountNumber(accountId);

  await ensureSaaSCoreTables(env);

  const profile =
    await getBusinessProfile(
      env,
      account
    );

  const dashboard =
    await getSaaSDashboardSummary(
      env,
      account
    );

  return {
    success: true,
    account_id: account,
    profile,
    dashboard
  };
}

/* ---------------------------------------------------------
   DELETE / DEACTIVATE HELPERS
--------------------------------------------------------- */

export async function deactivateCoreProduct(
  env,
  accountId,
  productId
) {
  const account =
    accountNumber(accountId);

  const product =
    positiveId(
      productId,
      "productId"
    );

  await ensureSaaSCoreTables(env);

  await env.DB.prepare(`
    UPDATE saas_products
    SET
      active = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE account_id = ?
      AND id = ?
  `).bind(
    account,
    product
  ).run();

  await logSaaSActivity(env, {
    accountId: account,
    action: "product_deactivated",
    entityType: "product",
    entityId: product,
    description:
      "Product deactivated"
  });

  return {
    success: true,
    id: product,
    active: false
  };
}

export async function deactivateCoreCustomer(
  env,
  accountId,
  customerId
) {
  const account =
    accountNumber(accountId);

  const customer =
    positiveId(
      customerId,
      "customerId"
    );

  await ensureSaaSCoreTables(env);

  await env.DB.prepare(`
    UPDATE saas_customers
    SET
      status = 'inactive',
      updated_at = CURRENT_TIMESTAMP
    WHERE account_id = ?
      AND id = ?
  `).bind(
    account,
    customer
  ).run();

  await logSaaSActivity(env, {
    accountId: account,
    action: "customer_deactivated",
    entityType: "customer",
    entityId: customer,
    description:
      "Customer deactivated"
  });

  return {
    success: true,
    id: customer,
    status: "inactive"
  };
  }
