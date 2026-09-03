/**
 * Gemeinsame Regel, WO die deutschen Textkorrekturen eines Merge-Skripts
 * greifen dürfen.
 *
 * Hintergrund (CodeQA 2026-09-03): merge_natura, merge_cultura und merge_phase5
 * ließen ihre Wortliste über das komplette Konzeptobjekt laufen — also auch
 * über technische Felder. Zwei Folgen waren im Bestand nachweisbar:
 *
 *   1. Konzept-IDs wurden umgeschrieben: `weisser-hai` -> `weißer-hai`,
 *      `grosser-tuemmler` -> `großer-tuemmler`. Die ID ist ein Schlüssel, kein
 *      Anzeigetext; sie stimmt danach nicht mehr mit der Erntedatei überein,
 *      und die ID-Kollisionsprüfung in merge_phase5 vergleicht anschließend
 *      gegen einen anderen Wert als den gelieferten.
 *   2. Eine Nachweis-URL wurde zerschrieben: der Urheberlink des Konzepts
 *      `expressionismus` endete auf `pressebild_gemälde_plastik.htm` statt
 *      `…gemaelde…` und war damit tot. Ein Urheberlink ist die Lizenzangabe.
 *
 * merge_lingua.js hatte die Regel schon richtig formuliert und im Kommentar
 * festgehalten; hier steht sie einmal für alle.
 *
 * Die Wortlisten selbst bleiben bewusst bei den Skripten: natura und cultura
 * pflegen fünf Paare, astra und phase5 zehn verschiedene. Sie
 * zusammenzuziehen würde das Verhalten je Bereich ändern.
 */

/** Felder, die einen deutschen Anzeigetext tragen und korrigiert werden dürfen. */
const TEXT_FIELDS = ['name', 'funFact', 'verifyNote', 'sourceName'];

/**
 * Wendet `fix` auf die deutschen Anzeigefelder und alle Attributwerte an.
 * `id`, URLs und die (englischen) Bildfelder bleiben unangetastet.
 *
 * @param {object} concept  Konzept in der vom Generator erwarteten Form.
 * @param {(text: string) => string} fix  Textkorrektur des jeweiligen Merges.
 * @returns {object} neues Konzept; die Eingabe bleibt unverändert.
 */
export function applyTextFix(concept, fix) {
  const out = { ...concept };
  for (const field of TEXT_FIELDS) {
    if (typeof out[field] === 'string') out[field] = fix(out[field]);
  }
  if (out.attributes && typeof out.attributes === 'object' && !Array.isArray(out.attributes)) {
    out.attributes = fixDeep(out.attributes, fix);
  }
  return out;
}

/** Textkorrektur rekursiv über Attributwerte (Strings, Listen, Unterobjekte). */
function fixDeep(value, fix) {
  if (typeof value === 'string') return fix(value);
  if (Array.isArray(value)) return value.map(entry => fixDeep(entry, fix));
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = fixDeep(value[key], fix);
    return out;
  }
  return value;
}
