// Exoplaneten-Harvester Welle 3 — NASA Exoplanet Archive (TAP-API).
//
// Gleiche Mechanik wie nasa_exoplanets.cjs (kuratierte Liste + NASA-Fakten).
// Diese Welle ergänzt Planeten, die noch NICHT in astra_raw.json stehen.
//
// Ausschluss-Bestand (Stand 2026-06-17, 47 Konzepte):
//   Proxima Centauri b, TRAPPIST-1-System/-e/-f, Kepler-452b, 51 Peg b,
//   HD 209458 b, Kepler-22 b, Kepler-186 f, Kepler-16 b, 55 Cnc e,
//   HD 189733 b, PSR B1257+12 b/c, WASP-12 b, K2-18 b, HR 8799 b/c/d,
//   Beta Pictoris b, GJ 1214 b, LHS 1140 b, TOI-700 d/e, Ross 128 b,
//   Kepler-90 i, Kepler-442 b, GJ 357 d, WASP-121 b, TrES-2 b,
//   Gliese 581 c, Kepler-62 f, WASP-39 b, 70 Vir b, 47 UMa b,
//   WASP-17 b, HAT-P-7 b, Kepler-11 b, Kepler-69 c, Kepler-444 b,
//   Kepler-10 b/c, GJ 486 b, LHS 3844 b, Kepler-36 b,
//   HD 149026 b, GJ 667 C c
//
// Aufruf: node nasa_exoplanets_w3.cjs
// Ausgabe: exoplanets_nasa_w3.json (Produce-only; NICHT in astra_raw.json schreiben)

'use strict';
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const TAP      = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
const PC_TO_LY = 3.26156; // 1 Parsec → Lichtjahre
const UA       = { 'User-Agent': 'ScientiaQuizExoHarvestW3/1.0 (public educational project)' };

// ---------------------------------------------------------------------------
// Kuratierte Welle-3-Planeten — berühmt / Meilenstein / Rekordhalter.
// Kriterien: (a) deutliche öffentliche Bekanntheit ODER (b) wissenschaftlicher
// Meilenstein (erster Transit, erste Atmosphärenmessung, Direktbild, Rekordwert).
// Umstrittene Objekte (Fomalhaut b, Alpha Cen Bb) sind bewusst ausgelassen.
// NASA-pl_name muss EXAKT stimmen (Groß-/Kleinschreibung, Bindestriche).
// ---------------------------------------------------------------------------
const CURATED = {
  // --- TRAPPIST-1: fehlende Mitglieder (b/c/d/g/h) -------------------------
  // TRAPPIST-1 e + f bereits im Bestand; a-b-c-d-g-h fehlen noch.
  // b/c/d sind erdgroß und intensiv untersucht; g/h am Außenrand.
  'TRAPPIST-1 b': {
    de: 'TRAPPIST-1 b',
    fame: 'Innerster Planet des TRAPPIST-1-Systems — extrem heiß, aber erdgroß und einer der meistuntersuchten Exoplaneten.'
  },
  'TRAPPIST-1 c': {
    de: 'TRAPPIST-1 c',
    fame: 'TRAPPIST-1 c ist einer der erdähnlichsten Planeten bekannt: fast identische Größe und Dichte wie die Erde, mit JWST Atmosphären-Kandidat.'
  },
  'TRAPPIST-1 d': {
    de: 'TRAPPIST-1 d',
    fame: 'Leichtester der TRAPPIST-1-Planeten — liegt am inneren Rand der habitablen Zone und ist ein intensiver Forschungskandidat.'
  },
  'TRAPPIST-1 g': {
    de: 'TRAPPIST-1 g',
    fame: 'Sechster Planet des TRAPPIST-1-Systems — am Außenrand der habitablen Zone, größer als die Erde.'
  },
  'TRAPPIST-1 h': {
    de: 'TRAPPIST-1 h',
    fame: 'Äußerster bekannter Planet des TRAPPIST-1-Systems — wahrscheinlich zu kalt für flüssiges Wasser, aber wichtig für Systemmodelle.'
  },

  // --- Weitere Direktbildplaneten -------------------------------------------
  'HR 8799 e': {
    de: 'HR 8799 e',
    fame: 'Vierter direkt fotografierter Planet im HR-8799-System — ermöglichte die erste vollständige Bahn-Animation eines Exoplanetensystems.'
  },
  'beta Pic c': {
    de: 'Beta Pictoris c',
    fame: 'Zweiter direkt nachgewiesener Planet im Beta-Pictoris-System — Entdeckung 2019 durch Radialgeschwindigkeit, Bestätigung durch Direktbild.'
  },

  // --- Rekordhalter / Extreme -----------------------------------------------
  'KELT-9 b': {
    de: 'KELT-9 b',
    fame: 'Mit über 4000 K ist KELT-9 b der heißeste bekannte Exoplanet — heißer als viele Sterne.'
  },
  'HAT-P-32 b': {
    de: 'HAT-P-32 b',
    fame: 'Aufgeblähter Heißer Jupiter mit einem der größten bekannten Radien — ein Lehrbeispiel für tidally-locked Gasriesen.'
  },
  'GJ 3470 b': {
    de: 'GJ 3470 b',
    fame: 'Mini-Neptun, der sehr schnell seine Atmosphäre verliert — ein Schlüsselobjekt zum Verständnis des Radius-Tals.'
  },
  'GJ 436 b': {
    de: 'GJ 436 b (Maïa)',
    fame: 'Erster bekannter Neptun-großer Exoplanet — umkreist einen Roten Zwerg und hüllt sich in einen gewaltigen Wasserstoff-Schweif.'
  },
  'WASP-76 b': {
    de: 'WASP-76 b',
    fame: 'Ultraheißer Jupiter, auf dem es buchstäblich Eisen regnet — eines der spektakulärsten atmosphärischen Phänomene bekannter Exoplaneten.'
  },
  'WASP-107 b': {
    de: 'WASP-107 b',
    fame: 'Extrem aufgeblähter Gasriese mit der geringsten Dichte bekannter Planeten — JWST wies Wassereis in seiner Atmosphäre nach.'
  },

  // --- Habitable-Zone-Kandidaten / Erdähnliche ------------------------------
  'Kepler-62 e': {
    de: 'Kepler-62 e',
    fame: 'Supererde im inneren Rand der habitablen Zone von Kepler-62 — enger Kandidat für eine mögliche Wasserwelt.'
  },
  'Kepler-438 b': {
    de: 'Kepler-438 b',
    fame: 'Galt lange als einer der erdähnlichsten bekannten Exoplaneten — extrem hoher Erdähnlichkeitsindex (ESI > 0,88).'
  },
  'Kepler-1229 b': {
    de: 'Kepler-1229 b',
    fame: 'Supererde in der habitablen Zone eines Roten Zwergs — einer der aussichtsreichsten kleinen Kandidaten im Kepler-Datensatz.'
  },
  'Kepler-296 e': {
    de: 'Kepler-296 e',
    fame: 'Supererde in der habitablen Zone eines Roten Zwergs in einem Doppelsternsystem — bemerkenswert für Bewohnbarkeits-Studien.'
  },
  'TOI-1452 b': {
    de: 'TOI-1452 b',
    fame: 'Supererde, bei der Messungen mit einem Wasser-dominierten Inneren übereinstimmen — mögliche „Ozeanwelt" in Erdnähe.'
  },

  // --- Historische Meilensteine / Erstentdeckungen --------------------------
  'PSR B1257+12 d': {
    de: 'PSR B1257+12 d (Phobetor)',
    fame: 'Dritter Planet des ersten bestätigten Exoplanetensystems (1994) — umkreist gemeinsam mit Draugr und Poltergeist einen Millisekunden-Pulsar.'
  },
  '51 Eri b': {
    de: '51 Eridani b',
    fame: 'Erster Exoplanet, der mit dem neuen GPI-Instrument direkt fotografiert wurde — Methan-Nachweis aus der Atmosphäre.'
  },
  'HD 40307 g': {
    de: 'HD 40307 g',
    fame: 'Supererde in der habitablen Zone von HD 40307 — ein näherer Kandidat für erdbewohnbare Bedingungen bei einem bekannten Mehrfachsystem.'
  },
  'pi Men c': {
    de: 'Pi Mensae c',
    fame: 'Erster von TESS entdeckter Exoplanet mit bestätigtem Transit in einem bekannten Mehrfachsystem — Grundstein für TESS-Wissenschaft.'
  },
  'Kepler-1649 c': {
    de: 'Kepler-1649 c',
    fame: 'Erdgroßer Planet in der habitablen Zone eines Roten Zwergs — 2020 aus den Kepler-Archivdaten durch maschinelles Lernen (Google AI) entdeckt.'
  },
  'TOI-700 b': {
    de: 'TOI-700 b',
    fame: 'Innerster Planet des TOI-700-Systems — erstes System, in dem TESS mehrere bestätigte Planeten in oder nahe der habitablen Zone fand.'
  }
};

// ---------------------------------------------------------------------------
// Hilfsfunktionen (identisch zu nasa_exoplanets.cjs)
// ---------------------------------------------------------------------------

function tapQuery(names) {
  const inList = names.map(n => "'" + n.replace(/'/g, "''") + "'").join(',');
  const sql = `select pl_name,hostname,disc_year,sy_dist,pl_orbper,discoverymethod,pl_rade,pl_bmasse from pscomppars where pl_name in (${inList})`;
  const url = TAP + '?request=doQuery&lang=ADQL&format=json&query=' + encodeURIComponent(sql);
  return new Promise((resolve, reject) => {
    https.get(url, { headers: UA }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(new Error('NASA-API Parse-Fehler: ' + d.slice(0, 300))); }
      });
    }).on('error', reject);
  });
}

// kebab-slug aus deutschem Anzeigenamen
function slug(s) {
  return s.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[()]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const round = (n, d) => { const f = 10 ** d; return Math.round(n * f) / f; };

// ---------------------------------------------------------------------------
// Dedup gegen bestehende astra_raw.json
// ---------------------------------------------------------------------------

const RAW_PATH = path.join(__dirname, '..', 'astra_raw.json');
const rawData  = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
const existingIds       = new Set(rawData.map(c => c.id));
const existingNamesNorm = new Set(rawData.map(c =>
  String(c.name ?? '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
));

function normName(s) {
  return String(s ?? '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Hauptprogramm
// ---------------------------------------------------------------------------

(async () => {
  console.log('=== NASA Exoplaneten-Harvest Welle 3 ===');
  console.log(`Bestand astra_raw.json: ${rawData.length} Konzepte`);

  const candidateNames = Object.keys(CURATED);
  console.log(`Kandidaten: ${candidateNames.length}`);

  // NASA TAP-Query für alle Kandidaten auf einmal
  let rows;
  try {
    rows = await tapQuery(candidateNames);
  } catch (err) {
    console.error('FEHLER beim NASA-API-Aufruf:', err.message);
    process.exit(1);
  }

  const found = new Map(rows.map(r => [r.pl_name, r]));
  const missing = candidateNames.filter(n => !found.has(n));

  if (missing.length > 0) {
    console.log('  Nicht im Archiv (Name-Mismatch prüfen): ' + missing.join(', '));
  }

  const out = [];
  let skippedDup = 0;

  for (const [nasaName, meta] of Object.entries(CURATED)) {
    const r = found.get(nasaName);
    if (!r) {
      // Bereits im missing-Log oben vermerkt
      continue;
    }

    if (r.sy_dist == null || r.disc_year == null) {
      console.warn(`  ! ${nasaName}: Distanz oder Entdeckungsjahr fehlt → übersprungen`);
      continue;
    }

    const distanceLy = round(r.sy_dist * PC_TO_LY, 1);
    const id         = slug(meta.de);

    // Dedup gegen Bestand
    if (existingIds.has(id) || existingNamesNorm.has(normName(meta.de))) {
      console.log(`  dup ${meta.de} (${id}) — bereits im Bestand`);
      skippedDup++;
      continue;
    }

    const attributes = {
      distanceLy,
      discoveredYear: r.disc_year,
      hostStar:       r.hostname,
      discoveryMethod: r.discoverymethod || undefined,
      orbitalPeriodDays: r.pl_orbper != null ? round(r.pl_orbper, 3) : undefined,
      radiusEarthRadii:  r.pl_rade   != null ? round(r.pl_rade, 2)   : undefined,
      massEarthMasses:   r.pl_bmasse != null ? round(r.pl_bmasse, 2)  : undefined
    };
    // Undefinierte Felder entfernen
    Object.keys(attributes).forEach(k => attributes[k] === undefined && delete attributes[k]);

    const concept = {
      id,
      name:       meta.de,
      category:   'exoplanet',
      attributes,
      funFact:    meta.fame,
      sourceName: 'NASA Exoplanet Archive',
      sourceUrl:  'https://exoplanetarchive.ipac.caltech.edu/overview/' + encodeURIComponent(nasaName),
      verifyNote: `NASA Exoplanet Archive (pscomppars): disc_year=${r.disc_year}, sy_dist=${round(r.sy_dist, 4)} pc → ${distanceLy} Lj.`
    };

    out.push(concept);
    console.log(`  + ${meta.de} | ${distanceLy} Lj | ${r.disc_year} | ${r.discoverymethod || '?'}`);
  }

  // Statistik
  console.log('\n=== Ergebnis ===');
  console.log(`Kandidaten: ${candidateNames.length}`);
  console.log(`Im NASA-Archiv gefunden: ${found.size}`);
  console.log(`Neue Konzepte: ${out.length}`);
  console.log(`Übersprungen (Duplikat): ${skippedDup}`);
  console.log(`Nicht im Archiv: ${missing.length}`);

  if (out.length === 0) {
    console.log('Keine neuen Konzepte — Ausgabedatei wird NICHT geschrieben.');
    return;
  }

  const outPath = path.join(__dirname, 'exoplanets_nasa_w3.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`\nGeschrieben: ${outPath}`);
})().catch(e => {
  console.error('FEHLER:', e.message);
  process.exit(1);
});
