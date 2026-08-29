import { decodeHTML } from 'entities';
import { isWikimediaCommonsUrl } from './commonsImage.js';

/** Entfernt HTML und private Kontaktadressen aus Commons-Metadaten. */
export function sanitizeImageAttribution(value) {
  return decodeHTML(String(value || ''))
    .replace(/<br\s*\/?\s*>/gi, ' / ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/\bmailto:\s*/gi, '')
    .replace(/\b(Unknown (?:author|artist|creator|source))\s*\1\b/gi, '$1')
    .replace(/\bUnknown\s*Unknown\b/gi, 'Unknown')
    // Commons ist der Fundort, nicht Teil des Urhebernamens. Die separate
    // Quellenverknüpfung zeigt ihn direkt neben der Attribution ohnehin an.
    .replace(/\s*(?:\/|·|,)\s*Wikimedia Commons\s*$/i, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s*\/\s*\/\s*/g, ' / ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s/·,;-]+|[\s/·,;-]+$/g, '')
    .trim();
}

/** Erkennt eine konkrete Person oder Organisation statt eines Kontakt-/Hinweisrests. */
export function isConcreteImageAttribution(value) {
  const attribution = sanitizeImageAttribution(value);
  if (!attribution) return false;
  return !/^(?:unknown(?: (?:author|artist|creator|source))?|unbekannt|own work|self|none|n\/a|urheber nicht angegeben(?:\b.*)?|please (?:report|contact|notify)\b.*|(?:report|contact) (?:references?|the author)\b.*)[\s.!,:;-]*$/i
    .test(attribution);
}

/** Positivliste der im Projekt dokumentierten freien Lizenzfamilien. */
export function isAllowedImageLicense(label) {
  const license = String(label || '').trim();
  if (/^Public domain$/i.test(license)) return true;
  if (/^CC0(?:\s+1\.0)?$/i.test(license)) return true;
  if (/^CC\s+BY(?:-SA)?\s+(?:1\.0|2\.0|2\.1|2\.5|3\.0|4\.0)(?:\s+[a-z]{2,3})?$/i.test(license)) return true;
  return /^(?:FAL|GFDL(?:\s+(?:1\.2|1\.3))?|Attribution|Copyrighted free use)$/i.test(license);
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
    if (!version) return '';
    return `https://creativecommons.org/licenses/${family}/${version}/${jurisdiction ? `${jurisdiction}/` : ''}`;
  }
  if (lower === 'fal') return 'https://artlibre.org/licence/lal/en/';
  if (lower === 'gfdl 1.2') return 'https://www.gnu.org/licenses/old-licenses/fdl-1.2.html';
  if (lower.startsWith('gfdl')) return 'https://www.gnu.org/licenses/fdl-1.3.html';
  if (lower === 'attribution') return 'https://commons.wikimedia.org/wiki/Template:Attribution';
  if (lower === 'copyrighted free use') {
    return 'https://commons.wikimedia.org/wiki/Template:Copyrighted_free_use';
  }
  return '';
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
  const sourceUrl = image.sourceUrl || image.url;
  const sanitizedAttribution = sanitizeImageAttribution(image.attribution);
  const attribution = /^Wikimedia Commons$/i.test(sanitizedAttribution)
    ? ''
    : sanitizedAttribution;
  return {
    sourceUrl,
    sourceLabel: isWikimediaCommonsUrl(sourceUrl) ? 'Wikimedia Commons' : 'Bildquelle',
    license: image.license || '',
    licenseUrl: image.licenseUrl || licenseUrlFor(image.license),
    attribution: attribution || 'Urheberangabe auf der Dateiseite',
    changes: image.changes || 'für die Anzeige technisch skaliert',
  };
}
