/** Gemeinsame Positivliste für veröffentlichte und neu geerntete Bilder. */

const CC_VERSION = '(?:1\\.0|2\\.0|2\\.1|2\\.5|3\\.0|4\\.0)';
const CC_LABEL = new RegExp(
  `^CC\\s+BY(?:-SA)?\\s+${CC_VERSION}(?:\\s+[a-z]{2,3})?$`,
  'i',
);
const RESTRICTED_METADATA =
  /\b(?:nc|nd|non[- ]?commercial|noncommercial|no[- ]?deriv(?:ative)?s?|all rights(?: reserved)?)\b/i;

function metadataValue(metadata, key) {
  return String(metadata?.[key]?.value ?? '').trim();
}

export function isAllowedImageLicense(label) {
  const license = String(label || '').trim();
  if (/^Public domain$/i.test(license)) return true;
  if (/^CC0(?:\s+1\.0)?$/i.test(license)) return true;
  if (CC_LABEL.test(license)) return true;
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
    return `CC ${family} ${creativeCommons[2]}${jurisdiction}`;
  }

  const publicDomain = metadataValue(metadata, 'Copyrighted').toLowerCase() === 'false'
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
    if (!version) return '';
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
