# Terra im Querbeet-Mischpool: Entscheidung

Stand: 2026-08-23

## Ausgangslage

`src/domains/metadata.js` setzt für Terra `includeInScientia: false`.
`SCIENTIA_MIX_IDS` übernimmt dieses Feld als alleinige Quelle für den
Mischpool. Dadurch laden `loadConcepts()` und `loadQuestions()` in
`src/domains/index.js` aktuell nur die sieben kartenfreien Fachbereiche.

Das ist fachlich ehrlich: In einer Terra-Runde zeigt `VisualPanel` die
Weltkarte, weil die aktive Domain `hasMap` setzt. Im Querbeet-Quiz ist die
aktive Domain hingegen Scientia. Sie hat keine Karte; `VisualPanel` würde
eine generische Konzeptkarte zeichnen. Eine Kartenklick-Frage hat dort weder
eine klickbare Karte noch Antwortoptionen und wäre unbeantwortbar.

## Quantifizierter möglicher Anteil

`public/data/questions_terra.json` enthält 5.116 Fragen. Davon sind 427
vom Typ `click-map` und bleiben zwingend außerhalb eines kartenfreien
Mischpools. Die restlichen 4.689 Fragen haben Antwortoptionen oder eine
Silhouette und können grundsätzlich als Multiple-Choice-Fragen laufen.

| Fragetyp | Fragen |
| --- | ---: |
| Städte (hin und zurück) | 2.737 |
| Länder, Bundesstaaten und Flaggen | 1.118 |
| Silhouetten | 427 |
| Flüsse | 241 |
| Hauptstädte, Kontinente, höchste Punkte und Währungen | 605 |
| **Kartenklick, ausgeschlossen** | **427** |

Die beiden Terra-Dateien umfassen unkomprimiert rund 3,9 MB
(`src/data/geodb.json`: 1,0 MB; Fragen: 2,9 MB). Sie würden erst beim
Querbeet-Start zusätzlich geladen, nicht auf dem Startbildschirm.

## Umsetzungsoptionen

1. **Terra bleibt ausgeschlossen.** Kein zusätzlicher Download, jede
   Terra-Frage behält die Weltkarte. Die Querbeet-CTA bleibt „alle Bereiche
   außer Geografie“.
2. **Kartenfreier Terra-Anteil.** Der Mischpool lädt Terra zusätzlich, filtert
   aber vor Rundenbeginn deterministisch alle 427 `click-map`-Fragen aus.
   Der Terra-Anteil umfasst dann 4.689 Fragen. Die CTA nennt wieder alle
   Bereiche; die eigenständige Terra-Runde behält sämtliche Fragetypen.

Von einem ungefilterten Eintrag Terras in `SCIENTIA_MIX_IDS` wird abgeraten:
Er würde Kartenklick-Fragen in eine Ansicht ohne Karte mischen.

## Erforderliche Technik bei Option 2

- Eine eigene Mischpool-Transformation filtert ausschließlich
  `type === 'click-map'`; der Terra-Katalog und seine normalen Spielmodi
  bleiben unverändert.
- Die 1.852 Geo-Entitäten erhalten für die generische Karte eine
  übersetzte, leak-freie Darstellungsform. Rohdaten besitzen `type`,
  `metadata` und `facts`, nicht die bei anderen Domains üblichen
  `attributes`, `source` und `image`. Ein bloßes Zusammenführen würde daher
  nur Name und Kategorie zeigen.
- Unpräfixierte Terra-Keys bleiben erhalten. Die bestehende
  `getDomainIdFromConceptKey()`-Regel ordnet sie bereits Terra zu; damit
  bleibt der SRS-Fortschritt pro Herkunfts-Domain getrennt.
- Der Fragenpool braucht Tests dafür, dass keine Kartenklick-Frage in
  Scientia erscheint, dass eine Terra-MCQ mit generischer Karte antwortbar
  ist und dass der gespeicherte Verlauf `domain: 'terra'` erhält. Danach
  folgen Build, Layoutcheck und ein Browserlauf mit einer Terra-Frage im
  Querbeet-Quiz.

## Entscheidung

Daniel hat am 2026-08-23 Option 1 gewählt: Terra bleibt im Querbeet-Mischpool
ausgeschlossen. Damit behält jede Terra-Frage ihre Weltkarte; die
Querbeet-CTA nennt weiterhin alle Bereiche außer Geografie. Der Codezustand
mit `includeInScientia: false` bleibt unverändert.

Option 2 wird nur erneut geprüft, wenn die Produktentscheidung ausdrücklich
geöffnet wird.
