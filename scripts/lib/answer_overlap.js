import { norm } from './generator_text.js';
import { isSpecificAnswer } from './audit_rules.cjs';

export function isSpecificQuoteWork(concept) {
  const work = String(concept.attributes?.work || '').trim();
  if (!work || !isSpecificAnswer(work)) return false;
  if (/^(?:Dramen|Briefe und Gespräche|Briefe, Gedichte, Sonstige)$/i.test(work)) return false;
  // Im Zitatkatalog bezeichnet Hebbels „Gedichte“ eine Sammelrubrik.
  // Gleichnamige konkrete Gedichtbände anderer Autoren bleiben zulässig.
  if (work === 'Gedichte' && concept.attributes.author === 'Friedrich Hebbel') return false;
  const author = norm(String(concept.attributes.author || '').replace(/\([^)]*\)/g, ''));
  const title = norm(work.replace(/\(\s*\d{4}\s*[-–]\s*\d{4}\s*\)/g, ''));
  return !author || title !== author;
}
export function artworkEraConflict(a, b) {
  const canonical = value => {
    const n = norm(value);
    if (/^(?:barock(?: goldenes zeitalter (?:der )?niederlande)?|hollandisches goldenes zeitalter|goldenes zeitalter der niederlande)$/.test(n)) return 'barock';
    return n;
  };
  const parts = value => String(value).split('/').map(canonical);
  return parts(a).some(part => parts(b).includes(part));
}
export function calendarDateConflict(a, b) {
  const parse = value => {
    const match = String(value).trim().match(/^(\d{1,2})\.(?:\s*[/–-]\s*(\d{1,2})\.)?\s+([A-Za-zÄÖÜäöü]+)$/);
    return match ? { month: norm(match[3]), lower: +match[1], upper: +(match[2] || match[1]) } : null;
  };
  const left = parse(a), right = parse(b);
  return left && right && left.month === right.month && left.lower <= right.upper && right.lower <= left.upper;
}
export function agencyConflict(a, b) {
  const aliases = {
    'national aeronautics and space administration': 'NASA',
    'jet propulsion laboratory': 'JPL',
    'european space agency': 'ESA',
    'europaische weltraumorganisation': 'ESA',
    'china national space administration': 'CNSA',
  };
  const tokens = value => String(value).split('/').map(part => {
    const key = norm(part);
    return aliases[key] || part.trim().toUpperCase();
  });
  const left = tokens(a), right = tokens(b);
  return left.some(part => right.includes(part)) || (left.includes('JPL') && right.includes('NASA')) || (right.includes('JPL') && left.includes('NASA'));
}
