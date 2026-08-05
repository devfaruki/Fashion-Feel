import { useLocation, useNavigate } from "react-router-dom";
import { Search, ExternalLink, ShoppingBag, Users, Package, Sparkles, Tags, MessageSquare } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalStats } from "@/contexts/GlobalStatsContext";
import { navItems } from "./nav-items";

const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || "http://localhost:5173";

export function AdminHeader() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout, admin } = useAuth();
  const { totalOrders, totalCustomers, totalProducts, totalBrands, totalCategories,totalReviews, loading } = useGlobalStats();

  const current =
    navItems.find((i) =>
      i.url === "/" ? pathname === "/" : pathname.startsWith(i.url),
    )?.title ?? "Admin";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const statItems = [
    { label: "Orders", value: totalOrders, icon: ShoppingBag },
    { label: "Customers", value: totalCustomers, icon: Users },
    { label: "Products", value: totalProducts, icon: Package },
    { label: "Brands", value: totalBrands, icon: Sparkles },
    { label: "Categories", value: totalCategories, icon: Tags },
    { label: "Reviews", value: totalReviews, icon: MessageSquare },
  ];

  const currentStat = statItems.find((s) => s.label === current);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="flex h-16 items-center gap-4 px-4 md:px-6">
        <SidebarTrigger className="hidden md:inline-flex" />

        {/* Title and Contextual Stat */}
        <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <h1 className="truncate font-display text-xl font-semibold tracking-tight text-foreground md:text-2xl shrink-0">
            {current}
          </h1>

          {currentStat && (
            <div className="flex items-center gap-2 lg:gap-3 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-l pl-2 lg:pl-3 border-border/50">
                <currentStat.icon className="h-4 w-4" />
                <span className="hidden sm:inline">Total:</span>
                {loading ? (
                  <Skeleton className="h-4 w-6" />
                ) : (
                  <span className="font-semibold text-foreground text-sm">{currentStat.value}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Section: View Site (Desktop), Search, View Site (Mobile), Avatar */}
        <div className="flex shrink-0 items-center gap-3 ml-auto">
          {/* Desktop View Website Link */}
          <a
            href={FRONTEND_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-smooth shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>View Website</span>
          </a>

          {/* Search Bar */}
          <div className="relative hidden max-w-xs flex-1 lg:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search orders, products…"
              className="h-9 rounded-xl border-border bg-secondary/50 pl-9 focus-visible:bg-card w-full"
            />
          </div>

          {/* Mobile View Website Link */}
          <a
            href={FRONTEND_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-smooth lg:hidden shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>View Site</span>
          </a>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex shrink-0 items-center gap-2 rounded-xl p-1 transition-smooth hover:bg-secondary">
                <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                  <AvatarFallback className="bg-gradient-primary text-xs font-semibold text-primary-foreground">
                    {admin?.name?.slice(0, 2).toUpperCase() || "FL"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {admin?.name || "Admin"}
                  </span>
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {admin?.email || "admin@fasionfeel.com"}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
