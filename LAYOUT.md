# Layout-Vertrag

> **Stand: 2026-07-17.** Verbindliche Regeln fuer das Gesamtlayout (die „Shell"). Wer am UI
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
`--shell-pad`). Bis einschließlich 768px stapelt ein einzelner `@media`-Breakpoint die Spalten: die
linke Karte behaelt ~38vh Hoehe (bleibt sichtbar), die rechte Spalte nimmt die volle Breite und
scrollt.

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

## Header-Vertrag

Der Desktop-Header behaelt seine beschrifteten Tabs und darf bei mittleren Breiten kontrolliert
umbrechen. Im echten `@media (max-width:768px)`-Block wird er zu genau zwei Grid-Zeilen:

- oben `DomainSwitcher` und die kompakte Meta-Gruppe;
- unten alle fuer die aktive Domain vorhandenen Tabs in **einer** Zeile;
- die Tab-Beschriftungen sind nur visuell ausgeblendet, stabile `aria-label` und `title` bleiben;
- der aktive Tab traegt `aria-current="page"`;
- Tabs, Domain-Trigger und Mute-Schalter haben mindestens 44×44 px Touchflaeche;
- Bestmarke und Streak zeigen mobil Icon + Wert, ihre volle Bedeutung steht in
  `aria-label` und `title`;
- der Mute-Schalter traegt zusaetzlich `aria-pressed`;
- Header-Geometrie und responsive Sichtbarkeit leben in `app-header-*`- bzw.
  `domain-switcher-*`-Klassen, nicht in Header-Inline-Styles.

Der DomainSwitcher-Trigger verknuepft das Menue im offenen Zustand ueber `aria-controls`, meldet
seinen Zustand ueber `aria-expanded` und kennzeichnet das Popup mit `aria-haspopup="menu"`.
Escape und die Auswahl einer Option schliessen das Menue und fokussieren den Trigger. Das Menue
bleibt schmaler als der Viewport, endet mit Sicherheitsabstand vor dessen Unterkante und scrollt
vertikal, damit alle Bereiche auch im Querformat erreichbar bleiben. Bei
`prefers-reduced-motion:reduce` laufen weder `.slide-in` noch die Chevron-Drehung animiert.

## Pruefen

```bash
node scripts/check_layout_contract.cjs          # menschenlesbar, Exit 0/1
node scripts/check_layout_contract.cjs --json     # maschinenlesbar
# oder via npm:
npm run check:layout
```

Der Check verifiziert: Variablen vorhanden, Shell-Klassen vorhanden, Breakpoint + Stapelung
vorhanden, App.jsx nutzt die Klassen, und die Shell-Masse (390px / 100vh) sind nicht wieder inline
in `App.jsx` hartcodiert. Fuer den Header maskiert ein Klammer-Parser CSS-Kommentare und Strings,
liest alle echten 768px-Bloecke und stellt sicher, dass nur der zentrale Mobilblock Header-Regeln
traegt; der separate `.app-main--explore`-Block bleibt davon unberuehrt. Im Headerblock prueft er
Grid, einzeilige Navigation, visuell ausgeblendete Labels und 44px-Touchziele. Zusaetzlich prueft
er Header-/Switcher-Klassen, zentrale ARIA-Merkmale und Reduced Motion. Fuer den Rechts-Footer
prueft er, dass die Pflichtlinks dauerhaft unterstrichen sind, keine Regel der
`.app-footer`-Klassenfamilie `opacity` setzt und die letzte Farbangabe der eigentlichen
`.app-footer`-Regel `--text-footer` verwendet. Der dekorative, `aria-hidden` gesetzte Trenner
besitzt bewusst eine eigene Farbe. Farbe allein ist kein Linkindikator, und die frueheren Werte lagen mit
4,30:1 (Links) beziehungsweise 3,31:1 (Disclaimer mit `opacity:.85`) unter den 4,5:1, die
WCAG 2.1 AA fuer normale Schrift verlangt. Das sind
Strukturpruefungen am Quelltext, keine Pixelmessungen oder Runtime-A11y-Tests. Die ARIA-Pruefungen
ersetzen daher weder den gezielten RTL-Test noch eine Browser-/Assistenztechnik-Gegenprobe.

## Was der Check NICHT abdeckt

Er prueft die Struktur, nicht das visuelle Ergebnis. Ein echter Pixel-/Scroll-Test braucht einen
Browser. Pflicht-Gegenprobe vor groesseren Layout-Aenderungen:

- **1280×800** fuer die Desktop-Regression;
- **769×800** und **768×800** direkt beidseits des Breakpoints, ohne harten Hoehensprung;
- **375×812** fuer Handy-Hochkant: Header grob maximal 120px, Nav einzeilig, kein
  Dokument-X-Overflow und Hauptinhalt deutlich im oberen Drittel;
- **844×390** fuer Handy-Querformat: Dropdown scrollbar, alle neun Domains erreichbar und seine
  Unterkante mindestens 8px vor der Viewport-Unterkante.

Der maschinelle Check ersetzt diese Gegenprobe und einen echten Geraetetest nicht.
