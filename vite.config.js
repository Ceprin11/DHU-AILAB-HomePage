import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Fewer, larger files: opening a page used to fetch a dozen tiny files (one per icon), and the reverse proxy
        // limits how many requests one network may send at the same time.
        manualChunks(id) {
          if (id.includes('/node_modules/lucide-react/')) return 'icons';
          return undefined;
        },
        experimentalMinChunkSize: 20 * 1024,
      },
    },
  },
});
