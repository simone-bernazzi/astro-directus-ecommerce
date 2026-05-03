import { i as getOrderBySessionId } from './directus_uyWA_htV.mjs';

const prerender = false;
const GET = async ({ url }) => {
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) {
    return new Response(JSON.stringify({ error: "session_id required" }), { status: 400 });
  }
  const order = await getOrderBySessionId(sessionId).catch(() => null);
  return new Response(JSON.stringify({ order }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
