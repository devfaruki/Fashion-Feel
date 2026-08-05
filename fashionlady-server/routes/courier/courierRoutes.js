const express = require("express");
const router = express.Router();

// GET /api/courier/check-fraud
router.get("/check-fraud", async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ status: "error", message: "Phone number is required" });
    }

    const targetUrl = `https://api.bdcourier.com/courier-check?phone=${phone}&type=free`;
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.COURIER_CHECK_API}`,
      },
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { status: "error", message: text };
    }
    
    res.json(data);
  } catch (error) {
    console.error("Error checking fraud:", error);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

// GET /api/courier/status/:consignmentId
router.get("/status/:consignmentId", async (req, res) => {
  try {
    const { consignmentId } = req.params;
    if (!consignmentId) {
      return res.status(400).json({ status: "error", message: "Consignment ID is required" });
    }

    const response = await fetch(`${process.env.COURIER_BASE_URL}/status_by_cid/${consignmentId}`, {
      method: "GET",
      headers: {
        "Api-Key": process.env.COURIER_API_KEY,
        "Secret-Key": process.env.COURIER_SECRET_KEY,
        "Content-Type": "application/json",
      },
    });

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      result = { status: response.status === 200 ? "success" : "error", message: text };
    }

    res.status(response.status).json(result);
  } catch (error) {
    console.error("Error fetching courier status:", error);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

// GET /api/courier/status/:type/:key
router.get("/status/:type/:key", async (req, res) => {
  try {
    const { type, key } = req.params;
    if (!type || !key) {
      return res.status(400).json({ status: "error", message: "Lookup type and key are required" });
    }

    let statusPath;
    switch (type) {
      case "cid":
        statusPath = `/status_by_cid/${encodeURIComponent(key)}`;
        break;
      case "invoice":
        statusPath = `/status_by_invoice/${encodeURIComponent(key)}`;
        break;
      case "trackingcode":
        statusPath = `/status_by_trackingcode/${encodeURIComponent(key)}`;
        break;
      default:
        return res.status(400).json({ status: "error", message: "Invalid courier lookup type" });
    }

    const response = await fetch(`${process.env.COURIER_BASE_URL}${statusPath}`, {
      method: "GET",
      headers: {
        "Api-Key": process.env.COURIER_API_KEY,
        "Secret-Key": process.env.COURIER_SECRET_KEY,
        "Content-Type": "application/json",
      },
    });

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      result = { status: response.status === 200 ? "success" : "error", message: text };
    }

    res.status(response.status).json(result);
  } catch (error) {
    console.error("Error fetching courier status:", error);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

// POST /api/courier/create-order
router.post("/create-order", async (req, res) => {
  try {
    const data = req.body;
    
    const response = await fetch(`${process.env.COURIER_BASE_URL}/create_order`, {
      method: "POST",
      headers: {
        "Api-Key": process.env.COURIER_API_KEY,
        "Secret-Key": process.env.COURIER_SECRET_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      // If the response is not valid JSON, return it as a message
      result = { status: response.status === 200 ? "success" : "error", message: text };
    }
    
    res.status(response.status).json(result);
  } catch (error) {
    console.error("Error creating courier order:", error);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

module.exports = router;
