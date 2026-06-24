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
 * noch „kürzeste raten" überdurchschnittlich trifft. Gleich-nahe Kandidaten
 * werden seeded gemischt (Variation + stabile Git-Diffs). Seed = richtige Antwort.
 */
export function pickBalanced(correct, candidates, k = 3) {
  const cLen = String(correct).length;
  const shuffled = seededShuffle(candidates, String(correct));
  // stabiler Sort nach Längen-Nähe; das Vor-Mischen randomisiert Gleichstände.
  shuffled.sort((a, b) => Math.abs(String(a).length - cLen) - Math.abs(String(b).length - cLen));
  return shuffled.slice(0, k);
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
