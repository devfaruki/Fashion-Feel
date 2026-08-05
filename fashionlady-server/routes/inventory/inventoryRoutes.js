const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prismaClient");

const PRODUCT_INCLUDE = {
  category: true,
  subCategory: true,
  brand: true,
};

function firstImage(images) {
  return Array.isArray(images) && images.length > 0 ? images[0] : "";
}

function toNonNegativeInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return parsed < 0 ? 0 : parsed;
}

function toNullableInt(value) {
  if (value === "" || value === null || value === undefined || value === "null") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : Math.max(0, parsed);
}

function activeVariants(product) {
  return Array.isArray(product.variants)
    ? product.variants.filter((variant) => variant && variant.active !== false)
    : [];
}

function variantStockTotal(variants) {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  return variants
    .filter((variant) => variant && variant.active !== false)
    .reduce((sum, variant) => sum + toNonNegativeInt(variant.openingStock, 0), 0);
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function findVariantIndex(product, selector) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const size = normalizeText(selector.size);
  const color = normalizeText(selector.color);

  return variants.findIndex(
    (variant) =>
      variant &&
      normalizeText(variant.size) === size &&
      normalizeText(variant.color) === color,
  );
}

function flattenInventoryProduct(product) {
  const variants = activeVariants(product);
  if (variants.length === 0) {
    return [{
      id: `${product.id}:simple`,
      productId: product.id,
      productCode: product.productId,
      productName: product.name,
      image: firstImage(product.images),
      category: product.category?.name ?? "",
      subCategory: product.subCategory?.name ?? "",
      brand: product.brand?.name ?? "",
      type: "simple",
      size: "",
      color: "",
      sku: "",
      stockQty: product.stockQty ?? 0,
      reserved: product.stockReserved ?? 0,
      available: Math.max(0, product.stockQty ?? 0),
      buyingPrice: null,
      oldPrice: product.oldPrice ?? null,
      customerPrice: product.price ?? 0,
      status: product.stock ?? "available",
    }];
  }

  return variants.map((variant, index) => {
    const stockQty = toNonNegativeInt(variant.openingStock, 0);
    return {
      id: `${product.id}:variant:${index}`,
      productId: product.id,
      productCode: product.productId,
      productName: product.name,
      image: variant.image || firstImage(product.images),
      category: product.category?.name ?? "",
      subCategory: product.subCategory?.name ?? "",
      brand: product.brand?.name ?? "",
      type: "variant",
      variantIndex: index,
      size: variant.size || "",
      color: variant.color || "",
      sku: variant.sku || "",
      stockQty,
      reserved: 0,
      available: stockQty,
      buyingPrice: toNullableInt(variant.buyingPrice),
      oldPrice: toNullableInt(variant.oldPrice),
      customerPrice: toNullableInt(variant.customerPrice),
      status: variant.active === false ? "inactive" : "available",
    };
  });
}

router.get("/items", async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { category: { name: { contains: search } } },
            { subCategory: { name: { contains: search } } },
            { brand: { name: { contains: search } } },
          ],
        }
      : {};

    const products = await prisma.product.findMany({
      where,
      include: PRODUCT_INCLUDE,
      orderBy: { id: "desc" },
    });

    const items = products.flatMap(flattenInventoryProduct);
    res.json({ status: "success", data: { items, total: items.length } });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({ status: "fail", message: "Failed to fetch inventory" });
  }
});

router.patch("/item/:productId", async (req, res) => {
  try {
    const productId = parseInt(req.params.productId, 10);
    if (!productId || productId < 1) {
      return res.status(400).json({ status: "fail", message: "Invalid product ID" });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: PRODUCT_INCLUDE,
    });
    if (!product) {
      return res.status(404).json({ status: "fail", message: "Product not found" });
    }

    const type = req.body.type === "variant" ? "variant" : "simple";

    if (type === "variant") {
      const variantIndex =
        req.body.variantIndex !== undefined
          ? parseInt(req.body.variantIndex, 10)
          : findVariantIndex(product, req.body);
      const variants = Array.isArray(product.variants) ? product.variants : [];

      if (Number.isNaN(variantIndex) || variantIndex < 0 || !variants[variantIndex]) {
        return res.status(404).json({ status: "fail", message: "Variant not found" });
      }

      const nextVariants = variants.map((variant, index) => {
        if (index !== variantIndex) return variant;
        return {
          ...variant,
          sku: req.body.sku !== undefined ? String(req.body.sku) : variant.sku || "",
          openingStock:
            req.body.stockQty !== undefined
              ? String(toNonNegativeInt(req.body.stockQty, 0))
              : String(toNonNegativeInt(variant.openingStock, 0)),
          buyingPrice:
            req.body.buyingPrice !== undefined
              ? String(toNullableInt(req.body.buyingPrice) ?? "")
              : variant.buyingPrice || "",
          oldPrice:
            req.body.oldPrice !== undefined
              ? String(toNullableInt(req.body.oldPrice) ?? "")
              : variant.oldPrice || "",
          customerPrice:
            req.body.customerPrice !== undefined
              ? String(toNullableInt(req.body.customerPrice) ?? "")
              : variant.customerPrice || "",
          active:
            req.body.status !== undefined
              ? req.body.status !== "inactive" && req.body.status !== "unavailable"
              : variant.active !== false,
        };
      });

      const stockQty = variantStockTotal(nextVariants) ?? 0;
      const updated = await prisma.product.update({
        where: { id: productId },
        data: {
          variants: nextVariants,
          stockQty,
          stock: stockQty > 0 ? "available" : "unavailable",
        },
        include: PRODUCT_INCLUDE,
      });

      return res.json({
        status: "success",
        data: flattenInventoryProduct(updated),
      });
    }

    const stockQty = toNonNegativeInt(req.body.stockQty, product.stockQty ?? 0);
    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        stockQty,
        price:
          req.body.customerPrice !== undefined
            ? toNonNegativeInt(req.body.customerPrice, product.price ?? 0)
            : product.price,
        oldPrice:
          req.body.oldPrice !== undefined
            ? toNullableInt(req.body.oldPrice)
            : product.oldPrice,
        stock:
          req.body.status !== undefined
            ? req.body.status
            : stockQty > 0
              ? "available"
              : "unavailable",
      },
      include: PRODUCT_INCLUDE,
    });

    res.json({ status: "success", data: flattenInventoryProduct(updated) });
  } catch (error) {
    console.error("Error updating inventory:", error);
    res.status(500).json({ status: "fail", message: "Failed to update inventory" });
  }
});

module.exports = router;
