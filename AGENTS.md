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

> **Stand 2026-06-17 (v1.37.3) — Sachbuch-Extraktion Phase 1, Natura-Welle (die eigentliche Ernte):**
> Gleiche Pipeline auf die **69 funFact-Lücken** unter den 243 Natura-Buchtreffern (alle aus
> Campbell/Westheide, KEINE Fehltreffer). 3 parallele Sonnet-Agenten → **52 belegte funFacts**
> (75 % Ertrag) → Opus-Gate (3 Sachkorrekturen: China-Alligator-Alleinstellung entschärft,
> Blauhäher „operante Konditionierung"→„erlernte Geschmacksaversion", Typo Schaumnest) → merge →
> verify (0 Fehler) → Browser (1205 K geladen, keine Fehler). Quelle „Spezielle Zoologie"
> (Westheide/Rieger) / „Campbell Biologie", je in `verifyNote`; bestehende Attribut-Quellen/Werte
> unangetastet. Highlights: Weißwal-Rhein-Irrgast 1966, Weißkopfseeadler-Federn schwerer als Skelett,
> Laotische Felsenratte (lebendes Fossil, 2005 wiederentdeckt), Aga-Kröte-Invasion. Bestätigt die
> Astra-Lehre: Buch-Ernte gehört zu den Bio-Domänen. Nächste Optionen: restliche 174 Natura-Treffer
> selektiv upgraden, Homo/Cultura-Treffer-Finder, dann Phase-2-Pilot (neue Konzepte/Sachfragen).

> **Stand 2026-06-17 (v1.37.2) — Sachbuch-Extraktion Phase 1, Astra-Pilot (`docs/extraktion_sachbuecher_plan.md`):**
> Pipeline End-to-End validiert: `pdftotext` → deterministischer Treffer-Finder (`concept_passages.py`)
> → 3 parallele Sonnet-Enrichment-Agenten (Batches je ~28 Konzepte, produce-only nach `/tmp`) →
> Opus-Gate → merge → generate → verify (0 Fehler) → Browser. **Ergebnis Astra: nur +3 belegte
> funFacts** (Mira, Mariner 10, Cassiopeia A — bisher ohne funFact; Quelle „Der neue Kosmos"/Unsöld).
> **Wichtige Pilot-Lehre:** Astra-Buchanreicherung lohnt kaum — (a) die 82 Namens-Treffer waren
> großteils **Biologie-Fehltreffer** (Asteroidennamen wie Pandora/Iris/Daphne = griech./biolog.
> Begriffe in den Bio-Büchern; `concept_passages.py` durchsucht ALLE `.txt`), (b) von 35 verwertbaren
> Fakten hatten **32 Konzepte bereits gleich gute oder bessere** NASA/Wikipedia-funFacts, (c) die eine
> Astro-Quelle (Unsöld, alte Auflage) liefert **veraltete Werte** (Deneb 63 000× statt ~200 000×,
> Andromeda 670 kpc) → Attribute NICHT überschrieben. **Konsequenz:** Buch-Ernte gehört zu **Natura**
> (Campbell/Westheide = autoritative Tierquelle, keine Fehltreffer-Pollution): dort **69 echte
> funFact-Lücken** unter 243 Treffern → nächste Welle.

> **Stand 2026-06-17 (v1.37.1) — Kurzgesagt als Notabilitäts-Signal (Astra, Proof-of-Concept):**
> Neue Quelle getestet: YouTube-Kanal Kurzgesagt als **Auswahl-/Notabilitätssignal** (welche
> berühmten Objekte aufnehmen), NICHT als Faktenquelle. Pipeline: 5 astronomielastige Videos
> lokal transkribiert (`yt-transcribe`/Auto-Untertitel) → Sonnet extrahiert benannte reale Objekte
> (verstümmelte Auto-Transkript-Namen auf kanonische Form normalisiert) → **Werte ausschließlich
> aus Wikidata** → Opus-Gate. Politik/Spekulatives per Titelfilter ausgeschlossen. Ergebnis: +6
> Flaggschiff-Objekte (Astra 649→**655** K / →**2051** F): R136a1 (massereichster Stern),
> Stephenson 2-18 (größter Stern), Barnards Stern, Alpha Centauri, Messier 87 (Foto-Galaxie),
> OJ 287. **Gate fing zwei Datenfallen:** (1) Beta Centauri — Wikidata-Distanz selbst falsch
> (50 statt ~390 Lj) → verworfen; (2) `apparentMagnitude` P1215 hat pro Stern viele Claims in
> verschiedenen Photometrie-Bändern (V/B/Infrarot) — der Harvest-Agent nahm den ersten (oft IR,
> z.B. Stephenson 2-18 mag 7.15 = IR, visuell ~15) → Helligkeit nur behalten wo gesichert V-Band.
> Schwarze Löcher/Quasare/Neutronensterne (TON 618, M87*, Sgr A*) brauchen NEUE Astra-Kategorie +
> Generator-Templates → Folge-Option. verify_facts 0 Fehler, Astra-3D browser-verifiziert.

> **Stand 2026-06-17 (v1.37.0) — Welle 4, reine Sonnet-Harvests (kein MiniMax):** Auf Wunsch
> nur Sonnet-Subagents statt MiniMax (Daniel hatte Sonnet-Volumen übrig). 5 parallele produce-only
> Subagents, host-diversifiziert (4× Wikidata-SPARQL + 1× Wikiquote), zentrales Opus-Gate.
> **+626 Konzepte / +2931 Fragen:** Natura 851→**1205** K / 4301→**6403** F (+354 Tiere, alle
> Sitelinks ≥ 12 notabilitäts-gerankt — Greifvögel/Eulen/Spechte/Primaten/Beuteltiere u.a.);
> Cultura 990→**1205** / 2988→**3557** (+86 Werke: Mozart-Opern, Hemingway, van Gogh u.a.,
> P31/P106-validiert; +129 gemeinfreie Zitate †≤1955 verbatim aus Wikiquote — Schnitzler, Musil,
> Zweig, Herder, Schlegel u.a.); Lingua 317→**352** / 1326→**1512** (+21 Sprachen, +9
> Schriftsysteme, +5 Sprachfamilien; Agent korrigierte etliche Wikidata-Datenfehler); Astra
> 627→**649** / 1949→**2023** (+8 benannte Sterne, +6 Galaxien, +8 Nebel). Alle `verify_facts`
> 0 Fehler, Natura-Quiz Browser-verifiziert. **Gate-Lehre erneut bestätigt:** Erste Natura-Ernte
> (232) war systematisch obskur (29 Kreischeulen-Varianten, tropische Tapaculos) — IUCN+P18+dewiki
> ist als Notabilitätsfilter ZU SCHWACH; erst `wikibase:sitelinks ≥ 12` trennt bekannte von
> obskuren Arten (cultura-wd1-Lehre). Astra: 5 katalog-only/obskure Galaxien (NGC-Nummern, GLASS-z13)
> im Gate verworfen. Neue Harvester: `wikidata_natura_wd4.cjs`, `wikidata_astra_w4.cjs`,
> `wikidata_lingua_w5.cjs`, `wikidata_cultura_w4.cjs`, `wikiquote_w4.cjs`.

> **Stand 2026-06-17 (v1.36.0) — Welle 3 (Bilder + Konzepte), 8 Sonnet-Subagents:**
> Lektion umgesetzt: Bilder jetzt über **de.wikipedia-Lemma / Wikidata-P18** statt commons-Freitext
> (`resolve_images_p18.cjs`) — die zuvor falsch zugeordneten Bauwerke kommen so korrekt (Bastille,
> Erechtheion, Marienburg→Malbork, Belvedere→Wien). **+327 Konzepte, ~+766 Fragen, +89 Cultura-Bilder:**
> Cultura 874→**990** K / →**2988** F (+116 Wikiquote-Zitate, neue PD-Autoren); Astra 562→**627** /
> →**1949** (+23 exoplanet, +25 galaxy, +17 nebula); Natura 782→**851** / →**4301** (+35 plant, +16
> mineral, +7 fungus, +11 geology); Lingua 282→**317** / →**1326** (+17 Sprachen, +18 Etymologien);
> Homo 169→**211** / →**593** (+17 body_fact, +12 organ, +6 bone, +7 muscle). Subagents fingen eigene
> Fehler (P18-Fehlbesetzungen cpe-bach→Gerichtsgebäude, meyerbeer→Pflanze; value-Kollisionen).
> Alle `verify_facts` 0 Fehler. **Nachgezogen (v1.36.1):** Astra +137 und Natura +213 Museum-Bilder
> über einen **gebündelten** P18/pageimages-Resolver (`resolve_images_batched.cjs`, bis 50 Einheiten/
> Request → kein Rate-Limit; der per-Konzept-Resolver war zuvor 6 h gelaufen und ins 429-Limit
> getreten). Museum gesamt: **1258 Bilder** (Astronomie 183, Natur 508, Kultur 428, Sprachen 139).

> **Stand 2026-06-17 (v1.35.0) — Breite Parallel-Welle, 8 Sonnet-Subagents über 5 Quellen:**
> Host-Diversität statt Agent-Stapeln (MiniMax-Limit ~4–6 parallel): 3× MiniMax + 3× Wikidata-SPARQL
> + 1× Wikiquote + 1× Commons-Bildauflösung gleichzeitig, alle Produce-only (eigene /tmp-Kandidaten,
> kein Index-Race), zentrales Opus-Gate + Merge. **+469 Konzepte, ~+1450 Fragen:**
> **Cultura** 647→**874** K / →**2809** F (+150 Wikiquote-Zitate, +76 composition/Movements);
> **Natura** 703→**782** / →**4124** (+17 fungus, +16 geology, +16 mineral, +30 plant);
> **Astra** 478→**562** / →**1781** (+25 galaxy, +18 nebula via Wikidata; +15 mission, +6 meteor_shower,
> +20 exoplanet via Wikidata/NASA); **Lingua** 241→**282** / →**1189** (+14 writing_system, +7
> language_family, +20 etymology); **Homo** 131→**169** / →**488** (+23 bone, +15 muscle).
> Dazu **+109 Museum-Bilder** für Cultura (Commons) — 19 commons-search-Fehlzuordnungen im Opus-Gate
> aussortiert (z.B. Bastille→Pont Royal, Erechtheion→Ornament, Tuileries→Louvre-Entwurf). Neuer
> Wikidata-Harvester `wikidata_galneb.cjs`. Alle `verify_facts` 0 Fehler, Browser-verifiziert
> (819 Museum-Karten, Bild-URLs einzeln geprüft). PD-Gate: Einstein/Th. Mann (†1955) seit 2026-01-01 frei.

> **Stand 2026-06-16 (v1.34.0) — Parallel-Welle (Museum + Cultura + Homo), 4 Sonnet-Subagents:**
> Neuer **Museum-Tab** (`src/components/MuseumExplorer.jsx`, in `src/App.jsx` verdrahtet) macht die
> geernteten freien Bilder durchsuchbar (710 Bilder, Filter nach Bereich + Suche + Lightbox; handhabt
> Commons-`Special:FilePath`- und Met/NASA-Direkt-URLs). **Cultura 496→647 K / 1941→2315 F:**
> +76 `composition` (Brahms/Mahler/Bruckner/Verdi/Puccini u.a., One-Shot-MiniMax, Lemma + Jahr geprüft)
> + 75 `quote` via neuem **Wikiquote-Direktparser** (`scripts/data_sources/harvest/wikiquote_harvest.cjs`,
> verbatim aus de.wikiquote, PD-Gate †≤1955; 2 Fehlzuschreibungen + 1 Begriff + 2 Schwachfälle im
> Opus-Gate verworfen). **Homo 96→131 K / →368 F:** +20 `organ` + 15 `body_fact` (MiniMax, Anatomie
> gegen de.wikipedia geprüft; unbelegte Gewichte, der „100.000 km Blutgefäße"-Mythos und eine
> Wert-Kollision verworfen). Alle `verify_facts` 0 Fehler, Browser-verifiziert.

> **Nächste Session — Phase 5 (5000 Fragen/Bereich):** Hebel = Konzept-Ausbau (nicht Templating).
> Ziel ~500 faire, **belegte** Konzepte/Bereich × ~10 Fragetypen. Mehrere Recherche-Runden.
> Pipeline steht: `scripts/data_sources/<domain>_raw.json` (Konzept + `sourceName` + `verifyNote`) →
> `node scripts/generate_<domain>.js` → `node scripts/verify_facts.js <domain>` → Browser-Run.
> **Integritätsregel bleibt hart:** jeder Fakt mit Quelle, keine erfundenen Zahlen — bei
> LLM-Recherche adversarialer Faktencheck **plus** manuelle Stichprobe vor Commit.
> Aktueller Stand (v1.26.5): Astra 455 Konzepte/1448 Fragen, Natura 606/3606, Homo 96/243,
> Lingua 241/988, Cultura 365/1580. **Wikidata-SPARQL-Welle 4 (v1.25.0/v1.26.0):** 4 parallele
> Sonnet-Harvester (wd3, eigene Dateien → kein Index-Race), Opus-Faktencheck vor Commit.
> Committet: **Natura +162 K/+954 F** (Doktorfische/Welse/Störe/Libellen/Gürteltiere/Falken,
> alle IUCN+dewiki+Bild-gefiltert), **Astra +152 K/+394 F** (16 Sterne, 118 benannte Asteroiden,
> 18 Monde), **Lingua +29 K/+132 F** (slawisch/germanisch/dravidisch/semitisch/Mon-Khmer u.a.;
> Agent entfernte 77 Dialekte/historische/umstrittene Einträge). **Cultura-Welle VERWORFEN:**
> der Sonnet-Harvester erntete alphabetisch (nicht notabilitäts-gerankt) → obskure Brücken/Türme
> (Aachsägebrücke, Bettelturm) + Bildhauer-Müll; composer-Batch durch Wikidata-P106-Fehler
> kontaminiert (Peter d. Gr., Tagore, Dario Fo als „Komponisten"), Nationalität falsch (Venturini
> „Deutsch"), und die behauptete Agent-Bereinigung wurde nie geschrieben. **Cultura korrekt neu geerntet
> (v1.26.0): +98 K/+288 F** — Notabilität per `wikibase:sitelinks`-Schwelle (≥12-25), composer
> P106-validiert (Rossini/Offenbach/Schönberg/Janáček u.a., Nationalität nur aus P27), literature
> nur echte Werke (Animal Farm/Alice/Hobbit/Schuld und Sühne…), berühmte Gemälde/Skulpturen/Bauwerke
> (Verbotene Stadt/Alhambra/Trevi-Brunnen/Venus von Urbino). Agent entfernte 12 Kontaminanten in
> verifizierter Selbstkontrolle (Mein Kampf/Kommunist. Manifest als nicht-literarisch, Wikidata-
> Fehlklassifikationen). Lehre: Wikidata-Massenernte braucht Sitelink-Ranking + P31/P106/P27-Validierung,
> sonst alphabetischer/kontaminierter Müll.
> **Wikidata-SPARQL-Welle 3 (v1.24.0):** 4 parallele
> Sonnet-Subagents (je Domain ein erweiterter Harvester, eigene Dateien → kein Index-Race),
> deterministisch aus WDQS: Natura +246 Tiere (Reptilien/Knorpelfische/Schmetterlinge/Vögel,
> →2693 Fragen), Astra +89 (25 Sterne/64 Asteroiden, →1054), Lingua +73 Sprachen (Bantu/Turk/
> Austronesisch/Nilo-Saharanisch u.a., →856), Cultura +54 (Gemälde/Literatur/Komponisten,
> →1292). Opus-Faktencheck-Stichprobe vor Commit: Cherubini-Nationalität (Französisch→Italienisch)
> und „Müllers Erdviper" (ASCII-Lemma→Umlaut) korrigiert, sonst sauber; alle verify_facts 0 Fehler,
> Natura-Quiz Browser-verifiziert. (Astra-Harvester-Skript versehentlich beim Stub-Aufräumen
> gelöscht — Daten via `harvest/astra_wd2.json` + `astra_raw.json` vollständig dokumentiert.)
> **Wikidata-SPARQL-Welle 2 (v1.23.0):** Natura +52 Tiere
> (1263 Fragen), Cultura +58 Konzepte (sitelink-kuratiert, Fehlkategorisierte verworfen; 1021 Fragen),
> Lingua +36 Weltsprachen (537 Fragen) — alle deterministisch aus WDQS, Quelle je Fakt = Wikidata-QID,
> Opus-Stichprobe + Sitelink-Notabilitätsfilter. Bilder Phase C nachgezogen (Natura 198/198, Cultura/Lingua
> teilweise). **Generator-Hebel-Welle (v1.21.0, token-frei):** in 4 parallelen
> Sonnet-Subagents je Generator neue Frage-Templates für bisher ungenutzte Attribute ergänzt
> (Homo +92, Cultura +173, Lingua +69, Astra +36 = +370 Fragen, keine neuen Konzepte/Fakten),
> alle `verify_facts` 0 Fehler, Browser-verifiziert (Homo-Reverse + Cultura-Vorwärts).
> **Wikidata-SPARQL-Welle (v1.22.0):** 68 neue Astra-Konzepte (20 Monde, 16 Sterne, 32 Asteroiden)
> deterministisch aus Wikidata Query Service geerntet (`harvest/wikidata_astra.cjs` → `astra_wd1.json`),
> Quelle je Fakt = Wikidata-QID, Opus-Stichprobe gegen Wikidata bestätigt (Astra 590→801 Fragen).
> **Bilder Phase C (v1.22.0):** 99 freie Commons-Bilder via `resolve_images.cjs` aufgelöst
> (Natura 146/146, Cultura 149/155 Konzepte mit Bild, fürs spätere Museum). Wikidata schont das
> Wikipedia-Rate-Limit (anderer Endpunkt, strukturiert/CC0); Commons-Resolver ist maxlag-/Backoff-gehärtet.
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
| Astra  | 455 | 1448 | NASA / IAU / ESA / Wikidata | **3D-Himmelskörper (three.js)** + Kontext-Karte (Bahn/Distanz), Texturen Solar System Scope (CC BY 4.0) |
| Homo   | 96 | 243 | Gray's Anatomy / Prometheus / NIH | **Anatomiegrafiken (Wikimedia, PD)** + konzeptgenauer Struktur-Marker je Frage |
| Natura | 606 | 3606 | Wikipedia / USGS / IUCN / IPCC / Wikidata | generische Konzeptkarte (`ConceptVisual`); Tiere via MiniMax-Delegation 49→97 ausgebaut (web-grounded); freies Commons-Foto je Konzept hinterlegt (`concept.image`, fürs spätere Museum) |
| Lingua | 241 | 988 | Wikipedia / Ethnologue / Wiktionary / Guinness / Wikidata | generische Konzeptkarte (`ConceptVisual`) mit dt. Attribut-Labels; Commons-Bild je Konzept hinterlegt (103/103, fürs spätere Museum) |
| Cultura | 365 | 1580 | Wikipedia (DE/EN) / Wikidata | generische Konzeptkarte (`ConceptVisual`) mit dt. Kategorie-/Attribut-Labels; via MiniMax-Delegation ausgebaut (Komponisten Wikidata-geprüft, Werke web-grounded) |

> Fragenzahlen Astra/Homo/Natura/Lingua/Cultura sind noch weit vom 5000-Ziel — Content-Ausbau (Phase 5) läuft weiter.
> Astra 1054/303 = ~3.5 F/K, Natura 2693/444 = ~6.1 F/K, Cultura 1292/267 = ~4.8 F/K, Lingua 856/212 = ~4.0 F/K,
> Homo 266/96 = ~2.8 F/K
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
- [ ] **Astra/Homo-Konzeptbilder fürs Museum (Stand 2026-06-12):** `generate_astra.js`/`generate_homo.js`
  tragen — anders als Natura/Lingua/Cultura — kein `concept.image`. Astra-Konzepte (inkl. der 68 neuen
  Wikidata-Objekte) haben bereits `imageSearchTerm`. Kleiner Generator-Edit (image-Feld spiegeln wie in
  `generate_natura.js`) + `node scripts/data_sources/harvest/resolve_images.cjs astra_raw.json`. Homo nutzt
  Anatomie-Assets (eigener Weg). Voraussetzung fürs Museum.
- [ ] **Cultura 21 Restbilder:** alte Literaturwerke + obskure Bauwerke ohne freies Commons-Bild
  (`_imgProblem`-Markierung in `cultura_raw.json`) — ggf. bessere Suchbegriffe oder andere freie Quelle.

### 1b. Geplante Bereiche, Modi & Quellen (Stand 2026-06-17)
*Aus Brainstorming-Session; Entscheidungen getroffen, Umsetzung offen.*
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
