import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Images, Landmark, LayoutGrid } from 'lucide-react';
import { CATEGORY_LABELS } from './conceptLabels';
import {
  PaginatedDepot,
  VirtualExhibitWall,
} from './ExhibitGalleryShared';
import ExhibitLightbox, { useExhibitLightbox } from './ExhibitLightbox';

// Kategorie -> deutsches Label; unbekannte Kategorien werden kapitalisiert.
const catLabel = (category) => CATEGORY_LABELS[category]
  || (category ? category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ') : '');

// Römische Saalnummern (nur Schmuck — nach XX einfach Dezimalzahl).
const ROMANS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
const roman = (index) => ROMANS[index] || String(index + 1);

/**
 * GalleryExplorer — begehbare Galeriewand für eine einzelne Wissensdomain.
 *
 * Kategorien bilden weiterhin die Säle. Wand, Exponat, Plakette, paginiertes
 * Depot und Lightbox stammen aus denselben Bausteinen wie das globale Museum.
 */
export default function GalleryExplorer({ domain, concepts = {} }) {
  const accent = domain?.accent || '#1B305B';

  const items = useMemo(() => Object.values(concepts || {})
    .filter((concept) => concept?.image?.url)
    .map((concept) => ({
      id: concept.id || concept.name,
      key: concept.id || concept.name,
      name: concept.name,
      category: concept.category || concept.type || '',
      categoryLabel: catLabel(concept.category || concept.type),
      imageUrl: concept.image.url,
      license: concept.image.license || '',
      attribution: concept.image.attribution || '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de')), [concepts]);

  const halls = useMemo(() => {
    const byCategory = new Map();
    for (const item of items) {
      const category = item.category || 'sonstiges';
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category).push(item);
    }
    return [...byCategory.entries()]
      .sort((a, b) => catLabel(a[0]).localeCompare(catLabel(b[0]), 'de'))
      .map(([category, hallItems]) => ({
        category,
        label: catLabel(category),
        items: hallItems,
      }));
  }, [items]);

  const [hallIndex, setHallIndex] = useState(0);
  const [view, setView] = useState('rundgang');
  const [search, setSearch] = useState('');
  const {
    lightbox, openLightbox, closeLightbox, navigateLightbox
  } = useExhibitLightbox();

  useEffect(() => {
    if (hallIndex >= halls.length) setHallIndex(0);
  }, [hallIndex, halls]);

  const query = search.trim().toLocaleLowerCase('de');
  const searchActive = query.length > 0;
  const depotItems = useMemo(
    () => (searchActive
      ? items.filter((item) => item.name.toLocaleLowerCase('de').includes(query))
      : items),
    [items, query, searchActive]
  );

  const hall = halls[hallIndex] || halls[0];
  const hallItems = hall?.items || [];
  const showDepot = view === 'depot' || searchActive;
  const shownCount = showDepot ? depotItems.length : hallItems.length;
  const toggleView = () => {
    if (showDepot) {
      setSearch('');
      setView('rundgang');
      return;
    }
    setView('depot');
  };

  if (items.length === 0) {
    return (
      <div className="terra-panel slide-in hall-empty-panel">
        <Images size={40} style={{ color: accent, opacity: 0.7 }} />
        <div className="hall-empty-title">
          Noch keine Bilder in {domain?.latinName || 'diesem Bereich'}
        </div>
        <div className="hall-empty-copy">
          Sobald für die Konzepte dieses Bereichs freie Bilder vorliegen, erscheinen sie hier
          automatisch. Bis dahin: Quiz starten oder die Statistik rechts ansehen.
        </div>
      </div>
    );
  }

  const credit = lightbox && (lightbox.item.attribution || lightbox.item.license)
    ? `${[lightbox.item.attribution, lightbox.item.license].filter(Boolean).join(' · ')} · Wikimedia Commons`
    : '';

  return (
    <div className="terra-panel slide-in hall-panel">
      <div className="hall">
        <div className="hall-topbar">
          <Landmark size={18} style={{ color: accent, flexShrink: 0 }} />
          <h2 className="hall-heading">
            Galerie — {domain?.label || domain?.latinName}
          </h2>
          <span className="hall-count">
            {shownCount} {shownCount === 1 ? 'Exponat' : 'Exponate'}
          </span>

          {!showDepot && halls.length > 1 && (
            <span className="hall-navigation">
              <button
                type="button"
                className="btn-terra hall-small-button"
                onClick={() => setHallIndex((hallIndex - 1 + halls.length) % halls.length)}
                title="Voriger Saal"
                aria-label="Voriger Saal"
              >
                <ChevronLeft size={15} />
              </button>
              <select
                className="hall-saal-select"
                value={hallIndex}
                onChange={(event) => setHallIndex(Number(event.target.value))}
                aria-label="Saal wählen"
              >
                {halls.map((entry, index) => (
                  <option key={entry.category} value={index}>
                    Saal {roman(index)} — {entry.label} ({entry.items.length})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-terra hall-small-button"
                onClick={() => setHallIndex((hallIndex + 1) % halls.length)}
                title="Nächster Saal"
                aria-label="Nächster Saal"
              >
                <ChevronRight size={15} />
              </button>
            </span>
          )}

          <span className={`hall-actions${showDepot || halls.length <= 1 ? ' hall-actions--push' : ''}`}>
            <input
              type="search"
              className="hall-search"
              placeholder="Suchen …"
              aria-label="Exponate durchsuchen"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                if (event.target.value.trim()) setView('depot');
              }}
            />
            <button
              type="button"
              className="btn-terra hall-view-button"
              aria-pressed={showDepot}
              onClick={toggleView}
              title={showDepot
                ? 'Zurück in den Rundgang'
                : 'Depot: alle Exponate als Raster'}
            >
              {showDepot
                ? (<><Landmark size={14} /> Rundgang</>)
                : (<><LayoutGrid size={14} /> Depot</>)}
            </button>
          </span>
        </div>

        {!showDepot && (
          <VirtualExhibitWall
            items={hallItems}
            resetKey={`${domain?.id || 'domain'}-${hallIndex}`}
            ariaLabel={`Saal ${roman(hallIndex)} — ${hall?.label}: ${hallItems.length} Exponate, mit Pfeiltasten oder Wischen durchgehen`}
            onOpen={openLightbox}
          />
        )}

        {showDepot && (
          <PaginatedDepot
            items={depotItems}
            resetKey={`${view}-${search}`}
            onOpen={openLightbox}
            subtitle={(item) => item.categoryLabel}
            emptyMessage={`Kein Exponat zu „${search.trim()}“ gefunden.`}
          />
        )}
      </div>

      <ExhibitLightbox
        state={lightbox}
        onClose={closeLightbox}
        onNavigate={navigateLightbox}
        credit={credit}
      />
    </div>
  );
}
