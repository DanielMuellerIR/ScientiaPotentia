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

const https = require("https");
const fs = require("fs");
const path = require("path");
const { writeJsonAtomic } = require('./json_io.cjs');
const {
  isAllowedCommonsLicenseMetadata,
  licenseNameFromCommonsMetadata,
} = require('../../lib/image_license_policy.js');

const RAWFILE = path.join(__dirname, "../cultura_raw.json");
const OUT = "/tmp/cultura_author_portraits.json";
const UA = "ScientiaAuthorPortraitResolver/1.0 (educational quiz; pageimages+imageinfo only)";
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/svg+xml', 'image/gif', 'image/webp',
]);

const sleep = ms => new Promise(r => setTimeout(r, ms));
function rawGet(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { "User-Agent": UA } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return rawGet(r.headers.location).then(res, rej); }
      let d = ""; r.on("data", c => d += c); r.on("end", () => res({ status: r.statusCode, body: d, headers: r.headers }));
    }).on("error", rej);
  });
}
async function get(url) {
  for (let i = 0; i < 5; i++) {
    const r = await rawGet(url);
    if (r.status !== 429) return r;
    await sleep(Math.min(60, 5 * 2 ** i) * 1000);
  }
  return rawGet(url);
}
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

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
      if (src) fileForAuthor.set(a, decodeURIComponent(src.split("/").pop()));
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
      const m = ii.extmetadata || {};
      const lic = licenseNameFromCommonsMetadata(m);
      const art = (m.Artist?.value || m.Credit?.value || "")
        .replace(/<[^>]+>/g, "").replace(/\s+/g, ' ').trim().slice(0, 200);
      const ok = ALLOWED_MIME.has(ii.mime || '')
        && isAllowedCommonsLicenseMetadata(m) && Boolean(art);
      licByFile.set(fTitle, { ok, lic, art });
    }
    await sleep(150);
  }

  // --- Mapping bauen: je Konzept das Autorenporträt (nur freie) ---
  const out = [];
  for (const [author, ids] of authorToIds) {
    const f = fileForAuthor.get(author); if (!f) continue;
    const lic = licByFile.get("File:" + f); if (!lic || !lic.ok) continue;
    for (const id of ids) {
      out.push({ id, imageFile: `https://commons.wikimedia.org/wiki/File%3A${encodeURIComponent(f)}`, imageLicense: lic.lic, imageAttribution: lic.art });
    }
  }
  writeJsonAtomic(OUT, out);
  console.log(`FERTIG: ${out.length} Konzept-Bilder (${new Set(out.map(o => o.imageFile)).size} distinkte Porträts) → ${OUT}`);
}

main().catch((error) => {
  console.error(`FEHLER: ${error.message}`);
  process.exitCode = 1;
});
