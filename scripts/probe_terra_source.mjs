import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

/** Prüft einen mledoze-Snapshot, ohne produktive Terra-Dateien zu schreiben. */
export function probeTerraSource(countries, requiredCodes) {
  if (!Array.isArray(countries) || !countries.length) throw new Error('Nicht leeres Länderarray erwartet');
  const codes = countries.map(country => country.cca2);
  if (codes.some(code => !/^[A-Z]{2}$/.test(code)) || new Set(codes).size !== codes.length) {
    throw new Error('Ungültige oder doppelte Länderkennungen');
  }
  const fields = {
    name: c => Boolean(c.translations?.deu?.common || c.name?.common),
    capital: c => Array.isArray(c.capital) && c.capital.some(Boolean),
    population: c => Number.isFinite(c.population) && c.population >= 0,
    area: c => Number.isFinite(c.area) && c.area >= 0,
    tld: c => Array.isArray(c.tld) && c.tld.some(Boolean),
    callingCode: c => Boolean(c.idd?.root && c.idd?.suffixes?.length),
    timezones: c => Array.isArray(c.timezones) && c.timezones.some(Boolean),
    currencyCodes: c => Object.keys(c.currencies || {}).some(Boolean),
    currencyNames: c => !Array.isArray(c.currencies) && Object.values(c.currencies || {}).some(value => value?.name),
    flag: c => Boolean(c.flag),
  };
  const coverage = Object.fromEntries(Object.entries(fields).map(([field, present]) =>
    [field, countries.filter(present).length]));
  const missingCodes = [...requiredCodes].filter(code => !codes.includes(code)).sort();
  return { countries: countries.length, requiredCountries: requiredCodes.size, missingCodes, coverage,
    directReplacement: missingCodes.length === 0 && Object.values(coverage).every(count => count === countries.length) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = process.argv[2];
  if (!input) throw new Error('Aufruf: node scripts/probe_terra_source.mjs SNAPSHOT.json [QUELL-URL]');
  const bytes = await readFile(input);
  const geodb = JSON.parse(await readFile(new URL('../src/data/geodb.json', import.meta.url), 'utf8'));
  const codes = new Set(Object.values(geodb.entities).filter(entity => entity.type === 'country').map(entity => entity.id));
  console.log(JSON.stringify({ source: process.argv[3] || null,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    ...probeTerraSource(JSON.parse(bytes), codes) }, null, 2));
}
