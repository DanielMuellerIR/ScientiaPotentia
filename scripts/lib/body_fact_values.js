// Nur vollständige Zahlenangaben verstehen; Grenzen wie „unter 80“ lassen
// keinen einzelnen falschen Alternativwert zu und werden nicht numerisch befragt.
const numberPattern = '(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,\\d+)?';
const valuePattern = new RegExp(`^(ca\\.\\s*)?(${numberPattern})(?:\\s*(?:[-–]|bis)\\s*(${numberPattern}))?(?:\\s+(Billionen|Milliarden|Millionen))?$`, 'i');
const decimalPlaces = value => (String(value).match(/[,.](\d+)$/)?.[1] || '').length;
export function parseBodyFactValue(raw) {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0
      ? { lower: raw, upper: raw, range: false, approximate: false, scale: '', precision: decimalPlaces(raw) } : null;
  }
  const match = String(raw).trim().match(valuePattern);
  if (!match) return null;
  const parse = value => Number(value.replace(/\./g, '').replace(',', '.'));
  const lower = parse(match[2]), upper = match[3] ? parse(match[3]) : lower;
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower < 0 || upper < lower) return null;
  const precision = Math.max(...[match[2], match[3]].filter(Boolean).map(value => (value.split(',')[1] || '').length));
  return { lower, upper, range: Boolean(match[3]), approximate: Boolean(match[1]), scale: match[4] || '', precision };
}
export function formatBodyFactValue(value, unit = '') {
  const format = number => number.toLocaleString('de-DE', {
    minimumFractionDigits: value.precision, maximumFractionDigits: value.precision,
  });
  return `${value.approximate ? 'ca. ' : ''}${format(value.lower)}${value.range ? `–${format(value.upper)}` : ''}${value.scale ? ` ${value.scale}` : ''}${unit ? ` ${unit}` : ''}`;
}
// Diese Einheiten benennen einzelne Körperteile oder Zellen, keine Dichte.
// „Millionen pro Mikroliter“ bleibt dagegen eine kontinuierliche Messgröße.
const countUnits = new Set([
  'Knochen', 'Zähne', 'Chromosomen', 'Rippenpaare', 'Muskeln', 'Neuronen',
  'Geschmacksknospen', 'Haare', 'Drüsen', 'Alveolen', 'Gelenke', 'Nierenkörperchen',
  'Sehzellen', 'Stück', 'Stück/Tag', 'Zellen', 'proteincodierende Gene',
  'Paare', 'Rezeptortypen', 'Lappen',
]);
export function bodyFactOptions(raw, unit = '', seed = '') {
  let value = parseBodyFactValue(raw);
  if (value && countUnits.has(unit)) {
    if (!Number.isInteger(value.lower) || !Number.isInteger(value.upper)) return null;
    value = { ...value, precision: 0 };
  }
  const percentage = unit === '%';
  if (!value || value.precision > 20 || (!percentage && value.lower <= 0)
    || (percentage && (value.scale || value.upper > 100))) return null;
  // Die Faktenpräzision gilt für jede Option. Ganze Knochen bleiben ganz,
  // und ein Dezimalbereich verrät sich nicht durch ungerundete Alternativen.
  const round = number => Number(number.toFixed(value.precision));
  const quantum = 10 ** -value.precision;
  const hash = [...String(seed)].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  let alternatives;
  if (value.range) {
    const width = value.upper - value.lower;
    const step = width + Math.max(quantum, value.lower * 0.2, value.upper * 0.1);
    const lowerRange = value.lower > step
      ? { ...value, lower: value.lower - step, upper: value.upper - step }
      : { ...value, lower: value.lower * 0.25, upper: value.lower * 0.75 };
    alternatives = [lowerRange, ...[1, -2, 2, -3, 3, -4, 4].map(offset => ({
      ...value, lower: value.lower + offset * step, upper: value.upper + offset * step,
    }))];
  } else {
    const factors = hash % 2 ? [0.7, 1.4, 0.5, 1.8, 0.85, 1.2, 2] : [0.7, 1.4, 1.8, 0.5, 0.85, 1.2, 2];
    const numbers = factors.map(factor => value.lower * factor);
    // Am Prozent-Grenzwert 0 entstehen durch Multiplikation keine Alternativen.
    if (percentage) numbers.push(...[10, -10, 20, -20, 30, -30].map(offset => value.lower + offset));
    alternatives = numbers.map(lower => ({ ...value, lower, upper: lower }));
  }
  const chosen = [];
  for (const alternative of alternatives) {
    const candidate = { ...alternative, lower: round(alternative.lower), upper: round(alternative.upper) };
    if (!Number.isFinite(candidate.lower) || !Number.isFinite(candidate.upper)
      || candidate.lower < (percentage ? 0 : quantum) || candidate.upper < candidate.lower
      || (percentage && candidate.upper > 100)) continue;
    if ([value, ...chosen].some(other => candidate.lower <= other.upper && candidate.upper >= other.lower)) continue;
    chosen.push(candidate);
    if (chosen.length === 3) break;
  }
  if (chosen.length < 3) return null;
  return { correct: formatBodyFactValue(value, unit), distractors: chosen.map(candidate => formatBodyFactValue(candidate, unit)) };
}
