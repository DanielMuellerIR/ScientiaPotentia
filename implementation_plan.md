# Implementation Plan — Ausbau zu „Scientia potentia" (Wissensquiz)

> **Stand:** 2026-06-04. Wegwerf-Arbeitsdokument; dauerhafte Projektfakten gehören nach `AGENTS.md`.
>
> **Vorhaben:** Das frühere Geografie-Quiz wird zu einem mehrteiligen Wissensspiel **„Scientia potentia"**
> mit sechs Hauptbereichen ausgebaut. Jeder Bereich hat eigenen Lernfortschritt; die Bereichsauswahl ist Teil
> der Domain-Abstraktion.
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

## 2. Historische Ausgangslage (vor Domain-Abstraktion)

Dieser Abschnitt beschreibt die Ausgangslage vor Phase 0. Er ist historische Begründung, keine aktuelle
Statusquelle. Aktuelle Architektur und Inhaltszahlen stehen in `AGENTS.md`.

- **SRS trackt Konzepte, nicht Fragen.** `src/App.jsx` (≈ Z. 81–97) iteriert `geodb.entities` und
  berechnet `due`/`new` pro **Entity**. Eine Entity (`FJ`) hat mehrere Fragen
  (capital/flag/continent/highest-point/currency/silhouette/click-map). Die SM-2-Karte ist die Entity,
  nicht die einzelne Frage. SM-2-Logik in `src/utils/srs.js`, Persistenz in `src/utils/db.js`.
- **Eine globale Welt.** `src/data/geodb.json` = `{ entities: { ID: {…} } }` mit reichen Metadaten.
  `src/components/Quiz.jsx` hängt durchgehend an `geodb.entities[q.entityId]`
  (Highlight, Eltern-Land, Silhouette-Geometrie, Klick-Validierung).
- **Damals statischer Import.** `Quiz.jsx` importierte `src/data/quiz_questions.json` statisch,
  nicht per `fetch`.
  Fragetypen: capital, flag, continent-match, highest-point, currency, silhouette, click-map,
  state-match, state-parent, city-match, reverse-city-match, city-river, river-country,
  reverse-river-country, river-mouth, river-mnemonic.
  Quiz-Modi (`quizMode`): `all | countries | cities | rivers | stadt-land-fluss`.
- **Damals DB v1.** `progress`-Store keyPath = `entityId`, ohne `domain`-Feld (`src/utils/db.js`).
- **Tief verdrahteter Klick-Flow.** `App → Map → Quiz` für `click-map`-Fragen
  (`App.jsx` `handleSelectEntityFromMap`, `Quiz.jsx` clickedMapId-Effekt).
- **Test-Infrastruktur vorhanden:** vitest + React-Testing-Library, `src/__tests__/QuizIntegration.test.jsx`,
  `src/setupTests.js`, `npm test`.

**Konsequenz:** Multi-Domain brauchte keine neue Quiz-Engine, aber eine **Abstraktionsschicht** über
„eine globale Welt" und einen **Konzeptspeicher pro Domain**. Diese Schicht ist inzwischen umgesetzt.

---

## 3. Leitprinzipien

- **Architektur vor Content.** Die Domain-Abstraktion ist das Deliverable; Content wächst danach.
- **5000 Fragen/Bereich = hartes Ziel** (Nutzer-Vorgabe 2026-06-04). Weg: **mehr distinkte Fragetypen
  je Konzept + Konzeptbasis ausbauen**, kontrolliert auf Repetitivität geprüft. Plumpes
  kombinatorisches Quoten-Templating bleibt verboten — Varianten müssen echte Lernwinkel sein.
- **Eine Domain end-to-end vor Replikation.** Jede Phase ist für sich launchfähig.
- **Jeder Fakt mit Quelle.** Provenance-Pflicht (`source`-Feld). Faktenkorrektheit nie aus
  Struktur-Tests behaupten.
- **Konzept-Mastery, nicht Fragen-Mastery.** Einheitlich in UI und Engine.

---

## 4. Datenmodell-Entscheidungen (vorab fixieren)

### 4.1 Konzept-Begriff verallgemeinern
Die damalige „Entity" wurde zum generischen **Concept**. Key-Schema: `domain:conceptId`.
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

## 5. Domain-Abstraktion (umgesetzt)

`src/domains/index.js` — Registry. Jede Domain kapselt Content + Visualisierung, lazy geladen.
Die Skizze beschreibt das Zielbild; aktuelle Details stehen in `AGENTS.md` und im Code:

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
  // astra, homo und weitere Domains folgen demselben Muster
];
```

Umgesetzte Umbauten:
- `App.jsx`: neuer State `activeDomain`; `due`/`new`/`srsProgress` aus der **Domain-Concept-Liste**
  berechnen statt aus globalem `geodb`.
- `Quiz.jsx`: `questions` + Concept-Lookup als Props/Loader (kein statischer Import,
  keine direkte `geodb`-Referenz mehr).
- `VisualPanel.jsx`: rendert `activeDomain.Visual`; Terra ⇒ Map.
- `DomainSwitcher.jsx`: Glassmorphism-Dropdown im Header, sechs Cards mit
  Icon / Name / Kurzbeschreibung / Mastery-Anzeige.

---

## 6. Phasen (jede Phase ist launchfähig)

### Phase 0 — Domain-Abstraktion, Terra unverändert *(kein neuer Content)*
**Status:** erledigt.

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
(all/countries/cities/rivers/stadt-land-fluss, dazu click-map/silhouette).

### Phase 1 — Astra, MCQ-only *(noch kein Click-Map)*
**Status:** erledigt.

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

**Verifikation:** strukturell **+ Faktencheck.** `scripts/verify_facts.js` prüft `source`-Feld
und Schema, Stichprobe manuell gegen Quelle. Browser-Run einer Astra-Runde.

### Phase 2 — Visualisierung pro Frage  *(Nutzer-Vorgabe: jede Frage zeigt links etwas)*
1. ✅ **2a Backbone (v1.7.0):** `VisualPanel.jsx` als Switch über `domain.Visual` (lazy); Quiz meldet
   aktives Konzept hoch (`onActiveConceptChange`), App hält `activeConceptKey`. Fallback `ConceptVisual`.
2. ✅ **2b Astra (v1.8.0):** `AstraVisual.jsx` — 3D-Himmelskörper (three.js@0.180), echte Texturen
   (Solar System Scope, CC BY 4.0) für Sonne/8 Planeten/Erdmond, sonst prozedural. Sternenfeld.
3. ✅ **2c Homo (v1.9.0):** `HomoVisual.jsx` — gemeinfreie Anatomiegrafiken (Wikimedia PD) je Kategorie.
4. ✅ **2d erledigt:** konzeptgenaue Hervorhebung über Astra-Kontextkarte und Homo-Struktur-Marker.

**Verifikation:** Browser-Run je Domain bestätigt (Astra Jupiter texturiert, Homo Skelett) — erledigt.

### Phase 3 — Homo, MCQ + Anatomievisual
**Status:** erledigt.

- **Homo:** Rekorde **ohne** namentlich genannte lebende Personen (Copyright/Persönlichkeitsrecht) —
  Kategorie-Fakten. Anatomie-SVG nur CC0/selbst erstellt. Nur harte, wissenschaftliche Fakten,
  keine Krankheiten, keine unseriösen Quellen.

### Phase 5 — Content-Ausbau auf 5000 Fragen/Bereich
**Status:** offen, laufend.

Hebel sind Konzept-Ausbau und mehr distinkte Fragetypen je Konzept. Aktuelle Zahlen und Erkenntnisse
stehen in `AGENTS.md`.

### Phasen 4–6 — Natura, Lingua, Cultura *(je einzeln, je Launch)*
**Status:** offen. Reihenfolge laut zentraler Projektdoku: Natura → Lingua → Cultura.

Pro Domain dieselbe Sequenz: verifizierte Faktenbasis (`source`) → MCQ-Generator → Visualisierung →
Browser-Run.

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
- **Mengenziel 5000 Fragen/Bereich** ist hartes Ausbauziel, aber kein Ersatz für Qualität. Pro Bereich
  dokumentieren: aktuelle Fragenzahl + Qualitätsstufe + Quellenabdeckung (in `AGENTS.md`).

---

## 8. Verifikationsstrategie

### Automatisiert
- `scripts/verify_quiz.js` (bestehend) pro Domain: 4 eindeutige Optionen inkl. korrekter Antwort,
  kein Englisch-Leak in deutschen Prompts/Antworten, Frage referenziert existierenden `conceptId`,
  (für Click-Map) SVG-Pfade syntaktisch gültig und im Canvas.
- `scripts/verify_facts.js`: jeder Fakt hat `source`; Schema-Validierung der Concept-Objekte.
- Unit-/Integrationstests (vitest/RTL): Domain-Wechsel, DB-Migration v1→v2, Mastery-Berechnung,
  bestehende `QuizIntegration.test.jsx` bleibt grün.

### Manuell / Browser (Pflicht)
- Echter Browser-Run pro Phase, nicht nur „Build grün".
- Faktencheck-Stichprobe gegen die zitierten Quellen — **Korrektheit nie aus Struktur-Tests behaupten.**

---

## 9. Betroffene Dateien (Überblick)

```
ScientiaPotentia/
├── public/data/
│   ├── questions_terra.json     # Terra-Fragen ausgelagert (Bundle entlasten)
│   ├── concepts_<domain>.json   # Konzept-/Faktenspeicher pro neuer Domain
│   └── questions_<domain>.json  # Fragen pro neuer Domain
├── scripts/
│   ├── data_sources/<domain>_raw.json  # verifizierte Fakten + source
│   ├── generate_<domain>.js     # Generator pro Domain
│   ├── verify_facts.js          # Provenance-/Schema-Check
│   └── verify_quiz.js           # Quiz-Integritätsprüfung
└── src/
    ├── domains/index.js         # Domain-Registry
    ├── components/
    │   ├── VisualPanel.jsx      # Switch über activeDomain.Visual
    │   ├── DomainSwitcher.jsx   # Header-Domainauswahl
    │   ├── Quiz.jsx             # Domain-Fragen + Concept-Lookup
    │   └── Dashboard.jsx        # Mastery pro Domain
    ├── utils/db.js              # DB v2: domain-Feld + Index, additiv
    └── App.jsx                  # activeDomain-State, DomainSwitcher
```

---

## 10. Reihenfolge & Empfehlung

**Aktueller Hebel:** Phase 5 Content-Ausbau. Neue Domains bleiben kleine, einzeln launchbare Schritte.

Reihenfolge der verbleibenden Domains nach zentraler Projektdoku:
**Natura → Lingua → Cultura**
(Cultura zuletzt: Copyright + subjektive Auswahl am heikelsten).
