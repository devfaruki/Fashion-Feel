const express = require("express");
const router = express.Router();

const orderRoutes = require("./order/orderRoutes");
const productRoutes = require("./product/productRoutes");
const categoryRoutes = require("./category/categoryRoutes");
const brandRoutes = require("./brand/brandRoutes");
const customerRoutes = require("./customer/customerRoutes");
const dashboardRoutes = require("./dashboard/dashboardRoutes");
const heroSectionsRoutes = require("./dashboard/heroSectionsRoutes");
const facebookRoutes = require("./facebook/facebookRoutes");
const loginRoutes = require("./login/loginRoutes");
const courierRoutes = require("./courier/courierRoutes");
const reviewRoutes = require("./review/reviewRoutes");
const siteSettingsRoutes = require("./siteSettings/siteSettingsRoutes");
const adminAccessRoutes = require("./adminAccess/adminAccessRoutes").router;

router.use("/login", loginRoutes);
router.use("/order", orderRoutes);
router.use("/product", productRoutes);
router.use("/category", categoryRoutes);
router.use("/brand", brandRoutes);
router.use("/customer", customerRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/dashboard/hero-sections", heroSectionsRoutes);
router.use("/facebook", facebookRoutes);
router.use("/courier", courierRoutes);
router.use("/review", reviewRoutes);
router.use("/site-settings", siteSettingsRoutes);
router.use("/admin-access", adminAccessRoutes);

module.exports = router;
