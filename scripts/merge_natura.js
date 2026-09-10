/**
 * Merge-Helfer für die Natura-Domain (Natur & Umwelt).
 *
 * Liest die vier Ernte-Dateien aus scripts/data_sources/harvest/natura_*.json,
 * vereinheitlicht sie und schreibt die verifizierte Faktenbasis nach
 * scripts/data_sources/natura_raw.json (Eingabe für generate_natura.js).
 *
 * Warum nötig: Die Sammelrunde lief mit ZWEI Konventionen (s. content_pipeline.md):
 *   - Teil w1  schrieb Deutsch  (maxGewichtKg, gefaehrdungsstatus, klasse="Säugetiere")
 *   - Teil w1b schrieb Englisch (maxWeightKg,  status,             klasse="Mammalia")
 * Ohne Angleichung zerfielen die kategorie-internen Distraktor-Pools des Generators
 * (zwei Schreibweisen derselben Sache nebeneinander -> unfaire/falsche MCQ-Optionen).
 *
 * Dieser Schritt macht (deterministisch, kein LLM):
 *   1. Attribut-KEYS -> kanonisch englisch je Kategorie (Synonyme zusammenführen).
 *   2. Attribut-WERTE für class + conservationStatus kanonisieren (de/lat/engl -> eine
 *      deutsche Form; IUCN-Code als stabiler Anker). Mehrdeutige Status -> Originaltext
 *      bleibt stehen, der Generator überspringt sie für die Status-Frage.
 *   3. ASCII-Umlaut-Putz (ue/ae/oe/ss -> ü/ä/ö/ß) über sicheres Wort-Wörterbuch.
 *   4. Dedup je Kategorie (id-Kollision + normalisierter Name).
 *   5. Bild- + Quellenfelder ERHALTEN (Museum/Provenance brauchen sie).
 *
 * Aufruf: node scripts/merge_natura.js          (Dry-Run, zeigt nur Befund)
 *         node scripts/merge_natura.js --write   (schreibt natura_raw.json)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { assertPreservesExistingConceptIds } from './lib/merge_safety.js';
import { applyTextFix, normalizeForDedup, normalizeIgnoringParentheses } from './lib/merge_text.js';
import { blacklistReason } from './lib/merge_blacklist.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const HARVEST = join(__dirname, 'data_sources', 'harvest');
const OUT_PATH = join(__dirname, 'data_sources', 'natura_raw.json');
const WRITE = process.argv.includes('--write');

const FILES = ['natura_a_w1.json', 'natura_a_w1b.json', 'natura_b_w1.json', 'natura_b_w1b.json'];

// --- 1. Attribut-Key-Aliase je Kategorie -> kanonisch englisch ---------------
// Nur Keys, die als Synonyme auftreten oder auf die der Generator Fragen baut.
// Übrige (Einzel-)Keys bleiben unangetastet (reine Anzeige-/Museumsdaten).
const KEY_ALIASES = {
  animal: {
    klasse: 'class',
    ordnung: 'order',
    verbreitung: 'range',
    gefaehrdungsstatus: 'conservationStatus', status: 'conservationStatus',
    maxLaengeCm: 'maxLengthCm', maxLengthCm: 'maxLengthCm',
    maxGewichtKg: 'maxWeightKg', maxWeightKg: 'maxWeightKg',
    maxSpannweiteCm: 'maxWingspanCm', fluegelspannweiteCm: 'maxWingspanCm', maxWingspanCm: 'maxWingspanCm'
  },
  plant: {
    art: 'scientificName', wissenschaftlicherName: 'scientificName',
    maxHoeheM: 'maxHeightM', maxHeightM: 'maxHeightM', heightM: 'maxHeightM',
    maxAlterJahre: 'maxAgeYears', maxAgeYears: 'maxAgeYears', ageYears: 'maxAgeYears',
    herkunft: 'origin', verbreitungsgebiet: 'origin', standortLand: 'origin'
  },
  fungus: { wissenschaftlicherName: 'scientificName' },
  mineral: { mohsHardness: 'mohsHardness', mohsHaerte: 'mohsHardness' }
};

// --- 2a. Tierklasse kanonisieren (lat./dt. -> eine deutsche Form) ------------
const CLASS_CANON = {
  mammalia: 'Säugetiere', saugetiere: 'Säugetiere',
  aves: 'Vögel', vogel: 'Vögel',
  reptilia: 'Reptilien', reptilien: 'Reptilien',
  amphibia: 'Amphibien', amphibien: 'Amphibien',
  chondrichthyes: 'Knorpelfische', knorpelfische: 'Knorpelfische',
  actinopterygii: 'Knochenfische', knochenfische: 'Knochenfische',
  cephalopoda: 'Kopffüßer', kopffusser: 'Kopffüßer',
  insecta: 'Insekten', insekten: 'Insekten',
  malacostraca: 'Höhere Krebse',
  tardigrada: 'Bärtierchen', bartierchen: 'Bärtierchen'
};

// --- 2b. Schutzstatus kanonisieren (IUCN) -----------------------------------
// Kanonische deutsche Bezeichnung + IUCN-Code. Der Code in Klammern ist der
// stabile Anker; Wort-Synonyme (engl./dt.) werden darauf abgebildet.
const STATUS_LABELS = {
  LC: 'Nicht gefährdet (LC)',
  NT: 'Potenziell gefährdet (NT)',
  VU: 'Gefährdet (VU)',
  EN: 'Stark gefährdet (EN)',
  CR: 'Vom Aussterben bedroht (CR)',
  DD: 'Ungenügende Datenlage (DD)',
  NE: 'Nicht bewertet (NE)'
};
export const STATUS_CANON_SET = new Set(Object.values(STATUS_LABELS));

/** Ermittelt den kanonischen Status oder null bei Mehrdeutigkeit. */
function statusCanon(raw) {
  const s = String(raw || '').toLowerCase();
  if (!s) return null;
  // Mehrdeutig ("je nach Art", "verschiedene Arten", Slash-Aufzählung) -> nicht kanonisieren.
  if (/je nach|je art|verschiedene|einige arten|mehrere| \/ /.test(s)) return null;
  if (/least concern|nicht gefährdet|\(lc\b|\blc\b/.test(s)) return STATUS_LABELS.LC;
  if (/critically endangered|vom aussterben|\(cr\b|\bcr\b/.test(s)) return STATUS_LABELS.CR;
  if (/near threatened|potenziell|gering gefährdet|\(nt\b|\bnt\b/.test(s)) return STATUS_LABELS.NT;
  if (/critically/.test(s)) return STATUS_LABELS.CR; // "critically" ohne "endangered"
  if (/\bendangered\b|stark gefährdet|\(en\b|\ben\b/.test(s)) return STATUS_LABELS.EN;
  if (/vulnerable|\(vu\b|\bvu\b/.test(s)) return STATUS_LABELS.VU;
  if (/data deficient|ungenügende|\(dd\b|\bdd\b/.test(s)) return STATUS_LABELS.DD;
  if (/not evaluated|nicht bewertet|nicht ausgewertet|\(ne\b|\bne\b/.test(s)) return STATUS_LABELS.NE;
  return null;
}

// --- 3. ASCII-Umlaut-Putz (sicheres Wort-Wörterbuch) ------------------------
// Wort-/Präfix-genau, damit kein korrektes Wort verstümmelt wird. Die Ernte ist
// größtenteils schon mit echten Umlauten, dies fängt nur Einzelfälle ab.
const DE_FIX = [
  ['gefaehrd', 'gefährd'], ['groesst', 'größt'], ['groesser', 'größer'], ['gross', 'groß'],
  ['hoehe', 'höhe'], ['hoeher', 'höher'], ['laenge', 'länge'], ['laenger', 'länger'],
  ['koerper', 'körper'], ['fuesse', 'füße'], ['fuss', 'fuß'], ['weiss', 'weiß'],
  ['suedlich', 'südlich'], ['noerdlich', 'nördlich'], ['waerme', 'wärme'],
  ['hoehle', 'höhle'], ['kuesten', 'küsten']
];
function deFix(s) {
  let out = String(s ?? '');
  for (const [a, b] of DE_FIX) {
    out = out.replace(new RegExp(a, 'gi'), m =>
      m[0] === m[0].toUpperCase() ? b[0].toUpperCase() + b.slice(1) : b);
  }
  return out;
}

// Normalisierung für Dedup + Wert-Lookups (Umlaute/Sonderzeichen entfernen).
// Vergleichsschlüssel für Dedup und Sperrlisten-Abgleich: einmal in
// ./lib/merge_text.js, dort auch die Begründung (CodeQA 2026-09-03).
const norm = normalizeForDedup;

// Alles ab dem ersten " (" abschneiden ("Waltiere (Cetacea)" -> "Waltiere").
const beforeParen = s => String(s || '').split(' (')[0].trim();

/** Wendet Key-Aliase + Wert-Kanonisierung auf ein Konzept an. */
function normalizeConcept(c) {
  const alias = KEY_ALIASES[c.category] || {};
  const attrsIn = c.attributes || {};
  const attrs = {};

  // Keys umbenennen (kanonisch englisch), Werte zunächst übernehmen.
  for (const [k, v] of Object.entries(attrsIn)) {
    const key = alias[k] || k;
    attrs[key] = v;
  }

  // Werte kanonisieren.
  if (attrs.class != null) {
    const canon = CLASS_CANON[norm(attrs.class)];
    attrs.class = canon || beforeParen(attrs.class); // unbekannt: wenigstens Klammern weg
  }
  if (attrs.order != null) attrs.order = beforeParen(attrs.order);
  if (attrs.conservationStatus != null) {
    // Kanonisch wenn eindeutig, sonst Originaltext behalten (Generator skippt ihn).
    attrs.conservationStatus = statusCanon(attrs.conservationStatus) || String(attrs.conservationStatus);
  }

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
    // Bildfelder für Provenance + späteres Museum mitnehmen.
    imageFile: c.imageFile || '',
    imageLicense: c.imageLicense || '',
    imageAttribution: c.imageAttribution || ''
  };
  // Textfixes nur auf Anzeigefelder und Attributwerte — nie auf id, URLs
  // oder Bildfelder (Regel und Begründung in ./lib/merge_text.js).
  return applyTextFix(out, deFix);
}

// --- Zusammenführen + Dedup --------------------------------------------------
const merged = [];
const idsByCat = {};       // Kategorie -> Set(id)
const namesByCat = {};
const loosePerCat = {};   // klammerlose Namen je Kategorie — nur fuer Hinweise     // Kategorie -> Set(normalisierter Name)
let dropped = [];
const warnings = [];      // Hinweise, die keinen Verwurf ausloesen
const blockedIds = [];   // wegen der Sperrliste verworfen — dürfen fehlen
const fileStats = {};

for (const file of FILES) {
  const arr = JSON.parse(readFileSync(join(HARVEST, file), 'utf8'));
  let kept = 0;
  for (const c0 of arr) {
    // BLACKLIST zuerst: gesperrte Konzepte gar nicht erst normalisieren
    // (Regel und Begründung in ./lib/merge_blacklist.js).
    const blocked = blacklistReason(c0);
    if (blocked) {
      dropped.push({ name: c0.name, category: c0.category, reason: blocked });
      blockedIds.push(String(c0.id || ''));
      continue;
    }
    const c = normalizeConcept(c0);
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

// --- Bericht -----------------------------------------------------------------
const byCat = {};
for (const c of merged) byCat[c.category] = (byCat[c.category] || 0) + 1;
// Status-Kanonisierungs-Quote (nur Tiere) zur Qualitätskontrolle.
const animals = merged.filter(c => c.category === 'animal');
const statusCanonCount = animals.filter(c => STATUS_CANON_SET.has(c.attributes.conservationStatus)).length;

console.log('=== MERGE NATURA ===');
for (const f of FILES) console.log(`  ${f.padEnd(20)} ${fileStats[f].kept}/${fileStats[f].in} behalten`);
console.log(`\nKonzepte gesamt: ${merged.length}  (verworfen ${dropped.length})`);
console.log('Nach Kategorie:', byCat);
console.log(`Tier-Schutzstatus kanonisch: ${statusCanonCount}/${animals.length}` +
  ` (${animals.length - statusCanonCount} mehrdeutig -> ohne Status-Frage)`);
if (warnings.length) {
  console.log('\n--- Hinweise ---');
  warnings.forEach(w => console.log('  ! ' + w));
}
if (dropped.length) {
  console.log('\n--- Verworfen (Dubletten) ---');
  dropped.forEach(d => console.log(`  - ${d.category}/${d.name} [${d.reason}]`));
}

if (WRITE) {
  assertPreservesExistingConceptIds(OUT_PATH, merged, blockedIds);
  writeFileSync(OUT_PATH, JSON.stringify(merged, null, 2), 'utf8');
  console.log(`\nGeschrieben: ${OUT_PATH} (${merged.length} Konzepte)`);
} else {
  console.log('\nDry-Run. Mit --write schreiben.');
}
