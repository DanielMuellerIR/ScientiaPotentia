import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Atlas from './components/Atlas';
import Quiz from './components/Quiz';
import Dashboard from './components/Dashboard';
import DomainSwitcher from './components/DomainSwitcher';
import VisualPanel from './components/VisualPanel';
import geodb from './data/geodb.json';
import { DOMAINS, getDomainById } from './domains';
import pkg from '../package.json';
import { getAllProgress, getSetting, saveSetting } from './utils/db';
import { playClick, isAudioMuted, setAudioMuted } from './utils/audio';
import { BarChart3, HelpCircle, Compass, Flame, Trophy, Volume2, VolumeX } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'atlas' | 'explore' | 'quiz'
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [quizDifficulty, setQuizDifficulty] = useState(1);
  const [quizMode, setQuizMode] = useState('all'); // 'all' | 'countries' | 'cities' | 'rivers' | 'stadt-land-fluss'
  const [clickedMapId, setClickedMapId] = useState(null);
  const [isMuted, setIsMuted] = useState(isAudioMuted());

  // Aktuell im Quiz gefragtes Konzept (Key, z.B. "astra:mars"). Steuert die
  // linke Visualisierung (VisualPanel) frageweise. null = keine aktive Frage.
  const [activeConceptKey, setActiveConceptKey] = useState(null);
  // Selbstverraeter-Guard: welches Attribut prueft die aktive Frage und ist die
  // Antwort der Konzeptname selbst? Das Visual blendet damit den verraeterischen
  // Chip/Marker/Namen aus, damit die Antwort nicht schon links sichtbar ist.
  const [activeTestedAttribute, setActiveTestedAttribute] = useState(null);
  const [activeAnswerIsName, setActiveAnswerIsName] = useState(false);
  const [activeHideConceptIdentity, setActiveHideConceptIdentity] = useState(false);
  // Wird die Frage beantwortet, darf das linke Visual erklaerende Details wie
  // FunFacts wieder zeigen. Vorher bleiben sie verborgen, weil Freitext oft
  // indirekte Hinweise auf die richtige Antwort enthaelt.
  const [activeQuestionAnswered, setActiveQuestionAnswered] = useState(false);

  // Setzt Konzept + Verraeter-Infos aus der Quiz-Meldung zugleich.
  const handleActiveConceptChange = (payload = {}) => {
    const { key, testedAttribute, answerIsName, hideConceptIdentity, isAnswered } = payload || {};
    setActiveConceptKey(key ?? null);
    setActiveTestedAttribute(testedAttribute ?? null);
    setActiveAnswerIsName(Boolean(answerIsName));
    setActiveHideConceptIdentity(Boolean(hideConceptIdentity));
    setActiveQuestionAnswered(Boolean(isAnswered));
  };

  // Aktive Wissens-Domain, per DomainSwitcher umschaltbar (Terra, Astra, …).
  const [activeDomainId, setActiveDomainId] = useState('terra');
  const activeDomain = getDomainById(activeDomainId);

  // Konzeptspeicher der aktiven Domain (Map conceptKey -> Konzept). Startwert
  // sind die Terra-Entities, damit der erste Render sofort Daten hat.
  const [concepts, setConcepts] = useState(geodb.entities);
  // Fragenkatalog der aktiven Domain. Wird zur Laufzeit aus public/data/ geladen
  // (entlastet das JS-Bundle, ermöglicht beliebig viele Domains).
  const [questionPool, setQuestionPool] = useState([]);

  // db-artiges Objekt für Komponenten, die geodb.entities erwarten (Quiz,
  // Dashboard, Atlas) — domain-agnostisch über den Konzeptspeicher.
  const domainDb = useMemo(() => ({ entities: concepts }), [concepts]);

  const handleToggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    setAudioMuted(newMuted);
    if (!newMuted) {
      setTimeout(() => playClick(), 10);
    }
  };

  const activeTabRef = React.useRef(activeTab);
  activeTabRef.current = activeTab;

  // SRS & Progress State
  const [srsProgress, setSrsProgress] = useState({});
  const [dueEntities, setDueEntities] = useState([]);
  const [newEntities, setNewEntities] = useState([]);
  const [streakCount, setStreakCount] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // Map state to convey quiz styles/highlights
  const [mapState, setMapState] = useState({
    mode: 'dashboard',
    highlightedIds: [],
    correctIds: [],
    wrongIds: [],
    showSubdivisions: false,
    zoomToEntityId: null
  });

  // Load progress, settings, and highscore on startup
  useEffect(() => {
    loadProgressData();
    loadStreak();
    loadHighScore();
  }, []);

  // Konzepte + Fragen der aktiven Domain laden (Lazy-Fetch je Domain-Wechsel).
  useEffect(() => {
    let cancelled = false;
    Promise.all([activeDomain.loadConcepts(), activeDomain.loadQuestions()])
      .then(([loadedConcepts, questions]) => {
        if (cancelled) return;
        setConcepts(loadedConcepts || {});
        setQuestionPool(Array.isArray(questions) ? questions : []);
      })
      .catch(e => {
        console.error('Error loading domain data:', e);
        if (!cancelled) { setConcepts({}); setQuestionPool([]); }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDomainId]);

  // Update map state mode based on active tab
  useEffect(() => {
    // Verlaesst man das Quiz, gibt es keine aktive Frage -> Konzept-Visual zuruecksetzen.
    if (activeTab !== 'quiz') {
      setActiveConceptKey(null);
      setActiveTestedAttribute(null);
      setActiveAnswerIsName(false);
      setActiveHideConceptIdentity(false);
      setActiveQuestionAnswered(false);
    }
    setMapState(prev => ({
      ...prev,
      mode: activeTab,
      highlightedIds: activeTab === 'quiz' ? prev.highlightedIds : [],
      correctIds: activeTab === 'quiz' ? prev.correctIds : [],
      wrongIds: activeTab === 'quiz' ? prev.wrongIds : [],
      showSubdivisions: activeTab === 'quiz' ? prev.showSubdivisions : false,
      zoomToEntityId: activeTab === 'quiz' ? prev.zoomToEntityId : null
    }));
  }, [activeTab]);

  // Lädt den (domainübergreifenden) Lernfortschritt aus IndexedDB.
  const loadProgressData = async () => {
    try {
      const progressList = await getAllProgress();
      const progressMap = {};
      progressList.forEach(item => {
        progressMap[item.entityId] = item;
      });
      setSrsProgress(progressMap);
    } catch (e) {
      console.error('Error loading progress data:', e);
    }
  };

  // Fällige/neue Konzepte werden aus den Konzepten der AKTIVEN Domain plus dem
  // Fortschritt abgeleitet — neu berechnet bei Domain-Wechsel oder Fortschritt.
  useEffect(() => {
    const now = Date.now();
    const due = [];
    const unused = [];

    Object.keys(concepts).forEach(id => {
      const entity = concepts[id];
      const progress = srsProgress[id];

      if (!progress || progress.repetitions === 0) {
        unused.push(entity);
      } else if (progress.nextDueDate <= now) {
        due.push(entity);
      }
    });

    setDueEntities(due);
    setNewEntities(unused);
  }, [concepts, srsProgress]);

  const loadStreak = async () => {
    try {
      const streak = await getSetting('streakCount', 0);
      const lastReviewDateStr = await getSetting('lastReviewDate', null);
      
      if (!lastReviewDateStr) {
        setStreakCount(0);
        return;
      }

      const lastReview = new Date(lastReviewDateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      lastReview.setHours(0, 0, 0, 0);

      const diffTime = Math.abs(today - lastReview);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 1) {
        setStreakCount(0);
        await saveSetting('streakCount', 0);
      } else {
        setStreakCount(streak);
      }
    } catch (e) {
      console.error('Error loading streak:', e);
    }
  };

  const loadHighScore = async () => {
    try {
      const savedScore = await getSetting('highScore', 0);
      setHighScore(savedScore);
    } catch (e) {
      console.error('Error loading highscore:', e);
    }
  };

  const handleAddScorePoints = async (pointsEarned) => {
    try {
      const currentScore = await getSetting('activeScore', 0);
      const newScore = currentScore + pointsEarned;
      await saveSetting('activeScore', newScore);
      
      if (newScore > highScore) {
        setHighScore(newScore);
        await saveSetting('highScore', newScore);
      }
    } catch (e) {
      console.error('Error updating score:', e);
    }
  };

  const handleSelectEntityFromMap = (entityId) => {
    if (activeTabRef.current === 'quiz') {
      // In Quiz mode, clicking on the map is used as the answer
      playClick();
      setClickedMapId(entityId);
      return;
    }

    playClick();
    const entity = concepts[entityId];
    if (entity) {
      setSelectedEntityId(entityId);
      setActiveTab('atlas');
    }
  };

  const handleStartQuickQuiz = (entityId) => {
    playClick();
    const targetEntity = concepts[entityId];
    if (targetEntity) {
      setDueEntities([targetEntity]);
      setNewEntities([]);
      setQuizDifficulty(1); // Quick quiz default is level 1
      setActiveTab('quiz');
    }
  };

  const handleStartDailyReview = (level, mode = 'all') => {
    playClick();
    setQuizDifficulty(level);
    setQuizMode(mode);
    saveSetting('activeScore', 0); // Reset score points for the new round
    setActiveTab('quiz');
  };

  const handleQuizFinished = async () => {
    playClick();
    const today = new Date();
    const todayStr = today.toDateString();
    const lastReviewDateStr = await getSetting('lastReviewDate', null);

    if (lastReviewDateStr !== todayStr) {
      const newStreak = streakCount + 1;
      setStreakCount(newStreak);
      await saveSetting('streakCount', newStreak);
      await saveSetting('lastReviewDate', todayStr);
    }

    await loadProgressData();
    setActiveTab('dashboard');
  };

  const handleTabChange = (tab) => {
    playClick();
    setActiveTab(tab);
  };

  // Wechsel des Wissensbereichs: aktive Domain setzen und Ansicht zurücksetzen.
  // Konzepte/Fragen werden vom Lade-Effekt (Abhängigkeit activeDomainId) geholt.
  const handleDomainChange = (domainId) => {
    if (domainId === activeDomainId) return;
    playClick();
    setActiveDomainId(domainId);
    // Domains mit Explorer (z.B. Astra) starten direkt im Erkundungsbereich,
    // alle anderen in der Übersicht.
    setActiveTab(getDomainById(domainId).Explorer ? 'explore' : 'dashboard');
    setSelectedEntityId(null);
    setClickedMapId(null);
    setActiveConceptKey(null);
    setActiveTestedAttribute(null);
    setActiveAnswerIsName(false);
    setActiveHideConceptIdentity(false);
    setActiveQuestionAnswered(false);
    setMapState({
      mode: 'dashboard',
      highlightedIds: [],
      correctIds: [],
      wrongIds: [],
      showSubdivisions: false,
      zoomToEntityId: null
    });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      background: 'var(--bg-main)',
      color: 'var(--text-main)',
      fontFamily: 'var(--font-sans)',
      paddingBottom: '8px'
    }}>
      {/* Terra Academic Header */}
      <header className="terra-panel" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        margin: '12px 24px 0 24px',
        height: '60px',
        border: '1px solid var(--border-light)',
        zIndex: 100
      }}>
        {/* Bereichsauswahl + App-Wortmarke (ersetzt die frühere statische Kopfzeile) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <DomainSwitcher
            domains={DOMAINS}
            activeId={activeDomainId}
            onSelect={handleDomainChange}
            srsProgress={srsProgress}
          />
          <span
            title="Scientia potentia est — Wissen ist Macht"
            style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px', whiteSpace: 'nowrap' }}
          >
            Scientia potentia · v{pkg.version}
          </span>
        </div>

        {/* Tab Selectors */}
        <nav style={{ display: 'flex', gap: '6px' }}>
          {/* "Übersicht" nur für Domains ohne eigenen Explorer. Wo es einen gibt
              (z.B. Astra-Sonnensystem), ist der Explorer die sinnvollere Startseite. */}
          {!activeDomain.Explorer && (
            <button
              className={activeTab === 'dashboard' ? 'btn-terra-primary' : 'btn-terra'}
              onClick={() => handleTabChange('dashboard')}
              style={{ fontSize: '15px', padding: '8px 14px' }}
            >
              <BarChart3 size={16} />
              Übersicht
            </button>
          )}
          {activeDomain.hasMap && (
            <button
              className={activeTab === 'atlas' ? 'btn-terra-primary' : 'btn-terra'}
              onClick={() => handleTabChange('atlas')}
              style={{ fontSize: '15px', padding: '8px 14px' }}
            >
              <Compass size={16} />
              Weltatlas
            </button>
          )}
          {/* Erkundungs-Tab: nur Domains mit eigenem Explorer (z.B. Astra-Sonnensystem). */}
          {activeDomain.Explorer && (
            <button
              className={activeTab === 'explore' ? 'btn-terra-primary' : 'btn-terra'}
              onClick={() => handleTabChange('explore')}
              style={{ fontSize: '15px', padding: '8px 14px' }}
            >
              {activeDomain.ExplorerIcon ? <activeDomain.ExplorerIcon size={16} /> : <Compass size={16} />}
              {activeDomain.explorerLabel || 'Erkundung'}
            </button>
          )}
          <button 
            className={activeTab === 'quiz' ? 'btn-terra-primary' : 'btn-terra'}
            onClick={() => handleTabChange('quiz')}
            style={{ fontSize: '15px', padding: '8px 14px' }}
          >
            <HelpCircle size={16} />
            Lern-Quiz
          </button>
        </nav>
        
        {/* Score & Streak indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={handleToggleMute}
            className="btn-terra"
            style={{ 
              padding: '6px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              minWidth: '36px',
              height: '36px'
            }}
            title={isMuted ? 'Ton einschalten' : 'Ton ausschalten'}
          >
            {isMuted ? (
              <VolumeX size={18} style={{ color: 'var(--text-muted)' }} />
            ) : (
              <Volume2 size={18} style={{ color: 'var(--color-primary)' }} />
            )}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', fontWeight: 700, color: 'var(--color-secondary)' }}>
            <Trophy size={18} />
            <span>Bestmarke: {highScore}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', fontWeight: 600, color: 'var(--color-warning)' }}>
            <Flame size={18} />
            <span>Streak: {streakCount}d</span>
          </div>
        </div>
      </header>

      {/* Main Layout Area */}
      <main style={{
        flex: 1,
        display: 'flex',
        padding: '12px 24px 12px 24px',
        gap: '20px',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Erkundungsmodus: der domänen-eigene Explorer (z.B. Astra-Sonnensystem)
            nutzt die volle Breite, ohne rechte Sidebar. Sonst das gewohnte
            Zwei-Spalten-Layout (Visual links, Tab-Panel rechts). */}
        {activeTab === 'explore' && activeDomain.Explorer ? (
          <>
            {/* Erkundung links (z.B. Astra-Sonnensystem), rechts die gewohnte
                Dashboard-Sidebar mit Stufen-Wähler + Quiz-Start — analog zu Terra. */}
            <div style={{ flex: 1, height: '100%', minWidth: 0 }}>
              <Suspense fallback={
                <div className="terra-panel" style={{ height: '100%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'var(--text-muted)', background: '#05060f',
                  border: '1px solid var(--border-light)' }}>Erkundung wird geladen …</div>
              }>
                <activeDomain.Explorer domain={activeDomain} concepts={concepts} srsProgress={srsProgress} />
              </Suspense>
            </div>
            <div style={{ width: '390px', height: '100%', zIndex: 10, flexShrink: 0 }}>
              <Dashboard
                geodb={domainDb}
                domain={activeDomain}
                questionPool={questionPool}
                srsProgress={srsProgress}
                dueCount={dueEntities.length}
                streakCount={streakCount}
                highScore={highScore}
                onStartDailyReview={handleStartDailyReview}
              />
            </div>
          </>
        ) : (
        <>
        {/* Linkes Visualisierungs-Panel: Weltkarte bei Terra, sonst pro Frage
            das gefragte Konzept (3D/Vektor bzw. generische Konzeptkarte). */}
        <div style={{ flex: 1, height: '100%', minWidth: 0 }}>
          <VisualPanel
            domain={activeDomain}
            concepts={concepts}
            srsProgress={srsProgress}
            activeConceptKey={activeConceptKey}
            testedAttribute={activeTestedAttribute}
            answerIsName={activeAnswerIsName}
            hideConceptIdentity={activeHideConceptIdentity}
            isQuestionAnswered={activeQuestionAnswered}
            mapProps={{
              selectedId: selectedEntityId,
              onSelectEntity: handleSelectEntityFromMap,
              highlightedIds: mapState.highlightedIds,
              correctIds: mapState.correctIds,
              wrongIds: mapState.wrongIds,
              progressHeatmap: srsProgress,
              mode: mapState.mode,
              showSubdivisions: mapState.showSubdivisions,
              zoomToEntityId: mapState.zoomToEntityId
            }}
          />
        </div>

        {/* Floating Sidebar panel */}
        <div style={{
          width: '390px',
          height: '100%',
          zIndex: 10,
          flexShrink: 0
        }}>
          {activeTab === 'dashboard' && (
            <Dashboard
              geodb={domainDb}
              domain={activeDomain}
              questionPool={questionPool}
              srsProgress={srsProgress}
              dueCount={dueEntities.length}
              streakCount={streakCount}
              highScore={highScore}
              onStartDailyReview={handleStartDailyReview}
            />
          )}

          {activeTab === 'atlas' && (
            <Atlas
              selectedEntity={concepts[selectedEntityId]}
              srsProgress={srsProgress[selectedEntityId]}
              onStartQuickQuiz={handleStartQuickQuiz}
              geodb={domainDb}
              onSelectEntity={handleSelectEntityFromMap}
            />
          )}

          {activeTab === 'quiz' && (
            <Quiz
              geodb={domainDb}
              questionPool={questionPool}
              domainId={activeDomain.id}
              dueEntities={dueEntities}
              newEntities={newEntities}
              difficulty={quizDifficulty}
              quizMode={quizMode}
              clickedMapId={clickedMapId}
              resetClickedMapId={() => setClickedMapId(null)}
              onQuizFinished={handleQuizFinished}
              onSetQuizState={setMapState}
              onActiveConceptChange={handleActiveConceptChange}
              onAddScore={handleAddScorePoints}
            />
          )}
        </div>
        </>
        )}
      </main>
    </div>
  );
}
