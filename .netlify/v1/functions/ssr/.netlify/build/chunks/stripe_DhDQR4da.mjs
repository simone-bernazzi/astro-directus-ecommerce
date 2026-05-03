import Stripe from 'stripe';
import { readItems, createItem, createItems, updateItem, createDirectus, staticToken, rest } from '@directus/sdk';
import { randomUUID } from 'node:crypto';

const prerender = false;
function getDirectusClient() {
  return createDirectus(process.env.DIRECTUS_URL).with(staticToken(process.env.DIRECTUS_TOKEN)).with(rest());
}
const POST = async ({ request }) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[webhook] signature verification failed:", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
  }
  if (event.type !== "checkout.session.completed") {
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }
  const session = event.data.object;
  const directus = getDirectusClient();
  try {
    const existing = await directus.request(
      readItems("orders", {
        filter: { stripe_session_id: { _eq: session.id } },
        limit: 1,
        fields: ["id"]
      })
    );
    if (existing.length > 0) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
    }
    const paymentIntent = typeof session.payment_intent === "string" ? await stripe.paymentIntents.retrieve(session.payment_intent) : session.payment_intent;
    const rawItems = JSON.parse(paymentIntent?.metadata?.items ?? "[]");
    const variantIds = rawItems.map((i) => i.variantId);
    const variants = await directus.request(
      readItems("product_variants", {
        filter: { id: { _in: variantIds } },
        fields: [
          "id",
          "sku",
          "name",
          "price_override",
          "stock_quantity",
          "product_id",
          "digital_file.*",
          "download_limit",
          "download_expires_hours",
          "product_id.*"
        ]
      })
    );
    const shippingAddr = session.shipping_details?.address;
    const shipping_address = shippingAddr ? {
      name: session.shipping_details?.name ?? "",
      line1: shippingAddr.line1 ?? "",
      line2: shippingAddr.line2 ?? null,
      city: shippingAddr.city ?? "",
      postal_code: shippingAddr.postal_code ?? "",
      state: shippingAddr.state ?? "",
      country: shippingAddr.country ?? ""
    } : null;
    const subtotalCents = session.amount_subtotal ?? 0;
    const totalCents = session.amount_total ?? 0;
    const shippingCost = parseFloat(session.metadata?.shipping_cost ?? "0");
    const giftCardAmount = parseFloat(session.metadata?.gift_card_amount ?? "0");
    const discountAmount = Math.max(0, (subtotalCents - totalCents) / 100 - shippingCost + giftCardAmount);
    const orderItemsData = rawItems.map((ri) => {
      const variant = variants.find((v) => v.id === ri.variantId) ?? {};
      const product = variant.product_id ?? {};
      const hasDigitalFile = !!variant.digital_file;
      const expiresAt = hasDigitalFile ? new Date(Date.now() + (variant.download_expires_hours ?? 168) * 3600 * 1e3).toISOString() : null;
      return {
        product_name: product.name ?? ri.sku,
        variant_name: variant.name ?? "",
        sku: ri.sku,
        unit_price: variant.price_override ?? product.base_price ?? 0,
        quantity: ri.qty,
        download_token: hasDigitalFile ? randomUUID() : null,
        download_count: 0,
        download_limit: variant.download_limit ?? 3,
        download_expires_at: expiresAt
      };
    });
    const order = await directus.request(
      createItem("orders", {
        stripe_session_id: session.id,
        status: "paid",
        customer_email: session.customer_details?.email ?? "",
        customer_name: session.customer_details?.name ?? "",
        subtotal: subtotalCents / 100,
        discount_amount: discountAmount,
        shipping_cost: shippingCost,
        total: totalCents / 100,
        coupon_id: null,
        gift_card_id: null,
        gift_card_amount_used: giftCardAmount > 0 ? giftCardAmount : null,
        shipping_address,
        items: orderItemsData.map((i) => ({
          product_name: i.product_name,
          variant_name: i.variant_name,
          sku: i.sku,
          unit_price: i.unit_price,
          quantity: i.quantity
        }))
      })
    );
    await directus.request(
      createItems("order_items", orderItemsData.map((i) => ({ ...i, order_id: order.id })))
    );
    for (const ri of rawItems) {
      const variant = variants.find((v) => v.id === ri.variantId);
      if (variant) {
        const newStock = Math.max(0, variant.stock_quantity - ri.qty);
        await directus.request(
          updateItem("product_variants", ri.variantId, { stock_quantity: newStock })
        );
      }
    }
    const giftCardCode = session.metadata?.gift_card_code;
    if (giftCardCode && giftCardAmount > 0) {
      const giftCards = await directus.request(
        readItems("gift_cards", {
          filter: { code: { _eq: giftCardCode } },
          limit: 1,
          fields: ["id", "remaining_value", "redemptions"]
        })
      );
      if (giftCards[0]) {
        const gc = giftCards[0];
        const redemptions = Array.isArray(gc.redemptions) ? gc.redemptions : [];
        await directus.request(
          updateItem("gift_cards", gc.id, {
            remaining_value: Math.max(0, gc.remaining_value - giftCardAmount),
            redemptions: [...redemptions, { date: (/* @__PURE__ */ new Date()).toISOString(), amount: giftCardAmount, order_id: order.id }]
          })
        );
      }
    }
    return new Response(JSON.stringify({ received: true, orderId: order.id }), { status: 200 });
  } catch (err) {
    console.error("[webhook] processing error:", err);
    return new Response(JSON.stringify({ received: true, error: "Processing failed" }), { status: 200 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
