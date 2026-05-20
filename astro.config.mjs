// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://stackpick.net',
  integrations: [
    sitemap({
      // Exclude noindex pages and OG image endpoints from the sitemap
      filter: (page) =>
        !page.includes('/404') &&
        !page.includes('/thanks') &&
        !page.includes('/og/'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});
