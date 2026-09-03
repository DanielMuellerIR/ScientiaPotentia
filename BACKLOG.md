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
  wird von `generator_text.js` re-exportiert). Real eingetreten am 2026-09-03: Der Homo-Lauf
  lieferte für `enzym-amylase-ptyalin` den Urheber „Own work." — konkret genug für den
  Preflight, zu unkonkret für den Release-Audit. Der Eintrag wurde von Hand aussortiert.
- 109 veröffentlichte Bildnachweise sind bei 200 Zeichen mitten im Wort abgeschnitten. Die
  Auflöser kürzen seit dem 2026-09-03 an der Wortgrenze und markieren den Schnitt, aber die
  vorhandenen Rohdaten tragen den harten Schnitt bereits. Ein normaler Auflöserlauf heilt sie
  nicht: Sowohl `resolve_images_batched.cjs` als auch `apply_images.cjs` fassen ausschließlich
  Konzepte ohne `imageFile` an. Nachgezählt nach dem Homo-Lauf vom 2026-09-03 — davor 109 hart
  abgeschnittene Nachweise, danach unverändert 109, dazu ein neuer, sauber an der Wortgrenze
  gekürzter. Zum Heilen braucht es einen eigenen Lauf, der die betroffenen Konzepte gezielt neu
  auflöst. Der mehrzeilige Commons-Rechtetext in 60 Nachweisen ist behoben.
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
- Das Deployment langfristig auf unveränderliche Release-Verzeichnisse mit einem atomar
  umgeschalteten Release-Zeiger umstellen. Der aktuelle Ablauf veröffentlicht Assets vor dem
  Entrypoint und kann deshalb kurzzeitig alten Code mit neuen Daten kombinieren.
- Terra erst dann in den Bereichsmix aufnehmen, wenn Kartenfragen und generische Konzeptkarten
  denselben visuellen Vertrag erfüllen.
