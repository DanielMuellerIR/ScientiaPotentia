import React, { useState } from 'react';
import { Compass } from 'lucide-react';

// Schwierigkeitsbeschreibungen domain-neutral: identischer Text für alle Bereiche
// (Terra/Astra/Homo/Natura/…). Nur Schwierigkeit + Punkte-Multiplikator beschreiben,
// keine geografiespezifischen Begriffe.
const LEVEL_DESC = {
  1: 'Grundlagen und bekannte Konzepte. (1x Punkte)',
  2: 'Mittelschwer: weniger geläufige Konzepte. (2.5x Punkte)',
  3: 'Anspruchsvoll: seltenere Konzepte und feine Details. (5x Punkte)',
  4: 'Meister: seltene, exotische und schwer zu merkende Konzepte. (10x Punkte)'
};

// Spielmodi sind geografiespezifisch (Stadt/Land/Fluss) -> nur bei Terra angeboten.
const TERRA_MODES = [
  { id: 'all', label: 'Alle Kategorien' },
  { id: 'countries', label: 'Nur Länder & Provinzen' },
  { id: 'cities', label: 'Nur Städte' },
  { id: 'rivers', label: 'Nur Flüsse' },
  { id: 'stadt-land-fluss', label: 'Stadt, Land, Fluss (Wechselnd)' }
];

/**
 * Gemeinsamer Quiz-Starter: Schwierigkeitsgrad (+ bei Terra Spielmodus) wählen und
 * die Runde starten. Wird an zwei Stellen verwendet:
 *   - in der Übersicht (Dashboard) als Teil der Lernkontrolle,
 *   - als Vorschalt-Screen des "Lern-Quiz"-Tabs, damit man dort die Stufe wählt,
 *     bevor die erste Frage erscheint (statt sofort in Stufe 1 zu landen).
 *
 * Props:
 *   domain  – aktive Domain (entscheidet, ob Spielmodi gezeigt werden)
 *   onStart – (level, mode) => void; startet die Quizrunde im Eltern-State
 */
export default function QuizLauncher({ domain = { id: 'terra' }, onStart }) {
  const [selectedLevel, setSelectedLevel] = useState(1); // 1 | 2 | 3 | 4
  const [selectedMode, setSelectedMode] = useState('all');
  const isTerra = domain.id === 'terra';

  return (
    <div className="terra-panel-inset" style={{
      padding: '16px',
      background: '#FAF9F4',
      border: '1px solid var(--border-light)'
    }}>
      <h4 style={{ fontFamily: 'var(--font-title)', color: 'var(--color-primary)', fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
        Schwierigkeitsgrad wählen
      </h4>

      {/* Stufen-Auswahl (Radio-Liste) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
        {[1, 2, 3, 4].map(lvl => (
          <label key={lvl} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '2px',
            border: `1px solid ${selectedLevel === lvl ? 'var(--color-primary)' : 'transparent'}`,
            background: selectedLevel === lvl ? 'rgba(27, 48, 91, 0.03)' : 'transparent',
            fontSize: '14px',
            cursor: 'pointer',
            fontWeight: selectedLevel === lvl ? 600 : 500
          }}>
            <input
              type="radio"
              name="difficulty"
              checked={selectedLevel === lvl}
              onChange={() => setSelectedLevel(lvl)}
              style={{ accentColor: 'var(--color-primary)' }}
            />
            {lvl === 1 && 'Stufe 1 (Leicht)'}
            {lvl === 2 && 'Stufe 2 (Mittel)'}
            {lvl === 3 && 'Stufe 3 (Schwer)'}
            {lvl === 4 && 'Stufe 4 (Meister)'}
          </label>
        ))}
      </div>

      <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4', padding: '8px 10px', background: 'rgba(0,0,0,0.02)', borderLeft: '2px solid var(--color-primary)', marginBottom: '16px' }}>
        {LEVEL_DESC[selectedLevel]}
      </div>

      {/* Spielmodus-Auswahl nur bei Terra */}
      {isTerra && (<>
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
      </>)}

      <button
        className="btn-terra-primary"
        onClick={() => onStart(selectedLevel, isTerra ? selectedMode : 'all')}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        <Compass size={18} />
        Quiz starten
      </button>
    </div>
  );
}
