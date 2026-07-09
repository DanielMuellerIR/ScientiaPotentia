# Cultura `genre_fiction` Runde 2 — Nur-Hörbuch-Autoren (Entdeckungsschicht)

Stand: 2026-07-09. Behebt die in der Code-Review monierte **Transienz** des v1.83-Scans:
Die Entdeckungsschicht (welche Autoren aufnehmen) ist jetzt reproduzierbar dokumentiert,
statt nur als Prosa in `AGENTS.md`. Die **Faktenschicht** bleibt wie in v1.83 Wikipedia DE.

## Idee

Runde 1 (v1.83) erntete Autoren, die Daniels Sammlung als **eBook UND Hörbuch** führt
(= besonders beliebt). Runde 2 zieht die **Nur-Hörbuch-Autoren** nach: Autoren, die es in
der Sammlung nur als Hörbuch (`~/Nextcloud/Odiobuks`) gibt, nicht als eBook
(`~/Nextcloud/eBooks/Autoren`). Die Sammlung ist reine **Entdeckungs-/Popularitäts-Schicht**
(welche Namen es wert sind) — keine Faktenquelle.

## Scan-Methodik (reproduzierbar, M5)

Die Sammlung liegt nur auf dem **M5** (`ssh m5`, Nextcloud voll hydriert). Reines
Verzeichnis-Listing hydriert keine Dateien (VFS-Disziplin, siehe theplan
`knowledge/ebook_vectordb.md`).

1. **eBook-Autoren** (Ausschlussmenge): `ls ~/Nextcloud/eBooks/Autoren` → 193 Autorenordner.
2. **Hörbuch-Einträge**: `find ~/Nextcloud/Odiobuks -mindepth 2 -maxdepth 2` → 911 Einträge
   je Genre-Ordner. Jeder Eintrag ist entweder ein Autorenordner (`Autor`) oder eine lose
   Datei `Autor - Titel.m4b`. Autor = Teil vor `" - "`, Medien-Endung entfernt.
3. **Genre-Fokus**: nur genre_fiction-relevante Odiobuks-Genres — `Science-Fiction`,
   `Fantasy`, `Fantasy, Horror`, `Klassiker, Grusel`, `Krimi, Thriller`. Ausgeschlossen:
   Sachbücher, Kabarett/Comedy, Liebesromane, Poesie, Historische Romane, Hörspiele,
   Romane/Literatur (Letztere gehören ggf. in die Kategorie `literature`, nicht `genre_fiction`).
4. **Nur-Hörbuch**: Odiobuks-Autor ∉ eBook-Autoren UND ∉ bereits vorhandene
   genre_fiction-Autoren (`cultura_raw.json`). Rauschen (`.DS_Store`, „Audible Original" …)
   gefiltert. → **336 Kandidaten**.
5. **Notabilitäts-Gate** (Projekt-Lektion: Existenz allein reicht nicht, sonst obskurer/
   kontaminierter Müll): DE-Wikipedia-Artikel muss existieren (**210/336**) UND das Intro
   muss einen Autor-Marker tragen (Schriftsteller/Autor/Roman/Genre-Begriff) → **193
   bestätigte Autoren** (`candidates_gated.json`), nach Artikellänge als Notabilitätsproxy
   sortiert. Aussortiert: Namensgleiche Nicht-Autoren (z. B. „David Reimer").

   **Caveat**: Der Autor-Keyword-Filter hat wenige Falsch-Negative (leeres Intro-Extrakt),
   z. B. Veronica Roth, Walter M. Miller, Ursula Poznanski — bei der Ernte mitprüfen.

## `candidates_gated.json`

Array `{author, title (DE-Wiki-Lemma), len (Artikel-Introlänge), isWriter, genres, count}`.
`genres`/`count` stammen aus dem Odiobuks-**Ordner** und sind für die tatsächliche
Werk-Klassifikation NUR ein Hinweis — das Genre wird bei der Ernte **pro Werk** bestimmt
(der Ordner „Klassiker, Grusel" enthält z. B. Homer/Melville/Dante = Literatur-Kanon, kein
`genre_fiction`).

## Welle 1 — Ergebnis (v1.85.0, 2026-07-09)

Die **124 notabelsten** Kandidaten (Wikidata-Sitelinks ≥8) über einen Multi-Agent-Workflow
geerntet (21 Finder-Batches à 6 Autoren + adversariale Genre-/Fakten-Prüfung je Batch,
41 Agenten, 0 Fehler). Finder verifizierten jeden Fakt per curl gegen de.wikipedia.
**86 verifizierte Konzepte** → Gate: 3 Cross-Kategorie-Dubletten gedroppt (20.000 Meilen,
Harry Potter, Dracula existierten bereits unter `literature`), 2 funFacts entschärft
(„englischer" Schauplatz = weicher Sprach-Leak) → **83 gemerged** (genre_fiction 123→206).
Alle 83 sourceUrls HTTP-200-geprüft, 0 funFact-Leaks, 0 ID-Kollisionen, verify_facts 0 Fehler.
Genre-Verteilung: SF 33 / Fantasy 22 / Thriller 15 / Kriminalroman 12 / Horror 4 (nach Drops).
38 der 124 Autoren übersprungen (Literatur-Kanon/Kinderbuch/Nicht-Genre — Curation griff).

**Offen — Welle 2:** die 69 obskureren Autoren (Sitelinks <8, eher dt. Regionalmarkt).
Workflow-Skript wiederverwendbar; nur die Args auf den `<8`-Tier umstellen.

## Ernte-Regeln (Faktenschicht = Wikipedia DE)

- Pro Autor **1–2 der bekanntesten Werke**, nicht das Gesamtwerk.
- Genre je Werk in das **feste Vokabular** zwingen: Science-Fiction / Fantasy / Horror /
  Kriminalroman / Thriller. Werke, die reiner Literatur-Kanon sind (Melville, Homer, Dante,
  Dickens, Twain …), gehören **nicht** in `genre_fiction` → überspringen (oder separat als
  `literature`). Grenzfälle Frankenstein/Dracula/Jules Verne = genre-begründend → aufnehmen.
- Felder wie bestehende genre_fiction-Konzepte: `id` (`genrefic-<autor>-<titel>-gN`),
  `name`, `category:"genre_fiction"`, `attributes{author, year|startYear, genre, language}`,
  `funFact`, `sourceName`, `sourceUrl`, `verifyNote`. `year`/`startYear` als **String**.
- Merge additiv über `append_concepts.cjs` (NIE `merge_cultura.js`), dann
  `generate_cultura.js` → `verify_facts.js cultura` → Browser.
