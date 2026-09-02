# Content-Pipeline

Scientia trennt Recherche, Rohdaten, Generierung und Prüfung. Die Dateien
`scripts/data_sources/<domain>_raw.json` sind die Quellwahrheit; Dateien unter `public/data/`
werden daraus erzeugt und nicht direkt bearbeitet.

## 1. Sammeln

- Zuerst Bereichsgrenze und Relevanz eines Konzepts prüfen.
- Wenige belastbare Quellen vollständig lesen, statt einzelne Suchtreffer zu sammeln.
- Pro Kandidat `sourceName`, `sourceUrl` und eine konkrete Prüfanmerkung speichern.
- Bilder in diesem Schritt nur als Suchbegriff notieren.

## 2. Fakten prüfen

- Autoritative Primär- und Fachquellen bevorzugen.
- Jeden Zahlenwert, jede Einheit und jeden Eigennamen gegen die verlinkte Quelle prüfen.
- Sekundärquellen nur verwenden, wenn keine bessere Quelle verfügbar ist.
- Eine Korrektur, die viele Fragen verändert, vor dem Merge als eigener Datenumbau prüfen.

## 3. Bilder auflösen

Die Wikimedia-Commons-Resolver ermitteln Bilddatei, Urheber, Lizenz und Lizenzadresse. Zulässig
sind Public Domain, CC0, CC BY, CC BY-SA, FAL, GFDL sowie die Commons-Freigaben „Attribution“
und „Copyrighted free use“. Creative-Commons-Angaben brauchen eine konkrete Versionsnummer;
NC, ND, unbekannte Bezeichnungen und unklare Rechte werden verworfen.

```bash
node scripts/data_sources/harvest/resolve_images_batched.cjs <domain>
node scripts/data_sources/harvest/backfill_image_attribution.mjs --write
```

Ein Bild muss das konkrete Konzept zeigen. Logos, Platzhalter und nur dekorativ passende Bilder
werden nicht übernommen.

## 4. Additiv zusammenführen

- Neue Kandidaten gegen vorhandene IDs und Namen prüfen.
- Deduplizierung nur innerhalb derselben Kategorie automatisieren.
- Bestehende, besser belegte Werte nicht durch schwächere Quellen überschreiben.
- Roh- und Kandidatendateien als nicht vertrauenswürdige Eingabe behandeln; Generatoren dürfen
  keine unvalidierten Felder still übernehmen.

## 4b. Attribute an bestehenden Konzepten ergänzen

Neue Attribute an bereits vorhandenen Konzepten laufen nicht über den Konzept-Merge,
sondern über ein eigenes Werkzeug. Es überschreibt nie einen vorhandenen Wert, sondern
meldet die Abweichung als Konflikt:

```bash
node scripts/data_sources/harvest/apply_attribute_additions.cjs <domain> <kandidatendatei>
node scripts/data_sources/harvest/apply_attribute_additions.cjs <domain> <kandidatendatei> --write
```

Wird dasselbe Attribut von zwei unabhängigen Ernten geliefert, ist die Konfliktliste des
zweiten Laufs die Gegenprobe: Wenige Konflikte belegen, dass beide Ernten dieselbe Quelle
richtig gelesen haben.

## 5. Generieren

Nur den betroffenen Generator ausführen, zum Beispiel:

```bash
node scripts/generate_natura.js
```

Generatoren leiten Fragen mechanisch aus geprüften Attributen ab. Distraktoren stammen aus
derselben Kategorie und Dimension. Der Antwort-Leak-Guard prüft den endgültigen Fragetext.

## 6. Verifizieren

```bash
npm run verify:facts -- <domain>
npm run audit:questions -- <domain>
npm run audit:image-credits
npm run audit:quote-rights
npm test
npm run build
```

Zusätzlich die Diff-Summen für Konzepte und Fragen festhalten, geänderte Datensätze lesen und im
Browser mindestens eine betroffene Frage samt Visualisierung, Bildnachweis und Quellenlink prüfen.

## Zitate

Original und Übersetzung haben getrennte Rechte. Vor dem Cultura-Generator läuft deshalb
`npm run audit:quote-rights`. Ein Zitat bleibt nur erhalten, wenn ein deutschsprachiges Original
oder eine dokumentierte gemeinfreie beziehungsweise frei lizenzierte Übersetzung vorliegt.
