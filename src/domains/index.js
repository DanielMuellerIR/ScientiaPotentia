import { Globe2 } from 'lucide-react';

/**
 * Central registry for all knowledge domains.
 *
 * A domain owns its concepts and its question pool. Terra still reuses the
 * existing geodb format, but the rest of the app no longer needs to know where
 * that data comes from. Future domains can add their own loaders here without
 * touching the quiz engine again.
 */
export const DOMAINS = [
  {
    id: 'terra',
    latinName: 'Terra',
    label: 'Geografie',
    shortLabel: 'Weltatlas',
    description: 'Länder, Städte, Flüsse und Regionen der Erde.',
    Icon: Globe2,
    loadConcepts: () => import('../data/geodb.json').then(module => module.default.entities),
    loadQuestions: () => fetch('data/questions_terra.json').then(response => {
      if (!response.ok) {
        throw new Error(`Fragenkatalog konnte nicht geladen werden: ${response.status}`);
      }
      return response.json();
    })
  }
];

/**
 * Finds a domain definition by ID and falls back to Terra.
 * The fallback keeps old settings safe if a future domain gets removed.
 */
export function getDomainById(domainId) {
  return DOMAINS.find(domain => domain.id === domainId) || DOMAINS[0];
}

/**
 * Existing Terra keys are intentionally unprefixed. Every new domain uses
 * "<domain>:<conceptId>", so a missing prefix always means Terra.
 */
export function getDomainIdFromConceptKey(conceptKey) {
  if (typeof conceptKey !== 'string' || !conceptKey.includes(':')) {
    return 'terra';
  }
  return conceptKey.split(':')[0];
}
