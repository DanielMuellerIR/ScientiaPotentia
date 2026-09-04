// Bild-Resolver für die Ernte (Phase C, gehärtet): sucht je Konzept (imageSearchTerm) ein
// REAL existierendes Wikimedia-Commons-Bild mit FREIER Lizenz und schreibt verifizierte
// imageFile/imageLicense/imageAttribution in die Harvest-JSONs.
//
// Härtungen (Stand 2026-06-10, siehe docs/content_pipeline.md "Smarte Rate-Limit-Umgehung"):
//   - EIN Call je Suchbegriff: generator=search + prop=imageinfo gebündelt (Suche + Lizenz +
//     MIME zusammen statt zwei Calls). imageinfo könnte bis 50 Titel bündeln; wir nutzen 10
//     Treffer je Suche.
//   - maxlag=5: der Server signalisiert Überlast selbst; Retry-After-Header wird respektiert.
//   - Backoff MIT Jitter (zufälliger Zuschlag), damit Retries nicht im Takt hämmern.
//   - EINE Verbindung: alle Calls strikt sequenziell, mind. 350 ms Abstand (höflich).
//   - Beschreibender User-Agent (Wikimedia-Pflicht).
//   - JSON.parse-Guard: bei Überlast liefert die API KLARTEXT ("You are making too many
//     requests…") statt JSON -> abfangen + Retry mit Backoff, NIEMALS still als "kein Bild"
//     werten (genau dieser Bug nullte am 2026-06-05 ~350 Bildfelder).
//   - Dedup-Cache: identischer Suchbegriff -> ein API-Call für viele Konzepte.
//   - Gemeinsamer Lizenzfilter mit Release-Audit und übrigen Resolvern.
//     Tabu: NC, ND, "All rights reserved" sowie unklare/fehlende Lizenz.
//   - MIME-Whitelist: nur browser-darstellbare Bildformate (jpeg/png/svg/gif/webp).
//     Verhindert .djvu-Buchscans und .tiff-Riesendateien als "Bild".
//   - Blacklist: gesperrte Commons-Dateien aus BLACKLIST.md werden nie verwendet.
//   - Schreibt nach JEDEM Konzept zurück -> Abbruch/Timeout hinterlässt konsistenten Stand.
//
// Aufruf: node resolve_images.cjs [--max-seconds=N] [datei1.json datei2.json ...]
//   ohne Dateien: alle _w1*.json im aktuellen Verzeichnis.
// Füllt nur Konzepte mit LEEREM imageFile (bestehende verifizierte Bilder bleiben unberührt).
// Idempotent/fortsetzbar. Fakten-Felder werden nie angefasst.

const https = require("https");
const fs = require("fs");
const path = require("path");
const { writeJsonAtomic } = require('./json_io.cjs');
const { commonsAttribution } = require('./credit_text.cjs');
const {
  isBlacklistedFile, isBlacklistedConcept,
} = require('./image_resolution_policy.cjs');
const {
  isAllowedCommonsLicenseMetadata,
  licenseNameFromCommonsMetadata,
} = require('../../lib/image_license_policy.js');

// Wikimedia verlangt einen beschreibenden User-Agent, der das Projekt erkennbar macht.
const UA = "ScientiaQuizImageResolver/1.0 (educational quiz project)";
const PROBLEM_TAG = "kein freies Bild gefunden (Phase C 2026-06-10)";
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Nur diese MIME-Typen gelten als brauchbares Quiz-Bild (browser-darstellbar).
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"]);

// Sperrliste: maschinenlesbar aus IMAGE_BLACKLIST.json ueber die gemeinsame
// Regel in image_resolution_policy.cjs. Vorher las diese Datei die Sperrliste
// per Regex aus dem Fliesstext BLACKLIST.md — damit wirkte ein Eintrag nur,
// wenn er dort als vollstaendige Commons-URL stand, und gesperrte KONZEPT-IDs
// wirkten gar nicht. Dass "Guernica" trotzdem haengen blieb, lag an der
// doppelten Pflege in beiden Dateien (CodeQA 2026-09-03).

// Urheber-Angabe aus extmetadata (Artist + Credit), HTML-Tags gestrippt, gekürzt.
// Artist + Credit nach der gemeinsamen Regel in credit_text.cjs. Bleibt beides
// leer, steht als letzter Ausweg die Plattform selbst im Nachweis.
function attribution(meta) {
  return commonsAttribution(meta) || "Wikimedia Commons";
}

// Laufzeit-Statistik (im Abschlussbericht ausgegeben).
const STATS = { apiCalls: 0, cacheHits: 0, rateLimitEvents: 0, retries: 0 };

let lastCall = 0;
// HTTP-GET gegen die Commons-API: Throttle (eine Verbindung, sequenziell),
// maxlag/Retry-After, Klartext-Overload-Guard, Backoff mit Jitter.
function apiGet(params, tries = 0) {
  return new Promise(async (resolve) => {
    // mind. 350 ms Abstand zwischen Calls (höflich, eine Verbindung)
    const wait = 350 - (Date.now() - lastCall);
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    STATS.apiCalls++;
    const q = "https://commons.wikimedia.org/w/api.php?" +
      Object.entries(params).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
    // Backoff-Helfer: Basiswartezeit + zufälliger Jitter (0-500 ms), Retry-After hat Vorrang.
    const backoff = (raSecs, baseMs) =>
      (raSecs > 0 ? raSecs * 1000 : baseMs * (tries + 1)) + Math.floor(Math.random() * 500);
    https.get(q, { headers: { "User-Agent": UA } }, r => {
      let d = ""; r.on("data", c => d += c);
      r.on("end", async () => {
        // Retry-After respektieren (Server gibt ihn bei maxlag/429/503 vor)
        const ra = parseInt(r.headers["retry-after"] || "0", 10);
        // Überlast: Klartext statt JSON, oder 429/503 -> warten + neu versuchen, NIE als "fehlt"
        if (d.startsWith("You are making too many") || r.statusCode === 429 || r.statusCode === 503) {
          STATS.rateLimitEvents++;
          if (tries < 6) { STATS.retries++; await sleep(backoff(ra, 1500)); return resolve(await apiGet(params, tries + 1)); }
          return resolve(null);
        }
        let j;
        try { j = JSON.parse(d); }
        catch {
          // unerwarteter Nicht-JSON-Body -> als Überlast behandeln + Retry, nicht still "fehlt"
          STATS.rateLimitEvents++;
          if (tries < 6) { STATS.retries++; await sleep(backoff(0, 1500)); return resolve(await apiGet(params, tries + 1)); }
          return resolve(null);
        }
        // maxlag-Fehler (HTTP 200, error.code === "maxlag") -> Retry-After abwarten
        if (j && j.error && j.error.code === "maxlag") {
          STATS.rateLimitEvents++;
          if (tries < 6) { STATS.retries++; await sleep(backoff(ra, 5000)); return resolve(await apiGet(params, tries + 1)); }
          return resolve(null);
        }
        resolve(j);
      });
    }).on("error", async () => {
      if (tries < 6) { STATS.retries++; await sleep(backoff(0, 800)); return resolve(await apiGet(params, tries + 1)); }
      resolve(null);
    });
  });
}

// ---------------------------------------------------------------------------
// Dedup-Cache: identischer Suchbegriff -> nur EIN API-Call, Ergebnis (auch ein
// Fehlschlag = null) wird wiederverwendet. Spart Calls, wenn mehrere Konzepte
// denselben imageSearchTerm tragen.
// ---------------------------------------------------------------------------
const CACHE = new Map();

// EIN Call: Suche (generator=search, Namespace 6 = Dateien) + Lizenz/URL/MIME
// (prop=imageinfo) gebündelt. Liefert das erste freie, MIME-taugliche,
// nicht-geblacklistete Bild — oder null.
async function resolveConcept(term) {
  if (!term) return null;
  if (CACHE.has(term)) { STATS.cacheHits++; return CACHE.get(term); }
  const j = await apiGet({
    action: "query", format: "json",
    generator: "search", gsrsearch: term, gsrnamespace: 6, gsrlimit: 10,
    prop: "imageinfo", iiprop: "extmetadata|url|mime", maxlag: 5,
  });
  let result = null;
  const pages = j?.query?.pages;
  if (pages) {
    // generator liefert pages unsortiert (keyed by pageid); `index` = Such-Rang -> danach ordnen
    const ordered = Object.values(pages).sort((a, b) => (a.index || 0) - (b.index || 0));
    for (const p of ordered) {
      const ii = p.imageinfo?.[0]; if (!ii) continue;
      if (!ALLOWED_MIME.has(ii.mime || "")) continue;            // nur echte, darstellbare Bilder
      if (isBlacklistedFile(p.title || "")) continue; // gesperrte Datei
      if (isAllowedCommonsLicenseMetadata(ii.extmetadata)) {
        result = {
          // Gespeichert wird die Commons-DATEISEITE (nicht die Roh-Bild-URL),
          // damit Lizenz + Urheber für jeden nachprüfbar verlinkt sind.
          imageFile: "https://commons.wikimedia.org/wiki/" + encodeURIComponent(p.title.replace(/ /g, "_")),
          imageLicense: licenseNameFromCommonsMetadata(ii.extmetadata),
          imageAttribution: attribution(ii.extmetadata),
        };
        break;
      }
    }
  }
  CACHE.set(term, result);
  return result;
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
      if (o.imageFile) continue;                  // schon gesetzt -> nie überschreiben
      // Gesperrtes Konzept gar nicht erst aufloesen. Dieses Skript schreibt sein
      // Ergebnis direkt in die Erntedatei, es gibt hier also keinen zweiten
      // Wächter davor (CodeQA 2026-09-03).
      if (isBlacklistedConcept(o.id)) continue;
      if (overBudget()) { G.stoppedEarly = true; break; }
      G.total++;
      const r = await resolveConcept(o.imageSearchTerm || o.name);
      if (r) { Object.assign(o, r); delete o._imgProblem; res++; G.resolved++; }
      else { o._imgProblem = PROBLEM_TAG; none++; G.none++; }
      writeJsonAtomic(f, arr); // Teilfortschritt nach jedem Konzept atomar sichern
    }
    writeJsonAtomic(f, arr);
    console.log(`${f.padEnd(22)} aufgeloest:${res}  ohne Bild:${none}`);
    if (G.stoppedEarly) break;
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n===== RESOLVER: ${G.resolved} aufgeloest, ${G.none} ohne freies Bild (von ${G.total}) in ${secs}s` +
    `${G.stoppedEarly ? " [Zeitbudget erreicht, gestoppt]" : ""} =====`);
  console.log(`STATISTIK: API-Calls=${STATS.apiCalls}  Cache-Hits=${STATS.cacheHits}` +
    `  Rate-Limit-Events=${STATS.rateLimitEvents}  Retries=${STATS.retries}`);

  // Ein kompletter Netzausfall sah bisher aus wie "kein freies Bild gefunden":
  // apiGet gibt nach sechs Versuchen null zurueck, jedes Konzept bekommt
  // _imgProblem, und der Lauf endet mit Exit 0. Findet der Resolver bei
  // mindestens zehn Anfragen NICHTS, ist das ein Fehlschlag, kein Ergebnis
  // (CodeQA 2026-09-03).
  if (G.total >= 10 && G.resolved === 0) {
    console.error('\nKein einziges Bild aufgeloest — vermutlich API- oder Netzproblem.');
    process.exitCode = 1;
  }
})();
