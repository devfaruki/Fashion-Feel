const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const prisma = require("../../lib/prismaClient");
const { verifyAccessToken } = require("../../lib/authMiddleware");

const router = express.Router();

const PUBLIC_DIR = path.join(__dirname, "..", "..", "public");
const ACCESS_DIR = path.join(PUBLIC_DIR, "admin-access");
const ROLES_FILE = path.join(ACCESS_DIR, "roles.json");
const ASSIGNMENTS_FILE = path.join(ACCESS_DIR, "assignments.json");

const permissionModules = [
  { group: "Overview", name: "Dashboard", key: "dashboard", viewOnly: true },
  { group: "Orders", name: "Orders", key: "orders" },
  { group: "Catalog", name: "Products", key: "products" },
  { group: "Catalog", name: "Variants", key: "variants" },
  { group: "Catalog", name: "Inventory", key: "inventory" },
  { group: "Catalog", name: "Categories", key: "categories" },
  { group: "Catalog", name: "Filters", key: "filters" },
  { group: "Store", name: "Customers", key: "customers" },
  { group: "Store", name: "Reviews", key: "reviews" },
  { group: "Store", name: "Home Page", key: "homePage" },
  { group: "Operations", name: "Analytics", key: "analytics", viewOnly: true },
  { group: "Operations", name: "Reports", key: "reports", viewOnly: true },
  { group: "Operations", name: "Income / Loss", key: "incomeLoss", viewOnly: true },
  { group: "Operations", name: "Stock Movements", key: "stockMovements" },
  { group: "Operations", name: "Purchases", key: "purchases" },
  { group: "Operations", name: "Offline Sales", key: "offlineSales" },
  { group: "Operations", name: "Expenses", key: "expenses" },
  { group: "Admin", name: "Users", key: "users" },
  { group: "Admin", name: "Roles", key: "roles" },
  { group: "Admin", name: "Settings", key: "settings" },
];

function fullPermissions() {
  return permissionModules.reduce((acc, item) => {
    acc[item.key] = { view: true, edit: !item.viewOnly };
    return acc;
  }, {});
}

function limitedPermissions(keys) {
  return permissionModules.reduce((acc, item) => {
    acc[item.key] = {
      view: keys.includes(item.key),
      edit: keys.includes(item.key) && !item.viewOnly,
    };
    return acc;
  }, {});
}

const defaultRoles = [
  { id: "owner", name: "Owner", active: true, permissions: fullPermissions() },
  { id: "admin", name: "Admin", active: true, permissions: fullPermissions() },
  {
    id: "manager",
    name: "Manager",
    active: true,
    permissions: limitedPermissions([
      "dashboard",
      "orders",
      "products",
      "inventory",
      "categories",
      "customers",
      "reviews",
      "homePage",
      "reports",
    ]),
  },
  {
    id: "staff",
    name: "Staff",
    active: true,
    permissions: limitedPermissions(["dashboard", "orders", "products", "customers"]),
  },
];

fs.mkdirSync(ACCESS_DIR, { recursive: true });

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error);
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(ACCESS_DIR, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readRoles() {
  const roles = readJson(ROLES_FILE, null);
  if (Array.isArray(roles) && roles.length > 0) return roles;
  writeJson(ROLES_FILE, defaultRoles);
  return defaultRoles;
}

function readAssignments() {
  return readJson(ASSIGNMENTS_FILE, {});
}

function writeAssignments(assignments) {
  writeJson(ASSIGNMENTS_FILE, assignments);
}

function roleSummary(role) {
  const values = Object.values(role.permissions || {});
  const total = values.reduce((sum, permission) => sum + (permission.view ? 1 : 0) + (permission.edit ? 1 : 0), 0);
  const max = permissionModules.reduce((sum, item) => sum + 1 + (item.viewOnly ? 0 : 1), 0);
  return total >= max ? "Full" : String(total);
}

function getAdminAccess(adminId) {
  const roles = readRoles();
  const assignments = readAssignments();
  const assignment = assignments[String(adminId)] || { roleId: "owner", active: true };
  const role = roles.find((item) => item.id === assignment.roleId) || roles[0] || defaultRoles[0];

  return {
    active: assignment.active !== false && role.active !== false,
    role,
    permissions: role.permissions || {},
  };
}

router.get("/modules", verifyAccessToken, (_req, res) => {
  res.json({ status: "success", data: permissionModules });
});

router.get("/roles", verifyAccessToken, (_req, res) => {
  const roles = readRoles().map((role) => ({
    ...role,
    totalPermission: roleSummary(role),
  }));
  res.json({ status: "success", data: roles });
});

router.post("/roles", verifyAccessToken, (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) {
    return res.status(400).json({ status: "fail", message: "Role name is required" });
  }

  const roles = readRoles();
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `role-${Date.now()}`;
  if (roles.some((role) => role.id === id)) {
    return res.status(409).json({ status: "fail", message: "Role already exists" });
  }

  const role = {
    id,
    name,
    active: req.body.active !== false,
    permissions: req.body.permissions || limitedPermissions([]),
  };
  roles.push(role);
  writeJson(ROLES_FILE, roles);
  res.json({ status: "success", data: role });
});

router.patch("/roles/:id", verifyAccessToken, (req, res) => {
  const roles = readRoles();
  const index = roles.findIndex((role) => role.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ status: "fail", message: "Role not found" });
  }

  roles[index] = {
    ...roles[index],
    name: req.body.name !== undefined ? String(req.body.name).trim() : roles[index].name,
    active: req.body.active !== undefined ? Boolean(req.body.active) : roles[index].active,
    permissions: req.body.permissions || roles[index].permissions,
  };
  writeJson(ROLES_FILE, roles);
  res.json({ status: "success", data: roles[index] });
});

router.get("/users", verifyAccessToken, async (_req, res) => {
  const admins = await prisma.admin.findMany({
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { id: "asc" },
  });
  const assignments = readAssignments();
  const roles = readRoles();

  const users = admins.map((admin, index) => {
    const assignment = assignments[String(admin.id)] || {
      roleId: index === 0 ? "owner" : "staff",
      active: true,
    };
    const role = roles.find((item) => item.id === assignment.roleId) || roles[0];
    return {
      ...admin,
      roleId: assignment.roleId,
      roleName: role?.name || "Owner",
      active: assignment.active !== false,
    };
  });

  res.json({ status: "success", data: users });
});

router.post("/users", verifyAccessToken, async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const roleId = String(req.body.roleId || "staff");

  if (!email || !password) {
    return res.status(400).json({ status: "fail", message: "Email and password are required" });
  }

  const hashed = await bcrypt.hash(password, 10);
  const admin = await prisma.admin.create({
    data: { name, email, password: hashed },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  const assignments = readAssignments();
  assignments[String(admin.id)] = { roleId, active: req.body.active !== false };
  writeAssignments(assignments);

  res.json({ status: "success", data: admin });
});

router.patch("/users/:id", verifyAccessToken, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ status: "fail", message: "Invalid user ID" });
  }

  const data = {};
  if (req.body.name !== undefined) data.name = String(req.body.name).trim();
  if (req.body.email !== undefined) data.email = String(req.body.email).trim().toLowerCase();
  if (req.body.password) data.password = await bcrypt.hash(String(req.body.password), 10);

  const admin = await prisma.admin.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, createdAt: true },
  });

  const assignments = readAssignments();
  assignments[String(id)] = {
    roleId: String(req.body.roleId || assignments[String(id)]?.roleId || "staff"),
    active: req.body.active !== undefined ? Boolean(req.body.active) : assignments[String(id)]?.active !== false,
  };
  writeAssignments(assignments);

  res.json({ status: "success", data: admin });
});

module.exports = {
  router,
  getAdminAccess,
};
