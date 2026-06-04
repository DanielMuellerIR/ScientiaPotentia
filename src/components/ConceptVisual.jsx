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
  species: 'Menschenart'
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
  distanceLy: 'Entfernung (Lj)'
};

export default function ConceptVisual({ domain, concept }) {
  const Icon = domain.Icon;
  const accent = domain.accent || 'var(--color-primary)';

  const categoryKey = concept?.category || concept?.type || '';
  const categoryLabel = CATEGORY_LABELS[categoryKey] || categoryKey;

  // Attribute als Liste aufbereiten; rein technische Schluessel ausblenden.
  const attrs = concept?.attributes || {};
  const attrEntries = Object.entries(attrs).filter(
    ([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'unit'
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
          {concept?.name || '—'}
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

        {/* Fun-Fact */}
        {concept?.funFact ? (
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
