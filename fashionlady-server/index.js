const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const methodOverride = require("method-override");
const path = require("path");
const fs = require("fs");
const routes = require("./routes");
const prisma = require("./lib/prismaClient");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure public directories exist for serving uploaded assets
const PUBLIC_DIR = path.join(__dirname, "public");
const PRODUCT_IMAGES_DIR = path.join(PUBLIC_DIR, "products");
const CATEGORY_IMAGES_DIR = path.join(PUBLIC_DIR, "categories");
const BRAND_IMAGES_DIR = path.join(PUBLIC_DIR, "brands");
fs.mkdirSync(PRODUCT_IMAGES_DIR, { recursive: true });
fs.mkdirSync(CATEGORY_IMAGES_DIR, { recursive: true });
fs.mkdirSync(BRAND_IMAGES_DIR, { recursive: true });

// -------------------- MIDDLEWARES --------------------
// Allowed origins for CORS
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://localhost:5174",
  "https://stylepear.com",
  "https://admin.stylepear.com",
  "https://fasionfeel.com.bd",
  "https://admin.fasionfeel.com.bd",
];

// Use the cors package with proper configuration
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("Blocked by CORS:", origin);
        callback(null, false);
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "X-HTTP-Method-Override",
    ],
    credentials: true,
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  }),
);

// Handle preflight for all routes explicitly
app.options("*", cors());

app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser()); // Add cookie parser middleware for handling HTTP-only cookies
// Allow clients to tunnel PUT/PATCH/DELETE over POST via header or query param
app.use(methodOverride("X-HTTP-Method-Override"));
app.use(methodOverride("_method"));
app.use("/public", express.static(PUBLIC_DIR));

// -------------------- ROUTES --------------------
app.use("/api", routes);

// -------------------- HEALTH CHECK --------------------
app.get("/", async (req, res) => {
  // Check database connection status
  let dbStatus = "unknown";
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch (error) {
    dbStatus = "disconnected: " + error.message;
  }

  res.json({
    status: "success",
    message: "Ecommerce server is running",
    database: dbStatus,
    environment: {
      hasDbUrl: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV || "not set",
    },
  });
});

// -------------------- 404 HANDLER --------------------
app.use((req, res, next) => {
  res.status(404).json({
    status: "fail",
    message: `Cannot ${req.method} ${req.path}. The requested endpoint does not exist.`,
  });
});

// -------------------- GLOBAL ERROR HANDLER --------------------
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);

  res.status(error.status || 500).json({
    status: "fail",
    message:
      error.message || "An unexpected error occurred. Please try again later.",
  });
});

// -------------------- DATABASE CONNECTION --------------------
(async () => {
  try {
    await prisma.$connect();
    console.log("✅ Connected to the database");
  } catch (error) {
    console.error("❌ Error connecting to the database:", error);
  }
})();

// -------------------- START SERVER --------------------
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});

module.exports = app;
