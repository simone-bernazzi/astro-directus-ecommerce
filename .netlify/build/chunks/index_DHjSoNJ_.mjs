import { c as createComponent } from './astro-component_B2VgPNJf.mjs';
import 'piccolore';
import { j as renderComponent, r as renderTemplate, m as maybeRenderHead, f as addAttribute } from './ssr-function_DN4WF_ND.mjs';
import { $ as $$Base, r as renderScript, a as $$Header, b as $$Footer } from './Footer_DbcJooQz.mjs';

const prerender = false;
const $$Index = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Index;
  const token = Astro2.cookies.get("directus_token")?.value;
  if (!token) {
    return Astro2.redirect("/login?redirect=/account");
  }
  return renderTemplate`${renderComponent($$result, "Base", $$Base, { "title": "Il mio account" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "Header", $$Header, {})} ${maybeRenderHead()}<main class="container py-12"> <h1 class="text-3xl font-bold mb-8">Il mio account</h1> <div class="grid grid-cols-1 md:grid-cols-4 gap-8"> <!-- Sidebar --> <nav class="space-y-1"> ${[
    { href: "/account", label: "Profilo" },
    { href: "/account/ordini", label: "I miei ordini" },
    { href: "/account/wishlist", label: "Lista desideri" }
  ].map((link) => renderTemplate`<a${addAttribute(link.href, "href")}${addAttribute([
    "block px-4 py-2 rounded-md text-sm font-medium transition-colors",
    Astro2.url.pathname === link.href ? "bg-[var(--color-brand)] text-white" : "text-[var(--color-text)] hover:bg-[var(--color-surface)]"
  ], "class:list")}> ${link.label} </a>`)} <button id="logout-btn" class="block w-full text-left px-4 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
Esci
</button> </nav> <!-- Content --> <div class="md:col-span-3"> <div class="bg-[var(--color-surface)] rounded-lg p-6"> <h2 class="text-lg font-semibold mb-4">Dati personali</h2> <p class="text-[var(--color-muted)] text-sm">Gestisci qui i tuoi dati di profilo e l'indirizzo di spedizione predefinito.</p> <!-- Profile form to be implemented with Directus user API --> </div> </div> </div> </main> ${renderComponent($$result2, "Footer", $$Footer, {})} ` })} ${renderScript($$result, "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template/src/pages/account/index.astro?astro&type=script&index=0&lang.ts")}`;
}, "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template/src/pages/account/index.astro", void 0);

const $$file = "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template/src/pages/account/index.astro";
const $$url = "/account";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
