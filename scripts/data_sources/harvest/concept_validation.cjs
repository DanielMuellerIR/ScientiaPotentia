function isHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function validateConcept(concept, {
  requireSource = false,
  requireAttributeValues = false,
} = {}) {
  if (!concept || typeof concept !== 'object' || Array.isArray(concept)) {
    return 'Konzept-Objekt erwartet';
  }
  for (const field of ['id', 'name', 'category']) {
    if (typeof concept[field] !== 'string' || !concept[field].trim()) {
      return `${field} fehlt oder ist kein nicht leerer Text`;
    }
  }
  if (!concept.attributes || typeof concept.attributes !== 'object'
      || Array.isArray(concept.attributes)) {
    return 'attributes muss ein Objekt sein';
  }
  if (requireAttributeValues && Object.keys(concept.attributes).length === 0) {
    return 'attributes muss mindestens ein fachliches Feld enthalten';
  }
  for (const [key, value] of Object.entries(concept.attributes)) {
    if (requireAttributeValues && (!key.trim() || value === null || value === undefined
        || (typeof value === 'string' && !value.trim()))) {
      return `attributes.${key || '—'} besitzt keinen verwertbaren Wert`;
    }
  }
  if (requireSource || Object.hasOwn(concept, 'sourceName')) {
    if (typeof concept.sourceName !== 'string' || !concept.sourceName.trim()) {
      return 'sourceName fehlt oder ist kein nicht leerer Text';
    }
  }
  if (requireSource || Object.hasOwn(concept, 'sourceUrl')) {
    if (!isHttpUrl(concept.sourceUrl)) return 'sourceUrl fehlt oder ist keine HTTP(S)-URL';
  }
  return null;
}

function validateCatalog(concepts, options) {
  if (!Array.isArray(concepts)) return 'Katalog muss ein Array sein';
  const ids = new Set();
  for (let index = 0; index < concepts.length; index += 1) {
    const problem = validateConcept(concepts[index], options);
    if (problem) return `Konzept ${index + 1}: ${problem}`;
    if (ids.has(concepts[index].id)) return `doppelte id ${concepts[index].id}`;
    ids.add(concepts[index].id);
  }
  return null;
}

module.exports = { isHttpUrl, validateCatalog, validateConcept };
