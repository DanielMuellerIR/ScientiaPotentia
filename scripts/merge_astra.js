/**
 * Merge-Helfer für die Astra-Domain (Astronomie) — Welle 1.
 *
 * Liest die zwei Ernte-Dateien scripts/data_sources/harvest/astra_w1.json und
 * astra_w1b.json, vereinheitlicht sie und führt sie per UPSERT in die
 * verifizierte Faktenbasis scripts/data_sources/astra_raw.json ein
 * (Eingabe für generate_astra.js).
 *
 * Warum nötig: Die Sammelrunde lief mit ZWEI Konventionen:
 *   - astra_w1  schrieb snake_case-Deutsch  (umlaufzeit_jahre, kerngroesse_km)
 *   - astra_w1b schrieb camelCase-Deutsch   (startjahr, aktuellEntfernungAU)
 * Ohne Angleichung zerfielen die kategorie-internen Distraktor-Pools des
 * Generators (zwei Schreibweisen derselben Sache nebeneinander).
 *
 * Dieser Schritt macht (deterministisch, kein LLM):
 *   1. Attribut-KEYS -> kanonisch englisches camelCase je Kategorie
 *      (KEY_ALIASES; deckt ALLE Keys beider Ernte-Dateien ab).
 *      Einzelne Keys brauchen zusätzlich eine EXAKTE Einheiten-Umrechnung
 *      (VALUE_CONVERT), damit gleiche Größen im selben Pool landen:
 *      durchmesserM -> diameterKm (/1000), anzahlSterneMillionen -> numStars
 *      (*1e6), alterMilliardenJahre -> ageMillionYears (*1000). Das verändert
 *      keine Fakten, nur die Einheit der Darstellung.
 *   2. UPSERT-Semantik (idempotent wiederholbar): existiert die Konzept-id
 *      schon im Bestand, werden NUR die Bildfelder (imageFile/imageLicense/
 *      imageAttribution/_imgProblem) aus der Ernte aufgefrischt — das Skript
 *      läuft später erneut, wenn die Bilder fertig aufgelöst sind. Neue ids
 *      werden angehängt.
 *   3. Dedup NUR innerhalb derselben Kategorie (id-Kollision + normalisierter
 *      Name exakt). Nie kategorieübergreifend — Sgr A* existiert bewusst
 *      doppelt: als konkretes Objekt (phenomenon) und als Objektklasse
 *      „Schwarzes Loch" (object). Beide bleiben erhalten.
 *   4. ASCII-Umlaut-Putz NUR auf Anzeigefeldern (name, funFact,
 *      attributes-WERTE), wörterbuch-basiert mit Wortgrenzen (\b).
 *      Keys werden nicht angefasst (die kanonisiert Schritt 1 ohnehin).
 *
 * Robustheit: Ein anderer Agent aktualisiert PARALLEL die Bildfelder der
 * harvest/*.json. Schlägt JSON.parse fehl (Datei gerade halb geschrieben),
 * warten wir 30 s und lesen erneut.
 *
 * Aufruf: node scripts/merge_astra.js          (Dry-Run, zeigt nur Befund)
 *         node scripts/merge_astra.js --write  (schreibt astra_raw.json)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { blacklistReason } from './lib/merge_blacklist.js';
import { normalizeForDedup, normalizeIgnoringParentheses } from './lib/merge_text.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARVEST = join(__dirname, 'data_sources', 'harvest');
const OUT_PATH = join(__dirname, 'data_sources', 'astra_raw.json');
const WRITE = process.argv.includes('--write');

const FILES = ['astra_w1.json', 'astra_w1b.json'];

// --- 1a. Attribut-Key-Aliase je Kategorie -> kanonisch englisches camelCase --
// Deckt bewusst ALLE Keys beider Ernte-Dateien ab (selbst inspiziert), damit
// kein deutscher Key unbemerkt durchrutscht. Unbekannte Keys werden unten im
// Bericht gemeldet (Frühwarnung für künftige Ernte-Wellen).
const KEY_ALIASES = {
  comet: {
    umlaufzeit_jahre: 'orbitalPeriodYears',
    // Hale-Bopp schrieb nur "perihelpassage" — gemeint ist die LETZTE Passage
    // (1997), daher derselbe kanonische Key wie "letzte_perihelpassage".
    letzte_perihelpassage: 'lastPerihelion',
    perihelpassage: 'lastPerihelion',
    naechste_perihelpassage: 'nextPerihelion',
    naechstes_perihel_ca_jahr: 'nextPerihelionYear',
    // Kernlänge und Kerngröße meinen beide die Kern-Ausdehnung in km
    // (Halley-Kern ist länglich, 15,3 km Längsachse) -> ein Pool.
    kernlaenge_km: 'nucleusSizeKm',
    kerngroesse_km: 'nucleusSizeKm',
    perihelabstand_ae: 'perihelionDistanceAU',
    bahnneigung_grad: 'inclinationDeg',
    entdeckungsjahr: 'discoveredYear',
    'sichtbar_mit_bloßem_auge_monate': 'nakedEyeVisibleMonths',
    rosetta_begleitung_jahre: 'rosettaEscortYears'
  },
  meteor_shower: {
    maximum_datum: 'peakDate',
    aktivitaet_von_bis: 'activityPeriod',
    zhr_max: 'zhrMax',
    zhr_normal: 'zhrNormal',
    zhr_sturm_max: 'zhrStormMax',
    eintrittsgeschwindigkeit_km_s: 'entrySpeedKmS',
    mutterkoerper: 'parentBody',
    umlaufzeit_mutterkoerper_jahre: 'parentBodyOrbitalPeriodYears',
    radiant_sternbild: 'radiantConstellation',
    radiant_koordinaten_ra: 'radiantRA',
    radiant_deklination_grad: 'radiantDeclinationDeg',
    maximum_dauer_stunden: 'peakDurationHours'
  },
  nebula: {
    messier_nr: 'messierNumber',
    entfernung_lichtjahre: 'distanceLy',       // wie Bestand star/galaxy
    durchmesser_lichtjahre: 'diameterLy',
    // "Ausdehnung" (Adlernebel) meint dieselbe Größe wie "Durchmesser"
    // -> in denselben Pool, sonst zerfällt die Durchmesser-Frage.
    ausdehnung_lichtjahre: 'diameterLy',
    typ: 'type',
    sternbild: 'constellation',
    helligkeit_mag: 'apparentMagnitude',       // wie Bestand star
    supernova_jahr: 'supernovaYear',
    pulsar_rotationen_pro_sekunde: 'pulsarRotationsPerSecond',
    zentralstern_temperatur_k: 'centralStarTempK',
    saeulen_hoehe_lichtjahre: 'pillarsHeightLy',
    scheinbare_groesse_bogenmin: 'apparentSizeArcmin',
    mindest_teleskop_cm: 'minTelescopeCm',
    katalog: 'catalog'
  },
  constellation: {
    flaeche_quadratgrad: 'areaSqDeg',
    iau_rang: 'iauRank',
    // "hauptsterne" (Kreuz des Südens: 4) und "hauptsterne_heller_3mag"
    // (Orion: 8) sind NICHT dasselbe Kriterium -> getrennte Keys.
    hauptsterne_heller_3mag: 'mainStarsBrighterMag3',
    hauptsterne: 'mainStars',
    abkuerzung_iau: 'iauAbbreviation',
    sichtbarkeit: 'visibility',
    bekannte_sterne: 'notableStars',
    zirkumpolar_mitteleuropa: 'circumpolarCentralEurope',
    form: 'shape',
    auf_flaggen_laender: 'onFlagsCount'
  },
  mission: {
    // ---- aus astra_w1 (snake_case deutsch) ----
    startdatum: 'launchDate',
    betreiber: 'operator',
    heliopause_gekreuzt_jahr: 'heliopauseCrossedYear',
    // "Entfernung Sonne 2025" (w1) und "aktuelle Entfernung" (w1b) meinen
    // beide den aktuellen Sonnenabstand in AE -> ein Pool.
    entfernung_sonne_ae_2025: 'currentDistanceAU',
    geschwindigkeit_km_h: 'speedKmH',
    ziel_vorbeiflug: 'flybyTargets',
    ankunft_saturn: 'saturnArrivalDate',
    missionsende: 'missionEndDate',
    missionsdauer_jahre: 'missionDurationYears',
    ziel: 'target',
    spiegeldurchmesser_m: 'mirrorDiameterM',
    spiegelsegmente: 'mirrorSegments',
    orbit: 'orbit',
    wellenlaengenbereich: 'wavelengthRange',
    // ---- aus astra_w1b (camelCase deutsch) ----
    startjahr: 'launchYear',
    besuchterPlaneten: 'planetsVisited',
    aktuellEntfernungAU: 'currentDistanceAU',
    interstellarerRaumSeit: 'interstellarSpaceSince',
    startmassekG: 'launchMassKg',              // krumme Schreibweise aus der Ernte
    plutoVorbeiflugJahr: 'plutoFlybyYear',
    plutoAbstandKm: 'plutoFlybyDistanceKm',
    arrokothVorbeiflugJahr: 'arrokothFlybyYear',
    landedatumISO: 'landingDate',
    landestelleKrater: 'landingSite',
    rovermassekG: 'roverMassKg',
    helikopterIngenuityMasseKg: 'ingenuityMassKg',
    budgetMilliardenUSD: 'budgetBillionUSD',
    mondlandungISO: 'moonLandingDate',
    aufenthaltMondeStunden: 'moonStayHours',
    aussenbordeinsatzStunden: 'evaHours',
    gesteinsprobenKg: 'rockSamplesKg',
    astronauten: 'astronauts',
    minimaleSonnenentfernungMioKm: 'minSunDistanceMioKm',
    // Parkers MAXIMAL-Geschwindigkeit ist nicht dasselbe wie Voyagers
    // aktuelle Reisegeschwindigkeit -> getrennte Keys (sonst unfairer Pool).
    maxGeschwindigkeitKmH: 'maxSpeedKmH',
    naechsterSonnenabstandSonnenradien: 'minSunDistanceSolarRadii',
    orbithoehekm: 'orbitAltitudeKm',
    spiegeldurchmesserm: 'mirrorDiameterM',
    masseTonnen: 'massTonnes',
    laengem: 'lengthM',
    betriebsaufnahme: 'operationalSinceYear',
    katalogisierteObjekte: 'catalogedObjects',
    messgenauigkeitMikrobogensekunden: 'accuracyMicroArcsec',
    orbitLagrangepunktL2: 'orbitAtL2',
    missionsendeISO: 'missionEndDate',
    // Kepler: Betriebsende als Jahr (kein ISO-Datum) -> eigener Key,
    // sonst mischen sich Jahre und Datums-Strings im selben Pool.
    betriebsendeJahr: 'operationEndYear',
    entdeckteExoplanetenKandidaten: 'exoplanetCandidates',
    suchgebiet: 'searchArea',
    beobachteteStere: 'observedStars',         // Tippfehler "Stere" aus der Ernte
    methode: 'method',
    masseKg: 'massKg'
  },
  phenomenon: {
    // ---- aus astra_w1 ----
    max_totalitaet_min: 'maxTotalityMin',
    laengste_bisher_min: 'longestObservedMin',
    kernschatten_breite_km_max: 'umbraMaxWidthKm',
    haeufigkeit_pro_ort_jahre: 'frequencyPerLocationYears',
    naechste_grosse_saros_zyklen: 'nextMajorSarosCycles',
    scheinbarer_winkeldurchmesser_mond_grad: 'moonAngularDiameterDeg',
    hoehe_gruen_km: 'greenAltitudeKm',
    hoehe_rot_km: 'redAltitudeKm',
    ursache: 'cause',
    hauptfarben: 'mainColors',
    aurorale_zone_breitengrad: 'auroralZoneLatitude',
    nordlicht_name_latein: 'latinNameNorthernLights',
    masse_sonnenmassen: 'massSolarMasses',
    entfernung_lichtjahre: 'distanceLy',
    ereignishorizont_durchmesser_mio_km: 'eventHorizonDiameterMioKm',
    erstes_bild_jahr: 'firstImageYear',
    typ: 'type',
    position: 'position',
    // ---- aus astra_w1b ----
    typischeAusdehnungSonnenradien: 'typicalSizeSolarRadii',
    maxAusdehnungSonnenradien: 'maxSizeSolarRadii',
    oberflaechentemperaturKelvin: 'surfaceTempK',
    leuchtkraftVielfacheSonne: 'luminositySunMultiple',
    beispiele: 'examples',
    freigabeenergieJoule: 'energyReleasedJoule',
    letzteGalaktischeSichtbarkeitJahr: 'lastGalacticVisibleYear',
    beobachter: 'observers',
    typIa: 'typeIaMechanism',
    kernkollaps: 'coreCollapseMechanism',
    haeufigkeitProJahrtausendMilchstrasse: 'ratePerMillenniumMilkyWay'
  },
  exoplanet: {
    entfernungLj: 'distanceLy',
    umlaufzeitTage: 'orbitalPeriodDays',
    mindestmasseErdmassen: 'minMassEarthMasses',
    radiusErdradien: 'radiusEarthRadii',
    entdeckungsjahr: 'discoveredYear',
    mutterstern: 'hostStar',
    anzahlPlaneten: 'numPlanets',
    planetenInHabitablerZone: 'planetsInHabitableZone',
    sterntyp: 'starType',
    sternmasseSonnenmassen: 'starMassSolarMasses',
    // "alter" (TRAPPIST-1) und "systemalter" (Kepler-452b) meinen beide das
    // Alter des Systems/Sterns in Milliarden Jahren -> ein Key.
    alterMilliardenJahre: 'systemAgeBillionYears',
    systemalterMilliardenJahre: 'systemAgeBillionYears',
    masseJupitermassen: 'massJupiterMasses',
    typ: 'type'
  },
  asteroid: {
    durchmesserKm: 'diameterKm',
    // durchmesserM (Bennu/Apophis) wird per VALUE_CONVERT exakt in km
    // umgerechnet — siehe unten.
    masseKg: 'massKg',                          // Strings wie "2,59 × 10²⁰" — bleiben kategorisch
    grosseHalbachseAU: 'semiMajorAxisAU',
    umlaufzeitJahre: 'orbitalPeriodYears',
    umlaufzeitTage: 'orbitalPeriodDays',
    entdeckungsjahr: 'discoveredYear',
    missionen: 'missions',
    mission: 'missions',
    bahnneigungGrad: 'inclinationDeg',
    typ: 'type',
    kollisionswahrscheinlichkeitBis2300Prozent: 'collisionProbBy2300Percent',
    kritischesJahr: 'criticalYear',
    probenentnahme: 'sampleReturn',
    erdannaeherung2029kmAbstand: 'earthApproach2029DistanceKm',
    datumVorbeiflug: 'flybyDate'
  },
  star_cluster: {
    entfernungLj: 'distanceLy',
    anzahlSterne: 'numStars',
    alterMillionenJahre: 'ageMillionYears',
    sternbild: 'constellation',
    typ: 'type',
    mitBlossemAugeSichtbareSterne: 'nakedEyeVisibleStars',
    durchmesserLj: 'diameterLy',
    masseSonnenmassen: 'massSolarMasses'
    // anzahlSterneMillionen + alterMilliardenJahre: per VALUE_CONVERT (unten)
  },
  object: {
    maxMasseSonnenmassen: 'maxMassSolarMasses',
    typischeMasseSonnenmassen: 'typicalMassSolarMasses',
    typischerRadiusKm: 'typicalRadiusKm',
    // Radius (Weißer Zwerg) vs. Durchmesser (Neutronenstern) sind
    // verschiedene Größen -> bewusst NICHT zusammengelegt.
    typischerDurchmesserKm: 'typicalDiameterKm',
    dichteTonnenProCm3: 'densityTonnesPerCm3',
    entstehungAusSternenBisSonnenmassen: 'progenitorMaxSolarMasses',
    entstehungAusSternenAbSonnenmassen: 'progenitorMinSolarMasses',
    abkuehldauerMilliardenJahre: 'coolingTimeBillionYears',
    chandrasekharGrenzeSonnenmassen: 'chandrasekharLimitSolarMasses',
    maxRotationProSekunde: 'maxRotationsPerSecond',
    magnetfeldTesla: 'magneticFieldTesla',
    masseM87SternSonnenmassen: 'massM87StarSolarMasses',
    masseSgrASternSonnenmassen: 'massSgrAStarSolarMasses',
    erstesDirectBildJahr: 'firstImageYear',
    typStellaresMasseSonnenmassen: 'stellarTypeMassSolarMasses',
    schwarzschildRadiusFormel: 'schwarzschildRadiusFormula'
  }
};

// --- 1b. Exakte Einheiten-Umrechnungen ---------------------------------------
// Nur verlustfreie Faktor-Umrechnungen, damit gleiche physikalische Größen im
// SELBEN Distraktor-Pool landen. Der Faktenwert bleibt identisch, nur die
// Einheit wird an den kanonischen Key angepasst.
const VALUE_CONVERT = {
  asteroid: {
    // Bennu 492 m -> 0,492 km; Apophis 350 m -> 0,35 km (gleicher Pool wie Vesta/Pallas)
    durchmesserM: { key: 'diameterKm', f: v => v / 1000 }
  },
  star_cluster: {
    // Omega Centauri: 10 Mio. Sterne -> 10.000.000 (gleicher Pool wie Plejaden/Hyaden)
    anzahlSterneMillionen: { key: 'numStars', f: v => v * 1e6 },
    // Omega Centauri: 11,5 Mrd. Jahre -> 11.500 Mio. Jahre
    alterMilliardenJahre: { key: 'ageMillionYears', f: v => v * 1000 }
  }
};

// --- 4. ASCII-Umlaut-Putz (sicheres Wort-Wörterbuch, mit Wortgrenze \b) ------
// Wort-Anfangs-genau, damit kein korrektes Wort verstümmelt wird. Die Ernte ist
// größtenteils schon mit echten Umlauten geschrieben; dies fängt Einzelfälle ab.
// Wirkt NUR auf Anzeigefelder (name, funFact, Attribut-WERTE) — Keys nie.
const DE_FIX = [
  ['ueber', 'über'], ['aequator', 'äquator'], ['weiss', 'weiß'], ['heiss', 'heiß'],
  ['gross', 'groß'], ['groesst', 'größt'], ['groesser', 'größer'], ['groesse', 'größe'],
  ['suedlich', 'südlich'], ['sued', 'süd'], ['noerdlich', 'nördlich'],
  ['hoehe', 'höhe'], ['hoeher', 'höher'], ['koerper', 'körper'],
  ['laengst', 'längst'], ['laenge', 'länge'], ['laenger', 'länger'],
  ['haeufig', 'häufig'], ['naeher', 'näher'], ['naechst', 'nächst'],
  ['staerk', 'stärk'], ['waerme', 'wärme'], ['fuenf', 'fünf'], ['duenn', 'dünn'],
  ['foermig', 'förmig'], ['traegt', 'trägt'], ['zaehl', 'zähl'],
  ['veraenderlich', 'veränderlich'], ['guertel', 'gürtel'], ['truemmer', 'trümmer'],
  ['gruen', 'grün'], ['saeule', 'säule'], ['kuehl', 'kühl']
];
function deFix(s) {
  let out = String(s ?? '');
  for (const [a, b] of DE_FIX) {
    // \b = Wortgrenze: Treffer nur am Wortanfang, Großschreibung wird übernommen.
    out = out.replace(new RegExp('\\b' + a, 'gi'), m =>
      m[0] === m[0].toUpperCase() ? b[0].toUpperCase() + b.slice(1) : b);
  }
  return out;
}
function deFixDeep(v) {
  if (typeof v === 'string') return deFix(v);
  if (Array.isArray(v)) return v.map(deFixDeep);
  if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = deFixDeep(v[k]); return o; }
  return v;
}

// Normalisierung für den Namens-Dedup (Umlaute/Sonderzeichen entfernen).
// Vergleichsschlüssel für Dedup und Sperrlisten-Abgleich: einmal in
// ./lib/merge_text.js, dort auch die Begründung (CodeQA 2026-09-03).
const norm = normalizeForDedup;

// Unbekannte Keys sammeln (Frühwarnung, falls eine künftige Ernte-Welle
// neue Schreibweisen einführt, die hier noch nicht gemappt sind).
const unknownKeys = new Set();

/** Wendet Key-Aliase + Einheiten-Umrechnung + Umlaut-Putz auf ein Konzept an. */
function normalizeConcept(c) {
  const alias = KEY_ALIASES[c.category] || {};
  const convert = VALUE_CONVERT[c.category] || {};
  const attrs = {};

  for (const [k, v] of Object.entries(c.attributes || {})) {
    // Erst Einheiten-Umrechnung prüfen (eigener Ziel-Key + Faktor) ...
    if (convert[k]) {
      attrs[convert[k].key] = convert[k].f(v);
      continue;
    }
    // ... sonst nur Key umbenennen, Wert unverändert übernehmen.
    if (!alias[k]) unknownKeys.add(`${c.category}.${k}`);
    attrs[alias[k] || k] = v;
  }

  // Startjahr aus dem ISO-Startdatum ableiten (exakter Substring, kein neuer
  // Fakt): w1-Missionen haben "startdatum", w1b-Missionen "startjahr" — für
  // den gemeinsamen Fragen-Pool brauchen beide launchYear.
  if (c.category === 'mission' && attrs.launchYear === undefined && typeof attrs.launchDate === 'string') {
    const y = Number(attrs.launchDate.slice(0, 4));
    if (Number.isFinite(y)) attrs.launchYear = y;
  }

  // Auf die vom Generator erwarteten Felder reduzieren; Bildfelder mitführen,
  // WIE VORGEFUNDEN (ein paralleler Agent löst die Bilder gerade erst auf).
  // imageSearchTerm ist nur ein Arbeitsfeld der Ernte -> fällt weg (wie Natura).
  const out = {
    id: c.id,
    // Umlaut-Putz nur auf Anzeigefeldern: name, funFact, Attribut-WERTE.
    name: deFix(c.name),
    category: c.category,
    attributes: deFixDeep(attrs),
    funFact: deFix(c.funFact || ''),
    sourceName: c.sourceName || '',
    sourceUrl: c.sourceUrl || '',
    verifyNote: c.verifyNote || '',
    imageFile: c.imageFile || '',
    imageLicense: c.imageLicense || '',
    imageAttribution: c.imageAttribution || ''
  };
  // Problem-Marker des Bild-Agenten mitführen, falls vorhanden.
  if (c._imgProblem !== undefined) out._imgProblem = c._imgProblem;
  return out;
}

// --- Ernte-Datei robust lesen (Bild-Agent schreibt parallel) -----------------
async function readJsonRetry(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    // Vermutlich schreibt der Bild-Agent die Datei gerade halb fertig.
    console.warn(`  ${path}: JSON.parse fehlgeschlagen (${e.message})`);
    console.warn('  -> 30 s warten, dann erneut lesen ...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    return JSON.parse(readFileSync(path, 'utf8')); // 2. Fehlschlag -> Abbruch mit Fehler
  }
}

// --- 2.+3. Upsert in den Bestand + Dedup je Kategorie ------------------------
const existing = JSON.parse(readFileSync(OUT_PATH, 'utf8'));
const before = existing.length;

// Nachschlagestrukturen über den Bestand: id -> Konzept (global eindeutig)
// und je Kategorie die normalisierten Namen (Dedup NUR gleiche Kategorie).
const byId = new Map(existing.map(c => [c.id, c]));
const namesByCat = {};
const loosePerCat = {};   // klammerlose Namen je Kategorie — nur fuer Hinweise
const warnings = [];      // Hinweise, die keinen Verwurf ausloesen
for (const c of existing) {
  (namesByCat[c.category] ||= new Set()).add(norm(c.name));
  (loosePerCat[c.category] ||= new Set()).add(normalizeIgnoringParentheses(c.name));
}

const fileStats = {};
const dropped = [];
const blockedIds = [];   // nur fuer den Bericht; merge_astra loescht nie

for (const file of FILES) {
  const arr = await readJsonRetry(join(HARVEST, file));
  let added = 0, refreshed = 0;

  for (const c0 of arr) {
    // BLACKLIST zuerst: gesperrte Konzepte gar nicht erst normalisieren
    // (Regel und Begründung in ./lib/merge_blacklist.js).
    const blocked = blacklistReason(c0);
    if (blocked) {
      dropped.push({ name: c0.name, category: c0.category, reason: blocked });
      blockedIds.push(String(c0.id || ''));
      continue;
    }
    const c = normalizeConcept(c0);

    // UPSERT: id schon im Bestand -> nur Bildfelder auffrischen (idempotent;
    // genau dieser Pfad greift, wenn das Skript nach der Bild-Auflösung
    // erneut läuft). Attribute/Fakten werden dabei NICHT überschrieben.
    const hit = byId.get(c.id);
    if (hit) {
      // Nur setzen, was die Ernte wirklich liefert. Vorher schrieb der Upsert
      // auch leere Werte zurueck und loeschte damit ein bereits aufgeloestes
      // Bild samt Lizenz und Urheber — still, denn die ID bleibt ja erhalten
      // und assertPreservesExistingConceptIds greift nicht (CodeQA 2026-09-03).
      if (c.imageFile) hit.imageFile = c.imageFile;
      if (c.imageLicense) hit.imageLicense = c.imageLicense;
      if (c.imageAttribution) hit.imageAttribution = c.imageAttribution;
      if (c._imgProblem !== undefined) hit._imgProblem = c._imgProblem;
      refreshed++;
      continue;
    }

    // Dedup nur innerhalb derselben Kategorie: exakter normalisierter Name.
    const catNames = (namesByCat[c.category] ||= new Set());
    if (catNames.has(norm(c.name))) {
      dropped.push({ name: c.name, category: c.category, reason: 'Name vorhanden (gleiche Kategorie)' });
      continue;
    }
    // Klammerlose Gleichheit ist nur noch ein Hinweis: „Kanopus" neben
    // „Kanopus (Canopus)" ist wahrscheinlich dieselbe Sache, „David
    // (Michelangelo)" neben „David (Donatello)" aber nicht (CodeQA 2026-09-03).
    if (loosePerCat[c.category]?.has(normalizeIgnoringParentheses(c.name))) {
      warnings.push(`Name unterscheidet sich nur im Klammerzusatz: ${c.name}`);
    }
    (loosePerCat[c.category] ||= new Set()).add(normalizeIgnoringParentheses(c.name));

    byId.set(c.id, c);
    catNames.add(norm(c.name));
    existing.push(c);
    added++;
  }
  fileStats[file] = { in: arr.length, added, refreshed };
}

// --- Bericht -----------------------------------------------------------------
const byCat = {};
for (const c of existing) byCat[c.category] = (byCat[c.category] || 0) + 1;

console.log('=== MERGE ASTRA (Welle 1) ===');
for (const f of FILES) {
  const s = fileStats[f];
  console.log(`  ${f.padEnd(18)} ${s.added} neu + ${s.refreshed} Bild-Refresh von ${s.in}`);
}
console.log(`\nKonzepte: ${before} (Bestand) -> ${existing.length} (erwartet 146)`);
console.log('Nach Kategorie:', byCat);
console.log('\nHinweis: „Sagittarius A*" (phenomenon) und „Schwarzes Loch" (object)');
console.log('bleiben bewusst BEIDE erhalten — konkretes Objekt vs. Objektklasse,');
console.log('verschiedene Konzepte, keine Dublette (Dedup nur je Kategorie).');
if (warnings.length) {
  console.log('\n--- Hinweise ---');
  warnings.forEach(w => console.log('  ! ' + w));
}
if (dropped.length) {
  console.log('\n--- Verworfen (Dubletten gleicher Kategorie) ---');
  dropped.forEach(d => console.log(`  - ${d.category}/${d.name} [${d.reason}]`));
} else {
  console.log('\nDubletten: 0 (Kategorien der Ernte sind disjunkt zum Bestand)');
}
if (unknownKeys.size) {
  console.log('\n!!! Unbekannte Attribut-Keys (nicht in KEY_ALIASES gemappt):');
  [...unknownKeys].sort().forEach(k => console.log(`  - ${k}`));
}

if (WRITE) {
  writeFileSync(OUT_PATH, JSON.stringify(existing, null, 2), 'utf8');
  console.log(`\nGeschrieben: ${OUT_PATH} (${existing.length} Konzepte)`);
} else {
  console.log('\nDry-Run. Mit --write schreiben.');
}
