import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  publicDir: 'public', // This is correct - 'public' directory is accessible in both dev and build
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0, // Don't inline assets as base64
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
});