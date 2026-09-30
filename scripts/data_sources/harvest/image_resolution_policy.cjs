const fs = require('node:fs');
const path = require('node:path');

const POLICY = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'IMAGE_BLACKLIST.json'), 'utf8'));
const BLACKLISTED_CONCEPTS = new Set(POLICY.conceptIds);

function normalizeCommonsFileTitle(value) {
  let title = String(value || '').trim();
  try {
    const url = new URL(title);
    title = decodeURIComponent(url.pathname.split('/').pop() || '');
  } catch {
    try { title = decodeURIComponent(title); } catch { /* bereits dekodiert */ }
  }
  return title.replace(/^(?:File|Datei):/i, '').replace(/_/g, ' ').trim();
}

const BLACKLISTED_FILES = new Set(
  POLICY.commonsFileTitles.map(normalizeCommonsFileTitle));

function fileNameFromUploadUrl(source) {
  try {
    const segments = new URL(source).pathname.split('/').filter(Boolean);
    // Thumbnail-Adressen tragen den echten Dateititel im VORLETZTEN Segment;
    // das letzte ist die skalierte Fassung („1200px-Sumerian_cuneiform.svg.png").
    // Vorher lieferte die Funktion diesen Namen, der anschliessende File:-Lookup
    // lief ins Leere und das Konzept blieb still ohne Bild (CodeQA 2026-09-03).
    const isThumb = segments.includes('thumb');
    const fileName = isThumb && segments.length >= 2
      ? segments[segments.length - 2]
      : segments[segments.length - 1];
    return fileName ? decodeURIComponent(fileName) : null;
  } catch {
    return null;
  }
}

function isBlacklistedConcept(id) {
  return BLACKLISTED_CONCEPTS.has(String(id || ''));
}

function isBlacklistedFile(value) {
  return BLACKLISTED_FILES.has(normalizeCommonsFileTitle(value));
}

/** Ein Vorfilter verwirft klare Fehlmotive; die fachliche Sichtung bleibt nötig. */
function isSuitableImageMotif(file, metadata, concept, domain) {
  const title = normalizeCommonsFileTitle(file).toLowerCase();
  const categories = String(metadata?.Categories?.value || '').toLowerCase();
  const subjects = `${title}|${categories}`.replace(/_/g, ' ');
  if (/\b(signatures?|signatur|autographs?)\b/.test(subjects)) return false;
  const portrait = ['composer', 'author', 'figure', 'genre_fiction'].includes(concept?.category);
  if (portrait && /\b(montages?|collages?|mosaics?)\b/.test(subjects)) return false;
  const humanAnatomy = domain === 'homo' && ['bone', 'muscle', 'organ', 'joint',
    'nerve', 'brain_lobe', 'cell_type', 'sense', 'reflex'].includes(concept?.category);
  if (humanAnatomy) {
    if (/\b(birds?|aves|insects?|arthropods?|cats?|dogs?|horses?|cattle|bovine|porcine|pigs?|rats?|mice|rodents?|fish|fishes|reptiles?|amphibians?|non-human|veterinary)\b/.test(subjects)) return false;
    if (/\b(personnel|military records|infantry|service records|karteikarte|personalakte)\b/.test(subjects)) return false;
  }
  return true;
}

/** Bevorzugt genau ein preferred P18; sonst genau ein normales Statement. */
function selectP18File(statements) {
  const usable = (Array.isArray(statements) ? statements : [])
    .filter(statement => statement?.rank !== 'deprecated')
    .map(statement => ({
      rank: statement?.rank || 'normal',
      value: statement?.mainsnak?.datavalue?.value,
    }))
    .filter(statement => typeof statement.value === 'string' && statement.value.trim());
  const preferred = usable.filter(statement => statement.rank === 'preferred');
  if (preferred.length === 1) return preferred[0].value;
  if (preferred.length > 1) return null;
  const normal = usable.filter(statement => statement.rank === 'normal');
  return normal.length === 1 ? normal[0].value : null;
}

module.exports = {
  fileNameFromUploadUrl,
  isBlacklistedConcept,
  isBlacklistedFile,
  isSuitableImageMotif,
  normalizeCommonsFileTitle,
  selectP18File,
};
