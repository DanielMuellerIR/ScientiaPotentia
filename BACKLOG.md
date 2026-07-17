# Backlog-Kandidaten Scientia

Vor Übernahme jeden Punkt gegen aktuellen Code, CHANGELOG und bestehende Projekt-Todos prüfen.

- **UI-Offensive (laufende Welle, 2026-07-17):** Module A bis E erledigt — v1.87.0
  brachte den Terra-Pergamentatlas; v1.88.0 das Astra-Label-Decluttering,
  Inneres-System-Inset, den sanften Klick-Zoomflug und kollisionssichere Touch-Ziele;
  Modul C evidenzbasierte Stern-/Ringvisuals, Deep-Sky-Okulare und Transitschema;
  v1.90.0 virtualisierte Domain-Säle, gemeinsames 60er-Depot und zugängliche Lightbox
  für Museum und GalleryExplorer; v1.91.0 den kompakten zweizeiligen Mobile-Header mit
  einzeiligen Icon-Tabs und zugänglichem DomainSwitcher. Offen bleibt nur (F, optional)
  Währungsnamen-Kandidatenartefakt. Modul A hat Währungsfragen und -daten bewusst
  nicht berührt; siehe bestehenden currency-Punkt unten.
- **Astra-Sternbildkontext:** Keine vermeintlich „offiziellen IAU-Strichfiguren“
  ergänzen. Die IAU erklärt ausdrücklich, dass sie keine solchen Linienmuster definiert;
  Astra besitzt zudem keine Sternkoordinaten. Vor einer Umsetzung entweder eine konkrete,
  kompatibel lizenzierte Linienkonvention freigeben oder auf offizielle IAU-Grenzen mit
  passendem Quelldatensatz umplanen. Quelle:
  https://www.iau.org/Iau/Science/What-we-do/The-Constellations.aspx
- Depot-/Galerie-Suche matcht Substrings („eule" findet „Beulenkrokodil") — auf
  Wortanfangs- oder diakritikrobuste Token-Suche umstellen.

- Echten iPhone-Hochkantlauf für responsive Shell und VisualPanel.
- Content-Ceilings pro Domain fachlich statt rein numerisch bewerten.
- Museum-/Explorer-Bildabdeckung gezielt erweitern, nur mit Lizenz- und Eignungsstichprobe.
- Harvest-Zwischenstände additiv mergen; keine Legacy-Rebuild-Skripte.
- Semantischen QA-Lauf (`scripts/qa_review`, MiniMax) auf den aktuellen Daten fahren. Die
  deterministische Ebene ist mit v1.85.10 abgearbeitet; offen ist nur noch, was
  strukturelle Checks prinzipiell nicht sehen (Sachfehler, unfaire Distraktoren,
  Verständlichkeit). Der Lauf verbraucht MiniMax-Kontingent — vorher mit Daniel klären.
- Weitere Templates auf „Antwort am Skalenboden" prüfen: Der Sweep 2026-07-16 deckte nur
  Wortform-Tells ab. Attribute mit natürlicher Untergrenze (Mindestanzahlen, Zählungen ab 1)
  können denselben Defekt tragen wie `officialIn`; `skipAsk` steht als Hebel bereit.
- `generate_questions.js` (Terra) seedbar machen: Der Generator nutzt ungeseedetes
  `Math.random()` an 12+ Stellen, dazu das verzerrende `sort(() => 0.5 - Math.random())`.
  Folge: Ein Lauf würfelt 4.787 von 5.217 Distraktorsätzen neu, `questions_terra.json` ist
  nicht reproduzierbar und Generatorfixes lassen sich nur chirurgisch ausliefern. Lingua
  macht es mit `seededShuffle` (Seed = id) vor. Der Umstieg kostet einmalig einen
  Distraktor-Churn über fast den ganzen Terra-Bestand — vorher mit Daniel abstimmen.
- Fragetyp `currency` reaktivieren: `CURRENCY_TRANSLATIONS` belegt auf alle ~174 Währungen
  erweitern, Fallback von „englisch durchreichen" auf „nicht fragen" umstellen und den
  Adjektiv-Leak lösen („in Kanada" → „Kanadischer Dollar"). Erst danach aus
  `DISABLED_TYPES` nehmen. Braucht eine belegte Quelle für die deutschen Namen.
- `verify_facts.js` Englisch-Leak-Check: Meldet bei Lingua zwei Fehlalarme auf griechischen
  Etymologien („én = in + theós = Gott" → „in" als englisches Wort gelesen). Vorbestehend,
  harmlos, aber dieselbe Klasse wie die 2026-07-16 entrauschten Audit-Fehlalarme: Ein
  Checker, der dauerhaft Bekanntes meldet, wird ignoriert und verdeckt dann Echtes.
- Terra-Fortschritt deckelt bei 1.850/1.852: Die Städte Luxemburg und Dschibuti sind seit
  v1.85.11 nicht mehr abfragbar (ihre einzigen Fragen waren Selbstverräter), zählen im
  Dashboard aber weiter als Karteikarte. Entweder `totalEntitiesCount` aus den tatsächlich
  abfragbaren Entitäten ableiten oder für beide einen fairen Fragetyp ergänzen.
