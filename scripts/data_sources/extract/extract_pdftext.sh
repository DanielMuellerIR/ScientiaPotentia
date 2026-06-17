#!/usr/bin/env bash
# Extrahiert die Textebene lokaler Sachbuch-PDFs nach ~/.cache/scientia_extract/<slug>.txt
# mit Seitenmarkern ("===== Seite N ====="). Deterministisch, 0 LLM, idempotent.
#
# Pfad bewusst ueber $HOME (M3=danielmuller vs. M5=dm0 — Username unterschiedlich!).
# Bücher muessen LOKAL HYDRIERT sein (Nextcloud-VFS). M5/VektorDB werden NICHT angefasst.
#
# Aufruf:  extract_pdftext.sh [Unterordner ...]   (ohne Arg = alle Sachbücher)
#   z.B.   extract_pdftext.sh Astronomie Biologie
set -uo pipefail
SRC="$HOME/Nextcloud/eBooks/Sachbücher"
OUT="$HOME/.cache/scientia_extract"
mkdir -p "$OUT"
command -v pdftotext >/dev/null || { echo "FEHLER: pdftotext fehlt (brew install poppler)"; exit 1; }

subdirs=("$@")
if [ ${#subdirs[@]} -eq 0 ]; then roots=("$SRC"); else roots=(); for s in "${subdirs[@]}"; do roots+=("$SRC/$s"); done; fi

find "${roots[@]}" -type f -iname '*.pdf' 2>/dev/null | while read -r pdf; do
  rel="${pdf#$SRC/}"
  slug=$(printf '%s' "$rel" | sed 's#/#__#g; s#\.[Pp][Dd][Ff]$##; s#[^A-Za-z0-9._-]#_#g')
  out="$OUT/$slug.txt"
  if [ -f "$out" ] && [ "$out" -nt "$pdf" ]; then echo "skip  $slug"; continue; fi
  if pdftotext -enc UTF-8 "$pdf" - 2>/dev/null | python3 -c '
import sys
pages = sys.stdin.read().split("\f")
sys.stdout.write("".join(f"\n===== Seite {i} =====\n{p}" for i,p in enumerate(pages,1)))
' > "$out" 2>/dev/null && [ -s "$out" ]; then
    echo "ok    $slug ($(wc -w < "$out" | tr -d ' ') W)"
  else
    echo "FAIL  $slug (kein Text? Scan/Platzhalter)"; rm -f "$out"
  fi
done
