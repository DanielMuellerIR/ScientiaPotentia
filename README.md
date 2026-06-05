# Scientia potentia — Multi-Domain-Wissensquiz

**Scientia potentia** ist ein responsives Wissensspiel für moderne Webbrowser. Das Projekt ist aus
dem Geografie-Spiel „Terra Weltatlas" entstanden und erweitert die Quiz-Engine auf mehrere
Wissensbereiche mit eigenem Lernfortschritt.

Aktueller Status, Domain-Zahlen, Roadmap und Architekturentscheidungen stehen zentral in
[`AGENTS.md`](AGENTS.md). Dieses README bleibt bewusst ein knapper Einstieg.

---

## Features

- **Domain-basiertes Lernen:** Jeder Wissensbereich hat eigene Konzepte, Fragen und
  Spaced-Repetition-Daten.
- **Terra-Weltatlas:** Interaktive MapLibre-Karte für Länder, subnationale Grenzen, Städte und
  Flüsse.
- **Visualisierung pro Frage:** Das linke Panel zeigt passend zur aktiven Frage Karte, 3D-Visual,
  Anatomiegrafik oder generische Konzeptkarte.
- **Spaced Repetition:** SM-2-basierter Lernfortschritt wird offline in IndexedDB gespeichert.
- **Offline-fähige Inhalte:** Quizdaten, Konzepte und gebündelte Assets liegen statisch im Projekt.
- **Glassmorphic Dark UI:** React/Vite-App mit Vanilla CSS, Lucide-Icons und Web-Audio-Feedback.

---

## Technologie-Stack

- **Frontend:** React 18 + Vite
- **Karten-Rendering:** MapLibre GL JS + PMTiles
- **3D-Visualisierung:** three.js
- **Icons:** Lucide-React
- **Styling:** Vanilla CSS
- **Datenhaltung:** IndexedDB + statische JSON-/Asset-Dateien

---

## Projektstruktur

```text
ScientiaPotentia/
├── AGENTS.md                  # Zentrale Projektfakten, Status, Roadmap
├── public/
│   ├── assets/                # Gebündelte Domain-Assets inkl. Credits
│   └── data/                  # Konzepte, Fragen und Terra-Geodaten
├── scripts/
│   ├── data_sources/          # Verifizierte Rohdaten pro Domain
│   ├── generate_questions.js  # Terra-Fragengenerator
│   ├── generate_<domain>.js   # Generatoren für weitere Domains
│   ├── verify_facts.js        # Provenance-/Schema-Prüfung
│   └── verify_quiz.js         # Quiz-Integritätsprüfung
├── src/
│   ├── components/            # React-Komponenten inkl. Quiz und Visuals
│   ├── domains/               # Domain-Registry und Loader
│   ├── data/                  # Terra-Konzeptdaten
│   ├── utils/                 # SM-2, Audio, IndexedDB
│   ├── App.jsx                # Hauptlayout und State-Koordination
│   └── index.css              # Design-System und CSS-Variablen
└── package.json
```

---

## Installation & Setup

### 1. Abhängigkeiten installieren

```bash
npm install
```

### 2. Entwicklungsserver starten

```bash
npm run dev
```

Die Anwendung läuft standardmäßig unter `http://localhost:3000`.

### 3. Produktions-Build erstellen

```bash
npm run build
```

Der optimierte Build wird im Ordner `dist/` abgelegt.

---

## Daten & Validierung

Die Content-Pipeline erzeugt statische Konzepte und Fragen pro Domain. Terra nutzt zusätzlich
Geodaten und Kartengeometrien. Aktuelle Fragenzahlen und Quellenabdeckung stehen in
[`AGENTS.md`](AGENTS.md).

Nützliche Prüf- und Generatorbefehle:

```bash
node scripts/prepare_data.js
node scripts/generate_questions.js
node scripts/generate_astra.js
node scripts/generate_homo.js
node scripts/verify_facts.js astra
node scripts/verify_facts.js homo
node scripts/verify_quiz.js
```

Jeder Fakt braucht eine nachvollziehbare Quelle. Automatische Strukturprüfungen ersetzen keine
manuelle Faktenstichprobe.

---

## Lizenzen & Quellen

Das Projekt ist offline-fähig konzipiert und nutzt freie oder passend lizenzierte Quellen, darunter
Natural Earth, GeoNames, Wikidata, NASA/IAU/ESA sowie gebündelte Assets mit dokumentierten Credits.
Asset-Credits liegen in den jeweiligen `public/assets/<domain>/.../CREDITS.md`-Dateien.
