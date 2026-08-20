/**
 * Bundler-unabhängige Struktur der Wissensbereiche.
 *
 * Dieses Modul enthält nur Daten und kann deshalb sowohl von der React-Registry
 * als auch von Node-Skripten importiert werden. IDs, Reihenfolge und Kartenflag
 * haben damit genau eine Quelle; UI-Komponenten und Generatoren können an diesen
 * Feldern nicht mehr unbemerkt auseinanderlaufen.
 */
export const DOMAIN_CONFIGS = [
  { id: 'scientia', hasMap: false, hasOwnContent: false, includeInScientia: false, usesGeodb: false },
  { id: 'terra', hasMap: true, hasOwnContent: true, includeInScientia: false, usesGeodb: true },
  { id: 'astra', hasMap: false, hasOwnContent: true, includeInScientia: true, usesGeodb: false },
  { id: 'homo', hasMap: false, hasOwnContent: true, includeInScientia: true, usesGeodb: false },
  { id: 'natura', hasMap: false, hasOwnContent: true, includeInScientia: true, usesGeodb: false },
  { id: 'lingua', hasMap: false, hasOwnContent: true, includeInScientia: true, usesGeodb: false },
  { id: 'cultura', hasMap: false, hasOwnContent: true, includeInScientia: true, usesGeodb: false },
  { id: 'machina', hasMap: false, hasOwnContent: true, includeInScientia: true, usesGeodb: false },
  { id: 'historia', hasMap: false, hasOwnContent: true, includeInScientia: true, usesGeodb: false }
];

export const SCIENTIA_MIX_IDS = DOMAIN_CONFIGS
  .filter(domain => domain.includeInScientia)
  .map(domain => domain.id);
