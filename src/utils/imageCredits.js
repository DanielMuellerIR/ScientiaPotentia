import { decodeHTML } from 'entities';
import imageLicensePolicy from '../../scripts/lib/image_license_policy.cjs';
import { isWikimediaCommonsUrl } from './commonsImage.js';

const {
  isAllowedImageLicense,
  licenseUrlFor,
} = imageLicensePolicy;

export { isAllowedImageLicense, licenseUrlFor };

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
