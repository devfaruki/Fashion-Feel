"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search,
  ShoppingBag,
  Heart,
  Menu,
  X,
  ChevronDown,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { useQuery } from "@tanstack/react-query";
import { api, resolveAssetUrl } from "@/lib/api";
import { defaultSiteSettings, useSiteSettings } from "@/lib/site-settings";
import type { Product } from "@/types/store";
import { Skeleton } from "@/components/ui/skeleton";
import { getPrimaryImage } from "@/lib/product-images";

const baseNavItems = [
  { label: "Shop", to: "/shop" },
  { label: "New Arrivals", to: "/shop?cat=new" },
];

interface HeaderProps {
  transparent?: boolean;
}

export const Header = ({ transparent = false }: HeaderProps) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { count, openCart } = useCart();
  const { ids } = useWishlist();
  const debouncedQuery = useDebounce(query, 300);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { data: siteSettings } = useSiteSettings();
  const settings = siteSettings ?? defaultSiteSettings;

  useEffect(() => {
    setMounted(true);
  }, []);

  const categoriesQuery = useQuery({
    queryKey: ["header-categories"],
    queryFn: async () => {
      const { data } = await api.get("/category/all-categories", {
        params: { limit: 100, activeOnly: true },
      });
      return data.data.categories as { id: number; name: string }[];
    },
  });

  const allCategories = categoriesQuery.data || [];
  const topCategories = allCategories.slice(0, 4);
  const moreCategories = allCategories.slice(4);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const suggestionsQuery = useQuery({
    queryKey: ["search-suggestions", debouncedQuery],
    queryFn: async () => {
      const { data } = await api.get("/product/all-products", {
        params: { search: debouncedQuery, limit: 50, activeOnly: true },
      });
      return data.data.products as Product[];
    },
    enabled: searchOpen && debouncedQuery.trim().length > 1,
  });

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/shop?q=${encodeURIComponent(query.trim())}`);
    setSearchOpen(false);
    setQuery("");
  };

  return (
    <header
      className={cn("top-0 z-50", transparent ? "fixed inset-x-0" : "sticky")}
    >
      <div
        className={cn(
          "transition-all duration-300",
          scrolled
            ? "bg-background/95 backdrop-blur-md shadow-soft text-foreground"
            : transparent
              ? "bg-transparent text-primary-foreground"
              : "bg-background text-foreground",
        )}
      >
        <div className={`${scrolled ? "text-black" : "text-white"}  container flex h-20 items-center justify-between gap-6`}>
          <button
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          <Link
            href="/"
            aria-label={`${settings.brandName} home`}
            className="flex items-center"
          >
            <img
              src={resolveAssetUrl(settings.headerLogo)}
              alt={settings.brandName}
              className={cn(
                "h-14 w-auto max-w-[180px] object-contain transition-[filter] duration-300",
              )}
            />
          </Link>

          <nav className="hidden lg:flex items-center gap-7">
            {baseNavItems.map((item) => (
              <Link
                key={item.label}
                href={item.to}
                className="story-link text-sm font-medium opacity-90 hover:opacity-100 hover:text-accent transition-colors flex items-center gap-1"
              >
                {item.label}
              </Link>
            ))}

            {categoriesQuery.isLoading ? (
              <div className="flex gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            ) : (
              <>
                {topCategories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/shop?cat=${encodeURIComponent(cat.name)}`}
                    className="story-link text-sm font-medium opacity-90 hover:opacity-100 hover:text-accent transition-colors flex items-center gap-1"
                  >
                    {cat.name}
                  </Link>
                ))}

                {moreCategories.length > 0 && (
                  <div className="group relative flex items-center h-full py-6 -my-6 cursor-pointer">
                    <span className="text-sm font-medium opacity-90 hover:opacity-100 hover:text-accent transition-colors flex items-center gap-1">
                      <span className="story-link">More</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </span>
                    <div className="absolute top-[80%] left-0 pt-4 hidden group-hover:block z-50 animate-fade-in-up">
                      <div className="bg-background text-foreground shadow-xl rounded-md p-2 w-56 border border-border flex flex-col max-h-96 overflow-y-auto">
                        {moreCategories.map((cat) => (
                          <Link
                            key={cat.id}
                            href={`/shop?cat=${encodeURIComponent(cat.name)}`}
                            className="px-4 py-2.5 text-sm hover:bg-secondary hover:text-accent font-medium rounded-sm transition-colors"
                          >
                            {cat.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </nav>

          <div className="flex items-center gap-1 md:gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search"
              onClick={() => setSearchOpen((s) => !s)}
            >
              <Search className="h-5 w-5" />
            </Button>
            {/* User account dropdown removed as Auth is disabled */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Track Order"
              asChild
              className="hidden md:flex relative"
            >
              <Link href="/track-order">
                <Truck className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Wishlist"
              asChild
              className="hidden md:flex relative"
            >
              <Link href="/wishlist">
                <Heart className="h-5 w-5" />
                {mounted && ids.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
                    {ids.length}
                  </span>
                )}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Cart"
              onClick={openCart}
              className="relative"
            >
              <ShoppingBag className="h-5 w-5" />
              {mounted && count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold flex items-center justify-center">
                  {count}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Search dropdown */}
        {searchOpen && (
          <div className="relative">
            <div
              className="fixed inset-0 bg-white/40 backdrop-blur-[2px] z-[-1] animate-fade-in"
              onClick={() => setSearchOpen(false)}
            />
            <div className="animate-fade-in-up relative z-10 py-4 md:py-12">
              <div className="container px-4">
                <div className="max-w-3xl mx-auto bg-background/80 backdrop-blur-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-white/10 p-5 md:p-10">
                  <form
                    onSubmit={submitSearch}
                    className="flex gap-3 max-w-2xl mx-auto"
                  >
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-black" />
                      <input
                        ref={inputRef}
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search lawn, chiffon, organza, brand…"
                        className="w-full h-11 md:h-14 pl-12 pr-4 bg-secondary/40 backdrop-blur-md border-b-2 border-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground text-sm md:text-lg text-foreground"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="rounded-none h-11 md:h-14 px-4 md:px-5 bg-primary hover:bg-primary-glow shadow-lg shadow-primary/20 transition-all active:scale-95 text-sm md:text-base font-semibold"
                    >
                      <Search />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 md:h-14 md:w-14 border border-border/50 rounded-none text-muted-foreground hover:text-primary hover:border-primary transition-all"
                      onClick={() => setSearchOpen(false)}
                      aria-label="Close search"
                    >
                      <X className="h-5 w-5 md:h-6 md:w-6" />
                    </Button>
                  </form>

                  <div className="mt-6 md:mt-8 max-h-[60vh] overflow-y-auto pr-1 md:pr-2 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">

                    {suggestionsQuery.isLoading && (
                      <div className="max-w-2xl mx-auto mt-4 grid sm:grid-cols-2 gap-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-3 p-2">
                            <Skeleton className="h-14 w-12" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-3 w-20" />
                              <Skeleton className="h-4 w-40" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {(suggestionsQuery.data?.length ?? 0) > 0 && (
                      <div className="max-w-2xl mx-auto mt-6 md:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                        {(suggestionsQuery.data ?? []).map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              router.push(`/shop?q=${encodeURIComponent(p.name)}`);
                              setSearchOpen(false);
                              setQuery("");
                            }}
                            className="flex items-center gap-4 p-3 hover:bg-secondary/60 text-left transition-all group border border-transparent hover:border-border/40 backdrop-blur-sm"
                          >
                            <div className="relative h-16 w-14 flex-shrink-0 overflow-hidden rounded-md bg-secondary">
                              <Image
                                src={getPrimaryImage(p)}
                                alt={p.name}
                                fill
                                sizes="56px"
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/80 font-semibold mb-0.5">
                                {p.brand?.name ?? "Collection"}
                              </p>
                              <p className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                                {p.name}
                              </p>
                              <p className="text-sm font-bold text-primary mt-0.5">
                                BDT {p.price.toLocaleString()}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-background animate-scale-in lg:hidden">
          <div className="container flex h-20 items-center justify-between">
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              aria-label={`${settings.brandName} home`}
              className="flex items-center"
            >
              <img src={resolveAssetUrl(settings.favicon)} alt={settings.brandName} className="h-9 w-auto max-w-[44px] object-contain" />
            </Link>
            <button onClick={() => setMobileOpen(false)} aria-label="Close">
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="container flex flex-col gap-1 py-8 h-[calc(100vh-5rem)] overflow-y-auto">
            {baseNavItems.map((item) => (
              <Link
                key={item.label}
                href={item.to}
                onClick={() => setMobileOpen(false)}
                className="text-2xl font-serif text-foreground hover:text-accent transition-colors py-3 border-b border-border"
              >
                {item.label}
              </Link>
            ))}

            <button
              onClick={() => setMobileCategoriesOpen(!mobileCategoriesOpen)}
              className="flex items-center justify-between text-2xl font-serif text-foreground hover:text-accent transition-colors py-3 border-b border-border w-full text-left"
            >
              Categories
              <ChevronDown className={`h-6 w-6 transition-transform ${mobileCategoriesOpen ? "rotate-180" : ""}`} />
            </button>

            {mobileCategoriesOpen && (
              <div className="flex flex-col gap-1 py-2 pl-4 border-b border-border animate-fade-in">
                {categoriesQuery.isLoading ? (
                  <div className="py-2 space-y-4">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-6 w-40" />
                  </div>
                ) : (
                  allCategories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/shop?cat=${encodeURIComponent(cat.name)}`}
                      onClick={() => setMobileOpen(false)}
                      className="text-lg font-medium text-muted-foreground hover:text-accent transition-colors py-2"
                    >
                      {cat.name}
                    </Link>
                  ))
                )}
              </div>
            )}

            <Link
              href="/track-order"
              onClick={() => setMobileOpen(false)}
              className="text-2xl font-serif text-foreground hover:text-accent transition-colors py-3 border-b border-border"
            >
              Track Order
            </Link>
            <Link
              href="/wishlist"
              onClick={() => setMobileOpen(false)}
              className="text-2xl font-serif text-foreground hover:text-accent transition-colors py-3 border-b border-border"
            >
              Wishlist {mounted ? `(${ids.length})` : ""}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};
