#!/usr/bin/env bash
set -euo pipefail

# Einstiegsskript zum Veroeffentlichen von Scientia (Regel: jedes Web-Projekt
# hat an der Repo-Wurzel ein deploy.sh). Es erfindet keinen eigenen Weg,
# sondern ruft das vorhandene deploy.py auf, das dist/ per FTPS inkrementell
# hochlaedt und index.html erst zuletzt atomar umschaltet.
#
# Aufrufe:
#   ./deploy.sh                Trockenpruefung ohne Zugangsdaten und ohne Bau:
#                              deploy.py --dry-run listet den Deploy-Plan aus
#                              dem vorhandenen dist/ (vorher ./build.sh).
#   ./deploy.sh --live [ARGS]  Echter Upload; ARGS gehen unveraendert an
#                              deploy.py (z. B. --remote ZIEL, --env DATEI,
#                              --no-build, --force). deploy.py baut vorher
#                              selbst per "npm run build", sofern nicht
#                              --no-build gesetzt ist.
#   ./deploy.sh --help         Diese Hilfe.
#
# Zugangsdaten liest ausschliesslich deploy.py aus der Env-Datei (Standard
# ./.env oder SCIENTIA_DEPLOY_ENV); sie stehen nie in Argumenten oder in der
# Ausgabe. Das Zielverzeichnis kommt ueber --remote oder
# SCIENTIA_DEPLOY_REMOTE; der eingebaute Standard ist absichtlich kein echtes
# Ziel.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

hilfe() {
  sed -n '/^# Aufrufe:/,/^$/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

case "${1:-}" in
  --help|-h) hilfe; exit 0 ;;
  --live)
    shift
    echo "[deploy] Echter Upload ueber deploy.py ..."
    exec python3 ./deploy.py "$@"
    ;;
  "") ;;
  *) echo "Unbekanntes Argument: $1" >&2; hilfe >&2; exit 2 ;;
esac

if [[ ! -d dist ]]; then
  echo "dist/ fehlt. Zuerst: ./build.sh" >&2
  exit 1
fi
echo "[deploy] Trockenpruefung: deploy.py --dry-run (kein Bau, kein Upload, keine Zugangsdaten)"
python3 ./deploy.py --dry-run
echo "[deploy] Echter Upload: ./deploy.sh --live --remote ZIEL"
