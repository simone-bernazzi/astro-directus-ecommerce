import { z } from 'zod';
import { f as getCouponByCode } from './directus_uyWA_htV.mjs';

const prerender = false;
const BodySchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().min(0)
});
const POST = async ({ request }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Richiesta non valida" }), { status: 400 });
  }
  const { code, subtotal } = parsed.data;
  const coupon = await getCouponByCode(code).catch(() => null);
  if (!coupon || !coupon.is_active) {
    return new Response(JSON.stringify({ valid: false, error: "Coupon non trovato o non attivo" }), { status: 200 });
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < /* @__PURE__ */ new Date()) {
    return new Response(JSON.stringify({ valid: false, error: "Coupon scaduto" }), { status: 200 });
  }
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    return new Response(JSON.stringify({ valid: false, error: "Coupon esaurito" }), { status: 200 });
  }
  if (coupon.min_order_amount !== null && subtotal < coupon.min_order_amount) {
    return new Response(JSON.stringify({
      valid: false,
      error: `Ordine minimo €${coupon.min_order_amount.toFixed(2)} richiesto`
    }), { status: 200 });
  }
  return new Response(JSON.stringify({
    valid: true,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value
  }), { status: 200, headers: { "Content-Type": "application/json" } });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
