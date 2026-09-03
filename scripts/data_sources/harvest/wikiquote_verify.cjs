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
const { writeJsonAtomic } = require('./json_io.cjs');
const { normalizeQuoteText, quoteTokens } = require('./wikiquote_cleaning.cjs');

const UA = { 'User-Agent': 'ScientiaQuizQuoteVerify/1.0 (public educational project)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// `norm`/`toks` liegen seit CodeQA 2026-09-03 zentral in wikiquote_cleaning.cjs.
// Die frueheren Kopien waren auseinandergedriftet: Diese hier kannte nur die
// geraden Anfuehrungszeichen, der Verifizierer auch die typografischen.
const norm = normalizeQuoteText;
const toks = quoteTokens;

function fetchPage(title, tries = 0) {
  return new Promise((resolve, reject) => {
    const url = 'https://de.wikiquote.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&titles=' + encodeURIComponent(title);
    let retryStarted = false;
    const retry = error => {
      if (retryStarted) return;
      retryStarted = true;
      if (tries >= 3) { reject(error); return; }
      setTimeout(() => fetchPage(title, tries + 1).then(resolve, reject), 800 * (tries + 1));
    };
    const req = https.get(url, { headers: UA }, response => {
      if (response.statusCode === 429 || response.statusCode >= 500) {
        response.resume();
        retry(new Error(`Wikiquote HTTP ${response.statusCode} für ${title}`));
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Wikiquote HTTP ${response.statusCode} für ${title}`));
        return;
      }
      let data = '';
      response.on('error', retry);
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          const page = Object.values(JSON.parse(data).query.pages)[0];
          resolve(page.missing !== undefined ? '' : (page.revisions[0].slots.main['*'] || ''));
        } catch (error) {
          retry(new Error(`Wikiquote-Antwort für ${title} nicht parsebar: ${error.message}`));
        }
      });
    });
    req.on('error', retry);
    req.setTimeout(30000, () => req.destroy(new Error('Wikiquote-Timeout')));
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
    if (outFile) { writeJsonAtomic(outFile, verified.map(v => v.q)); console.log(`=> ${outFile}: ${verified.length} Objekte`); }
  });
}

module.exports = { verify, norm, toks };
