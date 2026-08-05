# Fasion Feel Server

This app contains the backend-side tracking and Meta Conversions API integration used by Fasion Feel.

## Tracking Included

- Meta Conversions API proxy endpoint
- Server-side purchase tracking after order creation
- PII normalization and SHA-256 hashing for Meta user data

## Where It Is Wired

### Meta CAPI Client

The conversion API client is implemented in [lib/facebookConversionAPI.js](lib/facebookConversionAPI.js).

It supports:

- `Purchase`
- `AddToCart`
- `InitiateCheckout`
- `ViewContent`

### Events Proxy Route

The HTTP endpoint is implemented in [routes/facebook/facebookRoutes.js](routes/facebook/facebookRoutes.js).

Endpoint:

- `POST /api/facebook/events`

What it does:

- Checks that `FACEBOOK_PIXEL_ID` and `FACEBOOK_CONVERSION_API_TOKEN` are set
- Validates `eventName` and `eventId`
- Captures client IP and user agent
- Normalizes and hashes user data where appropriate
- Forwards the event to Meta Graph API

### Order Purchase Hook

Purchase tracking is triggered asynchronously after order creation in [routes/order/orderRoutes.js](routes/order/orderRoutes.js).

This means order creation does not wait on Facebook tracking to finish.

## Payload Shape

The frontend sends a payload like this to `/api/facebook/events`:

```json
{
	"eventName": "Purchase",
	"eventId": "purchase_123",
	"eventSourceUrl": "https://example.com/checkout",
	"customData": {},
	"userData": {
		"email": "user@example.com",
		"phone": "8801...",
		"fn": "First",
		"ln": "Last",
		"ct": "Dhaka",
		"zp": "1207",
		"country": "bd",
		"external_id": "123",
		"fbp": "fb.1....",
		"fbc": "fb.1...."
	}
}
```

The server enriches this with request IP, user agent, and Meta-compatible user data before forwarding it.

## Environment Variables

Add these to the server `.env` file:

```env
DATABASE_URL=mysql://user:password@localhost:3306/database
ACCESS_TOKEN_SECRET=your_jwt_secret
NODE_ENV=production
PORT=3000

FACEBOOK_PIXEL_ID=your_meta_pixel_id
FACEBOOK_CONVERSION_API_TOKEN=your_meta_capi_token
FACEBOOK_WEBHOOK_VERIFY_TOKEN=optional_webhook_token
FRONTEND_URL=https://your-frontend.example.com
```

## Reuse Checklist

1. Keep the pixel ID and access token on the server only.
2. Validate required event fields before sending to Meta.
3. Hash personal data before forwarding user data.
4. Run purchase tracking asynchronously so order creation stays fast.
5. Keep the frontend and backend event IDs aligned for deduplication.

## Reference

For the full frontend and server tracking map, see [../TRACKING_IMPLEMENTATION_README.md](../TRACKING_IMPLEMENTATION_README.md).
