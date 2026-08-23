import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Images, Info, Landmark, LayoutGrid
} from 'lucide-react';
import { DOMAINS } from '../domains';
import { CATEGORY_LABELS } from './conceptLabels';
import {
  PaginatedDepot,
  VirtualExhibitWall,
} from './ExhibitGalleryShared';
import ExhibitLightbox, { useExhibitLightbox } from './ExhibitLightbox';
import { matchesNameTokenPrefix } from '../utils/tokenSearch';

const DOMAIN_BY_ID = Object.fromEntries(DOMAINS.map((domain) => [domain.id, domain]));
const DOMAIN_ORDER = new Map(DOMAINS.map((domain, index) => [domain.id, index]));

function catLabel(category) {
  if (!category) return '';
  return CATEGORY_LABELS[category]
    || category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');
}

const ROMANS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
const roman = (index) => ROMANS[index] || String(index + 1);

/**
 * Globales Museum: Jede bildführende Domain bildet in Registry-Reihenfolge
 * einen Saal. „Alle Bereiche“ ist ein strikt paginiertes Depot; Suche schaltet
 * ebenfalls ins Depot, ohne die vollständige Lightbox-Trefferliste zu verlieren.
 */
export default function MuseumExplorer({
  allDomainData = {},
  loading = false,
  loadFailed = false,
  activeDomainId,
}) {
  const [domainFilter, setDomainFilter] = useState(activeDomainId || '');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [view, setView] = useState('rundgang');
  const [search, setSearch] = useState('');
  const {
    lightbox, openLightbox, closeLightbox, navigateLightbox
  } = useExhibitLightbox();

  const allItems = useMemo(() => {
    const items = [];
    for (const [domainId, conceptMap] of Object.entries(allDomainData)) {
      if (!conceptMap) continue;
      for (const concept of Object.values(conceptMap)) {
        if (!concept?.image?.url) continue;
        const category = concept.category || concept.type || '';
        items.push({
          id: concept.id || concept.name,
          key: `${domainId}:${concept.id || concept.name}`,
          name: concept.name || '–',
          category,
          categoryLabel: catLabel(category),
          domainId,
          imageUrl: concept.image.url,
          license: concept.image.license || '',
          attribution: concept.image.attribution || '',
          funFact: concept.funFact || '',
          source: concept.source || null,
          attributes: concept.attributes || {},
        });
      }
    }
    return items.sort((a, b) => {
      const domainDelta = (DOMAIN_ORDER.get(a.domainId) ?? 999)
        - (DOMAIN_ORDER.get(b.domainId) ?? 999);
      return domainDelta || a.name.localeCompare(b.name, 'de');
    });
  }, [allDomainData]);

  const halls = useMemo(() => DOMAINS
    .map((domain) => ({
      domain,
      items: allItems.filter((item) => item.domainId === domain.id),
    }))
    .filter((hall) => hall.items.length > 0), [allItems]);

  // Nach dem asynchronen Laden öffnet das Museum möglichst Daniels aktive
  // Domain; bildlose Domains (z.B. Terra) fallen auf den ersten echten Saal.
  useEffect(() => {
    if (halls.length === 0 || domainFilter === 'all') return;
    if (halls.some((hall) => hall.domain.id === domainFilter)) return;
    const preferred = halls.find((hall) => hall.domain.id === activeDomainId);
    setDomainFilter((preferred || halls[0]).domain.id);
  }, [activeDomainId, domainFilter, halls]);

  const filterPool = useMemo(
    () => (domainFilter === 'all'
      ? allItems
      : allItems.filter((item) => item.domainId === domainFilter)),
    [allItems, domainFilter]
  );

  const categories = useMemo(() => [...new Set(filterPool
    .map((item) => item.category)
    .filter(Boolean))]
    .sort((a, b) => catLabel(a).localeCompare(catLabel(b), 'de')), [filterPool]);

  useEffect(() => {
    if (categoryFilter !== 'all' && !categories.includes(categoryFilter)) {
      setCategoryFilter('all');
    }
  }, [categories, categoryFilter]);

  const query = search.trim();
  const searchActive = query.length > 0;
  const filteredItems = useMemo(() => filterPool.filter((item) => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    return !query || matchesNameTokenPrefix(item.name, query);
  }), [categoryFilter, filterPool, query]);

  const hallIndex = halls.findIndex((hall) => hall.domain.id === domainFilter);
  const activeHall = hallIndex >= 0 ? halls[hallIndex] : null;
  const showDepot = domainFilter === 'all' || view === 'depot' || searchActive;
  const shownCount = filteredItems.length;
  const toggleView = () => {
    if (showDepot) {
      setSearch('');
      setView('rundgang');
      return;
    }
    setView('depot');
  };

  const selectDomain = (nextDomainId) => {
    setDomainFilter(nextDomainId);
    setCategoryFilter('all');
    setView(nextDomainId === 'all' ? 'depot' : 'rundgang');
  };

  const selectAdjacentHall = (direction) => {
    if (!halls.length) return;
    const next = (hallIndex + direction + halls.length) % halls.length;
    selectDomain(halls[next].domain.id);
  };

  const lightboxItem = lightbox?.item;
  const lightboxDomain = lightboxItem ? DOMAIN_BY_ID[lightboxItem.domainId] : null;
  const lightboxAccent = lightboxDomain?.accent || 'var(--color-primary)';
  const credit = lightboxItem && (lightboxItem.attribution || lightboxItem.license)
    ? [
      lightboxItem.attribution,
      lightboxItem.license && `Lizenz: ${lightboxItem.license}`,
      'Wikimedia Commons',
    ].filter(Boolean).join(' · ')
    : '';

  const museumHeader = lightboxItem ? (
    <span
      className="museum-domain-badge"
      style={{
        '--museum-accent': lightboxAccent,
        background: `${lightboxAccent}22`,
        borderColor: `${lightboxAccent}55`,
      }}
    >
      {lightboxDomain?.label || lightboxItem.domainId}
      {lightboxItem.categoryLabel ? ` · ${lightboxItem.categoryLabel}` : ''}
    </span>
  ) : null;

  const museumDetails = lightboxItem ? (
    <div className="museum-lightbox-details">
      <h3>{lightboxItem.name}</h3>
      {Object.keys(lightboxItem.attributes || {}).length > 0 && (
        <div className="museum-attributes">
          {Object.entries(lightboxItem.attributes).slice(0, 6).map(([key, value]) => (
            <span key={key}>
              <span>{key}: </span>
              <b>{typeof value === 'boolean' ? (value ? 'ja' : 'nein') : String(value)}</b>
            </span>
          ))}
        </div>
      )}
      {lightboxItem.funFact && (
        <div
          className="museum-fun-fact"
          style={{ background: `${lightboxAccent}11`, borderColor: `${lightboxAccent}33` }}
        >
          <Info size={15} style={{ color: lightboxAccent, flexShrink: 0, marginTop: 2 }} />
          <p>{lightboxItem.funFact}</p>
        </div>
      )}
      {lightboxItem.source?.url && (
        <a href={lightboxItem.source.url} target="_blank" rel="noopener noreferrer">
          Quelle: {lightboxItem.source.name || lightboxItem.source.url}
        </a>
      )}
    </div>
  ) : null;

  return (
    <div className="terra-panel hall-panel">
      <div className="hall">
        <div className="hall-topbar museum-topbar">
          <Images size={20} className="museum-title-icon" />
          <h2 className="hall-heading">Museum</h2>
          <span className="hall-count">
            {shownCount} {shownCount === 1 ? 'Exponat' : 'Exponate'}
          </span>

          {halls.length > 0 && (
            <span className="hall-navigation museum-hall-navigation">
              {domainFilter !== 'all' && (
                <button
                  type="button"
                  className="btn-terra hall-small-button"
                  onClick={() => selectAdjacentHall(-1)}
                  title="Voriger Saal"
                  aria-label="Voriger Saal"
                >
                  <ChevronLeft size={15} />
                </button>
              )}
              <select
                className="hall-saal-select museum-domain-select"
                value={domainFilter}
                onChange={(event) => selectDomain(event.target.value)}
                aria-label="Museumsbereich wählen"
              >
                <option value="all">Alle Bereiche — Depot ({allItems.length})</option>
                {halls.map((hall, index) => (
                  <option key={hall.domain.id} value={hall.domain.id}>
                    Saal {roman(index)} — {hall.domain.label} ({hall.items.length})
                  </option>
                ))}
              </select>
              {domainFilter !== 'all' && (
                <button
                  type="button"
                  className="btn-terra hall-small-button"
                  onClick={() => selectAdjacentHall(1)}
                  title="Nächster Saal"
                  aria-label="Nächster Saal"
                >
                  <ChevronRight size={15} />
                </button>
              )}
            </span>
          )}

          <span className="hall-actions hall-actions--push">
            {categories.length > 0 && (
              <select
                className="hall-saal-select museum-category-select"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                aria-label="Kategorie filtern"
              >
                <option value="all">Alle Kategorien</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{catLabel(category)}</option>
                ))}
              </select>
            )}
            <input
              type="search"
              className="hall-search"
              placeholder="Suchen …"
              aria-label="Museum durchsuchen"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                if (event.target.value.trim()) setView('depot');
              }}
            />
            {domainFilter !== 'all' && (
              <button
                type="button"
                className="btn-terra hall-view-button"
                aria-pressed={showDepot}
                onClick={toggleView}
                title={showDepot
                  ? 'Zurück in den Rundgang'
                  : 'Depot: gefilterte Exponate als Raster'}
              >
                {showDepot
                  ? (<><Landmark size={14} /> Rundgang</>)
                  : (<><LayoutGrid size={14} /> Depot</>)}
              </button>
            )}
          </span>
        </div>

        {loading && <div className="hall-state">Bilder werden geladen …</div>}
        {!loading && loadFailed && (
          <div className="hall-state hall-state--error">
            Bilder konnten nicht geladen werden. Bitte später erneut versuchen.
          </div>
        )}
        {!loading && !loadFailed && allItems.length === 0 && (
          <div className="hall-state">Keine Bilder verfügbar.</div>
        )}

        {!loading && !loadFailed && allItems.length > 0 && !showDepot && activeHall && (
          <VirtualExhibitWall
            items={filteredItems}
            resetKey={`${domainFilter}-${categoryFilter}`}
            ariaLabel={`Saal ${roman(hallIndex)} — ${activeHall.domain.label}: ${filteredItems.length} Exponate, mit Pfeiltasten oder Wischen durchgehen`}
            onOpen={openLightbox}
            placardSubtitle={(item, index) => (
              `${item.categoryLabel || 'Ohne Kategorie'} · Nr. ${index + 1}`
            )}
          />
        )}

        {!loading && !loadFailed && allItems.length > 0 && showDepot && (
          <PaginatedDepot
            items={filteredItems}
            resetKey={`${domainFilter}-${categoryFilter}-${search}-${view}`}
            onOpen={openLightbox}
            subtitle={(item) => (
              domainFilter === 'all'
                ? `${DOMAIN_BY_ID[item.domainId]?.label || item.domainId} · ${item.categoryLabel}`
                : item.categoryLabel
            )}
            emptyMessage={searchActive
              ? `Kein Exponat zu „${search.trim()}“ gefunden.`
              : 'Keine Exponate für diesen Filter gefunden.'}
          />
        )}
      </div>

      <ExhibitLightbox
        state={lightbox}
        onClose={closeLightbox}
        onNavigate={navigateLightbox}
        header={museumHeader}
        details={museumDetails}
        credit={credit}
        imageMaxHeight="420px"
      />
    </div>
  );
}
