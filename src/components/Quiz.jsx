import React, { useState, useEffect, useRef } from 'react';
import { calculateSRS, mapBinaryToQuality } from '../utils/srs';
import { saveProgressAndLog, getProgress } from '../utils/db';
import { shuffle } from '../utils/shuffle';
import { useGeoData } from '../utils/useGeoData';
import { playClick, playCorrectChime, playErrorBuzzer } from '../utils/audio';
import { createSilhouettePaths } from '../utils/silhouette';
import { getDomainIdFromConceptKey } from '../utils/conceptKeys';
import { Check, X, ArrowRight, Award, RotateCcw, MapPin } from 'lucide-react';

// Diese Werte stehen in Effekt-Abhängigkeiten. Modulkonstanten verhindern, dass
// ein ausgelassener optionaler Array-Prop bei jedem Render eine neue Referenz
// erzeugt und dadurch die Quizsession endlos neu initialisiert.
const EMPTY_LIST = Object.freeze([]);
const DEFAULT_ROUND_CONFIG = Object.freeze({ kind: 'fixed', length: 10 });

function SilhouettePaths({ paths, width = 160, height = 160 }) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ margin: '0 auto', display: 'block' }}>
      {paths.map((d, index) => (
        <path
          key={index}
          d={d}
          fill="#FAF6EE"
          stroke="#1B305B"
          strokeWidth="1.5"
          fillRule="evenodd"
        />
      ))}
    </svg>
  );
}

// Nur der seltene Fallback ohne vorkompilierten SVG-Pfad lädt GeoJSON. Würde
// der Hook in Quiz selbst liegen, zögen auch alle Nicht-Terra-Runden rund
// 1,7 MiB Länder- und Provinzgeometrie, obwohl sie diese nie verwenden.
function DynamicSilhouette({ entityId, entityType }) {
  const geo = useGeoData(['countries', 'subdivisions']);
  const geojson = entityType === 'state' ? geo.subdivisions : geo.countries;
  if (!geojson) {
    return <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Lade Kontur...</div>;
  }

  const feature = geojson.features.find(candidate => candidate.id === entityId);
  if (!feature?.geometry) {
    return <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Keine Geometrie</div>;
  }

  const paths = createSilhouettePaths(feature.geometry, { width: 160, height: 160 });
  return paths.length > 0 ? <SilhouettePaths paths={paths} /> : null;
}

function QuestionSilhouette({ question }) {
  if (question.silhouetteSvgPath) {
    return <SilhouettePaths paths={[question.silhouetteSvgPath]} />;
  }
  return <DynamicSilhouette entityId={question.entityId} entityType={question.entityType} />;
}

export default function Quiz({ 
  geodb, 
  questionPool = EMPTY_LIST,
  dueEntities = EMPTY_LIST,
  newEntities = EMPTY_LIST,
  quizMode = 'all',
  roundConfig = DEFAULT_ROUND_CONFIG,
  players = EMPTY_LIST,
  clickedMapId = null,
  resetClickedMapId,
  onQuizFinished,
  onSetQuizState,
  onActiveConceptChange,
  onAddScore,
  entityFilterId = null,
  onQuizRestart,
  onTrackProgressWrite,
  onFlushProgressWrites,
  isPaused = false,
}) {
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [points, setPoints] = useState(0); // Score points
  const [sessionFinished, setSessionFinished] = useState(false);
  // Überlebens-Modus: verbleibende Leben (null = feste Runde, kein Survival).
  const [isPractice, setIsPractice] = useState(false);
  const [firstTryCount, setFirstTryCount] = useState(0);
  const [mistakeQuestions, setMistakeQuestions] = useState([]);
  const isSurvival = !isPractice && roundConfig?.kind === 'survival';
  const totalLives = roundConfig?.lives || 3;
  const [lives, setLives] = useState(isSurvival ? totalLives : null);
  // Mehrspieler: ab 2 Namen wird reihum gefragt; je Spieler ein Trefferzähler.
  const isMultiplayer = Array.isArray(players) && players.length > 1;
  const nPlayers = isMultiplayer ? players.length : 1;
  const [playerScores, setPlayerScores] = useState(() => isMultiplayer ? new Array(players.length).fill(0) : []);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [wrongClickIds, setWrongClickIds] = useState([]);
  const [progressSaveFailed, setProgressSaveFailed] = useState(false);
  const progressWriteTail = useRef(Promise.resolve());
  const sessionActionPending = useRef(false);
  const [isSessionChanging, setIsSessionChanging] = useState(false);
  const inputPaused = isPaused || isSessionChanging;
  const quizQuestions = Array.isArray(questionPool) ? questionPool : [];

  // Fälligkeit ist eine Priorität beim Start, kein Neustart-Signal. Ein später
  // geladener Fortschritt darf eine bereits gespielte Runde nicht zurücksetzen.
  useEffect(() => {
    generateQuizSession();
  }, [quizMode, questionPool, entityFilterId, roundConfig, players]);

  // Meldet die aktive Frage ans linke Visual-Panel. Dieser Effekt ist bewusst
  // vom Karten-Setup getrennt: Der Antwortzustand aendert sich nach einem Klick,
  // soll aber nicht die Map-Highlights der Antwortauswertung zuruecksetzen.
  useEffect(() => {
    if (!onActiveConceptChange) return;

    if (questions.length > 0 && currentIdx < questions.length && !sessionFinished) {
      const q = questions[currentIdx];

      // Der entityId ist zugleich der Konzept-Key (z.B. "astra:mars").
      //
      // Zusaetzlich melden wir, WELCHES Attribut die Frage prueft (testedAttribute),
      // ob die Antwort der Konzeptname selbst ist (answerIsName, Reverse-Frage),
      // ob die Konzeptidentitaet verborgen bleiben muss und ob die Frage bereits
      // beantwortet wurde. Damit blendet das Visual vor der Antwort verraeterische
      // Chips / Marker / FunFacts aus und darf sie danach als Erklaerung zeigen.
      onActiveConceptChange({
        key: q.entityId || null,
        testedAttribute: q.testedAttribute ?? null,
        answerIsName: Boolean(q.answerIsName),
        hideConceptIdentity: Boolean(q.hideConceptIdentity),
        isAnswered
      });
    } else {
      onActiveConceptChange(null);
    }
  }, [currentIdx, questions, sessionFinished, isAnswered]);

  // Set map layer configurations when entering new question
  useEffect(() => {
    if (questions.length > 0 && currentIdx < questions.length && !sessionFinished) {
      const q = questions[currentIdx];
      setStatusMessage('');
      setWrongClickIds([]);

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
      if (q.type === 'click-map' && clickedMapId && !isAnswered && !inputPaused) {
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
          setScore(prev => prev + 1);
          if (newAttempts === 1) setFirstTryCount(prev => prev + 1);
          if (isMultiplayer) setPlayerScores(prev => { const n = [...prev]; n[currentPlayerIdx] = (n[currentPlayerIdx] || 0) + 1; return n; });

          // Calculate points
          const earned = earnedPoints(newAttempts);
          setPoints(prev => prev + earned);
          if (!isMultiplayer && onAddScore) onAddScore(earned);

          onSetQuizState({
            mode: 'quiz',
            highlightedIds: [],
            correctIds: [q.entityId].filter(id => id && typeof id === 'string'),
            wrongIds: wrongClickIds.filter(id => id && typeof id === 'string'),
            showSubdivisions: q.entityType === 'state',
            zoomToEntityId: q.entityId || null
          });

          if (!isMultiplayer) persistUserAnswer(q.entityId, q.entityType, true, newAttempts);
        } else {
          // Wrong Click!
          if (newAttempts === 1) setMistakeQuestions(prev => [...prev, q]);
          playErrorBuzzer();
          const updatedWrongs = [...wrongClickIds, actualClickedId];
          setWrongClickIds(updatedWrongs);
          // Überlebens-Modus: JEDER Fehlklick kostet ein Leben — genau wie bei den
          // Multiple-Choice-Fragen (Quiz.jsx handleSelectOption). Der Karten-Modus
          // war früher nachsichtiger (Abzug erst beim 3. Fehler), das ist behoben
          // (Code-Review F2). livesLeft wird lokal berechnet, weil der State-Wert
          // `lives` erst nach dem Re-Render aktualisiert ist.
          const livesLeft = isSurvival ? lives - 1 : null;
          if (isSurvival) setLives(prev => prev - 1);
          setStatusMessage(`Das war ${clickedName}. Gesucht war ${geodb.entities[q.entityId]?.name}. Versuche es erneut!`);

          onSetQuizState({
            mode: 'quiz',
            highlightedIds: [],
            correctIds: [],
            wrongIds: updatedWrongs.filter(id => id && typeof id === 'string'),
            showSubdivisions: q.entityType === 'state',
            zoomToEntityId: q.entityId || null
          });

          // Antwort aufdecken, wenn 3 Fehlversuche erreicht sind ODER im Survival
          // das letzte Leben verbraucht wurde — dann ist die Frage in jedem Fall
          // vorbei (sonst könnte der Spieler mit 0 Leben endlos weiterklicken).
          const revealAnswer = newAttempts >= 3 || (isSurvival && livesLeft <= 0);
          if (revealAnswer) {
            setIsAnswered(true);
            setStatusMessage(`Ausweg: Der gesuchte Ort ist jetzt grün hervorgehoben.`);

            onSetQuizState({
              mode: 'quiz',
              highlightedIds: [],
              correctIds: [q.entityId].filter(id => id && typeof id === 'string'),
              wrongIds: updatedWrongs.filter(id => id && typeof id === 'string'),
              showSubdivisions: q.entityType === 'state',
              zoomToEntityId: q.entityId || null
            });

            if (!isMultiplayer) persistUserAnswer(q.entityId, q.entityType, false, newAttempts);
          }
        }
        
        if (resetClickedMapId) resetClickedMapId();
      }
    }
    // wrongClickIds und attempts werden im Effekt gelesen (gesammelte Falschklicks
    // bzw. Versuchszaehler) und muessen darum in den Deps stehen — sonst arbeitet
    // ein erneuter Klick mit der veralteten Closure des vorigen Renders (Stale-Closure):
    // der zuletzt rot markierte Falschklick verschwaende sonst von der Karte.
  }, [clickedMapId, isAnswered, sessionFinished, questions, currentIdx, wrongClickIds, attempts, inputPaused]);

  // Kartenklicks gelten nur für eine offene Kartenfrage. Auch ein Klick nach
  // der Antwort darf nicht als Antwort auf die nächste Frage erhalten bleiben.
  useEffect(() => {
    if (questions.length > 0 && currentIdx < questions.length) {
      const q = questions[currentIdx];
      if (clickedMapId && (q.type !== 'click-map' || isAnswered || sessionFinished || inputPaused) && resetClickedMapId) {
        resetClickedMapId();
      }
    }
  }, [clickedMapId, questions, currentIdx, isAnswered, sessionFinished, inputPaused, resetClickedMapId]);

  // Flaches Scoring ohne Schwierigkeitsstufen: 10 Punkte beim ersten Versuch,
  // weniger bei weiteren Versuchen (10 / Versuchszahl). Kein Stufen-Multiplikator mehr.
  // codereview-ok: bewusst an zwei Stellen aufgerufen (Karten-Klick- und MCQ-Pfad),
  // beides legitime Eingabewege, kein toter Code (2026-07-08)
  const earnedPoints = (attemptCount) => Math.round(10 / attemptCount);

  // Setzt eine fertig zusammengestellte Fragenliste als aktive Session und
  // initialisiert alle Runden-Zustände neu. Vorher war dieser Block dreimal
  // wortgleich in generateQuizSession dupliziert (Code-Review R1).
  const applySession = (sessionQuestions, { practice = false } = {}) => {
    setQuestions(sessionQuestions);
    setCurrentIdx(0);
    setAttempts(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setPoints(0);
    setIsPractice(practice);
    setFirstTryCount(0);
    setMistakeQuestions([]);
    setLives(!practice && roundConfig?.kind === 'survival' ? totalLives : null);
    setPlayerScores(isMultiplayer ? new Array(nPlayers).fill(0) : []);
    setCurrentPlayerIdx(0);
    setSessionFinished(false);
  };

  const generateQuizSession = () => {
    const eligibleQuestions = entityFilterId
      ? quizQuestions.filter(question => question.entityId === entityFilterId)
      : quizQuestions;
    if (eligibleQuestions.length === 0) {
      applySession([]);
      return;
    }

    const dueIds = new Set(dueEntities.map(d => d.id));
    const newIds = new Set(newEntities.map(n => n.id));

    // Stellt die Optionen einer Frage zusammen und mischt sie zufällig, damit die
    // Position der richtigen Antwort variiert. Von beiden Modi genutzt (R1-Dedup).
    const withShuffledOptions = (baseQuestion) => {
      const options = baseQuestion.options && baseQuestion.options.length > 0
        ? shuffle(baseQuestion.options)
        : [];
      return { ...baseQuestion, options };
    };

    const sortPool = (pool) => {
      // Erst unverzerrt mischen, dann STABIL nach Priorität sortieren (Array.sort
      // ist laut Spezifikation stabil): innerhalb gleicher Priorität bleibt so die
      // Zufallsreihenfolge erhalten — ohne zufälligen sort-Komparator (verzerrt).
      return shuffle(pool).sort((a, b) => {
        const aDue = dueIds.has(a.entityId) ? 2 : (newIds.has(a.entityId) ? 1 : 0);
        const bDue = dueIds.has(b.entityId) ? 2 : (newIds.has(b.entityId) ? 1 : 0);
        return bDue - aDue; // Higher priority first
      });
    };

    const fixedLen = isMultiplayer
      ? Math.ceil((roundConfig?.length || 10) / nPlayers) * nPlayers
      : (roundConfig?.length || 10);
    const roundTarget = roundConfig?.kind === 'survival' ? 150 : fixedLen;
    const fairCount = available => {
      const count = Math.min(roundTarget, available);
      return isMultiplayer ? Math.floor(count / nPlayers) * nPlayers : count;
    };
    const usedEntityIds = new Set();
    const usedCorrectAnswers = new Set();

    // 1. Special sequence mode: Stadt, Land, Fluss alternating
    if (quizMode === 'stadt-land-fluss') {
      const getSortedPoolForType = (type) => {
        // Ohne Schwierigkeitsstufen: gesamter Fragenpool des Typs, zufällig gemischt
        // (SRS-Priorisierung via sortPool bleibt erhalten).
        let pool = [];
        if (type === 'city') {
          pool = eligibleQuestions.filter(q => q.entityType === 'city');
        } else if (type === 'country') {
          pool = eligibleQuestions.filter(q => q.entityType === 'country' || q.entityType === 'state');
        } else if (type === 'river') {
          pool = eligibleQuestions.filter(q => q.entityType === 'river' || q.type === 'city-river');
        }
        return sortPool(pool);
      };

      const citiesSorted = getSortedPoolForType('city');
      const countriesSorted = getSortedPoolForType('country');
      const riversSorted = getSortedPoolForType('river');

      const pools = { city: citiesSorted, country: countriesSorted, river: riversSorted };
      const types = Object.keys(pools).filter(type => pools[type].length > 0);
      const available = new Set(types.flatMap(type => pools[type].map(q => q.id))).size;
      const slots = Array.from({ length: fairCount(available) }, (_, i) => types[i % types.length]);
      const chosen = [];

      slots.forEach((type) => {
        let pool = [];
        if (type === 'city') pool = citiesSorted;
        else if (type === 'country') pool = countriesSorted;
        else if (type === 'river') pool = riversSorted;

        let selected = null;
        for (const q of pool) {
          if (chosen.some(x => x.id === q.id)) continue;
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
        // Ist eine Kategorie erschöpft, mit den übrigen auffüllen. So bleiben
        // kleine oder nach Konzept gefilterte Runden spielbar.
        if (!selected) {
          selected = types.flatMap(other => pools[other]).find(q => !chosen.some(x => x.id === q.id));
        }
        if (selected) {
          chosen.push(selected);
          usedEntityIds.add(selected.entityId);
          usedCorrectAnswers.add(selected.correctAnswer);
        }
      });

      // Format options for each question
      const sessionQuestions = chosen.map(withShuffledOptions);

      // Reihenfolge Stadt, Land, Fluss beibehalten; keine Frage doppelt spielen.
      applySession(sessionQuestions);
      return;
    }

    // 2. Standardmodi: gesamter Fragenpool (ohne Schwierigkeitsstufen), nur nach
    //    Spielmodus-Kategorie gefiltert. Die Mischung kommt aus sortPool (Zufall +
    //    SRS-Priorisierung fälliger/neuer Konzepte).
    let filteredQuestions = eligibleQuestions;
    if (quizMode === 'countries') {
      filteredQuestions = eligibleQuestions.filter(q => q.entityType === 'country' || q.entityType === 'state');
    } else if (quizMode === 'cities') {
      filteredQuestions = eligibleQuestions.filter(q => q.entityType === 'city');
    } else if (quizMode === 'rivers') {
      filteredQuestions = eligibleQuestions.filter(q => q.entityType === 'river' || q.type === 'city-river');
    }

    const sortedQuestions = sortPool(filteredQuestions);

    // Rundengröße: feste Länge (10/25/50) ODER im Survival-Modus ein großer Vorrat,
    // dessen Ende über die Leben gesteuert wird (nicht über die Fragenzahl).
    // Im Mehrspieler-Modus die Rundenlänge auf ein Vielfaches der Spielerzahl
    // aufrunden, damit jeder gleich viele Fragen bekommt (faire Reihum-Verteilung).
    const targetCount = fairCount(sortedQuestions.length);

    const chosenQuestions = [];
    const usedParentCountryIds = new Set();

    for (const q of sortedQuestions) {
      if (chosenQuestions.length >= targetCount) break;

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

    // Bei kleinen Pools zuerst die Einschränkung des Herkunftslands lockern.
    if (chosenQuestions.length < targetCount) {
      for (const q of sortedQuestions) {
        if (chosenQuestions.length >= targetCount) break;
        if (usedEntityIds.has(q.entityId)) continue;
        if (usedCorrectAnswers.has(q.correctAnswer)) continue;

        chosenQuestions.push(q);
        usedEntityIds.add(q.entityId);
        usedCorrectAnswers.add(q.correctAnswer);
      }
    }

    // Anschließend verschiedene Fragen desselben Konzepts zulassen.
    if (chosenQuestions.length < targetCount) {
      for (const q of sortedQuestions) {
        if (chosenQuestions.length >= targetCount) break;
        if (chosenQuestions.some(existing => existing.id === q.id)) continue;
        chosenQuestions.push(q);
      }
    }

    // Format options and shuffle them at runtime (so correct answer position is random)
    const sessionQuestions = chosenQuestions.map(withShuffledOptions);

    // Shuffle the final questions in the session
    const shuffledSession = shuffle(sessionQuestions);

    applySession(shuffledSession);
  };

  const handleSelectOption = (option) => {
    if (isAnswered || inputPaused) return;
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
      if (newAttempts === 1) setFirstTryCount(prev => prev + 1);
      // Mehrspieler: Treffer dem aktuellen Spieler gutschreiben.
      if (isMultiplayer) setPlayerScores(prev => { const n = [...prev]; n[currentPlayerIdx] = (n[currentPlayerIdx] || 0) + 1; return n; });

      const earned = earnedPoints(newAttempts);
      setPoints(prev => prev + earned);
      // Highscore/SRS nur im Einzelspieler — Gäste sollen die Lerndaten nicht verfälschen.
      if (!isMultiplayer && onAddScore) onAddScore(earned);

      onSetQuizState({
        mode: 'quiz',
        highlightedIds: [],
        correctIds: [highlightId, riverId].filter(id => id && typeof id === 'string'),
        wrongIds: [],
        showSubdivisions: q.entityType === 'state',
        zoomToEntityId: riverId || highlightId || null
      });

      if (!isMultiplayer) persistUserAnswer(q.entityId, q.entityType, true, newAttempts);
    } else {
      playErrorBuzzer();
      setMistakeQuestions(prev => [...prev, q]);
      setIsAnswered(true);
      if (isSurvival) setLives(prev => prev - 1); // Überlebens-Modus: ein Leben weg

      onSetQuizState({
        mode: 'quiz',
        highlightedIds: [],
        correctIds: [],
        wrongIds: [highlightId, riverId].filter(id => id && typeof id === 'string'),
        showSubdivisions: q.entityType === 'state',
        zoomToEntityId: riverId || highlightId || null
      });

      if (!isMultiplayer) persistUserAnswer(q.entityId, q.entityType, false, newAttempts);
    }
  };

  const saveUserAnswer = async (entityId, entityType, isCorrect, attemptCount) => {
    const quality = mapBinaryToQuality(isCorrect, attemptCount);
    const currentState = await getProgress(entityId);
    const nextState = calculateSRS(currentState, quality);
    // SRS-Fortschritt und History-Eintrag in EINER Transaktion schreiben, damit
    // bei Reload/Absturz nicht der eine ohne den anderen übrig bleibt (Code-Review F6).
    await saveProgressAndLog(entityId, nextState, entityType, {
      // Im Querbeet-Quiz braucht die History die Herkunft des konkreten Konzepts
      // (z. B. "astra:mars" -> "astra"), nicht die aktive Mischansicht.
      domain: getDomainIdFromConceptKey(entityId),
      type: entityType,
      correct: isCorrect,
      attempts: attemptCount,
      qualityScore: quality
    });
  };

  // Die Antwortauswertung soll ohne künstliche Wartezeit zur nächsten Frage
  // wechseln können. Der asynchrone Schreibvorgang darf deshalb im Hintergrund
  // laufen, aber ein Transaktionsfehler muss beobachtet und sichtbar werden.
  const persistUserAnswer = (entityId, entityType, isCorrect, attemptCount) => {
    // Bei wiederholten Konzepten muss jede Berechnung den vorherigen Commit
    // lesen. Zwei gleichzeitige Read-modify-write-Vorgänge verlören eine Antwort.
    const write = progressWriteTail.current.then(() => saveUserAnswer(entityId, entityType, isCorrect, attemptCount));
    progressWriteTail.current = write.catch(() => {});
    if (onTrackProgressWrite) onTrackProgressWrite(write);
    else void write.catch(error => {
      console.error('Lernfortschritt konnte nicht gespeichert werden:', error);
      setProgressSaveFailed(true);
    });
  };

  const progressSaveAlert = progressSaveFailed ? (
    <div role="alert" style={{ padding: '9px 12px', borderLeft: '3px solid var(--color-error)',
      background: 'rgba(132, 32, 41, 0.06)', color: 'var(--color-error)', fontSize: '13px' }}>
      Diese Antwort konnte nicht im Lernfortschritt gespeichert werden.
    </div>
  ) : null;

  const changeSession = async action => {
    if (inputPaused || sessionActionPending.current) return;
    sessionActionPending.current = true;
    setIsSessionChanging(true);
    try {
      if (onFlushProgressWrites) await onFlushProgressWrites();
      else await progressWriteTail.current;
      await action();
    } finally {
      sessionActionPending.current = false;
      setIsSessionChanging(false);
    }
  };

  const handleRestart = () => changeSession(() => {
    if (onQuizRestart) onQuizRestart();
    generateQuizSession();
  });

  const handlePractice = () => changeSession(() => {
    if (onQuizRestart) onQuizRestart();
    applySession(mistakeQuestions.map(q => ({ ...q, options: shuffle(q.options || []) })), { practice: true });
  });

  const handleFinish = () => changeSession(() => onQuizFinished?.());

  const handleNextQuestion = () => {
    if (inputPaused) return;
    if (resetClickedMapId) resetClickedMapId();
    // Survival endet, sobald die Leben aufgebraucht sind; sonst weiter, solange der
    // (große) Fragenvorrat reicht. Feste Runde endet nach der letzten Frage.
    const survivalOver = isSurvival && lives <= 0;
    // codereview-ok: bei survivalOver wird direkt beendet (else-Zweig), kein
    // Spielerwechsel — rein kosmetisch, kein DB-Write/Datenrisiko (2026-07-08)
    if (!survivalOver && currentIdx + 1 < questions.length) {
      setCurrentIdx(prev => prev + 1);
      setAttempts(0);
      setSelectedOption(null);
      setIsAnswered(false);
      if (isMultiplayer) setCurrentPlayerIdx(prev => (prev + 1) % nPlayers); // reihum
    } else {
      setSessionFinished(true);
      if (onActiveConceptChange) onActiveConceptChange(null);
      onSetQuizState({
        mode: 'dashboard',
        highlightedIds: [],
        correctIds: [],
        wrongIds: []
      });
    }
  };

  if (sessionFinished) {
    // Mehrspieler-Rangliste (höchste Trefferzahl gewinnt; Gleichstand = Unentschieden).
    const ranking = isMultiplayer
      ? players.map((name, i) => ({ name, score: playerScores[i] || 0 })).sort((a, b) => b.score - a.score)
      : [];
    const topScore = ranking.length ? ranking[0].score : 0;
    const winners = ranking.filter(r => r.score === topScore);
    const isTie = winners.length > 1;
    return (
      <div className="terra-panel slide-in" style={{
        padding: '32px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        minHeight: '100%',
        overflowY: 'auto',
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
          {isMultiplayer ? (
            <>
              <h2 style={{ fontFamily: 'var(--font-title)', color: 'var(--color-primary)', marginBottom: '10px' }}>
                {isTie ? 'Unentschieden!' : `${winners[0].name} gewinnt!`}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px' }}>
                {ranking.map((r, i) => {
                  const isWinner = r.score === topScore;
                  return (
                    <div key={r.name + i} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '14px', padding: '5px 10px', borderRadius: '2px', background: isWinner ? 'rgba(139, 111, 59, 0.10)' : 'transparent', fontWeight: isWinner ? 700 : 500, color: isWinner ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                      <span>{isWinner ? '★ ' : ''}{r.name}</span>
                      <span>{r.score} richtig</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <h2 style={{ fontFamily: 'var(--font-title)', color: 'var(--color-primary)', marginBottom: '8px' }}>
                {isPractice ? 'Wiederholung beendet!' : isSurvival && lives <= 0 ? 'Aus!' : 'Runde beendet!'}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.4' }}>
                {isSurvival ? (
                  <>Du hast <strong>{score}</strong> {score === 1 ? 'Frage' : 'Fragen'} richtig beantwortet.<br/></>
                ) : (
                  <>Ergebnis: <strong>{score}</strong> von <strong>{questions.length}</strong> richtig.<br/></>
                )}
                Direkt gewusst: <strong>{firstTryCount}</strong> von <strong>{currentIdx + 1}</strong>.<br />
                Punkte verdient: <strong style={{ color: 'var(--color-secondary)' }}>+{points} Punkte</strong>.
              </p>
            </>
          )}
        </div>

        {progressSaveAlert}

        {!isMultiplayer && mistakeQuestions.length > 0 && (
          <button className="btn-terra-primary" onClick={handlePractice} disabled={inputPaused}>
            <RotateCcw size={15} /> Fehler üben ({mistakeQuestions.length})
          </button>
        )}
        <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '280px' }}>
          <button 
            className="btn-terra"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={handleRestart}
            disabled={inputPaused}
          >
            <RotateCcw size={15} />
            Erneut
          </button>
          <button 
            className="btn-terra-primary"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={handleFinish}
            disabled={inputPaused}
          >
            Fortfahren
          </button>
        </div>
      </div>
    );
  }

  const q = questions[currentIdx];
  if (!q) {
    return (
      <div className="terra-panel slide-in" role="status" style={{ padding: '24px' }}>
        Für dieses Konzept ist noch keine Quizfrage verfügbar.
      </div>
    );
  }

  return (
    <div className="terra-panel slide-in" style={{
      padding: '20px',
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }}>
      {/* Quiz Progress header */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
            {isPractice ? 'WIEDERHOLUNG · ' : ''}{isSurvival ? `FRAGE ${currentIdx + 1}` : `FRAGE ${currentIdx + 1} VON ${questions.length}`}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isSurvival && (
              <span aria-label={`${lives} von ${totalLives} Leben`} style={{ display: 'inline-flex', gap: '2px', fontSize: '15px', lineHeight: 1 }}>
                {Array.from({ length: totalLives }).map((_, i) => (
                  <span key={i} style={{ color: i < lives ? '#C0392B' : 'var(--border-light)' }}>♥</span>
                ))}
              </span>
            )}
            {isMultiplayer ? (
              <span style={{ display: 'inline-flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {players.map((name, i) => (
                  <span key={i} style={{ fontSize: '12px', fontWeight: i === currentPlayerIdx ? 700 : 500, color: i === currentPlayerIdx ? 'var(--color-secondary)' : 'var(--text-muted)' }}>
                    {name}: {playerScores[i] || 0}
                  </span>
                ))}
              </span>
            ) : (
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-secondary)' }}>
                Punkte: {points}
              </span>
            )}
          </div>
        </div>
        {/* Fortschrittsbalken nur bei fester Runde — im Survival ist die Länge offen */}
        {isSurvival ? (
          <div style={{ marginBottom: '20px' }} />
        ) : (
          <div style={{ width: '100%', height: '6px', background: 'var(--border-light)', borderRadius: '1px', marginBottom: '20px', overflow: 'hidden' }}>
            <div style={{
              width: `${((currentIdx) / questions.length) * 100}%`,
              height: '100%',
              background: 'var(--color-primary)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        )}

        {/* Mehrspieler: wer gerade dran ist */}
        {isMultiplayer && (
          <div style={{ marginBottom: '12px', padding: '7px 10px', borderRadius: '2px', background: 'rgba(139, 111, 59, 0.08)', borderLeft: '3px solid var(--color-secondary)', fontSize: '13.5px', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-title)' }}>
            {players[currentPlayerIdx]} ist dran
          </div>
        )}

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
            <QuestionSilhouette question={q} />
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
                  disabled={isAnswered || inputPaused}
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
        {progressSaveAlert}
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
                    <span>Hervorragend gelöst! (+{earnedPoints(attempts)} Pkt.)</span>
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
              disabled={inputPaused}
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
