/** Entfernt nur eindeutig erkennbare Wikiquote-Quellenanhänge. */
function stripQuotationMarks(value) {
  let text = String(value || '').trim();
  const quoted = text.match(/^[„"»«](.*)[“”"«»]\s*(?:[–—-].*)?$/);
  if (quoted) {
    text = quoted[1];
  } else {
    // Unzitierte Hauptlistenpunkte sind zulässig. Ein Binnen-Gedankenstrich
    // bleibt Text; nur ein nach Satzende abgesetzter, quellentypischer Anhang
    // wird entfernt.
    text = text.replace(
      /(?<=[.!?])\s+[–—-]\s+(?=[^\n]*(?:\b(?:werk|quelle|seite|band|kapitel|isbn)\b|\bS\.\s*\d|\b\d{4}\b))[^\n]*$/i,
      '',
    );
  }
  return text
    .replace(/\s+https?:\/\/\S+/g, '')
    .replace(/^[„"»«]\s*/, '')
    .replace(/\s*[“”"«»]\s*$/, '')
    .trim();
}

module.exports = { stripQuotationMarks };
