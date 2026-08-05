"use client";

import { Instagram, Facebook, Mail, MapPin, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FormEvent } from "react";
import Link from "next/link";
import { resolveAssetUrl } from "@/lib/api";
import { defaultSiteSettings, useSiteSettings } from "@/lib/site-settings";

export const Footer = () => {
  const { data: siteSettings } = useSiteSettings();
  const settings = siteSettings ?? defaultSiteSettings;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    toast.success(`Welcome to ${settings.brandName}`, { description: "You're now subscribed." });
    (e.target as HTMLFormElement).reset();
  };

  return (
    <footer className="bg-primary text-white">
      {/* Newsletter */}
      <div className="border-b border-white/20">
        <div className="container py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs tracking-[0.3em] uppercase text-white mb-3">Stay Connected</p>
            <h3 className="font-serif text-3xl md:text-4xl font-medium leading-tight">
              Be the first to know about new arrivals and exclusive offers.
            </h3>
          </div>
          <form onSubmit={onSubmit} className="flex gap-0">
            <Input
              type="email"
              required
              placeholder="Your email address"
              className="rounded-none h-14 bg-transparent border-white/40 text-white placeholder:text-white/70 focus-visible:ring-white"
            />
            <Button
              type="submit"
              size="lg"
              className="rounded-none h-14 px-8 bg-[#ff0000] text-white hover:bg-[#cc0000]"
            >
              <Mail className="h-4 w-4" /> Subscribe
            </Button>
          </form>
        </div>
      </div>

      {/* Links */}
      <div className="container py-16 grid grid-cols-2 lg:grid-cols-5 gap-10">
        <div className="col-span-2">
          <img src={resolveAssetUrl(settings.footerLogo)} alt={settings.brandName} className="mb-5 h-12 w-auto max-w-[180px] object-contain" />
          <p className="opacity-80 max-w-sm leading-relaxed mb-5">
            {settings.aboutIntro}
          </p>
          <ul className="space-y-3 text-sm opacity-80 max-w-sm">
            <li className="flex gap-3">
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-white" />
              <span>
                <strong className="block font-medium opacity-100">{settings.showroomTitle}</strong>
                {settings.address}
              </span>
            </li>
            <li className="flex gap-3 items-center">
              <Phone className="h-4 w-4 flex-shrink-0 text-white" />
              <a href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`} className="hover:text-white/80 transition-colors">{settings.phone}</a>
            </li>
            <li className="flex gap-3 items-center">
              <Mail className="h-4 w-4 flex-shrink-0 text-white" />
              <a href={`mailto:${settings.email}`} className="hover:text-white/80 transition-colors break-all">
                {settings.email}
              </a>
            </li>
          </ul>
          <div className="flex gap-3 mt-6">
            {[
              { Icon: Facebook, href: settings.facebookUrl },
              { Icon: Instagram, href: settings.instagramUrl },
            ].map(({ Icon, href }, i) => (
              <a
                key={i}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label="Social"
                className="h-10 w-10 rounded-full border border-white/30 flex items-center justify-center hover:bg-white hover:text-foreground hover:border-white transition-all"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        {[
          { title: "Shop", links: [{ l: "New Arrivals", to: "/shop" }, { l: "Lawn", to: "/shop" }, { l: "Chiffon", to: "/shop" }, { l: "Organza", to: "/shop" }, { l: "Party Wear", to: "/shop" }, { l: "Sale", to: "/shop" }] },
          { title: "Help", links: [{ l: "Contact Us", to: "/contact" }, { l: "Shipping", to: "/shipping" }, { l: "Returns", to: "/returns" }, { l: "Size Guide", to: "/size-guide" }, { l: "Track Order", to: "/track-order" }] },
          { title: "About", links: [{ l: "Our Story", to: "/about" }, { l: "Sustainability", to: "/sustainability" }] },
        ].map((col) => (
          <div key={col.title}>
            <h5 className="font-serif text-lg font-medium mb-5">{col.title}</h5>
            <ul className="space-y-3 text-sm opacity-75">
              {col.links.map((link) => (
                <li key={link.l}>
                  <Link href={link.to} className="story-link hover:text-white/80 transition-colors">
                    {link.l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/20">
        <div className="container py-6 flex flex-col md:flex-row justify-between items-center gap-3 text-sm opacity-60">
          <p>© {new Date().getFullYear()} {settings.brandName} — all rights to original brand.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:opacity-100">Privacy</a>
            <a href="#" className="hover:opacity-100">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
