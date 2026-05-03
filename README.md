# Astro + Directus Starter Template

Template riutilizzabile per siti vetrina, blog e landing page. Stack: **Astro 6 SSG · Tailwind CSS v4 · GSAP + Lenis · Directus CMS · Netlify**.

---

## Nuovo sito cliente

### 1. Crea repo dal template

```bash
gh repo create nome-cliente --template simone-bernazzi/astro-directus-starter --private --clone
cd nome-cliente
```

### 2. Installa e verifica

```bash
nvm use 22
npm install
npm run build
```

### 3. Configura variabili ambiente

```bash
cp .env.example .env
# Apri .env e inserisci DIRECTUS_URL e DIRECTUS_TOKEN del cliente
```

### 4. Personalizza il tema

Modifica **un solo file**: `src/styles/theme.css`

```css
@theme {
  --color-brand: #2563eb;      /* colore principale */
  --color-accent: #f59e0b;     /* colore secondario */
  --font-heading: 'Inter', sans-serif;
  --font-body: 'Inter', sans-serif;
  /* ... */
}
:root {
  --animation-style: elegant;  /* elegant | bold | premium | editorial */
}
```

### 5. Crea le collezioni Directus

Nel pannello admin di Directus, crea le seguenti collezioni seguendo lo schema in `docs/superpowers/plans/2026-04-30-directus-astro-starter.md` (Task 4):

- `pages` — pagine con blocchi JSON
- `posts` — articoli blog
- `categories` — categorie blog
- `portfolio` — progetti portfolio
- `faq` — domande frequenti
- `site_settings` — singleton con nome sito, logo, social

### 6. Deploy su Netlify

1. Netlify → New site → Import da GitHub → seleziona la repo del cliente
2. Build command: `npm run build` · Publish dir: `dist` · Node version: `22`
3. Environment variables: `DIRECTUS_URL`, `DIRECTUS_TOKEN`
4. Build hook: Netlify → Site settings → Build hooks → crea hook → incolla URL in un Directus Flow (trigger: on publish)

---

## Struttura progetto

```
src/
├── animations/        # GSAP presets + Lenis init
├── components/
│   ├── blocks/        # Hero, Features, CTA, Testimonials, BlogGrid, PortfolioGrid, FaqAccordion
│   ├── layout/        # Header, Footer
│   └── ui/            # Button, Card, Badge
├── layouts/           # Base.astro, Page.astro, Post.astro
├── lib/               # directus.ts (client + query helpers), types.ts
├── pages/             # index, [slug], blog/, portfolio/
└── styles/            # theme.css (personalizzazione cliente), global.css
```

## Comandi utili

| Comando | Azione |
|---|---|
| `npm run dev` | Dev server su `localhost:4321` |
| `npm run build` | Build produzione in `./dist/` |
| `npm run preview` | Anteprima build locale |
| `npm test` | Esegui test Vitest |
| `npm run astro check` | Type-check TypeScript |

> Richiede Node 22+. Usa `nvm use 22` se necessario.
