# Content-Pipeline für Fragen-Ausbau (Phase 5)

> **Stand: 2026-06-05.** Lebendes Dokument. Beschreibt den **vereinbarten** effizienten
> Ablauf, um die Wissensbereiche (außer Terra) auf 1000/2000/5000 Fragen je Bereich zu
> bringen. Ergänzt `archive/koerper_fakten_prozess.md` (Homo-spezifischer Erstentwurf) und
> verallgemeinert ihn. Quelle für Status/Zahlen bleibt `AGENTS.md`.

## Ausgangslage (Krisensitzung 2026-06-05)

Fragen außerhalb Terra waren zu wenige und teils schwach. Eine erste Multi-Agent-Sammelrunde
(2× 8 Sonnet-Finder parallel) brachte **≈390 neue, belegte Konzepte** in 5 Bereichen
(Astra, Homo, Natura, Cultura, Lingua), abgelegt in `scripts/data_sources/harvest/`.
Fakten-Trefferquote in den Opus-Stichproben hoch (alle ~10 web-geprüften Fakten korrekt bis
auf eine Zahl). Aber: der naive Ablauf war **zu langsam und zu teuer** und hatte
Qualitätslücken (s. „Gelernte Stolpersteine").

## Vereinbarte Entscheidungen

1. **Generator-Hebel zuerst.** Fragen pro Konzept von aktuell ~2–3 (Astra 3,3 · Homo 1,8)
   auf **~10** heben — über mehr **faire** Fragetypen je Konzept im Generator. Das ist
   **token-frei** (reines Templating aus den `attributes`) und der billigste Weg zu hohen
   Fragenzahlen. Erst danach die Konzeptmenge skalieren.
2. **Pipeline-Redesign übernehmen** (Phasen A–E unten).
3. **Gestufte Verifikation.** Autoritative Primärquellen (Wikidata, NASA Planetary Fact
   Sheets, JPL, Gray's Anatomy 1918, USGS) gelten als belegt — **Quelle speichern, nicht
   erneut web-nachschlagen**. Voll-Verify nur bei Portalen/Sekundärquellen.
4. **Quellen sind Pflicht — für jeden Fakt UND jedes Bild** (Name, URL, bei Bild zusätzlich
   Lizenz + Urheber).
5. **Eskalationsregel:** Wenn eine Entscheidung **viele Fragen auf einmal invalidiert**,
   zuerst Daniel informieren, nicht eigenmächtig löschen.

## Pipeline (Phasen A–E)

**A — Sammeln (Sonnet, parallel nach Bereich×Kategorie).** Finder öffnet **wenige reiche
Quellseiten** und **erntet je Seite 15–40 Fakten** (Page-Mining), statt ein Webaufruf pro
Fakt. Ausgabe **nach Quelle gruppiert** (`{sourceUrl, sourceName, facts:[…]}`). **Keine**
Bildsuche hier. Tool-Budget je Finder klein halten (~15 Calls, 1–2 Seiten).

**B — Fakten verifizieren (Sonnet, parallel nach QUELLE).** Ein Verifizierer je Quellseite
liest die Seite **einmal** und prüft **alle** ihr zugeordneten Fakten im Stapel. Autoritative
Quellen überspringen (gestufte Verifikation, Entscheidung 3).

**C — Bilder auflösen + prüfen (deterministisch + Sonnet, dedupliziert).** Eindeutige
Bild-Suchbegriffe sammeln → **ein Bild darf viele Fragen bedienen**, also einmal auflösen,
mehrfach nutzen. Commons-API **live**: erstes existierendes + frei lizenziertes Bild
(nur **PD/CC0/CC-BY/CC-BY-SA**, kein NC/ND/unklar). Sonnet urteilt nur noch **Bild-passt-zu-
Frage**. Quelle+Lizenz+Urheber je Bild speichern. Skript: `scripts/data_sources/harvest/resolve_images.cjs`.

**D — Opus-Stichprobe.** Adversarial je Quelle (Wahrheit + Lizenz), Blacklist-Rückspielung
über `scripts/data_sources/harvest/BLACKLIST.md`, Statistik.

**E — Generator (token-frei).** Verifizierte Konzepte → ~10 Fragetypen/Konzept per Templating.
Selbstverräter-Guard (`revealsAnswer`) + dimensionsrichtige Distraktoren existieren schon.
Hier gehören **alle** Qualitäts-Guards hin (keine Unsinnsfragen, keine offensichtlichen
Antworten) — nicht zum Finder.

## Effizienz-Hebel (Webaufrufe UND Tokens senken)

1. **Wikidata-SPARQL/Bulk statt Seiten-Scraping** — eine Query liefert hunderte
   **strukturierte** Fakten (Elemente, Planeten, Artmaße, Sprachstatistik, Kunstwerk-Metadaten)
   mit Quelle = Wikidata (CC0). LLM extrahiert nichts, formuliert nur. Größter Sammel-Hebel.
2. **Beschriftete/segmentierbare Illustrationen = Fragenfabrik.** Ein Skelett-/Organ-/Bahn-
   Diagramm mit beschrifteten, klickbaren Elementen → jedes Label = eine Frage, **alle teilen
   EIN verifiziertes Bild**. Mechanik existiert: `MARKER_BY_ID` in `HomoVisual.jsx` (Klick-
   Marker auf Strukturen), Astra-Bahnschema, Terra-Karte. Größter q/Konzept-Hebel für
   räumliche Domänen.
3. **Reiche Artseite → dutzende Fakten, ein Bild.** Z. B. „Blauwal": Größe, Gewicht,
   Lebensdauer, Herzgröße, Tragzeit, Verbreitung → 1 Fetch, viele Fakten, ein Leitbild für
   alle (akzeptiert: gemeinsames Bild bei thematisch passenden Fakten).
4. **Deterministisch > LLM** überall: Dedup, Umlaut-Putz (`fix_umlauts.js`), Lizenz-Check,
   Bild-Auflösung, Quellen-Speicherung = Skript. LLM nur für Konzeptauswahl, Formulierung,
   Bild-Fit-Urteil.
5. **Generator-Expansion ist token-FREI** (Entscheidung 1).
6. **Gestufte Verifikation** (Entscheidung 3) — autoritative Quellen nicht nachprüfen.
7. **Fetch-Cache + Dedup** — gleiche Seite/gleicher Bildbegriff nur einmal holen.
8. **Schlanke Prompts** — Briefing als Datei referenzieren, kurze Kategorie-Zuweisung;
   Dedup-Namenslisten NICHT in den Prompt (deterministischer Nachschritt).
9. **Finder lösen keine Bilder** — nur `imageSearchTerm`; spart ~30–40 % Tool-Calls und killt
   die Fabrikations-Fehlerquelle.

## Smarte Rate-Limit-Umgehung (Wikimedia/Commons)

- **`generator=search` + `prop=imageinfo` in EINEM Call** (Suche + Lizenz statt zwei Calls).
- **`maxlag=5`** setzen (Server signalisiert Überlast selbst) und **`Retry-After`-Header**
  respektieren statt blind warten.
- **`imageinfo` bündelt bis zu 50 Titel** je Call.
- Beschreibender **User-Agent** (Wikimedia-Pflicht), **eine** Verbindung, Backoff mit Jitter.
- **Dedup-Cache:** identischer Suchbegriff → ein Call für viele Konzepte.
- Achtung Bug-Falle: API liefert bei Überlast **Klartext** statt JSON
  („You are making too many requests…") → `JSON.parse` wirft. Immer abfangen + Retry, nie still
  als „fehlt" werten (genau dieser Fehler nullte am 2026-06-05 versehentlich 350 Bildfelder).

## Durchsatz & Hochrechnung (gemessen am 2026-06-05)

- 2 Wellen → ~390 Konzepte, **~1,12 Mio Sonnet-Tokens**, ~23 min reine Agent-Wall-Clock
  (8-fach parallel) + Opus-Checkpoints. ≈**2.900 Sonnet-Tokens/Konzept**.
- Wall-Clock = **langsamster** Finder (Welle B bis 771 s), weil ~80–110 serielle Tool-Calls.
  „2× 5 min" war für 1-Call-pro-Fakt nie realistisch.

**Konzepte nötig je Bereich** (Hebel = Fragen/Konzept):

| Fragen/Bereich | bei 3 F/Konzept | bei 10 F/Konzept |
|---|--:|--:|
| 1000 | ~333 | ~100 |
| 2000 | ~667 | ~200 |
| 5000 | ~1.667 | ~500 |

**Geschätzte Zeit** (redesignte Pipeline, ~350 verif. Konzepte je ~30-min-Zyklus über 5 Bereiche):

| Ziel/Bereich | @10 F/Konzept | @3 F/Konzept |
|---|---|---|
| 1000 | ~0,75 h | ~2,5 h |
| 2000 | ~1,5 h | ~5 h |
| 5000 | ~3,5 h | ~12 h |

**Token grob (Sonnet):** ~1,6 Mio/Zyklus → 5000@10 ≈ 11 Mio, 5000@3 ≈ 38 Mio. Mit Wikidata-
Bulk + Generator-Hebel deutlich darunter. **Kernaussage:** mehr Fragetypen/Konzept schlägt mehr
Konzepte um Längen.

## Gelernte Stolpersteine

- **Finder erfinden Bild-URLs**, wenn sie Bilder selbst auflösen sollen: 3 von 16 Findern
  (verraten durch winzige Tool-Nutzung 5–10) lieferten 54 nicht existierende Commons-Dateien.
  → Bilder nie vom Sammel-LLM, immer deterministisch (Phase C).
- **Copyright-Landmine:** Foto eines noch geschützten 2-D-Werks ist NICHT frei (Guernica,
  Picasso †1973 → frei erst 2043), auch wenn der Fotograf CC vergibt. Werke mit Urheber-Tod
  **nach 1955** im Bild meiden. Siehe `BLACKLIST.md`.
- **IDs dürfen ASCII sein** (`weisser-hai`) — Slugs werden nie angezeigt. Echte Umlaute nur in
  **Anzeigefeldern** Pflicht (name, funFact, attributes-Werte). Attribut-**Keys** sind
  Identifier → besser Englisch/konsistent (`heightM` statt `hoeheM`), Normalisierung beim Merge.
- **Rate-Limit-Klartext bricht JSON-Parser** (s. o.).
