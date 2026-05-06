// astro.config.mjs
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

// ── Adapter ──────────────────────────────────────────────
// VPS / Node.js (default): npm install @astrojs/node
import node from '@astrojs/node'
// Netlify: npm remove @astrojs/node && npm install @astrojs/netlify
// import netlify from '@astrojs/netlify'
// ─────────────────────────────────────────────────────────

export default defineConfig({
  output: 'static',
  site: process.env.PUBLIC_SITE_URL ?? 'https://tuodominio.it',
  adapter: node({ mode: 'standalone' }),
  // adapter: netlify(),  // ← Netlify
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        // nodemailer is optional — install it only if you use SMTP email
        external: ['nodemailer'],
      },
    },
  },
  i18n: {
    defaultLocale: 'it',
    locales: ['it', 'en'],
    routing: { prefixDefaultLocale: false },
  },
})
