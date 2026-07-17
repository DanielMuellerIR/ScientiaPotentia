# Terra Currency F — isolierter Kandidat

## Erfolgskriterium und Reproduktion

Der Lauf ist erfolgreich, wenn er aus `src/data/geodb.json` bytegleich
`cand_terra_currency_f.json` erzeugt, der Offline- und Online-Verifier grün sind und im
Produkt weiterhin keine Currency-Frage aktiv oder mit dem Kandidaten verbunden ist.

```bash
node scripts/data_sources/harvest/harvest_terra_currency_f.mjs
node scripts/data_sources/harvest/verify_terra_currency_f.mjs
node scripts/data_sources/harvest/verify_terra_currency_f.mjs --online
```

Der Harvester benötigt Netzwerkzugriff, weil er jeden kuratierten ISO-Code sowie das deutsche
`skos:prefLabel` gegen die gepinnte EU-Authority-Version `20260105-0` prüft. Der normale Verifier
ist danach vollständig offline. `--online` wiederholt die EU-Prüfung für alle 134 verwendeten
Codes.

Ausgabe des geprüften Laufs am 2026-07-17:

```text
Kandidat geschrieben: 174 Einträge, 135 Namen, 137 Rawstrings, 5 blockiert.
OK offline: 3604 Prüfungen; 174 Einträge / 135 Namen / 137 Rawstrings / 5 blockiert; keine Produktintegration.
OK online: 4551 Prüfungen; 174 Einträge / 135 Namen / 137 Rawstrings / 5 blockiert; keine Produktintegration.
```

Ein unmittelbar wiederholter Harvester-Lauf erzeugte denselben SHA-256:

```text
61115a85747592d82c7d2b99acd4a14b8f948cef500534b32c2ee07743b2b057  scripts/data_sources/harvest/cand_terra_currency_f.json
```

## Scope und Zählsummen

- Input: 175 Country-Entities; SHA-256
  `64838f8dd341cdb853e132e5a3f1093b24dd69312275f0562868eb36b76aee16`.
- `AQ` hat `currency: "N/A"` und wird als einziges Land ausgeschlossen.
- Kandidat: 174 Länderzeilen, 137 byteverschiedene Rawstrings, 135 verschiedene englische Namen
  und 134 verschiedene ISO-Codes.
- 169 Zeilen sind als `verified-candidate` markiert.
- Ausschließlich `BG`, `CU`, `EH`, `PS` und `ZW` sind `blocked-source-data`.
- Der Parser bewahrt auch abweichende Symbole bytegenau, etwa `DZD` in `DZ`/`EH` und `EGP` in
  `EG`/`PS`. ISO-Codes werden ausschließlich aus dem kuratierten Namen-Mapping bestimmt, nie aus
  dem Symbol.
- `candidateOnly=true`, `rawMergeApproved=false` und
  `questionReactivationApproved=false`. Es gibt keine Änderung an Raw-, Produkt- oder generierten
  Daten.

Die blockierten Einträge übersetzen bewusst die **im Raw-Feld bezeichnete** Währung:

| Entity | Raw-Code | EU-Label (de) | Blockierender Befund |
|---|---|---|---|
| BG | BGN | Lew | Ende 2026-01-01; Nachfolger EUR |
| CU | CUC | Konvertibler Peso | Ende 2021-06-30; fachlicher Nachfolger CUP, aber keine EU-`isReplacedBy`-Kante |
| EH | DZD | Algerischer Dinar | Raw-Gebietszuordnung weicht von der aktuellen Gegenquelle (MAD) ab |
| PS | EGP | Ägyptisches Pfund | keine eindeutige eigene ISO-4217-Währung; mehrere Umlaufwährungen |
| ZW | ZWL | Simbabwe-Dollar | Ende 2024-08-31; Nachfolger ZWG |

Das ist eine Befundsammlung, keine stillschweigende Aktualisierung. Über Raw-Merge und
Reaktivierung entscheidet Daniel separat.

## Quellen und Nutzung

1. **EU Publications Office, Currency authority list**, Dataset-/Authority-Version `20260105-0`:
   Primärquelle für Code, deutsches und englisches `skos:prefLabel`, Deprecation und
   Nutzungsdaten. Der Query-SHA-256 ist
   `742e9efd9b03da52f097b84e77604903743b2f4c21109b312fd35b3c978d81c8`.
   Zusätzlich ist die sortierte Projektion der 134 verwendeten Codes über
   `code, englishLabel, germanLabel, deprecated, useStart, useEnd` mit SHA-256
   `1d8d81db8affb74f0d55642a2a5c46801e331ba341bc94aeb809c1be6ad01a68` gepinnt.
   Jeder Eintrag verweist direkt auf
   `https://publications.europa.eu/resource/authority/currency/<CODE>`.
   Dataset:
   <https://op.europa.eu/en/web/eu-vocabularies/dataset/-/resource?uri=http%3A%2F%2Fpublications.europa.eu%2Fresource%2Fdataset%2Fcurrency>
2. **Deutsche Bundesbank, „ISO-Währungscodes“**, PDF-Stand 2026-07-15:
   Gegenquelle für deutsche Singularnamen und aktuelle Gebietszuordnung.
   <https://www.bundesbank.de/de/statistiken/statistische-fachreihen/-/iso-waehrungscodes-808950>
3. **SIX, ISO 4217 Maintenance Agency**: Gegenquelle ausschließlich für Code- und Statuspflege.
   <https://www.six-group.com/en/products-services/financial-information/market-reference-data/data-standards.html>

Die EU-Daten werden mit sichtbarer Quellen- und Versionsangabe gemäß der EU-Regelung zur
Weiterverwendung öffentlicher Dokumente nachgenutzt. Die Bundesbank- und SIX-Quellen werden nur
als Beleg/Gegenprüfung zitiert; Tabellen oder längere Texte daraus wurden nicht kopiert. Ihre
Quellenangaben müssen bei einer späteren fachlichen Weiterverwendung erhalten bleiben.

Ändert die Live-Quelle ihre Projektion trotz gleicher Versionskennung, bricht der Harvester vor
dem Schreiben ab. Ein Quellenupdate ist dann ein expliziter Review-Vorgang: Projektion diffen,
geänderte Labels, Status- und Nutzungsdaten gegen EU/Bundesbank/SIX prüfen, Mapping und Sperrfälle
fachlich bewerten und erst danach den Pin bewusst aktualisieren. Bloßes Ersetzen des Hashes oder
stilles Regenerieren ist kein zulässiges Update.

## Deterministische Stichprobe

Das feste Verfahren lautet:

1. Für jede Entity SHA-256 über `terra-currency-f-v1:<entityId>` bilden.
2. Lexikografisch die zwölf kleinsten Hashes wählen.
3. Die elf Pflichtfälle `BG, CU, EH, PS, ZW, GL, BF, CF, KP, KR, SZ` ergänzen.
4. Nach Entity-ID sortieren.

Damit umfasst die dokumentierte Stichprobe 23 Einträge:

| Auswahl | Entity | Raw-Währung | ISO | EU-Label (de) | Status |
|---|---|---|---|---|---|
| Pflicht | BF | West African CFA franc (Fr) | XOF | CFA-Franc (BCEAO) | verifiziert |
| Pflicht | BG | Bulgarian lev (лв) | BGN | Lew | blockiert |
| Hash | BW | Botswana pula (P) | BWP | Pula | verifiziert |
| Pflicht | CF | Central African CFA franc (Fr) | XAF | CFA-Franc (BEAC) | verifiziert |
| Pflicht | CU | Cuban convertible peso ($) | CUC | Konvertibler Peso | blockiert |
| Hash | CZ | Czech koruna (Kč) | CZK | Tschechische Krone | verifiziert |
| Hash | DJ | Djiboutian franc (Fr) | DJF | Dschibuti-Franc | verifiziert |
| Pflicht | EH | Algerian dinar (دج) | DZD | Algerischer Dinar | blockiert |
| Pflicht | GL | krone (kr.) | DKK | Dänische Krone | verifiziert |
| Hash | IT | euro (€) | EUR | Euro | verifiziert |
| Pflicht | KP | North Korean won (₩) | KPW | Nordkoreanischer Won | verifiziert |
| Pflicht | KR | South Korean won (₩) | KRW | Südkoreanischer Won | verifiziert |
| Hash | LB | Lebanese pound (ل.ل) | LBP | Libanesisches Pfund | verifiziert |
| Hash | LY | Libyan dinar (ل.د) | LYD | Libyscher Dinar | verifiziert |
| Hash | MA | Moroccan dirham (د.م.) | MAD | Marokkanischer Dirham | verifiziert |
| Hash | MD | Moldovan leu (L) | MDL | Moldau-Leu | verifiziert |
| Hash | NE | West African CFA franc (Fr) | XOF | CFA-Franc (BCEAO) | verifiziert |
| Pflicht | PS | Egyptian pound (E£) | EGP | Ägyptisches Pfund | blockiert |
| Hash | RO | Romanian leu (lei) | RON | Rumänischer Leu | verifiziert |
| Pflicht | SZ | Swazi lilangeni (L) | SZL | Lilangeni | verifiziert |
| Hash | TG | West African CFA franc (Fr) | XOF | CFA-Franc (BCEAO) | verifiziert |
| Hash | TZ | Tanzanian shilling (Sh) | TZS | Tansania-Schilling | verifiziert |
| Pflicht | ZW | Zimbabwean dollar ($) | ZWL | Simbabwe-Dollar | blockiert |

Die Stichprobe deckt beide CFA-Francs, Won-Disambiguierung, den unspezifischen Grönland-Eintrag,
den veralteten UI-Ländernamen Swasiland sowie sämtliche blockierten Quellprobleme ab.
