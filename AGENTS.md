# Scientia — Beitragsregeln und Architektur

Scientia ist ein responsives, werbefreies Wissensquiz mit acht Wissensbereichen und
Spaced-Repetition-Fortschritt. Produktname ist **Scientia**; „Scientia potentia est“ ist der
Leitspruch.

## Einstieg

- `README.md` und `README.de.md`: Projekteinstieg.
- `CHANGELOG.md`: öffentliche Versionshistorie.
- `BACKLOG.md`: verifizierte offene Arbeit.
- `LAYOUT.md`: verbindlicher Layoutvertrag.
- `docs/bereichs_abgrenzung.md`: fachliche Zuordnung der Wissensbereiche.
- `docs/content_pipeline.md`: Ablauf für neue Inhalte.
- `docs/wissensquellen.md`: kuratierte Quellen.

## Code und Daten

- Bestehende React-, Vite- und Vanilla-CSS-Muster fortführen; keine neuen Frameworks ohne
  begründeten Architekturentscheid.
- Identifier Englisch, Kommentare und sichtbare Texte Deutsch. Echte Umlaute verwenden.
- `src/domains/index.js` ist die Registry aller Wissensbereiche. Eine Domain liefert mindestens
  Metadaten, `loadConcepts()` und `loadQuestions()`.
- Terra-Konzeptschlüssel bleiben unpräfixt. Alle anderen Domains verwenden `<domain>:<id>`.
- IndexedDB speichert Fortschritt pro Domain. Schlüssel oder Datenbankstruktur nur mit
  Rückwärtskompatibilität ändern.
- Das Lernsystem verfolgt Konzepte, nicht einzelne Fragen.
- Fachlogik gehört in Registry oder Domain-Komponenten, nicht als Sonderfall in die App-Shell.

## Visualisierung und Bildrechte

Jede Quizfrage zeigt eine fachlich passende Visualisierung. `VisualPanel` routet Terra zur Karte,
domainspezifische Visuals zur registrierten Komponente und sonst zu `ConceptVisual`.

- Bilder nur als Public Domain, CC0 oder unter einer kompatiblen freien Lizenz verwenden.
- CC-BY- und CC-BY-SA-Dateien brauchen Urheberangabe, Quelllink und Lizenzlink.
- NC- oder ND-Lizenzen sind nicht zulässig.
- Keine erfundenen Bildadressen. Wikimedia-Commons-Dateiseiten sind nicht mit direkten
  Bildadressen gleichzusetzen.
- Gebündelte Assets dokumentieren ihre Herkunft im jeweiligen `CREDITS.md`.
- `npm run audit:image-credits` muss für veröffentlichte Konzeptbilder ohne Befund enden.

## Inhalts-Pipeline

Die Quellwahrheit liegt in `scripts/data_sources/<domain>_raw.json`. Generatoren erzeugen daraus
`public/data/concepts_<domain>.json` und `questions_<domain>.json`.

1. Domain-Grenze und Relevanz klären.
2. Fakten mit `sourceName` und `sourceUrl` in einer Kandidatendatei sammeln.
3. Fakten gegen belastbare Quellen prüfen und stichprobenartig lesen.
4. Additiv zusammenführen und deduplizieren.
5. Nur den betroffenen Generator ausführen.
6. Faktenprüfung, Fragen-Audit, Tests und UI-Stichprobe durchführen.

Generierte Konzept- oder Fragendateien nie direkt korrigieren. Die Änderung würde beim nächsten
Generatorlauf verloren gehen.

## Fachliche Regeln

- Keine erfundenen Fakten oder Zahlen. Jeder Fakt braucht eine nachvollziehbare Quelle.
- Distraktoren stammen aus derselben Kategorie und Dimension. Einheiten nicht mischen.
- Der Fragetext darf die Antwort nicht mechanisch verraten.
- Numerische Distraktoren aus Rohwerten ableiten, nicht aus formatierten Zeichenketten.
- Lange geschützte Texte nicht übernehmen. Zitate benötigen eine dokumentierte Rechtebasis;
  Übersetzungen werden getrennt vom Original geprüft.
- Keine namentlichen Rekorde lebender Personen.
- Gegenwarts- und Tagespolitik, Parteien, Regierungen und Wahlen bleiben ausgeschlossen.
- Bereichsgrenzen stehen in `docs/bereichs_abgrenzung.md`.

## Layout und Prüfung

Der responsive Shell-Vertrag lebt in `src/index.css`. Vor und nach Layoutarbeit
`npm run check:layout` ausführen und `LAYOUT.md` lesen.

Standardprüfung:

```bash
npm ci
npm test
npm run build
npm run check:layout
python3 -m unittest tests/test_deploy.py
```

Contentänderungen zusätzlich:

```bash
npm run verify:facts -- <domain>
npm run audit:questions -- <domain>
```

Nach Änderungen an Registry, Visualisierung oder Inhalt die betroffenen Bereiche in einem echten
Browser prüfen: Bereich wechseln, Quizfrage beantworten, Visualisierung und Bildnachweis prüfen
und die Konsole kontrollieren.

## Lizenzen

- Projektcode: `LICENSE`.
- Eigene redaktionelle Daten: `DATA_LICENSE.md`.
- Fremdsoftware, Datenquellen und Assets: `THIRD_PARTY_NOTICES.md` sowie lokale
  `CREDITS.md`- und Lizenzdateien.
