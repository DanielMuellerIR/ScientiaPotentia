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

/**
 * Maskiert Kommentare und Strings längentreu. Parser-Suchen laufen nur über
 * diese Ansicht, ihre Trefferindizes zeigen aber weiterhin exakt in den
 * Originaltext. So kann weder ein Kommentar noch content:"@media ..." einen
 * nicht vorhandenen Block oder Selektor vortäuschen.
 */
function maskCssNonCode(source) {
  const masked = source.split('');
  let quote = null;
  let inComment = false;
  const blank = (index) => {
    if (source[index] !== '\n' && source[index] !== '\r') masked[index] = ' ';
  };

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (inComment) {
      blank(i);
      if (char === '*' && next === '/') {
        blank(i + 1);
        inComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      blank(i);
      if (char === '\\' && i + 1 < source.length) {
        blank(i + 1);
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '/' && next === '*') {
      blank(i);
      blank(i + 1);
      inComment = true;
      i += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      blank(i);
      quote = char;
    }
  }
  return masked.join('');
}

/**
 * Liest einen echten Klammerblock aus dem Originaltext. Die Klammerzählung
 * verwendet die maskierte Ansicht, damit Klammern in Kommentaren und Strings
 * nicht als CSS-Struktur zählen.
 */
function readBraceBlock(source, maskedSource, openBraceIndex) {
  if (maskedSource[openBraceIndex] !== '{') return null;
  let depth = 0;

  for (let i = openBraceIndex; i < source.length; i += 1) {
    const char = maskedSource[i];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return {
          body: source.slice(openBraceIndex + 1, i),
          openBraceIndex,
          closeBraceIndex: i
        };
      }
    }
  }
  return null;
}

function findBlocks(source, startPattern) {
  const maskedSource = maskCssNonCode(source);
  const flags = startPattern.flags.replace(/[gy]/g, '') + 'g';
  const matcher = new RegExp(startPattern.source, flags);
  const blocks = [];
  let match;

  while ((match = matcher.exec(maskedSource)) !== null) {
    const openBraceIndex = maskedSource.indexOf(
      '{',
      match.index + match[0].length
    );
    if (openBraceIndex < 0) break;
    const block = readBraceBlock(source, maskedSource, openBraceIndex);
    if (!block) break;
    blocks.push({ ...block, matchIndex: match.index });
  }
  return blocks;
}

function findBlock(source, startPattern) {
  return findBlocks(source, startPattern)[0]?.body || null;
}

function getRuleBodies(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return findBlocks(source, new RegExp(`${escaped}\\s*(?=\\{)`))
    .map(block => block.body);
}

function getRuleBody(source, selector) {
  const bodies = getRuleBodies(source, selector);
  // Bei einer später wiederholten identischen Regel gilt deren Deklaration.
  return bodies[bodies.length - 1] || null;
}

/**
 * Sammelt Regeln anhand ihres vollständigen Selektortexts. Im Unterschied zu
 * getRuleBodies() kann der Aufrufer damit eine ganze Klassenfamilie prüfen,
 * etwa `.app-footer`, `.app-footer a` und `.app-footer-sep` gemeinsam.
 */
function getRuleBodiesMatching(source, selectorPattern) {
  const maskedSource = maskCssNonCode(source);
  const bodies = [];
  const openBraces = /\{/g;
  let match;

  while ((match = openBraces.exec(maskedSource)) !== null) {
    let start = match.index - 1;
    while (start >= 0 && !'{};'.includes(maskedSource[start])) start -= 1;
    const selector = maskedSource.slice(start + 1, match.index).trim();
    if (!selector || selector.startsWith('@')) continue;

    const flags = selectorPattern.flags.replace(/[gy]/g, '');
    if (!new RegExp(selectorPattern.source, flags).test(selector)) continue;
    const block = readBraceBlock(source, maskedSource, match.index);
    if (block) bodies.push(block.body);
  }
  return bodies;
}

function lastBodyWithDeclaration(bodies, propertyPattern) {
  return [...bodies].reverse().find(body => propertyPattern.test(body)) || '';
}

// Hilfsfunktion: prüft auf eine echte CSS-Regel, nie auf Kommentar/String.
function hasRule(selector, source = css) {
  return getRuleBodies(source, selector).length > 0;
}

const mobile768Blocks = findBlocks(
  css,
  /@media\s*\(\s*max-width\s*:\s*768px\s*\)\s*(?=\{)/
);
const mobileContractClasses = [
  '.app-header',
  '.app-header-brand',
  '.app-header-meta',
  '.app-header-nav',
  '.app-header-nav-button',
  '.app-header-nav-label',
  '.app-header-audio',
  '.app-header-stat',
  '.domain-switcher-trigger',
  '.domain-switcher-active-name',
  '.domain-switcher-active-label',
  '.domain-switcher-chevron'
];
function containsClassToken(source, className) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}(?![-_a-zA-Z0-9])`).test(maskCssNonCode(source));
}
function getMobileContractBlocks(blocks) {
  return blocks.filter(block =>
    mobileContractClasses.some(className => containsClassToken(block.body, className))
  );
}
// Header-Regeln dürfen genau in einem der echten 768er-Blöcke liegen. Dadurch
// kann ein späterer Spezialblock (z.B. app-main--explore) bestehen bleiben,
// aber keine spätere Header-Regel den geprüften Vertrag still überschreiben.
const mobileContractBlocks = getMobileContractBlocks(mobile768Blocks);
const mobile768 = mobileContractBlocks[0]?.body || null;
const reducedMotion = findBlock(
  css,
  /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*(?=\{)/
);

// Deterministischer Parser-Selbsttest: vorgetäuschte Media Queries und Regeln
// stehen absichtlich vor den echten Strukturen.
const parserFixture = `
  /* @media (max-width:768px) { .app-header { display:block } } */
  .decoy::before {
    content:"@media (max-width:768px) { .app-header { display:block } }";
  }
  @media (max-width:768px) {
    /* .app-header { display:block } */
    .inner-decoy::before { content:".app-header { display:block }"; }
    .app-header { display:grid }
  }
  @media (max-width:768px) { .app-header-nav-label { display:block } }
`;
const parserFixtureBlocks = findBlocks(
  parserFixture,
  /@media\s*\(\s*max-width\s*:\s*768px\s*\)\s*(?=\{)/
);
const parserProbe = getRuleBody(
  parserFixtureBlocks[0]?.body || '',
  '.app-header'
);
const parserFixtureContractBlocks = getMobileContractBlocks(parserFixtureBlocks);
const parserSelfTestOk = parserFixtureBlocks.length === 2
  && parserFixtureContractBlocks.length === 2
  && /display\s*:\s*grid/.test(parserProbe || '')
  && !hasRule(
    '.ghost',
    '/* .ghost { display:block } */ .decoy { content:".ghost { display:block }" }'
  );

const footerFamilyPattern = /(?:^|,)\s*\.app-footer(?:$|[-\s.:#>+~\[])/;
const footerParserFixture = `
  .app-footer { color:var(--text-footer) }
  .app-footer a { opacity:.6 }
  @media (max-width:768px) { .app-footer { color:var(--text-muted) } }
`;
const footerParserFixtureBodies = getRuleBodiesMatching(
  footerParserFixture,
  footerFamilyPattern
);
const footerParserSelfTestOk = footerParserFixtureBodies.length === 3
  && footerParserFixtureBodies.some(body => /opacity\s*:\s*\.6/.test(body))
  && /color\s*:\s*var\(--text-muted\)/.test(lastBodyWithDeclaration(
    getRuleBodies(footerParserFixture, '.app-footer'),
    /color\s*:/
  ));

// 1) Layout-Masse muessen als CSS-Variablen zentral definiert sein.
check('Interner CSS-Parser ignoriert Fake-Bloecke in Kommentaren und Strings',
  parserSelfTestOk,
  `Laengentreue CSS-Maskierung bzw. Brace-Parser nicht abschwaechen.`);
check('Interner CSS-Parser erfasst Selektorfamilien und die letzte Farbkaskade',
  footerParserSelfTestOk,
  `Familienregeln und die letzte wirksame Farbangabe muessen getrennt ermittelt werden.`);
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
  mobile768Blocks.length > 0,
  `Mobil-Breakpoint in src/index.css nicht entfernen.`);
check('Header-Vertrag liegt in genau einem echten 768px-Block',
  mobileContractBlocks.length === 1,
  `Alle echten 768px-Bloecke werden geprueft: Header-/Switcher-Regeln nur im zentralen Mobilblock halten; app-main--explore darf separat bleiben.`);
check('Mobil stapelt (.app-main flex-direction:column)',
  /flex-direction\s*:\s*column/.test(getRuleBody(mobile768 || '', '.app-main') || ''),
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

// 6) Der Header ist mobil zweizeilig und bleibt vollständig per CSS steuerbar.
const headerStart = app.search(/<header\b[^>]*\bapp-header\b[^>]*>/);
const headerEnd = headerStart >= 0 ? app.indexOf('</header>', headerStart) : -1;
const headerMarkup = headerStart >= 0 && headerEnd >= 0
  ? app.slice(headerStart, headerEnd + '</header>'.length)
  : '';
const navStart = headerMarkup.search(/<nav\b[^>]*\bapp-header-nav\b[^>]*>/);
const navEnd = navStart >= 0 ? headerMarkup.indexOf('</nav>', navStart) : -1;
const navMarkup = navStart >= 0 && navEnd >= 0
  ? headerMarkup.slice(navStart, navEnd + '</nav>'.length)
  : '';
const headerTabTags = navMarkup.match(/<button\b[\s\S]*?<\/button>/g) || [];
const mobileHeader = getRuleBody(mobile768 || '', '.app-header') || '';
const mobileNav = getRuleBody(mobile768 || '', '.app-header-nav') || '';
const mobileNavButton = getRuleBody(mobile768 || '', '.app-header-nav button,.app-header-nav-button') || '';
const mobileNavLabel = getRuleBody(mobile768 || '', '.app-header-nav-label') || '';
const mobileAudio = getRuleBody(mobile768 || '', '.app-header-audio') || '';
const mobileDomainTrigger = getRuleBody(mobile768 || '', '.domain-switcher-trigger') || '';

check('App-Header enthaelt keine Inline-Styles',
  headerMarkup.length > 0 && !/\bstyle\s*=/.test(headerMarkup),
  `Header-Markup in src/App.jsx ausschliesslich ueber app-header-* Klassen stylen.`);
['app-header-nav-button', 'app-header-nav-label', 'app-header-audio', 'app-header-stat'].forEach((c) =>
  check(`App-Header verwendet Klasse "${c}"`, headerMarkup.includes(c),
    `Header-Markup in src/App.jsx muss die responsive Klasse "${c}" verwenden.`)
);
check('Header-Quelltext: Tabs besitzen aria-label, title und aria-current',
  headerTabTags.length >= 3 && headerTabTags.every(tag =>
    /\baria-label=/.test(tag)
      && /\btitle=/.test(tag)
      && /\baria-current=/.test(tag)
  ),
  `Source-Gate: Jeder Header-Tab braucht einen stabilen Namen und der aktive Tab aria-current="page"; Runtime decken RTL/Browser ab.`);
check('Header-Quelltext: Quiz-Tab bleibt domainuebergreifend beschriftet',
  /aria-label="Quiz"/.test(headerMarkup)
    && /title="Quiz"/.test(headerMarkup)
    && /app-header-nav-label">Quiz</.test(headerMarkup),
  `Desktop- und A11y-Produktlabel fuer alle Domains als "Quiz" erhalten.`);
check('Header-Quelltext: Mute-Schalter besitzt aria-label und aria-pressed',
  /app-header-audio[\s\S]*?\baria-label=/.test(headerMarkup)
    && /app-header-audio[\s\S]*?\baria-pressed=/.test(headerMarkup),
  `Source-Gate: Der Mute-Schalter muss Zustand und Aktion benennen; Runtime decken RTL/Browser ab.`);
check('Mobiler Header ist ein zweizeiliges Grid',
  /display\s*:\s*grid/.test(mobileHeader)
    && /grid-template-areas\s*:[^;]*brand\s+meta[^;]*nav\s+nav/.test(mobileHeader),
  `Im echten 768px-Media-Block .app-header als Grid mit "brand meta" / "nav nav" definieren.`);
check('Mobile Header-Navigation bleibt in einer Zeile',
  /flex-wrap\s*:\s*nowrap/.test(mobileNav),
  `Im echten 768px-Media-Block muss .app-header-nav flex-wrap:nowrap verwenden.`);
check('Mobile Header-Labels sind visuell ausgeblendet',
  /display\s*:\s*none/.test(mobileNavLabel),
  `Im echten 768px-Media-Block .app-header-nav-label ausblenden; aria-label bleibt erhalten.`);
check('Mobile Header-Tabs haben mindestens 44x44px Touchziel',
  /min-width\s*:\s*44px/.test(mobileNavButton)
    && /min-height\s*:\s*44px/.test(mobileNavButton),
  `Im echten 768px-Media-Block fuer .app-header-nav-button mindestens 44px Breite und Hoehe setzen.`);
check('Mobiler Mute-Schalter hat mindestens 44x44px Touchziel',
  /(?:width|min-width)\s*:\s*44px/.test(mobileAudio)
    && /(?:height|min-height)\s*:\s*44px/.test(mobileAudio),
  `Im echten 768px-Media-Block .app-header-audio auf mindestens 44x44px halten.`);
check('Mobiler DomainSwitcher-Trigger hat mindestens 44x44px Touchziel',
  /min-width\s*:\s*44px/.test(mobileDomainTrigger)
    && /min-height\s*:\s*44px/.test(mobileDomainTrigger),
  `Im echten 768px-Media-Block .domain-switcher-trigger auf mindestens 44x44px halten.`);

// 7) Der Switcher darf responsive Geometrie nicht wieder ins JSX verlagern.
const switcher = fs.readFileSync(path.join(root, 'src/components/DomainSwitcher.jsx'), 'utf8');
const switcherMenuCss = getRuleBody(css, '.domain-switcher-menu') || '';
['domain-switcher-root', 'domain-switcher-trigger', 'domain-switcher-active-text',
  'domain-switcher-chevron', 'domain-switcher-menu'].forEach((c) =>
  check(`DomainSwitcher verwendet Klasse "${c}"`, switcher.includes(c),
    `DomainSwitcher-Geometrie ueber die Klasse "${c}" in index.css steuern.`)
);
check('DomainSwitcher-Trigger besitzt vollstaendige ARIA-Semantik',
  /aria-expanded=/.test(switcher)
    && /aria-haspopup="menu"/.test(switcher)
    && /aria-controls=/.test(switcher),
  `Trigger braucht aria-expanded, aria-haspopup="menu" und aria-controls.`);
check('DomainSwitcher-Menue ist viewportbegrenzt und vertikal scrollbar',
  /max-width\s*:/.test(switcherMenuCss)
    && /max-height\s*:/.test(switcherMenuCss)
    && /overflow-y\s*:\s*auto/.test(switcherMenuCss),
  `Das Dropdown braucht viewportbezogene Maximalmasse und overflow-y:auto.`);
const reducedSlideIn = getRuleBody(reducedMotion || '', '.slide-in') || '';
const reducedChevron = getRuleBody(reducedMotion || '', '.domain-switcher-chevron') || '';
check('Reduced Motion deaktiviert Slide-in und Chevron-Transition',
  reducedMotion !== null
    && /animation\s*:\s*none/.test(reducedSlideIn)
    && /transition\s*:\s*none/.test(reducedChevron),
  `Im prefers-reduced-motion-Block Animation und Chevron-Transition deaktivieren.`);

// 8) Rechts-Footer: die rechtlichen Pflichtangaben muessen erkennbar und lesbar bleiben.
//    Beide Pruefungen sind Kontrast-/Erkennbarkeitsregeln aus WCAG 2.1 AA, kein Geschmack:
//    Farbe allein ist kein Linkindikator (1.4.1), normale Schrift braucht 4,5:1 (1.4.3).
const footerBodies = getRuleBodies(css, '.app-footer');
const footerFamilyBodies = getRuleBodiesMatching(css, footerFamilyPattern);
const effectiveFooterColor = lastBodyWithDeclaration(footerBodies, /color\s*:/);
const footerLinkCss = getRuleBody(css, '.app-footer a') || '';
check('Footer-Links sind dauerhaft unterstrichen',
  /text-decoration\s*:\s*underline/.test(footerLinkCss),
  `.app-footer a dauerhaft unterstreichen: auf Touch-Geraeten gibt es keinen Hover als Ausgleich.`);
check('Footer-Text bleibt opak und nutzt die kontraststarke Footerfarbe',
  /--text-footer\s*:/.test(css)
    && /color\s*:\s*var\(--text-footer\)/.test(effectiveFooterColor)
    && footerFamilyBodies.every((body) => !/opacity\s*:/.test(body)),
  `.app-footer auf var(--text-footer) halten und in der ganzen Footer-Klassenfamilie keine opacity setzen (mindestens 4,5:1).`);

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
