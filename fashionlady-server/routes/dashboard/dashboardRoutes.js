const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prismaClient");

// ============================================
// GET /api/dashboard/sales-overview
// Returns daily/weekly sales data
// ============================================
router.get("/sales-overview", async (req, res) => {
    try {
        const timeframe = (req.query.timeframe || "weekly").toLowerCase(); // weekly, monthly, yearly
        let startDate = new Date();

        if (timeframe === "weekly") {
            startDate.setDate(startDate.getDate() - 7);
        } else if (timeframe === "monthly") {
            startDate.setMonth(startDate.getMonth() - 1);
        } else if (timeframe === "yearly") {
            startDate.setFullYear(startDate.getFullYear() - 1);
        }

        // Fetch all orders within timeframe
        const orders = await prisma.order.findMany({
            where: {
                orderDate: {
                    gte: startDate,
                },
            },
            select: {
                orderDate: true,
                totalPrice: true,
            },
        });

        // Group by date
        const salesMap = {};
        orders.forEach((order) => {
            const date = new Date(order.orderDate).toISOString().split("T")[0]; // YYYY-MM-DD
            salesMap[date] = (salesMap[date] || 0) + order.totalPrice;
        });

        // Convert to sorted array
        const salesData = Object.entries(salesMap)
            .map(([date, total]) => ({
                date,
                sales: total,
            }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        res.json({
            status: "success",
            data: {
                timeframe,
                totalSales: orders.reduce((sum, order) => sum + order.totalPrice, 0),
                orderCount: orders.length,
                chartData: salesData,
            },
        });
    } catch (error) {
        console.error("Error in /sales-overview:", error);
        res.status(500).json({
            status: "fail",
            message: "Failed to fetch sales overview. Please try again later.",
        });
    }
});

// ============================================
// GET /api/dashboard/orders-by-category
// Returns product category (filter) and order counts
// ============================================
router.get("/orders-by-category", async (req, res) => {
    try {
        // Get all categories with their product counts and order aggregates
        const categories = await prisma.category.findMany({
            select: {
                id: true,
                name: true,
                products: {
                    select: {
                        id: true,
                        productId: true,
                    },
                },
            },
        });

        // Build category stats by checking which products have orders
        const categoryStats = [];

        // Fetch orders once instead of inside the loop
        const orders = await prisma.order.findMany({
            select: { items: true },
        });

        for (const category of categories) {
            const productIds = new Set();
            category.products.forEach((prod) => {
                productIds.add(prod.id);
                if (prod.productId) {
                    productIds.add(prod.productId);
                }
            });

            if (productIds.size > 0) {
                let orderCount = 0;
                orders.forEach((order) => {
                    const items = Array.isArray(order.items) ? order.items : [];
                    let hasCategoryProduct = false;
                    items.forEach((item) => {
                        if (productIds.has(item.productId) || productIds.has(item.id)) {
                            hasCategoryProduct = true;
                        }
                    });
                    if (hasCategoryProduct) {
                        orderCount++;
                    }
                });

                if (orderCount > 0) {
                    categoryStats.push({
                        category: category.name,
                        orderCount,
                    });
                }
            }
        }

        res.json({
            status: "success",
            data: {
                chartData: categoryStats,
                totalOrders: categoryStats.reduce((sum, cat) => sum + cat.orderCount, 0),
            },
        });
    } catch (error) {
        console.error("Error in /orders-by-category:", error);
        res.status(500).json({
            status: "fail",
            message: "Failed to fetch orders by category. Please try again later.",
        });
    }
});

// ============================================
// GET /api/dashboard/payment-breakdown
// Returns payment method breakdown
// ============================================
router.get("/payment-breakdown", async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            select: {
                paymentMethod: true,
                totalPrice: true,
            },
        });

        const paymentBreakdown = {};

        orders.forEach((order) => {
            const method = order.paymentMethod || "UNKNOWN";
            if (!paymentBreakdown[method]) {
                paymentBreakdown[method] = { count: 0, totalAmount: 0 };
            }
            paymentBreakdown[method].count += 1;
            paymentBreakdown[method].totalAmount += order.totalPrice;
        });

        const chartData = Object.entries(paymentBreakdown).map(([method, data]) => ({
            method: method === "CASHON" ? "Cash On Delivery" : method === "BKASH" ? "bKash" : method,
            count: data.count,
            totalAmount: data.totalAmount,
            percentage: ((data.count / orders.length) * 100).toFixed(2),
        }));

        res.json({
            status: "success",
            data: {
                chartData,
                totalOrders: orders.length,
                totalRevenue: orders.reduce((sum, order) => sum + order.totalPrice, 0),
            },
        });
    } catch (error) {
        console.error("Error in /payment-breakdown:", error);
        res.status(500).json({
            status: "fail",
            message: "Failed to fetch payment breakdown. Please try again later.",
        });
    }
});

// ============================================
// GET /api/dashboard/stats
// Returns quick statistics summary
// ============================================
router.get("/stats", async (req, res) => {
    try {
        const [totalProducts, totalOrders, totalCustomers, totalRevenue, totalBrands, totalCategories, totalReviews] =
            await Promise.all([
                prisma.product.count(),
                prisma.order.count(),
                prisma.customer.count(),
                prisma.order.aggregate({
                    _sum: { totalPrice: true },
                }),
                prisma.brand.count(),
                prisma.category.count(),
                prisma.review.count(),
            ]);

        const recentOrders = await prisma.order.findMany({
            take: 5,
            orderBy: { orderDate: "desc" },
            select: {
                id: true,
                totalPrice: true,
                orderStatus: true,
                orderDate: true,
                customer: { select: { name: true } },
            },
        });

        res.json({
            status: "success",
            data: {
                totalProducts,
                totalOrders,
                totalCustomers,
                totalBrands,
                totalCategories,
                totalReviews,
                totalRevenue: totalRevenue._sum.totalPrice || 0,
                recentOrders,
            },
        });
    } catch (error) {
        console.error("Error in /stats:", error);
        res.status(500).json({
            status: "fail",
            message: "Failed to fetch dashboard statistics. Please try again later.",
        });
    }
});

module.exports = router;
