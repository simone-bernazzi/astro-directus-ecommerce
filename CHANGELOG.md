# CHANGELOG — Astro Directus E-commerce Template

## Legenda
- `[FEAT]` Funzionalità nuova
- `[FIX]` Bug risolto
- `[REFACTOR]` Modifica interna senza impatto utente
- `[DOCS]` Documentazione
- `[BREAK]` Breaking change

---

## [Unreleased] — In lavorazione

### Funzionalità da aggiungere (backlog)

- `[ ]` **Email transazionali** — template HTML per conferma ordine, spedizione, download digitale
- `[ ]` **Notifica disponibilità** — form email "avvisami quando torna disponibile" per prodotti esauriti
- `[ ]` **Upsell / cross-sell** — sezione "Spesso acquistato insieme" con logica configurabile in Directus
- `[ ]` **Multi-currency** — visualizzazione prezzi in valuta locale via exchangerate API, checkout sempre in EUR
- `[ ]` **Account: gestione indirizzi** — rubrica indirizzi di spedizione salvati per checkout rapido
- `[ ]` **Account: reset password** — flow email con token temporaneo
- `[ ]` **Ricerca prodotti** — input search con filtri live (categoria, prezzo min/max, tipo) via Directus API
- `[ ]` **Filtri negozio avanzati** — sidebar con attributi dinamici (taglia, colore, materiale) da product_variants
- `[ ]` **Admin dashboard** — pagina protetta `/admin` con metriche ordini, top prodotti, stato backup
- `[ ]` **Internazionalizzazione shop** — slug e contenuti prodotto in IT/EN, routing `/en/shop/`
- `[ ]` **Comparazione prodotti** — seleziona fino a 3 prodotti e confronta attributi

### Funzionalità non prioritarie

- `[ ]` **Abbonamenti** — supporto `price.recurring` Stripe per prodotti con rinnovo mensile/annuale; include Stripe Customer Portal per gestione rinnovi/cancellazioni (non necessario per ordini singoli — l'area account su Directus è sufficiente)
- `[ ]` **Stripe Customer Portal** — gestione abbonamenti, cambio piano e cancellazione lato cliente; rilevante solo in abbinamento alla feature Abbonamenti
- `[ ]` **Recensioni prodotto** — form con rating a stelle, moderazione in Directus, display media voti su PDP
- `[ ]` **B2B / prezzi a listino** — ruolo cliente "wholesale" con pricing separato in Directus

### Bug aperti

- `[ ]` **`BUG-004`** `api/download/[token].ts` — il proxy scarica l'intero file in memoria prima di rispondere; su file grandi (es. video) questo può causare timeout su Netlify (limite 10 secondi)

---

## [0.6.0] — 2026-05-03

### Aggiunto
- `[FEAT]` **Wishlist** — salvataggio prodotti preferiti in localStorage via nanostores persistent:
  - `src/stores/wishlist.ts` — `WishlistItem`, `wishlistItems`, `wishlistCount`, `toggleWishlist()`, `removeFromWishlist()`, `isInWishlist()`
  - `ProductCard.astro` — pulsante cuore in overlay (top-right immagine) con due SVG outline/filled; stato sincronizzato tramite `wishlistItems.subscribe`
  - `Header.astro` — icona cuore con badge rosso reattivo linkato a `/account/wishlist`
  - `pages/account/wishlist.astro` — pagina SSG con griglia prodotti renderizzata client-side, stato vuoto, pulsante rimozione singolo e "Svuota wishlist" con confirm

---

## [0.5.0] — 2026-05-03

### Fix
- `[FIX]` **BUG-002** `CartSummary.astro` — aggiunto `stockQuantity` a `CartItem`; passato da `AddToCart` al momento dell'aggiunta; pulsante `+` disabilitato in CartSummary se `quantity >= stockQuantity`; il check server-side in `api/checkout.ts` rimane come ultima difesa
- `[FIX]` **BUG-003** `api/checkout.ts` — quando `totalCents < 50` (ordine gratuito per coupon + gift card) l'ordine viene creato direttamente su Directus (status `paid`, stock decrementato, saldo gift card aggiornato) senza passare per Stripe; redirect a `/checkout/success?order_id=<id>`; `api/order-status.ts` ora accetta anche `order_id` oltre a `session_id`; `checkout/success.astro` gestisce entrambi i parametri

---

## [0.4.0] — 2026-05-03

### Aggiunto
- `[FEAT]` **Sitemap.xml** — integrazione `@astrojs/sitemap`; generazione automatica SSG di tutti gli URL indicizzabili; `site` letto da `PUBLIC_SITE_URL` in `astro.config.mjs`
- `[FEAT]` **robots.txt** — pagina statica `src/pages/robots.txt.ts`; esclude `/account/`, `/api/`, `/checkout/`; include URL sitemap generato dinamicamente da `PUBLIC_SITE_URL`
- `[FEAT]` **Tracking spedizione** — campi `tracking_number` e `tracking_url` su collezione `orders`; blocco dedicato in `/account/ordini/[id]` con link al corriere se URL presente; aggiunto a `setup-collections.mjs`

### Fix
- `[FIX]` **BUG-001** `negozio/[slug].astro` — estratta variabile `relUrl` nel blocco related products; rimossa doppia chiamata `getDirectusImageUrl` inline

---

## [0.3.0] — 2026-05-03

### Aggiunto
- `[FEAT]` **Analytics GTM / GA4** — layer completo eventi ecommerce via `window.dataLayer`:
  - `view_item_list` al caricamento griglia prodotti
  - `select_item` al click su ProductCard
  - `view_item` al caricamento pagina prodotto (PDP)
  - `add_to_cart` dopo aggiunta al carrello
  - `remove_from_cart` alla rimozione da CartSummary
  - `view_cart` all'apertura pagina carrello
  - `begin_checkout` al click "Procedi al pagamento"
  - `purchase` dopo fetch dati ordine su pagina success
  - `apply_coupon` all'applicazione coupon valido
  - `form_submit` all'invio form contatti
  - Snippet GTM in `Base.astro` condizionale su `PUBLIC_GTM_ID`
  - Modulo `src/lib/analytics.ts` con funzioni tipizzate per tutti gli eventi
  - `PUBLIC_GTM_ID` aggiunto a `.env.example`
- `[DOCS]` Aggiunto `PUBLIC_GTM_ID` alla guida produzione PDF

---

## [0.2.0] — 2026-05-03

### Aggiunto
- `[FEAT]` **Sistema backup Directus** — CLI `scripts/backup.mjs`:
  - Export schema snapshot, settings, tutte le collezioni utente, metadati file
  - Archivio `tar.gz` con retention policy configurabile
  - Upload S3-compatible con AWS Signature v4 nativo (no external deps)
  - Configurazione centralizzata in `backup.config.mjs`
- `[FEAT]` **Restore da backup** — CLI `scripts/restore.mjs`:
  - Estrae `tar.gz`, applica schema diff, importa in batch da 50 item
  - Flag: `--dry-run`, `--schema-only`, `--data-only`, `--collection <nome>`, `--force`
  - Flag `--remap-domain old.com:new.com` per sostituzione dominio durante import
  - Conferma interattiva prima di sovrascrivere dati
- `[FEAT]` **Toolkit migrazione** — CLI `scripts/migrate.mjs`:
  - `domain --old X --new Y [--dry-run]` — sostituzione ricorsiva dominio su tutto il contenuto Directus
  - `env [--source] [--output]` — genera nuovo `.env` con checklist variabili
  - `checklist` — stampa checklist completa 7 fasi migrazione
- `[FEAT]` **Backup automatico Netlify** — `netlify/functions/scheduled-backup.mts` (Scheduled Function)
- `[FEAT]` **API backup protetta** — `src/pages/api/admin/backup.ts` con header `x-admin-key`
- `[FEAT]` **npm scripts** — `backup`, `backup:weekly`, `backup:monthly`, `restore`, `migrate`
- `[DOCS]` Guida produzione PDF `guida-produzione.pdf` con 8 sezioni, checklist e tabella `.env`
- `[DOCS]` README riscritto completamente per il template ecommerce

### Fix
- `[FIX]` `api/webhook/stripe.ts` — aggiunto guard esplicito su `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` mancanti (era `!` assertion, ora restituisce 503 con messaggio chiaro)

---

## [0.1.0] — 2026-05-03

### Aggiunto — Layer E-commerce completo

#### Tipi e dati
- `[FEAT]` `src/lib/types.ts` — tipi completi: `Product`, `ProductCategory`, `ProductVariant`, `ShippingZone`, `Coupon`, `GiftCard`, `Order`, `OrderItem`, `Customer`, `CartItem`
- `[FEAT]` `src/lib/directus.ts` — helpers: `getProducts`, `getProductBySlug`, `getProductSlugs`, `getProductCategories`, `getProductCategoryBySlug`, `getShippingZones`, `getCouponByCode`, `getGiftCardByCode`, `getOrdersByCustomer`, `getOrderById`, `getOrderBySessionId`

#### Cart e store
- `[FEAT]` `src/stores/cart.ts` — nanostores persistent: `cartItems`, `cartCount`, `cartSubtotal`, `cartWeightG`, `cartDiscount`, `appliedCoupon`, `appliedGiftCard`; funzioni: `addToCart`, `updateQuantity`, `removeFromCart`, `clearCart`

#### Componenti shop
- `[FEAT]` `ProductCard.astro` — card con immagine lazy, prezzo, badge (esaurito/digitale/in evidenza)
- `[FEAT]` `ProductGrid.astro` — griglia con filtri per categoria
- `[FEAT]` `VariantSelector.astro` — selettore opzioni/varianti, dispatches `variant-selected`
- `[FEAT]` `AddToCart.astro` — stepper quantità + pulsante, aggiunge a nanostores cart
- `[FEAT]` `CartSummary.astro` — riepilogo carrello, coupon, gift card, totali, pulsante checkout

#### Pagine
- `[FEAT]` `pages/negozio/index.astro` — lista prodotti SSG
- `[FEAT]` `pages/negozio/[categoria].astro` — prodotti per categoria SSG
- `[FEAT]` `pages/negozio/[slug].astro` — PDP con gallery, varianti, prodotti correlati
- `[FEAT]` `pages/carrello.astro` — pagina carrello SSG
- `[FEAT]` `pages/checkout/success.astro` — conferma ordine con download digitali
- `[FEAT]` `pages/checkout/cancel.astro` — pagina annullamento
- `[FEAT]` `pages/account/index.astro` — area clienti SSR con auth cookie
- `[FEAT]` `pages/account/ordini/index.astro` — lista ordini SSR
- `[FEAT]` `pages/account/ordini/[id].astro` — dettaglio ordine con link re-download

#### API routes
- `[FEAT]` `api/checkout.ts` — crea sessione Stripe, prezzi riletti da Directus, calcolo spedizione, coupon/gift card
- `[FEAT]` `api/webhook/stripe.ts` — verifica firma, crea ordine + order_items, decrementa stock, aggiorna saldo gift card
- `[FEAT]` `api/coupon/validate.ts` — verifica scadenza, max usi, importo minimo
- `[FEAT]` `api/giftcard/validate.ts` — verifica scadenza, saldo residuo
- `[FEAT]` `api/download/[token].ts` — proxy file Directus con controllo scadenza e limite download
- `[FEAT]` `api/order-status.ts` — recupero ordine per session_id
- `[FEAT]` `api/contact.ts` — validazione Zod, reCAPTCHA v3, salvataggio Directus, SMTP opzionale
- `[FEAT]` `api/admin/backup.ts` — endpoint protetto per trigger backup

#### Setup e config
- `[FEAT]` `scripts/setup-collections.mjs` — crea tutte le 16 collezioni Directus via API
- `[FEAT]` `.mcp.json` — configurazione server MCP Directus per Claude Code
- `[FEAT]` `ContactForm.astro` — form contatti con reCAPTCHA v3
- `[FEAT]` Header con cart badge che si aggiorna via nanostores subscription
- `[FEAT]` `.env.example` esteso con tutte le variabili ecommerce

#### Fix build
- `[FIX]` `astro.config.mjs` — rimosso `output: 'hybrid'` (rimosso in Astro 6), sostituito con `output: 'static'`
- `[FIX]` `astro.config.mjs` — aggiunto `rollupOptions.external: ['nodemailer']` per evitare errore bundling
- `[FIX]` `directus.ts` — aggiunto guard `DIRECTUS_URL` non configurato con errore leggibile
- `[FIX]` Tutti i `getStaticPaths()` — wrappati in try/catch con fallback `[]` per build senza Directus
- `[FIX]` `.gitignore` — aggiunto `.netlify/` per escludere artefatti build

---

## [0.0.1] — 2026-04-30

### Base template (astro-directus-starter)

- `[FEAT]` Astro 6 + Tailwind CSS v4 + GSAP + Lenis
- `[FEAT]` Directus SDK v21 con helpers per pages, posts, categories, portfolio, faq, site_settings
- `[FEAT]` Layout Base.astro con SEO/OG meta tags
- `[FEAT]` Blocchi CMS: Hero, Features, CTA, Testimonials, BlogGrid, PortfolioGrid, FaqAccordion
- `[FEAT]` Deploy Netlify con adapter v7
- `[FEAT]` i18n: IT (default) + EN con routing senza prefisso per lingua default
