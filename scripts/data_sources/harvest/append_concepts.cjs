/**
 * Hängt verifizierte NEUE Konzepte an eine bestehende Faktenbasis an — additiv,
 * mit Dedup. Bewusst KEIN Rebuild (anders als die legacy merge_<domain>.js mit
 * hartcodierten First-Wave-Dateilisten, die spätere Direkt-Appends überschreiben
 * würden). Nur sicheres Anhängen: bestehende Konzepte bleiben unangetastet.
 *
 * Dedup: ein Kandidat fällt weg, wenn seine id bereits existiert ODER ein Konzept
 * derselben Kategorie mit gleichem normalisierten Namen existiert (auch innerhalb
 * der Kandidatenliste). '+'/'#' bleiben in der Normalisierung erhalten (C++/C#).
 *
 * Aufruf:
 *   node scripts/data_sources/harvest/append_concepts.cjs <domain> <candPathRelativRepo> [--write]
 *   (ohne --write nur Bericht)
 */
const path = require('node:path');
const {
  assertSafeDomain, readJsonArray, writeJsonAtomic
} = require('./json_io.cjs');
const { validateCatalog, validateConcept } = require('./concept_validation.cjs');

const ROOT = path.join(__dirname, '..', '..', '..');

function norm(s) {
  return String(s ?? '').toLowerCase()
    .replace(/ß/g, 'ss').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/[^a-z0-9+#]+/g, ' ').trim();
}

function hasConceptStructure(concept, options) {
  return validateConcept(concept, options) === null;
}

function main() {
  const [domainArgument, candidateArgument, ...flags] = process.argv.slice(2);
  if (!domainArgument || !candidateArgument || flags.some(flag => flag !== '--write')) {
    console.error('Aufruf: append_concepts.cjs <domain> <candPath> [--write]');
    return 1;
  }
  let domain;
  let raw;
  let candidates;
  let rawPath;
  try {
    domain = assertSafeDomain(domainArgument);
    rawPath = path.join(ROOT, 'scripts', 'data_sources', `${domain}_raw.json`);
    const candidatePath = path.isAbsolute(candidateArgument)
      ? candidateArgument
      : path.join(ROOT, candidateArgument);
    raw = readJsonArray(rawPath, `${domain}_raw.json`);
    candidates = readJsonArray(candidatePath, path.basename(candidatePath));
    const invalidIndex = raw.findIndex(concept => !hasConceptStructure(concept));
    if (invalidIndex >= 0) {
      throw new Error(`Rohkatalog: Konzept ${invalidIndex + 1} ist strukturell unvollständig`);
    }
  } catch (error) {
    console.error(`FEHLER: ${error.message}`);
    return 1;
  }

  const ids = new Set(raw.map(concept => concept.id));
  const nameKeys = new Set(raw.map(
    concept => `${concept.category}|${norm(concept.name)}`));
  const kept = [];
  const dropped = [];
  for (const concept of candidates) {
    const candidateOptions = { requireSource: true, requireAttributeValues: true };
    if (!hasConceptStructure(concept, candidateOptions)) {
      dropped.push({
        name: concept && concept.name,
        reason: `Struktur unvollständig (${validateConcept(concept, candidateOptions)})`,
      });
      continue;
    }
    const nameKey = `${concept.category}|${norm(concept.name)}`;
    if (ids.has(concept.id)) {
      dropped.push({ name: concept.name, reason: `id-Dublette (${concept.id})` });
      continue;
    }
    if (nameKeys.has(nameKey)) {
      dropped.push({
        name: concept.name,
        reason: `Name-Dublette (${concept.category})`,
      });
      continue;
    }
    ids.add(concept.id);
    nameKeys.add(nameKey);
    kept.push(concept);
  }

  const byCategory = {};
  for (const concept of kept) {
    byCategory[concept.category] = (byCategory[concept.category] || 0) + 1;
  }
  console.log(`Domain: ${domain}`);
  console.log(`Bestand: ${raw.length}  Kandidaten: ${candidates.length}  -> neu behalten: ${kept.length}, verworfen: ${dropped.length}`);
  console.log('Neu nach Kategorie:', byCategory);
  if (dropped.length) {
    console.log('--- Verworfen ---');
    dropped.forEach(item => console.log(`  x ${item.name}: ${item.reason}`));
  }

  const merged = raw.concat(kept);
  const outputError = validateCatalog(merged);
  if (outputError) {
    console.error(`FEHLER: Zusammengeführter Katalog ungültig: ${outputError}`);
    return 1;
  }

  if (flags.includes('--write') && kept.length) {
    writeJsonAtomic(rawPath, merged);
    console.log(`\nGeschrieben: ${rawPath} (${raw.length} -> ${raw.length + kept.length})`);
  } else if (flags.includes('--write')) {
    console.log('\nKeine neuen Konzepte; Rohkatalog unverändert.');
  } else {
    console.log('\n[DRY-RUN] Nichts geschrieben. Mit --write anhängen.');
  }
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { hasConceptStructure, main, norm };
