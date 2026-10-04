import { createRequire } from 'node:module';
import { hasPublishableAttribution, isAllowedImageLicense } from '../../src/utils/imageCredits.js';

const require = createRequire(import.meta.url);
const { isRejectedImageMapping } = require('../data_sources/harvest/image_resolution_policy.cjs');

/**
 * Bildfelder eines bestehenden Konzepts aus einer Erntedatei auffrischen.
 *
 * Die Merge-Skripte laufen mehrfach: erst mit den Konzepten, spaeter erneut,
 * wenn die Bild-Aufloeser fertig sind. Beim zweiten Lauf trifft die Ernte auf
 * einen Bestand, der inzwischen die NACHBEREINIGTEN Nachweise traegt — ohne
 * mehrzeiligen Commons-Rechtehinweis, mit zusammengezogenem Whitespace, mit
 * korrektem "&" statt "&amp;". Die Ernte traegt weiterhin den rohen Text.
 *
 * Deshalb die Unterscheidung: Ein anderes Bild bringt seinen eigenen Nachweis
 * mit — Lizenz und Urheber gehoeren dann zwingend dazu, sonst stuende die
 * Namensnennung eines fremden Bildes daneben. Dieselbe Datei dagegen behaelt
 * ihren bereinigten Nachweis; ergaenzt wird nur, was im Bestand ganz fehlt.
 *
 * Gemessen am 2026-09-10: Ohne diese Unterscheidung haette ein erneuter
 * merge_astra-Lauf sechs Nachweise verschlechtert, darunter
 * "J.Warren &amp; J.Hughes" statt "J.Warren & J.Hughes" und abgeschnittene
 * Quelllinks.
 *
 * @param {object} bestand  Konzept aus der Roh-Datei; wird an Ort und Stelle geaendert.
 * @param {object} ernte    Konzept aus der Erntedatei.
 * @returns {string[]} Namen der tatsaechlich geaenderten Felder, fuer den Bericht.
 */
export function refreshImageFields(bestand, ernte) {
  if (ernte.imageFile && isRejectedImageMapping(bestand.id || ernte.id, ernte.imageFile)) return [];
  const geaendert = [];
  const setze = (feld, wert) => {
    if (bestand[feld] === wert) return;
    bestand[feld] = wert;
    geaendert.push(feld);
  };

  if (ernte.imageFile && ernte.imageFile !== bestand.imageFile) {
    if (!ernte.imageLicense || !isAllowedImageLicense(ernte.imageLicense)
      || !hasPublishableAttribution(ernte.imageLicense, ernte.imageAttribution)) return [];
    setze('imageFile', ernte.imageFile);
    if (ernte.imageLicense) setze('imageLicense', ernte.imageLicense);
    setze('imageAttribution', ernte.imageAttribution || '');
    for (const field of ['imageLicenseUrl', 'imageChanges']) {
      if (ernte[field] !== undefined || bestand[field] !== undefined) setze(field, ernte[field] || '');
    }
  } else {
    if (!bestand.imageLicense && ernte.imageLicense) setze('imageLicense', ernte.imageLicense);
    if (!bestand.imageAttribution && ernte.imageAttribution) {
      setze('imageAttribution', ernte.imageAttribution);
    }
  }

  if (ernte._imgProblem !== undefined) setze('_imgProblem', ernte._imgProblem);
  return geaendert;
}
