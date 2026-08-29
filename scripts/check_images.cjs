// Bild-Prüfer: validiert die in einer Faktenbasis hinterlegten Commons-Bilder
// LIVE gegen die Wikimedia-Commons-API. Für jedes Konzept:
//   - existiert die Datei wirklich?           (missing-Flag)
//   - ist es ein Bild?                          (MIME image/*)
//   - ist die Lizenz frei?                      (extmetadata, gleiche Regel wie Resolver)
//   - Direkt-Thumbnail-URL + Maße               (für das Museum nutzbar)
//
// Es ÄNDERT nichts an den Daten — nur Report + optional eine Map nach stdout/Datei.
//
// Aufruf: node scripts/check_images.cjs [pfad/zur/raw.json] [--json=out.json]
//   default: scripts/data_sources/natura_raw.json
//
// Hintergrund: Der Resolver nahm jeweils das ERSTE freie Treffer-Bild. Dieser
// Check fängt tote/umbenannte Dateien und Nicht-Bilder ab, bevor sie im Museum
// sichtbar werden. Thematische Eignung muss visuell stichprobengeprüft werden.

const https = require("https");
const fs = require("fs");
const {
  isAllowedCommonsLicenseMetadata,
} = require('./lib/image_license_policy.cjs');

const UA = "ScientiaPotentiaQuiz/1.0 (offline education quiz; contact: local dev)";
const sleep = ms => new Promise(r => setTimeout(r, ms));

let lastCall = 0;
function apiGet(params, tries = 0) {
  return new Promise(async (resolve) => {
    const wait = 350 - (Date.now() - lastCall);
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const q = "https://commons.wikimedia.org/w/api.php?" +
      Object.entries(params).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
    https.get(q, { headers: { "User-Agent": UA } }, r => {
      let d = ""; r.on("data", c => d += c);
      r.on("end", async () => {
        const ra = parseInt(r.headers["retry-after"] || "0", 10);
        if (d.startsWith("You are making too many") || r.statusCode === 429 || r.statusCode === 503) {
          if (tries < 6) { await sleep(ra > 0 ? ra * 1000 : 1500 * (tries + 1)); return resolve(await apiGet(params, tries + 1)); }
          return resolve(null);
        }
        let j;
        try { j = JSON.parse(d); } catch {
          if (tries < 6) { await sleep(1500 * (tries + 1)); return resolve(await apiGet(params, tries + 1)); }
          return resolve(null);
        }
        if (j && j.error && j.error.code === "maxlag") {
          if (tries < 6) { await sleep(ra > 0 ? ra * 1000 : 5000); return resolve(await apiGet(params, tries + 1)); }
          return resolve(null);
        }
        resolve(j);
      });
    }).on("error", async () => {
      if (tries < 6) { await sleep(800 * (tries + 1)); return resolve(await apiGet(params, tries + 1)); }
      resolve(null);
    });
  });
}

// File:-Dateititel aus der gespeicherten Commons-Seiten-URL ziehen.
function titleFromUrl(u) {
  if (!u) return null;
  const dec = decodeURIComponent(String(u));
  const m = dec.match(/\/wiki\/(File:.+)$/);
  return m ? m[1].replace(/_/g, " ") : null;
}

(async () => {
  const args = process.argv.slice(2);
  const jsonOut = (args.find(a => a.startsWith("--json=")) || "").split("=")[1] || null;
  const path = args.find(a => !a.startsWith("--")) || "scripts/data_sources/natura_raw.json";
  const data = JSON.parse(fs.readFileSync(path, "utf8"));
  // raw.json ist ein Array; concepts_*.json ist eine Map -> beide Formen tragen.
  const items = Array.isArray(data) ? data : Object.values(data);

  // id -> {title, concept}
  const byTitle = {};       // API-Titel -> Eintrag
  const entries = [];
  for (const c of items) {
    const url = c.imageFile || c.image?.url || "";
    const title = titleFromUrl(url);
    const e = { id: c.id, name: c.name, category: c.category, title, url, result: null };
    entries.push(e);
    if (title) (byTitle[title] ||= []).push(e);
  }

  // In 50er-Batches abfragen (imageinfo bündelt bis 50 Titel je Call).
  const titles = Object.keys(byTitle);
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const j = await apiGet({
      action: "query", format: "json", titles: batch.join("|"),
      prop: "imageinfo", iiprop: "url|mime|size|extmetadata", iiurlwidth: 400, maxlag: 5
    });
    // Titel-Normalisierung der API berücksichtigen (z.B. Leerzeichen/Unterstrich).
    const normMap = {};
    for (const n of (j?.query?.normalized || [])) normMap[n.to] = n.from;
    const pages = j?.query?.pages || {};
    for (const p of Object.values(pages)) {
      const from = normMap[p.title] || p.title;
      const list = byTitle[from] || byTitle[p.title] || [];
      for (const e of list) {
        if (p.missing !== undefined) { e.result = { ok: false, reason: "missing" }; continue; }
        const ii = p.imageinfo?.[0];
        if (!ii) { e.result = { ok: false, reason: "no imageinfo" }; continue; }
        const isImg = (ii.mime || "").startsWith("image/");
        const free = isAllowedCommonsLicenseMetadata(ii.extmetadata);
        e.result = {
          ok: isImg && free,
          reason: !isImg ? "not image (" + ii.mime + ")" : !free ? "license not free" : "ok",
          mime: ii.mime, width: ii.width, height: ii.height,
          thumb: ii.thumburl || null
        };
      }
    }
  }

  // --- Report ---------------------------------------------------------------
  const noTitle = entries.filter(e => !e.title);
  const unresolved = entries.filter(e => e.title && !e.result);
  const ok = entries.filter(e => e.result?.ok);
  const bad = entries.filter(e => e.result && !e.result.ok);

  console.log(`Datei: ${path}`);
  console.log(`Konzepte: ${entries.length}  | OK: ${ok.length}  | Problem: ${bad.length}  | ohne Titel: ${noTitle.length}  | unbeantwortet: ${unresolved.length}`);
  if (bad.length) {
    console.log("\n--- PROBLEME ---");
    bad.forEach(e => console.log(`  x ${e.category}/${e.id}  [${e.result.reason}]  ${e.title}`));
  }
  if (noTitle.length) {
    console.log("\n--- OHNE GÜLTIGE FILE:-URL ---");
    noTitle.forEach(e => console.log(`  ? ${e.category}/${e.id}  ${e.url}`));
  }
  if (unresolved.length) {
    console.log("\n--- UNBEANTWORTET (API-Lücke) ---");
    unresolved.forEach(e => console.log(`  ? ${e.category}/${e.id}  ${e.title}`));
  }

  if (jsonOut) {
    const map = {};
    for (const e of entries) map[e.id] = { title: e.title, ...e.result };
    fs.writeFileSync(jsonOut, JSON.stringify(map, null, 2));
    console.log(`\nGeschrieben: ${jsonOut}`);
  }
})();
