// Gemeinsame Erscheinungs- und Beschriftungsdaten für die Astra-Domain.
// Wird sowohl von AstraVisual.jsx (3D-Quizkörper) als auch vom
// SolarSystemExplorer.jsx (2D-Sonnensystemkarte) genutzt, damit Farben, Labels
// und Texturzuordnung nur an EINER Stelle gepflegt werden (kein Drift).

// Kategorie-/Attribut-Labels kamen frueher als eigene Tabelle hier — die
// ueberschnitt sich mit denen in conceptLabels.js (gleiche Keys, teils
// abweichende Texte: Drift-Gefahr). Jetzt EINE Quelle: conceptLabels.js
// (dort vollstaendigste Tabelle inkl. LEAKY_SIBLINGS-System), hier nur
// re-exportiert, damit AstraVisual.jsx und SolarSystemExplorer.jsx wie
// bisher aus './astraBodies' importieren koennen (T1, 2026-07-08).
export { CATEGORY_LABELS, ATTR_LABELS } from './conceptLabels';

// Basis-Pfad + Lizenz der echten Oberflächentexturen (Solar System Scope).
export const TEX_BASE = 'assets/astra/textures/';
export const ATTRIBUTION = 'Textur: Solar System Scope · CC BY 4.0';

// Konzept-Id (ohne "astra:"-Präfix) -> echte Oberflächentextur (nur 3D).
export const TEXTURES = {
  sun: '2k_sun.jpg',
  mercury: '2k_mercury.jpg',
  venus: '2k_venus_surface.jpg',
  earth: '2k_earth_daymap.jpg',
  mars: '2k_mars.jpg',
  jupiter: '2k_jupiter.jpg',
  saturn: '2k_saturn.jpg',
  uranus: '2k_uranus.jpg',
  neptune: '2k_neptune.jpg',
  luna: '2k_moon.jpg'
};

// Grundfarben der acht Planeten (für die prozeduralen 2D-Scheiben). Die 3D-Ansicht
// nutzt für Planeten echte Texturen; die Karte zeichnet sie prozedural.
export const PLANET_COLORS = {
  mercury: 0x9b9286, venus: 0xd9b97a, earth: 0x3f7fbf, mars: 0xc1502e,
  jupiter: 0xd9b48a, saturn: 0xe3cfa3, uranus: 0xbfe3e6, neptune: 0x3b6fd6
};

// Prozedurale Farben für Körper ohne echte Textur (grob nach bekannter Erscheinung).
export const BODY_COLORS = {
  pluto: 0xc9a98a, ceres: 0x8c8378, eris: 0xd8d2c4, makemake: 0xb06a4a, haumea: 0xd9d2c8,
  phobos: 0x7a6f63, deimos: 0x8a7d6e, io: 0xe3d26b, europa: 0xd8cdb4, ganymede: 0x9a8e7e,
  callisto: 0x6f6457, titan: 0xd9923f, enceladus: 0xf2f4f6, rhea: 0xb9b4ab, mimas: 0xc8c4bc,
  triton: 0xc7b9c9, titania: 0x9c8d83, charon: 0xa8a097
};

// Sternfarben grob nach Spektraltyp (warm = K/M, weiß = A, bläulich = B).
export const STAR_COLORS = {
  sun: 0xfff2cc, sirius: 0xcdd7ff, betelgeuse: 0xff7b4d, rigel: 0xa8c4ff,
  proxima_centauri: 0xff8a5c, alpha_centauri_a: 0xfff0c4, polaris: 0xfff7e6,
  vega: 0xdfe6ff, aldebaran: 0xffb277, antares: 0xff6a45, capella: 0xfff0cc, arcturus: 0xffc27a
};

// Erscheinungs-Hinweise für das prozedurale 2D-Rendern: Gasriesen bekommen
// Wolkenbänder, Ringplaneten eine Ring-Ellipse. Werte sind CSS-Farbstrings.
export const BODY_LOOK = {
  earth:   { bands: ['#3f8f5a', '#2a6fb0', '#d8e6ef'] },
  mars:    { bands: ['#c1502e', '#9b3f24', '#e0c9a0'] },
  jupiter: { bands: ['#e8d4b0', '#b78a5a', '#d9b48a', '#9c6f44'] },
  saturn:  { bands: ['#efdcb0', '#cdb487'], ring: '#cbb68a' },
  uranus:  { bands: ['#cdeef0', '#a9d6da'], ring: '#bfe3e6' },
  neptune: { bands: ['#3b6fd6', '#2f5bb0', '#6f97e0'] }
};

// Deutscher Planetenname -> Position von der Sonne (1..8).
export const PLANET_ORDER = { merkur: 1, venus: 2, erde: 3, mars: 4, jupiter: 5, saturn: 6, uranus: 7, neptun: 8 };

/** Hex-Zahl -> CSS-#rrggbb. */
export function hexCss(hex) {
  return '#' + (hex & 0xffffff).toString(16).padStart(6, '0');
}

/**
 * Plausible Grundfarbe (CSS) für einen Körper, gestuft nach bester Quelle:
 * Planet -> Mond/Zwergplanet -> Stern -> Kategorie-Default.
 * @param {string} id   Konzept-Id ohne "astra:"-Präfix
 * @param {string} cat  Kategorie (planet|dwarf_planet|moon|star|galaxy|constant)
 */
export function bodyColorCss(id, cat) {
  const hex = PLANET_COLORS[id] ?? BODY_COLORS[id] ?? STAR_COLORS[id];
  if (hex != null) return hexCss(hex);
  if (cat === 'dwarf_planet') return hexCss(0xb8a98f);
  if (cat === 'star') return hexCss(0xfff2cc);
  if (cat === 'moon') return hexCss(0xb9b1a6);
  return hexCss(0x9b9286);
}
