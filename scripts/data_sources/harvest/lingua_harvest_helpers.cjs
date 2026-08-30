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
    // Nur bekannte Sprachzusätze sind reine Schreibvarianten. Ein beliebiger
    // Klammerinhalt kann die Bedeutung ändern (Wu (Chinesisch) ≠ Wu (Fluss)).
    .replace(/\((?:sprache|language|chinesisch|dialekt)\)/gi, ' ')
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

/**
 * SPARQL erzeugt aus mehreren Sprecher- und Schriftwerten ein Kreuzprodukt.
 * Die Reihenfolge ist nicht definiert; deshalb werden die fachlichen
 * Dimensionen getrennt dedupliziert und Mehrdeutigkeiten nicht geraten.
 * `wdt:` liefert dabei nur statements mit bestem Rang (preferred vor normal,
 * deprecated nie).
 */
function selectLanguageFacts(bindings, normalizeScript = value => value || null) {
  const speakers = new Set();
  const scripts = new Set();
  for (const row of bindings || []) {
    if (row.speakers?.value !== undefined) {
      const number = Number(row.speakers.value);
      if (Number.isFinite(number) && number > 0) speakers.add(number);
    }
    const script = normalizeScript(row.scriptLabel?.value);
    if (script) scripts.add(script);
  }
  if (speakers.size > 1) {
    throw new Error(`mehrdeutige P1098-Werte: ${[...speakers].sort((a, b) => a - b).join(', ')}`);
  }
  if (scripts.size > 1) {
    throw new Error(`mehrdeutige P282-Werte: ${[...scripts].sort().join(', ')}`);
  }
  return {
    speakersRaw: speakers.size ? [...speakers][0] : null,
    script: scripts.size ? [...scripts][0] : null,
  };
}

module.exports = {
  assertExpectedEntity,
  buildSingleLanguageQuery,
  normalizeEntityName,
  selectLanguageFacts,
};
