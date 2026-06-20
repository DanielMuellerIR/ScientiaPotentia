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

/**
 * Quiz-Starter OHNE Schwierigkeitsstufen (bewusst abgeschafft, s. AGENTS.md):
 * Fragen werden zufällig aus dem ganzen Pool des Bereichs gezogen — mal leicht,
 * mal knifflig (Glückssache). Bei Terra kann zusätzlich der Spielmodus (Stadt/
 * Land/Fluss) gewählt werden; alle anderen Bereiche starten direkt.
 *
 * Verwendet in der Übersicht (Dashboard) und als Vorschalt-Screen des Lern-Quiz-Tabs.
 *
 * Props:
 *   domain  – aktive Domain (entscheidet, ob Spielmodi gezeigt werden)
 *   onStart – (mode) => void; startet die Quizrunde im Eltern-State
 */
export default function QuizLauncher({ domain = { id: 'terra' }, onStart }) {
  const [selectedMode, setSelectedMode] = useState('all');
  const isTerra = domain.id === 'terra';

  return (
    <div className="terra-panel-inset" style={{
      padding: '16px',
      background: '#FAF9F4',
      border: '1px solid var(--border-light)'
    }}>
      {isTerra ? (
        <>
          <h4 style={{ fontFamily: 'var(--font-title)', color: 'var(--color-primary)', fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
            Spielmodus wählen
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
            {TERRA_MODES.map(mode => (
              <label key={mode.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                borderRadius: '2px',
                border: `1px solid ${selectedMode === mode.id ? 'var(--color-primary)' : 'transparent'}`,
                background: selectedMode === mode.id ? 'rgba(27, 48, 91, 0.03)' : 'transparent',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: selectedMode === mode.id ? 600 : 500
              }}>
                <input
                  type="radio"
                  name="quizMode"
                  checked={selectedMode === mode.id}
                  onChange={() => setSelectedMode(mode.id)}
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                {mode.label}
              </label>
            ))}
          </div>
        </>
      ) : (
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, padding: '8px 10px', background: 'rgba(0,0,0,0.02)', borderLeft: '2px solid var(--color-primary)', marginBottom: '16px' }}>
          Die Fragen werden zufällig aus allen Themen dieses Bereichs gemischt — mal leicht, mal knifflig.
        </div>
      )}

      <button
        className="btn-terra-primary"
        onClick={() => onStart(isTerra ? selectedMode : 'all')}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        <Compass size={18} />
        Quiz starten
      </button>
    </div>
  );
}
