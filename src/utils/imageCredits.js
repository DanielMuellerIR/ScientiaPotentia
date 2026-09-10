import { decodeHTML } from 'entities';
import {
  isAllowedImageLicense,
  licenseUrlFor,
} from '../../scripts/lib/image_license_policy.js';
import { isWikimediaCommonsUrl } from './commonsImage.js';

export { isAllowedImageLicense, licenseUrlFor };

/**
 * Commons-Rechtetext, der hinter dem eigentlichen Urheber steht: Genehmigungs-
 * hinweise, Danksagungen und Lizenzbausteine. Sie gehören nicht in die
 * Namensnennung — 60 veröffentlichte Bildnachweise bestanden ab der zweiten
 * Zeile aus solchem Text („Permission details / ACKNOWLEDGMENT FOR
 * PUBLICATIONS / All refereed publications …", CodeQA 2026-09-03).
 */
const CREDIT_BOILERPLATE =
  /\s*(?:Permission\s+details|Acknowledge?ments?|You\s+are\s+free|This\s+file\s+is\s+licensed|Licensing)\b[\s\S]*$/i;

/** Entfernt HTML und private Kontaktadressen aus Commons-Metadaten. */
export function sanitizeImageAttribution(value) {
  return decodeHTML(String(value || ''))
    .replace(/<br\s*\/?\s*>/gi, ' / ')
    // Zeilenumbrüche zuerst: Vier der fünf Bild-Auflöser vereinheitlichen den
    // Whitespace selbst, resolve_images_batched.cjs tat es nicht — dadurch
    // standen mehrzeilige Textblöcke im Bildnachweis.
    .replace(/\s+/g, ' ')
    .replace(CREDIT_BOILERPLATE, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/\bmailto:\s*/gi, '')
    .replace(/\b(Unknown (?:author|artist|creator|source))\s*\1\b/gi, '$1')
    .replace(/\bUnknown\s*Unknown\b/gi, 'Unknown')
    // Commons ist der Fundort, nicht Teil des Urhebernamens. Die separate
    // Quellenverknüpfung zeigt ihn direkt neben der Attribution ohnehin an.
    .replace(/\s*(?:\/|·|,)\s*Wikimedia Commons\s*$/i, '')
    .replace(/\(\s*\)/g, '')
    // Nur ein LEERES Segment zwischen zwei Trennern zusammenziehen — also mit
    // Leerzeichen dazwischen, wie es nach dem Entfernen von „Wikimedia
    // Commons" oder leeren Klammern entsteht. Ohne diese Bedingung traf die
    // Regel jedes „http://" im Credit und machte daraus „http: /":
    // 333 veröffentlichte Urhebernachweise trugen einen toten Quelllink
    // (CodeQA 2026-09-03).
    .replace(/\s*\/\s+\/\s*/g, ' / ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s/·,;-]+|[\s/·,;-]+$/g, '')
    .trim();
}

/** Erkennt eine konkrete Person oder Organisation statt eines Kontakt-/Hinweisrests. */
export function isConcreteImageAttribution(value) {
  const attribution = sanitizeImageAttribution(value);
  if (!attribution) return false;
  // Ein technischer Quellenrest benennt keinen Urheber. Insbesondere können
  // fehlerhafte Commons-Metadaten aus URL, DOI und einem fremden Dateititel
  // bestehen und dürfen das Veröffentlichungs-Audit nicht passieren.
  if (/^(?:https?:|(?:https?:\s*\/)|doi(?:\.org|:)|(?:file|datei):|(?:source|quelle)\s*:)/i
    .test(attribution)) return false;
  return !/^(?:wikimedia commons|commons|unknown(?: (?:author|artist|creator|source))?|unbekannt|own work|self|none|n\/a|urheber nicht angegeben(?:\b.*)?|please (?:report|contact|notify)\b.*|(?:report|contact) (?:references?|the author)\b.*)[\s.!,:;-]*$/i
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

/**
 * Reichen Lizenz und Urheberangabe zusammen für eine Veröffentlichung?
 *
 * Die Regel steht bewusst nur hier: Der Release-Audit
 * (`scripts/audit_image_credits.mjs`) und der Preflight der Bildernte
 * (`scripts/data_sources/harvest/apply_images.cjs`) prüfen dieselbe Bedingung.
 * Liefen sie auseinander, nähme der Preflight einen Eintrag an, den der Build
 * später ablehnt — und zwar für die ganze Domain. Genau das passierte am
 * 2026-09-03 mit dem Urheber „Own work." aus dem Homo-Lauf.
 *
 * Gemeinfreie Werke brauchen keine Namensnennung; „Wikimedia Commons" ist
 * jedoch auch dort kein Urheber, sondern der Fundort — und genau diesen
 * Rückfallwert setzen die Auflöser.
 *
 * @param {string} license        Lizenzbezeichnung, etwa „CC BY 4.0".
 * @param {string} rawAttribution Urheberangabe, roh wie aus Commons.
 */
export function hasPublishableAttribution(license, rawAttribution) {
  const attribution = sanitizeImageAttribution(rawAttribution);
  const attributionRequired = !/^(?:Public domain|PD\b|CC0\b)/i.test(String(license || ''));
  const genericCommonsCredit = /^(?:Wikimedia Commons|Commons)$/i.test(attribution);
  if (!attributionRequired && !genericCommonsCredit) return true;
  return isConcreteImageAttribution(attribution);
}

/**
 * Änderungshinweis für den Bildnachweis.
 *
 * CC BY und CC BY-SA verlangen die Angabe, ob das Werk verändert wurde. Seit
 * das Projekt eigene Kopien ausliefert, steht die Antwort fest: Ein unverändert
 * übernommenes Original ist eben nicht skaliert, und „technisch skaliert" wäre
 * dort schlicht falsch.
 *
 * @param {'original'|'resized'|undefined} mirrorMode Modus aus dem Bildmanifest.
 */
export function changeNoteFor(mirrorMode) {
  return mirrorMode === 'original'
    ? 'unverändert übernommen'
    : 'für die Anzeige technisch skaliert';
}

/**
 * Ergänzt ältere Concept-JSONs defensiv um ableitbare Credit-Felder.
 *
 * @param {object} image      Bildmetadaten aus dem Konzeptdatensatz.
 * @param {string} [mirrorMode] Modus der lokalen Kopie; bestimmt den Änderungshinweis.
 */
export function normaliseImageCredit(image, mirrorMode) {
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
    // Der Modus der eigenen Kopie sticht den im Katalog gespeicherten Hinweis:
    // Er beschreibt, was mit der ausgelieferten Datei wirklich geschehen ist.
    changes: mirrorMode
      ? changeNoteFor(mirrorMode)
      : (image.changes || changeNoteFor()),
  };
}
