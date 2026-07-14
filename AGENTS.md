# Scientia — Arbeitsregeln und Architektur

Scientia ist ein responsives, werbefreies Multi-Domain-Wissensquiz mit
Spaced-Repetition-Fortschritt. Produktname ist **Scientia**; „Scientia potentia est“ ist nur der
Leitspruch. Terra ist der Geografiebereich, daneben existieren eigenständige Domains wie Astra,
Homo, Natura, Cultura, Lingua, Machina und Historia. Qualität, Quellenintegrität, Offline-Fähigkeit
und eine passende Visualisierung pro Frage haben Vorrang vor bloßen Mengenrekorden.

## Einstieg und Quellen

- `README.md`: knapper Projekteinstieg.
- `CHANGELOG.md`: datierte Versions- und Implementierungshistorie.
- `LAYOUT.md`: verbindlicher Layoutvertrag und maschinelles Gate.
- `docs/bereichs_abgrenzung.md`: fachliche Domain-Zuordnung.
- `docs/content_pipeline.md`: Ablauf für Content-Wellen.
- `docs/wissensquellen.md` und `docs/wissensquellen_extern.md`: kuratierte Quellen.
- `scripts/data_sources/harvest/README.md`: Ernte-Zwischenstände.
- `scripts/qa_review/README.md`: semantische QA.
- Offene Arbeit gehört in den Projekt-Backlog, nicht als lange Chronik in diese Datei.
- Code und generierte Daten sind die Wahrheit für aktuelle Zählstände. Keine Zahlenlisten im
  Startkontext pflegen.

## Arbeitsweise

- Bestehende React-/Vite-/Vanilla-CSS-Muster fortführen; keine neuen Frameworks ohne Auftrag.
- Identifier Englisch, Kommentare und UI-Texte Deutsch. Echte Umlaute verwenden.
- Hilfreiche Kommentare bei Refactors erhalten und anpassen; komplexe Logik anfängerfreundlich
  erklären.
- Nur beauftragte Pfade ändern. Fremdes WIP und unabhängige Content-Wellen bleiben unberührt.
- Finder-/Recherche-Agenten schreiben nur isolierte Kandidatenartefakte und committen/pushen nie.
  Bulk-Output ist untrusted input und durchläuft deterministische sowie menschliche Gates.
- Git nach Fleet-Regeln: konkrete Pfade stagen, kein `git add .`/`-A`; abgeschlossene
  Implementierungs-Todos nach Verifikation zum kanonischen privaten Fleet-Remote sichern. GitHub nur auf ausdrücklichen
  Auftrag.
- Reine Regelreorganisation braucht keinen Produktversions-Bump.

## Tragende Architektur

### Domain-Registry und Schlüssel

`src/domains/index.js` ist die Registry. Eine Domain liefert mindestens Metadaten,
`loadConcepts()` und `loadQuestions()`; optionale Visual-/Explorer-Komponenten werden lazy geladen.

- Terra-Konzeptkeys bleiben unpräfixt, damit bestehender Fortschritt kompatibel bleibt.
- Alle anderen Domains nutzen `<domain>:<id>`. Ein Key ohne Doppelpunkt bedeutet Terra.
- `App.jsx` lädt aktive Domain, Konzepte und Fragen. UI und Speicher arbeiten über die
  domain-agnostische Entity-Struktur, nicht über hartcodierte Terra-Daten.
- IndexedDB-Fortschritt wird pro Domain aus dem Key abgeleitet. Keine Key-Migration oder
  DB-Neuschreibung ohne expliziten Plan und Rückwärtskompatibilität.
- Das SRS trackt Konzepte, nicht einzelne Fragen. Mastery und fällige Inhalte pro Domain berechnen.
- DomainSwitcher, Dashboard, VisualPanel und Explorer möglichst generisch erweitern; keine
  Domain-Sonderlogik in die Shell kopieren, wenn Registry/Komponente reicht.

### Visualisierung ist Pflicht

Jede Quizfrage zeigt links das gefragte Konzept. `VisualPanel` routet Terra zur Karte,
domainspezifische Visuals zur registrierten Komponente und sonst zu `ConceptVisual`.

- Neue Domain ohne Spezialvisual beginnt mit einer korrekten generischen Konzeptkarte.
- Fachlich passende Hervorhebung schlägt dekorative Illustration.
- Asset-Lizenz klein und sichtbar im Panel anzeigen.
- Bilder offline bündeln oder über den bestehenden verifizierten Resolverpfad führen.
- Keine erfundenen Bild-URLs. Commons-Dateiseiten sind nicht automatisch direkte Bild-URLs.
- `public/assets/<domain>/CREDITS.md` bzw. der aktuelle Credit-Pfad bleibt vollständig.

### Daten sind zweischichtig

Quellwahrheit liegt in `scripts/data_sources/<domain>_raw.json`. Daraus erzeugen die
`generate_<domain>.js`-Skripte `public/data/concepts_<domain>.json` und
`questions_<domain>.json`.

**Datenfixes immer in raw, nie direkt in generierten concepts/questions.** Eine direkte Änderung
würde beim nächsten Generatorlauf verschwinden. Bereits direkt angehängte Domains verwenden den
dokumentierten additiven Harvest-/Append-Pfad; keine alten `merge_<domain>.js`-Skripte ausführen,
wenn sie Direkt-Appends überschreiben könnten.

Ablauf einer Domain-/Content-Änderung:

1. Domain-Grenze und Notabilität klären.
2. Fakten mit `sourceName`/Quelle in isolierter Kandidatendatei sammeln.
3. Adversarial verifizieren und manuell stichproben.
4. Additiv mergen/deduplizieren; rohe Quelle bleibt nachvollziehbar.
5. Generator ausführen.
6. `verify_facts` für betroffene Domain, Fragen-Audit und Tests.
7. UI/Visualisierung im Browser prüfen.

## Verbindliche Inhaltsregeln

### Fakten und Fairness

- Keine erfundenen Fakten oder Zahlen. Jeder Fakt und jedes Bild braucht eine nachvollziehbare
  Quelle. Autoritative Primär-/Fachquellen bevorzugen.
- Wenn eine Korrektur viele Fragen invalidieren würde, vor dem Masseneingriff Daniel einbeziehen.
- Distraktoren stammen aus derselben Kategorie und Dimension. Liter, Jahre, Längen oder Anzahlen
  nicht vermischen. Numerische Distraktoren aus rohen Werten ableiten, nicht aus formatierten
  Strings.
- Antwort nicht mechanisch im Fragewortlaut verraten. Akzeptierte Ausnahme: ein bekannter
  Trivialname wie „Hammerhai“ darf legitimes Allgemeinwissen über die Kategorie verraten; daraus
  keinen pauschalen Filter bauen. Andere Leaks pro Fragetyp einzeln QA-prüfen.
- Schwierigkeit nicht aus veralteten `difficulty`-Feldern ableiten; das Feld ist ungenutzt.
- Verbose Antwortzusätze vermeiden, weil Längenunterschiede die richtige Antwort verraten.
- Dedup nur kategorieintern automatisieren. Kategorieübergreifende Gleichnamigkeit kann fachlich
  korrekt sein; semantische Stichprobe bleibt Pflicht.

### Sprache, Recht und Scope

- Sichtbares Deutsch verwendet `ä ö ü ß`, niemals pauschal `ae/oe/ue/ss`. Der kuratierte
  `fix_umlauts.js`-Helfer darf tokenweise laufen; kein blindes Suchen/Ersetzen.
- Keine langen geschützten Texte oder Zitate übernehmen. Verbatim-Zitate nur im dokumentierten
  Public-Domain-Gate: Autor spätestens 1955 verstorben; aktuelle Rechtslage vor Erweiterung prüfen.
- Bilder nur PD/CC0 oder kompatibel frei; CC-BY mit sichtbarer Attribution. NC/ND nicht als freie
  Produktassets behandeln.
- Keine namentlichen Rekorde lebender Personen.
- Gegenwarts-/Tagespolitik, aktuelle Parteien, Regierungen, Wahlen und wertende
  Wirtschaftssystem-Debatten bleiben aus allen Domains. Historische Politik nur neutral,
  datierbar und ohne Wertung.
- Homo enthält keine Krankheiten und keine Kulturthemen. Natura folgt beim Klima dem
  wissenschaftlichen/IPCC-Konsens. Domain-Grenzfälle zuerst in
  `docs/bereichs_abgrenzung.md` prüfen.
- Externe Videos/Bücher sind Entdeckungs- und Notabilitätsschicht, nicht automatisch Faktenschicht.
  Werte aus Fachquellen oder verifiziertem Volltext beziehen.

### Harvest- und Generatorfallen

- Wikidata-Massenernte braucht Notabilitätsranking und Typ-/Berufs-/Länderprüfung; bloßes Bild plus
  Sprachlink reicht nicht.
- Buchernte eignet sich für Objekt-/Artenkataloge, nicht pauschal für Konzeptlehrbücher.
- Alte Buchwerte dürfen aktuelle Astra-Fakten nicht überschreiben; bei Sternhelligkeit nur
  gesichertes V-Band verwenden.
- Bildauflösung deterministisch durchführen. Von LLMs erfundene URLs verwerfen.
- Uneinheitliche Key- und Werteschemata vor dem Generieren kanonisieren; Distraktorpools dürfen
  nicht in parallele Vokabulare zerfallen.
- Generatorhebel und Templates zuerst verbessern, erst danach die Konzeptmenge skalieren.
- Änderungen an Fragegeneratoren können Tausende Datensätze verändern: Diff-Summen und Stichproben
  dokumentieren, nicht nur Exit 0.

## Layout und UI

Der responsive Shell-Vertrag lebt in CSS-Klassen und CSS-Variablen in `src/index.css`, nicht in
wachsenden Inline-Styles. Vor und nach Layoutarbeit `npm run check:layout` ausführen und
`LAYOUT.md` lesen.

- Terra-Karte, 3D-/Anatomievisuals und ConceptVisual dürfen durch Shelländerungen nicht
  unterschiedlich verdrängt werden.
- Mobile Hochkant bleibt eigener visueller Gatefall; maschineller Layoutcheck ersetzt den echten
  Gerätetest nicht.
- Keine geschützten Visualassets oder Attributionen beim Refactor verlieren.
- UI-Status soll domain-agnostisch bleiben; Sonderfälle in Domain-Komponenten kapseln.

## Build und Verifikation

```bash
npm install
npm run build
npm test
npm run check:layout
```

Contentänderungen zusätzlich:

```bash
npm run verify:facts -- <domain>
npm run audit:questions -- <domain>
```

Für Terra ggf. `node scripts/verify_quiz.js`. Generator nur für die betroffene Domain ausführen.
Nach Registry-, Visual- oder Contentänderung einen Browserlauf durchführen: Domain wechseln,
Quizfrage beantworten, passende Visualisierung/Attribution prüfen und Konsole kontrollieren.

Testumfang nach Risiko:

- reine UI-Logik: Vitest + Build;
- Layout/CSS: Layoutvertrag + relevante Browsergrößen;
- raw/generator: Generator, `verify:facts`, Fragen-Audit, Diff-Summen und Stichprobe;
- Domain-Registry/DB: bestehender Terra-Fortschritt, Domainwechsel und Keypräfixe;
- Assets: Lizenz, Resolver, sichtbare Credits und Offlineverhalten.

## Dauerentscheidungen

- Qualität vor nomineller 5000er-Quote. Ein fachlich ehrliches Ceiling ist zulässig.
- Jede Frage behält eine Visualisierung.
- Terra-Keys und vorhandener Fortschritt bleiben rückwärtskompatibel.
- Keine erneute Abarbeitung alter, bereits geschlossener Rausch-Reports.
- Historische Phasenstände, Versionszahlen, Content-Zählstände und erledigte Todos gehören in
  CHANGELOG/Archive/Backlog, nicht zurück in den Startkontext.

Die früheren Agentenregeln liegen unverändert unter
[`docs/archive/agent-context-legacy-2026-07-14.md`](docs/archive/agent-context-legacy-2026-07-14.md)
und [`docs/archive/claude-context-legacy-2026-07-14.md`](docs/archive/claude-context-legacy-2026-07-14.md);
beide sind Referenz, keine aktive Anweisung.

## Verzeichnisstruktur

- [`README.md`](README.md): Projektüberblick.
- [`LAYOUT.md`](LAYOUT.md): Layoutvertrag.
- [`CHANGELOG.md`](CHANGELOG.md): veröffentlichte Änderungen.
- [`BACKLOG.md`](BACKLOG.md): verifizierte offene Arbeit.
- [`docs/INDEX.md`](docs/INDEX.md): Fach-, Quellen-, Archiv- und QA-Dokumentation.
