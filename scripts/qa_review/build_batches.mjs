/**
 * QA-Batch-Builder — Schritt 1 der MiniMax-Qualitätssicherung.
 *
 * Zweck: Aus den generierten Fragen (questions_<domain>.json) eine STRATIFIZIERTE
 * Stichprobe ziehen und für jede Frage exakt das nachbilden, WAS der Spieler vor dem
 * Antworten sieht — Prompt, Optionen, und der Text des linken Panels (Kategorie,
 * Name-oder-„?", die ≤6 sichtbaren Kennwerte nach Selbstverräter-Guard, Quelle).
 * Diese „Spieler-Sicht" geht anschließend gebündelt an MiniMax zur Bewertung
 * (scripts/qa_review/run_qa.py).
 *
 * Warum stratifiziert statt zufällig: Fragen entstehen aus TEMPLATES (Feld `type`)
 * über viele Konzepte. Ein Defekt in einem Template betrifft potenziell tausende
 * Fragen. Indem wir pro (domain × type) nur k Instanzen ziehen, „deckt" jede
 * Bewertung eine ganze Template-Familie ab — das nutzt das MiniMax-Volumen effizient
 * (systematische Fehler finden statt Einzelfälle).
 *
 * WICHTIG (Panel-Treue): Die Filterlogik hier MUSS deckungsgleich mit ConceptVisual.jsx
 * sein. Beide beziehen die Label-Tabellen + Guard-Mengen aus der geteilten Quelle
 * src/components/conceptLabels.js — driftet das eine, driftet das andere nicht mehr.
 *
 * Grenzen: Die 5 generischen Domains (natura/cultura/lingua/machina/historia) zeigen
 * im Quiz die Attribut-Karte (kein Bild — das lebt nur im Museum). Astra (3D-Planet)
 * und Homo (Anatomie) haben eigene grafische Visuals; für sie bildet dieses Skript
 * nur Prompt+Optionen ab und markiert das Panel als „grafisch" (visuelle
 * Giveaway-Prüfung braucht ein Vision-Modell → separater Schritt). Terra (Karte) ist
 * ausgeklammert.
 *
 * Aufruf:
 *   node scripts/qa_review/build_batches.mjs --domain natura --per-type 2 --batch 20 \
 *        --seed 42 --out <dir>
 *   node scripts/qa_review/build_batches.mjs --domain all --per-type 1 --out <dir>
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  CATEGORY_LABELS, ATTR_LABELS, POST_ANSWER_ATTRS, CORRELATED_ATTRS
} from '../../src/components/conceptLabels.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'public', 'data');

// Domains mit generischem ConceptVisual (Attribut-Karte, text-getreu rekonstruierbar).
const GENERIC_DOMAINS = ['natura', 'cultura', 'lingua', 'machina', 'historia'];
// Domains mit eigener grafischer Visualisierung (nur Prompt+Optionen; Panel „grafisch").
const VISUAL_DOMAINS = { astra: '3D-Planetensystem', homo: 'Anatomie-Grafik' };

// --- Mini-PRNG (mulberry32), damit die Stichprobe bei gleichem --seed reproduzierbar ist.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates mit gegebenem rng.
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Bildet den Text des linken Panels nach — exakt die Filterlogik aus ConceptVisual.jsx
 * (Zustand: Frage noch NICHT beantwortet, also detailsUnlocked=false).
 */
function reconstructPanel(concept, question) {
  const answerIsName = Boolean(question.answerIsName);
  const hideConceptIdentity = Boolean(question.hideConceptIdentity);
  const testedAttribute = question.testedAttribute ?? null;
  const hideIdentity = answerIsName || hideConceptIdentity; // detailsUnlocked=false

  const categoryKey = concept?.category || concept?.type || '';
  const categoryLabel = CATEGORY_LABELS[categoryKey] || categoryKey;
  const attrs = concept?.attributes || {};

  const attrEntries = hideIdentity
    ? []
    : Object.entries(attrs)
      .filter(([k, v]) =>
        v !== undefined && v !== null && v !== '' &&
        k !== 'unit' &&
        k !== testedAttribute &&
        k !== CORRELATED_ATTRS[testedAttribute] &&
        !POST_ANSWER_ATTRS.has(k))
      .slice(0, 6);

  const visibleAttrs = attrEntries.map(([k, v]) => ({
    label: ATTR_LABELS[k] || k,
    value: String(v) + (k === 'value' && attrs.unit ? ` ${attrs.unit}` : '')
  }));

  // Quellen-Selbstverraeter-Guard (deckungsgleich mit ConceptVisual.jsx): Quelle vor
  // der Antwort verbergen, wenn Identitaet verborgen ist oder der Quellname den
  // gefragten Wert enthaelt ("Grzimeks Tierleben – Vögel" bei der Klassenfrage).
  const testedValue = testedAttribute != null ? attrs[testedAttribute] : null;
  const rawSource = concept?.source?.name || '';
  const sourceLeaks = hideIdentity ||
    (testedValue != null && String(testedValue).length >= 3 && rawSource.includes(String(testedValue)));

  return {
    categoryLabel,
    name: hideIdentity ? '?' : (concept?.name || '—'),
    identityHidden: hideIdentity,
    visibleAttrs,
    sourceName: (rawSource && !sourceLeaks) ? rawSource : null,
    hasImageInMuseum: Boolean(concept?.image) // NICHT im Quiz sichtbar, nur Info
  };
}

// Baut die kompakte „Spieler-Sicht" einer einzelnen Frage.
function buildView(domain, question, concept) {
  const base = {
    id: question.id,
    domain,
    type: question.type,
    category: concept?.category || concept?.type || null,
    prompt: question.prompt,
    options: question.options,
    keyedAnswer: question.correctAnswer,
    answerIsName: Boolean(question.answerIsName),
    testedAttribute: question.testedAttribute ?? null
  };
  if (GENERIC_DOMAINS.includes(domain)) {
    base.panelType = 'karte';
    base.panel = reconstructPanel(concept, question);
  } else if (VISUAL_DOMAINS[domain]) {
    base.panelType = 'grafisch';
    base.panelNote = VISUAL_DOMAINS[domain] +
      (Boolean(question.answerIsName) ? ' (Konzept-Identität vor Antwort verborgen)' : '');
  }
  return base;
}

function loadDomain(domain) {
  const questions = JSON.parse(readFileSync(join(DATA_DIR, `questions_${domain}.json`), 'utf8'));
  const concepts = JSON.parse(readFileSync(join(DATA_DIR, `concepts_${domain}.json`), 'utf8'));
  return { questions, concepts };
}

// Stratifizierte Stichprobe: pro `type` bis zu perType Fragen (seed-reproduzierbar).
function sampleDomain(domain, perType, rng) {
  const { questions, concepts } = loadDomain(domain);
  const byType = new Map();
  for (const q of questions) {
    if (!byType.has(q.type)) byType.set(q.type, []);
    byType.get(q.type).push(q);
  }
  const views = [];
  for (const [, qs] of [...byType.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const picked = shuffle(qs, rng).slice(0, perType);
    for (const q of picked) {
      const concept = concepts[q.entityId];
      views.push(buildView(domain, q, concept));
    }
  }
  return views;
}

function parseArgs(argv) {
  const args = { domain: 'all', perType: 2, batch: 20, seed: 42, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--domain') args.domain = argv[++i];
    else if (a === '--per-type') args.perType = parseInt(argv[++i], 10);
    else if (a === '--batch') args.batch = parseInt(argv[++i], 10);
    else if (a === '--seed') args.seed = parseInt(argv[++i], 10);
    else if (a === '--out') args.out = argv[++i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.out) { console.error('FEHLER: --out <dir> erforderlich'); process.exit(2); }
  mkdirSync(args.out, { recursive: true });

  const rng = mulberry32(args.seed);
  const domains = args.domain === 'all'
    ? [...GENERIC_DOMAINS, ...Object.keys(VISUAL_DOMAINS)]
    : args.domain === 'generic'
      ? GENERIC_DOMAINS
      : args.domain.split(',').map(d => d.trim());

  let allViews = [];
  for (const d of domains) allViews = allViews.concat(sampleDomain(d, args.perType, rng));

  // In Batches schneiden und schreiben.
  const batches = [];
  for (let i = 0; i < allViews.length; i += args.batch) {
    batches.push(allViews.slice(i, i + args.batch));
  }
  batches.forEach((b, idx) => {
    const name = `batch_${String(idx).padStart(3, '0')}.json`;
    writeFileSync(join(args.out, name), JSON.stringify(b, null, 2));
  });

  const manifest = {
    seed: args.seed, perType: args.perType, batchSize: args.batch,
    domains, totalQuestions: allViews.length, batchCount: batches.length,
    byDomain: Object.fromEntries(domains.map(d => [d, allViews.filter(v => v.domain === d).length]))
  };
  writeFileSync(join(args.out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}

main();
