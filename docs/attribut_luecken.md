# Geprüfte Attribute ohne Fragetyp

**Stand: 2026-09-02.**

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

## Bewusst nicht erschlossen

Ein Attribut wird nur zur Frage, wenn seine Werte innerhalb der Kategorie
vergleichbar sind. Diese Fälle erfüllen das nicht:

- **Lingua, Kategorien Lehnwort, Sprachkuriosum, Grammatik und Phonetik.** Zusammen
  80 Konzepte, aber fast jedes trägt eigene Attributschlüssel (`clickTypeCount`,
  `longestGermanSingleWordPalindrome`, `hawaiianPhonemeCount`). Es gibt keinen
  gemeinsamen Schlüssel mit genug Belegungen für einen Distraktorpool. Diese
  Konzepte bräuchten einen eigenen Fragetyp, der den Fun-Fact selbst prüft.
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
