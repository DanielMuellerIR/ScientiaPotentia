# Semantischer QA-Report

Modell: `codex/gpt-5.6-terra`

Batches: 1 · Fragen: 12 · bewertet: 12

## Zusammenfassung

- Urteil **behalten**: 10 · **überarbeiten**: 2 · **verwerfen**: 0
- Selbstverräter stark/schwach/keiner: 1/1/10
- Distraktoren defekt/schwach/gut: 1/0/11
- Wissensniveau zu_obskur: 0 · Klarheit unklar: 0
- Mögliche Sachfehler (keyDoubt): 0

## 🟠 Starker Selbstverräter (1)

- **[natura/natura-animal-class]** Zu welcher Tierklasse gehört Dominikaner-Kardinal?
  - Antwort (keyed): Vögel
  - Grund: „Kardinal“ bezeichnet hier erkennbar einen Vogel.
  - Probleme: Der Name „Kardinal“ verrät die Vogelklasse praktisch direkt.

## 🔵 Sonstige überarbeiten/verwerfen (1)

- **[natura/natura-animal-lifespan-rev]** Welches dieser Tiere kann bis zu 30 Jahre alt werden?
  - Antwort (keyed): Gürteltier
  - Urteil: ueberarbeiten · Distraktoren: defekt (Auch Steinadler können etwa 30 Jahre alt werden.)
  - Probleme: Steinadler ist neben Gürteltier ebenfalls mit etwa 30 Jahren vereinbar.
