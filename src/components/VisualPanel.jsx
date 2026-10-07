import React, { lazy, Suspense } from 'react';
import DomainVisual from './DomainVisual';
import ConceptVisual from './ConceptVisual';
import { getDomainById } from '../domains';
import { getDomainIdFromConceptKey } from '../utils/conceptKeys';

const Map = lazy(() => import('./Map'));

/**
 * Linkes Visualisierungs-Panel. Waehlt die Darstellung passend zur aktiven
 * Domain und zum aktuell gefragten Konzept:
 *
 *   1. Terra (hasMap)              -> interaktive Weltkarte (Map.jsx)
 *   2. Domain mit eigener Visual   -> domain.Visual (z.B. 3D-Planeten bei Astra);
 *                                     diese Komponente kennt aktiven Konzept- und
 *                                     Uebersichtszustand selbst.
 *   3. Aktives Konzept, keine eig. -> generische ConceptVisual (Konzeptkarte)
 *   4. Sonst                       -> Themen-Uebersicht (DomainVisual)
 *
 * Grundregel: JEDE Quizfrage zeigt links etwas Passendes. Solange eine Domain
 * keine spezialisierte Visualisierung hat, springt ConceptVisual ein.
 *
 * domain.Visual wird lazy geladen (React.lazy in der Registry), damit schwere
 * Abhaengigkeiten (three.js fuer Astra) nur fuer die jeweilige Domain laden.
 */
function ContentVisual({
  domain,
  concepts = {},
  srsProgress = {},
  questionPool,
  activeConceptKey = null,
  testedAttribute = null,
  answerIsName = false,
  hideConceptIdentity = false,
  isQuestionAnswered = false
}) {
  const activeConcept = activeConceptKey ? concepts[activeConceptKey] : null;
  const SpecialVisual = domain.Visual;

  // --- Domain mit eigener Visualisierung (laedt three.js etc. lazy) ----
  if (SpecialVisual) {
    return (
      // codereview-ok: Suspense-Fallback zeigt bewusst DomainVisual (Direct-Visual-Show) (2026-07-08)
      <Suspense
        fallback={<DomainVisual domain={domain} concepts={concepts} srsProgress={srsProgress} questionPool={questionPool} />}
      >
        <SpecialVisual
          domain={domain}
          concepts={concepts}
          srsProgress={srsProgress}
          activeConcept={activeConcept}
          activeConceptKey={activeConceptKey}
          testedAttribute={testedAttribute}
          answerIsName={answerIsName}
          hideConceptIdentity={hideConceptIdentity}
          isQuestionAnswered={isQuestionAnswered}
        />
      </Suspense>
    );
  }

  // --- Generische Konzeptkarte waehrend einer Quizrunde ----------------
  if (activeConcept) {
    return (
      <ConceptVisual
        domain={domain}
        concept={activeConcept}
        testedAttribute={testedAttribute}
        answerIsName={answerIsName}
        hideConceptIdentity={hideConceptIdentity}
        isQuestionAnswered={isQuestionAnswered}
      />
    );
  }

  // --- Themen-Uebersicht (Dashboard/Atlas, keine aktive Frage) ---------
  return <DomainVisual domain={domain} concepts={concepts} srsProgress={srsProgress} questionPool={questionPool} />;
}


export default function VisualPanel(props) {
  const { domain, activeConceptKey, concepts = {}, mapProps = {}, mapAvailable, mapCapabilityPending } = props;
  const visualDomain = domain.id === 'scientia' && activeConceptKey
    ? getDomainById(getDomainIdFromConceptKey(activeConceptKey)) : domain;
  const hasMapPool = domain.hasMapQuestions ?? domain.hasMap;
  if (!hasMapPool) return <ContentVisual {...props} domain={visualDomain} />;

  const showMap = visualDomain.hasMap || mapCapabilityPending;
  const activeConcept = concepts[activeConceptKey];
  // Im Mix bleibt die geprüfte Karte montiert. Ein späterer Terra-Wechsel
  // braucht dadurch keinen zweiten Initialisierungslauf mitten in der Runde.
  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <div className="terra-panel" aria-hidden={!showMap}
        style={{ position: 'absolute', inset: 0, visibility: showMap ? 'visible' : 'hidden',
          overflow: 'hidden', border: '1px solid var(--border-light)', background: '#EAE6DC' }}>
        <Suspense fallback={<div role="status" style={{ padding: '24px' }}>Karte wird geladen …</div>}>
          <Map {...mapProps} />
        </Suspense>
        {showMap && mapAvailable === false && activeConcept && (
          <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
            <ConceptVisual domain={visualDomain} concept={activeConcept}
              answerIsName hideConceptIdentity isQuestionAnswered={props.isQuestionAnswered} />
          </div>
        )}
      </div>
      {!showMap && <ContentVisual {...props} domain={visualDomain} />}
    </div>
  );
}
