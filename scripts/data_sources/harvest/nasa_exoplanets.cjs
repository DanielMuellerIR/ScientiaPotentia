// Strukturierter Exoplaneten-Harvester für Astra — NASA Exoplanet Archive (TAP-API).
//
// Warum so: Es gibt >5000 bestätigte Exoplaneten, die allermeisten obskur. Naives
// Abgreifen brächte Müll (Notabilitäts-Falle, vgl. Cultura-wd1). Daher KURATIERTE
// Liste berühmter/Meilenstein-Planeten (Notabilität) + EXAKTE Zahlen aus dem NASA
// Exoplanet Archive (Distanz, Entdeckungsjahr) — analog zum Met×Wikidata-Muster.
// Token-frei, deterministisch, autoritativ.
//
// Generator-Bezug: generate_astra.js verarbeitet exoplanet über distanceLy + discoveredYear.
// Ausgabe: exoplanets_nasa.json (NICHT mergen ohne Review).
// Aufruf: node nasa_exoplanets.cjs

'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');
const { writeJsonAtomic } = require('./json_io.cjs');

const TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
const PC_TO_LY = 3.26156;             // 1 Parsec in Lichtjahren
const UA = { 'User-Agent': 'ScientiaQuizExoHarvest/1.0 (public educational project)' };

// Kuratierte Notabilitäts-Liste: NASA-pl_name -> { de: Anzeigename, fame: dt. Pointe }.
// "fame" wird zum funFact (warum berühmt) und ist die Notabilitäts-Begründung.
// Bereits vorhanden (NICHT erneut): Proxima Centauri b, TRAPPIST-1-System,
// Kepler-452 b, 51 Peg b.
const CURATED = {
  'HD 209458 b':  { de: 'HD 209458 b (Osiris)', fame: 'Erster Exoplanet, bei dem ein Transit vor seinem Stern beobachtet wurde, und der erste mit nachgewiesener Atmosphäre.' },
  'Kepler-22 b':  { de: 'Kepler-22 b', fame: 'Erster von Kepler bestätigter Planet in der habitablen Zone eines sonnenähnlichen Sterns.' },
  'Kepler-186 f': { de: 'Kepler-186 f', fame: 'Erster erdgroßer Planet, der in der habitablen Zone seines Sterns entdeckt wurde.' },
  'Kepler-16 b':  { de: 'Kepler-16 b (Tatooine)', fame: 'Erster eindeutig bestätigter zirkumbinärer Planet — er umkreist gleich zwei Sterne wie der Filmplanet Tatooine.' },
  '55 Cnc e':     { de: '55 Cancri e (Janssen)', fame: 'Glühend heiße Supererde, deren kohlenstoffreiche Zusammensetzung ihr den Beinamen „Diamantplanet" einbrachte.' },
  'HD 189733 b':  { de: 'HD 189733 b', fame: 'Tiefblauer Gasriese, auf dem es seitwärts aus Glaspartikeln regnen dürfte.' },
  'PSR B1257+12 c': { de: 'PSR B1257+12 c (Poltergeist)', fame: 'Gehört zu den allerersten bestätigten Exoplaneten überhaupt (1992) — und umkreist einen Pulsar.' },
  'WASP-12 b':    { de: 'WASP-12 b', fame: 'Extrem heißer Jupiter, der von seinem Stern langsam zerrissen und verschluckt wird.' },
  'K2-18 b':      { de: 'K2-18 b', fame: 'Planet in der habitablen Zone, in dessen Atmosphäre Wasserdampf nachgewiesen wurde.' },
  'HR 8799 b':    { de: 'HR 8799 b', fame: 'Teil des ersten Planetensystems, das direkt fotografiert werden konnte.' },
  'bet Pic b':    { de: 'Beta Pictoris b', fame: 'Junger, direkt abgebildeter Gasriese in einer noch aktiven Staubscheibe.' },
  'GJ 1214 b':    { de: 'GJ 1214 b', fame: 'Prototyp der „Wasserwelten"/Mini-Neptune — eine der am besten untersuchten Supererden.' },
  'LHS 1140 b':   { de: 'LHS 1140 b', fame: 'Felsige Supererde in der habitablen Zone eines nahen Roten Zwergs, ideal für Atmosphären-Studien.' },
  'TOI-700 d':    { de: 'TOI-700 d', fame: 'Erster erdgroßer Planet in der habitablen Zone, den das Weltraumteleskop TESS fand.' },
  'Ross 128 b':   { de: 'Ross 128 b', fame: 'Einer der nächstgelegenen gemäßigten erdgroßen Exoplaneten.' },
  'Kepler-90 i':  { de: 'Kepler-90 i', fame: 'Seine Entdeckung machte Kepler-90 zum ersten bekannten System mit acht Planeten — wie unser Sonnensystem.' },
  'Kepler-442 b': { de: 'Kepler-442 b', fame: 'Gilt als einer der erdähnlichsten bekannten Planeten in der habitablen Zone.' },
  'GJ 357 d':     { de: 'GJ 357 d', fame: 'Supererde am Rand der habitablen Zone eines nahen Sterns, „Super-Erde vor unserer Haustür" genannt.' },
  'WASP-121 b':   { de: 'WASP-121 b', fame: 'Ultraheißer Jupiter, in dessen glühender Atmosphäre verdampftes Metall nachgewiesen wurde.' },
  'TrES-2 b':     { de: 'TrES-2 b (Kepler-1 b)', fame: 'Gilt als einer der dunkelsten bekannten Planeten — er reflektiert weniger als 1 % des Sternenlichts.' },
  'GJ 581 c':     { de: 'Gliese 581 c', fame: 'Früh als möglicher habitabler Kandidat diskutierte Supererde, die große Aufmerksamkeit erregte.' },
  'Kepler-62 f':  { de: 'Kepler-62 f', fame: 'Supererde in der habitablen Zone, möglicher Kandidat für eine Wasserwelt.' },
  'WASP-39 b':    { de: 'WASP-39 b', fame: 'Erster Exoplanet, bei dem das James-Webb-Teleskop Kohlendioxid in der Atmosphäre nachwies.' }
};

function tapQuery(names) {
  const inList = names.map(n => "'" + n.replace(/'/g, "''") + "'").join(',');
  const sql = `select pl_name,hostname,disc_year,sy_dist,pl_orbper,discoverymethod,pl_rade,pl_bmasse from pscomppars where pl_name in (${inList})`;
  const url = TAP + '?request=doQuery&lang=ADQL&format=json&query=' + encodeURIComponent(sql);
  return new Promise((resolve, reject) => {
    https.get(url, { headers: UA }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('Parse: ' + d.slice(0, 200))); } });
    }).on('error', reject);
  });
}

function slug(s) {
  return s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[()]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
const round = (n, d) => { const f = 10 ** d; return Math.round(n * f) / f; };

(async () => {
  const rows = await tapQuery(Object.keys(CURATED));
  const found = new Map(rows.map(r => [r.pl_name, r]));
  const missing = Object.keys(CURATED).filter(n => !found.has(n));
  const out = [];
  for (const [nasaName, meta] of Object.entries(CURATED)) {
    const r = found.get(nasaName);
    if (!r) continue;
    if (r.sy_dist == null || r.disc_year == null) { console.warn(`  ! ${nasaName}: Distanz/Jahr fehlt im Archiv -> übersprungen`); continue; }
    const distanceLy = round(r.sy_dist * PC_TO_LY, 1);
    const attributes = {
      distanceLy,
      discoveredYear: r.disc_year,
      hostStar: r.hostname,
      discoveryMethod: r.discoverymethod || undefined,
      orbitalPeriodDays: r.pl_orbper != null ? round(r.pl_orbper, 2) : undefined,
      radiusEarthRadii: r.pl_rade != null ? round(r.pl_rade, 2) : undefined,
      massEarthMasses: r.pl_bmasse != null ? round(r.pl_bmasse, 2) : undefined
    };
    Object.keys(attributes).forEach(k => attributes[k] === undefined && delete attributes[k]);
    out.push({
      id: slug(meta.de),
      name: meta.de,
      category: 'exoplanet',
      attributes,
      funFact: meta.fame,
      sourceName: 'NASA Exoplanet Archive',
      sourceUrl: 'https://exoplanetarchive.ipac.caltech.edu/overview/' + encodeURIComponent(nasaName),
      verifyNote: `NASA Exoplanet Archive (pscomppars): disc_year=${r.disc_year}, sy_dist=${round(r.sy_dist, 2)} pc → ${distanceLy} Lj.`
    });
  }
  const outPath = path.join(__dirname, 'exoplanets_nasa.json');
  writeJsonAtomic(outPath, out);
  console.log(`Kuratiert: ${Object.keys(CURATED).length}, im Archiv gefunden: ${found.size}, geschrieben: ${out.length}`);
  if (missing.length) console.log('  Nicht im Archiv (Name-Mismatch prüfen): ' + missing.join(', '));
  console.log('=> ' + outPath);
})().catch(e => { console.error('FEHLER:', e.message); process.exit(1); });
