# Implementation Plan — Ausbau zu „Scientia potentia" (Wissensquiz)

> **Stand:** 2026-06-04. Wegwerf-Arbeitsdokument; dauerhafte Projektfakten gehören nach `AGENTS.md`.
>
> **Vorhaben:** Das bestehende Geografie-Quiz wird zu einem mehrteiligen Wissensspiel **„Scientia potentia"**
> mit sechs Hauptbereichen ausgebaut. Jeder Bereich hat eigenen Lernfortschritt; die Bereichsauswahl ersetzt
> die heutige „Terra Weltatlas"-Kopfzeile.
>
> **Leitidee:** Erst die Domain-Abstraktion bauen (die Architektur ist das eigentliche Deliverable),
> dann Content inkrementell. Qualität schlägt Mengen-Quote. Eine Domain end-to-end, bevor repliziert wird.

---

## 1. Ziel & Hauptbereiche

Das Spiel entwickelt sich vom Geografie-Quiz zum allgemeinen Wissensspiel mit sechs Bereichen,
jeder mit eigenem Lernfortschritt und mindestens langfristig großem Fragenkatalog:

| Latein  | Bereich            | Inhalt |
| :------ | :----------------- | :----- |
| **Terra**   | Geografie (Erde)   | Länder, Hauptstädte, Flüsse, Gebirge, Sehenswürdigkeiten — *bestehender Bereich.* |
| **Astra**   | Astronomie         | Sonnensystem, Planeten, Monde, bekannte Sterne/Galaxien, physikalische Konstanten (Parsec, AE, Lichtgeschwindigkeit), Alter von Erde/Sonne/Universum. |
| **Homo**    | Mensch & Körper    | Knochen, Muskeln, Organe, menschliche Spezies, physiologische Rekorde. Keine Krankheiten, keine Kultur. |
| **Natura**  | Natur & Umwelt     | Tiere, Pflanzen, Ökosystem Erde, Erdgeschichte, Evolution, Klimawandel (wissenschaftlicher Konsens). |
| **Cultura** | Kultur             | Kunst, Musik, Literatur, Popkultur. |
| **Lingua**  | Sprachen           | Deutsche Grammatik/Sprachfakten, Vokabeln der meistgesprochenen Sprachen, Grammatik EN/FR/ES, linguistische Trivia. |

### App-Name & Bereichsnamen (Sprach-Check)
- **„Scientia potentia"** als Titel ist korrekt: klassische Ellipse (Weglassen von *est*) aus
  *„scientia potentia est"* (Wissen ist Macht). In Mottos/Titeln üblich und prägnant.
  *Hinweis:* Das oft Bacon zugeschriebene Original lautet *„ipsa scientia potestas est"*;
  `scientia potentia est` ist die populäre Variante — also nicht als wörtliches Bacon-Zitat ausgeben.
  → **Empfehlung: so übernehmen.** Wird links im Header inkl. Version dauerhaft angezeigt.
- Bereichsnamen alle grammatikalisch korrekt: *astra* (Nom. Pl. von *astrum*, „die Sterne"),
  *homo/natura/cultura/lingua/terra* (Nom. Sg.). Einzige Schönheits-Inkonsistenz: `Astra` ist Plural
  unter sonst Singularen — bewusst akzeptieren (liest sich am besten) oder vereinheitlichen.

---

## 2. Ausgangslage (Ist-Architektur)

Diese Fakten sind aus dem Code verifiziert und tragen den ganzen Plan:

- **SRS trackt Konzepte, nicht Fragen.** `src/App.jsx` (≈ Z. 81–97) iteriert `geodb.entities` und
  berechnet `due`/`new` pro **Entity**. Eine Entity (`FJ`) hat mehrere Fragen
  (capital/flag/continent/highest-point/currency/silhouette/click-map). Die SM-2-Karte ist die Entity,
  nicht die einzelne Frage. SM-2-Logik in `src/utils/srs.js`, Persistenz in `src/utils/db.js`.
- **Eine globale Welt.** `src/data/geodb.json` = `{ entities: { ID: {…} } }` mit reichen Metadaten.
  `src/components/Quiz.jsx` hängt durchgehend an `geodb.entities[q.entityId]`
  (Highlight, Eltern-Land, Silhouette-Geometrie, Klick-Validierung).
- **Statischer Import.** `Quiz.jsx` importiert `src/data/quiz_questions.json` (≈ 2.8 MB) statisch,
  nicht per `fetch`. Aktueller Katalog: **5217 Fragen**.
  Fragetypen: capital, flag, continent-match, highest-point, currency, silhouette, click-map,
  state-match, state-parent, city-match, reverse-city-match, city-river, river-country,
  reverse-river-country, river-mouth, river-mnemonic.
  Quiz-Modi (`quizMode`): `all | countries | cities | rivers | stadt-land-fluss`.
- **DB v1.** `progress`-Store keyPath = `entityId`, ohne `domain`-Feld (`src/utils/db.js`).
- **Tief verdrahteter Klick-Flow.** `App → Map → Quiz` für `click-map`-Fragen
  (`App.jsx` `handleSelectEntityFromMap`, `Quiz.jsx` clickedMapId-Effekt).
- **Test-Infrastruktur vorhanden:** vitest + React-Testing-Library, `src/__tests__/QuizIntegration.test.jsx`,
  `src/setupTests.js`, `npm test`.

**Konsequenz:** Multi-Domain braucht keine neue Quiz-Engine, aber eine **Abstraktionsschicht** über
„eine globale Welt" und einen **Konzeptspeicher pro Domain** (heute fehlt er für alles außer Terra).

---

## 3. Leitprinzipien

- **Architektur vor Content.** Die Domain-Abstraktion ist das Deliverable; Content wächst danach.
- **Qualität vor Quote.** „≥ 5000 Fragen/Bereich" ist **Roadmap-Ziel, kein Launch-Gate.** Reines
  kombinatorisches Templating zum Quoten-Erreichen erzeugt repetitive/unfaire Fragen — verboten.
- **Eine Domain end-to-end vor Replikation.** Jede Phase ist für sich launchfähig.
- **Jeder Fakt mit Quelle.** Provenance-Pflicht (`source`-Feld). Faktenkorrektheit nie aus
  Struktur-Tests behaupten.
- **Konzept-Mastery, nicht Fragen-Mastery.** Einheitlich in UI und Engine.

---

## 4. Datenmodell-Entscheidungen (vorab fixieren)

### 4.1 Konzept-Begriff verallgemeinern
Die heutige „Entity" wird zum generischen **Concept**. Key-Schema: `domain:conceptId`.
- **Terra bleibt unpräfixt** (`FJ`, `Q64`, …) → keine Migration vorhandener IndexedDB-Records nötig.
  Regel im Code: Key ohne `:` ⇒ Domain `terra`.
- Neue Domains präfixen (`astra:mars`, `homo:femur`). Kollisionsfrei, da `progress` über `entityId` keyt.

### 4.2 Mastery-Definition (einheitlich)
`Mastery(domain) = Anteil der Concepts mit repetitions > 0` (Variante: Schwelle `interval ≥ 6`),
**pro Domain** berechnet. UI-Fortschrittsanzeige und Engine nutzen dieselbe Formel. Nicht „% Fragen".

### 4.3 Konzeptspeicher pro Domain (die heute fehlende Schicht)
Jede Domain liefert zur Laufzeit **zwei** Artefakte:
- `concepts_<domain>.json` — die Konzept-/Fakten-Objekte (Name, Metadaten, ggf. Geometrie/Hotspot-ID,
  `source`). Domainspezifisches Analogon zu `geodb.json`.
- `questions_<domain>.json` — die generierten Fragen, referenzieren `conceptId`.

Damit funktionieren Highlight, Klick-Validierung und Mastery in **jeder** Domain — nicht nur Terra.

### 4.4 DB v2
- `progress`-Record erhält Feld `domain` (aus Präfix abgeleitet, fehlend ⇒ `terra`).
- Neuer Index `domain` auf `progress`.
- `onupgradeneeded` v1→v2 **ergänzt nur** Index/Feld-Konvention; **migriert keine Keys**
  (Terra bleibt unpräfixt, additiv abwärtskompatibel — bestehender Lernfortschritt bleibt erhalten).

---

## 5. Domain-Abstraktion (Code)

`src/domains/index.js` — Registry. Jede Domain kapselt Content + Visualisierung, lazy geladen:

```js
// loadConcepts/loadQuestions lazy per fetch/import → kein Bundle-Bloat.
export const DOMAINS = [
  {
    id: 'terra',
    latinName: 'Terra',
    label: 'Geografie',
    icon: '🌍',
    loadConcepts: () => import('../data/geodb.json').then(m => m.default.entities),
    loadQuestions: () => fetch('data/questions_terra.json').then(r => r.json()),
    Visual: MapVisual, // bestehende Map.jsx, gewrappt
  },
  // astra, homo, natura, cultura, lingua folgen je Phase
];
```

Notwendige Umbauten:
- `App.jsx`: neuer State `activeDomain`; `due`/`new`/`srsProgress` aus der **Domain-Concept-Liste**
  berechnen statt aus globalem `geodb`.
- `Quiz.jsx`: `questions` + Concept-Lookup als Props/Loader (kein statischer Import,
  keine direkte `geodb`-Referenz mehr).
- `VisualPanel.jsx`: rendert `activeDomain.Visual`; Terra ⇒ Map.
- `DomainSwitcher.jsx`: Glassmorphism-Dropdown im Header, sechs Cards mit
  Icon / Name / Kurzbeschreibung / glühender Mastery-Anzeige.

---

## 6. Phasen (jede Phase ist launchfähig)

### Phase 0 — Domain-Abstraktion, Terra unverändert *(kein neuer Content)*
Gleiche App, intern domain-fähig. Null Verhaltensänderung ⇒ sofort mergebar.
1. Registry `src/domains/index.js`, Terra als einzige Domain.
2. Concept-Begriff + Key-Schema (4.1); Terra unpräfixt.
3. `App.jsx` auf `activeDomain` umstellen; due/new/progress aus Domain-Concepts.
4. `Quiz.jsx`: Loader statt statischem Import; `geodb`-Zugriffe über Concept-Lookup abstrahieren.
5. DB v2 (4.4).
6. Mastery-Formel (4.2) in UI + Engine vereinheitlichen.
7. `quiz_questions.json` → `public/data/questions_terra.json` auslagern (Bundle entlasten).

**Verifikation:** Terra spielt identisch wie vorher. Bestehende Test-Suite (`npm test`,
`QuizIntegration.test.jsx`) grün + Browser-Run aller Modi
(all/countries/cities/rivers/stadt-land-fluss, dazu click-map/silhouette). → Commit + Launch.

### Phase 1 — Astra, MCQ-only *(noch kein Click-Map)*
Beweist Multi-Domain ohne Visualisierungs-Risiko.
1. **Faktenbasis zuerst:** `scripts/data_sources/astra_raw.json`, ~100 *bekannte* Objekte
   (Sonne, Planeten, große Monde, prominente Sterne/Galaxien, Konstanten). Jeder Fakt mit `source`
   (NASA/IAU/ESA). **Fairness-Filter:** nur popkultur-/lehrplan-bekannte Objekte — keine obskuren Systeme.
   Recherche + Gegencheck ist die Hauptarbeit, nicht das Templating.
2. Generator `scripts/generate_astra.js` → `concepts_astra.json` + `questions_astra.json`.
   **So viele gute Fragen wie sauber gehen** (Launch-Ziel z.B. 300–800), kein Mengen-Zwang.
3. Distraktor-Regel: plausibel, gleiche Kategorie, nicht trivial ausschließbar.
4. Astra-Concepts in IndexedDB (`astra:*`), eigener Lernfortschritt.
5. **DomainSwitcher** im Header einführen (Terra + Astra wählbar).

**Verifikation:** strukturell **+ Faktencheck.** Neues `scripts/verify_facts.js`: prüft `source`-Feld
und Schema, Stichprobe manuell gegen Quelle. Browser-Run einer Astra-Runde. → Commit + Launch (2 Domains).

### Phase 2 — Visualisierungs-Panel generalisieren + Astra-Click-Map
Erst jetzt das aufwändige Stück, isoliert.
1. `VisualPanel.jsx` als Switch über `activeDomain.Visual`; Map = Terra-Visual.
2. Klick-Flow generalisieren: `onSelectEntity(domainConceptId)` statt geo-spezifisch
   (entkoppelt `App ↔ Map ↔ Quiz`).
3. Interaktives Sonnensystem-SVG mit validierten Hotspots, lizenzsauber (selbst erzeugt/CC0).

**Verifikation:** Klick auf z.B. Neptun wird grün/rot markiert, exakt wie Terra-Karte.

### Phasen 3–6 — Homo, Natura, Cultura, Lingua *(je einzeln, je Launch)*
Pro Domain dieselbe Sequenz: verifizierte Faktenbasis (`source`) → MCQ-Generator → Launch →
optional Visualisierung/Click-Map später.

- **Homo:** Rekorde **ohne** namentlich genannte lebende Personen (Copyright/Persönlichkeitsrecht) —
  Kategorie-Fakten. Anatomie-SVG nur CC0/selbst erstellt. Nur harte, wissenschaftliche Fakten,
  keine Krankheiten, keine unseriösen Quellen.
- **Natura:** Klimawandel strikt nach IPCC/wissenschaftlichem Konsens (keine Leugner-Quellen).
  Erdgeschichte, Systematik, Evolution, Ökosysteme — kein Krankheiten-Lexikon.
- **Cultura:** **keine** reproduzierten Songtexte/langen Zitate (Copyright). Nur faktische Zuordnung
  („Wer malte X?", „Wer komponierte Y?", Epochenzuordnung). Realistische Menge, kein Quoten-Zwang.
- **Lingua:** Vokabel-Qualität vor -Menge; Konjugations-/Deklinations-Multiplikation sparsam einsetzen.

---

## 7. Content-Qualität — verbindliche Regeln

- **Keine erfundenen Fakten.** Quelle pro Fakt im `source`-Feld; wissenschaftliche/offizielle Quellen.
- **Fairness:** keine Fragen zu obskuren Objekten, die niemand kennen kann (besonders Astra).
  Popkultur/Hard-SF darf zur Auswahl *inspirieren* — Fakten danach gegen wissenschaftliche Quellen prüfen.
- **Distraktoren** plausibel, gleiche Kategorie, nicht trivial ausschließbar.
- **Copyright:** keine geschützten Liedtexte/langen Zitate; keine namentlichen Rekorde lebender Personen.
- **Mengenziel ≥ 5000/Bereich** ist Roadmap, kein Launch-Blocker. Pro Bereich dokumentieren:
  aktuelle Fragenzahl + Qualitätsstufe + Quellenabdeckung (in `AGENTS.md`).

---

## 8. Verifikationsstrategie

### Automatisiert
- `scripts/verify_quiz.js` (bestehend) pro Domain: 4 eindeutige Optionen inkl. korrekter Antwort,
  kein Englisch-Leak in deutschen Prompts/Antworten, Frage referenziert existierenden `conceptId`,
  (für Click-Map) SVG-Pfade syntaktisch gültig und im Canvas.
- `scripts/verify_facts.js` (neu): jeder Fakt hat `source`; Schema-Validierung der Concept-Objekte.
- Unit-/Integrationstests (vitest/RTL): Domain-Wechsel, DB-Migration v1→v2, Mastery-Berechnung,
  bestehende `QuizIntegration.test.jsx` bleibt grün.

### Manuell / Browser (Pflicht)
- Echter Browser-Run pro Phase, nicht nur „Build grün".
- Faktencheck-Stichprobe gegen die zitierten Quellen — **Korrektheit nie aus Struktur-Tests behaupten.**

---

## 9. Betroffene Dateien (Überblick)

```
game_geo/
├── public/data/
│   ├── questions_terra.json     # [NEU] Terra-Fragen ausgelagert (Bundle entlasten)
│   ├── concepts_<domain>.json   # [NEU] Konzept-/Faktenspeicher pro neuer Domain
│   └── questions_<domain>.json  # [NEU] Fragen pro neuer Domain
├── scripts/
│   ├── data_sources/<domain>_raw.json  # [NEU] verifizierte Fakten + source
│   ├── generate_<domain>.js     # [NEU] Generator pro Domain
│   ├── verify_facts.js          # [NEU] Provenance-/Schema-Check
│   └── verify_quiz.js           # [WIEDERVERWENDEN] pro Domain
└── src/
    ├── domains/index.js         # [NEU] Domain-Registry
    ├── components/
    │   ├── VisualPanel.jsx      # [NEU] Switch über activeDomain.Visual (ab Phase 2)
    │   ├── DomainSwitcher.jsx   # [NEU] Header-Dropdown (Phase 1)
    │   ├── Quiz.jsx             # [ÄNDERN] Loader statt Import, Concept-Lookup statt geodb
    │   └── Dashboard.jsx        # [ÄNDERN] Mastery pro Domain
    ├── utils/db.js              # [ÄNDERN] DB v2: domain-Feld + Index, additiv
    └── App.jsx                  # [ÄNDERN] activeDomain-State, DomainSwitcher einbinden
```

---

## 10. Reihenfolge & Empfehlung

**Phase 0 (reiner Refactor, Terra unverändert) ist der Hebel:** danach ist jede Domain ein kleiner,
launchbarer Schritt statt eines Sechsfach-Risikos.

Reihenfolge der neuen Domains nach Aufwand/Risiko:
**Astra → Homo → Natura → Lingua → Cultura**
(Cultura zuletzt: Copyright + subjektive Auswahl am heikelsten).
