# Ernte-Ordner (Zwischenstand Faktensammlung)

> **Stand: 2026-07-19.** Rohe Recherche-Ausgabe der Multi-Agent-Sammelrunde (Krisensitzung).
> **Noch nicht** in `scripts/data_sources/<domain>_raw.json` gemerged. Ablauf/Plan:
> `docs/content_pipeline.md`.

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
- `resolve_images.cjs` — deterministischer Bild-Resolver (Commons-API, Lizenzprüfung).
  **Noch zu härten:** smarte Rate-Limits (`generator=search`+`imageinfo` ein Call, `maxlag`,
  `Retry-After`) — siehe `docs/content_pipeline.md`.

## Stand der Daten

- **390 Konzepte** gesamt, **Fakten intakt und stichprobengeprüft** (Opus, ~10 Fakten
  web-verifiziert, alle korrekt bis auf Pinguin-Tauchtiefe → korrigiert).
- **Bilder: nur `astra_w1.json` hat 16 verifizierte Bilder.** Alle übrigen `imageFile` sind
  **leer** — ein Sweep-Bug (Rate-Limit-Klartext als „fehlt" fehlinterpretiert) nullte sie,
  bevor der Resolver durch war. **Fakten unberührt.** `_imgProblem`-Feld markiert betroffene
  Konzepte. → **Phase C** (Bild-Auflösung) muss vor dem Merge erneut laufen.

| Datei | Konzepte | verif. Bild |
|---|--:|--:|
| astra_w1 / astra_w1b | 21 / 25 | 16 / 0 |
| homo_w1 / homo_w1b | 18 / 26 | 0 / 0 |
| natura_a_w1 / natura_a_w1b | 24 / 25 | 0 / 0 |
| natura_b_w1 / natura_b_w1b | 23 / 26 | 0 / 0 |
| cultura_a_w1 / cultura_a_w1b | 22 / 24 | 0 / 0 |
| cultura_b_w1 / cultura_b_w1b | 22 / 30 | 0 / 0 |
| lingua_a_w1 / lingua_a_w1b | 25 / 29 | 0 / 0 |
| lingua_b_w1 / lingua_b_w1b | 24 / 26 | 0 / 0 |

## Nächste Schritte (siehe content_pipeline.md)

1. Generator-Hebel (Fragen/Konzept ~10) — zuerst, token-frei.
2. Phase C erneut: Bilder deterministisch auflösen (gehärteter Resolver), dedupliziert.
3. Attribut-Keys normalisieren (Englisch/konsistent) + Dedup gegen Bestand, dann Merge in
   `<domain>_raw.json`.
4. Für Natura/Cultura/Lingua existieren noch **keine** Generatoren/Registry-Einträge.
