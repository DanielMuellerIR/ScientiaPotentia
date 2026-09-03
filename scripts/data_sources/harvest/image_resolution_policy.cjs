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
  normalizeCommonsFileTitle,
  selectP18File,
};
