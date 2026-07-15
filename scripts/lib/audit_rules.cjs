// Prüfregeln des Fragen-Audits — als eigenes Modul, damit sie testbar sind.
//
// CommonJS, weil der Konsument `scripts/audit_questions.cjs` ebenfalls CJS ist
// (das Repo steht sonst auf `type: module`). Vitest importiert die Datei per
// Interop, siehe `src/__tests__/auditRules.test.js`.
//
// Beide Regeln hatten Fehlalarme, die den Audit unbrauchbar machten
// (gefunden im QA-Sweep 2026-07-16, 433 falsche Treffer):
//
//   1. `click-map`-Fragen wurden als "zu wenige Optionen" gemeldet, obwohl sie
//      legitim gar keine haben.
//   2. Die Antwort-im-Stamm-Prüfung verglich per Substring, sodass das deutsche
//      Fragewort "w-elch-es" den Treffer "Elch" auslöste.

/**
 * Fragetypen ohne Antwortoptionen.
 *
 * Bei `click-map` klickt der Spieler das Ziel direkt auf der Karte an
 * (`mapTargetId`), statt aus einer Liste zu wählen — `options: []` ist dort
 * also korrekt und kein Strukturfehler.
 */
const OPTIONLESS_TYPES = new Set(['click-map']);

/** Erwartet dieser Fragetyp überhaupt Antwortoptionen? */
function expectsOptions(type) {
  return !OPTIONLESS_TYPES.has(String(type ?? ''));
}

/**
 * Normalisierung für den Antwort-im-Stamm-Vergleich: Kleinschreibung,
 * Anführungszeichen weg, Whitespace vereinheitlicht. Umlaute bleiben erhalten,
 * weil sichtbares Deutsch echte Umlaute verwendet.
 */
const norm = s => String(s ?? '')
  .toLowerCase()
  .replace(/[„“"»«›‹']/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/** Sonderzeichen für die Verwendung in einem RegExp maskieren. */
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Steht die richtige Antwort als eigenständiges Wort im Fragetext?
 *
 * Bewusst mit Wortgrenzen statt Substring: "Elch" steckt zwar buchstäblich in
 * "welches", ist dort aber kein eigenes Wort und verrät nichts. `\b` scheidet
 * aus, weil es ASCII-basiert ist und an Umlauten falsch greift ("Länder");
 * darum Lookarounds auf Unicode-Buchstaben/Ziffern.
 *
 * Sub-Wort-Nennungen wie "Südafrika" → "Afrika" gelten damit nicht mehr als
 * Treffer. Das ist gewollt: Solche Trivialnamen sind laut Projektregel
 * akzeptiertes Allgemeinwissen und ohnehin nicht reparierbar. Eigenständige
 * Nennungen ("Hauptstadt von Luxemburg" → "Luxemburg") werden weiterhin
 * gemeldet und bleiben Fall für die menschliche Sichtung.
 *
 * Kurzantworten (<4 Zeichen) werden ignoriert — zu viele Zufallstreffer.
 */
function answerInStem(prompt, correct) {
  const nc = norm(correct);
  if (nc.length < 4) return false;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(nc)}(?![\\p{L}\\p{N}])`, 'u');
  return re.test(norm(prompt));
}

module.exports = { OPTIONLESS_TYPES, expectsOptions, norm, answerInStem };
