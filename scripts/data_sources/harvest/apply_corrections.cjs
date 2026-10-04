/**
 * Wendet Korrekturen der adversarialen Verifier auf eine Faktenbasis an.
 *
 * Liest scripts/data_sources/<domain>_raw.json und alle
 * harvest/corr_<domain>_*.json. Standard ist ein Dry-Run; nur --write ersetzt
 * den Rohkatalog. Ein unlesbarer oder strukturell ungültiger Korrektursatz
 * blockiert den gesamten Schreibvorgang.
 *
 * Korrektur-Objekt (genau eine Operation pro Eintrag):
 *   { "id": "...", "set": { "<attr>": <wert> }, "reason": "..." }
 *   { "id": "...", "removeAttr": ["<attr>"], "reason": "..." }
 *   { "id": "...", "remove": true, "reason": "..." }
 *
 * Aufruf: node apply_corrections.cjs <machina|historia> [--write]
 */
const fs = require('node:fs');
const path = require('node:path');
const { readJsonArray, writeJsonAtomic } = require('./json_io.cjs');
const { isHttpUrl, validateCatalog } = require('./concept_validation.cjs');
const { isAllowedImageLicense } = require('../../lib/image_license_policy.js');
const { isBlacklistedFile, isRejectedImageMapping } = require('./image_resolution_policy.cjs');

const HARVEST = __dirname;
const ROOT = path.join(HARVEST, '..', '..', '..');
const CONCEPT_FIELDS = new Set([
  'name', 'category', 'funFact', 'sourceName', 'sourceUrl', 'verifyNote',
  'imageSearchTerm', 'imageFile', 'imageLicense', 'imageAttribution',
]);

function validateSetValue(key, value, conceptId) {
  if (value === null || value === undefined) return `${key} darf nicht null sein`;
  if (typeof value === 'string' && !value.trim()) return `${key} darf nicht leer sein`;
  if (key === 'concept.sourceUrl' && !isHttpUrl(value)) {
    return 'concept.sourceUrl muss eine HTTP(S)-URL sein';
  }
  if (key.startsWith('concept.') && typeof value !== 'string') {
    return `${key} muss Text sein`;
  }
  // Attributwerte wurden bisher gar nicht auf den Typ geprüft: Ein Objekt oder
  // eine Liste landete als Option „[object Object]" im Katalog, und das
  // Fragen-Audit sieht darin einen gültigen Text (CodeQA 2026-09-03).
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    return `${key} muss Text, Zahl oder Ja/Nein sein`;
  }
  // Bildfelder stehen in CONCEPT_FIELDS, aber diese Datei kannte weder die
  // Lizenzliste noch die Sperrliste — anders als apply_images.cjs. Eine
  // Korrekturdatei konnte damit ein gesperrtes oder unfrei lizenziertes Bild
  // an den Prüfungen vorbei in den Rohkatalog schreiben.
  if (key === 'concept.imageLicense' && !isAllowedImageLicense(value)) {
    return `concept.imageLicense: keine erlaubte freie Lizenz (${value})`;
  }
  if (key === 'concept.imageFile' && isBlacklistedFile(value)) {
    return `concept.imageFile: gesperrte Bilddatei (siehe harvest/BLACKLIST.md)`;
  }
  if (key === 'concept.imageFile' && isRejectedImageMapping(conceptId, value)) {
    return 'concept.imageFile: fachlich falsches Bildmotiv (siehe harvest/IMAGE_BLACKLIST.json)';
  }
  return null;
}

function validateSetKey(key) {
  if (!key.trim()) return 'leerer set-Schlüssel';
  if (key.startsWith('attributes.')) {
    return key.slice('attributes.'.length).trim()
      ? null
      : 'attributes.<key> benötigt einen Attributnamen';
  }
  if (key.startsWith('concept.')) {
    const field = key.slice('concept.'.length);
    return CONCEPT_FIELDS.has(field)
      ? null
      : `nicht erlaubtes Konzeptfeld: ${field || '—'}`;
  }
  if (key.includes('.')) return `unbekanntes set-Ziel: ${key}`;
  // Ein barer Schlüssel landet in `attributes`. Heisst er wie ein Konzeptfeld
  // („category" gibt es auf beiden Ebenen), sieht weder Autor noch Protokoll,
  // welche Ebene getroffen wurde. Die Ebene muss ausgeschrieben werden.
  return CONCEPT_FIELDS.has(key)
    ? `mehrdeutiger set-Schlüssel „${key}": bitte „attributes.${key}" oder „concept.${key}" schreiben`
    : null;
}

function validateCorrection(correction) {
  if (!correction || typeof correction !== 'object' || Array.isArray(correction)) {
    return 'Korrektur-Objekt erwartet';
  }
  if (typeof correction.id !== 'string' || !correction.id.trim()) {
    return 'id fehlt oder ist kein Text';
  }
  const hasRemove = correction.remove === true;
  const hasRemoveAttr = Object.hasOwn(correction, 'removeAttr');
  const hasSet = Object.hasOwn(correction, 'set');
  if (Number(hasRemove) + Number(hasRemoveAttr) + Number(hasSet) !== 1) {
    return 'genau eine Operation remove, removeAttr oder set erforderlich';
  }
  if (Object.hasOwn(correction, 'remove') && correction.remove !== true) {
    return 'remove darf nur true sein';
  }
  if (hasRemoveAttr && (
    !Array.isArray(correction.removeAttr)
    || correction.removeAttr.length === 0
    || !correction.removeAttr.every(
      attribute => typeof attribute === 'string' && attribute.trim())
  )) {
    return 'removeAttr muss eine nicht leere Textliste sein';
  }
  if (hasSet && (
    !correction.set || typeof correction.set !== 'object'
    || Array.isArray(correction.set) || Object.keys(correction.set).length === 0
  )) {
    return 'set muss ein nicht leeres Objekt sein';
  }
  if (hasSet) {
    for (const [key, value] of Object.entries(correction.set)) {
      const keyError = validateSetKey(key);
      if (keyError) return keyError;
      const valueError = validateSetValue(key, value, correction.id);
      if (valueError) return valueError;
    }
  }
  return null;
}

function setCorrectionValue(concept, key, value) {
  if (key.startsWith('concept.')) {
    concept[key.slice('concept.'.length)] = value;
    return;
  }
  const attribute = key.startsWith('attributes.')
    ? key.slice('attributes.'.length)
    : key;
  concept.attributes[attribute] = value;
}

function main() {
  const [domain, ...flags] = process.argv.slice(2);
  const allowedFlags = new Set(['--write', '--dry-run']);
  if (!['machina', 'historia'].includes(domain)
      || flags.some(flag => !allowedFlags.has(flag))
      || (flags.includes('--write') && flags.includes('--dry-run'))) {
    console.error('Aufruf: apply_corrections.cjs <machina|historia> [--write]');
    return 1;
  }
  const write = flags.includes('--write');
  const rawPath = path.join(ROOT, 'scripts', 'data_sources', `${domain}_raw.json`);
  let raw;
  try {
    raw = readJsonArray(rawPath, `${domain}_raw.json`);
  } catch (error) {
    console.error(`FEHLER: ${error.message}`);
    return 1;
  }
  // Korrekturen laufen auf einer Kopie. Erst der vollständig validierte
  // Ausgabekatalog darf die Quellwahrheit atomar ersetzen.
  const working = structuredClone(raw);
  const byId = new Map(working.map(concept => [concept.id, concept]));
  const correctionFiles = fs.readdirSync(HARVEST)
    .filter(file => new RegExp(`^corr_${domain}_.*\\.json$`).test(file))
    .sort((a, b) => a.localeCompare(b, 'de'));
  const planned = [];
  const inputErrors = [];
  for (const file of correctionFiles) {
    let corrections;
    try {
      corrections = readJsonArray(path.join(HARVEST, file), file);
    } catch (error) {
      inputErrors.push(error.message);
      continue;
    }
    corrections.forEach((correction, index) => {
      const error = validateCorrection(correction);
      if (error) inputErrors.push(`${file} #${index + 1}: ${error}`);
      else planned.push({ correction, file });
    });
  }
  if (inputErrors.length) {
    inputErrors.forEach(error => console.error(`FEHLER: ${error}`));
    console.error('Keine Korrektur angewendet.');
    return 1;
  }

  let applied = 0;
  let removed = 0;
  let skipped = 0;
  const removedIds = new Set();
  const log = [];
  for (const { correction, file } of planned) {
    const concept = byId.get(correction.id);
    if (!concept) {
      skipped++;
      log.push(`SKIP unbekannte id ${correction.id} (${file})`);
      continue;
    }
    if (correction.remove) {
      removedIds.add(correction.id);
      removed++;
      log.push(`REMOVE ${correction.id}: ${correction.reason || ''}`);
      continue;
    }
    if (!concept.attributes || typeof concept.attributes !== 'object'
        || Array.isArray(concept.attributes)) {
      console.error(`FEHLER: ${correction.id} besitzt kein Attribut-Objekt.`);
      return 1;
    }
    if (correction.removeAttr) {
      for (const attribute of correction.removeAttr) delete concept.attributes[attribute];
      applied++;
      log.push(`RMATTR ${correction.id} [${correction.removeAttr.join(',')}]: ${correction.reason || ''}`);
    } else {
      for (const [key, value] of Object.entries(correction.set)) {
        setCorrectionValue(concept, key, value);
      }
      applied++;
      log.push(`SET ${correction.id} ${JSON.stringify(correction.set)}: ${correction.reason || ''}`);
    }
  }

  const output = working.filter(concept => !removedIds.has(concept.id));
  const outputError = validateCatalog(output);
  if (outputError) {
    console.error(`FEHLER: Ausgabekatalog ungültig: ${outputError}`);
    console.error('Keine Korrektur angewendet.');
    return 1;
  }
  console.log(`Domain: ${domain}`);
  console.log(`Korrektur-Dateien: ${correctionFiles.length} (${correctionFiles.join(', ') || '—'})`);
  console.log(`Attribut-Korrekturen: ${applied}, entfernte Konzepte: ${removed}, übersprungen: ${skipped}`);
  console.log(`Konzepte: ${raw.length} -> ${output.length}`);
  console.log('\n--- Änderungen ---');
  log.forEach(entry => console.log(`  ${entry}`));

  if (write) {
    writeJsonAtomic(rawPath, output);
    console.log(`\nGeschrieben: ${rawPath}`);
  } else {
    console.log('\n[DRY-RUN] Nichts geschrieben. Mit --write anwenden.');
  }
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { main, setCorrectionValue, validateCorrection, validateSetKey, validateSetValue };
