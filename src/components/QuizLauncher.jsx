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
// Überleben ist bewusst Einzelspieler-only (s. handleStart).
const ROUND_OPTIONS = [
  { id: 'fixed-10', label: '10 Fragen', config: { kind: 'fixed', length: 10 } },
  { id: 'fixed-25', label: '25 Fragen', config: { kind: 'fixed', length: 25 } },
  { id: 'fixed-50', label: '50 Fragen', config: { kind: 'fixed', length: 50 } },
  { id: 'survival', label: 'Überleben (3 Leben)', config: { kind: 'survival', lives: 3 } }
];

const MAX_PLAYERS = 4;

/**
 * Quiz-Starter OHNE Schwierigkeitsstufen (bewusst abgeschafft, s. AGENTS.md):
 * Fragen werden zufällig aus dem ganzen Pool des Bereichs gezogen. Wählbar:
 *   - bei Terra der geografische Spielmodus (Stadt/Land/Fluss),
 *   - in JEDEM Bereich die Rundenlänge bzw. der Überlebens-Modus (ROUND_OPTIONS),
 *   - die Anzahl Mitspieler (1–4) mit eigenen Namen; ab 2 Spielern wird reihum
 *     gefragt und am Ende gewinnt die höchste Trefferzahl (nur feste Rundenlänge).
 *
 * Props:
 *   domain  – aktive Domain (entscheidet, ob die Geo-Spielmodi gezeigt werden)
 *   onStart – (mode, roundConfig, players) => void; startet die Quizrunde.
 *             roundConfig = { kind:'fixed', length } | { kind:'survival', lives }.
 *             players     = []  (Einzelspieler)  |  [Name, …]  (Mehrspieler, ab 2).
 */
export default function QuizLauncher({ domain = { id: 'terra' }, onStart }) {
  const [selectedMode, setSelectedMode] = useState('all');
  const [selectedRound, setSelectedRound] = useState('fixed-10');
  const [playerCount, setPlayerCount] = useState(1);
  const [playerNames, setPlayerNames] = useState(['', '', '', '']);
  const isTerra = domain.id === 'terra';
  const isMulti = playerCount > 1;

  // Wiederverwendbare Radio-Zeile (gleicher Look wie bisher die Terra-Spielmodi).
  const radioRow = (checked, onChange, label) => (
    <label style={{
      display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px',
      borderRadius: '2px',
      border: `1px solid ${checked ? 'var(--color-primary)' : 'transparent'}`,
      background: checked ? 'rgba(27, 48, 91, 0.03)' : 'transparent',
      fontSize: '14px', cursor: 'pointer', fontWeight: checked ? 600 : 500
    }}>
      <input type="radio" checked={checked} onChange={onChange} style={{ accentColor: 'var(--color-primary)' }} />
      {label}
    </label>
  );

  const sectionTitle = (text) => (
    <h4 style={{ fontFamily: 'var(--font-title)', color: 'var(--color-primary)', fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
      {text}
    </h4>
  );

  // Im Mehrspieler-Modus ist Überleben nicht verfügbar (eigene Leben pro Spieler =
  // späterer Ausbau); nur feste Rundenlängen anbieten.
  const roundChoices = ROUND_OPTIONS.filter(opt => !(isMulti && opt.config.kind === 'survival'));

  const handleStart = () => {
    let roundId = selectedRound;
    if (isMulti && roundId === 'survival') roundId = 'fixed-25'; // Fallback, falls vorher gewählt
    const round = ROUND_OPTIONS.find(r => r.id === roundId)?.config || { kind: 'fixed', length: 10 };
    const players = isMulti
      ? Array.from({ length: playerCount }, (_, i) => (playerNames[i] || '').trim() || `Spieler ${i + 1}`)
      : [];
    onStart(isTerra ? selectedMode : 'all', round, players);
  };

  return (
    <div className="terra-panel-inset" style={{
      padding: '16px', background: '#FAF9F4', border: '1px solid var(--border-light)'
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
        {roundChoices.map(opt =>
          <React.Fragment key={opt.id}>
            {radioRow(selectedRound === opt.id, () => setSelectedRound(opt.id), opt.label)}
          </React.Fragment>
        )}
      </div>

      {/* Mitspieler 1–4 */}
      {sectionTitle('Mitspieler')}
      <div style={{ display: 'flex', gap: '6px', marginBottom: isMulti ? '10px' : '16px' }}>
        {Array.from({ length: MAX_PLAYERS }, (_, i) => i + 1).map(n => {
          const active = playerCount === n;
          return (
            <button
              key={n}
              onClick={() => setPlayerCount(n)}
              style={{
                flex: 1, padding: '8px 0', fontSize: '14px', cursor: 'pointer',
                fontFamily: 'var(--font-title)', fontWeight: active ? 700 : 500,
                color: active ? '#fff' : 'var(--color-primary)',
                background: active ? 'var(--color-primary)' : 'transparent',
                border: `1px solid ${active ? 'var(--color-primary)' : 'var(--border-light)'}`,
                borderRadius: '2px'
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      {isMulti && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          {Array.from({ length: playerCount }, (_, i) => (
            <input
              key={i}
              type="text"
              value={playerNames[i]}
              maxLength={20}
              placeholder={`Spieler ${i + 1}`}
              onChange={(e) => setPlayerNames(prev => { const n = [...prev]; n[i] = e.target.value; return n; })}
              style={{
                width: '100%', padding: '8px 10px', fontSize: '14px',
                border: '1px solid var(--border-light)', borderRadius: '2px',
                background: '#fff', color: 'var(--color-primary)', boxSizing: 'border-box'
              }}
            />
          ))}
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Reihum gefragt — am Ende gewinnt die höchste Trefferzahl.
          </div>
        </div>
      )}

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
