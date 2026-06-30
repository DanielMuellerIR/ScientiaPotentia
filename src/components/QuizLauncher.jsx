import React, { useState } from 'react';
import { Compass } from 'lucide-react';

// Spielmodi sind geografiespezifisch (Stadt/Land/Fluss) -> nur bei Terra angeboten.
const TERRA_MODES = [
  { id: 'all', label: 'Alle Kategorien' },
  { id: 'countries', label: 'Nur Länder & Provinzen' },
  { id: 'cities', label: 'Nur Städte' },
  { id: 'rivers', label: 'Nur Flüsse' },
  { id: 'stadt-land-fluss', label: 'Stadt, Land, Fluss (Wechselnd)' }
];

// Rundenlänge bzw. Spielart — gilt für JEDEN Bereich. Entweder eine feste Anzahl
// Fragen oder der Überlebens-Modus (endlos, bis die Leben aufgebraucht sind).
const ROUND_OPTIONS = [
  { id: 'fixed-10', label: '10 Fragen', config: { kind: 'fixed', length: 10 } },
  { id: 'fixed-25', label: '25 Fragen', config: { kind: 'fixed', length: 25 } },
  { id: 'fixed-50', label: '50 Fragen', config: { kind: 'fixed', length: 50 } },
  { id: 'survival', label: 'Überleben (3 Leben)', config: { kind: 'survival', lives: 3 } }
];

/**
 * Quiz-Starter OHNE Schwierigkeitsstufen (bewusst abgeschafft, s. AGENTS.md):
 * Fragen werden zufällig aus dem ganzen Pool des Bereichs gezogen — mal leicht,
 * mal knifflig (Glückssache). Zusätzlich wählbar:
 *   - bei Terra der geografische Spielmodus (Stadt/Land/Fluss),
 *   - in JEDEM Bereich die Rundenlänge bzw. der Überlebens-Modus (ROUND_OPTIONS).
 *
 * Verwendet in der Übersicht (Dashboard) und als Vorschalt-Screen des Lern-Quiz-Tabs.
 *
 * Props:
 *   domain  – aktive Domain (entscheidet, ob die Geo-Spielmodi gezeigt werden)
 *   onStart – (mode, roundConfig) => void; startet die Quizrunde im Eltern-State.
 *             roundConfig = { kind:'fixed', length } | { kind:'survival', lives }.
 */
export default function QuizLauncher({ domain = { id: 'terra' }, onStart }) {
  const [selectedMode, setSelectedMode] = useState('all');
  const [selectedRound, setSelectedRound] = useState('fixed-10');
  const isTerra = domain.id === 'terra';

  // Wiederverwendbare Radio-Zeile (gleicher Look wie bisher die Terra-Spielmodi).
  const radioRow = (checked, onChange, label) => (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 10px',
      borderRadius: '2px',
      border: `1px solid ${checked ? 'var(--color-primary)' : 'transparent'}`,
      background: checked ? 'rgba(27, 48, 91, 0.03)' : 'transparent',
      fontSize: '14px',
      cursor: 'pointer',
      fontWeight: checked ? 600 : 500
    }}>
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        style={{ accentColor: 'var(--color-primary)' }}
      />
      {label}
    </label>
  );

  const sectionTitle = (text) => (
    <h4 style={{ fontFamily: 'var(--font-title)', color: 'var(--color-primary)', fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
      {text}
    </h4>
  );

  const handleStart = () => {
    const round = ROUND_OPTIONS.find(r => r.id === selectedRound)?.config || { kind: 'fixed', length: 10 };
    onStart(isTerra ? selectedMode : 'all', round);
  };

  return (
    <div className="terra-panel-inset" style={{
      padding: '16px',
      background: '#FAF9F4',
      border: '1px solid var(--border-light)'
    }}>
      {isTerra ? (
        <>
          {sectionTitle('Spielmodus wählen')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
            {TERRA_MODES.map(mode =>
              <React.Fragment key={mode.id}>
                {radioRow(selectedMode === mode.id, () => setSelectedMode(mode.id), mode.label)}
              </React.Fragment>
            )}
          </div>
        </>
      ) : (
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, padding: '8px 10px', background: 'rgba(0,0,0,0.02)', borderLeft: '2px solid var(--color-primary)', marginBottom: '16px' }}>
          Die Fragen werden zufällig aus allen Themen dieses Bereichs gemischt — mal leicht, mal knifflig.
        </div>
      )}

      {/* Rundenlänge / Überlebens-Modus — für jeden Bereich */}
      {sectionTitle('Spiellänge')}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
        {ROUND_OPTIONS.map(opt =>
          <React.Fragment key={opt.id}>
            {radioRow(selectedRound === opt.id, () => setSelectedRound(opt.id), opt.label)}
          </React.Fragment>
        )}
      </div>

      <button
        className="btn-terra-primary"
        onClick={handleStart}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        <Compass size={18} />
        Quiz starten
      </button>
    </div>
  );
}
