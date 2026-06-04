import React, { useState, useRef, useEffect } from 'react';
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
 *                  die Lernfortschritts-Anzeige pro Bereich
 */
export default function DomainSwitcher({ domains, activeId, onSelect, srsProgress = {} }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Klick ausserhalb schliesst das Dropdown
  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Anzahl gelernter Konzepte pro Domain aus dem globalen Fortschritt ableiten.
  // (Mastery = Anteil Konzepte mit repetitions > 0; hier zeigen wir die absolute
  //  Zahl gelernter Konzepte, weil die Gesamtzahl je Domain hier nicht vorliegt.)
  const studiedByDomain = {};
  Object.entries(srsProgress).forEach(([key, item]) => {
    const dId = item?.domain || getDomainIdFromConceptKey(key);
    if (item && item.repetitions > 0) {
      studiedByDomain[dId] = (studiedByDomain[dId] || 0) + 1;
    }
  });

  const active = domains.find(d => d.id === activeId) || domains[0];
  const ActiveIcon = active.Icon;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Auslöser: zeigt aktiven Bereich */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 12px',
          background: 'rgba(255,255,255,0.55)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-sm, 6px)',
          cursor: 'pointer',
          backdropFilter: 'blur(12px)'
        }}
        title="Wissensbereich wechseln"
      >
        <ActiveIcon size={22} style={{ color: active.accent }} />
        <div style={{ textAlign: 'left', lineHeight: 1.1 }}>
          <div style={{ fontFamily: 'var(--font-title)', fontSize: '18px', fontWeight: 700, color: 'var(--color-primary)' }}>
            {active.latinName}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{active.label}</div>
        </div>
        <ChevronDown size={16} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {/* Dropdown: Karten aller Bereiche */}
      {open && (
        <div
          className="slide-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            width: '320px',
            zIndex: 200,
            background: 'rgba(250, 249, 244, 0.92)',
            backdropFilter: 'blur(14px)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-sm, 8px)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          {domains.map(d => {
            const Icon = d.Icon;
            const isActive = d.id === activeId;
            const studied = studiedByDomain[d.id] || 0;
            return (
              <button
                key={d.id}
                onClick={() => { onSelect(d.id); setOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  textAlign: 'left',
                  background: isActive ? 'rgba(27, 48, 91, 0.06)' : 'transparent',
                  border: `1px solid ${isActive ? d.accent : 'transparent'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '38px', height: '38px', flexShrink: 0,
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.6)',
                  border: `1px solid ${d.accent}33`,
                  boxShadow: isActive ? `0 0 12px ${d.accent}55` : 'none'
                }}>
                  <Icon size={20} style={{ color: d.accent }} />
                </span>
                <div style={{ flex: 1, lineHeight: 1.25 }}>
                  <div style={{ fontFamily: 'var(--font-title)', fontSize: '15px', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {d.latinName} <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '13px' }}>· {d.label}</span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{d.description}</div>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: d.accent, whiteSpace: 'nowrap' }}>
                  {studied} gelernt
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
