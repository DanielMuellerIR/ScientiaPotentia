# Backlog

- 38 Konzept-IDs tragen Umlaute oder ß (`cultura:lit-der-fänger-im-roggen`, `natura:weißer-hai`
  und weitere). Sie entstanden, weil die deutschen Textkorrekturen der Merge-Skripte bis zum
  2026-09-03 über das ganze Konzeptobjekt liefen. Die Ursache ist behoben, die IDs bleiben
  bewusst stehen: Sie sind zugleich die Schlüssel des Lernfortschritts in IndexedDB, ein
  Umbenennen würde den Fortschritt zu diesen Konzepten stillschweigend zurücksetzen. Eine
  Bereinigung braucht eine Migration.
- `isConcreteImageAttribution` liegt in `src/utils/imageCredits.js` (ESM) und wird vom
  Release-Audit genutzt, aber nicht vom Preflight in
  `scripts/data_sources/harvest/apply_images.cjs` (CommonJS). Dadurch nimmt `apply_images
  --write` ein Bild mit dem generischen Urheber „Wikimedia Commons" an, und der Fehler platzt
  erst im `npm run build` — dann für die ganze Domain. Die Prüfung braucht zuerst ein Modul,
  das beide Welten laden können; ein Muster dafür gibt es bereits (`scripts/lib/audit_rules.cjs`
  wird von `generator_text.js` re-exportiert).
- 109 veröffentlichte Bildnachweise sind bei 200 Zeichen mitten im Wort abgeschnitten. Die
  Auflöser kürzen seit dem 2026-09-03 an der Wortgrenze und markieren den Schnitt, aber die
  vorhandenen Rohdaten tragen den harten Schnitt bereits — sie werden erst bei einem erneuten
  Auflöserlauf ganz. Der mehrzeilige Commons-Rechtetext in 60 Nachweisen ist behoben.
- `resolve_images_p18.cjs` löst nichts mehr auf. Ein Lauf gegen die echte Commons-API am
  2026-09-03 ergab 0 von 176 Astra-Konzepten, in einer Probe mit zwölf Planeten und Monden
  0 von 12. Ihm fehlt die Titelzuordnung `DEWIKI_MAP`, deshalb fragt er „Merkur" und „Venus"
  ab — beides Begriffsklärungsseiten ohne Artikelbild. `resolve_images_p18_v2.cjs` löste
  dieselben zwölf Konzepte zu zehn auf. Dazu kommt: Der Auflöser stellt je Konzept bis zu drei
  einzelne Anfragen im 200-ms-Takt, läuft damit in das Limit für nicht angemeldete Clients und
  hält sich darin fest; jede abgewiesene Anfrage wird still zu „kein freies Bild". Entweder die
  Zuordnung nachziehen und bündeln, oder die Datei zugunsten von v2 aufgeben.
- 14 der 99 gepflegten Titel in `DEWIKI_MAP` (`resolve_images_p18_v2.cjs`) treffen kein
  Artikelbild, geprüft am 2026-09-03 gegen de.wikipedia: neun zeigen auf Begriffsklärungsseiten
  (Neptun, Haumea, Iapetus, Quaoar, Kiviuq, Ijiraq, Paaliaq, Siarnaq, Erriapus), fünf auf gar
  kein Lemma (Sedna (Zwergplanet), Orcus (Zwergplanet), Nereid (Mond), Sombrero-Galaxie,
  Barnard's Galaxie). Der Auflöser meldet für sie „kein freies Bild", obwohl das richtige Lemma
  ein freies Bild hat — „Neptun (Planet)" trägt ein CC0-Bild. Neben den korrigierten Titeln
  fehlt eine Prüfung auf `pageprops.disambiguation`, sonst bleibt der nächste solche Eintrag
  wieder unsichtbar.
- `resolve_images_batched.cjs` wirft fremdsprachige Quellen weg. Läufe am 2026-09-03 ergaben
  0 von 55 Lingua- und 0 von 40 Machina-Konzepten. 47 der 55 Lingua-Konzepte haben eine
  en.wikipedia-Quelle; `pageTitleForConcept` kann damit nichts anfangen und rät stattdessen den
  deutschen Konzeptnamen als Lemma — von 55 so angefragten Titeln existieren 49 auf
  de.wikipedia nicht („Khoisan-Sprachen (Sammelgruppe)", „Maya-Sprachfamilie"). Über
  `langlinks` en→de oder `pageprops.wikibase_item` mit anschließendem P18 wäre die Quelle
  verwertbar.
- `resolve_author_portraits.cjs` prüft nicht, ob das Artikelbild ein Porträt zeigt. Der Lauf am
  2026-09-03 fand für 2 von 33 Autoren ein Bild, und das eine davon ist `Moers_Signatur.svg` —
  eine Unterschrift. Dass die übrigen 31 leer ausgehen, liegt an der Datenlage: die deutschen
  Artikel dieser Autoren enthalten kein Bild (gegengeprüft an „Dan Simmons").
- Kein Bild-Auflöser bricht ab, solange die API ihn dauerhaft abweist. Der Wächter gegen den
  stillen Nulllauf greift erst am Ende; `resolve_images_p18.cjs` lief so am 2026-09-03 zehn
  Minuten lang durch 60 Konzepte ohne einen einzigen Treffer. Eine Abbruchbedingung nach einer
  Reihe aufeinanderfolgender abgewiesener Anfragen fehlt.
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
- Die Bildabdeckung von Homo hinkt der Konzeptzahl hinterher: 946 Konzepte, 306 Bilder. Die
  acht neuen Kategorien der Welle vom 2026-09-02 haben noch keine aufgelösten Commons-Bilder.
- Fünf Lingua-Kategorien erzeugen bis heute keine einzige Frage, weil ihre Attributschlüssel je
  Konzept verschieden sind: Lehnwort (29), Sprachkuriosum (23), Sprachfakt (14), Grammatik (14)
  und Phonetik (14) — zusammen 94 Konzepte, nachgezählt am 2026-09-03. Sie brauchen einen
  eigenen Fragetyp; Begründung in `docs/attribut_luecken.md`.
- Lizenz der vorgesehenen IAU-Grenzdaten ausdrücklich dokumentieren, bevor sie gebündelt werden.
- Responsive Shell und VisualPanel auf einem echten iPhone im Hochformat prüfen.
- Bildabdeckung in Museum und Explorern nur mit fachlich eindeutigen, freien Kandidaten erweitern.
- Verbleibende Sach- und Fairnesskandidaten aus den semantischen QA-Läufen einzeln gegen
  belastbare Quellen prüfen. Die Berichte liegen außerhalb des Repos; `scripts/qa_review/`
  erzeugt neue nach `docs/qa_reports/` (nicht versioniert).
- Das Deployment langfristig auf unveränderliche Release-Verzeichnisse mit einem atomar
  umgeschalteten Release-Zeiger umstellen. Der aktuelle Ablauf veröffentlicht Assets vor dem
  Entrypoint und kann deshalb kurzzeitig alten Code mit neuen Daten kombinieren.
- Terra erst dann in den Bereichsmix aufnehmen, wenn Kartenfragen und generische Konzeptkarten
  denselben visuellen Vertrag erfüllen.
