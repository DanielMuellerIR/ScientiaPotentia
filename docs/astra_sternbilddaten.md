# Astra-Sternbilddaten: Quellen- und Umsetzungsentscheidung

Stand: 2026-08-23

## Entscheidung

Daniel hat am 2026-08-23 Option 2 gewählt: Astra soll die offiziellen IAU-Grenzen
zeigen, keine Sternbild-Strichfiguren. Die Umsetzung bleibt von einer
nachvollziehbaren Lizenz für den gebündelten Koordinatendatensatz abhängig.

## Ziel und aktueller Zustand

Sternbildnamen können in Astra als Eigenschaft einzelner Konzepte erscheinen. Für eine
Sternkarte fehlen jedoch sowohl ein Koordinatendatensatz als auch eine verbindliche
Darstellungskonvention. `scripts/data_sources/astra_raw.json` enthält keine Rektaszension
und Deklination; `AstraVisual.jsx` zeichnet keine Sternkarte.

Eine neue Visualisierung darf deshalb nicht aus einer vermeintlich offiziellen
Strichfigur abgeleitet werden. Die IAU definiert die 88 Sternbilder als
Himmelsbereiche mit Koordinatengrenzen und erklärt ausdrücklich, keine formalen
Figurenmuster festzulegen. Die Grenztabellen liegen dort als J2000-Textdaten vor.

Quellen:

- [IAU: The Constellations](https://iauarchive.eso.org/public/themes/constellations/)
- [IAU: What are the constellations?](https://www.iau.org/public/themes/constellations/)
- [IAU: Public Licensing Policy](https://iau.org/Iau/Copyright.aspx)
- [VizieR VI/49: Constellation Boundary Data](https://cdsarc.cds.unistra.fr/viz-bin/cat/VI/49)

Die IAU-Seite liefert für jedes Sternbild eine Textdatei mit J2000-Koordinaten. Die
allgemeine IAU-Lizenz nennt CC BY 4.0 jedoch ausdrücklich nur für Bilder, Videos und
Webtexte, nicht für Koordinatendateien. Der referenzierte VizieR-Katalog VI/49 nennt
das zugrundeliegende Fachwerk, aber ebenfalls keine freie Weiterverwendungslizenz.
Solche Daten erst übernehmen, wenn ihre Nutzungsbedingungen für das gebündelte Produkt
dokumentiert sind.

## Geprüfte Linienquellen

### Stellarium

Die westlichen Linien in Stellarium sind eine eigene, nicht standardisierte
Darstellung. Die ursprüngliche Datei war GPLv2+ lizenziert; eine Diskussion nennt
eine spätere MIT-Freigabe, doch sie ersetzt keine versionierte Quellenaufnahme mit
vollständigem Lizenzhinweis. Ohne genau festgelegten Datenstand und eine
nachprüfbare Lizenzkette ist Stellarium keine Standardquelle für Astra.

Quelle: [Stellarium: Lizenzdiskussion zu Sternbildlinien](https://github.com/Stellarium/stellarium/discussions/790)

### D3-Celestial

[D3-Celestial](https://github.com/ofrohn/d3-celestial) steht unter einer
BSD-3-Clause-Lizenz und enthält J2000-kompatible GeoJSON-Dateien für Linien und
Grenzen. Die Linien bleiben dennoch eine Visualisierungskonvention: Das Projekt
nennt für sie die IAU-Seite und eigene Linienanpassungen. Vor einer Übernahme muss
der konkrete Datenstand als Quellenartefakt festgeschrieben, seine Hinweise müssen
mitgebündelt und die Darstellung als „D3-Celestial-Linienkonvention“, nicht als
IAU-Standard, bezeichnet werden.

## Umsetzungsoptionen

Daniel hat IAU-Grenzen gewählt. Eine eigene Grenzflächen- oder Grenzlinienansicht
verwendet daher nur geprüfte IAU-Koordinatendaten. Sie ist fachlich amtlich, aber keine
vertraute Sternbild-Strichfigur; die Datenlizenz ist vor dem Import noch zu klären.
Von einer direkten Stellarium-Übernahme wird weiterhin abgeraten.

## Technischer Rahmen nach Freigabe

Die Visualdaten gehören als eigenständige Rohquelle unter
`scripts/data_sources/`; ein Generator erzeugt daraus eine Datei unter
`public/data/`. Damit bleiben sie von den bestehenden Astra-Konzepten getrennt und
machen keine nachträgliche Änderung aller Sternkonzepte nötig. Eine spezialisierte
Astra-Visual-Komponente soll die Daten kapseln; Domain-Shell und Fortschrittsspeicher
bleiben unverändert.

Für die nächste Umsetzung braucht es eine bestätigte Lizenzprüfung des exakt
übernommenen IAU-Datensatzes. Erst dann werden Rohquelle, Generator, spezialisierte
Visual-Komponente und sichtbare Quellenangabe ergänzt.
