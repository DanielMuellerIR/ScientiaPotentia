import React from 'react';
import { ArrowRight, Images as ImagesIcon, Layers, Map as MapIcon } from 'lucide-react';

/**
 * Scientia-Startbildschirm ("Hub"). Ersetzt das frühere Dashboard des
 * Mischbereichs als Landing: statt einer scrollenden Karteikarten-Aufschlüsselung
 * führt es Besucher optisch ansprechend zu den einzelnen Wissensbereichen ODER
 * zum domänenübergreifenden Querbeet-Quiz.
 *
 * Kernidee: Jede Bereichs-
 * karte nennt dynamisch die Anzahl Fragen, Konzepte und freier Bilder aus dem
 * generierten Manifest (public/data/domain_stats.json), damit sofort klar wird,
 * wie umfangreich das Quiz ist.
 *
 * Props:
 *   - domains:          Array der Domain-Registry (inkl. "scientia" selbst)
 *   - stats:            geladenes Manifest { totals, domains } oder null (lädt noch)
 *   - onSelectDomain:   (domainId) => void  — wechselt in den gewählten Bereich
 *   - onStartMixedQuiz: () => void          — öffnet das Querbeet-Quiz (Mischpool ohne Terra)
 */
export default function ScientiaHub({ domains = [], stats = null, onSelectDomain, onStartMixedQuiz }) {
  // Der Mischbereich selbst liefert die Texte/Farbe für das Querbeet-Angebot;
  // die Karten zeigen nur die echten Fachbereiche (Terra … Historia).
  const scientia = domains.find(d => d.id === 'scientia');
  const areaDomains = domains.filter(d => d.id !== 'scientia');

  // Zahl deutsch gruppieren; solange das Manifest lädt, dezenter Platzhalter.
  const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('de-DE') : '…');

  const totals = stats?.totals;
  const CtaIcon = scientia?.Icon || Layers;

  // Gesamtkennzahlen des Hero-Bereichs (macht den Umfang auf einen Blick sichtbar).
  const heroTotals = [
    { key: 'questions', label: 'Fragen', value: totals?.questions },
    { key: 'concepts', label: 'Konzepte', value: totals?.concepts },
    { key: 'images', label: 'Freie Bilder', value: totals?.images },
    { key: 'domains', label: 'Wissensbereiche', value: totals?.domains }
  ];

  return (
    <div className="scientia-hub terra-panel slide-in">
      <div className="scientia-hub-scroll">
        {/* Hero: Leitspruch, Anspruch und Gesamtzahlen */}
        <header className="scientia-hub-hero">
          <p className="scientia-hub-kicker">Scientia potentia est · Wissen ist Macht</p>
          <h1 className="scientia-hub-title">
            Ein Quiz, {fmt(totals?.domains)} Wissensbereiche
          </h1>
          <p className="scientia-hub-lede">
            Von den Sternen über den menschlichen Körper bis zu Sprachen, Kultur und
            Technik — wähle einen Bereich zum Vertiefen oder starte das Querbeet-Quiz
            quer durch alles.
          </p>
          <dl className="scientia-hub-totals">
            {heroTotals.map(t => (
              <div key={t.key} className="scientia-hub-total">
                <dt className="scientia-hub-total-label">{t.label}</dt>
                <dd className="scientia-hub-total-value">{fmt(t.value)}</dd>
              </div>
            ))}
          </dl>
        </header>

        {/* Primäres Angebot: das domänenübergreifende Querbeet-Quiz */}
        <button
          type="button"
          className="scientia-hub-cta"
          style={{ '--accent': scientia?.accent || 'var(--color-secondary)' }}
          onClick={onStartMixedQuiz}
        >
          <span className="scientia-hub-cta-icon" aria-hidden="true">
            <CtaIcon size={26} />
          </span>
          <span className="scientia-hub-cta-text">
            {/* Kein pauschales "alle Bereiche": Terra ist nicht im Mischpool
                (SCIENTIA_MIX_IDS), seine Kartenfragen brauchen die Weltkarte. */}
            <span className="scientia-hub-cta-title">Querbeet · alle Bereiche außer Geografie</span>
            <span className="scientia-hub-cta-desc">
              {scientia?.description || 'Fragen quer durch alle Wissensbereiche außer Geografie.'}
            </span>
          </span>
          <span className="scientia-hub-cta-go">
            Quiz starten <ArrowRight size={18} aria-hidden="true" />
          </span>
        </button>

        <h2 className="scientia-hub-section">Wissensbereiche erkunden</h2>

        {/* Karten-Grid: eine Karte je Fachbereich mit dynamischen Kennzahlen */}
        <div className="scientia-hub-grid">
          {areaDomains.map(d => {
            const Icon = d.Icon;
            const s = stats?.domains?.[d.id];
            // Terra führt "Orte" (Länder/Städte/Flüsse) statt bebilderter Karteikarten
            // und wird über die Weltkarte dargestellt — darum ein Karten-Chip statt Bildzahl.
            const isTerra = d.id === 'terra';
            const conceptNoun = isTerra ? 'Orte' : 'Konzepte';
            const showMapChip = Boolean(s?.hasMap);

            // Sprechendes ARIA-Label mit den Kennzahlen (für Screenreader).
            const ariaParts = [`${d.latinName}: ${d.label}`];
            if (s) {
              ariaParts.push(`${fmt(s.questions)} Fragen`);
              ariaParts.push(`${fmt(s.concepts)} ${conceptNoun}`);
              ariaParts.push(showMapChip ? 'mit Weltkarte' : `${fmt(s.images)} freie Bilder`);
            }

            return (
              <button
                key={d.id}
                type="button"
                className="scientia-hub-card"
                style={{ '--accent': d.accent }}
                onClick={() => onSelectDomain(d.id)}
                aria-label={ariaParts.join(', ')}
              >
                <span className="scientia-hub-card-head">
                  <span className="scientia-hub-card-icon" aria-hidden="true">
                    {Icon ? <Icon size={22} /> : null}
                  </span>
                  <span className="scientia-hub-card-heading">
                    <span className="scientia-hub-card-name">{d.latinName}</span>
                    <span className="scientia-hub-card-label">{d.label}</span>
                  </span>
                  <ArrowRight className="scientia-hub-card-arrow" size={16} aria-hidden="true" />
                </span>

                <span className="scientia-hub-card-desc">{d.description}</span>

                <span className="scientia-hub-card-stats" aria-hidden="true">
                  <span className="scientia-hub-stat scientia-hub-stat--primary">
                    <span className="scientia-hub-stat-value">{fmt(s?.questions)}</span>
                    <span className="scientia-hub-stat-label">Fragen</span>
                  </span>
                  <span className="scientia-hub-stat">
                    <span className="scientia-hub-stat-value">{fmt(s?.concepts)}</span>
                    <span className="scientia-hub-stat-label">{conceptNoun}</span>
                  </span>
                  <span className="scientia-hub-stat">
                    {showMapChip ? (
                      <>
                        <MapIcon className="scientia-hub-stat-glyph" size={15} />
                        <span className="scientia-hub-stat-label">Weltkarte</span>
                      </>
                    ) : (
                      <>
                        <span className="scientia-hub-stat-value">
                          <ImagesIcon className="scientia-hub-stat-glyph" size={13} />
                          {fmt(s?.images)}
                        </span>
                        <span className="scientia-hub-stat-label">Bilder</span>
                      </>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
