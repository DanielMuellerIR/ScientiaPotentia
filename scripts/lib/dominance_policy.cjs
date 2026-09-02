// Freigegebene Dominanz je Fragetyp — Ausnahmeliste des Fragen-Audits.
//
// Hintergrund: Ist bei einem Fragetyp dieselbe Lösung in mindestens der Hälfte
// aller Fälle richtig, gewinnt schon das bloße Raten dieser einen Antwort. Der
// Audit meldete das bisher nur als Hinweis; ein solcher Typ konnte trotzdem
// veröffentlicht werden. Jetzt blockiert jeder dominante Typ den Lauf, sofern
// er nicht hier mit Begründung und Obergrenze steht.
//
// Zwei Arten von Dominanz sind zu unterscheiden:
//
//   1. Sachliche Dominanz — die Welt ist schief verteilt. Die meisten Schriften
//      laufen von links nach rechts, die IUCN stuft die Mehrheit der Arten als
//      nicht gefährdet ein. Solche Fragen bleiben richtig und lehrreich; hier
//      etwas „auszugleichen" hieße, den Bestand zu verfälschen.
//   2. Bestandsdominanz — nicht die Welt, sondern die eigene Auswahl ist schief
//      (etwa der englischsprachig geprägte Genre-Bestand in Cultura). Solche
//      Einträge tragen unten einen Hinweis auf die inhaltliche Restarbeit.
//
// `maxShare` ist die zugestandene Obergrenze in Prozent, knapp über dem bei der
// Freigabe gemessenen Wert. Steigt der Anteil darüber, blockiert der Audit
// wieder — dann hat sich der Bestand verschoben und die Freigabe ist neu zu
// prüfen. Ein hier nicht gelisteter dominanter Typ blockiert immer.
//
// Stand der Messung: 2026-09-02.

const ACCEPTED_DOMINANCE = {
  // --- sachliche Dominanz ---------------------------------------------------
  'astra-planet-type': {
    maxShare: 55,
    reason: 'Das Sonnensystem hat acht Planeten, vier davon Gesteinsplaneten.',
  },
  'astra-dwarf-location': {
    maxShare: 75,
    reason: 'Die meisten anerkannten Zwergplaneten liegen im Kuipergürtel.',
  },
  'astra-galaxy-type': {
    maxShare: 60,
    reason: 'Spiralgalaxien stellen die Mehrheit der katalogisierten hellen Galaxien.',
  },
  'astra-exo-discovery-method': {
    maxShare: 66,
    reason: 'Die Transitmethode hat mit Kepler und TESS die meisten bekannten '
      + 'Exoplaneten geliefert.',
  },
  'cultura-artwork-medium': {
    maxShare: 63,
    reason: 'Öl auf Leinwand ist die vorherrschende Technik der abgebildeten Epochen.',
  },
  'homo-reflex-type': {
    maxShare: 75,
    reason: 'Der Bestand kennt nur Eigen- und Fremdreflex; Fremdreflexe überwiegen.',
  },
  'lingua-script-direction': {
    maxShare: 90,
    reason: 'Die große Mehrheit der lebenden Schriften läuft von links nach rechts.',
  },
  'lingua-language-script-type': {
    maxShare: 86,
    reason: 'Alphabete sind der weltweit häufigste Schrifttyp.',
  },
  'lingua-language-script': {
    maxShare: 71,
    reason: 'Das lateinische Alphabet ist die weltweit am häufigsten genutzte Schrift.',
  },
  'machina-protocol-layer': {
    maxShare: 86,
    reason: 'Benannte Netzprotokolle sitzen überwiegend in der Anwendungsschicht.',
  },
  'machina-protocol-transport': {
    maxShare: 63,
    reason: 'TCP trägt die Mehrzahl der erfassten Anwendungsprotokolle.',
  },
  'machina-engine-type': {
    maxShare: 86,
    reason: 'Unter den erfassten Maschinen überwiegen Verbrennungsmotoren.',
  },
  'natura-animal-status': {
    maxShare: 72,
    reason: 'Die IUCN stuft die Mehrheit der bewerteten Arten als nicht gefährdet ein.',
  },
  'natura-geology-volcanotype': {
    maxShare: 58,
    reason: 'Schichtvulkane stellen die Mehrheit der bekannten Vulkane.',
  },

  // --- Bestandsdominanz (inhaltliche Restarbeit, siehe BACKLOG.md) ----------
  'cultura-genrefic-language': {
    maxShare: 85,
    reason: 'Der Genre-Bestand ist englischsprachig geprägt. Abbau nur über einen '
      + 'breiteren, mehrsprachigen Werkbestand, nicht über andere Distraktoren.',
  },
  'lingua-language-official-countries': {
    maxShare: 56,
    reason: 'Der Sprachbestand führt überwiegend Sprachen mit wenigen '
      + 'Amtssprachenländern. Abbau nur über mehr Sprachen mit breiter Amtsgeltung.',
  },
  'natura-geology-typ': {
    maxShare: 55,
    reason: 'Kleine Kategorie mit zehn Fragen, in der Vulkane überwiegen. Abbau über '
      + 'weitere Geologieobjekte anderer Typen.',
  },
  'natura-fungus-essbarkeit': {
    maxShare: 63,
    reason: 'Der Pilzbestand ist auf bekannte Speisepilze ausgerichtet. Abbau über '
      + 'mehr ungenießbare und giftige Arten.',
  },
};

/**
 * Bewertet einen dominanten Fragetyp gegen die Freigabeliste.
 * Rückgabe: `{ accepted, maxShare, reason }` — `accepted: false` blockiert.
 */
function dominanceVerdict(type, topAnswerShare) {
  const entry = ACCEPTED_DOMINANCE[type];
  if (!entry) return { accepted: false, maxShare: null, reason: 'nicht freigegeben' };
  if (topAnswerShare > entry.maxShare) {
    return {
      accepted: false,
      maxShare: entry.maxShare,
      reason: `über der freigegebenen Obergrenze von ${entry.maxShare} %`,
    };
  }
  return { accepted: true, maxShare: entry.maxShare, reason: entry.reason };
}

module.exports = { ACCEPTED_DOMINANCE, dominanceVerdict };
