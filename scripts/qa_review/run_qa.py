#!/usr/bin/env python3
"""QA-Runner — Schritt 2 der semantischen Qualitätssicherung.

Liest die von build_batches.mjs erzeugten Batch-Dateien (Spieler-Sicht je Frage),
schickt jeden Batch gebündelt an ein gewähltes Sprachmodell (über einen
konfigurierbaren One-Shot-Runner)
und lässt jede Frage MEHRDIMENSIONAL bewerten:

  - Das gewählte Modell beantwortet die Frage ZUERST selbst (nur aus Frage+Optionen+Panel) und
    sagt, ob es echtes Wissen brauchte oder die Antwort aus Panel/Prompt ableitbar
    war (→ Selbstverräter-Signal).
  - Vergleich mit der hinterlegten Antwort (keyDoubt = möglicher Sachfehler).
  - Bewertung: Selbstverräter, Wissensniveau (bis „zu obskur"), Klarheit,
    Distraktor-Qualität — plus konkrete Problem-Benennung und ein Urteil.

Warum One-Shot statt agentischem OpenCode: reine Text→JSON-Bewertung, keine Tools
nötig → ein One-Shot-Runner spart Zeit und liefert
sauberes JSON. Inhalte sind öffentlich (live deployt), kein Geheimnis-Belang.

Wichtig (Fairness): Die Optionen werden pro Frage DETERMINISTISCH gemischt, bevor sie
an das Modell gehen — in den Rohdaten steht die richtige Antwort oft auf Position 0; ohne
Mischen würde die Position die Lösung verraten (im echten Quiz mischt die App auch).

Aufruf:
    python3 scripts/qa_review/run_qa.py --batches <dir> --out docs/qa_reports/qa_<date>.md
    python3 scripts/qa_review/run_qa.py --batches <dir> --out <md> --limit 1   # nur 1 Batch (Kalibrierung)
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys

DEFAULT_LLM_RUNNER = os.environ.get('SCIENTIA_LLM_RUNNER', '')

LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

EVALUATION_ENUMS = {
    'eigeneAntwort': {'A', 'B', 'C', 'D'},
    'basis': {'wissen', 'hinweis', 'raten'},
    'confidence': {'hoch', 'mittel', 'niedrig'},
    'selbstverraeter': {'keiner', 'schwach', 'stark'},
    'wissensniveau': {'allgemein', 'gehoben', 'fachwissen', 'spezialwissen', 'zu_obskur'},
    'klarheit': {'klar', 'leicht_mehrdeutig', 'unklar'},
    'distraktoren': {'gut', 'schwach', 'defekt'},
    'urteil': {'behalten', 'ueberarbeiten', 'verwerfen'},
}
EVALUATION_TEXT_FIELDS = (
    'keyDoubtGrund', 'selbstverraeterGrund', 'distraktorenGrund',
)

# --- Bewertungs-Rubrik (System-/Aufgabenteil des Prompts) -------------------
# Bewusst knapp, streng, deutsch. Enums klein halten → stabiles JSON.
RUBRIK = """Du bist ein strenger Qualitätsprüfer für ein deutsches Wissens-Quiz (Multiple Choice).
Jede Frage zeigt dem Spieler: die FRAGE, die OPTIONEN (A–D) und ein LINKES PANEL
(genau der Text, den er VOR dem Antworten sieht). Die richtig hinterlegte Antwort
(KEYED) sieht der Spieler NICHT — sie dient dir nur zum Abgleich.

Bewerte JEDE Frage in diesen Schritten:
1. Beantworte die Frage SELBST, nur aus FRAGE + OPTIONEN + PANEL. Nenne den Buchstaben.
   Sag, worauf deine Wahl beruht:
     "wissen"  = echtes Sachwissen nötig,
     "hinweis" = aus Panel/Prompt ableitbar OHNE Wissen (z.B. Name steht in der Frage,
                 nur eine Option passt grammatisch/thematisch, Panel zeigt die Lösung),
     "raten"   = nicht bestimmbar, geraten.
2. Vergleiche mit KEYED. Wenn du ziemlich sicher bist, dass eine ANDERE Option richtig
   ist (möglicher Sachfehler in den Daten): keyDoubt=true, sonst false.
3. Bewerte die Dimensionen (nutze exakt die vorgegebenen Werte).
4. Liste konkrete Probleme als kurze deutsche Stichpunkte (leer, wenn keine).

Gib AUSSCHLIESSLICH ein JSON-Array zurück, ein Objekt pro Frage, ohne Text davor/danach,
ohne Markdown-Codefence. Schema pro Objekt:
{
 "id": "<exakt die id der Frage>",
 "eigeneAntwort": "A|B|C|D",
 "basis": "wissen|hinweis|raten",
 "confidence": "hoch|mittel|niedrig",
 "keyDoubt": true|false,
 "keyDoubtGrund": "<kurz, oder \\"\\">",
 "selbstverraeter": "keiner|schwach|stark",
 "selbstverraeterGrund": "<kurz, oder \\"\\">",
 "wissensniveau": "allgemein|gehoben|fachwissen|spezialwissen|zu_obskur",
 "klarheit": "klar|leicht_mehrdeutig|unklar",
 "distraktoren": "gut|schwach|defekt",
 "distraktorenGrund": "<kurz, oder \\"\\">",
 "urteil": "behalten|ueberarbeiten|verwerfen",
 "probleme": ["<stichpunkt>", ...]
}

Leitlinien:
- "selbstverraeter=stark" wenn man ohne jedes Wissen sicher richtig liegt (basis=hinweis
  und confidence=hoch).
- "wissensniveau=zu_obskur" nur bei absurd speziellem Wissen, das kaum ein gebildeter
  Erwachsener kennen kann ODER wenn die Frage unverständlich/abwegig ist.
- "distraktoren=defekt" NUR wenn ein Distraktor SACHLICH ebenfalls korrekt ist (mehrere
  richtige Antworten), ein Duplikat/synonym zur richtigen Antwort ist, oder die Optionen
  so nah beieinander liegen, dass selbst mit Fachwissen nicht trennbar. Das ist der
  schwerste Mangel.
- WICHTIG zu Zahlen-/Maß-Fragen: Distraktoren mit ABWEICHENDER GRÖSSENORDNUNG (z.B. 9 g /
  55 g / 550 g) sind ABSICHTLICH so gestreut (Fairness, damit die Antwort nicht durch
  „nimm den Mittelwert" ratbar ist). Das allein ist KEIN Mangel und rechtfertigt KEIN
  „ueberarbeiten". Dass eine Zahlenfrage exaktes/ungefähres Zahlenwissen verlangt, ist
  normal und kein Problem. Flagge Zahlenfragen nur, wenn sie WIRKLICH defekt sind (zwei
  Optionen praktisch gleich, oder die Frage ist sinnlos).
- Vergib "urteil=ueberarbeiten"/"verwerfen" sparsam und nur bei echtem Mangel
  (Selbstverräter stark, distraktoren defekt, unklar/mehrdeutig, zu_obskur, keyDoubt).
  Reine „ist halt Fachwissen"-Fragen sind BEHALTEN.
- Sei konkret in den Gründen (nenne die Option/den Begriff), kein Allgemeinplatz.

FRAGEN:
"""


def deterministic_shuffle(options, seed_str):
    """Optionen reproduzierbar mischen (Seed = Hash der Frage-id)."""
    h = int(hashlib.sha256(seed_str.encode('utf-8')).hexdigest(), 16)
    idx = list(range(len(options)))
    # Fisher-Yates mit dem Hash als Zahlenquelle.
    for i in range(len(idx) - 1, 0, -1):
        h, r = divmod(h, i + 1)
        idx[i], idx[r] = idx[r], idx[i]
    return [options[i] for i in idx]


def format_question(view, ref):
    """Eine Frage als kompakten Textblock für das Modell rendern. `ref` ist ein OPAKES
    Kürzel (F1, F2 …) statt der echten Frage-id — die id enthält Konzept-Slugs
    (z.B. 'maitake', 'hammerhai'), die der Spieler NIE sieht; würde das Modell sie
    sehen, flaggte es Selbstverräter, die real gar nicht existieren."""
    opts = deterministic_shuffle(view['options'], view['id'])
    keyed_letter = LETTERS[opts.index(view['keyedAnswer'])] if view['keyedAnswer'] in opts else '?'
    lines = [f"[{ref}]  Domain: {view['domain']} | Typ: {view['type']}"]
    lines.append(f"FRAGE: {view['prompt']}")
    for i, o in enumerate(opts):
        lines.append(f"  {LETTERS[i]}) {o}")
    # Panel
    if view.get('panelType') == 'karte':
        p = view['panel']
        lines.append("LINKES PANEL (Spieler-Sicht vor Antwort):")
        lines.append(f"  Kategorie: {p['categoryLabel']} | Name: {p['name']}")
        if p['visibleAttrs']:
            kv = ' · '.join(f"{a['label']}: {a['value']}" for a in p['visibleAttrs'])
            lines.append(f"  Kennwerte: {kv}")
        else:
            lines.append("  Kennwerte: (keine sichtbar)")
        if p.get('sourceName'):
            lines.append(f"  Quelle: {p['sourceName']}")
    elif view.get('panelType') == 'grafisch':
        lines.append(f"LINKES PANEL: grafisch — {view.get('panelNote', '')}")
    lines.append(f"KEYED: {keyed_letter}")
    return '\n'.join(lines)


def build_prompt(views):
    """Prompt + Rückmap ref->echte id bauen (opake Kürzel gegen Slug-Leak)."""
    ref2id = {}
    blocks = []
    for i, v in enumerate(views):
        ref = f"F{i + 1}"
        ref2id[ref] = v['id']
        blocks.append(format_question(v, ref))
    return RUBRIK + '\n\n'.join(blocks) + '\n\nJETZT das JSON-Array:', ref2id


def call_model(prompt, backend, model, max_tokens, timeout, effort, runner):
    """Einen Batch über den freigegebenen One-Shot-Backend bewerten lassen.

    MiniMax bleibt der bisherige Standard. Der Codex-Backend erlaubt einen
    nachvollziehbaren Lauf mit einem ChatGPT-Modell, ohne den Quiz-Checkout zu
    öffnen: ``llm_run.py`` startet ihn in einem leeren, schreibgeschützten
    Verzeichnis. ``max_tokens`` begrenzt MiniMax-Ausgaben; der Codex-Backend stellt
    keine maschinenlesbare Ausgabeobergrenze bereit und protokolliert deshalb
    nur den Modellnamen und den Reasoning-Aufwand im Report.
    """
    command = [
        sys.executable, runner, backend, '--model', model,
        '--max-tokens', str(max_tokens), '--timeout', str(timeout),
        '--category', 'todo-audit',
    ]
    if backend == 'codex':
        command.extend(['--effort', effort])
    proc = subprocess.run(
        command, input=prompt, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"llm_run exit {proc.returncode}: {proc.stderr.strip()[:400]}")
    return proc.stdout.strip()


def extract_json_array(text):
    """JSON-Array aus der Antwort ziehen. Salvage-fähig: Bei einer abgeschnittenen
    Modellantwort werden alle VOLLSTÄNDIGEN Objekte gerettet, ein
    abgeschnittenes letztes ignoriert — so kostet ein zu langer Batch nur die letzte
    Frage statt den ganzen Batch."""
    text = re.sub(r'```(?:json)?', '', text)  # Codefences entfernen
    start = text.find('[')
    if start < 0:
        raise ValueError("kein '[' in der Antwort")
    # Zuerst der schnelle Weg: ganzes Array.
    try:
        return json.loads(text[start:text.rindex(']') + 1])
    except (ValueError, IndexError):
        pass
    # Salvage: Objekt für Objekt mit raw_decode ab jeder '{'-Position.
    dec = json.JSONDecoder()
    out = []
    i = start + 1
    n = len(text)
    while i < n:
        while i < n and text[i] not in '{]':
            i += 1
        if i >= n or text[i] == ']':
            break
        try:
            obj, end = dec.raw_decode(text, i)
            out.append(obj)
            i = end
        except ValueError:
            break  # abgeschnittenes letztes Objekt → aufhören
    if not out:
        raise ValueError("kein vollständiges JSON-Objekt gerettet")
    return out


def validate_evaluation(evaluation):
    """Prüft das dokumentierte Modell-Ausgabeschema vollständig.

    Eine vorhandene ID allein darf nicht als Bewertung zählen: Andernfalls kann
    ein abgeschnittenes oder frei erfundenes Objekt einen grünen Exit-Code
    erzeugen, obwohl Report und Rohdaten keine verwertbaren Dimensionen tragen.
    """
    if not isinstance(evaluation, dict):
        return ['Objekt erwartet']
    problems = []
    if not isinstance(evaluation.get('id'), str) or not evaluation['id'].strip():
        problems.append('id fehlt oder ist kein Text')
    for field, allowed in EVALUATION_ENUMS.items():
        if evaluation.get(field) not in allowed:
            problems.append(f'{field} fehlt oder ist ungültig')
    if type(evaluation.get('keyDoubt')) is not bool:  # bool, nicht 0/1 akzeptieren
        problems.append('keyDoubt fehlt oder ist kein Boolean')
    for field in EVALUATION_TEXT_FIELDS:
        if not isinstance(evaluation.get(field), str):
            problems.append(f'{field} fehlt oder ist kein Text')
    if (not isinstance(evaluation.get('probleme'), list)
            or not all(isinstance(item, str) for item in evaluation['probleme'])):
        problems.append('probleme fehlt oder ist keine Textliste')
    return problems


def validate_view(view):
    """Validiert die Felder, die Promptbau und Rückzuordnung zwingend brauchen."""
    if not isinstance(view, dict):
        return 'Fragenobjekt erwartet'
    for field in ('id', 'domain', 'type', 'prompt'):
        if not isinstance(view.get(field), str) or not view[field].strip():
            return f'{field} fehlt oder ist kein Text'
    options = view.get('options')
    if not isinstance(options, list) or len(options) != 4:
        return 'options muss genau 4 Einträge enthalten'
    if not all(isinstance(option, str) for option in options):
        return 'options enthält einen Nicht-Textwert'
    if view.get('keyedAnswer') not in options:
        return 'keyedAnswer fehlt in options'
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--batches', required=True, help='Verzeichnis mit batch_*.json')
    ap.add_argument('--out', required=True, help='Markdown-Report-Pfad')
    ap.add_argument('--backend', choices=('minimax', 'codex'), default='minimax',
                    help='Bewertungsbackend (Standard: minimax)')
    ap.add_argument('--model', default=None,
                    help='Modellname; Standard: MiniMax-M3 bzw. gpt-5.6-terra')
    ap.add_argument('--effort', choices=('minimal', 'low', 'medium', 'high', 'xhigh'),
                    default='medium', help='Reasoning-Aufwand für den Codex-Backend')
    ap.add_argument('--max-tokens', type=int, default=8000,
                    help='Ausgabeobergrenze pro MiniMax-Aufruf; Codex protokolliert sie nicht')
    ap.add_argument('--timeout', type=int, default=600)
    ap.add_argument('--limit', type=int, default=0, help='nur N Batches (0=alle)')
    ap.add_argument('--runner', default=DEFAULT_LLM_RUNNER,
                    help='Pfad zu einem kompatiblen One-Shot-Runner; alternativ SCIENTIA_LLM_RUNNER setzen')
    args = ap.parse_args()
    model = args.model or ('gpt-5.6-terra' if args.backend == 'codex' else 'MiniMax-M3')

    if args.limit < 0:
        ap.error('--limit darf nicht negativ sein')
    if args.max_tokens <= 0:
        ap.error('--max-tokens muss positiv sein')
    if args.timeout <= 0:
        ap.error('--timeout muss positiv sein')
    if not os.path.isdir(args.batches):
        ap.error(f'Batch-Verzeichnis fehlt: {args.batches}')
    if not args.runner:
        ap.error('--runner fehlt und SCIENTIA_LLM_RUNNER ist nicht gesetzt')
    runner = os.path.abspath(os.path.expanduser(args.runner))
    if not os.path.isfile(runner):
        ap.error(f'One-Shot-Runner fehlt: {runner}')

    batch_files = sorted(
        (f for f in os.listdir(args.batches) if re.fullmatch(r'batch_\d+\.json', f)),
        key=lambda filename: int(re.search(r'\d+', filename).group()),
    )
    manifest_path = os.path.join(args.batches, 'manifest.json')
    if os.path.isfile(manifest_path):
        try:
            with open(manifest_path, encoding='utf-8') as handle:
                manifest = json.load(handle)
            batch_count = manifest.get('batchCount')
            if type(batch_count) is not int or batch_count < 0:
                raise ValueError('batchCount fehlt oder ist ungültig')
            expected_files = {f'batch_{index:03d}.json' for index in range(batch_count)}
            actual_files = set(batch_files)
            if actual_files != expected_files:
                missing = sorted(expected_files - actual_files)
                stale = sorted(actual_files - expected_files)
                details = []
                if missing:
                    details.append(f'{len(missing)} fehlen')
                if stale:
                    details.append(f'{len(stale)} sind nicht im Manifest')
                raise ValueError(', '.join(details))
        except (OSError, ValueError, json.JSONDecodeError) as error:
            ap.error(f'ungültiger Batch-Snapshot: {error}')
    if args.limit:
        batch_files = batch_files[:args.limit]
    if not batch_files:
        ap.error(f'keine batch_*.json-Datei in {args.batches}')

    # Ausgabeverzeichnisse vor dem ersten Modellaufruf anlegen. So scheitert ein
    # langer Lauf nicht erst beim Schreiben des Rohberichts.
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)

    all_views = {}
    all_evals = []
    errors = []
    loaded_batches = []
    view_origins = {}
    for bf in batch_files:
        try:
            with open(os.path.join(args.batches, bf), encoding='utf-8') as handle:
                views = json.load(handle)
            if not isinstance(views, list) or not views:
                raise ValueError('Batch enthält keine Fragen')
            batch_ids = set()
            for index, view in enumerate(views, start=1):
                view_error = validate_view(view)
                if view_error:
                    raise ValueError(f'Frage {index}: {view_error}')
                view_id = view['id']
                if view_id in batch_ids:
                    raise ValueError(f'doppelte Frage-ID {view_id} im Batch')
                if view_id in view_origins:
                    raise ValueError(
                        f'doppelte Frage-ID {view_id}; bereits in {view_origins[view_id]}')
                batch_ids.add(view_id)
            for view in views:
                all_views[view['id']] = view
                view_origins[view['id']] = bf
            loaded_batches.append((bf, views))
        except (OSError, ValueError, json.JSONDecodeError) as error:
            errors.append((bf, str(error)))
            print(f"[QA] {bf}: FEHLER {error}", file=sys.stderr)

    for bf, views in loaded_batches:
        print(f"[QA] {bf}: {len(views)} Fragen → {args.backend}/{model} …", file=sys.stderr)
        try:
            prompt, ref2id = build_prompt(views)
            raw = call_model(prompt, args.backend, model, args.max_tokens,
                             args.timeout, args.effort, runner)
            evals = extract_json_array(raw)
            if not isinstance(evals, list):
                raise ValueError('Modellantwort ist kein JSON-Array')
            # Opakes Kürzel (F1…) zurück auf die echte Frage-id mappen.
            valid_evals = []
            schema_errors = []
            for index, evaluation in enumerate(evals, start=1):
                if isinstance(evaluation, dict):
                    evaluation = dict(evaluation)
                    if evaluation.get('id') in ref2id:
                        evaluation['id'] = ref2id[evaluation['id']]
                evaluation_errors = validate_evaluation(evaluation)
                if evaluation_errors:
                    schema_errors.append(
                        f'Objekt {index}: {", ".join(evaluation_errors)}')
                else:
                    valid_evals.append(evaluation)
            expected_ids = set(ref2id.values())
            received_ids = [evaluation['id'] for evaluation in valid_evals]
            seen_ids = set()
            for evaluation in valid_evals:
                evaluation_id = evaluation['id']
                if evaluation_id in expected_ids and evaluation_id not in seen_ids:
                    all_evals.append(evaluation)
                    seen_ids.add(evaluation_id)
            coverage_errors = []
            if schema_errors:
                coverage_errors.append(
                    f'{len(schema_errors)} ungültige Bewertung(en): '
                    + '; '.join(schema_errors[:3]))
            missing_ids = expected_ids - set(received_ids)
            unknown_ids = {item for item in received_ids if item not in expected_ids}
            duplicate_ids = {item for item in received_ids if received_ids.count(item) > 1}
            if missing_ids:
                coverage_errors.append(f'{len(missing_ids)} Bewertungen fehlen')
            if unknown_ids:
                coverage_errors.append(f'{len(unknown_ids)} unbekannte IDs')
            if duplicate_ids:
                coverage_errors.append(f'{len(duplicate_ids)} doppelte IDs')
            if coverage_errors:
                errors.append((bf, ', '.join(coverage_errors)))
            print(
                f"[QA] {bf}: {len(valid_evals)}/{len(evals)} gültige Bewertungen erhalten",
                file=sys.stderr,
            )
        except Exception as e:  # noqa: BLE001 — Batch-Fehler protokollieren, weiterlaufen
            errors.append((bf, str(e)))
            print(f"[QA] {bf}: FEHLER {e}", file=sys.stderr)

    # Rohdaten (id → eval + view) neben dem Report ablegen.
    raw_path = os.path.splitext(args.out)[0] + '.raw.json'
    merged = []
    eval_by_id = {e.get('id'): e for e in all_evals}
    for vid, view in all_views.items():
        merged.append({'view': view, 'eval': eval_by_id.get(vid)})
    with open(raw_path, 'w', encoding='utf-8') as handle:
        json.dump({'errors': errors, 'items': merged},
                  handle, ensure_ascii=False, indent=1)

    write_report(args.out, merged, errors, batch_files, args.backend, model)
    print(f"[QA] Report: {args.out}  (raw: {raw_path})", file=sys.stderr)
    missing_total = sum(1 for item in merged if not item['eval'])
    if errors or missing_total:
        print(
            f"[QA] FEHLER: {len(errors)} Batchfehler, {missing_total} Fragen ohne Bewertung",
            file=sys.stderr,
        )
        return 1
    return 0


def write_report(path, merged, errors, batch_files, backend, model):
    """Aggregierten Markdown-Report schreiben — Fokus auf Auffälligkeiten."""
    total = len(merged)
    have = [m for m in merged if m['eval']]
    def count(field, val):
        return sum(1 for m in have if (m['eval'] or {}).get(field) == val)

    flagged = [m for m in have if (m['eval'] or {}).get('urteil') in ('ueberarbeiten', 'verwerfen')]
    keydoubt = [m for m in have if (m['eval'] or {}).get('keyDoubt')]
    giveaway = [m for m in have if (m['eval'] or {}).get('selbstverraeter') == 'stark']
    obskur = [m for m in have if (m['eval'] or {}).get('wissensniveau') == 'zu_obskur']

    # Systematik: Typen, bei denen ein hoher Anteil auffällt.
    by_type = {}
    for m in have:
        t = m['view']['type']
        by_type.setdefault(t, []).append(m)
    systemic = []
    for t, ms in by_type.items():
        bad = [m for m in ms if (m['eval'] or {}).get('urteil') != 'behalten']
        if len(ms) >= 2 and len(bad) / len(ms) >= 0.5:
            systemic.append((t, len(bad), len(ms)))
    systemic.sort(key=lambda x: (-x[1], x[0]))

    L = []
    L.append(f"# Semantischer QA-Report\n")
    L.append(f"Modell: `{backend}/{model}`\n")
    L.append(f"Batches: {len(batch_files)} · Fragen: {total} · bewertet: {len(have)}"
             f"{' · FEHLER: ' + str(len(errors)) if errors else ''}\n")
    L.append("## Zusammenfassung\n")
    L.append(f"- Urteil **behalten**: {count('urteil','behalten')} · "
             f"**überarbeiten**: {count('urteil','ueberarbeiten')} · "
             f"**verwerfen**: {count('urteil','verwerfen')}")
    L.append(f"- Selbstverräter stark/schwach/keiner: "
             f"{count('selbstverraeter','stark')}/{count('selbstverraeter','schwach')}/{count('selbstverraeter','keiner')}")
    L.append(f"- Distraktoren defekt/schwach/gut: "
             f"{count('distraktoren','defekt')}/{count('distraktoren','schwach')}/{count('distraktoren','gut')}")
    L.append(f"- Wissensniveau zu_obskur: {len(obskur)} · Klarheit unklar: {count('klarheit','unklar')}")
    L.append(f"- Mögliche Sachfehler (keyDoubt): {len(keydoubt)}\n")

    if systemic:
        L.append("## ⚠️ Systematische Auffälligkeiten (Template-Verdacht)\n")
        L.append("_Typen, bei denen ≥50 % der Stichprobe nicht behalten wird — hier lohnt ein Template-Fix statt Einzelkorrektur._\n")
        for t, bad, n in systemic:
            L.append(f"- `{t}`: {bad}/{n} auffällig")
        L.append("")

    def block(title, items, extra=None):
        if not items:
            return
        L.append(f"## {title} ({len(items)})\n")
        for m in items:
            e, v = m['eval'], m['view']
            L.append(f"- **[{v['domain']}/{v['type']}]** {v['prompt']}")
            L.append(f"  - Antwort (keyed): {v['keyedAnswer']}")
            if extra:
                extra(L, e, v)
            probs = e.get('probleme') or []
            if probs:
                L.append(f"  - Probleme: {'; '.join(probs)}")
        L.append("")

    block("🔴 Möglicher Sachfehler (keyDoubt)", keydoubt,
          lambda L, e, v: L.append(f"  - Modell-Zweifel: {e.get('keyDoubtGrund','')} "
                                   f"(eigene Antwort {e.get('eigeneAntwort')})"))
    block("🟠 Starker Selbstverräter", giveaway,
          lambda L, e, v: L.append(f"  - Grund: {e.get('selbstverraeterGrund','')}"))
    block("🟡 Zu obskur / unverständlich", obskur,
          lambda L, e, v: L.append(f"  - Niveau: {e.get('wissensniveau')} · Klarheit: {e.get('klarheit')}"))
    block("🔵 Sonstige überarbeiten/verwerfen",
          [m for m in flagged if m not in keydoubt and m not in giveaway and m not in obskur],
          lambda L, e, v: L.append(f"  - Urteil: {e.get('urteil')} · Distraktoren: {e.get('distraktoren')} "
                                   f"({e.get('distraktorenGrund','')})"))

    if errors:
        L.append("## Fehler beim Aufruf\n")
        for bf, err in errors:
            L.append(f"- {bf}: {err}")
        L.append("")

    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as handle:
        handle.write('\n'.join(L))


if __name__ == '__main__':
    sys.exit(main())
