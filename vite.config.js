import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_PAGES === '1' ? '/trefoil/' : '/',
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
