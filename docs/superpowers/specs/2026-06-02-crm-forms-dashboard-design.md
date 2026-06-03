# Design Spec: CRM + Contact Forms + Dashboard

**Data:** 2026-06-02
**Scope:** Modulo CRM integrato, sistema Contact Forms avanzato, Dashboard Directus Insights
**Basato su:** `astro-directus-ecommerce` (template e-commerce)
**Architettura:** CRM-first — il CRM è il layer master, l'e-commerce è un canale

---

## Obiettivo

Estendere il template e-commerce con:
1. **CRM completo** — gestione contatti unificata (offline + online), pipeline commerciale, interazioni, task, KPI
2. **Contact Forms** — moduli configurabili da Directus con anti-spam avanzato, UTM tracking, filtri geografici e keyword
3. **Dashboard** — due Directus Insights separate (E-commerce e CRM) con KPI nativi e precalcolati via Flows

Il CRM funziona sia come CRM offline (vendite in negozio, clienti inseriti manualmente) che online (clienti da e-commerce). Un contatto può acquistare su entrambi i canali — il sistema traccia tutto in modo unificato.

---

## Stack

| Livello | Tecnologia | Ruolo |
|---|---|---|
| CMS / ORM | Directus (self-hosted su VPS Hetzner) | Catalogo, ordini, contatti CRM, form, KPI |
| Database | MySQL | Storage dati |
| Framework | Astro (Hybrid SSG+SSR) | Frontend + API routes |
| Adapter | `@astrojs/node` | SSR su Node.js (VPS) |
| Deploy | VPS Hetzner + PM2 | Runtime Node.js, processo gestito da `ecosystem.config.cjs` |
| Dashboard | Directus Insights (nativo) | KPI standard + pannelli su `customer_kpis` precalcolati |
| Anti-spam form | Honeypot + reCAPTCHA v3 + filtri server | Protezione multi-livello |
| Geo-filter | `ip-api.com` (default) / MaxMind GeoLite2 / Cloudflare (opzionale) | Filtro nazioni — provider selezionabile via `GEO_PROVIDER` env |

> **Nota deploy alternativo:** Netlify è supportato come opzione di deploy (sostituire `@astrojs/node` con `@astrojs/netlify`, aggiungere `netlify.toml`). Documentato in `docs/deploy-netlify.md` ma non è il default del template.

---

## Architettura

```
[CRM MASTER — Directus]
  contacts (anagrafica unificata offline+online)
  products (catalogo master + is_ecommerce flag)
  orders (unificati: channel online|offline)
  customer_kpis (KPI precalcolati da Flows)
  crm_interactions / crm_tasks / crm_tags / crm_documents
  forms / form_submissions
        ↕
  ┌─────────────────────────┬─────────────────────────┐
  │  CANALE ONLINE           │  CANALE OFFLINE          │
  │  Astro SSR + Stripe      │  Staff in Directus admin │
  │  · prodotti is_ecommerce │  · crea contatto manual  │
  │  · ordine via webhook    │  · crea ordine offline   │
  │  · Flow crea contact     │  · stesso stock          │
  └─────────────────────────┴─────────────────────────┘
        ↕
[DASHBOARD — Directus Insights]
  "E-commerce": fatturato, ordini, stock, prodotti
  "CRM": pipeline, CLV, churn, task, interazioni
```

---

## Architettura CRM-First

Il CRM non è un add-on dell'e-commerce — è il layer superiore. L'e-commerce è un canale di vendita.

- **Prodotti**: un unico catalogo master. `is_ecommerce=true` pubblica il prodotto sul sito. Lo stock è unico e decrementato ugualmente da vendite online e offline.
- **Contatti**: anagrafica unificata. Ogni persona è un `contact`, indipendentemente dal canale. `channel_type: offline | online | both`.
- **Ordini**: una sola collezione `orders` con campo `channel: online | offline`. Gli ordini online arrivano da Stripe via webhook, gli offline sono creati manualmente dallo staff.
- **KPI**: precalcolati ogni notte da un Flow Directus → salvati in `customer_kpis` → letti da Directus Insights senza logica custom nei pannelli.

---

## Collezioni Directus

### Modifiche a collezioni esistenti

#### `products` (modificata)
| Campo aggiunto | Tipo | Note |
|---|---|---|
| `is_ecommerce` | boolean | default: false — se true, pubblicato su Astro |
| `is_archived` | boolean | default: false — soft delete dal catalogo |

#### `orders` (modificata)
| Campo aggiunto | Tipo | Note |
|---|---|---|
| `channel` | enum | `online \| offline` — canale di vendita |
| `contact_id` | M2O contacts | Contatto CRM associato (nullable) |
| `staff_id` | M2O directus_users | Chi ha processato l'ordine offline (nullable) |

#### `customers` (modificata)
| Campo aggiunto | Tipo | Note |
|---|---|---|
| `contact_id` | M2O contacts | Ponte tra utente Directus online e contatto CRM |

---

### Nuove collezioni CRM

#### `contacts` ★ MASTER
| Campo | Tipo | Note |
|---|---|---|
| `first_name` | string | |
| `last_name` | string | |
| `email` | string | Unique, nullable |
| `phone` | string | Nullable |
| `date_of_birth` | date | Nullable |
| `channel_type` | enum | `offline \| online \| both` |
| `canale_prevalente` | enum | `offline \| online` |
| `pipeline_stage` | enum | `lead \| prospect \| cliente_attivo \| cliente_fidelizzato \| inattivo` |
| `customer_id` | M2O customers | Nullable — solo se ha account online |
| `default_shipping_address` | JSON | Nullable |
| `is_active` | boolean | default: true |
| `tags` | M2M crm_tags | |

#### `crm_interactions`
| Campo | Tipo | Note |
|---|---|---|
| `contact_id` | M2O contacts | |
| `type` | enum | `call \| visit \| email \| whatsapp \| note \| other` |
| `date` | datetime | |
| `subject` | string | Nullable |
| `body` | text | |
| `outcome` | string | Nullable |
| `staff_id` | M2O directus_users | |

#### `crm_tasks`
| Campo | Tipo | Note |
|---|---|---|
| `contact_id` | M2O contacts | |
| `title` | string | |
| `due_date` | datetime | |
| `status` | enum | `pending \| in_progress \| done \| cancelled` |
| `priority` | enum | `low \| medium \| high` |
| `assigned_to` | M2O directus_users | |
| `notes` | text | Nullable |

#### `crm_tags`
| Campo | Tipo | Note |
|---|---|---|
| `name` | string | |
| `color` | string | Hex color |
| `description` | string | Nullable |

#### `crm_documents`
| Campo | Tipo | Note |
|---|---|---|
| `contact_id` | M2O contacts | |
| `file_id` | M2O directus_files | |
| `label` | string | |
| `type` | enum | `preventivo \| contratto \| foto \| prescrizione \| altro` |

#### `crm_pipeline_history` (audit trail)
| Campo | Tipo | Note |
|---|---|---|
| `contact_id` | M2O contacts | |
| `from_stage` | string | |
| `to_stage` | string | |
| `date` | datetime | |
| `changed_by` | M2O directus_users | |
| `notes` | text | Nullable |

Auto-popolata da Flow ogni volta che `pipeline_stage` cambia su un contatto.

#### `customer_kpis` (popolata dai Flows)
| Campo | Tipo | Note |
|---|---|---|
| `contact_id` | M2O contacts | Unique |
| `clv` | decimal | Customer Lifetime Value |
| `churn_score` | decimal | 0–100, rischio abbandono |
| `lead_score` | decimal | 0–100, propensione all'acquisto |
| `total_spent_online` | decimal | |
| `total_spent_offline` | decimal | |
| `total_orders_online` | integer | |
| `total_orders_offline` | integer | |
| `last_purchase_at` | datetime | Nullable |
| `avg_order_value` | decimal | |
| `preferred_channel` | enum | `offline \| online` |
| `rfm_segment` | string | Champions, Loyal, At Risk, Dormant… |
| `calculated_at` | datetime | Timestamp ultimo calcolo |

---

### Nuove collezioni Contact Forms

#### `forms`
| Campo | Tipo | Default | Note |
|---|---|---|---|
| `name` | string | | Nome leggibile |
| `slug` | string | | Unique — usato come URL `/api/form/[slug]` |
| `fields` | JSON | | Array di definizioni campo (vedi schema sotto) |
| `success_message` | text | | Mostrato se redirect disabilitato |
| `redirect_enabled` | boolean | false | |
| `redirect_url` | string | | Nullable |
| `notification_email` | string | | Dove arriva la notifica admin |
| `recaptcha_enabled` | boolean | false | |
| `capture_ip` | boolean | **false** | Dato sensibile — opt-in esplicito |
| `capture_user_agent` | boolean | **false** | Dato sensibile — opt-in esplicito |
| `capture_page_url` | boolean | **true** | URL + UTM params — meno sensibile, utile per campagne |
| `honeypot_enabled` | boolean | **true** | Anti-spam base, sempre raccomandato |
| `country_filter_enabled` | boolean | false | |
| `allowed_countries` | JSON | | Array ISO codes es. `["IT","CH","DE"]` |
| `keyword_filter_enabled` | boolean | false | |
| `blocked_keywords` | JSON | | Array parole es. `["casino","viagra"]` |
| `is_active` | boolean | true | |

**Schema campo `fields` (JSON array):**
```json
[
  {
    "name": "nome",
    "label": "Il tuo nome",
    "type": "text",
    "required": true,
    "placeholder": "Mario Rossi"
  },
  {
    "name": "servizio",
    "label": "Servizio richiesto",
    "type": "select",
    "required": false,
    "options": ["Informazioni", "Preventivo", "Supporto"]
  }
]
```

Tipi campo supportati: `text · email · tel · textarea · select · checkbox · file`

#### `form_submissions`
| Campo | Tipo | Note |
|---|---|---|
| `form_id` | M2O forms | |
| `data` | JSON | Valori compilati |
| `page_url` | string | Nullable — se `capture_page_url=true`, include UTM params |
| `ip_address` | string | Nullable — solo se `capture_ip=true` |
| `user_agent` | string | Nullable — solo se `capture_user_agent=true` |
| `country_code` | string | Nullable — rilevato via `GEO_PROVIDER` (ip-api / maxmind / cloudflare) |
| `is_read` | boolean | default: false |
| `date_created` | datetime | |

---

## Directus Flows

| Flow | Trigger | Azione |
|---|---|---|
| `flow-contact-from-online-order` | Nuovo ordine `channel=online` | Cerca o crea `contact` → aggiorna `channel_type` |
| `flow-update-contact-channel` | Ordine offline su contatto online | Imposta `channel_type=both` |
| `flow-pipeline-history` | Modifica `pipeline_stage` su `contacts` | Inserisce riga in `crm_pipeline_history` |
| `flow-stock-offline-order` | Nuovo ordine offline | Decrementa `stock_quantity` su `product_variants` |
| `flow-kpi-nightly` | Schedule — ogni notte | Calcola CLV, churn, lead score, RFM per tutti i contatti → aggiorna `customer_kpis` |

### Formula CLV (base)
```
CLV = (avg_order_value × ordini_per_anno_stimati) × anni_vita_stimata_cliente
```
Configurabile per cliente — la formula può essere sostituita con una più sofisticata.

### Segmenti RFM (base)
| Segmento | Criteri |
|---|---|
| Champions | Acquisto recente + alta frequenza + alto valore |
| Loyal | Alta frequenza, valore medio |
| At Risk | Buona storia ma nessun acquisto negli ultimi 90gg |
| Dormant | Nessun acquisto da 180gg+ |

---

## Dashboard Directus Insights

### Dashboard "E-commerce"
| Pannello | Tipo | Fonte |
|---|---|---|
| Fatturato mese corrente | Metric (SUM) | `orders.total` — filter mese |
| N. ordini totali | Metric (COUNT) | `orders` |
| Breakdown online vs offline | Bar Chart | `orders` group by `channel` |
| Valore medio ordine | Metric (AVG) | `orders.total` |
| Nuovi contatti mese | Metric (COUNT) | `contacts` — filter mese |
| Vendite ultimi 30gg | Time Series | `orders` COUNT per giorno |
| Top 5 prodotti venduti | List | `order_items` COUNT group by `product_name` |
| Stock sotto soglia | Table | `product_variants` filter `stock_quantity ≤ low_stock_threshold` |

### Dashboard "CRM"
| Pannello | Tipo | Fonte |
|---|---|---|
| Contatti totali | Metric (COUNT) | `contacts` |
| CLV medio | Metric (AVG) | `customer_kpis.clv` |
| Task in scadenza oggi | Metric (COUNT) | `crm_tasks` filter `due_date=today` |
| Clienti a rischio churn | Metric (COUNT) | `customer_kpis` filter `churn_score>70` |
| Distribuzione pipeline | Bar Chart | `contacts` COUNT group by `pipeline_stage` |
| Top clienti per CLV | Table | `customer_kpis` sort by `clv DESC` join `contacts` |
| Interazioni settimana | Time Series | `crm_interactions` COUNT per giorno |
| Segmenti RFM | Table | `customer_kpis` group by `rfm_segment` |

> **Estensioni custom**: pannelli Vue.js aggiuntivi possono essere sviluppati per KPI specifici del cliente (es. mappa geografica clienti, funnel real-time). Questi sono fuori scope del template base ma documentati come estensione opzionale.

---

## Contact Forms — Componenti Astro

### File da creare

```
src/
├── lib/
│   └── forms.ts                    # getForm(slug), getForms(), tipi Form e FormField
├── components/
│   └── forms/
│       └── FormRenderer.astro      # Componente generico — <FormRenderer slug="contattaci" />
└── pages/
    └── api/
        └── form/
            └── [slug].ts           # Endpoint SSR — POST handler
```

### Pipeline server — `POST /api/form/[slug]`

1. Fetch config form da Directus (slug → fields, feature flags)
2. **Honeypot check** — campo nascosto compilato? → `200 OK` falso (silent reject)
3. **Country filter** (se enabled) — rileva paese via `GEO_PROVIDER` (ip-api.com default, MaxMind o Cloudflare opzionali) → paese non in `allowed_countries`? → `403`
4. **reCAPTCHA v3** (se enabled) — verifica token → score < 0.5? → reject
5. **Validazione Zod** — schema generato dinamicamente dai `fields` JSON, controlla required
6. **Keyword filter** (se enabled) — scan case-insensitive di tutti i valori compilati → parola in `blocked_keywords`? → `200 OK` falso (silent reject)
7. Salva `form_submission` in Directus (IP e user agent solo se rispettivi flag abilitati)
8. Invia email notifica admin — include `page_url` con UTM params se `capture_page_url=true`
9. Risposta → redirect a `redirect_url` oppure `{ success: true, message }`

### Honeypot — implementazione
Campo `<input>` nascosto via CSS (`position: absolute; left: -9999px`) aggiunto automaticamente da `FormRenderer.astro` se `honeypot_enabled=true`. Il server verifica che il campo sia vuoto. I bot lo compilano, gli umani non lo vedono. Silent reject con `200 OK` per non rivelare il meccanismo.

### Filtro geografico — implementazione

Il template supporta tre modalità di geo-detection, selezionabile via variabile d'ambiente `GEO_PROVIDER`:

**Modalità A — `ip-api.com` (default, no config)**
```typescript
// Gratuito, no API key. Limite: 45 req/min (sufficiente per form normali)
async function getCountryFromIP(ip: string): Promise<string | null> {
  const res = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`);
  const data = await res.json();
  return data.countryCode ?? null;
}
```

**Modalità B — MaxMind GeoLite2 (raccomandato per produzione, self-hosted)**
```typescript
// Database locale — zero latenza, zero rate limit, zero costi
// Richiede: npm install @maxmind/geoip2-node + download DB gratuito
// Documentato in docs/geo-filter-maxmind.md
import { WebServiceClient } from '@maxmind/geoip2-node';
```

**Modalità C — Cloudflare (se il VPS è dietro Cloudflare)**
```typescript
// Header automatico da Cloudflare — zero API call, zero latenza
const country = request.headers.get('cf-ipcountry');
```

**Logica unificata nel server:**
```typescript
const GEO_PROVIDER = process.env.GEO_PROVIDER ?? 'ip-api'; // 'ip-api' | 'maxmind' | 'cloudflare'

async function detectCountry(request: Request, clientIP: string): Promise<string | null> {
  if (GEO_PROVIDER === 'cloudflare') return request.headers.get('cf-ipcountry');
  if (GEO_PROVIDER === 'maxmind')    return getCountryMaxMind(clientIP);
  return getCountryFromIpApi(clientIP); // default
}

if (form.country_filter_enabled) {
  const country = await detectCountry(request, clientIP);
  if (country && !form.allowed_countries.includes(country)) {
    return new Response(JSON.stringify({ error: 'Not available in your region' }), { status: 403 });
  }
}
```

### Email notifica admin
Campi inclusi nell'email:
- Dati compilati dal form (tutti i campi)
- URL pagina con UTM params (se `capture_page_url=true`)
- Paese (se disponibile dal geo-provider configurato)
- IP address (solo se `capture_ip=true`)
- User agent (solo se `capture_user_agent=true`)
- Data e ora invio

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

# reCAPTCHA (opzionale — solo se usato)
RECAPTCHA_SECRET_KEY=
PUBLIC_RECAPTCHA_SITE_KEY=

# Email (opzionale)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Geo filter — scegli provider:
# 'ip-api'     → default, gratuito, no config, limite 45 req/min
# 'maxmind'    → self-hosted GeoLite2, no rate limit (vedi docs/geo-filter-maxmind.md)
# 'cloudflare' → solo se VPS è dietro Cloudflare proxy
GEO_PROVIDER=ip-api
```

---

## Sicurezza

### Contact Forms
- Honeypot sempre raccomandato (default on)
- reCAPTCHA v3 opt-in — score threshold configurabile
- IP e user agent non salvati di default (GDPR-first)
- Keyword filter e country filter: silent reject — i bot non sanno di essere bloccati
- Validazione Zod server-side su ogni submission — il client non è trusted

### CRM
- Nessun accesso pubblico alle collezioni CRM (`contacts`, `crm_*`, `customer_kpis`, `orders`) — solo ruoli autenticati
- Ruolo `staff`: accesso a `contacts`, `orders`, `crm_*` — no accesso a `directus_users`
- Ruolo `admin`: accesso completo

### Permessi Directus
| Ruolo | Accesso |
|---|---|
| Public | Read su `products` (solo `is_ecommerce=true, is_active=true`), `pages`, `posts`, `faq`, `site_settings`, `forms` (solo config — no submissions) |
| Customer | Read sui propri `orders`, `order_items`. Read su `products`. |
| Staff | CRUD su `contacts`, `orders` (offline), `crm_*`. Read su `products`, `customer_kpis`. |
| Admin | Accesso completo. |

---

## Struttura File (nuovi file da creare)

```
src/
├── lib/
│   ├── forms.ts                       # Client forms Directus
│   └── crm.ts                         # Helper query CRM (getContact, getContacts…)
├── components/
│   └── forms/
│       └── FormRenderer.astro
└── pages/
    └── api/
        └── form/
            └── [slug].ts

scripts/
└── setup-crm-collections.mjs          # Setup collezioni CRM in Directus

docs/
└── deploy-netlify.md                  # Istruzioni deploy alternativo su Netlify
```

---

## Personalizzazione per Nuovo Cliente

1. Fork repo → configura `.env`
2. Esegui `node scripts/setup-collections.mjs` → crea e-commerce collections
3. Esegui `node scripts/setup-crm-collections.mjs` → crea CRM collections
4. Configura Directus Insights → importa dashboard preset (JSON export)
5. Crea i form necessari in Directus (collezione `forms`)
6. Configura Flow `flow-kpi-nightly` con la formula CLV adatta al business

---

## Fuori Scope

- Dashboard CRM con UI custom Astro (tutto in Directus Insights)
- Invio email automatiche ai clienti (newsletter, follow-up automatici)
- Integrazione calendario/appuntamenti
- App mobile per staff
- Importazione massiva contatti (CSV) — valutabile come estensione
- Abbonamenti / pagamenti ricorrenti
