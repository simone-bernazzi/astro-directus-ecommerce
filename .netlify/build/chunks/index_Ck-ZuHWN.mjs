import { c as createComponent } from './astro-component_B2VgPNJf.mjs';
import 'piccolore';
import { j as renderComponent, r as renderTemplate, m as maybeRenderHead, f as addAttribute } from './ssr-function_DN4WF_ND.mjs';
import { $ as $$Base, a as $$Header, b as $$Footer } from './Footer_DbcJooQz.mjs';
import { a as getOrdersByCustomer } from './directus_uyWA_htV.mjs';

const prerender = false;
const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Index;
  const token = Astro2.cookies.get("directus_token")?.value;
  if (!token) {
    return Astro2.redirect("/login?redirect=/account/ordini");
  }
  const customerId = Astro2.cookies.get("directus_customer_id")?.value ?? "";
  const orders = customerId ? await getOrdersByCustomer(customerId).catch(() => []) : [];
  const statusLabels = {
    pending: "In attesa",
    paid: "Pagato",
    shipped: "Spedito",
    delivered: "Consegnato",
    refunded: "Rimborsato"
  };
  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    paid: "bg-blue-100 text-blue-800",
    shipped: "bg-purple-100 text-purple-800",
    delivered: "bg-green-100 text-green-800",
    refunded: "bg-gray-100 text-gray-700"
  };
  return renderTemplate`${renderComponent($$result, "Base", $$Base, { "title": "I miei ordini" }, { "default": async ($$result2) => renderTemplate` ${renderComponent($$result2, "Header", $$Header, {})} ${maybeRenderHead()}<main class="container py-12"> <h1 class="text-3xl font-bold mb-8">I miei ordini</h1> ${orders.length === 0 ? renderTemplate`<div class="text-center py-20 text-[var(--color-muted)]"> <p class="text-lg mb-4">Nessun ordine trovato.</p> <a href="/negozio" class="text-[var(--color-brand)] hover:underline">Inizia a fare shopping →</a> </div>` : renderTemplate`<div class="space-y-4"> ${orders.map((order) => renderTemplate`<a${addAttribute(`/account/ordini/${order.id}`, "href")} class="block bg-[var(--color-surface)] rounded-lg p-5 hover:shadow-md transition-shadow border border-[var(--color-border)]"> <div class="flex items-start justify-between gap-4 flex-wrap"> <div> <p class="text-xs text-[var(--color-muted)] mb-1"> ${new Date(order.date_created).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })} </p> <p class="font-mono text-sm text-[var(--color-muted)]">#${order.id.slice(-8).toUpperCase()}</p> <p class="font-semibold mt-1">€${order.total.toFixed(2)}</p> </div> <span${addAttribute(`text-xs font-medium px-3 py-1 rounded-full ${statusColors[order.status] ?? "bg-gray-100 text-gray-700"}`, "class")}> ${statusLabels[order.status] ?? order.status} </span> </div> ${Array.isArray(order.items) && order.items.length > 0 && renderTemplate`<p class="text-sm text-[var(--color-muted)] mt-3 line-clamp-1"> ${order.items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ")} </p>`} </a>`)} </div>`} </main> ${renderComponent($$result2, "Footer", $$Footer, {})} ` })}`;
}, "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template/src/pages/account/ordini/index.astro", void 0);

const $$file = "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template/src/pages/account/ordini/index.astro";
const $$url = "/account/ordini";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
