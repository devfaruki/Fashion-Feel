const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const prisma = require("../../lib/prismaClient");
const { verifyAccessToken } = require("../../lib/authMiddleware");
const { upload, compressAndSave, compressBase64AndSave } = require("../../lib/upload");

const PUBLIC_DIR = path.join(__dirname, "..", "..", "public");
const HERO_IMAGES_DIR = path.join(PUBLIC_DIR, "hero-sections");
fs.mkdirSync(HERO_IMAGES_DIR, { recursive: true });

function deleteHeroImage(imagePath) {
    if (!imagePath || typeof imagePath !== "string") return;

    try {
        const normalized = imagePath.replace(/\\/g, "/");
        const relativePath = normalized.replace(/^\/?public\//, "");
        const absolutePath = path.join(PUBLIC_DIR, relativePath);

        if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
        }
    } catch (error) {
        console.error(`Failed to delete hero image ${imagePath}:`, error);
    }
}

function parseInteger(value, fallback) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getUploadedFile(files, fieldName) {
    const file = files?.[fieldName];
    return Array.isArray(file) && file.length > 0 ? file[0] : null;
}

async function saveHeroImage(file, legacyValue, prefix) {
    if (file) {
        return compressAndSave(file, HERO_IMAGES_DIR, prefix);
    }

    if (typeof legacyValue === "string" && legacyValue.trim()) {
        return compressBase64AndSave(legacyValue, HERO_IMAGES_DIR, prefix);
    }

    return null;
}

async function serializeHeroSection(section) {
    return {
        ...section,
        buttonUrl: section.buttonUrl || "/shop",
    };
}

// Public active hero sections for the storefront
router.get("/", async (req, res) => {
    try {
        const heroSections = await prisma.heroSection.findMany({
            where: { status: "active" },
            orderBy: [{ order: "asc" }, { id: "asc" }],
        });

        res.json({
            status: "success",
            data: {
                heroSections: await Promise.all(heroSections.map(serializeHeroSection)),
            },
        });
    } catch (error) {
        console.error("Error fetching hero sections:", error);
        res.status(500).json({
            status: "fail",
            message: "Failed to fetch hero sections",
        });
    }
});

// Protected admin listing with pagination/search
router.get("/admin", verifyAccessToken, async (req, res) => {
    try {
        const page = Math.max(1, parseInteger(req.query.page, 1));
        const limit = Math.max(1, parseInteger(req.query.limit, 10));
        const skip = (page - 1) * limit;
        const searchQuery = (req.query.search || "").toString().trim();

        const where = {};
        if (searchQuery.length > 0) {
            where.OR = [
                { title: { contains: searchQuery } },
                { subtitle: { contains: searchQuery } },
                { buttonText: { contains: searchQuery } },
            ];
        }

        if (req.query.status && req.query.status !== "ALL") {
            where.status = String(req.query.status);
        }

        const [heroSections, total] = await Promise.all([
            prisma.heroSection.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ order: "asc" }, { id: "asc" }],
            }),
            prisma.heroSection.count({ where }),
        ]);

        res.json({
            status: "success",
            data: {
                heroSections: await Promise.all(heroSections.map(serializeHeroSection)),
                total,
                page,
                limit,
            },
        });
    } catch (error) {
        console.error("Error fetching admin hero sections:", error);
        res.status(500).json({
            status: "fail",
            message: "Failed to fetch hero sections",
        });
    }
});

router.use(verifyAccessToken);

// Create hero section
router.post(
    "/",
    upload.fields([
        { name: "image", maxCount: 1 },
        { name: "mobileImage", maxCount: 1 },
    ]),
    async (req, res) => {
        try {
            const title = (req.body.title || "").toString().trim();
            const subtitle = (req.body.subtitle || "").toString().trim();
            const buttonText = (req.body.buttonText || "").toString().trim();
            const buttonUrl = (req.body.buttonUrl || "/shop").toString().trim() || "/shop";
            const status = (req.body.status || "active").toString().trim() || "active";
            const orderValue = req.body.order;

            if (!title || !subtitle || !buttonText) {
                return res.status(400).json({
                    status: "fail",
                    message: "Title, subtitle, and button text are required",
                });
            }

            const imageFile = getUploadedFile(req.files, "image");
            const mobileImageFile = getUploadedFile(req.files, "mobileImage");
            const imagePath = await saveHeroImage(imageFile, req.body.image, "hero-desktop");
            const mobileImagePath = await saveHeroImage(mobileImageFile, req.body.mobileImage, "hero-mobile");

            if (!imagePath || !mobileImagePath) {
                return res.status(400).json({
                    status: "fail",
                    message: "Both desktop and mobile hero images are required",
                });
            }

            const lastHeroSection = await prisma.heroSection.findFirst({
                orderBy: { order: "desc" },
                select: { order: true },
            });

            const nextOrder =
                orderValue !== undefined && String(orderValue).trim() !== ""
                    ? parseInteger(orderValue, (lastHeroSection?.order ?? -1) + 1)
                    : (lastHeroSection?.order ?? -1) + 1;

            const result = await prisma.heroSection.create({
                data: {
                    title,
                    subtitle,
                    buttonText,
                    buttonUrl,
                    image: imagePath,
                    mobileImage: mobileImagePath,
                    order: nextOrder,
                    status,
                },
            });

            res.json({
                status: "success",
                data: result,
            });
        } catch (error) {
            console.error("Error creating hero section:", error);
            res.status(500).json({
                status: "fail",
                message: "Failed to create hero section",
            });
        }
    },
);

// Update hero section
router.patch(
    "/:id",
    upload.fields([
        { name: "image", maxCount: 1 },
        { name: "mobileImage", maxCount: 1 },
    ]),
    async (req, res) => {
        try {
            const id = parseInteger(req.params.id, NaN);
            if (!Number.isFinite(id) || id < 1) {
                return res.status(400).json({
                    status: "fail",
                    message: "Invalid hero section ID",
                });
            }

            const existingHero = await prisma.heroSection.findUnique({ where: { id } });
            if (!existingHero) {
                return res.status(404).json({
                    status: "fail",
                    message: "Hero section not found",
                });
            }

            const nextTitle = req.body.title !== undefined ? req.body.title.toString().trim() : existingHero.title;
            const nextSubtitle =
                req.body.subtitle !== undefined ? req.body.subtitle.toString().trim() : existingHero.subtitle;
            const nextButtonText =
                req.body.buttonText !== undefined ? req.body.buttonText.toString().trim() : existingHero.buttonText;
            const nextButtonUrl =
                req.body.buttonUrl !== undefined
                    ? req.body.buttonUrl.toString().trim() || "/shop"
                    : existingHero.buttonUrl || "/shop";
            const nextStatus =
                req.body.status !== undefined ? req.body.status.toString().trim() || "active" : existingHero.status;
            const nextOrder =
                req.body.order !== undefined && String(req.body.order).trim() !== ""
                    ? parseInteger(req.body.order, existingHero.order)
                    : existingHero.order;

            const imageFile = getUploadedFile(req.files, "image");
            const mobileImageFile = getUploadedFile(req.files, "mobileImage");

            let imagePath = existingHero.image;
            let mobileImagePath = existingHero.mobileImage;

            const nextImage = await saveHeroImage(imageFile, req.body.image, "hero-desktop");
            if (nextImage) {
                deleteHeroImage(existingHero.image);
                imagePath = nextImage;
            } else if (req.body.image === null || req.body.image === "null") {
                deleteHeroImage(existingHero.image);
                imagePath = existingHero.image;
            }

            const nextMobileImage = await saveHeroImage(mobileImageFile, req.body.mobileImage, "hero-mobile");
            if (nextMobileImage) {
                deleteHeroImage(existingHero.mobileImage);
                mobileImagePath = nextMobileImage;
            } else if (req.body.mobileImage === null || req.body.mobileImage === "null") {
                deleteHeroImage(existingHero.mobileImage);
                mobileImagePath = existingHero.mobileImage;
            }

            const result = await prisma.heroSection.update({
                where: { id },
                data: {
                    title: nextTitle,
                    subtitle: nextSubtitle,
                    buttonText: nextButtonText,
                    buttonUrl: nextButtonUrl,
                    image: imagePath,
                    mobileImage: mobileImagePath,
                    order: nextOrder,
                    status: nextStatus,
                },
            });

            res.json({
                status: "success",
                data: result,
            });
        } catch (error) {
            console.error("Error updating hero section:", error);
            res.status(500).json({
                status: "fail",
                message: "Failed to update hero section",
            });
        }
    },
);

// Delete hero section
router.delete("/:id", async (req, res) => {
    try {
        const id = parseInteger(req.params.id, NaN);
        if (!Number.isFinite(id) || id < 1) {
            return res.status(400).json({
                status: "fail",
                message: "Invalid hero section ID",
            });
        }

        const existingHero = await prisma.heroSection.findUnique({ where: { id } });
        if (!existingHero) {
            return res.status(404).json({
                status: "fail",
                message: "Hero section not found",
            });
        }

        await prisma.heroSection.delete({ where: { id } });
        deleteHeroImage(existingHero.image);
        deleteHeroImage(existingHero.mobileImage);

        res.json({
            status: "success",
            data: true,
        });
    } catch (error) {
        console.error("Error deleting hero section:", error);
        res.status(500).json({
            status: "fail",
            message: "Failed to delete hero section",
        });
    }
});

module.exports = router;
