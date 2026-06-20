import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import Atlas from './components/Atlas';
import Quiz from './components/Quiz';
import QuizLauncher from './components/QuizLauncher';
import Dashboard from './components/Dashboard';
import DomainSwitcher from './components/DomainSwitcher';
import VisualPanel from './components/VisualPanel';
import geodb from './data/geodb.json';
import { DOMAINS, getDomainById } from './domains';
import pkg from '../package.json';
import { getAllProgress, getSetting, saveSetting } from './utils/db';
import { playClick, isAudioMuted, setAudioMuted } from './utils/audio';
import { BarChart3, HelpCircle, Compass, Flame, Trophy, Volume2, VolumeX, Images } from 'lucide-react';

// Museum-Explorer lazy laden — enthält keine schweren Abhängigkeiten,
// aber lazy hält den initialen Bundle-Umfang schlank.
const MuseumExplorer = lazy(() => import('./components/MuseumExplorer'));

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'atlas' | 'explore' | 'quiz' | 'museum'
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  // Ob im Lern-Quiz-Tab bereits eine Runde "scharf gestellt" wurde. false =
  // Vorschalt-Screen mit Stufen-/Modus-Wahl; true = laufende Quizrunde. Wird über
  // einen Start-Handler (Dashboard- oder Tab-Launcher, Atlas-Schnellquiz) gesetzt
  // und beim Klick auf den Lern-Quiz-Tab bewusst zurückgesetzt, damit man dort
  // immer zuerst die Schwierigkeit wählt statt sofort in Stufe 1 zu landen.
  const [quizArmed, setQuizArmed] = useState(false);
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

  // Museum: Konzept-Maps aller Domains — wird einmalig beim ersten Öffnen
  // des Museum-Tabs geladen und dann gecacht (domainId -> Map).
  const [allDomainData, setAllDomainData] = useState({});

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

  // Museum-Daten: beim ersten Öffnen des Museum-Tabs alle Domains parallel laden.
  // Das Laden geschieht nur einmal (Prüfung Object.keys länge) und wird gecacht.
  useEffect(() => {
    if (activeTab !== 'museum') return;
    // Nur nachladen, wenn noch keine Daten vorhanden.
    if (Object.keys(allDomainData).length > 0) return;
    let cancelled = false;
    Promise.all(
      DOMAINS.map(domain =>
        domain.loadConcepts()
          .then(data => ({ id: domain.id, data }))
          .catch(() => ({ id: domain.id, data: {} }))
      )
    ).then(results => {
      if (cancelled) return;
      const map = {};
      results.forEach(({ id, data }) => { map[id] = data; });
      setAllDomainData(map);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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
      setQuizArmed(true);   // Schnellquiz startet ohne Vorschalt-Screen direkt
      setActiveTab('quiz');
    }
  };

  // Startet eine Quizrunde. Ohne Schwierigkeitsstufen nur noch der Spielmodus
  // (bei Terra Stadt/Land/Fluss, sonst 'all'); die Fragen mischt der Quiz selbst.
  const handleStartDailyReview = (mode = 'all') => {
    playClick();
    setQuizMode(mode);
    setQuizArmed(true); // Runde scharf stellen -> Quiz statt Vorschalt-Screen
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
    setQuizArmed(false); // Runde beendet -> nächster Lern-Quiz-Aufruf zeigt wieder die Wahl
    setActiveTab('dashboard');
  };

  const handleTabChange = (tab) => {
    playClick();
    // Direkter Klick auf den Lern-Quiz-Tab: Runde "entschärfen", damit zuerst der
    // Vorschalt-Screen mit Stufenwahl erscheint (nicht sofort Stufe 1).
    if (tab === 'quiz') setQuizArmed(false);
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
    setQuizArmed(false); // Bereichswechsel -> Quizrunde zurücksetzen
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

  // Shell-Layout via CSS-Klassen statt Inline-Styles — Masse/Responsive
  // zentral in index.css (.app-shell etc.). Siehe mobile-layout-plan.md.
  return (
    <div className="app-shell">
      {/* Terra Academic Header */}
      <header className="terra-panel app-header">
        {/* Bereichsauswahl + App-Wortmarke (ersetzt die frühere statische Kopfzeile) */}
        <div className="app-header-brand">
          <DomainSwitcher
            domains={DOMAINS}
            activeId={activeDomainId}
            onSelect={handleDomainChange}
            srsProgress={srsProgress}
          />
          <span
            className="app-wordmark"
            title="Scientia potentia est — Wissen ist Macht"
            style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px', whiteSpace: 'nowrap' }}
          >
            Scientia · v{pkg.version}
          </span>
        </div>

        {/* Tab Selectors */}
        <nav className="app-header-nav">
          {/* "Übersicht" nur für Domains ohne eigenen Explorer. Wo es einen gibt
              (z.B. Astra-Sonnensystem), ist der Explorer die sinnvollere Startseite. */}
          {!activeDomain.Explorer && (
            <button
              className={activeTab === 'dashboard' ? 'btn-terra-primary' : 'btn-terra'}
              onClick={() => handleTabChange('dashboard')}
            >
              <BarChart3 size={16} />
              Übersicht
            </button>
          )}
          {activeDomain.hasMap && (
            <button
              className={activeTab === 'atlas' ? 'btn-terra-primary' : 'btn-terra'}
              onClick={() => handleTabChange('atlas')}
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
          {/* Museum-Tab: globale Bildgalerie über alle Domains */}
          <button
            className={activeTab === 'museum' ? 'btn-terra-primary' : 'btn-terra'}
            onClick={() => handleTabChange('museum')}
            style={{ fontSize: '15px', padding: '8px 14px' }}
          >
            <Images size={16} />
            Museum
          </button>
        </nav>
        
        {/* Score & Streak indicators */}
        <div className="app-header-meta">
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
      <main className="app-main">
        {/* Erkundungsmodus: der domänen-eigene Explorer (z.B. Astra-Sonnensystem)
            nutzt die volle Breite, ohne rechte Sidebar. Sonst das gewohnte
            Zwei-Spalten-Layout (Visual links, Tab-Panel rechts). */}
        {activeTab === 'museum' ? (
          /* Museum: volle Breite wie der Explore-Tab, kein VisualPanel daneben */
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, padding: 0, height: '100%' }}>
            <Suspense fallback={
              <div className="terra-panel" style={{ height: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: 'var(--text-muted)',
                border: '1px solid var(--border-light)' }}>Museum wird geladen …</div>
            }>
              <MuseumExplorer allDomainData={allDomainData} />
            </Suspense>
          </div>
        ) : activeTab === 'explore' && activeDomain.Explorer ? (
          <>
            {/* Erkundung links (z.B. Astra-Sonnensystem), rechts die gewohnte
                Dashboard-Sidebar mit Stufen-Wähler + Quiz-Start — analog zu Terra. */}
            <div className="app-pane-left">
              <Suspense fallback={
                <div className="terra-panel" style={{ height: '100%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'var(--text-muted)', background: '#05060f',
                  border: '1px solid var(--border-light)' }}>Erkundung wird geladen …</div>
              }>
                <activeDomain.Explorer domain={activeDomain} concepts={concepts} srsProgress={srsProgress} />
              </Suspense>
            </div>
            <div className="app-pane-right">
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
        <div className="app-pane-left">
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

        {/* Rechte Sidebar — Geometrie/Scroll in .app-pane-right (index.css). */}
        <div className="app-pane-right">
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

          {activeTab === 'quiz' && (quizArmed ? (
            <Quiz
              geodb={domainDb}
              questionPool={questionPool}
              domainId={activeDomain.id}
              dueEntities={dueEntities}
              newEntities={newEntities}
              quizMode={quizMode}
              clickedMapId={clickedMapId}
              resetClickedMapId={() => setClickedMapId(null)}
              onQuizFinished={handleQuizFinished}
              onSetQuizState={setMapState}
              onActiveConceptChange={handleActiveConceptChange}
              onAddScore={handleAddScorePoints}
            />
          ) : (
            /* Vorschalt-Screen: bei Terra den Spielmodus wählen, sonst direkt starten.
               Keine Schwierigkeitsstufen mehr — die Fragen mischt der Quiz selbst. */
            <div className="terra-panel slide-in" style={{ height: '100%', overflowY: 'auto', padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
                  {activeDomain.latinName} · {activeDomain.label}
                </span>
                <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '24px', color: 'var(--color-primary)', fontWeight: 700, marginBottom: '2px' }}>
                  Lern-Quiz
                </h2>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {activeDomain.id === 'terra' ? 'Wähle den Spielmodus und starte die Runde.' : 'Starte eine Runde — die Fragen werden zufällig gemischt.'}
                </div>
              </div>
              <QuizLauncher domain={activeDomain} onStart={handleStartDailyReview} />
            </div>
          ))}
        </div>
        </>
        )}
      </main>
    </div>
  );
}
