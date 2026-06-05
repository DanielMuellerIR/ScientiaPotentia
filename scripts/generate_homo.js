/**
 * Generator fuer die Homo-Domain (Mensch & Körper / Anatomie & Physiologie).
 *
 * Liest scripts/data_sources/homo_raw.json (verifizierte Faktenbasis) und erzeugt:
 *   - public/data/concepts_homo.json  : Konzeptspeicher (Map id -> Konzept)
 *   - public/data/questions_homo.json : generierte Multiple-Choice-Fragen
 *
 * Aufbau analog zu generate_astra.js. Distraktoren stammen aus derselben
 * Kategorie/demselben Attribut -> plausibel und nicht trivial ausschliessbar.
 *
 * Aufruf: node scripts/generate_homo.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW_PATH = join(__dirname, 'data_sources', 'homo_raw.json');
const CONCEPTS_OUT = join(ROOT, 'public', 'data', 'concepts_homo.json');
const QUESTIONS_OUT = join(ROOT, 'public', 'data', 'questions_homo.json');

const DOMAIN = 'homo';

/** Deutsche Zahlformatierung: Punkt als Tausender-, Komma als Dezimaltrenner. */
function deNum(value) {
  if (typeof value !== 'number') value = Number(value);
  if (!isFinite(value)) return String(value);
  return value.toLocaleString('de-DE', { maximumFractionDigits: 4 });
}

/** Bis zu 3 Distraktoren (numerisch: naechstliegende Werte; sonst Reihenfolge). */
function pickDistractors(correct, pool, numeric) {
  const unique = [...new Set(pool.map(v => String(v)))].filter(v => v !== String(correct));
  if (numeric) {
    const cNum = Number(correct);
    unique.sort((a, b) => Math.abs(parseFloat(a) - cNum) - Math.abs(parseFloat(b) - cNum));
  }
  return unique.slice(0, 3);
}

// --- Selbstverraeter-Schutz ----------------------------------------------
// Wirft Fragen weg, deren Antwort schon im Fragetext/Konzeptnamen steckt.
// Beispiel: „In welcher Region liegt der Oberarmknochen?" -> Antwort „Arm"
// (steckt buchstaeblich im Namen). Solche Fragen sind wertlos.
function norm(s) {
  return String(s ?? '').toLowerCase()
    .replace(/ß/g, 'ss').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
// Deutsche Koerperteil-Wortstaemme -> implizierte Region. Damit faellt auch
// „Oberschenkelknochen" -> „Bein" auf, obwohl das Wort „Bein" nicht im Namen steht.
const REGION_STEMS = [
  [/schenkel|wade|schien|knie|ferse|sprung|zeh/, 'bein fuss oberschenkel unterschenkel wade knie fuss'],
  [/oberarm|unterarm|ellbogen|\bhand\b|finger|speiche|\belle\b/, 'arm hand'],
  [/schadel|kiefer|stirn|hinterhaupt|schlafe|nasen|joch|wange|kau|zahn/, 'kopf kiefer wange mund'],
  [/auge|lid/, 'kopf auge augenhohle lider'],
  [/mund|lippe/, 'kopf mund mundoffnung lippe'],
  [/zunge/, 'kopf mund zunge'],
  [/herz/, 'rumpf herz brustkorb brust'],
  [/rippe|brust|becken|wirbel|kreuz|steiss|schulterblatt|schlussel|sitzbein|rucken|rueck|lende|bauch/, 'rumpf brust brustwand rucken ruecken lendenregion bauch rippen'],
  [/gesass|huft/, 'gesass hufte']
];
function impliedRegions(name) {
  const n = norm(name);
  return REGION_STEMS.filter(([re]) => re.test(n)).map(([, r]) => r).join(' ');
}
// true, wenn die Antwort (oder ein markantes Wort daraus) bereits im Hinweis steht.
function revealsAnswer(subject, answer) {
  const S = norm(subject), A = norm(answer);
  const sNo = S.replace(/ /g, ''), aNo = A.replace(/ /g, '');
  if (!sNo || !aNo) return false;
  if (aNo.length >= 3 && sNo.includes(aNo)) return true; // ganze Antwort im Hinweis
  if (sNo.length >= 3 && aNo.includes(sNo)) return true; // ganzer Name in der Antwort
  // markantes Antwort-Wort steckt im Hinweis (>=4, damit nicht generische Stämme
  // wie „Galaxie" in „Spiralgalaxie" fälschlich anschlagen)
  for (const t of A.split(' ').filter(t => t.length >= 4)) {
    if (sNo.includes(t)) return true;
    // Kleine deutsche Flexionsglättung: "Oberschenkels" soll "Oberschenkel"
    // treffen, ohne kurze/generische Tokens zu aggressiv zu kuerzen.
    const stem = t.length >= 7 ? t.replace(/(ern|en|em|er|es|e|n|s)$/u, '') : t;
    if (stem.length >= 5 && sNo.includes(stem)) return true;
  }
  return false;
}

/** Klemmt berechnete Schwierigkeit auf die im Quiz genutzten Stufen 1..4. */
function clampDifficulty(value) {
  return Math.max(1, Math.min(4, value));
}

/**
 * Anatomische Begriffe sind nicht gleich bekannt: "Femur" ist vielen Nutzern
 * eher vertraut als "Os zygomaticum". Diese Offsets justieren die Template-
 * Schwierigkeit pro Konzept, ohne neue Fakten in die Datenbasis zu schreiben.
 * -1 = bekannter/alltagsnaher Begriff, +1/+2 = eher fachsprachlich.
 */
const FAMILIARITY_OFFSET = {
  // Bekannt aus Schule, Sport, Alltag oder Grundwissen.
  femur: -1, tibia: -1, humerus: -1, cranium: -1, patella: -1,
  pelvis: -1, sternum: -1, vertebra: -1,
  herz: -1, gehirn: -1, lunge: -1, leber: -1, magen: -1, haut: -1,
  biceps_brachii: -1, triceps_brachii: -1, quadriceps_femoris: -1,

  // Fachsprachlicher oder anatomisch genauer, aber noch gut lernbar.
  fibula: 1, ulna: 1, radius: 1, clavicula: 1, scapula: 1, mandibula: 1,
  atlas_c1: 1, axis_c2: 1, os_sacrum: 1, os_coccygis: 1,
  diaphragma: 1, masseter: 1, myocardium: 1, deltoideus: 1,
  pectoralis_major: 1, latissimus_dorsi: 1, trapezius: 1,
  sternocleidomastoid: 1, rectus_abdominis: 1, sartorius: 1,
  soleus: 1, psoas_major: 1,

  // Eher Spezialwissen: kleine Knochen, exakte Os-/Musculus-Bezeichnungen.
  stapes: 2, malleus: 2, incus: 2, talus: 2, calcaneus: 2,
  os_naviculare: 2, os_zygomaticum: 2, os_frontale: 2,
  os_occipitale: 2, os_temporale: 2, os_metacarpale: 2,
  stapedius: 2, gastrocnemius: 2, tibialis_anterior: 2,
  orbicularis_oculi: 2, orbicularis_oris: 2, genioglossus: 2,
  intercostales_externi: 2
};

function conceptDifficultyOffset(c) {
  return FAMILIARITY_OFFSET[c.id] || 0;
}

/** Holt einen sauberen lateinischen Fachbegriff aus Attribut oder Namensklammer. */
function latinTerm(c) {
  if (c.attributes?.latinName) return String(c.attributes.latinName).trim();
  const matches = [...String(c.name || '').matchAll(/\(([^()]+)\)/g)]
    .map(m => m[1].trim())
    .filter(Boolean);
  return matches.at(-1) || '';
}

/**
 * Fuer Lage-/Region-Fragen waehlt der Generator den Hinweis bewusst:
 * - normal: deutscher Name, solange er die Antwort nicht verraet
 * - sonst: lateinischer Fachbegriff, wenn vorhanden und selbst nicht verraeterisch
 *
 * Das Visual muss bei lateinischem Hinweis den deutschen Konzeptnamen verbergen,
 * weil sonst links wieder "Wadenbein" stehen wuerde, waehrend rechts "Fibula"
 * abgefragt wird.
 */
function resolveSubject(c, tpl, correct) {
  const germanSubject = (tpl.subject ? tpl.subject(c) : c.name) +
    (tpl.regionAnswer ? ' ' + impliedRegions(c.name) : '');
  const germanReveals = revealsAnswer(germanSubject, correct);

  if (tpl.regionAnswer && germanReveals) {
    const latin = latinTerm(c);
    if (latin && !revealsAnswer(latin, correct)) {
      return {
        label: latin,
        guardSubject: latin,
        usesLatinHint: true,
        hideConceptIdentity: true,
        germanReveals
      };
    }
  }

  return {
    label: tpl.subject ? tpl.subject(c) : c.name,
    guardSubject: germanSubject,
    usesLatinHint: false,
    hideConceptIdentity: false,
    germanReveals
  };
}

function resolveDifficulty(tpl, c, subjectInfo) {
  let difficulty = tpl.difficulty + conceptDifficultyOffset(c);

  // Lateinische Hinweise sind absichtlich schwerer als deutsche Alltagsnamen.
  if (subjectInfo.usesLatinHint) difficulty += 1;

  // Zahlenwerte und exakte Fachnamen sollen nicht in die sehr leichte Stufe fallen.
  if (tpl.numeric || tpl.attr === 'approxWeightGrams') difficulty = Math.max(difficulty, 3);
  if (tpl.attr === 'latinName' || subjectInfo.usesLatinHint) difficulty = Math.max(difficulty, 2);
  if (tpl.minDifficulty) difficulty = Math.max(difficulty, tpl.minDifficulty);

  return clampDifficulty(difficulty);
}

const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));

const byCategory = {};
for (const c of raw) (byCategory[c.category] ||= []).push(c);

// --- Konzeptspeicher ------------------------------------------------------
const concepts = {};
for (const c of raw) {
  const key = `${DOMAIN}:${c.id}`;
  const attributes = { ...c.attributes };
  // Einige aeltere Muskel-Eintraege tragen den Fachbegriff nur in Klammern im
  // Namen. Fuer konsistente Visuals und Fragen speichern wir ihn abgeleitet mit.
  const latin = latinTerm(c);
  if (latin && !attributes.latinName && (c.category === 'bone' || c.category === 'muscle')) {
    attributes.latinName = latin;
  }

  concepts[key] = {
    id: key,
    name: c.name,
    type: c.category,
    category: c.category,
    attributes,
    funFact: c.funFact || '',
    source: { name: c.sourceName, url: c.sourceUrl || '' }
  };
}

// --- Frage-Templates ------------------------------------------------------
const templates = [
  // ---- Knochen --------------------------------------------------------
  {
    category: 'bone', attr: 'region', type: 'homo-bone-region', difficulty: 1, regionAnswer: true,
    prompt: (c, subject) => subject.usesLatinHint
      ? `In welcher Körperregion liegt der Knochen mit dem lateinischen Namen „${subject.label}"?`
      : `In welcher Körperregion liegt der Knochen „${subject.label}"?`,
    format: v => v
  },
  {
    category: 'bone', attr: 'latinName', type: 'homo-bone-latin', difficulty: 3,
    prompt: c => `Wie lautet der lateinische (anatomische) Name des Knochens „${c.name}"?`,
    format: v => v
  },
  // ---- Muskeln --------------------------------------------------------
  {
    category: 'muscle', attr: 'location', type: 'homo-muscle-location', difficulty: 2, minDifficulty: 2, regionAnswer: true,
    prompt: (c, subject) => subject.usesLatinHint
      ? `Wo liegt der Muskel mit dem anatomischen Fachbegriff „${subject.label}"?`
      : `In welcher Körperregion liegt der Muskel „${subject.label}"?`,
    format: v => v
  },
  // ---- Organe ---------------------------------------------------------
  {
    category: 'organ', attr: 'system', type: 'homo-organ-system', difficulty: 2,
    prompt: c => `Zu welchem Organsystem gehört „${c.name}" hauptsächlich?`,
    format: v => v
  },
  {
    category: 'organ', attr: 'approxWeightGrams', type: 'homo-organ-weight', difficulty: 3,
    prompt: c => `Welches ungefähre Gewicht hat „${c.name}" beim Erwachsenen?`,
    format: v => `${deNum(v)} g`, numeric: true
  },
  // ---- Physiologische Eckwerte (nur numerische Werte -> saubere MCQ) ---
  {
    category: 'body_fact', attr: '__valueUnit__', type: 'homo-bodyfact-value', difficulty: 2,
    prompt: c => `Welche Angabe gehört zu: „${c.name}"?`,
    format: (_v, c) => `${c.attributes.value}${c.attributes.unit ? ' ' + c.attributes.unit : ''}`,
    valueUnit: true,
    skip: c => !/\d/.test(String(c.attributes.value)) // name-wertige Fakten (z.B. "Haut") überspringen
  },
  // ---- Hominine Arten -------------------------------------------------
  {
    category: 'species', attr: 'epoch', type: 'homo-species-epoch', difficulty: 3,
    prompt: c => `In welchen Zeitraum fällt „${c.name}"?`,
    format: v => v
  },

  // ==== Erweiterte Fragetypen (Stand 2026-06-04, Richtung 5000) ============
  // Nutzen nur bereits verifizierte Attribute -> keine neuen Fakten, nur echte
  // zusaetzliche Lernwinkel.

  // ---- Knochen: lateinischer Name -> deutscher Name (Gegenrichtung) ---
  {
    category: 'bone', attr: 'latinName', type: 'homo-bone-latin-rev', difficulty: 3, nameAnswer: true,
    subject: c => c.attributes.latinName, // Hinweis ist der lat. Name, nicht der dt. Name
    prompt: c => `Welcher Knochen trägt den lateinischen Namen „${c.attributes.latinName}"?`
  },
  // ---- Menschenarten: Ursprungsregion ---------------------------------
  {
    category: 'species', attr: 'region', type: 'homo-species-region', difficulty: 2,
    prompt: c => `In welcher Region liegt der Ursprung von „${c.name}"?`,
    format: v => v
  },
  // ---- Körperwerte: Wert -> Bezeichnung (Gegenrichtung) ---------------
  {
    category: 'body_fact', attr: 'value', type: 'homo-bodyfact-name', difficulty: 3, nameAnswer: true,
    subject: c => `${c.attributes.value} ${c.attributes.unit || ''}`, // Hinweis ist der Wert
    prompt: c => `Welche Körperangabe beträgt ungefähr ${c.attributes.value}${c.attributes.unit ? ' ' + c.attributes.unit : ''}?`,
    skip: c => !/\d/.test(String(c.attributes.value)) // nur numerische Werte
  },

  // Hinweis: Ein eigener „Muskel <-> lateinischer Fachbegriff"-Fragetyp entfällt
  // bewusst. Anders als bei den Knochen tragen alle Muskel-Konzeptnamen den
  // lateinischen Begriff bereits in Klammern (z.B. „Großer Brustmuskel (Musculus
  // pectoralis major)"), sodass Hinweis und Antwort identisch wären — der
  // Selbstverräter-Guard würde jede solche Frage verwerfen. Der lateinische
  // Begriff wird stattdessen schon in „homo-muscle-location" als Hinweis genutzt.

  // ---- Organe: Hauptaufgabe (Funktion) -------------------------------
  {
    category: 'organ', attr: 'function', type: 'homo-organ-function', difficulty: 2,
    prompt: c => `Welche Hauptaufgabe erfüllt das Organ „${c.name}"?`,
    format: v => v
  },
  // ---- Organe: Lage (Körperregion) -----------------------------------
  {
    category: 'organ', attr: 'location', type: 'homo-organ-location', difficulty: 2, regionAnswer: true,
    prompt: (c, subject) => `In welcher Körperregion liegt das Organ „${subject.label}"?`,
    format: v => v
  },
  // ---- Muskeln: Hauptfunktion ----------------------------------------
  {
    category: 'muscle', attr: 'function', type: 'homo-muscle-function', difficulty: 3,
    prompt: c => `Welche Funktion hat der Muskel „${c.name}" hauptsächlich?`,
    format: v => v
  }
];

// --- Fragen generieren ----------------------------------------------------
const questions = [];

for (const tpl of templates) {
  const conceptsInCat = byCategory[tpl.category] || [];
  // nameAnswer: korrekte Antwort ist der Konzeptname (Reverse-Fragen), Distraktoren
  // sind andere Namen derselben Kategorie. Das im Prompt genannte Attribut muss da sein.
  const valuePool = conceptsInCat
    .filter(c => !(tpl.skip && tpl.skip(c)))
    .map(c => (tpl.nameAnswer ? c.name : tpl.valueUnit ? tpl.format(null, c) : tpl.format(c.attributes[tpl.attr], c)))
    // Bei duenn besetzten Attributen (z.B. organ.location nur bei wenigen Organen)
    // liefern Konzepte ohne Wert sonst „undefined" als Distraktor. Leere Werte raus.
    .filter(v => v !== undefined && v !== null && v !== '');

  for (const c of conceptsInCat) {
    if (tpl.skip && tpl.skip(c)) continue;
    const rawValue = tpl.nameAnswer
      ? c.attributes[tpl.attr]
      : (tpl.valueUnit ? c.attributes.value : c.attributes[tpl.attr]);
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;

    const correct = tpl.nameAnswer ? c.name : (tpl.valueUnit ? tpl.format(null, c) : tpl.format(rawValue, c));
    const subjectInfo = resolveSubject(c, tpl, correct);

    // Selbstverraeter: steckt die Antwort schon im Hinweis (Name/Wert), Frage verwerfen.
    if (revealsAnswer(subjectInfo.guardSubject, correct)) continue;

    let pool = valuePool.slice();
    if (tpl.extraDistractors) pool = pool.concat(tpl.extraDistractors);
    const distractors = pickDistractors(correct, pool, tpl.numeric);
    if (distractors.length < 1) continue;

    questions.push({
      id: `q_${DOMAIN}_${c.id}_${tpl.type}`,
      entityId: `${DOMAIN}:${c.id}`,
      entityType: c.category,
      type: tpl.type,
      difficulty: resolveDifficulty(tpl, c, subjectInfo),
      prompt: tpl.prompt(c, subjectInfo),
      correctAnswer: correct,
      options: [correct, ...distractors],
      // Selbstverraeter-Guard im Visual: das Frontend muss wissen, welches
      // Attribut die Antwort prueft. Bei Reverse-Templates (Antwort = Konzeptname,
      // nameAnswer) gibt es kein geprueftes Attribut -> null. Sonst tpl.attr;
      // beim valueUnit-Template ist '__valueUnit__' nur ein Platzhalter -> das
      // real gepruefte Attribut ist 'value'.
      testedAttribute: tpl.nameAnswer ? null : (tpl.valueUnit ? 'value' : tpl.attr),
      // answerIsName: true, wenn die korrekte Antwort der Konzeptname ist (Reverse).
      answerIsName: Boolean(tpl.nameAnswer),
      // hideConceptIdentity: true, wenn der Prompt absichtlich nur den Fachbegriff
      // nennt. Dann darf das linke Visual nicht den deutschen Namen/Fun-Fact zeigen.
      hideConceptIdentity: Boolean(subjectInfo.hideConceptIdentity),
      silhouetteSvgPath: null,
      mapTargetId: null
    });
  }
}

writeFileSync(CONCEPTS_OUT, JSON.stringify(concepts, null, 2), 'utf8');
writeFileSync(QUESTIONS_OUT, JSON.stringify(questions, null, 2), 'utf8');

const byType = {};
for (const q of questions) byType[q.type] = (byType[q.type] || 0) + 1;
const byDiff = {};
for (const q of questions) byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1;
console.log(`Konzepte: ${Object.keys(concepts).length}`);
console.log(`Fragen:   ${questions.length}`);
console.log('Nach Typ:', byType);
console.log('Nach Schwierigkeit:', byDiff);
