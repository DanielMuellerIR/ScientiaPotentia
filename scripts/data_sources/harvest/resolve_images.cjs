// Bild-Resolver für die Ernte (gehärtet): sucht je Konzept (imageSearchTerm) ein REAL
// existierendes Wikimedia-Commons-Bild mit FREIER Lizenz (PD/CC0/CC-BY/CC-BY-SA/FAL/GFDL)
// und schreibt verifizierte imageFile/imageLicense/imageAttribution.
//
// Härtung ggü. Erstfassung (2026-06-05):
//   - EIN Call je Konzept: generator=search + prop=imageinfo gebündelt (statt Suche + Info
//     getrennt). Halbiert die Commons-Calls -> ~2x Durchsatz, weniger Rate-Limit-Last.
//   - maxlag=5: Server signalisiert Überlast selbst; wir respektieren den Retry-After-Header.
//   - Klartext-Overload („You are making too many…") wird abgefangen + neu versucht, NIE still
//     als „kein Bild" gewertet (genau dieser Bug nullte am 2026-06-05 ~350 Felder).
//   - --max-seconds=N: Zeitbudget. Danach sauber stoppen; Teilfortschritt ist gespeichert.
//   - Schreibt nach JEDEM Konzept zurück -> Abbruch/Timeout hinterlässt konsistenten Stand.
//
// Aufruf: node resolve_images.cjs [--max-seconds=N] [datei1.json datei2.json ...]
//   ohne Dateien: alle _w1*.json im aktuellen Verzeichnis.
// Füllt nur Konzepte mit leerem imageFile. Idempotent/fortsetzbar.

const https = require("https");
const fs = require("fs");

const UA = "ScientiaPotentiaQuiz/1.0 (offline education quiz; contact: local dev)";
const sleep = ms => new Promise(r => setTimeout(r, ms));

// freie Lizenz ja/nein anhand der Commons-extmetadata
function isFree(meta) {
  const lic = (meta?.LicenseShortName?.value || "").toString();
  const licUrl = (meta?.LicenseUrl?.value || "").toString();
  const copyrighted = (meta?.Copyrighted?.value || "").toString();
  const blob = (lic + " " + licUrl).toLowerCase();
  if (/\b(nc|nd|non[- ]?commercial|noncommercial|no[- ]?deriv|all rights)\b/.test(blob)) return false;
  if (/public domain|^pd|cc0|creativecommons\.org\/publicdomain/.test(blob)) return true;
  if (/cc[- ]by|creativecommons\.org\/licenses\/by/.test(blob)) return true; // by, by-sa (kein nc/nd, oben gefiltert)
  if (/\bfal\b|free art|gfdl/.test(blob)) return true;
  if (copyrighted.toLowerCase() === "false") return true; // PD ohne Kurzname
  return false;
}
function licName(meta) {
  return (meta?.LicenseShortName?.value || (meta?.Copyrighted?.value === "False" ? "Public domain" : "?")).toString();
}
function attribution(meta) {
  const artist = (meta?.Artist?.value || "").toString().replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const credit = (meta?.Credit?.value || "").toString().replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return [artist, credit].filter(Boolean).join(" / ").slice(0, 200) || "Wikimedia Commons";
}

let lastCall = 0;
// HTTP-GET gegen die Commons-API mit Throttle, maxlag/Retry-After + Klartext-Overload-Guard.
function apiGet(params, tries = 0) {
  return new Promise(async (resolve) => {
    // mind. 350 ms Abstand zwischen Calls (eine Verbindung, höflich)
    const wait = 350 - (Date.now() - lastCall);
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const q = "https://commons.wikimedia.org/w/api.php?" +
      Object.entries(params).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
    https.get(q, { headers: { "User-Agent": UA } }, r => {
      let d = ""; r.on("data", c => d += c);
      r.on("end", async () => {
        // Retry-After respektieren (Server gibt ihn bei maxlag/429/503 vor)
        const ra = parseInt(r.headers["retry-after"] || "0", 10);
        // Überlast: Klartext statt JSON, oder 429/503 -> warten + neu versuchen, NIE als „fehlt"
        if (d.startsWith("You are making too many") || r.statusCode === 429 || r.statusCode === 503) {
          if (tries < 6) { await sleep(ra > 0 ? ra * 1000 : 1500 * (tries + 1)); return resolve(await apiGet(params, tries + 1)); }
          return resolve(null);
        }
        let j;
        try { j = JSON.parse(d); }
        catch {
          // unerwarteter Nicht-JSON-Body -> als Überlast behandeln + retry, nicht still „fehlt"
          if (tries < 6) { await sleep(1500 * (tries + 1)); return resolve(await apiGet(params, tries + 1)); }
          return resolve(null);
        }
        // maxlag-Fehler (HTTP 200, error.code === "maxlag") -> Retry-After abwarten
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

// EIN Call: Suche (generator=search) + Lizenz/URL/MIME (prop=imageinfo) gebündelt.
async function resolveConcept(term) {
  if (!term) return null;
  const j = await apiGet({
    action: "query", format: "json",
    generator: "search", gsrsearch: term, gsrnamespace: 6, gsrlimit: 10,
    prop: "imageinfo", iiprop: "extmetadata|url|mime", maxlag: 5,
  });
  const pages = j?.query?.pages;
  if (!pages) return null;
  // generator liefert pages unsortiert (keyed by pageid); `index` = Such-Rang -> danach ordnen
  const ordered = Object.values(pages).sort((a, b) => (a.index || 0) - (b.index || 0));
  for (const p of ordered) {
    const ii = p.imageinfo?.[0]; if (!ii) continue;
    if ((ii.mime || "").startsWith("image/") === false) continue;
    if (isFree(ii.extmetadata)) {
      return {
        imageFile: "https://commons.wikimedia.org/wiki/" + encodeURIComponent(p.title.replace(/ /g, "_")),
        imageLicense: licName(ii.extmetadata),
        imageAttribution: attribution(ii.extmetadata),
      };
    }
  }
  return null;
}

(async () => {
  // --max-seconds aus den Argumenten ziehen, Rest sind Dateinamen
  let args = process.argv.slice(2);
  let maxSeconds = 0;
  args = args.filter(a => { const m = a.match(/^--max-seconds=(\d+)$/); if (m) { maxSeconds = +m[1]; return false; } return true; });
  const files = args.length ? args : fs.readdirSync(".").filter(f => /_w1b?\.json$/.test(f));

  const t0 = Date.now();
  const overBudget = () => maxSeconds > 0 && (Date.now() - t0) / 1000 >= maxSeconds;
  let G = { total: 0, resolved: 0, none: 0, stoppedEarly: false };

  for (const f of files) {
    const arr = JSON.parse(fs.readFileSync(f, "utf8"));
    let res = 0, none = 0;
    for (const o of arr) {
      if (o.imageFile) continue;                  // schon gesetzt
      if (overBudget()) { G.stoppedEarly = true; break; }
      G.total++;
      const r = await resolveConcept(o.imageSearchTerm || o.name);
      if (r) { Object.assign(o, r); delete o._imgProblem; res++; G.resolved++; }
      else { o._imgProblem = "kein freies Commons-Bild gefunden"; none++; G.none++; }
      fs.writeFileSync(f, JSON.stringify(arr, null, 2)); // Teilfortschritt sofort sichern
    }
    fs.writeFileSync(f, JSON.stringify(arr, null, 2));
    console.log(`${f.padEnd(22)} aufgeloest:${res}  ohne Bild:${none}`);
    if (G.stoppedEarly) break;
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n===== RESOLVER: ${G.resolved} aufgeloest, ${G.none} ohne freies Bild (von ${G.total}) in ${secs}s` +
    `${G.stoppedEarly ? " [Zeitbudget erreicht, gestoppt]" : ""} =====`);
})();
