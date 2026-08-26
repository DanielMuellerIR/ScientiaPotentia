import React from 'react';
import { CATEGORY_LABELS } from './conceptLabels';

/**
 * Themenübersicht für Domains ohne eigene Karten- oder 3D-Übersicht.
 *
 * Die Zusammenfassung bleibt sichtbar, während die Themenliste ihren eigenen
 * Scrollbereich nutzt. So passen auch die vielen Kategorien des gemischten
 * Scientia-Quiz in das linke Panel, ohne oben oder unten abgeschnitten zu werden.
 */
export default function DomainVisual({ domain, concepts = {}, srsProgress = {} }) {
  const Icon = domain.Icon;
  const accent = domain.accent || '#1B305B';

  const categories = Object.entries(concepts).reduce((groups, [key, concept]) => {
    const category = concept.category || concept.type || 'sonstige';
    groups[category] ||= { total: 0, studied: 0 };
    groups[category].total += 1;
    if (srsProgress[key]?.repetitions > 0) groups[category].studied += 1;
    return groups;
  }, {});

  const categoryEntries = Object.entries(categories)
    .map(([key, data]) => ({
      key,
      label: CATEGORY_LABELS[key] || key.replaceAll('_', ' '),
      ...data,
      percent: data.total > 0 ? Math.round((data.studied / data.total) * 100) : 0
    }))
    // Große Themen stehen zuerst. Bei Gleichstand hält das deutsche Label die
    // Reihenfolge stabil und für Menschen nachvollziehbar.
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'de'));

  const total = categoryEntries.reduce((sum, category) => sum + category.total, 0);
  const studied = categoryEntries.reduce((sum, category) => sum + category.studied, 0);
  const percent = total > 0 ? Math.round((studied / total) * 100) : 0;

  return (
    <section
      className="terra-panel domain-overview"
      style={{
        '--domain-accent': accent,
        '--domain-glow': `${accent}44`
      }}
      aria-labelledby="domain-overview-title"
    >
      <div className="domain-overview-layout">
        <header className="domain-overview-summary">
          <span className="domain-overview-icon" aria-hidden="true">
            <Icon size={38} />
          </span>

          <div className="domain-overview-copy">
            <h2 id="domain-overview-title">{domain.latinName}</h2>
            <div className="domain-overview-label">{domain.label}</div>
            <p>{domain.description}</p>
          </div>

          <div className="domain-overview-total">
            <svg
              className="domain-progress-ring"
              viewBox="0 0 128 128"
              role="img"
              aria-label={`${percent} % entdeckt`}
              data-testid="domain-progress-ring"
            >
              <circle className="domain-progress-ring-track" cx="64" cy="64" r="52" pathLength="100" />
              {percent > 0 && (
                <circle
                  className="domain-progress-ring-value"
                  cx="64"
                  cy="64"
                  r="52"
                  pathLength="100"
                  strokeDasharray={`${percent} 100`}
                />
              )}
              <text className="domain-progress-ring-percent" x="64" y="61" textAnchor="middle">
                {percent}%
              </text>
              <text className="domain-progress-ring-caption" x="64" y="79" textAnchor="middle">
                entdeckt
              </text>
            </svg>
            <div className="domain-overview-count">
              <strong>{studied.toLocaleString('de-DE')} / {total.toLocaleString('de-DE')}</strong>
              <span>Konzepte entdeckt</span>
            </div>
          </div>
        </header>

        <div className="domain-overview-categories-pane">
          <div className="domain-overview-categories-heading">
            <h3>Fortschritt nach Thema</h3>
            <span>{categoryEntries.length} Themen</span>
          </div>
          <div
            className="domain-overview-categories"
            role="list"
            aria-label="Fortschritt nach Themen"
            tabIndex="0"
          >
            {categoryEntries.map(category => (
              <div className="domain-overview-category" role="listitem" key={category.key}>
                <div className="domain-overview-category-topline">
                  <span>{category.label}</span>
                  <strong>{category.percent}%</strong>
                </div>
                <div className="domain-overview-category-count">
                  {category.studied.toLocaleString('de-DE')} / {category.total.toLocaleString('de-DE')} entdeckt
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
