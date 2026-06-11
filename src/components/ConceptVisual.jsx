import React from 'react';

/**
 * Generische Konzept-Visualisierung fuer das linke Panel.
 *
 * Zeigt das aktuell im Quiz gefragte Konzept als gestaltete Karte: grosser Name,
 * Kategorie-Badge, Kennwerte, Fun-Fact und eine kleine Quellen-/Lizenzzeile.
 * Damit hat JEDE Frage links einen passenden, informativen Inhalt (Grundregel:
 * keine Frage ohne linke Darstellung) — auch fuer Domains, die noch keine eigene
 * 3D-/Vektor-Visualisierung mitbringen.
 *
 * Spezialisierte Domains (z.B. Astra mit 3D-Planeten) ersetzen diese Komponente
 * ueber das Feld domain.Visual in der Registry; bis dahin greift diese Fallback-
 * Darstellung.
 *
 * Props:
 *   - domain:  aktive Domain-Definition (Icon, accent, …)
 *   - concept: das aktuell gefragte Konzept (name, category/type, attributes,
 *              funFact, source)
 */

// Deutsche Labels fuer bekannte Kategorien (Fallback: Roh-Schluessel).
const CATEGORY_LABELS = {
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
  literary_movement: 'Literaturepoche'
};

// Deutsche Labels fuer haeufige Attribut-Schluessel (Fallback: Roh-Schluessel).
const ATTR_LABELS = {
  region: 'Region',
  latinName: 'Lateinisch',
  notableFor: 'Bekannt für',
  location: 'Lage',
  system: 'Organsystem',
  approxWeightGrams: 'Gewicht (g)',
  value: 'Wert',
  unit: 'Einheit',
  epoch: 'Zeitraum',
  type: 'Typ',
  diameterKm: 'Durchmesser (km)',
  distanceAU: 'Entfernung (AE)',
  moons: 'Monde',
  numMoons: 'Anzahl Monde',
  orbitalPeriod: 'Umlaufzeit',
  orderFromSun: 'Position von Sonne',
  dayLengthHours: 'Tageslänge (h)',
  yearLengthEarthDays: 'Jahr (Erdtage)',
  surfaceTempC: 'Oberflächentemp. (°C)',
  mass: 'Masse',
  gravity: 'Schwerkraft',
  hostStar: 'Zentralstern',
  constellation: 'Sternbild',
  distanceLy: 'Entfernung (Lj)',
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
  totalDurationHours: 'Gesamtdauer (h)'
};

// Diese Freitext-Attribute beschreiben das Konzept so konkret, dass sie vor der
// Antwort oft indirekt die Loesung verraten. Sie werden erst als Erklaerung nach
// der Antwort gezeigt.
const POST_ANSWER_ATTRS = new Set(['notableFor', 'definition', 'function']);

// testedAttribute/answerIsName/hideConceptIdentity/isQuestionAnswered:
// Selbstverraeter-Guard (siehe Quiz.jsx). Vor der Antwort werden Identitaet,
// getestete Attribute und Freitext-Details konservativ verborgen; nach der
// Antwort darf das Visual erklaeren.
export default function ConceptVisual({
  domain,
  concept,
  testedAttribute = null,
  answerIsName = false,
  hideConceptIdentity = false,
  isQuestionAnswered = false
}) {
  const Icon = domain.Icon;
  const accent = domain.accent || 'var(--color-primary)';
  const detailsUnlocked = Boolean(isQuestionAnswered);
  const hideIdentity = (answerIsName || hideConceptIdentity) && !detailsUnlocked;

  const categoryKey = concept?.category || concept?.type || '';
  const categoryLabel = CATEGORY_LABELS[categoryKey] || categoryKey;

  // Attribute als Liste aufbereiten; rein technische Schluessel ausblenden.
  // Selbstverraeter-Guard: Vor der Antwort weder den Namen identifizierende
  // Chips (Reverse-Fragen) noch das getestete Attribut oder Freitext-Details
  // zeigen. Nach der Antwort werden sie als Erklaerung freigeschaltet.
  const attrs = concept?.attributes || {};
  const attrEntries = hideIdentity
    ? []
    : Object.entries(attrs).filter(
      ([k, v]) =>
        v !== undefined && v !== null && v !== '' &&
        k !== 'unit' &&
        (detailsUnlocked || (k !== testedAttribute && !POST_ANSWER_ATTRS.has(k)))
    );

  return (
    <div
      className="terra-panel"
      style={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid var(--border-light)',
        background: `radial-gradient(circle at 30% 20%, ${accent}33, transparent 60%), radial-gradient(circle at 80% 75%, ${accent}22, transparent 55%), #0d1326`
      }}
    >
      <div
        style={{
          position: 'relative',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '40px',
          textAlign: 'center',
          color: '#EAE6DC'
        }}
      >
        {/* Domain-Icon im Glow-Kreis */}
        <span
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '96px', height: '96px', borderRadius: '50%',
            background: `${accent}33`,
            border: `1px solid ${accent}aa`,
            boxShadow: `0 0 50px ${accent}77`,
            marginBottom: '22px'
          }}
        >
          {Icon ? <Icon size={48} style={{ color: '#fff' }} /> : null}
        </span>

        {/* Kategorie-Badge */}
        {categoryLabel ? (
          <div
            style={{
              fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px',
              textTransform: 'uppercase', opacity: 0.75,
              padding: '3px 12px', borderRadius: '999px',
              border: `1px solid ${accent}aa`, background: `${accent}22`,
              marginBottom: '12px'
            }}
          >
            {categoryLabel}
          </div>
        ) : null}

        {/* Konzeptname */}
        <h2
          style={{
            fontFamily: 'var(--font-title)', fontSize: '32px', fontWeight: 700,
            margin: 0, letterSpacing: '0.5px', lineHeight: 1.15, maxWidth: '460px'
          }}
        >
          {/* Bei unbeantworteten Reverse-/Fachbegriff-Fragen den Namen verbergen. */}
          {hideIdentity ? '?' : (concept?.name || '—')}
        </h2>

        {/* Kennwerte */}
        {attrEntries.length > 0 ? (
          <div
            style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
              width: '100%', maxWidth: '440px', marginTop: '22px'
            }}
          >
            {attrEntries.slice(0, 6).map(([k, v]) => (
              <div
                key={k}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px', padding: '8px 12px',
                  textAlign: 'left', backdropFilter: 'blur(8px)'
                }}
              >
                <div style={{ fontSize: '10.5px', opacity: 0.6, fontWeight: 600, letterSpacing: '0.4px' }}>
                  {ATTR_LABELS[k] || k}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>
                  {String(v)}{k === 'value' && attrs.unit ? ` ${attrs.unit}` : ''}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Fun-Fact erst nach der Antwort zeigen: Freitext kann Hinweise enthalten. */}
        {detailsUnlocked && concept?.funFact ? (
          <p
            style={{
              fontSize: '13px', maxWidth: '440px', opacity: 0.85,
              lineHeight: 1.5, marginTop: '22px', fontStyle: 'italic'
            }}
          >
            {concept.funFact}
          </p>
        ) : null}
      </div>

      {/* Quellen-/Lizenzzeile klein unten (Provenance immer sichtbar) */}
      {concept?.source?.name ? (
        <div
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '6px 14px', fontSize: '10.5px', opacity: 0.55,
            color: '#EAE6DC', textAlign: 'center',
            background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)'
          }}
        >
          Quelle: {concept.source.name}
          {concept.source.license ? ` · ${concept.source.license}` : ''}
        </div>
      ) : null}
    </div>
  );
}
