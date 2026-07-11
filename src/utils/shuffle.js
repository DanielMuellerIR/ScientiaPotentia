/**
 * Unverzerrtes Mischen per Fisher-Yates.
 *
 * Ersetzt das frühere Muster `array.sort(() => 0.5 - Math.random())`: ein
 * zufälliger sort-Komparator mischt statistisch verzerrt (frühe Elemente
 * bleiben bevorzugt vorn) und ist laut Spezifikation sogar undefiniertes
 * Verhalten, weil der Komparator inkonsistente Ergebnisse liefert.
 *
 * @param {Array} array - Eingabe; wird NICHT verändert.
 * @returns {Array} Neue, zufällig gemischte Kopie.
 */
export function shuffle(array) {
  const result = [...array];
  // Klassischer Fisher-Yates: von hinten nach vorn jedes Element mit einem
  // zufälligen Element davor (oder sich selbst) tauschen — jede Permutation
  // ist damit gleich wahrscheinlich.
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
