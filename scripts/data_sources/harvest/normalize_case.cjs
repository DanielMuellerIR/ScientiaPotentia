/**
 * Normalisiert Groß-/Kleinschreibungs-Varianten kategorialer Attributwerte in
 * <domain>_raw.json. Hintergrund: Finder-Wellen liefern denselben Wert mal groß,
 * mal klein ("Interpretiert"/"interpretiert"); der Distraktor-Picker dedupliziert
 * case-sensitiv und zeigt dann beide Varianten als scheinbare Doppel-Option.
 *
 * Vorgehen: je Attribut alle Werte nach case-gefaltetem Schlüssel gruppieren; ist
 * eine Gruppe mehrdeutig (mehrere Schreibungen), gewinnt die kanonische Form. Diese
 * ist die häufigste Schreibung unter den BESTEHENDEN Konzepten (id endet NICHT auf
 * dem aktuellen Wellen-Suffix via --wave) — neue Wellen-Konzepte konformieren sich
 * also an den verifizierten Bestand, nicht umgekehrt. Ohne --wave: häufigste gesamt.
 * Tie-Break: erste alphabetisch. Idempotent, rein Daten-Putz – Generator unangetastet.
 *
 * Aufruf: node normalize_case.cjs <domain> [--wave=<suffix>] [--write]
 */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..', '..', '..');
const domain = process.argv[2];
const WRITE = process.argv.includes('--write');
const waveSuffix = (process.argv.find(a => a.startsWith('--wave=')) || '').split('=')[1] || null;
// Bestehend = Konzept gehört NICHT zur aktuellen Welle (id endet nicht auf -<suffix>).
const isExisting = c => !waveSuffix || !String(c.id).endsWith('-' + waveSuffix);
if (!domain) { console.error('Aufruf: normalize_case.cjs <domain> [--wave=<suffix>] [--write]'); process.exit(1); }
const rawPath = path.join(ROOT, 'scripts', 'data_sources', `${domain}_raw.json`);
const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));

// Alle string-wertigen Attribut-Keys einsammeln (kategoriale Werte).
const keys = new Set();
for (const c of raw) for (const [k, v] of Object.entries(c.attributes || {})) if (typeof v === 'string') keys.add(k);

const changes = [];
for (const key of keys) {
  // case-gefalteter Schlüssel -> { Schreibung -> [Häufigkeit gesamt, Häufigkeit Bestand] }
  const groups = {};
  for (const c of raw) {
    const v = c.attributes && c.attributes[key];
    if (typeof v !== 'string') continue;
    const lc = v.toLowerCase().trim();
    const g = (groups[lc] ??= {});
    g[v] ??= { all: 0, existing: 0 };
    g[v].all++; if (isExisting(c)) g[v].existing++;
  }
  for (const [lc, variants] of Object.entries(groups)) {
    const forms = Object.keys(variants);
    if (forms.length < 2) continue; // keine Mehrdeutigkeit
    // kanonisch = häufigste Schreibung im BESTAND; fällt der Bestand aus, häufigste gesamt
    const canonical = forms.sort((a, b) =>
      (variants[b].existing - variants[a].existing) ||
      (variants[b].all - variants[a].all) ||
      a.localeCompare(b, 'de'))[0];
    for (const c of raw) {
      // Nur Wellen-Konzepte (NICHT Bestand) anpassen — verifizierte Bestandswerte
      // bleiben unangetastet; neue Konzepte konformieren sich an den Bestand.
      if (waveSuffix && isExisting(c)) continue;
      const v = c.attributes && c.attributes[key];
      if (typeof v === 'string' && v.toLowerCase().trim() === lc && v !== canonical) {
        c.attributes[key] = canonical;
        changes.push(`${key}: "${v}" -> "${canonical}" (${c.id})`);
      }
    }
  }
}

console.log(`${domain}: ${changes.length} Werte normalisiert.`);
changes.slice(0, 30).forEach(s => console.log('  ' + s));
if (WRITE && changes.length) {
  fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2), 'utf8');
  console.log(`Geschrieben: ${rawPath}`);
} else if (!WRITE) {
  console.log('[DRY-RUN] Mit --write anwenden.');
}
