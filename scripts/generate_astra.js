/**
 * Generator für die Astra-Domain (Astronomie).
 *
 * Liest die verifizierte Faktenbasis aus scripts/data_sources/astra_raw.json und
 * erzeugt daraus zwei Artefakte (analog zu Terra):
 *   - public/data/concepts_astra.json  : Konzeptspeicher (Map id -> Konzept),
 *                                         domainspezifisches Analogon zu geodb.entities
 *   - public/data/questions_astra.json : generierte Multiple-Choice-Fragen
 *
 * Leitidee laut Plan: Die Recherche/Verifikation der Fakten ist die eigentliche
 * Arbeit (passiert vorgelagert), das Templating hier ist nur die mechanische
 * Ableitung. Distraktoren stammen IMMER aus derselben Kategorie und demselben
 * Attribut -> plausibel und nicht trivial ausschliessbar.
 *
 * Aufruf: node scripts/generate_astra.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pickBalanced, deParse, shouldMagnitudeSpread, magnitudeSpreadDistractors } from './lib/quizrandom.js';
import { norm, deNum, revealsAnswerStrict as revealsAnswer } from './lib/generator_text.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW_PATH = join(__dirname, 'data_sources', 'astra_raw.json');
const CONCEPTS_OUT = join(ROOT, 'public', 'data', 'concepts_astra.json');
const QUESTIONS_OUT = join(ROOT, 'public', 'data', 'questions_astra.json');

const DOMAIN = 'astra';

// --- kleine Helfer -------------------------------------------------------

/**
 * Rundet auf `sig` signifikante Stellen. Gebraucht für die proportional
 * gestreuten Distraktoren (spreadNumeric): korrekter Wert UND Distraktoren
 * werden auf dieselbe Stellenzahl gerundet, damit das Anzeigeformat nicht die
 * Antwort verrät (sonst stünde z.B. „232,02" exakt neben runden Distraktoren).
 */
function roundSig(x, sig = 2) {
  if (!isFinite(x) || x === 0) return x;
  const mag = Math.pow(10, sig - Math.ceil(Math.log10(Math.abs(x))));
  return Math.round(x * mag) / mag;
}

/**
 * Wählt bis zu 3 Distraktoren aus einem Pool möglicher Werte.
 * - numeric=true: die dem korrekten Wert NAECHSTLIEGENDEN Werte (am verwechselbarsten)
 * - numeric=false: die ersten abweichenden Werte in Pool-Reihenfolge
 * Der korrekte Wert wird stets ausgeschlossen, Duplikate werden entfernt.
 */
function pickDistractors(correct, pool, numeric) {
  const unique = [...new Set(pool.map(v => String(v)))].filter(v => v !== String(correct));
  if (numeric) {
    // deParse statt Number(): einheitsbehaftete Werte („4,5 mag", „7,3 km")
    // ergeben mit Number()=NaN → die Wertnähe-Sortierung versagte und fiel auf
    // feste erste-3-Distraktoren zurück (Magnitude-Bug: domainweit Sonne/Sirius/
    // Beteigeuze als absurde Fix-Distraktoren).
    const cNum = deParse(correct);
    unique.sort((a, b) => Math.abs(deParse(a) - cNum) - Math.abs(deParse(b) - cNum));
    return unique.slice(0, 3);
  }
  // numeric=false: längen-balanciert statt Pool-Reihenfolge → kein Längen-Bias.
  return pickBalanced(correct, unique, 3);
}

// --- deterministischer Mini-Hash (FNV-1a) ---------------------------------
// Für die Reverse-Fragen (Welle 1) wollen wir die Distraktor-Namen pro Frage
// VARIIEREN (sonst stünden immer die ersten Konzepte der Datenreihenfolge als
// falsche Optionen da — das wäre durchschaubar). Math.random() wäre aber nicht
// reproduzierbar (jeder Generator-Lauf ergäbe ein anderes Artefakt). Daher:
// deterministische Pseudo-Zufallsreihenfolge über einen Hash aus Frage-Seed +
// Kandidatenname — stabil über Läufe, aber je Frage anders gemischt.
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// --- Faktenbasis laden ---------------------------------------------------

const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));

// Konzepte nach Kategorie gruppieren (für kategorie-interne Distraktoren)
const byCategory = {};
for (const c of raw) {
  (byCategory[c.category] ||= []).push(c);
}

// --- brightestStar je Sternbild herleiten (aus den Sterndaten) -----------
// Sternbilder tragen keinen "hellster Stern"-Wert; wir leiten ihn aus den
// Sternkonzepten ab: der Stern mit der KLEINSTEN scheinbaren Helligkeit
// (apparentMagnitude) je Sternbild ist der hellste. Das `star.constellation`-
// Feld ist uneinheitlich formatiert ("Adler" vs. "Adler (Aquila)" vs.
// "Andromeda (Sternbild)") -> Kernnamen normalisieren (Klammer-Suffix entfernen)
// und gegen den Sternbild-Kernnamen joinen. Nur ~57 der 88 Sternbilder sind im
// Sterndatensatz vertreten; die übrigen bekommen keinen Wert und werden vom
// Template übersprungen. Der Wert landet als Attribut am Sternbild-Konzept und
// dient dem neuen "hellster Stern"-Template als Antwort.
const constCore = s => String(s || '').replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
const brightestByConstellation = {};
for (const s of (byCategory.star || [])) {
  const key = constCore(s.attributes?.constellation);
  const mag = s.attributes?.apparentMagnitude;
  if (!key || typeof mag !== 'number' || !isFinite(mag)) continue;
  const cur = brightestByConstellation[key];
  // Sternnamen tragen teils einen Klammer-Zusatz (internationaler Name/Bayer-
  // Bezeichnung, z.B. "Atair (Altair)", "Prokyon (Procyon)"). Für die MCQ-Optionen
  // den Kern-Namen nehmen -> alle Optionen einheitlich formatiert (kein Format-Tell,
  // bei dem die einzige Antwort mit/ohne Klammer heraussticht).
  const name = s.name.replace(/\s*\([^)]*\)\s*$/, '');
  if (!cur || mag < cur.mag) brightestByConstellation[key] = { mag, name };
}
// Sternbilder, deren REAL hellster Stern NICHT im Sterndatensatz enthalten ist:
// die magnitude-basierte Herleitung wuerde hier einen faktisch FALSCHEN "hellsten"
// Stern liefern (der real hellste fehlt, ein schwaecherer ist der einzige/hellste
// im Teil-Datensatz). Gegen Wikipedia verifiziert (2026-07-01) -> ausgeschlossen,
// bis die fehlenden Sterne nachgetragen sind. Real hellster Stern je Fall:
const BRIGHTEST_STAR_INCOMPLETE = new Set([
  'schwertfisch',    // real: Alpha Doradus (3,27) — unser R136a1 (12,78) ist nur der einzige Dorado-Stern im Datensatz
  'pfeil',           // real: Gamma Sagittae (3,47) — unser Sham (Alpha Sagittae, 4,38) ist nicht der hellste
  'fische',          // real: Alpherg/Eta Piscium (3,62) — unser Alrescha (Alpha Piscium, 3,82) ist nicht der hellste
  'schlangenträger', // real: Rasalhague/Alpha Ophiuchi (2,08) — unser Sabik (2,42) ist nur der zweithellste
  'becher'           // real: Delta Crateris (3,57) — unser Alkes/Alpha Crateris (4,08) ist nicht der hellste
]);
for (const c of (byCategory.constellation || [])) {
  if (BRIGHTEST_STAR_INCOMPLETE.has(constCore(c.name))) continue;
  const hit = brightestByConstellation[constCore(c.name)];
  if (hit) c.attributes.brightestStar = hit.name;
}

// --- Konzeptspeicher bauen ----------------------------------------------
// Key-Schema laut Plan 4.1: "<domain>:<conceptId>" (z.B. astra:mars).
const concepts = {};
for (const c of raw) {
  const key = `${DOMAIN}:${c.id}`;
  concepts[key] = {
    id: key,
    name: c.name,
    type: c.category, // dient zugleich als SRS-/Dashboard-Typ
    category: c.category,
    attributes: c.attributes,
    funFact: c.funFact || '',
    source: { name: c.sourceName, url: c.sourceUrl || '' },
    // Bild fürs spätere Museum + (optionale) Konzept-Illustration mitführen
    // (wie Natura). Bestandskonzepte ohne Ernte-Bild bekommen null.
    image: c.imageFile
      ? { url: c.imageFile, license: c.imageLicense || '', attribution: c.imageAttribution || '' }
      : null
  };
}

// --- Frage-Templates -----------------------------------------------------
// Jedes Template beschreibt: auf welche Kategorie es zielt, welches Attribut
// abgefragt wird, wie Prompt und korrekte Antwort formatiert werden, und mit
// welcher Schwierigkeit. Distraktoren zieht die Engine generisch aus derselben
// Kategorie/demselben Attribut.

const templates = [
  // ---- Planeten -------------------------------------------------------
  {
    category: 'planet', attr: 'orderFromSun', type: 'astra-planet-order', difficulty: 1,
    prompt: c => `Die wievielte Position von der Sonne nimmt ${c.name} ein?`,
    format: v => `${v}.`
  },
  {
    category: 'planet', attr: 'numMoons', type: 'astra-planet-moons', difficulty: 2,
    prompt: c => `Wie viele Monde hat ${c.name} (nach gängiger Zählung)?`,
    format: v => `${deNum(v)}`, numeric: true
  },
  {
    category: 'planet', attr: 'type', type: 'astra-planet-type', difficulty: 2,
    prompt: c => `Zu welchem Planetentyp gehört ${c.name}?`,
    format: v => v,
    extraDistractors: ['Zwergplanet']
  },
  {
    category: 'planet', attr: 'distanceFromSunAU', type: 'astra-planet-au', difficulty: 3,
    prompt: c => `In welcher mittleren Entfernung umkreist ${c.name} die Sonne?`,
    format: v => `${deNum(v)} AE`, numeric: true
  },
  {
    category: 'planet', attr: 'diameterKm', type: 'astra-planet-diameter', difficulty: 3,
    prompt: c => `Welchen ungefähren Durchmesser hat ${c.name}?`,
    format: v => `${deNum(v)} km`, numeric: true
  },
  // ---- Zwergplaneten --------------------------------------------------
  {
    category: 'dwarf_planet', attr: 'location', type: 'astra-dwarf-location', difficulty: 3,
    prompt: c => `In welcher Region des Sonnensystems befindet sich der Zwergplanet ${c.name}?`,
    format: v => v,
    extraDistractors: ['Oortsche Wolke', 'Streuscheibe']
  },
  {
    category: 'dwarf_planet', attr: 'discoveredYear', type: 'astra-dwarf-year', difficulty: 4,
    prompt: c => `In welchem Jahr wurde der Zwergplanet ${c.name} entdeckt?`,
    format: v => `${v}`, numeric: true
  },
  // ---- Monde ----------------------------------------------------------
  {
    category: 'moon', attr: 'parentPlanet', type: 'astra-moon-parent', difficulty: 2,
    prompt: c => `Um welchen Himmelskörper kreist der Mond ${c.name}?`,
    format: v => v
  },
  // ---- Sterne ---------------------------------------------------------
  {
    category: 'star', attr: 'constellation', type: 'astra-star-constellation', difficulty: 3,
    prompt: c => `In welchem Sternbild liegt ${c.name}?`,
    format: v => v,
    skip: c => !c.attributes.constellation // Sonne hat kein Sternbild
  },
  {
    category: 'star', attr: 'type', type: 'astra-star-type', difficulty: 3,
    // „Sterntyp“ verriete die mögliche Antwort „Stern“ bereits im Fragetext.
    prompt: c => `Zu welcher Klasse von Himmelskörpern gehört ${c.name}?`,
    format: v => v
  },
  {
    category: 'star', attr: 'distanceLy', type: 'astra-star-distance', difficulty: 4,
    prompt: c => `Wie weit ist ${c.name} ungefähr von der Erde entfernt?`,
    format: v => `${deNum(v)} Lichtjahre`, numeric: true,
    skip: c => Number(c.attributes.distanceLy) < 0.1 // Sonne ausschliessen
  },
  // ---- Galaxien -------------------------------------------------------
  {
    category: 'galaxy', attr: 'type', type: 'astra-galaxy-type', difficulty: 3,
    prompt: c => `Welcher Galaxientyp ist ${c.name}?`,
    format: v => v,
    extraDistractors: ['Elliptische Galaxie', 'Irreguläre Galaxie']
  },
  {
    category: 'galaxy', attr: 'distanceLy', type: 'astra-galaxy-distance', difficulty: 4,
    prompt: c => `Wie weit ist ${c.name} ungefähr von der Erde entfernt?`,
    format: v => `${deNum(v)} Lichtjahre`, numeric: true,
    skip: c => Number(c.attributes.distanceLy) < 1 // Milchstraße (0) ausschliessen
  },
  // ---- Konstanten -----------------------------------------------------
  // Umgekehrte Frage: vom Wert auf den Namen schliessen. Distraktoren sind
  // andere Konstanten-Namen (gleiche Kategorie) -> sauber und eindeutig.
  {
    category: 'constant', attr: '__name__', type: 'astra-constant-value', difficulty: 3,
    subject: c => `${c.attributes.value} ${c.attributes.unit}`, // Hinweis ist der Wert
    prompt: c => `Welche astronomische Größe hat ungefähr den Wert von ${c.attributes.value} ${c.attributes.unit}?`,
    format: (_v, c) => c.name,
    nameAnswer: true
  },

  // ==== Erweiterte Fragetypen (Stand 2026-06-04, Richtung 5000) ============
  // Nutzen ausschliesslich bereits verifizierte Attribute -> keine neuen Fakten,
  // nur zusätzliche, echte Lernwinkel je Konzept.

  // ---- Planeten: Tag/Jahr + Reverse-Position --------------------------
  {
    category: 'planet', attr: 'orderFromSun', type: 'astra-planet-order-rev', difficulty: 2,
    subject: c => `${c.attributes.orderFromSun}.`, // Hinweis ist die Position, nicht der Name
    prompt: c => `Welcher Planet ist der ${c.attributes.orderFromSun}. von der Sonne?`,
    format: (_v, c) => c.name, nameAnswer: true
  },
  {
    category: 'planet', attr: 'dayLengthHours', type: 'astra-planet-day', difficulty: 3,
    prompt: c => `Wie lang dauert ein Tag (Rotation) auf ${c.name} ungefähr?`,
    format: v => `${deNum(v)} Stunden`, numeric: true
  },
  {
    category: 'planet', attr: 'yearLengthEarthDays', type: 'astra-planet-year', difficulty: 3,
    prompt: c => `Wie lang dauert ein Jahr (Sonnenumlauf) auf ${c.name} in Erdtagen?`,
    format: v => `${deNum(v)} Erdtage`, numeric: true
  },
  // ---- Zwergplaneten: Durchmesser + Umlaufzeit ------------------------
  {
    category: 'dwarf_planet', attr: 'diameterKm', type: 'astra-dwarf-diameter', difficulty: 4,
    prompt: c => `Welchen ungefähren Durchmesser hat der Zwergplanet ${c.name}?`,
    format: v => `${deNum(v)} km`, numeric: true
  },
  {
    category: 'dwarf_planet', attr: 'yearLengthEarthYears', type: 'astra-dwarf-year-len', difficulty: 4,
    prompt: c => `Wie lange braucht ${c.name} für einen Sonnenumlauf?`,
    format: v => `${deNum(v)} Erdjahre`, numeric: true
  },
  // ---- Monde: Durchmesser ---------------------------------------------
  {
    category: 'moon', attr: 'diameterKm', type: 'astra-moon-diameter', difficulty: 3,
    prompt: c => `Welchen ungefähren Durchmesser hat der Mond ${c.name}?`,
    format: v => `${deNum(v)} km`, numeric: true
  },
  // ---- Sterne: scheinbare Helligkeit ----------------------------------
  {
    category: 'star', attr: 'apparentMagnitude', type: 'astra-star-magnitude', difficulty: 4,
    prompt: c => `Welche scheinbare Helligkeit (Magnitude) hat ${c.name} ungefähr?`,
    format: v => `${deNum(v)} mag`, numeric: true,
    skip: c => c.attributes.apparentMagnitude === undefined
  },
  // ---- Konstanten: Name -> Wert (Gegenrichtung zur bestehenden Frage) -
  {
    category: 'constant', attr: 'value', type: 'astra-constant-name', difficulty: 2,
    prompt: c => `Welchen Wert hat ${c.name} ungefähr?`,
    format: (_v, c) => `${c.attributes.value} ${c.attributes.unit}`
  },

  // ==== Phase-5-Erweiterung (Stand 2026-06-05, Richtung 5000/Domain) =======
  // Nutzen ausschliesslich bereits verifizierte Attribute -> keine neuen Fakten.
  // (a) Zwergplaneten-Mondzahl als eigener Vorwärts-Typ (Spiegel zu astra-planet-moons),
  // (b)+(c) Reverse-Recall von vorhandenen numerischen Planeten-Attributen auf den Namen.

  // ---- Zwergplaneten: Mondzahl ----------------------------------------
  {
    category: 'dwarf_planet', attr: 'numMoons', type: 'astra-dwarf-moons', difficulty: 3,
    prompt: c => `Wie viele Monde hat der Zwergplanet ${c.name} (nach gängiger Zählung)?`,
    format: v => `${deNum(v)}`, numeric: true
  },
  // ---- Planeten: Durchmesser -> Name (Gegenrichtung) ------------------
  {
    category: 'planet', attr: 'diameterKm', type: 'astra-planet-diameter-rev', difficulty: 4, nameAnswer: true,
    subject: c => `${deNum(c.attributes.diameterKm)} km`, // Hinweis ist der Durchmesser, nicht der Name
    format: (_v, c) => c.name,
    prompt: c => `Welcher Planet hat einen ungefähren Durchmesser von ${deNum(c.attributes.diameterKm)} km?`
  },
  // ---- Planeten: Jahreslänge -> Name (Gegenrichtung) -----------------
  {
    category: 'planet', attr: 'yearLengthEarthDays', type: 'astra-planet-year-rev', difficulty: 4, nameAnswer: true,
    subject: c => `${deNum(c.attributes.yearLengthEarthDays)} Erdtage`, // Hinweis ist die Jahreslänge, nicht der Name
    format: (_v, c) => c.name,
    prompt: c => `Welcher Planet umrundet die Sonne in etwa ${deNum(c.attributes.yearLengthEarthDays)} Erdtagen?`
  },

  // ==== Welle-1-Erweiterung (Stand 2026-06-10) ==============================
  // Zwei Hebel, ausschliesslich aus bereits verifizierten Attributen:
  //  (a) Reverse-Spiegelungen bestehender Vorwärts-Fragen (Wert -> Name),
  //  (b) Templates für die neuen Ernte-Kategorien (nach merge_astra.js).
  //
  // Neue Engine-Flags (Mechanik unten in der Generier-Schleife):
  //  - reverseUnique: Reverse-Frage (Antwort = Konzeptname). KORREKTHEITS-GUARD:
  //    teilt ein anderes Konzept derselben Kategorie den abgefragten Wert,
  //    wird die Frage ÜBERSPRUNGEN (sonst wären mehrere Optionen richtig bzw.
  //    die Frage in der Welt mehrdeutig). Distraktoren sind nur Konzepte mit
  //    nachweislich ANDEREM Wert beim getesteten Attribut.
  //  - numericByValue: numerische Vorwärts-Frage, deren Distraktoren anhand
  //    der ROHEN Zahlenwerte nach Nähe gewählt werden (echte Nachbarwerte,
  //    wie generate_natura) — erst danach wird formatiert. Nicht-numerische
  //    Werte (z. B. Massen-Strings wie "2,59 × 10²⁰") werden übersprungen.
  //
  // BEWUSST AUSGELASSEN (zu kleine/ungeeignete Pools):
  //  - comet, star_cluster, constellation, object: nur je 3 Konzepte
  //    -> maximal 3 Optionen, laut Qualitätslatte lieber keine Frage.
  //  - phenomenon (5 Konzepte): Attribute fast vollständig disjunkt
  //    (Sonnenfinsternis/Polarlicht/Sgr A*/Roter Riese/Supernova teilen kein
  //    Attribut mit >= 4 Trägern) -> kein fairer Distraktor-Pool möglich.
  //  - nebula.type: zwei Werte beginnen mit "Emissions- und Reflexionsnebel"
  //    -> als MCQ-Optionen mehrdeutig (Orionnebel enthält selbst einen
  //    offenen Sternhaufen), Frage wäre unfair.
  //  - asteroid.massKg: Strings mit eingebackener Einheit/Notation -> keine
  //    numerische Frage möglich, kategorisch ohne Mehrwert.
  //  - meteor_shower.zhrMax/entrySpeedKmS/radiantConstellation, exoplanet.
  //    orbitalPeriodDays, mission.currentDistanceAU: nur 3 Träger -> Pool < 4.

  // ---- (a) Planeten: Mondzahl -> Name ---------------------------------
  {
    category: 'planet', attr: 'numMoons', type: 'astra-planet-moons-rev', difficulty: 3,
    nameAnswer: true, reverseUnique: true,
    // Singular/Plural sauber: "1 Mond", sonst "95 Monde".
    subject: c => c.attributes.numMoons === 1 ? '1 Mond' : `${deNum(c.attributes.numMoons)} Monde`,
    format: (_v, c) => c.name,
    prompt: c => c.attributes.numMoons === 1
      ? 'Welcher Planet hat (nach gängiger Zählung) genau einen Mond?'
      : `Welcher Planet hat (nach gängiger Zählung) ${deNum(c.attributes.numMoons)} Monde?`
    // Merkur + Venus teilen sich den Wert 0 -> beide Fragen entfallen (Guard).
  },
  // ---- (a) Planeten: Sonnenabstand (AE) -> Name ------------------------
  {
    category: 'planet', attr: 'distanceFromSunAU', type: 'astra-planet-au-rev', difficulty: 4,
    nameAnswer: true, reverseUnique: true,
    subject: c => `${deNum(c.attributes.distanceFromSunAU)} AE`,
    format: (_v, c) => c.name,
    prompt: c => `Welcher Planet umkreist die Sonne in einer mittleren Entfernung von ${deNum(c.attributes.distanceFromSunAU)} AE?`
  },
  // ---- (a) Planeten: Tageslänge -> Name --------------------------------
  {
    category: 'planet', attr: 'dayLengthHours', type: 'astra-planet-day-rev', difficulty: 4,
    nameAnswer: true, reverseUnique: true,
    subject: c => `${deNum(c.attributes.dayLengthHours)} Stunden`,
    format: (_v, c) => c.name,
    prompt: c => `Auf welchem Planeten dauert ein Tag (Rotation) etwa ${deNum(c.attributes.dayLengthHours)} Stunden?`
  },
  // ---- (a) Monde: Durchmesser -> Name (Pool: 28 Monde) ------------------
  {
    category: 'moon', attr: 'diameterKm', type: 'astra-moon-diameter-rev', difficulty: 4,
    nameAnswer: true, reverseUnique: true,
    subject: c => `${deNum(c.attributes.diameterKm)} km`,
    format: (_v, c) => c.name,
    prompt: c => `Welcher Mond hat einen ungefähren Durchmesser von ${deNum(c.attributes.diameterKm)} km?`
  },
  // ---- (a) Sterne: Sternbild -> Name ------------------------------------
  // Mehrere Sterne im selben Sternbild (Orion: Beteigeuze/Rigel/Bellatrix,
  // Zentaur, Zwillinge) -> diese Fragen entfallen über den Guard.
  {
    category: 'star', attr: 'constellation', type: 'astra-star-constellation-rev', difficulty: 3,
    nameAnswer: true, reverseUnique: true,
    skip: c => !c.attributes.constellation, // Sonne hat kein Sternbild
    subject: c => `Sternbild ${c.attributes.constellation}`,
    format: (_v, c) => c.name,
    prompt: c => `Welcher Stern liegt im Sternbild ${c.attributes.constellation}?`
  },
  // ---- (a) Sterne: scheinbare Helligkeit -> Name -------------------------
  {
    category: 'star', attr: 'apparentMagnitude', type: 'astra-star-magnitude-rev', difficulty: 4,
    nameAnswer: true, reverseUnique: true,
    skip: c => c.attributes.apparentMagnitude === undefined,
    subject: c => `${deNum(c.attributes.apparentMagnitude)} mag`,
    format: (_v, c) => c.name,
    prompt: c => `Welcher Stern hat eine scheinbare Helligkeit von etwa ${deNum(c.attributes.apparentMagnitude)} mag?`
  },
  // ---- (a) Sterne: Entfernung -> Name ------------------------------------
  // Spica + Bellatrix teilen sich 250 Lj -> beide entfallen über den Guard.
  {
    category: 'star', attr: 'distanceLy', type: 'astra-star-distance-rev', difficulty: 4,
    nameAnswer: true, reverseUnique: true,
    skip: c => Number(c.attributes.distanceLy) < 0.1, // Sonne ausschliessen
    subject: c => `${deNum(c.attributes.distanceLy)} Lichtjahre`,
    format: (_v, c) => c.name,
    prompt: c => `Welcher Stern ist etwa ${deNum(c.attributes.distanceLy)} Lichtjahre von der Erde entfernt?`
  },
  // ---- (a) Galaxien: Typ -> Name ------------------------------------------
  // "Spiralgalaxie"/"Zwerggalaxie" sind mehrfach vergeben -> nur die
  // eindeutigen Typen (Balkenspiral-, Starburst-, Elliptische) überleben.
  {
    category: 'galaxy', attr: 'type', type: 'astra-galaxy-type-rev', difficulty: 4,
    nameAnswer: true, reverseUnique: true,
    subject: c => c.attributes.type,
    format: (_v, c) => c.name,
    prompt: c => `Welche dieser Galaxien gehört zum Typ „${c.attributes.type}“?`
  },
  // ---- (a) Galaxien: Entfernung -> Name -----------------------------------
  // Zigarrengalaxie + Centaurus A teilen sich 12 Mio. Lj -> entfallen (Guard).
  {
    category: 'galaxy', attr: 'distanceLy', type: 'astra-galaxy-distance-rev', difficulty: 4,
    nameAnswer: true, reverseUnique: true,
    skip: c => Number(c.attributes.distanceLy) < 1, // Milchstraße (0) ausschliessen
    subject: c => `${deNum(c.attributes.distanceLy)} Lichtjahre`,
    format: (_v, c) => c.name,
    prompt: c => `Welche Galaxie ist etwa ${deNum(c.attributes.distanceLy)} Lichtjahre von der Erde entfernt?`
  },

  // ---- (b) Missionen (11 Konzepte) ---------------------------------------
  // launchYear ist nach dem Merge bei 9 von 11 gesetzt (aus startjahr bzw.
  // aus dem ISO-Startdatum abgeleitet) -> grösster Pool der Kategorie.
  {
    category: 'mission', attr: 'launchYear', type: 'astra-mission-launch-year', difficulty: 3,
    numericByValue: true,
    prompt: c => `In welchem Jahr startete die Mission „${c.name}“?`,
    format: v => `${v}` // Jahreszahl ohne Tausenderpunkt
  },
  {
    category: 'mission', attr: 'launchYear', type: 'astra-mission-launch-year-rev', difficulty: 4,
    nameAnswer: true, reverseUnique: true,
    // Voyager 1 + 2 starteten beide 1977 -> beide entfallen über den Guard.
    subject: c => `Startjahr ${c.attributes.launchYear}`,
    format: (_v, c) => c.name,
    prompt: c => `Welche dieser Missionen startete im Jahr ${c.attributes.launchYear}?`
  },
  {
    category: 'mission', attr: 'launchMassKg', type: 'astra-mission-launch-mass', difficulty: 4,
    numericByValue: true,
    prompt: c => `Welche Startmasse hatte die Mission „${c.name}“?`,
    format: v => `${deNum(v)} kg`
  },
  {
    category: 'mission', attr: 'operator', type: 'astra-mission-operator', difficulty: 3,
    prompt: c => `Wer betreibt (oder betrieb) die Mission „${c.name}“?`,
    format: v => v
    // "Gaia (ESA)" entfällt automatisch über den Selbstverräter-Guard
    // (Antwort "ESA" steckt im Namen).
  },

  // ---- (b) Nebel (5 Konzepte) ----------------------------------------------
  {
    category: 'nebula', attr: 'distanceLy', type: 'astra-nebula-distance', difficulty: 3,
    numericByValue: true,
    prompt: c => `Wie weit ist der ${c.name} ungefähr von der Erde entfernt?`,
    format: v => `${deNum(v)} Lichtjahre`
  },
  {
    category: 'nebula', attr: 'distanceLy', type: 'astra-nebula-distance-rev', difficulty: 4,
    nameAnswer: true, reverseUnique: true,
    subject: c => `${deNum(c.attributes.distanceLy)} Lichtjahre`,
    format: (_v, c) => c.name,
    prompt: c => `Welcher Nebel ist etwa ${deNum(c.attributes.distanceLy)} Lichtjahre von der Erde entfernt?`
  },
  {
    category: 'nebula', attr: 'messierNumber', type: 'astra-nebula-messier', difficulty: 4,
    numericByValue: true,
    // Selbstverräter-Skip: Nebel, deren Name die Messier-Nummer enthält (z.B.
    // "Messier 17 (Omeganebel)"), verraten die Antwort schon im Prompt -> auslassen.
    // Der generische revealsAnswer-Guard fängt das nicht, weil "M17" nicht als
    // Substring in "messier17omeganebel" steckt.
    skip: c => /Messier\s*\d+/i.test(c.name || ''),
    prompt: c => `Welche Messier-Nummer trägt der ${c.name}?`,
    format: v => `M${v}` // Katalognummer, kein Zahlenformat
  },
  {
    category: 'nebula', attr: 'messierNumber', type: 'astra-nebula-messier-rev', difficulty: 4,
    nameAnswer: true, reverseUnique: true,
    // Analog: als Antwort-Option würde "Messier 17 (Omeganebel)" die gefragte
    // Nummer M17 direkt nennen -> solche Namen als Antwort ausschließen.
    skip: c => /Messier\s*\d+/i.test(c.name || ''),
    subject: c => `M${c.attributes.messierNumber}`,
    format: (_v, c) => c.name,
    prompt: c => `Welcher Nebel trägt die Messier-Nummer M${c.attributes.messierNumber}?`
  },
  {
    category: 'nebula', attr: 'diameterLy', type: 'astra-nebula-diameter', difficulty: 4,
    numericByValue: true,
    prompt: c => `Welche ungefähre Ausdehnung hat der ${c.name}?`,
    format: v => `${deNum(v)} Lichtjahre`
  },
  {
    category: 'nebula', attr: 'constellation', type: 'astra-nebula-constellation', difficulty: 3,
    prompt: c => `In welchem Sternbild liegt der ${c.name}?`,
    format: v => v,
    // Nur 3 verschiedene Sternbild-Werte im Pool (Orion doppelt) -> mit echten
    // Sternbildern auffüllen, damit 4 Optionen zustande kommen. "Stier" wäre
    // nur beim Krebsnebel richtig — der hat aber kein Sternbild-Attribut und
    // bekommt daher keine Frage dieses Typs.
    extraDistractors: ['Stier', 'Schwan']
    // Orionnebel (liegt im Orion) entfällt über den Selbstverräter-Guard.
  },

  // ---- (b) Asteroiden (5 Konzepte) -----------------------------------------
  // diameterKm ist nach dem Merge bei allen 5 gesetzt (Bennu/Apophis exakt
  // aus Metern umgerechnet). Anzeige unter 1 km in Metern — reine Formatierung.
  {
    category: 'asteroid', attr: 'diameterKm', type: 'astra-asteroid-diameter', difficulty: 3,
    numericByValue: true,
    prompt: c => `Welchen ungefähren Durchmesser hat der Asteroid ${c.name}?`,
    format: v => v < 1 ? `${deNum(v * 1000)} m` : `${deNum(v)} km`
  },
  {
    category: 'asteroid', attr: 'diameterKm', type: 'astra-asteroid-diameter-rev', difficulty: 4,
    nameAnswer: true, reverseUnique: true,
    subject: c => c.attributes.diameterKm < 1
      ? `${deNum(c.attributes.diameterKm * 1000)} m`
      : `${deNum(c.attributes.diameterKm)} km`,
    format: (_v, c) => c.name,
    prompt: c => `Welcher Asteroid hat einen ungefähren Durchmesser von ${c.attributes.diameterKm < 1
      ? `${deNum(c.attributes.diameterKm * 1000)} m`
      : `${deNum(c.attributes.diameterKm)} km`}?`
  },
  {
    category: 'asteroid', attr: 'discoveredYear', type: 'astra-asteroid-year', difficulty: 4,
    numericByValue: true,
    prompt: c => `In welchem Jahr wurde der Asteroid ${c.name} entdeckt?`,
    format: v => `${v}` // Jahreszahl ohne Tausenderpunkt
  },
  {
    category: 'asteroid', attr: 'discoveredYear', type: 'astra-asteroid-year-rev', difficulty: 4,
    nameAnswer: true, reverseUnique: true,
    subject: c => `Entdeckungsjahr ${c.attributes.discoveredYear}`,
    format: (_v, c) => c.name,
    prompt: c => `Welcher Asteroid wurde im Jahr ${c.attributes.discoveredYear} entdeckt?`
  },

  // ---- (b) Meteorströme (4 Konzepte) ----------------------------------------
  // Alle Namen sind Plural ("die Perseiden") -> Prompts passen für alle vier.
  {
    category: 'meteor_shower', attr: 'peakDate', type: 'astra-shower-peak', difficulty: 2,
    prompt: c => `Wann erreichen die ${c.name} ihr jährliches Maximum?`,
    format: v => v
  },
  {
    category: 'meteor_shower', attr: 'peakDate', type: 'astra-shower-peak-rev', difficulty: 3,
    nameAnswer: true, reverseUnique: true,
    subject: c => `Maximum am ${c.attributes.peakDate}`,
    format: (_v, c) => c.name,
    prompt: c => `Welcher Meteorstrom erreicht sein Maximum am ${c.attributes.peakDate}?`
  },
  {
    category: 'meteor_shower', attr: 'parentBody', type: 'astra-shower-parent', difficulty: 4,
    prompt: c => `Welcher Himmelskörper ist der Mutterkörper der ${c.name}?`,
    format: v => v
  },
  {
    category: 'meteor_shower', attr: 'parentBody', type: 'astra-shower-parent-rev', difficulty: 4,
    nameAnswer: true, reverseUnique: true,
    subject: c => c.attributes.parentBody,
    format: (_v, c) => c.name,
    prompt: c => `Welcher Meteorstrom geht auf ${c.attributes.parentBody} zurück?`
  },

  // ---- (b) Exoplaneten (4 Konzepte) ------------------------------------------
  // TRAPPIST-1 ist ein System (kein Einzelplanet) -> neutrale Formulierung
  // "(bzw. welches System)" in den Reverse-Prompts.
  {
    category: 'exoplanet', attr: 'distanceLy', type: 'astra-exo-distance', difficulty: 3,
    numericByValue: true,
    prompt: c => `Wie weit ist ${c.name} ungefähr von der Erde entfernt?`,
    format: v => `${deNum(v)} Lichtjahre`
  },
  {
    category: 'exoplanet', attr: 'distanceLy', type: 'astra-exo-distance-rev', difficulty: 4,
    nameAnswer: true, reverseUnique: true,
    subject: c => `${deNum(c.attributes.distanceLy)} Lichtjahre`,
    format: (_v, c) => c.name,
    prompt: c => `Welcher Exoplanet (bzw. welches System) ist etwa ${deNum(c.attributes.distanceLy)} Lichtjahre von der Erde entfernt?`
  },
  {
    category: 'exoplanet', attr: 'discoveredYear', type: 'astra-exo-year', difficulty: 3,
    numericByValue: true,
    prompt: c => `In welchem Jahr wurde ${c.name} entdeckt?`,
    format: v => `${v}` // Jahreszahl ohne Tausenderpunkt
  },
  {
    category: 'exoplanet', attr: 'discoveredYear', type: 'astra-exo-year-rev', difficulty: 4,
    nameAnswer: true, reverseUnique: true,
    subject: c => `Entdeckungsjahr ${c.attributes.discoveredYear}`,
    format: (_v, c) => c.name,
    prompt: c => `Welcher Exoplanet (bzw. welches System) wurde im Jahr ${c.attributes.discoveredYear} entdeckt?`
  },

  // ==== Welle-2-Erweiterung (Stand 2026-06-12) ==============================
  // Sechs neue Fragetypen aus bisher ungenutzten Attributen, ausschließlich
  // aus bereits verifizierten Daten. Alle neuen Templates folgen den
  // bestehenden Qualitätssicherungs-Mechanismen:
  //  - reverseUnique: Guard gegen Mehrdeutigkeit (identischer Wert bei anderem Konzept)
  //  - numericByValue: Distraktoren nach echtem Zahlenwert-Abstand (nicht String)
  //  - Selbstverräter-Guard greift automatisch über revealsAnswer()
  //
  // BEWUSST AUSGELASSEN (Begründung):
  //  - planet.hasRings: nur 2 mögliche Antworten ('Ja'/'Nein') -> 50% Ratewahrscheinlichkeit,
  //    keine sinnvollen Distraktoren; Reverse nicht eindeutig (je 4 Planeten pro Wert).
  //  - moon.parentPlanet Reverse: 'Erde' (einziger eindeutiger Wert) würde Selbstverräter
  //    auslösen, weil 'erde' in norm('Erdmond (Luna)') enthalten ist -> keine Fragen.
  //  - exoplanet.starType: nur 2 Träger im Datensatz -> Pool zu klein.
  //  - asteroid.type: 2 Asteroiden teilen 'Apollo-Typ' -> Reverse nicht eindeutig;
  //    Vorwärts mit 3 Trägern grenzwertig, Distraktoren schwer kategorieintern.
  //  - nebula.type: alle Werte einzigartig, aber Texte zu unterschiedlich für faire
  //    kategorische Distraktoren (kein gemeinsames Schema wie 'Typ XY').

  // ---- (c) Sterne: Typ -> Name (11 einzigartige Sterntypen) -----------------
  // Gegenstück zu astra-star-type (Name -> Typ, bereits vorhanden).
  // reverseUnique-Guard überspringt die 13 Sterne mit doppeltem Typ automatisch
  // (z.B. 'Weißer Hauptreihenstern' gilt für 5 Sterne -> keine eindeutige Frage).
  // Die 11 Sterne mit einzigartigem Typ erzeugen je eine faire Reverse-Frage;
  // Distraktoren sind die anderen 23 Sterne (mit anderem Typ), durchgemischt per
  // deterministischem Hash.
  {
    category: 'star', attr: 'type', type: 'astra-star-type-rev', difficulty: 4,
    nameAnswer: true, reverseUnique: true,
    // Hinweis ist der Sterntyp, nicht der Name -> kein Selbstverräter möglich.
    subject: c => c.attributes.type,
    format: (_v, c) => c.name,
    prompt: c => `Welcher Stern ist vom Typ „${c.attributes.type}"?`
  },

  // ---- (c) Zwergplaneten: Durchmesser -> Name --------------------------------
  // Gegenstück zu astra-dwarf-diameter (Name -> Durchmesser, bereits vorhanden).
  // Alle 9 Zwergplaneten haben einzigartige diameterKm-Werte -> Guard genehmigt alle.
  // Distraktoren sind die 8 anderen Zwergplaneten (nach Zahlenwert-Nähe ausgewählt,
  // dann als Name präsentiert) — reverseUnique baut den Pool intern auf.
  {
    category: 'dwarf_planet', attr: 'diameterKm', type: 'astra-dwarf-diameter-rev', difficulty: 4,
    nameAnswer: true, reverseUnique: true,
    // Hinweis ist der Durchmesser in km.
    subject: c => `${deNum(c.attributes.diameterKm)} km`,
    format: (_v, c) => c.name,
    prompt: c => `Welcher Zwergplanet hat einen ungefähren Durchmesser von ${deNum(c.attributes.diameterKm)} km?`
  },

  // ---- (c) Zwergplaneten: Umlaufzeit -> Name ---------------------------------
  // Gegenstück zu astra-dwarf-year-len (Name -> Umlaufzeit, bereits vorhanden).
  // Alle 9 Umlaufzeiten sind einzigartig -> kein Guard-Ausfall erwartet.
  // Prompts mit gerundetem Wert, damit die Frage natürlich klingt.
  {
    category: 'dwarf_planet', attr: 'yearLengthEarthYears', type: 'astra-dwarf-year-len-rev', difficulty: 4,
    nameAnswer: true, reverseUnique: true,
    // Hinweis ist die Umlaufzeit in Erdjahren (mit bis zu 2 Dezimalstellen formatiert).
    subject: c => `${deNum(c.attributes.yearLengthEarthYears)} Erdjahre`,
    format: (_v, c) => c.name,
    prompt: c => `Welcher Zwergplanet benötigt ungefähr ${deNum(c.attributes.yearLengthEarthYears)} Erdjahre für einen Sonnenumlauf?`
  },

  // ---- (c) Zwergplaneten: Entdeckungsjahr -> Name ----------------------------
  // Gegenstück zu astra-dwarf-year (Name -> Entdeckungsjahr, bereits vorhanden).
  // reverseUnique-Guard entfernt: 2005 (Eris + Makemake) und 2004 (Haumea + Orcus).
  // Übrig bleiben 5 eindeutige Jahre: 1930 (Pluto), 1801 (Ceres), 2003 (Sedna),
  // 2002 (Quaoar), 2007 (Gonggong).
  {
    category: 'dwarf_planet', attr: 'discoveredYear', type: 'astra-dwarf-year-rev', difficulty: 4,
    nameAnswer: true, reverseUnique: true,
    // Hinweis ist das Entdeckungsjahr.
    subject: c => `Entdeckungsjahr ${c.attributes.discoveredYear}`,
    format: (_v, c) => c.name,
    prompt: c => `Welcher Zwergplanet wurde im Jahr ${c.attributes.discoveredYear} entdeckt?`
  },

  // ---- (c) Nebel: Sternbild -> Name ------------------------------------------
  // Gegenstück zu astra-nebula-constellation (Name -> Sternbild, bereits vorhanden).
  // Orionnebel und Pferdekopfnebel teilen das Sternbild 'Orion' -> beide entfallen
  // per reverseUnique-Guard. Der Krebsnebel hat kein constellation-Attribut -> skip.
  // Übrig: Ringnebel (Leier) und Adlernebel (Schlange). Pool = nur 3 Nebel mit Sternbild,
  // davon 2 mit je einzigartigem Wert -> Distraktoren: je 1 echter + 2 extraDistractors
  // ('Orion', 'Stier') -> insg. 4 Optionen. Die extraDistractors sind echte Sternbildnamen,
  // die plausibel sind, aber bei keinem der vorhandenen Nebel auftreten -> fair.
  {
    category: 'nebula', attr: 'constellation', type: 'astra-nebula-constellation-rev', difficulty: 4,
    nameAnswer: true, reverseUnique: true,
    // Sterne ohne Sternbild-Attribut (Krebsnebel) überspringen.
    skip: c => !c.attributes.constellation,
    // Hinweis ist das Sternbild.
    subject: c => `Sternbild ${c.attributes.constellation}`,
    format: (_v, c) => c.name,
    prompt: c => `Welcher Nebel liegt im Sternbild ${c.attributes.constellation}?`,
    // Zwei plausible Sternbildnamen als feste Distraktoren, falls der echte Pool zu klein ist.
    // 'Orion': bekanntes Sternbild, klingt plausibel für einen Nebel (Orionnebel existiert!),
    // aber er entfällt als richtiger Kandidat per Guard -> faires Ablenkmanöver.
    extraDistractors: ['Orion', 'Stier']
  },

  // ==== Welle-3-Erweiterung (Stand 2026-06-24) ==============================
  // Fünf neue Fragetypen ausschließlich für Exoplaneten, aus bisher ungenutzten
  // Attributen mit dem größten Konzepthebel (66-69 Träger je Attribut).
  //
  // BEWUSST AUSGELASSEN:
  //  - exoplanet.hostStar: Wirtsternname steckt bei ~100% der Exoplaneten im
  //    Konzeptnamen selbst (z. B. "WASP-12 b" -> hostStar "WASP-12") ->
  //    Selbstverräter-Guard löscht praktisch alle Fragen. Kein sinnvoller Hebel.
  //  - discoveryMethod Reverse (Methode -> Name): 43 von 66 Exoplaneten nutzen
  //    "Transit" -> reverseUnique-Guard entfernt alle 43; auch die anderen
  //    Methoden haben je mehrere Träger -> keine eindeutigen Reverse-Fragen.
  //  - exoplanet.notableFor: Freier Beschreibungstext, kein kategorialer Wert ->
  //    nicht als MCQ-Option geeignet.
  //  - exoplanet.orbitalPeriodYears/starType: zu wenige Träger (< 10).

  // ---- Exoplaneten: Entdeckungsmethode (66 Konzepte) ----------------------
  // Vier Methoden im Pool: Transit, Radial Velocity, Imaging, Pulsar Timing
  // -> immer 3 Distraktoren aus der Kategorie verfügbar. Keine Reverse-Frage
  // (Methode hat viele Träger, Eindeutigkeit nicht gegeben).
  // Die Rohwerte stehen englisch in den Daten -> hier auf die deutschen
  // Fachbegriffe abgebildet (das Quiz ist durchgehend deutschsprachig).
  {
    category: 'exoplanet', attr: 'discoveryMethod', type: 'astra-exo-discovery-method', difficulty: 3,
    prompt: c => `Wie wurde der Exoplanet ${c.name} entdeckt?`,
    format: v => ({
      'Transit': 'Transitmethode',
      'Radial Velocity': 'Radialgeschwindigkeitsmethode',
      'Pulsar Timing': 'Pulsar-Timing',
      'Imaging': 'Direkte Abbildung'
    }[v] || v)
  },

  // ---- Exoplaneten: Umlaufzeit in Tagen (69 Konzepte) --------------------
  // Alle 69 Werte sind einzigartig -> Vorwärts und Reverse beide möglich.
  // Vorwärts: spreadNumeric (proportionale Streuung) statt numericByValue —
  // die Umlaufzeiten häufen sich (viele „heiße" Planeten mit ~Tagen), sodass
  // Nachbarwerte ununterscheidbar wären. Reverse: reverseUnique-Guard bestätigt
  // alle 69 (keine doppelten Werte), also 69 Reverse-Fragen.
  {
    category: 'exoplanet', attr: 'orbitalPeriodDays', type: 'astra-exo-orbital-period', difficulty: 4,
    spreadNumeric: true,
    prompt: c => `Wie lange dauert ein Umlauf des Exoplaneten ${c.name} um seinen Stern?`,
    format: v => `${deNum(roundSig(v))} Tage`
  },
  {
    category: 'exoplanet', attr: 'orbitalPeriodDays', type: 'astra-exo-orbital-period-rev', difficulty: 5,
    nameAnswer: true, reverseUnique: true,
    subject: c => `Umlaufzeit ${deNum(c.attributes.orbitalPeriodDays)} Tage`,
    format: (_v, c) => c.name,
    prompt: c => `Welcher Exoplanet umrundet seinen Stern in etwa ${deNum(c.attributes.orbitalPeriodDays)} Tagen?`
  },

  // ---- Exoplaneten: Radius in Erdradien (67 Konzepte) --------------------
  // spreadNumeric: die Radien häufen sich stark um ~1 Erdradius (viele
  // Gesteinsplaneten) -> Nachbarwerte (numericByValue) lägen bei 1,11 vs. 1,12
  // und wären nicht unterscheidbar. Proportionale Streuung erzeugt faire,
  // klar verschiedene Optionen derselben Dimension.
  {
    category: 'exoplanet', attr: 'radiusEarthRadii', type: 'astra-exo-radius', difficulty: 4,
    spreadNumeric: true,
    prompt: c => `Welchen ungefähren Radius hat der Exoplanet ${c.name} (in Erdradien)?`,
    format: v => `${deNum(roundSig(v))} Erdradien`
  },

  // ---- Exoplaneten: Masse in Erdmassen (66 Konzepte) ----------------------
  // spreadNumeric wie bei Radius/Umlaufzeit: die Massen streuen über mehrere
  // Größenordnungen, häufen sich aber in Gruppen -> proportionale Distraktoren
  // statt Nachbarwerte. Reverse entfällt bewusst (HR 8799 c und d teilen
  // 3000 Erdmassen -> über reverseUnique mehrdeutig).
  {
    category: 'exoplanet', attr: 'massEarthMasses', type: 'astra-exo-mass', difficulty: 4,
    spreadNumeric: true,
    prompt: c => `Welche ungefähre Masse hat der Exoplanet ${c.name} (in Erdmassen)?`,
    format: v => `${deNum(roundSig(v))} Erdmassen`
  },

  // ==== Sternbilder (Welle: +77 IAU-Sternbilder) ===========================
  // Hebel für die neu aufgenommenen Konstellationen. Genutzt wird ausschließlich
  // das `iauAbbreviation`-Attribut (offizielles 3-Buchstaben-Kürzel, bei allen 80
  // Sternbildern gesetzt und eindeutig). `visibility` ist bewusst NICHT getemplatet
  // (Freitext, uneinheitlich), `notableStars` ebenfalls nicht (Liste statt Einzelwert).
  // Der Selbstverräter-Guard verwirft automatisch Fälle, in denen das Kürzel den
  // Namen verrät (z.B. „Ori" → Orion).
  {
    category: 'constellation', attr: 'iauAbbreviation', type: 'astra-const-abbr', difficulty: 4,
    prompt: c => `Wie lautet die offizielle IAU-Abkürzung (3 Buchstaben) des Sternbilds „${c.name}"?`,
    format: v => v
  },
  {
    category: 'constellation', attr: 'iauAbbreviation', type: 'astra-const-abbr-rev', difficulty: 3,
    nameAnswer: true, reverseUnique: true,
    subject: c => `IAU-Abkürzung „${c.attributes.iauAbbreviation}"`,
    format: (_v, c) => c.name,
    prompt: c => `Für welches Sternbild steht die offizielle IAU-Abkürzung „${c.attributes.iauAbbreviation}"?`
  },

  // ---- Sternbilder: hellster Stern (oben aus den Sterndaten hergeleitet) ---
  // `brightestStar` wird nicht in den Rohdaten gepflegt, sondern beim Generieren
  // aus den Sternkonzepten abgeleitet (kleinste apparentMagnitude je Sternbild).
  // Nur die ~57 im Sterndatensatz vertretenen Sternbilder tragen den Wert -> die
  // übrigen überspringt `skip`. Distraktoren sind die hellsten Sterne ANDERER
  // Sternbilder (gleiche Kategorie/gleiches Attribut) -> plausible, echte helle
  // Sterne. Der Selbstverräter-Guard (revealsAnswer) verwirft Fälle, in denen der
  // Sternname im Sternbildnamen steckt; das verräterische Panel-Geschwister
  // `notableStars` (Sternliste) blendet AstraVisual bei diesem Test aus.
  {
    category: 'constellation', attr: 'brightestStar', type: 'astra-constellation-brighteststar', difficulty: 3,
    // Sternbildnamen sind uneinheitlich ("Orion (Sternbild)", "Großer Bär (Ursa
    // Major)") -> jeden Klammer-Zusatz entfernen, damit der Prompt sauber den
    // deutschen Namen nennt.
    prompt: c => `Welcher ist der hellste Stern im Sternbild „${c.name.replace(/\s*\([^)]*\)\s*$/, '')}"?`,
    format: v => v,
    skip: c => !c.attributes.brightestStar
  }
];

// --- Fragen generieren ---------------------------------------------------

const questions = [];

for (const tpl of templates) {
  const conceptsInCat = byCategory[tpl.category] || [];

  // Wertepool für Distraktoren: alle formatierten Werte dieses Attributs in
  // der Kategorie (bzw. alle Namen, bei der Konstanten-Frage). Die neuen
  // Welle-1-Mechaniken (reverseUnique/numericByValue) bauen ihre Pools
  // stattdessen pro Frage selbst -> hier leer lassen.
  const valuePool = (tpl.reverseUnique || tpl.numericByValue || tpl.spreadNumeric) ? [] : conceptsInCat
    .filter(c => !(tpl.skip && tpl.skip(c)))
    .map(c => (tpl.nameAnswer ? c.name : tpl.format(c.attributes[tpl.attr], c)))
    // Dünn besetzte Attribute (z.B. dwarf_planet.numMoons nur bei einigen
    // Zwergplaneten) würden sonst „undefined" als Distraktor liefern. Leere raus.
    .filter(v => v !== undefined && v !== null && v !== '');

  for (const c of conceptsInCat) {
    if (tpl.skip && tpl.skip(c)) continue;
    const rawValue = tpl.nameAnswer ? c.name : c.attributes[tpl.attr];
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;

    // Welle-1-Vorprüfungen (greifen nur bei den neuen Flags):
    // - Reverse braucht das gespiegelte Attribut zwingend (rawValue ist hier
    //   der NAME, daher eigener Blick auf das Attribut).
    // - numericByValue braucht eine echte, endliche Zahl. Strings mit
    //   eingebackener Einheit ("2,59 × 10²⁰"), Bereichs- oder Datums-Strings
    //   fallen damit automatisch aus numerischen Fragen heraus.
    if (tpl.reverseUnique) {
      const v = c.attributes[tpl.attr];
      if (v === undefined || v === null || v === '') continue;
    }
    if ((tpl.numericByValue || tpl.spreadNumeric) && !(typeof rawValue === 'number' && isFinite(rawValue))) continue;

    const correct = tpl.nameAnswer ? c.name : tpl.format(rawValue, c);

    // Selbstverräter: steckt die Antwort schon im Hinweis, Frage verwerfen.
    const subject = tpl.subject ? tpl.subject(c) : c.name;
    if (revealsAnswer(subject, correct)) continue;

    let distractors;
    if (tpl.reverseUnique) {
      // --- Reverse-Korrektheits-Guard (Welle 1) --------------------------
      // Alle Distraktor-Konzepte müssen beim getesteten Attribut einen
      // ANDEREN Wert haben — sonst wären mehrere Optionen richtig. Teilt
      // ein anderes Konzept den abgefragten Wert, ist die Frage schon in
      // der Welt mehrdeutig ("Welcher Planet hat 0 Monde?" — Merkur UND
      // Venus) -> komplett überspringen statt nur Distraktoren filtern.
      const myVal = String(c.attributes[tpl.attr]);
      const others = conceptsInCat.filter(o => o !== c && !(tpl.skip && tpl.skip(o)));
      const shared = others.some(o => {
        const v = o.attributes[tpl.attr];
        return v !== undefined && v !== null && String(v) === myVal;
      });
      if (shared) continue;
      // Distraktor-Pool: nur Namen von Konzepten, die das Attribut MIT
      // anderem Wert tragen (Konzepte ohne Attribut wären als "falsche"
      // Option nicht belegbar -> raus).
      const namePool = others
        .filter(o => {
          const v = o.attributes[tpl.attr];
          return v !== undefined && v !== null && v !== '' && String(v) !== myVal;
        })
        .map(o => o.name)
        // Deterministisch pro Frage mischen (s. hashStr oben), damit nicht in
        // jeder Reverse-Frage dieselben ersten Namen als Distraktoren stehen.
        .sort((a, b) => hashStr(`${c.id}|${tpl.type}|${a}`) - hashStr(`${c.id}|${tpl.type}|${b}`));
      // Optionale feste Distraktoren ergänzen, falls der kategorie-interne Pool
      // zu klein ist (z.B. nebula.constellation: nur 3 Nebel mit Sternbild ->
      // je 1 echter Distraktor -> extraDistractors füllen auf 3 auf).
      const namePoolWithExtras = tpl.extraDistractors
        ? namePool.concat(tpl.extraDistractors)
        : namePool;
      distractors = pickDistractors(correct, namePoolWithExtras, false);
    } else if (tpl.spreadNumeric) {
      // --- Proportional gestreute Distraktoren (Welle 3) -----------------
      // Für CLUSTERNDE Attribute (Exoplaneten-Radius/-Masse/-Umlaufzeit häufen
      // sich stark um ähnliche Werte) liefert die Nachbarwert-Auswahl
      // (numericByValue) praktisch ununterscheidbare Optionen
      // (z.B. 1,11 vs. 1,12 Erdradien) -> unfaire Rate-Frage. Stattdessen
      // plausible Werte DERSELBEN Dimension in klarem Abstand um den korrekten
      // Wert erzeugen. Korrekter Wert und Distraktoren werden über die format-
      // Funktion gleich gerundet (roundSig), damit das Format nichts verrät.
      const n = rawValue;
      // Wo das Maß über ≥2 Größenordnungen streut (Masse/Umlaufzeit), echte
      // Pool-Werte log-gespreizt nutzen (Var-B). Sonst (z.B. Radius, der sich
      // eng um ~1 Erdradius häuft) bei der proportionalen Synthese bleiben.
      const spreadPool = [...new Set(conceptsInCat
        .filter(o => o !== c && !(tpl.skip && tpl.skip(o)))
        .map(o => o.attributes[tpl.attr])
        .filter(v => typeof v === 'number' && isFinite(v)))];
      const mag = shouldMagnitudeSpread(n, spreadPool, tpl.attr)
        && magnitudeSpreadDistractors(n, spreadPool, (v) => tpl.format(v, c), { seed: c.id });
      if (mag) {
        distractors = mag;
      } else {
        // Faktoren mischen Werte unter und über dem korrekten Wert.
        const factors = [0.45, 1.7, 0.65, 2.4, 1.35, 3.3, 0.3];
        const seen = new Set([correct]);
        const cands = [];
        for (const f of factors) {
          const d = tpl.format(roundSig(n * f), c);
          if (!seen.has(d)) { seen.add(d); cands.push(d); }
          if (cands.length === 3) break;
        }
        distractors = cands;
      }
    } else if (tpl.numericByValue) {
      // --- Numerische Nachbarwert-Distraktoren (Welle 1) ------------------
      // Auswahl auf den ROHEN Zahlen derselben Kategorie (die dem korrekten
      // Wert nächstliegenden = am verwechselbarsten), erst danach formatieren.
      // Das umgeht das Problem, dass formatierte Strings ("1.350 Lichtjahre")
      // nicht zuverlässig zurück in Zahlen parsebar sind.
      const rawNums = [...new Set(conceptsInCat
        .filter(o => o !== c && !(tpl.skip && tpl.skip(o)))
        .map(o => o.attributes[tpl.attr])
        .filter(v => typeof v === 'number' && isFinite(v)))]
        .filter(v => v !== rawValue);
      // Größenordnungs-Distraktoren bei über ≥2 Größenordnungen streuenden Maßen
      // (Distanzen, Durchmesser, Umlaufzeiten, Sternzahlen); apparentMagnitude
      // u.a. beschränkte/Index-Werte sind in shouldMagnitudeSpread ausgeschlossen
      // und fallen auf den Nachbarwert zurück.
      const fmt = (v) => tpl.format(v, c);
      distractors = (shouldMagnitudeSpread(rawValue, rawNums, tpl.attr)
        && magnitudeSpreadDistractors(rawValue, rawNums, fmt, { seed: c.id }))
        || (() => {
          rawNums.sort((a, b) => Math.abs(a - rawValue) - Math.abs(b - rawValue));
          return [...new Set(rawNums.map(fmt))].filter(d => d !== correct).slice(0, 3);
        })();
    } else {
      // --- Bestandsweg ------------------------------------------------------
      // Numerische Maße (numeric:true), die über ≥2 Größenordnungen streuen
      // (Stern-/Galaxien-Distanz u.a.): echte Pool-Werte log-gespreizt (Var-B)
      // statt enger Nachbarwerte. Sonst Distraktoren aus dem Kategorie-Pool.
      const rawPool = tpl.numeric
        ? conceptsInCat.filter(o => o !== c && !(tpl.skip && tpl.skip(o)))
            .map(o => o.attributes[tpl.attr])
            .filter(v => typeof v === 'number' && isFinite(v))
        : [];
      const mag = tpl.numeric && typeof rawValue === 'number'
        && shouldMagnitudeSpread(rawValue, rawPool, tpl.attr)
        && magnitudeSpreadDistractors(rawValue, rawPool, (v) => tpl.format(v, c), { seed: c.id });
      if (mag) {
        distractors = mag;
      } else {
        let pool = valuePool.slice();
        if (tpl.extraDistractors) pool = pool.concat(tpl.extraDistractors);
        distractors = pickDistractors(correct, pool, tpl.numeric);
      }
    }

    // Faire Frage braucht mind. 1 Distraktor; wir streben 3 an. Weniger als 2
    // Optionen wären keine echte Wahl -> überspringen.
    if (distractors.length < 1) continue;

    const options = [correct, ...distractors];

    questions.push({
      // type im id -> eindeutig, auch wenn zwei Templates dasselbe Attribut nutzen
      // (z.B. Position vorwärts/rückwärts).
      id: `q_${DOMAIN}_${c.id}_${tpl.type}`,
      entityId: `${DOMAIN}:${c.id}`,
      entityType: c.category,
      type: tpl.type,
      difficulty: tpl.difficulty,
      prompt: tpl.prompt(c),
      correctAnswer: correct,
      options, // Quiz mischt die Reihenfolge zur Laufzeit
      // Selbstverräter-Guard im Visual: das Frontend muss wissen, welches
      // Attribut die Antwort prüft. Bei Reverse-Templates (Antwort = Konzeptname,
      // nameAnswer) gibt es kein geprüftes Attribut -> null. Bei Vorwärts-
      // Templates ist es tpl.attr (z.B. 'orderFromSun', 'value').
      testedAttribute: tpl.nameAnswer ? null : tpl.attr,
      // answerIsName: true, wenn die korrekte Antwort der Konzeptname ist (Reverse).
      answerIsName: Boolean(tpl.nameAnswer),
      silhouetteSvgPath: null,
      mapTargetId: null
    });
  }
}

// --- schreiben -----------------------------------------------------------

writeFileSync(CONCEPTS_OUT, JSON.stringify(concepts, null, 2), 'utf8');
writeFileSync(QUESTIONS_OUT, JSON.stringify(questions, null, 2), 'utf8');

// kleine Statistik für die Konsole
const byType = {};
for (const q of questions) byType[q.type] = (byType[q.type] || 0) + 1;
const byDiff = {};
for (const q of questions) byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1;

console.log(`Konzepte: ${Object.keys(concepts).length}`);
console.log(`Fragen:   ${questions.length}`);
console.log('Nach Typ:', byType);
console.log('Nach Schwierigkeit:', byDiff);
