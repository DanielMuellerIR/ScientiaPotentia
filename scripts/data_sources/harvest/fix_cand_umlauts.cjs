/**
 * Deterministischer ASCII->Umlaut-Fixer für die Kandidatendateien.
 *
 * Einige Finder-Agenten lieferten ASCII-Deutsch (fuer/ueber/Domaene …) trotz
 * Vorgabe. Dieser Fixer korrigiert NUR echte deutsche Wörter in ANZEIGE-Feldern
 * (name, funFact, verifyNote, sourceName + String-Attributwerte) anhand einer
 * handkuratierten Wort-Liste. Bewusst NICHT angefasst: id, sourceUrl, image*
 * (dort ist ASCII gewollt/erforderlich). Korrekte ss-Wörter (dass, Klasse,
 * Prozess, Masse) und Eigennamen/Englisch (Queue, Quelle, Becquerel, Sauerstoff)
 * stehen NICHT in der Liste und bleiben unberührt.
 *
 * Aufruf: node scripts/data_sources/harvest/fix_cand_umlauts.cjs [--write]
 */
const fs = require('node:fs');
const path = require('node:path');
const { readJsonArray, writeJsonAtomic } = require('./json_io.cjs');

const HARVEST = __dirname;
const flags = process.argv.slice(2);
const allowedFlags = new Set(['--write', '--dry-run']);
if (flags.some(flag => !allowedFlags.has(flag))
    || (flags.includes('--write') && flags.includes('--dry-run'))) {
  console.error('Aufruf: fix_cand_umlauts.cjs [--write]');
  process.exit(1);
}
const WRITE = flags.includes('--write');

// Felder, in denen Deutsch erwartet wird (Anzeige/Provenance). id/url/image* NICHT.
const TEXT_FIELDS = new Set(['name', 'funFact', 'verifyNote', 'sourceName']);

// Handkuratierte Ersetzungen (Token wie gefunden -> korrekt). Reihenfolge: längere
// Komposita vor kürzeren Bestandteilen (Wortgrenzen schützen zwar, aber sicher ist sicher).
const MAP = [
  ['Ausfuehrungsgeschwindigkeit', 'Ausführungsgeschwindigkeit'],
  ['Ausfuehrung', 'Ausführung'],
  ['Datenwissenschaftsdomaene', 'Datenwissenschaftsdomäne'],
  ['Einbettungsdomaene', 'Einbettungsdomäne'],
  ['Geschaeftsdatenverarbeitung', 'Geschäftsdatenverarbeitung'],
  ['Nebenlaeufigkeit', 'Nebenläufigkeit'],
  ['Maschinennaehe', 'Maschinennähe'],
  ['plattformuebergreifende', 'plattformübergreifende'],
  ['hochverfuegbare', 'hochverfügbare'],
  ['hauptsaechlich', 'hauptsächlich'], ['Hauptsaechlich', 'Hauptsächlich'],
  ['Einfuehrung', 'Einführung'], ['eingefuehrt', 'eingeführt'],
  ['Domaene', 'Domäne'], ['domaene', 'domäne'],
  ['kuenstlichen', 'künstlichen'], ['kuenstliche', 'künstliche'], ['kuenstlich', 'künstlich'], ['Kuenstliche', 'Künstliche'],
  ['ueberwiegend', 'überwiegend'],
  ['urspruenglich', 'ursprünglich'], ['Urspruenglich', 'Ursprünglich'],
  ['unterstuetzt', 'unterstützt'],
  ['unabhaengig', 'unabhängig'], ['Unabhaengig', 'Unabhängig'],
  ['verfuegbar', 'verfügbar'],
  ['hoehere', 'höhere'], ['Hoehere', 'Höhere'],
  ['haeufig', 'häufig'], ['Haeufig', 'Häufig'],
  ['laeuft', 'läuft'],
  ['gewaehlt', 'gewählt'],
  ['gueltiges', 'gültiges'], ['gueltige', 'gültige'],
  ['fuehrte', 'führte'], ['Fuehrte', 'Führte'],
  ['erklaerte', 'erklärte'],
  ['aeltesten', 'ältesten'],
  ['primaere', 'primäre'], ['Primaere', 'Primäre'],
  ['fruehe', 'frühe'], ['Fruehe', 'Frühe'],
  ['Fruehmittelalter', 'Frühmittelalter'],
  ['Anaesthesie', 'Anästhesie'], ['anaesthesie', 'anästhesie'],
  ['Aufklaerung', 'Aufklärung'], ['aufklaerung', 'aufklärung'],
  ['Gluehlampe', 'Glühlampe'],
  ['Kuehlschrank', 'Kühlschrank'],
  ['Naehmaschine', 'Nähmaschine'],
  ['Roentgenstrahlen', 'Röntgenstrahlen'], ['Roentgen', 'Röntgen'],
  ['Suedpol', 'Südpol'],
  ['Grossteil', 'Großteil'],
  ['groessere', 'größere'], ['groesste', 'größte'], ['groesser', 'größer'],
  ['Groesste', 'Größte'],
  ['grosser', 'großer'], ['grosse', 'große'], ['Grosse', 'Große'],
  ['fuer', 'für'], ['Fuer', 'Für'],
  ['ueber', 'über'], ['Ueber', 'Über'],
];

const COMPILED = MAP.map(([w, r]) => [new RegExp(`\\b${w}\\b`, 'g'), r, w]);

function fixString(s, counter) {
  let out = s;
  for (const [re, r, w] of COMPILED) {
    out = out.replace(re, () => { counter[w] = (counter[w] || 0) + 1; return r; });
  }
  return out;
}

function fixConcept(c, counter) {
  for (const k of Object.keys(c)) {
    if (k === 'attributes') {
      const a = c.attributes;
      if (a && typeof a === 'object' && !Array.isArray(a)) {
        for (const ak of Object.keys(a)) {
          if (typeof a[ak] === 'string') a[ak] = fixString(a[ak], counter);
        }
      }
    } else if (TEXT_FIELDS.has(k) && typeof c[k] === 'string') {
      c[k] = fixString(c[k], counter);
    }
  }
  return c;
}

const files = fs.readdirSync(HARVEST)
  .filter(file => /^cand_[a-z]+_.*\.json$/.test(file))
  .sort((a, b) => a.localeCompare(b, 'de'));
const candidates = [];
try {
  for (const file of files) {
    candidates.push({
      file,
      path: path.join(HARVEST, file),
      data: readJsonArray(path.join(HARVEST, file), file),
    });
  }
} catch (error) {
  console.error(`FEHLER: ${error.message}`);
  process.exit(1);
}
let grandTotal = 0;
for (const { file, path: filePath, data } of candidates) {
  const counter = {};
  data.forEach(c => fixConcept(c, counter));
  const total = Object.values(counter).reduce((a, b) => a + b, 0);
  grandTotal += total;
  if (total) console.log(`${file}: ${total} Ersetzungen`, counter);
  if (WRITE && total) writeJsonAtomic(filePath, data);
}
console.log(`\nGesamt: ${grandTotal} Ersetzungen${WRITE ? '' : ' (DRY-RUN, nichts geschrieben)'}`);
