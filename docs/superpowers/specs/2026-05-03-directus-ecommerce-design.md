# Design Spec: Directus + Astro E-commerce Template

**Data:** 2026-05-03
**Scope:** Template riutilizzabile per negozi e-commerce (fisici + digitali) con Astro, Directus, Stripe
**Basato su:** `astro-directus-starter` (template vetrina/blog)
**Repo target:** `astro-directus-ecommerce` (repo separata)

---

## Obiettivo

Creare un template starter Astro per e-commerce riutilizzabile, collegato a Directus come headless CMS/OMS e Stripe per i pagamenti. Per ogni nuovo cliente: fork del repo, modifica di `theme.css` e `.env`, collegamento a Netlify. Setup < 2 ore.

---

## Stack

| Livello | Tecnologia | Ruolo |
|---|---|---|
| CMS / OMS | Directus (self-hosted su cPanel) | Catalogo prodotti, ordini, clienti, coupon, gift card, spedizioni |
| Database | MySQL (su cPanel) | Storage dati |
| Framework | Astro (Hybrid SSG+SSR) | Pagine statiche per catalogo, SSR per account/ordini |
| Pagamenti | Stripe Checkout (hosted) | Checkout, webhook post-pagamento |
| Stile | Tailwind CSS v4 | Utility-first, personalizzazione via CSS vars |
| Animazioni | GSAP + ScrollTrigger + Lenis | Stesse animazioni del template base |
| Deploy | Netlify | CDN, CI/CD, Serverless Functions, Edge Headers |
| Linguaggio | TypeScript | Type safety per SDK Directus e Stripe |
| i18n | Astro i18n nativo + Directus Translations | Multilingua senza librerie extra |

---

## Architettura

```
[Redattore / Admin]
        ↓
[Directus CMS su cPanel]
        ↕ webhook on publish → Netlify rebuild
        ↕ REST API / JS SDK (fetch catalogo a build time)

[Netlify Build — Astro Hybrid]
  SSG: shop index, PDP, categorie, homepage, blog, pagine CMS
  SSR: account, ordini, wishlist, profilo

[Netlify Functions]
  POST /api/checkout         → crea sessione Stripe
  POST /api/webhook/stripe   → processa eventi Stripe
  GET  /api/download/:token  → serve file digitali protetti
  POST /api/coupon/validate  → valida coupon lato server
  POST /api/giftcard/validate→ valida gift card lato server

[Stripe]
  Checkout hosted → pagamento → webhook → Netlify Function
        ↓
  Salva ordine Directus · decrementa stock · genera token download · invia email

[Utente finale]
  Catalogo SSG (CDN) → carrello localStorage → Stripe Checkout hosted → conferma
```

---

## Modalità Astro: Hybrid

```
src/pages/
├── [lang]/
│   ├── index.astro                 # SSG — homepage
│   ├── [slug].astro                # SSG — pagine CMS
│   ├── negozio/                    # SSG — catalogo
│   │   ├── index.astro
│   │   ├── [categoria]/index.astro
│   │   └── [slug].astro            # PDP prodotto
│   ├── blog/                       # SSG
│   │   ├── index.astro
│   │   └── [slug].astro
│   ├── carrello.astro              # SSG — carrello (localStorage)
│   ├── checkout/
│   │   ├── success.astro           # SSG — pagina conferma
│   │   └── cancel.astro            # SSG
│   └── account/                    # SSR — richiede auth
│       ├── index.astro             # profilo
│       ├── ordini/
│       │   ├── index.astro         # lista ordini
│       │   └── [id].astro          # dettaglio ordine
│       └── wishlist.astro
```

Le pagine `account/**` hanno `export const prerender = false`.

---

## Flusso Acquisto

```
1. Utente sfoglia catalogo (SSG)
2. Aggiunge variante al carrello (localStorage)
3. Apre carrello → applica coupon o gift card
   └─ POST /api/coupon/validate   → verifica server-side
   └─ POST /api/giftcard/validate → verifica saldo server-side
4. Click "Vai al checkout"
   └─ POST /api/checkout
      ├─ Rilegge prezzi da Directus (mai fidati dal client)
      ├─ Calcola spedizione (zona + peso prodotti)
      ├─ Applica sconto coupon/gift card
      └─ Crea sessione Stripe Checkout → redirect
5. Pagamento su Stripe hosted
6. Stripe invia webhook checkout.session.completed
   └─ POST /api/webhook/stripe
      ├─ Verifica firma STRIPE_WEBHOOK_SECRET
      ├─ Controlla idempotenza (stripe_session_id già presente?)
      ├─ Salva ordine + order_items in Directus
      ├─ Decrementa stock varianti
      ├─ Genera download_token (UUID v4) per prodotti digitali
      ├─ Aggiorna saldo gift card usata
      ├─ Incrementa coupon used_count
      └─ (opz.) Invia email di conferma
7. Utente torna su /checkout/success → mostra riepilogo
```

---

## Collezioni Directus

### products
| Campo | Tipo | Note |
|---|---|---|
| name | string | Traducibile |
| slug | string | Unico per lingua |
| description | rich text | Traducibile |
| type | enum | `physical \| digital` |
| base_price | decimal | Prezzo base |
| compare_price | decimal | Prezzo barrato (opz.) |
| images | M2M files | Gallery prodotto |
| category_id | M2O product_categories | |
| stripe_product_id | string | ID prodotto su Stripe |
| weight_g | integer | Per calcolo spedizione |
| width_mm, height_mm, depth_mm | integer | Dimensioni imballo |
| is_active | boolean | |
| featured | boolean | |
| sort_order | integer | |
| seo_title, seo_description | string | Traducibili |
| tags | M2M | |

### product_variants
| Campo | Tipo | Note |
|---|---|---|
| product_id | M2O products | |
| sku | string | Unico |
| name | string | Es. "Blu / XL" |
| option_1_name / option_1_value | string | Es. Colore / Blu |
| option_2_name / option_2_value | string | Es. Taglia / XL |
| price_override | decimal | Null = usa base_price |
| stock_quantity | integer | |
| low_stock_threshold | integer | Alert admin |
| stripe_price_id | string | ID prezzo su Stripe |
| digital_file | M2O directus_files | Solo prodotti digitali |
| download_limit | integer | Max download per acquisto |
| download_expires_hours | integer | Ore validità token |
| image_id | M2O directus_files | Immagine variante |
| is_active | boolean | |

### product_categories
| Campo | Tipo | Note |
|---|---|---|
| name | string | Traducibile |
| slug | string | |
| parent_id | M2O self | Categorie annidate |
| description | text | Traducibile |
| image | M2O directus_files | |
| sort_order | integer | |
| seo_title, seo_description | string | Traducibili |

### orders
| Campo | Tipo | Note |
|---|---|---|
| stripe_session_id | string | Unique — idempotenza |
| status | enum | `pending · paid · shipped · delivered · refunded` |
| customer_email | string | |
| customer_name | string | |
| customer_id | M2O customers | Nullable (guest) |
| subtotal | decimal | |
| discount_amount | decimal | |
| shipping_cost | decimal | |
| total | decimal | |
| coupon_id | M2O coupons | Nullable |
| gift_card_id | M2O gift_cards | Nullable |
| gift_card_amount_used | decimal | |
| shipping_address | JSON | Snapshot indirizzo |
| shipping_zone_id | M2O shipping_zones | |
| notes | text | Note interne |
| items | JSON | Snapshot leggero per email/riepilogo (order_items contiene il dettaglio completo) |

### order_items
| Campo | Tipo | Note |
|---|---|---|
| order_id | M2O orders | |
| product_name | string | Snapshot |
| variant_name | string | Snapshot |
| sku | string | Snapshot |
| unit_price | decimal | Snapshot |
| quantity | integer | |
| download_token | string | UUID v4, solo digitali |
| download_count | integer | Incrementato ad ogni download |
| download_limit | integer | Snapshot da variant |
| download_expires_at | datetime | Calcolato al momento ordine |

### coupons
| Campo | Tipo | Note |
|---|---|---|
| code | string | Unico, case-insensitive |
| type | enum | `percent \| fixed` |
| value | decimal | % o importo fisso |
| min_order_amount | decimal | Ordine minimo |
| max_uses | integer | Null = illimitato |
| used_count | integer | |
| expires_at | datetime | |
| stripe_coupon_id | string | Sincronizzato con Stripe |
| is_active | boolean | |
| description | string | Traducibile (opz.) |

### gift_cards
| Campo | Tipo | Note |
|---|---|---|
| code | string | UUID, unico |
| initial_value | decimal | |
| remaining_value | decimal | |
| purchased_by | M2O customers | Nullable — gift card venduta come guest o da account |
| order_id | M2O orders | Ordine di acquisto |
| expires_at | datetime | Nullable |
| is_active | boolean | |
| redemptions | JSON | Log utilizzi [{date, amount, order_id}] |

### shipping_zones
| Campo | Tipo | Note |
|---|---|---|
| name | string | Es. "Italia", "Europa" |
| countries | JSON | Array codici ISO (es. ["IT"]) |
| base_rate | decimal | Costo fisso spedizione |
| free_shipping_threshold | decimal | Null = mai gratuita |
| rate_per_kg | decimal | Costo per kg aggiuntivo |
| max_weight_g | integer | Peso massimo spedibile |
| is_active | boolean | |

### customers
| Campo | Tipo | Note |
|---|---|---|
| directus_user_id | M2O directus_users | |
| first_name, last_name | string | |
| phone | string | |
| default_shipping_address | JSON | |
| stripe_customer_id | string | |
| total_orders | integer | Calcolato |
| total_spent | decimal | Calcolato |

### Ereditate dal template base
`pages · posts · categories (blog) · portfolio · faq · site_settings`

---

## Multilingua (i18n)

### Configurazione Astro
```js
// astro.config.mjs
i18n: {
  defaultLocale: 'it',
  locales: ['it', 'en'],
  routing: { prefixDefaultLocale: false }
}
```

### URL structure
```
/negozio/[slug]          ← italiano (default, senza prefisso)
/en/shop/[slug]          ← inglese
/blog/[slug]
/en/blog/[slug]
```

### Directus Translations
Ogni collezione traducibile ha una sub-collezione `_translations`:
- `products_translations` (name, description, seo_title, seo_description)
- `product_categories_translations` (name, description, seo)
- `pages_translations` (title, blocks, seo)
- `posts_translations` (title, content, seo)
- `site_settings_translations` (nav_links, footer_text)
- `faq_translations` (question, answer)

Query SDK: `fields: ['*', { translations: ['*'] }]` → il componente filtra per `languages_code`.

### Language switcher
Header: link alla stessa pagina nella lingua alternativa. Slug per lingua gestito tramite campo `slug` nella rispettiva `_translations`.

---

## Sicurezza

### Stripe Webhook
- Verifica firma con `stripe.webhooks.constructEvent()` e `STRIPE_WEBHOOK_SECRET`
- Idempotenza: controlla `stripe_session_id` duplicati prima di salvare
- Risposta 200 entro 5s — elaborazione asincrona se necessario

### Download digitali
- Token UUID v4 generato **solo** dopo `checkout.session.completed`
- File serviti esclusivamente tramite `/api/download/:token` — mai URL diretto Directus
- Scadenza e limite download configurabili per prodotto
- Token monouso opzionale

### Netlify Functions
- Validazione input con `zod` su ogni endpoint
- **Prezzi riletti da Directus lato server** — il client non invia mai prezzi
- Coupon e gift card validati server-side
- CORS: solo origin del frontend in produzione (`ALLOWED_ORIGIN` env var)
- Rate limiting tramite Netlify Edge Headers

### Directus Permissions
| Ruolo | Accesso |
|---|---|
| Public | Read su products, product_variants, product_categories, pages, posts, faq, site_settings (solo campi is_active=true) |
| Customer | Read/Update sui propri ordini e profilo. Read su products. |
| Admin | Accesso completo. IP whitelist via cPanel. |

- `ACCESS_TOKEN_TTL=15m`, refresh token con scadenza 7 giorni
- Nessun accesso pubblico a orders, customers, gift_cards, coupons (solo via Function autenticata)

### HTTP Security Headers (netlify.toml)
```toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; script-src 'self' js.stripe.com; frame-src js.stripe.com; connect-src 'self' api.stripe.com"
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
```

---

## Pagine e Componenti

### Pagine SSG (catalogo)
| Rotta | Contenuto |
|---|---|
| `/negozio` | Lista prodotti con filtri categoria, ordinamento, ricerca |
| `/negozio/[categoria]` | Prodotti filtrati per categoria |
| `/negozio/[slug]` | PDP: gallery, varianti, selettore opzioni, add to cart, related |
| `/carrello` | Lista item, coupon/gift card input, riepilogo costi, bottone checkout |
| `/checkout/success` | Conferma ordine — riceve `?session_id=` da Stripe, fetch ordine da Directus client-side, link download (se digitali) |
| `/checkout/cancel` | Annullamento, torna al carrello |

### Pagine SSR (account)
| Rotta | Contenuto |
|---|---|
| `/account` | Profilo, dati spedizione default |
| `/account/ordini` | Lista ordini con stato |
| `/account/ordini/[id]` | Dettaglio ordine, tracking, re-download digitali |
| `/account/wishlist` | Prodotti salvati |

### Componenti nuovi (blocks e-commerce)
- `ProductGrid.astro` — griglia prodotti con filtri
- `ProductCard.astro` — card con immagine, prezzo, badge (nuovo/esaurito)
- `ProductGallery.astro` — gallery con zoom
- `VariantSelector.astro` — selettore opzioni (colore/taglia)
- `AddToCart.astro` — bottone + quantità (island, client:load)
- `CartDrawer.astro` — carrello laterale (island, client:load)
- `CartSummary.astro` — riepilogo prezzi + coupon/gift card input
- `CheckoutButton.astro` — chiama /api/checkout
- `LanguageSwitcher.astro` — link lingua alternativa

### Componenti UI riutilizzati dal template base
`Button · Card · Badge · Header · Footer · Nav`

---

## Variabili d'Ambiente

```bash
# Directus
DIRECTUS_URL=https://cms.tuodominio.it
DIRECTUS_TOKEN=xxxxx

# Stripe
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# App
PUBLIC_SITE_URL=https://tuodominio.it
ALLOWED_ORIGIN=https://tuodominio.it
DEFAULT_LOCALE=it

# Email (opzionale)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

---

## Personalizzazione per Nuovo Cliente

1. Fork repo → `gh repo create nome-cliente --template simone-bernazzi/astro-directus-ecommerce`
2. `cp .env.example .env` → inserire variabili Directus + Stripe
3. Modificare `src/styles/theme.css` (colori, font, animation-style)
4. Configurare lingue in `astro.config.mjs` (aggiungere/rimuovere locales)
5. Creare collezioni Directus tramite script `setup-collections.mjs`
6. Collegare repo a Netlify → deploy
7. Configurare webhook Stripe → URL Netlify Function
8. Configurare Build Hook Directus → Netlify

---

## Fuori Scope (questa fase)

- Abbonamenti / pagamenti ricorrenti (Stripe Subscriptions)
- Marketplace multi-venditore
- Integrazione corrieri (BRT, SDA API) — il calcolo spedizione è peso-based
- Ricerca full-text avanzata (Algolia, Meilisearch)
- Programma fedeltà / punti
- Recensioni prodotti
- Wishlist condivisibile
- Pagamento rateale (Klarna, Scalapay)
