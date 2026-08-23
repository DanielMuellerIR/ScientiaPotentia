# Ernte-Ordner (Zwischenstand Faktensammlung)

> **Stand: 2026-08-23.** Archiv roher Kandidaten aus der damaligen Sammelrunde.
> Es ist kein freigegebener Merge-Pool: Jeder noch nicht übernommene Kandidat braucht eine
> aktuelle Einzelprüfung nach `docs/content_pipeline.md`.

## Inhalt

- `*_w1.json` / `*_w1b.json` — je Bereich/Teil ein Array gesammelter Konzepte
  (Format wie `<domain>_raw.json`: `id, name, category, attributes, funFact, sourceName,
  sourceUrl, verifyNote` + Bildfelder `imageSearchTerm, imageFile, imageLicense,
  imageAttribution`).
- `harvest_terra_currency_f.mjs` und `verify_terra_currency_f.mjs` — Harvester und
  Offline-/Online-Gate für den in v1.92.0 freigegebenen
  [`terra_currency_raw.json`](../terra_currency_raw.json). Reproduktion, Quellen,
  Entscheidungen und Seed-Diff stehen in `terra_currency_f_review.md`.
- `BRIEFING.md` — Auftrag, den jeder Finder gelesen hat.
- `BLACKLIST.md` — vom Orchestrator (Opus) gepflegte Sperrliste (Quellen/URLs/Konzepte/Bilder)
  + Korrekturen. Vor jedem neuen Lauf von Findern zu lesen.
- `resolve_images.cjs` — historischer Bild-Resolver für diese Sammlung. Aktuelle
  Bildprüfungen laufen über die projektweiten Resolver- und Lizenz-Gates; gespeicherte
  Bildfelder sind kein Nachweis einer weiterhin gültigen Lizenz.

## Auditstand

Der Abgleich vom 2026-08-23 ordnet die 390 W1-Kandidaten so ein:

- 345 IDs sind bereits mit derselben ID in den aktuellen Rawkatalogen enthalten.
- Fünf Natura-Kandidaten sind mit abweichender Umlaut-Schreibweise bereits als dasselbe
  Konzept enthalten (`Weißer Hai`, `Großer Tümmler`, `Großer Abendsegler`,
  `Küstenmammutbaum Hyperion`, `Hallimasch`).
- 39 Homo-Kandidaten bleiben wegen des dokumentierten fachlichen Content-Ceilings
  ungemerged; ein Bulk-Append würde dieses Ceiling umgehen.
- Der verbleibende Lingua-Kandidat zu Bibelübersetzungen enthält zeitabhängige Zahlen und
  braucht vor jeder Übernahme eine aktuelle autoritative Quelle.

Die W1-Dateien enthalten inzwischen zwar Bildfelder, deren Lizenzstatus ist aber mit einem
aktuellen Gate neu zu prüfen. Die frühere Zahl „16 verifizierte Bilder" ist daher kein
brauchbarer Status mehr.

Eine weitergehende Inventur über 117 Kandidaten- und Raw-Snapshots mit 7.039 Einträgen fand
nach Deduplizierung von Domain und ID 93 nicht vorhandene IDs. Viele davon sind ältere
Schreibweisen oder Momentaufnahmen schon enthaltener Konzepte. Der Abgleich entscheidet nur
über die ID, nicht über Quellenqualität, Fragenfairness oder Bildlizenz; deshalb folgt daraus
kein automatischer Merge.

| Datei | Konzepte | gespeicherte Bildmetadaten |
|---|--:|--:|
| astra_w1 / astra_w1b | 21 / 25 | vorhanden / vorhanden |
| homo_w1 / homo_w1b | 18 / 26 | vorhanden / vorhanden |
| natura_a_w1 / natura_a_w1b | 24 / 25 | vorhanden / vorhanden |
| natura_b_w1 / natura_b_w1b | 23 / 26 | vorhanden / vorhanden |
| cultura_a_w1 / cultura_a_w1b | 22 / 24 | vorhanden / vorhanden |
| cultura_b_w1 / cultura_b_w1b | 22 / 30 | vorhanden / vorhanden |
| lingua_a_w1 / lingua_a_w1b | 25 / 29 | vorhanden / vorhanden |
| lingua_b_w1 / lingua_b_w1b | 24 / 26 | vorhanden / vorhanden |

## Nächste Schritte (siehe content_pipeline.md)

1. Einen verbliebenen Kandidaten nur bei fachlichem Gewinn, aktueller Primär- oder Fachquelle,
   fairem Fragetyp und passender Visualisierung einzeln übernehmen.
2. Bildquelle, Lizenz und sichtbare Attribution vor dem Merge erneut prüfen; keine gespeicherte
   Commons-Metadaten ungeprüft fortschreiben.
3. Nie die alten Legacy-Rebuild-Skripte verwenden: additive Übernahme in die Rawquelle,
   Generator, Faktenprüfung, Fragen-Audit und Stichprobe bleiben Pflicht.
