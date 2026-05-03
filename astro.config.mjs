// astro.config.mjs
import { defineConfig } from 'astro/config'
import netlify from '@astrojs/netlify'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  output: 'static',
  adapter: netlify(),
  integrations: [],
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
