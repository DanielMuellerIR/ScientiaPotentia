// Bergungsfähiger Loader für MiniMax-Harvest-Ausgaben.
//
// Sprachmodelle liefern beim Konzept-Harvest zwei bekannte JSON-Schwächen:
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
//   Sobald ein Objekt verworfen wurde, meldet Exit-Code 1 den unvollständigen Batch.

const fs = require("fs");
const { writeJsonAtomic } = require('./json_io.cjs');

// Typografische Anführungszeichen reparieren: „text" -> „text“ (sonst bricht der String).
// WICHTIG: die Innenklasse schließt das typografische SCHLUSSzeichen “ mit aus
// ([^"„“]) — sonst frisst der Match über ein bereits korrekt geschlossenes „…“
// hinweg bis zum nächsten ASCII-" (dem JSON-String-Ende) und zerstört das Objekt.
function quoteRepair(s) {
  return s.replace(/„([^"„“]*)"/g, "„$1“");
}

// Top-Level-{…}-Objekte herausschneiden, ohne von { } innerhalb von Strings getäuscht
// zu werden. Liefert ein Array von rohen Objekt-Strings.
function scanObjects(s) {
  const objects = [];
  const structuralDrops = [];
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
    else if (ch === "}") {
      if (depth === 0) {
        structuralDrops.push(`unerwartete schließende Klammer bei Zeichen ${k + 1}`);
        continue;
      }
      depth--;
      if (depth === 0 && start >= 0) {
        objects.push(s.slice(start, k + 1));
        start = -1;
      }
    }
  }
  if (start >= 0 || depth > 0) {
    structuralDrops.push(`unvollständig: ${s.slice(Math.max(0, start), Math.max(0, start) + 80)}`);
  }
  if (inStr) structuralDrops.push('unvollständiger JSON-String am Ausgabeende');
  return { objects, structuralDrops };
}

function validateArrayWrapper(source) {
  const text = source.trim();
  const problems = [];
  if (!text.startsWith('[')) problems.push('äußeres JSON-Array beginnt nicht mit [');
  if (!text.endsWith(']')) problems.push('äußeres JSON-Array endet nicht mit ]');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth < 0) {
        problems.push('unerwartete schließende Array-Klammer');
        depth = 0;
      }
    }
  }
  if (depth !== 0) problems.push('unausgeglichene Array-Klammern');
  if (inString) problems.push('unvollständiger String in äußerem JSON-Array');
  return [...new Set(problems)];
}

function extractObjects(s) {
  return scanObjects(s).objects;
}

// Eine MiniMax-Ausgabedatei laden → { good: [...], dropped: [kurzauszug, ...] }.
function load(file) {
  const raw = quoteRepair(fs.readFileSync(file, "utf8").replace(/```json/gi, "").replace(/```/g, ""));
  const { objects, structuralDrops } = scanObjects(raw);
  const good = [], dropped = [...validateArrayWrapper(raw), ...structuralDrops];
  for (const o of objects) {
    try { good.push(JSON.parse(o)); }
    catch (e) { dropped.push(o.slice(0, 80)); }   // kaputtes Objekt: droppen + merken
  }
  if (!objects.length && !dropped.length) {
    dropped.push(raw.trim() ? raw.trim().slice(0, 80) : 'leere Ausgabe');
  }
  return { good, dropped };
}

function main() {
  let args = process.argv.slice(2);
  let outFile = null;
  let argumentError = null;
  args = args.filter((argument) => {
    const match = argument.match(/^--out=(.*)$/);
    if (!match) {
      if (argument.startsWith('--')) argumentError = `unbekanntes Argument: ${argument}`;
      return !argument.startsWith('--');
    }
    if (!match[1]) argumentError = '--out benötigt einen Dateipfad';
    else if (outFile) argumentError = '--out darf nur einmal vorkommen';
    else outFile = match[1];
    return false;
  });
  if (argumentError || !args.length) {
    console.error(argumentError || 'Aufruf: mm_load.cjs <out1.txt> [out2.txt ...] [--out=ziel.json]');
    return 1;
  }
  const all = [];
  let droppedTotal = 0;
  for (const f of args) {
    let loaded;
    try {
      loaded = load(f);
    } catch (error) {
      console.error(`${f}: nicht lesbar (${error.message})`);
      return 1;
    }
    const { good, dropped } = loaded;
    console.log(`${f}: ${good.length} gerettet, ${dropped.length} verworfen`);
    dropped.forEach(d => console.log("   DROP: " + d));
    droppedTotal += dropped.length;
    all.push(...good);
  }
  if (outFile) {
    writeJsonAtomic(outFile, all);
    console.log(`=> ${outFile}: ${all.length} Objekte`);
  }
  else console.log(`(kein --out angegeben; insgesamt ${all.length} Objekte ladbar)`);
  return droppedTotal > 0 ? 1 : 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { quoteRepair, extractObjects, load, scanObjects, validateArrayWrapper };
