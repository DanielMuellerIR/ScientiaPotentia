# Drittanbieterhinweise

Die MIT-Lizenz in `LICENSE` gilt nur für den ursprünglichen Scientia-Programmcode. Daten, Bilder,
Kartenstile, Kartendaten, Schriftarten und Bibliotheken behalten ihre jeweiligen Rechte.

## Karten

### OpenFreeMap, OpenMapTiles, Positron und OpenStreetMap

`public/map_styles/scientia_parchment.json` ist eine lokal angepasste Fassung des von
[OpenFreeMap](https://openfreemap.org/) ausgelieferten Positron-Stils. Änderungen durch Scientia:
Pergamentfarben, deutsche Beschriftungen, Kontrast, Schriftwahl und Layerdetails. Die Anwendung
lädt weiterhin Kacheln, Relief, Glyphen und Sprites von OpenFreeMap.

- OpenFreeMap-Projekt: MIT, Copyright © 2023 Zsolt Ero.
- Positron-Stilcode: BSD 3-Clause, Copyright © 2024 MapTiler.com und OpenMapTiles contributors.
- Positron-Design: CC BY 4.0.
- Das Positron-Design beruht auf CartoDB Basemaps von Stamen und Paul Norman für CartoDB Inc.,
  lizenziert unter CC BY 3.0.
- OpenMapTiles-Schema und -Design: BSD 3-Clause beziehungsweise CC BY 4.0; sichtbare
  Namensnennung „OpenMapTiles“ ist erforderlich.
- Kartendaten: © OpenStreetMap contributors, Open Database License 1.0. Die interaktive Karte
  zeigt die von der Quelle gelieferte Attribution über MapLibre an.
- Natural-Earth-Raster: Public Domain.

Quellen: [OpenFreeMap-Lizenz](https://github.com/hyperknot/openfreemap/blob/main/LICENSE.md),
[OpenMapTiles-Lizenz](https://github.com/openmaptiles/openmaptiles/blob/master/LICENSE.md),
[OpenStreetMap Copyright](https://www.openstreetmap.org/copyright),
[Natural Earth Terms of Use](https://www.naturalearthdata.com/about/terms-of-use/).

BSD-3-Clause-Hinweis für OpenMapTiles/Positron:

> Copyright (c) 2024, MapTiler.com & OpenMapTiles contributors. All rights reserved.
>
> Redistribution and use in source and binary forms, with or without modification, are permitted
> provided that the following conditions are met:
>
> 1. Redistributions of source code must retain the above copyright notice, this list of
>    conditions and the following disclaimer.
> 2. Redistributions in binary form must reproduce the above copyright notice, this list of
>    conditions and the following disclaimer in the documentation and/or other materials provided
>    with the distribution.
> 3. Neither the name of the copyright holder nor the names of its contributors may be used to
>    endorse or promote products derived from this software without specific prior written
>    permission.
>
> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR
> IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
> FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR
> CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
> DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
> DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
> IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT
> OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

MIT-Hinweis für OpenFreeMap:

> Copyright (c) 2023 Zsolt Ero
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
> associated documentation files (the “Software”), to deal in the Software without restriction,
> including without limitation the rights to use, copy, modify, merge, publish, distribute,
> sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or
> substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
> NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
> NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
> DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

### GeoNames

Teile der Terra-Ortsdaten wurden mit [GeoNames](https://www.geonames.org/) abgeglichen oder daraus
abgeleitet. GeoNames Gazetteer-Daten stehen unter
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Daten werden ohne Gewähr für
Richtigkeit, Aktualität oder Vollständigkeit bereitgestellt.

### Wikidata

Strukturierte Fakten aus den Haupt-, Property-, Lexeme- und EntitySchema-Namensräumen von
[Wikidata](https://www.wikidata.org/) stehen unter
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

## Bilder und 3D-Texturen

- Konzeptbilder stammen überwiegend von Wikimedia Commons. Jedes erzeugte Konzept speichert
  Dateiseite, Urheberangabe, Lizenzbezeichnung und Lizenzlink. Die App zeigt diese Angaben am Bild.
- Dateien mit CC-Lizenz werden nur technisch für die Anzeige skaliert; andere inhaltliche
  Änderungen müssen beim jeweiligen Asset vermerkt werden.
- Astra-Texturen und die Saturnring-Aufnahme:
  `public/assets/astra/textures/CREDITS.md`.
- Homo-Anatomiegrafiken: `public/assets/homo/CREDITS.md`.
- NASA-Material ist in den USA grundsätzlich nicht urheberrechtlich geschützt, muss als
  NASA-Material kenntlich bleiben und kann gekennzeichnete Drittinhalte enthalten. NASA-Logos und
  Personenbilder unterliegen zusätzlichen Regeln:
  [NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).

## Schriftarten

- Inter: Copyright © 2020 The Inter Project Authors, SIL Open Font License 1.1.
  Volltext: `public/assets/fonts/INTER-OFL.txt`.
- Outfit: Copyright © 2021 The Outfit Project Authors, SIL Open Font License 1.1.
  Volltext: `public/assets/fonts/OUTFIT-OFL.txt`.

## Bibliotheken

Die JavaScript-Abhängigkeiten und ihre Versionen stehen in `package-lock.json`. MapLibre GL JS wird
mit seiner Lizenzdatei unter `public/assets/maplibre/LICENSE.txt` ausgeliefert. Die jeweiligen
Paketlizenzen gelten unverändert; `LICENSE` lizenziert diese Bibliotheken nicht neu.

## Zitate

Wörtliche Zitate und Übersetzungen werden nicht unter der Scientia-Datenlizenz neu lizenziert.
`npm run audit:quote-rights` prüft vor der Generierung, dass entweder der deutschsprachige
Originaltext oder eine dokumentierte gemeinfreie beziehungsweise frei lizenzierte Übersetzung
vorliegt.
