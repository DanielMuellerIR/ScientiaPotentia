/**
 * Buchstaben, die NFD nicht in Grundform plus Kombinationszeichen zerlegt.
 *
 * `.normalize('NFD')` trennt nur Akzente ab, die als eigenes Zeichen kodiert
 * sind — „ö" wird zu „o" plus Trema, „ł" bleibt „ł". Ohne diese Tabelle findet
 * „Lodz" das Łódź im Bestand nicht, waehrend „Gronland" das Grönland findet:
 * Die Normalisierung wirkt vollstaendig, ist es aber nicht. Betroffen sind 13
 * Eintraege der Geodatenbank, darunter Białystok, Diyarbakır, Đà Nẵng und
 * Garðabær.
 */
const UNZERLEGBARE_BUCHSTABEN = {
  'ł': 'l', 'đ': 'd', 'ð': 'd', 'þ': 'th',
  'æ': 'ae', 'ø': 'oe', 'œ': 'oe', 'ı': 'i', 'ħ': 'h'
};

// Aus den Schluesseln gebaut statt danebengeschrieben: Eine zweite Liste
// derselben Buchstaben wuerde beim Ergaenzen auseinanderlaufen — ein Zeichen nur
// in der Tabelle bliebe wirkungslos, eines nur im Muster loeschte den Rest des
// Namens (Review-Fund 2026-09-10).
const UNZERLEGBARE_MUSTER = new RegExp(`[${Object.keys(UNZERLEGBARE_BUCHSTABEN).join('')}]`, 'g');

/**
 * Durchsuchbare Namen vereinheitlichen: Groß-/Kleinschreibung, Umlaute und ß
 * sollen keine unterschiedlichen Trefferlisten erzeugen.
 */
function normalizeSearchText(value) {
  return String(value || '')
    .toLocaleLowerCase('de')
    .replace(/ß/g, 'ss')
    .replace(UNZERLEGBARE_MUSTER, zeichen => UNZERLEGBARE_BUCHSTABEN[zeichen])
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
