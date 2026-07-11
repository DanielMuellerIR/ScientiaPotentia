# Layout-Vertrag

> **Stand: 2026-06-10.** Verbindliche Regeln fuer das Gesamtlayout (die „Shell"). Wer am UI
> arbeitet — Mensch oder AI-Agent — haelt sich daran, damit das responsive Verhalten nicht
> unbemerkt zerbricht. Maschinell geprueft durch `scripts/check_layout_contract.cjs`.

## Worum es geht

Das Gesamtlayout besteht aus wenigen Shell-Containern:

- **Root** (`.app-shell`) — Flex-Spalte, volle Viewport-Hoehe.
- **Header** (`.app-header`) — feste Hoehe am Desktop.
- **Hauptbereich** (`.app-main`) — Zwei-Spalten-Reihe.
- **Linke Spalte** (`.app-pane-left`) — Karte/Explorer, waechst.
- **Rechte Spalte** (`.app-pane-right`) — Quiz/Dashboard, feste Breite am Desktop, eigener Scroll.

Alle diese Container werden in `src/index.css` (Abschnitt „APP-SHELL LAYOUT") definiert; ihre Masse
stehen als CSS-Variablen in `:root` (`--header-height`, `--sidebar-width`, `--shell-gap`,
`--shell-pad`). Unter 768px stapelt ein einzelner `@media`-Breakpoint die Spalten: die linke Karte
behaelt ~38vh Hoehe (bleibt sichtbar), die rechte Spalte nimmt die volle Breite und scrollt.

## Die Regeln

1. **Shell-Geometrie lebt nur in CSS-Klassen + CSS-Variablen, nie in Inline-Styles.**
   Breite/Hoehe/`overflow`/`flex-direction` der fuenf Shell-Container gehoeren nach `src/index.css`.
   Komponenten-internes Styling (innerhalb von Quiz, Dashboard, Atlas …) bleibt davon unberuehrt.

2. **Warum (der eigentliche Grund):** Eine CSS-Media-Query kann einen Inline-Style **nicht**
   ueberschreiben (Inline-Styles haben hoehere Spezifitaet). Wuerde die Shell-Breite inline gesetzt,
   koennte der Mobil-Breakpoint sie nicht mehr auf volle Breite umstellen — das Layout „zerbroeselt"
   auf dem Handy. Liegt die Geometrie in CSS, kann ein spaeter hinzugefuegter Inline-Style das
   responsive Verhalten nicht aushebeln.

3. **Jede Spalte mit variablem Inhalt behaelt `min-height:0` + `overflow-y:auto`.** Das ist der
   Flexbox-Overflow-Fix: zu hoher Inhalt (z.B. ein langes Quiz auf niedrigem Viewport) wird
   scrollbar statt abgeschnitten.

4. **Masse aendern = CSS-Variable aendern**, nicht den Wert an mehreren Stellen hartcodieren.

## Pruefen

```bash
node scripts/check_layout_contract.cjs          # menschenlesbar, Exit 0/1
node scripts/check_layout_contract.cjs --json     # maschinenlesbar
# oder via npm:
npm run check:layout
```

Der Check verifiziert: Variablen vorhanden, Shell-Klassen vorhanden, Breakpoint + Stapelung
vorhanden, App.jsx nutzt die Klassen, und die Shell-Masse (390px / 100vh) sind nicht wieder inline
in `App.jsx` hartcodiert.

## Was der Check NICHT abdeckt

Er prueft die Struktur, nicht das visuelle Ergebnis. Ein echter Pixel-/Scroll-Test braucht einen
Browser. Pflicht-Gegenprobe vor groesseren Layout-Aenderungen: Browser-Preview bei
**1280×800** (Desktop, Regression), **375×812** (Handy hochkant) und **844×390** (Handy quer)
ansehen — siehe `docs/archive/mobile-layout-plan.md`. Ein echter Geraetetest (iPhone hochkant) steht noch aus
(Todo in `AGENTS.md`).
