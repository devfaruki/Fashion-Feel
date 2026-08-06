const express = require("express");
const fs = require("fs");
const path = require("path");

const { verifyAccessToken } = require("../../lib/authMiddleware");
const { upload, compressAndSave } = require("../../lib/upload");

const router = express.Router();

const PUBLIC_DIR = path.join(__dirname, "..", "..", "public");
const SETTINGS_DIR = path.join(PUBLIC_DIR, "site-settings");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "settings.json");

const defaultSettings = {
  brandName: "Fasion Feet",
  headerLogo: "/assets/logo.png",
  footerLogo: "/assets/logo.png",
  favicon: "/favicon.png",
  phone: "01603-438543",
  email: "fasionfeel.collection@gmail.com",
  showroomTitle: "Dhanmondi Showroom",
  address: "Shop-9, Level 3, Anam Rangs Plaza, Satmasjid Road, Dhanmondi 6/A, Dhaka",
  hours: "Sat - Thu, 10:00 AM - 8:00 PM",
  aboutIntro:
    "A fashion destination where you can find original Pakistani & Indian collection to keep your style unique.",
  aboutStory:
    "Fasion Feet began as a small studio in Dhanmondi with one belief - that every woman deserves authentic, beautifully crafted clothing without having to fly across borders to find it.",
  facebookUrl: "https://www.facebook.com/fasionfeel.com.bd",
  instagramUrl: "https://www.instagram.com/fasionfeel",
  gtmId: "",
  ga4MeasurementId: "",
  microsoftClarityId: "",
  metaPixelId: "",
  metaPixelAccessToken: "",
  metaPixelTestCode: "",
  tiktokPixelId: "",
  tiktokPixelAccessToken: "",
  tiktokPixelTestCode: "",
};

fs.mkdirSync(SETTINGS_DIR, { recursive: true });

function readSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return { ...defaultSettings };
    const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
    return { ...defaultSettings, ...saved };
  } catch (error) {
    console.error("Failed to read site settings:", error);
    return { ...defaultSettings };
  }
}

function writeSettings(settings) {
  fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

function getUploadedFile(files, fieldName) {
  const file = files?.[fieldName];
  return Array.isArray(file) && file.length > 0 ? file[0] : null;
}

function readText(body, key, fallback) {
  if (body[key] === undefined) return fallback;
  return String(body[key]).trim();
}

router.get("/", (_req, res) => {
  res.json({
    status: "success",
    data: readSettings(),
  });
});

router.patch(
  "/",
  verifyAccessToken,
  upload.fields([
    { name: "headerLogo", maxCount: 1 },
    { name: "footerLogo", maxCount: 1 },
    { name: "favicon", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const current = readSettings();
      const next = {
        ...current,
        brandName: readText(req.body, "brandName", current.brandName),
        phone: readText(req.body, "phone", current.phone),
        email: readText(req.body, "email", current.email),
        showroomTitle: readText(req.body, "showroomTitle", current.showroomTitle),
        address: readText(req.body, "address", current.address),
        hours: readText(req.body, "hours", current.hours),
        aboutIntro: readText(req.body, "aboutIntro", current.aboutIntro),
        aboutStory: readText(req.body, "aboutStory", current.aboutStory),
        facebookUrl: readText(req.body, "facebookUrl", current.facebookUrl),
        instagramUrl: readText(req.body, "instagramUrl", current.instagramUrl),
        gtmId: readText(req.body, "gtmId", current.gtmId),
        ga4MeasurementId: readText(req.body, "ga4MeasurementId", current.ga4MeasurementId),
        microsoftClarityId: readText(req.body, "microsoftClarityId", current.microsoftClarityId),
        metaPixelId: readText(req.body, "metaPixelId", current.metaPixelId),
        metaPixelAccessToken: readText(req.body, "metaPixelAccessToken", current.metaPixelAccessToken),
        metaPixelTestCode: readText(req.body, "metaPixelTestCode", current.metaPixelTestCode),
        tiktokPixelId: readText(req.body, "tiktokPixelId", current.tiktokPixelId),
        tiktokPixelAccessToken: readText(req.body, "tiktokPixelAccessToken", current.tiktokPixelAccessToken),
        tiktokPixelTestCode: readText(req.body, "tiktokPixelTestCode", current.tiktokPixelTestCode),
      };

      const headerLogo = getUploadedFile(req.files, "headerLogo");
      const footerLogo = getUploadedFile(req.files, "footerLogo");
      const favicon = getUploadedFile(req.files, "favicon");

      if (headerLogo) {
        next.headerLogo = await compressAndSave(headerLogo, SETTINGS_DIR, "header-logo", {
          maxWidth: 600,
          maxHeight: 240,
          targetBytes: 70 * 1024,
        });
      }

      if (footerLogo) {
        next.footerLogo = await compressAndSave(footerLogo, SETTINGS_DIR, "footer-logo", {
          maxWidth: 600,
          maxHeight: 240,
          targetBytes: 70 * 1024,
        });
      }

      if (favicon) {
        next.favicon = await compressAndSave(favicon, SETTINGS_DIR, "favicon", {
          maxWidth: 128,
          maxHeight: 128,
          targetBytes: 30 * 1024,
        });
      }

      writeSettings(next);

      res.json({
        status: "success",
        data: next,
      });
    } catch (error) {
      console.error("Error updating site settings:", error);
      res.status(500).json({
        status: "fail",
        message: "Failed to update site settings",
      });
    }
  },
);

module.exports = router;
