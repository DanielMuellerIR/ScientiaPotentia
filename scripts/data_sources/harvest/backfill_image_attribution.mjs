#!/usr/bin/env node

/**
 * Ergänzt fehlende Urheberangaben aus Wikimedia Commons und entfernt
 * Kontaktadressen aus vorhandenen Credit-Texten.
 *
 * Aufruf: node scripts/data_sources/harvest/backfill_image_attribution.mjs
 */
import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isConcreteImageAttribution,
  sanitizeImageAttribution,
} from '../../../src/utils/imageCredits.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(SCRIPT_DIR, '..');
const DOMAINS = ['astra', 'cultura', 'historia', 'homo', 'lingua', 'machina', 'natura'];
const USER_AGENT = 'ScientiaImageCreditBackfill/1.0 (public educational project)';
const KNOWN_CREDITS = new Map([
  ['File:Post-It.jpg', 'Pavel Krok'],
  ['File:Algic langs.png', 'Ish Ishwar'],
  ['File:Salishan langs.png', 'Ish Ishwar'],
  ['File:Flash memory cards size.jpg', 'Wikimedia-Commons-Nutzer Xell'],
  ['File:Scheme of metal oxide semiconductor field-effect transistor.svg', 'Arne Nordmann'],
  ['File:Riesenbovist.jpg', 'Wikimedia-Nutzer Kettelring'],
  ['File:Acheta-domestica-1.jpg', 'Luis Fernández García'],
  ['File:XN Haematopota pluvialis 00 cropped.jpg', 'Guido Gerding / Luis Fernández García'],
  ['File:DianeJLH.jpg', 'Jean-Laurent Hentz'],
]);

function commonsTitle(imageUrl) {
  try {
    const url = new URL(imageUrl);
    if (url.hostname !== 'commons.wikimedia.org') return '';
    const marker = '/wiki/';
    const index = url.pathname.indexOf(marker);
    if (index < 0) return '';
    const title = decodeURIComponent(url.pathname.slice(index + marker.length));
    return /^(File|Datei):/i.test(title) ? title.replace(/^Datei:/i, 'File:') : '';
  } catch {
    return '';
  }
}

function chunks(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => (
    items.slice(index * size, (index + 1) * size)
  ));
}

function cleanWikiCredit(value) {
  return sanitizeImageAttribution(String(value || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\{\{Creator:([^}|]+)[^}]*\}\}/gi, '$1')
    .replace(/\[\[:?(?:[a-z-]+:)?(?:User|Benutzer):([^|\]]+)\|([^\]]+)\]\]/gi, '$2')
    .replace(/\[\[:?(?:[a-z-]+:)?(?:User|Benutzer):([^\]]+)\]\]/gi, '$1')
    .replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[(?:https?:\/\/\S+)\s+([^\]]+)\]/g, '$1')
    .replace(/\{\{[^{}]*\}\}/g, ' ')
    .replace(/'{2,}/g, ' ')
    .replace(/&nbsp;/gi, ' '));
}

function wikiCredit(wikitext, uploadUser, license) {
  const lines = String(wikitext || '').split('\n');
  for (const line of lines) {
    const field = line.match(/^\s*[*#|]?\s*(?:author|autor|auteur|artist|photographer|fotograf)\s*[:=]\s*(.+)$/i);
    const phrase = line.match(/(?:picture taken by|photo(?:graph)?(?: was)? taken by|photo(?:graph)?(?:ed)? by|foto (?:realizada )?por|fotograf(?:iert)? von)\s*:?\s*(.+)$/i);
    const copyright = line.match(/^\s*©\s*(.+)$/);
    const courtesy = line.match(/^\s*Courtesy\s*:\s*(.+)$/i);
    const candidate = cleanWikiCredit(field?.[1] || phrase?.[1] || copyright?.[1] || courtesy?.[1]);
    if (candidate && !/^(?:unknown|unbekannt|own work|self|none|n\/a)$/i.test(candidate)) return candidate;
  }

  const creator = wikitext.match(/\{\{Creator:([^}|]+)[^}]*\}\}/i)?.[1];
  if (creator) return cleanWikiCredit(creator);

  const takenByMe = wikitext.match(/taken by me,\s*([^,."\n]+)/i)
    || wikitext.match(/taken by myself\s*\(([^)]+)\)/i);
  if (takenByMe) return cleanWikiCredit(takenByMe[1]);

  const namedUser = wikitext.match(/\[\[:?(?:[a-z-]+:)?(?:User|Benutzer):([^|\]]+)(?:\|([^\]]+))?\]\]/i);
  if (namedUser && /(?:picture|photo|foto|author|artist|creator|photograph)/i.test(wikitext)) {
    return cleanWikiCredit(namedUser[2] || namedUser[1]);
  }

  if (/(?:\bown work\b|\bown photo\b|\bself-photographed\b|\b(?:photo)?graphed by myself\b|\btaken by myself\b|\bi created this image\b|\beigenes werk\b|\bselbst fotografiert\b|\bselbst erstellt\b|\{\{(?:Self[|}]|own\b))/i.test(wikitext)
      && uploadUser) {
    return `Wikimedia-Commons-Nutzer ${sanitizeImageAttribution(uploadUser)}`;
  }
  if (/\{\{Picswiss\b/i.test(wikitext)) return 'Schweizerisches Bundesarchiv (Picswiss)';
  if (/PD-USGov-NASA|NASA\/JPL/i.test(wikitext)) return 'NASA';
  if (/PD-USGov-USGS|U\.S\. Geological Survey/i.test(wikitext)) return 'U.S. Geological Survey';
  if (/PD-USGov-NOAA/i.test(wikitext)) return 'NOAA';
  if (/public domain/i.test(license) && uploadUser) {
    return `Urheber nicht angegeben (gemeinfrei; Upload: ${sanitizeImageAttribution(uploadUser)})`;
  }
  return '';
}

function metadataCredit(metadata, wikitext, uploadUser, license) {
  const primaryValues = [
    metadata?.Attribution?.value,
    metadata?.Artist?.value,
  ];
  const primary = primaryValues
    .map(sanitizeImageAttribution)
    .find(isConcreteImageAttribution);
  if (primary) return primary;

  // „Credit“ enthält auf Commons häufig nur die Fundstelle. Bei als eigenes
  // Werk markierten Dateien ist der Upload-Nutzer der belastbarere Urheber.
  const fromWikitext = wikiCredit(wikitext, uploadUser, license);
  if (fromWikitext) return fromWikitext;
  const fallbackCredit = sanitizeImageAttribution(metadata?.Credit?.value);
  return isConcreteImageAttribution(fallbackCredit) ? fallbackCredit : '';
}

function attributionNeedsLookup(value, license) {
  const credit = sanitizeImageAttribution(value);
  if (!credit) return true;
  const attributionRequired = !/^(?:Public domain|PD\b|CC0\b)/i.test(String(license || ''));
  return attributionRequired && !isConcreteImageAttribution(credit);
}

async function fetchMetadata(titles) {
  const result = new Map();
  for (const group of chunks(titles, 50)) {
    const params = new URLSearchParams({
      action: 'query',
      prop: 'imageinfo|revisions',
      iiprop: 'extmetadata|user',
      rvprop: 'content',
      rvslots: 'main',
      redirects: '1',
      format: 'json',
      formatversion: '2',
      titles: group.join('|'),
    });
    let response;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (response.ok) break;
      if (response.status !== 429 || attempt === 3) {
        throw new Error(`Commons API antwortet mit HTTP ${response.status}`);
      }
      const retryAfter = Math.min(Number(response.headers.get('retry-after')) || (attempt + 1) * 2, 15);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    }
    const payload = await response.json();
    const normalised = new Map((payload.query?.normalized || []).map(({ from, to }) => [from, to]));
    const redirects = new Map((payload.query?.redirects || []).map(({ from, to }) => [from, to]));
    const pages = new Map((payload.query?.pages || []).map((page) => [page.title, page]));

    for (const requested of group) {
      const canonical = redirects.get(normalised.get(requested) || requested)
        || normalised.get(requested)
        || requested;
      const page = pages.get(canonical);
      const metadata = page?.imageinfo?.[0]?.extmetadata || {};
      const license = String(metadata.LicenseShortName?.value || metadata.License?.value || '');
      const wikitext = page?.revisions?.[0]?.slots?.main?.content || '';
      const uploadUser = page?.imageinfo?.[0]?.user || '';
      result.set(requested, {
        credit: KNOWN_CREDITS.get(canonical)
          || metadataCredit(metadata, wikitext, uploadUser, license),
        license,
      });
    }
  }
  return result;
}

const domainData = new Map();
const missingTitles = new Set();
for (const domain of DOMAINS) {
  const file = join(DATA_DIR, `${domain}_raw.json`);
  const records = JSON.parse(await readFile(file, 'utf8'));
  domainData.set(domain, { file, records });
  for (const concept of records) {
    if (!concept.imageFile) continue;
    const cleaned = sanitizeImageAttribution(concept.imageAttribution);
    if (attributionNeedsLookup(cleaned, concept.imageLicense)) {
      const title = commonsTitle(concept.imageFile);
      if (title) missingTitles.add(title);
    }
  }
}

console.log(`${missingTitles.size} Commons-Dateien ohne Urheberangabe werden abgefragt.`);
const metadata = await fetchMetadata([...missingTitles]);
let filled = 0;
let sanitised = 0;
const unresolved = [];

for (const [domain, { file, records }] of domainData) {
  let changed = false;
  for (const concept of records) {
    if (!concept.imageFile) continue;
    const previous = String(concept.imageAttribution || '');
    let next = sanitizeImageAttribution(previous);
    if (attributionNeedsLookup(next, concept.imageLicense)) {
      const title = commonsTitle(concept.imageFile);
      const remote = metadata.get(title);
      next = remote?.credit || '';
      if (!next) unresolved.push(`${domain}:${concept.id} (${remote?.license || concept.imageLicense || 'ohne Lizenz'})`);
      else filled += 1;
    }
    if (next !== previous) {
      concept.imageAttribution = next;
      changed = true;
      if (previous && next) sanitised += 1;
    }
  }
  if (changed) {
    const temporary = `${file}.tmp`;
    await writeFile(temporary, `${JSON.stringify(records, null, 2)}\n`);
    await rename(temporary, file);
  }
}

if (unresolved.length) {
  console.error(`Keine Urheberangabe für ${unresolved.length} Bilder:`);
  unresolved.slice(0, 20).forEach((item) => console.error(`- ${item}`));
  process.exitCode = 1;
} else {
  console.log(`${filled} Datensätze ergänzt, ${sanitised} vorhandene Credits bereinigt.`);
}
