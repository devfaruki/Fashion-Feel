/**
 * Shared upload middleware using Multer + Sharp.
 *
 * - Multer: handles multipart/form-data file uploads (in-memory buffer).
 * - Sharp:  compresses & optimises images while preserving visual quality.
 *
 * All images are converted to high-quality WebP. The maximum dimension is
 * capped at 1920 px to keep file sizes small without visible loss.
 */

const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// ── MULTER SETUP ──────────────────────────────────────────────────────────────
// We use memoryStorage so that the raw buffer can be piped directly into Sharp
// before touching the filesystem.
const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const allowed = /^image\/(jpeg|jpg|png|gif|webp|svg\+xml|avif|bmp|tiff)$/i;
  if (allowed.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported image type: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB per file (raw, before compression)
  },
});

// ── SHARP COMPRESSION ─────────────────────────────────────────────────────────
/**
 * Compress a single image buffer with Sharp.
 *
 * Strategy:
 *  1. Resize if either dimension exceeds MAX_DIMENSION (keeps aspect ratio).
 *  2. Convert to WebP at `quality` (default 82) — excellent visual fidelity at
 *     a fraction of the original file size.
 *  3. Retry with slightly lower quality until the output is near the target
 *     size budget.
 *
 * A 300 KB phone photo typically shrinks to ~40-100 KB with no visible
 * difference.
 *
 * @param {Buffer}  buffer              Raw image buffer from Multer.
 * @param {Object}  [opts]              Options.
 * @param {number}  [opts.quality=82]   WebP quality (1-100).
 * @param {number}  [opts.maxWidth=1920] Max width in px.
 * @param {number}  [opts.maxHeight=1920] Max height in px.
 * @param {number}  [opts.targetBytes=102400] Preferred maximum output size.
 * @param {number}  [opts.minQuality=68] Minimum quality fallback.
 * @returns {Promise<Buffer>} Compressed WebP buffer.
 */
async function compressImage(buffer, opts = {}) {
  const {
    quality = 82,
    maxWidth = 1920,
    maxHeight = 1920,
    targetBytes = 100 * 1024,
    minQuality = 68,
  } = opts;

  let currentQuality = quality;
  let lastBuffer = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const output = await sharp(buffer)
      .rotate() // auto-rotate based on EXIF
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: "inside", // never upscale, keeps aspect ratio
        withoutEnlargement: true,
      })
      .webp({
        quality: currentQuality,
        effort: 4,
      })
      .toBuffer();

    lastBuffer = output;

    if (output.length <= targetBytes || currentQuality <= minQuality) {
      return output;
    }

    currentQuality = Math.max(minQuality, currentQuality - 6);
  }

  return lastBuffer;
}

// ── SAVE HELPERS ──────────────────────────────────────────────────────────────

function uid() {
  return crypto.randomBytes(6).toString("hex");
}

/**
 * Compress & save a single Multer file object to the given directory.
 *
 * @param {Object}  file        Multer file (has .buffer, .originalname, etc.)
 * @param {string}  destDir     Absolute path of the target directory.
 * @param {string}  prefix      Filename prefix, e.g. "product", "category".
 * @param {Object}  [opts]      Sharp options forwarded to compressImage().
 * @returns {Promise<string>}   Relative public path, e.g. "/public/products/product_abc123.webp"
 */
async function compressAndSave(file, destDir, prefix, opts) {
  fs.mkdirSync(destDir, { recursive: true });

  const compressed = await compressImage(file.buffer, opts);

  const fileName = `${prefix}_${Date.now()}_${uid()}.webp`;
  const absolutePath = path.join(destDir, fileName);

  fs.writeFileSync(absolutePath, compressed);

  // Derive the public-relative path from destDir
  // e.g.  …/public/products  →  /public/products/<file>
  const publicIdx = destDir.replace(/\\/g, "/").lastIndexOf("/public/");
  let relativePath;
  if (publicIdx !== -1) {
    relativePath = destDir.replace(/\\/g, "/").slice(publicIdx) + "/" + fileName;
  } else {
    // fallback: just store under /public/<last folder>
    const folder = path.basename(destDir);
    relativePath = `/public/${folder}/${fileName}`;
  }

  return relativePath;
}

/**
 * Compress & save multiple Multer files.
 *
 * @param {Object[]} files      Array of Multer file objects.
 * @param {string}   destDir    Target directory.
 * @param {string}   prefix     Filename prefix.
 * @param {Object}   [opts]     Sharp options.
 * @returns {Promise<string[]>} Array of public paths.
 */
async function compressAndSaveMany(files, destDir, prefix, opts) {
  const paths = [];
  for (const file of files) {
    const p = await compressAndSave(file, destDir, prefix, opts);
    paths.push(p);
  }
  return paths;
}

/**
 * Compress a base64 data-URL string (legacy fallback) and save to disk.
 *
 * @param {string}  dataUrl   Base64 data URL ("data:image/…;base64,…") or raw base64.
 * @param {string}  destDir   Target directory.
 * @param {string}  prefix    Filename prefix.
 * @param {Object}  [opts]    Sharp options.
 * @returns {Promise<string>} Relative public path.
 */
async function compressBase64AndSave(dataUrl, destDir, prefix, opts) {
  const trimmed = (dataUrl || "").trim();
  const match = trimmed.match(/^data:(.+);base64,(.+)$/);
  const base64Data = match ? match[2] : trimmed;
  const buffer = Buffer.from(base64Data, "base64");

  // Reuse the same compress-and-save pipeline
  const fakeFile = { buffer, originalname: "upload" };
  return compressAndSave(fakeFile, destDir, prefix, opts);
}

/**
 * Compress multiple base64 data-URL strings (legacy fallback).
 */
async function compressBase64AndSaveMany(dataUrls, destDir, prefix, opts) {
  const paths = [];
  for (const url of dataUrls) {
    const p = await compressBase64AndSave(url, destDir, prefix, opts);
    paths.push(p);
  }
  return paths;
}

module.exports = {
  upload,
  compressImage,
  compressAndSave,
  compressAndSaveMany,
  compressBase64AndSave,
  compressBase64AndSaveMany,
};
