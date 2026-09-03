import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// SITE_BASE_URL is set by .github/workflows/deploy-pages.yml.
// Locally it defaults to the dev server origin with no sub-path.
const site = process.env.SITE_BASE_URL ?? 'http://localhost:4321';
const base = new URL(site).pathname.replace(/\/$/, '') || '/';

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [react(), sitemap()],
});
