import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DIRECTUS_URL: 'https://cms.example.com',
      DIRECTUS_TOKEN: 'test-token',
    },
  },
});
