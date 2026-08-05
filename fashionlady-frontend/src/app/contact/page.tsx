"use client";

import { FormEvent } from "react";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Phone, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { defaultSiteSettings, useSiteSettings } from "@/lib/site-settings";

export default function Contact() {
  const { data: siteSettings } = useSiteSettings();
  const settings = siteSettings ?? defaultSiteSettings;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    toast.success("Message sent", { description: "We'll get back to you within 24 hours." });
    (e.target as HTMLFormElement).reset();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pb-24">
        <section className="container py-12 md:py-16 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-accent mb-3">Get in touch</p>
          <h1 className="font-serif text-4xl md:text-5xl text-foreground">Contact Us</h1>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
            We're here to help with orders, sizing, returns, or anything else.
          </p>
        </section>

        <section className="container grid lg:grid-cols-[1fr_1.2fr] gap-10">
          <div className="space-y-6">
            {[
              { i: MapPin, t: settings.showroomTitle, d: settings.address },
              { i: Phone, t: "Phone / WhatsApp", d: settings.phone },
              { i: Mail, t: "Email", d: settings.email },
              { i: Clock, t: "Hours", d: settings.hours },
            ].map(({ i: Icon, t, d }) => (
              <div key={t} className="flex gap-4 p-5 border border-border bg-card">
                <div className="h-11 w-11 flex-shrink-0 rounded-full bg-primary/10 text-foreground flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{t}</p>
                  <p className="text-sm text-muted-foreground mt-1">{d}</p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={onSubmit} className="bg-card border border-border p-6 md:p-8 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" required placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required placeholder="you@example.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" required placeholder="How can we help?" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" required rows={6} placeholder="Tell us a bit more..." />
            </div>
            <Button type="submit" size="lg" className="w-full rounded-none h-12">
              Send message
            </Button>
          </form>
        </section>
      </main>
      <Footer />
    </div>
  );
}
