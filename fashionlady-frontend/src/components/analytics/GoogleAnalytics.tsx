"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const didTrackInitialRef = useRef(false);
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  useEffect(() => {
    if (!measurementId || typeof window === "undefined" || !window.gtag) {
      return;
    }

    // gtag config sends the first page view. We send subsequent SPA route changes manually.
    if (!didTrackInitialRef.current) {
      didTrackInitialRef.current = true;
      return;
    }

    const pagePath = `${pathname}${window.location.search ?? ""}`;
    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_location: typeof window !== "undefined" ? window.location.href : "",
    });
  }, [pathname, measurementId]);

  if (!measurementId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
