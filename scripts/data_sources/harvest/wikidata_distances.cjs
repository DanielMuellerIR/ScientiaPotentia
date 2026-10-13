'use strict';

const UNIT_LY  = 'Q531';       // Lichtjahr
const UNIT_PC  = 'Q12129';     // Parsec
const UNIT_KPC = 'Q11929860';  // Kiloparsec
const UNIT_MPC = 'Q3773454';   // Megaparsec

/** Rechnet positive Wikidata-Distanzen in ganze Lichtjahre um. */
function toDistanceLy(amount, unitUrl) {
  const v = parseFloat(amount);
  if (!isFinite(v) || v <= 0) return null;
  const unitQid = String(unitUrl).split('/').pop();
  if (unitQid === UNIT_LY)  return Math.round(v);
  if (unitQid === UNIT_PC)  return Math.round(v * 3.26156);
  if (unitQid === UNIT_KPC) return Math.round(v * 3261.56);
  if (unitQid === UNIT_MPC) return Math.round(v * 3261560);
  return null;
}

async function fetchDistancesForQids(qids, label, { sparql, sleep, delayMs }) {
  const distMap = new Map();
  if (qids.length === 0) return distMap;
  const batchSize = 30;
  for (let i = 0; i < qids.length; i += batchSize) {
    const batch = qids.slice(i, i + batchSize);
    const valClause = batch.map(q => `wd:${q}`).join(' ');
    const query = `
SELECT DISTINCT ?item ?distAmount ?distUnit WHERE {
  VALUES ?item { ${valClause} }
  OPTIONAL {
    ?item p:P2583 ?distStmt .
    ?distStmt psv:P2583 ?distVal .
    ?distVal wikibase:quantityAmount ?distAmount .
    ?distVal wikibase:quantityUnit ?distUnit .
    ?distStmt wikibase:rank ?distRank .
    FILTER(?distRank != wikibase:DeprecatedRank)
  }
}
`;
    try {
      const bindings = await sparql(query);
      for (const b of bindings) {
        const itemUrl = b.item?.value;
        if (!itemUrl) continue;
        const qid     = String(itemUrl).split('/').pop();
        const amount  = b.distAmount?.value;
        const unitUrl = b.distUnit?.value;
        if (!amount || !unitUrl) continue;
        const ly = toDistanceLy(amount, unitUrl);
        if (!ly || ly <= 0) continue;
        // Erste gültige Angabe behalten; direkt angegebene Lichtjahre haben Vorrang.
        const existing = distMap.get(qid);
        if (!existing) {
          distMap.set(qid, ly);
        } else {
          const unitQid = String(unitUrl).split('/').pop();
          if (unitQid === UNIT_LY) distMap.set(qid, ly);
        }
      }
      if (i + batchSize < qids.length) await sleep(delayMs);
    } catch (err) {
      console.warn(`  Distanz-Batch-Fehler (${label}): ${err.message}`);
      throw err;
    }
  }
  return distMap;
}

module.exports = { fetchDistancesForQids, toDistanceLy };
