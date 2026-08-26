#!/usr/bin/env python3
"""
deploy.py — Upload des Scientia-Production-Builds per FTPS.

Der Release-Einstieg ``index.html`` wird erst veröffentlicht, nachdem alle
referenzierten Dateien erfolgreich auf dem Server liegen. Ein serverseitiges
SHA-256-Manifest ist die gemeinsame Wahrheit für inkrementelle Deployments;
das lokale Manifest dient nur als Diagnosekopie.
"""

import argparse
from dataclasses import dataclass
import datetime
import ftplib
import hashlib
import io
import json
import os
import posixpath
import re
import ssl
import subprocess
import sys
import uuid


# ── Pfade und Konfiguration ──────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_DIST = os.path.join(SCRIPT_DIR, "dist")
MANIFEST_PATH = os.path.join(SCRIPT_DIR, ".deploy-manifest.json")

DEFAULT_ENV = os.environ.get("SCIENTIA_DEPLOY_ENV", os.path.join(SCRIPT_DIR, ".env"))
# Der absichtlich nicht reale Standard verhindert versehentliche Veröffentlichungen.
# Das echte Ziel kommt über --remote oder SCIENTIA_DEPLOY_REMOTE.
REMOTE_BASE_DIR = os.environ.get("SCIENTIA_DEPLOY_REMOTE", "/example.com/httpdocs/scientia")
REMOTE_MANIFEST_NAME = ".scientia-deploy-manifest.json"
MANIFEST_VERSION = 1
ENTRYPOINT = "index.html"
# Vorsichtsmaßnahme für künftige Dateien aus public/: Diese Serverkonfigurationen
# werden nur überschrieben, wenn --force gesetzt ist. geodb.json liegt dagegen
# unter src/ und wird ins JavaScript-Bundle eingebettet, nie als Datei deployt.
PROTECTED_FILES = {".htaccess", ".htpasswd"}
UPLOAD_MARKER = ".uploading-"
# XSHA256 und XMD5 sind nicht Teil des FTP-Kerns. Manche Server bieten einen
# oder beide Befehle an; ohne sie bleibt der bewährte Manifest-/Größen-Fallback.
CHECKSUM_COMMANDS = (
    ("XSHA256", "sha256", 64),
    ("XMD5", "md5", 32),
)
UNSUPPORTED_FTP_COMMAND_CODES = {"500", "501", "502", "504"}
CHECKSUM_UNSUPPORTED = object()
CHECKSUM_UNVERIFIABLE = object()


@dataclass
class DeployResult:
    uploaded: int
    skipped: int
    failed: int
    manifest: dict
    not_attempted: int = 0
    #: Anteil an ``skipped``, für den der Server KEINE Prüfsumme liefern konnte —
    #: dort belegen nur Manifest und Größe die Gleichheit (Review-Fund 2026-08-25).
    skipped_unverified: int = 0


def load_env_credentials(env_path):
    if not os.path.exists(env_path):
        print(f"[ERROR] Credentials file not found at: {env_path}")
        print("Please verify the path and make sure the file exists.")
        sys.exit(1)

    credentials = {}
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            credentials[key.strip()] = value.strip().strip('"').strip("'")

    required = ["FTP_HOST", "FTP_USER", "FTP_PASS"]
    missing = [name for name in required if name not in credentials]
    if missing:
        print(f"[ERROR] Missing credentials in {env_path}: {', '.join(missing)}")
        sys.exit(1)

    return credentials


def get_remote_size(ftps, path):
    try:
        ftps.voidcmd("TYPE I")
        return ftps.size(path)
    except ftplib.error_perm:
        return None


def digest_of_file(path, algorithm):
    """Berechnet einen Dateihash gestückelt für den lokalen Vergleich."""
    digest = hashlib.new(algorithm)
    with open(path, "rb") as file_handle:
        for chunk in iter(lambda: file_handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def is_unsupported_ftp_command(error):
    """Erkennt nur die FTP-Antworten für einen nicht implementierten Befehl."""
    return str(error).split(" ", 1)[0] in UNSUPPORTED_FTP_COMMAND_CODES


def request_remote_checksum(ftps, command, remote_file, digest_length):
    """Fragt eine Erweiterungs-Prüfsumme ab, ohne ein Remote-File zu lesen.

    ``CHECKSUM_UNSUPPORTED`` erlaubt den Größen-Fallback. Jede andere
    unbrauchbare Antwort gilt dagegen als nicht verifiziert und erzwingt einen
    Upload, statt einen potentiell beschädigten Inhalt zu überspringen.
    """
    try:
        response = ftps.sendcmd(f"{command} {remote_file}")
    except ftplib.error_perm as error:
        return CHECKSUM_UNSUPPORTED if is_unsupported_ftp_command(error) else CHECKSUM_UNVERIFIABLE
    except ftplib.all_errors:
        return CHECKSUM_UNVERIFIABLE

    match = re.search(
        rf"(?<![0-9a-fA-F])([0-9a-fA-F]{{{digest_length}}})(?![0-9a-fA-F])",
        response,
    )
    return match.group(1).lower() if match else CHECKSUM_UNVERIFIABLE


class RemoteChecksumVerifier:
    """Wählt einmal pro Deploy die beste verfügbare Server-Prüfsumme.

    Der erste Skip-Kandidat probiert XSHA256 und danach XMD5. Anschließend
    bleibt der gefundene Befehl gecacht. Lehnt der Server beide Erweiterungen
    ab, entstehen keine weiteren Zusatzanfragen für die restlichen Dateien.
    """

    def __init__(self, ftps):
        self.ftps = ftps
        self.command = None
        self.algorithm = None
        self.digest_length = None
        self.unavailable = False

    def _expected_digest(self, local_file, algorithm):
        if algorithm == "sha256":
            return local_file["sha256"]
        # MD5 dient ausschließlich dem Vergleich mit einem XMD5-fähigen Server;
        # das Release-Manifest bleibt unverändert bei SHA-256 als Wahrheit.
        return digest_of_file(local_file["local_file"], algorithm)

    def matches(self, remote_file, local_file):
        """Gibt True, False oder None (Erweiterung nicht verfügbar) zurück."""
        if self.unavailable:
            return None

        commands = (
            ((self.command, self.algorithm, self.digest_length),)
            if self.command is not None
            else CHECKSUM_COMMANDS
        )
        for command, algorithm, digest_length in commands:
            remote_digest = request_remote_checksum(
                self.ftps, command, remote_file, digest_length
            )
            if remote_digest is CHECKSUM_UNSUPPORTED:
                if self.command is not None:
                    # Ein Serverwechsel während eines Deploys darf nicht zu einem
                    # Skip mit alter Annahme führen.
                    self.unavailable = True
                    return None
                continue
            if remote_digest is CHECKSUM_UNVERIFIABLE:
                return False

            if self.command is None:
                self.command = command
                self.algorithm = algorithm
                self.digest_length = digest_length
                print(f"[DEPLOY] Remote checksum verification enabled: {command}")
            return remote_digest == self._expected_digest(local_file, algorithm)

        self.unavailable = True
        print("[DEPLOY] Remote checksum extensions unavailable; using manifest and size fallback.")
        return None


def remote_file_exists(ftps, path):
    return get_remote_size(ftps, path) is not None


def mkdir_p(ftps, remote_directory):
    path_parts = remote_directory.strip("/").split("/")
    current = "/" if remote_directory.startswith("/") else ""

    for part in path_parts:
        if not part:
            continue
        current = f"{current}{part}" if current == "/" else f"{current}/{part}"
        try:
            ftps.cwd(current)
        except ftplib.error_perm:
            print(f"[DEPLOY] Creating remote directory: {current}")
            try:
                ftps.mkd(current)
            except ftplib.error_perm:
                # Ein paralleler Prozess kann das Verzeichnis bereits angelegt haben.
                pass


def require_remote_directory(ftps, remote_directory):
    """Verlangt ein vorhandenes Basisziel, statt Tippfehler still anzulegen."""
    try:
        ftps.cwd(remote_directory)
    except ftplib.error_perm as error:
        raise ValueError(
            f"Remote-Ziel existiert nicht oder ist nicht zugänglich: {remote_directory}"
        ) from error


def cleanup_stale_uploads(ftps, remote_directories):
    """Entfernt Temp-Dateien früherer, abgebrochener Deployments.

    Geprüft werden die Verzeichnisse des aktuellen Builds und des letzten
    Remote-Manifests. Kann ein Verzeichnis nicht gelistet oder eine Datei nicht
    gelöscht werden, bleibt der Fund als Warnung sichtbar.
    """
    removed = 0
    for directory in sorted(set(remote_directories)):
        try:
            ftps.cwd(directory)
        except ftplib.error_perm:
            # Ein Unterverzeichnis, das noch nicht existiert, kann keine Reste
            # enthalten und wird später bei Bedarf regulär angelegt.
            continue
        try:
            entries = ftps.nlst(directory)
        except ftplib.error_perm as error:
            print(f"[WARN] Remote-Verzeichnis konnte nicht auf Uploadreste geprüft werden: {directory} ({error})")
            continue
        for entry in entries:
            remote_file = entry if entry.startswith("/") else posixpath.join(directory, entry)
            if UPLOAD_MARKER not in posixpath.basename(remote_file):
                continue
            try:
                ftps.delete(remote_file)
                removed += 1
                print(f"[DEPLOY] Removed stale temporary upload: {remote_file}")
            except Exception as error:
                print(f"[WARN] Stale temporary upload could not be removed: {remote_file} ({error})")
    return removed


def ensure_remote_directory(ftps, remote_directory, prepared_directories):
    """Legt ein Unterverzeichnis höchstens einmal je Deployment an."""
    if remote_directory in prepared_directories:
        return
    mkdir_p(ftps, remote_directory)
    prepared_directories.add(remote_directory)


def upload_atomic(ftps, open_source, remote_file, prepared_directories=None):
    """Schreibt in eine temporäre Datei und schaltet sie per Rename sichtbar.

    Ein Verbindungsabbruch mitten im Upload trifft damit nur die temporäre
    Datei; der Live-Pfad behält seinen alten, vollständigen Inhalt, bis die
    neue Datei komplett auf dem Server liegt. ``open_source`` öffnet den
    Binärstrom lazy, damit Dateien und Speicherpuffer denselben Pfad nutzen.
    """
    prepared_directories = prepared_directories if prepared_directories is not None else set()
    ensure_remote_directory(ftps, posixpath.dirname(remote_file), prepared_directories)
    temporary_file = f"{remote_file}{UPLOAD_MARKER}{uuid.uuid4().hex}"
    try:
        with open_source() as source:
            ftps.storbinary(f"STOR {temporary_file}", source)
        ftps.rename(temporary_file, remote_file)
    except BaseException:
        try:
            ftps.delete(temporary_file)
        except Exception:
            pass
        raise


def upload_file(ftps, local_file, remote_file, prepared_directories=None):
    """Lädt eine Builddatei atomar hoch (gestreamt, ohne sie ganz in den RAM zu holen)."""
    upload_atomic(ftps, lambda: open(local_file, "rb"), remote_file, prepared_directories)


def upload_bytes_atomic(ftps, content, remote_file, prepared_directories=None):
    """Lädt einen Speicherpuffer (z.B. das Manifest) atomar hoch."""
    upload_atomic(ftps, lambda: io.BytesIO(content), remote_file, prepared_directories)


def resolve_ftp_host(host):
    """Liefert einen Hostnamen für die TLS-Zertifikatsprüfung."""
    import ipaddress
    import socket

    try:
        ipaddress.ip_address(host)
    except ValueError:
        return host
    try:
        name = socket.gethostbyaddr(host)[0]
        print(f"[DEPLOY] FTP_HOST ist eine IP; verbinde über '{name}' (Zertifikatsprüfung).")
        return name
    except OSError:
        return host


def sha256_of_file(path):
    """Berechnet SHA-256 gestückelt, damit große Dateien wenig RAM benötigen."""
    return digest_of_file(path, "sha256")


def empty_manifest():
    return {"version": MANIFEST_VERSION, "files": {}}


def normalise_manifest(data):
    """Akzeptiert nur das aktuelle, pfadbereinigte Manifestformat."""
    if not isinstance(data, dict) or data.get("version") != MANIFEST_VERSION:
        return empty_manifest()
    files = data.get("files")
    if not isinstance(files, dict):
        return empty_manifest()

    valid_files = {}
    for relative_path, metadata in files.items():
        if not isinstance(relative_path, str) or relative_path.startswith("/"):
            continue
        if ".." in relative_path.split("/") or not isinstance(metadata, dict):
            continue
        file_hash = metadata.get("sha256")
        file_size = metadata.get("size")
        if (
            isinstance(file_hash, str)
            and len(file_hash) == 64
            and all(character in "0123456789abcdef" for character in file_hash)
            and isinstance(file_size, int)
            and file_size >= 0
        ):
            valid_files[relative_path] = {"sha256": file_hash, "size": file_size}
    return {"version": MANIFEST_VERSION, "files": valid_files}


def manifest_bytes(manifest):
    return (json.dumps(manifest, indent=1, sort_keys=True) + "\n").encode("utf-8")


def load_remote_manifest(ftps, remote_base):
    remote_file = remote_path(remote_base, REMOTE_MANIFEST_NAME)
    chunks = []
    try:
        ftps.retrbinary(f"RETR {remote_file}", chunks.append)
    except ftplib.error_perm:
        print("[DEPLOY] Remote manifest missing; all files will be verified by upload.")
        return empty_manifest()

    try:
        return normalise_manifest(json.loads(b"".join(chunks).decode("utf-8")))
    except (UnicodeDecodeError, ValueError):
        print("[DEPLOY] Remote manifest invalid; all files will be verified by upload.")
        return empty_manifest()


def save_manifest(manifest):
    """Speichert die lokale Diagnosekopie erst nach einem kompletten Release."""
    temporary_path = f"{MANIFEST_PATH}.tmp"
    with open(temporary_path, "w", encoding="utf-8") as file_handle:
        json.dump(manifest, file_handle, indent=1, sort_keys=True)
        file_handle.write("\n")
    os.replace(temporary_path, MANIFEST_PATH)


def collect_dist_files(local_dist):
    """Liefert einen deterministischen Plan mit dem Entrypoint an letzter Stelle."""
    files = []
    ignored = 0
    for root, directories, filenames in os.walk(local_dist):
        directories.sort()
        for filename in sorted(filenames):
            if filename == ".DS_Store":
                ignored += 1
                continue
            local_file = os.path.join(root, filename)
            relative_path = os.path.relpath(local_file, local_dist).replace(os.sep, "/")
            files.append(
                {
                    "relative_path": relative_path,
                    "local_file": local_file,
                    "sha256": sha256_of_file(local_file),
                    "size": os.path.getsize(local_file),
                }
            )

    if not any(file["relative_path"] == ENTRYPOINT for file in files):
        raise ValueError(f"Build entrypoint '{ENTRYPOINT}' is missing in {local_dist}.")
    files.sort(key=lambda file: (file["relative_path"] == ENTRYPOINT, file["relative_path"]))
    return files, ignored


def normalise_remote_base(remote_base):
    """Erzwingt ein absolutes, bereinigtes Remoteziel.

    Nötig aus zwei Gründen: ``posixpath.join()`` erzeugt aus einer leeren Basis
    relative Zielpfade (aus dem gültigen Ziel ``/`` wurde früher ``""``), und
    ``mkdir_p()`` wechselt per ``cwd`` das Arbeitsverzeichnis — relative Pfade
    würden danach in einem anderen Verzeichnis landen als beim ersten Aufruf.
    """
    if (
        not isinstance(remote_base, str)
        or remote_base != remote_base.strip()
        or not remote_base.startswith("/")
    ):
        raise ValueError(f"Remote-Ziel muss ein absoluter Pfad sein: {remote_base!r}")
    # normpath entfernt "." sowie doppelte und abschließende Schrägstriche und
    # löst ".." bei absoluten Pfaden vollständig auf ("/a/../b" -> "/b"). Es
    # lässt nach POSIX aber einen führenden "//" stehen — den kappen wir selbst.
    normalised = posixpath.normpath(remote_base)
    if normalised.startswith("//"):
        normalised = "/" + normalised.lstrip("/")
    return normalised


def dist_snapshot_timestamp(local_dist):
    """Zeitpunkt der neuesten Datei im vorhandenen Dry-run-Build (ISO 8601)."""
    timestamps = []
    for root, _directories, filenames in os.walk(local_dist):
        timestamps.extend(os.path.getmtime(os.path.join(root, name)) for name in filenames)
    if not timestamps:
        return "keine Dateien"
    return datetime.datetime.fromtimestamp(max(timestamps)).astimezone().isoformat(timespec="seconds")


def remote_path(remote_base, relative_path):
    """Baut den absoluten Zielpfad. ``remote_base`` ist bereits normalisiert."""
    return posixpath.join(remote_base, relative_path)


def remote_matches_manifest(ftps, remote_file, local_file, remote_metadata, checksum_verifier):
    """Wie gut ist ein Skip belegt? ``"checksum"``, ``"manifest"`` oder ``False``.

    ``"checksum"`` heißt: Der Server hat den Inhalt selbst bestätigt (XSHA256 oder
    XMD5). ``"manifest"`` heißt: Manifest und Größe stimmen, aber der Server kann
    keine Prüfsumme liefern — beschädigte Bytes gleicher Länge blieben damit
    unentdeckt. Vorher gab die Funktion für beide Fälle True zurück, und der
    Deploy meldete auch den zweiten Fall als „Remote file verified"
    (Review-Fund 2026-08-25). Der Skip bleibt: Ohne die Erweiterungen müsste
    sonst jeder Deploy alles neu hochladen. Sichtbar ist der Unterschied jetzt.
    """
    if not isinstance(remote_metadata, dict):
        return False
    if remote_metadata.get("sha256") != local_file["sha256"]:
        return False
    if remote_metadata.get("size") != local_file["size"]:
        return False
    if get_remote_size(ftps, remote_file) != local_file["size"]:
        return False
    checksum_matches = checksum_verifier.matches(remote_file, local_file)
    if checksum_matches is False:
        return False
    return "checksum" if checksum_matches else "manifest"


def deploy_dist(ftps, local_dist, remote_base, *, dry_run=False, force=False):
    """Öffentliche Vertragsgrenze: normalisiert das Ziel genau einmal."""
    normalised_base = normalise_remote_base(remote_base)
    return _deploy_dist_normalised(
        ftps,
        local_dist,
        normalised_base,
        dry_run=dry_run,
        force=force,
    )


def _deploy_dist_normalised(ftps, local_dist, remote_base, *, dry_run=False, force=False):
    """Deployt einen Build; Assets zuerst, ``index.html`` und Manifest atomar zuletzt."""
    files, ignored = collect_dist_files(local_dist)
    if dry_run:
        remote_manifest = empty_manifest()
    else:
        require_remote_directory(ftps, remote_base)
        remote_manifest = load_remote_manifest(ftps, remote_base)
    remote_files = remote_manifest["files"]
    checksum_verifier = RemoteChecksumVerifier(ftps) if not dry_run else None
    release_files = {}
    uploaded = 0
    skipped = ignored
    skipped_unverified = 0
    failed = 0
    not_attempted = 0
    prepared_directories = {remote_base}

    if not dry_run:
        remote_directories = {remote_base}
        for relative_path in [file["relative_path"] for file in files] + list(remote_files):
            remote_directories.add(posixpath.dirname(remote_path(remote_base, relative_path)))
        cleanup_stale_uploads(ftps, remote_directories)

    for index, file in enumerate(files):
        relative_path = file["relative_path"]
        target = remote_path(remote_base, relative_path)
        is_entrypoint = relative_path == ENTRYPOINT
        is_protected = posixpath.basename(relative_path) in PROTECTED_FILES

        if is_protected and not force and not dry_run and remote_file_exists(ftps, target):
            print(f"[DEPLOY] [SKIP] Protected file already exists on server: {relative_path}")
            previous_metadata = remote_files.get(relative_path)
            if isinstance(previous_metadata, dict) and get_remote_size(ftps, target) == previous_metadata.get("size"):
                release_files[relative_path] = previous_metadata
            skipped += 1
            continue

        metadata = {"sha256": file["sha256"], "size": file["size"]}
        skip_evidence = (
            remote_matches_manifest(
                ftps, target, file, remote_files.get(relative_path), checksum_verifier
            )
            if not force and not dry_run
            else False
        )
        if skip_evidence:
            if skip_evidence == "checksum":
                print(f"[DEPLOY] [SKIP] Remote file verified: {relative_path}")
            else:
                print(
                    "[DEPLOY] [SKIP] Remote file matches manifest and size "
                    f"(server checksum unavailable): {relative_path}"
                )
                skipped_unverified += 1
            release_files[relative_path] = metadata
            skipped += 1
            continue

        action = "publish entrypoint" if is_entrypoint else "upload"
        if dry_run:
            print(f"[DRY-RUN] Would {action}: {file['local_file']} -> {target}")
            release_files[relative_path] = metadata
            uploaded += 1
            continue

        print(f"[DEPLOY] {action.capitalize()}: {file['local_file']} -> {target}")
        try:
            # Auch Assets gehen über temporäre Datei + Rename auf den Live-Pfad:
            # die laufende Seite lädt stabile Pfade wie data/questions_*.json,
            # ein abgebrochener Direktupload würde dort eine halbe Datei hinterlassen.
            upload_file(ftps, file["local_file"], target, prepared_directories)
            release_files[relative_path] = metadata
            uploaded += 1
        except Exception as error:
            print(f"[ERROR] Failed to {action} {file['local_file']}: {error}")
            failed += 1
            # Nach einem Assetfehler darf der neue Entrypoint nicht sichtbar werden.
            if not is_entrypoint:
                not_attempted = len(files) - index - 1
                break

    release_manifest = {"version": MANIFEST_VERSION, "files": release_files}
    if failed:
        return DeployResult(uploaded, skipped, failed, release_manifest, not_attempted,
                            skipped_unverified)

    remote_manifest_file = remote_path(remote_base, REMOTE_MANIFEST_NAME)
    if dry_run:
        print(f"[DRY-RUN] Would publish release manifest atomically: {remote_manifest_file}")
        return DeployResult(uploaded, skipped, failed, release_manifest,
                            skipped_unverified=skipped_unverified)

    try:
        upload_bytes_atomic(
            ftps,
            manifest_bytes(release_manifest),
            remote_manifest_file,
            prepared_directories,
        )
    except Exception as error:
        print(f"[ERROR] Failed to publish release manifest: {error}")
        failed += 1
    return DeployResult(uploaded, skipped, failed, release_manifest,
                        skipped_unverified=skipped_unverified)


def main():
    parser = argparse.ArgumentParser(description="FTPS-Deploy des Scientia-Builds")
    parser.add_argument("--env", default=DEFAULT_ENV, help="Pfad zur env-Datei mit FTPS-Zugangsdaten")
    parser.add_argument("--remote", default=REMOTE_BASE_DIR, help="Zielverzeichnis auf dem Webspace")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Nichts schreiben: kein Build, kein Upload, keine Zugangsdaten",
    )
    parser.add_argument("--no-build", action="store_true", help="Zuvor keinen 'npm run build' ausführen")
    parser.add_argument("--force", action="store_true", help="Alle Dateien inklusive geschützter neu hochladen")
    args = parser.parse_args()

    print("=" * 60)
    print("     SCIENTIA - FTPS DEPLOYMENT")
    print("=" * 60)

    # Ein ungültiges Ziel soll auffallen, bevor gebaut oder verbunden wird.
    try:
        remote_base = normalise_remote_base(args.remote)
    except ValueError as error:
        print(f"[ERROR] {error}")
        sys.exit(2)

    # --dry-run sagt "Nichts schreiben" zu. 'npm run build' würde aber dist/ neu
    # erzeugen und über den Statistik-Generator die getrackte
    # public/data/domain_stats.json überschreiben — deshalb im Dry-run nie bauen.
    if args.dry_run and not args.no_build:
        print("[DRY-RUN] Skipping build; the plan checks the existing dist/ tree.")
    elif not args.no_build:
        print("[DEPLOY] Running production build (npm run build)...")
        build = subprocess.run(["npm", "run", "build"], cwd=SCRIPT_DIR)
        if build.returncode != 0:
            print("[ERROR] Build failed. Deployment aborted.")
            sys.exit(1)

    if not os.path.isdir(LOCAL_DIST):
        print(f"[ERROR] Local build directory '{LOCAL_DIST}' does not exist.")
        sys.exit(1)

    if args.dry_run:
        print("[DRY-RUN] No connection or credentials required.")
        print("[DRY-RUN] Server delta unknown; every file in the existing dist/ tree is listed as an upload.")
        print(f"[DRY-RUN] Newest file in the used dist/ tree: {dist_snapshot_timestamp(LOCAL_DIST)}")
        try:
            result = _deploy_dist_normalised(
                None,
                LOCAL_DIST,
                remote_base,
                dry_run=True,
                force=args.force,
            )
        except (OSError, ValueError) as error:
            print(f"[ERROR] Deployment plan failed: {error}")
            sys.exit(1)
    else:
        print(f"[DEPLOY] Reading FTPS credentials from: {args.env}")
        credentials = load_env_credentials(args.env)
        host = resolve_ftp_host(credentials["FTP_HOST"])
        port = int(credentials.get("FTP_PORT", "21"))
        print(f"[DEPLOY] Connecting to FTPS host: {host}:{port} as user: {credentials['FTP_USER']}...")
        ftps = None
        try:
            ftps = ftplib.FTP_TLS(context=ssl.create_default_context())
            ftps.connect(host, port, timeout=15)
            ftps.login(credentials["FTP_USER"], credentials["FTP_PASS"])
            ftps.prot_p()
            ftps.set_pasv(True)
            print("[DEPLOY] FTPS connection established successfully.")
            result = _deploy_dist_normalised(ftps, LOCAL_DIST, remote_base, force=args.force)
        except Exception as error:
            print(f"[ERROR] Deployment failed: {error}")
            sys.exit(1)
        finally:
            if ftps:
                try:
                    ftps.quit()
                except Exception:
                    ftps.close()

        if not result.failed:
            save_manifest(result.manifest)

    print("=" * 60)
    if args.dry_run:
        print(
            f"      [DRY-RUN] {result.uploaded} local file(s) listed; "
            f"server delta unknown, {result.skipped} ignored."
        )
    elif result.failed:
        print(
            f"      DEPLOYMENT INCOMPLETE! {result.failed} upload(s) failed, "
            f"{result.uploaded} uploaded, {result.skipped} skipped, "
            f"{result.not_attempted} not attempted."
        )
        print("=" * 60)
        sys.exit(1)
    else:
        # Ehrlich zaehlen: Ein Skip ohne Server-Pruefsumme ist NICHT verifiziert,
        # sondern nur durch Manifest und Groesse gedeckt (Review-Fund 2026-08-25).
        verified = result.skipped - result.skipped_unverified
        beleg = f"{verified} remotely verified/skipped"
        if result.skipped_unverified:
            beleg += (
                f", {result.skipped_unverified} skipped on manifest and size only "
                "(server offers no checksum)"
            )
        print(
            f"      DEPLOYMENT SUCCESSFUL! Uploaded {result.uploaded} files "
            f"({beleg})."
        )
    print("=" * 60)


if __name__ == "__main__":
    main()
