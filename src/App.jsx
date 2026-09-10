import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import Atlas from './components/Atlas';
import Quiz from './components/Quiz';
import QuizLauncher from './components/QuizLauncher';
import Dashboard from './components/Dashboard';
import DomainSwitcher from './components/DomainSwitcher';
import ScientiaHub from './components/ScientiaHub';
import VisualPanel from './components/VisualPanel';
import { DOMAINS, getDomainById, loadDomainConcepts, loadDomainData } from './domains';
import pkg from '../package.json';
import { getAllProgress, getSetting, saveSetting } from './utils/db';
import { playClick, isAudioMuted, setAudioMuted } from './utils/audio';
import { dataUrl } from './utils/dataUrl';
import { BarChart3, HelpCircle, Compass, Flame, Trophy, Volume2, VolumeX, Images } from 'lucide-react';

// Museum-Explorer lazy laden — enthält keine schweren Abhängigkeiten,
// aber lazy hält den initialen Bundle-Umfang schlank.
const MuseumExplorer = lazy(() => import('./components/MuseumExplorer'));
const EMPTY_CONCEPTS = Object.freeze({});
const EMPTY_QUESTIONS = Object.freeze([]);
const DAY_MS = 24 * 60 * 60 * 1000;

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Neue Werte liegen als lokales ISO-Datum vor. Die zweite Variante liest die
// frühere Date.toDateString()-Ablage weiter, damit bestehende Streaks erhalten bleiben.
function parseStoredLocalDate(value) {
  if (typeof value !== 'string' || !value) return null;
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = isoMatch
    ? new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function localDayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

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
  // Rundenlänge bzw. Spielart: feste Fragenzahl oder Überlebens-Modus (Leben).
  const [quizRoundConfig, setQuizRoundConfig] = useState({ kind: 'fixed', length: 10 });
  // Mehrspieler: Liste der Spielernamen ([] = Einzelspieler, ab 2 = reihum).
  const [quizPlayers, setQuizPlayers] = useState([]);
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
  // Start bewusst im Mischbereich "scientia": sein Hub führt Besucher zu ALLEN
  // Wissensbereichen und macht den Umfang des Quiz sofort sichtbar, statt gleich
  // in einen einzelnen Bereich (früher Terra) zu springen.
  const [activeDomainId, setActiveDomainId] = useState('scientia');
  const activeDomain = getDomainById(activeDomainId);

  // Kennzahlen-Manifest je Bereich (Fragen/Konzepte/Bilder) für den Scientia-Hub.
  // Winzige, beim Build generierte Datei (public/data/domain_stats.json) — einmal
  // beim Start geladen, damit die Landing-Page nicht die großen Fragenkataloge zieht.
  const [domainStats, setDomainStats] = useState(null);

  // Domain-ID, Status und beide Kataloge bilden einen gemeinsamen Zustand. Dadurch
  // kann kein Fehlerpfad Konzepte leeren und gleichzeitig eine veraltete Domain-ID
  // stehen lassen. Fremde Daten werden schon im Render vor dem Effekt ausgeblendet.
  const [domainData, setDomainData] = useState({
    domainId: null,
    status: 'idle', // 'idle' | 'loading' | 'ready' | 'failed'
    concepts: EMPTY_CONCEPTS,
    questions: EMPTY_QUESTIONS
  });

  // Museum: Konzept-Maps aller Domains — wird einmalig beim ersten Öffnen
  // des Museum-Tabs geladen und dann gecacht (domainId -> Map).
  const [allDomainData, setAllDomainData] = useState({});
  // Ladezustand des Museum-Tabs explizit führen (Code-Review F7): aus der bloßen
  // Anzahl geladener Domains ließ sich „lädt noch" nicht von „geladen, aber leer/
  // fehlgeschlagen" unterscheiden.
  const [museumLoading, setMuseumLoading] = useState(false);
  const [museumLoadFailed, setMuseumLoadFailed] = useState(false);

  const domainDataReady = domainData.domainId === activeDomainId && domainData.status === 'ready';
  const domainLoadFailed = domainData.domainId === activeDomainId && domainData.status === 'failed';
  const concepts = domainDataReady ? domainData.concepts : EMPTY_CONCEPTS;
  const questionPool = domainDataReady ? domainData.questions : EMPTY_QUESTIONS;

  // db-artiges Objekt für Komponenten, die geodb.entities erwarten (Quiz,
  // Dashboard, Atlas) — domain-agnostisch über den verlässlich zugeordneten Speicher.
  const domainDb = useMemo(() => ({ entities: concepts }), [concepts]);

  const handleToggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    setAudioMuted(newMuted);
    if (!newMuted) {
      // Kurz warten, bis setAudioMuted(false) wirksam ist: der Klick-Sound wird
      // sonst noch vom gerade erst aufgehobenen Stummschalt-Zustand verschluckt.
      // 10 ms reichen für den State-Durchlauf, bleiben aber unter der Wahrnehmung.
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
  const [progressSaveFailed, setProgressSaveFailed] = useState(false);
  const [quizStartError, setQuizStartError] = useState('');
  const [quizEntityFilterId, setQuizEntityFilterId] = useState(null);
  // Eine Runde lebt vollständig im React-Zustand; ein persistierter Zwischenstand
  // würde nach Reload ohnehin keine Runde wiederherstellen. Die synchrone Referenz
  // verhindert zudem ein Rennen zwischen Rundenreset und erster Antwort.
  const activeScoreRef = React.useRef(0);
  const pendingQuizWritesRef = React.useRef(new Set());

  const trackQuizProgressWrite = (writePromise) => {
    const tracked = Promise.resolve(writePromise)
      .catch((error) => {
        console.error('Lernfortschritt konnte nicht gespeichert werden:', error);
        setProgressSaveFailed(true);
      })
      .finally(() => pendingQuizWritesRef.current.delete(tracked));
    pendingQuizWritesRef.current.add(tracked);
    return tracked;
  };

  const flushQuizProgressWrites = async () => {
    while (pendingQuizWritesRef.current.size > 0) {
      await Promise.allSettled([...pendingQuizWritesRef.current]);
    }
  };

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

  // Statistik-Manifest für den Scientia-Hub einmalig laden. Fehlt die Datei
  // (z.B. Generator noch nicht gelaufen), bleibt stats null und der Hub zeigt
  // dezente Platzhalter statt Zahlen — kein harter Fehler.
  useEffect(() => {
    let cancelled = false;
    fetch(dataUrl('domain_stats.json'))
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (!cancelled) setDomainStats(data); })
      .catch(() => { if (!cancelled) setDomainStats(null); });
    return () => { cancelled = true; };
  }, []);

  // Braucht die aktuelle Ansicht überhaupt die Kataloge der aktiven Domain?
  // Domains mit deferDataUntilQuiz (der Mischbereich "scientia") zeigen zuerst
  // einen Hub, der nur vom kleinen Statistik-Manifest lebt; ihre großen Kataloge
  // werden erst beim Quiz geholt. Das Flag steht in der Registry, damit die Shell
  // keine Domain-Sonderfälle kennen muss.
  const needsDomainData = !activeDomain.deferDataUntilQuiz || activeTab === 'quiz';
  // Konzepte + Fragen der aktiven Domain laden (Lazy-Fetch je Domain-Wechsel).
  useEffect(() => {
    if (!needsDomainData) return undefined;
    if (domainDataReady) return undefined;
    let cancelled = false;
    // Die Ziel-Domain wird hier festgehalten: ein spät eintreffendes Ergebnis
    // eines zwischenzeitlich verlassenen Bereichs darf nichts mehr setzen.
    const requestedDomainId = activeDomainId;
    setDomainData(current => (
      current.domainId === requestedDomainId && current.status === 'loading'
        ? current
        : {
          domainId: requestedDomainId,
          status: 'loading',
          concepts: EMPTY_CONCEPTS,
          questions: EMPTY_QUESTIONS
        }
    ));
    loadDomainData(activeDomain)
      .then(([loadedConcepts, questions]) => {
        if (cancelled) return;
        setDomainData({
          domainId: requestedDomainId,
          status: 'ready',
          concepts: loadedConcepts || {},
          questions: Array.isArray(questions) ? questions : []
        });
      })
      .catch(e => {
        console.error('Error loading domain data:', e);
        if (cancelled) return;
        setDomainData({
          domainId: requestedDomainId,
          status: 'failed',
          concepts: EMPTY_CONCEPTS,
          questions: EMPTY_QUESTIONS
        });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDomainId, needsDomainData]);

  // Museum-Daten: beim Öffnen fehlende Domains parallel laden. Erfolgreiche
  // Kataloge bleiben gecacht; vorübergehend fehlgeschlagene werden beim nächsten
  // Museumsbesuch erneut versucht.
  useEffect(() => {
    if (activeTab !== 'museum') return;
    // 'scientia' ist der domänenübergreifende Mischbereich — seine loadConcepts()
    // liefert ALLE Konzepte der anderen Domains nochmal. Im Museum würde dadurch
    // jedes Bild doppelt erscheinen (doppelte React-Keys, aufgeblähte Zählung,
    // redundanter Filter-Chip). Darum hier überspringen und nur die echten
    // Quell-Domains laden.
    const museumDomains = DOMAINS.filter(domain => domain.id !== 'scientia');
    // Nur erfolgreiche Kataloge gelten als gecacht. Fehlgeschlagene Domains
    // bleiben hier übrig und werden beim nächsten Museumsbesuch erneut versucht.
    const missingDomains = museumDomains.filter(domain => (
      !Object.prototype.hasOwnProperty.call(allDomainData, domain.id)
    ));
    if (missingDomains.length === 0) return;
    let cancelled = false;
    setMuseumLoading(true);
    setMuseumLoadFailed(false);
    Promise.all(
      missingDomains.map(domain =>
        loadDomainConcepts(domain)
          .then(data => ({ id: domain.id, data, ok: true }))
          .catch(() => ({ id: domain.id, data: {}, ok: false }))
      )
    ).then(results => {
      if (cancelled) return;
      const loaded = {};
      results.filter(result => result.ok).forEach(({ id, data }) => { loaded[id] = data; });
      setAllDomainData(current => ({ ...current, ...loaded }));
      // Vorhandene Teildaten bleiben nutzbar. Nur ohne einen einzigen erfolgreichen
      // Katalog zeigt das Museum den Fehlerzustand; erneutes Öffnen versucht es wieder.
      setMuseumLoadFailed(Object.keys(allDomainData).length === 0 && Object.keys(loaded).length === 0);
      setMuseumLoading(false);
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

  // Konnten die gespeicherten Werte gelesen werden? Nach einem Lesefehler stehen
  // streakCount und highScore auf ihrem Anfangswert 0. Wuerde von dort aus
  // geschrieben, machte der erste Punktegewinn aus einer Bestmarke von 5000 eine
  // von 10 und aus einer 27-Tage-Serie eine von 1. Solange der Vorzustand
  // unbekannt ist, fuehrt die App nur die Anzeige der laufenden Sitzung und
  // speichert nichts.
  const streakReadable = React.useRef(true);
  const highScoreReadable = React.useRef(true);

  const loadStreak = async () => {
    try {
      const streak = await getSetting('streakCount', 0);
      const lastReviewDateStr = await getSetting('lastReviewDate', null);
      
      if (!lastReviewDateStr) {
        setStreakCount(0);
        return;
      }

      const lastReview = parseStoredLocalDate(lastReviewDateStr);
      if (!lastReview) {
        setStreakCount(0);
        await saveSetting('streakCount', 0);
        return;
      }
      const today = new Date();
      // Kalendertage statt Millisekunden vergleichen: Ein 25-Stunden-Tag beim
      // Ende der Sommerzeit darf einen gestrigen Review nicht als zwei Tage alt werten.
      const diffDays = localDayNumber(today) - localDayNumber(lastReview);

      if (diffDays > 1 || diffDays < 0) {
        setStreakCount(0);
        await saveSetting('streakCount', 0);
      } else {
        setStreakCount(streak);
      }
      streakReadable.current = true;
    } catch (e) {
      streakReadable.current = false;
      console.error('Error loading streak:', e);
    }
  };

  const loadHighScore = async () => {
    try {
      const savedScore = await getSetting('highScore', 0);
      setHighScore(savedScore);
      highScoreReadable.current = true;
    } catch (e) {
      highScoreReadable.current = false;
      console.error('Error loading highscore:', e);
    }
  };

  const handleAddScorePoints = async (pointsEarned) => {
    const newScore = activeScoreRef.current + pointsEarned;
    activeScoreRef.current = newScore;
    if (newScore <= highScore) return;
    setHighScore(previous => Math.max(previous, newScore));
    if (!highScoreReadable.current) return;
    try {
      await saveSetting('highScore', newScore);
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
      if (!questionPool.some(question => question.entityId === entityId)) {
        setQuizStartError(`Für ${targetEntity.name} ist noch keine Quizfrage verfügbar.`);
        return;
      }
      setQuizStartError('');
      setQuizEntityFilterId(entityId);
      setDueEntities([targetEntity]);
      setNewEntities([]);
      setQuizMode('all');
      setQuizRoundConfig({ kind: 'fixed', length: 1 });
      setQuizPlayers([]);   // Schnellquiz ist immer Einzelspieler
      activeScoreRef.current = 0;
      setQuizArmed(true);   // Schnellquiz startet ohne Vorschalt-Screen direkt
      setActiveTab('quiz');
    }
  };

  // Startet eine Quizrunde. Ohne Schwierigkeitsstufen nur noch der Spielmodus
  // (bei Terra Stadt/Land/Fluss, sonst 'all'); die Fragen mischt der Quiz selbst.
  const handleStartDailyReview = (mode = 'all', roundConfig, players) => {
    playClick();
    setQuizMode(mode);
    if (roundConfig) setQuizRoundConfig(roundConfig); // feste Länge oder Survival
    setQuizPlayers(Array.isArray(players) ? players : []); // [] = Einzelspieler
    setQuizEntityFilterId(null);
    setQuizStartError('');
    activeScoreRef.current = 0;
    setQuizArmed(true); // Runde scharf stellen -> Quiz statt Vorschalt-Screen
    setActiveTab('quiz');
  };

  // Startansicht eines Bereichs. Wo es einen Explorer gibt, ist er die Startseite;
  // die Kopfzeile blendet den Uebersicht-Knopf dort aus (siehe Navigation unten).
  // Beide Rueckwege in die Uebersicht — Bereichswechsel und Rundenende — muessen
  // dieselbe Regel benutzen, sonst landet man auf einem Tab ohne Knopf.
  const startTabFor = (domain) => (domain?.Explorer ? 'explore' : 'dashboard');

  const handleQuizFinished = async () => {
    playClick();
    try {
      await flushQuizProgressWrites();
      const today = new Date();
      const todayKey = localDateKey(today);
      const lastReviewDateStr = await getSetting('lastReviewDate', null);
      const lastReview = parseStoredLocalDate(lastReviewDateStr);
      const lastReviewKey = lastReview ? localDateKey(lastReview) : null;

      if (lastReviewKey !== todayKey) {
        const newStreak = streakCount + 1;
        setStreakCount(newStreak);
        if (streakReadable.current) await saveSetting('streakCount', newStreak);
      }
      // Migriert auch einen alten Date.toDateString()-Wert vom heutigen Tag.
      if (lastReviewDateStr !== todayKey) await saveSetting('lastReviewDate', todayKey);
    } catch (e) {
      // Ein Streak-Schreibfehler darf den Abschluss nicht auf der Ergebnisansicht
      // festhalten. Die Antwort-Transaktionen selbst behandelt Quiz separat.
      console.error('Error finishing quiz:', e);
    } finally {
      await loadProgressData();
      setQuizArmed(false); // Runde beendet -> nächster Lern-Quiz-Aufruf zeigt wieder die Wahl
      setActiveTab(startTabFor(activeDomain));
    }
  };

  const handleTabChange = async (tab) => {
    playClick();
    if (activeTabRef.current === 'quiz') await flushQuizProgressWrites();
    // Direkter Klick auf den Lern-Quiz-Tab: Runde "entschärfen", damit zuerst der
    // Vorschalt-Screen mit Stufenwahl erscheint (nicht sofort Stufe 1).
    if (tab === 'quiz') setQuizArmed(false);
    // Der Hinweis gehoert zum Schnelltest-Versuch, nicht zur naechsten Ansicht.
    // Er verdeckt sonst die dauerhafte Warnung ueber nicht gespeicherte Antworten.
    setQuizStartError('');
    setActiveTab(tab);
  };

  // Wechsel des Wissensbereichs: aktive Domain setzen und Ansicht zurücksetzen.
  // Konzepte/Fragen werden vom Lade-Effekt (Abhängigkeit activeDomainId) geholt.
  const handleDomainChange = async (domainId) => {
    if (domainId === activeDomainId) return;
    playClick();
    if (activeTabRef.current === 'quiz') await flushQuizProgressWrites();
    setActiveDomainId(domainId);
    setActiveTab(startTabFor(getDomainById(domainId)));
    setQuizArmed(false); // Bereichswechsel -> Quizrunde zurücksetzen
    setQuizEntityFilterId(null);
    setQuizStartError('');
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

  // Hinweis für Panels, die ohne die Kataloge der aktiven Domain nichts Richtiges
  // zeigen könnten. Trennt "lädt noch" von "Laden fehlgeschlagen", damit aus einem
  // Fehler kein endloser Ladehinweis wird.
  const renderDomainDataNotice = () => (
    <div className="terra-panel slide-in" style={{ height: '100%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center', padding: '20px', color: 'var(--text-footer)',
      border: '1px solid var(--border-light)' }}>
      {domainLoadFailed
        ? `${activeDomain.latinName} konnte nicht geladen werden. Bitte die Seite neu laden.`
        : `${activeDomain.latinName} wird geladen …`}
    </div>
  );

  // Shell-Layout via CSS-Klassen statt Inline-Styles — Masse/Responsive
  // zentral in index.css (.app-shell etc.). Siehe docs/archive/mobile-layout-plan.md.
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
          >
            Scientia · v{pkg.version}
          </span>
        </div>

        {/* Tab Selectors */}
        <nav className="app-header-nav" aria-label="Hauptnavigation">
          {/* "Übersicht" nur für Domains ohne eigenen Explorer. Wo es einen gibt
              (z.B. Astra-Sonnensystem), ist der Explorer die sinnvollere Startseite. */}
          {!activeDomain.Explorer && (
            <button
              type="button"
              className={`${activeTab === 'dashboard' ? 'btn-terra-primary' : 'btn-terra'} app-header-nav-button`}
              onClick={() => handleTabChange('dashboard')}
              aria-label="Übersicht"
              aria-current={activeTab === 'dashboard' ? 'page' : undefined}
              title="Übersicht"
            >
              <BarChart3 size={16} />
              <span className="app-header-nav-label">Übersicht</span>
            </button>
          )}
          {activeDomain.hasMap && (
            <button
              type="button"
              className={`${activeTab === 'atlas' ? 'btn-terra-primary' : 'btn-terra'} app-header-nav-button`}
              onClick={() => handleTabChange('atlas')}
              aria-label="Weltatlas"
              aria-current={activeTab === 'atlas' ? 'page' : undefined}
              title="Weltatlas"
            >
              <Compass size={16} />
              <span className="app-header-nav-label">Weltatlas</span>
            </button>
          )}
          {/* Erkundungs-Tab: nur Domains mit eigenem Explorer (z.B. Astra-Sonnensystem). */}
          {activeDomain.Explorer && (
            <button
              type="button"
              className={`${activeTab === 'explore' ? 'btn-terra-primary' : 'btn-terra'} app-header-nav-button`}
              onClick={() => handleTabChange('explore')}
              aria-label={activeDomain.explorerLabel || 'Erkundung'}
              aria-current={activeTab === 'explore' ? 'page' : undefined}
              title={activeDomain.explorerLabel || 'Erkundung'}
            >
              {activeDomain.ExplorerIcon ? <activeDomain.ExplorerIcon size={16} /> : <Compass size={16} />}
              <span className="app-header-nav-label">
                {activeDomain.explorerLabel || 'Erkundung'}
              </span>
            </button>
          )}
          <button
            type="button"
            className={`${activeTab === 'quiz' ? 'btn-terra-primary' : 'btn-terra'} app-header-nav-button`}
            onClick={() => handleTabChange('quiz')}
            aria-label="Quiz"
            aria-current={activeTab === 'quiz' ? 'page' : undefined}
            title="Quiz"
          >
            <HelpCircle size={16} />
            <span className="app-header-nav-label">Quiz</span>
          </button>
          {/* Museum-Tab: globale Bildgalerie über alle Domains */}
          <button
            type="button"
            className={`${activeTab === 'museum' ? 'btn-terra-primary' : 'btn-terra'} app-header-nav-button`}
            onClick={() => handleTabChange('museum')}
            aria-label="Museum"
            aria-current={activeTab === 'museum' ? 'page' : undefined}
            title="Museum"
          >
            <Images size={16} />
            <span className="app-header-nav-label">Museum</span>
          </button>
        </nav>
        
        {/* Score & Streak indicators */}
        <div className="app-header-meta">
          <button
            type="button"
            onClick={handleToggleMute}
            className={`btn-terra app-header-audio${isMuted ? ' app-header-audio--muted' : ''}`}
            aria-label={isMuted ? 'Ton einschalten' : 'Ton ausschalten'}
            aria-pressed={isMuted}
            title={isMuted ? 'Ton einschalten' : 'Ton ausschalten'}
          >
            {isMuted ? (
              <VolumeX size={18} />
            ) : (
              <Volume2 size={18} />
            )}
          </button>
          <div
            className="app-header-stat app-header-stat--score"
            role="group"
            aria-label={`Bestmarke: ${highScore}`}
            title={`Bestmarke: ${highScore}`}
          >
            <Trophy size={18} />
            <span className="app-header-stat-label">Bestmarke: </span>
            <span className="app-header-stat-value">{highScore}</span>
          </div>
          <div
            className="app-header-stat app-header-stat--streak"
            role="group"
            aria-label={`Streak: ${streakCount} Tage`}
            title={`Streak: ${streakCount} Tage`}
          >
            <Flame size={18} />
            <span className="app-header-stat-label">Streak: </span>
            <span className="app-header-stat-value">{streakCount}d</span>
          </div>
        </div>
      </header>

      {(progressSaveFailed || quizStartError) && (
        <div
          role="alert"
          style={{ padding: '9px 16px', borderLeft: '3px solid var(--color-error)',
            color: 'var(--color-error)', background: 'rgba(132, 32, 41, 0.06)', fontSize: '13px' }}
        >
          {quizStartError || 'Mindestens eine Antwort konnte nicht im Lernfortschritt gespeichert werden.'}
        </div>
      )}

      {/* Main Layout Area. Der --explore-Modifier laesst die Galerie/den Explorer
          auf Mobil die volle Hoehe nutzen (Sidebar ausgeblendet, s. index.css);
          die Shell-Geometrie selbst bleibt unveraendert in den CSS-Klassen. */}
      <main className={activeTab === 'explore' ? 'app-main app-main--explore' : 'app-main'}>
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
              <MuseumExplorer
                allDomainData={allDomainData}
                loading={museumLoading}
                loadFailed={museumLoadFailed}
                activeDomainId={activeDomainId}
              />
            </Suspense>
          </div>
        ) : activeDomain.id === 'scientia' && activeTab === 'dashboard' ? (
          /* Scientia-Startbildschirm: volle Breite wie der Museum-Tab, statt des
             generischen Dashboards ein Navigations-Hub zu allen Bereichen. */
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, padding: 0, height: '100%' }}>
            <ScientiaHub
              domains={DOMAINS}
              stats={domainStats}
              onSelectDomain={handleDomainChange}
              onStartMixedQuiz={() => handleTabChange('quiz')}
            />
          </div>
        ) : activeTab === 'explore' && activeDomain.Explorer ? (
          <>
            {/* Erkundung links (z.B. Astra-Sonnensystem), rechts die gewohnte
                Dashboard-Sidebar mit Stufen-Wähler + Quiz-Start — analog zu Terra. */}
            <div className="app-pane-left">
              {/* Erst mit den Konzepten der AKTIVEN Domain rendern: sonst zeigte der
                  Explorer nach einem Bereichswechsel kurz die Inhalte des alten Bereichs. */}
              {domainDataReady ? (
                <Suspense fallback={
                  <div className="terra-panel" style={{ height: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: 'var(--text-muted)', background: '#05060f',
                    border: '1px solid var(--border-light)' }}>Erkundung wird geladen …</div>
                }>
                  <activeDomain.Explorer domain={activeDomain} concepts={concepts} srsProgress={srsProgress} />
                </Suspense>
              ) : renderDomainDataNotice()}
            </div>
            <div className="app-pane-right">
              {domainDataReady ? (
                <Dashboard
                  geodb={domainDb}
                  domain={activeDomain}
                  questionPool={questionPool}
                  srsProgress={srsProgress}
                  streakCount={streakCount}
                  highScore={highScore}
                  onStartDailyReview={handleStartDailyReview}
                />
              ) : renderDomainDataNotice()}
            </div>
          </>
        ) : (
        <>
        {/* Linkes Visualisierungs-Panel: Weltkarte bei Terra, sonst pro Frage
            das gefragte Konzept (3D/Vektor bzw. generische Konzeptkarte). */}
        <div className="app-pane-left">
          {domainDataReady ? (
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
          ) : renderDomainDataNotice()}
        </div>

        {/* Rechte Sidebar — Geometrie/Scroll in .app-pane-right (index.css). */}
        <div className="app-pane-right">
          {activeTab === 'dashboard' && (
            domainDataReady ? (
              <Dashboard
                geodb={domainDb}
                domain={activeDomain}
                questionPool={questionPool}
                srsProgress={srsProgress}
                streakCount={streakCount}
                highScore={highScore}
                onStartDailyReview={handleStartDailyReview}
              />
            ) : renderDomainDataNotice()
          )}

          {activeTab === 'atlas' && (
            domainDataReady ? (
              <Atlas
                selectedEntity={concepts[selectedEntityId]}
                srsProgress={srsProgress[selectedEntityId]}
                onStartQuickQuiz={handleStartQuickQuiz}
                geodb={domainDb}
                onSelectEntity={handleSelectEntityFromMap}
              />
            ) : renderDomainDataNotice()
          )}

          {/* Quiz erst freigeben, wenn Konzepte UND Fragen zur aktiven Domain gehören.
              Sonst könnte eine in der Ladelücke beantwortete Frage aus dem alten
              Bereich unter der neuen Domain gespeichert werden. */}
          {activeTab === 'quiz' && (!domainDataReady ? renderDomainDataNotice() : quizArmed ? (
            <Quiz
              geodb={domainDb}
              questionPool={questionPool}
              dueEntities={dueEntities}
              newEntities={newEntities}
              quizMode={quizMode}
              roundConfig={quizRoundConfig}
              players={quizPlayers}
              clickedMapId={clickedMapId}
              resetClickedMapId={() => setClickedMapId(null)}
              onQuizFinished={handleQuizFinished}
              entityFilterId={quizEntityFilterId}
              onQuizRestart={() => { activeScoreRef.current = 0; }}
              onTrackProgressWrite={trackQuizProgressWrite}
              onFlushProgressWrites={flushQuizProgressWrites}
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
                  Quiz
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

      {/* Dauerhaft sichtbare Fußzeile mit Pflicht-, Quellen- und Lizenzlinks.
          Sie sitzt als eigene Shell-Zeile unter dem
          Hauptbereich, damit die Links ohne Menü-Öffnen immer erreichbar sind —
          auch auf Mobil. Die Links öffnen in neuem Tab (target=_blank) und
          tragen rel="noopener noreferrer" gegen Tab-Nabbing. */}
      <footer className="app-footer">
        <a href="https://dm0.de/impressum.html" target="_blank" rel="noopener noreferrer">Impressum</a>
        <span className="app-footer-sep" aria-hidden="true">·</span>
        <a href="https://dm0.de/datenschutz.html" target="_blank" rel="noopener noreferrer">Datenschutz</a>
        <span className="app-footer-sep" aria-hidden="true">·</span>
        <a href="./credits.html">Bild- &amp; Datenquellen</a>
        <span className="app-footer-sep" aria-hidden="true">·</span>
        <span>
          Bildungs- und Unterhaltungszweck. Keine medizinische, rechtliche oder fachliche Beratung. Alle Angaben ohne Gewähr.
        </span>
      </footer>
    </div>
  );
}
