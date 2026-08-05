const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const prisma = require("../../lib/prismaClient");
const {
  upload,
  compressAndSaveMany,
  compressBase64AndSaveMany,
} = require("../../lib/upload");

const PUBLIC_DIR = path.join(__dirname, "..", "..", "public");
const REVIEW_IMAGES_DIR = path.join(PUBLIC_DIR, "reviews");
fs.mkdirSync(REVIEW_IMAGES_DIR, { recursive: true });

const REVIEW_STATUSES = ["PENDING", "APPROVED", "CANCELLED"];

function normalizeImagePath(imagePath) {
  if (!imagePath || typeof imagePath !== "string") return null;
  const normalized = imagePath.replace(/\\/g, "/");
  const relativePath = normalized.replace(/^\/?public\//, "");
  return path.join(PUBLIC_DIR, relativePath);
}

function removeReviewImages(imagePaths = []) {
  for (const imgPath of imagePaths) {
    const absolutePath = normalizeImagePath(imgPath);
    if (!absolutePath) continue;
    try {
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    } catch (err) {
      console.error(`Failed to delete review image ${absolutePath}:`, err);
    }
  }
}

function toSafeInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseIncomingImages(payload) {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    return payload.filter((item) => typeof item === "string" && item.trim());
  }

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item) => typeof item === "string" && item.trim().length > 0,
        );
      }
      return [];
    } catch {
      return [trimmed];
    }
  }

  return [];
}

function extractUploadedFiles(filesPayload) {
  if (!filesPayload) return [];
  if (Array.isArray(filesPayload)) return filesPayload;
  if (typeof filesPayload === "object") {
    return Object.values(filesPayload).flat();
  }
  return [];
}

function buildReviewPayload(review) {
  return {
    id: review.id,
    customerName: review.customerName,
    rating: review.rating,
    comment: review.comment,
    images: Array.isArray(review.images) ? review.images : [],
    status: review.status,
    createdAt: review.createdAt,
    product: review.product
      ? {
          id: review.product.id,
          name: review.product.name,
          images: Array.isArray(review.product.images)
            ? review.product.images
            : [],
        }
      : null,
  };
}

// POST /api/review/add-review
// Public endpoint for customers. Accepts multipart/form-data or JSON base64 images.
router.post(
  "/add-review",
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "reviewImages", maxCount: 10 },
    { name: "photos", maxCount: 10 },
  ]),
  async (req, res) => {
    try {
      const customerName = (req.body.customerName || "").trim();
      const comment = (req.body.comment || req.body.description || "").trim();
      const rating = toSafeInt(req.body.rating, NaN);
      const productId = toSafeInt(req.body.productId, NaN);

      if (!customerName) {
        return res.status(400).json({
          status: "fail",
          message: "Customer name is required",
        });
      }

      if (!comment) {
        return res.status(400).json({
          status: "fail",
          message: "Review comment is required",
        });
      }

      if (Number.isNaN(productId) || productId < 1) {
        return res.status(400).json({
          status: "fail",
          message: "A valid product ID is required",
        });
      }

      if (Number.isNaN(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({
          status: "fail",
          message: "Rating must be between 1 and 5",
        });
      }

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, images: true },
      });

      if (!product) {
        return res.status(404).json({
          status: "fail",
          message: "Product not found",
        });
      }

      const incomingFiles = extractUploadedFiles(req.files);

      let uploadedImages = [];
      try {
        if (incomingFiles.length > 0) {
          uploadedImages = await compressAndSaveMany(
            incomingFiles,
            REVIEW_IMAGES_DIR,
            "review",
          );
        } else {
          const incomingImages = parseIncomingImages(req.body.images);
          if (incomingImages.length > 0) {
            uploadedImages = await compressBase64AndSaveMany(
              incomingImages,
              REVIEW_IMAGES_DIR,
              "review",
            );
          }
        }
      } catch (imageError) {
        console.error("Error uploading review images:", imageError);
        return res.status(400).json({
          status: "fail",
          message: "Failed to upload review images. Please check image format.",
        });
      }

      const review = await prisma.review.create({
        data: {
          customerName,
          rating,
          comment,
          images: uploadedImages,
          product: { connect: { id: productId } },
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              images: true,
            },
          },
        },
      });

      res.status(201).json({
        status: "success",
        message: "Review submitted successfully and is pending approval",
        data: buildReviewPayload(review),
      });
    } catch (error) {
      console.error("Error creating review:", error);
      res.status(500).json({
        status: "fail",
        message: "Failed to submit review",
      });
    }
  },
);

// GET /api/review/product/:productId
// Public endpoint for product details page. Returns approved reviews only.
router.get("/product/:productId", async (req, res) => {
  try {
    const productId = toSafeInt(req.params.productId, NaN);

    if (Number.isNaN(productId) || productId < 1) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid product ID",
      });
    }

    const page = Math.max(1, toSafeInt(req.query.page, 1));
    const limit = Math.min(50, Math.max(1, toSafeInt(req.query.limit, 10)));
    const skip = (page - 1) * limit;

    const where = {
      productId,
      status: "APPROVED",
    };

    const [reviews, total, aggregate] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          customerName: true,
          rating: true,
          comment: true,
          images: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.review.count({ where }),
      prisma.review.aggregate({
        where,
        _avg: { rating: true },
      }),
    ]);

    res.json({
      status: "success",
      data: {
        reviews: reviews.map((review) => ({
          ...review,
          images: Array.isArray(review.images) ? review.images : [],
        })),
        total,
        page,
        limit,
        averageRating: Number(aggregate._avg.rating || 0),
      },
    });
  } catch (error) {
    console.error("Error fetching product reviews:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch product reviews",
    });
  }
});

// GET /api/review/recent
// Public home-page feed with the most recent approved reviews across products.
router.get("/recent", async (req, res) => {
  try {
    const limit = Math.min(20, Math.max(1, toSafeInt(req.query.limit, 20)));
    const page = Math.max(1, toSafeInt(req.query.page, 1));
    const skip = (page - 1) * limit;
    const where = { status: "APPROVED" };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              images: true,
            },
          },
        },
      }),
      prisma.review.count({ where }),
    ]);

    res.json({
      status: "success",
      data: {
        reviews: reviews.map(buildReviewPayload),
        total,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching recent reviews:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch recent reviews",
    });
  }
});

// GET /api/review/admin/all-reviews
// Admin listing endpoint with product and review data.
router.get("/admin/all-reviews", async (req, res) => {
  try {
    const page = Math.max(1, toSafeInt(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, toSafeInt(req.query.limit, 10)));
    const skip = (page - 1) * limit;

    const search = (req.query.search || "").toString().trim();
    const productId = toSafeInt(req.query.productId, NaN);
    const status = (req.query.status || "").toString().trim().toUpperCase();

    const where = { AND: [] };

    if (!Number.isNaN(productId) && productId > 0) {
      where.AND.push({ productId });
    }

    if (status) {
      if (!REVIEW_STATUSES.includes(status)) {
        return res.status(400).json({
          status: "fail",
          message: "Status must be one of PENDING, APPROVED, CANCELLED",
        });
      }
      where.AND.push({ status });
    }

    if (search) {
      where.AND.push({
        OR: [
          { customerName: { contains: search } },
          { comment: { contains: search } },
          { product: { name: { contains: search } } },
        ],
      });
    }

    const finalWhere = where.AND.length > 0 ? where : {};

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: finalWhere,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              images: true,
            },
          },
        },
      }),
      prisma.review.count({ where: finalWhere }),
    ]);

    res.json({
      status: "success",
      data: {
        reviews: reviews.map(buildReviewPayload),
        total,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching admin review list:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch reviews",
    });
  }
});

// GET /api/review/admin/:id
// Admin review detail endpoint for modal view.
router.get("/admin/:id", async (req, res) => {
  try {
    const id = toSafeInt(req.params.id, NaN);

    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid review ID",
      });
    }

    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            images: true,
            productId: true,
          },
        },
      },
    });

    if (!review) {
      return res.status(404).json({
        status: "fail",
        message: "Review not found",
      });
    }

    res.json({
      status: "success",
      data: buildReviewPayload(review),
    });
  } catch (error) {
    console.error("Error fetching review details:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch review details",
    });
  }
});

// PATCH /api/review/admin/update-status/:id
// Admin moderation endpoint: status can be PENDING, APPROVED, or CANCELLED.
router.patch("/admin/update-status/:id", async (req, res) => {
  try {
    const id = toSafeInt(req.params.id, NaN);
    const status = (req.body.status || "").toString().trim().toUpperCase();

    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid review ID",
      });
    }

    if (!REVIEW_STATUSES.includes(status)) {
      return res.status(400).json({
        status: "fail",
        message: "Status must be one of PENDING, APPROVED, CANCELLED",
      });
    }

    const updatedReview = await prisma.review.update({
      where: { id },
      data: { status },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            images: true,
          },
        },
      },
    });

    res.json({
      status: "success",
      message: "Review status updated successfully",
      data: buildReviewPayload(updatedReview),
    });
  } catch (error) {
    console.error("Error updating review status:", error);

    if (error.code === "P2025") {
      return res.status(404).json({
        status: "fail",
        message: "Review not found",
      });
    }

    res.status(500).json({
      status: "fail",
      message: "Failed to update review status",
    });
  }
});

// DELETE /api/review/admin/delete/:id
router.delete("/admin/delete/:id", async (req, res) => {
  try {
    const id = toSafeInt(req.params.id, NaN);

    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid review ID",
      });
    }

    const existing = await prisma.review.findUnique({
      where: { id },
      select: { id: true, images: true },
    });

    if (!existing) {
      return res.status(404).json({
        status: "fail",
        message: "Review not found",
      });
    }

    await prisma.review.delete({ where: { id } });

    const reviewImages = Array.isArray(existing.images) ? existing.images : [];
    if (reviewImages.length > 0) {
      removeReviewImages(reviewImages);
    }

    res.json({
      status: "success",
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to delete review",
    });
  }
});

module.exports = router;
