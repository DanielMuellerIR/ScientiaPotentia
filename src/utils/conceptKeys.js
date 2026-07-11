/**
 * Gemeinsame Konzept-Key-Logik — einzige Quelle für die Domain-Ableitung.
 *
 * Bestehende Terra-Keys sind bewusst unpraefixt (z.B. "FJ", "Q64"). Jede andere
 * Domain nutzt "<domain>:<conceptId>" (z.B. "astra:mars"); ein fehlendes ":"
 * bedeutet daher immer Terra. Vorher existierte diese Funktion doppelt
 * (src/utils/db.js und src/domains/index.js) — hier zusammengeführt.
 */
export function getDomainIdFromConceptKey(conceptKey) {
  // codereview-ok: 'terra'-Fallback ist bewusstes Default für unpräfixte Alt-Keys;
  // aktuelle Aufrufer übergeben Domain/gültige Keys explizit (2026-07-08)
  if (typeof conceptKey !== 'string' || !conceptKey.includes(':')) {
    return 'terra';
  }
  return conceptKey.split(':')[0];
}
