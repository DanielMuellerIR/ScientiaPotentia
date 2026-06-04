# Scientia potentia — Multi-Domain-Wissensquiz

> **Stand: 2026-06-04.** Lebendes Dokument, zentrale Quelle für Projektfakten.

Aus dem ursprünglichen Geografie-Quiz („Terra Weltatlas") entsteht ein mehrteiliges
Wissensspiel **Scientia potentia** mit eigenständigen Wissensbereichen (Domains), je mit
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
| Phase 2 | Visualisierungs-Panel generalisieren + Astra-Click-Map | offen |
| Phase 3–6 | Homo, Natura, Lingua, Cultura | Homo-Faktenbasis in Recherche |

Maßgeblicher Arbeitsplan: `implementation_plan.md` (Wegwerf-Dokument).

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
| Terra  | 1852 | 5217 | Natural Earth / GeoNames / Wikidata | Weltkarte (MapLibre) |
| Astra  | 56 | 121 | NASA / IAU / ESA | Übersichts-Panel (Click-Map: Phase 2) |
| Homo   | (Recherche läuft) | – | Anatomie-Lehrbücher / NIH | MCQ-only geplant |

### Inhaltsregeln (verbindlich)
- Keine erfundenen Fakten; Quelle pro Fakt. Fairness: keine obskuren Objekte.
- Distraktoren plausibel, gleiche Kategorie, nicht trivial ausschließbar.
- Copyright: keine geschützten Texte/langen Zitate, keine namentlichen Rekorde lebender Personen.
- Homo: keine Krankheiten, keine Kultur. Natura: Klimawandel nach IPCC-Konsens. Cultura zuletzt.

### Befehle
`npm run dev` (Port 3000) · `npm run build` · `node scripts/generate_<domain>.js` ·
`node scripts/verify_facts.js <domain>` · `node scripts/verify_quiz.js` (Terra).
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
