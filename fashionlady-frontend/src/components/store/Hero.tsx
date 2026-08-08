"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { resolveAssetUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { HeroSection } from "@/types/store";

type HeroProps = {
  slides: HeroSection[];
};

export const Hero = ({ slides }: HeroProps) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;

    const id = setInterval(
      () => setCurrent((c) => (c + 1) % slides.length),
      6500,
    );
    return () => clearInterval(id);
  }, [slides.length]);

  useEffect(() => {
    setCurrent(0);
  }, [slides.length]);

  return (
    <section className="relative overflow-hidden bg-primary">
      <div className="relative h-[100dvh] w-full">
        {slides.map((slide, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-1000 ease-out ${
              i === current ? "opacity-100" : "opacity-0"
            }`}
          >
            <Image
              src={resolveAssetUrl(slide.image)}
              alt={slide.title}
              fill
              priority={i === 0}
              sizes="(min-width: 768px) 100vw, 0px"
              className={cn(
                "hidden h-screen w-full object-cover object-center md:block",
                i === current ? "scale-100" : "scale-105",
                "transition-transform ease-out",
              )}
              style={{ transitionDuration: "6000ms" }}
            />
            <Image
              src={resolveAssetUrl(slide.mobileImage)}
              alt={slide.title}
              fill
              priority={i === 0}
              sizes="(max-width: 767px) 100vw, 0px"
              className={cn(
                "h-screen w-full object-cover object-center md:hidden",
                i === current ? "scale-100" : "scale-105",
                "transition-transform ease-out",
              )}
              style={{ transitionDuration: "6000ms" }}
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/45 via-black/15 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/20" />
          </div>
        ))}

        {/* Overlay content */}
        <div className="relative z-10 h-full container flex flex-col justify-center pt-24">
          <div
            key={current}
            className="max-w-5xl space-y-6 animate-fade-in-up text-white transition-colors duration-1000"
          >
            {/* Editorial title only — selector removed per request */}
            <h1
              className="leading-[0.95] text-[clamp(5rem,14vw,11rem)] drop-shadow-2xl md:font-playfair md:italic md:font-medium md:tracking-[0.02em]"
            >
              {slides[current].title}
            </h1>
            <p
              className="text-lg md:text-2xl italic max-w-2xl opacity-90 md:font-playfair md:italic"
            >
              {slides[current].subtitle}
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Button
                asChild
                size="lg"
                className="group rounded-none h-12 px-10 bg-primary-glow hover:bg-accent hover:text-accent-foreground text-white border border-primary-foreground/20 transition-all duration-300"
              >
                <Link href={slides[current].buttonUrl || "/shop"}>
                  {slides[current].buttonText}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Slide indicators bottom */}
          <div className="absolute bottom-10 left-0 right-0 container flex items-center justify-between">
            <div className="flex gap-3">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={`h-px transition-all duration-500 ${
                    i === current ? "w-16 bg-accent" : "w-8 bg-white/40"
                  }`}
                />
              ))}
            </div>
              <p className="hidden md:block text-xs tracking-[0.3em] uppercase opacity-60 text-white">
              {String(current + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
            </p>
          </div>
        </div>
      </div>

      {/* Decorative bottom marquee */}
      <div className="border-y border-primary/10 bg-background py-4 overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap gap-16 text-primary/60 font-serif text-2xl italic">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div key={idx} className="flex gap-16">
              <span>Lawn</span><span>✦</span>
              <span>Chiffon</span><span>✦</span>
              <span>Organza</span><span>✦</span>
              <span>Embroidered</span><span>✦</span>
              <span>Luxury</span><span>✦</span>
              <span>Handcrafted</span><span>✦</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
