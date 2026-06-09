# Plan — Mobil-Tauglichkeit & bröckelsicheres Layout

> **Stand: 2026-06-10.** Arbeits-/Planungsdokument. Ziel: App auf dem Smartphone benutzbar machen
> (etwas vom linken Bereich sichtbar, rechte Fragen immer vollständig bzw. scrollbar) und das
> Layout so strukturieren, dass spätere Feature-Arbeit es nicht unbemerkt zerstört.
>
> **Status:** Tier 0 ✅ erledigt (v1.14.3). Tier 1 ✅ erledigt (v1.15.0), in 3 Viewports verifiziert
> (Desktop unverändert, Hochkant gestapelt + scrollbar, Querformat Row + scrollbar). Tier 2 offen.

## Ist-Zustand (Befund 2026-06-09)

- Zwei-Spalten-Layout als **Flex-Row** in `src/App.jsx:425` (`<main>`).
  - Links: `flex:1, minWidth:0` (`App.jsx:440` Explore / `App.jsx:466` Standard) → kollabiert auf ~0.
  - Rechts: **fest `width:390px`, `flexShrink:0`** (`App.jsx:449` und `App.jsx:492`) → schrumpft nie.
  - `<main>` hat `overflow:hidden` (`App.jsx:430`); rechte Spalte hat **kein** `overflow` → Inhalt wird abgeschnitten, kein Scroll.
- Header: feste `height:60px`, `margin:12px 24px 0` (`App.jsx:319-328`), nicht sticky.
- Root: `100vh × 100vw`, Flex-Column (`App.jsx:308-317` + `index.css` `body`/`#root`).
- **Keine Media Queries**, keine `useMediaQuery`/`innerWidth`-Logik irgendwo.
- ~90 % Inline-Styles; Layout-Maße (390/60/24px) hartcodiert, teils doppelt.
- Nur `Dashboard` scrollt intern (`Dashboard.jsx:105` `overflowY:auto`). `Quiz` und `Atlas` haben kein Scroll.

### Daraus folgende Symptome (vom Nutzer bestätigt)
- **Hochkant (~390px breit):** rechte Spalte (390px) + Padding/Gap > Viewport → rechts angeschnitten, links ~0.
- **Querformat (~390px hoch):** rechte Spalte passt breit, aber Quiz höher als Spalte → unten abgeschnitten, **nicht scrollbar**.

## Designprinzipien (gegen „Layout zerbröselt beim Weiterentwickeln")

1. **Eine Quelle der Wahrheit:** Layout-Maße als CSS-Variablen in `:root`
   (`--header-height`, `--sidebar-width`, `--shell-gap`, `--shell-pad`, Breakpoint-Wert).
2. **Shell-Layout in benannte CSS-Klassen** statt Inline-Styles
   (`.app-shell`, `.app-header`, `.app-main`, `.app-pane-left`, `.app-pane-right`).
   Begründung: **Media Queries können Inline-Styles nicht überschreiben** (Spezifität). Liegt die
   Shell-Geometrie in CSS, kann ein künftiger Inline-Style *innerhalb* einer Komponente das
   responsive Verhalten nicht mehr aushebeln. Komponenten-interne Styles bleiben unangetastet.
3. **Responsiv ausschließlich per CSS-Media-Query** (deklarativ; von JS-Edits nicht kaputtbar) —
   kein `window.innerWidth` in JS.
4. **Scroll-Sicherheitsnetz:** jede Spalte mit variablem Inhalt bekommt `min-height:0` +
   `overflow-y:auto` (klassischer Flexbox-Overflow-Fix). Wirkt breakpoint-unabhängig.

## Umsetzung in Stufen (Tiers)

### Tier 0 — Scroll-Sicherheitsnetz (sehr günstig, sicher, kein Desktop-Effekt) ✅ ERLEDIGT (v1.14.3)
**Was:** der rechten Spalten-Wrapper-`div` (`App.jsx:449` und `App.jsx:491-496`)
`overflowY:'auto'` + `minHeight:0` geben. Wrapper ist `height:100%` → bei zu hohem Quiz-Inhalt
scrollt der Wrapper.
**Wirkung:** behebt sofort den Querformat-Befund („Antworten abgeschnitten, kein Scroll").
**Risiko:** praktisch null — kann nichts verschlechtern (Inhalt war vorher geclippt).
**Aufwand:** ~2 Zeilen. Kann unabhängig von allem anderen sofort gemacht werden.

### Tier 1 — Responsive Shell (mittel, der eigentliche dauerhafte Fix) ✅ ERLEDIGT (v1.15.0)
1. CSS-Variablen in `:root` ergänzen (`index.css`):
   `--header-height:60px; --sidebar-width:390px; --shell-gap:20px; --shell-pad:24px;`
2. Shell-Klassen in `index.css` anlegen und in `App.jsx` die Inline-Style-Blöcke der vier
   Shell-Container durch `className` ersetzen (Maße via `var(--…)`):
   - `.app-shell` (Root, Flex-Column, 100dvh statt 100vh wegen iOS-URL-Leiste)
   - `.app-header` (sticky, feste Höhe via Variable)
   - `.app-main` (Flex-Row, gap/padding via Variablen, `min-height:0`)
   - `.app-pane-left` (`flex:1; min-width:0; min-height:0`)
   - `.app-pane-right` (`width:var(--sidebar-width); flex-shrink:0; min-height:0; overflow-y:auto`)
3. **Eine** Media Query `@media (max-width:768px)`:
   - `.app-main { flex-direction:column; }`
   - `.app-pane-left { height:38vh; min-height:180px; flex:none; }` → „etwas vom linken Bereich".
   - `.app-pane-right { width:100%; flex:1 1 auto; }` → volle Breite, scrollt.
   - `.app-header` auf `flex-wrap:wrap` + auto-Höhe; Stat-Chips (Bestmarke/Streak) ggf. verstecken
     oder verkleinern, da der 60px-Header bei ~390px überläuft.
   - Padding/Gap reduzieren (`--shell-pad:12px`, `--shell-gap:10px` im Breakpoint).
   - Zusätzlich ggf. `@media (max-height:480px)` (Querformat-Phone): kompakterer Header.
4. `100vh` → `100dvh` (dynamic viewport height) für iOS-Safari-Adressleiste.

**Aufwand:** ~1–2 h inkl. Browser-Verifikation bei 3 Viewports. **Risiko:** mittel — betrifft den
Shell-Rahmen; Komponenten-Innenleben bleibt unberührt. Verifikation Pflicht (siehe unten).

### Tier 2 — Regressionsschutz (optional, fängt künftige Bröckelung automatisch)
- `LAYOUT.md` mit „Layout-Vertrag": Shell-Maße nur in CSS-Klassen/Variablen; nie Shell-Breite/-Höhe/
  -overflow inline; Panes behalten `min-height:0; overflow-y:auto`. Kurzverweis in `AGENTS.md`.
- Kommentare in `index.css` an jeder Shell-Regel + an der Media Query (Begründung Breakpoint).
- **Visueller Smoke-Test** (Playwright o. vitest-browser) bei 3 Viewports
  (390×844 hochkant, 844×390 quer, 1280×800 Desktop): prüfen, dass erster + letzter Antwort-Button
  im Viewport liegen und der linke Bereich sichtbar ist. Das ist der Test, der AI-Agenten-Bröckelung
  in CI tatsächlich abfängt. Eigene Mini-Phase, da Zusatz-Abhängigkeit.

## Verifikation (Pflicht bei Tier 1)
Browser-Preview bei mind. 3 Größen ansehen (preview_resize + screenshot):
- 390×844 (iPhone hochkant): links ~38vh sichtbar, rechts volle Breite, alle Antworten per Scroll erreichbar.
- 844×390 (iPhone quer): rechte Spalte scrollt, keine Abschneidung.
- 1280×800 (Desktop): unverändert wie vorher (Regressionscheck).

## Empfehlung / Reihenfolge
- **Tier 0 jetzt** (sicherer Sofort-Gewinn, behebt den Querformat-Bug).
- **Tier 1** als nächste fokussierte Session (kleiner PR, eigener Branch).
- **Tier 2** danach, sobald Tier 1 visuell bestätigt ist.

## START HIER (nächste Session)
Tier 0 + Tier 1 sind erledigt. Offen ist **Tier 2** (Regressionsschutz, optional):
`LAYOUT.md`-Vertrag schreiben + Kurzverweis in `AGENTS.md`, dann einen Viewport-Smoke-Test
(Playwright o. vitest-browser) bei 375×812 / 844×390 / 1280×800 aufsetzen, der prüft, dass
erster + letzter Antwort-Button im Viewport-Scrollbereich liegen und `.app-pane-left` sichtbar ist.
Layout-Klassen liegen in `src/index.css` (Abschnitt „APP-SHELL LAYOUT"), Maße als CSS-Variablen
in `:root` (`--header-height/--sidebar-width/--shell-gap/--shell-pad`).
