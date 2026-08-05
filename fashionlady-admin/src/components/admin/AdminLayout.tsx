import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { GlobalStatsProvider } from "@/contexts/GlobalStatsContext";
import { useIsMobile } from "@/hooks/use-mobile";

export function AdminLayout() {
  const isMobile = useIsMobile();

  return (
    <GlobalStatsProvider>
      <SidebarProvider defaultOpen>
        <div className="flex min-h-screen w-full bg-background">
          {!isMobile && <AdminSidebar />}

          <div className="flex w-full min-w-0 flex-1 flex-col">
            <AdminHeader />
            <main className="min-w-0 flex-1 animate-fade-in overflow-x-hidden p-4 pb-28 md:p-6 md:pb-6">
              <Outlet />
            </main>
          </div>

          {isMobile && <MobileBottomNav />}
        </div>
      </SidebarProvider>
    </GlobalStatsProvider>
  );
}
