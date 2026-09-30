// Astra-Auflöser: dieselbe Quellen-/Sprachauflösung wie der gebündelte Lauf.
// Ausgabe bleibt ein Kandidaten-Mapping; Motivprüfung erfolgt vor dem Einpflegen.
const fs = require("fs");
const path = require("path");
const { writeJsonAtomic } = require('./json_io.cjs');
const { isBlacklistedConcept } = require('./image_resolution_policy.cjs');
const { createCommonsLookup } = require('./commons_image_candidates.cjs');
const { fetchWikiJson, sleep } = require('../../lib/commons_api.cjs');
const { createApiGuard } = require('./api_guard.cjs');

// Eigene Ausgabedatei je Resolver schützt Kandidaten anderer Läufe.
const OUT_FILE = "/tmp/astra_images_p18_v2.json";
const ASTRA_FILE = path.join(__dirname, "../astra_raw.json");

// Zielkategorien
const TARGET_CATS = new Set(["galaxy", "nebula", "planet", "dwarf_planet", "moon", "mission"]);

const { DEWIKI_MAP, AMBIGUOUS_NAMES } = require('./astra_image_titles.cjs');
const { resolveSourceImages } = require('./wikipedia_image_sources.cjs');

// ---------------------------------------------------------------------------
// HTTP-GET mit Throttle + Backoff
// ---------------------------------------------------------------------------
const STATS = {
  apiCalls: 0,
};
const apiGuard = createApiGuard({ label: 'Die Wikidata-/Commons-API' });
let lastCall = 0;
async function apiGet(url) {
  await sleep(Math.max(0, 250 - (Date.now() - lastCall)));
  lastCall = Date.now();
  STATS.apiCalls++;
  return fetchWikiJson(url, { apiGuard });
}

// ---------------------------------------------------------------------------
// Hauptprogramm
// ---------------------------------------------------------------------------
async function main() {
  const t0 = Date.now();
  const data = JSON.parse(fs.readFileSync(ASTRA_FILE, "utf8"));

  // Gesperrte Konzepte gar nicht erst aufloesen — wie in resolve_images_batched.
  let targets = data.filter(c => TARGET_CATS.has(c.category) && !c.imageFile
    && !isBlacklistedConcept(c.id));

  // `--limit=N` begrenzt eine Stichprobe auf die ersten Zielkonzepte.
  // Die Ausgabe enthält ausschließlich die in diesem Lauf geprüften Kandidaten.
  const limitFlag = process.argv.slice(2).find(a => a.startsWith("--limit="));
  const limit = limitFlag ? Number(limitFlag.split("=")[1]) : 0;
  if (limitFlag && (!Number.isInteger(limit) || limit <= 0)) {
    console.error(`--limit erwartet eine positive ganze Zahl, nicht "${limitFlag.split("=")[1]}"`);
    process.exit(2);
  }
  const gesamt = targets.length;
  if (limit) targets = targets.slice(0, limit);
  console.log(`Zielkonzepte (ohne imageFile): ${targets.length}`
    + (limit ? ` von ${gesamt} (--limit=${limit})` : ""));

  const statsByCat = {};
  const statsByVia = {};
  const results = [];
  const commons = createCommonsLookup(apiGet);
  const sourceImages = await resolveSourceImages(targets, 'astra', apiGet, commons.acceptFiles, commons.fitsConcept);

  for (let i = 0; i < targets.length; i++) {
    const c = targets[i];
    const cat = c.category;
    if (!statsByCat[cat]) statsByCat[cat] = { total: 0, found: 0, skipped: 0 };
    statsByCat[cat].total++;

    process.stdout.write(`[${String(i+1).padStart(3)}/${targets.length}] ${cat.padEnd(12)} ${c.id.padEnd(32)} `);

    const file = sourceImages.get(c.id);
    const res = file ? { via: 'source-link', info: commons.get(file) } : null;
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

  // Ein Nulllauf darf eine brauchbare Kandidatendatei nicht überschreiben.
  if (targets.length >= 10 && results.length === 0) {
    console.error(
      `\nKein einziges Bild aufgeloest (${targets.length} Konzepte angefragt) — `
      + `vermutlich API- oder Netzproblem. ${OUT_FILE} bleibt unveraendert.`);
    process.exitCode = 1;
    return;
  }

  // Output schreiben
  writeJsonAtomic(OUT_FILE, results);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log("\n=== ERGEBNIS ===");
  console.log(`Aufgelöst: ${results.length} / ${targets.length} (${elapsed}s)`);
  console.log(`API-Calls: ${STATS.apiCalls}`);
  if (apiGuard.total) console.log(`Abgewiesene Anfragen: ${apiGuard.total}`);
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
