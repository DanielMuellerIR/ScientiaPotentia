/**
 * Wendet das vom gebündelten Resolver erzeugte Bild-Mapping additiv auf die
 * Faktenbasis <domain>_raw.json an — und kann anschließend (mit --prune) die von
 * check_images.cjs als ungültig markierten Bilder wieder entfernen.
 *
 * Hintergrund: resolve_images_batched.cjs schreibt nur nach /tmp; das Zurück-
 * schreiben in raw.json war bisher ein ad-hoc-Einzeiler (fehleranfällig, da pro
 * Welle wiederholt). Dieser Helfer kapselt beide wiederkehrenden Schritte.
 *
 * Aufruf:
 *   node apply_images.cjs <domain>                 # /tmp-Mapping in raw mergen
 *   node apply_images.cjs <domain> --prune=<check.json>  # ungültige Bilder entfernen
 *
 * Merge ist additiv: nur Konzepte OHNE imageFile bekommen ein Bild gesetzt
 * (der Resolver liefert ohnehin nur bildlose). Bestehende Bilder bleiben unangetastet.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', '..');
const domain = process.argv[2];
const pruneArg = (process.argv.find(a => a.startsWith('--prune=')) || '').split('=')[1];
if (!domain) { console.error('Aufruf: apply_images.cjs <domain> [--prune=<check.json>]'); process.exit(1); }

const rawPath = path.join(ROOT, 'scripts', 'data_sources', `${domain}_raw.json`);
const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const byId = new Map(raw.map(c => [c.id, c]));

if (pruneArg) {
  // --- Prune-Modus: Bilder entfernen, die check_images.cjs als nicht-ok flaggte ---
  const check = JSON.parse(fs.readFileSync(path.isAbsolute(pruneArg) ? pruneArg : path.join(ROOT, pruneArg), 'utf8'));
  let removed = 0;
  for (const [id, res] of Object.entries(check)) {
    // ok!==true UND ein Ergebnis liegt vor (unbeantwortete API-Lücken NICHT löschen)
    if (res && res.ok === false) {
      const c = byId.get(id);
      if (c && c.imageFile) {
        delete c.imageFile; delete c.imageLicense; delete c.imageAttribution;
        removed++;
        console.log(`  - entfernt: ${id} [${res.reason}]`);
      }
    }
  }
  fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2), 'utf8');
  console.log(`Prune fertig: ${removed} ungültige Bilder entfernt aus ${rawPath}`);
  process.exit(0);
}

// --- Apply-Modus: /tmp-Mapping mergen ---
const mapPath = `/tmp/${domain}_images_batched.json`;
const mapping = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
let applied = 0, skipped = 0;
for (const m of mapping) {
  const c = byId.get(m.id);
  if (!c) { skipped++; continue; }
  if (c.imageFile) { skipped++; continue; }      // additiv: bestehendes Bild nie überschreiben
  c.imageFile = m.imageFile;
  if (m.imageLicense) c.imageLicense = m.imageLicense;
  if (m.imageAttribution) c.imageAttribution = m.imageAttribution;
  applied++;
}
fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2), 'utf8');
console.log(`Apply fertig: ${applied} Bilder gesetzt, ${skipped} übersprungen → ${rawPath}`);
