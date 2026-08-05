"use client";

import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/store/Header";
import { Hero } from "@/components/store/Hero";
import { Categories } from "@/components/store/Categories";
import { FeaturedProducts } from "@/components/store/FeaturedProducts";
import { Brands } from "@/components/store/Brands";
import { HomeReviews } from "@/components/store/HomeReviews";
import { NewArrivals } from "@/components/store/NewArrivals";
import { Features } from "@/components/store/Features";
import { Footer } from "@/components/store/Footer";
import { api } from "@/lib/api";
import type { HeroSection } from "@/types/store";
import { HeroSkeleton } from "@/components/store/HeroSkeleton";

export default function Home() {
  const { data, isLoading } = useQuery({
    queryKey: ["hero-sections"],
    queryFn: async () => {
      const { data } = await api.get("/dashboard/hero-sections");
      return data.data as { heroSections: HeroSection[] };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const slides = data?.heroSections ?? [];

  if (isLoading || slides.length === 0) {
    return <HeroSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header transparent />
      <main>
        <Hero slides={slides} />
        <Categories />
        <NewArrivals />
        <FeaturedProducts />
        <Brands />
        <HomeReviews />
        <Features />
      </main>
      <Footer />
    </div>
  );
}
