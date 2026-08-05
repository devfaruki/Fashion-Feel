"use client";

import { useEffect } from "react";
import { resolveAssetUrl } from "@/lib/api";
import { defaultSiteSettings, useSiteSettings } from "@/lib/site-settings";

export function DynamicSiteChrome() {
  const { data } = useSiteSettings();
  const settings = data ?? defaultSiteSettings;

  useEffect(() => {
    document.title = `${settings.brandName} | Elegant Women's Fashion`;

    const baseHref = resolveAssetUrl(settings.favicon) || defaultSiteSettings.favicon;
    const href = `${baseHref}${baseHref.includes("?") ? "&" : "?"}v=${encodeURIComponent(settings.favicon)}`;
    const icons = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'));
    const targets = icons.length > 0 ? icons : [document.createElement("link")];

    for (const icon of targets) {
      if (!icon.parentElement) {
        icon.rel = "icon";
        document.head.appendChild(icon);
      }
      icon.href = href;
    }
  }, [settings.brandName, settings.favicon]);

  return null;
}
