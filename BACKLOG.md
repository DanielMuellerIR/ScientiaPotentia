# Backlog

- Die Karte spricht als einziger Teil der App einen fremden Server an: Der Stil in
  `public/map_styles/scientia_parchment.json` holt Vektorkacheln, Rasterrelief, Glyphs und
  Sprite von `tiles.openfreemap.org`, und damit geht die IP jedes Kartennutzers dorthin.
  Gemessen am 2026-09-10: Die Weltkacheln umfassen rund 80 GB und sind auf diesem Webspace
  nicht spiegelbar. Schriften (99 MB für die drei Schnitte à 256 Zeichenbereiche), Relief
  (41 MB als WebP bis Zoom 5, 263 MB bis Zoom 6) und Sprite (0,2 MB) wären spiegelbar, würden
  die Übertragung aber nicht beenden, solange die Kacheln von dort kommen. Entscheidung vom
  2026-09-10: Die Karte bleibt vollständig bei OpenFreeMap; die Begründung steht in
  `THIRD_PARTY_NOTICES.md`, `public/credits.html` und im Stil selbst. Beenden ließe sich die
  Übertragung nur mit eigenen Vektorkacheln — die App hält mit `countries.json`,
  `subdivisions.json` und `rivers.json` bereits eigene Geodaten; ob sie für den Kartenhintergrund
  ausreichen, ist ungeprüft und wäre ein eigener Auftrag.
- Konzeptbilder mit einer Quelle außerhalb von Wikimedia Commons kann `mirror_concept_images.mjs`
  nicht kopieren, und die App zeigt sie deshalb nicht. Zurzeit gibt es keine solche Quelle
  (geprüft 2026-09-10, alle 4945 Dateien liegen auf Commons); `npm run audit:image-mirror`
  meldet den Fall, falls doch eine hinzukommt.
- `public/assets/homo/digestive.svg` (405 KiB) hat keinen Verweis im Quelltext:
  `HomoVisual.jsx` bildet seine Kategorien auf `skeleton.svg`, `muscles.png`,
  `organs.svg` und `body.svg` ab, `CATEGORY_ASSET_ALIAS` leitet die übrigen
  dorthin um. Die Datei wandert trotzdem in jedes Release. Ein Löschen gehört
  ausdrücklich beauftragt, weil ihre Herkunft in `CREDITS.md` dokumentiert ist.
- 38 Konzept-IDs tragen Umlaute oder ß (`cultura:lit-der-fänger-im-roggen`, `natura:weißer-hai`
  und weitere). Sie entstanden, weil die deutschen Textkorrekturen der Merge-Skripte bis zum
  2026-09-03 über das ganze Konzeptobjekt liefen. Die Ursache ist behoben, die IDs bleiben
  bewusst stehen: Sie sind zugleich die Schlüssel des Lernfortschritts in IndexedDB, ein
  Umbenennen würde den Fortschritt zu diesen Konzepten stillschweigend zurücksetzen. Eine
  Bereinigung braucht eine Migration.
- Die Bildkandidaten aus dem Live-Lauf vom 2026-09-30 sind weiter einzeln fachlich
  und visuell zu kuratieren. Von den 135 Astra-Kandidaten wurden Merkur, Venus und
  Mars sowie Jupiter, Saturn, Uranus, Neptun und der Mond übernommen. Hinzu kommen
  Phobos, Deimos, Enceladus, Rhea und Mimas sowie Iapetus, Dione, Tethys
  und Hyperion. Io, Ganymed, Kallisto, Titan und Amalthea sind ebenfalls
  übernommen. Titania, Oberon, Ariel, Miranda und Proteus folgen;
  Eris, Sedna, Pandora, Triton und der Affenkopfnebel sind ebenfalls übernommen;
  Sichelnebel, Irisnebel, Flammender-Stern-Nebel, Schädelnebel und Herznebel
  sind ebenfalls übernommen; 98 bleiben zu kuratieren. Lingua (47 Kandidaten) und Machina
  (13 Kandidaten) sind noch nicht eingepflegt. Kategorien-Vorfilter verwerfen
  eindeutige Fehlmotive, ersetzen aber die Sichtung jedes übernommenen Bilds nicht.
- Charon bleibt vorerst ohne Bild: Der Kandidat „Charon in True Color - High-Res“
  ist auf Commons als gemeinfrei ausgewiesen, während die aktuelle
  New-Horizons-Nutzungsregel nichtkommerzielle Zwecke nennt. Diese unterschiedliche
  Rechtebeschreibung vor einer Übernahme klären.
- Die bestätigten Motivfehler bei `homo:leber` (Personalakte) und
  `cultura:edward-elgar` (Komponistenmontage) sind durch eine menschliche
  Lebergrafik beziehungsweise ein einzelnes Elgar-Porträt ersetzt.
- Für 19 Astra-Konzepte fehlt weiterhin eine eindeutig belegte Wikipedia-Zuordnung.
  Darunter stehen nicht erreichbare oder fachlich falsche externe Quelllinks und
  Grenzen zwischen Nebelkomponenten. Vor einer Bildübernahme die fachliche Quelle
  und das konkrete Motiv prüfen; ein geratener Konzeptname ersetzt diesen Beleg nicht.
- `resolve_author_portraits.cjs` prüft nicht, ob das Artikelbild ein Porträt zeigt. Der Lauf am
  2026-09-03 fand für 2 von 33 Autoren ein Bild, und das eine davon ist `Moers_Signatur.svg` —
  eine Unterschrift. Dass die übrigen 31 leer ausgehen, liegt an der Datenlage: die deutschen
  Artikel dieser Autoren enthalten kein Bild (gegengeprüft an „Dan Simmons").
- Sechs Fragetypen haben weiterhin eine Option, die nur als richtige Antwort vorkommt und nie
  als Distraktor (76 Fragen): `astra-nebula-type` „planetarischer Nebel", `machina-algo-complexity`
  „O(n²)", `historia-figure-field` „Naturwissenschaft (allg.)", `terra/river-country`
  „Deutschland", `astra-exo-distance` „40,5 Lichtjahre" und `terra/currency` „CFA-Franc (BEAC)".
  Vor der Umstellung von `pickBalanced` am 2026-09-03 waren es 31 Typen und 832 Fragen. Der Rest
  liegt an zu kleinen oder zu einseitigen Wertevorräten, nicht an der Auswahl — abbauen lässt er
  sich nur über mehr Werte im Bestand.
- Zwölf Fragen in Historia und Machina bieten zwei Optionen an, deren Oberbegriff gleich ist und
  die sich nur im Klammerzusatz unterscheiden: „Europa (Ursprung: Italien)" neben „Europa
  (Ursprung: England)", „Kompiliert (zu C)" neben „Kompiliert (Cross-Compile)". Anders als bei
  den Astra-Fällen bezeichnen sie wirklich Verschiedenes und sind mit Fachwissen unterscheidbar,
  darum bleiben sie vorerst. Ein Zusammenziehen auf den Oberbegriff würde in
  `historia-epoch-region` 23 von rund 50 Epochen auf „Europa" legen und die Gegenrichtung
  mehrdeutig machen — der Abbau gehört in den Bestand, nicht in die Auswahl.
- `machina-elem-category` bietet nur sieben Werte an, und die beiden häufigsten Antworten
  („Verbindungselement", „Getriebeelement") sind zugleich die beiden längsten. Dadurch ist die
  richtige Antwort dort überdurchschnittlich oft die längste Option. Abhilfe liegt im Bestand:
  mehr Bauelemente in den kurzen Kategorien.
- Vier Fragetypen sind dominant, weil der eigene Bestand schief ist, nicht die Welt: Sprache
  der Genre-Literatur (80 % Englisch), Amtssprachenländer (51 % „2 Länder"), Geologietyp
  (50 % Vulkan) und Essbarkeit von Pilzen (58 % essbar). Sie sind in
  `scripts/lib/dominance_policy.cjs` mit Begründung und Obergrenze freigegeben; abbauen lässt
  sich das nur über einen breiteren Bestand, nicht über andere Distraktoren. Die übrigen
  vierzehn dominanten Typen bilden die Wirklichkeit ab (die meisten Schriften laufen von links
  nach rechts, die IUCN stuft die Mehrheit der Arten als nicht gefährdet ein) und bleiben so.
- Die Bildabdeckung von Homo hinkt der Konzeptzahl hinterher: 946 Konzepte, 363 Bilder. Der
  gebündelte Auflöserlauf vom 2026-09-03 hat 57 Bilder ergänzt und damit die Zielkategorien
  weitgehend ausgeschöpft: Von 274 bildlosen Konzepten dort fand er für 64 ein freies Bild, 210
  haben auf de.wikipedia kein Artikelbild oder teilen sich ein mehrdeutiges Lemma. Die
  verbleibenden 585 bildlosen Konzepte teilen sich in 366 außerhalb der Zielkategorien —
  angeführt von `psych_effect` (128), `sense_organ_part` (38), `blood_vessel` (36) und
  `ligament_tendon` (27) — und 219 innerhalb, für die der Auflöser kein Artikelbild fand.
- Die Motivtreue der Bild-Auflöser braucht bei jedem Lauf eine Sichtung von Hand. Im
  Homo-Lauf vom 2026-09-03 waren 7 von 64 Zuordnungen fachlich falsch, obwohl Lizenz, Urheber
  und MIME-Typ stimmten: ein Katzenfötus für „Fötus", ein saugendes Kalb für „Saugreflex",
  Rinder-Markknochen für „Knochenmark" sowie vier Fotos, die das Konzept gar nicht zeigen
  (Hand ohne Knochen, Füße ohne Knochen, lackierte Zehen für ein Gelenk). Der Bildrechte-Audit
  kann das nicht prüfen. Ein maschineller Vorfilter müsste mindestens die Commons-Kategorien
  gegen die Domain halten — Tiermotive gehören nicht in Mensch & Körper.
- Phonetik ist die einzige Lingua-Kategorie ohne Fragetyp (14 Konzepte). Lehnwort,
  Sprachkuriosum, Grammatik und Sprachfakt tragen seit dem 2026-09-03 zusammen 47 Fragen in der
  Umkehrrichtung. In der Phonetik nennt der Schlüssel `type` in 7 von 10 Fällen die Lösung
  bereits im Hinweis; die drei verbleibenden Fragen tragen keinen eigenen Fragetyp. Ein Abbau
  bräuchte ein beschreibendes Attribut, das den Fachbegriff nicht wiederholt.
- Von den 94 Konzepten der fünf kleinen Lingua-Kategorien erzeugen 47 weiterhin keine Frage —
  sie tragen den jeweiligen Schlüssel nicht oder nennen die Lösung im Hinweis. Das ist keine
  Lücke der Auswahl, sondern des Bestands: Diese Konzepte bräuchten je ein zusätzliches,
  beschreibendes Attribut.
- Lizenz der vorgesehenen IAU-Grenzdaten ausdrücklich dokumentieren, bevor sie gebündelt werden.
- Responsive Shell und VisualPanel auf einem echten iPhone im Hochformat prüfen.
- Bildabdeckung in Museum und Explorern nur mit fachlich eindeutigen, freien Kandidaten erweitern.
- Verbleibende Sach- und Fairnesskandidaten aus den semantischen QA-Läufen einzeln gegen
  belastbare Quellen prüfen. Die Berichte liegen außerhalb des Repos; `scripts/qa_review/`
  erzeugt neue nach `docs/qa_reports/` (nicht versioniert).
- Die Vite-Bundles unter `assets/` sammeln sich auf dem Server genauso an wie früher die
  Katalogdateien: Sie tragen ihren Hash im Namen, werden also nie überschrieben, und die
  Aufräumregel des Deploys erfasst sie erst, seit das Manifest eine Historie führt
  (2026-09-03). Alles, was vor diesem Datum hochgeladen wurde, steht in keiner Historie und
  bleibt deshalb dauerhaft liegen. Ein einmaliger Abgleich gegen ein Verzeichnis-Listing
  könnte das bereinigen — er müsste sehr vorsichtig gebaut werden, weil er anders als die
  jetzige Regel auch Dateien sieht, die das Skript nie selbst hochgeladen hat.
- Terra erst dann in den Bereichsmix aufnehmen, wenn Kartenfragen und generische Konzeptkarten
  denselben visuellen Vertrag erfüllen.
