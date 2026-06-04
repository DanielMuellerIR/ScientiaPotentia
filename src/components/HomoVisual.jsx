import React from 'react';

/**
 * Homo-Visualisierung: anatomische Übersichtsgrafik pro Quizfrage.
 *
 * Zeigt links zur aktuellen Frage eine passende, gemeinfreie Anatomiegrafik
 * (Wikimedia Commons, Public Domain) — je Konzept-Kategorie eine Darstellung:
 *   Knochen   -> Skelett
 *   Muskel    -> Muskulatur
 *   Organ     -> innere Organe
 *   Körperwert-> Körperschema
 *   Menschenart-> Skelett (Fallback)
 *
 * Phase 2d — konzeptgenaue Hervorhebung: Liegt die gefragte Struktur an einer
 * bekannten Körperstelle, blendet ein pulsierender Ring genau dort auf der Grafik
 * ein (z.B. Femur am Oberschenkel, Herz im Brustkorb). Die Skizzen aus Wikimedia
 * tragen leider keine maschinenlesbaren Struktur-IDs, darum arbeiten wir mit einer
 * kalibrierten Koordinatentabelle: bekannte Konzepte exakt (MARKER_BY_ID), neue
 * Konzepte fallen automatisch auf das Zentrum ihrer Region/Lage zurück (ZONES).
 * Ganzkörper-Fakten (Körperwerte, Menschenarten, Haut) bekommen bewusst keinen
 * Punkt — sie haben keine einzelne Stelle.
 *
 * Eine kleine Lizenzzeile weist Quelle und Lizenz jedes Assets aus.
 *
 * Props (von VisualPanel): domain, concepts, srsProgress, activeConcept.
 */

const ASSET_BASE = 'assets/homo/';

// Kategorie -> Grafik + Provenienz (alle Public Domain, Wikimedia Commons) +
// Seitenverhältnis (Breite/Höhe) der Originaldatei (zur Doku; die Marker sitzen
// passgenau, weil das Bild selbst per height:100%/width:auto sein Verhältnis vorgibt).
const CATEGORY_ASSET = {
  bone:      { file: 'skeleton.svg',  author: 'Mikael Häggström', aspect: 435.687 / 841.89 },
  muscle:    { file: 'muscles.png',   author: 'nach Bouglé',      aspect: 1014 / 3006 },
  organ:     { file: 'organs.svg',    author: 'Mikael Häggström', aspect: 1363 / 1212 },
  body_fact: { file: 'body.svg',      author: 'Mikael Häggström', aspect: 1363 / 1234 },
  species:   { file: 'skeleton.svg',  author: 'Mikael Häggström', aspect: 435.687 / 841.89 }
};
const DEFAULT_ASSET = CATEGORY_ASSET.body_fact;

const CATEGORY_LABELS = {
  bone: 'Knochen', muscle: 'Muskel', organ: 'Organ',
  body_fact: 'Körperwert', species: 'Menschenart'
};

const ATTR_LABELS = {
  region: 'Region', latinName: 'Lateinisch', notableFor: 'Bekannt für',
  location: 'Lage', system: 'Organsystem', approxWeightGrams: 'Gewicht (g)',
  value: 'Wert', epoch: 'Zeitraum',
  // Phase-5-Keys, die sonst als rohe englische Schlüssel ('function',
  // 'definition') im Chip durchsickern würden.
  function: 'Funktion', definition: 'Definition'
};

// --- Marker-Koordinaten ---------------------------------------------------
// Normierte Position (0..1) IM JEWEILIGEN GRAFIK-RAHMEN: x = links->rechts,
// y = oben->unten. Pro Kategorie-Grafik ein eigenes Koordinatensystem.

// Exakte Treffer für die bekannten Konzepte (id ohne "homo:"-Präfix).
const MARKER_BY_ID = {
  // Knochen auf dem Skelett (stehende Figur, Kopf oben, Füße unten)
  cranium:    { x: 0.50, y: 0.06 }, mandibula: { x: 0.50, y: 0.10 },
  stapes:     { x: 0.56, y: 0.07 }, clavicula: { x: 0.40, y: 0.16 },
  scapula:    { x: 0.37, y: 0.20 }, sternum:   { x: 0.50, y: 0.24 },
  vertebra:   { x: 0.50, y: 0.30 }, humerus:   { x: 0.31, y: 0.28 },
  ulna:       { x: 0.27, y: 0.40 }, radius:    { x: 0.31, y: 0.40 },
  pelvis:     { x: 0.50, y: 0.42 }, femur:     { x: 0.44, y: 0.54 },
  patella:    { x: 0.45, y: 0.66 }, tibia:     { x: 0.46, y: 0.78 },
  fibula:     { x: 0.42, y: 0.78 },
  // Muskeln auf der Muskelfigur (anterior, sehr hochformatig)
  masseter:        { x: 0.50, y: 0.085 }, stapedius:      { x: 0.54, y: 0.065 },
  deltoideus:      { x: 0.36, y: 0.175 }, myocardium:     { x: 0.47, y: 0.235 },
  biceps_brachii:  { x: 0.32, y: 0.245 }, triceps_brachii:{ x: 0.30, y: 0.245 },
  diaphragma:      { x: 0.50, y: 0.275 }, gluteus_maximus:{ x: 0.50, y: 0.40 },
  sartorius:       { x: 0.45, y: 0.52 },  gastrocnemius:  { x: 0.44, y: 0.75 },
  // Organe auf dem Organ-Torso (beschriftetes Schema, fast quadratisch)
  gehirn: { x: 0.50, y: 0.13 }, herz:    { x: 0.50, y: 0.42 },
  lunge:  { x: 0.42, y: 0.40 }, leber:   { x: 0.41, y: 0.55 },
  magen:  { x: 0.56, y: 0.55 }, milz:    { x: 0.60, y: 0.50 },
  pankreas:{ x: 0.57, y: 0.60 }, nieren: { x: 0.50, y: 0.63 },
  blase:  { x: 0.50, y: 0.83 },
  // Phase-5-Organe (Lage im Organ-Torso)
  schilddruese: { x: 0.50, y: 0.22 }, gallenblase: { x: 0.43, y: 0.57 },
  nebenniere:   { x: 0.50, y: 0.58 }, thymus:      { x: 0.50, y: 0.33 },
  zunge:        { x: 0.50, y: 0.16 }
  // haut: bewusst ohne Marker (ganzer Körper, keine einzelne Stelle)
};

// Region/Lage-Zentren als Rückfall für NEUE Konzepte ohne id-Eintrag.
// Knochen: exakte Regionswerte (Kopf/Rumpf/Arm/Bein/Hand/Fuss) -> Skelett.
const BONE_ZONES = {
  kopf:  { x: 0.50, y: 0.07 }, rumpf: { x: 0.50, y: 0.30 },
  arm:   { x: 0.30, y: 0.34 }, hand:  { x: 0.22, y: 0.50 },
  bein:  { x: 0.45, y: 0.66 }, fuss:  { x: 0.46, y: 0.95 }
};
// Muskeln: freie Lage-Texte per Stichwort -> Muskelfigur.
const MUSCLE_ZONES = [
  [/auge|lid/,                      { x: 0.50, y: 0.065 }],
  [/mund|lippe/,                    { x: 0.50, y: 0.10 }],
  [/zunge|mundboden/,               { x: 0.50, y: 0.115 }],
  [/kopf|kiefer|wange|gesicht|kau/, { x: 0.50, y: 0.085 }],
  [/ohr/,                           { x: 0.54, y: 0.065 }],
  [/hals|nacken/,                   { x: 0.47, y: 0.135 }],
  [/schulter/,                      { x: 0.36, y: 0.175 }],
  [/rippe|interkostal|intercostal/, { x: 0.50, y: 0.26 }],
  [/brust|herz/,                    { x: 0.46, y: 0.23 }],
  [/zwischen brust|zwerchfell/,     { x: 0.50, y: 0.275 }],
  [/lende|psoas/,                   { x: 0.50, y: 0.345 }],
  [/bauch|rumpf/,                   { x: 0.50, y: 0.30 }],
  [/rücken|rueck/,                  { x: 0.50, y: 0.27 }],
  [/gesäß|gesaess|hüfte|huefte/,    { x: 0.50, y: 0.40 }],
  [/oberarm/,                       { x: 0.32, y: 0.245 }],
  [/unterarm/,                      { x: 0.27, y: 0.34 }],
  [/hand/,                          { x: 0.20, y: 0.40 }],
  [/oberschenkel/,                  { x: 0.45, y: 0.52 }],
  [/unterschenkel|wade|schienbein/, { x: 0.44, y: 0.74 }],
  [/fuß|fuss/,                      { x: 0.46, y: 0.96 }]
];
// Organe: Organsystem per Stichwort -> grobe Lage im Torso (neue Systeme der
// Phase 5 weichen im Wortlaut ab, z.B. „Verdauungssystem" statt „Verdauung").
const ORGAN_ZONES = [
  [/nerven|gehirn/,            { x: 0.50, y: 0.13 }],
  [/sinnes|sehen|auge/,        { x: 0.50, y: 0.13 }],
  [/atmung|atem|respirat/,     { x: 0.46, y: 0.38 }],
  [/herz|kreislauf|blut/,      { x: 0.50, y: 0.45 }],
  [/endokrin|hormon|drüse|druese/, { x: 0.50, y: 0.30 }],
  [/lymph|immun/,              { x: 0.55, y: 0.42 }],
  [/verdau|gastro/,            { x: 0.50, y: 0.60 }],
  [/ausscheid|harn|uro|niere/, { x: 0.50, y: 0.70 }]
];

/** Bestimmt die Marker-Position für das aktive Konzept (oder null = kein Punkt). */
function resolveMarker(concept) {
  if (!concept) return null;
  const id = (concept.id || '').replace(/^homo:/, '');
  if (MARKER_BY_ID[id]) return MARKER_BY_ID[id];

  const cat = concept.category || concept.type;
  const a = concept.attributes || {};
  if (cat === 'bone') {
    return BONE_ZONES[String(a.region || '').toLowerCase().replace(/ß/g, 'ss')] || null;
  }
  if (cat === 'muscle') {
    const loc = String(a.location || '').toLowerCase();
    const hit = MUSCLE_ZONES.find(([re]) => re.test(loc));
    return hit ? hit[1] : null;
  }
  if (cat === 'organ') {
    const sys = String(a.system || '').toLowerCase();
    const hit = ORGAN_ZONES.find(([re]) => re.test(sys));
    return hit ? hit[1] : null;
  }
  return null; // body_fact, species, Haut -> Ganzkörper, kein Einzelpunkt
}

export default function HomoVisual({ domain, concepts = {}, srsProgress = {}, activeConcept, testedAttribute, answerIsName }) {
  const accent = domain.accent || '#A14D5A';

  // Ohne aktive Frage: ruhige Themen-Darstellung (Skelett) als Standbild.
  const cat = activeConcept?.category || activeConcept?.type;
  const asset = (cat && CATEGORY_ASSET[cat]) || DEFAULT_ASSET;
  const catLabel = CATEGORY_LABELS[cat] || cat || '';

  // Selbstverräter-Schutz: Bei Reverse-Fragen (die Antwort IST der Name) bzw.
  // bei Fragen nach Lage/Region/System würde der pulsierende Marker die Stelle
  // — und damit die Antwort — verraten. In diesen Fällen Marker unterdrücken.
  // Defensiver Default: sind die neuen Props undefined, greift nichts und der
  // Marker verhält sich exakt wie bisher.
  const markerLeaks =
    answerIsName ||
    testedAttribute === 'region' ||
    testedAttribute === 'location' ||
    testedAttribute === 'system';
  const marker = markerLeaks ? null : resolveMarker(activeConcept);

  const attrs = activeConcept?.attributes || {};
  // Chip-Auswahl mit Verräter-Schutz:
  //  - answerIsName -> gar keine Chips (jeder Wert könnte zum Namen führen).
  //  - sonst das aktuell gefragte Attribut (testedAttribute) herausfiltern,
  //    damit der Chip die Antwort nicht direkt anzeigt.
  // Erst filtern, dann auf max. 4 Chips kürzen.
  const attrEntries = answerIsName
    ? []
    : Object.entries(attrs)
        .filter(([k, v]) =>
          v !== undefined && v !== null && v !== '' &&
          k !== 'unit' && k !== testedAttribute)
        .slice(0, 4);

  return (
    <div
      className="terra-panel"
      style={{
        height: '100%', position: 'relative', overflow: 'hidden',
        border: '1px solid var(--border-light)',
        // Helles, anatomisch lesbares Panel (Grafiken sind farbig auf hell/transparent).
        background: `radial-gradient(circle at 50% 35%, #fbf7f1, #e7ddd4 70%, #d8cdc4)`
      }}
    >
      {/* Pulsier-Animation für den Marker (einmal als Stylesheet eingebettet). */}
      <style>{`
        @keyframes homoPulse {
          0%   { transform: translate(-50%, -50%) scale(0.6); opacity: 0.9; }
          70%  { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
        }
      `}</style>

      {/* Anatomiegrafik im aspektgenauen Rahmen (damit Marker passgenau sitzen) */}
      <div style={{
        position: 'absolute', inset: '64px 24px 56px', display: 'flex',
        alignItems: 'center', justifyContent: 'center'
      }}>
        {/* Wrapper schrumpft exakt auf das Bild: das Bild gibt per height:100% +
            width:auto sein Seitenverhältnis vor, der Wrapper (Flex-Item) wird
            genau so breit. Dadurch ist die Marker-Position (% des Wrappers)
            deckungsgleich mit der Grafik — kein Letterboxing dazwischen. */}
        <div style={{ position: 'relative', height: '100%', display: 'flex' }}>
          <img
            src={`${ASSET_BASE}${asset.file}`}
            alt={catLabel || 'Anatomie'}
            style={{
              display: 'block', height: '100%', width: 'auto', maxWidth: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.25))'
            }}
          />

          {/* Konzeptgenaue Hervorhebung: pulsierender Ring genau auf der Struktur */}
          {marker && (
            <div style={{
              position: 'absolute', left: `${marker.x * 100}%`, top: `${marker.y * 100}%`,
              width: 0, height: 0, pointerEvents: 'none'
            }}>
              {/* aufsteigende Pulswelle */}
              <span style={{
                position: 'absolute', left: 0, top: 0, width: '34px', height: '34px',
                borderRadius: '50%', border: `2px solid ${accent}`,
                animation: 'homoPulse 1.8s ease-out infinite'
              }} />
              {/* fester Ring + Kern */}
              <span style={{
                position: 'absolute', left: 0, top: 0, transform: 'translate(-50%, -50%)',
                width: '24px', height: '24px', borderRadius: '50%',
                border: `2.5px solid ${accent}`, boxShadow: `0 0 12px ${accent}, inset 0 0 6px ${accent}aa`,
                background: `${accent}22`
              }} />
              <span style={{
                position: 'absolute', left: 0, top: 0, transform: 'translate(-50%, -50%)',
                width: '7px', height: '7px', borderRadius: '50%', background: accent,
                boxShadow: `0 0 6px ${accent}`
              }} />
            </div>
          )}
        </div>
      </div>

      {activeConcept && (
        <>
          {/* Kopf: Kategorie + Name */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, padding: '20px 24px',
            textAlign: 'center', pointerEvents: 'none',
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.85), transparent)'
          }}>
            {catLabel && (
              <div style={{
                display: 'inline-block', fontSize: '11px', fontWeight: 700,
                letterSpacing: '1.5px', textTransform: 'uppercase',
                padding: '3px 12px', borderRadius: '999px', color: '#fff',
                background: accent, marginBottom: '8px'
              }}>{catLabel}</div>
            )}
            {/* Bei Reverse-Fragen (answerIsName) ist der Konzeptname die gesuchte
                Antwort -> statt des Namens nur einen neutralen Platzhalter „?"
                zeigen. Default (Prop undefined/falsy): Name normal anzeigen. */}
            <h2 style={{
              fontFamily: 'var(--font-title)', fontSize: '28px', fontWeight: 700,
              margin: 0, color: 'var(--color-primary)', letterSpacing: '0.3px'
            }}>{answerIsName ? '?' : activeConcept.name}</h2>
          </div>

          {/* Fuß: Kennwerte + Fun-Fact */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 22px 26px',
            pointerEvents: 'none',
            background: 'linear-gradient(to top, rgba(255,255,255,0.9), transparent)'
          }}>
            {attrEntries.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '8px' }}>
                {attrEntries.map(([k, v]) => (
                  <span key={k} style={{
                    fontSize: '12px', padding: '4px 10px', borderRadius: '6px',
                    background: 'rgba(27,48,91,0.07)', border: '1px solid rgba(27,48,91,0.15)',
                    color: 'var(--color-primary)'
                  }}>
                    <span style={{ opacity: 0.65 }}>{ATTR_LABELS[k] || k}: </span>
                    <b>{String(v)}{k === 'value' && attrs.unit ? ` ${attrs.unit}` : ''}</b>
                  </span>
                ))}
              </div>
            )}
            {/* Fun-Fact bei Reverse-Fragen ausblenden — er nennt oft den
                Konzeptnamen oder umschreibt ihn so deutlich, dass er die
                gesuchte Antwort verrät. Default (Prop falsy): normal zeigen. */}
            {!answerIsName && activeConcept.funFact && (
              <p style={{
                fontSize: '12.5px', color: 'var(--text-muted)', maxWidth: '460px',
                margin: '0 auto', textAlign: 'center', fontStyle: 'italic'
              }}>{activeConcept.funFact}</p>
            )}
          </div>
        </>
      )}

      {/* Lizenzzeile klein unten rechts */}
      <div style={{
        position: 'absolute', bottom: 0, right: 0, padding: '3px 9px',
        fontSize: '10px', color: 'var(--text-muted)', pointerEvents: 'none'
      }}>
        Gemeinfrei · {asset.author} · Wikimedia Commons
      </div>
    </div>
  );
}
