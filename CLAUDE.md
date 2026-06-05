# CLAUDE.md - Agent-Kurzreferenz

Diese Datei ist nur eine Kurzreferenz für Claude/Codex. Projektfakten, Status, Roadmap,
Architekturentscheidungen und aktuelle Inhaltszahlen stehen zentral in `AGENTS.md`.

## Befehle

* **Abhängigkeiten installieren:** `npm install`
* **Entwicklungsserver starten:** `npm run dev`
* **Build erstellen:** `npm run build`
* **Build lokal prüfen:** `npm run preview`

## Arbeitsregeln

* Vor inhaltlichen Änderungen `AGENTS.md` lesen und dortige Projektregeln beachten.
* Keine Statuszahlen, Phasenstände oder Roadmap-Fakten in `CLAUDE.md` duplizieren.
* Code in Englisch schreiben; Kommentare und UI-Texte auf Deutsch.
* Keine Personenbezeichnungen mit Doppelpunkt-Gendering. Generisches Maskulinum oder neutrale Formulierungen nutzen.
* Bestehende Kommentare bei Refactors erhalten und anpassen; komplexe Logik ausführlich erklären.
* Bestehende React/Vite-/Vanilla-CSS-Muster weiterverwenden; keine neuen Frameworks ohne Auftrag.
* Nicht pushen, außer der Nutzer fordert es ausdrücklich. Wenn eine Aufgabe Commits ausschließt,
  keine Version bumpen und nicht committen.
