"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { ProductCard } from "@/components/store/ProductCard";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useDebounce } from "@/hooks/use-debounce";
import { Skeleton } from "@/components/ui/skeleton";
import type { Brand, Category, Product } from "@/types/store";

function ShopContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialCat = searchParams.get("cat") ?? "All";
  const initialQuery = searchParams.get("q") ?? "";
  const initialBrand = searchParams.get("brand") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [activeCat, setActiveCat] = useState<string>(initialCat);
  const [activeBrand, setActiveBrand] = useState<string>(initialBrand);
  const [sort, setSort] = useState("featured");
  const [price, setPrice] = useState<[number, number]>([0, 15000]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 400);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let changed = false;
    const cat = searchParams.get("cat");
    const q = searchParams.get("q");
    const brand = searchParams.get("brand");

    if (cat) {
      setActiveCat(cat);
      changed = true;
    }
    if (q) {
      setQuery(q);
      changed = true;
    }
    if (brand) {
      setActiveBrand(brand);
      changed = true;
    }

    if (changed) {
      router.replace(pathname);
    }
  }, [searchParams, pathname, router]);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await api.get("/category/all-categories", {
        params: { limit: 200, activeOnly: true },
      });
      return data.data.categories as Category[];
    },
  });

  const brandsQuery = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await api.get("/brand/all-brands", {
        params: { limit: 200, activeOnly: true },
      });
      return data.data.brands as Brand[];
    },
  });

  const newCountQuery = useQuery({
    queryKey: ["product-count", "new"],
    queryFn: async () => {
      const { data } = await api.get("/product/all-products", {
        params: { isNew: true, limit: 1, activeOnly: true },
      });
      return data.data.total as number;
    },
  });

  const saleCountQuery = useQuery({
    queryKey: ["product-count", "sale"],
    queryFn: async () => {
      const { data } = await api.get("/product/all-products", {
        params: { onSale: true, limit: 1, activeOnly: true },
      });
      return data.data.total as number;
    },
  });

  const selectedCategory = useMemo(
    () => categoriesQuery.data?.find((c) => c.name === activeCat) ?? null,
    [categoriesQuery.data, activeCat],
  );

  const selectedBrand = useMemo(
    () => brandsQuery.data?.find((b) => b.name === activeBrand) ?? null,
    [brandsQuery.data, activeBrand],
  );

  const productsQuery = useInfiniteQuery({
    queryKey: [
      "products",
      {
        activeCat,
        activeBrand,
        categoryId: selectedCategory?.id,
        brandId: selectedBrand?.id,
        debouncedQuery,
        price,
        sort,
      },
    ],
    enabled: 
      (activeCat === "All" || activeCat === "new" || activeCat === "sale" || !!selectedCategory || categoriesQuery.isSuccess) &&
      (activeBrand === "" || !!selectedBrand || brandsQuery.isSuccess),
    queryFn: async ({ pageParam = 1 }) => {
      const paramsPayload: Record<string, string | number | boolean> = {
        page: pageParam as number,
        limit: 10,
        minPrice: price[0],
        maxPrice: price[1],
        activeOnly: true,
      };

      if (debouncedQuery.trim()) paramsPayload.search = debouncedQuery.trim();
      if (selectedCategory?.id) paramsPayload.categoryId = selectedCategory.id;
      if (selectedBrand?.id) paramsPayload.brandId = selectedBrand.id;

      if (activeCat === "new") paramsPayload.isNew = true;
      if (activeCat === "sale") paramsPayload.onSale = true;

      if (sort === "price-asc") paramsPayload.sort = "price_asc";
      if (sort === "price-desc") paramsPayload.sort = "price_desc";
      if (sort === "name") paramsPayload.sort = "name";
      if (sort === "new") paramsPayload.sort = "newest";

      const { data } = await api.get("/product/all-products", {
        params: paramsPayload,
      });
      return data.data as {
        products: Product[];
        total: number;
        page: number;
        limit: number;
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const nextPage = lastPage.page + 1;
      return lastPage.page * lastPage.limit < lastPage.total
        ? nextPage
        : undefined;
    },
  });

  const products = (productsQuery.data?.pages.flatMap((p) => p.products) ?? []).filter(p => p.stock !== "unavailable");
  const total = productsQuery.data?.pages[0]?.total ?? 0;
  const isLoadingProducts = productsQuery.isLoading;
  const isFetchingNext = productsQuery.isFetchingNextPage;

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          productsQuery.hasNextPage &&
          !isFetchingNext
        ) {
          productsQuery.fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [productsQuery, isFetchingNext]);

  const setCat = (c: string) => {
    setActiveCat(c);
    setFiltersOpen(false);
  };

  const setBrand = (b: string) => {
    setActiveBrand(b);
    setFiltersOpen(false);
  };

  const tabs = [
    "All",
    "new",
    "sale",
    ...(categoriesQuery.data?.map((c) => c.name) ?? []),
  ];
  const tabLabel = (t: string) =>
    t === "new" ? "New Arrivals" : t === "sale" ? "On Sale" : t;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Page hero */}
      <section className="bg-secondary border-b border-border">
        <div className="container py-12 md:py-16">
          <nav className="text-xs tracking-wider uppercase text-muted-foreground mb-3">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            <span className="mx-2">/</span>
            <span className="text-primary">Shop</span>
          </nav>
          <h1 className="font-serif text-4xl md:text-5xl text-primary">
            {activeCat === "All" ? "All Collections" : tabLabel(activeCat)}
          </h1>
          <p className="text-muted-foreground mt-2">
            {total} {total === 1 ? "product" : "products"} available
          </p>
        </div>
      </section>

      <div className="container py-10 grid lg:grid-cols-[260px_1fr] gap-10">
        {/* Sidebar filters */}
        <aside
          className={cn(
            "lg:block",
            filtersOpen
              ? "fixed inset-0 z-40 bg-background overflow-y-auto p-6 lg:p-0 lg:static lg:bg-transparent"
              : "hidden",
          )}
        >
          <div className="flex items-center justify-between mb-6 lg:hidden">
            <p className="font-serif text-2xl text-primary">Filters</p>
            <button
              onClick={() => setFiltersOpen(false)}
              aria-label="Close filters"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-8">
            <div>
              <p className="text-xs uppercase tracking-wider font-medium mb-4 text-foreground">
                Search
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products…"
                  className="w-full h-10 pl-10 pr-3 bg-secondary/60 border-b-2 border-border focus:border-primary outline-none text-sm transition-colors"
                />
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider font-medium mb-4 text-foreground">
                Categories
              </p>
              <ul className="space-y-2">
                {tabs.map((c) => (
                  <li key={c}>
                    <button
                      onClick={() => setCat(c)}
                      className={cn(
                        "w-full text-left text-sm py-1 transition-colors flex items-center justify-between group",
                        activeCat === c
                          ? "text-primary font-medium"
                          : "text-muted-foreground hover:text-primary",
                      )}
                    >
                      <span>{tabLabel(c)}</span>
                      <span className="text-xs">
                        {c === "All"
                          ? total
                          : c === "new"
                            ? (newCountQuery.data ?? 0)
                            : c === "sale"
                              ? (saleCountQuery.data ?? 0)
                              : (categoriesQuery.data?.find(
                                  (cat) => cat.name === c,
                                )?.count ?? 0)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider font-medium mb-4 text-foreground">
                Brands
              </p>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => setBrand("")}
                    className={cn(
                      "w-full text-left text-sm py-1 transition-colors flex items-center justify-between group",
                      activeBrand === ""
                        ? "text-primary font-medium"
                        : "text-muted-foreground hover:text-primary",
                    )}
                  >
                    <span>All Brands</span>
                    <span className="text-xs">{total}</span>
                  </button>
                </li>
                {(brandsQuery.data ?? []).map((brand) => (
                  <li key={brand.id}>
                    <button
                      onClick={() => setBrand(brand.name)}
                      className={cn(
                        "w-full text-left text-sm py-1 transition-colors flex items-center justify-between group",
                        activeBrand === brand.name
                          ? "text-primary font-medium"
                          : "text-muted-foreground hover:text-primary",
                      )}
                    >
                      <span>{brand.name}</span>
                      <span className="text-xs">{brand.count ?? 0}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider font-medium mb-4 text-foreground">
                Price (BDT)
              </p>
              <Slider
                value={price}
                min={0}
                max={15000}
                step={500}
                onValueChange={(v) =>
                  setPrice([v[0], v[1]] as [number, number])
                }
                className="my-6"
              />
              <div className="flex justify-between text-xs text-muted-foreground tabular-nums mb-4">
                <span>Min: {price[0].toLocaleString()}</span>
                <span>Max: {price[1].toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground uppercase font-medium">Min Price</label>
                  <Input 
                    type="number" 
                    value={price[0]} 
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setPrice([val, price[1]]);
                    }}
                    className="h-9 text-xs rounded-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground uppercase font-medium">Max Price</label>
                  <Input 
                    type="number" 
                    value={price[1]} 
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setPrice([price[0], val]);
                    }}
                    className="h-9 text-xs rounded-none"
                  />
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full rounded-none border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              onClick={() => {
                setQuery("");
                setActiveCat("All");
                setActiveBrand("");
                setPrice([0, 15000]);
                setSort("featured");
                router.replace(pathname);
              }}
            >
              Clear all filters
            </Button>
          </div>
        </aside>

        {/* Products */}
        <div>
          <div className="flex items-center justify-between gap-4 pb-6 mb-8 border-b border-border">
            <Button
              variant="outline"
              className="lg:hidden rounded-none gap-2"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </Button>
            <p className="text-sm text-muted-foreground hidden lg:block">
              Showing <span className="text-primary font-medium">{total}</span>{" "}
              results
            </p>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[200px] rounded-none border-border focus:ring-0">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="new">Newest</SelectItem>
                <SelectItem value="price-asc">Price: Low to High</SelectItem>
                <SelectItem value="price-desc">Price: High to Low</SelectItem>
                <SelectItem value="name">Name: A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoadingProducts ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 md:gap-x-6 gap-y-10">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[3/4] w-full" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-24">
              <p className="font-serif text-2xl text-primary mb-2">
                No products found
              </p>
              <p className="text-muted-foreground mb-6">
                Try adjusting your filters or search.
              </p>
              <Button
                onClick={() => {
                  setQuery("");
                  setActiveCat("All");
                  setActiveBrand("");
                  setPrice([0, 15000]);
                }}
                className="rounded-none"
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 md:gap-x-6 gap-y-10">
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          )}
          <div ref={loadMoreRef} className="h-10" />
          {isFetchingNext && (
            <div className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-x-4 md:gap-x-6 gap-y-10">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[3/4] w-full" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default function Shop() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-dvh">Loading shop...</div>}>
      <ShopContent />
    </Suspense>
  );
}
