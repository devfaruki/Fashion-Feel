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

// Setup directory for category images
const PUBLIC_DIR = path.join(__dirname, "..", "..", "public");
const CATEGORY_IMAGES_DIR = path.join(PUBLIC_DIR, "categories");
fs.mkdirSync(CATEGORY_IMAGES_DIR, { recursive: true });

// Helper: Delete category image from disk
function deleteCategoryImage(imagePath) {
  if (!imagePath || typeof imagePath !== "string") return;

  try {
    const normalized = imagePath.replace(/\\/g, "/");
    const relativePath = normalized.replace(/^\/?public\//, "");
    const absolutePath = path.join(PUBLIC_DIR, relativePath);

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (err) {
    console.error(`Failed to delete category image ${imagePath}:`, err);
  }
}

// GET all categories
router.get("/all-categories", async (req, res) => {
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

    const categories = await prisma.category.findMany({
      where,
      skip,
      take: limit,
      orderBy: { order: "asc" },
      include: {
        subCategories: {
          where: req.query.activeOnly === "true" ? { status: "active" } : {},
          orderBy: { order: "asc" },
          include: {
            _count: {
              select: {
                products: {
                  where: req.query.activeOnly === "true" ? {
                    stock: "available",
                    OR: [{ brand: null }, { brand: { status: "active" } }],
                  } : {},
                },
              },
            },
          },
        },
        _count: {
          select: {
            products: {
              where: req.query.activeOnly === "true" ? {
                stock: "available",
                OR: [{ brand: null }, { brand: { status: "active" } }],
              } : {}
            }
          }
        }
      },
    });

    const total = await prisma.category.count({ where });

    const payload = categories.map((category) => {
      const subCategories = (category.subCategories ?? []).map((subCategory) => ({
        ...subCategory,
        count: subCategory._count?.products ?? 0,
      }));
      const subCategoryCount = subCategories.reduce((sum, subCategory) => sum + (subCategory.count ?? 0), 0);
      return {
        ...category,
        subCategories,
        count: (category._count?.products ?? 0) + subCategoryCount,
      };
    });

    res.json({
      status: "success",
      data: { categories: payload, total, page, limit },
    });
  } catch (error) {
    console.error("Error fetching all categories:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch categories",
    });
  }
});

// GET single category with all products
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id) || id < 1) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid category ID",
      });
    }

    const category = await prisma.category.findUnique({
      where: { id },
      include: { products: true },
    });

    if (!category) {
      return res.status(404).json({
        status: "fail",
        message: "Category not found",
      });
    }

    res.json({ status: "success", data: category });
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch category",
    });
  }
});

// POST add category
// Accepts multipart/form-data (Multer) OR JSON with base64 image (legacy).
router.post(
  "/add-category",
  upload.single("image"),
  async (req, res) => {
    try {
      const { name, image, status } = req.body;

      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          status: "fail",
          message: "Category name is required",
        });
      }

      // Get the highest order value to add new category at the end
      const lastCategory = await prisma.category.findFirst({
        orderBy: { order: "desc" },
        select: { order: true },
      });

      const nextOrder = (lastCategory?.order ?? -1) + 1;

      let imagePath = null;

      try {
        if (req.file) {
          // New path: Multer file → compress with Sharp
          imagePath = await compressAndSave(
            req.file,
            CATEGORY_IMAGES_DIR,
            "category",
          );
          console.log("✅ Compressed & saved category image via Multer+Sharp");
        } else if (image && typeof image === "string") {
          // Legacy fallback: base64 → compress with Sharp
          imagePath = await compressBase64AndSave(
            image,
            CATEGORY_IMAGES_DIR,
            "category",
          );
          console.log("✅ Compressed & saved category image via base64+Sharp");
        }
      } catch (error) {
        return res.status(400).json({
          status: "fail",
          message: "Failed to save category image: " + error.message,
        });
      }

      const result = await prisma.category.create({
        data: {
          name: name.trim(),
          image: imagePath,
          order: nextOrder,
          status: status || "active",
        },
      });

      res.json({
        status: "success",
        data: result,
      });
    } catch (error) {
      console.error("Error creating category:", error);

      if (error.code === "P2002") {
        return res.status(409).json({
          status: "fail",
          message: "A category with this name already exists",
        });
      }

      res.status(500).json({
        status: "fail",
        message: "Failed to create category",
      });
    }
  },
);

// PATCH update category
// Accepts multipart/form-data (Multer) OR JSON with base64 image (legacy).
router.patch(
  "/update-category/:id",
  upload.single("image"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, image } = req.body;

      if (isNaN(id) || id < 1) {
        return res.status(400).json({
          status: "fail",
          message: "Invalid category ID",
        });
      }

      if (name !== undefined && (!name || name.trim().length === 0)) {
        return res.status(400).json({
          status: "fail",
          message: "Category name cannot be empty",
        });
      }

      // Fetch existing category to handle old image
      const existingCategory = await prisma.category.findUnique({
        where: { id },
      });

      if (!existingCategory) {
        return res.status(404).json({
          status: "fail",
          message: "Category not found",
        });
      }

      let imagePath = existingCategory.image; // Keep existing image by default

      // Handle new image
      try {
        if (req.file) {
          // New path: Multer file → compress with Sharp
          const newImagePath = await compressAndSave(
            req.file,
            CATEGORY_IMAGES_DIR,
            "category",
          );
          // Delete old image if it exists
          if (existingCategory.image) {
            deleteCategoryImage(existingCategory.image);
          }
          imagePath = newImagePath;
          console.log("✅ Compressed & saved category image via Multer+Sharp");
        } else if (image !== undefined) {
          if (image === null || image === "null") {
            // Explicitly removing image
            if (existingCategory.image) {
              deleteCategoryImage(existingCategory.image);
            }
            imagePath = null;
          } else if (image && typeof image === "string") {
            // Legacy fallback: base64 → compress with Sharp
            const newImagePath = await compressBase64AndSave(
              image,
              CATEGORY_IMAGES_DIR,
              "category",
            );
            // Delete old image if it exists
            if (existingCategory.image) {
              deleteCategoryImage(existingCategory.image);
            }
            imagePath = newImagePath;
            console.log("✅ Compressed & saved category image via base64+Sharp");
          }
        }
      } catch (error) {
        return res.status(400).json({
          status: "fail",
          message: "Failed to save category image: " + error.message,
        });
      }

      const result = await prisma.category.update({
        where: { id },
        data: {
          name: name !== undefined ? name.trim() : existingCategory.name,
          image: imagePath,
          status: req.body.status !== undefined ? req.body.status : existingCategory.status,
        },
      });

      res.json({
        status: "success",
        data: result,
      });
    } catch (error) {
      console.error("Error updating category:", error);

      if (error.code === "P2025") {
        return res.status(404).json({
          status: "fail",
          message: "Category not found",
        });
      }

      if (error.code === "P2002") {
        return res.status(409).json({
          status: "fail",
          message: "A category with this name already exists",
        });
      }

      res.status(500).json({
        status: "fail",
        message: "Failed to update category",
      });
    }
  },
);

// DELETE category
router.delete("/delete-category/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id) || id < 1) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid category ID",
      });
    }

    // Check if category exists
    const categoryExists = await prisma.category.findUnique({
      where: { id },
    });

    if (!categoryExists) {
      return res.status(404).json({
        status: "fail",
        message: "Category not found",
      });
    }

    // Delete category image from disk if it exists
    if (categoryExists.image) {
      deleteCategoryImage(categoryExists.image);
    }

    // Delete the category (will cascade and remove categoryId from products)
    const result = await prisma.category.delete({
      where: { id },
    });

    res.json({
      status: "success",
      message: "Category deleted successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error deleting category:", error);

    if (error.code === "P2025") {
      return res.status(404).json({
        status: "fail",
        message: "Category not found",
      });
    }

    res.status(500).json({
      status: "fail",
      message: "Failed to delete category",
    });
  }
});

// POST add subcategory under a category
router.post("/add-subcategory", async (req, res) => {
  try {
    const categoryId = parseInt(req.body.categoryId, 10);
    const name = String(req.body.name || "").trim();
    const status = req.body.status || "active";

    if (!categoryId || categoryId < 1) {
      return res.status(400).json({ status: "fail", message: "Category is required" });
    }
    if (!name) {
      return res.status(400).json({ status: "fail", message: "Subcategory name is required" });
    }

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return res.status(404).json({ status: "fail", message: "Category not found" });
    }

    const lastSubCategory = await prisma.subCategory.findFirst({
      where: { categoryId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const result = await prisma.subCategory.create({
      data: {
        categoryId,
        name,
        status,
        order: (lastSubCategory?.order ?? -1) + 1,
      },
      include: { category: true, _count: { select: { products: true } } },
    });

    res.json({ status: "success", data: { ...result, count: result._count?.products ?? 0 } });
  } catch (error) {
    console.error("Error creating subcategory:", error);
    if (error.code === "P2002") {
      return res.status(409).json({
        status: "fail",
        message: "A subcategory with this name already exists in this category",
      });
    }
    res.status(500).json({ status: "fail", message: "Failed to create subcategory" });
  }
});

// PATCH update subcategory
router.patch("/update-subcategory/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = {};

    if (!id || id < 1) {
      return res.status(400).json({ status: "fail", message: "Invalid subcategory ID" });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "name")) {
      const name = String(req.body.name || "").trim();
      if (!name) {
        return res.status(400).json({ status: "fail", message: "Subcategory name cannot be empty" });
      }
      data.name = name;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
      data.status = req.body.status || "active";
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "categoryId")) {
      const categoryId = parseInt(req.body.categoryId, 10);
      if (!categoryId || categoryId < 1) {
        return res.status(400).json({ status: "fail", message: "Category is required" });
      }
      data.categoryId = categoryId;
    }

    const result = await prisma.subCategory.update({
      where: { id },
      data,
      include: { category: true, _count: { select: { products: true } } },
    });

    res.json({ status: "success", data: { ...result, count: result._count?.products ?? 0 } });
  } catch (error) {
    console.error("Error updating subcategory:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ status: "fail", message: "Subcategory not found" });
    }
    if (error.code === "P2002") {
      return res.status(409).json({
        status: "fail",
        message: "A subcategory with this name already exists in this category",
      });
    }
    res.status(500).json({ status: "fail", message: "Failed to update subcategory" });
  }
});

// DELETE subcategory
router.delete("/delete-subcategory/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id < 1) {
      return res.status(400).json({ status: "fail", message: "Invalid subcategory ID" });
    }

    await prisma.product.updateMany({
      where: { subCategoryId: id },
      data: { subCategoryId: null },
    });

    const result = await prisma.subCategory.delete({ where: { id } });
    res.json({ status: "success", message: "Subcategory deleted successfully", data: result });
  } catch (error) {
    console.error("Error deleting subcategory:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ status: "fail", message: "Subcategory not found" });
    }
    res.status(500).json({ status: "fail", message: "Failed to delete subcategory" });
  }
});

module.exports = router;
