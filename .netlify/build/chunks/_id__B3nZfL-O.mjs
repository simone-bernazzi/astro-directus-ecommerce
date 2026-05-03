import { c as createComponent } from './astro-component_B2VgPNJf.mjs';
import 'piccolore';
import { m as maybeRenderHead, f as addAttribute, i as renderSlot, r as renderTemplate, j as renderComponent, k as Fragment } from './ssr-function_DN4WF_ND.mjs';
import { $ as $$Base, a as $$Header, b as $$Footer } from './Footer_DbcJooQz.mjs';
import 'clsx';
import { g as getOrderById } from './directus_uyWA_htV.mjs';

const $$Badge = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Badge;
  const { variant = "default", class: className } = Astro2.props;
  const variantClasses = {
    default: "bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-border)]",
    brand: "bg-[var(--color-brand)] text-white",
    accent: "bg-[var(--color-accent)] text-white"
  };
  const classes = ["inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", variantClasses[variant], className].filter(Boolean).join(" ");
  return renderTemplate`${maybeRenderHead()}<span${addAttribute(classes, "class")}>${renderSlot($$result, $$slots["default"])}</span>`;
}, "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template/src/components/ui/Badge.astro", void 0);

const prerender = false;
const $$id = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$id;
  const token = Astro2.cookies.get("directus_token")?.value;
  if (!token) {
    return Astro2.redirect(`/login?redirect=${Astro2.url.pathname}`);
  }
  const { id } = Astro2.params;
  const order = await getOrderById(id);
  if (!order) return Astro2.redirect("/account/ordini");
  const statusLabels = {
    pending: "In attesa",
    paid: "Pagato",
    shipped: "Spedito",
    delivered: "Consegnato",
    refunded: "Rimborsato"
  };
  return renderTemplate`${renderComponent($$result, "Base", $$Base, { "title": `Ordine #${order.id.slice(-8).toUpperCase()}` }, { "default": async ($$result2) => renderTemplate` ${renderComponent($$result2, "Header", $$Header, {})} ${maybeRenderHead()}<main class="container py-12 max-w-3xl"> <a href="/account/ordini" class="text-sm text-[var(--color-muted)] hover:text-[var(--color-brand)] mb-6 inline-block">
← Tutti gli ordini
</a> <div class="flex items-start justify-between gap-4 flex-wrap mb-8"> <div> <h1 class="text-2xl font-bold">Ordine #${order.id.slice(-8).toUpperCase()}</h1> <p class="text-sm text-[var(--color-muted)] mt-1"> ${new Date(order.date_created).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} </p> </div> ${renderComponent($$result2, "Badge", $$Badge, { "variant": order.status === "delivered" ? "success" : order.status === "refunded" ? "error" : "info" }, { "default": async ($$result3) => renderTemplate`${statusLabels[order.status] ?? order.status}` })} </div> <!-- Items --> <section class="bg-[var(--color-surface)] rounded-lg p-6 mb-6"> <h2 class="font-semibold mb-4">Prodotti</h2> <div class="space-y-3"> ${order.order_items.map((item) => renderTemplate`<div class="flex justify-between items-start gap-4 text-sm"> <div> <p class="font-medium">${item.product_name}</p> <p class="text-[var(--color-muted)] text-xs">${item.variant_name} — SKU: ${item.sku}</p> ${item.download_token && renderTemplate`<a${addAttribute(`/api/download/${item.download_token}`, "href")} class="inline-flex items-center gap-1 text-xs text-[var(--color-brand)] hover:underline mt-1" download> <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path> </svg>
Scarica (${item.download_count}/${item.download_limit})
</a>`} </div> <div class="text-right"> <p>€${item.unit_price.toFixed(2)} × ${item.quantity}</p> <p class="font-semibold">€${(item.unit_price * item.quantity).toFixed(2)}</p> </div> </div>`)} </div> </section> <!-- Totals --> <section class="bg-[var(--color-surface)] rounded-lg p-6 mb-6"> <h2 class="font-semibold mb-4">Riepilogo costi</h2> <div class="space-y-2 text-sm"> <div class="flex justify-between"><span class="text-[var(--color-muted)]">Subtotale</span><span>€${order.subtotal.toFixed(2)}</span></div> ${order.discount_amount > 0 && renderTemplate`<div class="flex justify-between text-green-600"><span>Sconto</span><span>-€${order.discount_amount.toFixed(2)}</span></div>`} <div class="flex justify-between"><span class="text-[var(--color-muted)]">Spedizione</span><span>€${order.shipping_cost.toFixed(2)}</span></div> <div class="flex justify-between font-bold text-base border-t border-[var(--color-border)] pt-2 mt-2"> <span>Totale</span><span>€${order.total.toFixed(2)}</span> </div> </div> </section> <!-- Shipping address --> ${order.shipping_address && renderTemplate`<section class="bg-[var(--color-surface)] rounded-lg p-6"> <h2 class="font-semibold mb-3">Indirizzo di spedizione</h2> <address class="not-italic text-sm text-[var(--color-muted)] leading-relaxed"> ${order.shipping_address.name}<br> ${order.shipping_address.line1}<br> ${order.shipping_address.line2 && renderTemplate`${renderComponent($$result2, "Fragment", Fragment, {}, { "default": async ($$result3) => renderTemplate`${order.shipping_address.line2}<br>` })}`} ${order.shipping_address.postal_code} ${order.shipping_address.city}<br> ${order.shipping_address.state} — ${order.shipping_address.country} </address> </section>`} </main> ${renderComponent($$result2, "Footer", $$Footer, {})} ` })}`;
}, "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template/src/pages/account/ordini/[id].astro", void 0);

const $$file = "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template/src/pages/account/ordini/[id].astro";
const $$url = "/account/ordini/[id]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$id,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
