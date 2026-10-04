/**
 * Sperrlisten-Prüfung für die Merge-Skripte.
 *
 * Hintergrund (CodeQA 2026-09-03): Nur `merge_cultura.js` befragte
 * `harvest/IMAGE_BLACKLIST.json`. `merge_astra.js`, `merge_lingua.js`,
 * `merge_natura.js` und `merge_phase5.js` reichten `imageFile`, `imageLicense`
 * und `imageAttribution` durch, ohne die Sperrliste zu kennen — obwohl gerade
 * `merge_astra` die Bildfelder bestehender Konzepte auffrischt. Ein gesperrtes
 * Werk hätte über diese vier Wege in die Quellwahrheit gelangen können.
 *
 * Downstream fangen `harvest/purge_blacklisted.cjs` und der Bildnachweis-Audit
 * (seit 2026-09-03 Teil von `npm run build`) so etwas ab. Diese Prüfung ist
 * die Verteidigung an der Quelle: Was gar nicht erst hineinkommt, muss nicht
 * wieder herausgeräumt werden.
 *
 * Die Regel ist bewusst dieselbe wie in `merge_cultura.js`: Neben der exakten
 * ID-Prüfung aus `image_resolution_policy.cjs` bleibt ein Teilstring-Vergleich
 * gegen ID und Namen, damit auch eine abgewandelte Schreibweise
 * („guernica-picasso") hängen bleibt.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const HARVEST = join(dirname(fileURLToPath(import.meta.url)), '..', 'data_sources', 'harvest');
const { isBlacklistedConcept, isBlacklistedFile, isRejectedImageMapping } = require(
  join(HARVEST, 'image_resolution_policy.cjs'));

/** Normalisierung des Teilstring-Vergleichs: Kleinschreibung, nur a–z und 0–9. */
const compact = value => String(value ?? '').toLowerCase()
  .replace(/ß/g, 'ss').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
  .replace(/[^a-z0-9]/g, '');

const BLOCKED_IDS = require(join(HARVEST, 'IMAGE_BLACKLIST.json')).conceptIds.map(compact);

/**
 * Ist das Konzept gesperrt — über seine ID, seinen Namen oder seine Bilddatei?
 *
 * @param {object} concept  Rohkonzept aus einer Erntedatei.
 * @returns {null|string} `null`, wenn es bleiben darf; sonst der Grund fürs Verwerfen.
 */
export function blacklistReason(concept) {
  const id = concept?.id;
  const name = concept?.name;
  if (isBlacklistedConcept(id)
    || BLOCKED_IDS.some(blocked => compact(id).includes(blocked) || compact(name).includes(blocked))) {
    return 'BLACKLIST (siehe harvest/BLACKLIST.md)';
  }
  // Gesperrte Bilddatei an einem sonst unauffälligen Konzept: Der Purge-Lauf
  // wirft dasselbe Konzept später ohnehin weg, also hier schon verwerfen.
  if (concept?.imageFile && isBlacklistedFile(concept.imageFile)) {
    return `BLACKLIST-Bilddatei ${concept.imageFile} (siehe harvest/BLACKLIST.md)`;
  }
  if (concept?.imageFile && isRejectedImageMapping(id, concept.imageFile)) {
    return `Fachlich falsches Bildmotiv für ${id} (siehe harvest/IMAGE_BLACKLIST.json)`;
  }
  return null;
}

/** Die gesperrten Konzept-IDs — für die erlaubte Löschliste der Merge-Sicherung. */
export function blacklistedConceptIds() {
  return require(join(HARVEST, 'IMAGE_BLACKLIST.json')).conceptIds
    .map(id => String(id).toLowerCase());
}
