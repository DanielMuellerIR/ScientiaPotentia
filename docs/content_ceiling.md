# Fachliche Content-Ceilings

**Stand: 2026-08-27.** Dieses Dokument ersetzt eine reine Fragenquote als
Ausbauziel. Zahlen beschreiben den Umfang, nicht die Qualität oder den Bedarf
für weitere Konzepte.

## Entscheidung

Eine Domain wird nicht erweitert, um eine bestimmte Fragenzahl zu erreichen.
Sie erreicht ihr fachliches Ceiling, wenn ihr verbliebenes Material entweder
außerhalb der Domain-Grenze liegt, nur mit obskurem Fachjargon gefüllt werden
könnte oder keine faire, quellen- und visualisierungsgestützte Frage ergäbe.

Eine neue Content-Welle braucht deshalb vor dem Merge alle folgenden Belege:

1. Das Konzept gehört nach `bereichs_abgrenzung.md` in die gewählte Domain.
2. Die Rohdaten nennen für jeden prüfbaren Fakt eine belastbare Quelle.
3. Der Generator kann mindestens einen eigenständigen Lernwinkel mit
   dimensionsgleichen Distraktoren erzeugen; bloße Umformulierungen zählen
   nicht als zusätzliche Fragen.
4. Die sichtbare Visualisierung erklärt das gefragte Konzept. Ein fehlendes
   Foto ist nur dann zulässig, wenn Karte, Schema oder `ConceptVisual` den
   Sachverhalt besser abbildet.
5. Der Fragen-Audit, die Faktenprüfung und eine semantische Stichprobe finden
   keine unvertretbaren Selbstverräter, Mehrdeutigkeiten oder Dubletten.

Ein Bereich mit weniger Fragen darf also fertig sein; ein Bereich mit vielen
Fragen kann weiterhin ein begründetes, kuratiertes Reservoir besitzen.

## Bewertungsstand

Die Zahlen sind der beim Build erzeugte Stand aus
`public/data/domain_stats.json`. „Bilder“ zählt Konzeptbilder, nicht die
Pflichtvisualisierung jeder Frage: Terra verwendet die Karte, abstrakte Inhalte
die Konzeptkarte oder ein fachliches Schema.

| Domain | Fragen | Konzepte | Bilder | Fachliche Einordnung |
|---|---:|---:|---:|---|
| Terra | 5.116 | 1.852 Kartenobjekte | Karte | Geschlossener, quellgebundener Geodatensatz. Neue Fragen nur bei einem zusätzlichen fairen Kartentyp oder einer überprüften Datensatzänderung; keine künstliche Vermehrung pro Ort. |
| Astra | 5.055 | 1.560 | 489 | Breites, aber quellenabhängiges Reservoir. Neue Körper, Missionen oder Eigenschaften brauchen stabile Fachquellen. Keine Sternbildlinien ohne freigegebene Konvention oder IAU-Grenzdaten. |
| Homo | 1.600 | 599 | 306 | Erreicht das belegte Ceiling von etwa 1.500–1.700 Fragen. Krankheiten, Erreger und Medizingeschichte wären falsche Wege zur Mengensteigerung und gehören nach Natura beziehungsweise Historia. |
| Natura | 13.343 | 2.402 | 1.878 | Kein numerisches Ceiling: Arten, Lebensräume und Geologie bieten weiter Material. Es gelten aber Notabilität, belastbare Merkmale und eine passende Visualisierung vor weiterer Menge. |
| Lingua | 4.874 | 1.207 | 198 | Die frühere 5.000er-Orientierung ist fast erreicht, aber kein Grund für Restmaterial. Neue Einträge nur bei klaren Sprach-, Schrift- oder Etymologie-Lernzielen; bloße Flexions- und Dialektlisten bleiben aus. |
| Cultura | 7.373 | 1.987 | 1.047 | Breites Reservoir mit harter Urheberrechts- und Gegenwartsgrenze. Neue Werke müssen fachlich notabel sein; geschützte 2D-Werke, lange Zitate und lebende Rekordpersonen bleiben ausgeschlossen. |
| Machina | 6.130 | 2.165 | 291 | Breites Reservoir, aber viele abstrakte Konzepte haben bewusst kein Foto. Neue Fragen müssen Funktionsprinzipien lehren; Markenlogos oder aktuelle Produktlisten sind kein Ersatz für eine Visualisierung. |
| Historia | 6.330 | 1.244 | 1.025 | Breites Reservoir für datierbare, neutral darstellbare Inhalte. Tagespolitik, wertende Systemdebatten und schlecht belegte Rekordlisten bleiben außerhalb der Domain. |

## Folgen für die Pflege

- Die Zahl 5.000 ist nur noch ein historischer Orientierungswert. Sie ist kein
  Release-Gate und kein Auftrag, einen Bereich darunter aufzufüllen.
- Homo bleibt auf seinem belegten Ceiling. Erweiterungen werden nur als
  ausdrücklich neue, regelkonforme Kategorie geplant, nicht aus einer
  Zahlenlücke abgeleitet.
- Bei Natura, Astra, Lingua, Cultura, Machina und Historia entscheidet die
  dokumentierte Restlücke einer Kategorie über eine Welle, nicht der
  Gesamtzähler der Domain.
- Bildabdeckung ist eine eigene Qualitätsarbeit. Sie darf weder ein Konzept
  ohne passendes Bild erzwingen noch ein schwaches Bild als Fortschritt zählen.
- Die strukturelle Faktenprüfung vom 2026-08-23 meldet in allen sieben
  JSON-Domains null Fehler. Ihre bestehenden Warnungen ersetzen keine
  semantische QA; diese bleibt als eigener Backlog-Punkt mit vorheriger
  Freigabe des MiniMax-Kontingents bestehen.

## Quellen im Projekt

- [Domain-Grenzen](bereichs_abgrenzung.md)
- [Content-Pipeline](content_pipeline.md)
- [Kuratierte Wissensquellen](wissensquellen.md)
- [Verifizierte offene Arbeit](../BACKLOG.md)
- [Aktueller Fragen- und Konzeptstand](../public/data/domain_stats.json)
