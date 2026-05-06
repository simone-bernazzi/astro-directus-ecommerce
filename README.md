# Astro + Directus E-commerce Template

Template completo per e-commerce con blog, portfolio e area clienti. Stack: **Astro 6 · Tailwind CSS v4 · Directus CMS · Stripe · Netlify**.

---

## Funzionalità principali

| Area | Funzionalità |
|---|---|
| 🛍️ Shop | Prodotti, varianti, categorie, filtri, ricerca live |
| 🔍 Ricerca | Autocomplete dropdown (AJAX), filtri categoria/tipo/prezzo, filtri attributi variante |
| 🛒 Carrello | nanostores persistent, coupon, gift card |
| 💳 Checkout | Stripe Checkout hosted + ordini gratuiti (coupon 100%) |
| 📦 Ordini | Conferma, tracking spedizione, re-download digitali |
| ❤️ Wishlist | localStorage, badge header, pagina dedicata |
| ⚖️ Comparazione | Confronto affiancato fino a 3 prodotti (tray + modal) |
| 💱 Multi-valuta | EUR/USD/GBP/CHF display-only, tassi da frankfurter.app, checkout sempre in EUR |
| 🔔 Notifiche | Avvisami disponibilità, email spedizione, email conferma ordine |
| 👤 Account | Login/logout, reset password, rubrica indirizzi, storico ordini |
| 🔒 Admin | Dashboard metriche, alert stock, trigger backup |
| 📧 Email | Conferma ordine, spedizione, riassortimento — HTML responsive |
| 📥 Digitali | Download sicuro con token, scadenza, limite download |
| 🗺️ SEO | Sitemap.xml auto, robots.txt, OG tags, GA4 Enhanced Ecommerce |
| 💾 Backup | Script CLI + Netlify Scheduled Function + upload S3 |

---

## Stack

| Layer | Tecnologia |
|---|---|
| Frontend | Astro 6 (SSG + SSR per-page) |
| Stile | Tailwind CSS v4 via `@tailwindcss/vite` |
| Animazioni | GSAP + ScrollTrigger + Lenis |
| CMS | Directus (self-hosted su cPanel/VPS) |
| Pagamenti | Stripe Checkout (hosted) + Webhooks |
| Stato client | nanostores + @nanostores/persistent (cart, wishlist, valuta, confronto) |
| Validazione | Zod v3 |
| Email | nodemailer (SMTP) |
| Analytics | GTM + GA4 Enhanced Ecommerce via `window.dataLayer` |
| Deploy | Netlify (SSR Functions + Scheduled Functions) |
| AI | @directus/content-mcp (Claude Code integration) |

---

## Hosting Directus

Directus va installato **prima** di fare il setup del progetto Astro. Scegli una delle opzioni seguenti.

---

### Opzione A — cPanel (hosting condiviso / VPS con cPanel)

**Prerequisiti:** SSH abilitato, Node.js Selector attivo nel pannello, accesso al gestore MySQL.

#### 1. Crea database MySQL in cPanel

In cPanel → **MySQL Databases**:
- Crea database: `cpaneluser_directus`
- Crea utente: `cpaneluser_cms` con password sicura
- Aggiungi utente al database con **tutti i privilegi**

#### 2. Crea il sottodominio

In cPanel → **Subdomains**: crea `cms.tuodominio.it` puntato a una cartella dedicata (es. `~/cms.tuodominio.it`). Aggiungi record DNS A se necessario.

#### 3. Installa Directus via SSH

```bash
ssh utente@tuodominio.it
mkdir ~/cms.tuodominio.it && cd ~/cms.tuodominio.it

# Crea package.json
cat > package.json <<'EOF'
{
  "name": "directus",
  "version": "1.0.0",
  "type": "module",
  "scripts": { "start": "directus start" },
  "dependencies": { "directus": "^11.0.0" }
}
EOF

npm install
```

#### 4. Configura le variabili ambiente

```bash
cat > .env <<'EOF'
HOST=0.0.0.0
PORT=8055
PUBLIC_URL=https://cms.tuodominio.it

DB_CLIENT=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=cpaneluser_directus
DB_USER=cpaneluser_cms
DB_PASSWORD=PASSWORD_SICURA

KEY=genera-stringa-random-32-char
SECRET=genera-stringa-random-32-char

ADMIN_EMAIL=admin@tuodominio.it
ADMIN_PASSWORD=PASSWORD_ADMIN

STORAGE_LOCATIONS=local
STORAGE_LOCAL_ROOT=./uploads
EOF
```

Genera KEY e SECRET con: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (esegui due volte).

#### 5. Bootstrap e creazione admin

```bash
npx directus bootstrap
```

Crea lo schema del database e l'utente admin definiti nel `.env`.

#### 6. Crea il file di avvio per cPanel

cPanel richiede un file `.js` come entry point (non può eseguire direttamente `npm start`):

```bash
cat > server.js <<'EOF'
// server.js — wrapper per cPanel Node.js Selector
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const bin = join(__dirname, 'node_modules', '.bin', 'directus')

const proc = spawn(bin, ['start'], { stdio: 'inherit', env: process.env })
proc.on('close', code => process.exit(code ?? 0))
EOF
```

#### 7. Configura l'applicazione Node.js in cPanel

In cPanel → **Setup Node.js App** → **Create Application**:

| Campo | Valore |
|-------|--------|
| Node.js version | 20.x LTS (o superiore) |
| Application mode | Production |
| Application root | `cms.tuodominio.it` |
| Application URL | `cms.tuodominio.it` |
| Application startup file | `server.js` |

Clicca **Run NPM Install**, poi **Create** → **Restart**.

#### 8. Verifica

Apri `https://cms.tuodominio.it/admin` — dovresti vedere il login di Directus.

> **Uploads persistenti**: la cartella `uploads/` è su disco locale. In caso di migrazione server usa `scripts/backup.mjs` e `scripts/restore.mjs`.

---

### Opzione B — Railway (Docker, consigliato per semplicità)

Railway gestisce infrastruttura, scaling e certificati SSL automaticamente.

#### 1. Crea il progetto su Railway

Vai su [railway.app](https://railway.app) → **New Project**.

#### 2. Aggiungi il database PostgreSQL

**Add service** → **Database** → **PostgreSQL**.

Railway crea il DB e inietta automaticamente `DATABASE_URL` nel progetto.

#### 3. Aggiungi il servizio Directus

**Add service** → **Docker Image** → inserisci:

```
directus/directus:latest
```

#### 4. Configura le variabili ambiente

Nel tab **Variables** del servizio Directus, aggiungi:

```env
HOST=0.0.0.0
PORT=8055
PUBLIC_URL=https://nome-progetto.up.railway.app   # aggiorna dopo il deploy

DB_CLIENT=pg
DB_CONNECTION_STRING=${{Postgres.DATABASE_URL}}    # variabile Railway auto-injected

KEY=genera-stringa-random-32-char
SECRET=genera-stringa-random-32-char

ADMIN_EMAIL=admin@tuodominio.it
ADMIN_PASSWORD=PASSWORD_ADMIN

STORAGE_LOCATIONS=local
STORAGE_LOCAL_ROOT=./uploads
```

> Usa `${{NomeServizio.VARIABILE}}` per referenziare variabili di altri servizi Railway.

#### 5. Aggiungi un volume per gli uploads

Nel servizio Directus → **Volumes** → aggiungi volume montato su `/directus/uploads`. Senza questo, i file caricati si perdono ad ogni redeploy.

#### 6. Genera il dominio e aggiorna PUBLIC_URL

**Settings** → **Networking** → **Generate Domain**. Copia l'URL generato e aggiorna `PUBLIC_URL` nelle variabili.

#### 7. Deploy e verifica

Railway parte automaticamente. Dopo il primo deploy, apri `https://nome-progetto.up.railway.app/admin`.

---

### Opzione C — Render (Docker)

#### 1. Crea il database PostgreSQL

**New** → **PostgreSQL** → nota i valori di `Host`, `Database`, `Username`, `Password`.

#### 2. Crea il Web Service

**New** → **Web Service** → **Deploy an existing image** → inserisci:

```
directus/directus:latest
```

Configurazione:
| Campo | Valore |
|-------|--------|
| Port | `8055` |
| Health check path | `/server/health` |

#### 3. Configura le variabili ambiente

```env
HOST=0.0.0.0
PORT=8055
PUBLIC_URL=https://nome-servizio.onrender.com

DB_CLIENT=pg
DB_HOST=<host-db-render>
DB_PORT=5432
DB_DATABASE=<nome-db>
DB_USER=<utente-db>
DB_PASSWORD=<password-db>
DB_SSL__REJECT_UNAUTHORIZED=false

KEY=genera-stringa-random-32-char
SECRET=genera-stringa-random-32-char

ADMIN_EMAIL=admin@tuodominio.it
ADMIN_PASSWORD=PASSWORD_ADMIN

STORAGE_LOCATIONS=local
STORAGE_LOCAL_ROOT=./uploads
```

#### 4. Aggiungi disco persistente

**Disks** → aggiungi disco montato su `/directus/uploads` (minimo 1 GB).

#### 5. Deploy e verifica

Render avvia il container. Apri `https://nome-servizio.onrender.com/admin`.

> **Nota Render Free tier**: il servizio va in sleep dopo 15 minuti di inattività. Per Directus in produzione usa il piano Starter ($7/mese).

---

### Dopo l'installazione di Directus

Indipendentemente dall'opzione scelta:

1. Accedi all'admin Directus e crea un **Static Token** per l'integrazione Astro (Impostazioni → Utenti → il tuo utente admin → Token)
2. Imposta `DIRECTUS_URL` e `DIRECTUS_TOKEN` nel `.env` del progetto Astro
3. Esegui `node scripts/setup-collections.mjs` per creare le collezioni

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
ADMIN_KEY=your_random_admin_secret
```

> Il sito funziona senza Stripe (solo pagine + blog). Il checkout è disabilitato finché `STRIPE_SECRET_KEY` non è configurata.

### 4. Crea le collezioni Directus

```bash
node scripts/setup-collections.mjs
```

Crea automaticamente tutte le collezioni necessarie:

**CMS base:** `pages`, `posts`, `categories`, `portfolio`, `faq`, `site_settings`

**E-commerce:** `products`, `product_categories`, `product_variants`, `shipping_zones`, `orders`, `order_items`, `customers`, `coupons`, `gift_cards`

**Notifiche:** `contact_submissions`, `stock_notifications`

> Alcuni campi relazione (M2M immagini prodotto, collegamento customer → user Directus) richiedono un passaggio manuale dall'admin Directus — vedi output del comando.

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
│   ├── blocks/         # Hero, Features, CTA, BlogGrid, ContactForm, ...
│   ├── layout/         # Header (cart + wishlist badge + CurrencySelector), Footer, Nav
│   ├── shop/           # ProductCard, ProductGrid, VariantSelector,
│   │                   # AddToCart, CartSummary, StockNotify,
│   │                   # CompareTray (tray + modal)
│   └── ui/             # Button, Card, Badge, CurrencySelector
├── layouts/            # Base.astro, Page.astro, Post.astro
├── lib/
│   ├── directus.ts     # Client Directus + helpers (getProducts, getVariantOptions,
│   │                   # getProductsByIds — tutti usano PRODUCT_FIELDS costante)
│   ├── email.ts        # Template email HTML + sendOrderConfirmation,
│   │                   # sendShippingNotification, sendRestockNotification
│   ├── analytics.ts    # GA4 Enhanced Ecommerce via window.dataLayer
│   └── types.ts        # Tutti i tipi TypeScript (CMS + e-commerce)
├── pages/
│   ├── api/
│   │   ├── admin/
│   │   │   ├── auth.ts            # Login/logout sessione admin
│   │   │   ├── backup.ts          # Trigger backup (BACKUP_ADMIN_KEY)
│   │   │   ├── notify-shipped.ts  # Aggiorna ordine + email spedizione
│   │   │   └── notify-restock.ts  # Email riassortimento subscriber
│   │   ├── auth/
│   │   │   ├── login.ts           # Directus auth → cookie httpOnly
│   │   │   ├── logout.ts          # Revoca token + cancella cookie
│   │   │   ├── reset-request.ts   # Richiesta reset password
│   │   │   └── reset-confirm.ts   # Conferma nuova password
│   │   ├── account/
│   │   │   └── addresses.ts       # CRUD rubrica indirizzi
│   │   ├── checkout.ts            # Sessione Stripe + ordine gratuito
│   │   ├── coupon/validate.ts
│   │   ├── download/[token].ts    # Download prodotti digitali
│   │   ├── giftcard/validate.ts
│   │   ├── order-status.ts        # Lookup per session_id o order_id
│   │   ├── search.ts              # Ricerca + filtri (categoria, tipo, prezzo,
│   │   │                          # attributi variante via ?option=Nome:Valore)
│   │   ├── stock-notify.ts        # Sottoscrizione notifica disponibilità
│   │   ├── contact.ts
│   │   └── webhook/stripe.ts
│   ├── admin/
│   │   ├── index.astro            # Dashboard (SSR, protetta da ADMIN_KEY)
│   │   └── login.astro            # Login admin
│   ├── account/
│   │   ├── index.astro            # Profilo (SSR)
│   │   ├── indirizzi.astro        # Rubrica indirizzi (SSR)
│   │   ├── wishlist.astro         # Lista desideri (SSG, client-side)
│   │   ├── recupera-password.astro # Reset password (SSG, dual state)
│   │   └── ordini/                # Lista e dettaglio ordini (SSR)
│   ├── checkout/                  # Success (session_id o order_id), Cancel
│   ├── negozio/
│   │   ├── index.astro            # Griglia + autocomplete + filtri live
│   │   │                          # + filtri attributi variante + comparazione
│   │   ├── [categoria].astro      # Prodotti per categoria (SSG)
│   │   └── [slug].astro           # PDP con cross-sell + notifica stock
│   ├── login.astro
│   ├── blog/, portfolio/, contatti.astro, robots.txt.ts
│   └── ...
├── stores/
│   ├── cart.ts                    # cartItems, cartCount, addToCart, ...
│   ├── wishlist.ts                # wishlistItems, wishlistCount, toggleWishlist
│   ├── currency.ts                # selectedCurrency, applyConversion(), formatPrice()
│   └── compare.ts                 # compareItems (max 3), addToCompare, isInCompare
└── styles/
    ├── theme.css                  # ← personalizza qui
    └── global.css
netlify/
└── functions/
    └── scheduled-backup.mts      # Backup automatico schedulato
scripts/
├── setup-collections.mjs         # Crea tutte le collezioni Directus
├── backup.mjs                    # Backup manuale + S3
├── restore.mjs                   # Restore con --remap-domain
└── migrate.mjs                   # Migrazione dominio / env
backup.config.mjs
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
npm run restore backups/daily-2026-05-03.tar.gz
npm run restore backups/daily-2026-05-03.tar.gz -- --schema-only
npm run restore backups/daily-2026-05-03.tar.gz -- --collection products
npm run restore backups/daily-2026-05-03.tar.gz -- --dry-run
```

### Migrazione su nuovo server/dominio

```bash
# 1. Sul vecchio server: crea backup
npm run backup

# 2. Sul nuovo server: applica schema
npm run restore backup.tar.gz -- --schema-only

# 3. Importa dati sostituendo il dominio al volo
npm run restore backup.tar.gz -- --data-only --remap-domain vecchio.com:nuovo.com
```

---

## Email transazionali

Le email vengono inviate automaticamente via SMTP:

| Evento | Email |
|---|---|
| Ordine pagato (Stripe o gratuito) | Conferma ordine con riepilogo e link download |
| Ordine spedito | Notifica spedizione con tracking |
| Prodotto tornato disponibile | Email ai subscriber "Avvisami" |

Configura nel `.env`:

```env
SMTP_HOST=smtp.tuoprovider.it
SMTP_PORT=587
SMTP_USER=noreply@tuodominio.it
SMTP_PASS=...
SMTP_FROM=noreply@tuodominio.it
SMTP_FROM_NAME=Il mio negozio
```

---

## Admin Dashboard

Protetta da password (`ADMIN_KEY`). Accessibile su `/admin`.

Mostra: ordini totali, fatturato, ordini da processare, varianti in esaurimento, tabella ultimi 10 ordini, alert stock, pulsante backup.

Soglia alert stock configurabile: `ADMIN_LOW_STOCK_THRESHOLD=5` (default: 5 unità).

---

## Multi-valuta

Il selector EUR/USD/GBP/CHF nel header converte i prezzi visualizzati in tempo reale. I tassi vengono scaricati da [frankfurter.app](https://www.frankfurter.app/) (gratuito, nessuna API key) e cachati 1 ora in localStorage.

**Il checkout avviene sempre in EUR** — Stripe riceve sempre l'importo in euro.

Per aggiungere altre valute: modifica `CURRENCIES` in `src/stores/currency.ts` e aggiungi l'`<option>` corrispondente in `CurrencySelector.astro`.

---

## Comparazione prodotti

Dalla griglia del negozio, ogni card ha un pulsante "+ Confronta". Seleziona fino a 3 prodotti: compare una barra fissa in basso con i prodotti selezionati. Clicca "Confronta" per aprire la tabella comparativa affiancata (immagine, prezzo, categoria, tipo, disponibilità, peso).

---

## Ricerca e filtri

La pagina negozio combina:
- **Autocomplete**: dropdown AJAX con thumbnail e prezzo mentre scrivi (debounce 250ms)
- **Filtri**: categoria, tipo prodotto, fascia di prezzo
- **Filtri attributi variante**: pill multi-select per Taglia, Colore, ecc. — generati automaticamente dagli attributi `option_1/2` delle varianti nel catalogo

---

## Prodotti digitali

I prodotti con `product_type = 'digital'` ricevono automaticamente un link di download sicuro dopo il pagamento. Il link è:
- Protetto da token con scadenza configurabile (`download_expires_hours`)
- Limitato al numero di download (`download_limit`)
- Incluso nell'email di conferma ordine

### Hosting del file

Sulla variante prodotto sono disponibili due modalità:

| Campo | Comportamento |
|-------|---------------|
| `digital_file_url` (consigliato) | URL diretto (S3, CDN, Directus pubblico). Il proxy esegue un redirect 302 → zero memoria sul server. |
| `digital_file` (relazione Directus) | File caricato in Directus. Il proxy scarica e riversa il file al client. **Limite consigliato: 150 MB** — su Netlify Functions la risposta ha un timeout di 10 s e la RAM è limitata. |

Usa `digital_file_url` per file grandi o per file ospitati su servizi esterni (AWS S3, Google Cloud Storage, Bunny CDN, ecc.).

---

## Cross-sell / Upsell

Sulla PDP è presente una sezione "Spesso acquistato insieme" configurabile da Directus. Imposta il campo `cross_sell_ids` (JSON array di ID prodotto) su ogni prodotto.

---

## Notifica disponibilità

Se un prodotto è esaurito, sulla PDP compare il form "Avvisami quando torna disponibile". Per inviare le notifiche quando il prodotto torna disponibile:

```bash
curl -X POST https://tuodominio.it/api/admin/notify-restock \
  -H "x-admin-key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"product_id":"abc123"}'
```

---

## Form contatti + reCAPTCHA v3

```env
PUBLIC_RECAPTCHA_SITE_KEY=...
RECAPTCHA_SECRET_KEY=...
RECAPTCHA_MIN_SCORE=0.5
```

---

## Integrazione AI (Claude Code)

Il file `.mcp.json` configura il server MCP ufficiale di Directus per Claude Code.  
Claude Code risolve `${DIRECTUS_URL}` e `${DIRECTUS_TOKEN}` dall'**ambiente shell** al momento del lancio — non carica il `.env` in automatico.

Usa lo script incluso per avviare Claude Code con le variabili già esportate:

```bash
npm run claude          # oppure: bash scripts/claude.sh
```

Lo script fa il `source .env` e poi lancia `claude`, così il server MCP si connette a Directus senza configurazione aggiuntiva.

> **Alternativa rapida (una tantum):**
> ```bash
> set -a && source .env && set +a && claude
> ```

---

> Richiede Node.js 22+. Usa `nvm use 22` se necessario.
