/**
 * Opus-Gate für genre_fiction R2 (Welle 2 / Pilot).
 *
 * Liest die verifizierten Werke eines Ernte-Laufs (finalWorks-JSON: Array von
 * {name, author, year|startYear, genre, language, series?, funFact, sourceName,
 * sourceUrl, verifyNote}) und macht sie merge-fertig:
 *  - Cross-Kategorie-Dedup gegen ALLE cultura-Kategorien (der Welle-1-Stolperstein:
 *    Werke, die schon unter `literature`/`quote` stehen, dürfen nicht doppelt rein).
 *  - Genre-Vokabular erzwingen (Science-Fiction/Fantasy/Horror/Kriminalroman/Thriller).
 *  - year/startYear als String, genau eines.
 *  - deterministische ids (`genrefic-<nachname>-<titel-slug>-gN`) — id des Finders
 *    wird ignoriert, hier zentral vergeben (verhindert Format-/Kollisionsfehler).
 * Schreibt die gegateten Konzepte im Konzept-Shape; Merge danach über
 * ../append_concepts.cjs (NIE merge_cultura.js), dann generate_cultura.js →
 * verify_facts.js cultura → Browser.
 *
 * Aufruf (Pfade relativ zum Repo-Root aufgelöst):
 *   node scripts/data_sources/harvest/genrefic_r2/gate_wave2.cjs <finalworks.json> <cand-out.json>
 */
const fs = require('node:fs');
const path = require('node:path');

// Repo-Root relativ zur Skript-Lage (keine absoluten /Users/-Pfade im Repo).
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const finalPath = process.argv[2];
const outPath = process.argv[3];
if (!finalPath || !outPath) {
  console.error('Aufruf: gate_wave2.cjs <finalworks.json> <cand-out.json>');
  process.exit(1);
}

const works = JSON.parse(fs.readFileSync(finalPath, 'utf8'));
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/data_sources/cultura_raw.json'), 'utf8'));
const arr = Array.isArray(raw) ? raw : (raw.concepts || raw.data || Object.values(raw).find(Array.isArray));

const GENRES = new Set(['Science-Fiction', 'Fantasy', 'Horror', 'Kriminalroman', 'Thriller']);

// Normalisierung wie append_concepts.cjs (ß→ss, Umlaute→Vokal) für Namensvergleich.
const norm = s => String(s ?? '').toLowerCase()
  .replace(/ß/g, 'ss').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
  .replace(/[^a-z0-9+#]+/g, ' ').trim();

// ascii-Faltung für id-Slugs (ae/oe/ue wie im Bestand, z.B. "traeumen").
const slug = s => String(s ?? '').toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Bestehende: id-Set + normName->Kategorie(n) über ALLE Kategorien.
const existingIds = new Set(arr.map(c => c.id));
const nameToCats = new Map();
for (const c of arr) {
  const n = norm(c.name);
  if (!nameToCats.has(n)) nameToCats.set(n, new Set());
  nameToCats.get(n).add(c.category);
}

const kept = [];
const drops = [];
const seenNames = new Set();  // innerhalb dieses Laufs
const usedIds = new Set();

for (const w of works) {
  const tag = w && w.name ? w.name : '(ohne name)';
  if (!w || !w.name || !w.author) { drops.push({ tag, reason: 'name/author fehlt' }); continue; }
  if (!w.genre || !GENRES.has(w.genre)) { drops.push({ tag, reason: `genre nicht im Vokabular: "${w.genre}"` }); continue; }
  if (!w.language) { drops.push({ tag, reason: 'language fehlt' }); continue; }
  if (!w.funFact || !w.sourceName || !w.sourceUrl || !w.verifyNote) { drops.push({ tag, reason: 'funFact/source-Felder unvollständig' }); continue; }

  // Jahr: genau eines von year/startYear, als String.
  let year = w.year != null && w.year !== '' ? String(w.year) : undefined;
  let startYear = w.startYear != null && w.startYear !== '' ? String(w.startYear) : undefined;
  if (year && startYear) { startYear = undefined; } // year gewinnt bei Redundanz
  if (!year && !startYear) { drops.push({ tag, reason: 'weder year noch startYear' }); continue; }
  if (year && !/^\d{3,4}$/.test(year)) { drops.push({ tag, reason: `year unplausibel: "${year}"` }); continue; }
  if (startYear && !/^\d{3,4}$/.test(startYear)) { drops.push({ tag, reason: `startYear unplausibel: "${startYear}"` }); continue; }

  const n = norm(w.name);

  // Cross-Cat-Dedup: Werk existiert bereits in IRGENDEINER cultura-Kategorie?
  if (nameToCats.has(n)) {
    drops.push({ tag, reason: `Cross-Cat-Dublette (existiert in: ${[...nameToCats.get(n)].join(',')})` }); continue;
  }
  if (seenNames.has(n)) { drops.push({ tag, reason: 'Dublette innerhalb dieses Laufs' }); continue; }

  // deterministische id (bei Kollision -gN hochzählen).
  const lastName = String(w.author).trim().split(/\s+/).pop();
  let gi = 1;
  let id = `genrefic-${slug(lastName)}-${slug(w.name)}-g${gi}`;
  while (existingIds.has(id) || usedIds.has(id)) { gi++; id = `genrefic-${slug(lastName)}-${slug(w.name)}-g${gi}`; }

  const attributes = { author: String(w.author).trim(), genre: w.genre, language: w.language };
  if (year) attributes.year = year; else attributes.startYear = startYear;
  if (w.series) attributes.series = String(w.series).trim();

  kept.push({
    id,
    name: String(w.name).trim(),
    category: 'genre_fiction',
    attributes,
    funFact: String(w.funFact).trim(),
    sourceName: String(w.sourceName).trim(),
    sourceUrl: String(w.sourceUrl).trim(),
    verifyNote: String(w.verifyNote).trim(),
  });
  seenNames.add(n);
  usedIds.add(id);
}

fs.writeFileSync(outPath, JSON.stringify(kept, null, 2));

console.log(`Eingang: ${works.length} Werke -> behalten: ${kept.length}, verworfen: ${drops.length}`);
const byGenre = {};
for (const c of kept) byGenre[c.attributes.genre] = (byGenre[c.attributes.genre] || 0) + 1;
console.log('Genre-Verteilung:', byGenre);
if (drops.length) {
  console.log('\n--- Verworfen ---');
  for (const d of drops) console.log(`  x ${d.tag}: ${d.reason}`);
}
console.log(`\nKandidaten geschrieben: ${outPath}`);
