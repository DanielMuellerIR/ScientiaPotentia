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

Maßgeblicher Arbeitsplan: `implementation_plan.md` (Wegwerf-Dokument).

## Datei-Verzeichnis

| Datei | Wozu |
| :--- | :--- |
| [README.md](README.md) | Knapper Projekteinstieg, verweist für Status/Zahlen/Architektur auf AGENTS.md. |
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

> **Stand 2026-06-23 (v1.45.0) — Zwei neue Hauptbereiche: Machina (IT) + Historia (Geschichte):**
> Beide Domains end-to-end verdrahtet nach dem erprobten Cultura-Muster (Generator + Registry +
> `ConceptVisual`-Labels + `verify_facts`-Leak-Config). Nach Welle 2 + Reverse-Hebel (v1.45.2):
> **Machina 243 Konzepte / 760 Fragen** (programming_language, file_format, network_protocol,
> data_structure, algorithm, hardware, acronym, concept — Achse **Funktionsprinzip**, KEINE
> Erfindungsdaten → Historia). **Historia 246 Konzepte / 1180 Fragen** (invention, discovery, epoch,
> figure, milestone, expedition — Achse **Zeit/Urheberschaft**, Politik-Ausschluss eingehalten).
> Welle 2: +93/+107 Konzepte durch 6 weitere parallele Finder + 4 adversariale Verifier (10 Big-O-/
> Jahres-/Execution-Korrekturen; acronym-Cross-Dedup gegen Protokoll-/Hardware-Konzepte automatisiert).
> v1.45.2: token-freier Reverse-Hebel (+13 Frage-Templates, kind:'name' mit pickNames-Eindeutigkeit)
> → +188/+341 Fragen ohne neue Fakten. Pipeline: 8 parallele Sonnet-Finder
> (Schema/kontrolliertes Vokabular in `harvest/SPEC_machina_historia.md`) → Gate
> (`merge_machina_historia.js`: Dedup + Struktur + ASCII-Umlaut-Erkennung) → deterministischer
> Umlaut-Fix (`harvest/fix_cand_umlauts.cjs`, 67 Ersetzungen) → **5 adversariale Sonnet-Verifier**
> (6 Sachfehler korrigiert: TS-Execution-Frage entschärft via Prompt-Wording, Dijkstra O((V+E)log V),
> Hashing-Kategorie, Fahrenheit-Land, Tesla-Nationalität, da Vinci entfernt [Künstler→Cultura],
> Dias-Jahr) → `apply_corrections.cjs` → generate → verify (0 Fehler) → Browser-verifiziert
> (Domain-Wechsel, Quizrunde je Domain, dt. Labels, Selbstverräter-„?", keine Konsolenfehler) →
> npm test grün, Layout 17/17. **Noch offen:** kein Explorer/Museum-Tab (Konzepte ohne Bilder);
> Content-Ausbau Richtung 5000 (analog Natura-Wellen). `npm test` grün, NICHT deployt.

> **Stand 2026-06-20 (v1.44.0) — Schwierigkeitsstufen abgeschafft + Galerie-Lightbox + Selbstverräter:**
> **Schwierigkeitsstufen (Leicht/Mittel/Schwer/Meister) komplett entfernt.** Grund: die `difficulty`
> wurde **pro Fragen-Template** vergeben (z.B. jede „Ordnung"-Frage = Meister), nicht nach echter
> Rate-Schwierigkeit — famose Tiere wie Blauwal/Elefant landeten so unter „Meister", was albern wirkt.
> Echte Kalibrierung pro Frage ist bei zigtausend Fragen nicht leistbar. Quiz zieht jetzt **zufällig
> aus dem ganzen Pool** (SRS-Priorisierung bleibt), Header „FRAGE x VON y", flaches Scoring (10 Pkt./
> Treffer, ÷ Versuchszahl). `difficulty`-Feld bleibt ungenutzt in den Daten. UI: keine Stufenwahl mehr,
> Lern-Quiz startet direkt (Terra: nur Spielmodus). **Selbstverräter-Guard erweitert:** korrelierte
> Taxon-Attribute (`class`↔`order`) werden vor der Antwort gegenseitig ausgeblendet — bei „Welche
> Ordnung?" ist die Tierklasse nicht mehr sichtbar (sonst geschenkt). **Galerie-Lightbox gefixt:**
> per Portal Vollbild statt nur im linken Panel, hohe Hochformate bleiben im Rahmen.

> **Stand 2026-06-20 (v1.42.0) — Track-A Welle 4 abgeschlossen → Natura 2402 K / 12 685 F:**
> Die 341 gegateten Kandidaten aus `pending_wave4.json` (Insekten/Reptilien/Vögel) durch 5 parallele
> Sonnet-Taxon-Verifier adversarial geprüft (4 Fehler: Kastanienbohrer, Zwerghonigbiene,
> Kamelhalsfliege, Nordamerikanische Sandboa), **+337 deterministisch gemerged: Natura 2065→2402 K /
> 11 245→12 685 F**. verify 0 Fehler, Tests grün, Browser-verifiziert. Zusätzlich: **Bereichs-
> Abgrenzung** als Zuordnungs-Matrix erstellt ([`docs/bereichs_abgrenzung.md`](docs/bereichs_abgrenzung.md))
> — Voraussetzung vor Bau von Machina/Historia.

> **Stand 2026-06-17 (v1.41.0) — Track-A Welle 3: +287 Tierkonzepte → Natura-Meilenstein 2000 K / 10 993 F:**
> Dritte Discovery-Welle (Insekten×2, Reptilien×2, Vögel×2 über frische Grzimek-Seiten) → 294
> Kandidaten → Gate (292 ok) + 4 Taxon-Verifier (5 Fehler: Laubsängermeise nicht existent +
> 4 Insekten-funFact-Fehler). **287 gemerged: Natura 1713→2000 K / 9379→10 993 F** (runder
> Meilenstein). Tests grün, verify 0 Fehler, Browser-verifiziert. **Session-Summe Track A:
> +749 Tierkonzepte (3 Wellen), +55 funFacts.** Reserven weiter groß (Säugetiere-Band fast
> unberührt, Westheide Teil 1 Wirbellose kaum, Grzimek-Bände je ~50 % offen).

> **Stand 2026-06-17 (v1.40.1) — Astra Track A getestet: Konzept-Lehrbuch ≠ Objektkatalog (Lehre):**
> Probe auf *The Cosmic Perspective (2017)*, sternreichster Abschnitt (S. 525–575, 50 S.): nur **2
> neue Objekte** (Sirius B übernommen; NGC 3603 zu obskur verworfen). Grund: ein Konzept-Lehrbuch
> nennt nur bekannte Referenzobjekte (alle schon im Spiel) + H-R-Diagramm-Labels OHNE auswertbare
> Attribute; Sternhaufen haben keine Schema-Kategorie. **Lehre:** Track-A-Discovery lohnt nur bei
> systematischen Objekt-/Art-KATALOGEN (Grzimek/Westheide ~1,5 Treffer/Seite), NICHT bei Konzept-
> Lehrbüchern (~0,04/Seite). Astra-Wachstum bleibt bei **Wikidata-Harvests** (bewährt, vgl. v1.37.0).
> Sirius B (Weißer Zwerg, Großer Hund, 8,6 Lj) ergänzt → Astra 655→656 K / 2053 F.

> **Stand 2026-06-17 (v1.40.0) — Track-A Welle 2: +303 neue Tierkonzepte (→ Natura 1713 K / 9379 F):**
> Zweite Discovery-Welle, gleiche Mechanik: 6 Sonnet-Agenten über frische Page-Range-Slices
> (Insekten, Reptilien×2, Vögel, + Westheide Teil 2 Fische/Amphibien → neue Klassen Knochen-/
> Knorpelfische) → 320 Kandidaten. Zweistufiges Gate: programmatisch (316 ok, 4 zu lang) +
> 4 Taxon-Verifier (13 Sachfehler gefiltert: Wüstenleguan/Seewolf-Längen, Blindbremse-funFact,
> „Baubau" kein Vogel u.a.). **303 gemerged: Natura 1410→1713 K / 7635→9379 F** (+1744 Fragen).
> Tests grün, verify 0 Fehler, Browser-verifiziert (Königskobra, Mondfisch, Stierhai, Tsetsefliege).
> **Session-Summe Track A: +462 Tierkonzepte aus 2 Wellen.** Wiederkehrende Falle: Agenten erzeugen
> teils ASCII-`"` als dt. Schlusszeichen → JSON bricht; Repair-Regex `„…"`→`„…“` im Gate-Skript.
> Reserven weiter groß (Grzimek-Bände ~60 % ungelesen). Offen: Cosmic Perspective (Astra), Prometheus (Homo), Track B.

> **Stand 2026-06-17 (v1.39.0) — Sachbuch-Phase-2 Track-A SKALIERT: +159 neue Tierkonzepte (Grzimek + Westheide):**
> Neue Bücher extrahiert (Grzimeks Tierleben Säugetiere/Insekten/Kriechtiere/Vögel, ~1 Mio W; +
> The Cosmic Perspective 2017 als moderne Astro-Quelle; + Prometheus Anatomie für Homo). Breite
> Discovery-Welle: **6 parallele Sonnet-Agenten** über Page-Range-Slices (Insekten×2, Reptilien,
> Vögel, Säugetiere, wirbellose Tiere/Mollusken) → 167 Kandidaten. **Zweistufiges Gate:**
> (1) programmatisch — Dedup (cross-batch + Bestand), ≥2 belegte Attribute, Wertebereich-Sanity,
> class-Vokabel, funFact-Länge, conservationStatus gedroppt (kein Buch-IUCN); (2) **adversariale
> Verifikation** — 3 skeptische Sonnet-Prüfer (nach Taxon) fingen 7 Sachfehler (Bergkänguru-Speed
> 88→falsch, Herkulesspinner-Superlativ vertauscht, „stumme" Waldgrille, Synonym-Schildkröte u.a.).
> **159 gemerged → Natura 1251→1410 K / 6767→7635 F** (+868 Fragen). Browser-verifiziert, verify 0
> Fehler. Bestätigt: Discovery skaliert sauber über parallele Slices + zweistufiges Gate. Reserven:
> Grzimek-Bände noch zu ~80 % ungelesen, Westheide Teil 1+2 ebenso → weitere hunderte Arten möglich.
> Offen: Cosmic Perspective für Astra-Discovery; Prometheus für Homo; Track B (Sachfrage-MCQ, §6).

> **Stand 2026-06-17 (v1.38.0) — Sachbuch-Phase-2 Track-A Pilot: NEUE Tier-Konzepte aus „Spezielle Zoologie":**
> Erster Discovery-Lauf (statt Anreicherung jetzt Entdeckung): 1 Sonnet-Agent las den Raubtier-
> Abschnitt (Westheide/Rieger Teil 2, S. 620–650) gegen die Dedup-Namensliste und extrahierte
> **46 neue, im Buch belegte Raubtier-Arten** mit schema-konformen Attributen (class/order +
> maxLengthCm/maxWeightKg + range). Opus-Gate: Dedup (Substring-Treffer Erdwolf/Wolf, Leopard/
> Leopardgecko, Seelöwe/Löwe als Fehlalarm verworfen — keine echte Dublette); **conservationStatus
> gedroppt** (Buch nennt keinen IUCN-Code, Agent hatte ihn abgeleitet → „nicht raten"); 3 Text-
> korrekturen (Tüpfelhyäne-Ton, Leopard/Serval Grammatik). **Natura 1205→1251 K / 6403→6767 F**
> (+46 / +364). order „Raubtiere" pool-t mit 15 Bestandskonzepten; fehlende Bilder unkritisch
> (643/911 Tiere haben ohnehin keins). verify 0 Fehler, Browser-verifiziert. Arten u.a.: Leopard,
> Jaguar, Seeotter, Südlicher See-Elefant (4 t, schwerstes Raubtier), Honigdachs, Vielfraß, Fossa,
> Krabbenfresser, Mittelmeer-Mönchsrobbe. **Hochrechnung:** ~1,5 Arten/Seite → Westheide Teil 1+2
> (~900 S.) birgt mehrere hundert weitere belegte Tierkonzepte. Skalierung = mehrere Page-Range-
> Slices parallel. Track B (Sachfrage-MCQ) weiter offen (braucht neuen Generator-Fragetyp, §6 Plan).

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
| Astra  | 1560 | 5035 | NASA / IAU / ESA / Wikidata | **3D-Himmelskörper (three.js)** + Kontext-Karte (Bahn/Distanz), Texturen Solar System Scope (CC BY 4.0); 478 Museumsbilder |
| Homo   | 599 | 1600 | Gray's Anatomy / Prometheus / NIH / MedlinePlus / StatPearls / OpenStax / Wikipedia | **Anatomiegrafiken (Wikimedia, PD)** + konzeptgenauer Struktur-Marker je Frage; ab v1.52 zehn Physiologie-Kategorien jenseits der Anatomie; v1.74/v1.75 Vertiefung + sleep_perception; **v1.82 Runde 2**: +114 Konzepte/+204 Fragen (psych_effect→94, hormone→41, muscle→83, nerve→29 u. a.) + 3 neue Kategorien joint/reflex/blood_group; 304 Museumsbilder (Physiologie-Kategorien erstmals bebildert) — Richtung ehrliches Ceiling (~1500–1700, NICHT 5000 — docs/homo_erweiterung.md §4; Runde 2: docs/homo_erweiterung_runde2.md) |
| Natura | 2402 | 13217 | Wikipedia / USGS / IUCN / IPCC / Wikidata | generische Konzeptkarte (`ConceptVisual`); Tiere via MiniMax-Delegation 49→97 ausgebaut (web-grounded); freies Commons-Foto je Konzept hinterlegt (`concept.image`, fürs spätere Museum) |
| Lingua | 1207 | 5540 | Wikipedia / Ethnologue / Wiktionary / Guinness / Wikidata | generische Konzeptkarte (`ConceptVisual`) mit dt. Attribut-Labels; 184 Museumsbilder (writing_system/language_family) |
| Cultura | 1920 | 6948 | Wikipedia (DE/EN) / Wikidata | generische Konzeptkarte (`ConceptVisual`) mit dt. Kategorie-/Attribut-Labels; via MiniMax-Delegation ausgebaut (Komponisten Wikidata-geprüft, Werke web-grounded); ab v1.83 Kategorie `genre_fiction` (Populärliteratur SF/Fantasy/Horror/Krimi, Auswahl aus Daniels eBook-/Hörbuch-Sammlung); 865 Museumsbilder |
| Machina | 2165 | 6131 | Wikipedia / RFC/IANA / Lehrbücher / DIN 8580 | generische Konzeptkarte (`ConceptVisual`) mit dt. Labels; Achse Funktionsprinzip (v1.47.0); ab v1.71 auch klassische Technik (Handwerk/Mechanik/Maschinenbau): tool/machine_element/engine/manufacturing_process/material/simple_machine (2 Wellen, v1.71+v1.73); 124 Museumsbilder (hardware) |
| Historia | 1244 | 6332 | Wikipedia / Wikidata | generische Konzeptkarte (`ConceptVisual`) mit dt. Labels; Achse Zeit/Urheberschaft, Politik-Ausschluss (v1.47.0); 1023 Museumsbilder |

> **Stand 2026-07-02 (v1.83.0) — Cultura Genre-Literatur (Populärliteratur) aus privater Sammlung:**
> Neue Kategorie **`genre_fiction`** (122 Konzepte / 616 Fragen): SF/Fantasy/Horror/Krimi-Werke
> (Dune, Foundation, Trisolaris, Scheibenwelt, Hexer, King, Lovecraft, Christie, Dürrenmatt …).
> **Entdeckungsschicht** war erstmals Daniels eBook-/Hörbuch-Sammlung (Scan `~/Nextcloud/eBooks` +
> `Odiobuks`, 561 Autoren, 105 mit eBook+Hörbuch = beliebt, [D]/[M]-gehört-Marker gewichtet;
> 117/122 Konzepte mit Treffer in der ebook_vectordb-Bibliothek) — **Faktenschicht blieb
> Wikipedia DE** (5 parallele Ernte-Agenten, Notabilitäts-Gate: ohne DE-Artikel raus; Ausnahmen
> nur für Hugo/Nebula-Kanon). Eigene Kategorie statt `literature`, damit Distraktor-Pools
> genre-intern bleiben; festes Genre-Vokabular (Science-Fiction/Fantasy/Horror/Kriminalroman/
> Thriller) gegen Pool-Zerfall. **Serien-Konzepte** (Foundation-Zyklus, Perry Rhodan, Scheibenwelt,
> Maigret … 18 Stück) tragen `startYear` statt `year` + eigene Templates („Von wem stammt die
> Reihe …" / „In welchem Jahr startete die Reihe …"); Perry Rhodan bewusst ohne author
> (Autorenkollektiv). Zitate-Kategorie NICHT erweitert (Copyright, PD-Gate †≤1955 gilt weiter).
> 6 Templates gesamt (author/series-author/startyear/language/genre/year/series/author-rev),
> verify_facts 0 Fehler, npm test 32/32, Browser-verifiziert (Genre-Frage mit ConceptVisual-Chips,
> testedAttribute-Ausblendung greift).
>
> **Stand 2026-07-01 (v1.77.2–v1.79.2) — MiniMax-QA-Mechanismus + erste Fund-Fixes:**
> Neues semantisches QA-Werkzeug `scripts/qa_review/` nutzt das MiniMax-Abo-Volumen, um Fragen
> INHALTLICH zu prüfen (ergänzt `verify_facts`/`audit_questions`): stratifizierte Stichprobe pro
> (`domain`×`type`) → panel-getreue Spieler-Sicht → mehrdimensionale MiniMax-Bewertung (Selbst-
> verräter, Wissensniveau bis „zu obskur", Klarheit, Distraktor-Qualität, Sachfehler-Verdacht) mit
> konkreter Problembenennung. One-Shot über `theplan/tools/llm_run.py` (toollos = effizient),
> salvage-fähiger Parser, kalibriert (Größenordnungs-Distraktoren nicht überflaggt). Doku:
> `scripts/qa_review/README.md`; Reports in `docs/qa_reports/` (Roh-JSON ge-gitignored).
> **Grenzen:** Quiz-Panel zeigt KEIN Bild (nur Museum) → Bild-Giveaway nur Astra/Homo; Terra
> ausgeklammert.
>
> **Triage-Entscheidung Selbstverräter (Daniel, 2026-07-01):** Semantische **Name-im-Prompt-Fälle**
> (z.B. „Zu welcher Klasse gehört der Flügelkopf-**Hammerhai**?" → Knorpelfische; „Rebenstecher" →
> Käfer) gelten als **akzeptabel und werden NICHT gefiltert** — dass ein gebildeter Spieler aus einem
> Trivialnamen die Kategorie ableitet, ist legitimes Allgemeinwissen, kein Defekt; ein generischer
> Filter wäre künstlich und würde gute Fragen verwerfen. Die übrigen im per-type-2-Sweep geflaggten
> Cluster (diverse `-rev`/kategorische Typen, `cultura-quote-*`) sind NICHT pauschal akzeptiert,
> sondern Aufgabe einer künftigen, QA-gegengeprüften Content-Runde (frischer Sweep auf gefixten Daten
> als Ausgangspunkt).
>
> **Angewandt** (326 + 409 Fragen) und Funde gefixt: `astra-nebula-messier`-Selbst-
> verräter (v1.78.1); `lingua-etymology-era` Jahr/Epoche-Mismatch (v1.78.2); Key-Fehler Rift-Höhe +
> Sprachfamilien-Anteile (v1.78.3); **Mess-Distraktor-Proximity-Guard** (nicht-ganzzahlige Korrekt-
> werte, `pickNumeric` nach `quizrandom.js` zentralisiert, v1.79.0); **Quellen-Selbstverräter-Guard**
> (671 Tiere „Grzimeks Tierleben – Vögel" leakte die Klasse; v1.79.1); Machina Panel-Leak `purpose`
> + Vokabular-Dedup (v1.79.2). Label-Zentralisierung + Dashboard-Kosmetik (v1.77.2),
> Bundle-Splitting (v1.79.3). **Alles bis v1.79.3 live deployt** (dm0.de/sci, HTTP 200,
> Brythonisch-Fix live verifiziert). Rest-Triage siehe Entscheidung oben (Name-im-Prompt akzeptiert;
> `-rev`/`cultura-quote-*`-Cluster → künftige QA-gegengeprüfte Content-Runde, Start mit frischem
> Sweep auf den gefixten Daten).
>
> **Code-Review-Triage-Entscheidung (Daniel, 2026-07-01):** Die agentische MiniMax-Nacht-Code-Review
> vom 2026-06-26 (386 rohe Bullet-Funde über 16 Chunks) ist als **zu rauschlastig abgehakt** — kein
> Per-Fund-Abarbeiten. Das echte Signal wurde bereits handverifiziert destilliert (Report
> `2026-06-28.md`) und der lohnende Teil (7 Funde: doppelter `ATTR_LABELS`-Key, stale `clickedMapId`,
> Terra-Generator-Ausgabepfad, tote Imports) in Commit `ee8d626` gefixt. Beide Review-Reports tragen
> den `done`-Marker; nicht erneut aufgreifen.
>
> **QA-Content-Runde v1.80.0 (2026-07-01) — keyDoubt entwarnt + Panel-Leaks systematisch geschlossen:**
> Die 7 `keyDoubt`-Sachfehler-Verdachte aus dem Validierungs-Sweep wurden einzeln faktisch (Web)
> gegengeprüft — **kein** keyed-Wert ist falsch (Krakatau=Caldera, Doppler=Physik, Morphofalter 20 cm,
> Salvator Mundi 0,66 m, Mantel<Latein, LACP, Atomzeitalter 1991 alle belegt; nur adjazente-Kategorien-
> Grenzfälle, kein Eingriff). Die eigentliche Arbeit waren **14 Panel-Leaks**: der Selbstverräter-Guard
> blendete nur das getestete Attribut aus, nicht fachlich redundante **Geschwister** (Lebenszeit
> „1653–1706" verriet Geburtsjahr, `fullName` buchstabierte Bereich/Datenart/Zweck aus, `location`
> verriet das Land …). Fix zentral in `src/components/conceptLabels.js`: neue `LEAKY_SIBLINGS`-Tabelle +
> geteilte Helfer `isAttrLeakedBeforeAnswer`/`sourceRevealsValue`, genutzt von `ConceptVisual.jsx` UND
> dem QA-Harness `build_batches.mjs` (eine Quelle, keine Drift); Quellen-Guard jetzt diakritika-robust +
> tokenweise (Dvořák/Messner). Wirkt **typ-agnostisch** über ALLE country/etymology/date/fullName-Fragen
> (tausende Fragen). Regressionstest `src/__tests__/conceptLabels.test.js` (25 Fälle) + deterministischer
> Offline-Beweis (14 Leaks → 0 sichtbar) + Live-Preview bestätigt. **Rohdaten unverändert** (Attribute
> bleiben für andere Fragen legitim). Die 18 Name-im-Prompt-Selbstverräter bleiben akzeptiert (Triage
> oben). Offen für eine Folgesession: ein frischer MiniMax-Sweep auf dem neuen Guard als End-to-End-
> Gegenprobe (bestätigt Leaks weg, checkt den `cultura-quote-*`-Rest).
>
> **Astra „hellster Stern" v1.81.0 (2026-07-01) — brightestStar-Herleitung (Hebel a):**
> Neuer Fragetyp `astra-constellation-brighteststar` (+52 Fragen, Astra 5031→5083). `generate_astra.js`
> leitet `brightestStar` je Sternbild aus den Sternkonzepten ab (kleinste `apparentMagnitude`; das
> uneinheitliche `star.constellation` — „Adler" vs. „Adler (Aquila)" — per Klammer-Strip normalisiert).
> Von 88 Sternbildern sind 57 im Sterndatensatz vertreten; davon **5 ausgeschlossen**
> (`BRIGHTEST_STAR_INCOMPLETE`), weil ihr real hellster Stern im Datensatz FEHLT und die Herleitung
> sonst faktisch falsch wäre — gegen Wikipedia verifiziert: Schwertfisch (real Alpha Doradus statt
> R136a1), Pfeil (Gamma Sagittae st. Sham), Fische (Eta Piscium st. Alrescha), Schlangenträger
> (Rasalhague st. Sabik), Becher (Delta Crateris st. Alkes). Verbleiben **52 faktisch geprüfte** Fragen.
> Sternnamen-Klammerzusätze („Atair (Altair)") beim Ableiten gestrippt → 0 Format-Tells. `AstraVisual`
> blendet bei diesem Test die Sternlisten (`notableStars`/`mainStars`) aus (eigener Leak-Guard, analog
> LEAKY_SIBLINGS). Distraktoren = hellste Sterne anderer Sternbilder. **Ausbau** für die 31 unabge-
> deckten + 5 ausgeschlossenen Sternbilder: fehlende helle Sterne in `astra_raw.json` nachtragen
> (eigener Schritt) — dann Ausschlussliste entsprechend kürzen.
>
> **Stand 2026-06-30 (v1.77.0) — Spielmodi Phase 2: Mehrspieler (reihum, Namen, Sieger):**
> Hot-Seat-Mehrspieler, **nur feste Rundenlänge** (Survival bleibt Solo — bewusst, eigene Leben pro
> Spieler = späterer Ausbau). **`QuizLauncher.jsx`:** Mitspieler-Wahl 1–4 (Button-Reihe) + je ein
> Namensfeld (Default „Spieler N", überschreibbar, nicht persistiert); im Mehrspieler-Modus wird die
> Survival-Option ausgeblendet. `onStart(mode, roundConfig, players)`. **`App.jsx`:** `quizPlayers`-State
> ([] = Solo), an `Quiz` durchgereicht; Schnellquiz erzwingt Solo. **`Quiz.jsx`:** `isMultiplayer`
> (players.length>1), `playerScores[]` + `currentPlayerIdx`; Rundenlänge wird fair auf ein Vielfaches der
> Spielerzahl aufgerundet (jeder gleich viele Fragen); Spielerwechsel reihum in `handleNextQuestion`;
> Treffer dem aktuellen Spieler gutgeschrieben; HUD zeigt „<Name> ist dran"-Banner + Live-Punktestand
> aller Spieler; End-Screen = Rangliste mit ★-Sieger bzw. „Unentschieden!". **Wichtig:** im Mehrspieler
> **kein** `saveUserAnswer`/`onAddScore` — Gäste-Antworten verfälschen weder SRS noch Highscore (reiner
> Party-Modus). Build/test/layout grün, Browser-verifiziert (2 Spieler Anna/Bjarne: reihum-Wechsel,
> faire 5/5-Aufteilung bei 10 Fragen, „Anna gewinnt!" ★2:1; 3-Spieler-Setup mobil; Survival im
> Mehrspieler ausgeblendet; 0 Konsolenfehler). **NICHT deployt.** **Offen:** Phase 3 Museum-Redesign;
> Mobile-Feinschliff; optional Survival-Mehrspieler + Namen merken.
>
> **Stand 2026-06-30 (v1.76.0) — Spielmodi Phase 1: Scientia-Mischpool + Survival + wählbare Rundenlänge:**
> Erster Schritt des Spielspaß-Ausbaus (Nutzerwunsch: länger am Stück spielbar). **Drei Features, Solo:**
> (1) **Neuer Meta-Bereich `scientia`** als erster Dropdown-Eintrag (`src/domains/index.js`, Icon Layers,
> accent #B0863C) — zieht Fragen + Konzepte ALLER 7 Sach-Domains zusammen (`SCIENTIA_MIX_IDS`,
> `loadQuestions = Promise.all(...).flat()`, `loadConcepts = Object.assign(...)`). **Terra bewusst NICHT
> im Mix** (Karten-Klick-Fragen brauchen die Weltkarte; geodb-Konzepte passen nicht ins generische
> ConceptVisual). Kein eigenes Visual/Explorer → jede Frage rendert über das generische ConceptVisual mit
> ihrem Herkunfts-Konzept. (2) **Wählbare Rundenlänge 10/25/50** statt der früher hart codierten 5
> (`Quiz.jsx` `targetCount` ersetzt alle `>= 5`; `roundConfig`-Prop von `QuizLauncher`→`App`→`Quiz`).
> (3) **Survival-Modus „Überleben (3 Leben)"** — endlos bis 3 Fehler, HUD mit Herzen ♥♥♥ (rot/grau),
> kein Fortschrittsbalken, End-Screen „Aus! — Du hast N Fragen richtig beantwortet". Leben werden bei
> falscher MCQ-Antwort UND beim Terra-Karten-Klick-3-Fehler abgezogen. **Setup-Ebene generisch** in
> `QuizLauncher.jsx` (Spiellänge-Radiogruppe für JEDEN Bereich; Terra-Geomodi bleiben darüber).
> Build grün, npm test 2/2, Layout 17/17, Browser-verifiziert (Scientia-Mischpool: Historia-/Natura-
> Fragen; feste 25er-Runde „FRAGE 1 VON 25"; Survival endete sauber beim 3. Fehler; Mobile 375px
> gestapelt lesbar; 0 Konsolenfehler). **NICHT deployt.** **Offen:** Phase 2 Mehrspieler (Namen, reihum,
> Sieger-Screen); Phase 3 Museum-Redesign; Mobile-Feinschliff (Visual-Panel nimmt im Quiz ~38vh,
> Frage unter dem Fold — vorbestehend); perf-Option: Mischpool lädt ~44k Fragen, später per Domain sampeln;
> später ggf. Terra + per-Frage-Domain-Visual in den Mischpool.
>
> **Stand 2026-06-30 (v1.75.0) — Homo Welle 2: neue Kategorie sleep_perception + Vertiefung (MiniMax):**
> Fortsetzung Richtung ehrliches Ceiling. **+32 Konzepte / +83 Fragen → Homo 453→485 K / 1313→1396 F.**
> **Neue Kategorie `sleep_perception`** (Schlaf & Gedächtnis: REM/Tiefschlaf/Leichtschlaf/Schlafzyklus,
> zirkadianer + Schlaf-Wach-Rhythmus, Kurzzeit-/Arbeits-/Langzeit-/sensorisches/prozedurales Gedächtnis,
> Gedächtniskonsolidierung — rein physiologisch, keine Schlafstörungen) — Schema wie psych_effect
> (`definition` POST_ANSWER + `kind`-Klassifikator), 3 Generator-Templates in `generate_homo.js`, dt.
> Labels „Schlaf & Gedächtnis"/„Art" in HomoVisual.jsx + ConceptVisual.jsx. **Vertiefung** psych_effect +12
> (Fundamentaler Attributionsfehler, Spielerfehlschluss, Pareidolie, Planungsfehlschluss, Affekt-/
> Rekognitionsheuristik, Gerechte-Welt-Glaube u.a.) + cell_type +8 (Oligodendrozyt/Mikroglia/Enterozyt/
> Podozyt/Pyramidenzelle/Sertoli-/Leydig-/Kupffer-Zelle). **immune_defense bewusst NICHT gebaut:** die
> Immunzellen (Lymphozyt/Makrophage/Granulozyt/Plasmazelle/NK-Zelle …) liegen längst in cell_type →
> der doc-Vorschlag würde massiv überlappen. **Opus-Verifikation fing:** Krankheit als funFact-/notableFor-
> Fokus (Oligodendrozyt „Ursache der MS" — sachlich falsch; Podozyt krankheitszentriert), Faktenfehler
> (Kupffer „größte Zellpopulation der Leber" — das sind Hepatozyten), erfundener Latein-Name „Cellula
> Kuffera", Namens-Stamm in notableFor (Pyramidenzelle), 2 Definitions-Selbstverräter (Schlaf-Wach-
> Rhythmus „Wach-/Schlafphasen", Gerechte-Welt-Glaube „die Welt … gerecht"), 1 public-heikles Beispiel
> (illusorische Korrelation: Kriminalität+Minderheiten → neutrales Vollmond-Beispiel). verify 0, audit
> Strukt 0 / Bias 0 / 0 neue Format-Tells, npm test grün, Build grün. Browser: volle Homo-Runde mit
> 485/1396 fehlerfrei; sleep-Fragen wohlgeformt (Datenebene). **NICHT deployt.** **Damit ist Homos faires
> Reservoir weitgehend ausgeschöpft** — weiteres Volumen Richtung 5000 nur regelkonform via Natura
> `microbe` (Erreger) + Historia Medizingeschichte (docs/homo_erweiterung.md §4), NICHT in Homo.
>
> **Stand 2026-06-30 (v1.74.0) — Homo-Vertiefung Richtung ehrliches Ceiling (MiniMax-Delegation):**
> Homo ist die einzige Domain unter dem 5000-Ziel; laut `docs/homo_erweiterung.md` §4 ist ihr ehrliches
> Ceiling **~1500–1700 Fragen, NICHT 5000** (der Massen-Hebel Krankheiten/Erreger ist per
> `bereichs_abgrenzung.md` regelwidrig → gehört nach Natura `microbe` bzw. Historia Medizingeschichte).
> Auf Nutzerentscheidung „bis Ceiling ausbauen" eine reine **Datenvertiefung** (kein Code) der vier
> Kategorien mit Restspielraum: **+40 Konzepte / +118 Fragen → Homo 413→453 K / 1195→1313 F**
> (nerve +9: fehlende Hirnnerven IV/VI/IX/XI/XII + periphere femoralis/tibialis/fibularis/axillaris;
> hormone +9: EPO/Gastrin/Sekretin/CCK/Leptin/Ghrelin/Somatostatin/FSH/LH; cell_type +8: Astrozyt/
> Schwann/Endothel/Beta/Alpha/Pneumozyt/Purkinje/Belegzelle; psych_effect +14: Repräsentativitäts-/
> Spotlight-/IKEA-/Besitztums-/Status-quo-/Optimismus-/Falscher-Konsens-/Hawthorne-/Survivorship-/
> Lockvogel-/Cocktailparty-/Default-/Negativitäts-Effekt + Verfügbarkeitskaskade). **Pipeline:**
> 4 parallele MiniMax-Finder (OpenCode, sandbox-isoliert nach /tmp) → Opus-Faktenverifikation gegen
> Lehrbuchwissen → deterministische Korrekturen → `append_concepts` (0 verworfen) → generate → verify
> (0 Fehler) → audit (Strukt 0 / Bias-Templates 0 / 0 neue Format-Tells) → npm test grün →
> Browser-verifiziert (Homo-Quiz, neue Konzepte rendern mit dt. Labels + fairen Distraktoren, 0
> Konsolenfehler). **Opus-Verifikation fing:** 3 Regelverstöße (Entdeckungsdatum/-person im funFact:
> Sekretin 1902 Bayliss/Starling, Leptin 1994, Schwann-Zelle/Purkinje — gehört nach Historia →
> funFacts umgeschrieben), redundante fachNames (= Namenswiederholung → getrennt), Klammernamen
> entklammert, 3 Format-Tells (Ziffer/Klammer nur in der richtigen Option) geglättet. MiniMax-Schwäche
> (Quality-Log): schmuggelt trotz Verbot wiederholt Entdeckungsdaten/-personen in funFacts.
> **NICHT deployt.** Offen Richtung Ceiling: 2 neue faire Kategorien (immune_defense, sleep_perception)
> + ggf. weitere Vertiefung.
>
> **Stand 2026-06-25 (v1.73.0) — Machina klassische Technik Welle 2 (Vertiefung) + Deploy:**
> Zweite Welle über dieselben 6 Technik-Kategorien (Dedup-Listen aus dem Bestand an die Finder), bewährte
> Pipeline (6 Sonnet-Finder → Gate → 6 adversariale Opus-Verifier → append). **+207 Konzepte / +433 Fragen:
> Machina 1958→2165 K / 5698→6131 F.** Verifier-Funde u.a.: erfundenes „Beißring (Sprengringlehre)",
> Kreuzschubkurbel-Physik (Scotch Yoke hat KEINE Pleuelstange → Schlitzführung), Hartmetall umklassifiziert
> (Nichteisenmetall→Verbundwerkstoff), Ramjet/Pulsojet/Hydraulikmotor `type` entfernt (Staustrahl/Verdränger
> = keine Turbine, „lieber weglassen als raten"), Legierungs-Antwort-Leaks in `property` entschärft, Kronenrad
> (kein Kegelrad), Torsionsstab (Torsion statt Biegung). 3 fragenlose Engines (weder type noch energySource →
> 0 Fragen) bewusst verworfen statt als Dead-Weight zu führen. tool-Finder hatte `sourceName` vergessen →
> Verifier ergänzt. Alle `verify_facts` 0 Fehler, audit Machina Strukt 0 / Bias-Templates 0, npm test grün,
> Build/Layout 17/17. **Reservoir der klassischen Technik damit weitgehend ausgeschöpft** (Welle-2-Verifier
> sortierten zunehmend Obskures aus — weitere Wellen brächten v.a. Nischenbegriffe; Qualität vor Menge).
> **Mit v1.71/v1.72 zusammen deployt (dm0.de/sci).**
>
> **Stand 2026-06-25 (v1.72.0) — Größenordnungs-Distraktoren für numerische Maße (Fairness, Nutzerwunsch):**
> Numerische Fragen mit eng gehäuften Nachbarwert-Distraktoren (z.B. Schlangenlänge „59/60/63/65 cm",
> Galaxien-Distanz) verlangten Maschinen-Präzision — Größenordnungs-Gespür half nicht. Neuer **Magnitude-
> Spread** (`shouldMagnitudeSpread` + `magnitudeSpreadDistractors` in `scripts/lib/quizrandom.js`): wo ein
> Maß über **≥2 Größenordnungen** streut, werden die Distraktoren als EIN Wert ~÷10, EIN Wert ~×10 und EIN
> mäßig naher Wert (gleiche Größenordnung, seed-abhängig drüber/drunter) gesetzt — aus **echten Pool-Werten**
> (Var-B: Werte, die ein anderes Konzept derselben Kategorie wirklich hat, keine erfundenen Zahlen; an den
> Rändern automatisch der nächste reale Wert in Log-Distanz statt absurder Out-of-Range-Werte). Wer die
> Größenordnung kennt, schließt die zwei Ausreißer aus → faire 50:50 statt blindem Raten. **Datengetrieben
> über alle Domains** (Pool-Spanne ≥100×, positiv): greift bei Natura (Tier-Länge/-Gewicht/-Tempo,
> Pflanzenhöhe/-alter), Astra (Stern-/Galaxien-/Nebel-Distanz, Mond-/Asteroiden-Durchmesser, Umlaufzeiten,
> Sternzahl, Masse), Lingua (Sprecher-/Zeichen-/Sprachenzahl), Cultura (Skulpturhöhe), Homo (Organgewicht).
> **Bewusst ausgeschlossen** (`MAGNITUDE_EXCLUDE_ATTRS` + Span-Heuristik): Jahreszahlen (spannen <100× →
> bleiben Nachbarwert), beschränkte/log. Skalen (Mohshärte, scheinbare Sternhelligkeit), Identifikatoren
> (defaultPort, Katalognummern, Ordinalzahlen). Jeder Aufrufer behält seinen Fallback (Nachbarwert bzw.
> astra-`spreadNumeric` bei eng häufenden Exoplaneten-Radien); der Helfer liefert `null` bei Nicht-Eignung.
> Beispiele nachher: Lanzenotter 6/31/60/600 cm · Andromeda 260k/2,5M/4,47M/25M Lj · Herz 30/150/300/1500 g.
> **Audit:** Bias-Templates unverändert (astra/lingua/natura je 1 vorbestehend-marginal, **kein** Magnitude-
> Template darunter — die korrekte Antwort liegt bauartbedingt in der Mitte → ~25 %). Alle `verify_facts`
> 0 Fehler, npm test grün, Build grün, Live-verifiziert (Schlange/Andromeda über den Dev-Server). **NICHT deployt.**
>
> **Stand 2026-06-25 (v1.71.0) — Machina über die IT hinaus: klassische Technik (Handwerk/Mechanik/Maschinenbau):**
> Machinas Achse ist „Funktionsprinzip" — laut Bereichs-Abgrenzung ausdrücklich „Funktionsprinzip von …
> Geräten, Verfahren", bislang aber nur mit IT befüllt. Auf Nutzerwunsch (Technik jenseits Software/
> Computer) **6 neue Kategorien** ergänzt, alle entlang derselben Achse (kein Erfindungsdatum/-person —
> das bleibt Historia): `tool` (Handwerkzeuge: Gewerk/Funktion), `machine_element` (Maschinenelemente:
> Gruppe/Funktion), `engine` (Kraftmaschinen: Gattung/Energiequelle/Arbeitsweise), `manufacturing_process`
> (Fertigungsverfahren: **DIN-8580-Hauptgruppe**/Zweck), `material` (techn. Werkstoffe: Klasse/Eigenschaft —
> nur ingenieurmäßig, reine Minerale bleiben Natura), `simple_machine` (einfache Maschinen/Mechanismen:
> Funktion/Wirkprinzip). **+269 Konzepte / +573 Fragen: Machina 1689→1958 K / 5125→5698 F.** Pipeline:
> 6 Sonnet-Finder (produce-only nach /tmp, Schema/kontrolliertes Vokabular in `SPEC_machina_historia.md`)
> → programmatischer Gate-Check (JSON/Vokabular/ASCII-Umlaut, 0 Befunde) → 6 **adversariale Opus-Verifier**
> (in-place bereinigt: 10 entfernt — obskur/Dublette; Selbstverräter-Funktionen entschärft; Stirling-/
> Hydraulik-/Raketen-`type` als Vokabular-Fehlpass entfernt statt geraten; Kerosin-`energySource`
> weggelassen; alle DIN-8580-/Werkstoffklassen-Zuordnungen fachlich bestätigt) → `append_concepts`
> (additiv, 0 verworfen) → generate → verify (0 Fehler) → `audit:questions` (Machina Strukt 0 / Bias-
> Templates 0) → npm test grün → Build grün, Layout 17/17 → **Browser-verifiziert** (Handwerk-Frage
> „Läppen → DIN-8580-Hauptgruppe Trennen" rendert mit dt. Labels, faire Distraktoren, 0 Konsolenfehler).
> Neue Generator-Templates in `generate_machina.js` (Engine unverändert), CATEGORY_LABELS + ATTR_LABELS
> (Gewerk/Energiequelle/Wirkprinzip/Hauptgruppe/Werkstoffklasse/Eigenschaft/Gattung) + POST_ANSWER_ATTRS
> (principle/property) in `ConceptVisual.jsx`; Domain-Beschreibung/shortLabel aktualisiert. **Bekannte
> kleine Lücke:** Vokabular-Werte mit Schrägstrich (z.B. trade „Garten/Landwirtschaft", category
> „Lager/Führung") verlieren ihre Vorwärts-cat-Frage (Generator-Slash-Skip gegen mehrdeutige Antworten),
> behalten aber Reverse + andere Templates — bewusst nicht angefasst (der Skip schützt IT-Kategorien wie
> transport „TCP/UDP"). **NICHT deployt.**
>
> **Stand 2026-06-25 (v1.59.0–v1.70.0) — 5000-Ziel für ALLE MCQ-Domains außer Homo erreicht + Vertiefung (+~10 100 Fragen):**
> Autonome Content-Offensive in 9 Commits: sechs orchestrierte `find → verify`-Workflows (h1–h6,
> je Opus-Finder + adversarialer Opus-Verifier, additiver `append_concepts`, eigene Fakt-Stichprobe)
> plus interleavte Bild-Wellen. **+2093 Konzepte / +~7300 Fragen:** Historia 838→**1076** K /
> 4251→**5359** F (h1, unterbrochene Ernte fertig verifiziert); Machina 756→**1689** K / 2355→**5125** F
> (h2–h6, von weit unter Ziel über 5000); Astra 937→**1560** K / 3088→**5035** F (h2–h6); Lingua
> 795→**1094** K / 3534→**5025** F (h2–h3). **Damit liegen Terra, Astra, Natura, Lingua, Cultura,
> Machina, Historia alle ≥ 5000; nur Homo bleibt am ehrlichen Ceiling (1195).** Museumsbilder
> +~630 (Historia 0→880, Astra →478, Machina →124, Lingua →184, Homo →173).
> **Verifier fingen u.a.:** widerlegte Exoplaneten (Gliese 581 f, Tau Ceti f), erfundene Akronym-
> Vollformen (WebGPU), fabrizierte 404-Quell-URLs (Zhurong/Gienah/Fast-inverse-sqrt → echte ersetzt),
> obskure Objekte (38 von 42 19.-Jh.-Asteroiden, Mini-Moonlets, tote Sprachen), Big-O-Fehler („O(∞)"),
> Etymologie-Korrekturen gegen DWDS, astronomische Faktenfehler (Gienah oranger Riese, Azha 137 Lj).
> **Neue Tooling-Helfer (`scripts/data_sources/harvest/`):** `build_dedup.cjs` (Dedup-Namensliste je
> Kategorie für Finder), `normalize_case.cjs --wave=hN` (konformiert NUR Wellen-Konzepte an die
> Bestands-Schreibweise kategorialer Werte — fing „interpretiert"/„Interpretiert"-Doppeloptionen,
> Bestand bleibt unangetastet), `apply_images.cjs` (Apply /tmp-Bildmapping + `--prune` nach
> `check_images`). Alle `verify_facts` 0 Fehler, `audit:questions` Strukt 0 / Bias-Templates
> unverändert, `npm test` grün. **Offen:** Machina-`compression` hat zwei Parallelvokabulare
> (Bestands-Altlast, kein neuer Defekt — Kanonisierung als Qualitätsaufgabe vorgemerkt).
> **Anschluss-Enrichment v1.69–v1.70 (e1):** +542 Konzepte / +2778 Fragen über die Domains mit
> tiefem fairen Reservoir jenseits 5000 — Cultura 5042→**6332**, Historia 5359→**6332**, Lingua
> 5025→**5540** (Renaissance-/russ.-Realismus-Werke, verstorbene Forscher SEM/STM/Townes/Libby,
> Körper-/Fremdwort-Etymologien). Verifier entfernte u.a. „Der Zigeunerbaron" (abwertende Bezeichnung
> im Titel), ein fabriziertes „Tintenstrahl-Faxgerät" und eine erfundene Lampe-Etymologie; +274
> Museumsbilder (Cultura →865, Historia →1023). **Gesamt aktuell: 8 Domains 47 993 Fragen.**
> **NICHT deployt (live weiterhin v1.46.1).**
>
> **Stand 2026-06-25 (v1.52.0–v1.58.0) — Homo-Physiologie-Ausbau (3 Wellen) + Museum-Bildoffensive (6 Domains):**
> **(A) Homo jenseits der Anatomie (261/718 → 413/1195, +152 Konzepte/+477 Fragen)** nach
> [`docs/homo_erweiterung.md`](docs/homo_erweiterung.md) in 3 Wellen, je Opus-Finder + adversariale
> Opus-Verifier (Workflow), eigene Fakt-Stichprobe, deterministischer ASCII→Umlaut-Fix (nur Welle 1
> nötig — ab Welle 2 explizite Umlaut-Vorgabe im Prompt), `append_concepts` + `audit:questions`-Gate:
> **v1.52** cell_type(31)/hormone(20)/vitamin(13)/sense(6); **v1.53** digestive_enzyme(12)/nerve(13)/
> psych_effect(30); **v1.54** nutrient_macro(13)/development_stage(10)/brain_lobe(4). 33 neue Generator-
> Templates in `generate_homo.js` (Engine unverändert: `byCategory`/`pickBalanced`/`revealsAnswer`);
> dt. Labels für 10 Kategorien + Attribute in `HomoVisual.jsx`+`ConceptVisual.jsx`; `characteristic`
> zu POST_ANSWER_ATTRS. Fairness-Fixes pro Welle (Klammernamen entschärft, gland-Vorwärtsfrage wegen
> 4-Werte-Längenbias weggelassen). **Homos ehrliches Ceiling ~1500 Fragen ist damit weitgehend
> erreicht** (docs/homo_erweiterung.md §4) — weitere Kategorien wären obskur/Krankheits-Grauzone.
> **(B) Museum-Bilder ~1926 → ~3884 (+~1958 freie Bilder)** über den **gebündelten** Resolver
> (`resolve_images_batched.cjs`, 50 Einheiten/Request → kein Rate-Limit, ~2 min/Domain statt Stunden;
> der per-Konzept-Resolver wurde verworfen). Resolver gehärtet: TARGETS um historia/homo/machina
> erweitert, `redirects=1` + Redirect-Kette, echter NC/ND-Lizenzriegel (SA bleibt frei). `check_images.cjs`
> live als strenge Endkontrolle (Lizenz/MIME/Existenz) + programmatischer Scan auf Nicht-Bild/Karten/
> nicht-lateinische Dateinamen + Stichprobe je Domain: **historia 0→652** (v1.55, war Null-Bild-Domain),
> **natura 1093→1878 (+785, größter Hebel)** (v1.56), **homo 83→168 / machina 0→56** (v1.57),
> **cultura 428→734 / astra 182→256** (v1.58). Entfernt wurden je Domain wenige Videos (webm/ogv),
> PDF-Notenblätter, streng-unfreie Porträts und 2 natura-Fehltreffer (hebr. Schmuckbild, Verbreitungs-
> karte). Alle `verify_facts` 0 Fehler, Build grün, Homo-Quiz + Museum browser-verifiziert. **Bewusst
> NICHT gebaut** (docs/bildquellen_strategie.md): Foto-Zwang für Text-Kategorien (quote/etymology/
> constant/exoplanet) und die prozeduralen Machina-SVG-Generatoren (separater Großaufwand). **NICHT
> deployt (live weiterhin v1.46.1).**
>
> **Stand 2026-06-24 (v1.51.0) — Qualitätswelle: faire Distraktoren + Museum-Aufwertung + Bild-Audit:**
> KEINE neuen Konzepte/Fragen (Zahlen unverändert) — diese Welle macht den BESTAND besser.
> **(1) Selbstverräter-/Fairness-Fix der Distraktoren (Hauptarbeit).** Ein deterministischer
> Audit (`scripts/audit_questions.cjs`, `npm run audit:questions`) über ALLE Fragen + ein
> adversarialer Opus-Workflow (8 Domain-Finder → Verifier → Synthese) fanden denselben
> systemischen Defekt: Die Picker (`pickCategorical`/`pickNames`/`pickDistractors`) nahmen via
> `.slice(0,3)` IMMER die ersten drei Pool-Einträge als Distraktoren → die richtige Antwort war
> systematisch die längste/kürzeste Option (Homo organ-weight-rev 90,5 % „längste", Machina
> hw-category-rev 89,9 %, Natura plant-sciname-rev 96,4 % „kürzeste" usw.) und über „längste
> Antwort raten" wissensfrei lösbar. Zusätzlich ein echter Bug: `pickDistractors` (astra/homo)
> sortierte numerisch über `Number("4,5 mag")`=NaN → Nachbarwert-Sortierung versagte bei
> einheitsbehafteten Werten und fiel auf feste Distraktoren zurück (astra-star-magnitude: 128/131
> Fragen mit fixem absurden Tripel Sonne/Sirius/Beteigeuze). **Fix:** neues Modul
> `scripts/lib/quizrandom.js` (`seededShuffle` reproduzierbar, `pickBalanced` = längen-balancierte
> Auswahl → richtige Antwort liegt mittig, ~25 % statt ~90 %; `deParse` für dt. Zahlformat).
> Alle 7 MCQ-Generatoren darauf umgestellt (Terra war schon zufalls-basiert → nie betroffen).
> Ergebnis: **Bias-Templates 43 → 3** (alle marginal: n≤15 oder Δ<1,5 Zeichen). Zusätzlich Homo
> Substring-Overlap-Guard (verhindert Doppel-richtig „Verdauung"/„Verdauungssystem").
> **(2) Museum grafisch aufgewertet** (`MuseumExplorer.jsx` + `index.css`): gerahmte „mattierte"
> Karten im Pergament-Stil (Doppelrahmen wie `.terra-panel`), Hover-Lift + Bild-Zoom, Museums-
> Placard (Kategorie-Kapitälchen + Titel), Shimmer-Skelett beim Laden, Lightbox mit Backdrop-Blur.
> **(3) Bild-Stichprobe** (`check_images.cjs` live gegen Commons, 1926 Bilder): 1923 ok. 3 Flags
> „license not free" → 2 Fehlalarme (`isFree` erkannte die freien Vorlagen {{Attribution}} /
> {{Copyrighted free use}} nicht → Heuristik ergänzt), 1 echter Themen-Fehler (astra `messier-43`
> trug ein M42-Bild → entfernt, `imageSearchTerm` bleibt fürs Nachresolven). Visuelle Themen-
> Stichprobe von 7 diversen Bildern: alle korrekt. **Verifiziert:** verify_facts 0 Fehler (alle),
> npm test grün, Build grün, Layout 17/17, Homo-Quiz + Museum browser-verifiziert (0 Konsolen-
> fehler). **NICHT deployt** (live weiterhin v1.46.1). **Offene Follow-ups (Audit-Report, niedrige
> Prio):** Homo `system`-Attribut kanonisieren (Verdauung/Verdauungssystem, Sinnesorgan/-organe,
> Endokrines-System-Varianten); Cultura medium „Leinwand"→„Öl auf Leinwand" (15 Einträge, je
> einzeln verifizieren); Cognat-/Format-Outlier-Tells (Muster B/C) sind Daten-, keine Generator-
> Themen; M43 freies Bild nachresolven sobald Commons-Rate-Limit frei.
> **Strategie-Pläne für die nächsten Wellen** (Multi-Angle-Opus-Recherche, repo-verifiziert):
> [`docs/homo_erweiterung.md`](docs/homo_erweiterung.md) — Homo jenseits der Anatomie (16 neue
> faire Kategorien: psych_effect/cell_type/hormone/vitamin/nerve…, netto ~150–200 Konzepte,
> ehrliche Obergrenze ~2000 Fragen, 5000 für Homo unerreichbar) und
> [`docs/bildquellen_strategie.md`](docs/bildquellen_strategie.md) — mehr freie Museum-Bilder
> (Historia 0→~670 via bestehendem P18-Resolver, Machina selektiv ~150–200 + prozedurale SVGs,
> Gap-Fill der teilabgedeckten Domains ~1000–1200; **Datenfund: lingua_raw QID Q13199
> ‚Birmanisch' zeigt real auf Rätoromanisch → vor Lingua-Bildlauf prüfen**).
>
> **Stand 2026-06-24 (v1.50.0) — Konzept-Skalierung-Welle 7 (4 Domains unter 5000):**
> Zweite orchestrierte Welle, **26 Opus-Agenten** (13 `find → verify`-Slices) über die vier noch
> unter 5000 liegenden Domains; Dedup-Listen/Schema-Karten vor dem Lauf aus den AKTUELLEN (post-
> Welle-6) raw-Dateien neu erzeugt, damit Finder nichts doppeln. **+637 Konzepte / +2676 Fragen:**
> Historia 617→838 K / 3082→**4251** F (Erfindungen/Entdeckungen + **105 verstorbene Forscher/Denker**
> — Herschel/Dijkstra/Zu Chongzhi/Semmelweis/Hedy Lamarr u.v.a., alle mit birthYear + verstorben-
> geprüft, keine Politiker; Epochen/Meilensteine/Expeditionen); Lingua 586→795 K / 2562→**3534** F
> (+131 Etymologien Sklave/Tragödie/Hurrikan/Bonsai u.a., Sprachen/Familien, Schriftsysteme/Phonetik/
> Grammatik); Astra 859→937 K / 2910→**3088** F (Messier/NGC/Caldwell-Deep-Sky, benannte Sterne
> Alioth/Schedir, Sternhaufen M7/M11, Kometen West/Borrelly, Monde/Asteroiden — Sternbilder bleiben
> bei 88/88 komplett); Machina 627→756 K / 1998→**2355** F (Sprachen/Protokolle, Formate/Algorithmen
> Hierholzer/Johnson/VEB, Hardware/Akronyme NVMe/PCIe, Konzepte). **Verifier-Funde:** Dubletten
> (Konusnebel=Kegelnebel erneut, Geigerzähler/Tonband/Reibzündholz), Fakten (NGC 3115 Schwarzloch
> ~2 Mrd M☉, Joule = mechanisches Wärmeäquivalent statt „1. Hauptsatz", Haartrockner Godefroy 1890).
> **Merge-Lehre:** 3 recycelte/generische ids aus Vorwellen (`expedition-otto-von-kotzebue-weltreise`
> trug Cabrillo-Inhalt; `etymologie-tycoon`=„Ketzer"; `quechua`=Sprachfamilie) hätten 3 gute neue
> Konzepte per id-Dedup still verdrängt → vor dem `--write` erkannt, eindeutige `-w7`-ids vergeben,
> alle 637 gemergt. Eigene Stichprobe (24 Fakten + alle 105 figure-birthYears) sauber. Alle
> `verify_facts` 0 Fehler (Machina: 32 strukturelle `format-compression`-3-Optionen-Warnungen,
> vorbestehend). npm test grün, Layout 17/17, Historia + Machina browser-verifiziert (0 Konsolen-
> fehler). **NICHT deployt.** **Stand vs 5000-Ziel:** auf/über Ziel: Terra (5217), Natura (13217),
> Cultura (5042); drunter: Historia 4251, Lingua 3534, Astra 3088, Machina 2355, Homo 718.
>
> **Stand 2026-06-24 (v1.49.0) — Konzept-Skalierung-Welle 6 (18-Slice-Workflow, Opus-Welle):**
> Ein einziger orchestrierter Workflow mit **36 Opus-Agenten** (18 `find → verify`-Slices über die
> fünf wachsenden Domains, max. parallel): pro Slice ein Opus-Finder (famous-only, Schema +
> Dedup-Namensliste je Kategorie aus dem raw gespiegelt) → ein adversarialer Opus-Verifier
> (Datei-in-place bereinigt, unsichere Zahlen web-verifiziert). Merge/Generate/Verify/Test/
> Stichprobe/Commit deterministisch im Hauptkontext (Subagents nie committet). **+783 Konzepte /
> +3170 Fragen:** Cultura 1315→1537 K / 4175→**5042** F (über 5000-Ziel! berühmte Gemälde/Skulpturen/
> Bauwerke/Komponisten/Werke/Strömungen + gemeinfreie Zitate); Historia 446→617 K / 2218→3082 F
> (Erfindungen/Entdeckungen/verstorbene Forscher/Epochen/Meilensteine, Politik ausgeschlossen);
> Lingua 458→586 K / 2036→2562 F (Etymologien, Sprachen/Familien, Schriftsysteme); Astra 755→859 K /
> 2521→2910 F (Messier/NGC-Deep-Sky, benannte Sterne, Exoplaneten/Monde, restl. IAU-Sternbilder);
> Machina 469→627 K / 1474→1998 F (Sprachen/Protokolle, Formate/Algorithmen, Hardware/Akronyme/
> Konzepte, Achse Funktionsprinzip). **Verifier-Funde u.a.:** Dubletten gefangen (Konusnebel=
> Kegelnebel, Kaus Australis/Gienah als Bayer-Bezeichnung im Bestand, Wi-Fi-„Wireless Fidelity"-
> Mythos, Visual Basic id-Dublette); Fakten korrigiert (Avior/Aspidiske = Falsches Kreuz statt
> Diamantkreuz, M13 numStars 300.000, McClintock-Transposons 1950, Vitamin K 1934, Calvin-Zyklus =
> CO₂-Fixierung statt O₂-Quelle, Oberon-Endung `.Mod`, VXLAN Layer-2-Overlay, Sindhi/Mande-
> Sprecherzahlen). Append additiv via `harvest/append_concepts.cjs` (uniform für alle 5 Domains —
> `merge_machina_historia.js` existiert nicht mehr; Rebuild-Modell entfällt). Eigene Stichprobe
> (25 Fakten über 5 Domains) sauber. Alle `verify_facts` 0 Fehler (Machina: 29 strukturelle
> 3-Optionen-Warnungen bei `format-compression` — vorbestehend, da das `compression`-Attribut nur
> 4 Werte hat; keine Fehler). npm test grün, Layout 17/17, Cultura + Machina browser-verifiziert
> (echte 4-Optionen-Fragen, Umlaute, Selbstverräter-Guard, 0 Konsolenfehler). **NICHT deployt.**
> **Stand vs 5000-Ziel:** über/auf Ziel jetzt Terra (5217), Natura (13217), **Cultura (5042)**;
> weiterhin drunter: Historia 3082, Astra 2910, Lingua 2562, Machina 1998, Homo 718 (Anatomie-Ceiling).
>
> **Stand 2026-06-24 (v1.48.0) — Konzept-Skalierung ALLER Domains unter 5000 (Opus-Welle):**
> Parallel über alle sechs Domains unter dem 5000-Ziel, Finder + Verifier diesmal mit **Opus**
> (statt Sonnet): 6 Opus-Finder (famous-only, Schema aus dem jeweiligen raw gespiegelt) → 6 Opus-
> **Verifier** (adversarial, Datei-in-place bereinigt). **+515 Konzepte / +1758 Fragen:**
> Cultura 1205→1315 K / 3632→4175 F (berühmte Gemälde/Skulpturen/Bauwerke/Komponisten/Werke);
> Lingua 352→458 K / 1622→2036 F (53 Etymologien, Schriftsysteme, Sprachfamilien, hist. Sprachen);
> Astra 656→755 K / 2390→2521 F (**+77 IAU-Sternbilder** → 80/88; + neue Generator-Templates
> `astra-const-abbr`/-rev für die IAU-Kürzel, sonst hätten die Sternbilder kaum Fragen erzeugt);
> Historia 381→446 K / 1909→2218 F (Pascaline/Jacquard/Quarzuhr, Radiowellen/Mendel/REM-Schlaf,
> Demokrit/Eratosthenes/Kelvin/Pawlow — alle verstorben geprüft); Machina 384→469 K / 1238→1474 F
> (C-nahe Sprachen/Brainfuck/Scratch, RTSP/mDNS/STUN, Splay-Baum/Treap, Mutex/Closure/JIT);
> Homo 211→261 K / 593→718 F (Hand-Phalangen, mimische/tiefe Muskeln, Speicheldrüsen/Hirnkerne,
> Hominini — Finder meldet das faire Reservoir nun als **weitgehend erschöpft**). **Verifier-Funde:**
> Astra hellste-Stern-Korrekturen (Fische→Alpherg, Waage→Zubeneschamali), Lingua **72 Platzhalter-
> Nullen** entfernt (charCount:0/speakers:0), Machina Verilog verworfen + Big-O/Port-Fixes, Historia
> Linotype 1884, Cultura Moldau 1874. Neuer additiver Helfer `harvest/append_concepts.cjs` (Dedup-
> Append; die legacy `merge_<domain>.js` mit hartcodierten First-Wave-Dateilisten dürfen NICHT mehr
> laufen — sie würden spätere Direkt-Appends löschen). Alle `verify_facts` 0 Fehler, npm test grün,
> Layout 17/17, Cultura browser-verifiziert. NICHT deployt. **Stand vs 5000-Ziel:** über/auf Ziel
> nur Terra (5217) + Natura (13217); weiterhin drunter: Cultura 4175, Astra 2521, Historia 2218,
> Lingua 2036, Machina 1474, Homo 718 (Anatomie-Ceiling).
>
> **Stand 2026-06-24 (v1.47.0) — Konzept-Skalierung Machina + Historia (Welle 3):**
> Bewährte Pipeline (6 parallele Sonnet-Finder → Gate `merge_machina_historia.js` → 6 parallele
> **adversariale** Verifier → `apply_corrections.cjs` → eigene Stichprobe) für berühmte, faire,
> faktensichere NEUE Konzepte. **Machina 243→384 K / 808→1238 F** (+141 Konzepte: C++/C#, Scheme,
> Smalltalk, ALGOL, Simula u.a. Sprachen; SMB/NFS/OSPF/Kerberos u.a. Protokolle; AVIF/glTF/STL/
> Protobuf u.a. Formate; KMP/FFT/Diffie-Hellman/Timsort u.a. Algorithmen; B-Baum/Bloom-Filter/
> Skip-Liste u.a. Strukturen; 3D-Drucker/TPM/FPGA u.a. Hardware; REST/CRUD/ACID u.a. Acronyme;
> Deadlock/Polymorphie/Turing-Maschine u.a. Konzepte). **Historia 246→381 K / 1232→1909 F**
> (+135 Konzepte: Voltasäule/Elektronenmikroskop/CT/MRT u.a. Erfindungen; Lichtgeschwindigkeit/
> Kernspaltung/Dunkle-Materie u.a. Entdeckungen; Aristoteles/al-Chwarizmi/Rutherford/von Neumann
> u.a. — alle verstorben geprüft; Hellenismus/Belle Époque u.a. Epochen; Intel 4004/CRISPR/
> Schwarzes-Loch-Foto u.a. Meilensteine; Hudson/Tasman/Franklin u.a. Expeditionen).
> **Adversariale Verifizierung fing ~38 Sachfehler** (Big-O KMP/Rabin-Karp O(n+m), FFT≠Sortierung,
> CRC≠Kryptografie, Protokoll-Transport OSPF/IPsec/SCTP laufen direkt über IP, MRT 1973 statt 1977,
> Sextant-Erfinder, Fallschirm-Erfinder falsch→entfernt, Weimarer Republik→entfernt [Politik],
> Hellenismus-Ende -30). **Normalizer-Fix in merge_machina_historia.js:** `norm()` kollabierte
> "C"/"C++"/"C#" (bzw. "B-Baum"/"B+-Baum") auf denselben Schlüssel → C++/C# wurden in ALLEN
> früheren Wellen als vermeintliche Dubletten verworfen; '+'/'#' bleiben jetzt erhalten. Alle
> `verify_facts` 0 Fehler, npm test grün, Layout 17/17, Machina browser-verifiziert. NICHT deployt.
>
> **Stand 2026-06-24 (v1.46.1) — Cold-Start-Bugfix:** `src/utils/db.js` `initDB()` gab das gecachte
> `dbPromise` nicht zurück → erster Aufruf lieferte `undefined` → „Cannot read transaction of
> undefined" beim ersten Laden / nach Storage-Löschung. Fix verifiziert (kalte DB, 0 Fehler).
> v1.46.0 + v1.46.1 sind LIVE auf dm0.de/sci (deployt 2026-06-24).
>
> **Stand 2026-06-24 (v1.46.0) — Generator-Hebel-Welle über alle Bestandsdomains (token-frei):**
> In 7 parallelen Sonnet-Subagents (je 1 Generator) neue Frage-Templates für bisher
> UNGENUTZTE, bereits verifizierte Attribute ergänzt — **keine neuen Fakten/Konzepte,
> nur zusätzliche Lernwinkel**. Ergebnis **+1154 Fragen**: Astra 2053→2390 (Exoplaneten:
> discoveryMethod, Masse, Radius, Umlaufzeit vor/rückwärts), Natura 12685→13217 (Geologie/
> Mineral/Pflanze/Pilz: Typ, Formel, Dichte, Familie, Gattung, Verwendung, Essbarkeit, je
> vor/rückwärts), Lingua 1512→1622 (originalMeaning vor/rückwärts, languagesUsing-rev),
> Cultura 3557→3632 (widthM, endYear, period), Historia 1180→1232 (knownFor, endYear),
> Machina 760→808 (transport-rev, definition-rev). Homo: kein faires Template möglich (nur
> unit/definition ungenutzt) → bewusst nichts ergänzt. **Fairness-Nachbesserung Astra:** die
> Exoplaneten-Zahlenfragen (Radius/Masse/Umlaufzeit) erzeugten mit Nachbarwert-Distraktoren
> ununterscheidbare Optionen (1,11 vs. 1,12 Erdradien, weil die Werte clustern) → neuer
> `spreadNumeric`-Distraktormodus (proportionale Streuung + gleiches Rundungsformat für
> korrekten Wert UND Distraktoren) ersetzt `numericByValue` nur dort; danach 0/202 zu eng.
> Alle `verify_facts` 0 Fehler, npm test grün, Layout 17/17, Astra browser-verifiziert
> (Quiz-Runden, dt. Methoden-Labels, keine neuen Konsolenfehler). Konzeptzahlen unverändert
> (Beleg Token-Freiheit). **Offen weiter:** echte Konzept-Skalierung Richtung 5000 (Finder-
> Wellen), Explorer/Museum-Tab für Machina/Historia, Natura-`range`-Attribut (Freitext, für
> faire MCQ noch zu normalisieren).
>
> Fragenzahlen sind weiter vom 5000-Ziel entfernt — Content-Ausbau (Phase 5) läuft weiter.
> (Lingua: 47 heterogene Konzepte aus language_fact/grammar_fact/phonetics/language_curio
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
> 4. **Hinweis (Stand 2026-06-20):** Astra trägt inzwischen `image` (183 Museumsbilder, erledigt).
>    Offen bleibt **Homo** — `concepts_homo.json` hat **kein** `concept.image` (0 Museumsbilder);
>    Homo nutzt bisher nur die Anatomie-Assets (`HomoVisual`).
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
- [x] **Dashboard-Kosmetik (alle MCQ-Domains) (erledigt v1.77.2):** Labels nach
  `src/components/conceptLabels.js` ausgelagert (geteilt mit `ConceptVisual`); Dashboard nutzt
  `CATEGORY_LABELS` als Fallback (keine rohen Keys mehr) und sagt domain-neutral „Konzepte"
  (Terra: „Orte") statt hartkodiert „Orte".
- [ ] **Lingua-Fragetypen für heterogene Kategorien:** 47 Konzepte (language_fact, grammar_fact,
  phonetics, language_curio, loanword z.T.) haben bewusst noch keine Templates — Konzepte sind im
  Spiel (Visual/Distraktor-Pools), liefern aber keine Fragen. Hebel Richtung 5000-Ziel.
- [ ] **Homo-Konzeptbilder fürs Museum (Stand 2026-06-20):** `concepts_homo.json` hat als einziger
  Bereich **kein** `concept.image` (0 Museumsbilder). Astra ist erledigt (183 Bilder via `image`-Feld).
  Homo ist inhaltlich der zäheste Fall: Anatomie-Konzepte (Knochen/Muskeln/Organe) haben auf Commons
  wenig brauchbare freie Fotos; ggf. statt Fotos die vorhandenen Anatomie-Assets (`HomoVisual`) als
  Galerie-Quelle nutzen, statt pro Konzept ein Commons-Foto zu suchen.
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
- **(a)** Astra `notableStars`-Liste: `brightestStar`-Feld sauber normalisieren → ca. +50 Fragen „hellster Stern im Sternbild X"
- **(b)** Explorer/Museum-Tab für **Machina** + **Historia** (Konzepte ohne Bilder)
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
- [ ] **Idee — Cultura genre_fiction Runde 2** (Angebot 2026-07-02, offen): (a) zweite Welle aus
  den 369 Nur-Hörbuch-Autoren bzw. weiteren Werken der Top-Sammlungs-Autoren (Vorgehen v1.83:
  Autoren-/Titel-Scan `~/Nextcloud/eBooks` + `Odiobuks` mit [D]/[M]-Markern, Match gegen
  ebook_vectordb-SQLite, dann Wikipedia-DE-Ernte mit Notabilitäts-Gate); (b) Buchcover fürs
  Museum — moderne Cover sind auf Commons meist unfrei, Lizenzlage vorher klären; (c) Claire
  North „Die vielen Leben des Harry August" fiel trotz [D]-gehört durchs DE-Wiki-Gate — bei
  Bedarf mit EN-Quelle nachziehen.
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
