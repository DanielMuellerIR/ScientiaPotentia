/**
 * Einmaliger Merge-Helfer (Phase 5): hängt die recherchierten + verifizierten
 * neuen Konzepte aus /tmp/phase5_<domain>.json an die Faktenbasis
 * scripts/data_sources/<domain>_raw.json an — mit Dedup + Daten-Putz.
 *
 * Dedup (konservativ, je Kategorie; nie kategorieübergreifend, sonst falsche
 * Treffer wie Stern „Sonne" in „Sonnenmasse"):
 *   - id bereits vorhanden                       -> raus
 *   - normalisierter Name exakt / Teilstring     -> raus (gleiche Kategorie)
 *   - MANUAL_DROP: per Hand erkannte Dubletten   -> raus
 *
 * Daten-Putz (die Recherche schrieb teils verbose/ASCII-Deutsch):
 *   - Antwort-Felder kürzen (Sternbild/Galaxientyp ohne Klammern, Sterntyp auf
 *     den deutschen Teil, Zwergplaneten-Lage kanonisch, Muskel-Lage erste Phrase)
 *   - ASCII-Umlaute zu echten (ue/oe/ae/ss -> ü/ö/ä/ß) via sicherem Wort-Wörterbuch
 *
 * Aufruf: node scripts/merge_phase5.js          (Dry-Run, zeigt nur Befund)
 *         node scripts/merge_phase5.js --write  (schreibt die raw-Dateien)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const WRITE = process.argv.includes('--write');

// Per Hand-Stichprobe gefundene semantische Dubletten (gleiche Sache, anderer
// Name/andere id -> rein algorithmisch nicht erkennbar):
const MANUAL_DROP = new Set([
  'knochen_206',        // == Bestand „Anzahl Knochen beim Erwachsenen"
  'zaehne_32',          // == Bestand „Anzahl Zaehne beim Erwachsenen"
  'chromosomen_46',     // == Bestand „Anzahl Chromosomen des Menschen"
  'bauchspeicheldruese',// == Bestand „Bauchspeicheldruese" (id pankreas)
  'strudel_m51'         // Strudelgalaxie = Whirlpool-Galaxie = M51 (im Bestand)
]);

// --- Deutsch-Putz: ASCII-Schreibweisen zu echten Umlauten/ß -----------------
// Wort-/Präfix-genau (case-insensitiv, Großschreibung wird übernommen), damit
// kein „neue" zu „nü" o.ä. verstümmelt wird.
const DE_FIX = [
  ['ueber', 'über'], ['aequator', 'äquator'], ['weiss', 'weiß'], ['heiss', 'heiß'],
  ['gross', 'groß'], ['groesst', 'größt'], ['groesser', 'größer'],
  ['schaedel', 'schädel'], ['schlaef', 'schläf'], ['steiss', 'steiß'], ['gesaess', 'gesäß'],
  ['suedlich', 'südlich'], ['sued', 'süd'], ['loewe', 'löwe'],
  ['hoehle', 'höhle'], ['hoehe', 'höhe'], ['hoeher', 'höher'], ['koerper', 'körper'],
  ['laengst', 'längst'], ['laenge', 'länge'], ['laenger', 'länger'], ['laeng', 'läng'],
  ['haeufig', 'häufig'], ['naeher', 'näher'], ['staerk', 'stärk'], ['waerme', 'wärme'],
  ['fuenf', 'fünf'], ['duenn', 'dünn'], ['foermig', 'förmig'], ['traegt', 'trägt'],
  ['zaehl', 'zähl'], ['naehr', 'nähr'], ['veraenderlich', 'veränderlich'],
  ['guertel', 'gürtel']
];
function deFix(s) {
  let out = String(s ?? '');
  for (const [a, b] of DE_FIX) {
    out = out.replace(new RegExp(a, 'gi'), m =>
      m[0] === m[0].toUpperCase() ? b[0].toUpperCase() + b.slice(1) : b);
  }
  return out;
}
function deFixDeep(v) {
  if (typeof v === 'string') return deFix(v);
  if (Array.isArray(v)) return v.map(deFixDeep);
  if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = deFixDeep(v[k]); return o; }
  return v;
}

// Alles ab dem ersten „ (" abschneiden — robust auch bei verschachtelten
// Klammern wie „Spiralgalaxie (Starburst, SAB(s)c)" -> „Spiralgalaxie".
const beforeParen = s => String(s || '').split(' (')[0].trim();
const firstPhrase = s => String(s || '').split(/ \/ |, | \(/)[0].trim();
// Kanonische, kurze Zwergplaneten-Lage (Recherche lieferte teils Tippfehler).
const DWARF_LOC = { sedna: 'Oortsche Wolke', quaoar: 'Kuipergürtel', orcus: 'Kuipergürtel', gonggong: 'Streuscheibe' };
function canonStarType(t) {
  const m = String(t || '').match(/\((.*?)\)/);
  return (m ? m[1] : String(t || '')).split(',')[0].trim();
}

const norm = s => String(s ?? '').toLowerCase()
  .replace(/ß/g, 'ss').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
  .replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, '').trim();

// Konzept auf die vom Generator erwarteten Felder reduzieren + Felder putzen.
function clean(c) {
  const out = {
    id: c.id, name: c.name, category: c.category, attributes: { ...c.attributes },
    funFact: c.funFact || '', sourceName: c.sourceName,
    sourceUrl: c.sourceUrl || '', verifyNote: c.verifyNote || ''
  };
  const a = out.attributes;
  if (out.category === 'dwarf_planet') a.location = DWARF_LOC[out.id] || firstPhrase(a.location);
  if (out.category === 'star') { if (a.constellation) a.constellation = beforeParen(a.constellation); if (a.type) a.type = canonStarType(a.type); }
  if (out.category === 'galaxy' && a.type) a.type = beforeParen(a.type);
  if (out.category === 'muscle' && a.location) a.location = firstPhrase(a.location);
  return deFixDeep(out);
}

for (const domain of ['astra', 'homo']) {
  const rawPath = join(ROOT, 'scripts', 'data_sources', `${domain}_raw.json`);
  const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
  const incoming = JSON.parse(readFileSync(`/tmp/phase5_${domain}.json`, 'utf8'));

  // Bestand-Zwergplaneten-Lage angleichen (ASCII „Kuiperguertel" -> „Kuipergürtel"),
  // sonst stehen im selben MCQ-Pool zwei Schreibweisen derselben Region.
  for (const c of raw) if (c.category === 'dwarf_planet' && c.attributes?.location) c.attributes.location = deFix(c.attributes.location);

  const ids = new Set(raw.map(c => c.id));
  const namesByCat = {};
  for (const c of raw) (namesByCat[c.category] ||= []).push(norm(c.name));

  const kept = [], dropped = [];
  for (const c0 of incoming) {
    const c = clean(c0);
    const nn = norm(c.name);
    const catNames = namesByCat[c.category] ||= [];
    let reason = null;
    if (ids.has(c.id)) reason = `id-Kollision (${c.id})`;
    else if (MANUAL_DROP.has(c.id)) reason = `manuelle Dublette`;
    else if (catNames.includes(nn)) reason = `Name exakt vorhanden`;
    else if (nn.length >= 5 && catNames.some(n => n.length >= 5 && (n.includes(nn) || nn.includes(n)))) reason = `Name Teilstring (gleiche Kategorie)`;
    if (reason) { dropped.push({ name: c.name, reason }); continue; }
    ids.add(c.id); catNames.push(nn);
    kept.push(c);
  }

  console.log(`\n=== ${domain.toUpperCase()} === Bestand ${raw.length}, neu ${incoming.length} -> behalten ${kept.length}, verworfen ${dropped.length}`);
  dropped.forEach(d => console.log(`  - DROP ${d.name} [${d.reason}]`));

  if (WRITE) {
    writeFileSync(rawPath, JSON.stringify(raw.concat(kept), null, 2), 'utf8');
    console.log(`  geschrieben: ${rawPath} (${raw.length + kept.length} Konzepte)`);
  }
}
console.log(WRITE ? '\nFertig (geschrieben).' : '\nDry-Run. Mit --write schreiben.');
