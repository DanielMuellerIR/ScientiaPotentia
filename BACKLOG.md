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
- **Astra-Sternbildkontext:** Daniel hat am 2026-08-23 offizielle IAU-Grenzen gewählt,
  keine vermeintlich „offiziellen IAU-Strichfiguren“. Astra besitzt noch keine
  Sternkoordinaten. Die IAU-Grenzdateien verwenden J2000-Koordinaten, aber ihre
  Bundling-Lizenz ist noch nicht ausdrücklich dokumentiert; vor der Umsetzung diese
  Lizenz klären. Quellenlage und technischer Rahmen stehen in
  [`docs/astra_sternbilddaten.md`](docs/astra_sternbilddaten.md).
- Echten iPhone-Hochkantlauf für responsive Shell und VisualPanel. Daniel hat
  ihn am 2026-08-23 vertagt; erst fortsetzen, wenn ein reales iPhone verfügbar
  ist.
- **Museum-/Explorer-Bildabdeckung:** gezielt erweitern, nur mit Lizenz- und
  Eignungsstichprobe. Am 2026-08-23 wurden die direkt visualisierbaren Lingua-Schriftkonzepte,
  167 Machina-Objekte und 11 eindeutig zuordenbare Astra-Galaxien ergänzt; Rotokas bleibt ohne
  passenden freien Kandidaten offen. Weitere Bilder nur für fachlich eindeutige Konzepte suchen,
  keine generischen oder im dunklen Panel unlesbaren Platzhalter übernehmen.
- **Harvest-Restkandidaten (abgeschlossen, 2026-08-23):** Der W1-Audit ordnet alle 390
  Kandidaten einzeln ein: 345 stehen bereits mit derselben ID im Rawbestand, fünf
  Natura-Einträge sind Umlaut-Duplikate, 39 Homo-Kandidaten bleiben am dokumentierten
  Content-Ceiling. Der verbleibende Lingua-Eintrag zu Bibelübersetzungen erhielt in v1.98.12
  eine aktuelle, datierte Primärquelle. Die Snapshot-Differenzen rechtfertigen keinen
  Bulk-Append; keine Legacy-Rebuild-Skripte ausführen.
- **Semantische QA, Quellen-Triage fortsetzen:** Der Vollauf vom 2026-08-23 mit
  GPT-5.6 Terra bewertete je eine Frage aus allen 342 Templates der sieben
  Nicht-Terra-Domains in 29 Aufrufen. Der [Report](docs/qa_reports/qa_2026-08-23_all_gpt56-terra.md)
  bleibt Kandidatenliste, nicht Wahrheit: Die klaren Befunde sind in v1.98.68
  quellengeprüft korrigiert (Taxonomie, Winterpalast, Sorbisch, Suezkanal,
  Michelson–Morley, mehrdeutige Kategorien und äquivalente Antwortoptionen).
  Ein [Nachlauf](docs/qa_reports/qa_2026-08-23_all_gpt56-terra_validation.md)
  über 12 geänderte und benachbarte Fragen hatte keine möglichen Sachfehler und
  keine mehrfach richtige Antwort.
  Als Nächstes die übrigen modellgemeldeten Sach- und Fairnesskandidaten einzeln
  gegen Quellen prüfen; insbesondere historische Jahreszahlen, Astro-Werte und
  Klassifikationen. Ein generischer Kartenlauf ohne Astra und Homo umfasst 213
  Stichproben in 18 Aufrufen.
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
- **Terra im Querbeet-Mischpool (entschieden, 2026-08-23):** `SCIENTIA_MIX_IDS`
  lässt Terra bewusst aus. Daniel hat die bestehende Option bestätigt, weil
  Kartenklick-Fragen die Weltkarte brauchen und Geo-Konzepte nicht in die generische
  Konzeptkarte passen. Zahlen und verworfene Alternative stehen in
  [`docs/terra_mischpool.md`](docs/terra_mischpool.md).
