"use client";

import Link from "next/link";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { ProductCard } from "@/components/store/ProductCard";
import { useWishlist } from "@/contexts/WishlistContext";
import { useCart } from "@/contexts/CartContext";
import { Heart, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Product } from "@/types/store";
import { Skeleton } from "@/components/ui/skeleton";

export default function Wishlist() {
  const { ids, clear } = useWishlist();
  const { addItem } = useCart();

  const itemsQuery = useQuery({
    queryKey: ["wishlist-products", ids],
    queryFn: async () => {
      const { data } = await api.post("/product/by-ids", { ids });
      return data.data as Product[];
    },
    enabled: ids.length > 0,
  });

  const items = itemsQuery.data ?? [];

  const addAllToCart = () => {
    items.forEach((p) => addItem(p, p.sizes?.[1] ?? "Free Size", 1));
    clear();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="bg-secondary border-b border-border">
        <div className="container py-12">
          <nav className="text-xs tracking-wider uppercase text-muted-foreground mb-3">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            <span className="mx-2">/</span>
            <span className="text-primary">Wishlist</span>
          </nav>
          <h1 className="font-serif text-4xl md:text-5xl text-primary">
            Your Wishlist
          </h1>
          <p className="text-muted-foreground mt-2">
            {items.length} saved {items.length === 1 ? "item" : "items"}
          </p>
        </div>
      </section>

      <div className="container py-12">
        {itemsQuery.isLoading ? (
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
        ) : items.length === 0 ? (
          <div className="text-center py-20 max-w-md mx-auto">
            <div className="h-24 w-24 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
              <Heart className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="font-serif text-3xl text-primary mb-3">
              Nothing saved yet
            </h2>
            <p className="text-muted-foreground mb-8">
              Tap the heart on any product to save it here.
            </p>
            <Button
              asChild
              className="rounded-none h-12 px-8 bg-primary hover:bg-primary-glow"
            >
              <Link href="/shop">Discover Collections</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:justify-end gap-3 mb-6">
              <Button
                onClick={addAllToCart}
                className="rounded-none bg-primary hover:bg-primary-glow gap-2"
              >
                <ShoppingBag className="h-4 w-4" /> Add all to cart
              </Button>
              <Button
                variant="outline"
                onClick={clear}
                className="rounded-none"
              >
                Clear wishlist
              </Button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 md:gap-x-6 gap-y-10">
              {items.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}
