# Design Spec: Directus + Astro Starter Template

**Data:** 2026-04-30  
**Scope:** Template riutilizzabile per siti vetrina + blog + landing pages  
**Fase successiva:** Template e-commerce (repo separata)

---

## Obiettivo

Creare un template starter Astro riutilizzabile collegato a Directus come headless CMS. Per ogni nuovo cliente: fork del repo, modifica di un file tema e di `.env`, collegamento a Netlify. Tempo di setup per progetto: < 1 ora.

---

## Stack

| Livello | Tecnologia | Ruolo |
|---|---|---|
| CMS | Directus (self-hosted su cPanel) | Gestione contenuti, media, utenti |
| Database | MySQL (su cPanel) | Storage contenuti |
| Framework | Astro (SSG) | Generazione HTML statico a build time |
| Stile | Tailwind CSS v4 | Utility-first, personalizzazione via CSS vars |
| Animazioni | GSAP + ScrollTrigger + Lenis | Scroll animations, smooth scroll |
| Deploy | Netlify (piano free) | CDN, CI/CD, dominio custom, SSL |
| Linguaggio | TypeScript | Type safety per Directus SDK |

---

## Architettura

```
[Redattore] → [Directus CMS su cPanel]
                      ↓ webhook on publish
              [Netlify Build (Astro SSG)]
                      ↓ fetch API Directus
              [HTML/CSS/JS statici]
                      ↓ deploy
              [Netlify CDN]
                      ↓
              [Utente finale]
```

**Directus** gira solo come API — non serve alcun Node.js runtime in produzione sul frontend. Il server cPanel ospita esclusivamente Directus + MySQL. Netlify gestisce build e delivery.

---

## Struttura del Template

```
astro-directus-starter/
├── src/
│   ├── components/
│   │   ├── blocks/          # Hero, Features, CTA, Testimonials, BlogGrid, PortfolioGrid, FaqAccordion
│   │   ├── layout/          # Header, Footer, Nav
│   │   └── ui/              # Button, Card, Badge (primitivi)
│   ├── layouts/
│   │   ├── Base.astro       # HTML shell, meta, font, GSAP init
│   │   ├── Page.astro       # Pagine statiche e landing
│   │   └── Post.astro       # Articoli blog
│   ├── pages/
│   │   ├── index.astro
│   │   ├── blog/
│   │   │   ├── index.astro
│   │   │   └── [slug].astro
│   │   ├── portfolio/
│   │   │   ├── index.astro
│   │   │   └── [slug].astro
│   │   └── [slug].astro     # Pagine dinamiche da Directus
│   ├── lib/
│   │   └── directus.ts      # Client SDK + typed query helpers
│   ├── styles/
│   │   ├── theme.css        # Unico file da modificare per ogni cliente
│   │   └── global.css
│   └── animations/
│       ├── gsap.ts          # Setup GSAP + ScrollTrigger + Lenis
│       └── presets.ts       # fadeUp, staggerIn, splitText, parallax
├── public/
├── .env.example
├── astro.config.mjs
├── tailwind.config.mjs
└── netlify.toml
```

---

## Sistema di Temi

Il file `src/styles/theme.css` contiene esclusivamente CSS custom properties. È l'unico file da modificare per ogni cliente.

```css
:root {
  /* Colori */
  --color-brand:     #2563eb;
  --color-accent:    #f59e0b;
  --color-bg:        #ffffff;
  --color-surface:   #f9fafb;
  --color-text:      #111827;
  --color-muted:     #6b7280;

  /* Tipografia */
  --font-heading:    'Inter', sans-serif;
  --font-body:       'Inter', sans-serif;

  /* Spaziatura e forma */
  --radius:          0.5rem;
  --max-width:       1200px;

  /* Stile animazioni: elegant | bold | premium | editorial */
  --animation-style: elegant;
}
```

Tailwind v4 consuma le variabili CSS nativamente — non serve configurazione aggiuntiva.

---

## Sistema di Animazioni

Quattro preset GSAP attivati dalla variabile `--animation-style`:

| Preset | Stile | Effetti principali |
|---|---|---|
| `elegant` | Luxury agency | Fade-in scroll, parallax leggero, transizioni pulite |
| `bold` | Startup/tech | Entrate elaborate, SplitText sui titoli, hover forti |
| `premium` | Portfolio creativo | Cursor custom, scroll storytelling, profondità |
| `editorial` | Magazine/blog | Micro-animazioni, tipografia in movimento, View Transitions |

Il file `src/animations/presets.ts` esporta funzioni (`fadeUp()`, `staggerIn()`, `splitTitle()`, `parallax()`) che i componenti importano. Il preset attivo viene letto dalla variabile CSS al mount.

---

## Collezioni Directus

| Collezione | Campi principali | Note |
|---|---|---|
| `pages` | title, slug, blocks (JSON), seo | `blocks` compone sezioni visive senza collezioni extra |
| `posts` | title, slug, content, cover, category, published_at | Blog |
| `categories` | name, slug | Categorie blog |
| `portfolio` | title, slug, cover, gallery, client, year, tags, description | Gallery = array immagini |
| `faq` | question, answer, category, sort_order | Ordinamento drag & drop in Directus |
| `site_settings` | site_name, logo, nav_links, social, footer_text | Singleton — una sola riga |

---

## Pipeline di Deploy

1. Il redattore pubblica un contenuto in Directus
2. Directus invia un webhook POST a Netlify Build Hook URL
3. Netlify avvia il build Astro (~60-90 secondi per siti piccoli)
4. Astro fetcha tutte le collezioni via Directus JS SDK
5. Genera HTML statico e lo deploya sulla CDN
6. Il sito aggiornato è live

**Configurazione `netlify.toml`:**
```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
```

---

## Personalizzazione per Nuovo Cliente

1. `git clone` o fork del repo
2. `cp .env.example .env` → inserire `DIRECTUS_URL` e `DIRECTUS_TOKEN`
3. Modificare `src/styles/theme.css` (colori, font, animation-style)
4. Collegare il repo a Netlify (import da GitHub/GitLab)
5. Impostare le variabili d'ambiente in Netlify dashboard
6. Creare un Build Hook in Netlify → incollare URL in Directus (Flows/Webhooks)

---

## Fuori Scope (questa fase)

- Template e-commerce (repo separata, fase successiva)
- Area riservata / autenticazione utenti
- Ricerca full-text (valutabile con Netlify Functions + Directus search)
- Internazionalizzazione (i18n)
- Commenti blog
