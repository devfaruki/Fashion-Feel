# Analytics Integration Guide

This guide explains how to integrate Meta (Facebook) Pixel + Conversions API (CAPI), Google Analytics (GA4), and Microsoft Clarity in a Next.js app. It consolidates client and server code, environment variables, event deduplication, and QA steps so you can reuse it in another project.

**Key files in this repo:**
- **Meta Pixel (client):** [components/analytics/MetaPixel.tsx](components/analytics/MetaPixel.tsx#L1-L200)
- **GA4 (client):** [components/analytics/GoogleAnalytics.tsx](components/analytics/GoogleAnalytics.tsx#L1-L200)
- **Microsoft Clarity (client):** [components/analytics/MicrosoftClarity.tsx](components/analytics/MicrosoftClarity.tsx#L1-L200)
- **Meta events helper:** [lib/meta-events.ts](lib/meta-events.ts#L1-L220)
- **Server CAPI endpoint:** [app/api/meta/events/route.ts](app/api/meta/events/route.ts#L1-L220)
- **QA checklist:** [ANALYTICS_QA_CHECKLIST.md](ANALYTICS_QA_CHECKLIST.md#L1-L200)

**Overview**
- Browser pixel collects client-side events (fbq, gtag). Server-side CAPI improves match quality and reliability by sending backend events to Facebook Graph API.
- Deduplication: each event must include the same `event_id` in both browser and server payloads so Facebook deduplicates.

Environment variables (example)

```
NEXT_PUBLIC_META_PIXEL_ID=YOUR_PIXEL_ID
META_CONVERSIONS_API_TOKEN=YOUR_CAPI_TOKEN
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXX
NEXT_PUBLIC_CLARITY_ID=xxxxxx
META_TEST_EVENT_CODE=optional_test_code
```

Client integration

1) Meta Pixel (client)

Add a client component that injects the Pixel base script and initializes `fbq`.

Example (see full implementation): [components/analytics/MetaPixel.tsx](components/analytics/MetaPixel.tsx#L1-L200)

Core ideas:
- Initialize the pixel: `fbq('init', '<PIXEL_ID>')`.
- Use a readiness flag to know when `fbq` is available and then call `fbq('track', eventName, customData, { eventID: eventId })`.
- Generate an `eventId` for each meaningful action and use it for both browser and server events.

Sample browser event (pseudo):

```js
// generate event id
const eventId = `purchase_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
// browser pixel
fbq('track', 'Purchase', { value: 19.99, currency: 'USD' }, { eventID: eventId });
// push GA4 event if available
gtag && gtag('event', 'purchase', { value: 19.99, currency: 'USD', event_id: eventId });
// then call server to send CAPI
fetch('/api/meta/events', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ eventName: 'Purchase', eventId, eventSourceUrl: window.location.href, customData: { value: 19.99, currency: 'USD' }, userData: { fbp: getCookie('_fbp'), fbc: getCookie('_fbc'), email: userEmail } }) });
```

2) Google Analytics (GA4)

Load the GA4 snippet client-side and call `gtag('config', MEASUREMENT_ID)` and send events with `gtag('event', '<event>', payload)`.

See: [components/analytics/GoogleAnalytics.tsx](components/analytics/GoogleAnalytics.tsx#L1-L200)

3) Microsoft Clarity

Include the Clarity tag snippet in a client Script.

See: [components/analytics/MicrosoftClarity.tsx](components/analytics/MicrosoftClarity.tsx#L1-L200)

Server-side Conversions API (CAPI)

- The repo includes a ready CAPI route at [app/api/meta/events/route.ts](app/api/meta/events/route.ts#L1-L220).
- Responsibilities of the route:
  - Validate `eventName` and `eventId`.
  - Normalize and hash PII fields (email, phone) using SHA-256.
  - Validate `_fbp`/`_fbc` formats and include them when present.
  - Send a POST to `https://graph.facebook.com/v20.0/<PIXEL_ID>/events?access_token=<TOKEN>`.

Key server implementation notes (from the route):

- Hashing helper (sha256) is used for user fields: `em`, `ph`, `fn`, `ln`, `ct`, `zp`, `country`, `external_id`.
- `client_ip_address` and `client_user_agent` are included from request headers to improve matching.
- The route returns Facebook response details; handle non-OK responses.

Deploy and security

- Keep `META_CONVERSIONS_API_TOKEN` secret on the server. Do NOT expose it to the client.
- Add rate limiting to the endpoint to prevent abuse (see [docs/PRODUCTION_ARCHITECTURE.md](docs/PRODUCTION_ARCHITECTURE.md#L1-L120)).

Event design, deduplication and EMQ

- Always generate a unique `event_id` for each user action and use the same ID when submitting both browser and server events.
- Send available user match signals to CAPI: hashed `em`, hashed `ph`, `fn`, `ln`, `ct`, `zp`, `country`, `external_id`, plus `fbp` and `fbc` cookies.
- The repo helper [lib/meta-events.ts](lib/meta-events.ts#L1-L220) includes helpers:
  - `ensureMetaTrackingContext()` — creates `_fbc` from `fbclid` if missing.
  - `getOrCreateExternalId()` — sets a persistent external id cookie.
  - `trackBrowserEvent()` — unified browser event sending to fbq and gtag.
  - `trackServerEvent()` — calls the server CAPI route and enriches user data.

Example: sending a `Purchase` event (client-triggered flow)

1. Generate `eventId`.
2. Call `trackBrowserEvent('Purchase', customData, eventId)` to notify fbq and gtag.
3. Call `trackServerEvent()` which POSTs to `/api/meta/events` with hashed PII and cookies.

Verification and QA

- Use the following tools:
  - Meta Pixel Helper (Chrome extension) to verify browser pixel events.
  - Meta Events Manager -> Test Events to validate CAPI and deduplication.
  - GA4 DebugView and Realtime reports for GA events.
  - Microsoft Clarity dashboard for session recordings.
- Follow the QA checklist: [ANALYTICS_QA_CHECKLIST.md](ANALYTICS_QA_CHECKLIST.md#L1-L200)

Troubleshooting

- If server events are missing: check server environment variables and logs for `/api/meta/events` responses.
- If dedup is not happening: ensure both browser and server have identical `event_id` and server `event_time` close to browser event.
- For low EMQ (Event Match Quality): collect more hashed user signals (email/phone) earlier in flow.

Reusing this in another project

1. Copy the client components (Pixel, GA, Clarity) and the helper library `lib/meta-events.ts` into your project.
2. Add the server route `app/api/meta/events/route.ts` (or an equivalent REST endpoint) and set `META_CONVERSIONS_API_TOKEN` and `NEXT_PUBLIC_META_PIXEL_ID` in your environment.
3. Instrument key flows (view_item, add_to_cart, begin_checkout, purchase) to call both `trackBrowserEvent()` and `trackServerEvent()` with a shared `eventId`.
4. Run QA using the checklist and Pixel/Graph debugging tools.

Appendices

- Example cookie helpers and hashing are implemented in [lib/meta-events.ts](lib/meta-events.ts#L1-L220).
- Admin health page: [app/(dashboard)/admin/analytics/page.tsx](app/(dashboard)/admin/analytics/page.tsx#L1-L240) — useful for live checks in staging.
