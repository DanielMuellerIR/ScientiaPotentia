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

const https = require("https");
const fs = require("fs");
const path = require("path");
const { assertSafeDomain, writeJsonAtomic } = require('./json_io.cjs');
const {
  isAllowedCommonsLicenseMetadata,
  licenseNameFromCommonsMetadata,
} = require('../../lib/image_license_policy.js');
const { DEWIKI_MAP, AMBIGUOUS_NAMES } = require('./resolve_images_p18_v2.cjs');
const { commonsAttribution } = require('./credit_text.cjs');
const {
  fileNameFromUploadUrl,
  isBlacklistedConcept,
  isBlacklistedFile,
  selectP18File,
} = require('./image_resolution_policy.cjs');

const UA = "ScientiaQuizImageResolverBatched/1.0 (educational quiz; pageimages+P18 only, batched)";
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/svg+xml', 'image/gif', 'image/webp',
]);

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
// Weiterleitungen mit Zaehler: Ohne ihn haengt eine Redirect-Schleife den Lauf
// endlos, weil rawGet sich unbegrenzt selbst aufruft (CodeQA 2026-09-03).
const MAX_REDIRECTS = 5;
function rawGet(url, redirects = 0) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { "User-Agent": UA } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.resume();
        if (redirects >= MAX_REDIRECTS) {
          rej(new Error(`Mehr als ${MAX_REDIRECTS} Weiterleitungen fuer ${url}`));
          return;
        }
        return rawGet(r.headers.location, redirects + 1).then(res, rej);
      }
      let d = ""; r.on("data", c => d += c); r.on("end", () => res({ status: r.statusCode, body: d, headers: r.headers }));
    }).on("error", rej);
  });
}
// 429-Backoff (sollte bei Bündelung praktisch nie greifen)
async function get(url) {
  for (let i = 0; i < 6; i++) {
    const r = await rawGet(url);
    if (r.status !== 429) return r;
    const ra = parseInt(r.headers["retry-after"] || "0", 10);
    const wait = (ra > 0 ? ra : Math.min(60, 5 * 2 ** i)) * 1000;
    console.error(`  [rate-limit, warte ${wait / 1000}s]`);
    await sleep(wait);
  }
  return rawGet(url);
}
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const qidOf = u => (String(u).match(/Q\d+/) || [])[0];
const deTitle = u => { const m = String(u).match(/de\.wikipedia\.org\/wiki\/([^?#]+)/); return m ? decodeURIComponent(m[1]).replace(/_/g, " ") : null; };
// Die Pageimages-API ergänzt derzeit utm-Parameter an Commons-Upload-URLs. Nur der
// Pfadname ist ein Commons-Dateititel; Query und Fragment dürfen nicht mit in die
// anschließende imageinfo-Abfrage gelangen.
async function getJson(url) {
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

function logAmbiguousSources(label, ambiguous) {
  for (const { key, ids } of ambiguous) {
    console.log(`  Mehrdeutiger ${label} ausgelassen: ${key} -> ${ids.join(', ')}`);
  }
}

/**
 * Titel für die de.wikipedia-Abfrage eines Konzepts.
 *
 * Reihenfolge: belegter de.wikipedia-Link, dann die gepflegte Astra-Zuordnung
 * (dort heißen Artikel oft anders als das Konzept, z. B. „Io (Mond)"), zuletzt
 * der Konzeptname selbst. Der Namensrückfall ist der Regelfall für Konzepte
 * ohne oder mit fremdsprachiger Quelle — ohne ihn stellte der Resolver für sie
 * gar keine Anfrage und die Bildabdeckung stagnierte still (über 600 Konzepte
 * in Natura und Cultura).
 */
function pageTitleForConcept(concept, domain) {
  const mapped = domain === 'astra' ? (DEWIKI_MAP[concept.id] || null) : null;
  // Der Namens-Rueckfall gilt nur fuer eindeutige Namen. Bei einem Homonym
  // („Merkur", „Golf") liefert das gleichnamige Lemma das Hauptbild einer ganz
  // anderen Sache — und kein Waechter merkt das, weil der Bildrechte-Audit nur
  // Lizenz und Urheber prueft, nicht die Motivtreue. resolve_images_p18_v2
  // exportiert die Liste dafuer ausdruecklich (CodeQA 2026-09-03).
  const name = typeof concept.name === 'string' && concept.name.trim()
    && !AMBIGUOUS_NAMES.has(concept.name.trim())
    ? concept.name.trim() : null;
  // Die gepflegte Astra-Zuordnung geht der Quelle vor — so haelt es auch
  // resolve_images_p18_v2 (Weg 2 vor Weg 3).
  return mapped || deTitle(concept.sourceUrl) || name;
}

function collectResolvedPageImages(requestedTitles, byTitle, query) {
  const normalized = new Map((query.normalized || []).map(row => [row.from, row.to]));
  const redirects = new Map((query.redirects || []).map(row => [row.from, row.to]));
  const pages = new Map(Object.values(query.pages || {})
    .filter(page => page.title).map(page => [page.title, page]));
  return requestedTitles.map((requestedTitle) => {
    const normalizedTitle = normalized.get(requestedTitle) || requestedTitle;
    const finalTitle = redirects.get(normalizedTitle) || normalizedTitle;
    const fileName = fileNameFromUploadUrl(pages.get(finalTitle)?.original?.source);
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

  // Schritt 1: QID-Konzepte sammeln (sourceUrl mit Q…) und Rest über de.wiki-Titel
  const qidGroups = new Map();
  const titleGroups = new Map();
  for (const c of pool) {
    const qid = qidOf(c.sourceUrl);
    if (qid) addGroupedConcept(qidGroups, qid, c);
    else {
      const title = pageTitleForConcept(c, options.domain);
      if (title) addGroupedConcept(titleGroups, title, c);
    }
  }
  const qidIndex = uniqueSourceMap(qidGroups);
  const byQid = qidIndex.unique;
  logAmbiguousSources('Wikidata-Schlüssel', qidIndex.ambiguous);

  // id -> bare Commons-Dateiname (ohne "File:")
  const fileForId = new Map();

  // --- Schritt 2: Wikidata P18 gebündelt (50 QIDs/Request) ---
  const qids = [...byQid.keys()];
  for (const grp of chunk(qids, 50)) {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${grp.join("|")}&props=claims&format=json`;
    const j = await getJson(url);
    const ents = j?.entities || {};
    for (const qid of grp) {
      const f = selectP18File(ents[qid]?.claims?.P18);
      if (f && !isBlacklistedFile(f)) fileForId.set(byQid.get(qid).id, f);
    }
    await sleep(120);
  }
  console.log(`  Wikidata P18: ${fileForId.size}/${qids.length} QIDs mit Bild`);

  // --- Schritt 3: de.wikipedia pageimages gebündelt (50 Titel/Request) für QID-lose + QIDs ohne P18 ---
  // QIDs ohne P18 nachträglich per de.wiki-Titel versuchen (Quelle, Astra-Zuordnung
  // oder Konzeptname, siehe pageTitleForConcept)
  for (const [, c] of byQid) {
    if (!fileForId.has(c.id)) {
      const title = pageTitleForConcept(c, options.domain);
      if (title) addGroupedConcept(titleGroups, title, c);
    }
  }
  const titleIndex = uniqueSourceMap(titleGroups);
  const byTitle = titleIndex.unique;
  logAmbiguousSources('Wikipedia-Titel', titleIndex.ambiguous);
  const titles = [...byTitle.keys()];
  const resolvedPageImages = [];
  for (const grp of chunk(titles, 50)) {
    const url = `https://de.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=original&redirects=1&format=json&titles=${grp.map(encodeURIComponent).join("|")}`;
    const j = await getJson(url);
    resolvedPageImages.push(...collectResolvedPageImages(grp, byTitle, j?.query || {}));
    await sleep(120);
  }
  const finalPageIndex = uniqueFinalPageImages(resolvedPageImages);
  logAmbiguousSources('finaler Wikipedia-Titel', finalPageIndex.ambiguous);
  for (const [id, fileName] of finalPageIndex.assignments) {
    if (!isBlacklistedFile(fileName)) fileForId.set(id, fileName);
  }
  console.log(`  Nach pageimages: ${fileForId.size} Konzepte mit Bilddatei`);

  // --- Schritt 4: Lizenz + Attribution gebündelt via Commons imageinfo (50 Dateien/Request) ---
  const entries = [...fileForId.entries()]; // [id, filename]
  const files = entries.map(([, f]) => "File:" + f);
  const licByFile = new Map();
  for (const grp of chunk(files, 50)) {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata|url|mime&format=json&titles=${grp.map(encodeURIComponent).join("|")}`;
    const j = await getJson(url);
    const q = j?.query || {};
    const norm = {}; (q.normalized || []).forEach(n => norm[n.from] = n.to);
    const pageByTitle = {}; Object.values(q.pages || {}).forEach(p => { if (p.title) pageByTitle[p.title] = p; });
    for (const fTitle of grp) {
      const pt = norm[fTitle] || fTitle;
      const ii = pageByTitle[pt]?.imageinfo?.[0];
      if (!ii) continue;
      const m = ii.extmetadata || {};
      const lic = licenseNameFromCommonsMetadata(m);
      const ok = ALLOWED_MIME.has(String(ii.mime || ""))
        && isAllowedCommonsLicenseMetadata(m);
      // Urhebertext nach der gemeinsamen Regel in credit_text.cjs: Artist UND
      // Credit. Dieser Aufloeser las bis 2026-09-04 nur Artist; eine freie Datei
      // mit Nachweis allein in Credit kam ohne Text hier an und fiel weiter
      // unten still aus dem Mapping, obwohl ihre Lizenz akzeptiert war.
      licByFile.set(fTitle, { ok, lic, art: commonsAttribution(m) });
    }
    await sleep(120);
  }

  // --- Schritt 5: Mapping bauen (nur freie/vorhandene Bilder) ---
  const out = [];
  for (const [id, f] of entries) {
    const lic = licByFile.get("File:" + f);
    if (!lic || !lic.ok || !lic.art || isBlacklistedConcept(id) || isBlacklistedFile(f)) continue;
    out.push({ id, imageFile: `https://commons.wikimedia.org/wiki/File%3A${encodeURIComponent(f)}`, imageLicense: lic.lic, imageAttribution: lic.art });
  }
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
  isFree: isAllowedCommonsLicenseMetadata,
  parseArguments,
  pageTitleForConcept,
  selectP18File,
  uniqueFinalPageImages,
  uniqueSourceMap,
};
