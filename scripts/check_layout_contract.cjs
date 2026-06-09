#!/usr/bin/env node
/*
 * Layout-Contract-Check — Regressionsschutz fuer das responsive Shell-Layout.
 *
 * Warum dieses Skript existiert:
 * Das Gesamtlayout (Root, Header, Zwei-Spalten-Bereich, Mobil-Stapelung) lebt
 * bewusst in CSS-Klassen + CSS-Variablen (src/index.css), NICHT in Inline-Styles
 * der Komponenten. Grund: Eine CSS-Media-Query kann einen Inline-Style nicht
 * ueberschreiben (Spezifitaet). Solange die Shell in CSS liegt, kann ein spaeter
 * hinzugefuegter Inline-Style das responsive Verhalten nicht aushebeln.
 *
 * Dieses Skript prueft maschinell, dass dieser Vertrag eingehalten bleibt — es
 * faengt genau den Fall, dass jemand (Mensch oder AI-Agent) die responsive CSS
 * entfernt oder die Shell-Masse wieder inline hartcodiert.
 *
 * Headless-Nutzung (kein Browser, keine Test-Abhaengigkeiten noetig):
 *   node scripts/check_layout_contract.cjs           # menschenlesbar, Exit 0/1
 *   node scripts/check_layout_contract.cjs --json     # maschinenlesbarer Output
 *
 * Vollstaendige Begruendung + manueller Testbedarf: LAYOUT.md, mobile-layout-plan.md.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');

const results = [];
// name = was geprueft wird, ok = Ergebnis, hint = Reparaturhinweis bei Fehlschlag
function check(name, ok, hint) {
  results.push({ name, ok: !!ok, hint });
}

// Hilfsfunktion: prueft, ob eine CSS-Klasse als Regel (".name{") definiert ist.
function hasRule(selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(esc + '\\s*\\{').test(css);
}

// 1) Layout-Masse muessen als CSS-Variablen zentral definiert sein.
['--header-height', '--sidebar-width', '--shell-gap', '--shell-pad'].forEach((v) =>
  check(`CSS-Variable ${v} in :root definiert`, css.includes(v),
    `Variable in src/index.css :root ergaenzen (Single Source of Truth fuer Layout-Masse).`)
);

// 2) Die benannten Shell-Klassen muessen existieren.
['.app-shell', '.app-header', '.app-main', '.app-pane-left', '.app-pane-right'].forEach((c) =>
  check(`Shell-Klasse ${c} in index.css vorhanden`, hasRule(c),
    `Klasse ${c} darf nicht entfernt werden — sie traegt die Shell-Geometrie.`)
);

// 3) Der responsive Breakpoint und die Mobil-Stapelung muessen vorhanden sein.
check('Breakpoint @media (max-width:768px) vorhanden',
  /@media\s*\(\s*max-width:\s*768px\s*\)/.test(css),
  `Mobil-Breakpoint in src/index.css nicht entfernen.`);
check('Mobil stapelt (.app-main flex-direction:column)',
  /\.app-main\s*\{\s*flex-direction:\s*column\s*\}/.test(css),
  `Im Breakpoint muss .app-main auf flex-direction:column umstellen (sonst kein Stapeln auf dem Handy).`);

// 4) App.jsx muss die Shell-Klassen tatsaechlich verwenden.
['app-shell', 'app-main', 'app-pane-left', 'app-pane-right'].forEach((c) =>
  check(`App.jsx verwendet className "${c}"`, app.includes(c),
    `Shell-Container in src/App.jsx muss className="${c}" tragen, nicht Inline-Styles.`)
);

// 5) Die Shell-Masse duerfen NICHT wieder inline in App.jsx hartcodiert sein.
check('Keine hartcodierte Sidebar-Breite (390px) inline in App.jsx',
  !app.includes('390px'),
  `Sidebar-Breite gehoert in --sidebar-width (index.css), nicht als Inline-Style.`);
check('Keine hartcodierte Root-Hoehe (100vh) inline in App.jsx',
  !/100vh/.test(app),
  `Root-Hoehe gehoert in .app-shell (100dvh, index.css), nicht als Inline-Style.`);

// --- Auswertung / Ausgabe ---
const failed = results.filter((r) => !r.ok);
const ok = failed.length === 0;

if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify({ ok, total: results.length, failed: failed.length, results }, null, 2) + '\n');
} else {
  for (const r of results) {
    console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n    ↳ ${r.hint}`}`);
  }
  console.log('');
  console.log(ok
    ? `Layout-Vertrag eingehalten: ${results.length}/${results.length} Pruefungen bestanden.`
    : `Layout-Vertrag VERLETZT: ${failed.length}/${results.length} Pruefungen fehlgeschlagen. Siehe LAYOUT.md.`);
}

process.exit(ok ? 0 : 1);
