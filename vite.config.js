import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // maplibre-gl (~800 kB) und three.js (~490 kB, lazy) sind je EINE grosse Bibliothek
    // und nicht sinnvoll weiter teilbar. Nach der Vendor-Trennung sind sie in eigenen,
    // langzeit-cachebaren Chunks isoliert -> Schwelle bewusst darueber, statt App- und
    // Vendor-Code kuenstlich zu vermischen.
    chunkSizeWarningLimit: 850,
    rollupOptions: {
      output: {
        // Grosse, eager geladene Vendor-Bibliotheken aus dem Haupt-Bundle (index)
        // in eigene, langzeit-cachebare Chunks trennen (behebt die >500-kB-Warnung).
        // WICHTIG: three.js NICHT anfassen — es wird ausschliesslich von der lazy
        // geladenen AstraVisual importiert und liegt bereits in einem eigenen
        // On-Demand-Chunk. Ein manualChunks-Eintrag wuerde es faelschlich eager machen.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('three')) return;               // lazy lassen (AstraVisual)
          if (id.includes('maplibre-gl')) return 'maplibre';
          if (id.includes('/react') || id.includes('react-dom') || id.includes('scheduler')) return 'react-vendor';
          return 'vendor';
        }
      }
    }
  },
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
