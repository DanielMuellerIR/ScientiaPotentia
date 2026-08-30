import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getDomainIdFromConceptKey } from '../domains';

/**
 * Bereichsauswahl im Header. Ersetzt die fruehere statische "Terra Weltatlas"-
 * Kopfzeile durch ein Dropdown ueber alle Wissensbereiche.
 *
 * Props:
 *   - domains:     Array der Domain-Definitionen (aus der Registry)
 *   - activeId:    ID der aktiven Domain
 *   - onSelect:    (domainId) => void  beim Wechsel
 *   - srsProgress: Map conceptKey -> Fortschritt (global, alle Domains) fuer
 *                  die Anzeige entdeckter Konzepte pro Bereich
 */
export default function DomainSwitcher({ domains, activeId, onSelect, srsProgress = {} }) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const menuId = useId();

  // Klick außerhalb schließt das Dropdown. Escape schließt es ebenfalls und
  // gibt den Fokus an den Auslöser zurück, damit die Tastaturnavigation nicht
  // nach dem aus dem DOM entfernten Menü ins Leere fällt.
  useEffect(() => {
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key !== 'Escape' || !open) return;
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Anzahl entdeckter Konzepte pro Domain aus dem globalen Fortschritt ableiten.
  // (Anteil Konzepte mit repetitions > 0; hier zeigen wir die absolute Zahl
  //  entdeckter Konzepte, weil die Gesamtzahl je Domain hier nicht vorliegt.)
  const studiedByDomain = {};
  Object.entries(srsProgress).forEach(([key, item]) => {
    const dId = item?.domain || getDomainIdFromConceptKey(key);
    if (item && item.repetitions > 0) {
      studiedByDomain[dId] = (studiedByDomain[dId] || 0) + 1;
    }
  });

  const active = domains.find(d => d.id === activeId) || domains[0];
  const ActiveIcon = active.Icon;

  // Ein ARIA-Menü führt den Fokus beim Öffnen in seine aktive Option und
  // bewegt ihn mit Pfeiltasten. Tab darf das Menü verlassen; onBlur schließt
  // es dann, damit kein unsichtbar zurückgelassenes Dropdown offen bleibt.
  useEffect(() => {
    if (!open) return;
    const activeIndex = Math.max(0, domains.findIndex(domain => domain.id === active.id));
    setFocusedIndex(activeIndex);
    optionRefs.current[activeIndex]?.focus();
  }, [active.id, domains, open]);

  const handleMenuKeyDown = (event) => {
    const currentIndex = optionRefs.current.findIndex(option => option === document.activeElement);
    let nextIndex;
    if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % domains.length;
    else if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + domains.length) % domains.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = domains.length - 1;
    else return;
    event.preventDefault();
    setFocusedIndex(nextIndex);
    optionRefs.current[nextIndex]?.focus();
  };

  const handleSelect = (domainId) => {
    onSelect(domainId);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="domain-switcher-root"
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      {/* Auslöser: zeigt aktiven Bereich */}
      <button
        ref={triggerRef}
        type="button"
        className="domain-switcher-trigger"
        onClick={() => setOpen(o => !o)}
        aria-label={`Wissensbereich wechseln, aktuell ${active.latinName}: ${active.label}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        title="Wissensbereich wechseln"
      >
        <ActiveIcon
          className="domain-switcher-trigger-icon"
          size={22}
          style={{ color: active.accent }}
          aria-hidden="true"
        />
        <div className="domain-switcher-active-text">
          <div className="domain-switcher-active-name">{active.latinName}</div>
          <div className="domain-switcher-active-label">{active.label}</div>
        </div>
        <ChevronDown
          className={`domain-switcher-chevron${open ? ' domain-switcher-chevron--open' : ''}`}
          size={16}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown: Karten aller Bereiche */}
      {open && (
        <div
          id={menuId}
          className="domain-switcher-menu slide-in"
          role="menu"
          aria-label="Wissensbereiche"
          onKeyDown={handleMenuKeyDown}
        >
          {domains.map((d, index) => {
            const Icon = d.Icon;
            const isActive = d.id === active.id;
            const studied = studiedByDomain[d.id] || 0;
            return (
              <button
                ref={option => { optionRefs.current[index] = option; }}
                key={d.id}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                tabIndex={index === focusedIndex ? 0 : -1}
                onFocus={() => setFocusedIndex(index)}
                className={`domain-switcher-option${isActive ? ' domain-switcher-option--active' : ''}`}
                onClick={() => handleSelect(d.id)}
                style={{ borderColor: isActive ? d.accent : 'transparent' }}
              >
                <span
                  className="domain-switcher-option-icon"
                  style={{
                    borderColor: `${d.accent}33`,
                    boxShadow: isActive ? `0 0 12px ${d.accent}55` : 'none',
                    color: d.accent
                  }}
                >
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div className="domain-switcher-option-text">
                  <div className="domain-switcher-option-title">
                    {d.latinName}{' '}
                    <span className="domain-switcher-option-label">· {d.label}</span>
                  </div>
                  <div className="domain-switcher-option-description">{d.description}</div>
                </div>
                <div className="domain-switcher-option-progress" style={{ color: d.accent }}>
                  {studied} entdeckt
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
