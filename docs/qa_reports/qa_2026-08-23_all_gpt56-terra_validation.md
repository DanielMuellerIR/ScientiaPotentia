# Semantischer QA-Report

Modell: `codex/gpt-5.6-terra`

Batches: 1 · Fragen: 12 · bewertet: 12

## Zusammenfassung

- Urteil **behalten**: 11 · **überarbeiten**: 1 · **verwerfen**: 0
- Selbstverräter stark/schwach/keiner: 1/1/10
- Distraktoren defekt/schwach/gut: 0/1/11
- Wissensniveau zu_obskur: 0 · Klarheit unklar: 0
- Mögliche Sachfehler (keyDoubt): 0

## 🟠 Starker Selbstverräter (1)

- **[natura/natura-animal-class-rev]** Welches dieser Tiere gehört zur Tierklasse „Reptilien“?
  - Antwort (keyed): Schlegelsche Lanzenotter
  - Grund: A, C und D sind bereits an „Schmerle“, „Doktorfisch“ und „Rochen“ als Fische erkennbar; nur B bleibt als Reptil.
  - Probleme: Die drei Fischoptionen verraten Schlegelsche Lanzenotter als einzige Reptilienoption.
