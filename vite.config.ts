import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ root: 'apps/web', plugins: [react()], server: { port: 5173, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:4100', changeOrigin: true } } }, build: { assetsInlineLimit: 0, outDir: 'dist', emptyOutDir: true } });
