import React, { useMemo } from 'react';
import { Flame, AlertCircle, BarChart3, Trophy } from 'lucide-react';
import QuizLauncher from './QuizLauncher';
// Deutsche Kategorie-Labels der MCQ-Domains (Tier, Sprachfamilie, …) als Fallback,
// damit die Aufschlüsselung keine rohen Keys (animal, language_family) zeigt.
import { CATEGORY_LABELS } from './conceptLabels';

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
  constant: 'Konstanten',
  bone: 'Knochen',
  muscle: 'Muskeln',
  organ: 'Organe',
  body_fact: 'Körperwerte',
  species: 'Menschenarten'
};

export default function Dashboard({
  geodb,
  domain = { id: 'terra', latinName: 'Terra', label: 'Geografie' },
  questionPool = [],
  srsProgress = {},
  streakCount = 0,
  highScore = 0,
  onStartDailyReview
}) {
  const isTerra = domain.id === 'terra';
  // Terra behält Kartenobjekte ohne faire Frage (derzeit zwei Städte) für Atlas
  // und Karte. Für den Lernfortschritt zählen aber nur Entitäten, die in der
  // aktuellen Fragenmenge tatsächlich vorkommen.
  const countedEntities = useMemo(() => {
    const entities = Object.values(geodb.entities);
    if (!isTerra) return entities;
    const askedEntityIds = new Set(questionPool.map((question) => question.entityId));
    return entities.filter((entity) => askedEntityIds.has(entity.id));
  }, [geodb.entities, isTerra, questionPool]);
  const countedEntityIds = useMemo(
    () => new Set(countedEntities.map((entity) => entity.id)),
    [countedEntities]
  );
  const totalEntitiesCount = countedEntities.length;
  
  // Calculate status counts
  let masteredCount = 0;
  let familiarCount = 0;
  let learningCount = 0;
  
  Object.keys(srsProgress).forEach(id => {
    if (!countedEntityIds.has(id)) return;
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
  // Auch „Neu“ aus seiner wirklichen Anzahl berechnen. Der Rundungsrest der
  // anderen drei Anteile darf sonst fälschlich neue Konzepte vortäuschen
  // (z. B. 3 von 3 entdeckt: 33 + 33 + 33 ließ früher 1 % „Neu“ übrig).
  const unseenPercent = getPercent(unseenCount);

  // Konzepte generisch nach Typ gruppieren (domain-unabhängig).
  const entityTypes = {};
  countedEntities.forEach(entity => {
    const type = entity.type;
    if (!type) return;
    // TYPE_LABELS (Terra/Astra/Homo, Plural) zuerst; sonst singuläres CATEGORY_LABELS
    // der übrigen MCQ-Domains; erst dann der Roh-Key als letzter Ausweg.
    entityTypes[type] ||= { label: TYPE_LABELS[type] || CATEGORY_LABELS[type] || type, count: 0, studied: 0 };
    entityTypes[type].count++;
    if (srsProgress[entity.id] && srsProgress[entity.id].repetitions > 0) {
      entityTypes[type].studied++;
    }
  });

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
          Spielstand
        </h2>
        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 500 }}>
          <span style={{ color: 'var(--color-secondary)', fontWeight: 700 }}>{questionPool.length.toLocaleString('de-DE')} Fragen</span> · <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{totalEntitiesCount.toLocaleString('de-DE')} {domain.id === 'terra' ? 'Orte' : 'Konzepte'}</span>
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

      {/* Schwierigkeits-/Modus-Wahl + Quiz-Start (geteilt mit dem Lern-Quiz-Tab) */}
      <div style={{ marginBottom: '20px' }}>
        <QuizLauncher domain={domain} onStart={onStartDailyReview} />
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
          Deine Sammlung
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
            <div style={{ width: `${learningPercent}%`, height: '100%', background: '#DCE0D5' }} title={`Angespielt: ${learningPercent}%`} />
            <div style={{ width: `${unseenPercent}%`, height: '100%', background: 'transparent' }} title={`Neu: ${unseenPercent}%`} />
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
              <span style={{ color: 'var(--text-muted)', flex: 1 }}>Angespielt</span>
              <span style={{ fontWeight: 600 }}>{learningCount} ({learningPercent}%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EAE6DC', display: 'inline-block' }} />
              <span style={{ color: 'var(--text-muted)', flex: 1 }}>Neu</span>
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
                    {data.studied} / {data.count} entdeckt
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
