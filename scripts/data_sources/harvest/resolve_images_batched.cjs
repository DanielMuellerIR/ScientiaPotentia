// Gebündelter Bild-Resolver (Phase D) — Hauptbild via Wikidata-P18 / de.wikipedia pageimages.
// KEINE Freitextsuche. Im Gegensatz zu den per-Konzept-Resolvern bündelt dieses Skript die
// API-Aufrufe (bis 50 Einheiten pro Request) → ~Dutzend Requests statt einer pro Konzept,
// damit KEIN Wikimedia-Rate-Limit (429) auftritt. Schreibt das Ergebnis-Mapping
// erst nach einem vollständig erfolgreichen Lauf atomar.
//
// Aufruf:  node resolve_images_batched.cjs <domain> [animalCap] [animalOffset]
//   <domain>   = astra | natura | cultura | lingua | historia | homo | machina
//   [animalCap]= optionales Limit für natura-Kategorie "animal" (Default: alle)
//   [animalOffset] = Startindex für ein begrenztes Natura-Tierfenster (Default: 0)
// Ausgabe:  /tmp/<domain>_images_batched.json  (Array {id, imageFile, imageLicense, imageAttribution})

const fs = require("fs");
const path = require("path");
const { assertSafeDomain, writeJsonAtomic } = require('./json_io.cjs');
const { createApiGuard } = require("./api_guard.cjs");
const { sourceForConcept, canonicalPage, resolveSourceImages } = require('./wikipedia_image_sources.cjs');
const { fetchWithRetry } = require('../../lib/commons_api.cjs');
const { createCommonsLookup } = require('./commons_image_candidates.cjs');
const {
  fileNameFromUploadUrl,
  isBlacklistedConcept,
  isBlacklistedFile,
  selectP18File,
} = require('./image_resolution_policy.cjs');


// Zielkategorien je Domain (nur Kategorien, bei denen ein echtes Foto/Bild sinnvoll ist)
const TARGETS = {
  astra:  new Set(["galaxy", "nebula", "planet", "dwarf_planet", "moon", "mission"]),
  natura: new Set(["animal", "plant", "fungus", "geology", "mineral"]),
  cultura:new Set(["artwork", "sculpture", "architecture", "composer", "composition", "literature"]),
  lingua: new Set(["writing_system", "language_family"]),
  // Stand 2026-06-25 (docs/bildquellen_strategie.md): bisher nie geerntete Domains.
  historia: new Set(["invention", "discovery", "epoch", "figure", "milestone", "expedition"]),
  // Stand 2026-07-01 (docs/homo_erweiterung_runde2.md): die Physiologie-Kategorien
  // fehlten bisher komplett -> 0 Bilder. de.wiki-Hauptbilder (Histologie/Gray's-Stiche/
  // Anatomiegrafiken) sind ueber die Pipeline verfuegbar.
  // reflex (2026-07-09, Runde-2-Todo): jetzt AUFGENOMMEN — jedes Reflex-Konzept hat ein
  // EIGENES Lemma (Patellarsehnenreflex, Lidschlussreflex, ...), daher konzeptgenaue
  // Diagramme statt Kollisionsbilder; die Auswahl wird nach dem Lauf visuell gegengeprueft.
  // Bewusst WEITER NICHT dabei: psych_effect (abstrakt), vitamin/nutrient_macro
  // (Strukturformeln, Nutzen fraglich -> §4 niedrige Prio), blood_group (6 Konzepte teilen
  // sich das AB0-System-Lemma -> alle bekaemen dasselbe Schemabild = Duplikate).
  homo:   new Set(["bone", "muscle", "organ", "body_fact", "species",
    "cell_type", "hormone", "nerve", "sense", "brain_lobe",
    "digestive_enzyme", "development_stage", "sleep_perception", "joint", "reflex"]),
  // machina nur hardware (Geraete-Fotos, kein Logo-Problem); die logobelasteten
  // Kategorien (programming_language/concept/...) brauchen einen Logo-Filter -> separat.
  machina:new Set(["hardware"]),
};

function parseArguments(arguments_) {
  const [domainArgument, capArgument, offsetArgument, ...extra] = arguments_;
  if (!domainArgument || extra.length
      || (capArgument !== undefined && !/^[1-9]\d*$/.test(capArgument))
      || (offsetArgument !== undefined && !/^\d+$/.test(offsetArgument))) {
    throw new Error('Aufruf: node resolve_images_batched.cjs <domain> [animalCap] [animalOffset]');
  }
  const domain = assertSafeDomain(domainArgument);
  if (!TARGETS[domain]) throw new Error(`Unbekannte Domain: ${domain}`);
  return {
    domain,
    animalCap: capArgument === undefined ? Infinity : Number(capArgument),
    animalOffset: offsetArgument === undefined ? 0 : Number(offsetArgument),
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function rawGet(url) {
  const response = await fetchWithRetry(url);
  return { status: response.status, body: await response.text(), headers: Object.fromEntries(response.headers) };
}
// Bricht ab, sobald die Gegenstelle dauerhaft abweist, statt den Lauf leere
// Ergebnisse schreiben zu lassen.
const apiGuard = createApiGuard({ label: "Die Wikidata-/Commons-API" });
/**
 * Dieselbe Anfrage unter Aufsicht: Bleibt die Antwort nach allen Versuchen bei
 * 429 oder einem Serverfehler, ist das eine Abweisung und kein Ergebnis. Ohne
 * diese Zaehlung liefe der Auflöser weiter und schriebe zu jedem Konzept
 * "kein freies Bild" (siehe api_guard.cjs). Ein Netzfehler wirft ohnehin.
 */
async function get(url) {
  const antwort = await rawGet(url);
  if (!antwort || antwort.status === 429 || antwort.status >= 500) {
    apiGuard.rejected(`HTTP ${antwort ? antwort.status : "?"} bei ${url}`);
  } else {
    apiGuard.ok();
  }
  return antwort;
}
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
// Die Pageimages-API ergänzt derzeit utm-Parameter an Commons-Upload-URLs. Nur der
// Pfadname ist ein Commons-Dateititel; Query und Fragment dürfen nicht mit in die
// anschließende imageinfo-Abfrage gelangen.
let lastCall = 0;
async function getJson(url) {
  await sleep(Math.max(0, 250 - (Date.now() - lastCall)));
  lastCall = Date.now();
  const response = await get(url);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`API antwortet mit HTTP ${response.status}`);
  }
  let payload;
  try {
    payload = JSON.parse(response.body);
  } catch {
    throw new Error('API-Antwort ist kein gültiges JSON');
  }
  if (payload?.error) {
    apiGuard.rejected(payload.error.code || 'API-Fehler');
    throw new Error(`API-Fehler ${payload.error.code || 'unbekannt'}: ${payload.error.info || 'ohne Beschreibung'}`);
  }
  return payload;
}

function addGroupedConcept(groups, key, concept) {
  const concepts = groups.get(key) || [];
  concepts.push(concept);
  groups.set(key, concepts);
}

function uniqueSourceMap(groups) {
  const unique = new Map();
  const ambiguous = [];
  for (const [key, concepts] of groups) {
    if (concepts.length === 1) unique.set(key, concepts[0]);
    else ambiguous.push({ key, ids: concepts.map(concept => concept.id) });
  }
  return { unique, ambiguous };
}

function pageTitleForConcept(concept, domain) {
  return sourceForConcept(concept, domain)?.title || null;
}

function collectResolvedPageImages(requestedTitles, byTitle, query) {
  const normalized = new Map((query.normalized || []).map(row => [row.from, row.to]));
  const redirects = new Map((query.redirects || []).map(row => [row.from, row.to]));
  return requestedTitles.map((requestedTitle) => {
    const normalizedTitle = normalized.get(requestedTitle) || requestedTitle;
    const finalTitle = redirects.get(normalizedTitle) || normalizedTitle;
    const fileName = fileNameFromUploadUrl(canonicalPage(query, requestedTitle)?.original?.source);
    return { concept: byTitle.get(requestedTitle), finalTitle, fileName };
  }).filter(row => row.concept && row.fileName);
}

function uniqueFinalPageImages(rows) {
  const groups = new Map();
  for (const row of rows) addGroupedConcept(groups, row.finalTitle, row);
  const assignments = new Map();
  const ambiguous = [];
  for (const [title, candidates] of groups) {
    if (candidates.length === 1) {
      assignments.set(candidates[0].concept.id, candidates[0].fileName);
    } else {
      ambiguous.push({ key: title, ids: candidates.map(row => row.concept.id) });
    }
  }
  return { assignments, ambiguous };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const rawFile = path.join(__dirname, `../${options.domain}_raw.json`);
  const outputFile = `/tmp/${options.domain}_images_batched.json`;
  const raw = JSON.parse(fs.readFileSync(rawFile, "utf8"));
  if (!Array.isArray(raw)) throw new Error(`${options.domain}_raw.json muss ein JSON-Array sein`);
  const cats = TARGETS[options.domain];
  let pool = raw.filter(c => cats.has(c.category) && !c.imageFile
    && !isBlacklistedConcept(c.id));
  if (options.domain === "natura" && (options.animalCap !== Infinity || options.animalOffset > 0)) {
    const animals = pool.filter(c => c.category === "animal")
      .slice(options.animalOffset, options.animalOffset + options.animalCap);
    pool = pool.filter(c => c.category !== "animal").concat(animals);
  }
  const animalWindow = options.domain === "natura"
    && (options.animalCap !== Infinity || options.animalOffset > 0)
    ? ` (Tierfenster ab ${options.animalOffset + 1})` : "";
  console.log(`${options.domain}: ${pool.length} bildlose Konzepte in Zielkategorien${animalWindow}`);

  const commons = createCommonsLookup(getJson);
  const fileForId = await resolveSourceImages(pool, options.domain, getJson, commons.acceptFiles);
  console.log(`  Nach Quellenauflösung: ${fileForId.size} Konzepte mit Bilddatei`);

  const out = [...fileForId].map(([id, file]) => ({ id, ...commons.get(file) }));
  // Ein kompletter Netzausfall sieht aus wie "kein freies Bild gefunden": jede
  // gebuendelte Anfrage liefert nichts, und ohne Waechter stuende danach ein
  // leeres Mapping in der Ausgabedatei — ueber einem womoeglich brauchbaren aus
  // einem frueheren Lauf, mit Exit 0. resolve_images.cjs und
  // resolve_images_p18.cjs haben diese Bremse seit dem 2026-09-03.
  if (pool.length >= 10 && out.length === 0) {
    console.error(
      `\nKein einziges Bild aufgeloest (${pool.length} Konzepte angefragt) — `
      + `vermutlich API- oder Netzproblem. ${outputFile} bleibt unveraendert.`);
    process.exitCode = 1;
    return;
  }
  writeJsonAtomic(outputFile, out);
  console.log(`FERTIG: ${out.length}/${pool.length} Bilder → ${outputFile}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`FEHLER: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  addGroupedConcept,
  collectResolvedPageImages,
  fileNameFromUploadUrl,
  isFree: require('../../lib/image_license_policy.js').isAllowedCommonsLicenseMetadata,
  parseArguments,
  pageTitleForConcept,
  selectP18File,
  uniqueFinalPageImages,
  uniqueSourceMap,
};
