# Backlog-Kandidaten Scientia

Vor Übernahme jeden Punkt gegen aktuellen Code, CHANGELOG und bestehende Projekt-Todos prüfen.

- **UI-Offensive (abgeschlossene Welle, 2026-07-17):** Module A bis F erledigt — v1.87.0
  brachte den Terra-Pergamentatlas; v1.88.0 das Astra-Label-Decluttering,
  Inneres-System-Inset, den sanften Klick-Zoomflug und kollisionssichere Touch-Ziele;
  v1.89.0 evidenzbasierte Stern-/Ringvisuals, Deep-Sky-Okulare und Transitschema;
  v1.90.0 virtualisierte Domain-Säle, gemeinsames 60er-Depot und zugängliche Lightbox
  für Museum und GalleryExplorer; v1.91.0 den kompakten zweizeiligen Mobile-Header mit
  einzeiligen Icon-Tabs und zugänglichem DomainSwitcher; v1.91.1 das optionale Modul F
  als isoliertes, reproduzierbares
  Währungsnamen-Kandidatenartefakt samt
  [Review](scripts/data_sources/harvest/terra_currency_f_review.md). Der Kandidat wurde
  nach Daniels Freigabe in v1.92.0 als geprüfter
  [Currency-Rawkatalog](scripts/data_sources/terra_currency_raw.json) integriert und
  der faire Fragetyp reaktiviert.
- **Astra-Sternbildkontext:** Keine vermeintlich „offiziellen IAU-Strichfiguren“
  ergänzen. Die IAU erklärt ausdrücklich, dass sie keine solchen Linienmuster definiert;
  Astra besitzt zudem keine Sternkoordinaten. Vor einer Umsetzung entweder eine konkrete,
  kompatibel lizenzierte Linienkonvention freigeben oder auf offizielle IAU-Grenzen mit
  passendem Quelldatensatz umplanen. Quellenlage, Optionen und technischer Rahmen stehen in
  [`docs/astra_sternbilddaten.md`](docs/astra_sternbilddaten.md).
- Echten iPhone-Hochkantlauf für responsive Shell und VisualPanel.
- **Museum-/Explorer-Bildabdeckung:** gezielt erweitern, nur mit Lizenz- und
  Eignungsstichprobe. Am 2026-08-23 wurden die direkt visualisierbaren Lingua-Schriftkonzepte,
  100 Machina-Objekte und 11 eindeutig zuordenbare Astra-Galaxien ergänzt; Rotokas bleibt ohne
  passenden freien Kandidaten offen. Weitere Bilder nur für fachlich eindeutige Konzepte suchen,
  keine generischen oder im dunklen Panel unlesbaren Platzhalter übernehmen.
- **Harvest-Restkandidaten (abgeschlossen, 2026-08-23):** Der W1-Audit ordnet alle 390
  Kandidaten einzeln ein: 345 stehen bereits mit derselben ID im Rawbestand, fünf
  Natura-Einträge sind Umlaut-Duplikate, 39 Homo-Kandidaten bleiben am dokumentierten
  Content-Ceiling. Der verbleibende Lingua-Eintrag zu Bibelübersetzungen erhielt in v1.98.12
  eine aktuelle, datierte Primärquelle. Die Snapshot-Differenzen rechtfertigen keinen
  Bulk-Append; keine Legacy-Rebuild-Skripte ausführen.
- Semantischen QA-Lauf (`scripts/qa_review`, MiniMax) auf den aktuellen Daten fahren. Die
  deterministische Ebene ist mit v1.85.10 abgearbeitet; offen ist nur noch, was
  strukturelle Checks prinzipiell nicht sehen (Sachfehler, unfaire Distraktoren,
  Verständlichkeit). Der Lauf verbraucht MiniMax-Kontingent — vorher mit Daniel klären.
  Preflight am 2026-08-23: eine Frage pro Template über die sieben Nicht-Terra-Domains
  ergibt 342 Stichproben in 29 Aufrufen zu je höchstens 12 Fragen; mit dem Runner-Standard
  von 8.000 Ausgabetokens sind höchstens 232.000 Ausgabetokens anzusetzen. Ein
  generischer Kartenlauf ohne Astra und Homo umfasst 213 Stichproben in 18 Aufrufen.
- **Langfristig:** Mischzustand während des Deployments. Assets werden einzeln sichtbar,
  bevor der neue `index.html` erscheint (`deploy.py` lädt den Entrypoint zuletzt und
  ersetzt ihn per atomarem Rename). Das verhindert Datenverlust und halbe Dateien, aber
  nicht, dass ein Besucher für Sekunden bis wenige Minuten neue Daten mit altem Code
  sieht. Die saubere Reparatur wäre ein Umbau auf unveränderliche Release-Verzeichnisse
  plus einen einzigen umgeschalteten Release-Pointer — das ändert, **wohin**
  veröffentlicht wird, und ist kein kleiner Eingriff.
  Entscheidung Daniel (2026-08-03): kein Umbau jetzt. Im Wortlaut: „Dass bei deploy für
  Sekunden bis maximal wenige Minuten ein undefinierter Zustand entsteht, ist nicht so
  schlimm, es ist nur ein Spiel und es reicht, wenn man langfristig als Todo eine
  Verbesserung anstrebt." Damit bleibt der Punkt als langfristige Verbesserung stehen;
  vorziehen nur, wenn ein Deploy real jemanden gestört hat.
- Terra im Querbeet-Mischpool? `SCIENTIA_MIX_IDS` lässt Terra bewusst aus (Kartenklick-Fragen
  brauchen die Weltkarte, geodb-Konzepte passen nicht ins generische ConceptVisual). Seit
  v1.98.0 sagt die Oberfläche das ehrlich. Alternative wäre, einen kartenfreien Terra-Anteil
  (reine MCQ-Fragen mit Konzeptkarte) in den Mischpool aufzunehmen — Produktentscheidung,
  nicht nur Technik. Zahlen, Grenzen und Implementierungsschritte stehen in
  [`docs/terra_mischpool.md`](docs/terra_mischpool.md).
