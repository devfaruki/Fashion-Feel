const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prismaClient");
const fs = require("fs");
const path = require("path");
const {
  upload,
  compressAndSave,
  compressBase64AndSave,
} = require("../../lib/upload");

const PUBLIC_DIR = path.join(__dirname, "..", "..", "public");
const BRAND_IMAGES_DIR = path.join(PUBLIC_DIR, "brands");
fs.mkdirSync(BRAND_IMAGES_DIR, { recursive: true });

function deleteBrandImage(imagePath) {
  if (!imagePath || typeof imagePath !== "string") return;

  try {
    const normalized = imagePath.replace(/\\/g, "/");
    const relativePath = normalized.replace(/^\/?public\//, "");
    const absolutePath = path.join(PUBLIC_DIR, relativePath);

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (err) {
    console.error(`Failed to delete brand image ${imagePath}:`, err);
  }
}

router.get("/all-brands", async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const searchQuery = (req.query.search || "").toString().trim();
    let where = {};
    if (searchQuery.length > 0) {
      where.name = { contains: searchQuery };
    }

    if (req.query.activeOnly === "true") {
      where.status = "active";
    }

    const brands = await prisma.brand.findMany({
      where,
      skip,
      take: limit,
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: {
            products: {
              where: req.query.activeOnly === "true" ? {
                stock: "available",
                OR: [{ category: null }, { category: { status: "active" } }],
              } : {}
            }
          }
        }
      },
    });

    const total = await prisma.brand.count({ where });

    const payload = brands.map((brand) => ({
      ...brand,
      count: brand._count?.products ?? 0,
    }));

    res.json({
      status: "success",
      data: { brands: payload, total, page, limit },
    });
  } catch (error) {
    console.error("Error fetching all brands:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch brands",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id) || id < 1) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid brand ID",
      });
    }

    const brand = await prisma.brand.findUnique({
      where: { id },
      include: { products: true },
    });

    if (!brand) {
      return res.status(404).json({
        status: "fail",
        message: "Brand not found",
      });
    }

    res.json({ status: "success", data: brand });
  } catch (error) {
    console.error("Error fetching brand:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch brand",
    });
  }
});

// POST add brand
// Accepts multipart/form-data (Multer) OR JSON with base64 image (legacy).
router.post(
  "/add-brand",
  upload.single("image"),
  async (req, res) => {
    try {
      const { name, image, status } = req.body;

      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          status: "fail",
          message: "Brand name is required",
        });
      }

      const lastBrand = await prisma.brand.findFirst({
        orderBy: { order: "desc" },
        select: { order: true },
      });

      const nextOrder = (lastBrand?.order ?? -1) + 1;

      let imagePath = null;

      try {
        if (req.file) {
          // New path: Multer file → compress with Sharp
          imagePath = await compressAndSave(
            req.file,
            BRAND_IMAGES_DIR,
            "brand",
          );
          console.log("✅ Compressed & saved brand image via Multer+Sharp");
        } else if (image && typeof image === "string") {
          // Legacy fallback: base64 → compress with Sharp
          imagePath = await compressBase64AndSave(
            image,
            BRAND_IMAGES_DIR,
            "brand",
          );
          console.log("✅ Compressed & saved brand image via base64+Sharp");
        }
      } catch (error) {
        return res.status(400).json({
          status: "fail",
          message: "Failed to save brand image: " + error.message,
        });
      }

      const result = await prisma.brand.create({
        data: {
          name: name.trim(),
          image: imagePath,
          order: nextOrder,
          status: status || "active",
        },
      });

      res.json({ status: "success", data: result });
    } catch (error) {
      console.error("Error creating brand:", error);

      if (error.code === "P2002") {
        return res.status(409).json({
          status: "fail",
          message: "A brand with this name already exists",
        });
      }

      res.status(500).json({
        status: "fail",
        message: "Failed to create brand",
      });
    }
  },
);

// PATCH update brand
// Accepts multipart/form-data (Multer) OR JSON with base64 image (legacy).
router.patch(
  "/update-brand/:id",
  upload.single("image"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, image } = req.body;

      if (isNaN(id) || id < 1) {
        return res.status(400).json({
          status: "fail",
          message: "Invalid brand ID",
        });
      }

      if (name !== undefined && (!name || name.trim().length === 0)) {
        return res.status(400).json({
          status: "fail",
          message: "Brand name cannot be empty",
        });
      }

      const existingBrand = await prisma.brand.findUnique({ where: { id } });
      if (!existingBrand) {
        return res.status(404).json({
          status: "fail",
          message: "Brand not found",
        });
      }

      let imagePath = existingBrand.image;

      try {
        if (req.file) {
          // New path: Multer file → compress with Sharp
          const newImagePath = await compressAndSave(
            req.file,
            BRAND_IMAGES_DIR,
            "brand",
          );
          if (existingBrand.image) {
            deleteBrandImage(existingBrand.image);
          }
          imagePath = newImagePath;
          console.log("✅ Compressed & saved brand image via Multer+Sharp");
        } else if (image !== undefined) {
          if (image === null || image === "null") {
            if (existingBrand.image) {
              deleteBrandImage(existingBrand.image);
            }
            imagePath = null;
          } else if (image && typeof image === "string") {
            // Legacy fallback: base64 → compress with Sharp
            const newImagePath = await compressBase64AndSave(
              image,
              BRAND_IMAGES_DIR,
              "brand",
            );
            if (existingBrand.image) {
              deleteBrandImage(existingBrand.image);
            }
            imagePath = newImagePath;
            console.log("✅ Compressed & saved brand image via base64+Sharp");
          }
        }
      } catch (error) {
        return res.status(400).json({
          status: "fail",
          message: "Failed to save brand image: " + error.message,
        });
      }

      const result = await prisma.brand.update({
        where: { id },
        data: {
          name: name !== undefined ? name.trim() : existingBrand.name,
          image: imagePath,
          status: req.body.status !== undefined ? req.body.status : existingBrand.status,
        },
      });

      res.json({ status: "success", data: result });
    } catch (error) {
      console.error("Error updating brand:", error);

      if (error.code === "P2025") {
        return res.status(404).json({
          status: "fail",
          message: "Brand not found",
        });
      }

      if (error.code === "P2002") {
        return res.status(409).json({
          status: "fail",
          message: "A brand with this name already exists",
        });
      }

      res.status(500).json({
        status: "fail",
        message: "Failed to update brand",
      });
    }
  },
);

router.delete("/delete-brand/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id) || id < 1) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid brand ID",
      });
    }

    const brandExists = await prisma.brand.findUnique({ where: { id } });
    if (!brandExists) {
      return res.status(404).json({
        status: "fail",
        message: "Brand not found",
      });
    }

    if (brandExists.image) {
      deleteBrandImage(brandExists.image);
    }

    const result = await prisma.brand.delete({ where: { id } });

    res.json({
      status: "success",
      message: "Brand deleted successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error deleting brand:", error);

    if (error.code === "P2025") {
      return res.status(404).json({
        status: "fail",
        message: "Brand not found",
      });
    }

    res.status(500).json({
      status: "fail",
      message: "Failed to delete brand",
    });
  }
});

module.exports = router;
