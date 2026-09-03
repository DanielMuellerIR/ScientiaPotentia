/**
 * Struktur- und Provenance-Pruefung fuer einen Domain-Fragenkatalog.
 *
 * Prueft (laut Plan, Abschnitt 8):
 *   - jedes Konzept hat eine Quelle (source.name)  [Provenance-Pflicht]
 *   - jede Frage hat >= 2 Optionen inkl. korrekter Antwort
 *   - Optionen sind eindeutig (keine Dubletten)
 *   - jede Frage referenziert ein existierendes Konzept (entityId)
 *   - keine offensichtlichen Englisch-Leaks in deutschen Prompts
 *
 * Faktenkorrektheit wird hier NICHT behauptet — die liegt in der verifizierten
 * Faktenbasis (scripts/data_sources/<domain>_raw.json + manueller Stichprobe).
 *
 * Aufruf: node scripts/verify_facts.js astra
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hasEnglishLeak } from './lib/english_leak.js';
// Dieselbe Regel, die auch das Fragen-Audit verwendet: `click-map` verlangt
// keine Antwortoptionen, weil der Spieler dort direkt auf die Karte klickt.
// Ohne sie meldete diese Pruefung alle 427 Terra-Kartenfragen als Strukturfehler.
import { expectsOptions } from './lib/audit_rules.cjs';
// Dieselbe JSX-freie Bereichsliste, aus der auch der Statistik-Generator seine
// IDs und das Geodb-Flag liest. So kennt die Pruefung genau die Bereiche, die
// es wirklich gibt, statt jeden getippten Namen als Domain zu behandeln.
import { DOMAIN_CONFIGS } from '../src/domains/metadata.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const DOMAINS = DOMAIN_CONFIGS.filter(entry => entry.hasOwnContent);
const domain = process.argv[2] || 'astra';
const config = DOMAINS.find(entry => entry.id === domain);
if (!config) {
  console.error(`Unbekannter Bereich: ${domain}`);
  console.error(`Moeglich sind: ${DOMAINS.map(entry => entry.id).join(', ')}`);
  process.exit(2);
}

/**
 * Konzepte des Bereichs als Map id -> Konzept.
 * Terra ist der Sonderfall: Seine "Konzepte" sind die Kartenobjekte der
 * gebuendelten src/data/geodb.json; eine concepts_terra.json gibt es nicht.
 * Frueher lief das Skript dafuer in einen rohen ENOENT-Stacktrace.
 */
function loadConcepts() {
  if (config.usesGeodb) {
    const geodb = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'geodb.json'), 'utf8'));
    return geodb.entities || {};
  }
  return JSON.parse(readFileSync(join(ROOT, 'public', 'data', `concepts_${domain}.json`), 'utf8'));
}

const concepts = loadConcepts();
const questions = JSON.parse(
  readFileSync(join(ROOT, 'public', 'data', `questions_${domain}.json`), 'utf8'));

const errors = [];
const warnings = [];

// --- Konzepte: Provenance-Pflicht ---------------------------------------
// Die Geodb traegt ihre Herkunft nicht je Kartenobjekt, sondern zentral in
// THIRD_PARTY_NOTICES.md (Natural Earth, GeoNames). Eine Quellenpflicht je
// Eintrag wuerde dort 1.852 Scheinfehler melden, darum entfaellt sie fuer Terra.
for (const [key, c] of Object.entries(concepts)) {
  if (!config.usesGeodb && (!c.source || !c.source.name)) {
    errors.push(`Konzept ${key}: keine Quelle (source.name fehlt)`);
  }
  if (!c.name) errors.push(`Konzept ${key}: kein name`);
}

// --- Fragen --------------------------------------------------------------
const ids = new Set();
for (const q of questions) {
  const tag = q.id || q.entityId || '???';

  if (ids.has(q.id)) errors.push(`Frage ${tag}: doppelte id`);
  ids.add(q.id);

  if (typeof q.correctAnswer !== 'string' || q.correctAnswer.trim() === '') {
    errors.push(`Frage ${tag}: correctAnswer fehlt oder ist leer`);
  }
  if (!concepts[q.entityId]) {
    errors.push(`Frage ${tag}: entityId ${q.entityId} hat kein Konzept`);
  }
  if (hasEnglishLeak(domain, q.prompt)) {
    warnings.push(`Frage ${tag}: moeglicher Englisch-Leak: "${q.prompt}"`);
  }

  if (!expectsOptions(q.type)) {
    // Kartenfrage: statt Optionen braucht sie ein anklickbares Ziel.
    if (!q.mapTargetId) errors.push(`Frage ${tag}: Kartenfrage ohne mapTargetId`);
    continue;
  }

  if (!Array.isArray(q.options) || q.options.length < 2) {
    errors.push(`Frage ${tag}: weniger als 2 Optionen`);
    continue;
  }
  if (!q.options.includes(q.correctAnswer)) {
    errors.push(`Frage ${tag}: correctAnswer nicht in options`);
  }
  if (new Set(q.options).size !== q.options.length) {
    errors.push(`Frage ${tag}: doppelte Optionen`);
  }
  // Fairness-Hinweis: weniger als 4 Optionen ist erlaubt, aber auffaellig
  if (q.options.length < 4) {
    warnings.push(`Frage ${tag}: nur ${q.options.length} Optionen (Kategorie hat wenig Werte)`);
  }
}

// --- Report --------------------------------------------------------------
console.log(`Domain: ${domain}`);
console.log(`${config.usesGeodb ? 'Kartenobjekte' : 'Konzepte'}: ${Object.keys(concepts).length}`
  + `, Fragen: ${questions.length}`);
if (config.usesGeodb) {
  console.log('Quellenpflicht je Eintrag entfaellt: Geodb-Herkunft steht in THIRD_PARTY_NOTICES.md.');
}
console.log(`Fehler: ${errors.length}, Warnungen: ${warnings.length}`);
if (warnings.length) {
  console.log('\n--- Warnungen ---');
  warnings.forEach(w => console.log('  ! ' + w));
}
if (errors.length) {
  console.log('\n--- FEHLER ---');
  errors.forEach(e => console.log('  x ' + e));
  process.exit(1);
}
console.log('\nStruktur- und Provenance-Pruefung bestanden.');
