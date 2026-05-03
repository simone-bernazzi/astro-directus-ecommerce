# Astro + Directus E-commerce Template

Template completo per e-commerce con blog, portfolio e area clienti. Stack: **Astro 6 · Tailwind CSS v4 · Directus CMS · Stripe · Netlify**.

---

## Stack

| Layer | Tecnologia |
|---|---|
| Frontend | Astro 6 (SSG + SSR per-page) |
| Stile | Tailwind CSS v4 via `@tailwindcss/vite` |
| Animazioni | GSAP + ScrollTrigger + Lenis |
| CMS | Directus (self-hosted su cPanel/VPS) |
| Pagamenti | Stripe Checkout (hosted) + Webhooks |
| Cart | nanostores + @nanostores/persistent (localStorage) |
| Validazione | Zod v3 |
| Deploy | Netlify (SSR Functions + Scheduled Functions) |
| AI | @directus/content-mcp (Claude Code integration) |

---

## Setup nuovo progetto

### 1. Crea repo dal template

```bash
gh repo create nome-cliente --template simone-bernazzi/astro-directus-ecommerce --private --clone
cd nome-cliente
```

### 2. Installa dipendenze

```bash
nvm use 22
npm install
```

### 3. Configura variabili ambiente

```bash
cp .env.example .env
```

Variabili richieste al minimo:

```env
DIRECTUS_URL=https://cms.tuodominio.it
DIRECTUS_TOKEN=your_directus_static_token
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
PUBLIC_SITE_URL=https://tuodominio.it
ALLOWED_ORIGIN=https://tuodominio.it
```

### 4. Crea le collezioni Directus

```bash
node scripts/setup-collections.mjs
```

Crea automaticamente tutte le collezioni necessarie:

**CMS base:** `pages`, `posts`, `categories`, `portfolio`, `faq`, `site_settings`

**E-commerce:** `products`, `product_categories`, `product_variants`, `shipping_zones`, `orders`, `order_items`, `customers`, `coupons`, `gift_cards`, `contact_submissions`

### 5. Personalizza il tema

Modifica **un solo file**: `src/styles/theme.css`

```css
@theme {
  --color-brand: #2563eb;
  --color-accent: #f59e0b;
  --font-heading: 'Inter', sans-serif;
}
:root {
  --animation-style: elegant; /* elegant | bold | premium | editorial */
}
```

### 6. Configura Stripe Webhook

```bash
# In sviluppo
stripe listen --forward-to localhost:4321/api/webhook/stripe

# In produzione: crea webhook su dashboard.stripe.com
# URL: https://tuodominio.it/api/webhook/stripe
# Events: checkout.session.completed
```

### 7. Deploy su Netlify

1. Netlify → New site → Import da GitHub
2. Build command: `npm run build` · Publish dir: `dist` · Node version: `22`
3. Carica tutte le variabili del `.env` nella sezione Environment variables
4. Build hook: Site settings → Build hooks → crea hook → incollalo in un Directus Flow

---

## Struttura progetto

```
src/
├── components/
│   ├── blocks/       # Hero, Features, CTA, BlogGrid, ContactForm, ...
│   ├── layout/       # Header (con cart badge), Footer
│   ├── shop/         # ProductCard, ProductGrid, VariantSelector, AddToCart, CartSummary
│   └── ui/           # Button, Card, Badge
├── layouts/          # Base.astro, Page.astro, Post.astro
├── lib/
│   ├── directus.ts   # Client Directus + helpers per ogni collezione
│   └── types.ts      # Tutti i tipi TypeScript (CMS + e-commerce)
├── pages/
│   ├── api/
│   │   ├── admin/backup.ts        # Trigger backup protetto
│   │   ├── checkout.ts            # Crea sessione Stripe
│   │   ├── coupon/validate.ts
│   │   ├── download/[token].ts    # Download prodotti digitali
│   │   ├── giftcard/validate.ts
│   │   ├── order-status.ts
│   │   ├── contact.ts             # Form contatti + reCAPTCHA
│   │   └── webhook/stripe.ts      # Gestisce eventi Stripe
│   ├── account/      # Area clienti SSR (login, ordini, dettaglio ordine)
│   ├── checkout/     # Success, Cancel
│   ├── negozio/      # Index, [categoria], [slug] PDP
│   ├── blog/
│   ├── portfolio/
│   └── contatti.astro
├── stores/
│   └── cart.ts       # nanostores: cartItems, cartCount, cartDiscount, addToCart
└── styles/
    ├── theme.css     # ← personalizza qui
    └── global.css
netlify/
└── functions/
    └── scheduled-backup.mts  # Backup automatico schedulato
scripts/
├── setup-collections.mjs     # Crea collezioni Directus
├── backup.mjs                # Backup manuale
├── restore.mjs               # Restore da backup
└── migrate.mjs               # Migrazione dominio / env
backup.config.mjs             # Configurazione backup centralizzata
```

---

## Comandi

| Comando | Azione |
|---|---|
| `npm run dev` | Dev server su `localhost:4321` |
| `npm run build` | Build produzione |
| `npm run preview` | Anteprima build locale |
| `npm run backup` | Backup giornaliero |
| `npm run backup:weekly` | Backup settimanale |
| `npm run backup:monthly` | Backup mensile |
| `npm run restore <path>` | Ripristina da backup |
| `npm run migrate checklist` | Checklist completa migrazione |

---

## Backup e Migrazione

### Backup manuale

```bash
npm run backup                        # giornaliero (default)
npm run backup:weekly                 # settimanale
npm run backup -- --dry-run          # simula senza scrivere
```

I backup vengono salvati in `./backups/` come archivi `tar.gz`.
Configura `backup.config.mjs` per cambiare retention, percorso o passare a S3.

### Backup automatico (Netlify)

Aggiorna `BACKUP_CRON` nel `.env` (es. `0 2 * * *` per ogni notte alle 2).
La Netlify Scheduled Function `scheduled-backup.mts` si attiva automaticamente.

### Restore

```bash
# Ripristina tutto
npm run restore backups/daily-2026-05-03.tar.gz

# Solo schema
npm run restore backups/daily-2026-05-03.tar.gz -- --schema-only

# Solo dati
npm run restore backups/daily-2026-05-03.tar.gz -- --data-only

# Solo una collezione
npm run restore backups/daily-2026-05-03.tar.gz -- --collection products

# Anteprima senza modifiche
npm run restore backups/daily-2026-05-03.tar.gz -- --dry-run
```

### Migrazione su nuovo server/dominio

**Metodo A — Import diretto con sostituzione dominio (consigliato):**

```bash
# 1. Sul vecchio server: crea backup
npm run backup

# 2. Sul nuovo server: applica schema
npm run restore backup.tar.gz -- --schema-only

# 3. Importa dati sostituendo il dominio al volo
npm run restore backup.tar.gz -- --data-only --remap-domain vecchio.com:nuovo.com
```

**Metodo B — Aggiorna dominio su installazione esistente:**

```bash
node scripts/migrate.mjs domain --old vecchio.com --new nuovo.com
node scripts/migrate.mjs domain --old vecchio.com --new nuovo.com --dry-run  # preview
```

**Genera nuovo .env per il nuovo ambiente:**

```bash
node scripts/migrate.mjs env --output .env.new
# Apri .env.new, aggiorna i valori, rinomina in .env
```

**Checklist completa migrazione:**

```bash
node scripts/migrate.mjs checklist
```

---

## Prodotti digitali

I prodotti con `product_type = 'digital'` ricevono automaticamente un link di download sicuro dopo il pagamento. Il link è:
- Protetto da token con scadenza configurabile
- Limitato al numero di download impostato su Directus
- Servito dal proxy `/api/download/[token]`

## Form contatti + reCAPTCHA v3

Il form contatti usa reCAPTCHA v3 (invisible, score-based). Configura:

```env
PUBLIC_RECAPTCHA_SITE_KEY=...
RECAPTCHA_SECRET_KEY=...
RECAPTCHA_MIN_SCORE=0.5   # 0.0–1.0, default 0.5
```

Le submission vengono salvate nella collezione `contact_submissions` su Directus.
Se configurato, invia anche una notifica email via SMTP (`SMTP_*` nel `.env`).

## Integrazione AI (Claude Code)

Il file `.mcp.json` configura il server MCP ufficiale di Directus per Claude Code.
Permette di interrogare e modificare i contenuti CMS direttamente dalla chat.

```bash
# In Claude Code — il server MCP si attiva automaticamente
# Richiede DIRECTUS_URL e DIRECTUS_TOKEN nel .env
```

---

> Richiede Node.js 22+. Usa `nvm use 22` se necessario.
