> Arbeits-/Ergebnisdokument. Erarbeitet 2026-07-01/02 aus 5 parallelen Internet-Recherche-
> Agenten (Fragen + Bildquellen für Homo), jede Angabe gegen die deutsche Wikipedia belegt.
> Fortsetzung von `docs/homo_erweiterung.md` (Runde 1, 2026-06-24).

# Homo-Erweiterung Runde 2 — Recherche, Fragen-Ernte, Bildquellen

Stand: 2026-07-02. Ausgangsbestand vor dieser Runde: **485 Konzepte / 1396 Fragen / 173 Bilder** in
16 Kategorien. Nach dieser Runde: **599 Konzepte / 1600 Fragen / 304 Bilder** in 19 Kategorien.

## 0. Auftrag & Methode

Intensive, parallele Internet-Recherche nach (a) weiteren fairen Fragen und (b) freien Bildquellen
für Homo; danach dokumentieren und mit der Ernte beginnen. Umgesetzt über **5 parallele Recherche-
Agenten** mit WebSearch/WebFetch, jeder gegen die Bestandslisten dedupliziert:

| Agent | Auftrag | Ergebnis (verifiziert) |
|---|---|---|
| 1 | psych_effect ausbauen (Wikidata Q1127759 hat ~115 mit dt. Artikel, Bestand erst 56) | **+38** kognitive Verzerrungen |
| 2 | hormone / digestive_enzyme / nutrient_macro-Lücken | **+12 / +5 / +6** |
| 3 | Neue faire Kategorien: Blutgruppen, Gelenke, Reflexe | **+8 / +11 / +7** |
| 4 | muscle / nerve — weitere bekannte Vertreter | **+20 / +7** (1 Dublette `nerv-accessorius` verworfen) |
| 5 | Bildquellen für die 11 Kategorien mit 0 Bildern | Plan + Live-Stichprobe (s. §3) |

Harte Integritätsregel eingehalten: jede Angabe mit benannter freier Quelle (fast durchweg
de.wikipedia), keine erfundenen Zahlen; Bereichsgrenzen (keine Krankheiten als Subjekt, keine
Entdeckungsdaten/Personen → Historia) beachtet.

## 1. Gefundene & eingepflegte Fragen (+114 Konzepte, +204 Fragen)

**Bestehende Kategorien** (kein Generator-/Label-Eingriff nötig — Templates greifen automatisch):
- **psych_effect 56 → 94** (+38): u. a. Kontrollillusion, Priming, Déjà-vu, Stroop-Effekt, McGurk-
  Effekt, Weber-Fechner-Gesetz, Habituation, Gruppenpolarisierung, Ringelmann-Effekt, Flow,
  Imposter-Phänomen, Asch-Konformität, Wahrheitseffekt. Verworfen: Namens-Fallen (Rückschlageffekt =
  Kettensäge, Naiver Realismus = Erkenntnistheorie, Mandela-Effekt = Personseite).
- **hormone 29 → 41** (+12): Renin, Angiotensin II, ANP, hCG, DHEA, MSH, Relaxin, ACTH, Histamin,
  Inhibin, GnRH, Motilin.
- **digestive_enzyme 12 → 17** (+5): Enteropeptidase, Pankreas-Elastase, Aminopeptidase, Ribonuklease,
  Desoxyribonuklease. (Attribut-Keys `origin`/`productOrFunction` → Bestandsschema `gland`/`function`
  angeglichen.)
- **nutrient_macro 13 → 19** (+6): Selen, Kupfer, Mangan, Fluor, Molybdän, Kobalt. (Verworfen: Chlorid
  = rein chemischer Artikel, Chrom = 2014 von EFSA als essenziell gestrichen.)
- **muscle 63 → 83** (+20): Vastus lateralis/medialis, Adductor magnus, Piriformis, Pronator teres,
  Platysma, Corrugator supercilii, Erector spinae, Transversus abdominis, Quadratus lumborum u. a.
- **nerve 22 → 29** (+7): N. musculocutaneus, obturatorius, saphenus, suralis, Nn. intercostales,
  N. gluteus superior, N. thoracicus longus. (Accessorius war bereits als „Beinerv" vorhanden →
  Dedup fing das ab; damit alle 12 Hirnnerven komplett.)

**Drei neue Kategorien** (Generator-Templates + Labels + Leak-Geschwister neu verdrahtet):
- **joint (Gelenk), +11**: 6 Gelenktypen (Kugel-/Scharnier-/Sattel-/Dreh-/Ei-/ebenes Gelenk) + 5
  benannte Gelenke (Knie/Hüfte/Schulter/Ellbogen/Sprung). Fragen: Gelenktyp-Vorwärts + Knochen-Reverse.
- **reflex (Reflex), +7**: Patellarsehnen-, Lidschluss-, Pupillenlicht-, Würge-, Husten-, Moro-,
  Greifreflex. Fragen: Reflexart-Vorwärts + Reiz-Reverse + Reaktion-Reverse.
- **blood_group (Blutgruppe), +8**: A/B/AB/0, Rhesus±, Universalspender/-empfänger. Fragen NUR für die
  4 AB0-Gruppen (Antikörper-Zuordnung A→Anti-B, vorwärts + reverse); Rhesus/Universal via `skip`
  ausgenommen (semantisch überlappende Freitexte → kein sauberer Distraktorpool), bleiben als Konzepte.

**Fairness-/Leak-Absicherung neuer Kategorien** (`src/components/conceptLabels.js`):
`LEAKY_SIBLINGS` erweitert — bei jointType-Frage `movement` ausblenden („dreiachsig" verriete
Kugelgelenk), bei reflexType-Frage `stimulus`/`response`, bei Blutgruppen `antigen`↔`antibody`
(komplementär). Der bestehende `revealsAnswer`-Guard verwirft zusätzlich selbstverräterische Fälle
automatisch (z. B. „Kniescheibe" im Knochen-Hinweis verriete „Kniegelenk"). Regressionstest in
`src/__tests__/conceptLabels.test.js` (+5 Fälle, 32/32 grün).

## 2. Generator-/Label-Änderungen (Code)

- `scripts/generate_homo.js`: 7 neue Template-Einträge (joint ×2, reflex ×3, blood_group ×2) am Ende
  der `templates`-Liste. Klammer-Zusätze in `jointType`/`reflexType` werden fürs Optionsformat
  gestrippt (gleichförmige, nicht längen-verräterische Optionen).
- `src/components/conceptLabels.js` + `src/components/HomoVisual.jsx`: Kategorie-Labels (Gelenk/Reflex/
  Blutgruppe) + Attribut-Labels (jointType/bonesInvolved/movement/stimulus/response/reflexType/
  antigen/antibody) ergänzt; `LEAKY_SIBLINGS` erweitert (s. o.).

## 3. Bildquellen — Ergebnis (+131 Bilder, 173 → 304)

**Kernbefund (Agent 5):** Der gebündelte Resolver `resolve_images_batched.cjs` kannte Homo nur für die
alten Anatomie-Kategorien (`bone/muscle/organ/body_fact/species`) — die 11 neueren Kategorien fehlten
komplett in `TARGETS.homo` → 0 Bilder. Die de.wikipedia-Hauptbilder (Histologie, Gray's-1918-Stiche,
Anatomiegrafiken) sind über die bestehende, deterministische Pipeline verfügbar.

**Umgesetzt:** `TARGETS.homo` um `cell_type, hormone, nerve, sense, brain_lobe, digestive_enzyme,
development_stage, sleep_perception, joint` erweitert → Resolver → `apply_images` → `check_images`
(live-Lizenz/MIME-Validierung) → Prune → regeneriert. Ergebnis der Ernte:

| Kategorie | vorher | nachher |
|---|---|---|
| cell_type | 0 | 36/47 |
| hormone | 0 | 33/41 |
| nerve | 0 | 20/29 |
| joint | 0 | 8/11 |
| digestive_enzyme | 0 | 7/17 |
| development_stage | 0 | 7/10 |
| brain_lobe | 0 | 4/4 |
| sense | 0 | 3/6 |
| sleep_perception | 0 | 2/12 |

9 `.webm`-Videos automatisch verworfen (MIME-Filter). Zwei thematisch falsche Auto-Treffer bei der
Pflicht-Sichtkontrolle entfernt: **Fötus → `Catfetus1.jpg` (Katzenfötus)** und **Ebenes Gelenk →
`Scharniergelenk_Ellbogen.jpg` (falscher Gelenktyp)**. Museum-Filter „Mensch & Körper" zeigt live 304.

**Bewusst OHNE Bild** (Sonderweg/Verzicht, s. Agent-5-Analyse):
- **psych_effect (94):** abstrakt, nicht sinnvoll/eindeutig fotografierbar → bewusst kein Bild.
- **vitamin (13):** alle `sourceUrl` zeigen aufs Sammel-Lemma „Vitamin" → Pipeline nutzlos; Einzel-
  Lemmata lieferten nur nichtssagende Strukturformeln. Niedrige Priorität / Verzicht.
- **nutrient_macro (19):** Lemma-Kollisionen (mehrere Konzepte teilen generisches Lemma) → erst
  `sourceUrl` entzerren; geringe Priorität.
- **blood_group (8), reflex (7):** nicht in TARGETS aufgenommen (Diagramm-/Fehlbild-Risiko) → eigener
  vetteter Lauf, falls gewünscht.

## 4. Offen / nächste Schritte

- **reflex-Bilder — erledigt (v1.84.1):** vetteter Resolver-Lauf durchgeführt (`reflex` in
  `TARGETS.homo` aufgenommen). Von 7 Konzepten liefern nur 3 ein de.wiki-Hauptbild, davon 1 ein
  `.ogv`-**Video** (Moro-Reflex, für `<img>` untauglich → verworfen). Angewendet: **2 visuell
  gegengeprüfte GIFs** — Lidschlussreflex (Auge, CC BY-SA 3.0) + Pupillenlichtreflex (Pupille, PD).
  Die übrigen 5 Reflexe (Patellarsehnen-/Würge-/Husten-/Greif-/Moro-) bleiben bildlos.
- **blood_group-Bilder — bewusst verzichtet (v1.84.1):** 6 der 8 Konzepte teilen sich das Lemma
  `AB0-System`, 2 das Lemma `Rhesusfaktor` → alle bekämen dasselbe Schemabild (Duplikate, kein
  konzeptgenaues Bild). NICHT in `TARGETS` aufgenommen; nur mit Handauswahl sinnvoll.
- **vitamin/nutrient_macro — `sourceUrl` entzerrt, Bilder verzichtet (v1.84.1):** Alle 13 Vitamine
  zeigten aufs Sammel-Lemma „Vitamin" → jetzt je eigenes Lemma (`Vitamin_A` … `Vitamin_K`) + präziser
  `sourceName`. Bei nutrient_macro die 5 generischen (magnesium/natrium/phosphor → `Mengenelemente`,
  zink → `Spurenelement`, ballaststoffe → `Kohlenhydrate`) auf ihr Fach-Lemma umgestellt;
  fette/proteine (Quelle `Physiologischer_Brennwert` belegt den 9-/4-kcal-Fakt korrekt) und wasser
  bewusst belassen. **Bilder weiter verzichtet** (nur Strukturformeln, Nutzen fraglich). Nebeneffekt:
  der Quellen-Selbstverräter-Guard blendete „Wikipedia: Mengenelemente" bei der Nährstoffklassen-Frage
  fälschlich aus (Token „Mengenelement") — mit dem Fach-Lemma wird die Quelle wieder korrekt gezeigt.
- **Ehrliches Ceiling (aus Runde 1 bestätigt):** Homo liegt bei ~1500–1700 Fragen, nicht 5000. Mit
  1600 Fragen ist das Reservoir fairer, belegter Homo-Konzepte weitgehend ausgeschöpft; weitere Masse
  gehört konzeptuell nach Natura (Mikroben) und Historia (Medizingeschichte).

## Relevante Dateien

- `scripts/data_sources/homo_raw.json` — Faktenbasis (599 Konzepte, +114 dieser Runde).
- `scripts/generate_homo.js` — Template-Logik (7 neue Einträge, Welle 5).
- `src/components/conceptLabels.js` + `src/components/HomoVisual.jsx` — Labels + `LEAKY_SIBLINGS`.
- `scripts/data_sources/harvest/resolve_images_batched.cjs` — `TARGETS.homo` erweitert.
- `docs/homo_erweiterung.md` — Runde 1 (Vorgänger).
