/**
 * Merge-Helfer für die Cultura-Domain (Kunst & Kultur).
 *
 * Liest die vier Ernte-Dateien aus scripts/data_sources/harvest/cultura_*.json,
 * vereinheitlicht sie und schreibt die verifizierte Faktenbasis nach
 * scripts/data_sources/cultura_raw.json (Eingabe für generate_cultura.js).
 *
 * Warum nötig: Die Sammelrunde lief mit ZWEI Konventionen (wie bei Natura):
 *   - Teil a/b w1  schrieb teils andere Keys als Teil a/b w1b
 *     (z.B. composer: w1 hat geburtsjahr/sterbejahr als Zahl, w1b nur den
 *     lebensdaten-String "1685–1750"; art_movement: w1 "ursprungsland",
 *     w1b "entstehungsland").
 * Ohne Angleichung zerfielen die kategorie-internen Distraktor-Pools des
 * Generators (zwei Schreibweisen derselben Sache -> unfaire/falsche Optionen).
 *
 * Dieser Schritt macht (deterministisch, kein LLM):
 *   1. Attribut-KEYS -> kanonisch englisch je Kategorie (Synonyme zusammenführen).
 *      Jahres-Synonyme (jahr/urauffuehrungsjahr/erscheinungsjahr/entstehungsjahr/
 *      widmungsjahr) laufen unter "year" zusammen — die WERTE bleiben unverändert
 *      (Bereiche wie "1503–1519" und negative Jahre = v. Chr. bleiben, wie sie sind;
 *      Strings bleiben Strings). Der Generator filtert später selbst.
 *   2. Maß-WERTE (heightM/widthM/lengthM usw.): numerische Strings ("0.77") werden
 *      zu echten Zahlen geparst, damit ein gemeinsamer Zahlen-Pool entsteht.
 *   3. composer-Lebensdaten: Fehlen birthYear/deathYear, werden sie aus dem
 *      lebensdaten-String ("1685–1750") geparst — NUR wenn beide Teile 3-4-stellige
 *      Zahlen sind. Es wird nichts erfunden, der Original-String bleibt als
 *      "lifespan" erhalten.
 *   4. Wert-Putz für Distraktor-Fairness: originCountry und language verlieren
 *      Klammerzusätze ("Italien (Florenz)" -> "Italien"), damit nicht zwei
 *      Schreibweisen desselben Landes als verschiedene Optionen auftauchen.
 *   5. BLACKLIST: in harvest/BLACKLIST.md gesperrte Konzepte (Guernica) werden
 *      ausgefiltert, falls sie doch in einer Ernte-Datei auftauchen.
 *   6. ASCII-Umlaut-Putz (ue/ae/oe/ss -> ü/ä/ö/ß) über sicheres Wort-Wörterbuch
 *      (Cultura-Ernte ist laut Voranalyse sauber — rein defensiv).
 *   7. Dedup je Kategorie (id-Kollision + normalisierter Name).
 *   8. Bild- + Quellenfelder ERHALTEN (inkl. _imgProblem-Marker des Bild-Agenten).
 *
 * Hinweis Parallelbetrieb: Ein anderer Agent aktualisiert ggf. zeitgleich die
 * Bildfelder der harvest/*.json. Schlägt JSON.parse fehl (Datei gerade halb
 * geschrieben), warten wir 30 s und lesen erneut. Das Skript baut die Raw-Datei
 * komplett neu auf und ist damit idempotent — ein späterer Bilder-Refresh-Lauf
 * ist ausdrücklich vorgesehen.
 *
 * Aufruf: node scripts/merge_cultura.js          (Dry-Run, zeigt nur Befund)
 *         node scripts/merge_cultura.js --write   (schreibt cultura_raw.json)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { assertPreservesExistingConceptIds } from './lib/merge_safety.js';
import { applyTextFix, normalizeForDedup, normalizeIgnoringParentheses } from './lib/merge_text.js';
import { blacklistReason, blacklistedConceptIds } from './lib/merge_blacklist.js';

// Die Sperrliste liegt maschinenlesbar in harvest/IMAGE_BLACKLIST.json (Begründung
// je Eintrag in harvest/BLACKLIST.md). Sie wird hier eingelesen statt kopiert,
// damit ein neuer Eintrag nicht an zwei Stellen gepflegt werden muss.
const require = createRequire(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARVEST = join(__dirname, 'data_sources', 'harvest');
const OUT_PATH = join(__dirname, 'data_sources', 'cultura_raw.json');
const WRITE = process.argv.includes('--write');

const FILES = ['cultura_a_w1.json', 'cultura_a_w1b.json', 'cultura_b_w1.json', 'cultura_b_w1b.json'];

// --- BLACKLIST (aus harvest/IMAGE_BLACKLIST.json) ----------------------------
// Beispiel Guernica (Picasso): bis 2043 urheberrechtlich geschützt -> Konzept
// komplett gesperrt. Abgeglichen wird gegen id UND normalisierten Namen, damit
// auch eine abweichende Schreibweise ("guernica-picasso") hängen bleibt.
const BLACKLISTED = blacklistedConceptIds();

// --- 1. Attribut-Key-Aliase je Kategorie -> kanonisch englisch ---------------
// Nur Keys, die als Synonyme auftreten oder auf die der Generator Fragen baut.
// Übrige (Einzel-)Keys bleiben unangetastet (reine Anzeige-/Museumsdaten).
const KEY_ALIASES = {
  artwork: {
    kuenstler: 'creator', jahr: 'year', museum: 'location', technik: 'medium',
    hoeheM: 'heightM', breiteM: 'widthM', epoche: 'era', land: 'country'
  },
  sculpture: {
    kuenstler: 'creator', jahr: 'year', museum: 'location', material: 'material',
    hoeheM: 'heightM', breiteM: 'widthM', gesamthoehe_mit_sockelM: 'totalHeightWithPedestalM',
    epoche: 'era', land: 'country'
  },
  architecture: {
    architekt: 'architect', jahr: 'year', ort: 'location', material: 'material',
    laengeM: 'lengthM', breiteM: 'widthM', hoeheM: 'heightM',
    fassungsvermoegen: 'capacity', epoche: 'era', land: 'country',
    kuppeldurchmesserM: 'domeDiameterM', kuppelhoeheM: 'domeHeightM',
    gesamtflaecheHa: 'totalAreaHa', innenflaeche: 'interiorArea',
    ursprungshoeheM: 'originalHeightM', unesco_jahr: 'unescoYear',
    laengeKm: 'lengthKm', hoeheUeberMeerM: 'elevationM', gewichtT: 'weightT',
    stil: 'style'
  },
  art_movement: {
    zeitraum: 'period', ursprungsland: 'originCountry', entstehungsland: 'originCountry',
    hauptvertreter: 'mainRepresentatives', merkmale: 'characteristics',
    hauptmerkmale: 'characteristics', phasen: 'phases', namensgeber: 'namesake',
    entstehungsort: 'originPlace', wichtige_zentren: 'keyCenters',
    // "gruendungsjahr" (w1b) = Beginn der Bewegung -> gemeinsamer Zahlen-Anker
    // mit literary_movement (dort "zeitraum-von"). Name bewusst neutral.
    gruendungsjahr: 'startYear', gruender: 'founder', hauptgruppen: 'mainGroups',
    entstehungsregion: 'originRegion', bekanntestes_beispiel: 'notableExample',
    abgeloest_durch: 'succeededBy', abloest: 'supersedes'
  },
  composer: {
    geburtsjahr: 'birthYear', sterbejahr: 'deathYear', nationalitaet: 'nationality',
    epoche: 'era', 'bekanntes-werk': 'notableWork', hauptwerk: 'notableWork',
    lebensdaten: 'lifespan'
  },
  composition: {
    komponist: 'composer', gattung: 'genre', sprache: 'language', epoche: 'era',
    // Jahres-Synonyme: Werte unverändert unter "year" zusammenführen.
    jahr: 'year', erscheinungsjahr: 'year', urauffuehrungsjahr: 'year', widmungsjahr: 'year',
    'anzahl-konzerte': 'concertoCount', 'anzahl-opern': 'operaCount',
    tonart: 'musicalKey', saetze: 'movementCount', akte: 'actCount',
    dauer_min: 'durationMin', 'gesamtspieldauer-stunden': 'totalDurationHours',
    'textdichter-finale': 'finaleLyricist', librettist: 'librettist',
    widmungstraeger: 'dedicatee'
  },
  literature: {
    autor: 'author', gattung: 'genre', sprache: 'language', epoche: 'era',
    jahr: 'year', erscheinungsjahr: 'year', entstehungsjahr: 'year',
    // Zweiteilige Werke (Faust, Don Quijote): Teil-Jahre NICHT zu "year"
    // zusammenziehen — ein Einzeljahr wäre eine verfälschte Aussage.
    'erscheinungsjahr-teil1': 'yearPart1', 'erscheinungsjahr-teil2': 'yearPart2',
    entstehungszeitraum: 'creationPeriod',
    gesaenge: 'cantoCount', verse: 'verseCount', teile: 'partCount'
  },
  literary_movement: {
    'zeitraum-von': 'startYear', 'zeitraum-bis': 'endYear',
    herkunftsland: 'originCountry', herkunftslaender: 'originCountry', ursprung: 'originCountry',
    hauptmerkmal: 'characteristics', merkmale: 'characteristics',
    'wichtige-vertreter': 'mainRepresentatives', hauptvertreter: 'mainRepresentatives',
    kernidee: 'coreIdea',
    // ACHTUNG: "epoche" ist hier ein ZEITRAUM-String ("ca. 1830–1900"),
    // keine Epochen-Bezeichnung -> auf "period" mappen, nicht auf "era".
    epoche: 'period'
  }
};

// --- 2. Maß-Keys, deren Werte zu Zahlen geparst werden ------------------------
// Die Ernte mischt number (3.63) und String ("0.77"). Für numerische Fragen
// braucht der Generator einen homogenen Zahlen-Pool. Geparst wird NUR, wenn der
// String komplett numerisch ist (Punkt-Dezimal) — alles andere bleibt stehen.
// "year" fehlt hier ABSICHTLICH: Jahres-Werte (Bereiche, "v. Chr.") bleiben roh.
const NUM_KEYS = new Set([
  'heightM', 'widthM', 'lengthM', 'lengthKm', 'domeDiameterM', 'domeHeightM',
  'totalAreaHa', 'originalHeightM', 'elevationM', 'weightT', 'totalHeightWithPedestalM',
  'durationMin', 'totalDurationHours', 'movementCount', 'actCount',
  'concertoCount', 'operaCount', 'cantoCount', 'verseCount', 'partCount',
  'unescoYear', 'startYear', 'endYear', 'birthYear', 'deathYear', 'yearPart1', 'yearPart2'
]);
function parseNumeric(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && /^-?[0-9]+(\.[0-9]+)?$/.test(v.trim())) return Number(v.trim());
  return v; // nicht rein numerisch -> Original behalten (nichts verfälschen)
}

// --- 3. composer-Lebensdaten parsen ------------------------------------------
// "1685–1750" (Halbgeviertstrich ODER Bindestrich) -> { birth: 1685, death: 1750 }.
// Nur akzeptiert, wenn BEIDE Teile 3-4-stellige Zahlen sind — sonst null
// (keine Zahlen erfinden, nur parsen, was wirklich dasteht).
function parseLifespan(s) {
  const parts = String(s || '').split(/[–—-]/).map(p => p.trim());
  if (parts.length !== 2) return null;
  if (!/^\d{3,4}$/.test(parts[0]) || !/^\d{3,4}$/.test(parts[1])) return null;
  return { birth: Number(parts[0]), death: Number(parts[1]) };
}

// --- 4. ASCII-Umlaut-Putz (sicheres Wort-Wörterbuch) --------------------------
// Wort-/Präfix-genau, damit kein korrektes Wort verstümmelt wird. Die Cultura-
// Ernte ist laut Voranalyse sauber — dies fängt rein defensiv Einzelfälle ab.
const DE_FIX = [
  ['gefaehrd', 'gefährd'], ['groesst', 'größt'], ['groesser', 'größer'],
  ['hoehe', 'höhe'], ['hoeher', 'höher'], ['laenge', 'länge'], ['laenger', 'länger'],
  ['gemaelde', 'gemälde'], ['kuenstler', 'künstler'], ['gruender', 'gründer'],
  ['fruehe', 'frühe'], ['spaete', 'späte'], ['epochenuebergreifend', 'epochenübergreifend'],
  ['suedlich', 'südlich'], ['noerdlich', 'nördlich'], ['oesterreich', 'österreich']
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

// Normalisierung für Dedup + Blacklist-Abgleich (Umlaute/Sonderzeichen weg).
// Vergleichsschlüssel für Dedup und Sperrlisten-Abgleich: einmal in
// ./lib/merge_text.js, dort auch die Begründung (CodeQA 2026-09-03).
const norm = normalizeForDedup;

// Alles ab der ersten Klammer abschneiden ("Italien (Florenz)" -> "Italien").
const beforeParen = s => String(s || '').split(' (')[0].trim();

// --- Datei-Lesen mit Wartelogik ------------------------------------------------
// Der Bild-Agent kann eine harvest-Datei gerade halb geschrieben haben. Dann
// schlägt JSON.parse fehl -> 30 s warten und genau EINEN zweiten Versuch machen.
async function readJsonWithRetry(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.warn(`  ! ${path}: JSON.parse fehlgeschlagen (${err.message}) — warte 30 s und lese erneut ...`);
    await new Promise(resolve => setTimeout(resolve, 30000));
    return JSON.parse(readFileSync(path, 'utf8')); // zweiter Fehler darf das Skript abbrechen
  }
}

/** Wendet Key-Aliase + Wert-Putz auf ein Roh-Konzept an. */
function normalizeConcept(c, warnings) {
  const alias = KEY_ALIASES[c.category] || {};
  const attrsIn = c.attributes || {};
  const attrs = {};

  // Keys umbenennen (kanonisch englisch). Kollidieren zwei Quell-Keys auf
  // demselben Ziel-Key (z.B. zwei Jahres-Angaben), gewinnt der erste — und wir
  // melden es, statt still einen Wert zu verlieren.
  for (const [k, v] of Object.entries(attrsIn)) {
    const key = alias[k] || k;
    if (key in attrs) {
      warnings.push(`${c.category}/${c.id}: Key-Kollision ${k} -> ${key} (erster Wert behalten)`);
      continue;
    }
    attrs[key] = NUM_KEYS.has(key) ? parseNumeric(v) : v;
  }

  // composer: birthYear/deathYear aus dem lifespan-String ergänzen, falls die
  // Zahlen nicht ohnehin schon da sind (w1 hat sie, w1b nicht).
  if (c.category === 'composer' && attrs.lifespan != null && attrs.birthYear == null) {
    const parsed = parseLifespan(attrs.lifespan);
    if (parsed) {
      attrs.birthYear = parsed.birth;
      attrs.deathYear = parsed.death;
    } else {
      warnings.push(`composer/${c.id}: lebensdaten "${attrs.lifespan}" nicht parsbar -> ohne birthYear`);
    }
  }

  // Wert-Putz für faire Distraktor-Pools: Klammerzusätze bei Land/Sprache weg
  // ("Italien (Florenz)" und "Italien" wären sonst zwei verschiedene Optionen).
  if (typeof attrs.originCountry === 'string') attrs.originCountry = beforeParen(attrs.originCountry);
  if (typeof attrs.language === 'string') attrs.language = beforeParen(attrs.language);

  // Auf die vom Generator erwarteten Felder reduzieren + Bild/Quelle erhalten.
  const out = {
    id: c.id,
    name: c.name,
    category: c.category,
    attributes: attrs,
    funFact: c.funFact || '',
    sourceName: c.sourceName || '',
    sourceUrl: c.sourceUrl || '',
    verifyNote: c.verifyNote || '',
    // Bildfelder für Provenance + späteres Museum mitnehmen (werden parallel
    // von einem Bild-Agenten gepflegt; wie vorgefunden durchreichen).
    imageFile: c.imageFile || '',
    imageLicense: c.imageLicense || '',
    imageAttribution: c.imageAttribution || ''
  };
  // Problem-Marker des Bild-Agenten nur mitführen, wenn er existiert.
  if (c._imgProblem !== undefined) out._imgProblem = c._imgProblem;
  // Textfixes nur auf Anzeigefelder und Attributwerte — nie auf id, URLs
  // oder Bildfelder (Regel und Begründung in ./lib/merge_text.js).
  return applyTextFix(out, deFix);
}

// --- Zusammenführen + Dedup ----------------------------------------------------
const merged = [];
const idsByCat = {};       // Kategorie -> Set(id)
const namesByCat = {};
const loosePerCat = {};   // klammerlose Namen je Kategorie — nur fuer Hinweise     // Kategorie -> Set(normalisierter Name)
const dropped = [];        // Dubletten + Blacklist-Treffer (mit Grund)
const blockedIds = [];     // IDs, die wegen der Sperrliste wegfallen dürfen
const warnings = [];
const fileStats = {};
let lifespanParsed = 0;

for (const file of FILES) {
  const arr = await readJsonWithRetry(join(HARVEST, file));
  let kept = 0;
  for (const c0 of arr) {
    // BLACKLIST zuerst: gesperrte Konzepte gar nicht erst normalisieren
    // (Regel und Begründung in ./lib/merge_blacklist.js — dieselbe für alle Merges).
    const blocked = blacklistReason(c0);
    if (blocked) {
      dropped.push({ name: c0.name, category: c0.category, reason: blocked });
      blockedIds.push(String(c0.id || ''));
      continue;
    }
    const before = warnings.length;
    const c = normalizeConcept(c0, warnings);
    if (c.category === 'composer' && c.attributes.birthYear != null && c0.attributes?.geburtsjahr == null
      && warnings.length === before) lifespanParsed++;
    (idsByCat[c.category] ||= new Set());
    (namesByCat[c.category] ||= new Set());
    const nn = norm(c.name);
    let reason = null;
    if (idsByCat[c.category].has(c.id)) reason = `id-Kollision (${c.id})`;
    else if (namesByCat[c.category].has(nn)) reason = `Name vorhanden (${c.name})`;
    // Klammerlose Gleichheit ist nur noch ein Hinweis: „Kanopus" neben
    // „Kanopus (Canopus)" ist wahrscheinlich dieselbe Sache, „David
    // (Michelangelo)" neben „David (Donatello)" aber nicht (CodeQA 2026-09-03).
    else if (loosePerCat[c.category]?.has(normalizeIgnoringParentheses(c.name))) {
      warnings.push(`Name unterscheidet sich nur im Klammerzusatz: ${c.name}`);
    }

    if (reason) { dropped.push({ name: c.name, category: c.category, reason }); continue; }
    idsByCat[c.category].add(c.id);
    namesByCat[c.category].add(nn);
    (loosePerCat[c.category] ||= new Set()).add(normalizeIgnoringParentheses(c.name));
    merged.push(c);
    kept++;
  }
  fileStats[file] = { in: arr.length, kept };
}

// --- Bericht --------------------------------------------------------------------
const byCat = {};
for (const c of merged) byCat[c.category] = (byCat[c.category] || 0) + 1;
// Qualitätskontrolle: Wie viele Komponisten haben jetzt ein birthYear?
const composers = merged.filter(c => c.category === 'composer');
const withBirth = composers.filter(c => typeof c.attributes.birthYear === 'number').length;

console.log('=== MERGE CULTURA ===');
for (const f of FILES) console.log(`  ${f.padEnd(22)} ${fileStats[f].kept}/${fileStats[f].in} behalten`);
console.log(`\nKonzepte gesamt: ${merged.length}  (verworfen ${dropped.length})`);
console.log('Nach Kategorie:', byCat);
console.log(`Komponisten mit birthYear: ${withBirth}/${composers.length}` +
  ` (davon ${lifespanParsed} aus lebensdaten-String geparst)`);
if (warnings.length) {
  console.log('\n--- Warnungen ---');
  warnings.forEach(w => console.log('  ! ' + w));
}
if (dropped.length) {
  console.log('\n--- Verworfen ---');
  dropped.forEach(d => console.log(`  - ${d.category}/${d.name} [${d.reason}]`));
}

if (WRITE) {
  // Gesperrte IDs dürfen verschwinden — sie sollen es sogar. Ohne diese
  // ausdrückliche Löschliste hielte die Sicherheitsprüfung ausgerechnet den
  // vorgesehenen Bereinigungsweg auf. Alle anderen bestehenden IDs bleiben
  // geschützt.
  assertPreservesExistingConceptIds(OUT_PATH, merged, [...BLACKLISTED, ...blockedIds]);
  writeFileSync(OUT_PATH, JSON.stringify(merged, null, 2), 'utf8');
  console.log(`\nGeschrieben: ${OUT_PATH} (${merged.length} Konzepte)`);
} else {
  console.log('\nDry-Run. Mit --write schreiben.');
}
