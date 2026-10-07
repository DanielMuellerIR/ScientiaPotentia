import { writeJsonAtomic } from './data_sources/harvest/json_io.cjs';
/**
 * Einmaliger Merge-Helfer (Phase 5): hängt die recherchierten + verifizierten
 * neuen Konzepte aus /tmp/phase5_<domain>.json an die Faktenbasis
 * scripts/data_sources/<domain>_raw.json an — mit Dedup + Daten-Putz.
 *
 * Dedup (konservativ, je Kategorie; nie kategorieübergreifend, sonst falsche
 * Treffer wie Stern „Sonne" in „Sonnenmasse"):
 *   - id bereits vorhanden                       -> raus
 *   - normalisierter Name exakt                  -> raus (gleiche Kategorie)
 *   - Name als Teilstring eines vorhandenen      -> nur Hinweis, kein Verwurf
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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { applyTextFix, normalizeForDedup } from './lib/merge_text.js';
import { blacklistReason } from './lib/merge_blacklist.js';

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

// Vergleichsschlüssel für Dedup und Sperrlisten-Abgleich: einmal in
// ./lib/merge_text.js, dort auch die Begründung (CodeQA 2026-09-03).
const norm = normalizeForDedup;

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
  // Textfixes nur auf Anzeigefelder und Attributwerte — nie auf id, URLs
  // oder Bildfelder (Regel und Begründung in ./lib/merge_text.js).
  return applyTextFix(out, deFix);
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

  const kept = [], dropped = [], blockedIds = [], hinweise = [];
  for (const c0 of incoming) {
    // BLACKLIST zuerst: gesperrte Konzepte gar nicht erst normalisieren
    // (Regel und Begründung in ./lib/merge_blacklist.js).
    const blocked = blacklistReason(c0);
    if (blocked) {
      dropped.push({ name: c0.name, reason: blocked });
      blockedIds.push(String(c0.id || ''));
      continue;
    }
    const c = clean(c0);
    const nn = norm(c.name);
    const catNames = namesByCat[c.category] ||= [];
    let reason = null;
    if (ids.has(c.id)) reason = `id-Kollision (${c.id})`;
    else if (MANUAL_DROP.has(c.id)) reason = `manuelle Dublette`;
    else if (catNames.includes(nn)) reason = `Name exakt vorhanden`;
    if (reason) { dropped.push({ name: c.name, reason }); continue; }
    // Teilstring-Aehnlichkeit verwirft NICHT mehr, sondern meldet nur. Die
    // Regel traf im heutigen Bestand 36 echte Paare in astra (Titan/Titania,
    // Sirius/Sirius B), 35 in homo (Wirbel/Halswirbel), 55 in cultura und 182
    // in natura — alles verschiedene Konzepte, die als "Dublette" protokolliert
    // und damit nicht als Verlust erkennbar weggeworfen worden waeren
    // (CodeQA 2026-09-03).
    const aehnlich = nn.length >= 5
      && catNames.find(n => n.length >= 5 && n !== nn && (n.includes(nn) || nn.includes(n)));
    if (aehnlich) hinweise.push(`${c.name}: Name enthaelt/steckt in einem vorhandenen Namen`);
    ids.add(c.id); catNames.push(nn);
    kept.push(c);
  }

  console.log(`\n=== ${domain.toUpperCase()} === Bestand ${raw.length}, neu ${incoming.length} -> behalten ${kept.length}, verworfen ${dropped.length}`);
  dropped.forEach(d => console.log(`  - DROP ${d.name} [${d.reason}]`));
  hinweise.forEach(h => console.log(`  ! PRUEFEN ${h}`));

  if (WRITE) {
    writeJsonAtomic(rawPath, raw.concat(kept));
    console.log(`  geschrieben: ${rawPath} (${raw.length + kept.length} Konzepte)`);
  }
}
console.log(WRITE ? '\nFertig (geschrieben).' : '\nDry-Run. Mit --write schreiben.');
