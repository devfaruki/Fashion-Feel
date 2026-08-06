import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./Providers";
import ScrollToTop from "@/components/ScrollToTop";
import MetaPixel from "@/components/analytics/MetaPixel";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import MicrosoftClarity from "@/components/analytics/MicrosoftClarity";

export const metadata: Metadata = {
  title: "Fasion Feet | Elegant Women's Fashion",
  description:
    "Discover the latest trends in women's fashion with Fasion Feet. Shop our curated collection of elegant dresses, tops, and more.",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased font-sans">
        <MetaPixel />
        <GoogleAnalytics />
        <MicrosoftClarity />
        <ScrollToTop />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
