import { ProductCard } from "./ProductCard";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Product } from "@/types/store";
import { Skeleton } from "@/components/ui/skeleton";

export const NewArrivals = () => {
  const arrivalsQuery = useQuery({
    queryKey: ["new-arrivals"],
    queryFn: async () => {
      const { data } = await api.get("/product/all-products", {
        params: { isNew: true, limit: 8, activeOnly: true },
      });
      return data.data.products as Product[];
    },
  });

  return (
    <section id="new" className="py-10 lg:py-28 bg-background">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto mb-10 md:mb-14 animate-fade-in-up">
          <p className="text-sm tracking-[0.3em] uppercase text-accent font-medium mb-4">
            Just landed
          </p>
          <h2 className="font-serif text-4xl md:text-5xl font-medium text-primary mb-4">
            New Arrivals
          </h2>
          <p className="text-muted-foreground">
            Fresh from the looms — explore our latest unstitched luxury lawn
            collections.
          </p>
          <div className="h-px w-16 bg-accent mx-auto mt-6" />
        </div>

        {arrivalsQuery.isLoading ? (
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
        ) : (arrivalsQuery.data ?? []).filter((p) => p.stock !== "unavailable")
            .length === 0 ? (
          <div className="text-center py-20 bg-secondary/10 border border-dashed border-border rounded-lg">
            <p className="text-muted-foreground font-medium">
              No new arrivals at the moment. Check back soon!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 md:gap-x-6 gap-y-10">
            {(arrivalsQuery.data ?? [])
              .filter((p) => p.stock !== "unavailable")
              .map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
          </div>
        )}
      </div>
    </section>
  );
};
