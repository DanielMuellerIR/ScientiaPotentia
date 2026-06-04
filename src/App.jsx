import React, { useState, useEffect } from 'react';
import Map from './components/Map';
import Atlas from './components/Atlas';
import Quiz from './components/Quiz';
import Dashboard from './components/Dashboard';
import geodb from './data/geodb.json';
import { getAllProgress, getSetting, saveSetting } from './utils/db';
import { playClick, isAudioMuted, setAudioMuted } from './utils/audio';
import { Globe, BarChart3, HelpCircle, Compass, Flame, Trophy, Volume2, VolumeX } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'atlas' | 'quiz'
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [quizDifficulty, setQuizDifficulty] = useState(1);
  const [quizMode, setQuizMode] = useState('all'); // 'all' | 'countries' | 'cities' | 'rivers' | 'stadt-land-fluss'
  const [clickedMapId, setClickedMapId] = useState(null);
  const [isMuted, setIsMuted] = useState(isAudioMuted());

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

  // Update map state mode based on active tab
  useEffect(() => {
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

  const loadProgressData = async () => {
    try {
      const progressList = await getAllProgress();
      const progressMap = {};
      progressList.forEach(item => {
        progressMap[item.entityId] = item;
      });
      setSrsProgress(progressMap);

      const now = Date.now();
      const due = [];
      const unused = [];

      Object.keys(geodb.entities).forEach(id => {
        const entity = geodb.entities[id];
        const progress = progressMap[id];

        if (!progress || progress.repetitions === 0) {
          unused.push(entity);
        } else if (progress.nextDueDate <= now) {
          due.push(entity);
        }
      });

      setDueEntities(due);
      setNewEntities(unused);
    } catch (e) {
      console.error('Error loading progress data:', e);
    }
  };

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
    const entity = geodb.entities[entityId];
    if (entity) {
      setSelectedEntityId(entityId);
      setActiveTab('atlas');
    }
  };

  const handleStartQuickQuiz = (entityId) => {
    playClick();
    const targetEntity = geodb.entities[entityId];
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
        {/* Title logo area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Globe size={24} style={{ color: 'var(--color-primary)' }} />
          <h1 style={{
            fontFamily: 'var(--font-title)',
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--color-primary)',
            letterSpacing: '0.5px'
          }}>
            Terra Weltatlas v1.3.0
          </h1>
        </div>

        {/* Tab Selectors */}
        <nav style={{ display: 'flex', gap: '6px' }}>
          <button 
            className={activeTab === 'dashboard' ? 'btn-terra-primary' : 'btn-terra'}
            onClick={() => handleTabChange('dashboard')}
            style={{ fontSize: '15px', padding: '8px 14px' }}
          >
            <BarChart3 size={16} />
            Übersicht
          </button>
          <button 
            className={activeTab === 'atlas' ? 'btn-terra-primary' : 'btn-terra'}
            onClick={() => handleTabChange('atlas')}
            style={{ fontSize: '15px', padding: '8px 14px' }}
          >
            <Compass size={16} />
            Weltatlas
          </button>
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
        {/* Map Container */}
        <div className="terra-panel" style={{
          flex: 1,
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
          border: '1px solid var(--border-light)',
          background: '#EAE6DC'
        }}>
          <Map 
            selectedId={selectedEntityId}
            onSelectEntity={handleSelectEntityFromMap}
            highlightedIds={mapState.highlightedIds}
            correctIds={mapState.correctIds}
            wrongIds={mapState.wrongIds}
            progressHeatmap={srsProgress}
            mode={mapState.mode}
            showSubdivisions={mapState.showSubdivisions}
            zoomToEntityId={mapState.zoomToEntityId}
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
              geodb={geodb}
              srsProgress={srsProgress}
              dueCount={dueEntities.length}
              streakCount={streakCount}
              highScore={highScore}
              onStartDailyReview={handleStartDailyReview}
            />
          )}

          {activeTab === 'atlas' && (
            <Atlas 
              selectedEntity={geodb.entities[selectedEntityId]}
              srsProgress={srsProgress[selectedEntityId]}
              onStartQuickQuiz={handleStartQuickQuiz}
              geodb={geodb}
              onSelectEntity={handleSelectEntityFromMap}
            />
          )}

          {activeTab === 'quiz' && (
            <Quiz 
              geodb={geodb}
              dueEntities={dueEntities}
              newEntities={newEntities}
              difficulty={quizDifficulty}
              quizMode={quizMode}
              clickedMapId={clickedMapId}
              resetClickedMapId={() => setClickedMapId(null)}
              onQuizFinished={handleQuizFinished}
              onSetQuizState={setMapState}
              onAddScore={handleAddScorePoints}
            />
          )}
        </div>
      </main>
    </div>
  );
}
