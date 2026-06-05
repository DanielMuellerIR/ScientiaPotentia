# Prozessdokumentation: Körper-Fakten Q&A mit Bildquellen

**Zweck:** Dieses Dokument beschreibt den Recherche- und Extraktionsprozess für einen Coding Agent, der auf Basis der gesammelten Fragen, Quellen und Bildressourcen eine Q&A-Anwendung (z. B. Quiz, Lernkarten) aufbauen soll.

---

## 1. Wie die Fragen und Quellen gefunden wurden

### Suchstrategie
Die Fakten wurden über mehrere gezielte Web-Suchanfragen auf Deutsch gesammelt. Die Suchbegriffe kombinierten jeweils ein Körpersystem (z. B. „Skelett", „Herz", „Lunge") mit Qualifikatoren wie „Fakten", „Anatomie", „Funktion" und „wissenschaftlich".

Suchrunden:
- Skelett & Knochen
- Herz & Kreislauf (Herzschläge, Blutgefäße)
- Gehirn & Neuronen
- Haut (Fläche, Gewicht, Aufbau)
- Lunge & Atemvolumen
- Blut & Blutkörperchen
- Zähne & Zahnschmelz
- Muskeln (Anzahl, Typen)
- Leber & Nieren

### Quellenauswahl-Kriterien
Nur Quellen wurden aufgenommen, die mindestens eines der folgenden Merkmale aufweisen:
- Betrieben von einer Universitätsklinik, Fachgesellschaft, staatlichen Institution oder einem anerkannten Gesundheitsportal
- Enthält Literaturverweise oder ist redaktionell geprüft (z. B. durch Ärzte oder Wissenschaftler)
- Wikipedia-Artikel auf Deutsch (de.wikipedia.org) mit belegten Fakten und Einzelnachweisen
- Bekannte medizinische Lehr- und Nachschlagewerke (z. B. MSD Manuals, DocCheck Flexikon, Kenhub)

Ausgeschlossen wurden: Blogs ohne erkennbare Autorenschaft, reine SEO-Seiten, Foren (z. B. gutefrage.net).

---

## 2. Wie die Fragen extrahiert und verifiziert wurden

### Extraktion
Jeder gefundene Fakt wurde in eine Frage umformuliert, die:
- einen klar bebilderbaren Aspekt anspricht (Maße, Zahlen, Strukturen, Vergleiche)
- eindeutig beantwortbar ist
- keinen bloßen Definitionsfakt abfragt, sondern etwas Überraschendes oder Anschauliches

### Verifikation
Jeder Fakt wurde durch mindestens eine seriöse Quelle belegt, die ihn explizit nennt. Fakten, die nur auf einer einzelnen nicht-wissenschaftlichen Seite auftauchten, wurden weggelassen. Widersprüchliche Angaben (z. B. „86 Milliarden" vs. „100 Milliarden" Neuronen) wurden mit dem Stand der aktuellen Forschung abgeglichen und entsprechend kommentiert.

### Bildbarkeit als Filterkriterium
Nur Fakten wurden aufgenommen, zu denen sich ein passendes visuelles Element finden lässt, z. B.:
- anatomische Diagramme (Skelett, Herz, Lunge, Zahn)
- Mikrofotografien (Blutkörperchen, Hautschichten, Neuronen)
- Illustrationen von Größenverhältnissen (Blutgefäßlänge, Lungenoberfläche)
- schematische Darstellungen (Herzschlag, Atemzyklus)

---

## 3. Wie eine Bildquelle gefunden wird

### Primärquelle: Wikimedia Commons
**URL:** https://commons.wikimedia.org/

Wikimedia Commons ist die empfohlene Bildquelle, da:
- alle Bilder frei lizenziert oder gemeinfrei sind
- Lizenzinformationen pro Bild klar ausgewiesen sind
- eine strukturierte API und eine Suchfunktion verfügbar sind
- Bilder direkt in Anwendungen eingebunden werden können (mit Lizenzvermerk)

**Suchstrategie für den Coding Agent:**
```
https://commons.wikimedia.org/w/index.php?search=SUCHBEGRIFF&ns6=1
```
Oder über die MediaWiki API:
```
https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=SUCHBEGRIFF&srnamespace=6&format=json
```

Geeignete Suchbegriffe pro Themenkomplex (Englisch liefert mehr Treffer):
| Thema | Suchbegriff |
|---|---|
| Skelett | `human skeleton anatomy` |
| Herz | `human heart diagram` |
| Lunge | `lung alveoli anatomy` |
| Gehirn | `human brain neuron` |
| Haut | `skin layers epidermis` |
| Blut | `red blood cells erythrocyte` |
| Zähne | `tooth enamel cross section` |
| Muskeln | `human muscular system` |
| Niere | `kidney anatomy cross section` |
| Leber | `liver anatomy diagram` |

### Alternative Bildquellen
| Quelle | URL | Hinweis |
|---|---|---|
| NIH / NLM (US) | https://www.nlm.nih.gov/research/umls/sourcereleasedocs/ | Viele Public-Domain-Diagramme |
| OpenStax Anatomy | https://openstax.org/books/anatomy-and-physiology/pages/1-introduction | CC BY 4.0 |
| Sobotta Atlas (open) | — | Teile gemeinfrei, prüfen |
| Pixabay (Illustrations) | https://pixabay.com | CC0, aber geringere Qualität |

---

## 4. Rechtliche Situation

### Texte / Fakten
Fakten selbst sind **nicht urheberrechtlich geschützt**. Die Formulierung (Frage + Antwort) wurde eigenständig erstellt und ist kein Zitat aus den Quellen. Quellenangaben dienen der Transparenz, sind aber für reine Faktendarstellungen nicht rechtlich verpflichtend. Empfohlen wird trotzdem, die Quelle anzugeben.

### Bilder
Bilder unterliegen dem Urheberrecht. Für jedes verwendete Bild muss geprüft werden:

| Lizenztyp | Erlaubt für kommerzielle Nutzung? | Namensnennung nötig? |
|---|---|---|
| Public Domain / CC0 | ✅ Ja | ❌ Nein (empfohlen trotzdem) |
| CC BY 4.0 | ✅ Ja | ✅ Ja |
| CC BY-SA 4.0 | ✅ Ja, aber Derivate unter gleicher Lizenz | ✅ Ja |
| CC BY-NC | ❌ Nur nicht-kommerziell | ✅ Ja |
| All Rights Reserved | ❌ Nein | — |

**Empfehlung für den Coding Agent:** Beim Abruf von Wikimedia Commons immer das Feld `license` und `attribution` aus der API auslesen und automatisch als Bildunterschrift einfügen.

### Websites als Quellen
Die verlinkten Quellen werden nur als Referenz genannt. Das Scrapen oder Reproduzieren von Texten der Quellseiten ist ohne Erlaubnis nicht zulässig. Die hier gesammelten Fakten wurden paraphrasiert, nicht kopiert.

---

## 5. Alle verifizierten Quellen

### Gruppe A: Staatliche / institutionelle Gesundheitsportale
| Quelle | URL | Themen |
|---|---|---|
| Gesundheitsportal Österreich | https://www.gesundheit.gv.at | Skelett, Muskeln |
| Gesundheitsinformation.de (IQWiG) | https://www.gesundheitsinformation.de | Skelett, Haut |
| AOK Magazin | https://www.aok.de/pk/magazin | Darm, Blut |
| Internisten im Netz | https://www.internisten-im-netz.de | Niere, Leber |
| Stiftung Gesundheitswissen | https://www.stiftung-gesundheitswissen.de | Herz, Leber |
| Lungenliga Schweiz | https://www.lungenliga.ch | Lunge |
| Mehr Luft (AT) | https://mehr-luft.at | Lunge |

### Gruppe B: Universitätskliniken & wissenschaftliche Institutionen
| Quelle | URL | Themen |
|---|---|---|
| Universitätsklinikum Aachen | https://www.ukaachen.de | Herz, Blutgefäße |
| Hirslanden (CH) | https://www.hirslanden.ch | Herz |
| Luzerner Kantonsspital | https://www.luks.ch | Gehirn |
| Helmholtz-Gemeinschaft | https://www.helmholtz.de | Neuronen |
| Österreichische Akademie der Wissenschaften | https://www.oeaw.ac.at | Neuronen |
| Klinik Hallerwiese | https://www.klinik-hallerwiese.de | Darm |
| Herzstiftung | https://www.herzstiftung.de | Herz |

### Gruppe C: Medizinische Lehr- und Nachschlagewerke
| Quelle | URL | Themen |
|---|---|---|
| Kenhub | https://www.kenhub.com/de | Skelett, Zahn, Zahnschmelz, Blut |
| DocCheck Flexikon | https://flexikon.doccheck.com/de | Haut, Zahnschmelz, Muskeln |
| MSD Manuals (DE) | https://www.msdmanuals.com/de | Zähne |
| Leading Medicine Guide | https://www.leading-medicine-guide.com/de | Gehirn, Zähne, Darm |
| Visible Body (DE) | https://www.visiblebody.com/de | Skelett, Muskelarten |
| Das Gehirn (BMBF-gefördert) | https://www.dasgehirn.info | Gehirn, Energie, Neuronen |

### Gruppe D: Wikipedia (DE) – mit Einzelnachweisen
| Artikel | URL | Themen |
|---|---|---|
| Gehirn | https://de.wikipedia.org/wiki/Gehirn | Neuronen, Synapsen |
| Nervenzelle | https://de.wikipedia.org/wiki/Nervenzelle | Neuronen |
| Skelett des Menschen | https://de.wikipedia.org/wiki/Skelett_des_Menschen | Knochenformen |
| Blut | https://de.wikipedia.org/wiki/Blut | Blutbestandteile |
| Zahn | https://de.wikipedia.org/wiki/Zahn | Zahnschmelz-Härte |
| Zahnschmelz | https://de.wikipedia.org/wiki/Zahnschmelz | Mohshärte |
| Lungenvolumen | https://de.wikipedia.org/wiki/Lungenvolumen | Vitalkapazität |

### Gruppe E: Bildungs- und Wissenschaftsportale
| Quelle | URL | Themen |
|---|---|---|
| Planet Wissen (SWR/WDR/BR) | https://www.planet-wissen.de | Knochen, Haut, Lunge |
| Wissenschaft.de | https://www.wissenschaft.de | Gehirn in Zahlen |
| NeuroNation | https://www.neuronation.com | Gehirn, Neuronen |
| ONKO-Internetportal (DKG) | https://www.onko-portal.de | Haut, Darm, Blut |
| Krebsgesellschaft | https://www.krebsgesellschaft.de | Blut |
| Sofatutor | https://www.sofatutor.com | Blut, Leber/Niere |
| Simpleclub | https://simpleclub.com | Skelett |
| Studyflix | https://studyflix.de | Skelett |
| Studienkreis | https://www.studienkreis.de | Erythrozyten, Muskeln |
| Akademie Sport & Gesundheit | https://www.akademie-sport-gesundheit.de | Lungenvolumen |
| Runners World (DE) | https://www.runnersworld.de | Lunge |

### Gruppe F: Sonstige geprüfte Fachquellen
| Quelle | URL | Themen |
|---|---|---|
| Haut.de | https://www.haut.de | Haut-Fakten |
| Mein Lernen (AT) | https://mein-lernen.at | Lunge |
| Fernarzt | https://www.fernarzt.com | Darm |
| Das Gastroenterologie-Portal | https://dasgastroenterologieportal.de | Darm |
| Cerascreen | https://www.cerascreen.de | Knochen |
| SBK (Krankenkasse) | https://www.sbk.org | Knochen |
| Aktivshop Ratgeber | https://www.aktivshop.de | Muskeln |
| Blutspenden.de (DRK) | https://www.blutspenden.de | Blut |

---

## 6. Hinweise für den Coding Agent

- **Sprache:** Alle Fragen und Antworten sind auf Deutsch. Wikimedia-Suchen funktionieren auf Englisch besser.
- **Lizenz-Check:** Bei jedem Bild-Abruf via Commons-API das Feld `extmetadata.LicenseShortName` und `extmetadata.Attribution` auslesen.
- **Quellenlink:** Jede Antwort sollte einen klickbaren Link zur Quellenwebsite enthalten.
- **Kategorien:** Die Fragen sind in 8 Themenbereiche gruppiert: Skelett, Herz, Lunge, Gehirn, Blut, Zähne, Haut, Muskeln + Organe.
- **Format:** Fragen und Antworten können als JSON-Array strukturiert werden mit den Feldern: `id`, `kategorie`, `frage`, `antwort`, `quelle_name`, `quelle_url`, `bild_suchwort`, `bild_url` (nach Abruf), `bild_lizenz`.
