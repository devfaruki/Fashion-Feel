const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const prisma = require("../../lib/prismaClient");
const {
  upload,
  compressImage,
  compressAndSaveMany,
  compressBase64AndSaveMany,
} = require("../../lib/upload");
const multer = require("multer");
const AdmZip = require("adm-zip");
const XLSX = require("xlsx");

const PUBLIC_DIR = path.join(__dirname, "..", "..", "public");
const PRODUCT_IMAGES_DIR = path.join(PUBLIC_DIR, "products");
fs.mkdirSync(PRODUCT_IMAGES_DIR, { recursive: true });

const PRODUCT_INCLUDE = {
  category: true,
  subCategory: true,
  brand: true,
};

function toNonNegativeInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return parsed < 0 ? 0 : parsed;
}

function withStockMeta(product) {
  const variantStock = getVariantStockTotal(product.variants);
  const variantPrices = getVariantPriceList(product.variants);
  const variantOldPrices = getVariantOldPriceList(product.variants);
  const hasVariantPrices = variantPrices.length > 0;
  const displayPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : product.price;
  const priceRange =
    variantPrices.length > 0
      ? {
          min: Math.min(...variantPrices),
          max: Math.max(...variantPrices),
        }
      : null;
  const oldPriceRange =
    variantOldPrices.length > 0
      ? {
          min: Math.min(...variantOldPrices),
          max: Math.max(...variantOldPrices),
        }
      : null;
  const simplePricePair = getDiscountPair(product.price, product.oldPrice ?? 0);
  const stockQty = variantStock ?? product.stockQty ?? 0;
  const stockReserved = product.stockReserved ?? 0;
  const stockAvailable = Math.max(0, stockQty);
  const lowStockThreshold = product.lowStockThreshold ?? 0;
  return {
    ...product,
    price: hasVariantPrices ? displayPrice : simplePricePair.salePrice || product.price,
    oldPrice: hasVariantPrices
      ? oldPriceRange?.max ?? null
      : simplePricePair.oldPrice,
    priceRange,
    oldPriceRange,
    stockQty,
    stock: stockQty > 0 ? product.stock || "available" : product.stock,
    stockAvailable,
    isLowStock: stockAvailable <= lowStockThreshold,
  };
}

function getVariantPriceList(variants) {
  if (!Array.isArray(variants) || variants.length === 0) return [];
  return variants
    .filter((variant) => variant && variant.active !== false)
    .map((variant) =>
      getDiscountPair(
        Number.parseInt(variant.customerPrice ?? 0, 10),
        Number.parseInt(variant.oldPrice ?? 0, 10),
      ).salePrice,
    )
    .filter((price) => !Number.isNaN(price) && price > 0);
}

function getVariantOldPriceList(variants) {
  if (!Array.isArray(variants) || variants.length === 0) return [];
  return variants
    .filter((variant) => variant && variant.active !== false)
    .map((variant) =>
      getDiscountPair(
        Number.parseInt(variant.customerPrice ?? 0, 10),
        Number.parseInt(variant.oldPrice ?? 0, 10),
      ).oldPrice,
    )
    .filter((price) => !Number.isNaN(price) && price > 0);
}

function getDiscountPair(price, comparePrice) {
  const current = Number.isNaN(price) || price < 1 ? 0 : price;
  const compare = Number.isNaN(comparePrice) || comparePrice < 1 ? 0 : comparePrice;
  if (!current) return { salePrice: 0, oldPrice: null };
  if (!compare || compare === current) return { salePrice: current, oldPrice: null };
  return {
    salePrice: Math.min(current, compare),
    oldPrice: Math.max(current, compare),
  };
}

function getVariantStockTotal(variants) {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  return variants
    .filter((variant) => variant && variant.active !== false)
    .reduce((total, variant) => {
      const qty = Number.parseInt(variant.openingStock ?? 0, 10);
      return total + (Number.isNaN(qty) || qty < 0 ? 0 : qty);
    }, 0);
}

function syncStockQtyFromVariants(productData) {
  const variantStock = getVariantStockTotal(productData.variants);
  if (variantStock !== null) {
    productData.stockQty = variantStock;
    productData.stock = variantStock > 0 ? "available" : "unavailable";
  }
}

async function getNextProductId() {
  const lastProduct = await prisma.product.findFirst({
    orderBy: { productId: "desc" },
    select: { productId: true },
  });

  return lastProduct ? lastProduct.productId + 1 : 1;
}

function toAbsoluteImagePath(imagePath) {
  if (!imagePath || typeof imagePath !== "string") return null;
  const normalized = imagePath.replace(/\\/g, "/");
  const relativePath = normalized.replace(/^\/?public\//, "");
  return path.join(PUBLIC_DIR, relativePath);
}

function normalizeStoredImagePath(imagePath) {
  if (!imagePath || typeof imagePath !== "string") return "";
  const normalized = imagePath.replace(/\\/g, "/");
  const publicMatch = normalized.match(/\/public\/.+$/);
  return publicMatch ? publicMatch[0] : normalized;
}

function removeImagesFromDisk(imagePaths = []) {
  for (const imgPath of imagePaths) {
    const absolutePath = toAbsoluteImagePath(imgPath);
    if (!absolutePath) continue;
    try {
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    } catch (err) {
      console.error(`Failed to delete image ${absolutePath}:`, err);
    }
  }
}

const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 80 * 1024 * 1024,
  },
});

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return fallback;

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return fallback;
}

function parseSizes(value) {
  if (Array.isArray(value)) return value.map((size) => String(size).trim()).filter(Boolean);
  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((size) => String(size).trim()).filter(Boolean);
    }
  } catch {
    // fall back to comma-separated parsing
  }

  return trimmed
    .split(",")
    .map((size) => size.trim())
    .filter(Boolean);
}

function parseJsonArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return fallback;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return fallback;
}

function attachVariantImages(variants, uploadedVariantImages = []) {
  if (!Array.isArray(variants)) return [];

  return variants.map((variant) => {
    if (!variant || typeof variant !== "object") return variant;

    const uploadIndex = Number(variant.imageUploadIndex);
    const image =
      Number.isInteger(uploadIndex) && uploadedVariantImages[uploadIndex]
        ? uploadedVariantImages[uploadIndex]
        : variant.image || "";

    const { imageUploadIndex: _imageUploadIndex, ...cleanVariant } = variant;
    return {
      ...cleanVariant,
      image,
    };
  });
}

function readExcelRows(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function normalizeZipKey(value) {
  return String(value || "").replace(/\\/g, "/");
}

function buildZipImageLookup(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const lookup = new Map();

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;

    const normalized = normalizeZipKey(entry.entryName);
    const baseName = path.posix.basename(normalized);
    const folderName = path.posix.dirname(normalized).split("/")[0];
    const candidates = new Set();

    if (folderName && folderName !== ".") candidates.add(folderName);
    if (baseName) {
      const firstToken = baseName.split(/[_\-.]/)[0];
      candidates.add(firstToken);
    }

    for (const key of candidates) {
      if (!lookup.has(key)) lookup.set(key, []);
      lookup.get(key).push({
        buffer: entry.getData(),
        originalname: baseName || normalized,
      });
    }
  }

  return lookup;
}

function toPositiveInt(value, fallback = null) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

async function resolveCategoryByName(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;

  const categories = await prisma.category.findMany({
    select: { id: true, name: true },
  });

  const normalized = trimmed.toLowerCase();
  return (
    categories.find((category) => String(category.name || "").trim().toLowerCase() === normalized) ??
    null
  );
}

async function resolveBrandByName(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;

  const brands = await prisma.brand.findMany({
    select: { id: true, name: true },
  });

  const normalized = trimmed.toLowerCase();
  return (
    brands.find((brand) => String(brand.name || "").trim().toLowerCase() === normalized) ??
    null
  );
}

function normalizeProductRow(row) {
  const productId = toPositiveInt(row.productId ?? row.product_id ?? row.id);
  const stitchType = String(row.stitchType ?? row.stitch_type ?? "stitch")
    .trim()
    .toLowerCase() === "unstitch"
    ? "unstitch"
    : "stitch";
  const sizes = stitchType === "unstitch" ? ["Unstitch"] : parseSizes(row.sizes);

  return {
    productId,
    name: String(row.name ?? row.product_name ?? row.title ?? "").trim(),
    price: Number(row.price),
    oldPrice:
      row.oldPrice === "" || row.oldPrice === null || row.oldPrice === undefined
        ? null
        : Number(row.oldPrice),
    badge: String(row.badge ?? "").trim() || null,
    stitchType,
    sizes,
    stock: String(row.stock ?? "available").trim() || "available",
    stockQty: Math.max(0, Number.parseInt(row.stockQty ?? row.stock_qty ?? 0, 10) || 0),
    stockReserved: Math.max(0, Number.parseInt(row.stockReserved ?? row.stock_reserved ?? 0, 10) || 0),
    lowStockThreshold: Math.max(0, Number.parseInt(row.lowStockThreshold ?? row.low_stock_threshold ?? 5, 10) || 5),
    description: String(row.description ?? "").trim(),
    isNew: parseBoolean(row.isNew ?? row.is_new, false),
    isFeatured: parseBoolean(row.isFeatured ?? row.is_featured, false),
    categoryName: String(row.categoryName ?? row.category_name ?? "").trim(),
    brandName: String(row.brandName ?? row.brand_name ?? "").trim(),
    order: Number.parseInt(row.order ?? 0, 10) || 0,
  };
}

// POST /api/product/add-product
// Accepts multipart/form-data (Multer) OR JSON with base64 images (legacy).
router.post("/add-product", upload.any(), async (req, res) => {
  try {
    // When sent as FormData, non-file fields arrive as strings.
    // Parse them back into their expected types.
    const productData = { ...req.body };

    // Parse JSON fields that may have been stringified in FormData
    if (typeof productData.sizes === "string") {
      try {
        productData.sizes = JSON.parse(productData.sizes);
      } catch {
        productData.sizes = productData.sizes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    productData.colors = parseJsonArray(productData.colors);
    productData.variants = parseJsonArray(productData.variants);

    // Coerce numeric strings
    if (productData.price !== undefined)
      productData.price = Number(productData.price);
    if (
      productData.oldPrice !== undefined &&
      productData.oldPrice !== "null" &&
      productData.oldPrice !== ""
    )
      productData.oldPrice = Number(productData.oldPrice);
    else productData.oldPrice = null;
    if (
      productData.categoryId !== undefined &&
      productData.categoryId !== "null" &&
      productData.categoryId !== ""
    )
      productData.categoryId = Number(productData.categoryId);
    else productData.categoryId = null;
    if (
      productData.subCategoryId !== undefined &&
      productData.subCategoryId !== "null" &&
      productData.subCategoryId !== ""
    )
      productData.subCategoryId = Number(productData.subCategoryId);
    else productData.subCategoryId = null;
    if (
      productData.brandId !== undefined &&
      productData.brandId !== "null" &&
      productData.brandId !== ""
    )
      productData.brandId = Number(productData.brandId);
    else productData.brandId = null;
    if (productData.productId !== undefined) {
      const parsedProductId = Number(productData.productId);
      productData.productId =
        Number.isFinite(parsedProductId) && parsedProductId > 0
          ? Math.trunc(parsedProductId)
          : undefined;
    }

    // Coerce booleans
    if (typeof productData.isNew === "string")
      productData.isNew = productData.isNew === "true";
    if (typeof productData.isFeatured === "string")
      productData.isFeatured = productData.isFeatured === "true";

    if (!productData || Object.keys(productData).length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "Product data is required",
      });
    }

    if (!productData.name) {
      return res.status(400).json({
        status: "fail",
        message: "Product name is required",
      });
    }

    if (!productData.productId) {
      productData.productId = await getNextProductId();
    }

    if (Object.prototype.hasOwnProperty.call(productData, "stockQty")) {
      productData.stockQty = toNonNegativeInt(productData.stockQty, 0);
    }
    if (Object.prototype.hasOwnProperty.call(productData, "stockReserved")) {
      productData.stockReserved = toNonNegativeInt(
        productData.stockReserved,
        0,
      );
    }
    if (
      Object.prototype.hasOwnProperty.call(productData, "lowStockThreshold")
    ) {
      productData.lowStockThreshold = toNonNegativeInt(
        productData.lowStockThreshold,
        5,
      );
    }

    if (
      typeof productData.stockQty === "number" &&
      typeof productData.stockReserved === "number" &&
      productData.stockReserved > productData.stockQty
    ) {
      productData.stockReserved = productData.stockQty;
    }

    // ── HANDLE IMAGES ──────────────────────────────────────────────────
    let uploadedImages = [];
    let uploadedVariantImages = [];
    try {
      const mainFiles = (req.files || []).filter(
        (file) => file.fieldname === "images",
      );
      const variantFiles = (req.files || []).filter(
        (file) => file.fieldname === "variantImages",
      );

      if (mainFiles.length > 0) {
        // New path: Multer multipart files → compress with Sharp
        uploadedImages = await compressAndSaveMany(
          mainFiles,
          PRODUCT_IMAGES_DIR,
          "product",
        );
        console.log(
          `✅ Compressed & saved ${req.files.length} product image(s) via Multer+Sharp`,
        );
      }

      if (variantFiles.length > 0) {
        uploadedVariantImages = await compressAndSaveMany(
          variantFiles,
          PRODUCT_IMAGES_DIR,
          "product",
        );
        console.log(`Saved ${variantFiles.length} variant image(s)`);
      } else if (
        Array.isArray(productData.images) &&
        productData.images.length > 0 &&
        typeof productData.images[0] === "string"
      ) {
        // Legacy fallback: base64 data URLs in JSON body → compress with Sharp
        uploadedImages = await compressBase64AndSaveMany(
          productData.images,
          PRODUCT_IMAGES_DIR,
          "product",
        );
        console.log(
          `✅ Compressed & saved ${productData.images.length} product image(s) via base64+Sharp`,
        );
      }
    } catch (imageError) {
      console.error("Error uploading images:", imageError);
      return res.status(400).json({
        status: "fail",
        message: "Failed to upload product images. Please check image format.",
      });
    }

    productData.variants = attachVariantImages(
      productData.variants,
      uploadedVariantImages,
    );
    syncStockQtyFromVariants(productData);
    productData.images = uploadedImages.concat(uploadedVariantImages);

    // Clean up productData for Prisma
    const { categoryId, subCategoryId, brandId, id: _id, ...prismaData } = productData;

    // Create product
    const newProduct = await prisma.product.create({
      data: {
        ...prismaData,
        category:
          categoryId && categoryId > 0
            ? { connect: { id: categoryId } }
            : undefined,
        subCategory:
          subCategoryId && subCategoryId > 0
            ? { connect: { id: subCategoryId } }
            : undefined,
        brand:
          brandId && brandId > 0 ? { connect: { id: brandId } } : undefined,
      },
      include: PRODUCT_INCLUDE,
    });

    res.json({ status: "success", data: withStockMeta(newProduct) });
  } catch (error) {
    console.error("Error in /add-product route:", error);

    res.status(500).json({
      status: "fail",
      message: "Failed to create product. Please try again later.",
    });
  }
});

// POST /api/product/bulk-import-products
// Accepts one Excel file (xlsx/xls) + one ZIP archive with product images.
router.post(
  "/bulk-import-products",
  bulkUpload.fields([
    { name: "excel", maxCount: 1 },
    { name: "imagesZip", maxCount: 1 },
  ]),
  async (req, res) => {
    const excelFile = req.files?.excel?.[0];
    const zipFile = req.files?.imagesZip?.[0];

    if (!excelFile) {
      return res.status(400).json({
        status: "fail",
        message: "Excel file is required.",
      });
    }

    if (!zipFile) {
      return res.status(400).json({
        status: "fail",
        message: "Images ZIP file is required.",
      });
    }

    const excelExt = path.extname(excelFile.originalname || "").toLowerCase();
    if (![".xlsx", ".xls"].includes(excelExt)) {
      return res.status(400).json({
        status: "fail",
        message: "Only Excel files (.xlsx, .xls) are supported.",
      });
    }

    const zipExt = path.extname(zipFile.originalname || "").toLowerCase();
    if (zipExt !== ".zip") {
      return res.status(400).json({
        status: "fail",
        message: "Images must be uploaded as a .zip file.",
      });
    }

    try {
      const rows = readExcelRows(excelFile.buffer);

      if (rows.length === 0) {
        return res.status(400).json({
          status: "fail",
          message: "Excel file does not contain any product rows.",
        });
      }

      if (rows.length > 500) {
        return res.status(400).json({
          status: "fail",
          message: "Maximum 500 products can be imported at a time.",
        });
      }

      const zipLookup = buildZipImageLookup(zipFile.buffer);
      const results = [];
      const createdProducts = [];

      for (let index = 0; index < rows.length; index += 1) {
        const sourceRow = rows[index];
        const rowNumber = index + 2;
        const product = normalizeProductRow(sourceRow);
        const rowErrors = [];

        if (!product.productId) rowErrors.push("productId is required");
        if (!product.name) rowErrors.push("name is required");
        if (!Number.isFinite(product.price) || product.price < 0) rowErrors.push("price must be a valid number");
        if (!product.description) rowErrors.push("description is required");

        const [category, brand] = await Promise.all([
          resolveCategoryByName(product.categoryName),
          resolveBrandByName(product.brandName),
        ]);

        if (product.categoryName && !category) {
          rowErrors.push(`categoryName not found: ${product.categoryName}`);
        }

        if (product.brandName && !brand) {
          rowErrors.push(`brandName not found: ${product.brandName}`);
        }

        if (product.stockReserved > product.stockQty) {
          product.stockReserved = product.stockQty;
        }

        const imageKey = String(product.productId);
        const matchedEntries = zipLookup.get(imageKey) ?? [];

        if (rowErrors.length > 0) {
          results.push({
            rowNumber,
            productId: product.productId,
            status: "failed",
            errors: rowErrors,
          });
          continue;
        }

        const existingProduct = await prisma.product.findUnique({
          where: { productId: product.productId },
          select: { id: true },
        });

        if (existingProduct) {
          results.push({
            rowNumber,
            productId: product.productId,
            status: "failed",
            errors: ["productId already exists"],
          });
          continue;
        }

        if (matchedEntries.length === 0) {
          results.push({
            rowNumber,
            productId: product.productId,
            status: "failed",
            errors: [`no images found in ZIP for productId ${product.productId}`],
          });
          continue;
        }

        const productImages = [];
        let imageFailure = null;
        for (const file of matchedEntries) {
          try {
            const imageBuffer = await compressImage(file.buffer);
            const fileName = `product_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.webp`;
            const absolutePath = path.join(PRODUCT_IMAGES_DIR, fileName);
            fs.writeFileSync(absolutePath, imageBuffer);
            productImages.push(`/public/products/${fileName}`);
          } catch {
            imageFailure = `failed to process image ${file.originalname}`;
            break;
          }
        }

        if (imageFailure) {
          removeImagesFromDisk(productImages);
          results.push({
            rowNumber,
            productId: product.productId,
            status: "failed",
            errors: [imageFailure],
          });
          continue;
        }

        let created;
        try {
          created = await prisma.product.create({
            data: {
              productId: product.productId,
              name: product.name,
              price: product.price,
              oldPrice: product.oldPrice,
              badge: product.badge,
              sizes: product.sizes,
              stock: product.stock,
              stockQty: product.stockQty,
              stockReserved: product.stockReserved,
              lowStockThreshold: product.lowStockThreshold,
              description: product.description,
              isNew: product.isNew,
              isFeatured: product.isFeatured,
              order: product.order,
              images: productImages,
              category: category ? { connect: { id: category.id } } : undefined,
              brand: brand ? { connect: { id: brand.id } } : undefined,
            },
            include: PRODUCT_INCLUDE,
          });
        } catch (error) {
          removeImagesFromDisk(productImages);
          throw error;
        }

        createdProducts.push(withStockMeta(created));
        results.push({
          rowNumber,
          productId: product.productId,
          status: "success",
          imageCount: productImages.length,
        });
      }

      return res.json({
        status: "success",
        data: {
          totalRows: rows.length,
          created: createdProducts.length,
          failed: results.filter((item) => item.status === "failed").length,
          results,
          products: createdProducts,
        },
      });
    } catch (error) {
      console.error("Error in /bulk-import-products:", error);
      return res.status(500).json({
        status: "fail",
        message: "Failed to import products. Please check the Excel and ZIP files.",
      });
    }
  },
);

// GET /api/product
router.get("/all-products", async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit || req.query.per_page) || 10;

    if (limit > 100) limit = 100;

    const skip = (page - 1) * limit;

    // -----------------------------
    // 🔍 BUILD WHERE CONDITIONS
    // -----------------------------
    const where = { AND: [] };

    // 1. Text search (name, description, category, brand, productId)
    const search = (req.query.search || "").trim();
    if (search) {
      const numVal = Number(search);
      const isNum = !Number.isNaN(numVal);

      const searchConditions = [
        { name: { contains: search } },
        { description: { contains: search } },
        { category: { name: { contains: search } } },
        { brand: { name: { contains: search } } },
      ];

      if (isNum) {
        searchConditions.push({ productId: numVal });
      }

      where.AND.push({ OR: searchConditions });
    }

    // 2. Filter by category
    const categoryId = parseInt(req.query.categoryId);
    if (!isNaN(categoryId) && categoryId > 0) {
      where.AND.push({
        categoryId: categoryId,
      });
    }

    const subCategoryId = parseInt(req.query.subCategoryId);
    if (!isNaN(subCategoryId) && subCategoryId > 0) {
      where.AND.push({
        subCategoryId: subCategoryId,
      });
    }

    // 2.5 Filter by brand
    const brandId = parseInt(req.query.brandId);
    if (!isNaN(brandId) && brandId > 0) {
      where.AND.push({
        brandId: brandId,
      });
    }

    // 4. Price range filtering
    const minPrice = parseInt(req.query.minPrice);
    const maxPrice = parseInt(req.query.maxPrice);

    if (!isNaN(minPrice) || !isNaN(maxPrice)) {
      const priceCondition = {};
      if (!isNaN(minPrice)) {
        priceCondition.gte = minPrice;
      }
      if (!isNaN(maxPrice)) {
        priceCondition.lte = maxPrice;
      }
      where.AND.push({ price: priceCondition });
    }

    // 5. Flags (isNew / isFeatured / onSale)
    if (String(req.query.isNew || "").toLowerCase() === "true") {
      where.AND.push({ isNew: true });
    }
    if (String(req.query.isFeatured || "").toLowerCase() === "true") {
      where.AND.push({ isFeatured: true });
    }
    if (String(req.query.onSale || "").toLowerCase() === "true") {
      where.AND.push({ oldPrice: { not: null } });
    }

    // 6. Active only (for frontend)
    if (req.query.activeOnly === "true") {
      where.AND.push({ stock: "available" });
      where.AND.push({
        OR: [{ category: null }, { category: { status: "active" } }],
      });
      where.AND.push({
        OR: [{ brand: null }, { brand: { status: "active" } }],
      });
      where.AND.push({
        OR: [{ subCategory: null }, { subCategory: { status: "active" } }],
      });
    }

    // Clean up empty AND array
    const finalWhere = where.AND.length > 0 ? where : {};

    // -----------------------------
    // 🔽 SORTING
    // -----------------------------
    const sort = (req.query.sort || "").toLowerCase();
    let orderBy = { id: "desc" };

    if (sort === "newest" || sort === "newest-to-oldest") {
      orderBy = { id: "desc" };
    }

    if (sort === "oldest" || sort === "oldest-to-newest") {
      orderBy = { id: "asc" };
    }

    if (sort === "low-to-high" || sort === "price_asc") {
      orderBy = { price: "asc" };
    }

    if (sort === "high-to-low" || sort === "price_desc") {
      orderBy = { price: "desc" };
    }

    if (sort === "name") {
      orderBy = { name: "asc" };
    }

    // -----------------------------
    // 📌 FETCH PRODUCTS
    // -----------------------------
    const products = await prisma.product.findMany({
      where: finalWhere,
      orderBy,
      skip,
      take: limit,
      include: {
        ...PRODUCT_INCLUDE,
      },
    });

    // Count
    const total = await prisma.product.count({ where: finalWhere });

    const productsWithStock = products.map(withStockMeta);

    res.json({
      status: "success",
      data: { products: productsWithStock, total, page, limit },
    });
  } catch (error) {
    console.error("Error in /all-products:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch products. Please try again later.",
    });
  }
});

// Get truly random products
router.get("/random-products", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 4;
    const excludeId = parseInt(req.query.excludeId);

    // Get total count of products
    const where = excludeId ? { id: { not: excludeId } } : {};
    const totalCount = await prisma.product.count({ where });

    if (totalCount === 0) {
      return res.json({ status: "success", data: [] });
    }

    // If total products are fewer than or equal to limit, just return all
    if (totalCount <= limit) {
      const products = await prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
      });
      return res.json({
        status: "success",
        data: products.map(withStockMeta).sort(() => Math.random() - 0.5),
      });
    }

    // Otherwise, generate random skips to get random items
    // A simpler but effective way for small to medium catalogs:
    // Fetch all IDs, shuffle, then fetch full data for selected IDs
    const allIds = await prisma.product.findMany({
      where,
      select: { id: true },
    });

    const shuffledIds = allIds
      .map((p) => p.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, limit);

    const products = await prisma.product.findMany({
      where: { id: { in: shuffledIds } },
      include: PRODUCT_INCLUDE,
    });

    // Final shuffle to ensure order is random (Prisma might return in ID order)
    res.json({
      status: "success",
      data: products.map(withStockMeta).sort(() => Math.random() - 0.5),
    });
  } catch (error) {
    console.error("Error in /random-products:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch random products. Please try again later.",
    });
  }
});

// Update a product route
// Accepts multipart/form-data (Multer) OR JSON (legacy).
router.patch(
  "/update-product/:id",
  upload.any(),
  async (req, res) => {
    try {
      const productIdString = req.params.id;
      const productId = parseInt(productIdString);

      if (isNaN(productId) || productId < 1) {
        return res.status(400).json({
          status: "fail",
          message: "Invalid product ID",
        });
      }

      const productUpdateData = { ...req.body };

      // Parse JSON fields that may have been stringified in FormData
      if (typeof productUpdateData.sizes === "string") {
        try {
          productUpdateData.sizes = JSON.parse(productUpdateData.sizes);
        } catch {
          productUpdateData.sizes = productUpdateData.sizes
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
      if (Object.prototype.hasOwnProperty.call(productUpdateData, "colors")) {
        productUpdateData.colors = parseJsonArray(productUpdateData.colors);
      }
      if (Object.prototype.hasOwnProperty.call(productUpdateData, "variants")) {
        productUpdateData.variants = parseJsonArray(productUpdateData.variants);
      }

      // Parse removeImages if it came as a JSON string
      if (typeof productUpdateData.removeImages === "string") {
        try {
          productUpdateData.removeImages = JSON.parse(
            productUpdateData.removeImages,
          );
        } catch {
          productUpdateData.removeImages = [];
        }
      }

      // Coerce numeric strings
      if (productUpdateData.price !== undefined)
        productUpdateData.price = Number(productUpdateData.price);
      if (
        productUpdateData.oldPrice !== undefined &&
        productUpdateData.oldPrice !== "null" &&
        productUpdateData.oldPrice !== ""
      )
        productUpdateData.oldPrice = Number(productUpdateData.oldPrice);
      else if (
        productUpdateData.oldPrice === "null" ||
        productUpdateData.oldPrice === ""
      )
        productUpdateData.oldPrice = null;
      if (
        productUpdateData.categoryId !== undefined &&
        productUpdateData.categoryId !== "null" &&
        productUpdateData.categoryId !== ""
      )
        productUpdateData.categoryId = Number(productUpdateData.categoryId);
      else if (
        productUpdateData.categoryId === "null" ||
        productUpdateData.categoryId === ""
      )
        productUpdateData.categoryId = null;
      if (
        productUpdateData.subCategoryId !== undefined &&
        productUpdateData.subCategoryId !== "null" &&
        productUpdateData.subCategoryId !== ""
      )
        productUpdateData.subCategoryId = Number(productUpdateData.subCategoryId);
      else if (
        productUpdateData.subCategoryId === "null" ||
        productUpdateData.subCategoryId === ""
      )
        productUpdateData.subCategoryId = null;
      if (
        productUpdateData.brandId !== undefined &&
        productUpdateData.brandId !== "null" &&
        productUpdateData.brandId !== ""
      )
        productUpdateData.brandId = Number(productUpdateData.brandId);
      else if (
        productUpdateData.brandId === "null" ||
        productUpdateData.brandId === ""
      )
        productUpdateData.brandId = null;
      if (productUpdateData.stockQty !== undefined)
        productUpdateData.stockQty = Number(productUpdateData.stockQty);

      // Coerce booleans
      if (typeof productUpdateData.isNew === "string")
        productUpdateData.isNew = productUpdateData.isNew === "true";
      if (typeof productUpdateData.isFeatured === "string")
        productUpdateData.isFeatured = productUpdateData.isFeatured === "true";

      const addImagesBase64 = productUpdateData.addImages || [];
      const removeImages = productUpdateData.removeImages || [];

      const existingProduct = await prisma.product.findUnique({
        where: { id: productId },
        select: { images: true, stockQty: true, stockReserved: true },
      });
      if (!existingProduct) {
        return res.status(404).json({
          status: "fail",
          message: "Product not found",
        });
      }

      let imagesToDelete = [];
      const currentImages = Array.isArray(existingProduct.images)
        ? existingProduct.images
        : [];
      let nextImages = currentImages;
      let uploadedVariantImages = [];

      // ── HANDLE IMAGE CHANGES ──────────────────────────────────────────
      // Remove selected images
      if (Array.isArray(removeImages) && removeImages.length > 0) {
        const removeSet = new Set(removeImages.map(normalizeStoredImagePath));
        imagesToDelete = currentImages.filter((img) =>
          removeSet.has(normalizeStoredImagePath(img)),
        );
        nextImages = currentImages.filter(
          (img) => !removeSet.has(normalizeStoredImagePath(img)),
        );
      }

      // Add new images (Multer multipart files)
      const mainFiles = (req.files || []).filter(
        (file) => file.fieldname === "addImages",
      );
      const variantFiles = (req.files || []).filter(
        (file) => file.fieldname === "variantImages",
      );

      if (mainFiles.length > 0) {
        try {
          const newImages = await compressAndSaveMany(
            mainFiles,
            PRODUCT_IMAGES_DIR,
            "product",
          );
          nextImages = nextImages.concat(newImages);
          console.log(
            `✅ Compressed & saved ${req.files.length} product image(s) via Multer+Sharp`,
          );
        } catch (imageError) {
          console.error("Error uploading images:", imageError);
          return res.status(400).json({
            status: "fail",
            message:
              "Failed to upload product images. Please check image format.",
          });
        }
      } else if (
        Array.isArray(addImagesBase64) &&
        addImagesBase64.length > 0 &&
        typeof addImagesBase64[0] === "string"
      ) {
        // Legacy fallback: base64 data URLs → compress with Sharp
        try {
          const newImages = await compressBase64AndSaveMany(
            addImagesBase64,
            PRODUCT_IMAGES_DIR,
            "product",
          );
          nextImages = nextImages.concat(newImages);
          console.log(
            `✅ Compressed & saved ${addImagesBase64.length} product image(s) via base64+Sharp`,
          );
        } catch (imageError) {
          console.error("Error uploading images:", imageError);
          return res.status(400).json({
            status: "fail",
            message:
              "Failed to upload product images. Please check image format.",
          });
        }
      }

      if (variantFiles.length > 0) {
        try {
          uploadedVariantImages = await compressAndSaveMany(
            variantFiles,
            PRODUCT_IMAGES_DIR,
            "product",
          );
          nextImages = nextImages.concat(uploadedVariantImages);
          console.log(`Saved ${variantFiles.length} variant image(s)`);
        } catch (imageError) {
          console.error("Error uploading variant images:", imageError);
          return res.status(400).json({
            status: "fail",
            message:
              "Failed to upload product images. Please check image format.",
          });
        }
      }

      if (Object.prototype.hasOwnProperty.call(productUpdateData, "variants")) {
        productUpdateData.variants = attachVariantImages(
          productUpdateData.variants,
          uploadedVariantImages,
        );
        syncStockQtyFromVariants(productUpdateData);
      }

      // Only set images if something changed
      if (nextImages !== currentImages) {
        productUpdateData.images = nextImages;
      }

      if (Object.prototype.hasOwnProperty.call(productUpdateData, "stockQty")) {
        productUpdateData.stockQty = toNonNegativeInt(
          productUpdateData.stockQty,
          existingProduct.stockQty ?? 0,
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(productUpdateData, "stockReserved")
      ) {
        productUpdateData.stockReserved = toNonNegativeInt(
          productUpdateData.stockReserved,
          existingProduct.stockReserved ?? 0,
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(
          productUpdateData,
          "lowStockThreshold",
        )
      ) {
        productUpdateData.lowStockThreshold = toNonNegativeInt(
          productUpdateData.lowStockThreshold,
          5,
        );
      }

      if (
        typeof productUpdateData.stockQty === "number" &&
        typeof productUpdateData.stockReserved === "number" &&
        productUpdateData.stockReserved > productUpdateData.stockQty
      ) {
        productUpdateData.stockReserved = productUpdateData.stockQty;
      }

      // Clean up update data for Prisma
      const {
        categoryId,
        subCategoryId,
        brandId,
        addImages: _add,
        removeImages: _rem,
        id: _id,
        productId: _pId,
        ...prismaUpdateData
      } = productUpdateData;

      // Handle category relation
      if (categoryId !== undefined) {
        if (categoryId && categoryId > 0) {
          prismaUpdateData.category = { connect: { id: categoryId } };
        } else {
          prismaUpdateData.category = { disconnect: true };
        }
      }

      // Handle subcategory relation
      if (subCategoryId !== undefined) {
        if (subCategoryId && subCategoryId > 0) {
          prismaUpdateData.subCategory = { connect: { id: subCategoryId } };
        } else {
          prismaUpdateData.subCategory = { disconnect: true };
        }
      }

      // Handle brand relation
      if (brandId !== undefined) {
        if (brandId && brandId > 0) {
          prismaUpdateData.brand = { connect: { id: brandId } };
        } else {
          prismaUpdateData.brand = { disconnect: true };
        }
      }

      // Update product
      const result = await prisma.product.update({
        where: { id: productId },
        data: prismaUpdateData,
        include: PRODUCT_INCLUDE,
      });

      if (imagesToDelete.length > 0) {
        removeImagesFromDisk(imagesToDelete);
      }
      res.json({ status: "success", data: withStockMeta(result) });
    } catch (error) {
      console.error("Error in /update-product:", error);

      if (error.code === "P2025") {
        return res.status(404).json({
          status: "fail",
          message: "Product not found",
        });
      }

      if (error.code === "P2002") {
        return res.status(409).json({
          status: "fail",
          message: "A product with this information already exists",
        });
      }

      res.status(500).json({
        status: "fail",
        message: "Failed to update product. Please try again later.",
      });
    }
  },
);

// Get product details route
router.get("/details/:id", async (req, res) => {
  try {
    const productIdString = req.params.id;
    const productId = parseInt(productIdString);

    if (isNaN(productId) || productId < 1) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid product ID",
      });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        subCategory: true,
        brand: true,
        reviews: {
          where: { status: "APPROVED" },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            customerName: true,
            rating: true,
            comment: true,
            images: true,
            createdAt: true,
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({
        status: "fail",
        message: "Product not found",
      });
    }

    res.json({ status: "success", data: withStockMeta(product) });
  } catch (error) {
    console.error("Error fetching product details:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch product details. Please try again later.",
    });
  }
});

// get image by id
router.get("/images-and-name/:itemId", async (req, res) => {
  try {
    const productIdString = req.params.itemId;
    const productId = parseInt(productIdString);

    if (isNaN(productId) || productId < 1) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid product ID",
      });
    }

    const product = await prisma.product.findUnique({
      where: {
        id: productId,
      },
      select: {
        name: true,
        images: true,
      },
    });

    if (!product) {
      return res.status(404).json({
        status: "fail",
        message: "Product not found",
      });
    }

    res.json({ status: "success", data: product });
  } catch (error) {
    console.error("Error fetching product images:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch product images. Please try again later.",
    });
  }
});

// delete a product route
router.delete("/delete-product/:id", async (req, res) => {
  try {
    const productIdString = req.params.id;
    const productId = parseInt(productIdString);

    if (isNaN(productId) || productId < 1) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid product ID",
      });
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
      select: { images: true },
    });
    if (!existingProduct) {
      return res.status(404).json({
        status: "fail",
        message: "Product not found",
      });
    }

    const result = await prisma.product.delete({
      where: {
        id: productId,
      },
    });

    if (
      Array.isArray(existingProduct.images) &&
      existingProduct.images.length > 0
    ) {
      removeImagesFromDisk(existingProduct.images);
    }

    res.json({ status: "success", data: result });
  } catch (error) {
    console.error("Error deleting product:", error);

    if (error.code === "P2025") {
      return res.status(404).json({
        status: "fail",
        message: "Product not found",
      });
    }

    if (error.code === "P2003") {
      return res.status(409).json({
        status: "fail",
        message: "Cannot delete product. This product is referenced in orders.",
      });
    }

    res.status(500).json({
      status: "fail",
      message: "Failed to delete product. Please try again later.",
    });
  }
});

// POST /api/product/by-ids
router.post("/by-ids", async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    const parsedIds = ids
      .map((id) => Number.parseInt(String(id), 10))
      .filter((id) => Number.isFinite(id));

    if (parsedIds.length === 0) {
      return res.json({ status: "success", data: [] });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: parsedIds } },
      include: PRODUCT_INCLUDE,
    });

    res.json({ status: "success", data: products.map(withStockMeta) });
  } catch (error) {
    console.error("Error fetching products by ids:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch products. Please try again later.",
    });
  }
});

// GET /api/orders/aggregate
router.get("/statistic", async (req, res) => {
  try {
    const result = await prisma.product.aggregate({
      _count: true,
    });
    res.json({ status: "success", data: result });
  } catch (error) {
    console.error("Error fetching product statistics:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch product statistics. Please try again later.",
    });
  }
});

module.exports = router;
