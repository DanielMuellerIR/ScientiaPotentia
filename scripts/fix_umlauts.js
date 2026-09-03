// Einmal-Helfer: ersetzt ASCII-Ersatzschreibungen deutscher Umlaute (ue/ae/oe/ss)
// durch echte Umlaute (ü/ä/ö/ß) in den Astra/Homo-Quelldaten und -Generatoren.
//
// WARUM kein blindes Suchen-Ersetzen: ue/ae/oe/ss kommen massenhaft in KORREKTEN
// Wörtern und Eigennamen vor (Fluss, Masse, Wasser, Mission, Quelle, Sauerstoff,
// dass, Russland, Puerto, Buenos …). Darum eine handkuratierte Wort-Liste echter
// Transliterationen und Ersatz nur als GANZES Token (Wortgrenzen über Nicht-
// Buchstaben). Eigennamen, korrekte ss-Wörter und lateinische Fachbegriffe stehen
// bewusst NICHT in der Liste und bleiben unberührt.
//
// Aufruf: node scripts/fix_umlauts.js          (Dry-Run, zeigt nur Befund)
//         node scripts/fix_umlauts.js --write  (schreibt direkt zurück)

import { readFileSync, writeFileSync, renameSync } from 'fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

// Pfade relativ zur Skriptlage: Aus einem Unterverzeichnis gestartet brach das
// Skript bisher mit ENOENT ab, weil die Dateiliste rein relativ war
// (CodeQA 2026-09-03).
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const WRITE = process.argv.includes('--write');

const MAP = {
  // -- ae -> ä / äu ----------------------------------------------------
  abhaengt: 'abhängt', aeltere: 'ältere', aeltesten: 'ältesten', aeussere: 'äußere',
  aeusserste: 'äußerste', Armstuecke: 'Armstücke', Atmosphaere: 'Atmosphäre',
  ausgepraegtes: 'ausgeprägtes', Baender: 'Bänder', bestaetigten: 'bestätigten',
  buchstaeblich: 'buchstäblich', eifoermige: 'eiförmige', Einzelgaenger: 'Einzelgänger',
  Eintraege: 'Einträge', elfjaehrigen: 'elfjährigen', empfaengt: 'empfängt',
  enthaelt: 'enthält', ergaenzen: 'ergänzen', faellt: 'fällt', Flaeche: 'Fläche',
  gaengiger: 'gängiger', gefaerbt: 'gefärbt', Gezeitenkraefte: 'Gezeitenkräfte',
  Haelfte: 'Hälfte', Haenden: 'Händen', Hemisphaere: 'Hemisphäre', Irregulaere: 'Irreguläre',
  Jahreslaenge: 'Jahreslänge', Kanaele: 'Kanäle', kraeftigen: 'kräftigen',
  Laengeneinheit: 'Längeneinheit', laenger: 'länger', laengste: 'längste',
  Laengster: 'Längster', laesst: 'lässt', leuchtkraeftigste: 'leuchtkräftigste',
  Magensaeure: 'Magensäure', Mindestlaenge: 'Mindestlänge', Muskelansaetze: 'Muskelansätze',
  naechste: 'nächste', naechsten: 'nächsten', naechstliegende: 'nächstliegende',
  naeherungsweise: 'näherungsweise', Naehrstoffe: 'Nährstoffe', Naehrstoffen: 'Nährstoffen',
  Oberflaeche: 'Oberfläche', Oberflaechentemperatur: 'Oberflächentemperatur',
  Photosphaere: 'Photosphäre', praezisierte: 'präzisierte', Qualitaets: 'Qualitäts',
  Salzsaeure: 'Salzsäure', Schaefermond: 'Schäfermond', schaetzungsweise: 'schätzungsweise',
  Schlaege: 'Schläge', Schlaegen: 'Schlägen', schlaegt: 'schlägt',
  Selbstverraeter: 'Selbstverräter', Sonnenoberflaeche: 'Sonnenoberfläche',
  spaeter: 'später', Spaetes: 'Spätes', taeglich: 'täglich', verraet: 'verrät',
  verraeterisch: 'verräterisch', verlaeuft: 'verläuft', vollstaendige: 'vollständige',
  waehlt: 'wählt', Waehlt: 'Wählt', waehrend: 'während', waeren: 'wären',
  Weisheitszaehne: 'Weisheitszähne', Wirbelsaeule: 'Wirbelsäule', Wortstaemme: 'Wortstämme',
  Zaehlung: 'Zählung', Zaehne: 'Zähne', Zaehnen: 'Zähnen', Backenzaehne: 'Backenzähne',
  Asteroidenguertel: 'Asteroidengürtel', Bauchspeicheldruese: 'Bauchspeicheldrüse',

  // Pleistozän/Pliozän-Reihe
  Mittelpleistozaen: 'Mittelpleistozän', Pleistozaen: 'Pleistozän', Pliozaen: 'Pliozän',
  Spaetpleistozaen: 'Spätpleistozän',

  // -- oe -> ö ---------------------------------------------------------
  ausgehoehlten: 'ausgehöhlten', Blutkoerperchen: 'Blutkörperchen',
  Gehoerknoechelchen: 'Gehörknöchelchen', gehoert: 'gehört', Handgewoelbe: 'Handgewölbe',
  hoechste: 'höchste', Himmelskoerper: 'Himmelskörper', juengste: 'jüngste',
  knoechernen: 'knöchernen', Koerper: 'Körper', Koerperfunktionen: 'Körperfunktionen',
  Koerpergewichts: 'Körpergewichts', Koerperkerntemperatur: 'Körperkerntemperatur',
  Koerperoberflaeche: 'Körperoberfläche', Koerpers: 'Körpers', Koerperteil: 'Körperteil',
  Koerpertemperatur: 'Körpertemperatur', Koerperzelle: 'Körperzelle', loeste: 'löste',
  moeglicher: 'möglicher', Muskelhohlkoerper: 'Muskelhohlkörper', Roehrenknochen: 'Röhrenknochen',
  Schoepfergott: 'Schöpfergott', Stoerungen: 'Störungen', ungeloeste: 'ungelöste',
  ungewoehnlich: 'ungewöhnlich', voellig: 'völlig', Wangenvorwoelbung: 'Wangenvorwölbung',

  // -- ue -> ü ---------------------------------------------------------
  dafuer: 'dafür', Duenn: 'Dünn', duenn: 'dünn', fluessiges: 'flüssiges',
  Blutfluessigkeit: 'Blutflüssigkeit', fruehen: 'frühen', frueher: 'früher',
  fruehere: 'frühere', fruehes: 'frühes', Fuenftel: 'Fünftel', fuehrte: 'führte',
  fuer: 'für', Fuer: 'Für', geprueftes: 'geprüftes', gepruefte: 'geprüfte',
  geschuetzt: 'geschützt', kuerzen: 'kürzen', kuerzesten: 'kürzesten', prueft: 'prüft',
  Ruecken: 'Rücken', ruecken: 'rücken', Rueckenmark: 'Rückenmark',
  rueckresorbiert: 'rückresorbiert', rueckwaerts: 'rückwärts', Silbermuenzen: 'Silbermünzen',
  Steigbuegel: 'Steigbügel', ueber: 'über', Ueber: 'Über', ueberspringen: 'überspringen',
  uebrig: 'übrig', Umwelteinfluessen: 'Umwelteinflüssen', ungefaehr: 'ungefähr',
  ungefaehren: 'ungefähren', vorwaerts: 'vorwärts', Vorwaerts: 'Vorwärts',
  Woerter: 'Wörter', wuerde: 'würde', wuerden: 'würden', Schuetzt: 'Schützt',
  zuruecklegt: 'zurücklegt', zusaetzliche: 'zusätzliche', geschmackssinn: 'geschmackssinn',

  // -- ss -> ß (nur echte Transliterationen; korrekte ss-Wörter NICHT hier) --
  aussenbereich: 'außenbereich', Aussenbereich: 'Außenbereich', Aussenkante: 'Außenkante',
  ausserhalb: 'außerhalb', blossem: 'bloßem', Fuss: 'Fuß', Fusses: 'Fußes',
  Fuessen: 'Füßen', Fusswurzelknochen: 'Fußwurzelknochen', gross: 'groß',
  groesse: 'größe', Groesse: 'Größe', groesseren: 'größeren', groesste: 'größte',
  groesstenteils: 'größtenteils', Groesstes: 'Größtes', heissen: 'heißen',
  heisser: 'heißer', Milchstrasse: 'Milchstraße', regelmaessig: 'regelmäßig',
  reisst: 'reißt', schiesst: 'schießt',

  // Sonderfall mit gemischten Ersetzungen in einem Token
  Graebenbruchtaelern: 'Grabenbruchtälern'
};

const FILES = [
  'scripts/data_sources/astra_raw.json',
  'scripts/data_sources/homo_raw.json',
  'scripts/generate_astra.js',
  'scripts/generate_homo.js'
];

// Wortgrenzen über deutsche Buchstaben: Token darf nicht Teil eines größeren
// Wortes sein (links/rechts kein Buchstabe, inkl. Umlaute).
function tokenRegex(token) {
  return new RegExp(`(?<![A-Za-zÄÖÜäöüß])${token}(?![A-Za-zÄÖÜäöüß])`, 'g');
}

let grandTotal = 0;
for (const file of FILES) {
  const fullPath = join(REPO_ROOT, file);
  let text = readFileSync(fullPath, 'utf8');
  let fileTotal = 0;
  for (const [wrong, right] of Object.entries(MAP)) {
    const re = tokenRegex(wrong);
    const before = text;
    text = text.replace(re, right);
    if (text !== before) {
      const n = (before.match(re) || []).length;
      fileTotal += n;
    }
  }
  if (WRITE && fileTotal > 0) {
    // Atomar schreiben wie alle Werkzeuge unter harvest/: erst in eine
    // Nachbardatei, dann umbenennen. Ein Abbruch mitten im Schreiben liess
    // sonst eine abgeschnittene Rohdatei ohne Rueckfallebene zurueck.
    const temporary = join(dirname(fullPath), `.${basename(fullPath)}.tmp`);
    writeFileSync(temporary, text, { flag: 'w' });
    renameSync(temporary, fullPath);
  }
  console.log(`${file}: ${fileTotal} Ersetzungen`);
  grandTotal += fileTotal;
}
console.log(`Gesamt: ${grandTotal} Ersetzungen`);
console.log(WRITE ? 'Fertig (geschrieben).' : 'Dry-Run. Mit --write schreiben.');
