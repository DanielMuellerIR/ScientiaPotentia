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

/**
 * Wortlaut eines Zitats für den Vergleich normalisieren: Kleinschreibung,
 * Anführungen, Gedankenstriche, Auslassungspunkte und Satzzeichen zu
 * Leerzeichen, ß zu ss. Umlaute bleiben, weil sichtbares Deutsch sie führt.
 *
 * Warum hier und nicht je Skript (CodeQA 2026-09-03): Die Funktion stand
 * dreimal kopiert in wikiquote_verify.cjs, wikiquote_harvest.cjs und
 * wikiquote_w4.cjs — und war auseinandergedriftet. Die beiden Erntekopien
 * kannten nur die geraden Anführungszeichen, nicht die typografischen. Aus
 * „Er sagte: „Die Freiheit" ist das Wichtigste." wurde dort das Dedup-Token
 * `freiheit"` statt `freiheit`, sodass die Overlap-Dublettenprüfung bei
 * echten Wikiquote-Texten schlechter griff als beim Verifizierer.
 */
function normalizeQuoteText(value) {
  return String(value || '').toLowerCase()
    .replace(/[„“”"»«‚‘’']/g, ' ')
    .replace(/[–—-]/g, ' ')
    .replace(/[…]/g, ' ')
    .replace(/[.,;:!?()\[\]]/g, ' ')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Wort-Tokens ab drei Zeichen — Grundlage des Overlap-Dedup. */
function quoteTokens(value) {
  return normalizeQuoteText(value).split(' ').filter(word => word.length >= 3);
}

module.exports = { stripQuotationMarks, normalizeQuoteText, quoteTokens };
