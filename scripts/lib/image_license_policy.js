/** Gemeinsame Positivliste für veröffentlichte und neu geerntete Bilder. */

const CC_VERSION = '(?:1\\.0|2\\.0|2\\.1|2\\.5|3\\.0|4\\.0)';
// Nur Länderfassungen, die im kuratierten Bestand tatsächlich vorkommen. Ein
// freier Suffix würde auch die Lizenzbestandteile NC/ND und Fantasiewerte als
// vermeintliche Rechtsordnung akzeptieren.
const CC_JURISDICTIONS = new Set([
  'at', 'ch', 'cz', 'de', 'es', 'fr', 'igo', 'it', 'jp', 'kr', 'nl', 'pl', 'us',
]);
const CC_LABEL = new RegExp(`^CC\\s+BY(?:-SA)?\\s+(${CC_VERSION})(?:\\s+([a-z]{2,3}))?$`, 'i');
const RESTRICTED_METADATA =
  /\b(?:nc|nd|non[- ]?commercial|noncommercial|no[- ]?deriv(?:ative)?s?|all rights(?: reserved)?)\b/i;

function metadataValue(metadata, key) {
  return String(metadata?.[key]?.value ?? '').trim();
}

/** Nur eine eindeutige Eigenwerk-Freigabe vor getrennten Motiv-Rechteangaben. */
export function ownWorkLicenseFromWikitext(wikitext) {
  const text = String(wikitext || '');
  const sections = text.split(/==\s*\{\{int:license-header\}\}\s*==/i);
  if (sections.length !== 2) return null;
  const block = sections[1].split(/\n\s*(?:={2,}|;|\[\[Category:)/i)[0];
  const template = block.trim().match(/^\{\{self\s*\|([^{}]+)\}\}$/i);
  if (!template) return null;
  const labels = template[1].split('|').map(value => {
    const name = value.trim();
    if (/^gfdl$/i.test(name)) return 'GFDL';
    const cc = name.match(/^cc-(by(?:-sa)?)-(1\.0|2\.0|2\.1|2\.5|3\.0|4\.0)$/i);
    return cc ? `CC ${cc[1].toUpperCase()} ${cc[2]}` : null;
  });
  if (labels.some(label => !label || !isAllowedImageLicense(label))) return null;
  return labels.find(label => label.startsWith('CC ')) || labels[0] || null;
}

export function isAllowedImageLicense(label) {
  const license = String(label || '').trim();
  if (RESTRICTED_METADATA.test(license)) return false;
  if (/^Public domain$/i.test(license)) return true;
  if (/^CC0(?:\s+1\.0)?$/i.test(license)) return true;
  const creativeCommons = license.match(CC_LABEL);
  if (creativeCommons) {
    const jurisdiction = creativeCommons[2]?.toLowerCase();
    return !jurisdiction || CC_JURISDICTIONS.has(jurisdiction);
  }
  return /^(?:FAL|GFDL(?:\s+(?:1\.2|1\.3))?|Attribution|Copyrighted free use)$/i
    .test(license);
}

/**
 * Liefert genau die Bezeichnung, die später auch das Veröffentlichungs-Audit
 * akzeptiert. Commons-spezifische PD-Vorlagen werden nur dann auf „Public
 * domain“ vereinheitlicht, wenn Commons sie ausdrücklich als nicht
 * urheberrechtlich geschützt kennzeichnet.
 */
export function licenseNameFromCommonsMetadata(metadata) {
  const shortName = metadataValue(metadata, 'LicenseShortName')
    || metadataValue(metadata, 'License');
  if (isAllowedImageLicense(shortName)) return shortName;

  const licenseUrl = metadataValue(metadata, 'LicenseUrl');
  const blob = `${shortName} ${licenseUrl}`.toLowerCase();
  if (/creativecommons\.org\/publicdomain\/zero\/1\.0/.test(blob)) return 'CC0 1.0';

  const creativeCommons = licenseUrl.match(
    /creativecommons\.org\/licenses\/(by(?:-sa)?)\/(1\.0|2\.0|2\.1|2\.5|3\.0|4\.0)(?:\/([a-z]{2,3}))?/i,
  );
  if (creativeCommons) {
    const family = creativeCommons[1].toLowerCase() === 'by-sa' ? 'BY-SA' : 'BY';
    const jurisdiction = creativeCommons[3] ? ` ${creativeCommons[3].toLowerCase()}` : '';
    const label = `CC ${family} ${creativeCommons[2]}${jurisdiction}`;
    return isAllowedImageLicense(label) ? label : (shortName || '?');
  }

  // Commons kennzeichnet gemeinfreie Werke auch mit dem Public Domain Mark
  // (Kurzname „PDM-owner“, gesetzt vom Rechteinhaber). Der Kurzname enthält
  // weder „public domain“ noch eine Lizenz-URL — erkennbar ist er nur an sich
  // selbst und an der Nutzungsbedingung. Belegt am Porträt Carl Gustav Jung
  // der ETH-Bibliothek, das der Gegencheck sonst als unfrei aussortierte.
  const publicDomainMark = /^pdm(?:$|[\s-])/i.test(shortName)
    || /public domain mark/i.test(metadataValue(metadata, 'UsageTerms'));
  const publicDomain = publicDomainMark
    || metadataValue(metadata, 'Copyrighted').toLowerCase() === 'false'
    || /public domain|creativecommons\.org\/publicdomain|^pd(?:\b|-)/i.test(blob);
  if (publicDomain) return 'Public domain';

  return shortName || '?';
}

/** Prüft Commons-extmetadata mit derselben Positivliste wie das Release-Audit. */
export function isAllowedCommonsLicenseMetadata(metadata) {
  const blob = [
    metadataValue(metadata, 'LicenseShortName'),
    metadataValue(metadata, 'License'),
    metadataValue(metadata, 'LicenseUrl'),
    metadataValue(metadata, 'UsageTerms'),
  ].join(' ');
  if (RESTRICTED_METADATA.test(blob)) return false;
  return isAllowedImageLicense(licenseNameFromCommonsMetadata(metadata));
}

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
  const creativeCommons = license.match(
    /^CC\s+BY(-SA)?(?:\s+([0-9.]+))?(?:\s+([a-z]+))?$/i,
  );
  if (creativeCommons) {
    const family = creativeCommons[1] ? 'by-sa' : 'by';
    const version = creativeCommons[2];
    const jurisdiction = creativeCommons[3]?.toLowerCase();
    if (!version || !isAllowedImageLicense(license)) return '';
    return `https://creativecommons.org/licenses/${family}/${version}/${jurisdiction ? `${jurisdiction}/` : ''}`;
  }
  if (lower === 'fal') return 'https://artlibre.org/licence/lal/en/';
  if (lower === 'gfdl 1.2') return 'https://www.gnu.org/licenses/old-licenses/fdl-1.2.html';
  if (lower.startsWith('gfdl')) return 'https://www.gnu.org/licenses/fdl-1.3.html';
  if (lower === 'attribution') {
    return 'https://commons.wikimedia.org/wiki/Template:Attribution';
  }
  if (lower === 'copyrighted free use') {
    return 'https://commons.wikimedia.org/wiki/Template:Copyrighted_free_use';
  }
  return '';
}
