// Bergungsfähiger Loader für MiniMax-Harvest-Ausgaben.
//
// MiniMax (One-Shot via theplan `llm_run.py minimax`) liefert beim Konzept-Harvest
// zwei bekannte JSON-Schwächen (siehe theplan/knowledge/p_scientiapotentia.md):
//   1. Gemischte Anführungszeichen: öffnet mit typografischem „, schließt mit geradem "
//      → roher JSON.parse scheitert. Deterministischer Repair: „…" -> „…“.
//   2. Seltene Strukturbrüche bei langen Outputs (>~20 Objekte/Call), z.B.
//      "verifyNote":"Wikidata":"Q…"} (Schlüssel mit zwei Werten). Nicht reparierbar
//      → das EINE kaputte Objekt droppen + protokollieren, statt den ganzen Batch zu verlieren.
//
// Strategie: Markdown-Fences entfernen, Quote-Repair, dann Top-Level-{…}-Objekte per
// Klammertiefe (string-aware, damit { } in Strings nicht zählen) zerlegen und je Objekt
// einzeln parsen. So überlebt der Rest des Batches einen einzelnen Strukturfehler.
//
// Aufruf:  node mm_load.cjs <out1.txt> [out2.txt ...] [--out=ziel.json]
//   Ohne --out wird nur eine Statistik ausgegeben (kein Schreiben).
//   Mit --out=datei.json werden alle geretteten Objekte als JSON-Array geschrieben.

const fs = require("fs");

// Typografische Anführungszeichen reparieren: „text" -> „text“ (sonst bricht der String).
function quoteRepair(s) {
  return s.replace(/„([^"„]*)"/g, "„$1“");
}

// Top-Level-{…}-Objekte herausschneiden, ohne von { } innerhalb von Strings getäuscht
// zu werden. Liefert ein Array von rohen Objekt-Strings.
function extractObjects(s) {
  const out = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let k = 0; k < s.length; k++) {
    const ch = s[k];
    if (inStr) {                       // im String: nur auf das schließende " achten
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") { if (depth === 0) start = k; depth++; }
    else if (ch === "}") { depth--; if (depth === 0 && start >= 0) { out.push(s.slice(start, k + 1)); start = -1; } }
  }
  return out;
}

// Eine MiniMax-Ausgabedatei laden → { good: [...], dropped: [kurzauszug, ...] }.
function load(file) {
  const raw = quoteRepair(fs.readFileSync(file, "utf8").replace(/```json/gi, "").replace(/```/g, ""));
  const good = [], dropped = [];
  for (const o of extractObjects(raw)) {
    try { good.push(JSON.parse(o)); }
    catch (e) { dropped.push(o.slice(0, 80)); }   // kaputtes Objekt: droppen + merken
  }
  return { good, dropped };
}

if (require.main === module) {
  let args = process.argv.slice(2);
  let outFile = null;
  args = args.filter(a => { const m = a.match(/^--out=(.+)$/); if (m) { outFile = m[1]; return false; } return true; });
  const all = [];
  for (const f of args) {
    const { good, dropped } = load(f);
    console.log(`${f}: ${good.length} gerettet, ${dropped.length} verworfen`);
    dropped.forEach(d => console.log("   DROP: " + d));
    all.push(...good);
  }
  if (outFile) { fs.writeFileSync(outFile, JSON.stringify(all, null, 2)); console.log(`=> ${outFile}: ${all.length} Objekte`); }
  else console.log(`(kein --out angegeben; insgesamt ${all.length} Objekte ladbar)`);
}

module.exports = { quoteRepair, extractObjects, load };
