# Terra Currency — Merge und Reaktivierung

## Erfolgskriterium und Reproduktion

Der Currency-Merge ist erfolgreich, wenn aus `src/data/geodb.json` und der gepinnten
EU-Authority-Projektion bytegleich `scripts/data_sources/terra_currency_raw.json`
entsteht, exakt die fachlich freigegebenen Fragen generiert werden und Offline-/Online-Gates
grün sind.

```bash
node scripts/data_sources/harvest/harvest_terra_currency_f.mjs
node scripts/generate_questions.js
node scripts/data_sources/harvest/verify_terra_currency_f.mjs
node scripts/data_sources/harvest/verify_terra_currency_f.mjs --online
node scripts/verify_quiz.js
npm run audit:questions
```

Geprüfter Stand vom 2026-07-19:

```text
Currency-Rawdaten geschrieben: 172 Einträge, 134 Namen, 134 Rawstrings,
93 Fragen freigegeben, 79 Ländername-Leaks übersprungen.
OK offline: 4609 Prüfungen; 172 Quellen / 93 Fragen / 79 Ländername-Leaks übersprungen.
OK online: 5541 Prüfungen; 172 Quellen / 93 Fragen / 79 Ländername-Leaks übersprungen.
Quiz: 5116 Fragen, 57903 Prüfungen, 0 Fehler.
```

Zwei vollständige Generatorläufe erzeugten dieselbe Fragen-Datei. Gepinnte Hashes:

```text
a4d252351b7cff9de5527464479b00fc5a6b68366f7cbf9f3e1f9505ce73c21a  EU-Projektion
8d2d957909ae120afa7ae095348fd7d7f4780e84e66282e01e98856b426b79ec  terra_currency_raw.json
7db01a9a88b9054cb9fb3b1b5067d94f9bf14e34eb0973b7b3e3461f5c8239c0  questions_terra.json
```

## Freigegebene Datenpolitik

- `candidateOnly=false`, `rawMergeApproved=true` und
  `questionReactivationApproved=true`.
- Deutsche Namen und ISO-Codes stammen aus der EU Publications Office Currency
  Authority List `20260105-0`. Währungssymbole bestimmen nie den ISO-Code.
- Eine fehlende belegte Zuordnung erzeugt keine Frage. Es gibt keinen englischen
  Fallback.
- Antworten verwenden einheitlich `Deutscher Name (ISO-Code)`. Die uneindeutigen
  Symbole erscheinen nicht in den Antwortoptionen.
- Distraktoren stammen bevorzugt aus derselben Weltregion, danach aus derselben
  Schwierigkeit und zuletzt aus dem globalen belegten Pool. Auswahl und Reihenfolge
  sind pro Fragen-ID deterministisch.
- Die Frage lautet „Welche dieser Währungen wird in … verwendet?“. Damit behauptet
  sie auch bei Ländern mit mehreren Umlaufwährungen keine exklusive Einzelwährung.

Von 175 Country-Entities besitzen `AQ`, `EH` und `PS` bewusst keine eindeutige
Currency-Zuordnung. Die übrigen 172 Zeilen decken 134 ISO-Codes ab.

## Entscheidungen zu den fünf Sperrfällen

| Entity | Entscheidung | Begründung |
|---|---|---|
| `BG` | `EUR`, Frage aktiv | Bulgarien führte den Euro am 2026-01-01 ein. |
| `CU` | `CUP`, Frage übersprungen | CUC ist ausgelaufen; „Kubanischer Peso“ verrät Kuba. |
| `EH` | keine Currency-Zuordnung | Die Gegenquelle ordnet MAD zu, „offizielle Währung“ bleibt für das umstrittene Gebiet mehrdeutig. |
| `PS` | keine Currency-Zuordnung | Keine eindeutige einzelne ISO-4217-Währung; mehrere Währungen sind im Umlauf. |
| `ZW` | `ZWG`, Frage übersprungen | ZWL ist ausgelaufen; „Simbabwe-Gold“ verrät Simbabwe. |

Der Quellenwechsel verändert die gepinnte EU-Projektion ausschließlich wie beschlossen:
`BGN`, `CUC` und `ZWL` entfallen; `CUP` und `ZWG` kommen hinzu. `EUR` war bereits
enthalten.

## Ländername- und Adjektiv-Leaks

Die frühere Teilübersetzung zeigte 17 bekannte Adjektiv-Leaks. Der vollständige
deutsche Katalog macht weitere gleichartige Fälle sichtbar. Deshalb werden nun alle
79 amtlichen Bezeichnungen mit erkennbarem Ländername, Länderabkürzung oder
unmittelbarem Adjektiv als `skip-country-name-leak` markiert. Beispiele:

- Kanada → Kanadischer Dollar
- Nordkorea → Nordkoreanischer Won
- Vereinigte Staaten → US-Dollar
- Dschibuti → Dschibuti-Franc

Die vollständige, vom Verifier auf Coverage geprüfte ID-Liste liegt als
`COUNTRY_NAME_LEAK_IDS` im Harvester und als `skippedCountryNameLeakIds` in den
Currency-Rawdaten. Solche Bezeichnungen dürfen weiterhin Distraktoren sein, weil sie
bei einer anderen gefragten Entity keine richtige Antwort verraten.

## Deterministischer Seed-Diff

Vor der Umstellung enthielt `questions_terra.json` 5.023 Fragen. Danach:

- 93 neue Currency-Fragen;
- 0 entfernte Fragen;
- 4.591 bestehende Fragen mit ausschließlich geänderten `options`;
- 0 Änderungen an bestehenden IDs, Prompts, richtigen Antworten oder anderen Feldern.

Alle früheren `Math.random()`-Aufrufe und verzerrenden Random-Sorts im Terra-Generator
sind durch `seededShuffle` beziehungsweise längenbalancierte, fragen-ID-seedbare
Auswahl ersetzt. Wiederholte Läufe sind dadurch bytegleich.

## Quellen

1. **EU Publications Office, Currency authority list**, Version `20260105-0`:
   Primärquelle für ISO-Code, deutsche und englische `skos:prefLabel`, Status und
   Nutzungsdaten.
   <https://op.europa.eu/en/web/eu-vocabularies/dataset/-/resource?uri=http%3A%2F%2Fpublications.europa.eu%2Fresource%2Fdataset%2Fcurrency>
2. **Deutsche Bundesbank, „ISO-Währungscodes“**, Stand 2026-07-15:
   Gegenquelle für aktuelle deutsche Singularnamen und Gebietszuordnung.
   <https://www.bundesbank.de/de/statistiken/statistische-fachreihen/-/iso-waehrungscodes-808950>
3. **SIX, ISO 4217 Maintenance Agency**:
   Gegenquelle für Code- und Statuspflege.
   <https://www.six-group.com/en/products-services/financial-information/market-reference-data/data-standards.html>

Ändert die Live-Quelle ihre Projektion trotz gleicher Versionskennung, bricht der
Harvester vor dem Schreiben ab. Dann sind Labels, Status- und Nutzungsdaten zu diffen
und fachlich zu prüfen; bloßes Ersetzen des Hashes ist unzulässig.
