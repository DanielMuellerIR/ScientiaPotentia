# Changelog

Dieses Changelog beginnt mit dem für eine öffentliche Veröffentlichung bereinigten Projektstand.

## [2.0.1] — 2026-09-02

- 99 Fragen in Astra und Mensch & Körper zeigten „undefined“ oder „NaN km“ als Antwortoption:
  Ein fehlender Rohwert lief durch die Textformatierung und landete als scheinbar echter Wert
  im Distraktorenpool. Die Generatoren prüfen den Rohwert jetzt vor dem Formatieren, und das
  Fragen-Audit lässt solche Optionen nicht mehr durch.
- 28 Exoplaneten-Fragen boten zwei Schreibweisen derselben Entdeckungsmethode als getrennte
  Optionen — damit war auch der vermeintlich falsche Distraktor richtig. Die Methoden haben
  jetzt je eine Kanonform; die eine Frage mit zwei Entdeckungsmethoden entfällt.
- Picassos „Guernica“ ist bis 2043 urheberrechtlich geschützt und war als gesperrt vermerkt,
  wurde aber weiter mit Bild ausgeliefert. Das Konzept und seine acht Fragen sind entfernt; der
  Bildnachweis-Audit schlägt jetzt bei jedem gesperrten Konzept fehl.
- Die Frage nach dem Erdteil eines Tieres nannte für Kuba, die Antillen und Mittelamerika
  „Mittelamerika“ — das ist keine Erdteilangabe. Diese Verbreitungsgebiete zählen jetzt zu
  Nordamerika.
- Der gebündelte Bildsucher fragt wieder unter dem Konzeptnamen an, wenn eine Quelle keinen
  deutschen Wikipedia-Titel hergibt; zuvor übersprang er über 600 bildlose Konzepte still.
- Das Fragen-Audit blockiert jetzt bei Fragetypen mit dominanter Lösung, solange sie nicht in
  `scripts/lib/dominance_policy.cjs` mit Begründung und Obergrenze freigegeben sind.

## [2.0.0] — 2026-09-02

- Mensch & Körper wächst von 1.604 auf 3.242 Fragen: neu sind Blutgefäße, Bänder und Sehnen,
  Hirnstrukturen, Botenstoffe, Bestandteile der Sinnesorgane, Zähne, Gewebearten und Bausteine
  des Immunsystems; Organe, Muskeln, Nerven, Menschenarten und Vitamine wurden vertieft.
- Bereits geprüfte, aber nie abgefragte Angaben ergeben neue Fragen in vier weiteren Bereichen:
  Erdteil eines Tieres, Kometen und Sternhaufen, Beschreibung eines IT-Konzepts, Transport- und
  Funktionsprinzipien, Musikepoche, Merkmale und Hauptvertreter der Kunst- und Literaturepochen.
- Die Lagefrage zu Organen nennt jetzt eine von fünf gleichrangigen Körperregionen statt eines
  unterschiedlich langen Beschreibungstextes, dessen Länge die Lösung verriet.
- Zwei Schultermuskeln trugen vertauschte deutsche Namen; die Korrektur betrifft alle daraus
  erzeugten Fragen.
- Das Fragen-Audit meldet zusätzlich Fragetypen, bei denen dieselbe Lösung in mindestens der
  Hälfte aller Fälle richtig ist.

## [1.99.4] — 2026-08-30

- Gruppenabfragen der Sprachernte prüfen alle Wikidata-Aussagen je Sprache gemeinsam,
  statt Sprecherzahl oder Schrift aus einer zufälligen Antwortzeile zu übernehmen.

## [1.99.3] — 2026-08-30

- Die Astronomie-Ernte erkennt Leuchtkraftklassen auch in kompakten und hybriden
  Spektralangaben und ordnet Riesen sowie Unterriesen dadurch korrekt ein.

## [1.99.2] — 2026-08-30

- Alle Wikidata-Bildresolver lehnen veraltete oder mehrdeutige P18-Aussagen ab und
  verwenden dieselbe eindeutige Rangregel.

## [1.99.1] — 2026-08-30

- Schnellquiz, Wiederholungsrunden und Fortschrittsspeicherung verwenden nun die richtige
  Konzept- und Rundenbasis; Schreibfehler bleiben auch nach dem Quiz sichtbar.
- Doppelte Sprachkonzepte wurden zusammengeführt und vorhandener Lernfortschritt wird auf die
  kanonischen Einträge migriert.
- Bildauswahl und Bildnachweise prüfen Sperrlisten, eindeutige Wikidata-Bilder, freie Lizenzen
  und konkrete Rechteinhaber vor der Veröffentlichung.
- Ernte-, Merge- und semantische QA-Werkzeuge brechen bei Datenverlust, unvollständigen
  Modellantworten, ungültigen Quellen oder einem veralteten Prüfsnapshot kontrolliert ab.
- Tastaturnavigation im Bereichsmenü verwendet genau einen fokussierbaren Menüeintrag.

## [1.99.0] — 2026-08-26

- Öffentliche Projekt- und Beitragsdokumentation ohne lokale Arbeitsnotizen oder private
  Infrastrukturangaben.
- Getrennte Lizenzen für Programmcode und eigene Datensatzinhalte sowie gebündelte Hinweise für
  Karten, Daten, Bilder, Schriftarten und Bibliotheken.
- Sichtbare Bildnachweise mit Dateiseite, Urheber, Lizenzlink und Änderungshinweis in Quiz,
  Galerie, Museum, Astronomie- und Anatomieansicht; maschinelles Audit für 5.234 Bilder.
- Rechte-Audit für Zitate; 25 deutsche Übersetzungen ohne dokumentierte Übersetzerrechte und vier
  von der Quelle als unsicher bezeichnete Zuschreibungen entfernt.
- Vite, Vitest, React-Plugin und jsdom aktualisiert; bekannte npm-Schwachstellen im aktuellen
  Abhängigkeitsbaum behoben.

## [1.98.69] — 2026-08-26

- Acht Wissensbereiche mit mehr als 50.000 generierten Fragen und 13.000 Konzepten.
- Domainabhängige Karten-, Astronomie-, Anatomie-, Museum- und Galerieansichten.
- Lokal gespeicherter Lernfortschritt mit Spaced Repetition.
- Deterministische Generatoren, Quellenprüfung, Fragen-Audit und semantische QA-Werkzeuge.
- Responsives Desktop- und Mobil-Layout mit maschinell geprüftem Layoutvertrag.
- Atomares FTPS-Deployment des Entrypoints und des Release-Manifests.

## Öffentliche Historie

Künftige veröffentlichte Änderungen werden hier pro Version mit Datum und sichtbarer Wirkung
dokumentiert. Interne Arbeitsprotokolle, Infrastrukturangaben und persönliche Notizen gehören
nicht in dieses Dokument.
