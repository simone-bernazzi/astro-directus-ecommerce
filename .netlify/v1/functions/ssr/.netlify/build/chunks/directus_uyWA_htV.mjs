import { readItems, createDirectus, rest, staticToken, readSingleton, readItem } from '@directus/sdk';

const __vite_import_meta_env__ = {"ASSETS_PREFIX": undefined, "BASE_URL": "/", "DEV": false, "MODE": "production", "PROD": true, "SITE": undefined, "SSR": true};
function getDirectusUrl() {
  return typeof import.meta !== "undefined" && Object.assign(__vite_import_meta_env__, { _: "/Users/simonebernazzi/.nvm/versions/node/v22.22.2/bin/node" })?.DIRECTUS_URL || process.env.DIRECTUS_URL || "";
}
function getDirectusToken() {
  return typeof import.meta !== "undefined" && Object.assign(__vite_import_meta_env__, { _: "/Users/simonebernazzi/.nvm/versions/node/v22.22.2/bin/node" })?.DIRECTUS_TOKEN || process.env.DIRECTUS_TOKEN || "";
}
function getClient() {
  const url = getDirectusUrl();
  const token = getDirectusToken();
  if (!url) {
    throw new Error("DIRECTUS_URL not configured. Add it to your .env file.");
  }
  let client = createDirectus(url).with(rest());
  if (token) {
    client = client.with(staticToken(token));
  }
  return client;
}
function getDirectusImageUrl(fileId, params) {
  if (!fileId) return "";
  const base = `${getDirectusUrl()}/assets/${fileId}`;
  if (!params) return base;
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== void 0).map(([k, v]) => [k, String(v)])
  ).toString();
  return query ? `${base}?${query}` : base;
}
async function getSiteSettings() {
  const client = getClient();
  const data = await client.request(
    readSingleton("site_settings", {
      fields: ["*", "logo.*"]
    })
  );
  return data;
}
async function getProducts(options = {}) {
  const client = getClient();
  const filter = { status: { _eq: "published" }, is_active: { _eq: true } };
  if (options.featured) filter.featured = { _eq: true };
  if (options.categorySlug) filter.category_id = { slug: { _eq: options.categorySlug } };
  const items = await client.request(
    readItems("products", {
      filter,
      limit: options.limit ?? -1,
      fields: [
        "*",
        "images.directus_files_id.*",
        "category_id.*",
        "variants.*",
        "variants.image_id.*",
        "variants.digital_file.*"
      ],
      sort: ["sort_order", "name"]
    })
  );
  return items;
}
async function getShippingZones() {
  const client = getClient();
  const items = await client.request(
    readItems("shipping_zones", {
      filter: { is_active: { _eq: true } },
      fields: ["*"]
    })
  );
  return items;
}
async function getCouponByCode(code) {
  const client = getClient();
  const items = await client.request(
    readItems("coupons", {
      filter: { code: { _icontains: code }, is_active: { _eq: true } },
      limit: 1,
      fields: ["*"]
    })
  );
  const list = items;
  return list[0] ?? null;
}
async function getGiftCardByCode(code) {
  const client = getClient();
  const items = await client.request(
    readItems("gift_cards", {
      filter: { code: { _eq: code }, is_active: { _eq: true } },
      limit: 1,
      fields: ["id", "code", "initial_value", "remaining_value", "expires_at", "is_active", "redemptions"]
    })
  );
  const list = items;
  return list[0] ?? null;
}
async function getOrdersByCustomer(customerId) {
  const client = getClient();
  const items = await client.request(
    readItems("orders", {
      filter: { customer_id: { _eq: customerId } },
      fields: ["*", "order_items.*"],
      sort: ["-date_created"]
    })
  );
  return items;
}
async function getOrderById(id) {
  const client = getClient();
  try {
    const item = await client.request(
      readItem("orders", id, { fields: ["*", "order_items.*"] })
    );
    return item;
  } catch {
    return null;
  }
}
async function getOrderBySessionId(sessionId) {
  const client = getClient();
  const items = await client.request(
    readItems("orders", {
      filter: { stripe_session_id: { _eq: sessionId } },
      limit: 1,
      fields: ["*", "order_items.*"]
    })
  );
  const list = items;
  return list[0] ?? null;
}

export { getOrdersByCustomer as a, getSiteSettings as b, getDirectusImageUrl as c, getProducts as d, getShippingZones as e, getCouponByCode as f, getOrderById as g, getGiftCardByCode as h, getOrderBySessionId as i };
