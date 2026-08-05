import { NavLink, useLocation } from "react-router-dom";
import { navItems } from "./nav-items";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  return (
    <nav className="fixed bottom-2 left-2 right-2 z-50 md:hidden">
      <div className="overflow-x-auto rounded-2xl border border-white/70 bg-gradient-to-b from-white/95 via-white/90 to-white/80 py-2 pl-2 pr-2 shadow-[0_10px_24px_-14px_rgba(15,23,42,0.35)] backdrop-blur-lg [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max items-center gap-1">
          {navItems.map((item) => {
            const active = isActive(item.url);
            return (
              <NavLink
                key={item.title}
                to={item.url}
                end={item.url === "/"}
                className={cn(
                  "flex min-w-[68px] shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-smooth",
                  active
                    ? "bg-gradient-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="text-[10px] font-medium">{item.title}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
