const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const prisma = require("../../lib/prismaClient");
const bcrypt = require("bcryptjs");
const { getAdminAccess } = require("../adminAccess/adminAccessRoutes");

const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || "your-access-secret-key";
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "your-refresh-secret-key";
const ACCESS_TOKEN_EXPIRY = "15m"; // Short-lived
const REFRESH_TOKEN_EXPIRY = "7d"; // Long-lived

// POST /api/login/admin-login
router.post("/admin-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: "fail",
        data: "Email and password are required",
      });
    }

    // Find admin by email
    const admin = await prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      return res.status(401).json({
        status: "fail",
        data: "Invalid email or password",
      });
    }

    // Compare passwords (using bcrypt)
    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: "fail",
        data: "Invalid email or password",
      });
    }

    const access = getAdminAccess(admin.id);
    if (!access.active) {
      return res.status(403).json({
        status: "fail",
        data: "This admin account is inactive",
      });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { id: admin.id, email: admin.email },
      ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY },
    );

    const refreshToken = jwt.sign(
      { id: admin.id, email: admin.email },
      REFRESH_TOKEN_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY },
    );

    // Set refresh token in HTTP-only cookie (secure, cannot be accessed by JavaScript)
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true, // Cannot be accessed via JavaScript
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      sameSite: "strict", // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Send access token to frontend (will be stored in memory, not localStorage)
    res.json({
      status: "success",
      data: {
        accessToken,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: access.role,
          permissions: access.permissions,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      status: "fail",
      data: error.message,
    });
  }
});

// POST /api/login/refresh-token
router.post("/refresh-token", async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        status: "fail",
        data: "Refresh token not found",
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    const admin = await prisma.admin.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true },
    });

    if (!admin) {
      return res.status(401).json({
        status: "fail",
        data: "Admin not found",
      });
    }

    const access = getAdminAccess(admin.id);
    if (!access.active) {
      return res.status(403).json({
        status: "fail",
        data: "This admin account is inactive",
      });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { id: decoded.id, email: decoded.email },
      ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY },
    );

    res.json({
      status: "success",
      data: {
        accessToken: newAccessToken,
        admin: {
          ...admin,
          role: access.role,
          permissions: access.permissions,
        },
      },
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(401).json({
      status: "fail",
      data: "Invalid refresh token",
    });
  }
});

// POST /api/login/logout
router.post("/logout", async (req, res) => {
  try {
    // Clear refresh token cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.json({
      status: "success",
      data: "Logged out successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: "fail",
      data: error.message,
    });
  }
});

module.exports = router;
