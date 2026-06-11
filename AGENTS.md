# Scientia — Multi-Domain-Wissensquiz

> **Name/Leitspruch:** Das Quiz heißt **Scientia**. *„Scientia potentia est"* (Wissen ist
> Macht) ist der Leitspruch und erscheint nur an passenden Stellen (Header-Tooltip, README,
> künftiger About-Dialog), nicht als Produktname.

> **Stand: 2026-06-05.** Lebendes Dokument, zentrale Quelle für Projektfakten.

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

Maßgeblicher Arbeitsplan: `implementation_plan.md` (Wegwerf-Dokument).

> **Nächste Session — Phase 5 (5000 Fragen/Bereich):** Hebel = Konzept-Ausbau (nicht Templating).
> Ziel ~500 faire, **belegte** Konzepte/Bereich × ~10 Fragetypen. Mehrere Recherche-Runden.
> Pipeline steht: `scripts/data_sources/<domain>_raw.json` (Konzept + `sourceName` + `verifyNote`) →
> `node scripts/generate_<domain>.js` → `node scripts/verify_facts.js <domain>` → Browser-Run.
> **Integritätsregel bleibt hart:** jeder Fakt mit Quelle, keine erfundenen Zahlen — bei
> LLM-Recherche adversarialer Faktencheck **plus** manuelle Stichprobe vor Commit.
> Aktueller Stand (v1.20.0): Astra 146 Konzepte/554 Fragen, Natura 146/939, Homo 96/174 (unverändert),
> Lingua 103/266, Cultura 155/645 (beide verdrahtet; Cultura via MiniMax-Delegation ausgebaut, v1.19.0).
>
> **Phase-5-Runde 1 (2026-06-04, Multi-Agent-Workflow):** `scripts/merge_phase5.js` dokumentiert
> Dedup + Daten-Putz der Recherche. Gelernt: Recherche-Agents liefern (a) Dubletten zum Bestand
> trotz Vorgabe (id- + semantische Kollisionen → per Kategorie deduppen, NIE kategorieübergreifend),
> (b) ASCII-Deutsch (ue/ss statt ü/ß) → Wort-Wörterbuch-Putz, (c) verbose Antwort-Felder
> (Sternbild/Typ/Lage mit Klammern) → kürzen, sonst Längen-Giveaway in MCQ. Manuelle Stichprobe
> fand 5 semantische Dubletten, die kein Algorithmus sah → Pflicht bleibt.
>
> **Phase-5-Runde 2 (2026-06-05, Krisensitzung — Sammeln + Pipeline-Redesign):** Ablaufplan,
> Effizienz-Hebel, Hochrechnung und Stolpersteine jetzt zentral in **`docs/content_pipeline.md`**.
> Ergebnis dieser Session: **≈390 neue, belegte Konzepte** für Astra/Homo/Natura/Cultura/Lingua
> gesammelt (2× 8 Sonnet-Finder parallel), abgelegt in `scripts/data_sources/harvest/`
> (Stand + Bild-Status: `harvest/README.md`). **Fakten stichprobengeprüft (gut), aber noch
> NICHT gemerged.** Vereinbarte Entscheidungen: (1) **Generator-Hebel zuerst** — Fragen/Konzept
> von ~2–3 auf ~10 (token-frei per Templating), erst dann Konzeptmenge skalieren; (2) Pipeline
> Phase A–E übernehmen; (3) **gestufte Verifikation** (autoritative Quellen — Wikidata, NASA
> Fact Sheets, JPL, Gray's 1918, USGS — gelten als belegt, nur schwächere voll prüfen);
> (4) Quelle Pflicht je Fakt UND Bild; (5) wenn eine Entscheidung viele Fragen invalidiert,
> erst Daniel fragen. **Gelernt:** Sammel-LLMs erfinden Bild-URLs (3/16 Finder, 54 Fake-Dateien)
> → Bilder nur deterministisch (Phase C); Copyright-Landmine Foto-eines-geschützten-Werks
> (Guernica) → `harvest/BLACKLIST.md`.

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
| Astra  | 146 | 554 | NASA / IAU / ESA | **3D-Himmelskörper (three.js)** + Kontext-Karte (Bahn/Distanz), Texturen Solar System Scope (CC BY 4.0) |
| Homo   | 96 | 174 | Gray's Anatomy / Prometheus / NIH | **Anatomiegrafiken (Wikimedia, PD)** + konzeptgenauer Struktur-Marker je Frage |
| Natura | 146 | 939 | Wikipedia / USGS / IUCN / IPCC | generische Konzeptkarte (`ConceptVisual`); Tiere via MiniMax-Delegation 49→97 ausgebaut (web-grounded); freies Commons-Foto je Konzept hinterlegt (`concept.image`, fürs spätere Museum) |
| Lingua | 103 | 266 | Wikipedia / Ethnologue / Wiktionary / Guinness | generische Konzeptkarte (`ConceptVisual`) mit dt. Attribut-Labels; Commons-Bild je Konzept hinterlegt (103/103, fürs spätere Museum) |
| Cultura | 155 | 645 | Wikipedia (DE/EN) / Wikidata | generische Konzeptkarte (`ConceptVisual`) mit dt. Kategorie-/Attribut-Labels; via MiniMax-Delegation ausgebaut (Komponisten Wikidata-geprüft, Werke web-grounded) |

> Fragenzahlen Astra/Homo/Natura/Lingua/Cultura sind noch weit vom 5000-Ziel — Content-Ausbau (Phase 5) läuft weiter.
> Astra 554/146 = ~3.8 F/K, Natura 939/146 = ~6.4 F/K, Cultura 645/155 = ~4.2 F/K, Lingua 266/103 = ~2.6 F/K
> (Lingua: 22 Fragetypen; 47 heterogene Konzepte aus language_fact/grammar_fact/phonetics/language_curio
> bewusst ohne eigene Templates — nur Museum/Distraktor-Pool. Hebel für mehr: dort Templates ergänzen).

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

> **✅ Selbstverräter-Guard (v1.11.0):** Beide Generatoren verwerfen jetzt automatisch Fragen, deren
> Antwort schon im Hinweis steckt (`revealsAnswer()` + `impliedRegions()` für dt. Körperteil-Stämme).
> Effekt Homo: `bone-region` 15→1 (nur „Steigbügel" bleibt, kein Wortverrat). Guard greift auch auf
> neue Phase-5-Konzepte. Generisch sicher: gemeinsame Stamm-Wörter (z.B. „Galaxie" in „Spiralgalaxie")
> schlagen NICHT an (Token-Mindestlänge, keine Hinweis→Antwort-Richtung).
>
> **✅ Visueller Selbstverräter-Guard + i18n (v1.12.0):** Das linke Visual verriet bislang die
> Antwort — Chip „apparentMagnitude: 1.06" neben der Magnitude-Frage; Sternfarbe = Sterntyp;
> Kontextkarte = Bahn/Position; Organ-Marker = Körperlage; Reverse-Frage „Welcher Planet ist der
> 3.?" zeigte den Namen im Header. Behoben über zwei neue Frage-Felder `testedAttribute` +
> `answerIsName` (in beiden Generatoren geschrieben, deterministisch — Diff nur +Felder) →
> durchgereicht Quiz→App→VisualPanel→AstraVisual/HomoVisual/ConceptVisual. Die Visuals blenden den
> getesteten Attribut-Chip aus, neutralisieren Sternfarbe/Kontextkarte/Marker für die abgefragte
> Dimension und verbergen Name/Chips/FunFact bei Reverse-Namensfragen. Zudem: rohe englische
> Attribut-Keys (`apparentMagnitude`→„Magnitude", `function`→„Funktion", `parentPlanet`→
> „Zentralplanet" …) in `ATTR_LABELS` aller Visuals deutsch belabelt. **Rest-Schwäche (in v1.12.2
> behoben):** der FunFact konnte bei Vorwärtsfragen beiläufig die Antwort andeuten (z.B. „äußerste
> Planet" → Position 8) — jetzt zeigen alle Visuals FunFact/Freitext-Chips erst nach dem Antworten
> (`isQuestionAnswered`/`detailsUnlocked`).
>
> **✅ Homo-Anatomiegrafiken entschärft (v1.12.0):** `organs.svg`/`body.svg` (Häggström-Serie
> „Man shadow") trugen englische bzw. „Example text"-Platzhalter-Labels samt Leader-Lines. Per
> Skript alle `<text>`-Elemente + geraden Leader-Pfade (thin stroke, keine Kurven) entfernt; die
> Organ-Rastergrafiken blieben unverändert → `MARKER_BY_ID` bleibt kalibriert (verifiziert:
> Marker sitzt exakt auf Bruchteilsposition). `CREDITS.md` dokumentiert die Bearbeitung.
>
> **✅ Schwierigkeit & lateinische Fachbegriffe (v1.12.2):** Wo der deutsche Name die Region
> verrät, fragt der Homo-Generator jetzt den **lateinischen Fachbegriff** ab („In welcher
> Körperregion liegt der Knochen mit dem lateinischen Namen „Fibula"?") und setzt das neue
> Frage-Feld `hideConceptIdentity`, sodass das linke Visual den deutschen Namen verbirgt („?")
> und FunFact/Chips/Marker erst nach dem Antworten als Erklärung zeigt (`isQuestionAnswered`
> durchgereicht Quiz→App→VisualPanel→Visuals). Die Schwierigkeit ist nicht mehr rein Template-starr:
> `FAMILIARITY_OFFSET` justiert pro Konzept nach Bekanntheitsgrad (Femur/Herz leichter,
> Os zygomaticum/Stapes schwerer), `resolveDifficulty` klemmt auf Stufe 1..4. Effekt: Homo
> 112→142 Fragen (Verteilung 1:5 / 2:52 / 3:52 / 4:33). Browser-verifiziert (Stufe 3).
>
> **Rest-Schwäche (offen):** Fälle ohne literalen Stamm-Treffer und ohne lateinischen Begriff
> (z.B. „Schädel"→Kopf) bleiben trivial; dort fehlt noch ein Fachbegriff-Hinweis.

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
> 4. **Hinweis:** `concepts_astra.json`/`concepts_homo.json` haben **kein** `image`-Feld — fürs Museum dort
>    nachrüsten (Astra-Bilder in `astra_raw`/Assets, Homo nutzt Anatomie-Assets).
Browser-Preview-Config: `.claude/launch.json` (Server „dev", Port 3000; nicht eingecheckt).

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
- [ ] **Dashboard-Kosmetik (alle MCQ-Domains):** Die Kategorie-Aufschlüsselung zeigt rohe Keys
  (`language_family`, `animal` …) statt deutscher Labels, und der Fragen-Pool-Text sagt hartkodiert
  „… Orte" (`Dashboard.jsx`, Zeile ~116). Labels aus `ConceptVisual.jsx` exportieren/teilen und
  „Orte" domain-neutral machen („Konzepte", bei Terra „Orte").
- [ ] **Lingua-Fragetypen für heterogene Kategorien:** 47 Konzepte (language_fact, grammar_fact,
  phonetics, language_curio, loanword z.T.) haben bewusst noch keine Templates — Konzepte sind im
  Spiel (Visual/Distraktor-Pools), liefern aber keine Fragen. Hebel Richtung 5000-Ziel.

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
