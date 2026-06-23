/**
 * Wendet die Korrekturen der adversarialen Verifier auf eine Faktenbasis an.
 *
 * Liest scripts/data_sources/<domain>_raw.json + alle harvest/corr_<domain>_*.json
 * (Arrays von Korrektur-Objekten) und schreibt das Raw zurück.
 *
 * Korrektur-Objekt (eines pro Eintrag):
 *   { "id": "...", "set": { "<attr>": <wert> }, "reason": "..." }   -> Attribut(e) setzen/ändern
 *   { "id": "...", "removeAttr": ["<attr>"], "reason": "..." }       -> Attribut(e) entfernen
 *   { "id": "...", "remove": true, "reason": "..." }                 -> ganzes Konzept verwerfen
 *
 * Aufruf: node scripts/data_sources/harvest/apply_corrections.cjs <machina|historia> [--dry-run]
 */
const fs = require('node:fs');
const path = require('node:path');

const HARVEST = __dirname;
const ROOT = path.join(HARVEST, '..', '..', '..');
const domain = process.argv[2];
const DRY = process.argv.includes('--dry-run');
if (!['machina', 'historia'].includes(domain)) {
  console.error('Domain machina|historia angeben.'); process.exit(1);
}

const rawPath = path.join(ROOT, 'scripts', 'data_sources', `${domain}_raw.json`);
const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const byId = new Map(raw.map(c => [c.id, c]));

const corrFiles = fs.readdirSync(HARVEST).filter(f => new RegExp(`^corr_${domain}_.*\\.json$`).test(f));
let applied = 0, removed = 0, skipped = 0;
const log = [];

for (const f of corrFiles) {
  let corrs;
  try { corrs = JSON.parse(fs.readFileSync(path.join(HARVEST, f), 'utf8')); }
  catch (e) { console.error(`${f}: nicht parsebar (${e.message})`); continue; }
  if (!Array.isArray(corrs)) continue;
  for (const c of corrs) {
    const concept = byId.get(c.id);
    if (!concept) { skipped++; log.push(`SKIP unbekannte id ${c.id} (${f})`); continue; }
    if (c.remove) {
      concept._remove = true; removed++;
      log.push(`REMOVE ${c.id}: ${c.reason || ''}`);
    } else if (c.removeAttr) {
      for (const a of c.removeAttr) delete concept.attributes[a];
      applied++;
      log.push(`RMATTR ${c.id} [${c.removeAttr.join(',')}]: ${c.reason || ''}`);
    } else if (c.set) {
      for (const [k, v] of Object.entries(c.set)) concept.attributes[k] = v;
      applied++;
      log.push(`SET ${c.id} ${JSON.stringify(c.set)}: ${c.reason || ''}`);
    }
  }
}

const out = raw.filter(c => !c._remove);

console.log(`Domain: ${domain}`);
console.log(`Korrektur-Dateien: ${corrFiles.length} (${corrFiles.join(', ') || '—'})`);
console.log(`Attribut-Korrekturen: ${applied}, entfernte Konzepte: ${removed}, übersprungen: ${skipped}`);
console.log(`Konzepte: ${raw.length} -> ${out.length}`);
console.log('\n--- Änderungen ---');
log.forEach(l => console.log('  ' + l));

if (!DRY) {
  fs.writeFileSync(rawPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`\nGeschrieben: ${rawPath}`);
} else {
  console.log('\n[DRY-RUN] Nichts geschrieben.');
}
