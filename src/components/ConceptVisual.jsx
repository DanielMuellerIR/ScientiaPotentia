import React, { useState, useEffect } from 'react';
// Label-Tabellen und Selbstverraeter-Guard-Mengen liegen zentral in conceptLabels.js
// (geteilt mit Dashboard-Aufschluesselung und den QA-Werkzeugen).
import { CATEGORY_LABELS, ATTR_LABELS, isAttrLeakedBeforeAnswer, sourceRevealsValue } from './conceptLabels';
// Commons-Dateiseite -> direkter, skalierter Bild-Link (geteilt mit Museum/Galerie).
import { commonsToDirectUrl } from '../utils/commonsImage';

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

  // Quiz-Exponat: Hat das Konzept ein geerntetes Bild, haengt es als gerahmtes,
  // VERHUELLTES Exponat im Panel und wird erst nach der Antwort enthuellt.
  // Konservativ leak-frei: Das Bild ist grundsaetzlich vor der Antwort unsichtbar
  // (Samttuch), egal ob die Frage die Identitaet oder ein Attribut testet.
  // Es laedt aber schon hinter dem Tuch, damit die Enthuellung nicht ruckelt.
  const image = concept?.image;
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => { setImgFailed(false); }, [concept?.id, concept?.name]);
  const showExhibit = Boolean(image?.url) && !imgFailed;

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
        (detailsUnlocked || !isAttrLeakedBeforeAnswer(k, testedAttribute))
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
      // Vorwaertsfragen: Quellname verraet den gefragten Wert (diakritika-robust,
      // tokenweise — siehe sourceRevealsValue in conceptLabels.js).
      sourceRevealsValue(sourceName, testedValue)
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
          // Scroll-sicher zentrieren: margin:auto am inneren Wrapper statt
          // justify-content:center — bei niedrigen Viewports (38vh-Streifen
          // auf dem Handy) wird gescrollt statt oben abgeschnitten.
          overflowY: 'auto',
          alignItems: 'center',
          padding: '28px 40px',
          textAlign: 'center',
          color: '#EAE6DC'
        }}
      >
        <div style={{ margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>

        {/* Gerahmtes Exponat: Bild laedt hinter dem Samttuch, Enthuellung nach
            der Antwort. Ohne Bild (oder bei Ladefehler) bleibt der bisherige
            Icon-Glow-Kreis erhalten. */}
        {showExhibit ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginBottom: '20px' }}>
            <div className="exhibit-frame">
              <div className="exhibit-mat">
                <img
                  className={detailsUnlocked ? 'exhibit-img exhibit-img--revealed' : 'exhibit-img'}
                  src={commonsToDirectUrl(image.url, 640)}
                  // Vor der Antwort auch im alt-Text nichts verraten.
                  alt={detailsUnlocked ? (concept?.name || 'Exponat') : 'Verhülltes Exponat'}
                  onError={() => setImgFailed(true)}
                />
              </div>
              <div className={detailsUnlocked ? 'exhibit-drape exhibit-drape--lifted' : 'exhibit-drape'} aria-hidden={detailsUnlocked}>
                <span className="exhibit-drape-q">?</span>
              </div>
            </div>
            {/* Bildlizenz sichtbar im Panel, sobald das Bild sichtbar ist. */}
            {detailsUnlocked && (image.license || image.attribution) ? (
              <div
                className="exhibit-credit"
                title={`Bild: ${[image.attribution, image.license].filter(Boolean).join(' · ')} · Wikimedia Commons`}
              >
                Bild: {[image.attribution, image.license].filter(Boolean).join(' · ')} · Wikimedia Commons
              </div>
            ) : null}
          </div>
        ) : (
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
        )}

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

        {/* Quellen-/Lizenzzeile klein am Ende des Inhalts (im Fluss statt absolut,
            damit sie auf niedrigen Viewports nicht den Fun-Fact ueberlappt).
            Verborgen, wenn der Quellname den gefragten Wert enthaelt
            (Selbstverraeter, s. sourceLeaks); nach der Antwort wieder sichtbar. */}
        {showSource ? (
          <div style={{ marginTop: '18px', fontSize: '10.5px', opacity: 0.55 }}>
            Quelle: {concept.source.name}
            {concept.source.license ? ` · ${concept.source.license}` : ''}
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
