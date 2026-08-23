> **Historisches Strategiepapier, Stand 2026-06-24.** Die Zahlen, Prioritäten und
> Codebefunde unten sind Momentaufnahmen und keine aktuelle Arbeitsanweisung.
>
> **Aktueller Status 2026-08-23:** `resolve_images_batched.cjs` enthält inzwischen auch
> Historia, Homo und Machina; beide Pageimages-Resolver folgen Weiterleitungen. Der
> Batch-Resolver trennt Upload-Tracking-Parameter vom Commons-Dateinamen und filtert
> MIME-Typ sowie Lizenz vor dem Rawimport. Aktuelle Zählstände stehen in
> `public/data/domain_stats.json`; der verbindliche Ablauf ist
> [`content_pipeline.md`](content_pipeline.md). Neue Bilder bleiben Einzelentscheidungen
> mit Live-Lizenzcheck und Sichtprüfung, nicht die hier geschätzten Mengenhebel.

# Mehr freie Bilder fürs Museum — Strategiepapier

Historischer Stand: 2026-06-24. Domain: ScientiaPotentia (deutschsprachiges Multi-Domain-Quiz, werbefrei, offline-fähig).

Alle Zahlen unten sind, wo gekennzeichnet, aus Live-API-Stichproben der vier Analyse-Blickwinkel; die strukturellen Behauptungen (sourceUrl-Bestand, QID-Abwesenheit, Resolver-Targets, fehlendes `redirects=1`) habe ich gegen das echte Repo gegengeprüft — sie stimmen.

## 0. Verifizierte Ausgangslage (Repo-Check, nicht geschätzt)

| Domain | Konzepte | mit Bild | de.wiki-sourceUrl | Wikidata-QID | Befund |
|---|---|---|---|---|---|
| historia | 838 | **0** | 831 | **0** | QID-Resolver feuert nie; de.wiki-Weg-3 greift sofort |
| machina | 756 | **0** | 689 | 0 | hardware/concept fotofähig, Rest Logo-/SVG-Problem |
| homo | 261 | 83 | 115 | – | **nicht in `TARGETS`** des batched-Resolvers → 0 Fortschritt |
| natura | 2402 | 1093 | – | – | 1197 ohne Bild *und* ohne Wiki-URL (Tiernamen) |

Schlüsselbefunde aus dem Code:
- `resolve_images_batched.cjs` hat `TARGETS = {astra, natura, cultura, lingua}` — **homo, historia, machina fehlen komplett**. Das erklärt 0/0 ohne weitere Ursachenforschung.
- `resolve_images_p18_v2.cjs` löst über drei Wege auf (QID-P18 → DEWIKI_MAP → de.wiki-sourceUrl-pageimages) und prüft jede Datei live über `commonsInfoForTitle()` + `isFree()` (PD/CC0/CC-BY ja; NC/ND/SA nein). Das ist die abgesegnete, deterministische Pipeline.
- **`redirects=1` fehlt in beiden Resolvern** in den pageimages-Requests (`resolve_images_batched.cjs:98`, `resolve_images_p18_v2.cjs:336`). Das ist die wirksamste Ein-Zeilen-Härtung.

Konsequenz: Der größte Hebel ist **kein neuer Quellenstack**, sondern den bestehenden Resolver auf die nie geernteten Domains anzuwenden plus drei kleine Härtungen.

---

## 1. Priorisierte Maßnahmenliste

Sortiert nach Ertrag/Aufwand. „Bildzuwachs" = realistische, lizenzgefilterte, on-topic Treffer.

| # | Maßnahme | Quelle | Domain/Kategorie | Bildzuwachs (realistisch) | Aufwand | Lizenz-OK? |
|---|---|---|---|---|---|---|
| **1** | **natura erneut ernten** | de.wiki pageimages (Konzeptname als Titel) | natura/animal (1197 ohne Bild/URL) | **~700** (live 60 %, n=200) | niedrig | Ja, Commons-imageinfo |
| **2** | **historia-Resolver bauen** | de.wiki pageimages via sourceUrl + SPARQL-Sitelink→P18 | historia (alle 6 Kat.) | **~500–650** (live 75–93 %) | niedrig | Ja, P18/pageimages Commons-only |
| **3** | **homo in TARGETS aufnehmen** | de.wiki sourceUrl-pageimages | homo/{bone,muscle,organ,body_fact} | **~83** (live 49 %) | niedrig | Ja, meist PD Gray's Anatomy |
| **4** | **cultura nachernten** | bestehende Pipeline + Kat. composer/architecture/art_movement | cultura | **~200–250** | niedrig | Ja |
| **5** | **astra nachernten** | P18-Bündelung + de.wiki sourceUrl | astra/{asteroid,star,galaxy,nebula,constellation,comet} | **~150–200** (asteroid live 55 %) | niedrig | Ja |
| **6** | **machina hardware** | de.wiki sourceUrl-pageimages | machina/hardware (79) | **~50** (live 65 %) | niedrig | Ja, Geräte-Fotos, kein Logo |
| **7** | **machina übrige Kat. + Logo-Filter** | de.wiki pageimages mit Logo-Reject | machina/{concept,algorithm,data_structure,acronym} | **~100** | niedrig–mittel | Ja, **nur mit Logo-Filter** |
| 8 | Sekundär-Properties P41/P94/P1442 | Wikidata SPARQL (gleicher Call) | historia/{epoch,expedition,region} | +30–60 | niedrig | Ja, aber fachlich schwach |
| 9 | P373-Commons-Kategorie | Wikidata P373 → categorymembers | machina-Algo/DS, historia-invention Rest | +20–40 (unsicher) | mittel | Ja, hohes Fehlbild-Risiko |
| 10 | NASA Image Library | images-api.nasa.gov | astra-Missionen/Galaxien-Restlücken | +50–150 | mittel | PD (eng matchen) |
| 11 | Met / Smithsonian Open Access | collectionapi.metmuseum.org / api.si.edu | cultura, historia-Geräte | wenige Dutzend | mittel | CC0 (nur `isPublicDomain`) |
| 12 | GBIF→P225→P18 | api.gbif.org + Wikidata | natura-Tier-Misses (37 %) | +130–180 (teuer) | hoch | gemischt, iNaturalist-NC-Falle |
| 13 | Prozedurale SVG-Schemata | selbst generiert | machina/{data_structure 47, algorithm 97}, homo-Schemata | ~144 (deterministisch) | hoch | Trivial frei (Eigenwerk) |
| ✗ | **Nicht erzwingen** | – | cultura/quote(564), lingua/etymology(283), astra/{constant,exoplanet} | 0 (bewusst) | – | – |
| ✗ | **Lohnt nicht** | Openverse / PhyloPic | Zieldomains | ~0 unabhängig | mittel/hoch | Openverse meist SA |

Drei **Pflicht-Härtungen** am bestehenden Code (ziehen quer durch fast alle Maßnahmen):
1. **`redirects=1`** in jeden pageimages-Request (fängt Lemma-Weiterleitungen; ohne diesen Parameter stille `missing`-Lücken bei z. B. „Newtonsche_Mechanik"). Ein-Zeilen-Patch in beiden Resolvern.
2. **Nicht-Bild-P18 herausfiltern** (`.pdf/.tif/.webm`) bzw. via `Special:FilePath/<file>?page=1` als JPG rendern (betrifft v. a. astra-Wissenschaftsplots).
3. **Logo-Reject-Filter** vor `isFree()` (Dateiname-Heuristik `/logo|wordmark|icon|lettermark|brandmark|signet/i` **und** `extmetadata.Restrictions` auf `trademarked`/`insignia`). **Pflicht für machina**, sonst landen C++/Rust/Go/TypeScript-Markenlogos im Museum und verletzen Regel (b).

Querregel: nach **jedem** Lauf Ergebnis in `*_raw.json` zurückmergen (`imageFile`/`imageLicense`/`imageAttribution`) **und** `scripts/check_images.cjs` live laufen, bevor etwas ins Museum geht — fängt tote/umbenannte/Nicht-Bild-Dateien. Vor Massen-Merge je Kategorie eine 20–30er-Stichprobe im Museum-Tab visuell sichten (wie in den bisherigen Wellen).

---

## 2. Historia & Machina (die zwei Null-Bild-Domains)

### Historia — lohnt sich klar, deterministisch machbar

**Verifiziert:** 831/838 Konzepte tragen eine de.wikipedia-sourceUrl, **kein einziges eine QID**. Genau deshalb feuert der QID-Pfad nie und es gibt 0 Bilder — keine inhaltliche Schwäche, sondern fehlende Resolver-Konfiguration. Live-Proben der Analyse: 75 % (SPARQL-P18, n=235) bis 93 % (pageimages, n=30) haben ein Hauptbild; nach Lizenzfilter realistisch **~500–650 Bilder**.

Zwei deterministische Wege, beide ohne LLM/Freitext:
- **Weg A (Hauptweg): de.wiki-sourceUrl → pageimages.** Genau Weg 3 des bestehenden `resolve_images_p18_v2.cjs` (`dewikiTitleFromUrl()` → `dewikiPageimage()` → `commonsInfoForTitle()`). Greift sofort, weil die sourceUrls vorhanden sind. Einfachster Pfad.
- **Weg B (Komplement): dewiki-Lemma → QID → P18 via SPARQL-Sitelink.** `?sl schema:about ?item; schema:isPartOf <de.wikipedia.org>; schema:name "<Lemma>"@de. OPTIONAL { ?item wdt:P18 ?img }` in VALUES-Batches à ~150. Liefert thematisch oft das schärfer kuratierte Bild und Sekundär-Properties (P41/P94/P1442) im selben Call. Aufwendiger, aber höhere Trefferqualität bei figure (88 % Porträt-Quote).

Empfehlung: **Weg A zuerst** (kleinster Eingriff, deckt den Großteil), Weg B als Komplement nur für die Restmenge. **`redirects=1` ist hier kritisch** — ohne ihn ~12 % stille Lücken.

Ehrliche Grenze: Thematische Eignung ist nicht garantiert. Porträts (figure) klappen sehr gut; bei expedition/milestone zeigt P18 oft den Protagonisten statt Schiff/Karte (fachlich meist vertretbar). epoch ist am schwächsten (Karten/Wappen). Die ~20 % abstrakten Konzepte ohne gutes Hauptbild **bewusst ohne Bild lassen**, nicht mit schwachen Treffern verwässern.

### Machina — lohnt sich selektiv, klare Erwartung

**Verifiziert:** 689/756 de.wiki-sourceUrls, 0 Bilder. Aber die Kategorie-Verteilung entscheidet alles:
- **hardware (79):** live 65 % saubere Geräte-Fotos (CPU/GPU/RAM/SSD), kein Logo-Problem → **~50 Bilder. Hier anfangen.**
- **concept/algorithm/data_structure/acronym:** ~20–27 % Hauptbild-Quote, aber **massiv logobelastet** (gemessen: 27 von 38 freien PL-Bildern sind Logos). Nur mit Pflicht-Logo-Filter brauchbar → ~100 Bilder.
- **programming_language (12 % nach Logo-Abzug), network_protocol (4 %):** **bewusst sein lassen.** Hier ist die vorhandene prozedurale ConceptVisual-Karte die richtige Lösung, nicht ein erzwungenes Foto.

Realistischer Foto-Ertrag: **~150–200** (nicht 0→756). Für die 144 abstrakten DS/Algorithmus-Konzepte gibt es per Regel (d) gar kein faires Foto — der **einzige saubere Weg ist prozedurales SVG** (Maßnahme 13), gespeist aus den belegten Attributen (O-Notation etc.). Das ist echter Code (hoher Einmalaufwand), aber der einzige regelkonforme Pfad — und macht Machina visuell vollwertig.

**Fazit Null-Bild-Domains:** Historia lohnt sehr (deterministisch ~75 % füllbar, niedriger Aufwand). Machina lohnt selektiv (hardware sofort, Rest mit Logo-Filter, programming_language/protocol bewusst SVG/ConceptVisual statt Foto).

---

## 3. Gap-Filling-Plan via gebündeltem Resolver

Statt sechs Einzelskripten ein **kaskadierter, gebündelter Resolver** mit klarer Vorrangordnung pro Konzept — jeder Schritt nimmt nur, was der vorige nicht löste:

```
Pro Domain, pro Konzept ohne imageFile:
  1. QID in sourceUrl?           → Wikidata P18 (gebündelt, 50 QIDs/Request)
  2. de.wiki-sourceUrl?          → pageimages (gebündelt, 50 Titel/Request, redirects=1)   ← Historia/Machina/Homo Hauptweg
  3. (historia) Lemma→SPARQL-Sitelink→P18  → Komplement für Schritt-2-Lücken
  4. Konzeptname als Titel?      → pageimages (natura-Tiere ohne URL)
  5. Sekundär-Props P41/P94/P1442 (nur historia epoch/expedition, wo passend)
  6. P373-Kategorie (experimentell, nur machina-Algo/DS-Rest, klar markiert)

  → jede Kandidaten-Datei: Logo-Reject-Filter (machina) → ALLOWED_MIME → isFree()
  → Treffer: {imageFile, imageLicense, imageAttribution} mergen
  → check_images.cjs live validieren
```

Konkrete Bündel-Mechanik (übernimmt das Muster aus `resolve_images_batched.cjs`):
- pageimages: 50 Titel/Request, `redirects=1&maxlag=5`, Throttle ≥250 ms.
- SPARQL: POST an `query.wikidata.org/sparql`, `Accept: sparql-results+json`, VALUES-Batches à ~150, 60s-Timeout beachten, kleine Batches.
- Commons-Lizenz: gebündelter imageinfo-Call (50 Dateien/Request), wie schon vorhanden.
- Idempotent + 429-Backoff (im batched-Resolver vorhanden) → Lauf mehrfach wiederholbar.

So bleibt alles im Wikimedia-Ökosystem (kein LLM-URL-Risiko), die isFree()-Validierung unverändert, und `check_images.cjs` ist das Sicherheitsnetz vor jedem Commit. Externe APIs (NASA/Met/Smithsonian) erst **nach** dieser Kaskade als gezielte Restlücken-Füller — jeweils eigener kleiner Harvester, niemals als Massenhebel.

---

## 4. Empfehlung: Top-3 zuerst + was dafür zu bauen ist

**Top-3 nach Ertrag/Aufwand — zusammen ~1250–1500 neue freie Bilder, alle niedriger Aufwand:**

**① natura nachernten (~700 Bilder).** Größter Einzelhebel im ganzen Projekt. Ursache ist rein mechanisch: Resolver lief nach den Skalierungswellen 5–7 nie erneut gegen die neuen 1197 URL-losen Tiere.
- Bauen: `node resolve_images_batched.cjs natura` mit **`redirects=1`**-Patch. Ergebnis mergen → `check_images.cjs`. Kein neuer Code außer dem Ein-Zeilen-Patch.

**② historia von 0 auf ~500–650 Bilder.** Größter qualitativer Sprung (eine ganze Domain von null auf bebildert).
- Bauen: `resolve_images_historia.cjs` als Kopie von `resolve_images_p18_v2.cjs`. `ASTRA_FILE` → `historia_raw.json`, `TARGET_CATS` → alle 6 Kategorien. Weg 3 (de.wiki-sourceUrl) greift direkt; `redirects=1` ergänzen; SPARQL-Sitelink→P18 als Komplement für Lücken. Stichprobe pro Kategorie im Museum, dann mergen.

**③ homo + machina-hardware (~130 Bilder, fast „aus dem Nichts").** Beide brauchen nur Target-Konfiguration.
- Bauen homo: `TARGETS.homo = {muscle, bone, organ, body_fact, species}` in `resolve_images_batched.cjs` ergänzen (fehlt komplett), laufen → ~83 Bilder PD Gray's-Anatomy.
- Bauen machina-hardware: Resolver auf `category===hardware` mit de.wiki-sourceUrl, Logo-Filter aktiv → ~50 saubere Geräte-Fotos. Das verdoppelt den Machina+Historia-Block praktisch.

**Reihenfolge der Umsetzung:** Zuerst die **drei Härtungen** (`redirects=1`, Nicht-Bild-P18-Filter, Logo-Reject-Filter) einbauen — sie sind Voraussetzung für saubere Erträge in allen folgenden Läufen. Dann ①→②→③, jeweils Lauf → mergen → `check_images.cjs` → visuelle Stichprobe → Commit (Version-Bump).

**Danach (zweite Welle, mittlerer Aufwand):** cultura/astra nachernten (#4/#5, ~350–450), machina übrige Kategorien mit Logo-Filter (#7, ~100).

**Bewusst NICHT bauen:** Foto-Zwang für cultura/quote (564), lingua/etymology (283), astra/{constant, exoplanet} → prozedurale ConceptVisual-Karte statt irreführender/copyright-riskanter Fotos. Das macht zugleich die Abdeckungs-Statistik ehrlicher (cultura-Nenner ~1109→545, lingua ~656→190). Openverse (liefert für Technik fast nur Commons-SA-Dubletten) und PhyloPic (nur Silhouetten, Natura ohnehin gut versorgt) lohnen für die Zieldomains nicht.

**Offene Klärungen mit Daniel** (vor Umsetzung): (a) lingua-Bildlauf erst nach QID↔Name-Stichprobe — `lingua_raw.json` hat mind. einen Fehlbezug (Q13199 als „Birmanisch" getaggt, real Rätoromanisch → würde falsches Bild ziehen). (b) Sollen die Text-Kategorien (quote/etymology) im Museum überhaupt erscheinen (→ ConceptVisual) oder gar nicht? (c) Lohnt der hohe Einmalaufwand für die prozeduralen SVG-Generatoren der 144 machina-DS/Algorithmus-Konzepte, oder reicht dort die bestehende ConceptVisual-Karte?

---

Relevante Dateien (absolut):
- `/Users/danielmuller/git/ScientiaPotentia/scripts/data_sources/harvest/resolve_images_p18_v2.cjs` (Vorlage für historia/machina, drei Auflösungswege)
- `/Users/danielmuller/git/ScientiaPotentia/scripts/data_sources/harvest/resolve_images_batched.cjs` (`TARGETS`-Map Zeile 24 — homo/historia/machina fehlen; pageimages-Request Zeile 98 ohne `redirects=1`)
- `/Users/danielmuller/git/ScientiaPotentia/scripts/check_images.cjs` (Live-Validierung vor Commit)
- `/Users/danielmuller/git/ScientiaPotentia/scripts/data_sources/{historia,machina,homo,natura}_raw.json` (Merge-Ziele)
- `/Users/danielmuller/git/ScientiaPotentia/scripts/data_sources/harvest/BLACKLIST.md` (für machina-Logo-Erweiterung)
