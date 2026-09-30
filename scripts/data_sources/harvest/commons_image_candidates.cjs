const { commonsAttribution } = require('./credit_text.cjs');
const { isBlacklistedFile } = require('./image_resolution_policy.cjs');
const { isAllowedCommonsLicenseMetadata, licenseNameFromCommonsMetadata } = require('../../lib/image_license_policy.js');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/svg+xml', 'image/gif', 'image/webp']);

/** Bündelt und cached die Rechteprüfung, bevor ein Quellenweg den nächsten verdrängt. */
function createCommonsLookup(getJson) {
  const cache = new Map();
  async function acceptFiles(files) {
    const { hasPublishableAttribution, sanitizeImageAttribution } = await import('../../../src/utils/imageCredits.js');
    const missing = [...new Set(files)].filter(file => !cache.has(file));
    for (let i = 0; i < missing.length; i += 50) {
      const group = missing.slice(i, i + 50);
      const params = new URLSearchParams({ action: 'query', format: 'json', prop: 'imageinfo',
        iiprop: 'extmetadata|mime', iiextmetadatalanguage: 'de', maxlag: '5', titles: group.map(file => 'File:' + file).join('|') });
      const payload = await getJson(`https://commons.wikimedia.org/w/api.php?${params}`);
      const aliases = new Map((payload.query?.normalized || []).map(row => [row.from, row.to]));
      const pages = new Map(Object.values(payload.query?.pages || {}).map(page => [page.title, page]));
      for (const file of group) {
        const title = aliases.get('File:' + file) || 'File:' + file;
        const page = pages.get(title);
        const info = page?.imageinfo?.[0];
        const metadata = info?.extmetadata || {};
        const license = licenseNameFromCommonsMetadata(metadata);
        const attribution = sanitizeImageAttribution(commonsAttribution(metadata));
        const allowed = page && !('missing' in page) && ALLOWED_MIME.has(info?.mime)
          && !isBlacklistedFile(file) && !isBlacklistedFile(title)
          && Boolean(attribution) && isAllowedCommonsLicenseMetadata(metadata) && hasPublishableAttribution(license, attribution);
        cache.set(file, allowed ? {
          imageFile: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
          imageLicense: license, imageAttribution: attribution,
        } : null);
      }
    }
    return new Set(files.filter(file => cache.get(file)));
  }
  return { acceptFiles, get: file => cache.get(file) };
}
module.exports = { createCommonsLookup };
