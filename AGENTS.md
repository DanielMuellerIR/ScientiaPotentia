# Scientia — Multi-Domain-Wissensquiz

> **Name/Leitspruch:** Das Quiz heißt **Scientia**. *„Scientia potentia est"* (Wissen ist
> Macht) ist der Leitspruch und erscheint nur an passenden Stellen (Header-Tooltip, README,
> künftiger About-Dialog), nicht als Produktname.

> **Stand: 2026-07-12.** Lebendes Dokument, zentrale Quelle für Projektfakten.
> Die datierte Versions-Chronik ist nach [CHANGELOG.md](CHANGELOG.md) ausgelagert;
> stehende Regeln/Entscheidungen stehen unter „Stehende Entscheidungen & Lehren".

Aus dem ursprünglichen Geografie-Quiz („Terra Weltatlas") entsteht ein mehrteiliges
Wissensspiel **Scientia** mit eigenständigen Wissensbereichen (Domains), je mit
eigenem Lernfortschritt (Spaced Repetition / SM-2). Terra (Geografie) ist der erste, voll
ausgebaute Bereich; weitere folgen je einzeln und launchfähig.

Geplante Bereiche: **Terra** (Geografie), **Astra** (Astronomie), **Homo** (Mensch & Körper),
**Natura** (Natur & Umwelt), **Cultura** (Kultur), **Lingua** (Sprachen).

- **Zielplattform:** Web-App (responsive), optional Desktop-Wrapper (Tauri).
- **Philosophie:** werbefrei, visuell hochwertig (Glassmorphic Dark / Karten-Rendering),
  datenschutzfreundlich, offline-fähig. Qualität vor Mengen-Quote; jeder Fakt mit Quelle.

---

## Typ & Zweck
- **Typ:** Spiel (Quiz)
- **Zweck:** Responsives Multi-Domain-Wissensquiz mit interaktiver Weltkarte und Spaced-Repetition-Lernfortschritt.
- **Plattform:** Web

## 🧭 Aktueller Stand & Architektur (Stand 2026-06-04)

### Status
| Phase | Inhalt | Stand |
| :---- | :----- | :---- |
| Phase 0 | Domain-Abstraktion, Terra unverändert | ✅ erledigt (v1.4.0) |
| Phase 1 | Astra (MCQ-only) + DomainSwitcher | ✅ erledigt (v1.5.0) |
| Phase 3 | Homo (MCQ-only) | ✅ erledigt (v1.6.0) |
| Phase 2a | Visual-Backbone: linkes Panel zeigt pro Frage das gefragte Konzept (`VisualPanel`/`ConceptVisual`) | ✅ erledigt (v1.7.0) |
| Phase 2b | Astra 3D-Himmelskörper (three.js + NASA/SSS-Texturen) | ✅ erledigt (v1.8.0) |
| Phase 2c | Homo Anatomiegrafiken (Wikimedia PD) pro Frage | ✅ erledigt (v1.9.0) |
| Phase 2d | Konzeptgenaue Hervorhebung (Astra Kontext-Karte, Homo Struktur-Marker) | ✅ erledigt (v1.11.0) |
| Phase 5 | **Content-Ausbau auf 5000 Fragen/Bereich** (mehr Fragetypen + Konzeptausbau) | offen, laufend (v1.16.0: Astra 146K/554F, Natura 98K/480F) |
| Phase 4 | **Natura (MCQ-only)** als Domain verdrahtet (Merge→Generator→Registry, 98 Konzepte/302 Fragen) | ✅ erledigt (v1.14.0) |
| Phase 4–6a | **Lingua als Domain verdrahtet** (Registry + ConceptVisual-Labels, Generator auf 22 Fragetypen erweitert) | ✅ erledigt (v1.17.0: 103 Konzepte/266 Fragen, Browser-verifiziert) |
| Phase 4–6b | **Cultura als Domain verdrahtet** (Registry + ConceptVisual-Labels für 8 Kategorien/65 Attribute) | ✅ erledigt (v1.18.0), per MiniMax-Delegation ausgebaut auf 155 Konzepte/645 Fragen (v1.19.0), Browser-verifiziert |

**Layout/Frontend-Konvention (Stand 2026-06-10):** Das responsive Shell-Layout folgt einem
verbindlichen Vertrag — Shell-Geometrie lebt in CSS-Klassen + CSS-Variablen (`src/index.css`),
nicht in Inline-Styles; Details und Begründung in [`LAYOUT.md`](LAYOUT.md). Vor/nach Layout-Arbeit
`npm run check:layout` ausführen (maschineller Regressionsschutz, kein Browser nötig).

**Neue verbindliche Anforderungen (Stand 2026-06-04, Nutzer-Vorgabe):**
- **Jede Quizfrage MUSS links eine passende Visualisierung zeigen** (sonst „todlangweilig"). Umgesetzt
  über `VisualPanel` → `domain.Visual` (lazy). Terra=Karte, Astra=3D, Homo=Anatomie, Rest=`ConceptVisual`.
- **Ziel 5000 Fragen/Bereich** ist jetzt hartes Ziel. Weg: **mehr distinkte Fragetypen je Konzept +
  Konzeptbasis ausbauen**, kontrolliert auf Repetitivität geprüft (ersetzt die alte „kein Templating"-Regel).
- **Bildmaterial:** copyright-frei (PD/CC0) oder wissenschaftlich korrekt prozedural; CC-BY mit
  sichtbarer Attribution. **Lizenz jedes Assets klein im Panel anzeigen.** Assets gebündelt (offline).

Der frühere Arbeitsplan `implementation_plan.md` (Wegwerf-Dokument der Frühphase) liegt
archiviert unter `docs/archive/` — zusammen mit `RECONSTRUCTION-TODO.md`,
`mobile-layout-plan.md` und `koerper_fakten_prozess.md` (alle erledigt/veraltet, 2026-07-12).

## Datei-Verzeichnis

| Datei | Wozu |
| :--- | :--- |
| [README.md](README.md) | Knapper Projekteinstieg, verweist für Status/Zahlen/Architektur auf AGENTS.md. |
| [CHANGELOG.md](CHANGELOG.md) | Datierte Versions-Chronik (aus AGENTS.md ausgelagert, 2026-07-12). |
| [docs/bereichs_abgrenzung.md](docs/bereichs_abgrenzung.md) | Zuordnungs-Matrix mit Primär-Owner je Grenzfall, maßgeblich vor neuen Inhalts-Wellen. |
| [docs/bildquellen_strategie.md](docs/bildquellen_strategie.md) | Strategiepapier für mehr freie Museum-Bilder je Domain mit Verifizierter Ausgangslage. |
| [docs/content_pipeline.md](docs/content_pipeline.md) | Vereinbarter Ablauf, um die Wissensbereiche auf 1000/2000/5000 Fragen zu bringen. |
| [docs/extraktion_sachbuecher_plan.md](docs/extraktion_sachbuecher_plan.md) | Ausführungsreifer Plan zur parallelen Faktenextraktion aus lokalen Sachbüchern. |
| [docs/homo_erweiterung.md](docs/homo_erweiterung.md) | Strategiepapier: Homo-Ausbau jenseits der Anatomie (neue Kategorien, ehrliches Ceiling). |
| [docs/homo_erweiterung_runde2.md](docs/homo_erweiterung_runde2.md) | Homo-Erweiterung Runde 2: Recherche, Fragen-Ernte, Bildquellen. |
| [docs/wissensquellen.md](docs/wissensquellen.md) | Kuratierte freie Wissensquellen je Bereich zum Selbstentwickeln von Fragen. |
| [docs/wissensquellen_extern.md](docs/wissensquellen_extern.md) | Externe Quellen (YouTube, E-Book-Korpus): Nutzungsprinzip und Kanal-Auswahl. |
| [scripts/data_sources/harvest/README.md](scripts/data_sources/harvest/README.md) | Ernte-Ordner-Zwischenstand, noch nicht in die raw-Dateien gemerged. |
| [scripts/qa_review/README.md](scripts/qa_review/README.md) | MiniMax-gestützte inhaltliche Qualitätssicherung der Quizfragen. |

### Domain-Abstraktion (das tragende Konzept)
- **Registry `src/domains/index.js`** — Liste aller Domains. Jede liefert `loadConcepts()`
  (Map `conceptKey -> Konzept`) und `loadQuestions()` (Array MCQ-Fragen), lazy per fetch/import.
  Felder: `id, latinName, label, description, Icon, accent, hasMap`.
- **Konzept-Key-Schema:** Terra unpräfixt (`FJ`, `Q64`), alle anderen `"<domain>:<id>"`
  (z. B. `astra:mars`). Ein fehlendes `:` bedeutet immer Terra → keine IndexedDB-Migration
  bestehender Terra-Fortschritte nötig.
- **`App.jsx`** hält `activeDomainId`; Konzepte + Fragen werden je Wechsel geladen. Fällige/neue
  Konzepte und alle Panels arbeiten über den domain-agnostischen Speicher (`domainDb = {entities}`),
  nicht mehr fix über `geodb`.
- **`DomainSwitcher.jsx`** (Header-Dropdown), **`DomainVisual.jsx`** (linkes Panel für Domains
  ohne Karte; Terra zeigt `Map.jsx`). **`Dashboard.jsx`** ist domain-aware (generische Kategorie-
  Aufschlüsselung; geografiespezifische Spielmodi nur bei Terra).
- **DB v2 (`src/utils/db.js`):** `progress`-Records haben Feld `domain` (aus Key abgeleitet) +
  Index `domain`. Additiv abwärtskompatibel, migriert keine Keys.
- **SRS trackt Konzepte, nicht Fragen.** Mastery = Anteil Konzepte mit `repetitions > 0` je Domain.

### Datendateien
- `public/data/questions_terra.json` (5217 Fragen) + `geodb.json` (Terra-Konzepte, statisch).
- `public/data/concepts_<domain>.json` + `questions_<domain>.json` je neuer Domain.
- `scripts/data_sources/<domain>_raw.json` — verifizierte Faktenbasis mit `source` je Konzept.
- `docs/wissensquellen.md` — kuratierte, lizenz-verifizierte freie Wissensquellen je Bereich
  (Recherche-Input für manuelle Fragenentwicklung; Fakten frei, Lizenzen nur bei Textübernahme).

### Eine neue Domain hinzufügen (erprobter Ablauf)
1. **Faktenbasis recherchieren** (Multi-Agent-Workflow): Kategorien fächern, je Konzept
   `attributes` + `sourceName`. Adversarialer Verify-Pass korrigiert Zahlen. Ergebnis nach
   `scripts/data_sources/<domain>_raw.json`. Werte manuell stichprobenprüfen.
2. **Generator `scripts/generate_<domain>.js`** schreiben (Frage-Templates je Kategorie;
   Distraktoren aus derselben Kategorie/demselben Attribut) → erzeugt `concepts_<domain>.json`
   + `questions_<domain>.json` in `public/data/`.
3. **`node scripts/verify_facts.js <domain>`** (Struktur + Provenance; 0 Fehler).
4. **Registry-Eintrag** in `src/domains/index.js` ergänzen (`hasMap:false` für MCQ-only).
   Dashboard/Switcher/Visual sind bereits generisch — keine weiteren UI-Änderungen nötig.
5. **Browser-Run** der neuen Domain (Wechsel, Quizrunde, keine Konsolenfehler).

### Bereichs-Content (Stand)
| Domain | Konzepte | Fragen | Quellen | Visualisierung |
| :----- | :------- | :----- | :------ | :------------- |
| Terra  | 1852 | 5217 | Natural Earth / GeoNames / Wikidata | Weltkarte (MapLibre), pro Frage Highlight |
| Astra  | 1560 | 5035 | NASA / IAU / ESA / Wikidata | **3D-Himmelskörper (three.js)** + Kontext-Karte (Bahn/Distanz), Texturen Solar System Scope (CC BY 4.0); 478 Museumsbilder |
| Homo   | 599 | 1600 | Gray's Anatomy / Prometheus / NIH / MedlinePlus / StatPearls / OpenStax / Wikipedia | **Anatomiegrafiken (Wikimedia, PD)** + konzeptgenauer Struktur-Marker je Frage; ab v1.52 zehn Physiologie-Kategorien jenseits der Anatomie; v1.74/v1.75 Vertiefung + sleep_perception; **v1.82 Runde 2**: +114 Konzepte/+204 Fragen (psych_effect→94, hormone→41, muscle→83, nerve→29 u. a.) + 3 neue Kategorien joint/reflex/blood_group; 306 Museumsbilder (Physiologie-Kategorien erstmals bebildert; v1.84.1 +2 reflex-GIFs, vitamin/nutrient_macro-sourceUrl entzerrt) — Richtung ehrliches Ceiling (~1500–1700, NICHT 5000 — docs/homo_erweiterung.md §4; Runde 2: docs/homo_erweiterung_runde2.md §4) |
| Natura | 2402 | 13217 | Wikipedia / USGS / IUCN / IPCC / Wikidata | generische Konzeptkarte (`ConceptVisual`); Tiere via MiniMax-Delegation 49→97 ausgebaut (web-grounded); freies Commons-Foto je Konzept hinterlegt (`concept.image`, fürs spätere Museum) |
| Lingua | 1207 | 5540 | Wikipedia / Ethnologue / Wiktionary / Guinness / Wikidata | generische Konzeptkarte (`ConceptVisual`) mit dt. Attribut-Labels; 184 Museumsbilder (writing_system/language_family) |
| Cultura | 2018 | 7440 | Wikipedia (DE/EN) / Wikidata | generische Konzeptkarte (`ConceptVisual`) mit dt. Kategorie-/Attribut-Labels; via MiniMax-Delegation ausgebaut (Komponisten Wikidata-geprüft, Werke web-grounded); ab v1.83 Kategorie `genre_fiction` (Populärliteratur SF/Fantasy/Horror/Krimi, Auswahl aus Daniels eBook-/Hörbuch-Sammlung; v1.84.2 Claire North; **v1.85.0 R2-Welle: +83 Nur-Hörbuch-Autoren → genre_fiction 123→206**; **v1.85.2 R2-Welle-2-Pilot: +14 Werke/12 Autoren → 206→220**; **v1.85.3: 4 Pilot-Werke bebildert** (Laßwitz/Chabon/Brockmeier/Galbraith)); 1048 Museumsbilder (v1.85.1: genre_fiction über freie **Autorenporträts** bebildert, 179 Werke; v1.85.3 +4 → 183) |
| Machina | 2165 | 6131 | Wikipedia / RFC/IANA / Lehrbücher / DIN 8580 | generische Konzeptkarte (`ConceptVisual`) mit dt. Labels; Achse Funktionsprinzip (v1.47.0); ab v1.71 auch klassische Technik (Handwerk/Mechanik/Maschinenbau): tool/machine_element/engine/manufacturing_process/material/simple_machine (2 Wellen, v1.71+v1.73); 124 Museumsbilder (hardware) |
| Historia | 1244 | 6332 | Wikipedia / Wikidata | generische Konzeptkarte (`ConceptVisual`) mit dt. Labels; Achse Zeit/Urheberschaft, Politik-Ausschluss (v1.47.0); 1023 Museumsbilder |

### Visualisierung pro Frage (Stand 2026-06-04)
- **`src/components/VisualPanel.jsx`** wählt: Terra→`Map`, Domain mit `domain.Visual`→diese (lazy),
  sonst aktives Konzept→`ConceptVisual` (generische Karte), sonst→`DomainVisual` (Übersicht).
- **`Quiz.jsx`** meldet je Frage das gefragte Konzept hoch (`onActiveConceptChange`), **`App.jsx`** hält
  `activeConceptKey` und reicht es an `VisualPanel`.
- **`AstraVisual.jsx`** (three.js): rotierende Kugel mit echter Textur (Sonne/8 Planeten/Erdmond) bzw.
  prozedural (Zwergplaneten/Monde/Sterne/Galaxien), Konstanten als Wertanzeige; Sternenfeld-Hintergrund.
  **Phase 2d:** `AstraContextMap` (Inset unten links) verortet das Konzept — Planet/Zwergplanet/Mond
  im Bahn-Schema (zugehörige Bahn leuchtet), Stern/Galaxie auf log. Entfernungsskala (Erde→Objekt).
- **`HomoVisual.jsx`**: gemeinfreie Anatomiegrafik je Kategorie + Konzept-Overlay + Lizenzzeile.
  **Phase 2d:** pulsierender Marker genau auf der gefragten Struktur. Da die PD-Grafiken keine
  Struktur-IDs tragen, kalibrierte Koordinaten: `MARKER_BY_ID` (bekannte Konzepte exakt) +
  Region/Lage/System-Zonen (neue Konzepte automatisch). Ganzkörper-Fakten ohne Marker. 100% Abdeckung
  für Knochen/Muskel/Organ. Bild im aspektgenauen Rahmen (height:100%/width:auto), damit Marker passen.
- **Asset-Ablage:** `public/assets/<domain>/…` inkl. `CREDITS.md` (Quelle+Lizenz je Datei).

### Inhaltsregeln (verbindlich)
- Keine erfundenen Fakten; Quelle pro Fakt. Fairness: keine obskuren Objekte.
- **Echte Umlaute Pflicht (ä ö ü ß), niemals ASCII-Ersatz (ue/ae/oe/ss) im ganzen Spiel.**
  Gilt für alle angezeigten Inhalte (Prompts, Antworten, Konzeptnamen, FunFacts, Attribute).
  Recherche-/LLM-Output liefert oft ASCII-Deutsch → vor dem Generieren bereinigen.
  Helfer: `node scripts/fix_umlauts.js` (handkuratierte Wort-Liste, Ersatz nur als ganzes Token;
  korrekte ss-Wörter, Eigennamen und lat. Begriffe bleiben unberührt). **Kein blindes
  Suchen-Ersetzen** — ue/ae/oe/ss stecken in vielen korrekten Wörtern (Masse, Wasser, Fluss …).
- Distraktoren plausibel, gleiche Kategorie, nicht trivial ausschließbar. **Gleiche Dimension/
  Einheit:** zu „Blutvolumen → ca. 5 Liter" niemals „32 Zähne"/„206 Knochen" als Distraktor.
  Numerische Eckwerte streuen um den korrekten Wert mit gleicher Einheit (siehe
  `bodyFactDistractors` in `generate_homo.js`).
- **Antwort darf nicht im Fragewortlaut stecken (Selbstverräter-Test).** Wenn der deutsche
  Name die Antwort verrät, ist die Frage schlecht bzw. höchstens Stufe 1. Beispiele:
  „In welcher Region liegt der **Wade**nbein?" → „Bein" steckt drin. „…der **Kau**knochen?"
  → Kopf trivial. Schwierigkeit muss den **Bekanntheitsgrad** widerspiegeln, nicht das Template.
- Copyright: keine geschützten Texte/langen Zitate, keine namentlichen Rekorde lebender Personen.
- Homo: keine Krankheiten, keine Kultur. Natura: Klimawandel nach IPCC-Konsens. Cultura zuletzt.
- **Politik-Ausschluss (global, Stand 2026-06-17):** Gegenwarts-/Tagespolitik, aktuelle
  Parteien/Regierungen/Wahlen sowie Wirtschaftssystem-Debatten (Kapitalismus/Sozialismus/-ismen,
  Wertungen, Schuldfragen) bleiben draußen — in **allen** Bereichen und bereits bei der Quellenwahl
  (YouTube/E-Books). **Historische** Politik ist nur als nüchterne, datierbare Fakten ohne Wertung
  zulässig (Jahreszahlen, wer gründete/erfand was, Epochen, Verträge als Daten). Gilt besonders für
  den geplanten Bereich Historia (Schwerpunkt Kultur/Wissenschaft/Technik).

### Externe Wissensquellen (YouTube, E-Book-Korpus)
Kuratierte, seriöse Quellen je Bereich + Nutzungsprinzip stehen in
[`docs/wissensquellen_extern.md`](docs/wissensquellen_extern.md). **Kernregel:** kuratierte
Kanäle/Bücher sind die **Entdeckungs-/Notabilitätsschicht** (welche Objekte/Themen aufnehmen),
**niemals die Faktenschicht** — Werte kommen weiter aus Wikidata/NASA/IUCN/Gray's etc., bei
E-Books aus dem Sachbuch-Volltext mit verbatim-Verifikation. Zugangs-/Hostdetails zum
E-Book-Korpus (Projekt ebook_vectordb, M5): zentral im theplan-knowledge.

### Befehle
`npm run dev` (Port 3000) · `npm run build` · `node scripts/generate_<domain>.js` ·
`node scripts/verify_facts.js <domain>` · `node scripts/verify_quiz.js` (Terra) ·
`node scripts/merge_phase5.js [--write]` (Einmal-Helfer: Recherche-Konzepte deduppen+putzen+anhängen) ·
`node scripts/merge_natura.js [--write]` (Harvest→natura_raw.json: Key-/Wert-Normalisierung + Dedup) ·
`node scripts/generate_natura.js`.

> **Natura-Verdrahtung (v1.14.0):** Vorlage für Lingua/Cultura. Stolperstein war die
> **uneinheitliche Ernte**: zwei Finder-Konventionen (Deutsch `maxGewichtKg`/`gefaehrdungsstatus`
> vs. Englisch `maxWeightKg`/`status`) UND zwei Werte-Sprachen (`klasse`="Säugetiere" vs.
> "Mammalia"; Status dt.+Code vs. engl. Wort). `merge_natura.js` kanonisiert deshalb **Keys**
> (→ englisch) UND **Werte** (Tierklasse → eine dt. Form; IUCN-Status → dt. Bezeichnung+Code,
> mehrdeutige bleiben Originaltext und werden in der Status-Frage übersprungen). Ohne das
> zerfallen die kategorie-internen Distraktor-Pools. `generate_natura.js` zieht numerische
> Distraktoren aus **rohen Zahlen** (echt nächstliegend) statt aus formatierten Strings.
> Bilder lagen schon aufgelöst in der Ernte (Phase C); `concept.image` führt sie fürs Museum mit.

> **Natura — offene Schritte (Stand 2026-06-06):**
> 1. **Bilder geprüft, aber unsichtbar.** `node scripts/check_images.cjs scripts/data_sources/natura_raw.json`
>    bestätigt **98/98** Commons-Bilder live: existieren, Bild-MIME, freie Lizenz. ABER: sie werden
>    **nirgends angezeigt** — das linke Quiz-Panel (`ConceptVisual`) rendert nur das Domain-Icon, und
>    es gibt **kein Natura-Museum**. Die Bilder liegen also brach. Gespeichert ist die Commons-**Dateiseite**
>    (`/wiki/File:…`); zum Anzeigen `https://commons.wikimedia.org/wiki/Special:FilePath/<Dateiname>?width=…`
>    nutzen (302-Redirect auf die echte Datei, direkt in `<img>` verwendbar).
> 2. **TODO Museum (Erkundungsbereich).** Wiederverwendbare, themebare Galerie bauen — Muster:
>    `SolarSystemExplorer.jsx` + Explorer-Verdrahtung in `App.jsx` (Tab „explore", nur wenn `domain.Explorer`
>    gesetzt; Felder `Explorer`/`explorerLabel`/`ExplorerIcon` in `src/domains/index.js`). Grid aller
>    Konzepte mit Foto (Special:FilePath), Kategorie-Filter, Detail mit Attributen/FunFact/Quelle+Lizenz.
>    Danach Bilder visuell stichproben (Resolver nahm „erstes freies Treffer" → thematische Eignung prüfen).
> 3. **TODO Content-Ausbau.** Aktuell **97 Tiere** (146 Konzepte gesamt) — via MiniMax web-grounded ausgebaut. Weiter sammeln
>    (Schwerpunkt Tiere) per `content_pipeline.md`: Harvest → Phase C Bilder → `merge_natura.js` → `generate_natura.js`.
> 4. **Hinweis (Stand 2026-06-20):** Astra trägt inzwischen `image` (183 Museumsbilder, erledigt).
>    Offen bleibt **Homo** — `concepts_homo.json` hat **kein** `concept.image` (0 Museumsbilder);
>    Homo nutzt bisher nur die Anatomie-Assets (`HomoVisual`).
Browser-Preview-Config: `.claude/launch.json` (Server „dev", Port 3000; nicht eingecheckt).

---

## 🧱 Stehende Entscheidungen & Lehren

> Lebende Arbeitsregeln, aus den früheren Chronik-Blöcken herausgezogen (kompakt, mit
> Datum). Die vollständigen Kontexte stehen in [CHANGELOG.md](CHANGELOG.md).

### Grundsatz-Entscheidungen (Daniel)
- **Triage-Entscheidung Selbstverräter (2026-07-01):** Semantische **Name-im-Prompt-Fälle**
  (ein Trivialname wie „Hammerhai" verrät die Kategorie „Knorpelfische") gelten als
  **akzeptabel und werden NICHT gefiltert** — das ist legitimes Allgemeinwissen, kein Defekt.
  Die übrigen im per-type-Sweep geflaggten Cluster (`-rev`/kategorische Typen, `cultura-quote-*`)
  sind NICHT pauschal akzeptiert, sondern Aufgabe einer künftigen, QA-gegengeprüften Content-Runde
  (frischer Sweep auf gefixten Daten als Start).
- **Code-Review-Triage-Entscheidung (2026-07-01):** Die agentische MiniMax-Nacht-Code-Review
  vom 2026-06-26 (386 rohe Bullet-Funde) ist als **zu rauschlastig abgehakt** — kein
  Per-Fund-Abarbeiten. Das echte Signal wurde handverifiziert destilliert (Report `2026-06-28.md`),
  der lohnende Teil (7 Funde) in Commit `ee8d626` gefixt. Beide Reports tragen den `done`-Marker,
  **nicht erneut aufgreifen**.
- **Schwierigkeitsstufen abgeschafft (2026-06-20):** `difficulty` wurde pro Fragen-Template
  vergeben (nicht nach echter Rate-Schwierigkeit) → Stufen entfernt, Quiz zieht zufällig aus dem
  ganzen Pool (SRS-Priorisierung bleibt). Das `difficulty`-Feld bleibt ungenutzt in den Daten.

### Integrität & Verifikation
- **Integritätsregel (hart):** Jeder Fakt mit Quelle, keine erfundenen Zahlen. Bei LLM-Recherche
  **adversarialer Faktencheck PLUS manuelle Stichprobe vor Commit**. Wenn eine Entscheidung viele
  Fragen invalidiert → erst Daniel fragen.
- **Gestufte Verifikation (Phase-5-Runde 2, 2026-06-05):** Autoritative Quellen (Wikidata, NASA
  Fact Sheets, JPL, Gray's 1918, USGS) gelten als belegt; nur schwächere Quellen voll prüfen.
  Quelle ist Pflicht je Fakt UND je Bild.
- **Subagent-Finder nie committen/pushen lassen.**
- **MiniMax-Schwäche (Quality-Log):** schmuggelt trotz Verbot wiederholt Entdeckungsdaten/-personen
  in funFacts (gehört nach Historia) → in der Opus-Verifikation gezielt darauf prüfen.

### Content-Lehren (was sich bewährt / nicht bewährt hat)
- **Wikidata-Massenernte braucht Notabilitäts-Ranking (cultura-wd1-Lehre, 2026-06-17):** IUCN+P18+dewiki
  ist als Notabilitätsfilter ZU SCHWACH → erst `wikibase:sitelinks ≥ 12` (je Kategorie 8–25) trennt
  bekannte von obskuren Objekten. Zusätzlich **P31/P106/P27-Validierung**, sonst alphabetischer/
  kontaminierter Müll.
- **Buch-Ernte (Track A) lohnt nur bei Objekt-/Art-KATALOGEN** (Grzimek/Westheide ~1,5 Treffer/Seite),
  NICHT bei Konzept-Lehrbüchern (~0,04/Seite, 2026-06-17). Astra-Wachstum bleibt bei Wikidata-Harvests.
- **Astra-Buchanreicherung meiden (2026-06-17):** Fehltreffer-Pollution (Asteroidennamen = Bio-Begriffe),
  veraltete Werte in alten Auflagen → Attribute NIE mit alten Buchwerten überschreiben.
- **apparentMagnitude (Wikidata P1215)** hat pro Stern mehrere Photometrie-Bänder (V/B/IR) → nur
  gesicherte **V-Band-Helligkeit** übernehmen.
- **PD-Gate †≤1955:** Zitate/Texte nur von Autoren, die spätestens 1955 verstorben sind (verbatim aus
  Wikiquote); seit 2026-01-01 sind †1955 (Einstein/Th. Mann) frei. Copyright-Landmine: Foto eines
  geschützten Werks (Guernica) → `harvest/BLACKLIST.md`.
- **Externe Quellen = Entdeckungs-/Notabilitätsschicht, nie Faktenschicht** (Kurzgesagt/eBooks nur
  „welche Objekte aufnehmen"; Werte weiter aus Wikidata/NASA/IUCN/Gray's).

### Pipeline-Fallen
- **Dedup nur kategorie-intern**, NIE kategorieübergreifend; manuelle semantische Stichprobe bleibt
  Pflicht (Algorithmen finden semantische Dubletten nicht — Phase-5-Runde 1).
- **Sammel-LLMs erfinden Bild-URLs** → Bilder nur **deterministisch** auflösen (Phase C, `resolve_images*`).
- **Verbose Antwort-Felder kürzen** (Klammerzusätze in MCQ = Längen-Giveaway).
- **ASCII-Deutsch-Falle:** Recherche-/Agent-Output liefert oft `ue/ae/oe/ss` und ASCII-`"` als
  Schlusszeichen → deterministischer Umlaut-/Anführungs-Fix im Gate VOR dem Generieren (kein blindes
  Suchen-Ersetzen, siehe Inhaltsregeln).
- **Generator-Hebel zuerst** (Fragen/Konzept token-frei via Templating hochziehen), erst dann die
  Konzeptmenge skalieren.
- Weitere operative Tooling-Fallen (Legacy-`merge_<domain>.js` löschen Direkt-Appends; recycelte/
  generische IDs; **Datenfixes immer in `scripts/data_sources/<domain>_raw.json`, NIE in
  `public/data/concepts_<domain>.json`**): siehe Todos §1c **FALLEN**.

---


---

## 📋 Inhaltsverzeichnis
- [Projektbeschreibung](#-projektbeschreibung)
- [Rechercheergebnisse (Codex-Subagents)](#-rechercheergebnisse-codex-subagents)
  - [Marktanalyse & Wettbewerb (Herschel)](#1-marktanalyse--wettbewerb-herschel)
  - [Geodaten & Quellen (Parfit)](#2-geodaten--quellen-parfit)
  - [Rechtliches & Lizenzen (Avicenna)](#3-rechtliches--lizenzen-avicenna)
  - [Rendering- & Kartentechnik (Einstein)](#4-rendering--kartentechnik-einstein)
  - [Quizdesign & Progression (Maxwell)](#5-quizdesign--progression-maxwell)
- [Offene Todos & Nächste Schritte](#-offene-todos--nächste-schritte)
- [Projektstruktur](#-projektstruktur)

---

## 🎯 Projektbeschreibung
Das Ziel ist ein Geografie-Spiel, das über ein reines Trivia-Quiz hinausgeht. Es kombiniert einen erkundbaren, ästhetisch ansprechenden Atlas mit spielerischen, adaptiven Lernelementen. Der Fokus liegt auf der physischen und politischen Geografie (Länder, Hauptstädte, große Flüsse, Gebirge, Sehenswürdigkeiten).
- **Zielplattform:** Web-App (responsive) mit optionalem Desktop-Wrapper (z. B. Tauri) für macOS, Windows und Linux.
- **Philosophie:** Werbefrei, visuell hochwertig, flüssiges Rendering, datenschutzfreundlich und offline-fähig (im Rahmen begrenzter Detailstufen).

---

## 🔍 Rechercheergebnisse (Codex-Subagents)

Die Rohdaten der Recherche befinden sich in den exportierten Sitzungsprotokollen unter [codex_research_raw/](codex_research_raw/).

### 1. Marktanalyse & Wettbewerb (Herschel)
*Zusammenfassung basierend auf [Herschel_ad1a-d13a7be4757d.md](codex_research_raw/2026-06-03_Herschel_ad1a-d13a7be4757d.md)*

| Wettbewerber | Plattform | Preis | Stärken / UX | Lücke für unser Projekt |
| :--- | :--- | :--- | :--- | :--- |
| **Seterra** | Web, iOS, macOS (M1+) | Free / IAP | Über 400 anpassbare Quizze, sehr bekannt, breite Abdeckung. | Sehr quizlastig, wenig Entdecken, veraltete UI, keine Erklärungsebene. |
| **GeoGuessr** | Web, iOS, Android, Steam | Freemium ($3.99/mo) | Street View (Immersive), Multiplayer, starke Marke. | Keine klassische Karten/Lernstruktur. Teure APIs machen es limitiert. |
| **Worldle / Globle** | Web, Mobile | Free / Premium | Schnelles Daily-Format (Silhouette / Heatmap-Globus). | Nur eine Aufgabe pro Tag, kein tieferes Lernen. |
| **Lizard Point** | Web | Free | Umfassend (Länder, Hauptstädte, Flüsse, Berge). | UX extrem altbacken, keine spielerische Progression. |
| **Sporcle / JetPunk** | Web, iOS | Free (Ads) / Premium | Riesiger Trivia-Katalog (UGC-basiert). | Textlastig, Werbeanzeigen, stark schwankende Content-Qualität. |

> [!NOTE]  
> **Die Marktlücke:** Es fehlt ein ruhiges, ansprechendes **interaktives Wissens- und Quiz-Spiel**. Die Lücke liegt in der Kombination aus freiem Entdecken (Klick auf Karte zeigt Fakten), geführten Lernpfaden, adaptiver Wiederholungslogik (Spaced Repetition) und einer klaren, werbefreien Ästhetik.

---

### 2. Geodaten & Quellen (Parfit)
*Zusammenfassung basierend auf [Parfit_aa63-4942f79b0f78.md](codex_research_raw/2026-06-03_Parfit_aa63-4942f79b0f78.md)*

- **Natural Earth:** Der Grundpfeiler für alle Basiskarten. Enthält administrative Grenzen (Admin-0, Admin-1), Städte, Flüsse, Seen, Autobahnen und physische Strukturen. Vektor- und Rasterdaten in Skalierungen 1:10m, 1:50m und 1:110m.
- **GeoNames:** Für weltweite geografische Eigennamen, Koordinaten und Klassifizierungen. Sehr gut geeignet für Städte (`cities15000.zip` enthält alle Städte >15.000 Einwohner) und Alternativnamen (Übersetzungen).
- **Wikidata:** Der semantische Kleber. Dient zur Anreicherung von Geodaten (z. B. Flaggen, Sehenswürdigkeiten, UNESCO-Welterbestätten, geschichtlicher Kontext) über SPARQL-Queries.
- **REST Countries / World Bank APIs:** Für offizielle Länder-Metadaten (Hauptstädte, ISO-Codes, Regionen).

> [!IMPORTANT]  
> **MVP-Datenset-Empfehlung:** Echte APIs im Spiel vermeiden (Rate-Limits & Offline-Fähigkeit). Stattdessen Offline-Dumps im Build-Prozess nutzen und normalisieren:
> 1. *Länder:* Natural Earth Admin-0 + Wikidata QIDs (Master).
> 2. *Hauptstädte / Städte:* GeoNames `cities15000.zip` + World Bank Country API.
> 3. *Physische Features:* Natural Earth 10m Physical Vectors (Große Flüsse, Seen, Gebirge).
> 4. *Sehenswürdigkeiten:* Wikidata-Dumps (UNESCO / populäre POIs nach Sitelinks gefiltert).

---

### 3. Rechtliches & Lizenzen (Avicenna)
*Zusammenfassung basierend auf [Avicenna_9331-9b585604a0b4.md](codex_research_raw/2026-06-03_Avicenna_9331-9b585604a0b4.md)*

- **Natural Earth:** Public Domain. Kommerziell uneingeschränkt nutzbar, keine Attribution zwingend (aber empfohlen).
- **Wikidata:** CC0. Völlig freie Nutzung, keine Nennungspflicht.
- **GeoNames:** CC BY 4.0. Kommerziell nutzbar, erfordert aber eine Attribution (z. B. in den Credits).
- **OpenStreetMap (OSM) / ODbL:** Freie Nutzung, aber strenges Share-Alike für *abgeleitete Datenbanken*. Wenn OSM-Daten extrahiert, verarbeitet und mit anderen Quizdaten verschmolzen werden, zieht dies ggf. den gesamten Datensatz unter die ODbL. Ein gerendertes Kartenbild im Spiel gilt als *Produced Work* und ist unproblematisch (nur Attributionspflicht).
- **Mapbox / Google Maps:** Große rechtliche Hürden bei kommerzieller Verwertung und Datenspeicherung (Caching-Verbote, exklusive SDK-Nutzung, hohe Nutzungskosten).

> [!TIP]  
> **Sicherste Route:** Den primären Quizdatenbestand rein aus **Natural Earth, Wikidata und GeoNames** aufbauen. OSM-Geometrien nur isoliert als Basiskarte einsetzen und strickt trennen, um ODbL-Infektionen der Spieldatenbank zu vermeiden.

---

### 4. Rendering- & Kartentechnik (Einstein)
*Zusammenfassung basierend auf [Einstein_8e84-e953af8b2bfc.md](codex_research_raw/2026-06-03_Einstein_8e84-e953af8b2bfc.md)*

- **Option A (MapLibre GL JS + PMTiles):** *Beste Langzeitspur.* WebGL-basiertes, hochperformantes Vektorkacheln-Rendering. PMTiles (Protomaps) erlaubt das Lesen von Vektorkacheln direkt aus einer einzelnen Archiv-Datei (z. B. auf Cloudflare R2 gehostet) via HTTP Range Requests. Egress-Kosten sind dadurch fast null. Ein Low-Zoom-Planet bis Z6 ist ca. 60 MB groß und lässt sich offline bündeln.
- **Option B (D3.js / SVG + TopoJSON):** *Beste MVP-Spur für statische Karten.* Perfekt für rein politische Quizze (Grenzen anklicken, Regionen einfärben). Keine Tileserver nötig, extrem leichtgewichtig, unkompliziert offline-fähig.
- **Option C (Leaflet / OpenLayers):** Leaflet ist ideal für Raster-Karten, schwächelt aber bei Vektordaten auf Mobilgeräten. OpenLayers ist für ein Quiz-MVP zu komplex.

---

### 5. Quizdesign & Progression (Maxwell)
*Zusammenfassung basierend auf [Maxwell_ab51-fbb569c3ded4.md](codex_research_raw/2026-06-03_Maxwell_ab51-fbb569c3ded4.md)*

- **Fragetypen:**
  - *Finde auf der Karte:* Ort, Land oder Fluss auf der Karte anklicken.
  - *Was ist das?* Ein Land/Fluss wird hervorgehoben, der Name muss eingegeben oder per Multiple-Choice gewählt werden.
  - *Zuordnungen:* Land zu Hauptstadt, Sehenswürdigkeit zu Land.
  - *Kontextuelle Fragen:* "Welcher Fluss fließt durch Kairo?"
- **Schwierigkeitsstufen (Progression):**
  - *Stufe 1:* Kontinente, Top-20 Länder/Hauptstädte, sichtbare Hilfen.
  - *Stufe 2:* Länder pro Kontinent, große Flüsse & Gebirge, Multiple Choice.
  - *Stufe 3:* Regionen ohne Ländergrenzen-Labels, physische Details.
  - *Stufe 4:* Weltweiter Mix, kleinere Inselstaaten, freie Texteingabe.
- **Lernmodus:** Spaced Repetition (Karteikartensystem). Falsch beantwortete Fragen werden priorisiert wiederholt. Freies Erkunden der Karte (Atlas-Modus) als Einstieg.
- **Datenmodell-Entwurf:**
  - `GeoEntity` (ID, Typ, Namen/Aliase, Koordinaten, Prominenz, Quelle).
  - `MapLayer` (Layer-Typ, Quelle, Vereinfachung, Labelregeln).
  - `QuestionTemplate` / `QuestionInstance` (Generierungsregeln und konkrete Instanzen).
  - `UserProgress` (History, Mastery-Score, Review-Date).

---

## 📅 Offene Todos & Nächste Schritte
*Projektstatus und Todos für zukünftige Entwicklungs-Sessions.*

### 0. Aus Projekt-Review 2026-07-12 (v1.85.4–v1.85.8)
- [ ] **v1.85.4–v1.85.8 deployen:** live ist noch v1.85.3. Achtung: der erste Deploy nach
  Einführung des Hash-Manifests (`deploy.py`, v1.85.6) lädt einmalig ALLES hoch und baut
  dabei `.deploy-manifest.json` auf; ab dann inkrementell (Sekunden statt Minuten).
- [ ] **Astra/Lingua auf `revealsAnswerStrict` aufwerten?** Beide nutzen die schwächere
  Basis-Selbstverräter-Prüfung (vermutlich Drift, kein Design — seit v1.85.7 sichtbar in
  `scripts/lib/generator_text.js`). Aufwertung siebt Fragen aus = Content-Änderung →
  bewusst entscheiden und mit frischem QA-Sweep gegenprüfen, nicht still umstellen.
- [ ] **`verify_facts.js` nachschärfen:** Englisch-Leak-Check ist für cultura/machina/
  historia/lingua auf `null` (stumm); `correctAnswer` wird nicht auf Leer-String geprüft.
  Optional als npm-Script verdrahten (bisher nur `audit:questions`).
- [ ] **Fonts + maplibre-CSS selbst hosten:** `index.html` lädt render-blockierend von
  Google Fonts/unpkg — widerspricht dem Offline-Ziel.
- [ ] **Quiz.jsx entflechten:** God-Component (~1050 Zeilen); die Terra-Silhouetten-
  Geometrie (~180 Zeilen, Shoelace/Projektion) in ein eigenes Modul ziehen, damit die
  domain-agnostische Quiz-Komponente ehrlich domain-agnostisch wird.

### 1. Technische Architektur & Features
- [x] **Entscheidung: Web-App vs. Tauri-App** getroffen (Web-App-first unter React/Vite).
- [x] **Entscheidung: Kartentechnik** festlegen (MapLibre GL JS für die Weltkarte, vorgerenderte SVG-Konturen für isolierte Länder-Silhouetten).
- [x] **Datenbank & ETL-Pipeline konzipieren:** Rich-Metadata-ETL (`prepare_data.js` -> `geodb.json`) sowie Offline-Generierung des Fragenkatalogs (`generate_questions.js` -> `quiz_questions.json`) vollständig implementiert.
- [x] **Qualitätssicherung:** Testsuite (`verify_quiz.js`) prüft alle Fragen auf Korrektheit (32k+ Assertions).
- [ ] **Erweiterung physische Features:** Flüsse, Seen und Gebirge als Layer auf der Weltkarte und als Quiz-Fragen einbinden.
- [ ] **Tauri-Wrapper:** Optionales Desktop-Packaging für macOS.
- [ ] **Mobil hochkant auf echtem iPhone testen:** Das responsive Layout (Tier 1, v1.15.0) ist
  bisher nur in der Browser-Preview bei 375×812 / 844×390 verifiziert. Auf echtem Gerät prüfen
  (Safari iOS, hochkant + quer): Karte oben sichtbar, Fragen rechts/unten vollständig scrollbar,
  Header-Umbruch ok, `100dvh` korrekt bei ein-/ausblendender Adressleiste. Siehe `LAYOUT.md`.
- [x] **Test-Infrastruktur repariert (v1.15.2):** `vitest`/`jsdom`/`@testing-library/react`/`-jest-dom`
  als devDependencies ergänzt, `test`-Block in `vite.config.js` (jsdom, setupFiles), Scripts
  `npm test` / `npm run test:watch`. `QuizIntegration.test.jsx` läuft grün (2 Tests). Layout-Regression
  separat über `npm run check:layout`.
- [x] **Cultura als Domain verdrahtet (v1.18.0):** Registry-Eintrag in `src/domains/index.js`
  (Icon `Landmark`, accent `#7E4B6B`) + `CATEGORY_LABELS` (8 Kategorien) / `ATTR_LABELS`
  (65 Attribute) in `ConceptVisual.jsx`. `verify_facts.js cultura` 0 Fehler, Browser-Run
  verifiziert (Domain-Wechsel, Quizrunde, Selbstverräter-Guard, deutsche Labels, keine Konsolenfehler).
- [x] **Dashboard-Kosmetik (alle MCQ-Domains) (erledigt v1.77.2):** Labels nach
  `src/components/conceptLabels.js` ausgelagert (geteilt mit `ConceptVisual`); Dashboard nutzt
  `CATEGORY_LABELS` als Fallback (keine rohen Keys mehr) und sagt domain-neutral „Konzepte"
  (Terra: „Orte") statt hartkodiert „Orte".
- [ ] **Lingua-Fragetypen für heterogene Kategorien:** 47 Konzepte (language_fact, grammar_fact,
  phonetics, language_curio, loanword z.T.) haben bewusst noch keine Templates — Konzepte sind im
  Spiel (Visual/Distraktor-Pools), liefern aber keine Fragen. Hebel Richtung 5000-Ziel.
- [x] **Homo-Konzeptbilder fürs Museum (erledigt, überholt seit v1.82):** Das „0 Museumsbilder"-Premise
  (Stand 2026-06-20) ist längst hinfällig — Homo trägt inzwischen **306** `concept.image`-Einträge
  (v1.82 Physiologie-Kategorien erstmals bebildert, v1.84.1 +2 reflex-GIFs). Anatomie-Konzepte werden
  über den regulären Resolver-Weg (`resolve_images_batched.cjs`, `TARGETS.homo`) bebildert; die
  HomoVisual-Assets blieben Frage-Visual, wurden nicht als Galerie-Quelle gebraucht.
- [ ] **Cultura 21 Restbilder:** alte Literaturwerke + obskure Bauwerke ohne freies Commons-Bild
  (`_imgProblem`-Markierung in `cultura_raw.json`) — ggf. bessere Suchbegriffe oder andere freie Quelle.

### 1b. Geplante Bereiche, Modi & Quellen (Stand 2026-06-17)
*Aus Brainstorming-Session; Entscheidungen getroffen, Umsetzung offen.*
- [x] **Hauptbereiche neu abgrenzen / Definitionen schärfen (PLANUNG, vor Machina/Historia):**
  Zuordnungs-Matrix erstellt → [`docs/bereichs_abgrenzung.md`](docs/bereichs_abgrenzung.md).
  Leitprinzip: jeder Bereich hat eine **Ordnungsachse**; **Objekt-vs-Zeit-Regel** (Sach-Bereiche +
  Machina besitzen das Objekt, **Historia** den datierbaren Verlauf). Grenzfälle entschieden:
  Technikgeschichte (Funktion→Machina / Datum→Historia), Kunst-/Bauepochen (Werk→Cultura /
  Epoche→Historia), Wissenschaftsgeschichte (Objekt→Astra/Natura / Entdeckung→Historia), physische
  Geografie (Karte→Terra / Geologie→Natura). Meta-Regel: **Historia ist kein Sammelbecken**, ein
  Konzept = ein Primär-Owner. **Vor dem Bau von Machina/Historia und vor neuen Wellen heranziehen.**
- [x] **Sachbuch-Track-A Welle 4 fertig verifizieren + mergen (v1.42.0):** Die 341 gegateten
  Kandidaten aus `pending_wave4.json` durch 5 parallele Sonnet-Taxon-Verifier adversarial geprüft;
  4 Fehler gefiltert (Kastanienbohrer, Zwerghonigbiene, Kamelhalsfliege, Nordamerikanische Sandboa),
  **+337 Konzepte** deterministisch gemergt. verify_facts natura 0 Fehler, npm test grün,
  Natura-Quizrunde im Browser verifiziert. **Natura: 2065 → 2402 Konzepte / 11245 → 12685 Fragen.**
- [ ] **Neuer Bereich „Machina"** (Digital/IT/Computer) — lat. Name **Machina** (gesetzt). Neue
  Domain analog Natura: `generate_machina.js` + Kategorien + Registry-Eintrag (`src/domains/index.js`)
  + generisches `ConceptVisual` mit dt. Labels. Materiallage sehr ergiebig. Quellen: siehe
  `docs/wissensquellen_extern.md` (ExplainingTheFuture, c't 3003, heise c't u.a.).
- [ ] **Neuer Bereich „Historia"** (Geschichte) — lat. Name **Historia**. Schwerpunkt
  **Kultur-/Wissenschafts-/Technikgeschichte** (Entdeckungen, Erfindungen, Kunst-/Bauepochen,
  wer-baute/erfand-was-wann). **Politik-Ausschlussregel beachten** (s. Inhaltsregeln). Quelle u.a.
  Geschichtsfenster.
- [ ] **Spielmodus „Allround"** — Fragen quer über alle Hauptbereiche gemischt (Domain-übergreifend).
- [ ] **Spielmodus „Marathon"/Sudden-Death** — spielen, bis der erste Fehler kommt (Highscore = Streak).
- [ ] **Astra `black_hole`-Kategorie + Generator-Templates** (Masse in Sonnenmassen, Entfernung,
  Typ, Erstbild-Jahr) — Voraussetzung, um die ergiebigsten Astronomie-Quellen (Schwarze Löcher,
  Quasare, Neutronensterne: TON 618, M87*, Sgr A*) überhaupt aufnehmen zu können. Wikidata hat dafür
  saubere Werte. Ggf. analog `quasar`/`neutron_star`.
- [ ] **E-Book-Korpus als Quelle + Verifikations-Schicht** (Projekt ebook_vectordb, Daten auf M5,
  per `ssh m5` erreichbar; 40k Bücher, FTS5 = 0 Tokens, Semantik, `ask --check strict` mit
  verbatim-Verifikation). **Nur Sachbücher** (Korpus ist fiction-lastig; Genre am Pfad, das große
  „ePub Archiv" braucht bessere Genre-Erkennung). Primärnutzen: geerntete Fakten gegen Sachbücher
  bestätigen (spart Web-Zugriffe, härtet „Quelle pro Fakt"). Sekundär: gezielte Extraktion, Drafting
  auf MiniMax/gemma (M5), Quelle = Buchtitel+Autor, **keine Langzitate speichern** (Copyright).
  Zugangsdetails: theplan-knowledge `p_scientiapotentia.md` + `ebook_vectordb.md`.
  **Ausführungsreifer Extraktionsplan (M5-frei, rein lokal auf M3): [`docs/extraktion_sachbuecher_plan.md`](docs/extraktion_sachbuecher_plan.md)** — parallele Sonnet-Agenten, Gerüst-Skripte
  unter `scripts/data_sources/extract/` (getestet: Natura 243/1205, Astra 82/655 Konzepte in den
  neuen Büchern Unsöld/Westheide/Campbell gefunden). Für eine eigene Session vorgesehen.

- [ ] **Neue Sachbuch-Quellen für Cultura + Historia (Stand 2026-06-19, Daniels Hinweis):** Es liegen
  **neue Kunst-Sachbücher** vor (Cultura-Lane: Kunst/Kunstgeschichte) — als Discovery-/Anreicherungs-
  Quelle für Cultura prüfen. Zusätzlich soll der **Geschichts-Ordner** im E-Book-Korpus ergiebig sein —
  Kandidat für die Quellenbasis des geplanten Bereichs **Historia**. Beim Einlesen die Track-A-Lehre
  beachten (lohnt nur bei Katalogen, nicht bei reinen Konzept-/Fließtext-Lehrbüchern) und die
  Politik-Ausschlussregel für Historia. Konkrete Titel/Pfade beim nächsten Extraktionslauf sichten.

### 1c. Offener Content-Ausbau (aus theplan übernommen 2026-06-25)

**Stand v1.50.0** — committet + gepusht, aber **NICHT deployt** (live ist weiterhin v1.46.1; v1.47–v1.50 warten auf `python3 deploy.py`, Daniel-Freigabe).

Wellen 6 + 7 (2026-06-24) brachten +1420 Konzepte / +5846 Fragen via 18- bzw. 13-Slice-Opus-Workflows (`find → verify`, `append_concepts.cjs` uniform).

**Zählerstände vs. 5000-Ziel (nach Welle 7):**
| Domain | Fragen | Status |
| :----- | :----- | :----- |
| Terra | 5217 | ✅ über Ziel |
| Natura | 13217 | ✅ weit über Ziel |
| Cultura | 5042 | ✅ neu drüber |
| Historia | 4251 | AM NÄCHSTEN — ~1 Welle reicht |
| Lingua | 3534 | drunter |
| Astra | 3088 | drunter |
| Machina | 2355 | SÄTTIGT — Finder-Ertrag fällt; eher Generator-Hebel / mehr Templates als neue Finder |
| Homo | 718 | stößt an Anatomie-Ceiling (faires Reservoir erschöpft → 5000 dort nicht erreichbar; nur via mehr Frage-Templates oder bewusst akzeptieren) |

**Konkrete offene Hebel:**
- **(a)** ~~Astra `notableStars`-Liste: `brightestStar`-Feld sauber normalisieren → ca. +50 Fragen „hellster Stern im Sternbild X"~~ **erledigt v1.81.0** (+52 Fragen)
- **(b)** ~~Explorer/Museum-Tab für **Machina** + **Historia**~~ **erledigt v1.84.0** — Museum zeigt
  beide automatisch (datengetrieben); per-Domain-Galerie-Tab in `src/domains/index.js` verdrahtet
  (Machina 124 Bilder v. a. hardware, Historia 1023 Bilder). Browser-verifiziert.
- **(c)** ~~Bundle-Splitting: `index`-Bundle > 1,6 MB, Build-Warnung~~ **erledigt v1.79.3** —
  `manualChunks` trennt maplibre/react-vendor/vendor, `index` 1701→720 kB, Warnung weg
  (three bleibt lazy in AstraVisual).

**Tooling — neue Konzepte für ALLE Domains:**
```
scripts/data_sources/harvest/append_concepts.cjs <domain> <cand> --write
```
Additiv, Dedup, `+`/`#`-erhaltend. `merge_machina_historia.js` existiert nicht mehr (Rebuild-Modell entfällt).

**FALLEN:**
1. **Legacy `merge_cultura/lingua/astra.js` NICHT laufen lassen** — diese Skripte löschen Direkt-Appends.
2. **Recycelte / generische IDs aus Vorwellen** (z.B. `expedition-otto-von-kotzebue-weltreise` trug Cabrillo-Inhalt) verdrängen gute neue Konzepte still per ID-Dedup → vor `--write` die Dry-Run-Drops gegen Inhalt prüfen, ggf. eindeutige `-wN`-IDs vergeben.
3. **Subagent-Findern commit/push immer verbieten.**
4. **Konzept-DATENFIXES immer in `scripts/data_sources/<domain>_raw.json`, NIE direkt in
   `public/data/concepts_<domain>.json`** (verifiziert 2026-07-01): Die Generatoren lesen `*_raw.json`
   und ÜBERSCHREIBEN concepts+questions bei jedem Lauf — Direkt-Edits an `concepts_*.json` gehen beim
   nächsten `node scripts/generate_<domain>.js` verloren. Ablauf: raw editieren → generieren →
   `verify_facts`.

(ex-theplan #202)

### 1d. Offene Punkte (Stand 2026-06-26)

> **Konvention:** Projektspezifische Todos bleiben **hier in `AGENTS.md`**, nicht in
> `~/git/theplan`. Wird die Liste zu lang → in eigene Datei (`docs/todos.md` o. ä.)
> auslagern und hier nur referenzieren. (Frühere theplan-Einträge #225/#227/#228 wurden
> am 2026-06-26 hierher zurückgeholt.)

- [x] **Machina-`compression`-Doppelvokabular kanonisieren (erledigt v1.79.2):** Über den
  MiniMax-QA-Sweep bestätigt und behoben — `keine`→`unkomprimiert`, `verlustfrei`→`verlustfrei
  komprimiert`, `verlustbehaftet`→`verlustbehaftet komprimiert` (in `machina_raw.json`); zusätzlich
  execution `Bytecode/VM`→`Bytecode (VM)`. Kompression hat ehrlich nur 3 Kategorien → forward-Fragen
  jetzt 3-optional (verify-Warnung, kein Fehler).
- [ ] **Idee — Cultura genre_fiction Runde 2** (Angebot 2026-07-02, Welle 1 erledigt): (a) **Welle 1
  erledigt v1.85.0** — M5-Scan selbst per SSH gefahren (`scripts/data_sources/harvest/genrefic_r2/`,
  reproduzierbar), 193 gegatete Nur-Hörbuch-Autoren; die 124 notabelsten (Sitelinks ≥8) via Multi-Agent-
  Workflow geerntet (Finder + adversariale Prüfung), **83 Konzepte gemerged** (Kanon/Kinderbuch
  übersprungen, 3 Cross-Kategorie-Dubletten gedroppt). **Welle 2 Pilot erledigt v1.85.2** — die
  notabelsten offenen Kandidaten via 3 eng begrenzte Subagenten (eingebettete Liste, kein args —
  Fanout-Lehre) gegen de.wiki geerntet, **+14 Werke/12 Autoren gemerged (206→220)**, verify 0 Fehler,
  Browser-verifiziert; Details `harvest/genrefic_r2/README.md` §Welle 2. **Bebilderung Pilot erledigt
  v1.85.3** (4/14 mit freiem DE-Portrait: Laßwitz/Chabon/Brockmeier/Galbraith; Rest hat keins).
  **OFFEN (optional):** ≈88 Rest-Kandidaten nach demselben Pilot-Muster;
  (b) **erledigt v1.85.1** — Buchcover: Daniel wählte freie
  **Autorenporträts** (nicht Cover); `resolve_author_portraits.cjs` löst je genre_fiction-Konzept das
  de.wiki-Autorenporträt (dedupliziert, Lizenzfilter, .svg-Signaturen raus) → 179/206 bebildert,
  visuell + Live-Lizenz-geprüft; (c) **erledigt v1.84.2** — Claire North.
- [ ] **Idee — Machina über NEUE Kategorien statt Vertiefung** (niedrige Prio): Die klassische
  Technik ist nach 2 Wellen (v1.71/v1.73, +476 K/+1006 F) weitgehend ausgeschöpft. Ergiebigere
  Hebel wären eigene Kategorien `measuring_instrument` (Messgeräte) und `vehicle_tech`
  (Fahrzeugtechnik: Getriebe/Bremse/Federung) — je mit neuen Generator-Templates +
  `ConceptVisual`-Labels (wie bei den 6 Technik-Kategorien). Angebot 2026-06-26, offen gelassen.

> **Hinweis zum Stand in 1c:** Die dortige Tabelle ist ein Snapshot vom 2026-06-25 (vor-Deploy).
> Aktuell (2026-06-26) ist **alles bis v1.73.0 live deployt** und Machina liegt bei **2165 K /
> 6131 F** (nicht mehr 2355). Die Hebel (a)/(b)/(c) aus 1c bleiben gültig.

### 2. Ablaufplan-Status
- [x] **Session 1:** Datenrettung Codex, Aufbereitung `AGENTS.md`.
- [x] **Session 2:** Architekturentscheidung, Daten-Pipeline entwerfen, Testdaten-Extrakt erstellen.
- [x] **Session 3:** Lokaler Prototyp (Karten-Rendering + einfache Klick-Interaktion).
- [x] **Session 4:** Quiz-Logik, State-Management und Progression implementieren.
- [x] **Session 5 (diese):** Offline-Fragenkatalog (2.837 Fragen) mit Shoelace-Flächenfilter und Cosinus-Breitengrad-Korrektur für die Silhouetten. Korrektur der Klickfehler-Visualisierung und Ausschluss von Doubletten im Quiz.


---

## 📂 Projektstruktur
```
ScientiaPotentia/
├── AGENTS.md                 # Dieses Dokument (Zentraler Einstieg)
└── codex_research_raw/       # Rohe, exportierte Markdown-Logs der Codex-Recherche
    ├── 2026-06-03_9369-3da8198a98f7_9369-3da8198a98f7.md  # Hauptthread
    ├── 2026-06-03_Herschel_ad1a-d13a7be4757d.md           # Konkurrenzanalyse
    ├── 2026-06-03_Parfit_aa63-4942f79b0f78.md             # Datenquellen
    ├── 2026-06-03_Avicenna_9331-9b585604a0b4.md           # Rechtliches/Lizenzen
    ├── 2026-06-03_Einstein_8e84-e953af8b2bfc.md           # Kartentechnik
    └── 2026-06-03_Maxwell_ab51-fbb569c3ded4.md            # Quizdesign/Progression
```
