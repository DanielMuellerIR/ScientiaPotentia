import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 3000,
    open: true
  },
  // Vitest-Konfiguration
  test: {
    environment: 'jsdom',       // Browser-ähnliche DOM-Umgebung
    globals: false,              // describe/it/expect/vi werden explizit aus 'vitest' importiert
    setupFiles: './src/setupTests.js'  // Mocks für maplibre-gl, fetch, audio, db, indexedDB
  }
});
