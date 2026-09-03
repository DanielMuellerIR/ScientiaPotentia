# Changelog

Dieses Changelog beginnt mit dem für eine öffentliche Veröffentlichung bereinigten Projektstand.

## [2.0.2] — 2026-09-03

- 832 Fragen in allen acht Wissensbereichen zeigten eine Antwortoption, die im ganzen Katalog
  nur als richtige Lösung vorkam und nie als falsche — wer sie sah, konnte sie ohne Wissen
  anklicken. Betroffen waren unter anderem „Schlangen" (206 von 206 Fragen), „USA" (102 von 102)
  und „Australien und Ozeanien" (65 von 65). Die Distraktorenauswahl nahm bisher stets die drei
  längenähnlichsten Werte und seedete zudem mit der richtigen Antwort, sodass alle Fragen mit
  derselben Lösung dieselben falschen Optionen bekamen. Beides ist behoben; es bleiben 76 Fragen,
  deren Wertevorrat schlicht zu klein ist.
- Der Bildnachweis-Audit und das Fragen-Audit laufen jetzt in `npm run build` mit und brechen
  die Veröffentlichung ab. Ein leerer Fragen- oder Bildkatalog gilt nicht mehr als bestanden.
- Die Struktur- und Provenance-Prüfung deckt jetzt auch Terra ab; zuvor brach sie dort ab.
- 333 veröffentlichte Bildnachweise trugen einen toten Quelllink: Eine Aufräumregel im
  Urhebertext zog jedes doppelte Schrägstrichpaar zusammen und machte aus „https://pixabay.com/…"
  ein „https: / pixabay.com/…". Die Regel greift jetzt nur noch bei einem wirklich leeren
  Segment, und die 333 bereits beschädigten Angaben sind in den Rohdaten repariert.
- In Astra boten mehrere Fragetypen zwei Optionen an, die dasselbe bedeuten — damit war auch
  der vermeintlich falsche Distraktor richtig: „H-II-Gebiet" neben „Emissionsnebel" (46 von 96
  Nebelfragen), drei Schreibweisen von „Heißer Jupiter" (10 von 62), „Mond (Schwerefeld)" neben
  „Mond (Lander + Rover Yutu)" und „Astronomische Einheit" neben „Mittlere Entfernung
  Erde-Sonne". Alle betroffenen Angaben haben jetzt eine Kanonform.
- Die Frage nach der Asteroidengruppe mischte Spektralklasse und Bahngruppe, die sich nicht
  ausschließen: Eros ist S-Typ und erdnah zugleich. Gefragt wird jetzt nur nach der
  Spektralklasse.
- In 40 von 63 Fragen nach der Körperregion eines Muskels stand die Antwort wörtlich in einem
  sichtbaren Merkmal daneben — die Lage, die Funktion oder das Versorgungsgebiet nannten sie.
  Diese Angaben bleiben jetzt bis zur Antwort verborgen. Dasselbe galt für Gefäße und Nerven.
- „Protein" und „Molekül" standen als getrennte Antworten auf die Frage nach der Art eines
  Immunbausteins, obwohl ein Protein ein Molekül ist; in 15 von 22 Fragen waren beide zur Wahl.
  Ebenso nannten die Organsystemfragen zehn Systeme in 19 Schreibweisen. Beides vereinheitlicht.
- Die Frage nach dem Gegenspieler eines Muskels bot in fünf Fällen den gefragten Muskel selbst
  als Option an. Die Frage nach der Art eines Bandes blieb nach dem Selbstverräter-Filter mit
  fünf Fragen übrig, vier davon mit derselben Lösung; sie entfällt.
- Der Seeotter war „Nordamerika" zugeordnet, obwohl sein Verbreitungsgebiet Kamtschatka und die
  Kurilen einschließt. Erdteilübergreifende Gebiete erzeugen jetzt keine Erdteilfrage mehr.
- 60 Bildnachweise zeigten statt eines Urhebers einen mehrzeiligen Commons-Rechtetext
  („Permission details / ACKNOWLEDGMENT FOR PUBLICATIONS …"). Der Rechtetext wird jetzt vom
  Urhebernamen getrennt; künftige Auflöserläufe kürzen lange Angaben an der Wortgrenze statt
  mitten im Wort.
- Zehn Zitatfragen hatten „Sonstige" oder „Anderes" als richtige Antwort — Restekategorien der
  Datenbasis, keine Werktitel. Solche Fragen sind nicht beantwortbar und entfallen; das
  Fragen-Audit blockiert einen Sammelwert als Lösung künftig, lässt ihn als falsche Option aber zu.
- Die Frage nach dem Schrifttyp einer Sprache bot „Abdschad" und „Abjad" als getrennte
  Optionen an — zwei Umschriften desselben Schrifttyps. In 26 Fragen standen beide zur Wahl,
  in 6 davon war eine die gewertete Lösung. Beide Schreibweisen sind vereinheitlicht.
- 32 Asteroidenfragen boten Meter und Kilometer im selben Optionssatz an, 66 Kometenfragen
  begannen mit „der Komet Komet …", und in vier Exoplanetenfragen stand der gesuchte Wirtsstern
  bereits im Planetennamen. Alles behoben.
- Vier Lingua-Kategorien erzeugen erstmals Fragen: Lehnwort, Sprachkuriosum, Grammatik und
  Sprachfakt kommen zusammen auf 47 neue Fragen. Ihre Konzepte tragen fast durchweg eigene
  Attributschlüssel, deshalb findet die übliche Frage „welchen Wert hat dieses Konzept?" dort
  keinen Distraktorenpool. Gefragt wird jetzt umgekehrt — der Attributwert ist der Hinweis, der
  Konzeptname die Antwort: „Zu welcher Wortgruppe gehören ‚Basar, Karawane, Schach'?" Bei den
  Sprachfakten kommen die falschen Optionen aus der passenden Nachbarkategorie, damit
  „Keilschrift" neben „Devanagari" steht und nicht neben „Ungarisch". Phonetik bleibt ohne
  Fragetyp: Dort nennt die Typangabe in sieben von zehn Fällen die gesuchte Lösung.
- Mensch & Körper hat 57 neue Konzeptbilder: 363 statt 306 von 946 Konzepten sind bebildert.
  Der gebündelte Bild-Auflöser fand für 64 der 274 bildlosen Konzepte in den Zielkategorien ein
  freies Commons-Bild; sieben davon sind nach Sichtung aussortiert, weil sie fachlich nicht zum
  Konzept passen — darunter ein Katzenfötus für „Fötus", ein saugendes Kalb für „Saugreflex" und
  Rinder-Markknochen für „Knochenmark". Ein weiteres nannte statt eines Urhebers nur „Own work.".
  Der Bildrechte-Audit prüft Lizenz und Urheber, nicht das Motiv; diese Prüfung bleibt Handarbeit.

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
