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


module.exports = { DEWIKI_MAP, AMBIGUOUS_NAMES };
