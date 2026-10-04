import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { renameSync } from 'node:fs';
import { join } from 'node:path';
import { buildDataAssetMap } from './scripts/lib/data_asset_hashes.mjs';
// Der Name des Meta-Tags ist der Vertrag zwischen Build und Laufzeit. Er steht
// deshalb nur an einer Stelle: dort, wo ihn die Laufzeit ausliest.
import { DATA_MAP_META_NAME } from './src/utils/dataUrl.js';

/**
 * Gibt den Katalogdateien unter `public/data/` ihren Inhaltshash in den Namen
 * und schreibt die Zuordnung als Meta-Tag in die `index.html`.
 *
 * Damit ist der Einstieg der einzige Punkt, an dem ein Release sichtbar wird:
 * Solange ein Browser die alte `index.html` hat, lädt er ausschließlich die
 * Dateien, die zu ihr gehören — Bundles wie Kataloge. Vorher trugen nur die
 * Bundles einen Hash, die Kataloge lagen unter festen Namen und wurden beim
 * Deploy überschrieben; in diesem Fenster sah alter Code neue Daten.
 *
 * Der Hash wird aus `public/data/` berechnet, weil Vite dieses Verzeichnis
 * unverändert nach `dist/` kopiert. Das Umbenennen passiert danach in `dist/`;
 * die Quelldateien bleiben unangetastet.
 *
 * Nur der Produktionsbau ist betroffen. Der Entwicklungsserver liefert
 * `public/` direkt aus, dort gibt es kein Meta-Tag und `dataUrl()` in
 * `src/utils/dataUrl.js` bleibt beim Klarnamen.
 */
function hashedDataAssets() {
  let assetMap = {};
  return {
    name: 'scientia-hashed-data-assets',
    apply: 'build',
    buildStart() {
      assetMap = buildDataAssetMap(join(import.meta.dirname, 'public', 'data'));
    },
    transformIndexHtml() {
      return [{
        tag: 'meta',
        attrs: { name: DATA_MAP_META_NAME, content: JSON.stringify(assetMap) },
        injectTo: 'head'
      }];
    },
    writeBundle() {
      // Nach dem Schreiben von dist/: Die kopierten Katalogdateien tragen noch
      // ihren Klarnamen und bekommen ihn hier gegen den gehashten getauscht.
      const distData = join(import.meta.dirname, 'dist', 'data');
      for (const [plain, hashed] of Object.entries(assetMap)) {
        try {
          renameSync(join(distData, plain), join(distData, hashed));
        } catch (error) {
          // ENOENT heißt: Die Datei kam gar nicht erst in den Build. Das ist ein
          // echter Fehler — ohne sie fehlt der Katalog im Release.
          throw new Error(`Katalogdatei ${plain} fehlt in dist/data: ${error.message}`);
        }
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), hashedDataAssets()],
  base: './',
  build: {
    // MapLibre und three.js bleiben in getrennten, erst bei Bedarf geladenen
    // Chunks. Die Größenwarnung bleibt sichtbar, wenn ein Update sie vergrößert.
    chunkSizeWarningLimit: 850,
    rollupOptions: {
      output: {
        // Bibliotheken vom App-Bundle trennen und langfristig cachebar halten.
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
    // Headless-Aufrufe dürfen weder den Standardbrowser fokussieren noch ein
    // zusätzliches Fenster öffnen. Wer die UI prüft, öffnet sie bewusst.
    open: false
  },
  // Vitest-Konfiguration
  test: {
    environment: 'jsdom',       // Browser-ähnliche DOM-Umgebung
    globals: false,              // describe/it/expect/vi werden explizit aus 'vitest' importiert
    setupFiles: './src/setupTests.js'  // Mocks für maplibre-gl, fetch, audio, db, indexedDB
  }
});
