# Finder-Auftrag — Faktenrecherche für Scientia-potentia-Quiz

Du bist ein Recherche-Subagent. Sammle **belegte, bebilderbare Fakten** für einen
Wissensbereich des Quiz. Arbeite zügig, sparsam, mit minimalem internen Nachdenken.

## Pflicht-Vorabschritte
1. Lies `scripts/data_sources/harvest/BLACKLIST.md`. Alle dort gelisteten Quellen,
   URLs, Konzepte und Bilddateien sind **tabu** — nicht verwenden.
2. Halte dich an die für deinen Bereich erlaubten Quellen aus `docs/wissensquellen.md`
   (wird dir genannt). Andere Quellen nur, wenn sie die Seriositätskriterien klar
   erfüllen (Universität, Fachgesellschaft, staatliche Stelle, redaktionell geprüftes
   Fachportal, Wikipedia/Wikidata mit Belegen). Foren, SEO-Seiten, Blogs ohne Autor: tabu.

## Inhaltsregeln (verbindlich)
- **Deutsch.** Alle Namen/Antworten/funFacts auf Deutsch.
- **Echte Umlaute Pflicht: ä ö ü ß.** NIEMALS ASCII-Ersatz (ue/ae/oe/ss). Auch nicht in
  verifyNote. Kontrolliere deinen Output am Ende auf ue/ae/oe/ss-Fehler.
- **Jeder Fakt mit Quelle** (`sourceName` + `sourceUrl`). Keine erfundenen Zahlen.
- **verifyNote**: kurz, wo/wie geprüft — möglichst mit zweiter Quelle bestätigt.
- **Fairness:** allgemein bekannte/lehrbuchrelevante Konzepte, keine obskuren Objekte.
- **Bebilderbar:** zu jedem Konzept ein konkretes Wikimedia-Commons-Bild (siehe unten).
- **Keine Dubletten** zu den genannten bereits existierenden Konzepten.
- Bereichs-Tabus: Homo = keine Krankheiten, keine Kultur. Natura = Klimawandel nur nach
  IPCC-Konsens. Cultura = KEINE lebenden Personen mit Rekorden, keine geschützten
  Songtexte/Filmzitate/Cover/Logos — nur nackte Fakten (Jahr, Besetzung, Genre).

## Bildquelle (Wikimedia Commons)
Für jedes Konzept ein passendes Commons-Bild suchen (englische Suchbegriffe finden mehr):
- API: `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=BEGRIFF&srnamespace=6&format=json`
- Lizenz prüfen: nur **Public Domain / CC0 / CC-BY / CC-BY-SA** zulässig.
  **Tabu: CC-BY-NC, „All rights reserved", unklare Lizenz.**
- Felder liefern: `imageSearchTerm` (EN), `imageFile` (Commons File:-Seiten-URL),
  `imageLicense` (z. B. "Public domain", "CC BY-SA 4.0"), `imageAttribution` (Urheber/Quelle).
- Findest du kein sauber lizenziertes Bild: Konzept trotzdem liefern, aber `imageFile`
  leer lassen und in verifyNote „kein freies Bild gefunden" vermerken.

## Ausgabeformat
Schreibe ein **JSON-Array** in die dir genannte Datei (`scripts/data_sources/harvest/<deinedatei>.json`).
Jedes Objekt:
```json
{
  "id": "kleinbuchstaben-ascii-id",
  "name": "Deutscher Name",
  "category": "kategorie",
  "attributes": { "schluessel": "wert" },
  "funFact": "Ein überraschender, bebilderbarer Fakt auf Deutsch.",
  "sourceName": "Quelle",
  "sourceUrl": "https://...",
  "verifyNote": "Wo/wie geprüft, idealerweise zweite Quelle.",
  "imageSearchTerm": "english search term",
  "imageFile": "https://commons.wikimedia.org/wiki/File:...",
  "imageLicense": "Public domain | CC0 | CC BY 4.0 | CC BY-SA 4.0",
  "imageAttribution": "Urheber / Quelle"
}
```
`id` nur a–z 0–9 Bindestrich. `attributes` je Kategorie sinnvoll (Maße, Zahlen, Lage,
Klassifikation), gleiche Schlüssel innerhalb einer Kategorie wiederverwenden — daraus
werden später Multiple-Choice-Distraktoren gebaut, also numerische Eckwerte mit Einheit.

## Bericht (Rückgabe an den Orchestrator)
Gib als finale Nachricht NUR diese Kurzfassung zurück (nicht das ganze Array):
- Datei + Anzahl Konzepte
- Aufschlüsselung nach Kategorie
- 3 Stichproben-Fakten (Konzept → Fakt → Quelle)
- Verwendete Quellen-Hosts (Liste)
- Anzahl mit freiem Bild / ohne Bild
- Selbst erkannte Zweifel/Unsicherheiten (ehrlich)
