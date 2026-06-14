# MiniMax-Harvest-Prompt — Vorlage (Gewinner aus Trial & Error 2026-06-14)

Vorlage für den **One-Shot**-Konzept-Harvest über MiniMax-M3
(`python3 ~/git/theplan/tools/llm_run.py minimax --max-tokens 40000 "<prompt>"`).
Hintergrund/Erkenntnisse: `theplan/knowledge/p_scientiapotentia.md`.

## Aufruf

```bash
python3 "$HOME/git/theplan/tools/llm_run.py" minimax --max-tokens 40000 \
  "$(cat prompt.txt)" > out.txt 2>err.txt
node mm_load.cjs out.txt --out=candidates.json   # Quote-Repair + bergungsfähiges Parsen
```

## Bewährte Prompt-Struktur (die fünf Pflicht-Bausteine)

1. **Rolle + Auftrag + Menge + Qualitätsanker.** „Du befüllst eine Faktendatenbank für ein
   deutsches Wissensquiz. Liefere **15–20** weltbekannte, lehrbuchrelevante `<Kategorie>`
   (KEINE obskuren) als reines JSON-Array." → Batchgröße bewusst klein halten (Strukturbrüche
   skalieren mit Output-Länge).
2. **Exklusionsliste** der bereits vorhandenen Konzepte (Dubletten sparen Nacharbeit).
3. **Vollständiges Ziel-Schema als Literal** — Feld für Feld, exakt die Keys, die der
   `generate_<domain>.js` erwartet. Das ist der Haupthebel: ohne Schema-Literal liefert MiniMax
   ein freies Schema (falsche Feldnamen, Strings statt Zahlen) und nichts ist pipeline-tauglich.
   Enum-Werte (z.B. Kristallsystem) als geschlossene Liste vorgeben.
4. **Harte Regeln** (Block am Ende):
   - „Gib NUR das JSON-Array aus, kein Text, kein Markdown."
   - „Echte Umlaute ä ö ü ß überall außer im id-Feld. Nie ue/ae/oe/ss als Ersatz."
   - „Zahlenfelder sind JSON-Zahlen, **kein Bereich** — nimm den **gängigen Lehrbuch-Einzelwert,
     gerundet** (NICHT den rohen Bereichs-Mittelwert: ergibt sonst 7.25/7.75)."
   - „Erfinde NICHTS. Unsicher → Feld weglassen. Lieber weniger, dafür sichere Werte."
5. **Quellen-Pflicht:** `sourceUrl` auf ein de.wikipedia-Lemma, `verifyNote` möglichst mit
   Wikidata-Q-Nummer.

## Was Prompting NICHT fixt (immer deterministisch nachziehen)

- **Mixed-Quote-Bug** (`„…"`): trotz Regel → `mm_load.cjs` macht den Repair.
- **Mohs-/Zahl-Mittelwerte** auf 0.5 runden: `Math.round(x*2)/2`.
- **Fakten-Stichprobe (Opus):** Lemma-Existenz gebündelt prüfen
  (`de.wikipedia.org/w/api.php?action=query&titles=A|B|…`) + strukturierte Werte reviewen
  (Restfehlerquote ~2 %, z.B. ein falsches Kristallsystem pro ~40 Mineralen).

## Beispiel (Natura-Minerale, gekürzt)

```
Du befüllst eine Faktendatenbank für ein deutsches Wissensquiz. Liefere 16 weltbekannte
ERZ-Minerale (KEINE Schmucksteine, KEINE obskuren) als reines JSON-Array.
AUSSCHLUSS: Diamant, Quarz, Gold, Graphit, Talk.

Schema je Objekt (Felder exakt so):
{"id":"<klein, Umlaute als ae/oe/ue/ss NUR hier>","name":"<deutsch, echte Umlaute>",
"category":"mineral","attributes":{"mohsHardness":<Zahl, kein Bereich>,
"kristallsystem":"<genau eines: kubisch|hexagonal|trigonal|tetragonal|orthorhombisch|monoklin|triklin>",
"chemischeFormel":"<z.B. SiO2>","dichte":<Zahl g/cm3, weglassen wenn unsicher>},
"funFact":"<1-2 Sätze>","sourceName":"de.wikipedia.org – <Name>",
"sourceUrl":"https://de.wikipedia.org/wiki/<Lemma>","verifyNote":"<Quelle, möglichst Wikidata-Q>",
"imageSearchTerm":"<englischer Commons-Begriff>"}

HARTE REGELN:
- Gib NUR das JSON-Array aus, kein Text, kein Markdown.
- Echte Umlaute ä ö ü ß überall außer im id-Feld. Nie ue/ae/oe/ss als Ersatz.
- mohsHardness/dichte sind JSON-Zahlen, kein Bereich (gängiger Lehrbuchwert, auf 0.5 gerundet).
- kristallsystem exakt aus der Liste, kleingeschrieben.
- Erfinde NICHTS. Unsicher → Feld weglassen. Lieber weniger, dafür sichere Werte.
```
