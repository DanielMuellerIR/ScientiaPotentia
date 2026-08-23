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
  passendem Quelldatensatz umplanen. Quelle:
  https://www.iau.org/Iau/Science/What-we-do/The-Constellations.aspx
- Echten iPhone-Hochkantlauf für responsive Shell und VisualPanel.
- Content-Ceilings pro Domain fachlich statt rein numerisch bewerten.
- Museum-/Explorer-Bildabdeckung gezielt erweitern, nur mit Lizenz- und Eignungsstichprobe.
- Harvest-Zwischenstände additiv mergen; keine Legacy-Rebuild-Skripte.
- Semantischen QA-Lauf (`scripts/qa_review`, MiniMax) auf den aktuellen Daten fahren. Die
  deterministische Ebene ist mit v1.85.10 abgearbeitet; offen ist nur noch, was
  strukturelle Checks prinzipiell nicht sehen (Sachfehler, unfaire Distraktoren,
  Verständlichkeit). Der Lauf verbraucht MiniMax-Kontingent — vorher mit Daniel klären.
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
  nicht nur Technik.
- Browser-Gegenprobe für v1.98.0 offen: Footer-Kontrast und -Unterstreichung sowie die neuen
  Ladehinweise (Hub → Querbeet, Bereichswechsel) sind nur headless geprüft (Vitest,
  Layoutvertrag, Kontrastrechnung). Der Geräte-/Browserlauf nach LAYOUT.md steht aus.
