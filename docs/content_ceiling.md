# Fachliche Content-Ceilings

**Stand: 2026-09-30.** Dieses Dokument ersetzt eine reine Fragenquote als
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
| Astra | 5.626 | 1.560 | 531 | Breites, aber quellenabhängiges Reservoir. Kometen und Sternhaufen sind seit 2026-09-02 erschlossen. Neue Körper, Missionen oder Eigenschaften brauchen stabile Fachquellen. Keine Sternbildlinien ohne freigegebene Konvention oder IAU-Grenzdaten. |
| Homo | 3.237 | 946 | 363 | Das frühere Ceiling von 1.500 bis 1.700 Fragen war zu eng gezogen: Es beschrieb die damals angelegten Kategorien, nicht die Domain. Acht neue Kategorien innerhalb der Körpergrenze (Blutgefäße, Bandapparat, Hirnstrukturen, Botenstoffe, Sinnesorgan-Bestandteile, Zähne, Gewebe, Immunsystem) haben die Zahl fast verdoppelt. Krankheiten und Medizingeschichte bleiben weiterhin draußen. |
| Natura | 13.849 | 2.402 | 1.878 | Kein numerisches Ceiling: Arten, Lebensräume und Geologie bieten weiter Material. Es gelten aber Notabilität, belastbare Merkmale und eine passende Visualisierung vor weiterer Menge. |
| Lingua | 4.897 | 1.202 | 197 | Neue Einträge nur bei klaren Sprach-, Schrift- oder Etymologie-Lernzielen; bloße Flexions- und Dialektlisten bleiben aus. Lehnwort, Sprachkuriosum, Grammatik und Sprachfakt werden seit dem 2026-09-03 in der Umkehrrichtung gefragt (Attributwert als Hinweis, Konzeptname als Antwort) und tragen zusammen 47 Fragen. Phonetik bleibt draußen: Dort nennt der Typ in 7 von 10 Fällen die Lösung. |
| Cultura | 7.749 | 1.986 | 1.046 | Breites Reservoir mit harter Urheberrechts- und Gegenwartsgrenze. Neue Werke müssen fachlich notabel sein; geschützte 2D-Werke, lange Zitate und lebende Rekordpersonen bleiben ausgeschlossen. |
| Machina | 6.536 | 2.165 | 291 | Breites Reservoir, aber viele abstrakte Konzepte haben bewusst kein Foto. Neue Fragen müssen Funktionsprinzipien lehren; Markenlogos oder aktuelle Produktlisten sind kein Ersatz für eine Visualisierung. |
| Historia | 6.330 | 1.244 | 1.025 | Breites Reservoir für datierbare, neutral darstellbare Inhalte. Tagespolitik, wertende Systemdebatten und schlecht belegte Rekordlisten bleiben außerhalb der Domain. |

## Folgen für die Pflege

- Die Zahl 5.000 ist nur noch ein historischer Orientierungswert. Sie ist kein
  Release-Gate und kein Auftrag, einen Bereich darunter aufzufüllen.
- Ein Ceiling beschreibt immer nur die bereits angelegten Kategorien. Bevor ein
  Bereich als fertig gilt, ist zu prüfen, ob es innerhalb seiner Grenze noch
  ganze Themenfelder ohne eigene Kategorie gibt. Bei Homo waren das acht.
- Ein zweiter, oft übersehener Hebel sind Attribute, die in den Rohdaten geprüft
  vorliegen, aber von keinem Fragetyp genutzt werden. Sie kosten keine neue
  Recherche. `docs/attribut_luecken.md` hält den jeweiligen Stand fest.
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
