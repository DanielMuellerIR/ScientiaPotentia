/**
 * Bricht einen Auflöserlauf ab, wenn die API ihn dauerhaft abweist.
 *
 * Alle Bild-Auflöser wiederholen eine abgewiesene Anfrage einige Male und geben
 * danach auf — leise. Für den Aufrufer sieht das aus wie „kein freies Bild",
 * und der Lauf macht mit dem nächsten Konzept weiter. Der vorhandene Wächter
 * gegen den Nulllauf greift erst am Ende. So lief `resolve_images_p18.cjs` am
 * 2026-09-03 zehn Minuten lang durch 60 Konzepte, ohne einen einzigen Treffer
 * und ohne eine einzige Warnung.
 *
 * Dieser Wächter zählt ausschließlich abgewiesene Anfragen in Folge. Eine
 * beantwortete Anfrage setzt die Zählung zurück — auch dann, wenn die Antwort
 * „kein Bild" lautet: Das ist ein Ergebnis, keine Störung.
 */

/** Nach so vielen Abweisungen in Folge gilt die Gegenstelle als gestört. */
const DEFAULT_LIMIT = 20;

/**
 * @param {object} options `limit` überschreibt die Schwelle, `label` benennt
 *   die Gegenstelle in der Fehlermeldung.
 * @returns {{ok: Function, rejected: Function, consecutive: number, total: number}}
 */
function createApiGuard({ limit = DEFAULT_LIMIT, label = 'Die API' } = {}) {
  let consecutive = 0;
  let total = 0;

  return {
    /** Meldet eine beantwortete Anfrage. */
    ok() {
      consecutive = 0;
    },

    /**
     * Meldet eine endgültig abgewiesene Anfrage.
     *
     * @param {string} [reason] Kurzer Grund für die Fehlermeldung.
     * @throws {Error} sobald `limit` Abweisungen in Folge erreicht sind.
     */
    rejected(reason = '') {
      consecutive += 1;
      total += 1;
      if (consecutive >= limit) {
        const detail = reason ? ` Zuletzt: ${reason}` : '';
        throw new Error(
          `${label} hat ${consecutive} Anfragen in Folge abgewiesen — Lauf abgebrochen, `
          + `damit er nicht stundenlang leere Ergebnisse schreibt.${detail}`,
        );
      }
    },

    /** Abweisungen in Folge, für Protokollzeilen. */
    get consecutive() {
      return consecutive;
    },

    /** Abweisungen insgesamt, für die Schlussbilanz. */
    get total() {
      return total;
    },
  };
}

module.exports = { createApiGuard, DEFAULT_LIMIT };
