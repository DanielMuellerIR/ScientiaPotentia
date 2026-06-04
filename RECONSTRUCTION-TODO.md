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

## GELÖST ✅ (2026-06-04, Update) — Residuen im M3-`scientia_potentia`-Arbeitsbaum gefunden
Die zunächst als verloren geglaubten Dateien lagen als **echte Files** im M3-Ordner
`scientia_potentia` (Arbeitsbaum, nicht in git) und wurden nach game_geo übernommen:
- **`src/components/Map.jsx`** (26 KB) ✅
- **`src/data/quiz_questions.json`** (2,9 MB, ~5.267 Fragen) ✅
- **`scripts/generate_questions.js`** (32 KB) ✅
- **`src/setupTests.js`**, **`src/__tests__/QuizIntegration.test.jsx`** ✅

Damit ist game_geo **vollständig + baubar** (alle `App.jsx`-Imports erfüllt). Belt-and-suspenders-
Kopie inkl. `dist/` + Roh-Geodaten (`ne_10m_rivers_*`, `ne_50m_admin_1_*`) in
`~/git-corrupt-backups/scientia-recover-m5/_m3_scientia_uniques/`.

## Rest-Kleinkram (optional)
- `src/data/wikidata_cities_raw.json` (Roh-Cache, via `scripts/` regenerierbar)
- `codex_research_raw/*` (6 Recherche-Notizen) — nicht aufgetaucht, niedriger Wert
- Build-Verifikation noch ausstehend: `npm install && npm run build` (war wegen parallelem
  Nextcloud-Sync verschoben).

## Quellen (Archiv)
- Live-Bundle: `~/git-corrupt-backups/scientia-recover-m5/_live_bundle/`
- M3-scientia-Funde: `~/git-corrupt-backups/scientia-recover-m5/_m3_scientia_uniques/`
