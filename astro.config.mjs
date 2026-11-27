// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';

const readData = (name) =>
  JSON.parse(readFileSync(new URL(`./src/data/${name}.json`, import.meta.url), 'utf8'));

const tools = readData('tools').filter((t) => t.status === 'Published');
const comparisons = readData('comparisons');
const guides = readData('guides');
const categories = readData('categories');

// Every URL that has a real date behind it gets a lastmod; the rest get none.
// A lastmod Google decides it cannot trust is ignored for the whole sitemap, so
// listing and static pages are left out rather than stamped with a build date.
const lastmodByPath = new Map();
const toolDate = new Map(tools.map((t) => [t.slug, t.last_updated]));
const newest = (slugs) =>
  slugs.map((s) => toolDate.get(s)).filter(Boolean).sort().pop();

for (const t of tools) {
  for (const prefix of ['tools', 'pricing', 'alternatives']) {
    lastmodByPath.set(`/${prefix}/${t.slug}`, t.last_updated);
  }
}
for (const g of guides) {
  lastmodByPath.set(`/blog/${g.slug}`, g.date);
}
for (const c of comparisons) {
  const d = newest(c.tools ?? []);
  if (d) lastmodByPath.set(`/compare/${c.slug}`, d);
}
for (const cat of categories) {
  const d = newest(tools.filter((t) => t.category === cat.name).map((t) => t.slug));
  if (d) lastmodByPath.set(`/category/${cat.slug}`, d);
}

export default defineConfig({
  site: 'https://stackpick.net',
  integrations: [
    sitemap({
      // Exclude noindex pages and OG image endpoints from the sitemap
      filter: (page) =>
        !page.includes('/404') &&
        !page.includes('/thanks') &&
        !page.includes('/og/') &&
        // Deploy marker read by scripts/check-deploy.sh, not a page.
        !page.includes('/build-info'),
      serialize: (item) => {
        const path = new URL(item.url).pathname.replace(/\/$/, '');
        const lastmod = lastmodByPath.get(path);
        return lastmod ? { ...item, lastmod } : item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});
