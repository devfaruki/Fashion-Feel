/**
 * Facebook Conversion API routes
 *
 * Endpoints:
 * POST /api/facebook/events - Track conversion events
 */

const express = require("express");
const crypto = require("crypto");
const FacebookConversionAPI = require("../../lib/facebookConversionAPI");
const prisma = require("../../lib/prismaClient");

const router = express.Router();
const META_CATALOG_CATEGORY = "Apparel & Accessories > Clothing";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeText(value) {
  return (value || "").toString().trim().toLowerCase();
}

function normalizeEmail(value) {
  return normalizeText(value);
}

function normalizePhone(value) {
  if (!value) return "";
  const digits = value.toString().replace(/\D/g, "");
  if (digits.startsWith("8801")) return digits;
  if (digits.startsWith("01")) return `88${digits}`;
  if (digits.length === 10 && digits.startsWith("1")) return `880${digits}`;
  return digits;
}

function isSha256(value) {
  return /^[a-f0-9]{64}$/i.test(value);
}

function hashOrPass(value) {
  if (!value) return undefined;
  return isSha256(value) ? value.toLowerCase() : sha256(value);
}

function maybeHashedField(value, normalizer = normalizeText) {
  const normalized = normalizer(value);
  return normalized ? hashOrPass(normalized) : undefined;
}

function validFbCookie(value) {
  if (!value) return undefined;
  return /^fb\.\d+\.\d+\..+/.test(value) ? value : undefined;
}

function normalizeBaseUrl(value, fallback) {
  const base = String(value || fallback || "").trim().replace(/\/$/, "");
  return base || "";
}

function getSiteBaseUrl(req) {
  return normalizeBaseUrl(
    process.env.FRONTEND_BASE_URL ||
      process.env.PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL,
    `${req.protocol}://${req.get("host")}`,
  );
}

function getAssetBaseUrl(req) {
  return normalizeBaseUrl(
    process.env.PUBLIC_ASSET_BASE_URL ||
      process.env.SERVER_BASE_URL ||
      process.env.API_BASE_URL,
    `${req.protocol}://${req.get("host")}`,
  );
}

function resolveAbsoluteUrl(baseUrl, value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const normalized = value.startsWith("/") ? value : `/${value}`;
  return `${baseUrl}${normalized}`;
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvRow(values) {
  return values.map(csvEscape).join(",");
}

function getPrimaryImage(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  return images.find(Boolean) || "";
}

function productAvailability(product) {
  const stockQty = Number(product.stockQty) || 0;
  if (product.stock === "unavailable" || stockQty <= 0) return "out of stock";
  return "in stock";
}

function formatCatalogPrice(value) {
  const amount = Number(value) || 0;
  return `${amount.toFixed(2)} BDT`;
}

router.get("/catalog.csv", async (req, res) => {
  try {
    const siteBaseUrl = getSiteBaseUrl(req);
    const assetBaseUrl = getAssetBaseUrl(req);

    const products = await prisma.product.findMany({
      where: {
        stock: "available",
        OR: [{ category: null }, { category: { status: "active" } }],
      },
      orderBy: [{ order: "asc" }, { id: "desc" }],
      include: { category: true, brand: true },
    });

    const headers = [
      "id",
      "title",
      "description",
      "availability",
      "condition",
      "price",
      "link",
      "image_link",
      "brand",
      "google_product_category",
      "fb_product_category",
      "sale_price",
      "item_group_id",
      "product_type",
    ];

    const rows = products.map((product) => {
      const productId = String(product.id);
      const hasSale =
        Number.isFinite(Number(product.oldPrice)) &&
        Number(product.oldPrice) > Number(product.price);

      return csvRow([
        productId,
        product.name,
        stripHtml(product.description || product.name),
        productAvailability(product),
        "new",
        formatCatalogPrice(hasSale ? product.oldPrice : product.price),
        `${siteBaseUrl}/product/${product.id}`,
        resolveAbsoluteUrl(assetBaseUrl, getPrimaryImage(product)),
        product.brand?.name || "Fasion Feel",
        META_CATALOG_CATEGORY,
        META_CATALOG_CATEGORY,
        hasSale ? formatCatalogPrice(product.price) : "",
        productId,
        product.category?.name || "Women's Fashion",
      ]);
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=900");
    return res.send([csvRow(headers), ...rows].join("\n"));
  } catch (error) {
    console.error("[Facebook Catalog Feed] Error:", error);
    return res.status(500).json({
      status: "fail",
      message: "Failed to generate Facebook catalog feed.",
    });
  }
});

router.post("/events", async (req, res) => {
  try {
    const pixelId = process.env.FACEBOOK_PIXEL_ID;
    const accessToken = process.env.FACEBOOK_CONVERSION_API_TOKEN;

    if (!pixelId || !accessToken) {
      return res.status(500).json({
        status: "fail",
        message: "Facebook configuration missing on server.",
      });
    }

    const body = req.body || {};
    const eventName = (body.eventName || "").trim();
    const eventId = (body.eventId || "").trim();

    if (!eventName || !eventId) {
      return res.status(400).json({
        status: "fail",
        message: "eventName and eventId are required.",
      });
    }

    const forwardedFor = (req.headers["x-forwarded-for"] || "").toString();
    const clientIpAddress =
      forwardedFor.split(",")[0]?.trim() || req.ip || undefined;
    const clientUserAgent = req.headers["user-agent"] || undefined;

    const userData = body.userData || {};

    const facebookUserData = {
      client_ip_address: clientIpAddress,
      client_user_agent: clientUserAgent,
      fbp: validFbCookie(userData.fbp),
      fbc: validFbCookie(userData.fbc),
      external_id: maybeHashedField(userData.external_id),
      em: maybeHashedField(userData.email, normalizeEmail),
      ph: maybeHashedField(userData.phone, normalizePhone),
      fn: maybeHashedField(userData.fn),
      ln: maybeHashedField(userData.ln),
      ct: maybeHashedField(userData.ct),
      zp: maybeHashedField(userData.zp),
      country: maybeHashedField(userData.country),
    };

    Object.keys(facebookUserData).forEach((key) => {
      if (
        facebookUserData[key] === undefined ||
        facebookUserData[key] === null
      ) {
        delete facebookUserData[key];
      }
    });

    const payload = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      event_source_url: body.eventSourceUrl,
      action_source: body.actionSource || "website",
      user_data: facebookUserData,
      custom_data: body.customData || {},
    };

    const facebookAPI = new FacebookConversionAPI(pixelId, accessToken);
    const result = await facebookAPI.trackEvent(payload);

    if (!result || !result.success) {
      return res.status(502).json({
        status: "fail",
        message: "Meta Conversions API request failed",
        details: result,
      });
    }

    return res.json({ status: "success", meta: result });
  } catch (error) {
    console.error("[Facebook Events Proxy] Error:", error);
    return res.status(500).json({
      status: "fail",
      message: "Internal server error",
      error: error.message,
    });
  }
});

router.get("/verify-webhook", (req, res) => {
  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === verifyToken) {
      console.log("[Facebook Webhook] Verified");
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }

  return res.sendStatus(400);
});

module.exports = router;
