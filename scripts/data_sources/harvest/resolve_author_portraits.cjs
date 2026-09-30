// Autorenporträt-Resolver für Cultura `genre_fiction` (Stand 2026-07-09).
// Projektentscheidung: genre_fiction wird im Museum NICHT über (unfreie)
// Buchcover bebildert, sondern über FREIE AUTORENPORTRÄTS. Der reguläre
// resolve_images_batched.cjs löst je Konzept das Werk-Artikelbild auf (= Cover) und ist
// hier deshalb falsch. Dieses Skript löst stattdessen das de.wikipedia-Hauptbild des
// AUTORS auf und weist es allen Werken dieses Autors zu (Autoren werden dedupliziert,
// dieselbe Person nur einmal abgefragt).
//
// Aufruf:  node resolve_author_portraits.cjs
// Ausgabe: /tmp/cultura_author_portraits.json  (Array {id, imageFile, imageLicense, imageAttribution})
// Danach:  apply_images.cjs (mit angepasstem Mapping-Pfad) bzw. direkt mergen, check_images validieren.

const fs = require("fs");
const path = require("path");
const { writeJsonAtomic } = require('./json_io.cjs');
const { createApiGuard } = require("./api_guard.cjs");
const { commonsAttribution } = require('./credit_text.cjs');
const { fetchWithRetry, sleep } = require('../../lib/commons_api.cjs');
const {
  isAllowedCommonsLicenseMetadata,
  licenseNameFromCommonsMetadata,
} = require('../../lib/image_license_policy.js');
const {
  fileNameFromUploadUrl, isBlacklistedFile, isBlacklistedConcept, isSuitableImageMotif,
} = require('./image_resolution_policy.cjs');

const RAWFILE = path.join(__dirname, "../cultura_raw.json");
const OUT = "/tmp/cultura_author_portraits.json";
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/svg+xml', 'image/gif', 'image/webp',
]);

// Bricht ab, sobald die Gegenstelle dauerhaft abweist, statt den Lauf leere
// Ergebnisse schreiben zu lassen.
const apiGuard = createApiGuard({ label: "Die Wikipedia-API" });
async function getRaw(url, options) {
  // Der gemeinsame Client begrenzt Weiterleitungen und wiederholt 429, 5xx,
  // Netzabbrüche sowie Zeitüberschreitungen mit Backoff.
  const response = await fetchWithRetry(url, { attempts: 5, ...options });
  return {
    status: response.status,
    body: await response.text(),
    headers: Object.fromEntries(response.headers),
  };
}

/**
 * Dieselbe Anfrage unter Aufsicht: Bleibt die Antwort nach allen Versuchen bei
 * 429 oder einem Serverfehler, ist das eine Abweisung und kein Ergebnis. Ohne
 * diese Zaehlung liefe der Auflöser weiter und schriebe zu jedem Konzept
 * "kein freies Bild" (siehe api_guard.cjs). Ein Netzfehler wirft ohnehin.
 */
async function get(url) {
  const antwort = await getRaw(url);
  if (!antwort || antwort.status === 429 || antwort.status >= 500) {
    apiGuard.rejected(`HTTP ${antwort ? antwort.status : "?"} bei ${url}`);
  } else {
    apiGuard.ok();
  }
  return antwort;
}
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

function portraitLicenseEntry(imageInfo) {
  const metadata = imageInfo?.extmetadata || {};
  const license = licenseNameFromCommonsMetadata(metadata);
  const attribution = commonsAttribution(metadata);
  const ok = ALLOWED_MIME.has(imageInfo?.mime || '')
    && isAllowedCommonsLicenseMetadata(metadata) && Boolean(attribution);
  return { ok, lic: license, art: attribution };
}

async function getJson(url) {
  const response = await get(url);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`API antwortet mit HTTP ${response.status}`);
  }
  try {
    const payload = JSON.parse(response.body);
    if (payload?.error) {
      throw new Error(`API-Fehler ${payload.error.code || 'unbekannt'}`);
    }
    return payload;
  } catch (error) {
    if (error.message.startsWith('API-Fehler')) throw error;
    throw new Error('API-Antwort ist kein gültiges JSON');
  }
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(RAWFILE, "utf8"));
  // genre_fiction ohne Bild, mit Autor. Autor -> zugehörige Konzept-IDs.
  const authorToIds = new Map();
  for (const c of raw) {
    if (c.category !== "genre_fiction" || c.imageFile) continue;
    const a = c.attributes && c.attributes.author;
    if (!a) continue; // z.B. Perry Rhodan (Autorenkollektiv) -> kein Porträt
    if (!authorToIds.has(a)) authorToIds.set(a, []);
    authorToIds.get(a).push(c.id);
  }
  const authors = [...authorToIds.keys()];
  console.log(`genre_fiction ohne Bild: ${[...authorToIds.values()].reduce((n, v) => n + v.length, 0)} Konzepte, ${authors.length} distinkte Autoren`);

  // --- pageimages (de.wikipedia) gebündelt: Autorname -> Hauptbild-Datei ---
  const fileForAuthor = new Map();
  for (const grp of chunk(authors, 45)) {
    const url = `https://de.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=original&redirects=1&format=json&titles=${grp.map(encodeURIComponent).join("|")}`;
    const j = await getJson(url); const q = j?.query || {};
    const norm = {}; (q.normalized || []).forEach(n => norm[n.from] = n.to);
    const redir = {}; (q.redirects || []).forEach(r => redir[r.from] = r.to);
    const pageByTitle = {}; Object.values(q.pages || {}).forEach(p => { if (p.title) pageByTitle[p.title] = p; });
    for (const a of grp) {
      const pt = redir[norm[a] || a] || norm[a] || a;
      const src = pageByTitle[pt]?.original?.source;
      const fileName = fileNameFromUploadUrl(src);
      if (fileName) fileForAuthor.set(a, fileName);
    }
    await sleep(150);
  }
  console.log(`  pageimages: ${fileForAuthor.size}/${authors.length} Autoren mit Hauptbild`);

  // --- Commons imageinfo gebündelt: Lizenz/Attribution nach gemeinsamer Positivliste ---
  const files = [...new Set([...fileForAuthor.values()])].map(f => "File:" + f);
  const licByFile = new Map();
  for (const grp of chunk(files, 45)) {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata|url|mime&format=json&titles=${grp.map(encodeURIComponent).join("|")}`;
    const j = await getJson(url); const q = j?.query || {};
    const norm = {}; (q.normalized || []).forEach(n => norm[n.from] = n.to);
    const pageByTitle = {}; Object.values(q.pages || {}).forEach(p => { if (p.title) pageByTitle[p.title] = p; });
    for (const fTitle of grp) {
      const ii = pageByTitle[norm[fTitle] || fTitle]?.imageinfo?.[0]; if (!ii) continue;
      const entry = portraitLicenseEntry(ii);
      entry.ok &&= isSuitableImageMotif(
        fTitle, ii.extmetadata, { category: 'author' }, 'cultura');
      licByFile.set(fTitle, entry);
    }
    await sleep(150);
  }

  // --- Mapping bauen: je Konzept das Autorenporträt (nur freie) ---
  const out = [];
  for (const [author, ids] of authorToIds) {
    const f = fileForAuthor.get(author); if (!f) continue;
    const lic = licByFile.get("File:" + f); if (!lic || !lic.ok) continue;
    // Sperrliste: gesperrtes Konzept oder gesperrte Datei nie zuweisen. Diese
    // Datei pruefte sie bisher gar nicht (CodeQA 2026-09-03); der Kopfkommentar
    // nennt "direkt mergen" als Weg an apply_images.cjs vorbei.
    if (isBlacklistedFile(f)) continue;
    for (const id of ids) {
      if (isBlacklistedConcept(id)) continue;
      out.push({ id, imageFile: `https://commons.wikimedia.org/wiki/File%3A${encodeURIComponent(f)}`, imageLicense: lic.lic, imageAttribution: lic.art });
    }
  }
  writeJsonAtomic(OUT, out);
  console.log(`FERTIG: ${out.length} Konzept-Bilder (${new Set(out.map(o => o.imageFile)).size} distinkte Porträts) → ${OUT}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`FEHLER: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { fileNameFromUploadUrl, getRaw, portraitLicenseEntry };
