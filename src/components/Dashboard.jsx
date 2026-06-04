import React, { useState } from 'react';
import { Flame, Compass, Calendar, Award, BookOpen, AlertCircle, BarChart3, Trophy } from 'lucide-react';

// Deutsche Labels für Konzept-Typen über alle Domains hinweg.
// Unbekannte Typen werden unverändert angezeigt.
const TYPE_LABELS = {
  country: 'Staaten',
  state: 'Bundesländer / Provinzen',
  city: 'Städte',
  river: 'Flüsse',
  mountain: 'Gebirge',
  landmark: 'Sehenswürdigkeiten',
  planet: 'Planeten',
  dwarf_planet: 'Zwergplaneten',
  moon: 'Monde',
  star: 'Sterne',
  galaxy: 'Galaxien',
  constant: 'Konstanten'
};

export default function Dashboard({
  geodb,
  domain = { id: 'terra', latinName: 'Terra', label: 'Geografie' },
  questionPool = [],
  srsProgress = {},
  dueCount = 0,
  streakCount = 0,
  highScore = 0,
  onStartDailyReview
}) {
  const [selectedLevel, setSelectedLevel] = useState(1); // 1 | 2 | 3 | 4
  const [selectedMode, setSelectedMode] = useState('all'); // 'all' | 'countries' | 'cities' | 'rivers' | 'stadt-land-fluss'
  const isTerra = domain.id === 'terra';
  const totalEntitiesCount = Object.keys(geodb.entities).length;
  
  // Calculate status counts
  let masteredCount = 0;
  let familiarCount = 0;
  let learningCount = 0;
  
  Object.keys(srsProgress).forEach(id => {
    const item = srsProgress[id];
    if (item.repetitions > 0) {
      if (item.interval >= 30) {
        masteredCount++;
      } else if (item.interval >= 7) {
        familiarCount++;
      } else {
        learningCount++;
      }
    }
  });

  const unseenCount = totalEntitiesCount - (masteredCount + familiarCount + learningCount);
  
  // Percentages
  const getPercent = (count) => {
    if (totalEntitiesCount === 0) return 0;
    return Math.round((count / totalEntitiesCount) * 100);
  };

  const masteredPercent = getPercent(masteredCount);
  const familiarPercent = getPercent(familiarCount);
  const learningPercent = getPercent(learningCount);
  const unseenPercent = 100 - (masteredPercent + familiarPercent + learningPercent);

  // Konzepte generisch nach Typ gruppieren (domain-unabhängig).
  const entityTypes = {};
  Object.values(geodb.entities).forEach(entity => {
    const type = entity.type;
    if (!type) return;
    entityTypes[type] ||= { label: TYPE_LABELS[type] || type, count: 0, studied: 0 };
    entityTypes[type].count++;
    if (srsProgress[entity.id] && srsProgress[entity.id].repetitions > 0) {
      entityTypes[type].studied++;
    }
  });

  const levelInfo = {
    1: { title: 'Leicht (Stufe 1)', desc: 'Einfache Länder, Kontinente & leichte Silhouetten. (1x Punkte)' },
    2: { title: 'Mittel (Stufe 2)', desc: 'Mittelschwere Länder, Karten-Klick & Städte-Zuordnung. (2.5x Punkte)' },
    3: { title: 'Schwer (Stufe 3)', desc: 'Subnational: Bundesländer & Provinzen (Umrisse & Klicks). (5x Punkte)' },
    4: { title: 'Meister (Stufe 4)', desc: 'Meister: Exotische Länder, ferne Provinzen & obscure Städte. (10x Punkte)' }
  };

  return (
    <div className="terra-panel slide-in" style={{
      height: '100%',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <div style={{
        padding: '20px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto'
      }}>
      {/* Top Banner: Welcome */}
      <div style={{ marginBottom: '14px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
          {domain.latinName} · {domain.label}
        </span>
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '24px', color: 'var(--color-primary)', fontWeight: 700, marginBottom: '2px' }}>
          Lernkontrolle
        </h2>
        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 500 }}>
          Fragen-Pool: <span style={{ color: 'var(--color-secondary)', fontWeight: 700 }}>{questionPool.length.toLocaleString('de-DE')} Fragen</span> | Karteikarten: <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{totalEntitiesCount.toLocaleString('de-DE')} Orte</span>
        </div>
      </div>

      {/* Stats Cards: Streak & Highscore */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        {/* Highscore */}
        <div className="terra-panel-inset" style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(139, 111, 59, 0.02)',
          border: '1px solid var(--border-light)'
        }}>
          <Trophy size={20} style={{ color: 'var(--color-secondary)' }} />
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>HIGHSCORE</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)', lineHeight: 1.2 }}>
              {highScore} Pkt.
            </div>
          </div>
        </div>

        {/* Streak */}
        <div className="terra-panel-inset" style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(181, 137, 0, 0.02)',
          border: '1px solid var(--border-light)'
        }}>
          <Flame size={20} style={{ color: 'var(--color-warning)' }} />
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>TÄGLICHER STREAK</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)', lineHeight: 1.2 }}>
              {streakCount} {streakCount === 1 ? 'Tag' : 'Tage'}
            </div>
          </div>
        </div>
      </div>

      <hr style={{ border: 'none', height: '1px', background: 'var(--border-light)', marginBottom: '14px' }} />

      {/* Difficulty & Gameplay launch card */}
      <div className="terra-panel-inset" style={{
        padding: '16px',
        marginBottom: '20px',
        background: '#FAF9F4',
        border: '1px solid var(--border-light)'
      }}>
        <h4 style={{ fontFamily: 'var(--font-title)', color: 'var(--color-primary)', fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
          Schwierigkeitsgrad wählen
        </h4>
        
        {/* Radio Button list */}
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
          {levelInfo[selectedLevel].desc}
        </div>

        {/* Spielmodi sind geografiespezifisch (Stadt/Land/Fluss) -> nur bei Terra */}
        {isTerra && (<>
        <h4 style={{ fontFamily: 'var(--font-title)', color: 'var(--color-primary)', fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
          Spielmodus wählen
        </h4>

        {/* Mode selection Radio list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          {[
            { id: 'all', label: 'Alle Kategorien' },
            { id: 'countries', label: 'Nur Länder & Provinzen' },
            { id: 'cities', label: 'Nur Städte' },
            { id: 'rivers', label: 'Nur Flüsse' },
            { id: 'stadt-land-fluss', label: 'Stadt, Land, Fluss (Wechselnd)' }
          ].map(mode => (
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
          onClick={() => onStartDailyReview(selectedLevel, isTerra ? selectedMode : 'all')}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          <Compass size={18} />
          Quiz starten
        </button>
      </div>

      {/* Progress Breakdown */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{
          fontFamily: 'var(--font-title)',
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--color-primary)',
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <BarChart3 size={18} style={{ color: 'var(--color-primary)' }} />
          Karteikarten-Verteilung
        </h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Progress bar */}
          <div style={{
            width: '100%',
            height: '10px',
            background: '#FAF6EE',
            borderRadius: '2px',
            overflow: 'hidden',
            display: 'flex',
            border: '1px solid var(--border-light)'
          }}>
            <div style={{ width: `${masteredPercent}%`, height: '100%', background: '#C5B595' }} title={`Gemeistert: ${masteredPercent}%`} />
            <div style={{ width: `${familiarPercent}%`, height: '100%', background: '#A4B4CC' }} title={`Vertraut: ${familiarPercent}%`} />
            <div style={{ width: `${learningPercent}%`, height: '100%', background: '#DCE0D5' }} title={`Lernen: ${learningPercent}%`} />
            <div style={{ width: `${unseenPercent}%`, height: '100%', background: 'transparent' }} title={`Ungelernt: ${unseenPercent}%`} />
          </div>

          {/* Legend Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', marginTop: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#C5B595', display: 'inline-block' }} />
              <span style={{ color: 'var(--text-muted)', flex: 1 }}>Gemeistert</span>
              <span style={{ fontWeight: 600 }}>{masteredCount} ({masteredPercent}%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#A4B4CC', display: 'inline-block' }} />
              <span style={{ color: 'var(--text-muted)', flex: 1 }}>Vertraut</span>
              <span style={{ fontWeight: 600 }}>{familiarCount} ({familiarPercent}%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#DCE0D5', display: 'inline-block' }} />
              <span style={{ color: 'var(--text-muted)', flex: 1 }}>Lernen</span>
              <span style={{ fontWeight: 600 }}>{learningCount} ({learningPercent}%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EAE6DC', display: 'inline-block' }} />
              <span style={{ color: 'var(--text-muted)', flex: 1 }}>Ungelernt</span>
              <span style={{ fontWeight: 600 }}>{unseenCount} ({unseenPercent}%)</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Category List */}
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {Object.entries(entityTypes).map(([key, data]) => {
            const progress = data.count > 0 ? Math.round((data.studied / data.count) * 100) : 0;
            return (
              <div key={key} className="terra-panel-inset" style={{
                padding: '10px 14px',
                background: 'rgba(0,0,0,0.01)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '14px'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{data.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ color: 'var(--text-muted)' }}>
                    {data.studied} / {data.count} gelernt
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--color-secondary)', fontSize: '15px' }}>
                    {progress}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Help info (geografiespezifisch) */}
      {isTerra && (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: 'var(--text-muted)', fontSize: '13px', marginTop: '16px', lineHeight: 1.4 }}>
        <AlertCircle size={16} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: '1px' }} />
        <span>Klicke auf den Tab "Weltatlas" oben, um die Weltkarte frei zu studieren. Der Startbildschirm zeigt absichtlich keine Grenzen, um den Globus clean zu halten.</span>
      </div>
      )}
      </div>
    </div>
  );
}
