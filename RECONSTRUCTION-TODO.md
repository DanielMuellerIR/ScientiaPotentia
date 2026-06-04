# Reconstruction-TODO — game_geo (Terra Weltatlas)

**Stand: 2026-06-04.** Dieses Repo wurde nach einem Datenverlust (Nextcloud-VFS-Korruption +
Stromausfall, Git-History auf allen 3 Macs zerstört, Nextcloud-Trashbin leer) aus mehreren
Quellen rekonstruiert. Vollständige Forensik im Arbeits-Log `theplan/_log/2026-06-04.md` und
im Manifest `~/git-corrupt-backups/scientia-recover-m5/RECOVERY-MANIFEST.md`.

> **Projekt-Hinweis:** game_geo (Live-Name „Terra", `dm0.de/terra/`, v1.3.0) und der Ordner
> `scientia_potentia` sind **dasselbe Projekt**. „scientia_potentia" ist der neue Name, der mit
> der noch nicht implementierten Erweiterungs-Planung kommt. Rename erfolgt mit der Erweiterung.

## Geborgen / wiederhergestellt ✅
- **Config/Docs** (game_geo-Working-Dir, aktuelle v1.3.0): CLAUDE.md, AGENTS.md, README.md,
  deploy.py, index.html, package.json, package-lock.json, vite.config.js, .gitignore
- **src** (aus M5-`scientia_potentia`-Index, gestagete Blobs): App.jsx,
  components/{Atlas,Dashboard,Quiz}.jsx, data/geodb.json, utils/{audio,db,srs}.js
- **scripts**: prepare_data.js, test_srs.js, verify_quiz.js
- **public/data**: countries.json, rivers.json, subdivisions.json (von Live-Site `/terra/data/`)
- **src/index.css**: aus dem deployten CSS-Bundle (`assets/index-C7lJ3K3F.css`) — minifiziert,
  bei Gelegenheit aufhübschen
- **src/main.jsx**: neu erstellt (triviale Vite/React-18-Boilerplate)

## NOCH OFFEN ⚠️ — App baut erst, wenn erledigt
1. **`src/components/Map.jsx`** — maplibre-Karte. Quelle: deploytes JS-Bundle
   (`~/git-corrupt-backups/scientia-recover-m5/_live_bundle/index-i4Su8rID.js`, minifiziert,
   kein Sourcemap; 132× maplibre, addLayer/addSource/fitBounds/flyTo vorhanden). Props laut
   `App.jsx`: `onSelectEntity`, `mapState`/`onSetQuizState`, `clickedMapId`/`resetClickedMapId`.
   Entweder aus Bundle-Verhalten neu bauen oder im Zuge der geplanten Erweiterung frisch.
2. **`src/data/quiz_questions.json`** — ~5.267 Fragen, ins JS-Bundle eingebacken
   (`entityId`/`prompt` ~5.300×). Aus dem gesicherten Bundle extrahierbar; alternativ via
   `scripts/generate_questions.js` (Punkt 3) neu generieren.
3. **`scripts/generate_questions.js`** — fehlt (generierte quiz_questions aus geodb + data).
   `scripts/prepare_data.js` (vorhanden) erzeugt countries/rivers/subdivisions/geodb, **nicht**
   die Fragen.
4. Klein: `src/data/wikidata_cities_raw.json` (Roh-Cache, via scripts regenerierbar),
   `src/setupTests.js`, `src/__tests__/QuizIntegration.test.jsx`, `codex_research_raw/*`.

## Quellen für die offenen Punkte
- **Gesichertes Live-Bundle**: `~/git-corrupt-backups/scientia-recover-m5/_live_bundle/`
- **Time Machine**: lief auf M1/Schwermetall seit Wochen nicht; evtl. auf M5/M-128 (TM-Platte
  wieder am Dock). Nur falls Bundle-/Neubau-Weg nicht reicht.
