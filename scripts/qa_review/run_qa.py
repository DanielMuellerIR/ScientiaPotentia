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

DEFAULT_LLM_RUNNER = os.environ.get('SCIENTIA_LLM_RUNNER', 'llm_run.py')

LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

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
                    help='Pfad zu einem kompatiblen One-Shot-Runner (Standard: SCIENTIA_LLM_RUNNER oder llm_run.py)')
    args = ap.parse_args()
    model = args.model or ('gpt-5.6-terra' if args.backend == 'codex' else 'MiniMax-M3')

    batch_files = sorted(f for f in os.listdir(args.batches)
                         if re.match(r'batch_\d+\.json$', f))
    if args.limit:
        batch_files = batch_files[:args.limit]

    all_views = {}
    all_evals = []
    errors = []
    for bf in batch_files:
        views = json.load(open(os.path.join(args.batches, bf)))
        for v in views:
            all_views[v['id']] = v
        prompt, ref2id = build_prompt(views)
        print(f"[QA] {bf}: {len(views)} Fragen → {args.backend}/{model} …", file=sys.stderr)
        try:
            raw = call_model(prompt, args.backend, model, args.max_tokens,
                             args.timeout, args.effort, args.runner)
            evals = extract_json_array(raw)
            # Opakes Kürzel (F1…) zurück auf die echte Frage-id mappen.
            for e in evals:
                if e.get('id') in ref2id:
                    e['id'] = ref2id[e['id']]
            all_evals.extend(evals)
            print(f"[QA] {bf}: {len(evals)} Bewertungen erhalten", file=sys.stderr)
        except Exception as e:  # noqa: BLE001 — Batch-Fehler protokollieren, weiterlaufen
            errors.append((bf, str(e)))
            print(f"[QA] {bf}: FEHLER {e}", file=sys.stderr)

    # Rohdaten (id → eval + view) neben dem Report ablegen.
    raw_path = args.out.rsplit('.', 1)[0] + '.raw.json'
    merged = []
    eval_by_id = {e.get('id'): e for e in all_evals}
    for vid, view in all_views.items():
        merged.append({'view': view, 'eval': eval_by_id.get(vid)})
    json.dump({'errors': errors, 'items': merged},
              open(raw_path, 'w'), ensure_ascii=False, indent=1)

    write_report(args.out, merged, errors, batch_files, args.backend, model)
    print(f"[QA] Report: {args.out}  (raw: {raw_path})", file=sys.stderr)


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

    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w').write('\n'.join(L))


if __name__ == '__main__':
    main()
