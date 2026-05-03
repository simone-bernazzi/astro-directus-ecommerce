// astro.config.mjs
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  output: 'static',
  integrations: [], // explicit empty array required: Astro 6 + Zod v4 bug with undefined default
  vite: {
    plugins: [tailwindcss()],
  },
})
