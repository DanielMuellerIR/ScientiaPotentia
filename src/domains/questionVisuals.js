// Regionsfragen benötigen die markierte Kartenfläche auch ohne Kartenklick.
const MAP_QUESTION_TYPES = new Set(['click-map', 'state-match']);

export function questionRequiresMap(question) {
  return MAP_QUESTION_TYPES.has(question.type);
}
