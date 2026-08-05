"use client";

import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { Truck, Globe, PackageCheck } from "lucide-react";

export default function Shipping() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pb-24">
        <section className="container py-12 md:py-16 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-accent mb-3">Delivery info</p>
          <h1 className="font-serif text-4xl md:text-5xl text-foreground">Shipping</h1>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
            Fast, tracked delivery across Bangladesh and worldwide.
          </p>
        </section>

        <section className="container grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {[
            { i: Truck, t: "Inside Dhaka", d: "BDT 80 — 1 to 2 business days" },
            { i: Truck, t: "Outside Dhaka", d: "BDT 150 — 3 to 5 business days" },
            { i: Globe, t: "International", d: "Calculated at checkout — 7 to 14 days" },
            { i: PackageCheck, t: "Free shipping", d: "On orders over BDT 5,000" },
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

        <section className="container max-w-3xl space-y-10">
          {[
            {
              t: "Order processing",
              d: "All orders are processed within 1–2 business days. Orders placed on Friday or public holidays are processed the next working day.",
            },
            {
              t: "Tracking",
              d: "You'll receive an email and SMS with a tracking link as soon as your order ships. You can also track from your account dashboard.",
            },
            {
              t: "Cash on delivery",
              d: "COD is available for all orders within Bangladesh. Please keep the exact amount ready for the courier.",
            },
            {
              t: "International orders",
              d: "We ship worldwide via DHL and FedEx. Customs duties and taxes are the responsibility of the recipient.",
            },
            {
              t: "Delays",
              d: "While we work hard to deliver on time, weather, courier strikes, and customs may occasionally cause delays. We'll keep you informed.",
            },
          ].map((s) => (
            <div key={s.t}>
              <h2 className="font-serif text-2xl text-foreground mb-2">{s.t}</h2>
              <p className="text-muted-foreground leading-relaxed">{s.d}</p>
            </div>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  );
}
