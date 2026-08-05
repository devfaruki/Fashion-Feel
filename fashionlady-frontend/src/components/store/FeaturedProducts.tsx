import { ProductCard } from "./ProductCard";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Category, Product } from "@/types/store";
import { Skeleton } from "@/components/ui/skeleton";

export const FeaturedProducts = () => {
  const [active, setActive] = useState("All");

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await api.get("/category/all-categories", {
        params: { limit: 200, activeOnly: true },
      });
      return data.data.categories as Category[];
    },
  });

  const featuredQuery = useQuery({
    queryKey: ["featured-products"],
    queryFn: async () => {
      const { data } = await api.get("/product/all-products", {
        params: { isFeatured: true, limit: 8, activeOnly: true },
      });
      return data.data.products as Product[];
    },
  });

  const tabs = ["All", ...(categoriesQuery.data?.map((c) => c.name) ?? [])];

  const visible = useMemo(() => {
    const list = (featuredQuery.data ?? []).filter(p => p.stock !== "unavailable");
    return active === "All"
      ? list
      : list.filter((p) => p.category?.name === active);
  }, [active, featuredQuery.data]);

  return (
    <section id="featured" className="py-10 lg:py-28 bg-secondary/40">
      <div className="container">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-8 md:mb-12 animate-fade-in-up">
          <div>
            <p className="text-sm tracking-[0.3em] uppercase text-accent font-medium mb-3">
              Hand-picked
            </p>
            <h2 className="font-serif text-4xl md:text-5xl font-medium text-primary">
              Featured at Fasion Feel
            </h2>
          </div>

          <div className="flex flex-wrap gap-1">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setActive(t)}
                className={`px-4 py-2 text-sm font-medium transition-all relative ${
                  active === t
                    ? "text-primary"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                {t}
                {active === t && (
                  <span className="absolute bottom-0 left-2 right-2 h-px bg-accent" />
                )}
              </button>
            ))}
          </div>
        </div>

        {featuredQuery.isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 md:gap-x-6 gap-y-10">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[3/4] w-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            No featured items in this category yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 md:gap-x-6 gap-y-10">
            {visible.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}

        <div className="text-center mt-14">
          <Button
            asChild
            size="lg"
            variant="outline"
            className="group rounded-none h-12 px-8 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <Link href="/shop">
              View All Products
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};
