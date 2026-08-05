"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface SiteSettings {
  brandName: string;
  headerLogo: string;
  footerLogo: string;
  favicon: string;
  phone: string;
  email: string;
  showroomTitle: string;
  address: string;
  hours: string;
  aboutIntro: string;
  aboutStory: string;
  facebookUrl: string;
  instagramUrl: string;
  gtmId: string;
  ga4MeasurementId: string;
  microsoftClarityId: string;
  metaPixelId: string;
  metaPixelAccessToken: string;
  metaPixelTestCode: string;
  tiktokPixelId: string;
  tiktokPixelAccessToken: string;
  tiktokPixelTestCode: string;
}

export const defaultSiteSettings: SiteSettings = {
  brandName: "Fasion Feel",
  headerLogo: "/assets/logo.png",
  footerLogo: "/assets/logo.png",
  favicon: "/favicon.png",
  phone: "01603-438543",
  email: "fasionfeel.collection@gmail.com",
  showroomTitle: "Dhanmondi Showroom",
  address: "Shop-9, Level 3, Anam Rangs Plaza, Satmasjid Road, Dhanmondi 6/A, Dhaka",
  hours: "Sat - Thu, 10:00 AM - 8:00 PM",
  aboutIntro:
    "A fashion destination where you can find original Pakistani & Indian collection to keep your style unique.",
  aboutStory:
    "Fasion Feel began as a small studio in Dhanmondi with one belief - that every woman deserves authentic, beautifully crafted clothing without having to fly across borders to find it.",
  facebookUrl: "https://www.facebook.com/fasionfeel.com.bd",
  instagramUrl: "https://www.instagram.com/fasionfeel",
  gtmId: "",
  ga4MeasurementId: "",
  microsoftClarityId: "",
  metaPixelId: "",
  metaPixelAccessToken: "",
  metaPixelTestCode: "",
  tiktokPixelId: "",
  tiktokPixelAccessToken: "",
  tiktokPixelTestCode: "",
};

export function useSiteSettings() {
  return useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data } = await api.get("/site-settings");
      return { ...defaultSiteSettings, ...(data.data as Partial<SiteSettings>) };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
