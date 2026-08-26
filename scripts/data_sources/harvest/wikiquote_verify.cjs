// Verifiziert geerntete Zitat-Konzepte gegen de.wikiquote.org.
//
// Hintergrund: LLM-Harvest (MiniMax) liefert berühmte Zitate mit hoher Recall,
// aber relevantem Halluzinations-/FEHLZUSCHREIBUNGSrisiko (z.B. wurde Kants
// „Aufklärung ist der Ausgang…" fälschlich Tucholsky zugeschrieben). Daher Pflicht-
// Gate: Wortlaut gegen die de.wikiquote-AUTORENSEITE prüfen.
//
// Strikt-verbatim ist zu streng (historische Orthographie „todt/seyn", Zitate auf
// Werk-Unterseiten) → Token-OVERLAP: Anteil der Zitat-Tokens (Länge ≥3), die auf der
// Autorenseite vorkommen. Schwelle 0.8 bestätigt die ATTRIBUTION zuverlässig (ein
// fremder Autor hätte kaum Overlap) und den Wortlaut weitgehend; Grenzfälle <0.8
// werden konservativ verworfen (lieber weniger, dafür korrekt zugeschrieben).
//
// Aufruf: node wikiquote_verify.cjs <quotes_raw.json> [--out=verified.json] [--min=0.8]
//   Konzept-Schema: { name:<Zitattext>, attributes:{ author, ... }, ... }

const https = require('https');
const fs = require('fs');

const UA = { 'User-Agent': 'ScientiaQuizQuoteVerify/1.0 (public educational project)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Wortlaut normalisieren: Umlaute behalten, aber Anführungen/Gedankenstriche/
// Satzzeichen/Whitespace vereinheitlichen (ß->ss), damit nur der Wortbestand zählt.
function norm(s) {
  return String(s || '').toLowerCase()
    .replace(/[„“”"»«‚‘’']/g, ' ').replace(/[–—-]/g, ' ').replace(/[…]/g, ' ')
    .replace(/[.,;:!?()\[\]]/g, ' ').replace(/ß/g, 'ss').replace(/\s+/g, ' ').trim();
}
const toks = s => norm(s).split(' ').filter(w => w.length >= 3);

function fetchPage(title, tries = 0) {
  return new Promise(res => {
    const url = 'https://de.wikiquote.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&titles=' + encodeURIComponent(title);
    https.get(url, { headers: UA }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => { try { const p = Object.values(JSON.parse(d).query.pages)[0]; res(p.missing !== undefined ? '' : (p.revisions[0].slots.main['*'] || '')); } catch (e) { res(''); } });
    }).on('error', async () => { if (tries < 3) { await sleep(800); res(await fetchPage(title, tries + 1)); } else res(''); });
  });
}

async function verify(quotes, min = 0.8) {
  const authors = [...new Set(quotes.map(q => q.attributes.author))];
  const pageTokens = {};
  for (const au of authors) { pageTokens[au] = new Set(toks(await fetchPage(au))); await sleep(350); }
  const verified = [], dropped = [];
  for (const q of quotes) {
    const set = pageTokens[q.attributes.author] || new Set();
    const t = toks(q.name);
    const hit = t.length ? t.filter(w => set.has(w)).length / t.length : 0;
    (hit >= min ? verified : dropped).push({ q, hit });
  }
  return { verified, dropped, authorsLoaded: authors.filter(a => pageTokens[a].size).length, authorsTotal: authors.length };
}

if (require.main === module) {
  let args = process.argv.slice(2);
  let outFile = null, min = 0.8;
  args = args.filter(a => {
    let m = a.match(/^--out=(.+)$/); if (m) { outFile = m[1]; return false; }
    m = a.match(/^--min=([\d.]+)$/); if (m) { min = parseFloat(m[1]); return false; }
    return true;
  });
  const quotes = JSON.parse(fs.readFileSync(args[0], 'utf8'));
  verify(quotes, min).then(({ verified, dropped, authorsLoaded, authorsTotal }) => {
    console.log(`Wikiquote-Seiten geladen: ${authorsLoaded}/${authorsTotal}`);
    console.log(`VERIFIZIERT (Overlap>=${min}): ${verified.length}/${quotes.length}`);
    dropped.sort((a, b) => b.hit - a.hit).forEach(({ q, hit }) => console.log(`  ✗ ${hit.toFixed(2)} ${q.attributes.author}: ${q.name.slice(0, 50)}`));
    if (outFile) { fs.writeFileSync(outFile, JSON.stringify(verified.map(v => v.q), null, 2)); console.log(`=> ${outFile}: ${verified.length} Objekte`); }
  });
}

module.exports = { verify, norm, toks };
