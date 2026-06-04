import { Globe2, Sparkles } from 'lucide-react';

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
    // Phase 1: reine Multiple-Choice-Fragen, noch keine interaktive Karte.
    hasMap: false,
    loadConcepts: () => fetch('data/concepts_astra.json').then(handleJson),
    loadQuestions: () => fetch('data/questions_astra.json').then(handleJson)
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
