// astro.config.mjs
import { defineConfig } from 'astro/config'
import netlify from '@astrojs/netlify'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  output: 'static',
  site: process.env.PUBLIC_SITE_URL ?? 'https://tuodominio.it',
  adapter: netlify(),
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
