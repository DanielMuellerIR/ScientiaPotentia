/**
 * Kürzung von Urhebernachweisen aus Commons-Metadaten.
 *
 * Hintergrund (CodeQA 2026-09-03): Alle fünf Bild-Auflöser schnitten die
 * Urheberangabe mit `slice(0, 200)` hart ab — mitten im Wort und mitten in
 * einer URL. Gemessen waren 56 Rohdatensätze exakt 200 Zeichen lang und 112
 * veröffentlichte Nachweise ≥ 195 Zeichen, mit Endstücken wie
 * „… Canadian Space Agency (https://www.asc-c". Bei CC-BY und CC-BY-SA ist ein
 * Namensfragment keine korrekte Namensnennung.
 *
 * Diese Fassung kürzt an der letzten Wortgrenze und markiert den Schnitt mit
 * einem Auslassungszeichen, damit sichtbar bleibt, dass der Nachweis
 * unvollständig ist. Die vollständige Angabe steht weiterhin auf der
 * verlinkten Commons-Dateiseite.
 */

/** Höchstlänge eines Urhebernachweises. Darüber wird an der Wortgrenze gekürzt. */
const MAX_CREDIT_LENGTH = 200;

/**
 * Kürzt einen Urhebernachweis auf höchstens `limit` Zeichen, ohne ein Wort zu
 * zerschneiden. Passt der Text, kommt er unverändert zurück.
 *
 * @param {string} value  Urhebertext aus den Commons-Metadaten.
 * @param {number} [limit]  Höchstlänge einschließlich Auslassungszeichen.
 * @returns {string}
 */
function truncateCredit(value, limit = MAX_CREDIT_LENGTH) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  // Platz für das Auslassungszeichen freihalten und an der letzten Wort- oder
  // Trennzeichengrenze davor schneiden.
  const room = limit - 2;
  const cut = text.slice(0, room);
  const boundary = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('/'), cut.lastIndexOf(';'));
  const head = boundary > room / 2 ? cut.slice(0, boundary) : cut;
  return `${head.replace(/[\s/;,·-]+$/, '')} …`;
}

/**
 * Urhebernachweis aus den Commons-Metadaten einer Datei.
 *
 * Commons fuehrt die Namensnennung in zwei Feldern: `Artist` (Urheber) und
 * `Credit` (Quelle/Fundstelle). Viele freie Dateien fuellen nur eines davon.
 * Der gebuendelte Aufloeser las bis 2026-09-04 ausschliesslich `Artist` — ein
 * Datensatz mit Nachweis nur in `Credit` kam ohne Urhebertext an und wurde
 * danach still verworfen, obwohl seine Lizenz akzeptiert war.
 *
 * Rueckgabe ist der bereinigte, auf {@link MAX_CREDIT_LENGTH} gekuerzte Text.
 * Fehlen beide Felder, kommt der leere String zurueck; ob daraus ein Verwurf
 * oder ein Ersatztext wie „Wikimedia Commons" wird, entscheidet der Aufrufer.
 *
 * @param {object} metadata  extmetadata-Block aus der Commons-imageinfo-Antwort.
 * @returns {string}
 */
function commonsAttribution(metadata) {
  const feld = (name) => String(metadata?.[name]?.value ?? '')
    // Zeilenumbrueche zuerst, und zwar mit Ersatzzeichen: Commons trennt
    // mehrere Urheber in `Artist` haeufig mit <br />. Faellt das Tag ersatzlos
    // weg, entsteht ein Name, den es nicht gibt — aus "Scott Anttila<br />
    // Anttler" wurde "Scott AnttilaAnttler" (so im Bestand bei
    // astra:leo-i-zwerggalaxie). Bei CC-BY ist das keine Namensnennung mehr.
    // src/utils/imageCredits.js macht dieselbe Ersetzung fuer die Anzeige; hier
    // greift sie an der Quelle, bevor der Text in die Rohdaten wandert.
    .replace(/<br\s*\/?\s*>/gi, ' / ')
    .replace(/<[^>]+>/g, '')     // uebriges HTML (Links, <span>)
    .replace(/\s+/g, ' ')
    // Ein <br> am Textende hinterlaesst ein leeres Segment. Geteilt wird an
    // genau dem Trenner, den die Zeile darueber selbst einsetzt — mit
    // Leerzeichen. Eine Regex auf blosse Schraegstriche waere hier falsch: Sie
    // trifft auch das "//" in einer Adresse und den Schraegstrich am Ende eines
    // Quelllinks (Review-Fund 2026-09-10).
    .split(' / ').map((teil) => teil.trim()).filter(Boolean)
    .join(' / ');
  return truncateCredit([feld('Artist'), feld('Credit')].filter(Boolean).join(' / '));
}

module.exports = { MAX_CREDIT_LENGTH, commonsAttribution, truncateCredit };
