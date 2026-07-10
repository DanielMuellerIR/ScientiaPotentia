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

## Welle 2 — Pilot geerntet (v1.85.2, 2026-07-10)

Der geplante kleine Pilot ist erledigt: die notabelsten offenen Kandidaten wurden
über **3 eng begrenzte Subagenten mit fest im Prompt eingebetteter Autorenliste**
(kein `args`, harte Obergrenze 5 Autoren je Agent — genau die Prävention aus der
Fanout-Lehre) gegen de.wikipedia faktengeprüft geerntet. **14 verifizierte Werke von
12 Autoren** → Gate (0 Drops, keine Cross-Kat-Dubletten) → merge → generate →
`verify_facts` 0 Fehler → Browser-verifiziert (Cultura 7440 Fragen, genre_fiction
**206→220**). Genre-Verteilung des Pilots: Thriller 4 / SF 4 / Fantasy 3 /
Kriminalroman 2 / Horror 1. Bewusst gedroppt: J.D. Robb (Nora Roberts — DE-Wikipedia
belegt Reihe/Genre, aber kein Erscheinungsjahr → kein erfundenes `year`), John Gardner
(Genre-Namensvetter hat keinen DE-Artikel, nur der Literatur-Gardner), Daniel Call
(Dramatiker, kein Genre-Autor). Literatur-Kanon/Kinderbuch (Homer, Dr. Seuss, Cormac
McCarthy, Roald Dahl, Norton Juster, Mirjam Pressler) gemäß Ernte-Regeln übersprungen.
Ernte-Rohdaten: `wave2_pilot_final.json`, gegatete Kandidaten:
`../cand_cultura_genrefic_r2w2_pilot.json`. **Bilder offen** — die 14 neuen Werke
haben noch keine Autorenporträts (`resolve_author_portraits.cjs`, separater Schritt
wie in v1.85.1). Restmenge ≈ 88 offene Kandidaten (davon Teil Literatur-Kanon) für
eine mögliche Folge-Welle nach demselben Muster.

## Welle 2 — ursprüngliche Planung (Stand 2026-07-09)

Das ursprüngliche Sitelink-Ranking-JSON aus Welle 1 lag nur im flüchtigen
Session-Scratchpad und ist weg. **Ersatz-Ableitung (reproduzierbar, ohne
Sitelinks):** die offene Restmenge = alle Kandidaten aus `candidates_gated.json`,
deren Autor noch in **keiner** cultura-Kategorie vorkommt (Dedup gegen
`author`-Attribut über literature/quote/genre_fiction — nicht nur genre_fiction,
sonst wiederholt sich der Welle-1-Stolperstein mit Cross-Kat-Dubletten):

```
node -e 'const cand=require("./candidates_gated.json");
const r=require("../../cultura_raw.json");const a=Array.isArray(r)?r:Object.values(r).find(Array.isArray);
const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[.\-]/g," ").replace(/\s+/g," ").trim();
const ex=new Set();for(const c of a){const au=c.attributes&&c.attributes.author;if(au)ex.add(norm(au));}
console.log(cand.filter(c=>!ex.has(norm(c.author))).sort((x,y)=>y.len-x.len).length,"offen");'
```

→ **102 offene Kandidaten**, nach Artikel-Introlänge (`len`) als Notabilitätsproxy
sortiert. Davon ist rund ein Drittel bewusst zu überspringender Literatur-Kanon/
Kinderbuch (Homer, Dr. Seuss, Edmund Spenser, Amor Towles, Cormac McCarthy …) —
die Kuratierung pro Werk fängt das (siehe Ernte-Regeln). Realistischer Ertrag
≈ 60 echte Genre-Treffer.

**Vorgehen (Daniel-Entscheidung 2026-07-09): kleiner Pilot zuerst** — erst die
~15 notabelsten Autoren ernten, committen, browser-verifizieren, dann über den
Rest entscheiden. Gate-Werkzeug liegt bereit: `gate_wave2.cjs` (Cross-Kat-Dedup +
Genre-Vokabular + deterministische ids) → `../append_concepts.cjs cultura <cands> --write`
→ `node scripts/generate_cultura.js` → `node scripts/verify_facts.js cultura`.

> **Warnung — NICHT groß fächern.** Der erste Welle-2-Voll-Fächer (Workflow-Tool)
> kippte durch einen `args`-Serialisierungs-Bug in einen Amoklauf (~1900 Müll-Batches,
> ~14,4 Mio. Token verbrannt, Wochenlimit gerissen; nichts ins Repo geschrieben).
> Lehre + Präventionsregeln: theplan `knowledge/workflow-tool-fanout-safety.md`.
> Für den Pilot Nutzdaten fest ins Skript einbetten (nicht über `args`), harten
> Batch-Cap setzen, mit 1–2 Batches smoke-testen.

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
