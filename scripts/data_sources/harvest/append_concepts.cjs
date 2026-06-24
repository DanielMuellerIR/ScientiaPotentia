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
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', '..');
const domain = process.argv[2];
const candArg = process.argv[3];
const WRITE = process.argv.includes('--write');
if (!domain || !candArg) {
  console.error('Aufruf: append_concepts.cjs <domain> <candPath> [--write]');
  process.exit(1);
}

const rawPath = path.join(ROOT, 'scripts', 'data_sources', `${domain}_raw.json`);
const candPath = path.isAbsolute(candArg) ? candArg : path.join(ROOT, candArg);

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const cand = JSON.parse(fs.readFileSync(candPath, 'utf8'));
if (!Array.isArray(raw) || !Array.isArray(cand)) {
  console.error('raw und Kandidatendatei müssen JSON-Arrays sein.'); process.exit(1);
}

function norm(s) {
  return String(s ?? '').toLowerCase()
    .replace(/ß/g, 'ss').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/[^a-z0-9+#]+/g, ' ').trim();
}

const ids = new Set(raw.map(c => c.id));
const nameKeys = new Set(raw.map(c => `${c.category}|${norm(c.name)}`));

const kept = [];
const dropped = [];
for (const c of cand) {
  if (!c || !c.id || !c.name || !c.category || !c.attributes || typeof c.attributes !== 'object') {
    dropped.push({ name: c && c.name, reason: 'Struktur unvollständig (id/name/category/attributes)' });
    continue;
  }
  const nkey = `${c.category}|${norm(c.name)}`;
  if (ids.has(c.id)) { dropped.push({ name: c.name, reason: `id-Dublette (${c.id})` }); continue; }
  if (nameKeys.has(nkey)) { dropped.push({ name: c.name, reason: `Name-Dublette (${c.category})` }); continue; }
  ids.add(c.id); nameKeys.add(nkey);
  kept.push(c);
}

const byCat = {};
for (const c of kept) byCat[c.category] = (byCat[c.category] || 0) + 1;

console.log(`Domain: ${domain}`);
console.log(`Bestand: ${raw.length}  Kandidaten: ${cand.length}  -> neu behalten: ${kept.length}, verworfen: ${dropped.length}`);
console.log('Neu nach Kategorie:', byCat);
if (dropped.length) {
  console.log('--- Verworfen ---');
  dropped.forEach(d => console.log(`  x ${d.name}: ${d.reason}`));
}

if (WRITE) {
  fs.writeFileSync(rawPath, JSON.stringify(raw.concat(kept), null, 2), 'utf8');
  console.log(`\nGeschrieben: ${rawPath} (${raw.length} -> ${raw.length + kept.length})`);
} else {
  console.log('\n[DRY-RUN] Nichts geschrieben. Mit --write anhängen.');
}
