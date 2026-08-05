import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  Package,
  Tags,
  Sparkles,
  Image as ImageIcon,
  Star,
  Ticket,
  Settings,
} from "lucide-react";

export const navItems = [
  { title: "Overview", url: "/", icon: LayoutDashboard, permission: "dashboard" },
  { title: "Orders", url: "/orders", icon: ShoppingBag, permission: "orders" },
  { title: "Customers", url: "/customers", icon: Users, permission: "customers" },
  { title: "Products", url: "/products", icon: Package, permission: "products" },
  { title: "Categories", url: "/categories", icon: Tags, permission: "categories" },
  { title: "Brands", url: "/brands", icon: Sparkles, permission: "products" },
  { title: "Hero Sections", url: "/hero-sections", icon: ImageIcon, permission: "homePage" },
  { title: "Reviews", url: "/reviews", icon: Star, permission: "reviews" },
  { title: "Users", url: "/users", icon: Users, permission: "users" },
  { title: "Roles", url: "/roles", icon: Ticket, permission: "roles" },
  { title: "Manage Shop", url: "/site-settings", icon: Settings, permission: "settings" },
  // { title: "Discounts", url: "/discounts", icon: Ticket },
];

export const mobileNavItems = navItems;
