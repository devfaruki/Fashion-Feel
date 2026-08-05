# Facebook Pixel Backend Setup Guide

This guide covers the server-side integration of Facebook Pixel Conversion API for your ecommerce backend.

## Overview

Your backend now includes:

- **Facebook Conversion API Service** (`lib/facebookConversionAPI.js`) - Handles server-side event tracking
- **Facebook Routes** (`routes/facebook/facebookRoutes.js`) - Provides endpoints for tracking events
- **Automatic Purchase Tracking** - Orders automatically send purchase data to Facebook

## Why Backend Integration?

1. **Better Tracking Accuracy** - Server-side events are more reliable than client-side
2. **GDPR Compliance** - Sensitive data (emails, phones) should be hashed server-side
3. **Conversion Verification** - Facebook trusts server data more than client-side
4. **Offline Conversions** - Track purchases even if user has ad blockers
5. **Real-Time Reporting** - Purchase events appear immediately in Events Manager

## Step 1: Get Facebook Conversion API Token

### Prerequisites

- Facebook Business Account with Pixel created
- Admin access to Facebook Pixel

### Steps to Generate Token

1. Go to [Facebook Business Manager](https://business.facebook.com/)
2. Navigate to **Events Manager** (or **Data Sources** → **Pixels**)
3. Select your **Pixel ID**
4. Go to **Settings** tab
5. Scroll to **Conversions API**
6. Click **Generate Access Token**
7. Copy the token (save it securely)

## Step 2: Configure Environment Variables

Update your `.env` file with the following variables:

```bash
# Facebook Pixel Configuration
FACEBOOK_PIXEL_ID=YOUR_PIXEL_ID_HERE
FACEBOOK_CONVERSION_API_TOKEN=YOUR_API_TOKEN_HERE
FRONTEND_URL=http://localhost:3000
```

### Getting Your Values

**FACEBOOK_PIXEL_ID:**

- Go to Events Manager
- Your Pixel ID is displayed at the top or in Settings
- Example: `1234567890`

**FACEBOOK_CONVERSION_API_TOKEN:**

- Generate from Conversions API section in Pixel Settings
- Format: Long alphanumeric string
- Example: `EAABsdfkjsdfklsdfj...`

## Step 3: API Endpoints

Your backend now provides the following endpoints:

### 1. Track Events (Single Endpoint)

**Endpoint:** `POST /api/facebook/events`

All conversion events (Purchase, AddToCart, ViewContent, InitiateCheckout) are sent through this single endpoint.

**Request Body:**

```json
{
  "eventName": "Purchase",
  "eventId": "purchase_123_1710000000",
  "eventSourceUrl": "https://your-frontend-url/checkout",
  "actionSource": "website",
  "customData": {
    "currency": "BDT",
    "value": 5000,
    "order_id": "123",
    "content_type": "product",
    "content_ids": ["789", "790"]
  },
  "userData": {
    "email": "customer@example.com",
    "phone": "+8801234567890",
    "external_id": "cust_456",
    "fbp": "fb.1.1710000000.1234567890",
    "fbc": "fb.1.1710000000.ABCDEF"
  }
}
```

**Response:**

```json
{
  "status": "success",
  "meta": {
    "success": true,
    "eventsReceived": 1,
    "fbtrace_id": "abc123def456"
  }
}
```

Use this same endpoint for AddToCart, ViewContent, InitiateCheckout, and Purchase.

#### Track Add To Cart

**Request Body:**

```json
{
  "eventName": "AddToCart",
  "email": "customer@example.com",
  "phone": "+8801234567890",
  "value": 1000,
  "currency": "BDT",
  "product": {
    "id": 789,
    "product_name": "Premium T-Shirt",
    "price": 1000
  }
}
```

#### Track View Content

**Request Body:**

```json
{
  "eventName": "ViewContent",
  "email": "customer@example.com",
  "phone": "+8801234567890",
  "value": 1000,
  "currency": "BDT",
  "product": {
    "id": 789,
    "product_name": "Premium T-Shirt",
    "price": 1000
  }
}
```

#### Track Initiate Checkout

**Request Body:**

```json
{
  "eventName": "InitiateCheckout",
  "email": "customer@example.com",
  "phone": "+8801234567890",
  "value": 4500,
  "currency": "BDT",
  "items": [
    {
      "id": 789,
      "product_name": "Premium T-Shirt",
      "quantity": 2
    },
    {
      "id": 790,
      "product_name": "Blue Jeans",
      "quantity": 1
    }
  ]
}
```

**Response (all events):**

```json
{
  "status": "success",
  "message": "AddToCart event tracked successfully",
  "fbeesId": "xyz789abc456"
}
```

## Step 4: Frontend Integration

Your frontend should call the backend endpoints when users interact with products:

### Example Frontend Implementation (Vue/React/Next.js)

```javascript
// When user adds product to cart
async function trackAddToCart(product, userEmail, userPhone) {
  try {
    const response = await fetch(
      "http://your-backend-url/api/facebook/events",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName: "AddToCart",
          eventId: `addtocart_${product.productId}_${Date.now()}`,
          customData: {
            currency: "BDT",
            value: product.price,
            content_type: "product",
            content_ids: [String(product.productId)],
          },
          userData: {
            email: userEmail,
            phone: userPhone,
          },
        }),
      },
    );
    const data = await response.json();
    console.log("✅ AddToCart tracked:", data);
  } catch (error) {
    console.error("❌ Error tracking AddToCart:", error);
  }
}

// When user views checkout (cart)
async function trackCheckout(items, userEmail, userPhone, totalValue) {
  try {
    const response = await fetch(
      "http://your-backend-url/api/facebook/events",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName: "InitiateCheckout",
          eventId: `checkout_${Date.now()}`,
          customData: {
            currency: "BDT",
            value: totalValue,
            content_type: "product",
          },
          userData: {
            email: userEmail,
            phone: userPhone,
          },
        }),
      },
    );
    const data = await response.json();
    console.log("✅ Checkout tracked:", data);
  } catch (error) {
    console.error("❌ Error tracking checkout:", error);
  }
}
```

## Step 5: Verify Everything Works

### Check Backend Logs

When an order is created, you should see console logs like:

```
[Facebook Conversion API] ✅ Event tracked: {
  eventName: 'Purchase',
  fbeesId: 'abc123def456'
}
```

### Check Facebook Events Manager

1. Go to [Facebook Events Manager](https://business.facebook.com/events_manager/)
2. Select your Pixel
3. Go to **Test Events** tab
4. You should see **Purchase** events appearing in real-time
5. Events should show:
   - Event name (Purchase)
   - Timestamp
   - Event value (BDT currency)
   - Customer email/phone (hashed)

### Monitor in Browser Console

When frontend calls backend endpoints, you'll see responses in browser console:

```javascript
Console Output:
✅ AddToCart tracked: {status: 'success', message: '...', fbeesId: 'xyz123'}
✅ Purchase tracked: {status: 'success', message: '...', fbeesId: 'abc456'}
```

## Tracked Events

Your system now automatically tracks:

| Event                | When                            | Data Sent                                    |
| -------------------- | ------------------------------- | -------------------------------------------- |
| **Purchase**         | ✅ Automatic when order created | Order ID, total value, items, customer email |
| **AddToCart**        | Called from frontend            | Product ID, price, customer email            |
| **ViewContent**      | Called from frontend            | Product ID, price, customer email            |
| **InitiateCheckout** | Called from frontend            | All cart items, total value, customer email  |
| **PageView**         | Tracked by frontend pixel       | Page URL, user ID                            |

## Advanced: Data Privacy & Hashing

The Facebook Conversion API uses **SHA256 hashing** for personally identifiable information:

### What Gets Hashed:

- Email addresses → `em` (hashed)
- Phone numbers → `ph` (hashed)

### Why Hashing?

- GDPR compliance - no plain text PII sent to Facebook
- Better matching - Facebook compares hashed values
- More secure - your customer data stays private

### How It Works (Automatically)

```javascript
// Input: customer@example.com
// Output: aec070645fe53ee3cee59928e4aceaa22ec84ec0d0ee77257961b641d2487ec7

// The hashing is done in lib/facebookConversionAPI.js
hashData(data) {
  return crypto
    .createHash('sha256')
    .update(data.toLowerCase().trim())
    .digest('hex');
}
```

## Troubleshooting

### Issue: "Facebook Pixel ID or Access Token is not configured"

**Solution:** Check your `.env` file has both variables set correctly

```bash
FACEBOOK_PIXEL_ID=1234567890
FACEBOOK_CONVERSION_API_TOKEN=EAABs...
```

### Issue: Events not showing in Events Manager

**Solution:**

1. Wait 5-10 minutes for events to propagate
2. Check API response for errors: `"error": "..."`
3. Verify token hasn't expired
4. Check Network tab in browser DevTools for failed requests

### Issue: 400 Bad Request when calling endpoints

**Solution:** Verify your JSON payload has required fields:

- Purchase: `orderId`, `value`, `items`
- AddToCart: `product` with `id`
- InitiateCheckout: `items` array

### Issue: Wrong event value in Facebook

**Solution:** Ensure `value` matches your currency (BDT)

- Should be in minor units: 5000 = 50 BDT
- Or adjust based on your currency convention

## Security Best Practices

1. ✅ **Never commit secrets** - Keep tokens in `.env.local`
2. ✅ **CORS enabled** - Backend accepts requests from frontend
3. ✅ **Validation** - All endpoints validate input before sending to Facebook
4. ✅ **Async tracking** - Purchase tracking doesn't block order creation
5. ✅ **Error handling** - Failed tracking doesn't fail order creation

## Production Checklist

- [ ] Facebook Pixel ID is correct
- [ ] Conversion API token is valid and not expired
- [ ] `.env` variables are set in production
- [ ] Backend endpoints are accessible from frontend
- [ ] Events Manager shows live purchase events
- [ ] Customer PII is properly hashed
- [ ] CORS is configured to allow frontend domain
- [ ] Error logs are monitored

## Useful Resources

- 📘 [Facebook Conversion API Docs](https://developers.facebook.com/docs/marketing-api/conversions-api)
- 📊 [Events Manager](https://business.facebook.com/events_manager/)
- 🧪 [Pixel Test Tool](https://developers.facebook.com/tools/pixelhelper/)
- 📋 [Event Reference](https://developers.facebook.com/docs/facebook-pixel/reference)
- 🔐 [Privacy & Data](https://developers.facebook.com/docs/plugins/pixel#privacy)

## Support

If you encounter issues:

1. **Check Console Logs:** Look for `[Facebook Conversion API]` messages
2. **Verify Token:** Go to Business Manager → Pixel Settings → Conversions API
3. **Test Endpoint:** Use Postman to test `/api/facebook/events`
4. **Check Events Manager:** Verify events appear in Test Events tab

---

**Setup Date:** December 2025  
**Backend Version:** 1.0.0  
**Tested With:** Node.js Express, Prisma ORM, MySQL
