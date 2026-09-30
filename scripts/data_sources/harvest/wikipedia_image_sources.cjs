const { DEWIKI_MAP, AMBIGUOUS_NAMES, ASTRA_WIKI_SOURCES } = require('./astra_image_titles.cjs');
const { fileNameFromUploadUrl, selectP18File, isBlacklistedFile } = require('./image_resolution_policy.cjs');

function wikipediaSource(value) {
  try {
    const url = new URL(value);
    const match = url.hostname.match(/^([a-z][a-z0-9-]*)\.wikipedia\.org$/);
    if (!match || !['https:', 'http:'].includes(url.protocol) || !url.pathname.startsWith('/wiki/')) return null;
    const title = decodeURIComponent(url.pathname.slice(6)).replace(/_/g, ' ').trim();
    return title ? { language: match[1], title } : null;
  } catch { return null; }
}

function wikidataId(value) {
  try {
    const url = new URL(value);
    return /^(?:www\.)?wikidata\.org$/.test(url.hostname)
      ? url.pathname.match(/^\/wiki\/(Q[1-9]\d*)$/)?.[1] || null : null;
  } catch { return null; }
}

function sourceForConcept(concept, domain) {
  if (domain === 'astra' && ASTRA_WIKI_SOURCES[concept.id]) return ASTRA_WIKI_SOURCES[concept.id];
  const mapped = domain === 'astra' ? DEWIKI_MAP[concept.id] : undefined;
  if (mapped !== undefined) return mapped ? { language: 'de', title: mapped } : null;
  const source = wikipediaSource(concept.sourceUrl) || wikipediaSource(concept.wikiLink);
  if (source) return source;
  // Astra-Bezeichnungen (z. B. WISE oder Europa) sind häufig Homonyme. Ohne
  // fachliche Titelzuordnung oder Artikelquelle wird dort nichts geraten.
  const name = String(concept.name || '').trim();
  return domain !== 'astra' && name && !AMBIGUOUS_NAMES.has(name)
    ? { language: 'de', title: name } : null;
}

function canonicalPage(query, requestedTitle) {
  const aliases = new Map([...(query.normalized || []), ...(query.redirects || [])]
    .map(({ from, to }) => [from, to]));
  let title = requestedTitle;
  const seen = new Set();
  while (aliases.has(title)) {
    if (seen.has(title)) return null;
    seen.add(title);
    title = aliases.get(title);
  }
  const page = Object.values(query.pages || {}).find(page => page.title === title);
  return page && !('missing' in page) && !('invalid' in page)
    && !('disambiguation' in (page.pageprops || {})) ? page : null;
}

function pageImageFile(page) {
  // Wikipedia kann auch ein lokal hochgeladenes, unfreies Bild liefern. Dessen
  // gleichnamige Commons-Datei wäre kein Beleg für dieselbe Bildzuordnung.
  try {
    const url = new URL(page?.original?.source);
    if (url.hostname !== 'upload.wikimedia.org' || !url.pathname.startsWith('/wikipedia/commons/')) return null;
    return fileNameFromUploadUrl(url.href);
  } catch { return null; }
}

const chunks = (items) => Array.from({ length: Math.ceil(items.length / 50) }, (_, i) => items.slice(i * 50, (i + 1) * 50));
function apiUrl(host, parameters) {
  return `https://${host}/w/api.php?${new URLSearchParams({ format: 'json', maxlag: '5', ...parameters })}`;
}

/** Quellenidentität vor Bildwahl: Sprachartikel → Wikidata-P18 → Artikelbild → de-langlink. */
async function resolveSourceImages(concepts, domain, getJson, acceptFiles = async files => new Set(files), fitsConcept = () => true) {
  const rows = concepts.map(concept => ({ concept, qid: wikidataId(concept.sourceUrl), source: sourceForConcept(concept, domain) }));
  const languageGroups = new Map();
  for (const row of rows) {
    if (!row.source) continue;
    const group = languageGroups.get(row.source.language) || [];
    group.push(row); languageGroups.set(row.source.language, group);
  }
  for (const [language, group] of languageGroups) {
    for (const titles of chunks([...new Set(group.map(row => row.source.title))])) {
      const payload = await getJson(apiUrl(`${language}.wikipedia.org`, {
        action: 'query', prop: 'pageprops|pageimages|langlinks', ppprop: 'wikibase_item|disambiguation',
        piprop: 'original', lllang: 'de', lllimit: 'max', redirects: '1', titles: titles.join('|'),
      }));
      for (const row of group.filter(row => titles.includes(row.source.title))) {
        row.page = canonicalPage(payload.query || {}, row.source.title);
        // Fehlende und mehrdeutige Quellen dürfen weder P18 noch langlinks liefern.
        if (!row.page) continue;
        row.qid ||= /^Q[1-9]\d*$/.test(row.page.pageprops?.wikibase_item || '') ? row.page.pageprops.wikibase_item : null;
      }
    }
  }
  const entities = new Map();
  for (const ids of chunks([...new Set(rows.map(row => row.qid).filter(Boolean))])) {
    const payload = await getJson(apiUrl('www.wikidata.org', { action: 'wbgetentities', props: 'claims|sitelinks', ids: ids.join('|') }));
    for (const id of ids) entities.set(id, payload.entities?.[id]);
  }
  const candidates = [];
  const fallback = [];
  const primary = rows.map(row => {
    const entity = entities.get(row.qid);
    const files = [...new Set([selectP18File(entity?.claims?.P18), pageImageFile(row.page)]
      .filter(file => file && !isBlacklistedFile(file)))];
    return { row, entity, files };
  });
  const accepted = await acceptFiles([...new Set(primary.flatMap(item => item.files))]);
  for (const { row, entity, files } of primary) {
    const file = files.find(file => accepted.has(file) && fitsConcept(file, row.concept, domain));
    const identity = row.qid || (row.page ? `${row.source.language}:${row.page.title}` : null);
    if (file) candidates.push({ id: row.concept.id, identity, file });
    else {
      const title = entity?.sitelinks?.dewiki?.title || row.page?.langlinks?.find(link => link.lang === 'de')?.['*'];
      if (title && !(row.source?.language === 'de' && row.page?.title === title)) fallback.push({ row, title });
    }
  }
  const linked = [];
  for (const titles of chunks([...new Set(fallback.map(item => item.title))])) {
    const payload = await getJson(apiUrl('de.wikipedia.org', { action: 'query', prop: 'pageimages|pageprops',
      ppprop: 'wikibase_item|disambiguation', piprop: 'original', redirects: '1', titles: titles.join('|') }));
    for (const { row, title } of fallback.filter(item => titles.includes(item.title))) {
      const page = canonicalPage(payload.query || {}, title);
      // Sprachlinks können auf einen weiter gefassten Artikel führen. Bei
      // bekannter Quellen-QID muss der Rückfall dasselbe Objekt belegen.
      if (row.qid && page?.pageprops?.wikibase_item !== row.qid) continue;
      const file = pageImageFile(page);
      if (file && !isBlacklistedFile(file)) linked.push({ id: row.concept.id, concept: row.concept, identity: row.qid || `de:${page.title}`, file });
    }
  }
  const acceptedLinked = await acceptFiles([...new Set(linked.map(row => row.file))]);
  candidates.push(...linked.filter(row => acceptedLinked.has(row.file) && fitsConcept(row.file, row.concept, domain)));
  // Auch sprachübergreifende Redirects und QID-Aliase können dasselbe Objekt
  // mehrfach bezeichnen. Eine Zuordnung zu mehreren Konzepten braucht Sichtung.
  const identities = new Map();
  for (const candidate of candidates) identities.set(candidate.identity, (identities.get(candidate.identity) || 0) + 1);
  return new Map(candidates.filter(row => identities.get(row.identity) === 1 && !isBlacklistedFile(row.file))
    .map(row => [row.id, row.file]));
}

module.exports = { wikipediaSource, wikidataId, sourceForConcept, canonicalPage, resolveSourceImages };
