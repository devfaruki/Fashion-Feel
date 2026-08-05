// Simple smoke test for /api/facebook/events
// Usage: node scripts/capi-smoke.js

require("dotenv").config();

const endpoint =
  process.env.CAPI_SMOKE_ENDPOINT ||
  `http://localhost:${process.env.PORT || 3000}/api/facebook/events`;

async function run() {
  try {
    const payload = {
      eventName: "ViewContent",
      eventId: `smoke_${Date.now()}`,
      eventSourceUrl: "http://localhost/product/123",
      actionSource: "website",
      customData: {
        content_type: "product",
        content_ids: ["123"],
        value: 10,
        currency: "BDT",
      },
      userData: {
        external_id: `ext_${Date.now()}`,
        fbp: "fb.1.1600000000.1234567890",
      },
    };

    // node 18+ has global fetch; fallback to node-fetch if not available
    let fetchFn = global.fetch;
    if (!fetchFn) {
      try {
        fetchFn = (...args) =>
          import("node-fetch").then(({ default: f }) => f(...args));
      } catch (e) {
        console.error(
          "fetch is not available and node-fetch could not be imported.",
        );
        process.exit(1);
      }
    }

    console.log("Posting smoke payload to", endpoint);
    const res = await fetchFn(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("Smoke test failed:", res.status, data);
      process.exit(2);
    }

    console.log("Smoke test success:", data && (data.status || data));
    process.exit(0);
  } catch (err) {
    console.error("Error running smoke test:", err.message || err);
    process.exit(3);
  }
}

run();
