# Astra-Sternbilddaten: Quellen- und Umsetzungsentscheidung

Stand: 2026-08-23

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

Die IAU-Seite nennt für ihre Diagramme CC BY 4.0, aber nicht ausdrücklich eine
Lizenz für die verlinkten Grenzdateien. Solche Daten erst übernehmen, wenn ihre
Nutzungsbedingungen für das gebündelte Produkt dokumentiert sind.

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

1. **Keine Sternkarte:** Die bestehenden Astra-Visualisierungen bleiben unverändert.
   Das ist die richtige Wahl, wenn Sternbildkontext keinen klaren Lernnutzen hat.
2. **IAU-Grenzen:** Eine eigene Grenzflächen- oder Grenzlinienansicht verwendet nur
   geprüfte IAU-Koordinatendaten. Sie ist fachlich amtlich, aber keine vertraute
   Sternbild-Strichfigur; die Datenlizenz ist vorher zu klären.
3. **D3-Celestial-Linien:** Eine Sternkarte kann eine explizit benannte
   D3-Celestial-Konvention verwenden. Sie braucht einen versionierten
   Quelldatensatz, sichtbare Quellenangabe und eine Kennzeichnung als Konvention.

Von einer direkten Stellarium-Übernahme wird abgeraten.

## Technischer Rahmen nach Freigabe

Die Visualdaten gehören als eigenständige Rohquelle unter
`scripts/data_sources/`; ein Generator erzeugt daraus eine Datei unter
`public/data/`. Damit bleiben sie von den bestehenden Astra-Konzepten getrennt und
machen keine nachträgliche Änderung aller Sternkonzepte nötig. Eine spezialisierte
Astra-Visual-Komponente soll die Daten kapseln; Domain-Shell und Fortschrittsspeicher
bleiben unverändert.

Für die nächste Umsetzung braucht es Daniels Wahl zwischen Option 1, 2 und 3 sowie
bei Option 2 oder 3 eine bestätigte Lizenzprüfung des exakt übernommenen
Datensatzes.
