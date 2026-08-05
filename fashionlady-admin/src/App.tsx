import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import AdminLogin from "./pages/admin/Login";
import Overview from "./pages/admin/Overview";
import Orders from "./pages/admin/Orders";
import Customers from "./pages/admin/Customers";
import Products from "./pages/admin/Products";
import Categories from "./pages/admin/Categories";
import Brands from "./pages/admin/Brands";
import HeroSections from "./pages/admin/HeroSections";
import Reviews from "./pages/admin/Reviews";
import SiteSettings from "./pages/admin/SiteSettings";
import Users from "./pages/admin/Users";
import Roles from "./pages/admin/Roles";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<AdminLogin />} />
            <Route
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<ProtectedRoute permission="dashboard"><Overview /></ProtectedRoute>} />
              <Route path="/orders" element={<ProtectedRoute permission="orders"><Orders /></ProtectedRoute>} />
              <Route path="/customers" element={<ProtectedRoute permission="customers"><Customers /></ProtectedRoute>} />
              <Route path="/products" element={<ProtectedRoute permission="products"><Products /></ProtectedRoute>} />
              <Route path="/categories" element={<ProtectedRoute permission="categories"><Categories /></ProtectedRoute>} />
              <Route path="/brands" element={<ProtectedRoute permission="products"><Brands /></ProtectedRoute>} />
              <Route path="/hero-sections" element={<ProtectedRoute permission="homePage"><HeroSections /></ProtectedRoute>} />
              <Route path="/reviews" element={<ProtectedRoute permission="reviews"><Reviews /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute permission="users"><Users /></ProtectedRoute>} />
              <Route path="/roles" element={<ProtectedRoute permission="roles"><Roles /></ProtectedRoute>} />
              <Route path="/site-settings" element={<ProtectedRoute permission="settings"><SiteSettings /></ProtectedRoute>} />
              {/* <Route path="/discounts" element={<Discounts />} /> */}
              {/* <Route path="/settings" element={<Settings />} /> */}
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
