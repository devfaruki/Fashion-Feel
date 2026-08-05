/**
 * Facebook Conversion API Service
 * Handles server-side tracking of purchase events and other conversions
 * 
 * For more info: https://developers.facebook.com/docs/marketing-api/conversions-api/
 */

const crypto = require('crypto');

class FacebookConversionAPI {
    constructor(pixelId, accessToken) {
        this.pixelId = pixelId;
        this.accessToken = accessToken;
        this.apiVersion = 'v18.0';
        this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
        this.endpoint = `${this.baseUrl}/${this.pixelId}/events`;
    }

    /**
     * Hash personally identifiable information for Facebook Conversion API
     * This provides GDPR compliance and improves matching
     * @param {string} data - The data to hash (email, phone, etc.)
     * @returns {string} - SHA256 hashed value in lowercase
     */
    hashData(data) {
        if (!data) return null;
        return crypto
            .createHash('sha256')
            .update(data.toLowerCase().trim())
            .digest('hex');
    }

    /**
     * Send event to Facebook Conversion API
     * @param {object} eventData - Event data object
     * @returns {Promise<object>} - API response
     */
    async trackEvent(eventData) {
        try {
            if (!this.pixelId || !this.accessToken) {
                throw new Error('Facebook Pixel ID or Access Token is not configured');
            }

            const payload = {
                data: [eventData],
                access_token: this.accessToken,
            };

            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                console.error('Facebook Conversion API Error:', result);
                return {
                    success: false,
                    error: result.error?.message || 'Unknown error',
                    details: result,
                };
            }

            console.log('[Facebook Conversion API] ✅ Event tracked:', {
                eventName: eventData.event_name,
                eventsReceived: result.events_received,
                fbtrace_id: result.fbtrace_id,
            });

            return {
                success: true,
                eventsReceived: result.events_received,
                fbtrace_id: result.fbtrace_id,
            };
        } catch (error) {
            console.error('[Facebook Conversion API] ❌ Error:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Track Purchase Event (called when order is completed)
     * @param {object} options - Purchase event options
     * @returns {Promise<object>}
     * 
     * Example:
     * trackPurchase({
     *   customerId: 123,
     *   email: 'user@example.com',
     *   phone: '+8801234567890',
     *   orderId: 'ORDER_12345',
     *   currency: 'BDT',
     *   value: 5000,
     *   items: [{product_name: 'Shirt', price: 1000, quantity: 2}],
     *   contentType: 'product',
     * })
     */
    async trackPurchase(options) {
        const {
            customerId,
            email,
            phone,
            orderId,
            currency = 'BDT',
            value,
            items = [],
            contentType = 'product',
        } = options;

        // Prepare user data (hashed for privacy)
        const userData = {};
        if (email) userData.em = this.hashData(email);
        if (phone) userData.ph = this.hashData(phone);

        // Prepare content items for better conversion tracking
        const contents = items.map((item) => ({
            id: item.productId || item.id,
            title: item.product_name || item.name,
            quantity: item.quantity || 1,
            delivery_category: 'home_delivery',
        }));

        const eventData = {
            event_name: 'Purchase',
            event_time: Math.floor(Date.now() / 1000),
            event_id: `purchase_${orderId}_${Date.now()}`, // Unique event ID to prevent duplicates
            user_data: userData,
            custom_data: {
                currency,
                value,
                content_name: `Order #${orderId}`,
                content_ids: items.map((item) => item.productId || item.id),
                content_type: contentType,
                contents,
                order_id: orderId,
            },
            opt_out: false,
        };

        return this.trackEvent(eventData);
    }

    /**
     * Track AddToCart Event
     * @param {object} options
     */
    async trackAddToCart(options) {
        const {
            email,
            phone,
            value,
            currency = 'BDT',
            product = {},
            quantity = 1,
        } = options;

        const userData = {};
        if (email) userData.em = this.hashData(email);
        if (phone) userData.ph = this.hashData(phone);

        const eventData = {
            event_name: 'AddToCart',
            event_time: Math.floor(Date.now() / 1000),
            event_id: `addtocart_${product.id}_${Date.now()}`,
            user_data: userData,
            custom_data: {
                currency,
                value,
                content_ids: [product.productId || product.id],
                content_type: 'product',
                contents: [
                    {
                        id: product.productId || product.id,
                        title: product.product_name || product.name,
                        quantity,
                    },
                ],
            },
        };

        return this.trackEvent(eventData);
    }

    /**
     * Track InitiateCheckout Event
     * @param {object} options
     */
    async trackInitiateCheckout(options) {
        const {
            email,
            phone,
            value,
            currency = 'BDT',
            items = [],
        } = options;

        const userData = {};
        if (email) userData.em = this.hashData(email);
        if (phone) userData.ph = this.hashData(phone);

        const eventData = {
            event_name: 'InitiateCheckout',
            event_time: Math.floor(Date.now() / 1000),
            event_id: `checkout_${Date.now()}`,
            user_data: userData,
            custom_data: {
                currency,
                value,
                content_ids: items.map((item) => item.productId || item.id),
                content_type: 'product',
                num_items: items.length,
            },
        };

        return this.trackEvent(eventData);
    }

    /**
     * Track ViewContent Event (for product pages)
     * @param {object} options
     */
    async trackViewContent(options) {
        const {
            email,
            phone,
            value,
            currency = 'BDT',
            product = {},
        } = options;

        const userData = {};
        if (email) userData.em = this.hashData(email);
        if (phone) userData.ph = this.hashData(phone);

        const eventData = {
            event_name: 'ViewContent',
            event_time: Math.floor(Date.now() / 1000),
            event_id: `viewcontent_${product.id}_${Date.now()}`,
            user_data: userData,
            custom_data: {
                currency,
                value: value || product.price || 0,
                content_ids: [product.productId || product.id],
                content_name: product.product_name || product.name,
                content_type: 'product',
                contents: [
                    {
                        id: product.productId || product.id,
                        title: product.product_name || product.name,
                    },
                ],
            },
        };

        return this.trackEvent(eventData);
    }
}

module.exports = FacebookConversionAPI;
