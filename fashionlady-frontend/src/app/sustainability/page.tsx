"use client";

import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { Leaf, Recycle, HandHeart, PackageOpen } from "lucide-react";

export default function Sustainability() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pb-24">
        <section className="container py-12 md:py-16 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-accent mb-3">Our commitment</p>
          <h1 className="font-serif text-4xl md:text-5xl text-foreground">Sustainability</h1>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto leading-relaxed">
            Slow fashion, fair makers, and packaging that doesn't cost the earth.
          </p>
        </section>

        <section className="container grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
          {[
            { i: Leaf, t: "Natural fibres", d: "Lawn, cotton, chiffon and organza — no synthetics where we can avoid them." },
            { i: HandHeart, t: "Fair makers", d: "We pay artisans and tailors above market rate, on time, every time." },
            { i: PackageOpen, t: "Plastic-free packaging", d: "Recycled paper boxes and cotton dust bags. No single-use plastic." },
            { i: Recycle, t: "Made to last", d: "Quality you can pass down — the most sustainable garment is one you keep." },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="border border-border bg-card p-6 text-center">
              <div className="h-12 w-12 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Icon className="h-6 w-6" />
              </div>
              <p className="font-medium text-foreground">{t}</p>
              <p className="text-sm text-muted-foreground mt-1">{d}</p>
            </div>
          ))}
        </section>

        <section className="container max-w-3xl space-y-8">
          <p className="text-muted-foreground leading-relaxed">
            We're a small business, so we won't pretend to be perfect — but we're working on it. Every season we measure
            what we use, what we waste, and what we can do better. We share the good and the not-so-good honestly with
            our community.
          </p>
          <div>
            <h2 className="font-serif text-2xl text-foreground mb-2">What we're working on next</h2>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground leading-relaxed">
              <li>A take-back programme for pre-loved Fasion Feet pieces.</li>
              <li>Carbon-neutral domestic shipping by 2026.</li>
              <li>A repair service for embroidery and beadwork.</li>
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
