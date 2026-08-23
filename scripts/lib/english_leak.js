// Englische Warnwörter nur als vollständige Unicode-Wörter erkennen. JavaScripts
// \b kennt ausschließlich ASCII-Wortzeichen und würde sonst etwa "the" in
// griechischem "theós" fälschlich als englisches Wort melden.
function englishWordPattern(words) {
  return new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${words.join('|')})(?![\\p{L}\\p{N}])`,
    'iu'
  );
}

export const ENGLISH_LEAK_BY_DOMAIN = {
  astra: englishWordPattern(['the', 'moon', 'star', 'distance', 'diameter', 'orbit', 'galaxy']),
  // "organ" NICHT aufnehmen: deutsches Wort "Organ" ist identisch (kein Leak).
  homo: englishWordPattern(['the', 'bone', 'muscle', 'weight', 'blood']),
  natura: englishWordPattern(['the', 'animal', 'plant', 'weight', 'length', 'species']),
  // Sprachnamen, Werktitel und Fachbegriffe werden über gezielte Patterns statt
  // eines pauschalen Opt-outs geprüft. So bleiben legitime Eigennamen erlaubt.
  lingua: englishWordPattern(['the', 'is', 'are', 'spoken', 'language', 'word', 'meaning']),
  cultura: englishWordPattern(['the', 'is', 'are', 'painted', 'written', 'novel', 'poem']),
  // Machina: etablierte englische Fachwörter wie HTTP oder Python bleiben
  // erlaubt; ganze englische Satzreste nicht.
  machina: englishWordPattern(['the', 'is', 'are', 'with', 'from', 'used', 'written', 'language']),
  // Historia: Namen bleiben frei, englische Satzreste nicht.
  historia: englishWordPattern(['the', 'is', 'are', 'invented', 'written']),
};

export function hasEnglishLeak(domain, prompt) {
  const pattern = domain in ENGLISH_LEAK_BY_DOMAIN
    ? ENGLISH_LEAK_BY_DOMAIN[domain]
    : ENGLISH_LEAK_BY_DOMAIN.astra;
  return pattern.test(prompt);
}
