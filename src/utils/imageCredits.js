const COMMONS_REUSE_URL = 'https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia';

/** Entfernt HTML und private Kontaktadressen aus Commons-Metadaten. */
export function sanitizeImageAttribution(value) {
  return String(value || '')
    .replace(/<br\s*\/?\s*>/gi, ' / ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/\bmailto:\s*/gi, '')
    .replace(/\b(Unknown (?:author|artist|creator|source))\s*\1\b/gi, '$1')
    .replace(/\bUnknown\s*Unknown\b/gi, 'Unknown')
    .replace(/\b(CFCF|wdwd)\b/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s*\/\s*\/\s*/g, ' / ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s/·,;-]+|[\s/·,;-]+$/g, '')
    .trim();
}

/** Liefert für die in den Rohdaten vorkommenden freien Lizenzen eine kanonische Adresse. */
export function licenseUrlFor(label) {
  const license = String(label || '').trim();
  const lower = license.toLowerCase();
  if (!license) return '';
  if (lower === 'cc0' || lower === 'cc0 1.0') {
    return 'https://creativecommons.org/publicdomain/zero/1.0/';
  }
  if (lower === 'public domain' || lower.startsWith('pd ')) {
    return 'https://commons.wikimedia.org/wiki/Commons:Public_domain';
  }
  const creativeCommons = license.match(/^CC\s+BY(-SA)?(?:\s+([0-9.]+))?(?:\s+([a-z]+))?$/i);
  if (creativeCommons) {
    const family = creativeCommons[1] ? 'by-sa' : 'by';
    const version = creativeCommons[2];
    const jurisdiction = creativeCommons[3]?.toLowerCase();
    if (!version) return COMMONS_REUSE_URL;
    return `https://creativecommons.org/licenses/${family}/${version}/${jurisdiction ? `${jurisdiction}/` : ''}`;
  }
  if (lower === 'fal') return 'https://artlibre.org/licence/lal/en/';
  if (lower === 'gfdl 1.2') return 'https://www.gnu.org/licenses/old-licenses/fdl-1.2.html';
  if (lower.startsWith('gfdl')) return 'https://www.gnu.org/licenses/fdl-1.3.html';
  if (lower === 'attribution') return 'https://commons.wikimedia.org/wiki/Template:Attribution';
  if (lower === 'copyrighted free use') {
    return 'https://commons.wikimedia.org/wiki/Template:Copyrighted_free_use';
  }
  return COMMONS_REUSE_URL;
}

/** Einheitliche Bildmetadaten für alle Domain-Generatoren. */
export function buildImageMetadata(concept) {
  if (!concept?.imageFile) return null;
  return {
    url: concept.imageFile,
    sourceUrl: concept.imageFile,
    license: concept.imageLicense || '',
    licenseUrl: concept.imageLicenseUrl || licenseUrlFor(concept.imageLicense),
    attribution: sanitizeImageAttribution(concept.imageAttribution),
    changes: concept.imageChanges || 'für die Anzeige technisch skaliert',
  };
}

/** Ergänzt ältere Concept-JSONs defensiv um ableitbare Credit-Felder. */
export function normaliseImageCredit(image) {
  if (!image?.url) return null;
  return {
    sourceUrl: image.sourceUrl || image.url,
    license: image.license || '',
    licenseUrl: image.licenseUrl || licenseUrlFor(image.license),
    attribution: sanitizeImageAttribution(image.attribution) || 'Urheberangabe auf der Dateiseite',
    changes: image.changes || 'für die Anzeige technisch skaliert',
  };
}
