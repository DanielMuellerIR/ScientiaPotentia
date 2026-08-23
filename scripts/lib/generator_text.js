/**
 * Geteilte Text-Helfer der Domain-Generatoren.
 *
 * Diese Funktionen existierten zuvor als lokale Kopien in allen 7 Domain-
 * Generatoren (generate_astra/homo/natura/lingua/cultura/machina/historia.js)
 * und waren teils auseinandergedriftet — ein Bugfix musste 7× nachgezogen
 * werden. Hier zusammengeführt (2026-07-12):
 *   - norm/deNum waren byte-identisch in allen 7 Generatoren.
 *   - revealsAnswer gab es in zwei semantischen Varianten (Basis + verschärft,
 *     siehe unten) plus einer anatomie-spezifischen Sonderform, die bewusst
 *     lokal in generate_homo.js bleibt (Komposita-Stämme wie „Kaumuskel").
 */

/**
 * Normalisiert einen String für Vergleiche: Kleinschreibung, Umlaute
 * vereinfacht (ä->a usw.), alles Nicht-Alphanumerische zu Leerzeichen.
 */
export function norm(s) {
  return String(s ?? '').toLowerCase()
    .replace(/ß/g, 'ss').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Formatiert eine Zahl im deutschen Zahlformat (Punkt-Tausender, Komma-Dezimal). */
export function deNum(value) {
  if (typeof value !== 'number') value = Number(value);
  if (!isFinite(value)) return String(value);
  return value.toLocaleString('de-DE', { maximumFractionDigits: 4 });
}

/**
 * Vergleichsschlüssel für Antwortoptionen. Bei Orts- und Herkunftsangaben
 * ändert die Reihenfolge kommaseparierter Bestandteile die Bedeutung nicht
 * ("Rom, Galleria Borghese" = "Galleria Borghese, Rom"). Umlaute und
 * Satzzeichen sind ebenfalls keine eigenständigen Antwortunterschiede.
 */
export function optionKey(value) {
  const raw = String(value ?? '');
  const parts = raw.split(',').map(part => norm(part)).filter(Boolean);
  return parts.length > 1 ? parts.sort().join(',') : norm(raw);
}

/** Bewahrt die erste Schreibweise jeder semantisch gleichen Option. */
export function distinctOptionValues(values) {
  const seen = new Set();
  return values.map(String).filter(value => {
    const key = optionKey(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Selbstverräter-Basis-Check: Steht die Antwort (oder ein markantes
 * Antwort-Wort) schon im Fragetext/Konzeptnamen? Genutzt von Astra/Lingua.
 *
 * Prüft: ganze Antwort im Hinweis, ganzer Hinweis in der Antwort, sowie
 * Antwort-Tokens >= 4 Zeichen im Hinweis (Mindestlänge, damit generische
 * Stämme wie „Galaxie" in „Spiralgalaxie" nicht fälschlich anschlagen).
 */
export function revealsAnswer(subject, answer) {
  const S = norm(subject), A = norm(answer);
  const sNo = S.replace(/ /g, ''), aNo = A.replace(/ /g, '');
  if (!sNo || !aNo) return false;
  if (aNo.length >= 3 && sNo.includes(aNo)) return true;
  if (sNo.length >= 3 && aNo.includes(sNo)) return true;
  for (const t of A.split(' ').filter(t => t.length >= 4)) if (sNo.includes(t)) return true;
  return false;
}

/**
 * Verschärfter Selbstverräter-Check (Cultura/Historia/Machina/Natura):
 * fängt zusätzlich Stamm-/Kompositum-Leaks, die der reine
 * Token-im-Hinweis-Test verpasst.
 */
export function revealsAnswerStrict(subject, answer) {
  const S = norm(subject), A = norm(answer);
  const sNo = S.replace(/ /g, ''), aNo = A.replace(/ /g, '');
  if (!sNo || !aNo) return false;
  if (aNo.length >= 3 && sNo.includes(aNo)) return true;
  if (sNo.length >= 3 && aNo.includes(sNo)) return true;
  const sTokens = S.split(' ').filter(t => t.length >= 4);
  const aTokens = A.split(' ').filter(t => t.length >= 4);
  // Antwort-Token im Fragetext (volle Antwort inkl. Klammern).
  for (const t of aTokens) if (sNo.includes(t)) return true;
  // Für die verschärften Checks (a, b) zählt nur der Antwort-Kern OHNE
  // Klammerzusätze: "Homer (zugeschrieben)" darf nicht am Frageverb "schrieb"
  // scheitern — die Klammer ist Quellen-Notiz, kein abgefragter Inhalt.
  const ACore = norm(String(answer).replace(/\([^)]*\)/g, ' '));
  const aCoreNo = ACore.replace(/ /g, '');
  const aCoreTokens = ACore.split(' ').filter(t => t.length >= 4);
  // a) Fragetext-Token in der Antwort. Mindestlänge 5, sonst schlägt das
  //    Frage-Wort "Land" auf "DeutschLAND"/"GriechenLAND" an (kein Verrat).
  for (const t of sTokens) if (t.length >= 5 && aCoreNo.includes(t)) return true;
  // b) gemeinsamer Wortanfang (Stamm-Heuristik gegen Übersetzungs-/Ableitungs-Leaks).
  for (const st of sTokens) for (const at of aCoreTokens) {
    if (st.slice(0, 4) === at.slice(0, 4)) return true;
  }
  return false;
}
