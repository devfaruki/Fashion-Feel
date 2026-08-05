# Fasion Feel Frontend

This app contains the browser-side tracking stack used by Fasion Feel.

## Tracking Included

- Meta Pixel
- Google Analytics 4
- Microsoft Clarity
- Ecommerce event tracking for product view, add to cart, checkout start, and purchase

## Where It Is Wired

The global tracking components are mounted from [src/app/layout.tsx](src/app/layout.tsx):

- [src/components/analytics/MetaPixel.tsx](src/components/analytics/MetaPixel.tsx)
- [src/components/analytics/GoogleAnalytics.tsx](src/components/analytics/GoogleAnalytics.tsx)
- [src/components/analytics/MicrosoftClarity.tsx](src/components/analytics/MicrosoftClarity.tsx)

Shared event helpers live in [src/lib/meta-events.ts](src/lib/meta-events.ts).

## Event Flow

### Meta Pixel

- Loads the base Pixel script with `next/script`
- Sends the initial `PageView`
- Sends SPA route-change `PageView` events when the pathname changes
- Uses tracking cookies such as `_fbp`, `_fbc`, and `fl_external_id`

### Google Analytics 4

- Loads `gtag.js` with the configured measurement ID
- Initializes `window.dataLayer` and `window.gtag`
- Sends the initial config page view
- Sends manual `page_view` events on route changes

### Microsoft Clarity

- Loads the Clarity script after interaction
- Uses `NEXT_PUBLIC_CLARITY_ID`
- Returns `null` if the ID is missing

## Ecommerce Events

The frontend emits the following events from shared helpers in [src/lib/meta-events.ts](src/lib/meta-events.ts):

- `ViewContent` from product detail pages
- `AddToCart` from cart actions
- `InitiateCheckout` from the checkout screen
- `Purchase` after the order is created

These helpers send the event to both Meta Pixel and GA4 in the browser, and also POST a server-side Meta CAPI event when needed.

## Key Call Sites

- Product view tracking: [src/app/product/[id]/page.tsx](src/app/product/[id]/page.tsx)
- Add to cart tracking: [src/contexts/CartContext.tsx](src/contexts/CartContext.tsx)
- Checkout start and purchase tracking: [src/app/checkout/page.tsx](src/app/checkout/page.tsx)

## Environment Variables

Add these to the frontend `.env` file:

```env
NEXT_PUBLIC_META_PIXEL_ID=your_meta_pixel_id
NEXT_PUBLIC_GA_MEASUREMENT_ID=your_ga4_measurement_id
NEXT_PUBLIC_CLARITY_ID=your_clarity_project_id
NEXT_PUBLIC_META_EVENT_CURRENCY=USD
NEXT_PUBLIC_API_URL=https://your-backend.example.com
```

Notes:

- `NEXT_PUBLIC_API_URL` should point to the backend that exposes `/api/facebook/events`
- `NEXT_PUBLIC_META_EVENT_CURRENCY` is optional and defaults to `USD`

## Reuse Checklist

1. Add the three analytics components to the root layout.
2. Keep SPA page-view tracking for Meta Pixel and GA4.
3. Centralize ecommerce events in one helper file.
4. Use stable event IDs to avoid duplicate attribution.
5. Keep all IDs and tokens in environment variables.

## Reference

For the full frontend and server tracking map, see [../TRACKING_IMPLEMENTATION_README.md](../TRACKING_IMPLEMENTATION_README.md).
