import React, { useState, useEffect } from 'react';
import { calculateSRS, mapBinaryToQuality } from '../utils/srs';
import { saveProgress, addHistoryLog, getProgress } from '../utils/db';
import { playClick, playCorrectChime, playErrorBuzzer } from '../utils/audio';
import { Check, X, HelpCircle, ArrowRight, Award, RotateCcw, MapPin } from 'lucide-react';

export default function Quiz({ 
  geodb, 
  questionPool = [],
  domainId = 'terra',
  dueEntities = [], 
  newEntities = [], 
  difficulty = 1,
  quizMode = 'all',
  clickedMapId = null,
  resetClickedMapId,
  onQuizFinished, 
  onSetQuizState,
  onAddScore
}) {
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [points, setPoints] = useState(0); // Score points
  const [sessionFinished, setSessionFinished] = useState(false);
  const [countriesGeoJSON, setCountriesGeoJSON] = useState(null);
  const [subdivisionsGeoJSON, setSubdivisionsGeoJSON] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [wrongClickIds, setWrongClickIds] = useState([]);
  const [correctClickIds, setCorrectClickIds] = useState([]);
  const quizQuestions = Array.isArray(questionPool) ? questionPool : [];

  // Load GeoJSON geometries for isolated outline projections
  useEffect(() => {
    fetch('data/countries.json')
      .then(res => res.json())
      .then(data => setCountriesGeoJSON(data))
      .catch(err => console.error('Failed to load countries geometry:', err));
      
    fetch('data/subdivisions.json')
      .then(res => res.json())
      .then(data => setSubdivisionsGeoJSON(data))
      .catch(err => console.error('Failed to load subdivisions geometry:', err));
  }, []);

  // Generate quiz questions on mount or pool change
  useEffect(() => {
    generateQuizSession();
  }, [dueEntities, newEntities, difficulty, quizMode, questionPool]);

  // Set map layer configurations when entering new question
  useEffect(() => {
    if (questions.length > 0 && currentIdx < questions.length && !sessionFinished) {
      const q = questions[currentIdx];
      setStatusMessage('');
      setWrongClickIds([]);
      setCorrectClickIds([]);
      
      // Determine what to highlight or overlay on Map. If city, highlight/zoom to its parent country.
      const mapHighlightId = q.entityType === 'city' ? geodb.entities[q.entityId]?.metadata?.countryId : q.entityId;

      // Resolve river ID for city-river questions to zoom/highlight the river
      const isCityRiver = q.type === 'city-river';
      let riverId = null;
      if (isCityRiver) {
        const riverEntity = Object.values(geodb.entities).find(
          e => e.type === 'river' && e.name === q.correctAnswer
        );
        if (riverEntity) riverId = riverEntity.id;
      }

      if (q.type === 'click-map') {
        // Map Click Mode: show clean map, borders only, wait for click
        onSetQuizState({
          mode: 'quiz',
          highlightedIds: [],
          correctIds: [],
          wrongIds: [],
          showSubdivisions: q.entityType === 'state',
          zoomToEntityId: mapHighlightId || null
        });
      } else {
        // Highlight active question entity on Map in other modes
        const highlightedIds = [mapHighlightId, riverId].filter(id => id && typeof id === 'string');

        onSetQuizState({
          mode: 'quiz',
          highlightedIds: highlightedIds,
          correctIds: [],
          wrongIds: [],
          showSubdivisions: q.entityType === 'state',
          zoomToEntityId: riverId || mapHighlightId || null
        });
      }
    }
  }, [currentIdx, questions, sessionFinished]);

  // Listen to map click answers (q.type === 'click-map')
  useEffect(() => {
    if (questions.length > 0 && currentIdx < questions.length && !sessionFinished) {
      const q = questions[currentIdx];
      if (q.type === 'click-map' && clickedMapId && !isAnswered) {
        // Map clicked subdivision to its parent country if the question expects a country
        let actualClickedId = clickedMapId;
        const clickedEntity = geodb.entities[clickedMapId];
        if (q.entityType === 'country' && clickedEntity && clickedEntity.type === 'state') {
          actualClickedId = clickedEntity.metadata?.countryId;
        }

        const finalClickedEntity = geodb.entities[actualClickedId];
        const clickedName = finalClickedEntity ? finalClickedEntity.name : 'Unbekannter Ort';
        
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        if (actualClickedId === q.entityId) {
          // Correct Click!
          playCorrectChime();
          setIsAnswered(true);
          setCorrectClickIds([q.entityId]);
          setScore(prev => prev + 1);
          
          // Calculate points
          const earned = Math.round(10 * getDifficultyMultiplier() * (1 / newAttempts));
          setPoints(prev => prev + earned);
          if (onAddScore) onAddScore(earned);
  
          onSetQuizState({
            mode: 'quiz',
            highlightedIds: [],
            correctIds: [q.entityId].filter(id => id && typeof id === 'string'),
            wrongIds: wrongClickIds.filter(id => id && typeof id === 'string'),
            showSubdivisions: q.entityType === 'state',
            zoomToEntityId: q.entityId || null
          });
          
          saveUserAnswer(q.entityId, q.entityType, true, newAttempts);
        } else {
          // Wrong Click!
          playErrorBuzzer();
          const updatedWrongs = [...wrongClickIds, actualClickedId];
          setWrongClickIds(updatedWrongs);
          setStatusMessage(`Das war ${clickedName}. Gesucht war ${geodb.entities[q.entityId]?.name}. Versuche es erneut!`);
          
          onSetQuizState({
            mode: 'quiz',
            highlightedIds: [],
            correctIds: [],
            wrongIds: updatedWrongs.filter(id => id && typeof id === 'string'),
            showSubdivisions: q.entityType === 'state',
            zoomToEntityId: q.entityId || null
          });
  
          if (newAttempts >= 3) {
            // Force answer reveal after 3 failures
            setIsAnswered(true);
            setCorrectClickIds([q.entityId]);
            setStatusMessage(`Ausweg: Der gesuchte Ort ist jetzt grün hervorgehoben.`);
            
            onSetQuizState({
              mode: 'quiz',
              highlightedIds: [],
              correctIds: [q.entityId].filter(id => id && typeof id === 'string'),
              wrongIds: updatedWrongs.filter(id => id && typeof id === 'string'),
              showSubdivisions: q.entityType === 'state',
              zoomToEntityId: q.entityId || null
            });

            saveUserAnswer(q.entityId, q.entityType, false, newAttempts);
          }
        }
        
        if (resetClickedMapId) resetClickedMapId();
      }
    }
  }, [clickedMapId, isAnswered, sessionFinished, questions, currentIdx]);

  const getDifficultyMultiplier = () => {
    if (difficulty === 2) return 2.5;
    if (difficulty === 3) return 5.0;
    if (difficulty === 4) return 10.0;
    return 1.0;
  };

  const generateQuizSession = () => {
    if (quizQuestions.length === 0) {
      setQuestions([]);
      setCurrentIdx(0);
      setAttempts(0);
      setSelectedOption(null);
      setIsAnswered(false);
      setScore(0);
      setPoints(0);
      setSessionFinished(false);
      return;
    }

    const dueIds = new Set(dueEntities.map(d => d.id));
    const newIds = new Set(newEntities.map(n => n.id));

    const sortPool = (pool) => {
      return [...pool].sort((a, b) => {
        const aDue = dueIds.has(a.entityId) ? 2 : (newIds.has(a.entityId) ? 1 : 0);
        const bDue = dueIds.has(b.entityId) ? 2 : (newIds.has(b.entityId) ? 1 : 0);
        if (aDue !== bDue) {
          return bDue - aDue; // Higher priority first
        }
        return 0.5 - Math.random(); // Random shuffle for equal priority
      });
    };

    const usedEntityIds = new Set();
    const usedCorrectAnswers = new Set();

    // 1. Special sequence mode: Stadt, Land, Fluss alternating
    if (quizMode === 'stadt-land-fluss') {
      const getSortedPoolForType = (type) => {
        // Try requested difficulty, then fallback in order
        for (const d of [difficulty, 2, 3, 1, 4].filter((v, i, a) => a.indexOf(v) === i)) {
          let pool = [];
          if (type === 'city') {
            pool = quizQuestions.filter(q => q.difficulty === d && q.entityType === 'city');
          } else if (type === 'country') {
            pool = quizQuestions.filter(q => q.difficulty === d && (q.entityType === 'country' || q.entityType === 'state'));
          } else if (type === 'river') {
            pool = quizQuestions.filter(q => q.difficulty === d && (q.entityType === 'river' || q.type === 'city-river'));
          }
          if (pool.length > 0) {
            return sortPool(pool);
          }
        }
        return [];
      };

      const citiesSorted = getSortedPoolForType('city');
      const countriesSorted = getSortedPoolForType('country');
      const riversSorted = getSortedPoolForType('river');

      const slots = ['city', 'country', 'river', 'city', 'country', 'river'];
      const chosen = [];

      slots.forEach((type) => {
        let pool = [];
        if (type === 'city') pool = citiesSorted;
        else if (type === 'country') pool = countriesSorted;
        else if (type === 'river') pool = riversSorted;

        let selected = null;
        for (const q of pool) {
          if (usedEntityIds.has(q.entityId)) continue;
          if (usedCorrectAnswers.has(q.correctAnswer)) continue;
          selected = q;
          break;
        }

        // Fallback 1: Unique question ID (allow duplicate entity/answer if pool is small)
        if (!selected) {
          for (const q of pool) {
            if (chosen.some(x => x.id === q.id)) continue;
            selected = q;
            break;
          }
        }

        // Fallback 2: Take first available
        if (!selected && pool.length > 0) {
          selected = pool[0];
        }

        if (selected) {
          chosen.push(selected);
          usedEntityIds.add(selected.entityId);
          usedCorrectAnswers.add(selected.correctAnswer);
        }
      });

      // Format options for each question
      const sessionQuestions = chosen.map(baseQuestion => {
        const options = baseQuestion.options && baseQuestion.options.length > 0
          ? [...baseQuestion.options].sort(() => 0.5 - Math.random())
          : [];
        return {
          ...baseQuestion,
          options
        };
      });

      // Note: do not shuffle sessionQuestions to preserve strict [Stadt, Land, Fluss, Stadt, Land, Fluss] order!
      setQuestions(sessionQuestions);
      setCurrentIdx(0);
      setAttempts(0);
      setSelectedOption(null);
      setIsAnswered(false);
      setScore(0);
      setPoints(0);
      setSessionFinished(false);
      return;
    }

    // 2. Standard modes with category filters and difficulty fallbacks
    let filteredQuestions = [];
    const diffOrder = [difficulty, 2, 3, 1, 4].filter((v, i, a) => a.indexOf(v) === i);
    
    for (const d of diffOrder) {
      const levelQs = quizQuestions.filter(q => q.difficulty === d);
      let candidates = levelQs;
      if (quizMode === 'countries') {
        candidates = levelQs.filter(q => q.entityType === 'country' || q.entityType === 'state');
      } else if (quizMode === 'cities') {
        candidates = levelQs.filter(q => q.entityType === 'city');
      } else if (quizMode === 'rivers') {
        candidates = levelQs.filter(q => q.entityType === 'river' || q.type === 'city-river');
      }
      
      if (candidates.length > 0) {
        filteredQuestions = candidates;
        break;
      }
    }

    const sortedQuestions = sortPool(filteredQuestions);

    const chosenQuestions = [];
    const usedParentCountryIds = new Set();

    for (const q of sortedQuestions) {
      if (chosenQuestions.length >= 5) break;

      // Rule 1: Unique entityId
      if (usedEntityIds.has(q.entityId)) continue;

      // Rule 2: Unique correctAnswer
      if (usedCorrectAnswers.has(q.correctAnswer)) continue;

      // Rule 3: Avoid duplicate parent country IDs for subdivisions/cities in the same session if possible
      const parentCountryId = geodb.entities[q.entityId]?.metadata?.countryId;
      if (parentCountryId && usedParentCountryIds.has(parentCountryId)) {
        continue;
      }

      // Add to session
      chosenQuestions.push(q);
      usedEntityIds.add(q.entityId);
      usedCorrectAnswers.add(q.correctAnswer);
      if (parentCountryId) {
        usedParentCountryIds.add(parentCountryId);
      }
    }

    // Fallback: If we couldn't find 5 questions due to parent country constraints, 
    // run another pass ignoring the parent country constraints (Rule 3)
    if (chosenQuestions.length < 5) {
      for (const q of sortedQuestions) {
        if (chosenQuestions.length >= 5) break;
        if (usedEntityIds.has(q.entityId)) continue;
        if (usedCorrectAnswers.has(q.correctAnswer)) continue;

        chosenQuestions.push(q);
        usedEntityIds.add(q.entityId);
        usedCorrectAnswers.add(q.correctAnswer);
      }
    }

    // Final fallback: just take the first 5 available if we still don't have enough
    if (chosenQuestions.length < 5) {
      for (const q of sortedQuestions) {
        if (chosenQuestions.length >= 5) break;
        if (chosenQuestions.some(existing => existing.id === q.id)) continue;
        chosenQuestions.push(q);
      }
    }

    // Format options and shuffle them at runtime (so correct answer position is random)
    const sessionQuestions = chosenQuestions.map(baseQuestion => {
      const options = baseQuestion.options && baseQuestion.options.length > 0
        ? [...baseQuestion.options].sort(() => 0.5 - Math.random())
        : [];
      
      return {
        ...baseQuestion,
        options
      };
    });

    // Shuffle the final questions in the session
    const shuffledSession = sessionQuestions.sort(() => 0.5 - Math.random());

    setQuestions(shuffledSession);
    setCurrentIdx(0);
    setAttempts(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setPoints(0);
    setSessionFinished(false);
  };

  const handleSelectOption = (option) => {
    if (isAnswered) return;
    playClick();
    
    const q = questions[currentIdx];
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    setSelectedOption(option);

    const highlightId = q.entityType === 'city' ? geodb.entities[q.entityId]?.metadata?.countryId : q.entityId;

    // Resolve river ID to keep it highlighted on answer reveal
    const isCityRiver = q.type === 'city-river';
    let riverId = null;
    if (isCityRiver) {
      const riverEntity = Object.values(geodb.entities).find(
        e => e.type === 'river' && e.name === q.correctAnswer
      );
      if (riverEntity) riverId = riverEntity.id;
    }

    if (option === q.correctAnswer) {
      playCorrectChime();
      setIsAnswered(true);
      setScore(prev => prev + 1);
      
      const earned = Math.round(10 * getDifficultyMultiplier() * (1 / newAttempts));
      setPoints(prev => prev + earned);
      if (onAddScore) onAddScore(earned);

      onSetQuizState({
        mode: 'quiz',
        highlightedIds: [],
        correctIds: [highlightId, riverId].filter(id => id && typeof id === 'string'),
        wrongIds: [],
        showSubdivisions: q.entityType === 'state',
        zoomToEntityId: riverId || highlightId || null
      });

      saveUserAnswer(q.entityId, q.entityType, true, newAttempts);
    } else {
      playErrorBuzzer();
      setIsAnswered(true);
      
      onSetQuizState({
        mode: 'quiz',
        highlightedIds: [],
        correctIds: [],
        wrongIds: [highlightId, riverId].filter(id => id && typeof id === 'string'),
        showSubdivisions: q.entityType === 'state',
        zoomToEntityId: riverId || highlightId || null
      });

      saveUserAnswer(q.entityId, q.entityType, false, newAttempts);
    }
  };

  const saveUserAnswer = async (entityId, entityType, isCorrect, attemptCount) => {
    const quality = mapBinaryToQuality(isCorrect, attemptCount);
    const currentState = await getProgress(entityId);
    const nextState = calculateSRS(currentState, quality);
    await saveProgress(entityId, nextState, entityType);
    await addHistoryLog({
      entityId,
      domain: domainId,
      type: entityType,
      correct: isCorrect,
      attempts: attemptCount,
      qualityScore: quality
    });
  };

  const handleNextQuestion = () => {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(prev => prev + 1);
      setAttempts(0);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setSessionFinished(true);
      onSetQuizState({
        mode: 'dashboard',
        highlightedIds: [],
        correctIds: [],
        wrongIds: []
      });
    }
  };

  // Proportional SVG path projection function for isolated country contours (Level 4)
  const renderSilhouette = (entityId, entityType) => {
    // If the active question has a pre-compiled silhouette path, render it directly!
    const q = questions[currentIdx];
    if (q && q.entityId === entityId && q.silhouetteSvgPath) {
      return (
        <svg width={160} height={160} viewBox="0 0 160 160" style={{ margin: '0 auto', display: 'block' }}>
          <path 
            d={q.silhouetteSvgPath} 
            fill="#FAF6EE" 
            stroke="#1B305B" 
            strokeWidth="1.5" 
            fillRule="evenodd"
          />
        </svg>
      );
    }

    // Fallback: dynamic calculation from GeoJSON (just in case)
    const geojson = entityType === 'state' ? subdivisionsGeoJSON : countriesGeoJSON;
    if (!geojson) return <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Lade Kontur...</div>;

    const feature = geojson.features.find(f => f.id === entityId);
    if (!feature || !feature.geometry) return <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Keine Geometrie</div>;

    const geom = feature.geometry;
    
    // Shoelace area calculator
    const getRingArea = (ring) => {
      let sum = 0;
      for (let i = 0; i < ring.length; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[(i + 1) % ring.length];
        sum += x1 * y2 - x2 * y1;
      }
      return Math.abs(sum) * 0.5;
    };

    // Convert geom coordinates to a uniform list of polygons
    let allPolys = [];
    if (geom.type === 'Polygon') {
      allPolys = [geom.coordinates];
    } else if (geom.type === 'MultiPolygon') {
      allPolys = geom.coordinates;
    }

    if (allPolys.length === 0) return null;

    // For each polygon, calculate area, bounding box and center
    const polysWithMeta = allPolys.map(poly => {
      if (poly.length === 0) return { poly, area: 0, center: [0, 0], minLng: 0, maxLng: 0, minLat: 0, maxLat: 0 };
      const area = getRingArea(poly[0]);
      
      let minLng = Infinity, maxLng = -Infinity;
      let minLat = Infinity, maxLat = -Infinity;
      poly[0].forEach(([lng, lat]) => {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });
      return {
        poly,
        area,
        center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
        minLng,
        maxLng,
        minLat,
        maxLat
      };
    });

    // Find the largest area polygon (master)
    let master = polysWithMeta[0];
    polysWithMeta.forEach(p => {
      if (p.area > master.area) {
        master = p;
      }
    });

    const masterMinLng = master.minLng;
    const masterMaxLng = master.maxLng;
    const masterMinLat = master.minLat;
    const masterMaxLat = master.maxLat;
    const masterCenter = master.center;
    const aspectCorrection = Math.cos(masterCenter[1] * Math.PI / 180);
    const maxDistance = 15.0; // degrees threshold to keep nearby islands

    // Filter polygons that are within maxDistance of the master polygon's bounding box
    const selectedPolys = [];
    polysWithMeta.forEach(p => {
      if (p.area === 0) return;
      
      let dx = 0;
      if (p.center[0] < masterMinLng) {
        dx = (masterMinLng - p.center[0]) * aspectCorrection;
      } else if (p.center[0] > masterMaxLng) {
        dx = (p.center[0] - masterMaxLng) * aspectCorrection;
      }
      
      let dy = 0;
      if (p.center[1] < masterMinLat) {
        dy = masterMinLat - p.center[1];
      } else if (p.center[1] > masterMaxLat) {
        dy = p.center[1] - masterMaxLat;
      }
      
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= maxDistance) {
        selectedPolys.push(p.poly);
      }
    });

    if (selectedPolys.length === 0) return null;

    // Calculate local bounding box of all selected polygons combined
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    selectedPolys.forEach(poly => {
      poly.forEach(ring => {
        ring.forEach(([lng, lat]) => {
          const xLocal = (lng - masterCenter[0]) * aspectCorrection;
          const yLocal = lat - masterCenter[1];
          if (xLocal < minX) minX = xLocal;
          if (xLocal > maxX) maxX = xLocal;
          if (yLocal < minY) minY = yLocal;
          if (yLocal > maxY) maxY = yLocal;
        });
      });
    });

    const width = 160;
    const height = 160;
    const padding = 10;

    const spanX = maxX - minX || 0.1;
    const spanY = maxY - minY || 0.1;

    const scaleX = (width - 2 * padding) / spanX;
    const scaleY = (height - 2 * padding) / spanY;
    const scale = Math.min(scaleX, scaleY);

    const centerXLocal = (minX + maxX) / 2;
    const centerYLocal = (minY + maxY) / 2;

    const project = ([lng, lat]) => {
      const xLocal = (lng - masterCenter[0]) * aspectCorrection;
      const yLocal = lat - masterCenter[1];
      const x = width / 2 + (xLocal - centerXLocal) * scale;
      const y = height / 2 - (yLocal - centerYLocal) * scale; // Invert Y for screen
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };

    let paths = [];
    selectedPolys.forEach(poly => {
      poly.forEach(ring => {
        if (ring.length === 0) return;
        const d = 'M' + ring.map(pt => project(pt)).join(' L') + ' Z';
        paths.push(d);
      });
    });

    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ margin: '0 auto', display: 'block' }}>
        {paths.map((d, i) => (
          <path 
            key={i} 
            d={d} 
            fill="#FAF6EE" 
            stroke="#1B305B" 
            strokeWidth="1.5" 
            fillRule="evenodd"
          />
        ))}
      </svg>
    );
  };


  if (sessionFinished) {
    return (
      <div className="terra-panel slide-in" style={{
        padding: '32px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: '20px'
      }}>
        <div style={{
          width: '70px',
          height: '70px',
          borderRadius: '50%',
          background: 'rgba(139, 111, 59, 0.05)',
          border: '2px solid var(--color-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Award size={36} style={{ color: 'var(--color-secondary)' }} />
        </div>
        
        <div>
          <h2 style={{ fontFamily: 'var(--font-title)', color: 'var(--color-primary)', marginBottom: '8px' }}>
            Runde beendet!
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.4' }}>
            Ergebnis: <strong>{score}</strong> von <strong>{questions.length}</strong> richtig.<br/>
            Punkte verdient: <strong style={{ color: 'var(--color-secondary)' }}>+{points} Punkte</strong>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '280px' }}>
          <button 
            className="btn-terra"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={generateQuizSession}
          >
            <RotateCcw size={15} />
            Erneut
          </button>
          <button 
            className="btn-terra-primary"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={onQuizFinished}
          >
            Fortfahren
          </button>
        </div>
      </div>
    );
  }

  const q = questions[currentIdx];
  if (!q) return null;

  return (
    <div className="terra-panel slide-in" style={{
      padding: '20px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }}>
      {/* Quiz Progress header */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
            TEST {currentIdx + 1} VON {questions.length} ({getGermanDifficulty(difficulty)})
          </span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-secondary)' }}>
            Punkte: {points}
          </span>
        </div>
        {/* Progress Bar */}
        <div style={{ width: '100%', height: '6px', background: 'var(--border-light)', borderRadius: '1px', marginBottom: '20px', overflow: 'hidden' }}>
          <div style={{ 
            width: `${((currentIdx) / questions.length) * 100}%`, 
            height: '100%', 
            background: 'var(--color-primary)',
            transition: 'width 0.3s ease'
          }} />
        </div>

        {/* Prompt */}
        <h3 style={{
          fontFamily: 'var(--font-title)',
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--color-primary)',
          lineHeight: '1.4',
          marginBottom: '20px'
        }}>
          {q.prompt}
        </h3>

        {/* Question Type 1: Map Click Mode (Level 2) */}
        {q.type === 'click-map' && (
          <div className="terra-panel-inset" style={{
            padding: '28px',
            textAlign: 'center',
            background: '#FAF9F4',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <MapPin size={32} style={{ color: 'var(--color-primary)' }} />
            <div style={{ fontSize: '15px', color: 'var(--text-main)', fontWeight: 600 }}>
              Klicke direkt auf die Länderfläche in der Karte!
            </div>
            {attempts > 0 && (
              <div style={{ fontSize: '13px', color: 'var(--color-error)' }}>
                Versuch: {attempts}
              </div>
            )}
          </div>
        )}

        {/* Question Type 2: Isolated Silhouette Outlines Mode (Level 4) */}
        {q.type === 'silhouette' && (
          <div className="silhouette-box" style={{ marginBottom: '20px' }}>
            {renderSilhouette(q.entityId, q.entityType)}
          </div>
        )}

        {/* Render MCQ Choices if applicable */}
        {q.options && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {q.options.map((option, index) => {
              const isSelected = selectedOption === option;
              const isCorrectOption = option === q.correctAnswer;
              
              let btnStyle = {
                background: '#FAF8F2',
                borderColor: 'var(--border-light)',
                color: 'var(--text-main)'
              };

              if (isAnswered) {
                if (isCorrectOption) {
                  btnStyle = {
                    background: 'rgba(44, 94, 67, 0.1)',
                    borderColor: 'var(--color-success)',
                    color: 'var(--color-success)',
                    fontWeight: 'bold'
                  };
                } else if (isSelected) {
                  btnStyle = {
                    background: 'rgba(132, 32, 41, 0.1)',
                    borderColor: 'var(--color-error)',
                    color: 'var(--color-error)'
                  };
                }
              }

              return (
                <button
                  key={index}
                  className="btn-terra"
                  onClick={() => handleSelectOption(option)}
                  disabled={isAnswered}
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    padding: '12px',
                    fontSize: '15.5px',
                    fontWeight: 500,
                    ...btnStyle
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                    <span style={{
                      width: '22px',
                      height: '22px',
                      background: 'rgba(0,0,0,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--text-muted)'
                    }}>
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span style={{ 
                      flex: 1, 
                      textAlign: 'left',
                      fontSize: q.type === 'flag' ? '48px' : 'inherit',
                      lineHeight: q.type === 'flag' ? '1' : 'inherit'
                    }}>{option}</span>
                    {isAnswered && isCorrectOption && <Check size={14} />}
                    {isAnswered && isSelected && !isCorrectOption && <X size={14} />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Answer feedback & Status box */}
      <div style={{ marginTop: '20px' }}>
        {statusMessage && (
          <div className="slide-in" style={{
            fontSize: '14px',
            padding: '8px 12px',
            background: wrongClickIds.length > 0 && !isAnswered ? 'rgba(132, 32, 41, 0.05)' : 'rgba(44, 94, 67, 0.05)',
            color: wrongClickIds.length > 0 && !isAnswered ? 'var(--color-error)' : 'var(--color-success)',
            borderLeft: `3px solid ${wrongClickIds.length > 0 && !isAnswered ? 'var(--color-error)' : 'var(--color-success)'}`,
            marginBottom: '12px',
            fontWeight: 500
          }}>
            {statusMessage}
          </div>
        )}
        
        {isAnswered && (
          <div className="slide-in" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {q.type !== 'click-map' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: selectedOption === q.correctAnswer ? 'var(--color-success)' : 'var(--color-error)',
                fontSize: '14px',
                fontWeight: 600,
                padding: '6px 10px',
                background: selectedOption === q.correctAnswer ? 'rgba(44, 94, 67, 0.03)' : 'rgba(132, 32, 41, 0.03)'
              }}>
                {selectedOption === q.correctAnswer ? (
                  <>
                    <Check size={14} />
                    <span>Hervorragend gelöst! (+{Math.round(10 * getDifficultyMultiplier() * (1 / attempts))} Pkt.)</span>
                  </>
                ) : (
                  <>
                    <X size={14} />
                    <span>Falsch. Antwort: <strong>{q.correctAnswer}</strong> (0 Pkt.)</span>
                  </>
                )}
              </div>
            )}
            
            <button
              className="btn-terra-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleNextQuestion}
            >
              Weiter
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function getGermanDifficulty(diff) {
  if (diff === 2) return 'MITTEL';
  if (diff === 3) return 'SCHWER';
  if (diff === 4) return 'MEISTER';
  return 'LEICHT';
}
