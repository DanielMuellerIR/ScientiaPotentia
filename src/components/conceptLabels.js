/**
 * Geteilte Label-Tabellen und Selbstverraeter-Guard-Mengen fuer die generische
 * Konzept-Darstellung.
 *
 * Frueher lagen diese Konstanten privat in `ConceptVisual.jsx`. Ausgelagert, damit
 * sie an mehreren Stellen als EINE Quelle der Wahrheit dienen:
 *   - `ConceptVisual.jsx` (linkes Quiz-Panel)
 *   - Dashboard-Kategorie-Aufschluesselung (deutsche statt roher Keys)
 *   - QA-Werkzeuge (`scripts/qa_review/*`), die exakt nachbilden, WAS der Spieler
 *     vor dem Antworten sieht (Guard-Logik muss deckungsgleich sein).
 *
 * Wichtig: Diese Datei ist bewusst framework-frei (kein React-Import), damit sie
 * auch von Node-Skripten (`import`) genutzt werden kann.
 */

// Deutsche Labels fuer bekannte Kategorien (Fallback: Roh-Schluessel).
export const CATEGORY_LABELS = {
  planet: 'Planet',
  dwarf_planet: 'Zwergplanet',
  moon: 'Mond',
  star: 'Stern',
  galaxy: 'Galaxie',
  constant: 'Konstante',
  constellation: 'Sternbild',
  mission: 'Raumfahrtmission',
  bone: 'Knochen',
  muscle: 'Muskel',
  organ: 'Organ',
  body_fact: 'Körperwert',
  species: 'Menschenart',
  // Homo — Physiologie jenseits der Anatomie (Stand 2026-06-25)
  cell_type: 'Zelltyp',
  hormone: 'Hormon',
  vitamin: 'Vitamin',
  sense: 'Sinn',
  digestive_enzyme: 'Verdauungsenzym',
  nerve: 'Nerv',
  psych_effect: 'Psychoeffekt',
  nutrient_macro: 'Nährstoff',
  development_stage: 'Entwicklungsstadium',
  brain_lobe: 'Großhirnlappen',
  sleep_perception: 'Schlaf & Gedächtnis',
  // Homo — Welle 5 (Stand 2026-07-01): Gelenke, Reflexe, Blutgruppen
  joint: 'Gelenk',
  reflex: 'Reflex',
  blood_group: 'Blutgruppe',
  // Natura
  animal: 'Tier',
  plant: 'Pflanze',
  fungus: 'Pilz',
  biome: 'Lebensraum',
  geology: 'Geologie',
  mineral: 'Mineral',
  atmosphere: 'Atmosphäre',
  phenomenon: 'Naturphänomen',
  // Lingua
  language: 'Sprache',
  language_family: 'Sprachfamilie',
  writing_system: 'Schriftsystem',
  language_fact: 'Sprach-Fakt',
  etymology: 'Wortherkunft',
  loanword: 'Lehnwort',
  grammar_fact: 'Grammatik',
  phonetics: 'Phonetik',
  language_curio: 'Sprachkuriosum',
  // Cultura
  artwork: 'Kunstwerk',
  sculpture: 'Skulptur',
  architecture: 'Architektur',
  art_movement: 'Kunstrichtung',
  composer: 'Komponist',
  composition: 'Musikwerk',
  literature: 'Literaturwerk',
  genre_fiction: 'Genre-Literatur',
  literary_movement: 'Literaturepoche',
  // Machina (Digital & Technik)
  programming_language: 'Programmiersprache',
  file_format: 'Dateiformat',
  network_protocol: 'Netzwerkprotokoll',
  data_structure: 'Datenstruktur',
  algorithm: 'Algorithmus',
  hardware: 'Hardware',
  acronym: 'Abkürzung',
  concept: 'Konzept',
  // Machina — klassische Technik (Handwerk/Mechanik/Maschinenbau)
  tool: 'Handwerkzeug',
  machine_element: 'Maschinenelement',
  engine: 'Kraftmaschine',
  manufacturing_process: 'Fertigungsverfahren',
  material: 'Werkstoff',
  simple_machine: 'Einfache Maschine',
  // Historia (Geschichte)
  invention: 'Erfindung',
  discovery: 'Entdeckung',
  epoch: 'Epoche',
  figure: 'Persönlichkeit',
  milestone: 'Meilenstein',
  expedition: 'Expedition',
  // Weitere Astronomie-Kategorien, die nur in Museum/Galerie vorkamen
  // (R3-Zusammenführung der drei zuvor getrennten Label-Tabellen).
  comet: 'Komet',
  meteor_shower: 'Meteorschauer',
  nebula: 'Nebel',
  exoplanet: 'Exoplanet',
  asteroid: 'Asteroid',
  star_cluster: 'Sternhaufen',
  object: 'Objekt',
  // Ältere Galerie-Kategorien
  music: 'Musik',
  quote: 'Zitat',
  script: 'Schrift'
};

// Deutsche Labels fuer haeufige Attribut-Schluessel (Fallback: Roh-Schluessel).
export const ATTR_LABELS = {
  region: 'Region',
  latinName: 'Lateinisch',
  notableFor: 'Bekannt für',
  location: 'Lage',
  system: 'Organsystem',
  // Homo-Attribute der neuen Kategorien (cell_type/hormone/vitamin/sense + Welle 2).
  fachName: 'Fachbegriff',
  gland: 'Bildungsort',
  hormoneClass: 'Hormonklasse',
  chemicalName: 'Chemischer Name',
  solubility: 'Löslichkeit',
  sensoryOrgan: 'Sinnesorgan',
  substrate: 'Substrat',
  domain: 'Bereich',
  foodSource: 'Nahrungsquelle',
  nutrientClass: 'Nährstoffgruppe',
  characteristic: 'Kennzeichen',
  timeframe: 'Zeitspanne',
  kind: 'Art',
  // Homo — Welle 5 (joint/reflex/blood_group).
  jointType: 'Gelenktyp',
  bonesInvolved: 'Beteiligte Knochen',
  movement: 'Beweglichkeit',
  stimulus: 'Reiz (Auslöser)',
  response: 'Reaktion',
  reflexType: 'Reflexart',
  antigen: 'Antigen',
  antibody: 'Antikörper',
  approxWeightGrams: 'Gewicht (g)',
  value: 'Wert',
  unit: 'Einheit',
  epoch: 'Zeitraum',
  type: 'Typ',
  diameterKm: 'Durchmesser (km)',
  distanceAU: 'Entfernung (AE)',
  moons: 'Monde',
  // numMoons/orderFromSun: Text an das bestehende Astra-Panel angeglichen (T1,
  // zuvor abweichende Duplikate in astraBodies.js — dort war 'Monde'/'Position
  // v. Sonne' sichtbar; hier vereinheitlicht, keine andere Domain nutzt die Keys).
  numMoons: 'Monde',
  orbitalPeriod: 'Umlaufzeit',
  orderFromSun: 'Position v. Sonne',
  dayLengthHours: 'Tageslänge (h)',
  yearLengthEarthDays: 'Jahr (Erdtage)',
  surfaceTempC: 'Oberflächentemp. (°C)',
  mass: 'Masse',
  gravity: 'Schwerkraft',
  hostStar: 'Zentralstern',
  constellation: 'Sternbild',
  distanceLy: 'Entfernung (Lj)',
  brightestStar: 'Hellster Stern',
  // Weitere Astra/Homo-Schluessel, damit keine rohen englischen Keys leaken.
  apparentMagnitude: 'Magnitude',
  parentPlanet: 'Zentralplanet',
  yearLengthEarthYears: 'Jahr (Erdjahre)',
  distanceFromSunAU: 'Entfernung (AE)',
  hasRings: 'Ringe',
  discoveredYear: 'Entdeckt',
  definition: 'Definition',
  function: 'Funktion',
  // Natura-Attribute (kanonische Keys aus merge_natura.js).
  class: 'Tierklasse',
  order: 'Ordnung',
  range: 'Verbreitung',
  conservationStatus: 'Schutzstatus (IUCN)',
  maxLengthCm: 'max. Länge (cm)',
  maxWeightKg: 'max. Gewicht (kg)',
  lifespanYears: 'Lebensdauer (Jahre)',
  topSpeedKmh: 'Geschwindigkeit (km/h)',
  maxWingspanCm: 'Spannweite (cm)',
  scientificName: 'Wissenschaftl. Name',
  maxHeightM: 'max. Höhe (m)',
  maxAgeYears: 'max. Alter (Jahre)',
  origin: 'Herkunft',
  mohsHardness: 'Mohshärte',
  kristallsystem: 'Kristallsystem',
  chemischeFormel: 'Chemische Formel',
  lage: 'Lage',
  vulkantyp: 'Vulkantyp',
  // Häufige Natura-Einzelattribute (verhindert rohe camelCase-Keys im Panel).
  herzgewichtKg: 'Herzgewicht (kg)',
  herzfrequenzMin: 'Herzfrequenz (1/min)',
  koerperlaengeCm: 'Körperlänge (cm)',
  maxGewichtG: 'max. Gewicht (g)',
  schulterhoeheMaxCm: 'Schulterhöhe (cm)',
  tiefenbereichM: 'Tiefenbereich (m)',
  maxTauchtiefeM: 'max. Tauchtiefe (m)',
  maxTauchzeitMin: 'max. Tauchzeit (min)',
  beissKraftN: 'Beißkraft (N)',
  maxGroesseMm: 'max. Größe (mm)',
  fluegelschlaegeSekunde: 'Flügelschläge/s',
  migrationsdistanzKm: 'Migrationsdistanz (km)',
  // Lingua (kanonische Keys aus merge_lingua.js)
  speakersMillionsTotal: 'Sprecher gesamt (Mio.)',
  speakersMillionsNative: 'Muttersprachler (Mio.)',
  family: 'Sprachfamilie',
  script: 'Schrift',
  scriptType: 'Schrifttyp',
  countries: 'Länder',
  officialIn: 'Amtssprache in (Ländern)',
  languageCount: 'Anzahl Sprachen',
  mainBranches: 'Hauptzweige',
  distribution: 'Verbreitung',
  shareWorldPopulationPercent: 'Anteil Weltbevölkerung (%)',
  charCount: 'Zeichenanzahl',
  direction: 'Schreibrichtung',
  usersMillions: 'Nutzer (Mio.)',
  languagesUsing: 'Verwendet von',
  sourceLanguage: 'Herkunftssprache',
  originalMeaning: 'Ursprüngliche Bedeutung',
  loanPath: 'Entlehnungsweg',
  loanEra: 'Entlehnungszeit',
  meaning: 'Bedeutung',
  examples: 'Beispiele',
  language: 'Sprache',
  speakersMillions: 'Sprecher (Mio.)',
  inventedYear: 'Erfunden (Jahr)',
  specialFeature: 'Besonderheit',
  firstAttestedYear: 'Erstbeleg (Jahr)',
  caseCount: 'Anzahl Fälle',
  toneCount: 'Anzahl Töne',
  founder: 'Begründer',
  foundedYear: 'Gegründet',
  // Cultura (Keys aus concepts_cultura.json; location/founder/language bereits oben).
  creator: 'Urheber',
  architect: 'Architekt',
  author: 'Autor',
  composer: 'Komponist',
  creationPeriod: 'Entstehungszeit',
  year: 'Jahr',
  yearPart1: 'Jahr (Teil 1)',
  yearPart2: 'Jahr (Teil 2)',
  era: 'Epoche',
  period: 'Periode',
  country: 'Land',
  originCountry: 'Herkunftsland',
  originPlace: 'Herkunftsort',
  originRegion: 'Herkunftsregion',
  nationality: 'Nationalität',
  namesake: 'Namensgeber',
  dedicatee: 'Widmungsträger',
  genre: 'Gattung',
  series: 'Reihe/Zyklus',
  startYear: 'Startjahr',
  style: 'Stil',
  medium: 'Medium',
  material: 'Material',
  musicalKey: 'Tonart',
  keyCenters: 'Tonarten-Zentren',
  movementCount: 'Anzahl Sätze',
  actCount: 'Anzahl Akte',
  cantoCount: 'Anzahl Gesänge',
  concertoCount: 'Anzahl Konzerte',
  operaCount: 'Anzahl Opern',
  partCount: 'Anzahl Teile',
  verseCount: 'Anzahl Verse',
  librettist: 'Librettist',
  finaleLyricist: 'Finale-Textdichter',
  coreIdea: 'Grundidee',
  characteristics: 'Merkmale',
  mainGroups: 'Hauptgruppen',
  mainRepresentatives: 'Hauptvertreter',
  notableExample: 'Bekanntes Beispiel',
  notableWork: 'Bekanntes Werk',
  phases: 'Phasen',
  succeededBy: 'Nachfolger',
  supersedes: 'Vorgänger',
  birthYear: 'Geburtsjahr',
  deathYear: 'Todesjahr',
  lifespan: 'Lebenszeit',
  startYear: 'Startjahr',
  endYear: 'Endjahr',
  unescoYear: 'UNESCO-Jahr',
  heightM: 'Höhe (m)',
  widthM: 'Breite (m)',
  lengthM: 'Länge (m)',
  lengthKm: 'Länge (km)',
  originalHeightM: 'Ursprüngliche Höhe (m)',
  totalHeightWithPedestalM: 'Gesamthöhe mit Sockel (m)',
  elevationM: 'Höhe ü. NN (m)',
  domeHeightM: 'Kuppelhöhe (m)',
  domeDiameterM: 'Kuppeldurchmesser (m)',
  weightT: 'Gewicht (t)',
  capacity: 'Fassungsvermögen',
  interiorArea: 'Innenfläche',
  totalAreaHa: 'Gesamtfläche (ha)',
  durationMin: 'Dauer (min)',
  totalDurationHours: 'Gesamtdauer (h)',
  // Machina (Digital & Technik) — Funktion/Eigenschaft, kein Datum/Person.
  paradigm: 'Paradigma',
  typeSystem: 'Typsystem',
  execution: 'Ausführung',
  primaryDomain: 'Anwendungsbereich',
  fileExtension: 'Dateiendung',
  mediaType: 'Datenart',
  compression: 'Kompression',
  fullName: 'Bedeutung',
  layer: 'Netzwerkschicht',
  defaultPort: 'Standard-Port',
  transport: 'Transportprotokoll',
  purpose: 'Zweck',
  accessComplexity: 'Zugriffskomplexität',
  avgComplexity: 'Zeitkomplexität (Ø)',
  // Machina — klassische Technik
  trade: 'Gewerk',
  energySource: 'Energiequelle',
  principle: 'Wirkprinzip',
  mainGroup: 'Hauptgruppe (DIN 8580)',
  materialClass: 'Werkstoffklasse',
  property: 'Eigenschaft',
  // Historia (Geschichte) — Zeit/Urheberschaft. region/nationality/field s. o.
  inventor: 'Erfinder',
  discoverer: 'Entdecker',
  knownFor: 'Bekannt für',
  protagonist: 'Hauptakteur',
  explorer: 'Entdeckungsreisender',
  precededBy: 'Vorausgehende Epoche',
  field: 'Bereich'
};

/**
 * Liefert den sichtbaren Attributnamen. Der Rohschlüssel `family` wird von
 * Pflanzen und Sprachen geteilt; erst die Kategorie entscheidet, welche
 * fachliche Bezeichnung im Panel steht.
 */
export function getAttributeLabel(key, category = '') {
  if (key === 'family' && category === 'plant') return 'Pflanzenfamilie';
  return ATTR_LABELS[key] || key;
}

// Diese Freitext-Attribute beschreiben das Konzept so konkret, dass sie vor der
// Antwort oft indirekt die Loesung verraten. Sie werden erst als Erklaerung nach
// der Antwort gezeigt.
// 'knownFor' (Historia-Persönlichkeiten) erst nach der Antwort zeigen: der
// Freitext ("Beiträge zur Quantenmechanik") verriete sonst Feld/Nationalität.
export const POST_ANSWER_ATTRS = new Set(['notableFor', 'definition', 'function', 'knownFor', 'characteristic',
  // Klassische Technik: beschreibende Freitexte, die das Konzept vor der Antwort verraten könnten.
  'principle', 'property',
  // Machina: 'purpose' (Zweck) beschreibt die Funktion so konkret, dass es z.B. bei der
  // Algorithmus-Klassen-Frage die Antwort verrät ("Löst lineare Optimierungsprobleme"
  // → Optimierungsalgorithmus). Die eigenen purpose-Fragen zeigen den Wert als Option,
  // nicht im Panel — daher hier gefahrlos vor der Antwort verbergen. (QA-Fund 2026-07-01)
  'purpose']);

// Taxonomisch korrelierte Attribute: Wird z.B. die ORDNUNG gefragt, verraet die
// sichtbare TIERKLASSE die Antwort oft schon (die Distraktoren sind dann Ordnungen
// anderer Klassen — wer "Vögel" sieht, waehlt die einzige Vogel-Ordnung). Daher vor
// der Antwort das jeweils korrelierte Attribut mit ausblenden (in beide Richtungen).
export const CORRELATED_ATTRS = { order: 'class', class: 'order' };

// Fachlich redundante Geschwister-Attribute: Wird der KEY getestet, verraten die
// aufgefuehrten VALUES die Antwort schon im Panel — die Lebenszeit "1653–1706"
// nennt das Geburtsjahr, der Perioden-String "1905–1913" das Startjahr, die
// Abkuerzungs-Langform (fullName) buchstabiert Bereich/Datenart/Zweck aus, der
// Entlehnungsweg nennt Herkunftssprache und Ursprungsbedeutung. Solche Geschwister
// werden vor der Antwort ZUSAETZLICH zum getesteten Attribut ausgeblendet.
// (QA-Fund 2026-07-01, Panel-Leaks). Wichtig: Es wird nur die SICHTBARE Anzeige
// gefiltert — die Rohdaten bleiben unveraendert, dieselben Attribute sind fuer
// ANDERE Fragen desselben Konzepts weiterhin legitim.
export const LEAKY_SIBLINGS = {
  // Personen-Lebensdaten: 'lifespan' nennt Geburts- UND Todesjahr im Klartext.
  birthYear: ['lifespan'],
  deathYear: ['lifespan'],
  // Kunstrichtungen/Epochen: Perioden-String und Hauptvertreter datieren die Richtung.
  startYear: ['period', 'mainRepresentatives'],
  endYear: ['period', 'mainRepresentatives'],
  period: ['startYear', 'endYear', 'mainRepresentatives'],
  // Wortherkunft: die vier Etymologie-Attribute verraten sich gegenseitig.
  sourceLanguage: ['loanPath', 'originalMeaning', 'loanEra'],
  originalMeaning: ['loanPath', 'sourceLanguage', 'loanEra'],
  loanPath: ['sourceLanguage', 'originalMeaning', 'loanEra'],
  loanEra: ['loanPath', 'sourceLanguage', 'originalMeaning'],
  // Herkunftsland: Lage ("Galleria Borghese, Rom") bzw. Erfinder verraten das Land.
  country: ['location', 'inventor'],
  // Abkuerzungs-Langform buchstabiert Bereich/Datenart/Zweck aus; die Klammer in
  // avgComplexity ("O(n) (Stromchiffre)") verraet den Zweck.
  domain: ['fullName'],
  mediaType: ['fullName'],
  purpose: ['fullName', 'avgComplexity'],
  // Homo Welle 5: Beweglichkeit ("dreiachsig") verraet den Gelenktyp (Kugelgelenk);
  // Reiz/Reaktion legen die Reflexart nahe; Antigen und Antikoerper sind bei den
  // Blutgruppen komplementaer -> jeweils das Geschwister vor der Antwort ausblenden.
  jointType: ['movement'],
  reflexType: ['stimulus', 'response'],
  antibody: ['antigen'],
  antigen: ['antibody']
};

/**
 * Selbstverraeter-Guard: Soll das Attribut `key` VOR der Antwort im Panel verborgen
 * werden, wenn `testedAttribute` gefragt ist? Kapselt alle vier Regeln, damit
 * ConceptVisual.jsx (Quiz-Panel) und build_batches.mjs (QA-Harness) exakt dieselbe
 * Logik nutzen und nicht auseinanderdriften.
 */
export function isAttrLeakedBeforeAnswer(key, testedAttribute) {
  if (key === testedAttribute) return true;                    // das gefragte Attribut selbst
  if (CORRELATED_ATTRS[testedAttribute] === key) return true;  // taxonomisch korreliert (order<->class)
  if (POST_ANSWER_ATTRS.has(key)) return true;                 // Freitext-Details generell erst nach Antwort
  const siblings = LEAKY_SIBLINGS[testedAttribute];            // fachlich redundante Geschwister
  return Boolean(siblings && siblings.includes(key));
}

// Diakritika-robuste Normalisierung fuer Text-Vergleiche ("Dvořák" -> "dvorak").
function normalizeForMatch(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Quellen-Selbstverraeter-Guard: Verraet der Quellname `sourceName` den gefragten
 * Wert `testedValue`? Frueher exakte Substring-Pruefung (`includes`) — die scheiterte
 * an Diakritika ("… (Dvořák)" vs. keyed "Antonin Dvorak") und an keyed-Werten, die
 * LAENGER als das Quellfragment sind ("Reinhold Messner und Peter Habeler" vs. Quelle
 * "… Reinhold Messner"). Jetzt diakritika-robust und tokenweise: ein markantes
 * Wort-Token (>=4 Zeichen) des gefragten Werts im Quellnamen genuegt. (QA-Fund 2026-07-01)
 */
export function sourceRevealsValue(sourceName, testedValue) {
  if (testedValue == null) return false;
  const val = normalizeForMatch(testedValue);
  if (val.length < 3) return false;
  const src = normalizeForMatch(sourceName);
  if (src.includes(val)) return true;   // ganzer Wert (kurze Werte, Jahreszahlen)
  const tokens = val.split(/[^a-z0-9]+/).filter(t => t.length >= 4);
  return tokens.some(t => src.includes(t));
}
