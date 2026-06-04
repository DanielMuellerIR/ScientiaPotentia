# 🌍 Terra Weltatlas & Geografie-Quiz

Ein interaktives Geografie-Lernspiel und Entdecker-Atlas, optimiert für moderne Webbrowser. Das Projekt kombiniert einen frei erkundbaren Atlas mit einem spielerischen, adaptiven Lernsystem basierend auf Spaced-Repetition-Algorithmen (SM-2).

---

## ✨ Features

- **🗺️ Interaktiver Weltatlas:** Erkunde Länder, subnationale Grenzen (Bundesländer, Provinzen), Großstädte und Flussläufe.
- **🎓 Intelligentes Quizsystem (Spaced Repetition):** 
  - Nutzt einen adaptiven Wiederholungsalgorithmus (SuperMemo-2), um Lerninhalte genau dann abzufragen, wenn das Gehirn kurz davor ist, sie zu vergessen.
  - Dynamisches State-Management speichert deinen Lernfortschritt offline in der Browser-Datenbank (IndexedDB).
- **🕹️ 5 Spielmodi & 4 Stufen:**
  - **Alle Kategorien:** Bunter Mix aus dem gesamten Fragenkatalog.
  - **Nur Länder & Provinzen:** Fokus auf Nationalstaaten und Gliedstaaten.
  - **Nur Städte:** Testet dein Wissen über Hauptstädte und Großstädte.
  - **Nur Flüsse:** Flussläufe, Mündungsgewässer und Stadt-Fluss-Zuordnungen.
  - **Stadt, Land, Fluss (Wechselnd):** Eine feste Rundenabfolge (`Stadt` ➔ `Land` ➔ `Fluss` ➔ `Stadt` ➔ `Land` ➔ `Fluss`) für 6 abwechslungsreiche Fragen.
- **🎨 Glassmorphic Aesthetic Theme:** Hochwertiges, ablenkungsfreies Design mit parchment-artigem Kontrast, flüssigen CSS-Animationen und reaktiven Vektorkarten.
- **🔊 Retro Sound Synthesizer:** Dynamisch per Web Audio API erzeugtes akustisches Feedback (Clicks, Chimes und Buzzer) mit persistentem Stummschalter im Header.
- **🔍 Live-Suche:** Finde im Atlas blitzschnell jeden Ort und jeden Fluss per Autocomplete-Suche.

---

## 🛠️ Technologie-Stack

- **Frontend-Framework:** React 18 (Vite-basiert)
- **Karten-Rendering:** MapLibre GL JS + PMTiles (für extrem leichtgewichtige Vektorkacheln ohne teuren Tileserver)
- **Icons:** Lucide-React
- **Styling:** Vanilla CSS (TailwindCSS-frei für maximale Anpassungskontrolle)
- **Datenhaltung:** IndexedDB (für Lernstatistiken) & statische GeoJSON-Bestände

---

## 📂 Projektstruktur

```text
game_geo/
├── public/
│   └── data/               # Statische GeoJSON-Karten & Flussgeometrien
├── scripts/
│   ├── prepare_data.js     # ETL-Pipeline: Extrahiert Länder, Staaten & Flussläufe von Natural Earth
│   ├── generate_questions.js # Generiert den 5.267 Fragen umfassenden Quizkatalog
│   ├── verify_quiz.js      # Prüft Fragenkatalog auf logische & strukturelle Fehler
│   └── test_modes_simulation.js # Simuliert 10.000 Runden zur Validierung der Spiellogik
├── src/
│   ├── components/         # React-Komponenten (Map, Quiz, Atlas, Dashboard)
│   ├── data/
│   │   └── geodb.json      # Die kompilierte relationale Geodatenbank
│   ├── utils/              # Hilfsmodule (SM-2 Math, Audio-Synthesizer, DB-Wrapper)
│   ├── App.jsx             # Hauptlayout & State-Koordination
│   └── index.css           # Kern-Design-System & CSS-Variablen
└── package.json
```

---

## 🚀 Installation & Setup

### 1. Abhängigkeiten installieren
```bash
npm install
```

### 2. Geodaten laden und Fragenkatalog generieren
Die Kartendaten und Quizfragen sind vorkompiliert. Du kannst die Pipelines jedoch jederzeit anpassen und neu ausführen:
```bash
# Lädt Natural Earth Geometrien herunter und baut geodb.json & rivers.json
node scripts/prepare_data.js

# Generiert den Fragenbestand neu
node scripts/generate_questions.js

# Führt die Validierungstests aus
node scripts/verify_quiz.js
```

### 3. Entwicklungsserver starten
```bash
npm run dev
```
Die Anwendung ist standardmäßig unter `http://localhost:3000` (oder `3001`) erreichbar.

### 4. Produktions-Build erstellen
```bash
npm run build
```
Der fertige, optimierte Build wird im Ordner `dist/` abgelegt.

---

## 📊 Fragenbestand & Validierung

Die Anwendung verfügt über einen Pool von **5.267 Fragen**, die vollautomatisch aus den Geodaten von Natural Earth, Wikidata und GeoNames generiert werden. Die Fragen decken unter anderem ab:
- Hauptstädte und Länderflaggen
- Zugehörigkeit von Bundesstaaten/Provinzen
- Höhenpunkte und offizielle Währungen
- Stadt-Fluss-Verbindungen und Mündungsgewässer
- Traditionelle deutsche Eselsbrücken und Merksprüche der physischen Geografie (z. B. *„Brigach und Breg bringen die Donau zuweg“*)

Zur Qualitätssicherung durchlaufen alle Fragen und Generierungslogiken automatisierte Prüfungen auf fehlende Daten, Doubletten, ungültige Bounding-Boxes und Spielfluss-Zyklen.

---

## ⚖️ Lizenzen & Quellen

Dieses Projekt ist offline-fähig konzipiert und nutzt ausschließlich freie Datenquellen:
- **Natural Earth:** Public Domain (Geometrien für Länder, Bundesstaaten und Flüsse).
- **GeoNames:** CC BY 4.0 (Städtedaten und Einwohnerzahlen).
- **Wikidata:** CC0 (Zusatzinformationen, Währungen, Flaggen, Welterbestätten).
