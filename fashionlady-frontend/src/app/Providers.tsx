"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { QuickViewProvider } from "@/contexts/QuickViewContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartDrawer } from "@/components/store/CartDrawer";
import { QuickViewModal } from "@/components/store/QuickViewModal";
import { DynamicSiteChrome } from "@/components/store/DynamicSiteChrome";
import { ReactNode, useState } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WishlistProvider>
            <CartProvider>
              <QuickViewProvider>
                <DynamicSiteChrome />
                {children}
                <Toaster />
                <Sonner />
                <CartDrawer />
                <QuickViewModal />
              </QuickViewProvider>
            </CartProvider>
          </WishlistProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
