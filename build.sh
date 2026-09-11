#!/usr/bin/env bash
set -euo pipefail

# Bauschritt von Scientia (Regel: jedes Web-Projekt mit Bauschritt hat an der
# Repo-Wurzel ein build.sh). Ruft genau den Bau aus package.json auf:
# "npm run build" fuehrt die Audits (Drittanbieter-Hinweise, Domain-Statistik,
# Datenbestand, Bildnachweise, Bildspiegel, Fragen) aus und baut danach mit
# Vite den Production-Stand nach dist/.
#
# Aufrufe:
#   ./build.sh          npm run build
#   ./build.sh --help   Diese Hilfe
#
# Hinweis: Der Statistik-Generator schreibt public/data/domain_stats.json neu;
# die Datei ist versioniert. Nach dem Bau "git status" ansehen.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

case "${1:-}" in
  "") ;;
  --help|-h)
    sed -n '/^# Aufrufe:/,/^$/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  *)
    echo "Unbekanntes Argument: $1 (erlaubt: --help)" >&2
    exit 2
    ;;
esac

if [[ ! -d node_modules ]]; then
  echo "node_modules fehlt. Zuerst: npm ci" >&2
  exit 1
fi

exec npm run build
