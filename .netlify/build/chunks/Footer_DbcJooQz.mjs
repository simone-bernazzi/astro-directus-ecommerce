import { c as createComponent } from './astro-component_B2VgPNJf.mjs';
import 'piccolore';
import { l as createRenderInstruction, f as addAttribute, r as renderTemplate, n as renderHead, i as renderSlot, m as maybeRenderHead, j as renderComponent } from './ssr-function_DN4WF_ND.mjs';
import 'clsx';
import { b as getSiteSettings, c as getDirectusImageUrl } from './directus_uyWA_htV.mjs';

async function renderScript(result, id) {
  const inlined = result.inlinedScripts.get(id);
  let content = "";
  if (inlined != null) {
    if (inlined) {
      content = `<script type="module">${inlined}</script>`;
    }
  } else {
    const resolved = await result.resolve(id);
    content = `<script type="module" src="${result.userAssetsBase ? (result.base === "/" ? "" : result.base) + result.userAssetsBase : ""}${resolved}"></script>`;
  }
  return createRenderInstruction({ type: "script", id, content });
}

const $$Base = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Base;
  const settings = await getSiteSettings().catch((err) => {
    return { site_name: "Sito", logo: null, nav_links: [], social: [], footer_text: null };
  });
  const {
    title = settings.site_name,
    description = "",
    image = "",
    lang = "it"
  } = Astro2.props;
  const pageTitle = title === settings.site_name ? settings.site_name : `${title} — ${settings.site_name}`;
  return renderTemplate`<html${addAttribute(lang, "lang")}> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${description && renderTemplate`<meta name="description"${addAttribute(description, "content")}>`}<meta property="og:type" content="website"><meta property="og:url"${addAttribute(Astro2.url.href, "content")}><meta property="og:title"${addAttribute(pageTitle, "content")}><meta property="og:site_name"${addAttribute(settings.site_name, "content")}>${description && renderTemplate`<meta property="og:description"${addAttribute(description, "content")}>`}${image && renderTemplate`<meta property="og:image"${addAttribute(image, "content")}>`}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title"${addAttribute(pageTitle, "content")}>${description && renderTemplate`<meta name="twitter:description"${addAttribute(description, "content")}>`}${image && renderTemplate`<meta name="twitter:image"${addAttribute(image, "content")}>`}<title>${pageTitle}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">${renderHead()}</head> <body> ${renderSlot($$result, $$slots["default"])} ${renderScript($$result, "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template/src/layouts/Base.astro?astro&type=script&index=0&lang.ts")} </body> </html>`;
}, "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template/src/layouts/Base.astro", void 0);

const $$Nav = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Nav;
  const { links, currentPath } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<nav class="nav" aria-label="Navigazione principale"> <ul class="flex items-center gap-6 list-none m-0 p-0"> ${links.map((link) => renderTemplate`<li> <a${addAttribute(link.url, "href")}${addAttribute([
    "text-sm font-medium transition-colors duration-200 hover:text-[var(--color-brand)]",
    link.url !== "/" && currentPath.startsWith(link.url) || currentPath === link.url ? "text-[var(--color-brand)]" : "text-[var(--color-text)]"
  ], "class:list")}${addAttribute(link.url !== "/" && currentPath.startsWith(link.url) || currentPath === link.url ? "page" : void 0, "aria-current")}> ${link.label} </a> </li>`)} </ul> </nav>`;
}, "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template/src/components/layout/Nav.astro", void 0);

const $$Header = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Header;
  const settings = await getSiteSettings().catch((err) => {
    return { site_name: "Sito", logo: null, nav_links: [], social: [], footer_text: null };
  });
  const navLinks = settings.nav_links ?? [];
  const currentPath = Astro2.url.pathname;
  return renderTemplate`${maybeRenderHead()}<header class="header sticky top-0 z-50 bg-[var(--color-bg)] border-b border-[var(--color-border)]"> <div class="container flex items-center justify-between py-4"> <a href="/" class="flex items-center gap-2 font-semibold text-lg"> ${settings.logo ? renderTemplate`<img${addAttribute(getDirectusImageUrl(settings.logo.id, { height: 40 }), "src")}${addAttribute(settings.site_name, "alt")} class="h-10 w-auto">` : renderTemplate`<span>${settings.site_name}</span>`} </a> <!-- Desktop nav --> <div class="hidden md:block"> ${renderComponent($$result, "Nav", $$Nav, { "links": navLinks, "currentPath": currentPath })} </div> <!-- Cart icon --> <a href="/carrello" class="relative p-2 hover:text-[var(--color-brand)] transition-colors" aria-label="Carrello"> <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"> <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"></path> </svg> <span id="cart-badge" class="absolute -top-1 -right-1 bg-[var(--color-brand)] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center hidden">0</span> </a> <!-- Mobile hamburger --> <button id="mobile-menu-toggle" class="md:hidden flex flex-col gap-1.5 p-2 rounded focus-visible:outline-2 focus-visible:outline-[var(--color-brand)]" aria-label="Apri menu di navigazione" aria-expanded="false" aria-controls="mobile-menu"> <span class="block w-6 h-0.5 bg-[var(--color-text)] transition-all"></span> <span class="block w-6 h-0.5 bg-[var(--color-text)] transition-all"></span> <span class="block w-6 h-0.5 bg-[var(--color-text)] transition-all"></span> </button> </div> <!-- Mobile menu --> <div id="mobile-menu" class="hidden md:hidden border-t border-[var(--color-border)]"> <nav class="container py-4" aria-label="Navigazione mobile"> <ul class="flex flex-col gap-3 list-none m-0 p-0"> ${navLinks.map((link) => renderTemplate`<li> <a${addAttribute(link.url, "href")}${addAttribute([
    "block text-sm font-medium py-1 transition-colors duration-200 hover:text-[var(--color-brand)]",
    currentPath === link.url ? "text-[var(--color-brand)]" : "text-[var(--color-text)]"
  ], "class:list")}${addAttribute(currentPath === link.url ? "page" : void 0, "aria-current")}> ${link.label} </a> </li>`)} </ul> </nav> </div> </header> ${renderScript($$result, "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template/src/components/layout/Header.astro?astro&type=script&index=0&lang.ts")}`;
}, "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template/src/components/layout/Header.astro", void 0);

const $$Footer = createComponent(async ($$result, $$props, $$slots) => {
  const settings = await getSiteSettings().catch(() => ({
    site_name: "Sito",
    logo: null,
    nav_links: [],
    social: [],
    footer_text: "Tutti i diritti riservati."
  }));
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  return renderTemplate`${maybeRenderHead()}<footer class="footer border-t border-[var(--color-border)] py-8 mt-16"> <div class="container flex flex-col sm:flex-row items-center justify-between gap-4"> <p class="text-sm text-[var(--color-muted)]">
&copy; ${currentYear} ${settings.site_name}. ${settings.footer_text} </p> ${settings.social && settings.social.length > 0 && renderTemplate`<ul class="flex items-center gap-4 list-none m-0 p-0"> ${settings.social.map((item) => renderTemplate`<li> <a${addAttribute(item.url, "href")} target="_blank" rel="noopener noreferrer" class="text-sm text-[var(--color-muted)] hover:text-[var(--color-brand)] transition-colors"> ${item.platform}<span class="sr-only"> (si apre in una nuova scheda)</span> </a> </li>`)} </ul>`} </div> </footer>`;
}, "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template/src/components/layout/Footer.astro", void 0);

export { $$Base as $, $$Header as a, $$Footer as b, renderScript as r };
