import React from 'react';
// Label-Tabellen und Selbstverraeter-Guard-Mengen liegen zentral in conceptLabels.js
// (geteilt mit Dashboard-Aufschluesselung und den QA-Werkzeugen).
import { CATEGORY_LABELS, ATTR_LABELS, POST_ANSWER_ATTRS, CORRELATED_ATTRS } from './conceptLabels';

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
        (detailsUnlocked || (k !== testedAttribute && k !== CORRELATED_ATTRS[testedAttribute] && !POST_ANSWER_ATTRS.has(k)))
    );

  // Quellen-Selbstverraeter-Guard: Manche Quellnamen enthalten den gefragten Wert
  // (z.B. "Grzimeks Tierleben – Vögel" bei der Tierklassen-Frage). Vor der Antwort
  // die Quellzeile dann verbergen; nach der Antwort (detailsUnlocked) wieder zeigen.
  const testedValue = testedAttribute != null ? attrs[testedAttribute] : null;
  const sourceName = concept?.source?.name || '';
  const sourceLeaks =
    !detailsUnlocked && (
      // Reverse-/Namensfragen: Identitaet ist verborgen -> Quelle des versteckten
      // Konzepts (z.B. "… – Amphibien") koennte sie mitverraten.
      hideIdentity ||
      // Vorwaertsfragen: Quellname enthaelt den gefragten Wert direkt.
      (testedValue != null && String(testedValue).length >= 3 && sourceName.includes(String(testedValue)))
    );
  const showSource = Boolean(sourceName) && !sourceLeaks;

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

      {/* Quellen-/Lizenzzeile klein unten. Verborgen, wenn der Quellname den
          gefragten Wert enthaelt (Selbstverraeter, s. sourceLeaks); nach der
          Antwort wieder sichtbar. */}
      {showSource ? (
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
