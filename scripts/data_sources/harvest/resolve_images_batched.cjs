// Gebündelter Bild-Resolver (Phase D) — Hauptbild via Wikidata-P18 / de.wikipedia pageimages.
// KEINE Freitextsuche. Im Gegensatz zu den per-Konzept-Resolvern bündelt dieses Skript die
// API-Aufrufe (bis 50 Einheiten pro Request) → ~Dutzend Requests statt einer pro Konzept,
// damit KEIN Wikimedia-Rate-Limit (429) auftritt. Schreibt das Ergebnis-Mapping inkrementell.
//
// Aufruf:  node resolve_images_batched.cjs <domain> [animalCap] [animalOffset]
//   <domain>   = astra | natura | cultura | lingua | historia | homo | machina
//   [animalCap]= optionales Limit für natura-Kategorie "animal" (Default: alle)
//   [animalOffset] = Startindex für ein begrenztes Natura-Tierfenster (Default: 0)
// Ausgabe:  /tmp/<domain>_images_batched.json  (Array {id, imageFile, imageLicense, imageAttribution})

const https = require("https");
const fs = require("fs");
const path = require("path");

const DOMAIN = process.argv[2];
const ANIMAL_CAP = process.argv[3] ? parseInt(process.argv[3], 10) : Infinity;
const ANIMAL_OFFSET = process.argv[4] ? parseInt(process.argv[4], 10) : 0;
if (!DOMAIN) { console.error("Aufruf: node resolve_images_batched.cjs <domain> [animalCap] [animalOffset]"); process.exit(1); }
if ((ANIMAL_CAP !== Infinity && (!Number.isInteger(ANIMAL_CAP) || ANIMAL_CAP < 1)) ||
    !Number.isInteger(ANIMAL_OFFSET) || ANIMAL_OFFSET < 0) {
  console.error("animalCap muss positiv und animalOffset eine nichtnegative ganze Zahl sein.");
  process.exit(1);
}

const RAWFILE = path.join(__dirname, `../${DOMAIN}_raw.json`);
const OUT = `/tmp/${DOMAIN}_images_batched.json`;
const UA = "ScientiaQuizImageResolverBatched/1.0 (educational quiz; pageimages+P18 only, batched)";

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

const sleep = ms => new Promise(r => setTimeout(r, ms));
function rawGet(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { "User-Agent": UA } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return rawGet(r.headers.location).then(res, rej); }
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
const J = s => { try { return JSON.parse(s); } catch { return null; } };
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const qidOf = u => (String(u).match(/Q\d+/) || [])[0];
const deTitle = u => { const m = String(u).match(/de\.wikipedia\.org\/wiki\/([^?#]+)/); return m ? decodeURIComponent(m[1]).replace(/_/g, " ") : null; };
// Die Pageimages-API ergänzt derzeit utm-Parameter an Commons-Upload-URLs. Nur der
// Pfadname ist ein Commons-Dateititel; Query und Fragment dürfen nicht mit in die
// anschließende imageinfo-Abfrage gelangen.
const fileNameFromUploadUrl = source => {
  try {
    const fileName = new URL(source).pathname.split("/").pop();
    return fileName ? decodeURIComponent(fileName) : null;
  } catch {
    return null;
  }
};
// Gleiche konservative Freigabe wie scripts/check_images.cjs: Der Resolver darf
// weder Video-Dateien noch Lizenztypen liefern, die das nachgelagerte Gate wieder
// entfernen müsste.
const isFree = meta => {
  const lic = (meta?.LicenseShortName?.value || "").toString();
  const licUrl = (meta?.LicenseUrl?.value || "").toString();
  const copyrighted = (meta?.Copyrighted?.value || "").toString();
  const blob = (lic + " " + licUrl).toLowerCase();
  if (/\b(nc|nd|non[- ]?commercial|noncommercial|no[- ]?deriv|all rights)\b/.test(blob)) return false;
  if (/public domain|^pd|cc0|creativecommons\.org\/publicdomain/.test(blob)) return true;
  if (/cc[- ]by|creativecommons\.org\/licenses\/by/.test(blob)) return true;
  if (/\bfal\b|free art|gfdl/.test(blob)) return true;
  if (/copyrighted free use|free use/.test(blob) || /^attribution\b/.test(lic.toLowerCase().trim())) return true;
  return copyrighted.toLowerCase() === "false";
};

(async () => {
  const raw = JSON.parse(fs.readFileSync(RAWFILE, "utf8"));
  const cats = TARGETS[DOMAIN];
  let pool = raw.filter(c => cats.has(c.category) && !c.imageFile);
  if (DOMAIN === "natura" && (ANIMAL_CAP !== Infinity || ANIMAL_OFFSET > 0)) {
    const animals = pool.filter(c => c.category === "animal").slice(ANIMAL_OFFSET, ANIMAL_OFFSET + ANIMAL_CAP);
    pool = pool.filter(c => c.category !== "animal").concat(animals);
  }
  const animalWindow = DOMAIN === "natura" && (ANIMAL_CAP !== Infinity || ANIMAL_OFFSET > 0)
    ? ` (Tierfenster ab ${ANIMAL_OFFSET + 1})` : "";
  console.log(`${DOMAIN}: ${pool.length} bildlose Konzepte in Zielkategorien${animalWindow}`);

  // Schritt 1: QID-Konzepte sammeln (sourceUrl mit Q…) und Rest über de.wiki-Titel
  const byQid = new Map();   // QID -> concept
  const byTitle = new Map(); // de.wiki-Titel -> concept
  for (const c of pool) {
    const qid = qidOf(c.sourceUrl);
    if (qid) byQid.set(qid, c);
    else { const t = deTitle(c.sourceUrl) || c.name; byTitle.set(t, c); }
  }

  // id -> bare Commons-Dateiname (ohne "File:")
  const fileForId = new Map();

  // --- Schritt 2: Wikidata P18 gebündelt (50 QIDs/Request) ---
  const qids = [...byQid.keys()];
  for (const grp of chunk(qids, 50)) {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${grp.join("|")}&props=claims&format=json`;
    const j = J((await get(url)).body);
    const ents = j?.entities || {};
    for (const qid of grp) {
      const f = ents[qid]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (f) fileForId.set(byQid.get(qid).id, f);
    }
    await sleep(120);
  }
  console.log(`  Wikidata P18: ${fileForId.size}/${qids.length} QIDs mit Bild`);

  // --- Schritt 3: de.wikipedia pageimages gebündelt (50 Titel/Request) für QID-lose + QIDs ohne P18 ---
  // QIDs ohne P18 nachträglich per de.wiki-Titel versuchen (Titel = concept.name)
  for (const [qid, c] of byQid) if (!fileForId.has(c.id)) byTitle.set(deTitle(c.sourceUrl) || c.name, c);
  const titles = [...byTitle.keys()];
  for (const grp of chunk(titles, 50)) {
    const url = `https://de.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=original&redirects=1&format=json&titles=${grp.map(encodeURIComponent).join("|")}`;
    const j = J((await get(url)).body);
    const q = j?.query || {};
    // Titel-Auflösung: erst Normalisierung (Leerzeichen/Unterstrich), dann Redirect
    // (redirects=1) -> finaler Seitentitel. Ohne die redirect-Kette griffe redirects=1 nicht.
    const norm = {}; (q.normalized || []).forEach(n => norm[n.from] = n.to);
    const redir = {}; (q.redirects || []).forEach(r => redir[r.from] = r.to);
    const pageByTitle = {}; Object.values(q.pages || {}).forEach(p => { if (p.title) pageByTitle[p.title] = p; });
    for (const t of grp) {
      const c = byTitle.get(t);
      const normTitle = norm[t] || t;
      const pageTitle = redir[normTitle] || normTitle;
      const src = pageByTitle[pageTitle]?.original?.source;
      const fileName = src && fileNameFromUploadUrl(src);
      if (fileName) fileForId.set(c.id, fileName);
    }
    await sleep(120);
  }
  console.log(`  Nach pageimages: ${fileForId.size} Konzepte mit Bilddatei`);

  // --- Schritt 4: Lizenz + Attribution gebündelt via Commons imageinfo (50 Dateien/Request) ---
  const entries = [...fileForId.entries()]; // [id, filename]
  const files = entries.map(([, f]) => "File:" + f);
  const licByFile = new Map();
  for (const grp of chunk(files, 50)) {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata|url|mime&format=json&titles=${grp.map(encodeURIComponent).join("|")}`;
    const j = J((await get(url)).body);
    const q = j?.query || {};
    const norm = {}; (q.normalized || []).forEach(n => norm[n.from] = n.to);
    const pageByTitle = {}; Object.values(q.pages || {}).forEach(p => { if (p.title) pageByTitle[p.title] = p; });
    for (const fTitle of grp) {
      const pt = norm[fTitle] || fTitle;
      const ii = pageByTitle[pt]?.imageinfo?.[0];
      if (!ii) continue;
      const m = ii.extmetadata || {};
      const lic = (m.LicenseShortName?.value || m.License?.value || "").toString();
      const ok = String(ii.mime || "").startsWith("image/") && isFree(m);
      licByFile.set(fTitle, { ok, lic: lic || "Public domain", art: (m.Artist?.value || "").replace(/<[^>]+>/g, "").trim().slice(0, 200) });
    }
    await sleep(120);
  }

  // --- Schritt 5: Mapping bauen (nur freie/vorhandene Bilder) ---
  const out = [];
  for (const [id, f] of entries) {
    const lic = licByFile.get("File:" + f);
    if (!lic || !lic.ok) continue;
    out.push({ id, imageFile: `https://commons.wikimedia.org/wiki/File%3A${encodeURIComponent(f)}`, imageLicense: lic.lic, imageAttribution: lic.art });
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`FERTIG: ${out.length}/${pool.length} Bilder → ${OUT}`);
})();
