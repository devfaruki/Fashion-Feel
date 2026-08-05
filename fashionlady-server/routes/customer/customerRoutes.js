const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prismaClient");

function normalizePhone(phone) {
    if (!phone) return "";
    let cleaned = phone.replace(/\D/g, ""); // Remove all non-digits
    if (cleaned.startsWith("880")) {
        cleaned = cleaned.substring(2); // Remove '88' but keep '0' -> '01...'
    }
    if (cleaned.length === 10 && !cleaned.startsWith("0")) {
        cleaned = "0" + cleaned;
    }
    return cleaned;
}

function normalizeText(value) {
    return String(value || "").trim();
}

// POST /api/orders
router.post("/add-customer", async (req, res) => {
    try {
        const customerData = req.body;

        if (!customerData || Object.keys(customerData).length === 0) {
            return res.status(400).json({
                status: "fail",
                message: "Customer data is required",
            });
        }

        if (!customerData.name) {
            return res.status(400).json({
                status: "fail",
                message: "Customer name is required",
            });
        }

        if (customerData.phone) {
            customerData.phone = normalizePhone(customerData.phone);
        }

        if (customerData.name) customerData.name = normalizeText(customerData.name);
        if (customerData.address) customerData.address = normalizeText(customerData.address);
        if (customerData.district) customerData.district = normalizeText(customerData.district);
        if (customerData.thana) customerData.thana = normalizeText(customerData.thana);

        const result = await prisma.customer.create({
            data: customerData,
        });
        res.json({ status: "success", data: result });
    } catch (error) {
        console.error("Error creating customer:", error);

        if (error.code === "P2002") {
            return res.status(409).json({
                status: "fail",
                message: "A customer with this information already exists",
            });
        }

        res.status(500).json({
            status: "fail",
            message: "Failed to create customer. Please try again later.",
        });
    }
});

// GET /api/orders
// GET /api/customer - list customers with pagination and optional search
router.get("/all-customer", async (req, res) => {
    try {
        // Pagination: accept `page` and `limit` (or `per_page`) as query params.
        // Default: page=1, limit=10
        let page = parseInt(req.query.page, 10);
        let limit = parseInt(req.query.limit || req.query.per_page, 10);

        if (isNaN(page) || page < 1) page = 1;
        if (isNaN(limit) || limit < 1) limit = 10;
        // Prevent extremely large limits
        const MAX_LIMIT = 100;
        if (limit > MAX_LIMIT) limit = MAX_LIMIT;

        const skip = (page - 1) * limit;

        // Build search filter if provided. We search `name`, `phone`, `address`, and `customerId`. If numeric, search `id`.
        const searchQuery = (req.query.search || "").toString().trim();
        let where = {};
        if (searchQuery.length > 0) {
            const numVal = Number(searchQuery);
            const isNumeric = !Number.isNaN(numVal);
            const normalizedSearch = normalizePhone(searchQuery);

            where = {
                OR: [
                    { name: { contains: searchQuery } },
                    { phone: { contains: searchQuery } },
                    { address: { contains: searchQuery } },
                    { district: { contains: searchQuery } },
                    { thana: { contains: searchQuery } },
                    { customerId: { contains: searchQuery } },
                ],
            };

            if (normalizedSearch && normalizedSearch.length >= 10) {
                where.OR.push({ phone: { contains: normalizedSearch } });
            }

            if (isNumeric) where.OR.push({ id: numVal });
        }

        // Fetch customers with pagination and optional search filter
        const customers = await prisma.customer.findMany({
            where,
            include: {
                Orders: {
                    select: {
                        totalPrice: true,
                        orderStatus: true,
                    },
                },
            },
            orderBy: { id: "desc" },
            skip,
            take: limit,
        });

        // Get total count for the filtered result
        const total = await prisma.customer.count({ where });

        // If consumer wants only the count (no data), return the number directly
        if (req.query.countOnly && (req.query.countOnly === "true" || req.query.countOnly === "1")) {
            return res.json({ status: "success", data: total });
        }

        res.json({
            status: "success",
            data: {
                customers: customers.map((c) => ({
                    ...c,
                    orderCount: c.Orders.length,
                    totalSpent: c.Orders.filter((o) => o.orderStatus !== "CANCELLED").reduce(
                        (sum, o) => sum + o.totalPrice,
                        0,
                    ),
                    Orders: undefined, // Remove detailed orders from list
                })),
                total,
                page,
                limit,
            },
        });
    } catch (error) {
        console.error("Error fetching customers:", error);
        res.status(500).json({
            status: "fail",
            message: "Failed to fetch customers. Please try again later.",
        });
    }
});

// GET /api/orders/:id
router.get("/customer-details/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        if (isNaN(id) || id < 1) {
            return res.status(400).json({
                status: "fail",
                message: "Invalid customer ID",
            });
        }

        const result = await prisma.customer.findUnique({
            where: {
                id: id,
            },
        });

        if (!result) {
            return res.status(404).json({
                status: "fail",
                message: "Customer not found",
            });
        }

        res.json({ status: "success", data: result });
    } catch (error) {
        console.error("Error fetching customer details:", error);
        res.status(500).json({
            status: "fail",
            message: "Failed to fetch customer details. Please try again later.",
        });
    }
});

// delete a customer route
router.delete("/delete-customer/:id", async (req, res) => {
    try {
        const customerIdString = req.params.id;
        const customertId = parseInt(customerIdString);

        if (isNaN(customertId) || customertId < 1) {
            return res.status(400).json({
                status: "fail",
                message: "Invalid customer ID",
            });
        }

        const result = await prisma.customer.delete({
            where: {
                id: customertId,
            },
        });
        res.json({ status: "success", data: result });
    } catch (error) {
        console.error("Error deleting customer:", error);

        if (error.code === "P2025") {
            return res.status(404).json({
                status: "fail",
                message: "Customer not found",
            });
        }

        if (error.code === "P2003") {
            return res.status(409).json({
                status: "fail",
                message: "Cannot delete customer. This customer has associated orders.",
            });
        }

        res.status(500).json({
            status: "fail",
            message: "Failed to delete customer. Please try again later.",
        });
    }
});

// Update a customer route
router.patch("/update-customer/:id", async (req, res) => {
    try {
        const customerIdString = req.params.id;
        const customerId = parseInt(customerIdString);
        const customerUpdateData = req.body;

        if (isNaN(customerId) || customerId < 1) {
            return res.status(400).json({
                status: "fail",
                message: "Invalid customer ID",
            });
        }

        if (!customerUpdateData || Object.keys(customerUpdateData).length === 0) {
            return res.status(400).json({
                status: "fail",
                message: "No update data provided",
            });
        }

        if (customerUpdateData.phone) {
            customerUpdateData.phone = normalizePhone(customerUpdateData.phone);
        }

        if (customerUpdateData.name) customerUpdateData.name = normalizeText(customerUpdateData.name);
        if (customerUpdateData.address) customerUpdateData.address = normalizeText(customerUpdateData.address);
        if (customerUpdateData.district) customerUpdateData.district = normalizeText(customerUpdateData.district);
        if (customerUpdateData.thana) customerUpdateData.thana = normalizeText(customerUpdateData.thana);

        const result = await prisma.customer.update({
            where: {
                id: customerId,
            },
            data: customerUpdateData,
        });
        res.json({ status: "success", data: result });
    } catch (error) {
        console.error("Error updating customer:", error);

        if (error.code === "P2025") {
            return res.status(404).json({
                status: "fail",
                message: "Customer not found",
            });
        }

        if (error.code === "P2002") {
            return res.status(409).json({
                status: "fail",
                message: "A customer with this information already exists",
            });
        }

        res.status(500).json({
            status: "fail",
            message: "Failed to update customer. Please try again later.",
        });
    }
});

// GET /api/customer/customer-orders/:id
router.get("/customer-orders/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        if (isNaN(id) || id < 1) {
            return res.status(400).json({
                status: "fail",
                message: "Invalid customer ID",
            });
        }

        const orders = await prisma.order.findMany({
            where: {
                customerId: id,
            },
            orderBy: {
                id: "desc",
            },
        });

        res.json({ status: "success", data: orders });
    } catch (error) {
        console.error("Error fetching customer orders:", error);
        res.status(500).json({
            status: "fail",
            message: "Failed to fetch customer orders. Please try again later.",
        });
    }
});

// GET /api/orders/aggregate
router.get("/statistic", async (req, res) => {
    try {
        const result = await prisma.customer.aggregate({
            _count: true,
        });
        res.json({ status: "success", data: result });
    } catch (error) {
        console.error("Error fetching customer statistics:", error);
        res.status(500).json({
            status: "fail",
            message: "Failed to fetch customer statistics. Please try again later.",
        });
    }
});

module.exports = router;
