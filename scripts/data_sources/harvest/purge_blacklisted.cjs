/**
 * Entfernt gesperrte Konzepte aus den Rohdaten aller Domains.
 *
 * Die Sperrliste steht in `IMAGE_BLACKLIST.json` (Begründung je Eintrag in
 * `BLACKLIST.md`). Sie hielt bisher nur die Bildauflösung von gesperrten
 * Konzepten fern; ein bereits eingepflegtes Konzept blieb trotzdem in
 * `<domain>_raw.json` und damit im veröffentlichten Bestand stehen. Genau das
 * war bei „Guernica" der Fall: Das Werk ist bis 2043 geschützt, laut
 * BLACKLIST.md komplett zu streichen — und wurde weiter ausgeliefert.
 *
 * Der reguläre Merge taugt für diese Löschung nicht: `merge_cultura.js` baut
 * die Rohdaten aus vier Erntedateien der ersten Welle nach und würde heute
 * über 1.800 später ergänzte Konzepte mitlöschen. Darum dieses eigene, eng
 * begrenzte Werkzeug: Es löscht ausschließlich die namentlich gesperrten IDs.
 *
 * Aufruf:
 *   node purge_blacklisted.cjs            # Trockenlauf, meldet nur
 *   node purge_blacklisted.cjs --write    # löscht wirklich
 *   node purge_blacklisted.cjs --check    # Exit 1, wenn noch etwas übrig ist
 *
 * Nach einem --write müssen die betroffenen Generatoren neu laufen, damit
 * `public/data/` dem bereinigten Stand entspricht.
 */
const fs = require('node:fs');
const path = require('node:path');
const { readJsonArray, writeJsonAtomic } = require('./json_io.cjs');
const { isBlacklistedConcept, isBlacklistedFile } = require('./image_resolution_policy.cjs');

const DATA_SOURCES = path.join(__dirname, '..');

function parseArguments(arguments_) {
  const unknown = arguments_.filter(flag => flag !== '--write' && flag !== '--check');
  if (unknown.length) {
    throw new Error('Aufruf: purge_blacklisted.cjs [--write] [--check]');
  }
  return {
    write: arguments_.includes('--write'),
    check: arguments_.includes('--check'),
  };
}

// Die sieben Domains mit einem Konzept-Array als Quellwahrheit. Terra fehlt
// bewusst: Sein Bestand sind Kartenobjekte, und `terra_currency_raw.json` ist
// ein Objekt mit Metadaten statt einer Konzeptliste.
const DOMAINS = ['astra', 'cultura', 'historia', 'homo', 'lingua', 'machina', 'natura'];

/** Die `<domain>_raw.json` der Domains mit Konzeptliste. */
function rawFiles() {
  return DOMAINS
    .map(domain => ({ domain, file: path.join(DATA_SOURCES, `${domain}_raw.json`) }))
    .filter(({ file }) => fs.existsSync(file));
}

/**
 * Gesperrte Konzepte einer Rohdatei. Ein Treffer entsteht über die Konzept-ID
 * oder über eine gesperrte Bilddatei — beide Wege stehen in der Sperrliste.
 */
function blacklistedConcepts(concepts) {
  return concepts.filter(concept => isBlacklistedConcept(concept?.id)
    || (concept?.imageFile && isBlacklistedFile(concept.imageFile)));
}

function main(argv) {
  const options = parseArguments(argv);
  let hits = 0;
  for (const { domain, file } of rawFiles()) {
    const concepts = readJsonArray(file, `${domain}_raw.json`);
    const blocked = blacklistedConcepts(concepts);
    if (!blocked.length) continue;
    hits += blocked.length;
    for (const concept of blocked) {
      console.log(`  ${domain}: ${concept.id} (${concept.name || 'ohne Name'}) — gesperrt`);
    }
    if (options.write) {
      const kept = concepts.filter(concept => !blocked.includes(concept));
      writeJsonAtomic(file, kept);
      console.log(`  ${domain}: ${blocked.length} Konzepte entfernt, ${kept.length} verbleiben`);
    }
  }

  if (!hits) {
    console.log('Keine gesperrten Konzepte in den Rohdaten.');
    return 0;
  }
  if (options.write) {
    console.log(`\n${hits} gesperrte Konzepte entfernt. Betroffene Generatoren neu ausführen.`);
    return 0;
  }
  console.log(`\n${hits} gesperrte Konzepte gefunden. Mit --write entfernen.`);
  return options.check ? 1 : 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`FEHLER: ${error.message}`);
    process.exitCode = 2;
  }
}

module.exports = { blacklistedConcepts, parseArguments, rawFiles };
