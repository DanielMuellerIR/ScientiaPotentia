import React, { Suspense } from 'react';
import Map from './Map';
import DomainVisual from './DomainVisual';
import ConceptVisual from './ConceptVisual';

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
export default function VisualPanel({
  domain,
  concepts = {},
  srsProgress = {},
  activeConceptKey = null,
  testedAttribute = null,
  answerIsName = false,
  hideConceptIdentity = false,
  isQuestionAnswered = false,
  mapProps = {}
}) {
  // --- Terra: bestehende Weltkarte -------------------------------------
  if (domain.hasMap) {
    return (
      <div
        className="terra-panel"
        style={{
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
          border: '1px solid var(--border-light)',
          background: '#EAE6DC'
        }}
      >
        <Map {...mapProps} />
      </div>
    );
  }

  const activeConcept = activeConceptKey ? concepts[activeConceptKey] : null;
  const SpecialVisual = domain.Visual;

  // --- Domain mit eigener Visualisierung (laedt three.js etc. lazy) ----
  if (SpecialVisual) {
    return (
      <Suspense
        fallback={<DomainVisual domain={domain} concepts={concepts} srsProgress={srsProgress} />}
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
  return <DomainVisual domain={domain} concepts={concepts} srsProgress={srsProgress} />;
}
