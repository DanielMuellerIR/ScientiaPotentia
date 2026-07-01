/**
 * Generator für die Historia-Domain (Geschichte).
 *
 * Liest die verifizierte Faktenbasis aus scripts/data_sources/historia_raw.json
 * und schreibt:
 *   - public/data/concepts_historia.json  : Konzeptspeicher (Map key -> Konzept)
 *   - public/data/questions_historia.json : generierte Multiple-Choice-Fragen
 *
 * Ordnungsachse laut docs/bereichs_abgrenzung.md: **Zeit / Ereignis / Urheberschaft**
 * ("Wann / durch wen / in welcher Epoche …?"). Schwerpunkt Kultur-/Wissenschafts-/
 * Technikgeschichte (Erfindungen, Entdeckungen, Epochen, Entdecker, Forscher).
 *
 * Politik-Ausschluss (AGENTS.md → Inhaltsregeln, GLOBAL): Gegenwarts-/Tagespolitik,
 * Parteien/Wahlen/Regierungen sowie -ismen-Wertungen bleiben komplett draußen.
 * Historische Politik nur als nüchterne datierbare Fakten OHNE Wertung. Dieser
 * Generator erzwingt das nicht technisch — die Faktenbasis (historia_raw.json) muss
 * politikfrei kuratiert sein (Gate-Stufe der Recherche).
 *
 * Aufruf: node scripts/generate_historia.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { seededShuffle, pickBalanced, pickNumeric } from './lib/quizrandom.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW_PATH = join(__dirname, 'data_sources', 'historia_raw.json');
const CONCEPTS_OUT = join(ROOT, 'public', 'data', 'concepts_historia.json');
const QUESTIONS_OUT = join(ROOT, 'public', 'data', 'questions_historia.json');

const DOMAIN = 'historia';

// --- kleine Helfer (Engine wie Cultura) ------------------------------------

function deNum(value) {
  if (typeof value !== 'number') value = Number(value);
  if (!isFinite(value)) return String(value);
  return value.toLocaleString('de-DE', { maximumFractionDigits: 4 });
}

function cleanNum(v) {
  if (typeof v === 'number') return (isFinite(v) && v > 0) ? v : null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (/^[0-9]+([.,][0-9]+)?$/.test(t)) return Number(t.replace(',', '.'));
  }
  return null;
}

/**
 * Jahres-Putz: nur positive 3-4-stellige Ganzzahlen sind gültige Jahre für
 * numerische Fragen. Negative Jahre (v. Chr.), Bereiche ("1914–1918") und
 * "ca."-Angaben fallen heraus — nichts verfälschen, lieber keine Frage.
 * (Antike v.-Chr.-Daten werden so bewusst NICHT als Jahres-Frage gestellt.)
 */
function cleanYear(v) {
  if (typeof v === 'number') return (Number.isInteger(v) && v >= 100 && v <= 2100) ? v : null;
  if (typeof v === 'string' && /^\d{3,4}$/.test(v.trim())) return Number(v.trim());
  return null;
}

/** Jahre OHNE Tausenderpunkt formatieren ("1885", nicht "1.885"). */
const yearFmt = v => String(v);

// Alles ab der ersten Klammer abschneiden ("Buchdruck (Europa)" -> "Buchdruck").
const beforeParen = s => String(s || '').split(' (')[0].trim();

function norm(s) {
  return String(s ?? '').toLowerCase()
    .replace(/ß/g, 'ss').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function containsEitherWay(a, b) {
  const A = norm(a).replace(/ /g, ''), B = norm(b).replace(/ /g, '');
  if (!A || !B) return false;
  return A.includes(B) || B.includes(A);
}

// --- Selbstverräter-Schutz (Basis wie Cultura) ----------------------------
function revealsAnswer(subject, answer) {
  const S = norm(subject), A = norm(answer);
  const sNo = S.replace(/ /g, ''), aNo = A.replace(/ /g, '');
  if (!sNo || !aNo) return false;
  if (aNo.length >= 3 && sNo.includes(aNo)) return true;
  if (sNo.length >= 3 && aNo.includes(sNo)) return true;
  const sTokens = S.split(' ').filter(t => t.length >= 4);
  const aTokens = A.split(' ').filter(t => t.length >= 4);
  for (const t of aTokens) if (sNo.includes(t)) return true;
  const ACore = norm(String(answer).replace(/\([^)]*\)/g, ' '));
  const aCoreNo = ACore.replace(/ /g, '');
  const aCoreTokens = ACore.split(' ').filter(t => t.length >= 4);
  for (const t of sTokens) if (t.length >= 5 && aCoreNo.includes(t)) return true;
  for (const st of sTokens) for (const at of aCoreTokens) {
    if (st.slice(0, 4) === at.slice(0, 4)) return true;
  }
  return false;
}

// --- Distraktor-Auswahl (identisch zur Cultura-Engine) ---------------------

function pickCategorical(correct, pool, k = 3) {
  // längen-balanciert statt Pool-Reihenfolge: `.slice(0,k)` nahm sonst feste
  // erste-k Einträge → Längen-Bias (richtige Antwort fast immer längste/kürzeste).
  return pickBalanced(correct, [...new Set(pool.map(String))]
    .filter(v => v !== String(correct))
    .filter(v => !containsEitherWay(v, correct)), k);
}

// pickNumeric: jetzt zentral in ./lib/quizrandom.js (mit Proximity-Guard fuer Messgroessen).


function pickNames(correctName, subjectValue, pool, k = 3) {
  const subjNorm = norm(subjectValue);
  const candidates = pool
    .filter(p => p.name !== correctName && norm(p.value) !== subjNorm)
    .filter(p => !containsEitherWay(p.name, correctName));
  const cl = String(correctName).length;
  const shuffled = seededShuffle(candidates, correctName);
  shuffled.sort((a, b) => {
    const pa = a.name.includes('(') ? 1 : 0, pb = b.name.includes('(') ? 1 : 0;
    if (pa !== pb) return pa - pb;
    return Math.abs(a.name.length - cl) - Math.abs(b.name.length - cl);
  });
  return [...new Set(shuffled.map(p => p.name))].slice(0, k);
}

// --- Faktenbasis laden ----------------------------------------------------
const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));

const byCategory = {};
for (const c of raw) (byCategory[c.category] ||= []).push(c);

// --- Konzeptspeicher bauen --------------------------------------------------
const concepts = {};
for (const c of raw) {
  const key = `${DOMAIN}:${c.id}`;
  concepts[key] = {
    id: key,
    name: c.name,
    type: c.category,
    category: c.category,
    attributes: c.attributes,
    funFact: c.funFact || '',
    source: { name: c.sourceName, url: c.sourceUrl || '' },
    image: c.imageFile
      ? { url: c.imageFile, license: c.imageLicense || '', attribution: c.imageAttribution || '' }
      : null
  };
}

// --- Frage-Templates ---------------------------------------------------------
const templates = [
  // ==== Erfindungen (invention) ===========================================
  {
    category: 'invention', attr: 'inventor', kind: 'cat', type: 'historia-invention-inventor', difficulty: 3,
    prompt: c => `Wer gilt als Erfinder/Entwickler von „${beforeParen(c.name)}“?`,
    skip: c => /unbekannt|umstritten/i.test(String(c.attributes.inventor || ''))
  },
  {
    category: 'invention', attr: 'year', kind: 'num', type: 'historia-invention-year', difficulty: 4,
    prompt: c => `In welchem Jahr wurde „${beforeParen(c.name)}“ (etwa) erfunden?`,
    clean: cleanYear, format: yearFmt
  },
  {
    category: 'invention', attr: 'country', kind: 'cat', type: 'historia-invention-country', difficulty: 3,
    prompt: c => `In welchem Land entstand die Erfindung „${beforeParen(c.name)}“?`
  },
  {
    category: 'invention', attr: 'field', kind: 'cat', type: 'historia-invention-field', difficulty: 2,
    prompt: c => `Welchem Bereich ist die Erfindung „${beforeParen(c.name)}“ zuzuordnen?`
  },
  // Reverse: vom Erfinder auf die Erfindung.
  {
    category: 'invention', attr: 'inventor', kind: 'name', type: 'historia-invention-inventor-rev', difficulty: 3,
    prompt: c => `Welche dieser Erfindungen geht auf ${beforeParen(String(c.attributes.inventor))} zurück?`,
    skip: c => /unbekannt|umstritten/i.test(String(c.attributes.inventor || ''))
  },

  // ==== Entdeckungen (discovery) ==========================================
  {
    category: 'discovery', attr: 'discoverer', kind: 'cat', type: 'historia-discovery-discoverer', difficulty: 3,
    prompt: c => `Wer entdeckte/beschrieb „${beforeParen(c.name)}“ als Erster?`,
    skip: c => /unbekannt|umstritten/i.test(String(c.attributes.discoverer || ''))
  },
  {
    category: 'discovery', attr: 'year', kind: 'num', type: 'historia-discovery-year', difficulty: 4,
    prompt: c => `In welchem Jahr erfolgte die Entdeckung von „${beforeParen(c.name)}“?`,
    clean: cleanYear, format: yearFmt
  },
  {
    category: 'discovery', attr: 'field', kind: 'cat', type: 'historia-discovery-field', difficulty: 2,
    prompt: c => `Welchem Wissensgebiet ist die Entdeckung „${beforeParen(c.name)}“ zuzuordnen?`
  },
  {
    category: 'discovery', attr: 'discoverer', kind: 'name', type: 'historia-discovery-discoverer-rev', difficulty: 3,
    prompt: c => `Welche dieser Entdeckungen geht auf ${beforeParen(String(c.attributes.discoverer))} zurück?`,
    skip: c => /unbekannt|umstritten/i.test(String(c.attributes.discoverer || ''))
  },

  // ==== Epochen / Zeitabschnitte (epoch) ==================================
  {
    category: 'epoch', attr: 'startYear', kind: 'num', type: 'historia-epoch-start', difficulty: 4,
    prompt: c => `Um welches Jahr begann die Epoche „${beforeParen(c.name)}“ (in Europa)?`,
    clean: cleanYear, format: yearFmt
  },
  {
    category: 'epoch', attr: 'region', kind: 'cat', type: 'historia-epoch-region', difficulty: 3,
    prompt: c => `Mit welcher Region wird die Epoche „${beforeParen(c.name)}“ vor allem verbunden?`
  },
  {
    category: 'epoch', attr: 'precededBy', kind: 'cat', type: 'historia-epoch-preceded', difficulty: 4,
    prompt: c => `Welche Epoche ging „${beforeParen(c.name)}“ unmittelbar voraus?`
  },

  // ==== Forscher / Entdecker / Erfinder (figure) ==========================
  // Wissenschaft / Technik / Exploration — KEINE Politiker, KEINE Wertungen.
  {
    category: 'figure', attr: 'field', kind: 'cat', type: 'historia-figure-field', difficulty: 2,
    prompt: c => `In welchem Gebiet wirkte ${c.name} hauptsächlich?`
  },
  {
    category: 'figure', attr: 'nationality', kind: 'cat', type: 'historia-figure-nationality', difficulty: 3,
    prompt: c => `Welcher Nation wird ${c.name} zugerechnet?`
  },
  {
    category: 'figure', attr: 'birthYear', kind: 'num', type: 'historia-figure-birthyear', difficulty: 4,
    prompt: c => `In welchem Jahr wurde ${c.name} geboren?`,
    clean: cleanYear, format: yearFmt
  },
  // Reverse: von der Leistung auf die Person. knownFor ist je Person eindeutig.
  {
    category: 'figure', attr: 'knownFor', kind: 'name', type: 'historia-figure-knownfor-rev', difficulty: 3,
    prompt: c => `Wer ist bekannt für „${c.attributes.knownFor}“?`,
    skip: c => !c.attributes.knownFor
  },

  // ==== Meilensteine / datierbare Ereignisse (milestone) ==================
  {
    category: 'milestone', attr: 'year', kind: 'num', type: 'historia-milestone-year', difficulty: 4,
    prompt: c => `In welchem Jahr ereignete sich „${beforeParen(c.name)}“?`,
    clean: cleanYear, format: yearFmt
  },
  {
    category: 'milestone', attr: 'protagonist', kind: 'cat', type: 'historia-milestone-protagonist', difficulty: 3,
    prompt: c => `Welche Person/Gruppe steht im Zentrum von „${beforeParen(c.name)}“?`,
    skip: c => /unbekannt/i.test(String(c.attributes.protagonist || ''))
  },
  {
    category: 'milestone', attr: 'field', kind: 'cat', type: 'historia-milestone-field', difficulty: 2,
    prompt: c => `Welchem Bereich ist das Ereignis „${beforeParen(c.name)}“ zuzuordnen?`
  },

  // ==== Entdeckungsreisen / Expeditionen (expedition) =====================
  {
    category: 'expedition', attr: 'explorer', kind: 'cat', type: 'historia-expedition-explorer', difficulty: 3,
    prompt: c => `Wer leitete die Expedition/Reise „${beforeParen(c.name)}”?`,
    // Mehrstimmige Einträge (“Lewis, Clark”) überspringen — kein einzelner Name als Antwort.
    skip: c => /,/.test(String(c.attributes.explorer || ''))
  },
  {
    category: 'expedition', attr: 'year', kind: 'num', type: 'historia-expedition-year', difficulty: 4,
    prompt: c => `In welchem Jahr fand „${beforeParen(c.name)}” statt (Beginn)?`,
    clean: cleanYear, format: yearFmt
  },
  {
    category: 'expedition', attr: 'region', kind: 'cat', type: 'historia-expedition-region', difficulty: 3,
    prompt: c => `Welche Region war Ziel der Reise „${beforeParen(c.name)}”?`
  },
  // Reverse: Vom Entdecker auf die Expedition.
  {
    category: 'expedition', attr: 'explorer', kind: 'name', type: 'historia-expedition-explorer-rev', difficulty: 3,
    prompt: c => `Welche dieser Expeditionen leitete ${beforeParen(String(c.attributes.explorer))}?`,
    // Mehrstimmige Einträge und Selbstverräter (Expeditionsname enthält Erkundernamen) ausschließen.
    skip: c => /,/.test(String(c.attributes.explorer || ''))
  },

  // ==== Epochen: Endjahr (epoch) ==========================================
  // cleanYear filtert v.-Chr.-Jahres-Zahlen (negativ) automatisch heraus.
  {
    category: 'epoch', attr: 'endYear', kind: 'num', type: 'historia-epoch-end', difficulty: 4,
    prompt: c => `Um welches Jahr endete die Epoche „${beforeParen(c.name)}"?`,
    clean: cleanYear, format: yearFmt
  },

  // ==== Forscher: knownFor Vorwärts (figure) ==============================
  // Vorwärts: Für welche Leistung ist die genannte Person bekannt?
  // Selbstverräter-Guard prüft, ob Personenname in der knownFor-Beschreibung steckt.
  {
    category: 'figure', attr: 'knownFor', kind: 'cat', type: 'historia-figure-knownfor', difficulty: 3,
    prompt: c => `Wofür ist ${c.name} in erster Linie bekannt?`,
    skip: c => !c.attributes.knownFor
  },

  // ==== Reverse-Hebel (mehr Fragetypen je Konzept, token-frei) =============
  // kind:'name': Antwort = Konzeptname; pickNames garantiert, dass nur EINE der
  // 4 Optionen die genannte Eigenschaft (Bereich/Land/Nation/Region) erfüllt.
  {
    category: 'invention', attr: 'field', kind: 'name', type: 'historia-invention-field-rev', difficulty: 3,
    prompt: c => `Welche dieser Erfindungen gehört zum Bereich „${c.attributes.field}“?`
  },
  {
    category: 'invention', attr: 'country', kind: 'name', type: 'historia-invention-country-rev', difficulty: 3,
    prompt: c => `Welche dieser Erfindungen stammt aus „${c.attributes.country}“?`
  },
  {
    category: 'discovery', attr: 'field', kind: 'name', type: 'historia-discovery-field-rev', difficulty: 3,
    prompt: c => `Welche dieser Entdeckungen gehört zum Gebiet „${c.attributes.field}“?`
  },
  {
    category: 'figure', attr: 'field', kind: 'name', type: 'historia-figure-field-rev', difficulty: 3,
    prompt: c => `Welcher dieser Forscher wirkte vor allem im Bereich „${c.attributes.field}“?`
  },
  {
    category: 'figure', attr: 'nationality', kind: 'name', type: 'historia-figure-nationality-rev', difficulty: 3,
    prompt: c => `Welche dieser Persönlichkeiten stammt aus „${c.attributes.nationality}“?`
  },
  {
    category: 'milestone', attr: 'field', kind: 'name', type: 'historia-milestone-field-rev', difficulty: 3,
    prompt: c => `Welches dieser Ereignisse gehört zum Bereich „${c.attributes.field}“?`
  },
  {
    category: 'expedition', attr: 'region', kind: 'name', type: 'historia-expedition-region-rev', difficulty: 3,
    prompt: c => `Welche dieser Reisen führte in die Region „${c.attributes.region}“?`
  }
];

// --- Fragen generieren (Engine identisch zu generate_cultura.js) -----------
const questions = [];
const skipped = {};
function countSkip(tpl, reason) {
  (skipped[tpl.type] ||= {});
  skipped[tpl.type][reason] = (skipped[tpl.type][reason] || 0) + 1;
}

for (const tpl of templates) {
  const conceptsInCat = byCategory[tpl.category] || [];
  const clean = tpl.clean || cleanNum;

  let catPool = [];
  let numPool = [];
  let namePool = [];
  for (const c of conceptsInCat) {
    const v = c.attributes[tpl.attr];
    if (v === undefined || v === null || v === '') continue;
    if (tpl.kind === 'name') {
      namePool.push({ name: c.name, value: String(v) });
    } else if (tpl.kind === 'num') {
      const n = clean(v);
      if (n !== null) numPool.push(n);
    } else {
      if (!tpl.poolFilter || tpl.poolFilter(v)) catPool.push(v);
    }
  }

  const poolSize = tpl.kind === 'name' ? namePool.length
    : tpl.kind === 'num' ? numPool.length : catPool.length;
  if (poolSize < 3) {
    countSkip(tpl, `Pool zu klein (${poolSize})`);
    continue;
  }

  for (const c of conceptsInCat) {
    if (tpl.skip && tpl.skip(c)) { countSkip(tpl, 'Template-Skip'); continue; }

    const rawValue = c.attributes[tpl.attr];
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;

    let correct, distractors;
    if (tpl.kind === 'name') {
      correct = c.name;
      distractors = pickNames(correct, String(rawValue), namePool);
    } else if (tpl.kind === 'num') {
      const n = clean(rawValue);
      if (n === null) { countSkip(tpl, 'kein sauberer Zahlenwert (Bereich/v. Chr./Text)'); continue; }
      correct = tpl.format(n);
      distractors = pickNumeric(n, numPool, tpl.format);
    } else {
      if (/\//.test(String(rawValue)) || /verschiedene/i.test(String(rawValue))) {
        countSkip(tpl, 'mehrdeutiger Wert (Slash/Sammelangabe)');
        continue;
      }
      if (tpl.poolFilter && !tpl.poolFilter(rawValue)) { countSkip(tpl, 'poolFilter'); continue; }
      correct = String(rawValue);
      distractors = pickCategorical(correct, catPool);
    }

    const promptText = tpl.prompt(c);
    if (revealsAnswer(promptText, correct)) { countSkip(tpl, 'Selbstverräter'); continue; }

    if (distractors.length < 2) { countSkip(tpl, `zu wenige Distraktoren (${distractors.length})`); continue; }

    const options = [correct, ...distractors];

    questions.push({
      id: `q_${DOMAIN}_${c.id}_${tpl.type}`,
      entityId: `${DOMAIN}:${c.id}`,
      entityType: c.category,
      type: tpl.type,
      difficulty: tpl.difficulty,
      prompt: promptText,
      correctAnswer: correct,
      options,
      testedAttribute: tpl.kind === 'name' ? null : tpl.attr,
      answerIsName: tpl.kind === 'name',
      silhouetteSvgPath: null,
      mapTargetId: null
    });
  }
}

// --- schreiben -----------------------------------------------------------
writeFileSync(CONCEPTS_OUT, JSON.stringify(concepts, null, 2), 'utf8');
writeFileSync(QUESTIONS_OUT, JSON.stringify(questions, null, 2), 'utf8');

const byType = {}, byDiff = {}, qByCat = {};
for (const q of questions) {
  byType[q.type] = (byType[q.type] || 0) + 1;
  byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1;
  qByCat[q.entityType] = (qByCat[q.entityType] || 0) + 1;
}
console.log(`Konzepte: ${Object.keys(concepts).length}`);
console.log(`Fragen:   ${questions.length}`);
console.log('Nach Kategorie:', qByCat);
console.log('Nach Typ:', byType);
console.log('\nSkips nach Typ und Grund:');
for (const [type, reasons] of Object.entries(skipped)) {
  for (const [reason, n] of Object.entries(reasons)) console.log(`  ${type}: ${reason} -> ${n}`);
}
