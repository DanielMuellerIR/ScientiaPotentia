# Plan: Parallele Faktenextraktion aus Sachbüchern (Sonnet-Agenten)

> **Stand 2026-06-17.** Ausführungsreifer Plan für eine **eigene Session**. Ziel: aus den lokalen
> Sachbüchern belegte, quiz-taugliche Fakten gewinnen — maximal parallel über Sonnet-Subagenten,
> zentral mit Opus gegated. Ergänzt `docs/wissensquellen_extern.md` und `docs/content_pipeline.md`.

## 0. Harte Randbedingungen (NICHT verletzen)

- **Bücher lokal von DIESEM Rechner (M3), hydriert.** Wurzel **immer über `$HOME`** ansprechen —
  M3 = `/Users/danielmuller/…`, M5 = `/Users/dm0/…` (unterschiedlicher Username!). Nie einen
  absoluten `/Users/<name>/…`-Pfad hartkodieren.
  Buch-Wurzel: `$HOME/Nextcloud/eBooks/Sachbücher/`.
- **M5 / VektorDB / `ebook_vectordb` NICHT anfassen** (dort läuft der `www`-Orchestrator; ein
  Re-Index könnte stören). Diese Pipeline arbeitet **rein lokal auf M3** über extrahierten Text.
- **Werkzeug:** `pdftotext` (poppler, via Homebrew installiert). Lehrbuch-PDFs haben saubere
  Textebene; Scans (ohne Text) werden vom Extraktor übersprungen.
- **Integritätsregeln (aus `AGENTS.md`):** jeder Fakt mit Quelle (**Buchtitel + Seite**), keine
  erfundenen Zahlen; **eigene Formulierung**, KEINE langen Wörtlich-Zitate (Copyright — Fakten/Titel
  sind frei, Prosa nicht); echte Umlaute; keine obskuren Objekte; Homo ohne Krankheiten; Politik-
  Ausschluss (s. Inhaltsregeln). Werte, die das Buch nicht hergibt, weglassen — nicht raten.
- **Arbeitsverzeichnis (extrahierter Text):** `$HOME/.cache/scientia_extract/` — **außerhalb des
  Repos**, NICHT committen (Copyright + Größe). Kandidaten-JSON der Agenten ebenfalls dorthin/`/tmp`.

## 1. Bestand (Stand 2026-06-17)

Neu hinzugefügt unter `Sachbücher/`:
- `Astronomie/` — **Der neue Kosmos** (Unsöld, 2. Aufl.) ≈ 160k Wörter, 451 S.
- `Biologie/` — **Campbell Biologie** ≈ 1,07 Mio W · **Spezielle Zoologie 1 + 2** (Westheide/Rieger) ≈ 490k + 453k W.

Der gesamte `Sachbücher/`-Ordner ist lokal hydriert (weitere Themen vorhanden: Informatik, Musik,
Pflanzen, Elektrotechnik … — relevant für künftiges **Machina**/Cultura-Musik/Natura-Botanik).

**Wichtige Eignungs-Erkenntnis (Proof v. 2026-06-17):** Bücher = etabliertes Grundlagenwissen.
Für **brandaktuelle** Rekorde/Objekte (z. B. R136a1, TON 618) bleibt **Wikidata/NASA primär** — eine
alte Lehrbuch-Auflage hat sie nicht. Bücher glänzen bei gesicherten Grundlagen + Verifikation.

## 2. Architektur (gilt für alle Wellen)

```
 (deterministisch, 0 LLM)            (Sonnet, parallel, produce-only)        (Opus, zentral)
 PDF ──pdftotext──► Text(+Seiten) ──► N Subagenten lesen lokale Slices ──► Gate: Dedup, Integritäts-
                    + Treffer/Chunks    → kompaktes JSON (Fakt+Quelle)       check, Plausibilität, Drop
                                                                              │
                                                ┌─────────────────────────────┘
                                                ▼
                         merge in <domain>_raw.json ──► node scripts/generate_<domain>.js
                         ──► node scripts/verify_facts.js <domain> (0 Fehler) ──► Browser-Run
                         ──► Commit pro Domain (+ Push minipc)
```

- **Parallelitäts-Deckel hier:** *nicht* ein externer Host (Dateien sind lokal), sondern die
  Subagent-Concurrency + der Hauptkontext-Budget. Sinnvoll **~8–10 Sonnet-Agenten pro Welle**,
  mehrere Wellen. Jeder Agent liest seine Slice via `Read` (billig für ihn) und gibt **kompaktes
  strukturiertes JSON** zurück — Rohtext NIE in den Hauptkontext.
- **Maximaler Durchsatz/Determinismus:** optional als **Workflow-Skript** (fan-out über Slices,
  `schema`-erzwungenes StructuredOutput, zentrales Gate). Braucht explizites Opt-in des Nutzers
  („use a workflow"/ultracode). Ohne Opt-in: wellenweise `Agent`-Aufrufe (mehrere pro Nachricht).

## 3. Zwei Phasen (Phase 1 zuerst — billig, sicher, ohne Generator-Änderung)

### Phase 1 — Gezielte Anreicherung bestehender Konzepte (grep-getrieben)
Wir lesen NICHT ganze Bücher, sondern suchen die **Namen bereits vorhandener Konzepte** im Buchtext
und geben den Agenten nur die Trefferpassagen. Bounded durch #Konzepte, nicht #Seiten → schnell.

1. **Extraktion:** `scripts/data_sources/extract/extract_pdftext.sh [Unterordner …]`
   → `$HOME/.cache/scientia_extract/<slug>.txt` (mit `===== Seite N =====`-Markern).
2. **Treffer-Finder:** `scripts/data_sources/extract/concept_passages.py <domain> [maxHits]`
   → `passages_<domain>.json` = `[{concept, category, hits:[{book,page,passage}]}]`.
3. **Sonnet-Agenten (parallel):** jeder bekommt **einen Batch von ~25–30 Konzepten** samt Passagen
   und liefert je Konzept: einen **belegten `funFact`** (eigene Formulierung, ≤ 200 Zeichen) +
   optional **Attribut-Bestätigung/Korrektur** (nur wenn das Buch den Wert klar nennt) +
   `quelle: "<Buchtitel>, S. <n>"`. Kein Treffer/zu dünn → leer lassen.
4. **Opus-Gate:** Plausibilität, keine Prosa-Zitate, Umlaute, Dedup gegen vorhandenen funFact;
   bei Attribut-Korrektur gegen bestehenden Wert + Wikidata gegenprüfen, bevor überschrieben wird.
5. **Merge:** funFact/`verifyNote` (`… ; belegt in <Buch> S.n`) ins bestehende Konzept in
   `<domain>_raw.json` → `generate_<domain>.js` → `verify_facts.js` → Browser → Commit.

**Ertrag:** sofort bessere Fakten + Quellenbelege, ohne Engine-Änderung. Ideal für Natura (Tiere via
Westheide, Biologie via Campbell) und Astra-Grundlagen (Unsöld).

### Phase 2 — Entdeckung NEUER Fakten/Konzepte (chunk-getrieben, größer)
Volltext durchgehen, um neue quiz-würdige Inhalte zu finden, die das Buch besonders gut hergibt.

- **Chunking:** `chunk_books.py` (zu bauen) splittet jeden Text in ~1.500–2.000-Wort-Stücke mit
  ~150 W Überlappung, je Chunk Seiten-Range; Manifest `chunks_manifest.json` steuert die Wellen.
- **Relevanz-Vorfilter** (kostensparend): Chunks ohne quizrelevante Substanz (Vorwort, Methoden,
  Glossar, Register, Aufgaben) per Heuristik/Headings überspringen — was übersprungen wird, **loggen**.
- **Zwei Ziel-Typen je Fakt** (Agent wählt):
  - **(A) Neues Konzept**, das in eine **bestehende** Kategorie passt (Schema exakt wie der jeweilige
    Generator erwartet; erlaubte Kategorien s. §4). Nur wo die Attribute wirklich im Buch stehen.
  - **(B) Sachfrage-MCQ** (statement-basiert): „Welche Aussage über X trifft zu?" o. ä. — der Hebel
    für die *qualitative* Buchstärke (Prozesse, Beschreibungen). **Voraussetzung:** ein neuer,
    generischer **Sachfrage-Fragetyp** im Generator + Anbindung ans Visual-Panel (s. §6, offene
    Entscheidung — von Opus VOR der Welle zu bauen).
- Gate/Merge/Verify/Commit wie Phase 1.

**Empfehlung:** Phase 2 mit **einem Pilot** beginnen (z. B. Unsöld, kleinstes Buch) → Prompt +
Distraktor-Qualität + Yield messen, dann skalieren. Erst Track (A) (passt in bestehende Engine),
Track (B) nach Bau des Sachfrage-Typs.

## 4. Erlaubte Zielkategorien je Domain (NUR diese — sonst entstehen Konzepte ohne Fragen)
Vor jeder Welle mit `grep "category ===" scripts/generate_<domain>.js` gegenprüfen.
- **Natura:** animal, plant, mineral, geology, fungus, biome, phenomenon, atmosphere.
- **Astra:** planet, dwarf_planet, moon, star, galaxy, nebula, asteroid, meteor_shower, exoplanet,
  mission, constant. (KEINE black_hole/quasar/neutron_star — Templates fehlen, eigenes Todo.)
- **Homo:** bone, body_fact, organ, muscle, species (KEINE Krankheiten).
- **Cultura/Lingua:** s. jeweiligen Generator.
Felder ohne Buchbeleg weglassen; mindestens 2 verwertbare Attribute, sonst Konzept verwerfen.

## 5. Agent-Prompt-Bausteine

**Phase-1-Enrichment-Agent (produce-only, model: sonnet):**
> Du bekommst einen Batch bestehender Quiz-Konzepte mit Buch-Passagen (`passages_<domain>.json`,
> Indizes X–Y). Für JEDES Konzept: lies die Passagen und gib, falls inhaltlich tragfähig, einen
> **belegten funFact** in EIGENER, knapper deutscher Formulierung (≤ 200 Zeichen, kein wörtliches
> Zitat) zurück, plus `quelle: "<Buchtitel>, S. <n>"`. Wenn das Buch einen unserer Attributwerte
> klar nennt und er abweicht, melde das separat als `attribut_korrektur` (nicht selbst überschreiben).
> Erfinde nichts; kein Treffer/zu vage → Konzept auslassen. Echte Umlaute. Ausgabe: JSON-Array
> `[{concept, funFact, quelle, attribut_korrektur?}]` nach `/tmp/enrich_<domain>_<batch>.json`.
> KEIN Commit, KEIN Schreiben in _raw.json.

**Phase-2-Discovery-Agent (produce-only, model: sonnet):** analog, liest Chunk-Slice, liefert
Track-(A)-Konzepte (Schema des Generators) und/oder Track-(B)-Sachfragen
`{domain, thema, frage, richtige_antwort, distraktoren[3], schwierigkeit, quelle}` — Distraktoren
plausibel, gleiche Dimension, nicht trivial ausschließbar; Antwort nicht im Fragewortlaut.

## 6. Offene Entscheidungen (für die ausführende Session, mit Empfehlung)
1. **Sachfrage-Fragetyp bauen?** (Track B) — größter Hebel für Buchwissen, aber Engine-Arbeit:
   generischer statement-MCQ-Generator + Distraktor-Strategie + Selbstverräter-Guard + **Visual-
   Anbindung** (jede Frage braucht links ein Visual — an welches Konzept/Bild bindet eine freie
   Sachfrage?). *Empfehlung:* zuerst Phase 1 + Track A liefern ohne Engine-Änderung; Track B als
   bewusster Folgeschritt mit eigenem kleinen Design.
2. **Reihenfolge der Bücher:** *Empfehlung* Natura zuerst (Campbell/Westheide am ergiebigsten +
   Bereich profitiert sofort), dann Astra (Unsöld, Grundlagen), dann weitere Themen (Machina etc.).
3. **Workflow vs. Agent-Wellen:** bei sehr vielen Chunks Workflow-Skript (Opt-in nötig).

## 7. Kickoff der nächsten Session
```bash
cd ~/git/ScientiaPotentia
# 1) Text extrahieren (neue Bücher; ohne Arg = alle Sachbücher):
scripts/data_sources/extract/extract_pdftext.sh Astronomie Biologie
# 2) Phase-1-Trefferpassagen je Domain:
python3 scripts/data_sources/extract/concept_passages.py natura 3
python3 scripts/data_sources/extract/concept_passages.py astra 3
# 3) passages_<domain>.json in Batches schneiden, ~8–10 Sonnet-Enrichment-Agenten parallel
#    starten (Prompt §5), Ergebnisse zentral mit Opus gaten, mergen, generate+verify, Browser, Commit.
# 4) Danach Phase-2-Pilot (chunk_books.py bauen, Unsöld) — Yield/Qualität messen, dann skalieren.
```
Gerüst-Skripte liegen unter `scripts/data_sources/extract/` (getestet 2026-06-17).
