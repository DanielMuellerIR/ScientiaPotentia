> Strategiepapier (Wegwerf-/Arbeitsdokument), erarbeitet 2026-06-24 aus einem Multi-Angle-
> Opus-Recherche-Workflow (Finder + repo-verifizierte Synthese). Live-API-/Wikidata-Stichproben.

# Strategiepapier: Homo-Erweiterung jenseits der Anatomie

Stand: 2026-06-24 · Bestand Homo: 261 Konzepte / 718 Fragen in 5 Kategorien (bone 64, muscle 63, organ 58, body_fact 56, species 20)

## 0. Verifizierte Grundlagen (aus dem Repo, nicht aus den Vorschlägen)

Drei Befunde aus der echten Codebasis steuern alle Zahlen unten — sie korrigieren teils die Annahmen der eingereichten Blickwinkel:

1. **Reale Fragen-Ausbeute ist ~2,75 Q/Konzept, nicht „6 Templates = 6 Fragen".** 718 Fragen / 261 Konzepte. Die Generator-Templates (`scripts/generate_homo.js`) erzeugen pro Konzept *theoretisch* 4–8 Fragen, aber `skip`-Klauseln und der `revealsAnswer`-Guard (Z. 139, 522) streichen real die Hälfte weg. Jede „×6"-Hochrechnung in den Vorschlägen ist deshalb optimistisch und wird unten halbiert.
2. **Das Quellenmuster ist bereits etabliert und exakt das, was die Vorschläge fordern.** Bestandskonzepte tragen `source.name`/`source.url` auf `de.wikipedia.org`, `ninds.nih.gov`, `ncbi.nlm.nih.gov/books/`, `britannica.com`. Raw-Format in `scripts/data_sources/homo_raw.json` hat pro Item `sourceName` + `verifyNote` (Pflicht). Wikidata liefert nur Auswahl/Label/Bild — **die Sachattribute kommen aus benannter PD-Quelle**. Dieses Muster ist tragend und für alle neuen Kategorien zu übernehmen.
3. **Es gibt schon ein `body_fact`-Konzept `homo:ischiasnerv`** (`category: body_fact`, value = „Ischiasnerv"). Jede `nerve`-Kategorie muss dagegen deduplizieren (id-Kollision + semantisch).

Der Generator hat genau die Mechanik, die die Vorschläge voraussetzen: `byCategory`-Distraktorpool (Z. 283), `bodyFactDistractors` für numerische Streuung gleicher Einheit (Z. 79), `REGION_STEMS`/`revealsAnswer` als Selbstverräter-Guard (Z. 123, 139), `FAMILIARITY_OFFSET` zum Entschärfen grenzwertiger Begriffe (Z. 194). **Neue Kategorien brauchen keine neue Engine, nur neue Template-Einträge + Raw-Daten.**

---

## 1. Priorisierte Tabelle aller Vorschläge

Konzeptzahlen sind die **ehrlichen** Werte der Einreicher, wo plausibel; Fragen-Spalte ist **mein** korrigierter Wert (Konzepte × ~2,5–3, nicht × Template-Zahl). „Netto" zieht Dubletten zum Bestand ab.

| # | Kategorie (Label) | Konzepte (netto) | Realist. Fragen | Freie Quelle | Aufwand | Fairness-Risiko |
|---|---|---|---|---|---|---|
| 1 | **cell_type** – Zelltypen des Menschen | ~30 | ~85–110 | Wikidata (Auswahl/Bild) + Gray's/NIH (Attribute) | **niedrig** – SPARQL sauber (~30 Treffer), Muster=bone/muscle | **niedrig** – Schulstoff, Sitelink≥40 |
| 2 | **sense** – Die fünf Sinne | 6 | ~30–40 | Wikidata-QIDs + NIH/NEI/NIDCD (StatPearls NBK539861) | **niedrig** – 6 feste Konzepte, reverse-lastig | **sehr niedrig** |
| 3 | **nerve** – Nerven (Hirn-/periphere) | ~14 | ~45–60 | Wikidata (P31=Nerv) + StatPearls NBK470353 + Gray's | **mittel** – Dedup gg. `homo:ischiasnerv`, famous-Cut | **mittel** – nur ~6 Hirnnerven laienbekannt |
| 4 | **vitamin** – Vitamine (13er-Liste) | 13 (+~4 Mineral) | ~45–55 | de.WP „Vitamin"-Tabelle + NIH ODS Factsheets | **niedrig** – geschlossene Liste, kein SPARQL nötig | **niedrig** – B5/B6/B7 via FAMILIARITY_OFFSET |
| 5 | **hormone** – Hormone & Drüsen | ~26 | ~70–90 | NIH/MedlinePlus + Wikidata (nur Auswahl) | **mittel** – kein sauberes WP→Drüse, gland manuell belegen | **niedrig–mittel** – Releasing-Hormone raus |
| 6 | **immune_defense** – Abwehr & Immunsystem | ~16 (−~4 Dubl.) | ~40–55 | Wikidata (P279*=Leukozyt) + StatPearls/Gray's | **mittel** – Dedup gg. organ (Milz/Thymus/Lymphknoten existieren) | **mittel** – strikt nicht-pathologisch halten |
| 7 | **psych_effect** – Kognitive Verzerrungen | ~40 | ~110–140 | Wikidata Q1127759 (115 m. dt. WP) + dt.-WP-Definition | **hoch** – Attribute aus Freitext, Sonnet-Verifier nötig | **hoch** – 260→115→~40 Cut, Krankheits-/Historia-Falle |
| 8 | **digestive_enzyme** – Verdauungsenzyme | 12 | ~35–45 | de.WP „Verdauungsenzym" + OpenStax (CC BY) | **niedrig** – geschlossene Liste | **mittel** – nur ~5 laienbekannt, Rest Distraktorpool |
| 9 | **nutrient_macro** – Nährstoffe & Mineralstoffe | 13 | ~40–50 | de.WP Brennwert + NIH ODS | **niedrig** | **mittel** – Überlapp Calcium/Eisen mit body_fact |
| 10 | **vital_sign** – Vitalparameter | ~6–8 **netto** | ~20–30 | MedlinePlus/StatPearls | **mittel** – hoher Dublettenanteil zu body_fact | **mittel** – Diagnose-Schwellen verboten |
| 11 | **sleep_perception** – Schlaf/Gedächtnis/Wahrnehmung | ~30 (−Sinne) | ~70–90 | OpenStax + NIH/MedlinePlus | **mittel** – Überlapp mit `sense` (Sinne doppelt!) | **mittel** – Schlafstörungen=Krankheit raus |
| 12 | **genetic_disorder** – Erbkrankheiten | ~28 | ~70–90 | NIH MedlinePlus Genetics (kuratiert, **kein** SPARQL) | **hoch** – jedes Item handverifiziert | **hoch** – Krankheits-Grauzone, neutrale Sprache zwingend |
| 13 | **development_stage** – Entwicklungsstadien | ~14–20 | ~35–50 | OpenStax + MedlinePlus Fetal development | **mittel** | **mittel** – Abtreibungs-/Lebensbeginn-Debatte meiden |
| 14 | **brain_lobe** – Großhirnlappen | 4 | ~12–18 | Wikidata-QIDs + StatPearls NBK537247 | **niedrig** | **hoch (strukturell)** – 4 Member = kein eigener Distraktorpool |
| 15 | **human_chromosome** – Chromosomen | ~8 | ~15–25 | Wikidata (24 vollständig) + MedlinePlus | **niedrig** | **hoch** – nur ~8 mit fairem Ratefakt, Rest obskur |
| 16 | **body_barrier** – Schutzbarrieren/Reflexe | ~7 | ~15–20 | NIH/StatPearls/Gray's | **niedrig** | **hoch** – Überlapp organ+immune_defense, Grenzfall |

**Doppelvorschläge:** `vitamin` und `nerve`/`sense`-Achse wurden von zwei Blickwinkeln unabhängig vorgeschlagen — das ist ein Konvergenz-Signal für Robustheit, nicht zwei getrennte Kategorien.

---

## 2. Dedup & Abgrenzung

### 2a. Gegen die 5 Bestandskategorien (verifiziert am echten `concepts_homo.json`)

| Neue Kategorie | Kollidiert mit Bestand | Abgrenzungsregel |
|---|---|---|
| **immune_defense** | `organ`: `homo:milz`, `homo:thymus`, `homo:lymphknoten`, `homo:mandeln`, `homo:lymphknoten_anzahl` (body_fact) existieren bereits | Milz/Thymus/Lymphknoten/Mandeln **bleiben in organ**. immune_defense nimmt nur die **Zellen** (Lymphozyt, Makrophage, Granulozyt, Plasmazelle, Antikörper). Netto-Neugewinn ~10–12, nicht 16. |
| **cell_type** | `body_fact`: `homo:lebensdauer_erythrozyten`, `…_leukozyten`, `homo:erythrozyten_pro_tag`, `homo:sehzellen_netzhaut`, `homo:neuronen_gehirn_86mrd` | Diese sind *Zahl-Fakten über* Zellen, nicht die Zelle als Konzept. cell_type führt **Erythrozyt/Leukozyt/Neuron als Funktions-Konzept** — keine id-Kollision, aber Reverse-Fragen dürfen nicht denselben Zahlfakt doppeln. |
| **nerve** | `body_fact`: `homo:ischiasnerv` (value=„Ischiasnerv") | **Harte id-Dedup.** Entweder Zahl-Fakt in body_fact belassen + Ischias funktional in nerve mit anderer id, oder id übernehmen. v1.50.0-Lehre (recycelte ids = stille Verdränger) beachten. |
| **vital_sign** | `body_fact`: `homo:koerpertemperatur`, `homo:ruhepuls`, `homo:blutdruck_systolisch/_diastolisch`, `homo:atemzuege_pro_minute`, `homo:herzminutenvolumen`, `homo:schlagvolumen`, `homo:atemzugvolumen` | **~7 der 12 vorgeschlagenen existieren schon.** Netto nur ~6 (Sauerstoffsättigung, pH-Blut, Blutzucker-Normbereich + measuredBy-Achse). **Empfehlung: keine eigene Kategorie**, stattdessen `measuredBy`/`normalRange`-Templates in body_fact. |
| **sense** ↔ **sleep_perception** | Beide Blickwinkel führen „Sehsinn/Hörsinn/Gleichgewichtssinn" | **Untereinander dedupen.** Sinne gehören in `sense`. sleep_perception behält nur Schlafphasen + Gedächtnisarten. |
| **brain_lobe** | `organ`: Cerebellum, Hirnstamm, Hippocampus, Thalamus, Hypothalamus, Mesencephalon, Corpus callosum | Lappen fehlen komplett → kollisionsfrei. Aber 4 Member zu wenig für eigenen Distraktorpool → **gemeinsamer Pool mit Hirn-organ-Konzepten**. |
| **body_barrier** | `organ`: `homo:haut`, `homo:magen`; body_fact „Größtes Organ" | Hohe Überlappung → **nur als Lückenfüller**, sonst Items in immune_defense/body_fact einsortieren. |

### 2b. Gegen Natura

- **cell_type/genetic_disorder/human_chromosome:** ausschließlich *menschliche* Zellen/Gene — keine Tier-/Pflanzenzellen, keine allgemeine Zellbiologie.
- **nutrient_macro:** Mineralstoffe nur als **Ernährungsfunktion** (Eisen→Sauerstofftransport), nicht als Gestein/Mineral (→ Natura/Geologie).
- **sense:** Tier-Sinne bleiben in Natura.
- **Erreger als Organismen** (Bakterien/Viren) gehören **nicht in Homo** → separate Natura-Kategorie `microbe` prüfen (per `docs/bereichs_abgrenzung.md` Z. 45).

### 2c. Gegen Historia (die kritischste Grenze)

`bereichs_abgrenzung.md` Z. 59: „Homo bleibt körperlich (keine Krankheiten, keine Kultur). Historischer Meilenstein → Historia." Konkret für jede neue Kategorie:

- **Keine Entdeckungsdaten/Personen.** vitamin: kein „wann entdeckt", hormone: kein „Banting/Insulin 1921", psych_effect: **nie** „wer hat den Effekt benannt" — immer nur das *beobachtbare Phänomen*. genetic_disorder: Achse ist Erbgang/Leitsymptom, nicht „Down 1866".
- **Krankheits-Tabu (Z. 46/520):** vitamin/nutrient_macro nennen Mangelkrankheit nur als *funFact* oder Reverse-Antwort, nie als Quiz-Subjekt. immune_defense/body_barrier strikt nicht-pathologisch (`Antikörper binden Erreger` ✓; `Krankheit bei Antikörpermangel` ✗). psych_effect: **psychische Störungen sind Krankheiten → komplett raus** (Depression/Phobie/ADHS). sleep_perception: Schlafapnoe/Insomnie raus. **genetic_disorder ist der heikelste Grenzfall** — formal Krankheiten; tragbar nur, weil die Achse Genetik/Erbgang ist und neutrale MedlinePlus-Sprache verwendet wird. Wenn die Orchestrierung „keine Krankheiten" hart auslegt, fällt diese Kategorie weg.

---

## 3. Umsetzungs-Fahrplan Top-3

Auswahl nach **(Fairness × Konzepte × niedriger Aufwand)**, mit Dedup-Realität verrechnet: **cell_type, hormone, vitamin**. (psych_effect hat mehr Konzepte, aber höchsten Aufwand + Historia/Krankheits-Risiko → Welle 2.)

### Gemeinsames Schema (alle drei)

Raw-Format wie `homo_raw.json`, Pflichtfelder `id, name, category, attributes{}, funFact, sourceName, verifyNote` (+ optional `imageFile/imageLicense/imageAttribution`). Der Generator wandelt das in das `concepts_homo.json`-Format mit `source.{name,url}`.

### 3.1 cell_type (höchste Tragfähigkeit, niedrigster Aufwand)

**Schema:** `system` (Blut/Nervensystem/Immunsystem/Fortpflanzung/Sinnesorgan/Bindegewebe — wie `organ.system`), `function` (dt. Funktionstext), `notableFor` (ratbare Beschreibung), `fachName` (optional, Reverse-Template), `location` (optional, regionAnswer).

**SPARQL (Auswahl + Label + Bild — verifiziert ~39 Treffer, nach Filterung ~30):**
```sparql
SELECT ?c ?cLabel ?sitelinks ?img WHERE {
  ?c wdt:P279* wd:Q7868 .              # subclass* of cell
  ?c wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 40)             # Notabilitätsgate (Astra-bewährt)
  OPTIONAL { ?c wdt:P18 ?img }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
} ORDER BY DESC(?sitelinks)
```
Manuell ausschließen: Pflanzenzelle, Protoplast, Spore, Endospore (Nicht-Mensch) und reine Oberbegriffe (Zelle, Gamet, Blutkörperchen). **Attribute NICHT aus Wikidata** — `system`/`function`/`notableFor` aus Gray's/NIH pro Konzept, mit `verifyNote`. Bild nur bei eindeutig PD/CC-Lizenz (pro Bild prüfen, wie im Bestand — viele Homo-Konzepte haben gar kein Bild, das ist ok).

**Generator-Templates** (analog bone/muscle, in `generate_homo.js` als neue Einträge):
```js
{ category:'cell_type', attr:'system',   type:'homo-cell-system',     difficulty:1 }
{ category:'cell_type', attr:'function', type:'homo-cell-function',   difficulty:2 }
{ category:'cell_type', attr:'function', type:'homo-cell-function-rev', difficulty:2, nameAnswer:true } // Funktion→Zelle
{ category:'cell_type', attr:'notableFor', type:'homo-cell-notable-rev', difficulty:2, nameAnswer:true }
{ category:'cell_type', attr:'fachName',  type:'homo-cell-latin',      difficulty:3 } // nur wo gesetzt
```
Selbstverräter-Guard: korrelierte Paare `system↔location` bei der Antwort gegenseitig ausblenden (analog `class↔order` in Natura). Der vorhandene `revealsAnswer`-Guard fängt Namens-in-Antwort-Fälle automatisch.

**Fragenzuwachs:** 30 Konzepte × ~3 (nach skip-Verlust) ≈ **85–110 Fragen**.

### 3.2 hormone (mittel — kein sauberes Wikidata→Drüse)

**Schema:** `gland` (Bildungsort), `function` (Hauptwirkung), `hormoneClass` (optional: Peptid/Steroid/Amin), `latinName` (optional).

**Sourcing:** Wikidata Q11364 nur für **Konzept-Auswahl** (liefert Marken-Schrott wie „dynepo" → manuell filtern auf die ~13–26 famosen). `gland` und `function` **aus NIH/MedlinePlus** belegen, da keine saubere WP-Property Hormon→Drüse existiert. Geschlossene Seed-Liste der bekannten Hormone (Insulin, Adrenalin, Cortisol, Testosteron, Östrogen, Melatonin, Thyroxin, Wachstumshormon, Glucagon, Oxytocin) + endokrine Drüsen (Schilddrüse, Nebenniere, Hypophyse — **prüfen: Schilddrüse/Nebenniere/Hypophyse existieren teils schon als organ** → Drüsen ggf. in organ belassen, hier nur Hormone).

**Templates:**
```js
{ category:'hormone', attr:'gland',    type:'homo-hormone-gland',    difficulty:2 } // welche Drüse bildet X?
{ category:'hormone', attr:'function', type:'homo-hormone-function', difficulty:2 }
{ category:'hormone', attr:'function', type:'homo-hormone-function-rev', difficulty:3, nameAnswer:true }
{ category:'hormone', attr:'gland',    type:'homo-hormone-gland-rev',    difficulty:2, nameAnswer:true } // welches Hormon aus Drüse Y?
{ category:'hormone', attr:'hormoneClass', type:'homo-hormone-class', difficulty:3 } // nur wo gesetzt
```
Famous-Cut: keine Releasing-Hormone (TRH, GnRH), keine obskuren Peptide. FAMILIARITY_OFFSET für grenzwertige (Glucagon, Oxytocin).

**Fragenzuwachs:** ~26 (eher ~20 nach Drüsen-Dedup) × ~3 ≈ **60–80 Fragen**.

### 3.3 vitamin (niedrigster Aufwand, geschlossene 13er-Liste)

**Schema:** `letter` (Vitamin C), `chemicalName` (Ascorbinsäure), `solubility` (fett-/wasserlöslich), `mainFunction`, `deficiencyDisease` (nur als Antwort/funFact, **nie** als Subjekt). Optional 4–5 Mineralstoffe (Eisen, Calcium, Jod, Magnesium) — aber Calcium/Eisen-Überlapp mit nutrient_macro/body_fact beachten → ggf. Mineralstoffe weglassen und rein bei 13 Vitaminen bleiben.

**Sourcing:** **Kein sauberes Wikidata** (P31=Q34956 liefert 3 Treffer inkl. Marke „Vitabrid C"). Quelle = de.WP „Vitamin"-Tabelle (kanonische 13er-Liste) + NIH ODS Factsheets pro Vitamin. Geschlossene Liste, **kein SPARQL nötig** — direkt als Raw-Seed.

**Templates:**
```js
{ category:'vitamin', attr:'solubility',   type:'homo-vitamin-solubility', difficulty:1 } // 2-Optionen → mit 2 Schein-Optionen auffüllen oder difficulty niedrig
{ category:'vitamin', attr:'mainFunction', type:'homo-vitamin-function',   difficulty:2 }
{ category:'vitamin', attr:'chemicalName', type:'homo-vitamin-chem',       difficulty:3 }
{ category:'vitamin', attr:'chemicalName', type:'homo-vitamin-chem-rev',   difficulty:3, nameAnswer:true }
{ category:'vitamin', attr:'mainFunction', type:'homo-vitamin-function-rev', difficulty:3, nameAnswer:true }
```
**Achtung solubility:** nur 2 mögliche Werte → reine 2-Auswahl ist zu leicht und liefert keine 4 Distraktoren. Entweder difficulty=1 mit künstlichen Plausibel-Optionen, oder dieses Template streichen und auf function/chemicalName setzen. `chemicalName` darf den `letter` nicht enthalten (Selbstverräter).

**Fragenzuwachs:** 13 × ~3,5 ≈ **45–55 Fragen**.

### Reihenfolge & Mechanik

1. Raw-Seeds erzeugen (cell_type via SPARQL-Harvest → manuell kuratieren; hormone/vitamin als Hand-Seed), jedes Item mit `verifyNote` + benannter Quelle. **Regel a halten: keine erfundenen Zahlen.**
2. Sonnet-Subagent-Verifikation pro Konzept gegen die genannte PD-Quelle (Modell-Tiering: Auswahl/Spec mit Opus, Verifikation parallel mit Sonnet).
3. Template-Einträge in `generate_homo.js` ergänzen (kein Engine-Umbau — `byCategory` greift automatisch, sobald Konzepte die neue `category` tragen).
4. Merge mit **id-Dedup gegen `homo_raw.json`** (v1.50.0-Lehre).
5. `verify_facts.js`/`verify_quiz.js` laufen lassen, dann Build + Preview.

---

## 4. Ehrliche Hochrechnung Richtung 5000

### Top-3 allein
| Kategorie | Konzepte (netto) | Fragen (realist.) |
|---|---|---|
| cell_type | ~30 | ~85–110 |
| hormone | ~20 | ~60–80 |
| vitamin | ~13 | ~45–55 |
| **Summe Top-3** | **~63** | **~190–245** |

**Homo nach Top-3: ~324 Konzepte / ~910–960 Fragen.** Das ist eine solide, ehrliche Erweiterung — aber meilenweit von 5000.

### Alle 16 Vorschläge (nach Dedup & realistischer Q-Ausbeute)
Konservativ über alle kollisionsfrei umsetzbaren Kategorien (psych_effect, sleep_perception, genetic_disorder, nerve, sense, immune_defense, digestive_enzyme, nutrient_macro, development_stage + die drei Top + kleine Beiwerk-Kategorien):

- **Faire Netto-Konzepte gesamt: ~260–340** (die Einreicher schätzen selbst „~90–150" für Psych, „~60–75" für Zellbio, „~38" für Ernährung — summiert plausibel ~300).
- **Realistische Fragen gesamt: ~750–1000 neu** (nicht „×6").

**Homo-Endstand bei voller Umsetzung aller Blickwinkel: ~520–600 Konzepte / ~1450–1700 Fragen.**

### Das nächste Ceiling — klar benannt

> **Homo erreicht über alle Anatomie-jenseitigen Blickwinkel zusammen ~1500–1700 Fragen, nicht 5000.**

Gründe, ehrlich:
1. **Das faire-famous-Reservoir des Menschen ist endlich.** Anatomie war mit 261 Konzepten weitgehend erschöpft; Physiologie/Kognition/Genetik addieren real ~300 Konzepte, dann beginnt überall Fachjargon (CD8+-Subtypen, Releasing-Hormone, OMIM-Einzelfälle, Carnegie-Stadien CS1–23, obskure Verzerrungen).
2. **Die Q-Ausbeute ist ~2,75/Konzept, nicht 6.** Der `revealsAnswer`-Guard und `skip` halbieren die Templates — das ist *gewollt* (Fairness > Masse) und nicht wegzuoptimieren ohne Qualitätsverlust.
3. **Krankheits- und Historia-Tabu schneiden hart.** Der naheliegendste Massen-Hebel (konkrete Krankheiten, Symptom→Organ, Erreger→Krankheit) ist in Homo regelwidrig (`bereichs_abgrenzung.md` Z. 46/59). Das ist eine *Inhalts*grenze, kein Skalierungsproblem.

**Wo die 5000 wirklich herkommen müssten** (außerhalb dieses Auftrags, als ehrliche Konsequenz):
- **Cross-Attribut- und Reverse-Hebel** stärker ausreizen (mehr Templates pro Konzept, wo der Guard es zulässt) — bringt vielleicht +30 %, nicht ×3.
- **Erreger → eigene Natura-Kategorie `microbe`** auslagern (regelkonform, eigener Bereich).
- **Medizingeschichte/Entdeckungen → Historia** (Insulin-Entdeckung, Anatomie-Pioniere, Impfung) — das ist substanzielles Material, gehört aber sauber in Historia, nicht Homo.

**Fazit:** Die Top-3 (cell_type/hormone/vitamin) sind der beste Aufwand-Nutzen-Schnitt und sofort umsetzbar (~190–245 Fragen, niedriges Risiko, Generator unverändert). Die vollständige Welle bringt Homo auf ~1500–1700 Fragen. **Homo wird realistisch nicht zur 5000er-Domain** — sein ehrliches Ceiling liegt bei rund einem Drittel davon; die Differenz gehört konzeptuell nach Natura (Mikroben) und Historia (Medizingeschichte), nicht in einen aufgeblähten Homo-Krankheitskatalog.

---

Relevante Dateien (absolut):
- `/Users/danielmuller/git/ScientiaPotentia/scripts/generate_homo.js` — Template-/Distraktor-/Guard-Logik (Z. 79 `bodyFactDistractors`, 123 `REGION_STEMS`, 139 `revealsAnswer`, 194 `FAMILIARITY_OFFSET`, 283 `byCategory`); hier neue Template-Einträge ergänzen.
- `/Users/danielmuller/git/ScientiaPotentia/scripts/data_sources/homo_raw.json` — Raw-Seed-Format (261 Items, `verifyNote`-Pflicht); hier neue Konzepte einpflegen, id-Dedup zwingend.
- `/Users/danielmuller/git/ScientiaPotentia/public/data/concepts_homo.json` + `questions_homo.json` — Generator-Output (261 Konzepte / 718 Fragen, ~2,75 Q/Konzept).
- `/Users/danielmuller/git/ScientiaPotentia/docs/bereichs_abgrenzung.md` — verbindliche Homo-Grenzen (Z. 46/59: keine Krankheiten/Kultur, Medizingeschichte→Historia).