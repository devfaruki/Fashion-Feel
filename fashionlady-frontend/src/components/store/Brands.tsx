import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { api, resolveAssetUrl } from "@/lib/api";
import type { Brand } from "@/types/store";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Brands = () => {
  const [showAll, setShowAll] = useState(false);

  const brandsQuery = useQuery({
    queryKey: ["brands-home", showAll],
    queryFn: async () => {
      const { data } = await api.get("/brand/all-brands", {
        params: { limit: showAll ? 100 : 4, activeOnly: true },
      });
      return { brands: data.data.brands as Brand[], total: data.data.total as number };
    },
  });

  const allBrands = brandsQuery.data?.brands ?? [];
  const totalBrands = brandsQuery.data?.total ?? 0;

  const visibleBrands = allBrands;

  return (
    <section id="brands" className="py-10 lg:py-28 bg-background">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto mb-10 md:mb-16 animate-fade-in-up">
          <p className="text-sm tracking-[0.3em] uppercase text-accent font-medium mb-4">
            Signature labels
          </p>
          <h2 className="font-serif text-4xl md:text-5xl font-medium text-primary mb-4">
            Browse by Brands
          </h2>
          <div className="h-px w-16 bg-accent mx-auto" />
        </div>

        {brandsQuery.isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[3/4] w-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : visibleBrands.length === 0 ? (
          <div className="text-center py-20 bg-secondary/20 border border-dashed border-border rounded-lg">
            <p className="text-muted-foreground font-medium">
              No brands available at the moment.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {visibleBrands.map((brand, i) => (
                <Link
                  key={brand.id}
                  href={`/shop?brand=${encodeURIComponent(brand.name)}`}
                  className="group relative overflow-hidden bg-secondary aspect-[3/4] hover-lift animate-scale-in"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  {brand.image && (
                    <Image
                      src={resolveAssetUrl(brand.image)}
                      alt={brand.name}
                      fill
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 text-primary-foreground">
                    <h3 className="font-serif text-2xl md:text-3xl font-medium mb-1">
                      {brand.name}
                    </h3>
                    <p className="text-sm opacity-80">
                      {brand.count ?? 0} pieces
                    </p>
                    <div className="h-px w-0 bg-accent mt-3 transition-all duration-500 group-hover:w-12" />
                  </div>
                </Link>
              ))}
            </div>

            {totalBrands > 4 && (
              <div className="mt-8 flex justify-center">
                <Button
                  variant="outline"
                  className="min-w-36"
                  onClick={() => setShowAll((prev) => !prev)}
                >
                  {showAll ? "Show Less" : "Show More"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};
