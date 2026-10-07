# Terra: offene Quellen und Importvertrag

Prüfstand: 2026-10-07. Der vorhandene Spielkatalog wird durch diese Probe nicht verändert.

## Quellenvergleich

| Quelle | Zugang und Versionierung | Rechte | Eignung |
| --- | --- | --- | --- |
| [mledoze/countries](https://github.com/mledoze/countries) | JSON ohne Konto; Git-Commit als fester Snapshot | [ODbL 1.0](https://github.com/mledoze/countries/blob/master/LICENSE); eine übernommene oder abgeleitete Datenbank braucht eine gesonderte Rechteprüfung und Kennzeichnung | ISO-Codes, Namen, Hauptstädte, Währungen, Telefonvorwahlen und Flächen; Bevölkerung und Zeitzonen fehlen |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata:Data_access) | API/SPARQL ohne Konto; exportierte Aussagen mit Revisions- und Abrufnachweis sichern | [Strukturierte Daten unter CC0](https://www.wikidata.org/wiki/Wikidata:Copyright) | Viele benötigte Felder; Mehrfachwerte, Einheiten, Rang, Quellen und Bezugsdatum müssen ausgewertet werden |
| [World Bank](https://datahelpdesk.worldbank.org/knowledgebase/topics/125589-developer-information) | Indikator-API ohne Konto; Jahr, Indikator und heruntergeladenen Snapshot sichern | [Grundsätzlich CC BY 4.0 mit zusätzlichen Bedingungen; Metadaten und Ausnahmen prüfen](https://data.worldbank.org/summary-terms-of-use) | Bevölkerung mit Bezugsjahr als mögliche Ergänzung; keine vollständige Ersatzquelle für alle Länderfelder |
| [REST Countries v5](https://restcountries.com/docs/countries/api-versions) | Konto und API-Schlüssel; neues Schema | Weitergaberechte vor Übernahme des konkreten Angebots prüfen | Zusätzliche Betriebsabhängigkeit; in dieser Probe nicht verwendet |

Empfehlung: einen getrennten Snapshot-Import aufbauen und Bevölkerung sowie Zeitzonen ausdrücklich vervollständigen. Wikidata ist wegen CC0 ein geeigneter Kandidat für den nächsten kleinen Versuch. mledoze ist technisch gut versionierbar, aber kein vollständiger direkter Ersatz. Es wird hier kein fremder Datenbestand unter die redaktionelle Projektlizenz umetikettiert.

## Tatsächlich ausgeführte Probe

`scripts/probe_terra_source.mjs` liest nur eine lokale Kandidatendatei und gibt einen Bericht aus. Es schreibt weder `geodb.json` noch einen Fragenkatalog.

- Snapshot: [countries.json, Commit c2ac0049c14edcf2436c7aa1b2493222a020b462](https://raw.githubusercontent.com/mledoze/countries/c2ac0049c14edcf2436c7aa1b2493222a020b462/countries.json).
- SHA-256: `913e5d716f9dc6b59881ee23488d47f5fda52070d1a34cac5fa327c9e61d8f7c`.
- 250 Datensätze, eindeutige ISO-2-Kennungen; alle 175 Länderkennungen des Spielbestands enthalten.
- Namen: 250; Hauptstädte: 245; Fläche: 249; TLD: 250; Vorwahl: 248; Währungen: 246; Flagge: 249. Diese Zahlen beziehen sich auf alle 250 Quelldatensätze einschließlich abhängiger Gebiete.
- Bevölkerung: 0; Zeitzonen: 0. Ein direkter Ersatz besteht die Pflichtfeldprüfung deshalb nicht.
- Technische Feldabdeckung ist kein fachlicher Einzel-Faktencheck und keine Festlegung, welche Gebiete als Länder spielbar sind.

Reproduktion nach Download des verlinkten Snapshots:

```bash
node scripts/probe_terra_source.mjs countries.json QUELL_URL
```

## Vertrag für den produktiven Folgeimport

1. Pro Quelle URL, unveränderliche Version/Revision, Abrufdatum, Lizenz und SHA-256 sichern. Netzabruf und Transformation trennen.
2. Bestehende unpräfixierte ISO-2-Länderkennungen und weitere Terra-Konzeptkennungen erhalten. Doppelte Codes und fehlende benötigte Länder sperren.
3. Deutsche Namen, Hauptstädte, Bevölkerung mit Bezugsjahr, Fläche in km², TLD, Telefonvorwahl, Zeitzonen, Flagge und Währungscode/-name ausdrücklich abbilden. Mehrere Werte zulassen, statt den ersten still als einzigen auszugeben.
4. Fehlende Pflichtwerte nicht durch `0`, leere Listen oder `N/A` ersetzen. Der Lauf darf den vorhandenen Bestand erst nach vollständiger Prüfung ersetzen.
5. Quellen und Rechte getrennt nach Datenherkunft dokumentieren. Einheiten, Bezugsjahre und territoriale Abgrenzungen vor neuen numerischen Fragen prüfen.
6. Den ersten produktiven Parser als eigenes begrenztes Arbeitspaket umsetzen: zunächst wenige Länder samt Fehlerfällen, danach vollständige Abdeckung, Katalogvergleich und Browserprüfung. Bis dahin bleibt die bisherige neue Terra-Ernte blockiert; das Spiel bleibt nutzbar.
