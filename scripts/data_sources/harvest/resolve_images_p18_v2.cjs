// Bild-Resolver Phase D v2: Hauptbild via de.wikipedia pageimages ODER Wikidata P18.
// KEINE Freitextsuche — nur das Artikelhauptbild des passenden Wikipedia-Artikels.
//
// Verbesserungen gegenüber v1:
//   - Explizites de.wikipedia-Titel-Mapping für alle Konzepte ohne de.wiki-sourceUrl
//     oder mit mehrdeutigem deutschen Namen (Io/Europa/Charon/Prometheus/Ariel etc.)
//   - Namensbasierter Fallback via de.wikipedia (Weg 4) nur wenn sourceTitle fehlt,
//     das verhindert Verwechslung bei mehrdeutigen Namen wie "Europa", "Prometheus"
//   - Wikidata P18 bleibt immer Weg 1 (zuverlässig, eindeutig durch QID)
//
// Strategie je Konzept (in Reihenfolge):
//   1. Hat sourceUrl eine Wikidata-QID?        → Wikidata P18
//   2. Hat Konzept einen de-wiki-Alias (DEWIKI_MAP)? → de.wikipedia pageimages
//   3. Hat sourceUrl eine de.wikipedia-URL?    → de.wikipedia pageimages
//   4. Hat wikiLink eine de.wikipedia-URL?     → de.wikipedia pageimages
//   5. Sonst: deutscher Konzeptname → de.wikipedia pageimages
//      (nur wenn name nicht bekannt mehrdeutig ist)
//   Kein brauchbares Ergebnis → Konzept auslassen.

const https = require("https");
const fs = require("fs");
const path = require("path");
const { writeJsonAtomic } = require('./json_io.cjs');
const { truncateCredit } = require('./credit_text.cjs');
const {
  isAllowedCommonsLicenseMetadata,
  licenseNameFromCommonsMetadata,
} = require('../../lib/image_license_policy.js');
const {
  selectP18File, isBlacklistedFile, isBlacklistedConcept,
} = require('./image_resolution_policy.cjs');

const UA = "ScientiaQuizImageResolverP18v2/1.0 (educational quiz project; pageimages+P18 only)";
const OUT_FILE = "/tmp/astra_images2.json";
const ASTRA_FILE = path.join(__dirname, "../astra_raw.json");

// Zielkategorien
const TARGET_CATS = new Set(["galaxy", "nebula", "planet", "dwarf_planet", "moon", "mission"]);

// ---------------------------------------------------------------------------
// Explizites de.wikipedia-Titel-Mapping.
// Schlüssel = Konzept-id aus astra_raw.json.
// Wert = exakter de.wikipedia-Seitentitel (Leerzeichen, keine Unterstriche).
// Notwendig für:
//   a) Konzepte mit non-de-wiki-sourceUrl (NASA, en.wiki, etc.)
//   b) Konzepte mit mehrdeutigem deutschem Namen (Europa → Kontinent vs. Mond)
//   c) Konzepte mit Klammerzusatz in de.wiki
//
// Leere Titel ("") = Konzept überspringen (kein sinnvolles de.wiki-Lemma vorhanden).
// ---------------------------------------------------------------------------
const DEWIKI_MAP = {
  // Planeten (sourceUrl = NASA-Factsheet)
  "mercury":               "Merkur (Planet)",
  "venus":                 "Venus (Planet)",
  "earth":                 "Erde",
  "mars":                  "Mars (Planet)",
  "jupiter":               "Jupiter (Planet)",
  "saturn":                "Saturn (Planet)",
  "uranus":                "Uranus (Planet)",
  "neptune":               "Neptun",

  // Zwergplaneten
  "pluto":                 "Pluto",
  "ceres":                 "Ceres (Zwergplanet)",
  "eris":                  "Eris (Zwergplanet)",
  "makemake":              "Makemake (Zwergplanet)",
  "haumea":                "Haumea",
  "sedna":                 "Sedna (Zwergplanet)",
  "quaoar":                "Quaoar",
  "orcus":                 "Orcus (Zwergplanet)",
  "gonggong":              "Gonggong",

  // Monde — Erde + Mars
  "luna":                  "Mond",
  "phobos":                "Phobos (Mond)",
  "deimos":                "Deimos (Mond)",

  // Monde — Jupiter (mehrdeutige Namen, NASA-sourceUrl)
  "io":                    "Io (Mond)",
  "europa":                "Europa (Mond)",
  "ganymede":              "Ganymed (Mond)",
  "callisto":              "Kallisto (Mond)",
  "amalthea":              "Amalthea (Mond)",

  // Monde — Saturn (NASA-sourceUrl / Wikidata)
  "titan":                 "Titan (Mond)",
  "enceladus":             "Enceladus (Mond)",
  "rhea":                  "Rhea (Mond)",
  "mimas":                 "Mimas (Mond)",
  "iapetus":               "Iapetus",
  "dione":                 "Dione (Mond)",
  "tethys":                "Tethys (Mond)",
  "hyperion":              "Hyperion (Mond)",
  "phoebe":                "Phoebe (Mond)",
  "epimetheus":            "Epimetheus (Mond)",
  "janus":                 "Janus (Mond)",
  "calypso":               "Calypso (Mond)",
  "telesto":               "Telesto (Mond)",
  "helene":                "Helene (Mond)",
  "prometheus-saturn":     "Prometheus (Mond)",
  "pandora-saturn":        "Pandora (Mond)",
  "albiorix":              "Albiorix (Mond)",
  "erriapus":              "Erriapus",
  "ijiraq":                "Ijiraq",
  "kiviuq":                "Kiviuq",
  "paaliaq":               "Paaliaq",
  "siarnaq":               "Siarnaq",
  "tarvos":                "Tarvos (Mond)",
  "ymir":                  "Ymir (Mond)",

  // Monde — Uranus (en.wiki-sourceUrl, mehrdeutige Namen)
  "titania":               "Titania (Mond)",
  "oberon":                "Oberon (Mond)",
  "umbriel":               "Umbriel (Mond)",
  "ariel":                 "Ariel (Mond)",
  "miranda":               "Miranda (Mond)",
  "caliban":               "Caliban (Mond)",
  "sycorax":               "Sycorax (Mond)",
  "belinda":               "Belinda (Mond)",
  "bianca":                "Bianca (Mond)",
  "cordelia":              "Cordelia (Mond)",
  "cressida":              "Cressida (Mond)",
  "desdemona":             "Desdemona (Mond)",
  "mab":                   "Mab (Mond)",

  // Monde — Neptun
  "triton":                "Triton (Mond)",
  "nereid":                "Nereid (Mond)",
  "proteus":               "Proteus (Mond)",
  "despina":               "Despina (Mond)",
  "larissa":               "Larissa (Mond)",
  "naiad":                 "Naiad (Mond)",
  "halimede":              "Halimede (Mond)",
  "laomedeia":             "Laomedeia",
  "neso":                  "Neso (Mond)",
  "psamathe":              "Psamathe (Mond)",
  "sao":                   "Sao (Mond)",

  // Monde — Pluto
  "charon":                "Charon (Mond)",
  "nix":                   "Nix (Mond)",
  "hydra":                 "Hydra (Mond)",
  "kerberos":              "Kerberos (Mond)",

  // Monde — Jupiter (Wikidata, kleine)
  "adrastea":              "Adrastea (Mond)",
  "ananke":                "Ananke (Mond)",
  "carme":                 "Carme (Mond)",
  "elara":                 "Elara (Mond)",
  "himalia":               "Himalia (Mond)",
  "lysithea":              "Lysithea (Mond)",

  // Galaxien (NASA/en.wiki-sourceUrl oder mehrdeutig)
  "milky_way":             "Milchstraße",
  "andromeda":             "Andromedagalaxie",
  "triangulum":            "Dreiecksgalaxie",
  "large_magellanic_cloud":"Große Magellansche Wolke",
  "small_magellanic_cloud":"Kleine Magellansche Wolke",
  "whirlpool":             "Whirlpool-Galaxie",
  "sombrero":              "Sombrero-Galaxie",
  "bode_m81":              "Messier 81",
  "zigarren_m82":          "Messier 82",
  "centaurus_a":           "Centaurus A",
  "bildhauer_ngc253":      "Sculptor-Galaxie",
  "feuerrad_m101":         "Messier 101",
  "sonnenblume_m63":       "Messier 63",
  "schwarzauge_m64":       "Messier 64",
  "barnards-galaxie":      "Barnard's Galaxie",
  "wagenradgalaxie":       "Wagenradgalaxie",
  "sculptor-galaxie":      "Sculptor-Galaxie",

  // Missionen (de.wikipedia-sourceUrl, kein explizites Mapping nötig, aber zur Sicherheit)
  // (werden über sourceUrl aufgelöst)
};

// Namen, die NICHT per Name-Fallback (Weg 5) gesucht werden sollen,
// weil sie zu sehr disambiguiert sind und das Mapping fehlt. Sicherheitsnetz.
const AMBIGUOUS_NAMES = new Set([
  "Europa", "Io", "Charon", "Ariel", "Miranda", "Oberon", "Titania",
  "Prometheus", "Pandora", "Helene", "Calypso", "Janus", "Mab",
  "Bianca", "Cressida", "Cordelia", "Larissa", "Naiad", "Proteus",
  "Despina", "Neso", "Sao", "Carme", "Elara", "Himalia",
]);

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"]);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Sperrliste: maschinenlesbar aus IMAGE_BLACKLIST.json ueber die gemeinsame
// Regel in image_resolution_policy.cjs. Vorher las diese Datei die Sperrliste
// per Regex aus dem Fliesstext BLACKLIST.md — damit wirkte ein Eintrag nur,
// wenn er dort als vollstaendige Commons-URL stand, und gesperrte KONZEPT-IDs
// wirkten gar nicht. Dass "Guernica" trotzdem haengen blieb, lag an der
// doppelten Pflege in beiden Dateien (CodeQA 2026-09-03).

function attribution(meta) {
  const artist = (meta?.Artist?.value || "").toString().replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const credit = (meta?.Credit?.value || "").toString().replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return truncateCredit([artist, credit].filter(Boolean).join(" / ")) || "Wikimedia Commons";
}

// ---------------------------------------------------------------------------
// HTTP-GET mit Throttle + Backoff
// ---------------------------------------------------------------------------
const STATS = { apiCalls: 0, rateLimitEvents: 0, retries: 0, cacheHits: 0 };
let lastCall = 0;
const MIN_PAUSE = 250; // ms zwischen Calls (etwas erhöht für Sicherheit)

function apiGet(url, tries = 0) {
  return new Promise(async (resolve) => {
    const wait = MIN_PAUSE - (Date.now() - lastCall);
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    STATS.apiCalls++;

    const backoff = (raSecs, baseMs) =>
      (raSecs > 0 ? raSecs * 1000 : baseMs * (tries + 1)) + Math.floor(Math.random() * 500);

    https.get(url, { headers: { "User-Agent": UA } }, r => {
      let d = ""; r.on("data", c => d += c);
      r.on("end", async () => {
        const ra = parseInt(r.headers["retry-after"] || "0", 10);
        if (d.startsWith("You are making too many") || r.statusCode === 429 || r.statusCode === 503) {
          STATS.rateLimitEvents++;
          const wait = backoff(ra, 2000);
          console.error(`  [rate-limit, warte ${(wait/1000).toFixed(1)}s]`);
          if (tries < 8) { STATS.retries++; await sleep(wait); return resolve(await apiGet(url, tries + 1)); }
          return resolve(null);
        }
        let j;
        try { j = JSON.parse(d); }
        catch {
          STATS.rateLimitEvents++;
          if (tries < 8) { STATS.retries++; await sleep(backoff(0, 2000)); return resolve(await apiGet(url, tries + 1)); }
          return resolve(null);
        }
        if (j && j.error && j.error.code === "maxlag") {
          STATS.rateLimitEvents++;
          if (tries < 8) { STATS.retries++; await sleep(backoff(ra, 5000)); return resolve(await apiGet(url, tries + 1)); }
          return resolve(null);
        }
        resolve(j);
      });
    }).on("error", async () => {
      if (tries < 8) { STATS.retries++; await sleep(backoff(0, 1000)); return resolve(await apiGet(url, tries + 1)); }
      resolve(null);
    });
  });
}

// ---------------------------------------------------------------------------
// Commons imageinfo für einen Dateititel holen.
// ---------------------------------------------------------------------------
const commonsCache = new Map();

async function commonsInfoForTitle(rawTitle) {
  let title = rawTitle;
  try { title = decodeURIComponent(title.replace(/\+/g, " ")); } catch { }
  title = title.replace(/_/g, " ").trim();

  if (commonsCache.has(title)) { STATS.cacheHits++; return commonsCache.get(title); }
  if (isBlacklistedFile(title)) { commonsCache.set(title, null); return null; }

  const encodedTitle = encodeURIComponent(title.replace(/ /g, "_"));
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json` +
    `&titles=${encodedTitle}&prop=imageinfo&iiprop=extmetadata%7Curl%7Cmime&maxlag=5`;

  const j = await apiGet(url);
  const pages = j?.query?.pages;
  let result = null;
  if (pages) {
    const page = Object.values(pages)[0];
    if (page && page.missing === undefined) {
      const ii = page.imageinfo?.[0];
      if (ii && ALLOWED_MIME.has(ii.mime || "")
          && isAllowedCommonsLicenseMetadata(ii.extmetadata)) {
        const normalizedTitle = (page.title || title).replace(/ /g, "_");
        result = {
          imageFile: "https://commons.wikimedia.org/wiki/" + encodeURIComponent(normalizedTitle),
          imageLicense: licenseNameFromCommonsMetadata(ii.extmetadata),
          imageAttribution: attribution(ii.extmetadata),
        };
      }
    }
  }
  commonsCache.set(title, result);
  return result;
}

// ---------------------------------------------------------------------------
// Wikidata P18 → Commons-Dateititel oder null.
// ---------------------------------------------------------------------------
async function wikidataP18(qid) {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json` +
    `&ids=${encodeURIComponent(qid)}&props=claims&maxlag=5`;
  const j = await apiGet(url);
  const entity = j?.entities?.[qid];
  if (!entity) return null;
  const p18 = entity.claims?.P18;
  if (!p18 || !p18.length) return null;
  // Mehrdeutige oder veraltete Aussagen dürfen nicht durch ihre Listenposition
  // entscheiden, welches Bild veröffentlicht wird.
  const val = selectP18File(p18);
  if (!val) return null;
  return "File:" + val;
}

// ---------------------------------------------------------------------------
// de.wikipedia pageimages → Commons-Dateititel oder null.
// ---------------------------------------------------------------------------
const dewikiCache = new Map();

async function dewikiPageimage(title) {
  if (dewikiCache.has(title)) { STATS.cacheHits++; return dewikiCache.get(title); }

  const encodedTitle = encodeURIComponent(title.replace(/ /g, "_"));
  const url = `https://de.wikipedia.org/w/api.php?action=query&format=json` +
    `&titles=${encodedTitle}&prop=pageimages&piprop=original&redirects=1&maxlag=5`;
  const j = await apiGet(url);
  const pages = j?.query?.pages;
  let result = null;
  if (pages) {
    const page = Object.values(pages)[0];
    if (page && page.missing === undefined) {
      const source = page.original?.source;
      if (source) {
        // Commons-Upload-URL: .../wikipedia/commons/<hash>/<hash>/<Dateiname>.
        // Pageimages hängt Tracking-Parameter an; die gehören nicht zum Dateinamen.
        let fileName = null;
        try { fileName = decodeURIComponent(new URL(source).pathname.split("/").pop() || ""); }
        catch { fileName = null; }
        if (fileName) {
          // .svg.png-Varianten zurück auf .svg normalisieren (de.wiki liefert manchmal .svg.png)
          fileName = fileName.replace(/\.svg\.png$/, ".svg");
          result = "File:" + fileName;
        }
      }
    }
  }
  dewikiCache.set(title, result);
  return result;
}

// ---------------------------------------------------------------------------
// de.wikipedia-Titel aus URL extrahieren.
// ---------------------------------------------------------------------------
function dewikiTitleFromUrl(url) {
  if (!url) return null;
  const m = url.match(/^https?:\/\/de\.wikipedia\.org\/wiki\/(.+)$/);
  if (!m) return null;
  let title = m[1];
  try { title = decodeURIComponent(title.replace(/\+/g, " ")); } catch { }
  return title.replace(/_/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Haupt-Resolver.
// ---------------------------------------------------------------------------
async function resolveConcept(c) {
  // --- Weg 1: Wikidata P18 (eindeutig via QID) ---
  const qid = c.sourceUrl?.match(/wikidata\.org\/wiki\/(Q\d+)/)?.[1];
  if (qid) {
    const p18Title = await wikidataP18(qid);
    if (p18Title) {
      const info = await commonsInfoForTitle(p18Title);
      if (info) return { via: "wikidata-P18", info };
    }
    // P18 vorhanden aber Bild nicht brauchbar → weiter mit anderen Wegen
  }

  // --- Weg 2: Explizites de.wikipedia-Mapping (höchste Priorität nach P18) ---
  const explicitTitle = DEWIKI_MAP[c.id];
  if (explicitTitle !== undefined) {
    if (explicitTitle === "") return null; // bewusst übersprungen
    const fileTitle = await dewikiPageimage(explicitTitle);
    if (fileTitle) {
      const info = await commonsInfoForTitle(fileTitle);
      if (info) return { via: "dewiki-map", info };
    }
    // Mapping vorhanden, aber Bild nicht brauchbar → trotzdem nicht Freitextsuche machen
    return null;
  }

  // --- Weg 3: de.wikipedia via sourceUrl ---
  const sourceTitle = dewikiTitleFromUrl(c.sourceUrl);
  if (sourceTitle) {
    const fileTitle = await dewikiPageimage(sourceTitle);
    if (fileTitle) {
      const info = await commonsInfoForTitle(fileTitle);
      if (info) return { via: "dewiki-sourceUrl", info };
    }
  }

  // --- Weg 4: de.wikipedia via wikiLink ---
  const wikiTitle = dewikiTitleFromUrl(c.wikiLink);
  if (wikiTitle && wikiTitle !== sourceTitle) {
    const fileTitle = await dewikiPageimage(wikiTitle);
    if (fileTitle) {
      const info = await commonsInfoForTitle(fileTitle);
      if (info) return { via: "dewiki-wikiLink", info };
    }
  }

  // --- Weg 5: Konzeptname → de.wikipedia (nur bei eindeutigen Namen) ---
  if (!AMBIGUOUS_NAMES.has(c.name) && !sourceTitle && !wikiTitle) {
    const fileTitle = await dewikiPageimage(c.name);
    if (fileTitle) {
      const info = await commonsInfoForTitle(fileTitle);
      if (info) return { via: "dewiki-name", info };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Hauptprogramm
// ---------------------------------------------------------------------------
async function main() {
  const t0 = Date.now();
  const data = JSON.parse(fs.readFileSync(ASTRA_FILE, "utf8"));

  // Gesperrte Konzepte gar nicht erst aufloesen — wie in resolve_images_batched.
  const targets = data.filter(c => TARGET_CATS.has(c.category) && !c.imageFile
    && !isBlacklistedConcept(c.id));
  console.log(`Zielkonzepte (ohne imageFile): ${targets.length}`);

  const statsByCat = {};
  const statsByVia = {};
  const results = [];

  for (let i = 0; i < targets.length; i++) {
    const c = targets[i];
    const cat = c.category;
    if (!statsByCat[cat]) statsByCat[cat] = { total: 0, found: 0, skipped: 0 };
    statsByCat[cat].total++;

    process.stdout.write(`[${String(i+1).padStart(3)}/${targets.length}] ${cat.padEnd(12)} ${c.id.padEnd(32)} `);

    const res = await resolveConcept(c);
    if (res) {
      results.push({ id: c.id, ...res.info });
      statsByCat[cat].found++;
      statsByVia[res.via] = (statsByVia[res.via] || 0) + 1;
      const fname = decodeURIComponent(res.info.imageFile.split("/").pop()).slice(0, 45);
      console.log(`✓ [${res.via.padEnd(15)}] ${res.info.imageLicense.padEnd(14)} ${fname}`);
    } else {
      statsByCat[cat].skipped++;
      console.log(`— kein freies Bild`);
    }
  }

  // Output schreiben
  writeJsonAtomic(OUT_FILE, results);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log("\n=== ERGEBNIS ===");
  console.log(`Aufgelöst: ${results.length} / ${targets.length} (${elapsed}s)`);
  console.log(`API-Calls: ${STATS.apiCalls}  Cache-Hits: ${STATS.cacheHits}  Rate-Limit: ${STATS.rateLimitEvents}  Retries: ${STATS.retries}`);
  console.log("\nNach Kategorie:");
  Object.entries(statsByCat).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([cat, s]) =>
    console.log(`  ${cat.padEnd(14)} gesamt:${String(s.total).padStart(3)}  gefunden:${String(s.found).padStart(3)}  ohne-Bild:${String(s.skipped).padStart(3)}`)
  );
  console.log("\nNach Auflösungsweg:");
  Object.entries(statsByVia).sort((a,b)=>b[1]-a[1]).forEach(([via, n]) =>
    console.log(`  ${via.padEnd(18)} ${n}`)
  );
  console.log(`\nOutput: ${OUT_FILE} (${results.length} Einträge)`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`FEHLER: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { AMBIGUOUS_NAMES, DEWIKI_MAP };
