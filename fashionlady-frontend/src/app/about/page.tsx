"use client";

import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { Sparkles, Heart, Globe } from "lucide-react";
import Link from "next/link";
import { defaultSiteSettings, useSiteSettings } from "@/lib/site-settings";

export default function About() {
  const { data: siteSettings } = useSiteSettings();
  const settings = siteSettings ?? defaultSiteSettings;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pb-24">
        <section className="container py-12 md:py-16 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-accent mb-3">About us</p>
          <h1 className="font-serif text-4xl md:text-5xl text-foreground">Our Story</h1>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto leading-relaxed">
            {settings.aboutIntro}
          </p>
        </section>

        <section className="container max-w-3xl space-y-8">
          <p className="text-muted-foreground leading-relaxed">
            {settings.aboutStory}
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Today our showroom on Satmasjid Road welcomes thousands of women each season — and we deliver across
            Bangladesh and worldwide. We're still a small team, still obsessed with the details, and still answering
            every WhatsApp message ourselves.
          </p>
        </section>

        <section className="container grid md:grid-cols-3 gap-5 mt-14">
          {[
            { i: Sparkles, t: "Original only", d: "Every piece sourced from authorised Pakistani & Indian houses." },
            { i: Heart, t: "Handpicked", d: "Curated weekly so your wardrobe always feels fresh." },
            { i: Globe, t: "Worldwide", d: "From our Dhanmondi showroom to doorsteps across the globe." },
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

        <section className="container max-w-3xl mt-16 text-center">
          <h2 className="font-serif text-3xl text-foreground mb-3">Visit our showroom</h2>
          <p className="text-muted-foreground">
            {settings.address}
          </p>
          <Link href="/contact" className="story-link text-foreground mt-4 inline-block">Get in touch</Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
