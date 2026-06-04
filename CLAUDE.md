# CLAUDE.md - Geografie-Quiz & Weltatlas

This document contains standard commands, styling tokens, and guidelines for developer reference.

## Development Commands

* **Install dependencies:** `npm install`
* **Run dev server:** `npm run dev`
* **Build application:** `npm run build`
* **Preview build:** `npm run preview`

## Project Guidelines

### Code & Comments
* Write detailed comments explaining the logic, especially for complex operations (IndexedDB, SM-2 math, MapLibre protocol registration).
* Preserve existing comments when refactoring.
* Gendering: **Kein `:innen`-Gendering**. Generisches Maskulinum (Entwickler, Nutzer, Spieler) oder neutrale Umschreibungen (Lehrkraft, Studierende, etc.) nutzen.
* Language: Coding in English (variables, functions, components), comments/UI text in German.

### Styling & Theme (Glassmorphic Dark)
* No TailwindCSS. Use pure Vanilla CSS with variables in `index.css`.
* Base colors should be dark (slate/navy bases) with vibrant neon-teal/indigo accents and glow effects.
* Use smooth animations and CSS glassmorphism (`backdrop-filter: blur(12px)`).
* Responsive: Layout must work on small mobile screens (no tiny map zoom queries without zoom aids).

### Versioning & Commits
* After completing a non-trivial feature/fix:
  1. Bump the version in `package.json`.
  2. Commit the changes locally.
  3. Never push automatically unless explicitly asked by the user.
