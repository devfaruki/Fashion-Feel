"use client";

import type { Product } from "@/types/store";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

type MetaEventName =
  | "PageView"
  | "ViewContent"
  | "AddToCart"
  | "InitiateCheckout"
  | "Purchase";

type MetaUserData = {
  email?: string;
  phone?: string;
  fn?: string;
  ln?: string;
  ct?: string;
  zp?: string;
  country?: string;
  external_id?: string;
  fbp?: string;
  fbc?: string;
};

type TrackServerEventInput = {
  eventName: MetaEventName;
  eventId?: string;
  customData?: Record<string, unknown>;
  userData?: MetaUserData;
  eventSourceUrl?: string;
};

type PurchaseInput = {
  items: Array<{ product: Product; size: string; quantity: number }>;
  total: number;
  currency?: string;
  orderId?: string;
  eventId?: string;
  userData?: MetaUserData;
};

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;
const FBP_COOKIE = "_fbp";
const FBC_COOKIE = "_fbc";
const EXTERNAL_ID_COOKIE = "fl_external_id";
const META_CURRENCY_FALLBACK = "BDT";

function resolveCurrency(input?: string): string {
  const configured =
    process.env.NEXT_PUBLIC_META_EVENT_CURRENCY ?? META_CURRENCY_FALLBACK;
  const value = (input ?? configured).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(value) ? value : META_CURRENCY_FALLBACK;
}

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;

  const value = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.split("=")[1]) : undefined;
}

function setCookie(
  name: string,
  value: string,
  maxAgeSeconds = COOKIE_MAX_AGE_SECONDS,
) {
  if (typeof document === "undefined") return;

  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}

function buildContentItem(product: Product, quantity: number) {
  return {
    id: String(product.id),
    quantity,
    item_price: Number(product.price) || 0,
  };
}

export function normalizeMetaPhone(phone?: string): string | undefined {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("8801")) return digits;
  if (digits.startsWith("01")) return `88${digits}`;
  if (digits.length === 10 && digits.startsWith("1")) return `880${digits}`;
  return digits;
}

function toGaEventName(eventName: MetaEventName): string {
  const map: Record<MetaEventName, string> = {
    PageView: "page_view",
    ViewContent: "view_item",
    AddToCart: "add_to_cart",
    InitiateCheckout: "begin_checkout",
    Purchase: "purchase",
  };

  return map[eventName];
}

export function generateEventId(prefix = "evt") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateExternalId(): string {
  const existing = getCookie(EXTERNAL_ID_COOKIE);
  if (existing) return existing;

  const created = generateEventId("ext");
  setCookie(EXTERNAL_ID_COOKIE, created, 60 * 60 * 24 * 365);
  return created;
}

export function ensureMetaTrackingContext() {
  if (typeof window === "undefined") return {};

  let fbp = getCookie(FBP_COOKIE);
  if (!fbp) {
    fbp = `fb.1.${Date.now()}.${Math.floor(Math.random() * 1_000_000_000)}`;
    setCookie(FBP_COOKIE, fbp);
  }

  let fbc = getCookie(FBC_COOKIE);
  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  if (!fbc && fbclid) {
    fbc = `fb.1.${Date.now()}.${fbclid}`;
    setCookie(FBC_COOKIE, fbc);
  }

  const externalId = getOrCreateExternalId();
  return { fbp, fbc, externalId };
}

export function trackBrowserEvent(
  eventName: MetaEventName,
  customData: Record<string, unknown> = {},
  eventId = generateEventId(eventName.toLowerCase()),
) {
  if (typeof window === "undefined") return { eventId };

  ensureMetaTrackingContext();

  try {
    if (window.fbq) {
      window.fbq("track", eventName, customData, { eventID: eventId });
    }
  } catch (error) {
    console.error("Meta pixel browser track failed", error);
  }

  try {
    if (window.gtag) {
      window.gtag("event", toGaEventName(eventName), {
        ...customData,
        event_id: eventId,
      });
    }
  } catch (error) {
    console.error("GA4 browser track failed", error);
  }

  return { eventId };
}

export async function trackServerEvent(input: TrackServerEventInput) {
  if (typeof window === "undefined") return null;

  const { fbp, fbc, externalId } = ensureMetaTrackingContext();
  const eventId =
    input.eventId ?? generateEventId(input.eventName.toLowerCase());

  const payload = {
    eventName: input.eventName,
    eventId,
    eventSourceUrl: input.eventSourceUrl ?? window.location.href,
    customData: input.customData ?? {},
    userData: {
      fbp,
      fbc,
      ...(input.userData ?? {}),
      external_id: input.userData?.external_id ?? externalId,
    },
  };

  try {
    // Prefer the same API origin used by the app's axios client.
    const serverBase =
      process.env.NEXT_PUBLIC_API_URL ??
      process.env.NEXT_PUBLIC_SERVER_BASE ??
      "http://localhost:3000";
    const url = `${serverBase.replace(/\/$/, "")}/api/facebook/events`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await response.json();
    }

    const raw = await response.text();
    console.error("Meta CAPI non-JSON response", {
      status: response.status,
      statusText: response.statusText,
      snippet: raw.slice(0, 120),
    });
    return null;
  } catch (error) {
    console.error("Meta CAPI request failed", error);
    return null;
  }
}

export function trackViewContent(product: Product) {
  const currency = resolveCurrency();
  const customData = {
    content_type: "product",
    content_ids: [String(product.id)],
    contents: [buildContentItem(product, 1)],
    content_name: product.name,
    value: Number(product.price) || 0,
    currency,
  };

  const { eventId } = trackBrowserEvent("ViewContent", customData);
  void trackServerEvent({
    eventName: "ViewContent",
    eventId,
    customData,
  });
}

export function trackAddToCart(product: Product, size: string, quantity = 1) {
  const currency = resolveCurrency();
  const customData = {
    content_type: "product",
    content_ids: [String(product.id)],
    contents: [
      {
        ...buildContentItem(product, quantity),
        size,
      },
    ],
    content_name: product.name,
    value: (Number(product.price) || 0) * quantity,
    currency,
  };

  const { eventId } = trackBrowserEvent("AddToCart", customData);
  void trackServerEvent({
    eventName: "AddToCart",
    eventId,
    customData,
  });
}

export function trackInitiateCheckout(
  items: Array<{ product: Product; size: string; quantity: number }>,
  total: number,
  shipping = 0,
) {
  const currency = resolveCurrency();
  const customData = {
    content_type: "product",
    content_ids: items.map((item) => String(item.product.id)),
    contents: items.map((item) => ({
      ...buildContentItem(item.product, item.quantity),
      size: item.size,
    })),
    num_items: items.reduce((sum, item) => sum + item.quantity, 0),
    value: total,
    shipping,
    currency,
  };

  const { eventId } = trackBrowserEvent("InitiateCheckout", customData);
  void trackServerEvent({
    eventName: "InitiateCheckout",
    eventId,
    customData,
  });
}

export async function trackPurchase(input: PurchaseInput) {
  const currency = resolveCurrency(input.currency);
  const customData = {
    content_type: "product",
    content_ids: input.items.map((item) => String(item.product.id)),
    contents: input.items.map((item) => ({
      ...buildContentItem(item.product, item.quantity),
      size: item.size,
    })),
    num_items: input.items.reduce((sum, item) => sum + item.quantity, 0),
    value: input.total,
    currency,
    order_id: input.orderId,
  };

  const eventId = input.eventId ?? generateEventId("purchase");
  trackBrowserEvent("Purchase", customData, eventId);

  return await trackServerEvent({
    eventName: "Purchase",
    eventId,
    customData,
    userData: input.userData,
  });
}
