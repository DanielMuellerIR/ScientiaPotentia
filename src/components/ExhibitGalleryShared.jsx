import React, {
  useCallback, useEffect, useMemo, useRef, useState
} from 'react';
import { ChevronLeft, ChevronRight, Images } from 'lucide-react';
import { commonsToDirectUrl } from '../utils/commonsImage';

export const DEFAULT_DEPOT_PAGE_SIZE = 60;

const imageUrlFor = (item) => item?.imageUrl || item?.url || '';

function activateWithKeyboard(event, onActivate) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  onActivate(event);
}

/**
 * Gemeinsamer Bildzustand für Wand, Depot und Lightbox. Damit behandeln beide
 * Explorer langsame sowie defekte Bilder identisch und zeigen nie ein leeres Mat.
 */
export function ExhibitImage({
  item,
  size,
  className,
  style,
  fallbackSize = 26,
  loadingText = '',
  onRatio,
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const imageUrl = imageUrlFor(item);

  useEffect(() => {
    setLoaded(false);
    setErrored(false);
  }, [imageUrl]);

  if (errored || !imageUrl) {
    return (
      <div className="hall-image-fallback" role="img" aria-label={`Bild für ${item?.name || 'Exponat'} nicht verfügbar`}>
        <Images size={fallbackSize} style={{ opacity: 0.3 }} />
      </div>
    );
  }

  return (
    <>
      {!loaded && (
        <div className="hall-loading" aria-hidden="true">
          {loadingText && <span className="hall-loading-text">{loadingText}</span>}
        </div>
      )}
      <img
        className={className}
        src={commonsToDirectUrl(imageUrl, size)}
        alt={item.name}
        loading={size <= 480 ? 'lazy' : undefined}
        onLoad={(event) => {
          setLoaded(true);
          // Echtes Seitenverhältnis des geladenen Bildes melden, damit der Rahmen
          // sich der Bildform anpasst (statt alle Rahmen gleich hoch zu machen).
          const { naturalWidth, naturalHeight } = event.currentTarget;
          if (onRatio && naturalWidth > 0 && naturalHeight > 0) {
            onRatio(naturalWidth / naturalHeight);
          }
        }}
        onError={() => setErrored(true)}
        style={{ ...style, opacity: loaded ? 1 : 0 }}
      />
    </>
  );
}

/**
 * Messing-Plakette unter Wandexponaten. Zusatzzeilen (z.B. Domain oder
 * Kategorie) bleiben per `subtitle` frei, die gemeinsame Typografie bleibt gleich.
 */
export function ExhibitPlacard({ name, subtitle }) {
  return (
    <div className="hall-placard">
      <div className="hall-placard-name">{name}</div>
      {subtitle && <div className="hall-placard-sub">{subtitle}</div>}
    </div>
  );
}

export function HallExhibit({ item, index, left, width, subtitle, onOpen }) {
  // Seitenverhältnis (Breite/Höhe) des Bildes; erst nach dem Laden bekannt.
  // Es steuert per CSS-Variable --ar die Rahmenform, damit ein Querformat einen
  // breiten und ein Hochformat einen schmalen Rahmen bekommt — kein Einheitsrahmen,
  // den ein einzelnes extrem hohes Bild diktiert.
  const [ratio, setRatio] = useState(null);
  const open = (event) => onOpen(item, event.currentTarget);
  const style = { left: `${left}px`, width: `${width}px` };
  if (ratio) style['--ar'] = ratio;
  return (
    <div
      className="hall-exhibit"
      style={style}
      onClick={open}
      onKeyDown={(event) => activateWithKeyboard(event, open)}
      role="button"
      tabIndex={0}
      title={item.name}
      data-testid="hall-exhibit"
      data-exhibit-index={index}
    >
      {/* Wrapper hält den Rahmen mittig (Bilder hängen auf gemeinsamer Blickachse),
          während die Plakette bündig am unteren Rand bleibt. */}
      <div className="hall-frame-wrap">
        <div className="hall-frame">
          <div className="hall-mat">
            <ExhibitImage item={item} size={480} className="hall-img" onRatio={setRatio} />
          </div>
        </div>
      </div>
      <ExhibitPlacard name={item.name} subtitle={subtitle || `Nr. ${index + 1}`} />
    </div>
  );
}

/**
 * Berechnet aus echter Containerbreite und scrollLeft nur das sichtbare
 * Exponatfenster plus zwei Pufferplätze je Seite.
 */
export function useVirtualWall(itemCount, resetKey) {
  const wallRef = useRef(null);
  const rafRef = useRef(0);
  const [wallWidth, setWallWidth] = useState(0);
  const [scrollX, setScrollX] = useState(0);

  useEffect(() => {
    const element = wallRef.current;
    if (!element) return undefined;

    const measure = () => setWallWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const slotWidth = wallWidth > 0 && wallWidth < 640
    ? Math.max(240, Math.round(wallWidth * 0.8))
    : 300;

  useEffect(() => {
    const element = wallRef.current;
    if (element?.scrollTo) element.scrollTo({ left: 0 });
    else if (element) element.scrollLeft = 0;
    setScrollX(0);
  }, [resetKey]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const onScroll = useCallback((event) => {
    const nextScrollX = event.currentTarget.scrollLeft;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setScrollX(nextScrollX));
  }, []);

  const onKeyDown = useCallback((event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    wallRef.current?.scrollBy?.({
      left: direction * slotWidth,
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }, [slotWidth]);

  const first = Math.max(0, Math.floor(scrollX / slotWidth) - 2);
  const last = Math.min(
    itemCount - 1,
    Math.ceil((scrollX + wallWidth) / slotWidth) + 2
  );
  const visibleIndices = [];
  for (let index = first; index <= last; index += 1) visibleIndices.push(index);

  return {
    wallRef,
    onScroll,
    onKeyDown,
    slotWidth,
    stripWidth: itemCount * slotWidth,
    visibleIndices,
  };
}

export function VirtualExhibitWall({
  items,
  resetKey,
  ariaLabel,
  onOpen,
  placardSubtitle,
}) {
  const {
    wallRef, onScroll, onKeyDown, slotWidth, stripWidth, visibleIndices
  } = useVirtualWall(items.length, resetKey);

  return (
    <div
      ref={wallRef}
      className="hall-wall"
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      tabIndex={0}
      aria-label={ariaLabel}
      data-testid="virtual-wall"
    >
      <div className="hall-strip" style={{ width: `${stripWidth}px` }}>
        {visibleIndices.map((index) => {
          const item = items[index];
          return (
            <HallExhibit
              key={item.key || item.id || `${item.name}-${index}`}
              item={item}
              index={index}
              left={index * slotWidth}
              width={slotWidth}
              subtitle={placardSubtitle?.(item, index)}
              onOpen={(selected, trigger) => onOpen(selected, items, trigger)}
            />
          );
        })}
      </div>
    </div>
  );
}

export function DepotCard({ item, subtitle, onOpen }) {
  const open = (event) => onOpen(item, event.currentTarget);
  return (
    <div
      className="hall-depot-card"
      onClick={open}
      onKeyDown={(event) => activateWithKeyboard(event, open)}
      role="button"
      tabIndex={0}
      title={item.name}
      data-testid="depot-card"
    >
      <div className="hall-depot-matte">
        <ExhibitImage
          item={item}
          size={300}
          fallbackSize={22}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </div>
      <div className="hall-depot-name">{item.name}</div>
      {subtitle && <div className="hall-depot-sub">{subtitle}</div>}
    </div>
  );
}

/**
 * Das Depot hält unabhängig von der Treffermenge höchstens `pageSize` Karten
 * im DOM. `onOpen` erhält trotzdem die vollständige Trefferliste, damit die
 * Lightbox über Seitengrenzen hinweg weiterblättert.
 */
export function PaginatedDepot({
  items,
  onOpen,
  subtitle,
  emptyMessage,
  resetKey,
  pageSize = DEFAULT_DEPOT_PAGE_SIZE,
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);

  useEffect(() => {
    setPage(0);
  }, [resetKey, items]);

  const pageItems = useMemo(() => {
    const start = safePage * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, pageSize, safePage]);

  return (
    <div className="hall-depot-view">
      <div className="hall-depot" data-testid="depot-grid">
        {items.length === 0 && (
          <div className="hall-empty">{emptyMessage}</div>
        )}
        {pageItems.map((item, index) => (
          <DepotCard
            key={item.key || item.id || `${item.name}-${index}`}
            item={item}
            subtitle={subtitle?.(item)}
            onOpen={(selected, trigger) => onOpen(selected, items, trigger)}
          />
        ))}
      </div>
      {items.length > pageSize && (
        <nav className="hall-pagination" aria-label="Depotseiten">
          <button
            type="button"
            className="btn-terra"
            onClick={() => setPage(Math.max(0, safePage - 1))}
            disabled={safePage === 0}
            aria-label="Vorherige Depotseite"
          >
            <ChevronLeft size={15} /> Zurück
          </button>
          <span>Seite {safePage + 1} von {pageCount}</span>
          <button
            type="button"
            className="btn-terra"
            onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
            disabled={safePage >= pageCount - 1}
            aria-label="Nächste Depotseite"
          >
            Weiter <ChevronRight size={15} />
          </button>
        </nav>
      )}
    </div>
  );
}
