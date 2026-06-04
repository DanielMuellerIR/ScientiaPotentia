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
 * Die konkrete gefragte Struktur wird im Overlay benannt (Name, Kategorie,
 * Kennwerte, Fun-Fact); eine konzeptgenaue Hervorhebung einzelner Knochen/
 * Muskeln ist als spätere Erweiterung vorgesehen. Eine kleine Lizenzzeile
 * weist Quelle und Lizenz jedes Assets aus.
 *
 * Props (von VisualPanel): domain, concepts, srsProgress, activeConcept.
 */

const ASSET_BASE = 'assets/homo/';

// Kategorie -> Grafik + Provenienz (alle Public Domain, Wikimedia Commons).
const CATEGORY_ASSET = {
  bone:      { file: 'skeleton.svg',  author: 'Mikael Häggström' },
  muscle:    { file: 'muscles.png',   author: 'nach Bouglé' },
  organ:     { file: 'organs.svg',    author: 'Mikael Häggström' },
  body_fact: { file: 'body.svg',      author: 'Mikael Häggström' },
  species:   { file: 'skeleton.svg',  author: 'Mikael Häggström' }
};
const DEFAULT_ASSET = CATEGORY_ASSET.body_fact;

const CATEGORY_LABELS = {
  bone: 'Knochen', muscle: 'Muskel', organ: 'Organ',
  body_fact: 'Körperwert', species: 'Menschenart'
};

const ATTR_LABELS = {
  region: 'Region', latinName: 'Lateinisch', notableFor: 'Bekannt für',
  location: 'Lage', system: 'Organsystem', approxWeightGrams: 'Gewicht (g)',
  value: 'Wert', epoch: 'Zeitraum'
};

export default function HomoVisual({ domain, concepts = {}, srsProgress = {}, activeConcept }) {
  const accent = domain.accent || '#A14D5A';

  // Ohne aktive Frage: ruhige Themen-Darstellung (Skelett) als Standbild.
  const cat = activeConcept?.category || activeConcept?.type;
  const asset = (cat && CATEGORY_ASSET[cat]) || DEFAULT_ASSET;
  const catLabel = CATEGORY_LABELS[cat] || cat || '';

  const attrs = activeConcept?.attributes || {};
  const attrEntries = Object.entries(attrs)
    .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'unit')
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
      {/* Anatomiegrafik zentriert (hochformatige Figuren -> contain) */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '64px 24px 56px'
      }}>
        <img
          src={`${ASSET_BASE}${asset.file}`}
          alt={catLabel || 'Anatomie'}
          style={{
            maxHeight: '100%', maxWidth: '70%', objectFit: 'contain',
            filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.25))'
          }}
        />
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
            <h2 style={{
              fontFamily: 'var(--font-title)', fontSize: '28px', fontWeight: 700,
              margin: 0, color: 'var(--color-primary)', letterSpacing: '0.3px'
            }}>{activeConcept.name}</h2>
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
            {activeConcept.funFact && (
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
