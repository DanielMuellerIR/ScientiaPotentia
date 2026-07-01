/**
 * Generator für die Machina-Domain (Digital / IT / Computer).
 *
 * Liest die verifizierte Faktenbasis aus scripts/data_sources/machina_raw.json
 * und schreibt:
 *   - public/data/concepts_machina.json  : Konzeptspeicher (Map key -> Konzept)
 *   - public/data/questions_machina.json : generierte Multiple-Choice-Fragen
 *
 * Leitidee (wie Natura/Cultura): Die Recherche/Verifikation ist die eigentliche
 * Arbeit; das Templating leitet nur mechanisch ab. Distraktoren stammen IMMER aus
 * derselben Kategorie und demselben Attribut -> plausibel, nicht trivial ausschließbar.
 *
 * Ordnungsachse laut docs/bereichs_abgrenzung.md: **Funktionsprinzip** ("Wie
 * funktioniert … / was leistet …?"). Maschina fragt deshalb NUR nach Eigenschaften/
 * Funktion (Paradigma, Schicht, Komplexität, Kompression, Abkürzung), NICHT nach
 * Erfindungsdatum/-person/-reihenfolge — die Zeit-/Urheberschaftsachse gehört zu
 * Historia. (Quervernetzung ist erwünscht, das Konzept aber bleibt Single-Owner.)
 *
 * Aufruf: node scripts/generate_machina.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { seededShuffle, pickBalanced, pickNumeric } from './lib/quizrandom.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW_PATH = join(__dirname, 'data_sources', 'machina_raw.json');
const CONCEPTS_OUT = join(ROOT, 'public', 'data', 'concepts_machina.json');
const QUESTIONS_OUT = join(ROOT, 'public', 'data', 'questions_machina.json');

const DOMAIN = 'machina';

// --- kleine Helfer (identisch zur erprobten Cultura-Engine) ----------------

/** Deutsche Zahlformatierung: Punkt als Tausender-, Komma als Dezimaltrenner. */
function deNum(value) {
  if (typeof value !== 'number') value = Number(value);
  if (!isFinite(value)) return String(value);
  return value.toLocaleString('de-DE', { maximumFractionDigits: 4 });
}

/**
 * Wandelt einen Attributwert in eine saubere POSITIVE Zahl ODER null.
 * Negative Werte, Bereiche und Text -> null (werden übersprungen, nichts verfälschen).
 */
function cleanNum(v) {
  if (typeof v === 'number') return (isFinite(v) && v > 0) ? v : null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (/^[0-9]+([.,][0-9]+)?$/.test(t)) return Number(t.replace(',', '.'));
  }
  return null;
}

// Normalisierung für Guards (Umlaute weg, nur Kleinbuchstaben/Ziffern).
function norm(s) {
  return String(s ?? '').toLowerCase()
    .replace(/ß/g, 'ss').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Enthalten sich zwei Werte gegenseitig (normalisiert, ohne Leerzeichen)? */
function containsEitherWay(a, b) {
  const A = norm(a).replace(/ /g, ''), B = norm(b).replace(/ /g, '');
  if (!A || !B) return false;
  return A.includes(B) || B.includes(A);
}

// --- Selbstverräter-Schutz (Basis wie Cultura) ----------------------------
// Verwirft Fragen, deren Antwort schon im finalen Fragetext steckt.
// Hinweis Machina-Abkürzungen: "SQL" -> "Structured Query Language" ist KEIN
// Verräter (die Einzelbuchstaben tauchen nicht als ganze Wörter auf); die
// Token-Heuristik schlägt nur an, wenn ein echtes Wort geteilt wird.
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
// kind: 'cat' (kategorisch), 'num' (numerisch), 'name' (Reverse: Antwort = Name).
// Alle Fragen prüfen Funktion/Eigenschaft — kein Erfindungsdatum/-person (Historia).
const templates = [
  // ==== Programmiersprachen (programming_language) ========================
  {
    category: 'programming_language', attr: 'paradigm', kind: 'cat', type: 'machina-lang-paradigm', difficulty: 3,
    prompt: c => `Welchem Programmierparadigma wird die Sprache ${c.name} primär zugeordnet?`
  },
  // (Kein typeSystem-Template: das Attribut ist binär — "statisch"/"dynamisch" —
  //  und kann daher keine faire 4-Optionen-Frage mit >=2 Distraktoren bilden.)
  {
    category: 'programming_language', attr: 'execution', kind: 'cat', type: 'machina-lang-execution', difficulty: 3,
    prompt: c => `Wie wird Programmcode der Sprache ${c.name} üblicherweise ausgeführt?`
  },
  {
    category: 'programming_language', attr: 'primaryDomain', kind: 'cat', type: 'machina-lang-domain', difficulty: 2,
    prompt: c => `In welchem Anwendungsbereich wird ${c.name} vor allem eingesetzt?`
  },
  {
    category: 'programming_language', attr: 'fileExtension', kind: 'cat', type: 'machina-lang-ext', difficulty: 2,
    prompt: c => `Welche Dateiendung tragen Quelltextdateien der Sprache ${c.name} typischerweise?`
  },
  // Reverse: vom Paradigma auf die Sprache. pickNames stellt sicher, dass die
  // Distraktor-Sprachen ein ANDERES Paradigma haben.
  {
    category: 'programming_language', attr: 'paradigm', kind: 'name', type: 'machina-lang-paradigm-rev', difficulty: 3,
    prompt: c => `Welche dieser Sprachen ist dem Paradigma „${c.attributes.paradigm}“ zuzuordnen?`
  },

  // ==== Dateiformate (file_format) ========================================
  {
    category: 'file_format', attr: 'mediaType', kind: 'cat', type: 'machina-format-mediatype', difficulty: 2,
    prompt: c => `Welcher Art von Daten dient das Dateiformat ${c.name} primär?`
  },
  {
    category: 'file_format', attr: 'compression', kind: 'cat', type: 'machina-format-compression', difficulty: 3,
    // Prompt meidet bewusst den Wortstamm "kompr…" — sonst verrät er die Antwort
    // ("verlustfrei komprimiert") über den Selbstverräter-Guard.
    prompt: c => `Wie behandelt das Dateiformat ${c.name} die Datenmenge bei der Speicherung?`
  },
  {
    category: 'file_format', attr: 'fullName', kind: 'cat', type: 'machina-format-fullname', difficulty: 3,
    prompt: c => `Wofür steht das Kürzel des Dateiformats ${c.name}?`
  },
  // Reverse: welches Format ist verlustfrei/verlustbehaftet? (über compression)
  {
    category: 'file_format', attr: 'compression', kind: 'name', type: 'machina-format-compression-rev', difficulty: 3,
    prompt: c => `Welches dieser Dateiformate arbeitet „${c.attributes.compression}“?`
  },

  // ==== Netzwerkprotokolle (network_protocol) =============================
  {
    category: 'network_protocol', attr: 'layer', kind: 'cat', type: 'machina-protocol-layer', difficulty: 3,
    // "Ebene" statt "Schicht": sonst verrät "…schicht" im Prompt die Antwort
    // ("Anwendungsschicht") über den Selbstverräter-Guard.
    prompt: c => `Auf welcher Ebene des Netzwerkmodells ist das Protokoll ${c.name} angesiedelt?`
  },
  {
    category: 'network_protocol', attr: 'defaultPort', kind: 'num', type: 'machina-protocol-port', difficulty: 4,
    // Antwort ist die nackte Portnummer (kein "Port"-Präfix, das den Frage-Begriff
    // doppeln und als Selbstverräter zählen würde). String(v): Ports nie mit
    // Tausenderpunkt (8080 != 8.080).
    prompt: c => `Welche Portnummer ist dem Protokoll ${c.name} standardmäßig zugeordnet?`,
    format: v => `${v}`
  },
  // transport Reverse: Antwort = Protokollname. Pool hat nur TCP/UDP/„TCP und UDP";
  // der Vorwärts-Typ (Antwort = TCP/UDP) scheitert am 2-Distraktoren-Minimum (nur
  // 1 anderer kategorialer Wert vorhanden). Reverse funktioniert, weil pickNames
  // aus dem Namens-Pool schöpft — dort genug Kandidaten pro TCP-/UDP-Gruppe.
  // Sammelwert-Konzepte werden übersprungen; eindeutige Zuordnung nötig.
  {
    category: 'network_protocol', attr: 'transport', kind: 'name', type: 'machina-protocol-transport-rev', difficulty: 3,
    skip: c => /\/|und/i.test(String(c.attributes.transport || '')),
    prompt: c => `Welches dieser Protokolle nutzt ausschließlich „${c.attributes.transport}" als Transportprotokoll?`
  },
  {
    category: 'network_protocol', attr: 'purpose', kind: 'cat', type: 'machina-protocol-purpose', difficulty: 2,
    prompt: c => `Wozu dient das Protokoll ${c.name}?`
  },
  {
    category: 'network_protocol', attr: 'fullName', kind: 'cat', type: 'machina-protocol-fullname', difficulty: 3,
    prompt: c => `Wofür steht die Abkürzung ${c.name}?`
  },

  // ==== Datenstrukturen (data_structure) ==================================
  {
    category: 'data_structure', attr: 'category', kind: 'cat', type: 'machina-ds-category', difficulty: 3,
    // "Struktur" im Prompt meiden — verriete sonst "…struktur"-Antworten.
    prompt: c => `Welcher Grundkategorie ordnet man ${c.name} in der Informatik zu?`
  },
  {
    category: 'data_structure', attr: 'purpose', kind: 'cat', type: 'machina-ds-purpose', difficulty: 3,
    prompt: c => `Wofür wird die Datenstruktur ${c.name} typischerweise eingesetzt?`
  },
  {
    category: 'data_structure', attr: 'accessComplexity', kind: 'cat', type: 'machina-ds-complexity', difficulty: 4,
    prompt: c => `Welche durchschnittliche Zeitkomplexität hat der typische Zugriff bei ${c.name}?`
  },

  // ==== Algorithmen (algorithm) ===========================================
  {
    category: 'algorithm', attr: 'category', kind: 'cat', type: 'machina-algo-category', difficulty: 3,
    prompt: c => `Zu welcher Klasse von Algorithmen gehört ${c.name}?`
  },
  {
    category: 'algorithm', attr: 'avgComplexity', kind: 'cat', type: 'machina-algo-complexity', difficulty: 4,
    prompt: c => `Welche durchschnittliche Zeitkomplexität hat der Algorithmus ${c.name}?`
  },
  {
    category: 'algorithm', attr: 'purpose', kind: 'cat', type: 'machina-algo-purpose', difficulty: 2,
    prompt: c => `Welches Problem löst der Algorithmus ${c.name}?`
  },

  // ==== Hardware-Komponenten (hardware) ===================================
  {
    category: 'hardware', attr: 'function', kind: 'cat', type: 'machina-hw-function', difficulty: 2,
    prompt: c => `Welche Aufgabe erfüllt die Komponente ${c.name} im Computer?`
  },
  {
    category: 'hardware', attr: 'category', kind: 'cat', type: 'machina-hw-category', difficulty: 3,
    prompt: c => `Zu welcher Gruppe von Hardware zählt ${c.name}?`
  },

  // ==== IT-Abkürzungen (acronym) ==========================================
  {
    category: 'acronym', attr: 'fullName', kind: 'cat', type: 'machina-acronym-fullname', difficulty: 3,
    prompt: c => `Wofür steht die Abkürzung „${c.name}“ in der Informatik?`
  },
  {
    category: 'acronym', attr: 'domain', kind: 'cat', type: 'machina-acronym-domain', difficulty: 2,
    prompt: c => `Welchem Teilgebiet der Informatik ist der Begriff „${c.name}“ zuzuordnen?`
  },

  // ==== Konzepte (concept) ================================================
  // category-Frage statt Definition (Definitionen sind als MCQ schwach und
  // verraten leicht die Antwort). Reverse über category.
  {
    category: 'concept', attr: 'category', kind: 'cat', type: 'machina-concept-category', difficulty: 3,
    prompt: c => `Welchem Teilgebiet der Informatik ist das Konzept „${c.name}” zuzuordnen?`
  },
  // definition Reverse: Antwort = Konzeptname. Freitext-Definitionen verraten
  // den Namen oft buchstäblich → Selbstverräter-Guard filtert diese heraus (ok).
  // Die verbleibenden Fragen sind echter Schwierigkeitsgrad 4: nur die Definition,
  // kein Hinweis auf den Namen.
  {
    category: 'concept', attr: 'definition', kind: 'name', type: 'machina-concept-definition-rev', difficulty: 4,
    prompt: c => `Welches IT-Konzept beschreibt folgende Definition?\n„${c.attributes.definition}”`
  },

  // ==== Reverse-Hebel (mehr Fragetypen je Konzept, token-frei) =============
  // kind:'name' -> Antwort ist der Konzeptname; pickNames stellt sicher, dass die
  // Distraktor-Konzepte beim getesteten Attribut einen ANDEREN Wert haben, also
  // unter den 4 Optionen nur EINS die genannte Eigenschaft erfüllt (fair eindeutig).
  {
    category: 'programming_language', attr: 'primaryDomain', kind: 'name', type: 'machina-lang-domain-rev', difficulty: 3,
    prompt: c => `Welche dieser Programmiersprachen wird vor allem im Bereich „${c.attributes.primaryDomain}“ eingesetzt?`
  },
  {
    category: 'programming_language', attr: 'execution', kind: 'name', type: 'machina-lang-execution-rev', difficulty: 3,
    prompt: c => `Welche dieser Programmiersprachen wird üblicherweise so ausgeführt: „${c.attributes.execution}“?`
  },
  {
    category: 'file_format', attr: 'mediaType', kind: 'name', type: 'machina-format-mediatype-rev', difficulty: 2,
    prompt: c => `Welches dieser Dateiformate dient für „${c.attributes.mediaType}“?`
  },
  {
    category: 'network_protocol', attr: 'layer', kind: 'name', type: 'machina-protocol-layer-rev', difficulty: 3,
    prompt: c => `Welches dieser Protokolle arbeitet auf der „${c.attributes.layer}“?`
  },
  {
    category: 'acronym', attr: 'domain', kind: 'name', type: 'machina-acronym-domain-rev', difficulty: 2,
    prompt: c => `Welche dieser Abkürzungen gehört in das Gebiet „${c.attributes.domain}“?`
  },
  {
    category: 'hardware', attr: 'category', kind: 'name', type: 'machina-hw-category-rev', difficulty: 3,
    prompt: c => `Welche dieser Komponenten gehört zur Gruppe „${c.attributes.category}“?`
  },

  // ==== KLASSISCHE TECHNIK (Handwerk / Mechanik / Maschinenbau) =============
  // Achse weiterhin Funktionsprinzip: "wie funktioniert / was leistet es",
  // NIE Erfindungsdatum/-person (das bliebe Historia). Freitext-cat-Templates
  // (Funktion/Zweck/Eigenschaft/Wirkprinzip) ziehen Distraktoren aus den
  // Freitexten anderer Konzepte derselben Kategorie — identisch zu hw-function.

  // ---- Handwerkzeuge (tool) ----------------------------------------------
  {
    category: 'tool', attr: 'trade', kind: 'cat', type: 'machina-tool-trade', difficulty: 2,
    prompt: c => `Welchem Gewerk ist das Werkzeug ${c.name} typischerweise zugeordnet?`
  },
  {
    category: 'tool', attr: 'function', kind: 'cat', type: 'machina-tool-function', difficulty: 2,
    prompt: c => `Welche Aufgabe erfüllt das Werkzeug ${c.name}?`
  },
  {
    category: 'tool', attr: 'trade', kind: 'name', type: 'machina-tool-trade-rev', difficulty: 2,
    prompt: c => `Welches dieser Werkzeuge gehört vor allem in das Gewerk „${c.attributes.trade}“?`
  },

  // ---- Maschinenelemente (machine_element) -------------------------------
  {
    category: 'machine_element', attr: 'category', kind: 'cat', type: 'machina-elem-category', difficulty: 3,
    // "Element" im Prompt meiden, falls Antwortwerte den Stamm tragen.
    prompt: c => `Zu welcher Gruppe von Maschinenbauteilen zählt ${c.name}?`
  },
  {
    category: 'machine_element', attr: 'function', kind: 'cat', type: 'machina-elem-function', difficulty: 2,
    prompt: c => `Welche Aufgabe erfüllt das Maschinenbauteil ${c.name}?`
  },
  {
    category: 'machine_element', attr: 'category', kind: 'name', type: 'machina-elem-category-rev', difficulty: 3,
    prompt: c => `Welches dieser Maschinenbauteile gehört zur Gruppe „${c.attributes.category}“?`
  },

  // ---- Kraftmaschinen / Antriebe (engine) --------------------------------
  {
    category: 'engine', attr: 'type', kind: 'cat', type: 'machina-engine-type', difficulty: 3,
    prompt: c => `Zu welcher Gattung von Kraftmaschinen zählt ${c.name}?`
  },
  {
    category: 'engine', attr: 'energySource', kind: 'cat', type: 'machina-engine-energy', difficulty: 2,
    prompt: c => `Mit welcher Energiequelle arbeitet ${c.name} primär?`
  },
  {
    category: 'engine', attr: 'type', kind: 'name', type: 'machina-engine-type-rev', difficulty: 3,
    prompt: c => `Welche dieser Maschinen zählt zur Gattung „${c.attributes.type}“?`
  },
  {
    category: 'engine', attr: 'energySource', kind: 'name', type: 'machina-engine-energy-rev', difficulty: 2,
    prompt: c => `Welche dieser Kraftmaschinen wird primär mit „${c.attributes.energySource}“ betrieben?`
  },

  // ---- Fertigungsverfahren (manufacturing_process) -----------------------
  {
    category: 'manufacturing_process', attr: 'mainGroup', kind: 'cat', type: 'machina-mfg-maingroup', difficulty: 3,
    prompt: c => `Welcher Hauptgruppe der Fertigungsverfahren (DIN 8580) ordnet man ${c.name} zu?`
  },
  {
    category: 'manufacturing_process', attr: 'purpose', kind: 'cat', type: 'machina-mfg-purpose', difficulty: 2,
    prompt: c => `Was bewirkt das Fertigungsverfahren ${c.name}?`
  },
  {
    category: 'manufacturing_process', attr: 'mainGroup', kind: 'name', type: 'machina-mfg-maingroup-rev', difficulty: 3,
    prompt: c => `Welches dieser Fertigungsverfahren gehört zur Hauptgruppe „${c.attributes.mainGroup}“?`
  },

  // ---- Technische Werkstoffe (material) ----------------------------------
  {
    category: 'material', attr: 'materialClass', kind: 'cat', type: 'machina-material-class', difficulty: 3,
    // "Werkstoff" im Prompt meiden, falls Klassenwerte den Stamm tragen.
    prompt: c => `Zu welcher Werkstoffgruppe zählt ${c.name}?`
  },
  {
    category: 'material', attr: 'property', kind: 'cat', type: 'machina-material-property', difficulty: 3,
    prompt: c => `Welche Eigenschaft bzw. Verwendung kennzeichnet ${c.name} vor allem?`
  },
  {
    category: 'material', attr: 'materialClass', kind: 'name', type: 'machina-material-class-rev', difficulty: 3,
    prompt: c => `Welcher dieser Werkstoffe gehört zur Gruppe „${c.attributes.materialClass}“?`
  },

  // ---- Einfache Maschinen & Mechanismen (simple_machine) -----------------
  {
    category: 'simple_machine', attr: 'function', kind: 'cat', type: 'machina-simple-function', difficulty: 2,
    prompt: c => `Welche mechanische Aufgabe erfüllt ${c.name}?`
  },
  {
    category: 'simple_machine', attr: 'principle', kind: 'cat', type: 'machina-simple-principle', difficulty: 3,
    prompt: c => `Auf welchem physikalischen Wirkprinzip beruht ${c.name}?`
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
      if (n === null) { countSkip(tpl, 'kein sauberer Zahlenwert'); continue; }
      correct = tpl.format(n);
      distractors = pickNumeric(n, numPool, tpl.format);
    } else {
      // Slash-/Sammelwerte als korrekte Antwort mehrdeutig -> überspringen.
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
