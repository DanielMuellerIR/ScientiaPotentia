/**
 * Wendet ein vom Bild-Resolver erzeugtes Mapping additiv auf
 * <domain>_raw.json an oder entfernt explizit als ungültig geprüfte Bilder.
 *
 * Die Rawdatei ändert sich nur mit --write. Vorher werden Rawkatalog und das
 * vollständige Mapping beziehungsweise Prüfergebnis eingelesen und validiert;
 * der abschließende Write ersetzt die Datei atomar.
 *
 * Aufruf:
 *   node apply_images.cjs <domain> [--mapping=<datei.json>] [--write]
 *   node apply_images.cjs <domain> --prune=<check.json> [--write]
 *
 * Ohne --mapping wird /tmp/<domain>_images_batched.json verwendet. Der Merge
 * ist additiv: Bestehende imageFile-Felder bleiben unangetastet.
 */
const path = require('node:path');
const {
  assertSafeDomain, readJson, readJsonArray, writeJsonAtomic,
} = require('./json_io.cjs');
const {
  isAllowedImageLicense,
} = require('../../lib/image_license_policy.js');
const {
  hasPublishableAttribution,
} = require('../../../src/utils/imageCredits.js');
const {
  isBlacklistedConcept,
  isBlacklistedFile,
  isRejectedImageMapping,
} = require('./image_resolution_policy.cjs');

const ROOT = path.join(__dirname, '..', '..', '..');

function parseArguments(arguments_) {
  const [domainArgument, ...flags] = arguments_;
  const writeCount = flags.filter(flag => flag === '--write').length;
  const mappingFlags = flags.filter(flag => flag.startsWith('--mapping='));
  const pruneFlags = flags.filter(flag => flag.startsWith('--prune='));
  const unknown = flags.filter(flag => (
    flag !== '--write'
    && !flag.startsWith('--mapping=')
    && !flag.startsWith('--prune=')
  ));
  if (!domainArgument || unknown.length || writeCount > 1
      || mappingFlags.length > 1 || pruneFlags.length > 1
      || (mappingFlags.length && pruneFlags.length)) {
    throw new Error('Aufruf: apply_images.cjs <domain> [--mapping=<datei.json> | --prune=<check.json>] [--write]');
  }
  const valueAfterEquals = (flag, name) => {
    if (!flag) return null;
    const value = flag.slice(flag.indexOf('=') + 1);
    if (!value) throw new Error(`${name} benötigt einen Dateipfad`);
    return value;
  };
  return {
    domain: assertSafeDomain(domainArgument),
    write: writeCount === 1,
    mappingArgument: valueAfterEquals(mappingFlags[0], '--mapping'),
    pruneArgument: valueAfterEquals(pruneFlags[0], '--prune'),
  };
}

function resolveInputPath(argument, fallback) {
  if (!argument) return fallback;
  return path.isAbsolute(argument) ? argument : path.join(ROOT, argument);
}

function indexRawConcepts(raw) {
  const byId = new Map();
  raw.forEach((concept, index) => {
    if (!concept || typeof concept !== 'object' || Array.isArray(concept)
        || typeof concept.id !== 'string' || !concept.id.trim()) {
      throw new Error(`Rohkatalog: Konzept ${index + 1} besitzt keine gültige id`);
    }
    if (byId.has(concept.id)) {
      throw new Error(`Rohkatalog: doppelte id ${concept.id}`);
    }
    byId.set(concept.id, concept);
  });
  return byId;
}

function isCommonsFilePage(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'commons.wikimedia.org'
      && /^\/wiki\/(?:File|Datei):/i.test(decodeURIComponent(url.pathname));
  } catch {
    return false;
  }
}

function validateMapping(mapping, byId = null) {
  const ids = new Set();
  mapping.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
        || typeof entry.id !== 'string' || !entry.id.trim()) {
      throw new Error(`Bild-Mapping: Eintrag ${index + 1} besitzt keine gültige id`);
    }
    if (ids.has(entry.id)) {
      throw new Error(`Bild-Mapping: doppelte id ${entry.id}`);
    }
    ids.add(entry.id);
    if (byId && !byId.has(entry.id)) {
      throw new Error(`Bild-Mapping: unbekannte id ${entry.id}`);
    }
    if (isBlacklistedConcept(entry.id)) {
      throw new Error(`Bild-Mapping: gesperrtes Konzept ${entry.id}`);
    }
    if (!isCommonsFilePage(entry.imageFile)) {
      throw new Error(`Bild-Mapping: ${entry.id} besitzt keine Commons-Dateiseite`);
    }
    if (isBlacklistedFile(entry.imageFile)) {
      throw new Error(`Bild-Mapping: gesperrte Commons-Datei für ${entry.id}`);
    }
    if (isRejectedImageMapping(entry.id, entry.imageFile)) {
      throw new Error(`Bild-Mapping: fachlich falsches Motiv für ${entry.id}`);
    }
    if (typeof entry.imageLicense !== 'string' || !entry.imageLicense.trim()) {
      throw new Error(`Bild-Mapping: ${entry.id} besitzt keine Lizenzangabe`);
    }
    if (!isAllowedImageLicense(entry.imageLicense)) {
      throw new Error(`Bild-Mapping: ${entry.id} besitzt keine erlaubte freie Lizenz`);
    }
    if (typeof entry.imageAttribution !== 'string' || !entry.imageAttribution.trim()) {
      throw new Error(`Bild-Mapping: ${entry.id} besitzt keine Urheberangabe`);
    }
    // Dieselbe Bedingung wie der Release-Audit, aus derselben Funktion: Ohne
    // sie nahm der Preflight einen generischen Urheber wie "Wikimedia Commons"
    // oder "Own work." an, und der Fehler platzte erst im `npm run build` —
    // dann fuer die ganze Domain (real am 2026-09-03, Homo-Lauf).
    if (!hasPublishableAttribution(entry.imageLicense, entry.imageAttribution)) {
      throw new Error(
        `Bild-Mapping: ${entry.id} nennt mit "${entry.imageAttribution.trim()}" `
        + 'keinen konkreten Rechteinhaber',
      );
    }
  });
}

function validatePruneResult(check) {
  if (!check || typeof check !== 'object' || Array.isArray(check)) {
    throw new Error('Prüfergebnis muss ein JSON-Objekt sein');
  }
  for (const [id, result] of Object.entries(check)) {
    if (!id.trim() || !result || typeof result !== 'object' || Array.isArray(result)
        || (result.ok !== true && result.ok !== false)) {
      throw new Error(`Prüfergebnis für ${id || 'leere id'} benötigt ok=true|false`);
    }
  }
}

function applyMapping(byId, mapping) {
  // Direkte Aufrufer bekommen denselben Schutz wie der CLI-Preflight. Vor der
  // ersten Änderung wird das ganze Mapping geprüft, damit nichts halb ankommt.
  validateMapping(mapping, byId);
  let applied = 0;
  let alreadyImaged = 0;
  for (const entry of mapping) {
    const concept = byId.get(entry.id);
    if (!concept) {
      // validateMapping(mapping, byId) muss diesen Zustand vor jeder Mutation
      // verhindern. Der Wächter bleibt für direkte Aufrufer bestehen.
      throw new Error(`Bild-Mapping: unbekannte id ${entry.id}`);
    }
    if (concept.imageFile) {
      alreadyImaged++;
      continue;
    }
    concept.imageFile = entry.imageFile;
    concept.imageLicense = entry.imageLicense;
    concept.imageAttribution = entry.imageAttribution;
    applied++;
  }
  return { applied, alreadyImaged, changed: applied };
}

function pruneImages(byId, check) {
  let removed = 0;
  for (const [id, result] of Object.entries(check)) {
    if (result.ok !== false) continue;
    const concept = byId.get(id);
    if (!concept?.imageFile) continue;
    delete concept.imageFile;
    delete concept.imageLicense;
    delete concept.imageAttribution;
    removed++;
    console.log(`  - entfernt: ${id} [${result.reason || 'ohne Begründung'}]`);
  }
  return { removed, changed: removed };
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const rawPath = path.join(
      ROOT, 'scripts', 'data_sources', `${options.domain}_raw.json`);
    const raw = readJsonArray(rawPath, `${options.domain}_raw.json`);
    const byId = indexRawConcepts(raw);
    let result;

    if (options.pruneArgument) {
      const prunePath = resolveInputPath(options.pruneArgument);
      const check = readJson(prunePath, path.basename(prunePath));
      validatePruneResult(check);
      result = pruneImages(byId, check);
      console.log(`Prune: ${result.removed} ungültige Bilder zum Entfernen vorgemerkt.`);
    } else {
      const fallback = `/tmp/${options.domain}_images_batched.json`;
      const mappingPath = resolveInputPath(options.mappingArgument, fallback);
      const mapping = readJsonArray(mappingPath, path.basename(mappingPath));
      validateMapping(mapping, byId);
      result = applyMapping(byId, mapping);
      console.log(`Apply: ${result.applied} Bilder zum Setzen vorgemerkt, `
        + `${result.alreadyImaged} bereits bebilderte Konzepte unverändert.`);
    }

    if (options.write && result.changed) {
      writeJsonAtomic(rawPath, raw);
      console.log(`Geschrieben: ${rawPath}`);
    } else if (options.write) {
      console.log('Keine Änderung; Rohkatalog nicht neu geschrieben.');
    } else {
      console.log('[DRY-RUN] Nichts geschrieben. Mit --write anwenden.');
    }
    return 0;
  } catch (error) {
    console.error(`FEHLER: ${error.message}`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  applyMapping,
  indexRawConcepts,
  isCommonsFilePage,
  parseArguments,
  pruneImages,
  validateMapping,
  validatePruneResult,
};
