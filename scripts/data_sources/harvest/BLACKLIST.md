# BLACKLIST — gesperrte Quellen/Domains/URLs für die Recherche

> Wird vom Orchestrator (Opus) nach jeder Stichproben-Runde gepflegt.
> Jeder Finder-Subagent MUSS diese Datei vor Arbeitsbeginn lesen und die hier
> gelisteten Quellen/URLs/Konzepte komplett meiden. Stand wird je Runde ergänzt.

## Generelle Regel (NEU nach Stichprobe Welle 1)
- **Foto eines noch geschützten 2D-Kunstwerks ist NICHT frei** — auch wenn der Fotograf
  das Foto unter CC stellt. Das Urheberrecht am abgebildeten Werk bleibt. Werke, deren
  Urheber **nach 1955** starb (70 Jahre p.m.a.), sind im Bild TABU. Nur Fakten erlaubt,
  aber lieber ganz meiden, weil das Quiz ein freies Bild braucht.
- `sourceUrl` möglichst auf **de.wikipedia.org oder Primärquelle** setzen (nicht en.wikipedia),
  damit der Quellenlink für deutsche Nutzer taugt.

## Gesperrte Quellen (Domain/Host)
<!-- noch keine -->

## Gesperrte Einzel-URLs
- https://commons.wikimedia.org/wiki/File:Pablo_Picasso%27s_Guernica.jpg — Foto eines
  urheberrechtlich geschützten Picasso-Werks (frei erst 2043). NICHT verwenden.

## Gesperrte/abgelehnte Konzepte oder Fakten (mit Grund)
- **Guernica (Picasso)** — Werk bis 2043 geschützt, kein freies Bild möglich. Konzept
  komplett streichen, nicht erneut vorschlagen.

## Korrekturen (Fakt war falsch — richtiger Wert)
- Kaiserpinguin `maxTauchtiefeM`: **564** (nicht 535). Rekord Polar Biology 2006 /
  Guinness. Max. Tauchzeit Rekord 32,2 min (2018).

## Gesperrte Bildquellen / Bilddateien (Lizenzgrund)
- Alle Fotos/Scans von Werken mit Urheber-Tod nach 1955 (siehe generelle Regel oben).

## Fachlich falsche Bildzuordnungen

`IMAGE_BLACKLIST.json` enthält unter `rejectedMappings` geprüfte Kombinationen
aus Konzept-ID und Commons-Dateititel samt Begründung. Die Sperre gilt nur für
diese Kombination, nicht für das Konzept oder die Datei insgesamt. So darf ein
Webb-Teleskopspiegel weiterhin Webb illustrieren, aber nicht Hubble. Resolver,
Bildanwendung, Merge und Bildnachweis-Audit prüfen dieselbe Liste.
