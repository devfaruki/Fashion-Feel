const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || "your-access-secret-key";

/**
 * Middleware to verify JWT access token
 * If token is tampered with, jwt.verify() will throw an error
 * If token is expired, jwt.verify() will throw an error
 * This ensures that any manipulation is immediately caught
 */
const verifyAccessToken = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // "Bearer TOKEN"

    if (!token) {
      return res.status(401).json({
        status: "fail",
        data: "Access token not found. Please login again.",
      });
    }

    // Verify token signature and expiration
    // If token is tampered with or expired, this will throw an error
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);

    // Attach admin info to request for use in route handlers
    req.admin = decoded;
    next();
  } catch (error) {
    console.error("Token verification error:", error.message);

    // Handle specific JWT errors
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "fail",
        data: "Access token expired. Please use refresh token to get a new one.",
      });
    } else if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        status: "fail",
        data: "Invalid token. Token appears to have been tampered with.",
      });
    }

    res.status(401).json({
      status: "fail",
      data: "Authentication failed",
    });
  }
};

module.exports = { verifyAccessToken };
