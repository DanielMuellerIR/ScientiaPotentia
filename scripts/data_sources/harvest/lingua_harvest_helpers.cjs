/** Gemeinsame Schutzfunktionen für die Wikidata-Lingua-Harvester. */

'use strict';

function assertQid(qid) {
  if (!/^Q\d+$/.test(String(qid))) {
    throw new Error(`Ungültige Wikidata-QID: ${qid}`);
  }
  return qid;
}

/**
 * Normalisiert ausschließlich Schreibvarianten. Inhaltlich verschiedene Namen
 * dürfen dadurch nicht gleich werden: Der Abgleich soll falsche QIDs stoppen.
 */
function normalizeEntityName(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[’'`´]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function assertExpectedEntity(item, bindings) {
  const expectedName = item.nameDE ?? item.name;
  if (!Array.isArray(bindings) || bindings.length === 0) {
    throw new Error(`${expectedName}: ${item.qid} lieferte keine Sprachdaten`);
  }

  const expected = normalizeEntityName(expectedName);
  const remoteNames = new Set();
  for (const row of bindings) {
    if (row.itemLabel?.value) remoteNames.add(row.itemLabel.value);
    if (row.itemAltLabel?.value) remoteNames.add(row.itemAltLabel.value);
  }

  if (![...remoteNames].some(name => normalizeEntityName(name) === expected)) {
    const found = [...remoteNames].join(', ') || 'kein deutsches Label';
    throw new Error(
      `${expectedName}: ${item.qid} bezeichnet laut Wikidata „${found}“`,
    );
  }

  return bindings;
}

/**
 * Fragt neben Sprecherzahl und Schrift auch Label und Aliase der Entität ab.
 * Damit prüft assertExpectedEntity die handkuratierten QID-Namens-Paare, bevor
 * ein fremder Zahlenwert unter dem erwarteten Sprachnamen gespeichert wird.
 */
function buildSingleLanguageQuery(qid) {
  assertQid(qid);
  return [
    'SELECT ?itemLabel ?itemAltLabel ?speakers ?scriptLabel',
    'WHERE {',
    `  wd:${qid} rdfs:label ?itemLabel .`,
    '  FILTER(LANG(?itemLabel) = "de")',
    '  OPTIONAL {',
    `    wd:${qid} skos:altLabel ?itemAltLabel .`,
    '    FILTER(LANG(?itemAltLabel) = "de")',
    '  }',
    `  OPTIONAL { wd:${qid} wdt:P1098 ?speakers . }`,
    '  OPTIONAL {',
    `    wd:${qid} wdt:P282 ?script .`,
    '    ?script rdfs:label ?scriptLabel .',
    '    FILTER(LANG(?scriptLabel) = "de")',
    '  }',
    '  FILTER EXISTS {',
    `    ?dw schema:about wd:${qid} ;`,
    '        schema:isPartOf <https://de.wikipedia.org/> .',
    '  }',
    '}',
    'LIMIT 100',
  ].join('\n');
}

module.exports = {
  assertExpectedEntity,
  buildSingleLanguageQuery,
  normalizeEntityName,
};
