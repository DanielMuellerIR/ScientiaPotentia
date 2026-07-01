# MiniMax-QA — semantische Qualitätssicherung der Quizfragen

Ein Werkzeug, das das üppige MiniMax-Abo-Volumen nutzt, um Quizfragen **inhaltlich**
zu prüfen — dort, wo strukturelle Checks (`verify_facts.js`, `audit_questions.cjs`)
nicht hinreichen: Verrät eine Frage ihre Antwort selbst? Ist sie zu extremes
Expertenwissen oder abwegig/unverständlich? Sind die Distraktoren fair? Stimmt die
hinterlegte Antwort überhaupt?

Die Bewertung ist **mehrdimensional** (nicht binär gut/schlecht) und benennt
**konkrete Probleme**.

## Kernidee: Effizienz durch Template-Stratifizierung

Fragen entstehen aus **Templates** (Feld `type`) über viele Konzepte. Ein Defekt in
einem Template betrifft potenziell tausende Fragen. Statt zufällig zu sampeln, ziehen
wir pro (`domain` × `type`) nur *k* Instanzen — so „deckt" jede MiniMax-Bewertung eine
ganze Template-Familie ab. Das findet **systematische** Fehler (Template-Bug,
schlechter Attribut-Leak) statt Einzelfälle und nutzt das Volumen sparsam.

## Was MiniMax sieht (Panel-Treue)

Für jede Frage wird exakt die **Spieler-Sicht vor dem Antworten** nachgebaut:
Prompt, gemischte Optionen, und der Text des linken Panels (Kategorie, Name oder „?",
die ≤6 sichtbaren Kennwerte **nach** Selbstverräter-Guard, Quelle). Die Filterlogik
teilt sich `build_batches.mjs` mit dem echten Panel über
[`src/components/conceptLabels.js`](../../src/components/conceptLabels.js) — driftet das
eine nicht mehr vom anderen.

Die richtige Antwort (`KEYED`) bekommt MiniMax nur zum Abgleich; der Spieler sieht sie
nicht. Die Optionen werden **deterministisch gemischt** (Seed = Frage-id), weil in den
Rohdaten die richtige Antwort oft auf Position 0 steht — sonst leakt die Position.

### Grenzen

- **Bild:** Das Quiz-Panel zeigt **kein Bild** (Bilder leben nur im Museum/Explorer).
  Ein „Bild-Giveaway" ist im Quiz daher nur bei **Astra** (3D-Planet) und **Homo**
  (Anatomie) möglich — deren grafische Visuals werden hier nur als „grafisch" markiert
  (Prompt/Optionen werden trotzdem geprüft). Echte visuelle Prüfung bräuchte ein
  Vision-Modell → separater Schritt.
- **Terra** (Karte) ist ausgeklammert.
- MiniMax ist stochastisch: zwei Läufe finden teils Unterschiedliches. Der Report
  liefert **Kandidaten für menschliche Sichtung**, kein Endurteil — besonders bei
  `keyDoubt` (Sachfehler-Verdacht) selbst gegenprüfen.

## Bewertungsdimensionen (pro Frage)

| Feld | Werte | Bedeutung |
| :--- | :--- | :--- |
| `eigeneAntwort` / `basis` / `confidence` | A–D / wissen·hinweis·raten / hoch·mittel·niedrig | MiniMax beantwortet selbst; `basis=hinweis` = ohne Wissen ableitbar |
| `selbstverraeter` | keiner·schwach·stark | Verrät Frage/Panel die Antwort? |
| `wissensniveau` | allgemein·gehoben·fachwissen·spezialwissen·zu_obskur | „zu_obskur" = absurd/unverständlich |
| `klarheit` | klar·leicht_mehrdeutig·unklar | Verständlichkeit/Eindeutigkeit |
| `distraktoren` | gut·schwach·defekt | „defekt" = Distraktor auch korrekt / Duplikat / ununterscheidbar |
| `keyDoubt` | bool | MiniMax hält eine andere Option für richtig (Sachfehler-Verdacht) |
| `urteil` | behalten·ueberarbeiten·verwerfen | Gesamturteil |
| `probleme` | [text] | Konkrete Stichpunkte |

**Kalibrierung:** Zahlen-/Maß-Distraktoren werden bewusst nach Größenordnung gestreut
(Fairness, v1.72.0). Die Rubrik weiß das und flaggt sie nicht als Mangel — nur echte
Defekte (mehrere richtige Antworten, ununterscheidbar nah, sinnlos) führen zu
`ueberarbeiten`/`verwerfen`.

## Aufruf

```bash
# 1. Stichprobe bauen (Spieler-Sicht je Frage → Batch-Dateien)
node scripts/qa_review/build_batches.mjs \
    --domain generic \        # oder: all | natura | natura,cultura
    --per-type 1 \            # k Instanzen je (domain × type)
    --batch 12 \              # Fragen pro MiniMax-Call (12 = truncation-arm)
    --seed 7 \
    --out <scratchdir>/qa_sweep

# 2. Bewerten (One-Shot MiniMax je Batch) → Markdown-Report + .raw.json
python3 scripts/qa_review/run_qa.py \
    --batches <scratchdir>/qa_sweep \
    --out docs/qa_reports/qa_<datum>_<scope>.md \
    --max-tokens 12000 --timeout 300 \
    [--limit 1]               # nur N Batches (Kalibrierung)
```

Der Runner ist **salvage-fähig**: läuft ein Batch ins Token-Limit, werden die
vollständigen Objekte gerettet und nur die abgeschnittene letzte Frage verworfen.

## Dateien

- `build_batches.mjs` — Sampling + Panel-Rekonstruktion (ESM, nutzt `conceptLabels.js`).
- `run_qa.py` — Bewertungs-Rubrik + MiniMax-Aufruf (über `~/git/theplan/tools/llm_run.py`)
  + Report-Aggregation. Die Rubrik steht als `RUBRIK`-Konstante oben in der Datei und ist
  der Ort zum Nachschärfen.
- Reports landen in `docs/qa_reports/` (Markdown + `.raw.json` mit allen Rohbewertungen).

## Nachschärfen (das „immer wieder kontrollieren")

1. Kleinen Kalibrierlauf (`--limit 1`) fahren, Rohbefunde stichprobenartig
   gegenprüfen (liegt MiniMax richtig? zu streng/zu lasch?).
2. `RUBRIK` in `run_qa.py` anpassen (Leitlinien-Block).
3. Erneut prüfen. MiniMax-Schwächen ins theplan-Qualitätslog eintragen.
