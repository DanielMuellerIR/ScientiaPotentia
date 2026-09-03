/**
 * Ergänzt Attribute an BESTEHENDEN Konzepten einer Faktenbasis.
 *
 * Gegenstück zu append_concepts.cjs: dort kommen neue Konzepte dazu, hier
 * bekommen vorhandene Konzepte zusätzliche geprüfte Attribute (z. B. der
 * lateinische Organname oder der Gegenspieler eines Muskels).
 *
 * Bewusst konservativ: Ein vorhandener Attributwert wird NIE überschrieben.
 * Eine Ergänzung, die einen bestehenden Wert ändern würde, gilt als Konflikt
 * und wird gemeldet statt angewendet — sonst könnte eine schwächere Quelle
 * einen besser belegten Wert still ersetzen (siehe docs/content_pipeline.md,
 * Abschnitt „Additiv zusammenführen").
 *
 * Eingabeformat (ein JSON-Array; Einträge ohne "attributes" werden übersprungen,
 * damit dieselbe Kandidatendatei auch neue Konzepte enthalten darf):
 *   { "id": "herz", "attributes": { "latinName": "Cor" },
 *     "sourceUrl": "https://…", "verifyNote": "…" }
 *
 * Aufruf:
 *   node scripts/data_sources/harvest/apply_attribute_additions.cjs \
 *     <domain> <candPathRelativRepo> [--write]
 *   (ohne --write nur Bericht)
 */
const path = require('node:path');
const {
  assertSafeDomain, readJsonArray, writeJsonAtomic,
} = require('./json_io.cjs');
const { isHttpUrl, validateCatalog } = require('./concept_validation.cjs');

const ROOT = path.join(__dirname, '..', '..', '..');

/** Vergleichswert für den Konfliktcheck: Zahlen und Text robust vergleichbar. */
function sameValue(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  return String(a).trim() === String(b).trim();
}

function validateAddition(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return 'Ergänzungs-Objekt erwartet';
  }
  if (typeof entry.id !== 'string' || !entry.id.trim()) {
    return 'id fehlt oder ist kein nicht leerer Text';
  }
  if (!entry.attributes || typeof entry.attributes !== 'object'
      || Array.isArray(entry.attributes)) {
    return 'attributes muss ein Objekt sein';
  }
  if (Object.keys(entry.attributes).length === 0) {
    return 'attributes ist leer';
  }
  for (const [key, value] of Object.entries(entry.attributes)) {
    if (!key.trim()) return 'leerer Attributname';
    if (value === null || value === undefined) return `${key}: kein Wert`;
    if (typeof value === 'string' && !value.trim()) return `${key}: leerer Text`;
    // `boolean` gehoert dazu: Der Bestand fuehrt 29 solcher Attribute
    // (hasRings, zodiac, circumpolarCentralEurope ...). Ohne sie wurde eine
    // gueltige Ergaenzung `hasRings: false` stumm uebersprungen
    // (CodeQA 2026-09-03).
    if (typeof value !== 'string' && typeof value !== 'number'
      && typeof value !== 'boolean') {
      return `${key}: nur Text, Zahl oder Ja/Nein erlaubt`;
    }
  }
  // Eine Ergänzung ohne nachvollziehbare Quelle ist wertlos: die Rohdaten
  // müssen jeden prüfbaren Fakt belegen (CLAUDE.md, Fachliche Regeln).
  if (!isHttpUrl(entry.sourceUrl)) return 'sourceUrl fehlt oder ist keine HTTP(S)-URL';
  return null;
}

function main() {
  const [domainArgument, candidateArgument, ...flags] = process.argv.slice(2);
  if (!domainArgument || !candidateArgument || flags.some(flag => flag !== '--write')) {
    console.error('Aufruf: apply_attribute_additions.cjs <domain> <candPath> [--write]');
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
  } catch (error) {
    console.error(`FEHLER: ${error.message}`);
    return 1;
  }

  const byId = new Map(raw.map(concept => [concept.id, concept]));
  const applied = [];
  const conflicts = [];
  const skipped = [];
  const perAttribute = {};

  for (const entry of candidates) {
    // Einträge mit "category" sind neue Konzepte und gehören zu append_concepts.cjs.
    if (entry && typeof entry === 'object' && entry.category) continue;
    const problem = validateAddition(entry);
    if (problem) {
      skipped.push({ id: entry && entry.id, reason: problem });
      continue;
    }
    const concept = byId.get(entry.id);
    if (!concept) {
      skipped.push({ id: entry.id, reason: 'id existiert nicht im Rohkatalog' });
      continue;
    }
    for (const [key, value] of Object.entries(entry.attributes)) {
      const current = concept.attributes ? concept.attributes[key] : undefined;
      if (current !== undefined && current !== null && current !== '') {
        if (!sameValue(current, value)) {
          conflicts.push({ id: entry.id, key, current, proposed: value });
        }
        continue; // vorhandener Wert bleibt unangetastet
      }
      concept.attributes = concept.attributes || {};
      concept.attributes[key] = value;
      perAttribute[key] = (perAttribute[key] || 0) + 1;
      applied.push({ id: entry.id, key });
    }
  }

  console.log(`Domain: ${domain}`);
  console.log(`Konzepte im Katalog: ${raw.length}  Ergänzungen angewendet: ${applied.length}`);
  console.log('Nach Attribut:', perAttribute);
  if (conflicts.length) {
    console.log(`--- Konflikte (nicht angewendet, bestehender Wert bleibt): ${conflicts.length} ---`);
    conflicts.slice(0, 40).forEach(item => console.log(
      `  ! ${item.id}.${item.key}: „${item.current}" bleibt, Vorschlag war „${item.proposed}"`));
    if (conflicts.length > 40) console.log(`  … und ${conflicts.length - 40} weitere`);
  }
  if (skipped.length) {
    console.log(`--- Übersprungen: ${skipped.length} ---`);
    skipped.slice(0, 40).forEach(item => console.log(`  x ${item.id}: ${item.reason}`));
    if (skipped.length > 40) console.log(`  … und ${skipped.length - 40} weitere`);
  }

  const outputError = validateCatalog(raw);
  if (outputError) {
    console.error(`FEHLER: Katalog nach Ergänzung ungültig: ${outputError}`);
    return 1;
  }

  if (flags.includes('--write') && applied.length) {
    writeJsonAtomic(rawPath, raw);
    console.log(`\nGeschrieben: ${rawPath}`);
  } else if (flags.includes('--write')) {
    console.log('\nKeine Ergänzungen; Rohkatalog unverändert.');
  } else {
    console.log('\n[DRY-RUN] Nichts geschrieben. Mit --write anwenden.');
  }
  // Uebersprungene Ergaenzungen sind Eingabefehler (fehlende Quelle, unbekannte
  // id), kein Normalfall wie bei den Kandidaten in append_concepts. Ein Lauf,
  // bei dem alles an einem Tippfehler scheitert, meldete bisher Exit 0 und war
  // von "nichts zu tun" nicht zu unterscheiden (CodeQA 2026-09-03).
  return skipped.length ? 1 : 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { main, sameValue, validateAddition };
