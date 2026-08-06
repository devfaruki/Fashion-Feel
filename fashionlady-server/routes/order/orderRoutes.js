const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prismaClient");

function toPositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return null;
  return parsed > 0 ? parsed : null;
}

function normalizePhone(phone) {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, ""); // Remove all non-digits
  if (cleaned.startsWith("880")) {
    cleaned = cleaned.substring(2); // Remove '88' but keep '0' -> '01...'
  }
  if (cleaned.length === 10 && !cleaned.startsWith("0")) {
    cleaned = "0" + cleaned;
  }
  return cleaned;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function extractOrderItems(items) {
  if (!Array.isArray(items)) return [];
  const merged = new Map();

  for (const item of items) {
    if (!item) continue;
    const rawId = item.productId ?? item.id ?? item.product_id;
    const productId = Number.parseInt(rawId, 10);
    const quantity = toPositiveInt(item.quantity) ?? 1;
    if (Number.isNaN(productId) || productId < 1) continue;
    const selection = getOrderItemSelection(item);
    const key = `${productId}::${selection.size}::${selection.color}`;
    const existing = merged.get(key);
    merged.set(key, {
      productId,
      quantity: (existing?.quantity || 0) + quantity,
      size: selection.size,
      color: selection.color,
    });
  }

  return Array.from(merged.values());
}

function normalizeVariantText(value) {
  return String(value || "").trim().toLowerCase();
}

function getOrderItemSelection(item) {
  const explicitSize = item.variantSize ?? item.selectedSize ?? item.sizeName;
  const explicitColor = item.variantColor ?? item.selectedColor ?? item.color;

  if (explicitSize || explicitColor) {
    return {
      size: normalizeText(explicitSize),
      color: normalizeText(explicitColor),
    };
  }

  const label = normalizeText(item.size);
  const parts = label.split("/").map((part) => part.trim()).filter(Boolean);
  return {
    size: parts[0] || label,
    color: parts.length > 1 ? parts.slice(1).join(" / ") : "",
  };
}

function getActiveVariants(product) {
  return Array.isArray(product.variants)
    ? product.variants.filter((variant) => variant && variant.active !== false)
    : [];
}

function getVariantStock(variant) {
  const qty = Number.parseInt(variant?.openingStock ?? 0, 10);
  return Number.isNaN(qty) || qty < 0 ? 0 : qty;
}

function getVariantStockTotal(variants) {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  return variants
    .filter((variant) => variant && variant.active !== false)
    .reduce((total, variant) => total + getVariantStock(variant), 0);
}

function findVariantIndex(product, item) {
  const variants = getActiveVariants(product);
  if (variants.length === 0) return -1;
  const size = normalizeVariantText(item.size);
  const color = normalizeVariantText(item.color);

  let index = variants.findIndex(
    (variant) =>
      normalizeVariantText(variant.size) === size &&
      normalizeVariantText(variant.color) === color,
  );

  if (index === -1 && !color) {
    index = variants.findIndex((variant) => normalizeVariantText(variant.size) === size);
  }

  if (index === -1) return -1;
  const originalVariants = Array.isArray(product.variants) ? product.variants : [];
  return originalVariants.findIndex((variant) => variant === variants[index]);
}

function updateVariantStock(product, item, delta) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const variantIndex = findVariantIndex(product, item);
  if (variantIndex < 0) return null;

  const nextVariants = variants.map((variant, index) => {
    if (index !== variantIndex) return variant;
    const nextStock = Math.max(0, getVariantStock(variant) + delta);
    return {
      ...variant,
      openingStock: String(nextStock),
    };
  });

  return {
    variants: nextVariants,
    stockQty: getVariantStockTotal(nextVariants) ?? 0,
  };
}

async function ensureStockAvailability(tx, orderItems) {
  const productIds = orderItems.map((item) => item.productId);
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      stockQty: true,
      stockReserved: true,
      variants: true,
    },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));

  const missing = orderItems.filter((item) => !productMap.has(item.productId));
  if (missing.length > 0) {
    const error = new Error("PRODUCT_NOT_FOUND");
    error.details = missing.map((item) => item.productId);
    throw error;
  }

  const insufficient = [];
  for (const item of orderItems) {
    const product = productMap.get(item.productId);
    const activeVariants = getActiveVariants(product);
    const variantIndex = findVariantIndex(product, item);
    const available =
      activeVariants.length > 0
        ? variantIndex >= 0
          ? getVariantStock(product.variants[variantIndex])
          : 0
        : Math.max(0, product.stockQty ?? 0);
    if (
      activeVariants.length > 0 &&
      variantIndex < 0
    ) {
      insufficient.push({
        productId: item.productId,
        product_name: product.name,
        size: item.size,
        color: item.color,
        requested: item.quantity,
        available: 0,
        reason: "Variant not found",
      });
      continue;
    }

    if (item.quantity > available) {
      insufficient.push({
        productId: item.productId,
        product_name: product.name,
        size: item.size,
        color: item.color,
        requested: item.quantity,
        available,
      });
    }
  }

  if (insufficient.length > 0) {
    const error = new Error("INSUFFICIENT_STOCK");
    error.details = insufficient;
    throw error;
  }

  return productMap;
}

async function reserveStock(tx, orderItems) {
  const productMap = await ensureStockAvailability(tx, orderItems);
  for (const item of orderItems) {
    const product = productMap.get(item.productId);
    const variantStockUpdate = updateVariantStock(product, item, -item.quantity);
    if (variantStockUpdate) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          variants: variantStockUpdate.variants,
          stockQty: variantStockUpdate.stockQty,
          stockReserved: { increment: item.quantity },
          stock: variantStockUpdate.stockQty > 0 ? "available" : "unavailable",
        },
      });
      product.variants = variantStockUpdate.variants;
      product.stockQty = variantStockUpdate.stockQty;
      product.stockReserved = (product.stockReserved ?? 0) + item.quantity;
      continue;
    }

    await tx.product.update({
      where: { id: item.productId },
      data: {
        stockQty: { decrement: item.quantity },
        stockReserved: { increment: item.quantity },
      },
    });
  }
}

async function finalizeStock(tx, orderItems) {
  for (const item of orderItems) {
    await tx.product.update({
      where: { id: item.productId },
      data: {
        stockReserved: { decrement: item.quantity },
      },
    });
  }
}

async function finalizeStockDirect(tx, orderItems) {
  const productMap = await ensureStockAvailability(tx, orderItems);
  for (const item of orderItems) {
    const product = productMap.get(item.productId);
    const variantStockUpdate = updateVariantStock(product, item, -item.quantity);
    if (variantStockUpdate) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          variants: variantStockUpdate.variants,
          stockQty: variantStockUpdate.stockQty,
          stock: variantStockUpdate.stockQty > 0 ? "available" : "unavailable",
        },
      });
      product.variants = variantStockUpdate.variants;
      product.stockQty = variantStockUpdate.stockQty;
      continue;
    }

    await tx.product.update({
      where: { id: item.productId },
      data: {
        stockQty: { decrement: item.quantity },
      },
    });
  }
}

async function releaseStock(tx, orderItems) {
  const productIds = orderItems.map((item) => item.productId);
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      variants: true,
      stockQty: true,
      stockReserved: true,
    },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));

  for (const item of orderItems) {
    const product = productMap.get(item.productId);
    const variantStockUpdate = product ? updateVariantStock(product, item, item.quantity) : null;
    if (variantStockUpdate) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          variants: variantStockUpdate.variants,
          stockQty: variantStockUpdate.stockQty,
          stockReserved: { decrement: item.quantity },
          stock: variantStockUpdate.stockQty > 0 ? "available" : "unavailable",
        },
      });
      product.variants = variantStockUpdate.variants;
      product.stockQty = variantStockUpdate.stockQty;
      product.stockReserved = Math.max(0, (product.stockReserved ?? 0) - item.quantity);
      continue;
    }

    await tx.product.update({
      where: { id: item.productId },
      data: {
        stockQty: { increment: item.quantity },
        stockReserved: { decrement: item.quantity },
      },
    });
  }
}

async function createOrderFromBody(body) {
  if (!body || Object.keys(body).length === 0) {
    const error = new Error("ORDER_DATA_REQUIRED");
    throw error;
  }

  if (!body.name || String(body.name).trim().length < 2) {
    const error = new Error("CUSTOMER_NAME_REQUIRED");
    throw error;
  }

  if (!body.phone) {
    const error = new Error("CUSTOMER_PHONE_REQUIRED");
    throw error;
  }

  if (!body.address || String(body.address).trim().length < 3) {
    const error = new Error("CUSTOMER_ADDRESS_REQUIRED");
    throw error;
  }

  const saleSource = normalizeText(body.saleSource || "ONLINE").toUpperCase() || "ONLINE";
  const isOfflineSale = saleSource === "OFFLINE";

  if (!isOfflineSale) {
    if (!body.district || normalizeText(body.district).length < 2) {
      const error = new Error("CUSTOMER_DISTRICT_REQUIRED");
      throw error;
    }

    if (!body.thana || normalizeText(body.thana).length < 2) {
      const error = new Error("CUSTOMER_THANA_REQUIRED");
      throw error;
    }
  }

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    const error = new Error("ORDER_ITEMS_REQUIRED");
    throw error;
  }

  const orderItems = extractOrderItems(body.items);
  if (orderItems.length === 0) {
    const error = new Error("INVALID_ORDER_ITEMS");
    throw error;
  }

  await prisma.$transaction(async (tx) => {
    await ensureStockAvailability(tx, orderItems);
  });

  const result = await prisma.$transaction(async (tx) => {
    const normalizedPhone = normalizePhone(body.phone);
    const normalizedDistrict = normalizeText(body.district);
    const normalizedThana = normalizeText(body.thana);
    const customer = await tx.customer.upsert({
      where: { phone: normalizedPhone },
      update: {
        name: normalizeText(body.name),
        address: normalizeText(body.address),
        district: isOfflineSale ? null : normalizedDistrict,
        thana: isOfflineSale ? null : normalizedThana,
      },
      create: {
        name: normalizeText(body.name),
        phone: normalizedPhone,
        address: normalizeText(body.address),
        district: isOfflineSale ? null : normalizedDistrict,
        thana: isOfflineSale ? null : normalizedThana,
      },
    });

    const order = await tx.order.create({
      data: {
        customerId: customer.id,
        totalPrice: Number(body.totalPrice) || 0,
        deliveryCharge: Number(body.deliveryCharge) || 0,
        district: isOfflineSale ? null : normalizedDistrict,
        thana: isOfflineSale ? null : normalizedThana,
        saleSource,
        orderStatus: isOfflineSale ? "PAID" : body.orderStatus || "PENDING",
        paymentMethod: body.paymentMethod || "CASHON",
        items: body.items,
        note: body.note || null,
      },
      include: {
        customer: true,
      },
    });

    return order;
  });

  return result;
}

/**
 * Generate a random 4-digit order number between 1000-9999
 */
function generate4DigitOrderNumber() {
  return Math.floor(1000 + Math.random() * 9000);
}

// POST /api/orders — creates customer + order in one call
router.post("/add-order", async (req, res) => {
  try {
    const body = req.body;

    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "Order data is required",
      });
    }

    // Validate customer fields
    if (!body.name || String(body.name).trim().length < 2) {
      return res.status(400).json({
        status: "fail",
        message: "Customer name is required",
      });
    }

    if (!body.phone) {
      return res.status(400).json({
        status: "fail",
        message: "Customer phone is required",
      });
    }

    if (!body.address || String(body.address).trim().length < 3) {
      return res.status(400).json({
        status: "fail",
        message: "Customer address is required",
      });
    }

    if (!body.district || normalizeText(body.district).length < 2) {
      return res.status(400).json({
        status: "fail",
        message: "Customer district is required",
      });
    }

    if (!body.thana || normalizeText(body.thana).length < 2) {
      return res.status(400).json({
        status: "fail",
        message: "Customer thana/upazila is required",
      });
    }

    if (
      !body.items ||
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      return res.status(400).json({
        status: "fail",
        message: "Order must contain at least one item",
      });
    }

    const orderItems = extractOrderItems(body.items);
    if (orderItems.length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "Order items are invalid",
      });
    }

    // Pre-check stock availability outside the main transaction
    try {
      await prisma.$transaction(async (tx) => {
        await ensureStockAvailability(tx, orderItems);
      });
    } catch (error) {
      if (error.message === "PRODUCT_NOT_FOUND") {
        return res.status(404).json({
          status: "fail",
          message: "One or more products not found",
          data: error.details,
        });
      }

      if (error.message === "INSUFFICIENT_STOCK") {
        return res.status(409).json({
          status: "fail",
          message: "Insufficient stock for one or more items",
          data: error.details,
        });
      }

      throw error;
    }

    // Create or update customer + order in a single transaction
    const result = await createOrderFromBody(body);

    // Generate a 4-digit display order number
    const orderDisplayId = String(result.id).padStart(4, "0").slice(-4);

    res.json({
      status: "success",
      data: result,
      orderId: orderDisplayId,
    });
  } catch (error) {
    console.error("Error creating order:", error);

    if (error.message === "CUSTOMER_NAME_REQUIRED") {
      return res.status(400).json({ status: "fail", message: "Customer name is required" });
    }
    if (error.message === "CUSTOMER_PHONE_REQUIRED") {
      return res.status(400).json({ status: "fail", message: "Customer phone is required" });
    }
    if (error.message === "CUSTOMER_ADDRESS_REQUIRED") {
      return res.status(400).json({ status: "fail", message: "Customer address is required" });
    }
    if (error.message === "CUSTOMER_DISTRICT_REQUIRED") {
      return res.status(400).json({ status: "fail", message: "Customer district is required" });
    }
    if (error.message === "CUSTOMER_THANA_REQUIRED") {
      return res.status(400).json({ status: "fail", message: "Customer thana/upazila is required" });
    }
    if (error.message === "ORDER_ITEMS_REQUIRED") {
      return res.status(400).json({ status: "fail", message: "Order must contain at least one item" });
    }
    if (error.message === "INVALID_ORDER_ITEMS") {
      return res.status(400).json({ status: "fail", message: "Order items are invalid" });
    }

    if (error.code === "P2003") {
      return res.status(404).json({
        status: "fail",
        message: "Customer not found. Please create the customer first.",
      });
    }

    res.status(500).json({
      status: "fail",
      message: "Failed to create order. Please try again later.",
    });
  }
});

router.post("/add-offline-sale", async (req, res) => {
  try {
    const body = req.body;
    body.saleSource = "OFFLINE";
    body.orderStatus = "PAID";
    const result = await createOrderFromBody(body);
    const orderDisplayId = String(result.id).padStart(4, "0").slice(-4);

    res.json({
      status: "success",
      data: result,
      orderId: orderDisplayId,
    });
  } catch (error) {
    console.error("Error creating offline sale:", error);

    if (error.message === "CUSTOMER_NAME_REQUIRED") {
      return res.status(400).json({ status: "fail", message: "Customer name is required" });
    }
    if (error.message === "CUSTOMER_PHONE_REQUIRED") {
      return res.status(400).json({ status: "fail", message: "Customer phone is required" });
    }
    if (error.message === "CUSTOMER_ADDRESS_REQUIRED") {
      return res.status(400).json({ status: "fail", message: "Customer address is required" });
    }
    if (error.message === "CUSTOMER_DISTRICT_REQUIRED") {
      return res.status(400).json({ status: "fail", message: "Customer district is required" });
    }
    if (error.message === "CUSTOMER_THANA_REQUIRED") {
      return res.status(400).json({ status: "fail", message: "Customer thana/upazila is required" });
    }
    if (error.message === "ORDER_ITEMS_REQUIRED") {
      return res.status(400).json({ status: "fail", message: "Order must contain at least one item" });
    }
    if (error.message === "INVALID_ORDER_ITEMS") {
      return res.status(400).json({ status: "fail", message: "Order items are invalid" });
    }

    if (error.code === "P2003") {
      return res.status(404).json({
        status: "fail",
        message: "Customer not found. Please create the customer first.",
      });
    }

    res.status(500).json({
      status: "fail",
      message: "Failed to create offline sale. Please try again later.",
    });
  }
});

// GET /api/orders
// GET /api/orders - list orders with pagination and optional search
router.get("/all-order", async (req, res) => {
  try {
    // Pagination: accept `page` and `limit` (or `per_page`) as query params.
    // Default: page=1, limit=10
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit || req.query.per_page, 10);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;
    // Prevent extremely large limits
    const MAX_LIMIT = 100;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    const skip = (page - 1) * limit;

    // Build search filter if provided. We can search on orderStatus, paymentMethod, note, totalPrice, id and customer name/phone.
    const searchQuery = (req.query.search || "").toString().trim();
    let where = {};
    if (searchQuery.length > 0) {
      const numVal = Number(searchQuery);
      const isNumeric = !Number.isNaN(numVal);
      const searchUpper = searchQuery.toUpperCase();

      const orFilters = [];

      // Note is a string
      orFilters.push({ note: { contains: searchQuery } });

      // Customer is a relation; use `is` for filtering a one-to-one relation
      orFilters.push({ customer: { is: { name: { contains: searchQuery } } } });
      orFilters.push({
        customer: { is: { phone: { contains: searchQuery } } },
      });
      orFilters.push({
        customer: { is: { district: { contains: searchQuery } } },
      });
      orFilters.push({
        customer: { is: { thana: { contains: searchQuery } } },
      });

      // Enums can't be filtered with `contains` in Prisma. Check for exact enum values (case-insensitive)
      const orderStatusEnums = ["PENDING", "SHIPPED", "DELIVERED", "CANCELLED", "PAID"];
      if (orderStatusEnums.includes(searchUpper)) {
        orFilters.push({ orderStatus: searchUpper });
      }
      const paymentEnums = ["CASHON", "BKASH", "NAGAD", "ROCKET", "CARD"];
      if (paymentEnums.includes(searchUpper)) {
        orFilters.push({ paymentMethod: searchUpper });
      }

      // If the search term is numeric we can search id and numeric fields
      if (isNumeric) {
        orFilters.push({ id: numVal });
        orFilters.push({ totalPrice: numVal });
        orFilters.push({ deliveryCharge: numVal });
      }

      // Remove items/json-based search; complex JSON search isn't universally supported.
      // Use a catch-all fallback: if nothing else is added push an empty string match on note
      if (orFilters.length === 0) {
        orFilters.push({ note: { contains: searchQuery } });
      }

      where = { OR: orFilters };
    }

    if (req.query.saleSource) {
      const saleSource = String(req.query.saleSource).trim().toUpperCase();
      if (saleSource) {
        where = {
          ...where,
          saleSource,
        };
      }
    }

    // Fetch orders with pagination and optional search filter
    const orders = await prisma.order.findMany({
      where,
      include: { customer: true },
      orderBy: { id: "desc" },
      skip,
      take: limit,
    });

    // Get total count for the filtered result
    const total = await prisma.order.count({ where });

    // If consumer wants only the count (no data), return the number directly
    if (
      req.query.countOnly &&
      (req.query.countOnly === "true" || req.query.countOnly === "1")
    ) {
      return res.json({ status: "success", data: total });
    }

    res.json({ status: "success", data: { orders, total, page, limit } });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch orders. Please try again later.",
    });
  }
});

// GET /api/orders
router.get("/recent-order", async (req, res) => {
  try {
    const result = await prisma.order.findMany({
      take: 3,
      include: {
        customer: true,
      },
      orderBy: {
        id: "desc",
      },
    });
    res.json({ status: "success", data: result });
  } catch (error) {
    console.error("Error fetching recent orders:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch recent orders. Please try again later.",
    });
  }
});

// GET /api/orders/:id
router.get("/order-details/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id) || id < 1) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid order ID",
      });
    }

    const result = await prisma.order.findUnique({
      where: {
        id: id,
      },
      include: {
        customer: true,
      },
    });

    if (!result) {
      return res.status(404).json({
        status: "fail",
        message: "Order not found",
      });
    }

    res.json({ status: "success", data: result });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch order details. Please try again later.",
    });
  }
});

// Update a order route
router.patch("/update-order/:id", async (req, res) => {
  try {
    const orderIdString = req.params.id;
    const orderId = parseInt(orderIdString);

    if (isNaN(orderId) || orderId < 1) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid order ID",
      });
    }

    const orderUpdateData = req.body;

    if (!orderUpdateData || Object.keys(orderUpdateData).length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "No update data provided",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!existingOrder) {
        throw Object.assign(new Error("ORDER_NOT_FOUND"));
      }

      const orderItems = extractOrderItems(existingOrder.items);
      const reserveRequested =
        orderUpdateData.reserveStock === true ||
        orderUpdateData.reserveStock === "true";
      const nextStatus = orderUpdateData.orderStatus;
      const cancelRequested = nextStatus === "CANCELLED";
      const finalizeRequested =
        nextStatus === "SHIPPED" || nextStatus === "DELIVERED";

      delete orderUpdateData.reserveStock;

      if (orderItems.length > 0) {
        if (reserveRequested && !existingOrder.stockFinalized) {
          const reserveGate = await tx.order.updateMany({
            where: { id: orderId, stockReserved: false, stockFinalized: false },
            data: { stockReserved: true },
          });

          if (reserveGate.count === 1) {
            await reserveStock(tx, orderItems);
          }
        }

        if (
          cancelRequested &&
          existingOrder.stockReserved &&
          !existingOrder.stockFinalized
        ) {
          await releaseStock(tx, orderItems);
          orderUpdateData.stockReserved = false;
        }

        if (finalizeRequested && !existingOrder.stockFinalized) {
          if (existingOrder.stockReserved) {
            await finalizeStock(tx, orderItems);
          } else {
            await finalizeStockDirect(tx, orderItems);
          }
          orderUpdateData.stockReserved = false;
          orderUpdateData.stockFinalized = true;
        }
      }

      return await tx.order.update({
        where: {
          id: orderId,
        },
        data: orderUpdateData,
      });
    });

    res.json({ status: "success", data: result });
  } catch (error) {
    console.error("Error updating order:", error);

    if (error.message === "ORDER_NOT_FOUND") {
      return res.status(404).json({
        status: "fail",
        message: "Order not found",
      });
    }

    if (error.message === "PRODUCT_NOT_FOUND") {
      return res.status(404).json({
        status: "fail",
        message: "One or more products not found",
        data: error.details,
      });
    }

    if (error.message === "INSUFFICIENT_STOCK") {
      return res.status(409).json({
        status: "fail",
        message: "Insufficient stock for one or more items",
        data: error.details,
      });
    }

    if (error.code === "P2025") {
      return res.status(404).json({
        status: "fail",
        message: "Order not found",
      });
    }

    if (error.code === "P2003") {
      return res.status(404).json({
        status: "fail",
        message: "Customer not found. Please provide a valid customer ID.",
      });
    }

    res.status(500).json({
      status: "fail",
      message: "Failed to update order. Please try again later.",
    });
  }
});

// delete an order route
router.delete("/delete-order/:id", async (req, res) => {
  try {
    const orderIdString = req.params.id;
    const orderId = parseInt(orderIdString);

    if (isNaN(orderId) || orderId < 1) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid order ID",
      });
    }

    const result = await prisma.order.delete({
      where: {
        id: orderId,
      },
    });
    res.json({ status: "success", data: result });
  } catch (error) {
    console.error("Error deleting order:", error);

    if (error.code === "P2025") {
      return res.status(404).json({
        status: "fail",
        message: "Order not found",
      });
    }

    res.status(500).json({
      status: "fail",
      message: "Failed to delete order. Please try again later.",
    });
  }
});

// GET /api/orders/aggregate
router.get("/statistic", async (req, res) => {
  try {
    const result = await prisma.order.aggregate({
      _sum: {
        totalPrice: true,
      },
      _count: true,
    });
    res.json({ status: "success", data: result });
  } catch (error) {
    console.error("Error fetching order statistics:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch order statistics. Please try again later.",
    });
  }
});

router.get("/track-order/:query", async (req, res) => {
  try {
    const query = req.params.query;
    if (!query) {
      return res.status(400).json({ status: "fail", message: "Search query is required" });
    }

    const isNumeric = /^\d+$/.test(query);
    const orderId = isNumeric ? parseInt(query) : null;
    const normalizedPhone = normalizePhone(query);

    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { customer: { phone: normalizedPhone } },
          orderId ? { id: orderId } : null,
        ].filter(Boolean),
      },
      select: {
        id: true,
        orderDate: true,
        totalPrice: true,
        orderStatus: true,
        courierDetails: true,
        items: true,
        customer: {
          select: {
            name: true,
            phone: true
          }
        }
      },
      orderBy: { id: "desc" },
    });

    if (!orders || orders.length === 0) {
      return res.status(404).json({ status: "fail", message: "No orders found for this search." });
    }

    res.json({ status: "success", data: orders });
  } catch (error) {
    console.error("Error tracking order:", error);
    res.status(500).json({ status: "fail", message: "Failed to track order. Please try again later." });
  }
});

module.exports = router;
