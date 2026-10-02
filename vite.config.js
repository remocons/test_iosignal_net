import { defineConfig } from 'vite';
export default defineConfig({ root: 'public', publicDir: false, build: { outDir: '../dist', emptyOutDir: true }, server: { host: '127.0.0.1', port: Number(process.env.PORT || 8080), strictPort: true } });
