import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';
import path from 'node:path';

// Every public/**/index.html is a page (run scripts/generate.mjs first; npm scripts do).
const root = path.resolve('public');
const pages = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const file = path.join(dir, entry.name);
  if (entry.isDirectory()) return pages(file);
  return entry.name === 'index.html' ? [file] : [];
});
const input = Object.fromEntries(pages(root).map((file) => [path.relative(root, path.dirname(file)) || 'home', file]));

export default defineConfig({
  // static/ (exported media) is copied as is and served at /media/….
  root: 'public', publicDir: '../static', appType: 'mpa',
  build: { outDir: '../dist', emptyOutDir: true, rollupOptions: { input } },
  server: { host: '127.0.0.1', port: Number(process.env.PORT || 8080), strictPort: true },
});
