import Stripe from 'stripe';
import { z } from 'zod';
import { d as getProducts, e as getShippingZones, f as getCouponByCode, h as getGiftCardByCode } from './directus_uyWA_htV.mjs';

const prerender = false;
const CartItemSchema = z.object({
  variantId: z.string(),
  productId: z.string(),
  productSlug: z.string(),
  productName: z.string(),
  variantName: z.string(),
  sku: z.string(),
  price: z.number().positive(),
  quantity: z.number().int().positive(),
  image: z.string().nullable(),
  type: z.enum(["physical", "digital"]),
  weightG: z.number().int().min(0)
});
const BodySchema = z.object({
  items: z.array(CartItemSchema).min(1),
  couponCode: z.string().nullable().optional(),
  giftCardCode: z.string().nullable().optional(),
  shippingCountry: z.string().length(2).optional()
});
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key);
}
function calcShipping(items, zone, subtotal) {
  if (!zone) return 0;
  if (zone.free_shipping_threshold && subtotal >= zone.free_shipping_threshold) return 0;
  const totalWeightKg = items.reduce((sum, i) => sum + i.weightG * i.quantity, 0) / 1e3;
  return zone.base_rate + zone.rate_per_kg * Math.max(0, totalWeightKg - 1);
}
const POST = async ({ request }) => {
  const origin = request.headers.get("origin") ?? "";
  const allowed = process.env.ALLOWED_ORIGIN ?? "";
  if (allowed && origin !== allowed) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid request", details: parsed.error.flatten() }), { status: 400 });
  }
  const { items, couponCode, giftCardCode, shippingCountry } = parsed.data;
  try {
    const products = await getProducts();
    const lineItems = [];
    let subtotal = 0;
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        return new Response(JSON.stringify({ error: `Prodotto non trovato: ${item.productName}` }), { status: 400 });
      }
      const variant = product.variants?.find((v) => v.id === item.variantId && v.is_active);
      if (!variant) {
        return new Response(JSON.stringify({ error: `Variante non trovata: ${item.variantName}` }), { status: 400 });
      }
      if (variant.stock_quantity < item.quantity) {
        return new Response(JSON.stringify({ error: `Stock insufficiente per: ${item.productName}` }), { status: 400 });
      }
      const serverPrice = variant.price_override ?? product.base_price;
      subtotal += serverPrice * item.quantity;
      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: {
            name: `${product.name}${variant.name !== product.name ? ` — ${variant.name}` : ""}`,
            metadata: { productId: product.id, variantId: variant.id, sku: variant.sku }
          },
          unit_amount: Math.round(serverPrice * 100)
        },
        quantity: item.quantity
      });
    }
    const zones = await getShippingZones();
    let shippingZone = null;
    if (shippingCountry) {
      shippingZone = zones.find((z2) => z2.countries.includes(shippingCountry)) ?? null;
    }
    const hasPhysical = items.some((i) => i.type === "physical");
    const shippingCost = hasPhysical ? calcShipping(items, shippingZone, subtotal) : 0;
    if (shippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: { name: "Spedizione" },
          unit_amount: Math.round(shippingCost * 100)
        },
        quantity: 1
      });
    }
    let stripeCoupon;
    let discountAmount = 0;
    if (couponCode) {
      const coupon = await getCouponByCode(couponCode);
      if (coupon && coupon.is_active) {
        if (!coupon.min_order_amount || subtotal >= coupon.min_order_amount) {
          discountAmount = coupon.type === "percent" ? subtotal * (coupon.value / 100) : coupon.value;
          if (coupon.stripe_coupon_id) {
            stripeCoupon = coupon.stripe_coupon_id;
          }
        }
      }
    }
    let giftCardAmount = 0;
    if (giftCardCode) {
      const giftCard = await getGiftCardByCode(giftCardCode);
      if (giftCard && giftCard.is_active && giftCard.remaining_value > 0) {
        giftCardAmount = Math.min(giftCard.remaining_value, subtotal - discountAmount);
        if (giftCardAmount > 0) {
          lineItems.push({
            price_data: {
              currency: "eur",
              product_data: { name: `Gift card (${giftCardCode})` },
              unit_amount: -Math.round(giftCardAmount * 100)
            },
            quantity: 1
          });
        }
      }
    }
    const stripe = getStripe();
    const siteUrl = process.env.PUBLIC_SITE_URL ?? "http://localhost:4321";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      ...stripeCoupon ? { discounts: [{ coupon: stripeCoupon }] } : {},
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout/cancel`,
      metadata: {
        coupon_code: couponCode ?? "",
        gift_card_code: giftCardCode ?? "",
        gift_card_amount: String(giftCardAmount),
        shipping_cost: String(shippingCost)
      },
      shipping_address_collection: hasPhysical ? { allowed_countries: zones.flatMap((z2) => z2.countries) } : void 0,
      payment_intent_data: {
        metadata: {
          items: JSON.stringify(items.map((i) => ({ variantId: i.variantId, sku: i.sku, qty: i.quantity })))
        }
      }
    });
    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("[checkout]", err);
    return new Response(JSON.stringify({ error: "Errore interno del server" }), { status: 500 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
