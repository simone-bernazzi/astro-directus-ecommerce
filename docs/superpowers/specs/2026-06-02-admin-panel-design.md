# Admin Panel Design

## Goal

Build a custom Astro-based admin panel for managing all e-commerce data (contacts, orders, products, coupons, gift cards, shipping, forms, pages, articles) — served from the same repo under `/admin/*`, accessible on a separate subdomain. Replaces direct use of Directus admin UI for day-to-day operations.

## Architecture

Same Astro repo (`output: server`), same server, new subdomain (`admin.otticamarangon.it`). All data fetched server-side via Directus REST API using a staff JWT token stored in an `httpOnly` cookie. No Directus credentials exposed to the browser.

An Astro middleware guards all `/admin/*` routes, redirecting unauthenticated requests to `/admin/login`.

## Tech Stack

- Astro SSR (existing repo)
- Preact islands for interactive components (dynamic block modal, color picker, rich text editor)
- Tiptap for rich text editing (articles)
- Directus REST API (`/items/*`, `/fields/*`, `/auth/login`)
- CSS custom properties for theming (2 brand colors stored in `site_settings`)

## UX / UI Decisions

| Decision | Choice |
|---|---|
| Navigation | Sidebar con icone line, espandibile al click per mostrare le label |
| Tema default | Bianco/minimal, sfondo `#f9fafb`, sidebar `#fff` con bordo |
| Colori brand | 2 colori personalizzabili in Impostazioni, salvati in `site_settings` come CSS custom properties (`--color-primary`, `--color-accent`) |
| Lista records | Tabella con scroll orizzontale per colonne extra |
| Dettaglio contatto | Sezioni impilate scroll verticale: KPI → anagrafica → ordini → note CRM → task → docs |
| Editor pagine | Metadata a sinistra + lista blocchi a destra + modale dinamica per editing |
| Editor articoli | Form standard: titolo + rich text + cover + SEO |

## Routes

| Route | Layout | Note |
|---|---|---|
| `/admin/login` | Form standalone | POST `/auth/login` Directus |
| `/admin` | Dashboard KPI + Grafici | Fatturato, ordini aperti, nuovi lead, submissions recenti. Grafici: fatturato mensile (line chart), ordini per stato (donut), prodotti più venduti (bar). Pulsante export statistiche (JSON). |
| `/admin/contacts` | Tabella | Colonne: nome, email, tipo, pipeline, ultimo ordine. Pulsante export CSV/JSON. |
| `/admin/contacts/[id]` | Sezioni impilate | KPI → anagrafica → ordini → note CRM → task → docs |
| `/admin/orders` | Tabella | Colonne: #, contatto, totale, stato, data, canale. Pulsante export CSV/JSON. |
| `/admin/orders/[id]` | Sezioni impilate | Info ordine → items → spedizione → pagamento |
| `/admin/products` | Tabella | Colonne: nome, SKU, prezzo, stock, categoria, stato |
| `/admin/products/categories` | Tabella | Colonne: nome, slug, categoria padre, n. prodotti |
| `/admin/products/categories/[id]` | Form | Nome, slug, descrizione, immagine, parent dropdown |
| `/admin/products/[id]` | Form + sezione varianti | Form prodotto + tabella varianti inline |
| `/admin/products/[id]/variants/[vid]` | Form | SKU, attributi (taglia/colore), prezzo, stock, immagine |
| `/admin/coupons` | Tabella | Colonne: codice, tipo, valore, scadenza, utilizzi, stato |
| `/admin/coupons/[id]` | Form | Codice, tipo sconto, valore, scadenza, limite utilizzi, stato |
| `/admin/gift-cards` | Tabella | Colonne: codice, valore iniziale, saldo residuo, scadenza, stato |
| `/admin/gift-cards/[id]` | Form + storico | Codice, valore, saldo, scadenza, contatto assegnato + storico utilizzi |
| `/admin/shipping` | Tabella | Colonne: nome zona, paesi, corriere, n. tariffe |
| `/admin/shipping/[id]` | Form | Nome zona, dropdown multiplo paesi, corriere, tariffe per fascia peso/importo |
| `/admin/forms` | Tabella | Colonne: nome form, n. campi, n. submissions, data creazione |
| `/admin/forms/[id]` | Info + tabella submissions | Configurazione form + submissions collegate |
| `/admin/forms/[id]/submissions/[sid]` | Read-only | Dati submission, data, IP |
| `/admin/contact-submissions` | Tabella | Submissions filtrate per `form.slug = 'contact'`. Colonne: nome, email, messaggio (troncato), data, stato letto/non letto |
| `/admin/contact-submissions/[id]` | Read-only + azione | Dati submission + pulsante "Converti in contatto CRM" |
| `/admin/pages` | Tabella | Colonne: titolo, slug, stato, data modifica |
| `/admin/pages/[id]` | Metadata + blocchi | Colonna sinistra: slug/SEO/stato. Colonna destra: lista blocchi riordinabili + modale dinamica |
| `/admin/articles` | Tabella | Colonne: titolo, autore, stato, data pubblicazione |
| `/admin/articles/[id]` | Form | Titolo, body (Tiptap), cover, SEO title/description, stato |
| `/admin/settings` | Form | Color picker primary/accent, dati negozio, info generali |

## Key Components

### `AdminLayout.astro`
Shell comune a tutte le pagine admin. Sidebar con icone line, espandibile al click (stato salvato in `localStorage`). Carica `--color-primary` e `--color-accent` da `site_settings` come CSS custom properties inline nello `<head>`.

### `DataTable.astro`
Tabella generica con scroll orizzontale. Accetta: array di colonne (label + campo + formatter opzionale), array di record, link per il dettaglio. Paginazione server-side via query param `?page=`.

### `StackedDetail.astro`
Layout sezioni impilate per le pagine di dettaglio. Accetta sezioni come slot con titolo e contenuto. Header fisso con nome record, badge stato e pulsante Modifica.

### `BlockEditor` (Preact island)
Lista blocchi drag-to-reorder (`@dnd-kit/sortable`) per le pagine. Ogni blocco ha: icona tipo, nome, pulsanti modifica/elimina. Pulsante "Aggiungi sezione" apre selezione tipo blocco disponibile. Salva ordine via `PATCH /items/pages/{id}`.

### `DynamicBlockModal` (Preact island)
Modale per editing di un singolo blocco. Al mount chiama `GET /fields/{block_collection}` per leggere lo schema Directus. Renderizza dinamicamente i campi in base al tipo (`input`, `textarea`, `datetime`, `file`). Salva via `PATCH /items/{block_collection}/{id}`. Questo componente si auto-aggiorna quando MCP aggiunge nuovi campi a un blocco — nessuna modifica al frontend necessaria.

### `RichTextEditor` (Preact island)
Editor Tiptap minimal per gli articoli. Features: bold, italic, link, headings (H2/H3), liste, immagini via upload Directus. Output HTML salvato nel campo body.

### `ColorSettings` (Preact island)
Due input `type="color"` per `--color-primary` e `--color-accent`. Al salvataggio: `PATCH /items/site_settings/1` con i valori hex, poi aggiorna le CSS custom properties nel DOM senza reload.

## Auth Flow

1. `GET /admin/login` → form email/password
2. `POST /auth/login` → Directus risponde con `access_token` + `refresh_token`
3. I token vengono salvati in cookie `httpOnly; Secure; SameSite=Strict`
4. Middleware Astro su tutte le route `/admin/*`:
   - Legge il cookie `access_token`
   - Se assente o scaduto, tenta refresh con `refresh_token`
   - Se refresh fallisce, redirect a `/admin/login`
5. Tutte le fetch server-side usano `Authorization: Bearer {access_token}`

## Page Builder — Flusso AI → MCP → Admin

Il workflow per creare nuove pagine con blocchi custom:

1. AI genera template HTML con le sezioni della pagina
2. MCP legge l'HTML e crea le collection Directus (`block_hero`, `block_text_image`, ecc.) con i campi necessari
3. Admin panel legge dinamicamente i blocchi disponibili da `/collections` (filtrati per prefisso `block_`)
4. `DynamicBlockModal` legge `/fields/{block_collection}` e renderizza il form — nessun hardcoding nel frontend

Il campo `blocks` in `pages` è una relazione M2M verso una junction table `pages_blocks` (creata dallo script `setup-collections.mjs`) con campi: `page_id` (M2O → pages), `block_type` (string, nome della collection Directus es. `block_hero`), `block_id` (integer, ID del record nella collection blocco), `sort` (integer, ordine di visualizzazione). La convenzione è che tutte le collection blocco hanno prefisso `block_` — create da MCP quando processa un template HTML.

## Shipping — Paesi come Dropdown

Il campo `countries` nelle zone di spedizione è attualmente un JSON array in Directus. Nel pannello admin viene gestito con un `<select multiple>` che mostra tutti i paesi (lista ISO 3166-1 alpha-2 hardcodata nel frontend). Al salvataggio viene serializzato come array JSON via `PATCH /items/shipping_zones/{id}`. Nessuna modifica al backend.

## Converti Submission in Contatto

Da `/admin/contact-submissions/[id]`, il pulsante "Converti in contatto CRM" esegue:
1. `POST /items/contacts` con nome, email, telefono pre-compilati dalla submission
2. `PATCH /items/form_submissions/{id}` → imposta stato `converted`
3. Redirect a `/admin/contacts/{new_id}`

## Grafici (Dashboard)

Libreria: Chart.js caricata via CDN (nessuna dipendenza npm aggiuntiva). Tre grafici Preact island:

- **Line chart** — fatturato mensile ultimi 12 mesi (aggregato da `/items/orders?aggregate[sum]=total&groupBy[]=month(date_created)`)
- **Donut chart** — distribuzione ordini per stato (aggregato count per status)
- **Bar chart** — top 5 prodotti per quantità venduta (join orders → order_items → products)

I dati sono fetchati server-side e passati come props al componente Preact. Chart.js renderizza client-side.

## Export CSV / JSON

Route API: `GET /api/admin/export?collection={contacts|orders}&format={csv|json}&page=all`

- Fetch tutti i record dalla collection (senza paginazione, con `limit=-1` Directus)
- `format=csv`: converte con header da nome colonne, risponde con `Content-Disposition: attachment`
- `format=json`: risponde JSON array
- Bottone export visibile nella topbar delle pagine lista (contacts, orders)
- Export statistiche dashboard: `GET /api/admin/export?collection=stats&format=json` — ritorna i dati aggregati usati nei grafici

## Error Handling

- Errori API Directus (4xx/5xx): messaggio inline nella pagina, nessun crash
- Token scaduto durante navigazione: redirect silenzioso a login con `?redirect=` per tornare dopo il login
- Campi obbligatori mancanti nei form: validazione client-side con HTML5 `required` + validazione server-side nell'action Astro

## Testing

- Smoke test manuale per ogni route dopo l'implementazione
- Test critici: login/logout, protezione middleware, salvataggio form, DynamicBlockModal con schema reale
- I form usano Astro actions (`src/pages/admin/api/*`) testabili in isolamento con fetch dirette
