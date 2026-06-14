/**
 * Generator für die Homo-Domain (Mensch & Körper / Anatomie & Physiologie).
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

/** Bis zu 3 Distraktoren (numerisch: nächstliegende Werte; sonst Reihenfolge). */
function pickDistractors(correct, pool, numeric) {
  const unique = [...new Set(pool.map(v => String(v)))].filter(v => v !== String(correct));
  if (numeric) {
    const cNum = Number(correct);
    unique.sort((a, b) => Math.abs(parseFloat(a) - cNum) - Math.abs(parseFloat(b) - cNum));
  }
  return unique.slice(0, 3);
}

// Rundet auf „schoene" Zahlen, damit Distraktoren nicht krumm wirken.
function niceRound(x) {
  if (x >= 1000) { const p = Math.pow(10, Math.floor(Math.log10(x)) - 1); return Math.round(x / p) * p; }
  if (x >= 100) return Math.round(x / 10) * 10;
  return Math.max(1, Math.round(x));
}

/**
 * Distraktoren für physiologische Eckwerte (body_fact). Anders als beim
 * frueheren Pool-Verfahren werden NICHT Werte anderer Fakten gemischt — sonst
 * stuenden bei „Blutvolumen" Unsinns-Optionen wie „32 Zähne" oder „206 Knochen".
 * Stattdessen erzeugen wir plausible Alternativwerte DERSELBEN Einheit rund um
 * den korrekten Wert. Bereiche (z.B. „60-100") werden als verschobene Bereiche
 * gleicher Spanne gebildet.
 */
// Einheit ohne erklärende Klammer (z.B. „Chromosomen (23 Paare)" -> „Chromosomen"),
// damit Distraktoren nicht widersprüchlich werden („100 Chromosomen (23 Paare)").
function bodyFactUnit(c) {
  return (c.attributes.unit || '').replace(/\s*\([^)]*\)/g, '').trim();
}

function bodyFactDistractors(c) {
  const u = bodyFactUnit(c);
  const unit = u ? ` ${u}` : '';
  const raw = String(c.attributes.value).trim();
  const caPrefix = /^ca\.\s*/i.test(raw) ? 'ca. ' : '';

  const range = raw.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) {
    const a = +range[1], b = +range[2], step = (b - a) + 5;
    return [
      `${caPrefix}${Math.max(0, a - step)}-${Math.max(b - a, b - step)}${unit}`,
      `${caPrefix}${a + step}-${b + step}${unit}`,
      `${caPrefix}${a + 2 * step}-${b + 2 * step}${unit}`
    ];
  }

  // Erste Zahl MIT Ziffernanfang (sonst träfe /[\d.]+/ den Punkt in „ca." -> NaN).
  const m = raw.match(/\d+(?:[.,]\d+)?/);
  const n = m ? parseFloat(m[0].replace(',', '.')) : NaN;
  if (!isFinite(n) || n <= 0) return [];

  // Proportionale Streuung um den korrekten Wert -> immer gleiche Dimension,
  // nie eine Nonsens-Option aus einer anderen Einheit.
  const factors = [0.5, 0.7, 0.85, 1.2, 1.4, 1.7, 2];
  const correctRounded = niceRound(n);
  const cands = [];
  for (const f of factors) {
    const v = niceRound(n * f);
    if (v !== correctRounded && !cands.includes(v)) cands.push(v);
  }
  return cands.slice(0, 3).map(v => `${caPrefix}${deNum(v)}${unit}`);
}

// --- Selbstverräter-Schutz ----------------------------------------------
// Wirft Fragen weg, deren Antwort schon im Fragetext/Konzeptnamen steckt.
// Beispiel: „In welcher Region liegt der Oberarmknochen?" -> Antwort „Arm"
// (steckt buchstäblich im Namen). Solche Fragen sind wertlos.
function norm(s) {
  return String(s ?? '').toLowerCase()
    .replace(/ß/g, 'ss').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
// Deutsche Körperteil-Wortstämme -> implizierte Region. Damit fällt auch
// „Oberschenkelknochen" -> „Bein" auf, obwohl das Wort „Bein" nicht im Namen steht.
const REGION_STEMS = [
  [/schenkel|wade|schien|knie|ferse|sprung|zeh/, 'bein fuss oberschenkel unterschenkel wade knie fuss'],
  [/oberarm|unterarm|ellbogen|\bhand\b|finger|speiche|\belle\b/, 'arm hand'],
  [/schadel|kiefer|stirn|hinterhaupt|schlafe|nasen|joch|wange|kau|zahn/, 'kopf kiefer wange mund'],
  [/auge|lid/, 'kopf auge augenhohle lider'],
  [/mund|lippe/, 'kopf mund mundoffnung lippe'],
  [/zunge/, 'kopf mund zunge'],
  [/herz/, 'rumpf herz brustkorb brust'],
  [/rippe|brust|becken|wirbel|kreuz|steiss|schulterblatt|schlussel|sitzbein|rucken|rueck|lende|bauch/, 'rumpf brust brustwand rucken rücken lendenregion bauch rippen'],
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
    // treffen, ohne kurze/generische Tokens zu aggressiv zu kürzen.
    const stem = t.length >= 7 ? t.replace(/(ern|en|em|er|es|e|n|s)$/u, '') : t;
    if (stem.length >= 5 && sNo.includes(stem)) return true;
  }
  // Deutsche Komposita verraten sich über den gemeinsamen Wortstamm am
  // Wortanfang, nicht über das Wortende: „…gebildeten Harn…" verrät „Harnblase",
  // „Kaumuskel" verrät „…zum Kauen…", „Stirnbein" verrät „…die Stirn…".
  // Generische Kopf-Substantive (muskel/knochen/bein/organ/…) tragen keine
  // Bedeutung und werden vorher abgetrennt, damit der eigentliche Stamm frei
  // liegt ("Kaumuskel" -> "kau"). Schwelle: >= 4 Zeichen gemeinsamer Präfix
  // (vermeidet Zufälle wie „her" in „Herz"/„herstellen"); wurde aber bei einem
  // der Token ein Kopf-Substantiv abgetrennt, genügen >= 3 Zeichen ("kau").
  const stripHead = w =>
    w.replace(/(muskeln|muskel|knochen|beine|bein|organe|organ|drusen|druse|nerven|nerv)$/u, '');
  const hintTokens = S.split(' ').filter(t => t.length >= 3).map(t => [t, stripHead(t)]);
  for (const aTok of A.split(' ').filter(t => t.length >= 3)) {
    const aCore = stripHead(aTok);
    if (aCore.length < 3) continue;
    for (const [sTok, sCore] of hintTokens) {
      if (sCore.length < 3) continue;
      let k = 0;
      while (k < aCore.length && k < sCore.length && aCore[k] === sCore[k]) k++;
      if (k >= 4) return true;
      // 3-Zeichen-Stamm zählt nur nach Abtrennen eines Kopf-Substantivs UND wenn
      // der kürzere Kern vollständig im anderen aufgeht (echter Morphem-Treffer
      // „kau"->„kauen", nicht bloßer Trigramm-Zufall „sch" in Schlüssel/Schulter).
      const headStripped = aCore !== aTok || sCore !== sTok;
      if (headStripped && k >= 3 && (k === aCore.length || k === sCore.length)) return true;
    }
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
 * Für Lage-/Region-Fragen wählt der Generator den Hinweis bewusst:
 * - normal: deutscher Name, solange er die Antwort nicht verrät
 * - sonst: lateinischer Fachbegriff, wenn vorhanden und selbst nicht verräterisch
 *
 * Das Visual muss bei lateinischem Hinweis den deutschen Konzeptnamen verbergen,
 * weil sonst links wieder "Wadenbein" stehen würde, während rechts "Fibula"
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
  // Einige ältere Muskel-Einträge tragen den Fachbegriff nur in Klammern im
  // Namen. Für konsistente Visuals und Fragen speichern wir ihn abgeleitet mit.
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
    format: (_v, c) => {
      const u = bodyFactUnit(c);
      const raw = String(c.attributes.value).trim();
      // Reine Ganzzahl (ggf. mit „ca.") tausenderformatiert wie die Distraktoren
      // anzeigen, sonst verriete das andere Format die richtige Antwort.
      const m = raw.match(/^(ca\.\s*)?(\d+)$/i);
      const val = m ? `${m[1] ? 'ca. ' : ''}${deNum(+m[2])}` : raw;
      return `${val}${u ? ' ' + u : ''}`;
    },
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
  // zusätzliche Lernwinkel.

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
  },

  // ==== Neue Templates (Stand 2026-06-12) =================================
  // Alle nutzen ausschliesslich bereits in homo_raw.json vorhandene Attribute.
  // Keine neuen Fakten - nur bisher ungenutzter Lernwinkel (notableFor) oder
  // Umkehrrichtung bestehender Vorwarts-Fragen.

  // ---- Knochen: notableFor-Reverse ----------------------------------------
  // Hinweis: die markante Eigenschaft (notableFor). Antwort: der dt. Knochenname.
  // Guard: skip, wenn der notableFor-Text den deutschen Namen buchstäblich schon
  // enthält (revealsAnswer-Check läuft im zentralen Loop via guardSubject).
  // Da alle 30 notableFor-Werte einzigartig sind, reicht der Pool als Distraktorquelle.
  {
    category: 'bone', attr: 'notableFor', type: 'homo-bone-notable-rev', difficulty: 2, nameAnswer: true,
    subject: c => c.attributes.notableFor, // Hinweis im Prompt ist die Eigenschaft
    prompt: c => `Welcher Knochen wird beschrieben als: „${c.attributes.notableFor}"?`
  },

  // ---- Knochen: notableFor-Vorwärts ----------------------------------------
  // Hinweis: der dt. Knochenname. Antwort: die markante Eigenschaft (notableFor).
  // Distraktorpool = alle notableFor-Werte der Kategorie (30 einzigartige Einträge).
  // Guard: skip, wenn Name die notableFor-Antwort über Wortstamm verrät.
  {
    category: 'bone', attr: 'notableFor', type: 'homo-bone-notable', difficulty: 2,
    prompt: c => `Wofür ist der Knochen „${c.name}" anatomisch besonders bekannt?`,
    format: v => v
  },

  // ---- Muskeln: notableFor-Reverse ----------------------------------------
  // Analog zum Knochen-Reverse: notableFor als Hinweis, Muskelname als Antwort.
  // Achtung: Muskel-Namen enden oft auf '(Musculus ...)' - der dt. Kurzname
  // dient als Antwort (c.name enthält beides). Der revealsAnswer-Guard prüft
  // im Loop, ob notableFor den dt. Namensanteil preisgibt; skip dann automatisch.
  {
    category: 'muscle', attr: 'notableFor', type: 'homo-muscle-notable-rev', difficulty: 2, nameAnswer: true,
    subject: c => c.attributes.notableFor, // Hinweis = markante Eigenschaft
    prompt: c => `Welcher Muskel wird beschrieben als: „${c.attributes.notableFor}"?`
  },

  // ---- Organe: Gewicht-Reverse ----------------------------------------
  // Hinweis: Gewichtsangabe in Gramm. Antwort: der Organname.
  // Nur sinnvoll, wenn das Gewicht eindeutig ist - Organe mit identischem Gewicht
  // (Niere/Magen/Milz: alle 150 g) werden per skip ausgeschlossen, damit
  // kein falsches "richtig" entstehen kann.
  // Distraktorpool: andere Organnamen (15 insgesamt - ausreichend).
  {
    category: 'organ', attr: 'approxWeightGrams', type: 'homo-organ-weight-rev', difficulty: 3,
    nameAnswer: true,
    // Hinweis im Prompt ist das Gewicht; subject liefert den Gewichtstext
    subject: c => `${deNum(c.attributes.approxWeightGrams)} g (ungefähres Gewicht beim Erwachsenen)`,
    prompt: c => `Welches Organ wiegt beim Erwachsenen ungefähr ${deNum(c.attributes.approxWeightGrams)} Gramm?`,
    skip: c => {
      // Organe mit nicht-eindeutigem Gewicht überspringen, damit die Frage
      // eine klar korrekte Antwort hat. Prüfung: gibt es ein anderes Organ
      // mit exakt demselben approxWeightGrams-Wert?
      const w = c.attributes.approxWeightGrams;
      // Folgende IDs teilen sich 150 g: nieren, magen, milz
      const AMBIGUOUS_WEIGHTS = [150];
      return AMBIGUOUS_WEIGHTS.includes(w);
    }
  },

  // ---- Organe: Funktion-Reverse ----------------------------------------
  // Hinweis: die Hauptfunktion des Organs. Antwort: der Organname.
  // Nur 10 der 15 Organe haben das 'function'-Attribut. Da alle Funktionen
  // einzigartig formuliert sind, ist der Reverse eindeutig.
  // Distraktorpool: andere Organnamen (15 insgesamt - ausreichend).
  {
    category: 'organ', attr: 'function', type: 'homo-organ-function-rev', difficulty: 2,
    nameAnswer: true,
    subject: c => c.attributes.function, // Hinweis = Funktionstext
    prompt: c => `Welches Organ erfüllt folgende Hauptaufgabe: „${c.attributes.function}"?`
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
    // Bei dünn besetzten Attributen (z.B. organ.location nur bei wenigen Organen)
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

    // Selbstverräter: steckt die Antwort schon im Hinweis (Name/Wert), Frage verwerfen.
    // Ausnahme body_fact (valueUnit): hier ist die Antwort die ZAHL; dass die Einheit
    // („Knochen") auch im Namen („Anzahl Knochen…") steht, verrät die Zahl nicht — und
    // alle Distraktoren teilen die Einheit. Sonst fielen gute Fragen unnötig weg.
    if (!tpl.valueUnit && revealsAnswer(subjectInfo.guardSubject, correct)) continue;

    // body_fact: dimensionsgleiche Zahl-Distraktoren statt gemischter Pool.
    let distractors;
    if (tpl.valueUnit) {
      distractors = bodyFactDistractors(c);
    } else {
      let pool = valuePool.slice();
      if (tpl.extraDistractors) pool = pool.concat(tpl.extraDistractors);
      distractors = pickDistractors(correct, pool, tpl.numeric);
    }
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
      // Selbstverräter-Guard im Visual: das Frontend muss wissen, welches
      // Attribut die Antwort prüft. Bei Reverse-Templates (Antwort = Konzeptname,
      // nameAnswer) gibt es kein geprüftes Attribut -> null. Sonst tpl.attr;
      // beim valueUnit-Template ist '__valueUnit__' nur ein Platzhalter -> das
      // real geprüfte Attribut ist 'value'.
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
