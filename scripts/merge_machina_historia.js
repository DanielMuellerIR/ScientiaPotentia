/**
 * Gate + Merge für die neuen Domains Machina + Historia.
 *
 * Liest alle Kandidatendateien aus scripts/data_sources/harvest/cand_<domain>_*.json,
 * validiert sie strukturell, dedupliziert (id + normalisierter Name je Domain),
 * meldet Verdachtsfälle (unbekannte Kategorie, fehlende Quelle, ASCII-Umlaut-Reste)
 * und schreibt die zusammengeführte Faktenbasis:
 *   - scripts/data_sources/machina_raw.json
 *   - scripts/data_sources/historia_raw.json
 *
 * Dies ist die GATE-Stufe: rein mechanische Konsolidierung + Warnungen. Die
 * inhaltliche Faktenprüfung (adversarial + Stichprobe) passiert separat, bevor
 * committet wird. Bewusst KEIN automatisches Verwerfen bei Warnungen — erst
 * sichten.
 *
 * Aufruf:
 *   node scripts/merge_machina_historia.js            # schreibt nur bei 0 harten Fehlern
 *   node scripts/merge_machina_historia.js --dry-run  # nur Bericht, nichts schreiben
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARVEST = join(__dirname, 'data_sources', 'harvest');
const OUT = {
  machina: join(__dirname, 'data_sources', 'machina_raw.json'),
  historia: join(__dirname, 'data_sources', 'historia_raw.json')
};

const DRY = process.argv.includes('--dry-run');

// Erlaubte Kategorien je Domain (müssen zu den Generatoren passen).
const CATEGORIES = {
  machina: new Set(['programming_language', 'file_format', 'network_protocol',
    'data_structure', 'algorithm', 'hardware', 'acronym', 'concept']),
  historia: new Set(['invention', 'discovery', 'epoch', 'figure', 'milestone', 'expedition'])
};

// Häufige deutsche Wörter, die auf fehlende Umlaute hindeuten (kuratiert, um
// Fehlalarme bei korrekten Wörtern wie "Masse"/"Wasser" klein zu halten).
const ASCII_UMLAUT_HINTS = /\b(fuer|ueber|koennen|muessen|groesste|groesser|naechste|spaeter|waehrend|gehoert|loeste|Loesung|Koerper|beruehmt|Aegypten|Strasse|Fluesse|Voegel|Saeuger|Universalgelehrte|gegruendet|fruehe|spaetere|Erklaerung|Entwaesserung)\b/i;

function norm(s) {
  return String(s ?? '').toLowerCase()
    .replace(/ß/g, 'ss').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

const errors = [];
const warnings = [];

/** Liest + parst eine Kandidatendatei; bei JSON-Fehler harter Fehler. */
function loadCandidate(file) {
  const path = join(HARVEST, file);
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(data)) { errors.push(`${file}: kein JSON-Array`); return []; }
    return data.map(c => ({ ...c, _file: file }));
  } catch (e) {
    errors.push(`${file}: JSON nicht parsebar (${e.message})`);
    return [];
  }
}

function processDomain(domain) {
  const prefix = `cand_${domain}_`;
  const files = readdirSync(HARVEST).filter(f => f.startsWith(prefix) && f.endsWith('.json'));
  const all = files.flatMap(loadCandidate);

  const byId = new Map();
  const byName = new Map();
  const out = [];

  for (const c of all) {
    const where = `${domain}/${c._file}`;
    // Pflichtfelder
    if (!c.id || !c.name || !c.category) {
      errors.push(`${where}: Konzept ohne id/name/category (${JSON.stringify(c.name || c.id || '?')})`);
      continue;
    }
    if (!CATEGORIES[domain].has(c.category)) {
      warnings.push(`${where}: unbekannte Kategorie "${c.category}" bei "${c.name}"`);
    }
    if (!c.attributes || typeof c.attributes !== 'object' || Array.isArray(c.attributes)) {
      errors.push(`${where}: "${c.name}" hat kein attributes-Objekt`);
      continue;
    }
    if (!c.sourceName) {
      warnings.push(`${where}: "${c.name}" ohne sourceName (Provenance fehlt)`);
    }
    // Dedup nach id
    if (byId.has(c.id)) {
      warnings.push(`${where}: doppelte id "${c.id}" -> übersprungen (zuerst aus ${byId.get(c.id)})`);
      continue;
    }
    // Dedup nach normalisiertem Namen (innerhalb derselben Kategorie strenger melden)
    const nkey = `${c.category}|${norm(c.name)}`;
    if (byName.has(nkey)) {
      warnings.push(`${where}: Name-Dublette "${c.name}" (${c.category}) -> übersprungen`);
      continue;
    }
    // ASCII-Umlaut-Verdacht (Pflicht: echte Umlaute)
    const blob = JSON.stringify(c);
    if (ASCII_UMLAUT_HINTS.test(blob)) {
      warnings.push(`${where}: ASCII-Umlaut-Verdacht bei "${c.name}" (echte Umlaute prüfen)`);
    }

    byId.set(c.id, c._file);
    byName.set(nkey, true);
    // _file nicht mit rausschreiben.
    const { _file, ...clean } = c;
    out.push(clean);
  }

  // Kategorie-Statistik
  const byCat = {};
  for (const c of out) byCat[c.category] = (byCat[c.category] || 0) + 1;

  console.log(`\n=== ${domain} ===`);
  console.log(`Dateien: ${files.length} (${files.join(', ')})`);
  console.log(`Konzepte nach Gate: ${out.length}`);
  console.log('Nach Kategorie:', byCat);

  return out;
}

const result = {};
for (const domain of Object.keys(OUT)) {
  result[domain] = processDomain(domain);
}

console.log('\n--- Warnungen ---');
if (warnings.length) warnings.forEach(w => console.log('  ! ' + w));
else console.log('  (keine)');

if (errors.length) {
  console.log('\n--- HARTE FEHLER (nichts geschrieben) ---');
  errors.forEach(e => console.log('  x ' + e));
  process.exit(1);
}

if (DRY) {
  console.log('\n[DRY-RUN] Nichts geschrieben.');
} else {
  for (const [domain, concepts] of Object.entries(result)) {
    writeFileSync(OUT[domain], JSON.stringify(concepts, null, 2), 'utf8');
    console.log(`\nGeschrieben: ${OUT[domain]} (${concepts.length} Konzepte)`);
  }
}
