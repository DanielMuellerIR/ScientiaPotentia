// Bild-Resolver Phase D: Hauptbild via de.wikipedia pageimages ODER Wikidata P18.
// KEINE Freitextsuche — nur das Artikelhauptbild des passenden Wikipedia-Artikels.
//
// Strategie je Konzept:
//   1. Hat sourceUrl eine Wikidata-QID (/wiki/Q\d+)? → Wikidata P18 holen (direkt Dateititel).
//   2. Hat sourceUrl eine de.wikipedia-URL?            → de.wikipedia pageimages.
//   3. Hat wikiLink?                                   → de.wikipedia pageimages.
//   4. Sonst: Konzeptname als Titel gegen de.wikipedia pageimages versuchen.
//   Kein Ergebnis → Konzept überspringen (NICHT in Output-Array aufnehmen).
//
// Für jeden gefundenen Dateititel:
//   - Commons imageinfo?action=query&prop=imageinfo&iiprop=extmetadata|url|mime holen
//   - MIME aus ALLOWED_MIME, Lizenz frei (isFree), nicht in BLACKLIST
//   - imageFile = "https://commons.wikimedia.org/wiki/" + encodedTitle
//   - imageLicense, imageAttribution aus extmetadata
//
// Output: /tmp/astra_images2.json   [{id, imageFile, imageLicense, imageAttribution}]
//
// Aufruf: node resolve_images_p18.cjs
// Laufzeit: ~2-3 Min für 155 Konzepte (200ms Pause + Backoff).

const https = require("https");
const fs = require("fs");
const path = require("path");
const { writeJsonAtomic } = require('./json_io.cjs');
const {
  isAllowedCommonsLicenseMetadata,
  licenseNameFromCommonsMetadata,
} = require('../../lib/image_license_policy.js');
const { fileNameFromUploadUrl } = require('./image_resolution_policy.cjs');

const UA = "ScientiaQuizImageResolverP18/1.0 (educational quiz project; pageimages+P18 only)";
const OUT_FILE = "/tmp/astra_images2.json";
const ASTRA_FILE = path.join(__dirname, "../astra_raw.json");

// Zielkategorien (laut Aufgabenstellung)
const TARGET_CATS = new Set(["galaxy", "nebula", "planet", "dwarf_planet", "moon", "mission"]);
// Sterne + Asteroiden überspringen (meist Punktquellen/Diagramme),
// AUSSER P18 liefert ein echtes Bild — das prüfen wir unten.
// Für diese Kategorien verwenden wir P18, wenn vorhanden, aber kein Fallback via Name.
const P18_ONLY_CATS = new Set(["asteroid", "star"]);

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"]);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Blacklist aus BLACKLIST.md einlesen (identisch zu resolve_images.cjs)
// ---------------------------------------------------------------------------
function loadBlacklist() {
  const set = new Set();
  try {
    const md = fs.readFileSync(path.join(__dirname, "BLACKLIST.md"), "utf8");
    const re = /commons\.wikimedia\.org\/wiki\/(File:[^\s)\]]+)/gi;
    let m;
    while ((m = re.exec(md))) {
      let title = m[1];
      try { title = decodeURIComponent(title); } catch { /* schon dekodiert */ }
      set.add(title.replace(/_/g, " ").trim());
    }
  } catch { /* keine BLACKLIST.md → leere Sperrliste */ }
  return set;
}
const BLACKLIST = loadBlacklist();

function attribution(meta) {
  const artist = (meta?.Artist?.value || "").toString().replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const credit = (meta?.Credit?.value || "").toString().replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return [artist, credit].filter(Boolean).join(" / ").slice(0, 200) || "Wikimedia Commons";
}

// ---------------------------------------------------------------------------
// HTTP-GET mit Throttle + Backoff (beide APIs)
// ---------------------------------------------------------------------------
const STATS = { apiCalls: 0, rateLimitEvents: 0, retries: 0, cacheHits: 0 };
let lastCall = 0;
const MIN_PAUSE = 200; // ms zwischen Calls

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
          if (tries < 6) { STATS.retries++; await sleep(backoff(ra, 1500)); return resolve(await apiGet(url, tries + 1)); }
          return resolve(null);
        }
        let j;
        try { j = JSON.parse(d); }
        catch {
          STATS.rateLimitEvents++;
          if (tries < 6) { STATS.retries++; await sleep(backoff(0, 1500)); return resolve(await apiGet(url, tries + 1)); }
          return resolve(null);
        }
        if (j && j.error && j.error.code === "maxlag") {
          STATS.rateLimitEvents++;
          if (tries < 6) { STATS.retries++; await sleep(backoff(ra, 5000)); return resolve(await apiGet(url, tries + 1)); }
          return resolve(null);
        }
        resolve(j);
      });
    }).on("error", async () => {
      if (tries < 6) { STATS.retries++; await sleep(backoff(0, 800)); return resolve(await apiGet(url, tries + 1)); }
      resolve(null);
    });
  });
}

// ---------------------------------------------------------------------------
// Commons imageinfo für einen Dateititel (z.B. "File:Foo.jpg") holen.
// Gibt { imageFile, imageLicense, imageAttribution } oder null zurück.
// ---------------------------------------------------------------------------
const commonsCache = new Map(); // Dateititel → Ergebnis

async function commonsInfoForTitle(rawTitle) {
  // Normalisieren: Unterstriche→Leerzeichen, URL-dekodieren
  let title = rawTitle;
  try { title = decodeURIComponent(title.replace(/\+/g, " ")); } catch { /* bereits dekodiert */ }
  title = title.replace(/_/g, " ").trim();

  if (commonsCache.has(title)) { STATS.cacheHits++; return commonsCache.get(title); }

  // Schwarzliste sofort prüfen — spart API-Call
  if (BLACKLIST.has(title)) { commonsCache.set(title, null); return null; }

  const encodedTitle = encodeURIComponent(title.replace(/ /g, "_"));
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json` +
    `&titles=${encodedTitle}&prop=imageinfo&iiprop=extmetadata%7Curl%7Cmime&maxlag=5`;

  const j = await apiGet(url);
  const pages = j?.query?.pages;
  let result = null;
  if (pages) {
    const page = Object.values(pages)[0];
    if (page && !page.missing) {
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
// Wikidata P18 für eine QID holen → Commons-Dateititel oder null.
// ---------------------------------------------------------------------------
async function wikidataP18(qid) {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json` +
    `&ids=${encodeURIComponent(qid)}&props=claims&languages=de&maxlag=5`;
  const j = await apiGet(url);
  const entity = j?.entities?.[qid];
  if (!entity) return null;
  const p18 = entity.claims?.P18;
  if (!p18 || !p18.length) return null;
  // Bestes Preferred / Normal Statement nehmen
  const stmt = p18.find(s => s.rank === "preferred") || p18[0];
  const val = stmt?.mainsnak?.datavalue?.value;
  if (!val) return null;
  // P18-Wert ist ein Dateiname (z.B. "Pluto-01_Stern_3_pb.jpg"), kein "File:"-Präfix
  const fileTitle = "File:" + val;
  return fileTitle;
}

// ---------------------------------------------------------------------------
// de.wikipedia pageimages API → Commons-Dateititel oder null.
// title = Wikipedia-Seitentitel (dekodiert, ohne Namespace-Präfix).
// ---------------------------------------------------------------------------
async function dewikiPageimage(title) {
  const encodedTitle = encodeURIComponent(title.replace(/ /g, "_"));
  const url = `https://de.wikipedia.org/w/api.php?action=query&format=json` +
    `&titles=${encodedTitle}&prop=pageimages&piprop=original&pithumbsize=0&maxlag=5`;
  const j = await apiGet(url);
  const pages = j?.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) return null;
  // pageimages liefert "original.source" (URL zur Rohdatei) und implizit den Dateinamen
  const source = page.original?.source;
  if (!source) return null;
  // Dateinamen aus Commons-URL extrahieren:
  // https://upload.wikimedia.org/wikipedia/commons/3/37/Foo.jpg → File:Foo.jpg
  const fileName = fileNameFromUploadUrl(source);
  if (!fileName) return null;
  return "File:" + fileName;
}

// ---------------------------------------------------------------------------
// Seitentitel aus de.wikipedia-URL extrahieren, sofern vorhanden.
// Gibt z.B. "Andromeda-Galaxie" zurück oder null.
// ---------------------------------------------------------------------------
function dewikiTitleFromUrl(url) {
  if (!url) return null;
  // https://de.wikipedia.org/wiki/Andromeda-Galaxie
  const m = url.match(/^https?:\/\/de\.wikipedia\.org\/wiki\/(.+)$/);
  if (!m) return null;
  let title = m[1];
  try { title = decodeURIComponent(title.replace(/\+/g, " ")); } catch { /* ok */ }
  return title.replace(/_/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Haupt-Resolver: liefert { imageFile, imageLicense, imageAttribution } oder null.
// ---------------------------------------------------------------------------
async function resolveConcept(c) {
  // --- Weg 1: Wikidata P18 (falls QID vorhanden) ---
  const qid = c.sourceUrl && c.sourceUrl.match(/wikidata\.org\/wiki\/(Q\d+)/)?.[1];
  if (qid) {
    const p18Title = await wikidataP18(qid);
    if (p18Title) {
      const info = await commonsInfoForTitle(p18Title);
      if (info) return info;
      // P18 vorhanden, aber Bild nicht frei/MIME-falsch → trotzdem probieren via pageimages
    }
  }

  // --- Weg 2: de.wikipedia pageimages via sourceUrl ---
  const sourceTitle = dewikiTitleFromUrl(c.sourceUrl);
  if (sourceTitle) {
    const fileTitle = await dewikiPageimage(sourceTitle);
    if (fileTitle) {
      const info = await commonsInfoForTitle(fileTitle);
      if (info) return info;
    }
  }

  // --- Weg 3: de.wikipedia pageimages via wikiLink (falls vorhanden) ---
  const wikiTitle = dewikiTitleFromUrl(c.wikiLink);
  if (wikiTitle && wikiTitle !== sourceTitle) {
    const fileTitle = await dewikiPageimage(wikiTitle);
    if (fileTitle) {
      const info = await commonsInfoForTitle(fileTitle);
      if (info) return info;
    }
  }

  // --- Weg 4: Konzeptname direkt als de.wikipedia-Seitentitel ---
  // Nur für Zielkategorien (TARGET_CATS), nicht für P18_ONLY_CATS
  if (!P18_ONLY_CATS.has(c.category) && !sourceTitle && !wikiTitle) {
    const fileTitle = await dewikiPageimage(c.name);
    if (fileTitle) {
      const info = await commonsInfoForTitle(fileTitle);
      if (info) return info;
    }
  }

  return null; // kein Bild gefunden
}

// ---------------------------------------------------------------------------
// Hauptprogramm
// ---------------------------------------------------------------------------
(async () => {
  const t0 = Date.now();
  const data = JSON.parse(fs.readFileSync(ASTRA_FILE, "utf8"));

  // Zielkonzepte: TARGET_CATS ohne imageFile
  const targets = data.filter(c => TARGET_CATS.has(c.category) && !c.imageFile);
  console.log(`Zielkonzepte (ohne imageFile): ${targets.length}`);
  console.log(`Kategorien: galaxy=${targets.filter(c=>c.category==='galaxy').length}` +
    ` nebula=${targets.filter(c=>c.category==='nebula').length}` +
    ` planet=${targets.filter(c=>c.category==='planet').length}` +
    ` dwarf_planet=${targets.filter(c=>c.category==='dwarf_planet').length}` +
    ` moon=${targets.filter(c=>c.category==='moon').length}` +
    ` mission=${targets.filter(c=>c.category==='mission').length}`);
  console.log("---");

  // Statistik je Kategorie
  const statsByCat = {};
  const results = [];

  for (let i = 0; i < targets.length; i++) {
    const c = targets[i];
    const cat = c.category;
    if (!statsByCat[cat]) statsByCat[cat] = { total: 0, found: 0, skipped: 0 };
    statsByCat[cat].total++;

    process.stdout.write(`[${String(i+1).padStart(3)}/${targets.length}] ${cat.padEnd(12)} ${c.id.padEnd(32)} `);

    const info = await resolveConcept(c);
    if (info) {
      results.push({ id: c.id, ...info });
      statsByCat[cat].found++;
      // Dateinamen aus URL zur Anzeige kürzen
      const fname = decodeURIComponent(info.imageFile.split("/").pop()).slice(0, 50);
      console.log(`✓ ${info.imageLicense.padEnd(14)} ${fname}`);
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
  Object.entries(statsByCat).forEach(([cat, s]) =>
    console.log(`  ${cat.padEnd(14)} gesamt:${s.total}  gefunden:${s.found}  ohne-Bild:${s.skipped}`)
  );
  console.log(`\nOutput: ${OUT_FILE} (${results.length} Einträge)`);
})();
