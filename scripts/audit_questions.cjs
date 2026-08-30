// Deterministischer Fragen-Integritäts-Audit über ALLE Domains.
//
// Fängt die klassischen MCQ-"Selbstverräter" statistisch ab — ohne LLM, über
// den gesamten Fragenbestand (nicht nur Stichproben):
//
//   1. Längen-Bias je Fragetyp: ist die richtige Antwort systematisch die
//      längste (oder kürzeste) Option? Erwartung bei 4 Optionen ~25 %.
//      >50 % = die Antwortlänge verrät die Lösung (typischer Template-Fehler).
//   2. Antwort-im-Fragetext: taucht die richtige Antwort wörtlich im prompt auf?
//   3. Strukturfehler: Dubletten-Optionen, correctAnswer fehlt in options,
//      <2 distinkte Optionen.
//   4. Format-Tell: nur die richtige Option hat Klammer/Zahl/Sonderzeichen,
//      die Distraktoren nicht (oder umgekehrt).
//
// Aufruf: node scripts/audit_questions.cjs [domain] [--dump=/tmp/sci_audit]
//   --dump schreibt je Domain die auffälligen Fälle + eine Zufallsstichprobe
//   als JSON für die anschließende semantische LLM-Prüfung.
//   --data-dir erlaubt isolierte Regressionstests mit einem kleinen Katalog.

const fs = require('fs');
const path = require('path');
// `answerInStem` heißt hier `answerAppearsInStem`, weil unten ein gleichnamiges
// Sammel-Array für die Treffer steht.
const { expectsOptions, norm, answerInStem: answerAppearsInStem } = require('./lib/audit_rules.cjs');

const DOMAINS = ['astra', 'cultura', 'historia', 'homo', 'lingua', 'machina', 'natura', 'terra'];
const args = process.argv.slice(2);
const positional = args.filter(arg => !arg.startsWith('--'));
if (positional.length > 1 || (positional[0] && !DOMAINS.includes(positional[0]))) {
  console.error(`Unbekannte Domain: ${positional.join(' ') || '(leer)'}`);
  process.exit(2);
}
const selectedDomains = positional[0] ? [positional[0]] : DOMAINS;
const optionValue = name => {
  const prefix = `${name}=`;
  const option = args.find(arg => arg.startsWith(prefix));
  return option ? option.slice(prefix.length) : null;
};
const dataArg = optionValue('--data-dir');
const DATA = dataArg ? path.resolve(dataArg) : path.join(__dirname, '..', 'public', 'data');
const dumpArg = optionValue('--dump');
const dumpDir = dumpArg ? path.resolve(dumpArg) : null;
if (dumpDir) fs.mkdirSync(dumpDir, { recursive: true });

// `norm` und die Prüfregeln liegen in ./lib/audit_rules.cjs (dort auch getestet).

function loadQuestions(domain) {
  const p = path.join(DATA, `questions_${domain}.json`);
  if (!fs.existsSync(p)) return null;
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  return Array.isArray(d) ? d : (d.questions || Object.values(d));
}

// Pseudo-Zufall mit fixem Seed (reproduzierbare Stichprobe).
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const summary = [];
let missingCatalogs = 0;

for (const domain of selectedDomains) {
  const qs = loadQuestions(domain);
  if (!qs) {
    console.error(`Fragenkatalog fehlt: ${path.join(DATA, `questions_${domain}.json`)}`);
    missingCatalogs += 1;
    continue;
  }

  const byType = {};                 // type -> Statistik
  const answerInStem = [];
  const structural = [];
  const formatTell = [];

  for (const q of qs) {
    const opts = q.options || [];
    const correct = q.correctAnswer;
    const prompt = q.prompt || q.question || '';
    const type = q.type || '?';

    (byType[type] ||= {
      type, n: 0, longest: 0, shortest: 0,
      lenCorrect: 0, lenDistract: 0, nDistract: 0,
    });
    const t = byType[type];

    // --- Struktur ---
    // Optionslose Typen (click-map) überspringen: dort ist `options: []` korrekt.
    const normOpts = opts.map(norm);
    const dup = new Set(normOpts).size !== normOpts.length;
    const hasAnswerKey = typeof correct === 'string' && correct.trim().length > 0;
    const hasCorrect = hasAnswerKey && normOpts.includes(norm(correct));
    if (expectsOptions(type) && (opts.length < 2 || dup || !hasAnswerKey || !hasCorrect)) {
      structural.push({ id: q.id, type, reason: opts.length < 2 ? 'zu wenige Optionen' : dup ? 'Dubletten-Option' : !hasAnswerKey ? 'correctAnswer fehlt' : 'correctAnswer fehlt in options', prompt, correct, options: opts });
    }

    // --- Längen-Bias ---
    if (opts.length >= 3 && hasCorrect) {
      const lens = opts.map(o => String(o).length);
      const cLen = String(correct).length;
      const maxLen = Math.max(...lens), minLen = Math.min(...lens);
      const isUniqueLongest = cLen === maxLen && lens.filter(l => l === maxLen).length === 1;
      const isUniqueShortest = cLen === minLen && lens.filter(l => l === minLen).length === 1;
      t.n++;
      if (isUniqueLongest) t.longest++;
      if (isUniqueShortest) t.shortest++;
      t.lenCorrect += cLen;
      const dl = lens.filter((_, i) => norm(opts[i]) !== norm(correct));
      t.lenDistract += dl.reduce((a, b) => a + b, 0);
      t.nDistract += dl.length;
    }

    // --- Antwort im Fragetext ---
    // Nur sinnvoll, wenn die Antwort kein triviales Kurzwort ist und nicht der
    // erwartete Reverse-Fall (answerIsName + Lemma im Stamm) vorliegt.
    // Wortgrenzen-Vergleich (siehe audit_rules.cjs): "welches" enthält zwar
    // "Elch", verrät die Antwort aber nicht.
    const nc = norm(correct);
    if (answerAppearsInStem(prompt, correct)) {
      answerInStem.push({ id: q.id, type, prompt, correct, options: opts });
    }

    // --- Format-Tell: Klammer/Ziffer nur bei der richtigen Option ---
    const hasSpecial = s => /[()0-9]/.test(String(s));
    const correctSpecial = hasSpecial(correct);
    const distractSpecial = opts.filter(o => norm(o) !== nc).map(hasSpecial);
    if (distractSpecial.length >= 2 && correctSpecial && distractSpecial.every(x => !x)) {
      formatTell.push({ id: q.id, type, prompt, correct, options: opts, reason: 'nur richtige Option hat Klammer/Ziffer' });
    }
  }

  // Typ-Statistik auswerten — Bias-Flag bei deutlicher Abweichung von 25 %.
  const typeStats = Object.values(byType).map(t => ({
    type: t.type, n: t.n,
    pctLongest: t.n ? +(100 * t.longest / t.n).toFixed(1) : 0,
    pctShortest: t.n ? +(100 * t.shortest / t.n).toFixed(1) : 0,
    avgLenCorrect: t.n ? +(t.lenCorrect / t.n).toFixed(1) : 0,
    avgLenDistract: t.nDistract ? +(t.lenDistract / t.nDistract).toFixed(1) : 0,
  }));
  const biasTypes = typeStats.filter(t => t.n >= 8 && (t.pctLongest >= 50 || t.pctShortest >= 55));

  summary.push({ domain, total: qs.length, structural: structural.length, answerInStem: answerInStem.length, formatTell: formatTell.length, biasTypes });

  // Konsolen-Report je Domain
  console.log(`\n=== ${domain.toUpperCase()}  (${qs.length} Fragen) ===`);
  console.log(`  Strukturfehler: ${structural.length} | Antwort-im-Stamm: ${answerInStem.length} | Format-Tell: ${formatTell.length}`);
  if (biasTypes.length) {
    console.log(`  ⚠ Längen-Bias-Templates (n≥8, longest≥50% oder shortest≥55%):`);
    biasTypes.sort((a, b) => Math.max(b.pctLongest, b.pctShortest) - Math.max(a.pctLongest, a.pctShortest))
      .forEach(t => console.log(`     ${t.type}  n=${t.n}  longest=${t.pctLongest}%  shortest=${t.pctShortest}%  (Ø richtig ${t.avgLenCorrect} vs Distr ${t.avgLenDistract})`));
  } else {
    console.log(`  ✓ kein auffälliger Längen-Bias auf Template-Ebene`);
  }
  if (structural.length) structural.slice(0, 5).forEach(s => console.log(`     STRUKT ${s.id}: ${s.reason}`));

  // --- Dump für LLM-Prüfung ---
  if (dumpDir) {
    const rnd = seeded(1234567 + domain.length);
    const sample = [...qs].sort(() => rnd() - 0.5).slice(0, 50)
      .map(q => ({ id: q.id, type: q.type, prompt: q.prompt, correctAnswer: q.correctAnswer, options: q.options }));
    fs.writeFileSync(path.join(dumpDir, `${domain}.json`), JSON.stringify({
      domain,
      flagged: { structural, answerInStem: answerInStem.slice(0, 40), formatTell: formatTell.slice(0, 40), biasTypes },
      randomSample: sample,
    }, null, 2));
  }
}

console.log('\n\n===== GESAMT-ÜBERSICHT =====');
summary.forEach(s => console.log(
  `${s.domain.padEnd(9)} ${String(s.total).padStart(6)} Fragen | Strukt ${s.structural} | Ans-im-Stamm ${s.answerInStem} | Format ${s.formatTell} | Bias-Templates ${s.biasTypes.length}`
));
if (dumpDir) console.log(`\nStichproben + Flags geschrieben nach: ${dumpDir}`);

// Strukturfehler und eine mechanisch im Stamm enthaltene Antwort verletzen
// harte Projektregeln. Heuristische Format- und Längenhinweise bleiben dagegen
// Sichtungsbefunde und dürfen den automatischen Lauf nicht allein blockieren.
const blockingFindings = summary.reduce(
  (count, item) => count + item.structural + item.answerInStem,
  missingCatalogs
);
if (blockingFindings) {
  console.error(`\n${blockingFindings} blockierende Fragenfehler gefunden.`);
  process.exitCode = 1;
}
