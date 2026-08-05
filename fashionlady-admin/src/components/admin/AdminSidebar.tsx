import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { navItems } from "./nav-items";
import { cn } from "@/lib/utils";
import { api, resolveAssetUrl } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

interface SiteSettings {
  brandName: string;
  headerLogo: string;
}

export function AdminSidebar() {
  const { state } = useSidebar();
  const { admin } = useAuth();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { data: settings } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data } = await api.get("/site-settings");
      return data.data as SiteSettings;
    },
  });
  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);
  const brandName = settings?.brandName || "Fasion Feel";
  const logo = settings?.headerLogo || "/fasionfeel_logo.jpg";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className={`${collapsed ? "justify-center" : "justify-start"} flex items-center gap-2`}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg">
            <img 
              src={resolveAssetUrl(logo)}
              alt={`${brandName} Logo`} 
              className="h-full w-full rounded-lg object-cover shadow-glow"
            />
          </div>
          {!collapsed && (
            <div className="ml-3 flex flex-col leading-tight">
              <span className="font-display text-base font-semibold text-foreground">
                {brandName}
              </span>
              <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                Admin
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="pr-2 py-3">
        <SidebarGroup className="px-1">
          {!collapsed && (
            <SidebarGroupLabel className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Manage
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navItems.filter((item) => !item.permission || admin?.permissions?.[item.permission]?.view || admin?.role?.id === "owner").map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className={cn(
                        "mx-1 h-11 rounded-md px-3 transition-smooth",
                        active &&
                          "bg-gradient-primary !text-primary-foreground shadow-soft hover:bg-gradient-primary hover:text-primary-foreground"
                      )}
                    >
                      <NavLink to={item.url} end={item.url === "/"}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="text-sm">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
