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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const domain = process.argv[2] || 'astra';
const conceptsPath = join(ROOT, 'public', 'data', `concepts_${domain}.json`);
const questionsPath = join(ROOT, 'public', 'data', `questions_${domain}.json`);

const concepts = JSON.parse(readFileSync(conceptsPath, 'utf8'));
const questions = JSON.parse(readFileSync(questionsPath, 'utf8'));

// Verbreitete englische Wortreste, die in deutschen Quiz-Texten nichts verloren
// haben. Bewusst eng gehalten, um Fehlalarme zu vermeiden. "planet" ist im
// Deutschen identisch ("Planet") und daher KEIN Leak -> nicht aufnehmen.
const ENGLISH_LEAK = /\b(the|moon|star|distance|diameter|orbit|galaxy)\b/i;

const errors = [];
const warnings = [];

// --- Konzepte: Provenance-Pflicht ---------------------------------------
for (const [key, c] of Object.entries(concepts)) {
  if (!c.source || !c.source.name) {
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
  if (!concepts[q.entityId]) {
    errors.push(`Frage ${tag}: entityId ${q.entityId} hat kein Konzept`);
  }
  if (ENGLISH_LEAK.test(q.prompt)) {
    warnings.push(`Frage ${tag}: moeglicher Englisch-Leak: "${q.prompt}"`);
  }
  // Fairness-Hinweis: weniger als 4 Optionen ist erlaubt, aber auffaellig
  if (q.options.length < 4) {
    warnings.push(`Frage ${tag}: nur ${q.options.length} Optionen (Kategorie hat wenig Werte)`);
  }
}

// --- Report --------------------------------------------------------------
console.log(`Domain: ${domain}`);
console.log(`Konzepte: ${Object.keys(concepts).length}, Fragen: ${questions.length}`);
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
