# Geprüfte Attribute ohne Fragetyp

**Stand: 2026-09-03.**

Neben neuen Konzepten gibt es einen zweiten Hebel für mehr Fragen, der keine neue
Recherche kostet: Attribute, die in `scripts/data_sources/<domain>_raw.json` bereits
belegt und geprüft sind, aus denen aber kein Generator eine Frage baut. Diese Datei
hält fest, was am 2026-09-02 noch offen war und warum.

## Am 2026-09-02 erschlossen

| Bereich | Attribut oder Kategorie | Neue Fragen |
|---|---|---:|
| Natura | Erdteil, abgeleitet aus dem Verbreitungsgebiet | 503 |
| Astra | Kometen und Sternhaufen (vorher ganz ohne Fragetyp) | 176 |
| Astra | Nebeltyp, Zentralstern, Sichtbarkeit, Entdeckungsjahr eines Mondes, Planetentyp eines Exoplaneten, Asteroidengruppe, Missionsziel, markante Eigenschaft von Sternen und Galaxien | 446 |
| Machina | Beschreibung eines IT-Konzepts, Transportprotokoll, Funktionsprinzip einer Kraftmaschine | 405 |
| Cultura | Musikepoche, Lebensdaten der Komponisten, Baustil, Merkmale und Hauptvertreter der Kunst- und Literaturepochen | 394 |
| Homo | Körperregion von Muskeln und Organen, lateinische Organnamen, Gegenspieler, Ansatz, Hirnnerv-Nummer, Versorgungsgebiet, Hirnvolumen, Körpergröße, Nahrungsquelle | Teil der Homo-Welle |

## Am 2026-09-03 erschlossen

| Bereich | Attribut oder Kategorie | Neue Fragen |
|---|---|---:|
| Lingua | Lehnwort (`examples`), Sprachkuriosum (`definition`), Grammatik (`principle`), Sprachfakt (Namenshälfte) — alle in der Umkehrrichtung | 47 |

Der Hebel war nicht ein neues Attribut, sondern die Richtung der Frage. Solange man
vorwärts fragt („welchen Wert hat dieses Konzept?"), braucht man einen Pool aus
Attributwerten — den gibt es in diesen Kategorien nicht. Rückwärts gefragt („welches
Konzept passt zu diesem Wert?") ist der Pool die Menge der Konzeptnamen, und davon hat
jede Kategorie 14 bis 29. Zur Vollständigkeit: Die Vorwärtsfrage nach der
Herkunftssprache eines Lehnworts scheiterte nicht am Pool — `sourceLanguage` hat 23
Belegungen mit 20 verschiedenen Werten — sondern daran, dass 18 der 23 Konzeptnamen die
Antwort selbst nennen („Türkische Lehnwörter im Deutschen" → Türkisch).

Wo die eigene Kategorie zu klein oder inhaltlich zu bunt für vergleichbare Optionen ist,
kann ein Template seine Distraktoren aus einer Nachbarkategorie ziehen (`namePool` in
`scripts/generate_lingua.js`). Sprachfakt nutzt das: Die 14 Konzepte meinen teils
Sprachen, teils Schriften, teils Familien, und die Optionen kommen jeweils aus der
passenden der drei großen Kategorien.

## Bewusst nicht erschlossen

Ein Attribut wird nur zur Frage, wenn seine Werte innerhalb der Kategorie
vergleichbar sind. Diese Fälle erfüllen das nicht:

- **Lingua, Kategorie Phonetik.** 14 Konzepte. Der Schlüssel `type` ist mit 10
  Belegungen der einzige tragfähige, nennt aber in 7 Fällen die Lösung schon im
  Hinweis („Aspiration (Behauchung)" ↔ „Behauchung von Verschlusslauten"). Die
  drei verbleibenden Fragen rechtfertigen keinen eigenen Fragetyp
  (Entscheidung Daniel, 2026-09-03).
- **Lingua, `language.countries` (110) und `writing_system.languagesUsing` (60).**
  Aufzählungen von 5 bis 86 Zeichen Länge. Als Antwortoption wäre die richtige
  Lösung über ihre Länge erratbar.
- **Machina, `programming_language.typeSystem` (85).** Praktisch binär: 45 statisch,
  34 dynamisch. Eine Frage mit zwei ernsthaften Optionen ist ein Münzwurf.
- **Cultura, `quote.authorDeathYear` (533).** Das Todesjahr des Autors ist ein
  Rechte-Nachweis, kein Lernziel; als Quizfrage zu einem Zitat wäre es beliebig.
- **Homo, `organ.location` und `muscle.region` in ihrer beschreibenden Form.** Beide
  Kategorien tragen daneben ein kurzes Regionsfeld, das abgefragt wird. Die langen
  Beschreibungstexte bleiben als erklärender Chip stehen.

## Verfahren

`node scripts/audit_questions.cjs` zeigt die erzeugten Fragetypen. Für eine neue
Inventur die Attribute je Kategorie aus der Rohdatei gegen das Feld
`testedAttribute` der erzeugten Fragen halten. Achtung: Umkehrfragen tragen
`testedAttribute: null`, ihr Attribut steckt nur im Typnamen — ein reiner Abgleich
über `testedAttribute` meldet sie fälschlich als ungenutzt.

Vor jedem neuen Fragetyp gelten dieselben Regeln wie für neue Inhalte:

1. Die Werte der Kategorie sind vergleichbar lang und gleicher Dimension.
2. Keine Lösung ist in der Hälfte aller Fälle richtig (`Dominant`-Spalte im Audit).
3. Kein sichtbares Geschwisterattribut verrät die Antwort
   (`LEAKY_SIBLINGS` in `src/components/conceptLabels.js`).
4. Bei Umkehrfragen ist der Wert innerhalb der Kategorie eindeutig.
