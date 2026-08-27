/** Nur ein tatsächlich geliefertes ganzzahliges JSON-Jahr belegt den Todeszeitpunkt. */
export function isDocumentedDeathYear(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
