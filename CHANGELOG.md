# Changelog

Dieses Changelog beginnt mit dem für eine öffentliche Veröffentlichung bereinigten Projektstand.

## [2.1.12] — 2026-09-30

- M81, M82, M104, M101 und ESO 137-001 erhalten fachlich gesichtete
  Galaxienaufnahmen mit vollständigen freien Bildnachweisen und lokalen Kopien.
  Farbkomposite, Mosaike und beteiligte Bildbearbeiter sind ausgewiesen.

## [2.1.11] — 2026-09-30

- Sichelnebel, Irisnebel, Flammender-Stern-Nebel, Schädelnebel und Herznebel
  erhalten fachlich gesichtete Aufnahmen mit vollständigen freien Bildnachweisen
  und lokalen Kopien. Zweifarbenaufnahme und Farbkomposite sind ausgewiesen.

## [2.1.10] — 2026-09-30

- Eris, Sedna, Pandora, Triton und der Affenkopfnebel erhalten fachlich gesichtete
  Aufnahmen mit vollständigen freien Bildnachweisen und lokalen Kopien.
  Punktaufnahmen, Farbkomposite und der markierte Nebelausschnitt sind ausgewiesen.

## [2.1.9] — 2026-09-30

- Titania, Oberon, Ariel, Miranda und Proteus erhalten fachlich gesichtete
  Voyager-Aufnahmen mit vollständigen freien Bildnachweisen und lokalen Kopien.
  Farbkomposite, Mosaike und Mirandas Kolorierung sind ausgewiesen.

## [2.1.8] — 2026-09-30

- Io, Ganymed, Kallisto, Titan und Amalthea erhalten fachlich gesichtete
  Aufnahmen mit vollständigen freien Bildnachweisen und lokalen Kopien.
  Die Bearbeitung der Farbaufnahmen und Amaltheas Stereopaar sind ausgewiesen.

## [2.1.7] — 2026-09-30

- Iapetus, Dione, Tethys und Hyperion erhalten fachlich gesichtete
  Cassini-Aufnahmen mit vollständigen freien Bildnachweisen und lokalen Kopien.
  Iapetus zeigt ein Falschfarbenmosaik, Hyperion eine monochrome Aufnahme.

## [2.1.6] — 2026-09-30

- Phobos, Deimos, Enceladus, Rhea und Mimas erhalten fachlich gesichtete
  Aufnahmen mit vollständigen freien Bildnachweisen und lokalen Kopien.

## [2.1.5] — 2026-09-30

- Jupiter, Saturn, Uranus, Neptun und der Mond erhalten fachlich gesichtete
  Aufnahmen mit vollständigen freien Bildnachweisen und lokalen Kopien.
  Uranus und Neptun zeigen farbkalibrierte Voyager-Aufnahmen.

## [2.1.4] — 2026-09-30

- Leber und Edward Elgar zeigen jetzt das menschliche Organ beziehungsweise ein
  einzelnes Porträt. Merkur, Venus und Mars erhalten fachlich gesichtete Bilder
  mit vollständigen Nachweisen und lokalen Kopien.
- Die Bildauflöser verwerfen Signaturen, Porträtmontagen sowie eindeutig tierische
  Anatomie und Personalakten für menschliche Anatomiekonzepte. Der Vorfilter
  ergänzt die weiterhin erforderliche fachliche Sichtung.
- Meldet Commons bei einem Eigenwerk mit GFDL die Gemeinfreiheit eines separat
  bezeichneten Gebäudes, prüft der gemeinsame Leser den aktuellen Lizenzabschnitt
  des Fotos. Nur eine eindeutige Freigabe wird übernommen; unklare Angaben blockieren
  den Rechteabgleich.

## [2.1.3] — 2026-09-30

- Der gebündelte Bildauflöser und der Astra-Auflöser verwenden dieselbe Sprach-
  und Wikidata-Verknüpfung. Fremdsprachige Wikipedia-Quellen bleiben erhalten;
  Begriffsklärungen und mehrdeutige Zuordnungen liefern keine Bildkandidaten.
- Neu ermittelte Commons-Nachweise erhalten sämtliche Urheber ohne feste
  200-Zeichen-Grenze. Ein gezieltes Werkzeug kann bestehende harte Schnitte an
  derselben Bilddatei reparieren; es schreibt erst nach vollständiger Rechteprüfung.
  65 bestehende Nachweise wurden damit repariert, die Bildzuordnungen bleiben erhalten.
- 87 zusätzliche Astra-Artikel sind fachlich zugeordnet. Der alte einzelne P18-Auflöser
  entfällt nach erfolgreichem Vergleich; API-Verzug wird begrenzt wiederholt und
  bei anhaltendem Fehler gemeldet, statt als fehlendes Bild zu gelten.

## [2.1.2] — 2026-09-12

- Die lokale Bildkopie gilt nur noch nach einem vollständigen, aktuellen Commons-Rechteabgleich
  als veröffentlichbar. Lizenzwechsel, verschwundene, unfreie und gesperrte Dateien entfernen
  ihren alten Zustand aus dem Manifest; ein abgebrochener Lauf und der Release-Audit brechen ab.
- Ein sehr schneller Quizstart überschreibt Bestmarke und Serie nicht mehr, während IndexedDB
  deren bisherigen Wert noch liest.
- Der Autorenporträt-Auflöser bewahrt `Artist` und `Credit` samt mehreren Urhebern vollständig
  und wiederholt vorübergehende Server- und Netzwerkfehler über den gemeinsamen API-Client.
- Die Harvest-Tests bilden den Importgraphen von `apply_images.cjs` wieder vollständig nach.

## [2.1.1] — 2026-09-10

- `npm run build` merkt jetzt, wenn eine Katalogdatei fehlt. Bisher baute die Zuordnung der
  Dateinamen nur aus dem, was in `public/data/` lag: Eine verschwundene Datei fiel einfach
  heraus, der Build lief mit Ausstieg 0 durch, und im Release fehlte still ein Katalog. Genau
  so verlor Fassung 2.0.2 die Weltkarte. Der neue Schritt `audit:data-assets` liest die
  angeforderten Dateien aus dem Quelltext und bricht ab, wenn eine davon fehlt oder keinen
  Inhaltshash bekommt.
- Die Bildernte nimmt keinen Eintrag mehr an, den der Build später ablehnt. Ob Lizenz und
  Urheberangabe für eine Veröffentlichung reichen, entscheidet jetzt für Ernte und Release
  dieselbe Funktion; vorher kannte nur der Release-Audit die Regel, und ein generischer
  Urheber wie „Own work." platzte erst im Build — dann für die ganze Domain.
- Kein Bild-Auflöser hält sich mehr in einer Sperre der Wikimedia-API fest. Weist sie zwanzig
  Anfragen in Folge ab, bricht der Lauf ab. Bisher wurde jede abgewiesene Anfrage still zu
  „kein freies Bild": Ein Lauf schrieb am 2026-09-03 zehn Minuten lang leere Ergebnisse und
  meldete am Ende Erfolg.
- 14 Titel der Astra-Bildauflösung zeigten auf Begriffsklärungsseiten oder auf Lemmata, die es
  nicht gibt — „Neptun" statt „Neptun (Planet)", „Sedna (Zwergplanet)" statt „(90377) Sedna".
  Die Titel sind gegen de.wikipedia geprüft und korrigiert. Zusätzlich erkennt der Auflöser
  eine Begriffsklärungsseite jetzt als solche und nennt sie samt Herkunft des Titels, statt sie
  als „kein freies Bild" abzulegen. Ein Lauf über alle 176 bildlosen Astra-Konzepte findet
  damit 37 Bilder statt bisher praktisch keiner; eingepflegt ist noch nichts, weil jede
  Zuordnung eine Sichtung von Hand braucht.
- `resolve_images_p18_v2.cjs` nimmt `--limit=N`. Ein voller Lauf dauert gut zwanzig Minuten;
  wer nur prüfen will, ob die Auflösung greift, braucht das nicht abzuwarten.

## [2.1.0] — 2026-09-10

- Konzeptbilder liegen jetzt auf dem eigenen Server. Bisher setzten Quiz und Galerien als
  Bildadresse eine `Special:FilePath`-Adresse von commons.wikimedia.org: Bei jeder aufgedeckten
  Antwort und in jeder Galeriekachel ging die IP-Adresse des Besuchers an die Wikimedia
  Foundation. `npm run mirror:images` legt zu allen 4945 Bilddateien eine eigene Kopie an —
  1241 sparsame Originale unverändert, 3704 größere auf 960 Pixel Breite verkleinert, dazu
  3914 Vorschaubilder mit 320 Pixeln. Fehlt eine Kopie, zeigt die App kein Bild; ein Rückfall
  auf Wikimedia ist ausgeschlossen und wird im Build geprüft.
- Der Bildnachweis sagt jetzt die Wahrheit über die ausgelieferte Datei: Ein unverändert
  übernommenes Original trägt „unverändert übernommen" statt „für die Anzeige technisch
  skaliert". Bei CC BY und CC BY-SA ist die Angabe, ob verändert wurde, eine Pflichtangabe.
- Drei Bilder trugen eine falsche Lizenzbezeichnung: „Halimede" stand als Public domain statt
  CC0, die Antlia-Zwerggalaxie als CC BY 3.0 statt 4.0, ein Spannungsreglermodul als
  CC BY-SA 3.0 statt CC BY 2.5. Aufgefallen beim Abgleich aller 4945 Dateien gegen den
  aktuellen Stand auf Commons; dabei war keine Datei verschwunden und keine unfrei geworden.
- Die Lizenztexte für GFDL 1.2, GFDL 1.3 und die Free Art License liegen der Veröffentlichung
  bei. Beim Verlinken auf Commons war das nicht nötig, beim Ausliefern eigener Kopien schon.
- Die Karte bleibt als einziger Teil der App bei einem fremden Server: Die Weltkacheln von
  OpenFreeMap umfassen rund 80 GB und lassen sich nicht spiegeln. Schriften, Relief und Sprite
  allein zu spiegeln, würde die Übertragung nicht beenden. Das ist jetzt in
  `THIRD_PARTY_NOTICES.md`, `public/credits.html` und im Kartenstil begründet statt unbemerkt.

## [2.0.4] — 2026-09-10

- Ein Deploy konnte Dateien eines noch gebrauchten Releases löschen. Ein Historieneintrag,
  dessen Pfade alle unzulässig waren, belegte einen der drei Historienplätze und schob damit
  einen echten Vorgänger heraus — dessen Dateien entfernte der nächste Lauf vom Server,
  obwohl eine noch ausgelieferte `index.html` auf sie zeigen kann.
- Nach einer Quizrunde landete man in sieben der neun Wissensbereiche auf einer Ansicht, die
  das Menü gar nicht anbietet und die nach dem Verlassen nicht wieder erreichbar war.
- Konnte die App Bestmarke oder Serie beim Start nicht lesen, überschrieb der erste
  Punktegewinn den gespeicherten Wert mit dem der laufenden Sitzung: Aus 5000 Punkten wurden
  10, aus einer 27-Tage-Serie eine 1. Solange der Vorzustand unbekannt ist, speichert die App
  jetzt nichts.
- Der Autonome Kreis der Tschuktschen zoomte auf die ganze Weltkarte statt auf die Region. Er
  ist das einzige der 252 Unterteilungs-Features, das die Datumsgrenze überspannt; für Länder
  gab es dafür Sonderfälle, für Unterteilungen und Flüsse keine.
- Die Ortssuche fand 13 Einträge nicht: „Lodz" lieferte kein Łódź, „Diyarbakir" kein
  Diyarbakır, „Da Nang" kein Đà Nẵng. Dass „Gronland" sein Grönland fand, ließ die
  Normalisierung vollständig wirken — sie zerlegt aber nur Akzente, keine eigenständigen
  Buchstaben wie ł, đ, ð, æ, ø und ı.
- Die Suchvorschläge durchsuchen auch die Kennungen, und die tragen ihre Gattung im Präfix.
  Die Eingabe „city" passte damit auf 1375 Einträge und verdrängte die drei, die das Wort im
  Namen führen. Namenstreffer stehen jetzt vorn.
- Ein Lauf von `prepare_data.js` hätte 1226 der 1375 Städte verloren, ohne Fehlercode: Fehlt
  die Städtedatei, baute das Skript stillschweigend mit einer handgepflegten Notliste von 149
  Städten weiter. Die Datei fehlt im Repo tatsächlich.
- Die veröffentlichten Terra-Fragen stammten noch aus v1.92.0 und trugen in 72 Fällen
  veraltete Antwortoptionen; Terra war der einzige der acht Kataloge, der sich nicht aus den
  Quelldaten reproduzieren ließ. Die richtigen Antworten sind unverändert.
- Ein Bildnachweis nannte mit „Scott AnttilaAnttler" einen Urheber, den es nicht gibt: Commons
  trennt mehrere Personen mit `<br />`, und die Auflöser entfernten das Tag ersatzlos. Bei
  CC-BY ist ein verklebter Name keine Namensnennung.
- Zwei Bild-Auflöser hätten bei einem Netzausfall ein leeres Ergebnis über ein brauchbares
  geschrieben und dabei Erfolg gemeldet. Ein dritter konnte einem Mond das Bild eines
  gleichnamigen Artikels geben — 25 Astra-Konzepte wie Io, Europa und Charon waren betroffen.
- Impressum und Datenschutz waren maschinell ungeprüft: Wer die Fußzeile entfernt hätte, wäre
  durch alle Prüfungen gekommen. Der Layoutvertrag prüft jetzt außerdem seine eigene Regel zum
  Scrollverhalten der Spalten.
- Das Erstladen ist 19 kB kleiner (gzip 7 kB): `pmtiles` war toter Code. Jedes Release ist
  zusätzlich 2,3 MB kleiner — die rohen Geodaten-Downloads lagen im Auslieferungsverzeichnis.

## [2.0.3] — 2026-09-04

- Die Weltkarte blieb im veröffentlichten Release ohne Länder, Provinzen und Flüsse. Seit
  2.0.2 tragen die Katalogdateien ihren Inhaltshash im Namen, die drei MapLibre-Quellen in
  `Map.jsx` forderten aber weiter die Klarnamen `data/countries.json`,
  `data/subdivisions.json` und `data/rivers.json` an — drei Adressen, die es in `dist/`
  nicht mehr gibt. Damit fielen Auswahl, Hervorhebung und Flussbeschriftung aus, während
  der Build fehlerfrei durchlief. Ein Test verbietet jetzt jede fest verdrahtete Adresse
  unter `data/` im Quelltext.
- Die Merge-Läufe für Natura und Lingua wären beim ersten Namenspaar abgebrochen, das sich
  nur im Klammerzusatz unterscheidet („Kanopus" neben „Kanopus (Canopus)"). Beide Skripte
  schrieben diesen Hinweis in eine Liste `warnings`, die dort nie angelegt war. Die Liste
  gibt es jetzt, ihr Inhalt steht im Bericht, und ein Test prüft für alle Merge-Skripte,
  dass jeder Sammler auch deklariert ist.
- Der Astra-Auflöser `resolve_images_p18_v2.cjs` leitete den Commons-Dateititel selbst aus
  dem letzten Adresssegment ab. Bei einer Thumbnail-Adresse kam damit „1200px-Foo.jpg"
  statt „Foo.jpg" heraus, die Dateiseite fehlte, und das Bild blieb ohne Meldung ungeerntet.
  Er nutzt jetzt dieselbe Regel wie die übrigen Auflöser.
- Der gebündelte Bild-Auflöser las den Urheber nur aus dem Commons-Feld `Artist`. Eine frei
  lizenzierte Datei, die ihre Namensnennung allein in `Credit` führt, kam damit ohne
  Urhebertext an und fiel still aus dem Ergebnis. Alle vier Bild-Auflöser lesen jetzt beide
  Felder über eine gemeinsame Funktion.

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
- Ein Release kann keine laufende Sitzung mehr zerbrechen. Bisher trugen nur die
  JavaScript- und CSS-Bündel einen Inhaltshash im Namen; die Katalogdateien unter `data/`
  lagen unter festen Namen und wurden beim Deploy überschrieben. Wer die Seite offen hatte,
  bekam in diesem Moment neue Daten zu altem Code — bei einer Feldumbenennung ein Abbruch.
  Jetzt tragen auch die Kataloge ihren Hash, und die `index.html` ist der einzige Punkt, an
  dem ein Release sichtbar wird. Abgelöste Dateien bleiben drei Releases lang liegen und
  werden danach entfernt; gelöscht wird ausschließlich, was das Deployskript selbst einmal
  hochgeladen hat.
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
