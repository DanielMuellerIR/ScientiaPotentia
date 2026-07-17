import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ExhibitImage } from './ExhibitGalleryShared';

/**
 * Gemeinsamer Lightbox-State. Die Liste wird beim Öffnen bewusst als Snapshot
 * gespeichert: Depot-Paginierung darf die Navigation nicht auf die aktuelle
 * Seite beschneiden.
 */
export function useExhibitLightbox() {
  const [lightbox, setLightbox] = useState(null);
  const returnFocusRef = useRef(null);

  const openLightbox = useCallback((item, list, trigger) => {
    const index = list.indexOf(item);
    if (index < 0) return;
    returnFocusRef.current = trigger || document.activeElement;
    setLightbox({ item, list, index });
  }, []);

  const closeLightbox = useCallback(() => {
    setLightbox(null);
    requestAnimationFrame(() => returnFocusRef.current?.focus?.());
  }, []);

  const navigateLightbox = useCallback((direction) => {
    setLightbox((current) => {
      if (!current?.list.length) return current;
      const index = (
        current.index + direction + current.list.length
      ) % current.list.length;
      return { ...current, item: current.list[index], index };
    });
  }, []);

  useEffect(() => {
    if (!lightbox) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'ArrowLeft') navigateLightbox(-1);
      if (event.key === 'ArrowRight') navigateLightbox(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightbox, navigateLightbox]);

  return { lightbox, openLightbox, closeLightbox, navigateLightbox };
}

function ExhibitDialog({ onClose, ariaLabel, header, children }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Fokus bleibt im modalen Dialog und kehrt anschließend zum Auslöser zurück.
  useEffect(() => {
    const previousFocus = document.activeElement;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus?.();
    };
  }, []);

  return createPortal((
    <div
      onClick={onClose}
      className="hall-lightbox-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(event) => event.stopPropagation()}
        className="hall-lightbox-dialog"
      >
        <div className="hall-lightbox-dialog-header">
          <div className="hall-lightbox-dialog-heading">{header}</div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="btn-terra hall-lightbox-close"
            title="Schließen (Esc)"
            aria-label="Lightbox schließen"
          >
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  ), document.body);
}

/**
 * Gemeinsame Bild-, Navigations- und Dialogbasis. Das Museum ergänzt über
 * `details` Attribute, FunFact und Sachquelle; die Gallery benötigt nur Credits.
 */
export default function ExhibitLightbox({
  state,
  onClose,
  onNavigate,
  header,
  details,
  credit,
  imageMaxHeight = '70vh',
}) {
  if (!state) return null;
  const { item, list, index } = state;
  const defaultHeader = (
    <div>
      <div className="hall-lightbox-title">{item.name}</div>
      <div className="hall-lightbox-subtitle">{item.categoryLabel || item.category || ''}</div>
    </div>
  );

  return (
    <ExhibitDialog
      onClose={onClose}
      ariaLabel={`Exponat: ${item.name}`}
      header={(
        <div className="hall-lightbox-header">
          {header || defaultHeader}
          <span className="hall-lightbox-position">
            {index + 1} / {list.length}
          </span>
        </div>
      )}
    >
      <div
        className="hall-lightbox-image"
        style={{ '--hall-lightbox-max-height': imageMaxHeight }}
      >
        <ExhibitImage
          key={item.key || item.id || item.imageUrl}
          item={item}
          size={800}
          loadingText="Bild wird geladen …"
          style={{
            maxWidth: '100%',
            maxHeight: imageMaxHeight,
            objectFit: 'contain',
            display: 'block',
          }}
        />
        <button
          type="button"
          onClick={() => onNavigate(-1)}
          className="btn-terra hall-lightbox-nav hall-lightbox-nav--prev"
          title="Vorheriges Exponat (←)"
          aria-label="Vorheriges Exponat"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => onNavigate(1)}
          className="btn-terra hall-lightbox-nav hall-lightbox-nav--next"
          title="Nächstes Exponat (→)"
          aria-label="Nächstes Exponat"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      {details}
      {credit && <div className="hall-lightbox-credit">{credit}</div>}
    </ExhibitDialog>
  );
}
