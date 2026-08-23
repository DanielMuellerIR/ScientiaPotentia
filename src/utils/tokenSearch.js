/**
 * Durchsuchbare Namen vereinheitlichen: Groß-/Kleinschreibung, Umlaute und ß
 * sollen keine unterschiedlichen Trefferlisten erzeugen.
 */
function normalizeSearchText(value) {
  return String(value || '')
    .toLocaleLowerCase('de')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function toTokens(value) {
  return normalizeSearchText(value).match(/[\p{L}\p{N}]+/gu) || [];
}

/**
 * Prüft jeden Suchbegriff nur gegen Wortanfänge des Namens. Dadurch findet
 * „Eule“ etwa „Schnee-Eule“, aber nicht das innere „eule“ in „Beulenkrokodil“.
 */
export function matchesNameTokenPrefix(name, search) {
  const normalizedSearch = normalizeSearchText(search);
  const searchTokens = normalizedSearch.match(/[\p{L}\p{N}]+/gu) || [];
  if (searchTokens.length === 0) return normalizedSearch.trim() === '';

  const nameTokens = toTokens(name);
  return searchTokens.every((searchToken) => nameTokens
    .some((nameToken) => nameToken.startsWith(searchToken)));
}
