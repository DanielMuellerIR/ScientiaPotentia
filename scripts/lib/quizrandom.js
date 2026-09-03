/**
 * Gemeinsame Helfer für faire Distraktor-Auswahl in allen Domain-Generatoren.
 *
 * Hintergrund (Bug, gefunden 2026-06-24 per Längen-Audit + Selbstverräter-Workflow):
 *
 * 1. LÄNGEN-BIAS bei Text-Distraktoren: Die Picker nahmen via `.slice(0, k)`
 *    IMMER die ersten k Pool-Einträge in Datei-Reihenfolge als Distraktoren.
 *    Standen diese festen Distraktoren systematisch kürzer/länger als die jeweils
 *    richtige Antwort, war die richtige Antwort fast immer die längste/kürzeste
 *    Option — ein Spieler ohne Wissen konnte „die längste Antwort" raten und lag
 *    weit über 25 %. `seededShuffle` mischt die Kandidaten je Frage reproduzierbar
 *    (Seed = die richtige Antwort), sodass die richtige Antwort im Mittel auf einer
 *    zufälligen Längenposition liegt (~25 % statt ~90 %). Reproduzierbar = stabile
 *    Git-Diffs der generierten Artefakte über Läufe hinweg.
 *
 * 2. NUMERIK-PARSE: astra/homo sortierten Distraktoren über `Number(formatierter
 *    String)`. Bei einheitsbehafteten Werten („4,5 mag", „300 g", „2.500.000
 *    Lichtjahre") ist `Number(...)` = NaN → die Nachbarwert-Sortierung verpuffte
 *    und fiel ebenfalls auf die ersten drei Pool-Einträge zurück (bei
 *    astra-star-magnitude domainweit Sonne/Sirius/Beteigeuze als absurde Fix-
 *    Distraktoren). `deParse` zieht die Zahl robust aus dem deutschen Zahlformat
 *    (Punkt = Tausender, Komma = Dezimal), damit die wertnächsten Distraktoren
 *    wirklich nach Wert gewählt werden.
 */

/** Deterministischer Pseudo-Zufall (mulberry32) aus einem String-Seed. */
export function makeRng(seedStr) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  let s = h >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Reproduzierbar gemischte Kopie von `arr` (Fisher-Yates mit Seed). */
export function seededShuffle(arr, seedStr) {
  const rng = makeRng(String(seedStr));
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Wählt k Text-Distraktoren aus `candidates` (bereits gefiltert, ohne die
 * richtige Antwort, ohne Dubletten). Bevorzugt Kandidaten mit ähnlicher LÄNGE
 * wie die richtige Antwort.
 *
 * Warum nicht nur mischen: Reines seeded-Mischen beseitigt den „immer dieselben
 * ersten Pool-Einträge"-Bias, lässt aber bei KLEINEN Vokabularen einen Rest-Tell
 * übrig — häufige richtige Werte (z.B. Tierklasse „Vögel", Paradigma „imperativ")
 * sind oft kürzer als der restliche Wortschatz, also wäre die richtige Antwort
 * überzufällig die kürzeste Option. Length-Balancing rückt die richtige Antwort
 * in die Mitte der Längenverteilung der vier Optionen, sodass weder „längste"
 * noch „kürzeste raten" überdurchschnittlich trifft. Standard-Seed ist die
 * richtige Antwort; Generatoren dürfen für mehrere Fragen mit derselben Antwort
 * zusätzlich eine stabile Fragen-ID übergeben.
 *
 * Warum verzerrt ziehen statt „die k längennächsten nehmen" (CodeQA
 * 2026-09-03): Der harte Schnitt war eine totale Ordnung über den Pool. Ein
 * Wert, dessen Länge von der jeweils richtigen Antwort weit abwich, kam damit
 * NIE unter die k Nächsten — er erschien im ganzen Katalog nur noch als
 * richtige Antwort. Gemessen waren das 31 Fragetypen und 832 Fragen, darunter
 * „Schlangen" (206 von 206), „USA" (102 von 102) und „Australien und Ozeanien"
 * (65 von 65): Wer diese Option sah, konnte sie ohne jedes Wissen anklicken.
 * Nach dem Umbau sind es 6 Typen und 76 Fragen, und zwar dort, wo der Pool zu
 * klein für eine andere Wahl ist.
 *
 * Der zweite Teil des Fehlers saß im Seed: Ohne eigene Fragen-ID ist er die
 * richtige Antwort, dann bekommen ALLE Fragen mit derselben Antwort dieselben
 * Distraktoren. Terra übergab als einziger Generator eine Fragen-ID — und war
 * als einziger nicht betroffen. Alle Generatoren reichen jetzt die Konzept-ID
 * durch.
 */
export function pickBalanced(correct, candidates, k = 3, seed = String(correct)) {
  const cLen = String(correct).length;
  const shuffled = seededShuffle(candidates, seed);
  // stabiler Sort nach Längen-Nähe; das Vor-Mischen randomisiert Gleichstände.
  shuffled.sort((a, b) => Math.abs(String(a).length - cLen) - Math.abs(String(b).length - cLen));
  // Verzerrte Ziehung statt `slice(0, k)`: `rng() ** 5` zieht den Index stark
  // nach vorne, lässt aber jeden Kandidaten zum Zug kommen. Der harte Schnitt
  // war eine totale Ordnung — ein Wert, dessen Länge von der jeweils richtigen
  // Antwort weit abwich, kam nie unter die k Nächsten und erschien im Katalog
  // nur noch als richtige Antwort (CodeQA 2026-09-03).
  const rng = makeRng(`${seed}|balance`);
  const picked = [];
  while (picked.length < k && shuffled.length) {
    picked.push(shuffled.splice(Math.floor(shuffled.length * rng() ** 5), 1)[0]);
  }

  // Nachbesserung genau gegen den Effekt, den diese Funktion verhindern soll:
  // Ist die richtige Antwort als EINZIGE die längste (oder kürzeste) der vier
  // Optionen, tausche den am weitesten entfernten Distraktor gegen einen
  // Kandidaten, der das aufhebt. Gibt es keinen, bleibt es wie gezogen — dann
  // gibt der Bestand es nicht her. Die verzerrte Ziehung sorgt für Vielfalt,
  // diese Korrektur für die Längenlage.
  const len = value => String(value).length;
  const isLongest = picked.length === k && picked.every(value => len(value) < cLen);
  const isShortest = picked.length === k && picked.every(value => len(value) > cLen);
  if (isLongest || isShortest) {
    const fits = value => (isLongest ? len(value) >= cLen : len(value) <= cLen);
    const replacement = shuffled.find(fits);
    if (replacement !== undefined) {
      // Den unpassendsten Distraktor ersetzen, nicht einen beliebigen.
      let worst = 0;
      for (let i = 1; i < picked.length; i++) {
        if (Math.abs(len(picked[i]) - cLen) > Math.abs(len(picked[worst]) - cLen)) worst = i;
      }
      picked[worst] = replacement;
    }
  }
  return picked;
}

/**
 * Numerische Distraktoren nach der Standardregel der Domain-Generatoren:
 * Streut das Maß über mindestens zwei Größenordnungen, werden die Distraktoren
 * proportional gestreut, sonst sind es die wertnächsten Nachbarn.
 *
 * Die drei Zeilen standen in generate_natura.js, generate_lingua.js und
 * generate_cultura.js wortgleich ausgeschrieben (CodeQA 2026-09-03). Hier
 * stehen sie einmal, damit eine Änderung an der Regel nicht an zwei Stellen
 * hängen bleibt. generate_homo.js und generate_astra.js rufen dieselben beiden
 * Funktionen, fallen aber bewusst auf einen anderen Weg zurück
 * (pickDistractors bzw. eine eigene Nachbarwert-Sortierung) und bleiben darum
 * eigenständig.
 */
export function numericDistractors(value, pool, format, { attribute, seed }) {
  return (shouldMagnitudeSpread(value, pool, attribute)
    && magnitudeSpreadDistractors(value, pool, format, { seed }))
    || pickNumeric(value, pool, format);
}

/**
 * Zieht die erste Zahl aus einem deutsch formatierten Wert-String.
 *   „2.500.000 Lichtjahre" -> 2500000   (Punkt = Tausendertrenner)
 *   „4,5 mag" -> 4.5                     (Komma = Dezimaltrenner)
 *   „-26,74"  -> -26.74
 *   „300 g"   -> 300
 * Gibt NaN zurück, wenn keine Zahl gefunden wird.
 */
export function deParse(value) {
  const m = String(value).match(/-?\d[\d.]*(?:,\d+)?/);
  if (!m) return NaN;
  return parseFloat(m[0].replace(/\./g, '').replace(',', '.'));
}

// ---------------------------------------------------------------------------
// GRÖSSENORDNUNGS-DISTRAKTOREN (Magnitude-Spread, Nutzerwunsch 2026-06-25)
//
// Problem: Bei numerischen Fragen mit eng gehäuften Nachbarwert-Distraktoren
// (z.B. Schlangenlänge „59/60/63/65 cm") braucht man Maschinen-Präzision statt
// Größenordnungs-Gespür — eine ungefähre Ahnung hilft nicht. Fairer ist eine
// Streuung über Größenordnungen: EIN Distraktor ~eine Größenordnung kleiner,
// EINER ~eine Größenordnung größer, EINER mäßig nah (gleiche Größenordnung,
// aber klar verschieden). Wer die Größenordnung kennt, schließt die zwei
// Ausreißer aus und steht vor einer fairen 50:50-Entscheidung.
//
// Var-B (vom Nutzer gewählt): Es werden ECHTE Pool-Werte gewählt (Werte, die
// ein anderes Konzept derselben Kategorie wirklich hat), nicht erfundene Zahlen.
// Das hält die Distraktoren „in der Welt" und vermeidet absurde Out-of-Range-
// Werte an den Rändern (ein ×10 des größten Werts existiert schlicht nicht im
// Pool -> es wird der nächste reale Wert in Log-Distanz genommen).
//
// Anwendung NUR, wenn die Werte echte, über Größenordnungen streuende Maße sind
// (Längen, Gewichte, Distanzen, Höhen, Flächen, Zählungen). NICHT bei
// Jahreszahlen, beschränkten Skalen (Mohshärte, scheinbare Sternhelligkeit) oder
// Identifikatoren (Ports) — die werden über shouldMagnitudeSpread ausgeschlossen.
// ---------------------------------------------------------------------------

// Attribute, die zwar rechnerisch ≥2 Größenordnungen streuen, aber KEINE
// magnitude-skalierbaren Maße sind (Identifikatoren / beschränkte bzw.
// logarithmische Skalen / kleine Index-Zählungen). Sie bleiben auf Nachbarwert.
const MAGNITUDE_EXCLUDE_ATTRS = new Set([
  'defaultPort',         // Netzwerk-Port = Identifikator, kein Maß
  'apparentMagnitude',   // scheinbare Helligkeit = logarithmische, beschränkte Skala
  'numMoons',            // kleine Index-Zählung (Mond-Anzahl)
  'messierNumber',       // Katalognummer = Identifikator
  'orderFromSun'         // Ordinalzahl
]);

/**
 * Entscheidet, ob für ein numerisches Attribut Größenordnungs-Distraktoren statt
 * Nachbarwerte fair sind. Kriterien: positiver Wertebereich, Pool spannt ≥100×
 * (zwei Größenordnungen), genügend distinkte Werte, nicht ausgeschlossen.
 */
export function shouldMagnitudeSpread(correctNum, poolNums, attr) {
  if (MAGNITUDE_EXCLUDE_ATTRS.has(attr)) return false;
  if (!(typeof correctNum === 'number' && isFinite(correctNum) && correctNum > 0)) return false;
  const pos = [...new Set(poolNums)].filter(n => typeof n === 'number' && isFinite(n) && n > 0);
  if (pos.length < 6) return false;          // zu kleiner Pool -> Nachbarwert
  const ratio = Math.max(...pos) / Math.min(...pos);
  return ratio >= 100;                       // ≥ 2 Größenordnungen Spannweite
}

/**
 * Größenordnungs-Distraktoren aus ECHTEN Pool-Werten (Var-B).
 * Wählt für drei Log-Ziele (≈ correct/10, ein mäßig naher Wert, ≈ correct×10)
 * jeweils den im Log-Abstand nächstgelegenen, noch ungenutzten realen Pool-Wert
 * und formatiert ihn. Liefert `null`, wenn keine 3 distinkten Distraktoren
 * zustande kommen (dann nutzt der Aufrufer seinen bestehenden Fallback).
 *
 * Der „mäßig nahe" Wert liegt seed-abhängig mal unter, mal über dem korrekten
 * Wert (Faktor ~0,5× oder ~1,8×), damit die richtige Antwort nicht systematisch
 * die obere/untere der beiden nahen Optionen ist.
 *
 * @param format  (value, ctx) => string — dieselbe Formatfunktion wie für die
 *                richtige Antwort, damit das Format nichts verrät.
 */
export function magnitudeSpreadDistractors(correctNum, poolNums, format, opts = {}) {
  const { seed = String(correctNum), ctx = null, k = 3 } = opts;
  const pool = [...new Set(poolNums)]
    .filter(n => typeof n === 'number' && isFinite(n) && n > 0 && n !== correctNum);
  if (pool.length < k) return null;

  // Seite des mäßig nahen Distraktors aus dem Seed bestimmen (unter/über).
  const rng = makeRng(String(seed));
  const moderateFactor = rng() < 0.5
    ? (0.45 + rng() * 0.15)   // ~0,45–0,60×  (deutlich kleiner, gleiche Größenordnung)
    : (1.7 + rng() * 0.6);    // ~1,7–2,3×    (deutlich größer, gleiche Größenordnung)
  // Reihenfolge: klein (÷10), groß (×10), mäßig nah. Klein+groß zuerst sichern.
  const targets = [correctNum * 0.1, correctNum * 10, correctNum * moderateFactor];

  const usedNums = new Set();
  const usedStr = new Set([String(format(correctNum, ctx))]);
  const out = [];
  for (const target of targets) {
    if (out.length >= k) break;
    const logT = Math.log(target);
    // realer Pool-Wert mit minimalem Log-Abstand zum Ziel, noch ungenutzt
    const cand = pool
      .filter(n => !usedNums.has(n))
      .sort((a, b) => Math.abs(Math.log(a) - logT) - Math.abs(Math.log(b) - logT))[0];
    if (cand === undefined) continue;
    const str = String(format(cand, ctx));
    if (usedStr.has(str)) { usedNums.add(cand); continue; } // Format-Dublette -> nächstes Ziel
    usedNums.add(cand); usedStr.add(str); out.push(str);
  }
  // Falls ein Ziel keinen frischen Wert lieferte: mit weiteren Pool-Werten auffüllen,
  // bevorzugt log-weit vom korrekten Wert entfernt (erhält den Spreiz-Charakter).
  if (out.length < k) {
    const logC = Math.log(correctNum);
    const rest = pool
      .filter(n => !usedNums.has(n))
      .sort((a, b) => Math.abs(Math.log(b) - logC) - Math.abs(Math.log(a) - logC));
    for (const n of rest) {
      if (out.length >= k) break;
      const str = String(format(n, ctx));
      if (usedStr.has(str)) continue;
      usedStr.add(str); out.push(str);
    }
  }
  return out.length >= k ? out : null;
}

// Relative Nähe, ab der zwei kontinuierliche Messwerte als "dieselbe Messung" gelten.
const RELATIVE_DUP = 0.01; // 1 %

/**
 * k numerische Distraktoren: die dem korrekten Wert NÄCHSTLIEGENDEN Zahlen aus dem
 * Pool (am verwechselbarsten), danach mit dem Template formatiert.
 *
 * Proximity-Guard (QA-Fund 2026-07-01): Bei kontinuierlichen MESSGRÖSSEN (nicht-
 * ganzzahliger Korrektwert, z.B. 0,63 m Bildbreite oder Magnitude 4,2) werden
 * Distraktoren verworfen, die < RELATIVE_DUP vom Korrektwert entfernt sind — sie
 * stellen faktisch dieselbe Messung dar (0,633 ≈ 0,63) und wären eine zweite richtige
 * Antwort. GANZZAHLIGE Korrektwerte (Jahre, Ports, Zähler, Katalog-Durchmesser) sind
 * bewusst AUSGENOMMEN: dort sind Nachbarwerte distinkte, legitime Antworten
 * (1872 ≠ 1873). Frühere Version (in jedem Generator dupliziert) hatte keinen Guard.
 */
export function pickNumeric(correctNum, poolNums, format, k = 3) {
  const guardProximity = !Number.isInteger(correctNum) && correctNum !== 0;
  const unique = [...new Set(poolNums)].filter(n => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return false;
    if (n === correctNum) return false;
    if (guardProximity && Math.abs(n - correctNum) / Math.abs(correctNum) < RELATIVE_DUP) return false;
    return true;
  });
  unique.sort((a, b) => Math.abs(a - correctNum) - Math.abs(b - correctNum));

  // Unterschiedliche Rohwerte können nach Rundung dieselbe sichtbare Option
  // ergeben. Die richtige Antwort und bereits gewählte Distraktoren deshalb
  // erst nach derselben Formatierung vergleichen, die auch die Frage nutzt.
  const seen = new Set([String(format(correctNum))]);
  const picked = [];
  for (const value of unique) {
    const formatted = String(format(value));
    if (seen.has(formatted)) continue;
    seen.add(formatted);
    picked.push(formatted);
    if (picked.length === k) break;
  }
  return picked;
}
