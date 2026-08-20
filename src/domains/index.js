import { lazy } from 'react';
import { Globe2, Sparkles, PersonStanding, Orbit, Leaf, Languages, Landmark, Images, Cpu, ScrollText, Layers } from 'lucide-react';
import { DOMAIN_CONFIGS, SCIENTIA_MIX_IDS } from './metadata';

export { SCIENTIA_MIX_IDS } from './metadata';

// Spezialisierte Visualisierungen lazy laden, damit schwere Abhaengigkeiten
// (z.B. three.js fuer Astra) nur ins Bundle kommen, wenn die Domain aktiv ist.
const AstraVisual = lazy(() => import('../components/AstraVisual'));
const HomoVisual = lazy(() => import('../components/HomoVisual'));

// Erkundungsbereiche (eigener Tab, gefüttert aus denselben Konzeptdaten wie das
// Quiz). Analog zur Terra-Weltkarte, aber je Domain spezialisiert.
const SolarSystemExplorer = lazy(() => import('../components/SolarSystemExplorer'));
// Generische Bildgalerie als Startansicht für Bereiche ohne eigenen Spezial-Explorer
// (Natura/Cultura/Lingua/Homo) — zeigt die geernteten Konzeptbilder statt nur Statistik.
const GalleryExplorer = lazy(() => import('../components/GalleryExplorer'));

/**
 * Zentrale Registry aller Wissensbereiche ("Domains").
 *
 * Jede Domain besitzt ihren eigenen Konzeptspeicher und Fragenkatalog. Terra
 * nutzt weiterhin das bestehende geodb-Format; alle anderen Domains liefern
 * concepts_<id>.json (Map conceptKey -> Konzept) + questions_<id>.json.
 *
 * loadConcepts/loadQuestions werden lazy geladen (import/fetch). Erfolgreiche
 * Kataloge besuchter Domains bleiben im gemeinsamen Laufzeitcache, damit ein
 * Tab- oder Bereichswechsel denselben großen Download nicht wiederholt.
 *
 * Konvention der Konzept-Keys (siehe Plan 4.1):
 *   - Terra: unpraefixt (z.B. "FJ", "Q64") -> keine IndexedDB-Migration noetig
 *   - alle anderen: "<id>:<conceptId>" (z.B. "astra:mars")
 */
// Welche Sach-Domains der domänenübergreifende "Scientia"-Mischpool zusammenfasst.
// Terra ist bewusst NICHT dabei: seine Karten-Klick-Fragen brauchen die Weltkarte,
// und seine geodb-Konzepte passen (noch) nicht ins generische ConceptVisual.
// Exportiert, damit Oberfläche und Tests prüfen können, was der Mischpool
// wirklich enthält — eine CTA darf nicht mehr versprechen als diese Liste hergibt.
const DOMAIN_DETAILS = {
  scientia: {
    // Domänenübergreifender Mischbereich: zieht Fragen + Konzepte ALLER Sach-Domains
    // zusammen (kein eigenes Visual/Explorer -> generisches ConceptVisual je Frage,
    // das Konzept bringt jede Frage aus ihrer Herkunfts-Domain selbst mit).
    latinName: 'Scientia',
    // Bewusst "außer Geografie": Terra fehlt im Mischpool (siehe SCIENTIA_MIX_IDS),
    // und ein Versprechen "alle Bereiche" wäre damit schlicht falsch.
    label: 'Alle Bereiche außer Geografie',
    shortLabel: 'Querbeet',
    description: 'Fragen quer durch alle Wissensbereiche außer Geografie — Astronomie, Mensch, Natur, Sprachen, Kultur, Technik und Geschichte gemischt.',
    Icon: Layers,
    accent: '#B0863C',
    // Die Kataloge dieses Bereichs sind die aller sieben Sach-Domains zusammen
    // (rund 32 MiB JSON). Sein Startbildschirm (ScientiaHub) braucht davon nichts:
    // er zeigt nur das winzige Statistik-Manifest. Dieses Flag sagt der Shell,
    // dass die Daten erst beim Quizstart geholt werden — die Landing-Page bleibt
    // dadurch leicht, gerade beim ersten Aufruf auf dem Handy.
    deferDataUntilQuiz: true,
    loadConcepts: () => Promise.all(
      DOMAINS.filter(d => SCIENTIA_MIX_IDS.includes(d.id)).map(loadDomainConcepts)
    ).then(maps => Object.assign({}, ...maps)),
    loadQuestions: () => Promise.all(
      DOMAINS.filter(d => SCIENTIA_MIX_IDS.includes(d.id)).map(loadDomainQuestions)
    ).then(lists => lists.flat())
  },
  terra: {
    latinName: 'Terra',
    label: 'Geografie',
    shortLabel: 'Weltatlas',
    description: 'Länder, Städte, Flüsse und Regionen der Erde.',
    Icon: Globe2,
    accent: '#1B305B',
    // Terra wird visuell von der bestehenden Weltkarte (Map.jsx) dargestellt.
    loadConcepts: () => import('../data/geodb.json').then(module => module.default.entities),
    loadQuestions: () => fetch('data/questions_terra.json').then(handleJson)
  },
  astra: {
    latinName: 'Astra',
    label: 'Astronomie',
    shortLabel: 'Sternenhimmel',
    description: 'Planeten, Monde, Sterne, Galaxien und kosmische Konstanten.',
    Icon: Sparkles,
    accent: '#5B4B8A',
    // Phase 2: 3D-Himmelskörper (three.js) statt statischer Übersicht.
    Visual: AstraVisual,
    // Erkundung: interaktive 2D-Sonnensystemkarte (Planeten -> Monde zoombar).
    Explorer: SolarSystemExplorer,
    explorerLabel: 'Sonnensystem',
    ExplorerIcon: Orbit,
    loadConcepts: () => fetch('data/concepts_astra.json').then(handleJson),
    loadQuestions: () => fetch('data/questions_astra.json').then(handleJson)
  },
  homo: {
    latinName: 'Homo',
    label: 'Mensch & Körper',
    shortLabel: 'Anatomie',
    description: 'Knochen, Muskeln, Organe, physiologische Eckwerte und menschliche Arten.',
    Icon: PersonStanding,
    accent: '#A14D5A',
    // Phase 2: gemeinfreie Anatomiegrafiken (Wikimedia PD) je Konzept-Kategorie.
    Visual: HomoVisual,
    // Startansicht: Bildgalerie (füllt sich, sobald Homo-Konzepte freie Bilder haben).
    Explorer: GalleryExplorer,
    explorerLabel: 'Galerie',
    ExplorerIcon: Images,
    loadConcepts: () => fetch('data/concepts_homo.json').then(handleJson),
    loadQuestions: () => fetch('data/questions_homo.json').then(handleJson)
  },
  natura: {
    latinName: 'Natura',
    label: 'Natur & Umwelt',
    shortLabel: 'Naturkunde',
    description: 'Tiere, Pflanzen, Pilze, Lebensräume, Gesteine und Naturphänomene.',
    Icon: Leaf,
    accent: '#3E7D5A',
    // MCQ-only: nutzt das generische ConceptVisual (Bild/Kennwerte pro Konzept).
    // Startansicht: Bildgalerie der Tier-/Pflanzen-/Gesteins-Konzepte statt Statistik.
    Explorer: GalleryExplorer,
    explorerLabel: 'Galerie',
    ExplorerIcon: Images,
    loadConcepts: () => fetch('data/concepts_natura.json').then(handleJson),
    loadQuestions: () => fetch('data/questions_natura.json').then(handleJson)
  },
  lingua: {
    latinName: 'Lingua',
    label: 'Sprachen',
    shortLabel: 'Sprachwelt',
    description: 'Sprachen, Sprachfamilien, Schriftsysteme und Wortgeschichten.',
    Icon: Languages,
    accent: '#8A6D3B',
    // MCQ-only: nutzt das generische ConceptVisual (Bild/Kennwerte pro Konzept).
    // Startansicht: Bildgalerie der Sprach-/Schrift-Konzepte statt Statistik.
    Explorer: GalleryExplorer,
    explorerLabel: 'Galerie',
    ExplorerIcon: Images,
    loadConcepts: () => fetch('data/concepts_lingua.json').then(handleJson),
    loadQuestions: () => fetch('data/questions_lingua.json').then(handleJson)
  },
  cultura: {
    latinName: 'Cultura',
    label: 'Kultur',
    shortLabel: 'Kulturwelt',
    description: 'Kunst, Skulptur, Architektur, Musik und Literatur.',
    Icon: Landmark,
    accent: '#7E4B6B',
    // MCQ-only: nutzt das generische ConceptVisual (Bild/Kennwerte pro Konzept).
    // Startansicht: Bildgalerie der Kunst-/Bau-/Musik-/Literatur-Konzepte statt Statistik.
    Explorer: GalleryExplorer,
    explorerLabel: 'Galerie',
    ExplorerIcon: Images,
    loadConcepts: () => fetch('data/concepts_cultura.json').then(handleJson),
    loadQuestions: () => fetch('data/questions_cultura.json').then(handleJson)
  },
  machina: {
    latinName: 'Machina',
    label: 'Digital & Technik',
    shortLabel: 'Technik',
    description: 'Vom Funktionsprinzip her: Software und Computer ebenso wie Werkzeuge, Maschinen, Motoren, Werkstoffe und Fertigungsverfahren.',
    Icon: Cpu,
    accent: '#2C7A8C',
    // MCQ-only: nutzt das generische ConceptVisual. Ordnungsachse = Funktionsprinzip
    // (vgl. docs/bereichs_abgrenzung.md); Erfindungsdatum/-person liegt bei Historia.
    // Startansicht: Bildgalerie der bebilderten Technik-Konzepte (v. a. hardware).
    // Freie Bilder sind inzwischen geerntet, daher ist der Explorer-Tab jetzt aktiv;
    // der Leerzustand von GalleryExplorer greift ohnehin, falls einmal keine Bilder da sind.
    Explorer: GalleryExplorer,
    explorerLabel: 'Galerie',
    ExplorerIcon: Images,
    loadConcepts: () => fetch('data/concepts_machina.json').then(handleJson),
    loadQuestions: () => fetch('data/questions_machina.json').then(handleJson)
  },
  historia: {
    latinName: 'Historia',
    label: 'Geschichte',
    shortLabel: 'Zeitachse',
    description: 'Erfindungen, Entdeckungen, Epochen, Forscher und datierbare Meilensteine.',
    Icon: ScrollText,
    accent: '#7A5230',
    // MCQ-only: nutzt das generische ConceptVisual. Ordnungsachse = Zeit/Urheberschaft.
    // Schwerpunkt Kultur-/Wissenschafts-/Technikgeschichte; Politik-Ausschluss gilt.
    // Startansicht: Bildgalerie der Geschichts-Konzepte (freie Bilder geerntet).
    Explorer: GalleryExplorer,
    explorerLabel: 'Galerie',
    ExplorerIcon: Images,
    loadConcepts: () => fetch('data/concepts_historia.json').then(handleJson),
    loadQuestions: () => fetch('data/questions_historia.json').then(handleJson)
  }
};

// Reihenfolge, IDs und Kartenflag kommen aus dem JSX-freien Metadatenmodul.
// Fehlende UI-/Loaderdetails brechen sofort beim Import statt erst im Hub-Manifest.
export const DOMAINS = DOMAIN_CONFIGS.map(config => {
  const details = DOMAIN_DETAILS[config.id];
  if (!details) throw new Error(`Domain-Details fehlen für: ${config.id}`);
  return { ...config, ...details };
});

/** Gemeinsamer fetch-Handler: wirft bei HTTP-Fehlern statt still leer zu laden. */
function handleJson(response) {
  if (!response.ok) {
    throw new Error(`Daten konnten nicht geladen werden: ${response.status}`);
  }
  return response.json();
}

// Erfolgreiche und noch laufende Katalog-Ladevorgänge werden je Domain geteilt.
// Ein Fehler entfernt nur den betroffenen Cacheeintrag, damit ein späterer
// Wechsel denselben Katalog erneut versuchen kann.
const conceptLoads = new Map();
const questionLoads = new Map();

function loadCached(cache, domain, loaderName, fallback) {
  if (cache.has(domain.id)) return cache.get(domain.id);
  const load = Promise.resolve()
    .then(() => domain[loaderName]())
    .then(data => data ?? fallback)
    .catch(error => {
      cache.delete(domain.id);
      throw error;
    });
  cache.set(domain.id, load);
  return load;
}

export function loadDomainConcepts(domain) {
  return loadCached(conceptLoads, domain, 'loadConcepts', {});
}

export function loadDomainQuestions(domain) {
  return loadCached(questionLoads, domain, 'loadQuestions', []);
}

export function loadDomainData(domain) {
  return Promise.all([loadDomainConcepts(domain), loadDomainQuestions(domain)]);
}

/** Leert den Laufzeitcache; wird von isolierten Integrationstests verwendet. */
export function resetDomainDataCache() {
  conceptLoads.clear();
  questionLoads.clear();
}

/**
 * Sucht eine Domain per ID und fällt auf den ersten konfigurierten Bereich
 * (aktuell Scientia) zurück. So bleiben alte Einstellungen bedienbar, falls ein
 * Bereich einmal entfernt wird.
 */
export function getDomainById(domainId) {
  return DOMAINS.find(domain => domain.id === domainId) || DOMAINS[0];
}

/**
 * Bestehende Terra-Keys sind bewusst unpraefixt. Jede andere Domain nutzt
 * "<domain>:<conceptId>", ein fehlendes Praefix bedeutet daher immer Terra.
 * Implementierung zentral in utils/conceptKeys.js (vorher hier dupliziert);
 * Re-Export haelt die bestehende Import-Adresse '../domains' stabil.
 */
export { getDomainIdFromConceptKey } from '../utils/conceptKeys';
