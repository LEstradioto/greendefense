import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  publicDir: 'public', // This is correct - 'public' directory is accessible in both dev and build
  server: {
    // Configuration for development server
    open: true, // Automatically open browser on server start
    cors: true, // Enable CORS for all server routes
  },
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