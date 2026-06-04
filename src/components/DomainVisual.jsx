import React from 'react';

/**
 * Generisches Visualisierungs-Panel fuer Domains OHNE interaktive Karte
 * (alles ausser Terra in Phase 1). Fuellt den linken Panel-Bereich, der bei
 * Terra die Weltkarte zeigt, mit einem themenbezogenen Ueberblick:
 * Bereichstitel, Beschreibung und eine Aufschluesselung der Konzept-Kategorien
 * inkl. Lernfortschritt.
 *
 * Phase 2 ersetzt dies pro Domain durch echte Visualisierungen
 * (z.B. interaktives Sonnensystem fuer Astra).
 *
 * Props:
 *   - domain:      aktive Domain-Definition (Icon, latinName, label, description, accent)
 *   - concepts:    Map conceptKey -> Konzept der aktiven Domain
 *   - srsProgress: globaler Fortschritt (Map conceptKey -> Fortschritt)
 */
export default function DomainVisual({ domain, concepts = {}, srsProgress = {} }) {
  const Icon = domain.Icon;
  const accent = domain.accent || 'var(--color-primary)';

  // Kategorien aus den Konzepten ableiten (z.B. planet, moon, star ...)
  // und gelernte Konzepte (repetitions > 0) je Kategorie zaehlen.
  const cats = {};
  Object.entries(concepts).forEach(([key, c]) => {
    const cat = c.category || c.type || 'sonstige';
    cats[cat] ||= { total: 0, studied: 0 };
    cats[cat].total++;
    if (srsProgress[key] && srsProgress[key].repetitions > 0) {
      cats[cat].studied++;
    }
  });

  // Deutsche Labels fuer bekannte Astronomie-Kategorien (Fallback: Schluessel)
  const CATEGORY_LABELS = {
    planet: 'Planeten',
    dwarf_planet: 'Zwergplaneten',
    moon: 'Monde',
    star: 'Sterne',
    galaxy: 'Galaxien',
    constant: 'Konstanten'
  };

  return (
    <div
      className="terra-panel"
      style={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid var(--border-light)',
        // Dezenter "Weltraum"-Verlauf, getoent nach Domain-Akzentfarbe
        background: `radial-gradient(circle at 30% 20%, ${accent}22, transparent 60%), radial-gradient(circle at 80% 70%, ${accent}18, transparent 55%), #0d1326`
      }}
    >
      <div style={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px',
        textAlign: 'center',
        color: '#EAE6DC'
      }}>
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '88px', height: '88px', borderRadius: '50%',
          background: `${accent}33`,
          border: `1px solid ${accent}88`,
          boxShadow: `0 0 40px ${accent}66`,
          marginBottom: '20px'
        }}>
          <Icon size={44} style={{ color: '#fff' }} />
        </span>

        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '30px', fontWeight: 700, margin: 0, letterSpacing: '1px' }}>
          {domain.latinName}
        </h2>
        <div style={{ fontSize: '14px', opacity: 0.7, marginBottom: '8px' }}>{domain.label}</div>
        <p style={{ fontSize: '14px', maxWidth: '420px', opacity: 0.85, lineHeight: 1.5, marginBottom: '28px' }}>
          {domain.description}
        </p>

        {/* Kategorie-Uebersicht mit Lernfortschritt */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          width: '100%',
          maxWidth: '440px'
        }}>
          {Object.entries(cats).map(([cat, data]) => {
            const pct = data.total > 0 ? Math.round((data.studied / data.total) * 100) : 0;
            return (
              <div key={cat} style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px',
                padding: '10px 12px',
                textAlign: 'left',
                backdropFilter: 'blur(8px)'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{CATEGORY_LABELS[cat] || cat}</div>
                <div style={{ fontSize: '11.5px', opacity: 0.7 }}>
                  {data.studied} / {data.total} gelernt · {pct}%
                </div>
                <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.12)', marginTop: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: accent }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
