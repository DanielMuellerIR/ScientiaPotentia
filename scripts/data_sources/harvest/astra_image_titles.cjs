// Fachlich zugeordnete Astra-Lemmata; kein Rückfall auf geratenen Konzeptnamen.
const DEWIKI_MAP = {
  // Planeten (sourceUrl = NASA-Factsheet)
  "mercury":               "Merkur (Planet)",
  "venus":                 "Venus (Planet)",
  "earth":                 "Erde",
  "mars":                  "Mars (Planet)",
  "jupiter":               "Jupiter (Planet)",
  "saturn":                "Saturn (Planet)",
  "uranus":                "Uranus (Planet)",
  "neptune":               "Neptun (Planet)",

  // Zwergplaneten
  "pluto":                 "Pluto",
  "ceres":                 "Ceres (Zwergplanet)",
  "eris":                  "Eris (Zwergplanet)",
  "makemake":              "Makemake (Zwergplanet)",
  "haumea":                "Haumea (Zwergplanet)",
  "sedna":                 "(90377) Sedna",
  "quaoar":                "(50000) Quaoar",
  "orcus":                 "(90482) Orcus",
  "gonggong":              "Gonggong",

  // Monde — Erde + Mars
  "luna":                  "Mond",
  "phobos":                "Phobos (Mond)",
  "deimos":                "Deimos (Mond)",

  // Monde — Jupiter (mehrdeutige Namen, NASA-sourceUrl)
  "io":                    "Io (Mond)",
  "europa":                "Europa (Mond)",
  "ganymede":              "Ganymed (Mond)",
  "callisto":              "Kallisto (Mond)",
  "amalthea":              "Amalthea (Mond)",

  // Monde — Saturn (NASA-sourceUrl / Wikidata)
  "titan":                 "Titan (Mond)",
  "enceladus":             "Enceladus (Mond)",
  "rhea":                  "Rhea (Mond)",
  "mimas":                 "Mimas (Mond)",
  "iapetus":               "Iapetus (Mond)",
  "dione":                 "Dione (Mond)",
  "tethys":                "Tethys (Mond)",
  "hyperion":              "Hyperion (Mond)",
  "phoebe":                "Phoebe (Mond)",
  "epimetheus":            "Epimetheus (Mond)",
  "janus":                 "Janus (Mond)",
  "calypso":               "Calypso (Mond)",
  "telesto":               "Telesto (Mond)",
  "helene":                "Helene (Mond)",
  "prometheus-saturn":     "Prometheus (Mond)",
  "pandora-saturn":        "Pandora (Mond)",
  "albiorix":              "Albiorix (Mond)",
  "erriapus":              "Erriapus (Mond)",
  "ijiraq":                "Ijiraq (Mond)",
  "kiviuq":                "Kiviuq (Mond)",
  "paaliaq":               "Paaliaq (Mond)",
  "siarnaq":               "Siarnaq (Mond)",
  "tarvos":                "Tarvos (Mond)",
  "ymir":                  "Ymir (Mond)",

  // Monde — Uranus (en.wiki-sourceUrl, mehrdeutige Namen)
  "titania":               "Titania (Mond)",
  "oberon":                "Oberon (Mond)",
  "umbriel":               "Umbriel (Mond)",
  "ariel":                 "Ariel (Mond)",
  "miranda":               "Miranda (Mond)",
  "caliban":               "Caliban (Mond)",
  "sycorax":               "Sycorax (Mond)",
  "belinda":               "Belinda (Mond)",
  "bianca":                "Bianca (Mond)",
  "cordelia":              "Cordelia (Mond)",
  "cressida":              "Cressida (Mond)",
  "desdemona":             "Desdemona (Mond)",
  "mab":                   "Mab (Mond)",

  // Monde — Neptun
  "triton":                "Triton (Mond)",
  "nereid":                "Nereid",
  "proteus":               "Proteus (Mond)",
  "despina":               "Despina (Mond)",
  "larissa":               "Larissa (Mond)",
  "naiad":                 "Naiad (Mond)",
  "halimede":              "Halimede (Mond)",
  "laomedeia":             "Laomedeia",
  "neso":                  "Neso (Mond)",
  "psamathe":              "Psamathe (Mond)",
  "sao":                   "Sao (Mond)",

  // Monde — Pluto
  "charon":                "Charon (Mond)",
  "nix":                   "Nix (Mond)",
  "hydra":                 "Hydra (Mond)",
  "kerberos":              "Kerberos (Mond)",

  // Monde — Jupiter (Wikidata, kleine)
  "adrastea":              "Adrastea (Mond)",
  "ananke":                "Ananke (Mond)",
  "carme":                 "Carme (Mond)",
  "elara":                 "Elara (Mond)",
  "himalia":               "Himalia (Mond)",
  "lysithea":              "Lysithea (Mond)",

  // Galaxien (NASA/en.wiki-sourceUrl oder mehrdeutig)
  "milky_way":             "Milchstraße",
  "andromeda":             "Andromedagalaxie",
  "triangulum":            "Dreiecksgalaxie",
  "large_magellanic_cloud":"Große Magellansche Wolke",
  "small_magellanic_cloud":"Kleine Magellansche Wolke",
  "whirlpool":             "Whirlpool-Galaxie",
  "sombrero":              "Sombrerogalaxie",
  "bode_m81":              "Messier 81",
  "zigarren_m82":          "Messier 82",
  "centaurus_a":           "Centaurus A",
  "bildhauer_ngc253":      "Sculptor-Galaxie",
  "feuerrad_m101":         "Messier 101",
  "sonnenblume_m63":       "Messier 63",
  "schwarzauge_m64":       "Messier 64",
  "barnards-galaxie":      "Barnards Galaxie",
  "wagenradgalaxie":       "Wagenradgalaxie",
  "sculptor-galaxie":      "Sculptor-Galaxie",

  // Missionen (de.wikipedia-sourceUrl, kein explizites Mapping nötig, aber zur Sicherheit)
  // (werden über sourceUrl aufgelöst)
};

// Namen, die NICHT per Name-Fallback (Weg 5) gesucht werden sollen,
// weil sie zu sehr disambiguiert sind und das Mapping fehlt. Sicherheitsnetz.
const AMBIGUOUS_NAMES = new Set([
  "Europa", "Io", "Charon", "Ariel", "Miranda", "Oberon", "Titania",
  "Prometheus", "Pandora", "Helene", "Calypso", "Janus", "Mab",
  "Bianca", "Cressida", "Cordelia", "Larissa", "Naiad", "Proteus",
  "Despina", "Neso", "Sao", "Carme", "Elara", "Himalia",
]);


// Am 2026-09-30 gegen vorhandene Artikel, Einleitung und Objektidentität geprüft.
// Konkrete englische Artikel bleiben erhalten, wenn de auf ein ganzes Programm führt.
const ASTRA_WIKI_SOURCES = {
  "moon-skoll-h2": {
    "language": "de",
    "title": "Skoll (Mond)"
  },
  "moon-hyrrokkin-h2": {
    "language": "de",
    "title": "Hyrrokkin (Mond)"
  },
  "moon-bestla-h2": {
    "language": "de",
    "title": "Bestla (Mond)"
  },
  "moon-fenrir-h2": {
    "language": "de",
    "title": "Fenrir (Mond)"
  },
  "moon-bebhionn-h2": {
    "language": "de",
    "title": "Bebhionn (Mond)"
  },
  "moon-tarqeq-h2": {
    "language": "de",
    "title": "Tarqeq (Mond)"
  },
  "moon-greip-h2": {
    "language": "de",
    "title": "Greip (Mond)"
  },
  "moon-narvi-h2": {
    "language": "de",
    "title": "Narvi (Mond)"
  },
  "moon-aitne-h2": {
    "language": "de",
    "title": "Aitne (Mond)"
  },
  "moon-thyone-h2": {
    "language": "de",
    "title": "Thyone (Mond)"
  },
  "moon-harpalyke-h2": {
    "language": "de",
    "title": "Harpalyke (Mond)"
  },
  "moon-kalyke-h2": {
    "language": "de",
    "title": "Kalyke (Mond)"
  },
  "moon-iocaste-h2": {
    "language": "de",
    "title": "Iocaste (Mond)"
  },
  "moon-erinome-h2": {
    "language": "de",
    "title": "Erinome (Mond)"
  },
  "moon-autonoe-h2": {
    "language": "de",
    "title": "Autonoe (Mond)"
  },
  "moon-valetudo-h2": {
    "language": "de",
    "title": "Valetudo (Mond)"
  },
  "moon-cupido-h2": {
    "language": "de",
    "title": "Cupid (Mond)"
  },
  "moon-perdita-h2": {
    "language": "de",
    "title": "Perdita (Mond)"
  },
  "moon-rosalind-h2": {
    "language": "de",
    "title": "Rosalind (Mond)"
  },
  "moon-juliet-h2": {
    "language": "de",
    "title": "Juliet (Mond)"
  },
  "moon-portia-h2": {
    "language": "de",
    "title": "Portia (Mond)"
  },
  "moon-rosalind-uranus-h2": {
    "language": "de",
    "title": "Stephano (Mond)"
  },
  "moon-trinculo-h2": {
    "language": "de",
    "title": "Trinculo (Mond)"
  },
  "moon-francisco-h2": {
    "language": "de",
    "title": "Francisco (Mond)"
  },
  "moon-margaret-h2": {
    "language": "de",
    "title": "Margaret (Mond)"
  },
  "moon-ferdinand-h2": {
    "language": "de",
    "title": "Ferdinand (Mond)"
  },
  "moon-setebos-h2": {
    "language": "de",
    "title": "Setebos (Mond)"
  },
  "moon-prospero-h2": {
    "language": "de",
    "title": "Prospero (Mond)"
  },
  "moon-galatea-neptun-h2": {
    "language": "de",
    "title": "Galatea (Mond)"
  },
  "moon-surtur-h2": {
    "language": "de",
    "title": "Surtur (Mond)"
  },
  "moon-pandia-h2": {
    "language": "de",
    "title": "Pandia (Mond)"
  },
  "moon-ersa-h2": {
    "language": "de",
    "title": "Ersa (Mond)"
  },
  "moon-eukelade-h2": {
    "language": "de",
    "title": "Eukelade (Mond)"
  },
  "moon-praxidike-h2": {
    "language": "de",
    "title": "Praxidike (Mond)"
  },
  "mission-juno-h2": {
    "language": "de",
    "title": "Juno (Raumsonde)"
  },
  "mission-curiosity-h2": {
    "language": "de",
    "title": "Mars Science Laboratory"
  },
  "mission-hayabusa-h2": {
    "language": "de",
    "title": "Hayabusa (Raumsonde)"
  },
  "mission-chandrayaan-3-h2": {
    "language": "de",
    "title": "Chandrayaan-3"
  },
  "mission-dart-h2": {
    "language": "de",
    "title": "Double Asteroid Redirection Test"
  },
  "mission-stardust-h2": {
    "language": "de",
    "title": "Stardust (Raumsonde)"
  },
  "mission-deep-impact-h2": {
    "language": "de",
    "title": "Deep Impact (Raumsonde)"
  },
  "mission-soho-h2": {
    "language": "de",
    "title": "Solar and Heliospheric Observatory"
  },
  "mission-philae-h2": {
    "language": "de",
    "title": "Philae (Raumsonde)"
  },
  "mission-chang-e-5-h2": {
    "language": "de",
    "title": "Chang’e 5"
  },
  "mission-pioneer-venus-h2": {
    "language": "en",
    "title": "Pioneer Venus Orbiter"
  },
  "mission-tess-h2": {
    "language": "de",
    "title": "Transiting Exoplanet Survey Satellite"
  },
  "mission-chandra-h2": {
    "language": "de",
    "title": "Chandra (Teleskop)"
  },
  "mission-juno-akatsuki-h2": {
    "language": "de",
    "title": "Akatsuki (Raumsonde)"
  },
  "mission-juno-euclid-h2": {
    "language": "de",
    "title": "Euclid (Weltraumteleskop)"
  },
  "mission-juno-clipper-h2": {
    "language": "de",
    "title": "Europa Clipper"
  },
  "mission-juno-dawn-vesta-h2": {
    "language": "en",
    "title": "Mariner 9"
  },
  "mission-galileo-orbiter-h4": {
    "language": "de",
    "title": "Galileo (Raumsonde)"
  },
  "mission-magellan-venus-h4": {
    "language": "de",
    "title": "Magellan (Raumsonde)"
  },
  "mission-phoenix-mars-lander-h4": {
    "language": "de",
    "title": "Phoenix (Raumsonde)"
  },
  "mission-genesis-h4": {
    "language": "de",
    "title": "Genesis (Raumsonde)"
  },
  "mission-aditya-l1-h4": {
    "language": "de",
    "title": "Aditya-L1"
  },
  "mission-friendship-7-h4": {
    "language": "de",
    "title": "Mercury-Atlas 6"
  },
  "mission-dragonfly-h5": {
    "language": "de",
    "title": "Dragonfly (Raumsonde)"
  },
  "mission-spherex-h5": {
    "language": "de",
    "title": "SPHEREx"
  },
  "mission-cheops-h5": {
    "language": "de",
    "title": "CHEOPS (Weltraumteleskop)"
  },
  "mission-ariel-h5": {
    "language": "de",
    "title": "ARIEL (Weltraumteleskop)"
  },
  "mission-capstone-h5": {
    "language": "de",
    "title": "Capstone"
  },
  "mission-swift-h5": {
    "language": "de",
    "title": "Neil Gehrels Swift Observatory"
  },
  "mission-integral-h5": {
    "language": "de",
    "title": "Integral (Satellit)"
  },
  "mission-planck-h5": {
    "language": "de",
    "title": "Planck-Weltraumteleskop"
  },
  "mission-wise-h5": {
    "language": "de",
    "title": "Wide-Field Infrared Survey Explorer"
  },
  "mission-iris-h5": {
    "language": "de",
    "title": "Interface Region Imaging Spectrograph"
  },
  "mission-davinci-h5": {
    "language": "de",
    "title": "DAVINCI (Raumsonde)"
  },
  "mission-veritas-h5": {
    "language": "de",
    "title": "VERITAS (Raumsonde)"
  },
  "mission-chandrayaan-2-h5": {
    "language": "de",
    "title": "Chandrayaan-2"
  },
  "galaxy-messier-81-h3": {
    "language": "de",
    "title": "Messier 81"
  },
  "galaxy-messier-82-h3": {
    "language": "de",
    "title": "Messier 82"
  },
  "galaxy-messier-104-h3": {
    "language": "de",
    "title": "Sombrerogalaxie"
  },
  "galaxy-messier-51-h3": {
    "language": "de",
    "title": "Whirlpool-Galaxie"
  },
  "galaxy-messier-31-h3": {
    "language": "de",
    "title": "Andromedagalaxie"
  },
  "galaxy-messier-33-h3": {
    "language": "de",
    "title": "Dreiecksnebel"
  },
  "galaxy-messier-87-h3": {
    "language": "de",
    "title": "Messier 87"
  },
  "galaxy-messier-101-h3": {
    "language": "de",
    "title": "Messier 101"
  },
  "nebula-hantelnebel-m27-h3": {
    "language": "de",
    "title": "Hantelnebel"
  },
  "nebula-lagunennebel-m8-h3": {
    "language": "de",
    "title": "Lagunennebel"
  },
  "nebula-trifidnebel-m20-h3": {
    "language": "de",
    "title": "Trifidnebel"
  },
  "nebula-omeganebel-m17-h3": {
    "language": "de",
    "title": "Omeganebel"
  },
  "nebula-ngc6302-bug-h3": {
    "language": "de",
    "title": "NGC 6302"
  },
  "nebula-gabriela-mistral-nebel-h4": {
    "language": "de",
    "title": "NGC 3324"
  },
  "nebula-laufendes-huhn-nebel-h4": {
    "language": "de",
    "title": "IC 2944"
  },
  "galaxy-eso-137-001-h3": {
    "language": "en",
    "title": "ESO 137-001"
  },
  "nebula-mystische-bergnebel-h4": {
    "language": "en",
    "title": "Mystic Mountain"
  }
};

module.exports = { DEWIKI_MAP, AMBIGUOUS_NAMES, ASTRA_WIKI_SOURCES };
