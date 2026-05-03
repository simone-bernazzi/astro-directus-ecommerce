import { z } from 'zod';
import { h as getGiftCardByCode } from './directus_uyWA_htV.mjs';

const prerender = false;
const BodySchema = z.object({
  code: z.string().min(1)
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
  const giftCard = await getGiftCardByCode(parsed.data.code).catch(() => null);
  if (!giftCard || !giftCard.is_active) {
    return new Response(JSON.stringify({ valid: false, error: "Gift card non trovata o non attiva" }), { status: 200 });
  }
  if (giftCard.expires_at && new Date(giftCard.expires_at) < /* @__PURE__ */ new Date()) {
    return new Response(JSON.stringify({ valid: false, error: "Gift card scaduta" }), { status: 200 });
  }
  if (giftCard.remaining_value <= 0) {
    return new Response(JSON.stringify({ valid: false, error: "Saldo gift card esaurito" }), { status: 200 });
  }
  return new Response(JSON.stringify({
    valid: true,
    id: giftCard.id,
    code: giftCard.code,
    remaining_value: giftCard.remaining_value
  }), { status: 200, headers: { "Content-Type": "application/json" } });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
