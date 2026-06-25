import { lazy } from 'react';
import { Globe2, Sparkles, PersonStanding, Orbit, Leaf, Languages, Landmark, Images, Cpu, ScrollText } from 'lucide-react';

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
 * loadConcepts/loadQuestions werden lazy geladen (import/fetch), damit nur die
 * Daten der gerade aktiven Domain im Speicher landen (kein Bundle-Bloat).
 *
 * Konvention der Konzept-Keys (siehe Plan 4.1):
 *   - Terra: unpraefixt (z.B. "FJ", "Q64") -> keine IndexedDB-Migration noetig
 *   - alle anderen: "<id>:<conceptId>" (z.B. "astra:mars")
 */
export const DOMAINS = [
  {
    id: 'terra',
    latinName: 'Terra',
    label: 'Geografie',
    shortLabel: 'Weltatlas',
    description: 'Länder, Städte, Flüsse und Regionen der Erde.',
    Icon: Globe2,
    accent: '#1B305B',
    // Terra wird visuell von der bestehenden Weltkarte (Map.jsx) dargestellt.
    hasMap: true,
    loadConcepts: () => import('../data/geodb.json').then(module => module.default.entities),
    loadQuestions: () => fetch('data/questions_terra.json').then(handleJson)
  },
  {
    id: 'astra',
    latinName: 'Astra',
    label: 'Astronomie',
    shortLabel: 'Sternenhimmel',
    description: 'Planeten, Monde, Sterne, Galaxien und kosmische Konstanten.',
    Icon: Sparkles,
    accent: '#5B4B8A',
    // Phase 2: 3D-Himmelskörper (three.js) statt statischer Übersicht.
    hasMap: false,
    Visual: AstraVisual,
    // Erkundung: interaktive 2D-Sonnensystemkarte (Planeten -> Monde zoombar).
    Explorer: SolarSystemExplorer,
    explorerLabel: 'Sonnensystem',
    ExplorerIcon: Orbit,
    loadConcepts: () => fetch('data/concepts_astra.json').then(handleJson),
    loadQuestions: () => fetch('data/questions_astra.json').then(handleJson)
  },
  {
    id: 'homo',
    latinName: 'Homo',
    label: 'Mensch & Körper',
    shortLabel: 'Anatomie',
    description: 'Knochen, Muskeln, Organe, physiologische Eckwerte und menschliche Arten.',
    Icon: PersonStanding,
    accent: '#A14D5A',
    // Phase 2: gemeinfreie Anatomiegrafiken (Wikimedia PD) je Konzept-Kategorie.
    hasMap: false,
    Visual: HomoVisual,
    // Startansicht: Bildgalerie (füllt sich, sobald Homo-Konzepte freie Bilder haben).
    Explorer: GalleryExplorer,
    explorerLabel: 'Galerie',
    ExplorerIcon: Images,
    loadConcepts: () => fetch('data/concepts_homo.json').then(handleJson),
    loadQuestions: () => fetch('data/questions_homo.json').then(handleJson)
  },
  {
    id: 'natura',
    latinName: 'Natura',
    label: 'Natur & Umwelt',
    shortLabel: 'Naturkunde',
    description: 'Tiere, Pflanzen, Pilze, Lebensräume, Gesteine und Naturphänomene.',
    Icon: Leaf,
    accent: '#3E7D5A',
    // MCQ-only: nutzt das generische ConceptVisual (Bild/Kennwerte pro Konzept).
    hasMap: false,
    // Startansicht: Bildgalerie der Tier-/Pflanzen-/Gesteins-Konzepte statt Statistik.
    Explorer: GalleryExplorer,
    explorerLabel: 'Galerie',
    ExplorerIcon: Images,
    loadConcepts: () => fetch('data/concepts_natura.json').then(handleJson),
    loadQuestions: () => fetch('data/questions_natura.json').then(handleJson)
  },
  {
    id: 'lingua',
    latinName: 'Lingua',
    label: 'Sprachen',
    shortLabel: 'Sprachwelt',
    description: 'Sprachen, Sprachfamilien, Schriftsysteme und Wortgeschichten.',
    Icon: Languages,
    accent: '#8A6D3B',
    // MCQ-only: nutzt das generische ConceptVisual (Bild/Kennwerte pro Konzept).
    hasMap: false,
    // Startansicht: Bildgalerie der Sprach-/Schrift-Konzepte statt Statistik.
    Explorer: GalleryExplorer,
    explorerLabel: 'Galerie',
    ExplorerIcon: Images,
    loadConcepts: () => fetch('data/concepts_lingua.json').then(handleJson),
    loadQuestions: () => fetch('data/questions_lingua.json').then(handleJson)
  },
  {
    id: 'cultura',
    latinName: 'Cultura',
    label: 'Kultur',
    shortLabel: 'Kulturwelt',
    description: 'Kunst, Skulptur, Architektur, Musik und Literatur.',
    Icon: Landmark,
    accent: '#7E4B6B',
    // MCQ-only: nutzt das generische ConceptVisual (Bild/Kennwerte pro Konzept).
    hasMap: false,
    // Startansicht: Bildgalerie der Kunst-/Bau-/Musik-/Literatur-Konzepte statt Statistik.
    Explorer: GalleryExplorer,
    explorerLabel: 'Galerie',
    ExplorerIcon: Images,
    loadConcepts: () => fetch('data/concepts_cultura.json').then(handleJson),
    loadQuestions: () => fetch('data/questions_cultura.json').then(handleJson)
  },
  {
    id: 'machina',
    latinName: 'Machina',
    label: 'Digital & Technik',
    shortLabel: 'Technik',
    description: 'Vom Funktionsprinzip her: Software und Computer ebenso wie Werkzeuge, Maschinen, Motoren, Werkstoffe und Fertigungsverfahren.',
    Icon: Cpu,
    accent: '#2C7A8C',
    // MCQ-only: nutzt das generische ConceptVisual. Ordnungsachse = Funktionsprinzip
    // (vgl. docs/bereichs_abgrenzung.md); Erfindungsdatum/-person liegt bei Historia.
    hasMap: false,
    // Kein Explorer-Tab vorerst: die Konzepte tragen noch keine freien Bilder,
    // eine leere Galerie sähe defekt aus. Nachrüstbar, sobald Bilder geerntet sind.
    loadConcepts: () => fetch('data/concepts_machina.json').then(handleJson),
    loadQuestions: () => fetch('data/questions_machina.json').then(handleJson)
  },
  {
    id: 'historia',
    latinName: 'Historia',
    label: 'Geschichte',
    shortLabel: 'Zeitachse',
    description: 'Erfindungen, Entdeckungen, Epochen, Forscher und datierbare Meilensteine.',
    Icon: ScrollText,
    accent: '#7A5230',
    // MCQ-only: nutzt das generische ConceptVisual. Ordnungsachse = Zeit/Urheberschaft.
    // Schwerpunkt Kultur-/Wissenschafts-/Technikgeschichte; Politik-Ausschluss gilt.
    hasMap: false,
    loadConcepts: () => fetch('data/concepts_historia.json').then(handleJson),
    loadQuestions: () => fetch('data/questions_historia.json').then(handleJson)
  }
];

/** Gemeinsamer fetch-Handler: wirft bei HTTP-Fehlern statt still leer zu laden. */
function handleJson(response) {
  if (!response.ok) {
    throw new Error(`Daten konnten nicht geladen werden: ${response.status}`);
  }
  return response.json();
}

/**
 * Sucht eine Domain per ID und faellt auf Terra zurueck.
 * Der Fallback haelt alte Einstellungen sicher, falls eine Domain mal entfernt wird.
 */
export function getDomainById(domainId) {
  return DOMAINS.find(domain => domain.id === domainId) || DOMAINS[0];
}

/**
 * Bestehende Terra-Keys sind bewusst unpraefixt. Jede andere Domain nutzt
 * "<domain>:<conceptId>", ein fehlendes Praefix bedeutet daher immer Terra.
 */
export function getDomainIdFromConceptKey(conceptKey) {
  if (typeof conceptKey !== 'string' || !conceptKey.includes(':')) {
    return 'terra';
  }
  return conceptKey.split(':')[0];
}
