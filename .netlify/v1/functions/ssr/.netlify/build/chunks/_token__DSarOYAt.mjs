import { createDirectus, staticToken, rest, readItems, updateItem } from '@directus/sdk';

const prerender = false;
const GET = async ({ params }) => {
  const { token } = params;
  if (!token) {
    return new Response("Token mancante", { status: 400 });
  }
  const directus = createDirectus(process.env.DIRECTUS_URL).with(staticToken(process.env.DIRECTUS_TOKEN)).with(rest());
  const items = await directus.request(
    readItems("order_items", {
      filter: { download_token: { _eq: token } },
      limit: 1,
      fields: ["id", "download_token", "download_count", "download_limit", "download_expires_at", "product_name", "variant_id.*", "variant_id.digital_file.*"]
    })
  );
  const orderItem = items[0];
  if (!orderItem) {
    return new Response("Token non valido", { status: 404 });
  }
  if (orderItem.download_expires_at && new Date(orderItem.download_expires_at) < /* @__PURE__ */ new Date()) {
    return new Response("Link di download scaduto", { status: 410 });
  }
  if (orderItem.download_count >= orderItem.download_limit) {
    return new Response("Limite download raggiunto", { status: 403 });
  }
  const digitalFile = orderItem.variant_id?.digital_file;
  if (!digitalFile?.id) {
    return new Response("File non trovato", { status: 404 });
  }
  await directus.request(
    updateItem("order_items", orderItem.id, {
      download_count: orderItem.download_count + 1
    })
  );
  const fileUrl = `${process.env.DIRECTUS_URL}/assets/${digitalFile.id}`;
  const fileResponse = await fetch(fileUrl, {
    headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` }
  });
  if (!fileResponse.ok) {
    return new Response("Errore nel recupero del file", { status: 502 });
  }
  const contentType = fileResponse.headers.get("content-type") ?? "application/octet-stream";
  const filename = digitalFile.filename_download ?? "download";
  return new Response(fileResponse.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
