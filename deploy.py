#!/usr/bin/env python3
"""
deploy.py — Upload des Scientia-Potentia Production-Builds auf den Netcup-Webspace (dm0.de/sci/) per FTPS.

Lädt exakt den fertigen Build (dist/) hoch.
Sicherheit:
  • Die Zugangsdaten werden aus einer Env-Datei gelesen (Default: Nextcloud/Beispiele/Templates/Sticky/.env/chili.env).
  • Es wird FTPS (FTP über explizites TLS) verwendet, um Zugangsdaten und Datenkanal zu verschlüsseln.
  • Überschreibschutz für kritische Systemdateien (.htaccess etc.) ist standardmäßig aktiv.

Benutzung:
  python3 deploy.py            # baut die Anwendung und lädt sie hoch
  python3 deploy.py --dry-run  # zeigt nur, was hochgeladen werden würde
  python3 deploy.py --no-build # überspringt den Build-Schritt (nutzt vorhandenes dist/)
  python3 deploy.py --force    # erzwingt das Überschreiben geschützter Dateien
"""

import argparse
import hashlib
import json
import os
import ssl
import sys
import subprocess
import ftplib

# ── Pfade und Konfiguration ──────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_DIST = os.path.join(SCRIPT_DIR, "dist")

# Lokales Manifest der zuletzt erfolgreich hochgeladenen Dateien
# (remote-Pfad -> SHA-256 des Inhalts). Damit werden unveränderte Dateien beim
# nächsten Deploy übersprungen, statt jedes Mal alle ~38 MB neu hochzuladen.
# Ein reiner Größenvergleich wäre für Text/JSON unsicher (z.B. Jahreszahl-Fix
# 1912->1913 = gleiche Größe); der Hash-Vergleich ist eindeutig.
# Die Datei ist maschinenlokal und ge-gitignored.
MANIFEST_PATH = os.path.join(SCRIPT_DIR, ".deploy-manifest.json")

# Dynamische Ermittlung des Home-Verzeichnisses für maximale Portabilität
HOME_DIR = os.path.expanduser("~")
DEFAULT_ENV = os.path.join(HOME_DIR, "Nextcloud", "Beispiele", "Templates", "Sticky", ".env", "chili.env")
# Zielverzeichnis auf dem Netcup-Webspace -> erreichbar unter https://dm0.de/sci/
# (Vite baut mit base:'./' relative Asset-Pfade, daher unterordner-tauglich.)
REMOTE_BASE_DIR = "/dm0.de/httpdocs/sci"


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
            k, v = line.split("=", 1)
            credentials[k.strip()] = v.strip().strip('"').strip("'")

    required = ["FTP_HOST", "FTP_USER", "FTP_PASS"]
    missing = [r for r in required if r not in credentials]
    if missing:
        print(f"[ERROR] Missing credentials in {env_path}: {', '.join(missing)}")
        sys.exit(1)

    return credentials


def remote_file_exists(ftps, path):
    try:
        ftps.voidcmd("TYPE I")
        return ftps.size(path) is not None
    except ftplib.error_perm:
        return False


def get_remote_size(ftps, path):
    try:
        ftps.voidcmd("TYPE I")
        return ftps.size(path)
    except ftplib.error_perm:
        return None


def mkdir_p(ftps, remote_directory):
    path_parts = remote_directory.strip("/").split("/")
    current = ""
    if remote_directory.startswith("/"):
        current = "/"

    for part in path_parts:
        if not part:
            continue
        if current == "/":
            current += part
        else:
            current += "/" + part

        try:
            ftps.cwd(current)
        except ftplib.error_perm:
            print(f"[DEPLOY] Creating remote directory: {current}")
            try:
                ftps.mkd(current)
            except ftplib.error_perm:
                pass


def upload_file(ftps, local_file, remote_file, dry_run=False):
    if dry_run:
        print(f"[DRY-RUN] Would upload: {local_file} -> {remote_file}")
        return
    with open(local_file, "rb") as fh:
        ftps.storbinary(f"STOR {remote_file}", fh)


def resolve_ftp_host(host):
    """Liefert einen Hostnamen für die TLS-Zertifikatsprüfung.

    Das Netcup-Zertifikat ist auf den Servernamen (z.B. ae82b.netcup.net)
    ausgestellt, nicht auf die IP. Steht in der env-Datei eine IP, wird sie
    per Reverse-DNS aufgelöst; das Zertifikat muss anschließend trotzdem von
    einer öffentlichen CA für genau diesen Namen signiert sein.
    Noch robuster: FTP_HOST in der env-Datei direkt auf den Hostnamen setzen.
    """
    import ipaddress
    import socket
    try:
        ipaddress.ip_address(host)
    except ValueError:
        return host  # bereits ein Hostname
    try:
        name = socket.gethostbyaddr(host)[0]
        print(f"[DEPLOY] FTP_HOST ist eine IP; verbinde über '{name}' (Zertifikatsprüfung).")
        return name
    except OSError:
        return host


def sha256_of_file(path):
    """SHA-256 des Dateiinhalts (gestückelt gelesen, schont RAM bei großen JSONs)."""
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_manifest():
    """Lädt das Upload-Manifest; fehlend/defekt = leeres Manifest (alles hochladen)."""
    try:
        with open(MANIFEST_PATH, "r", encoding="utf-8") as fh:
            data = json.load(fh)
            return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def save_manifest(manifest):
    with open(MANIFEST_PATH, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=1, sort_keys=True)


def main():
    parser = argparse.ArgumentParser(description="FTPS-Deploy von dist/ auf dm0.de/terra")
    parser.add_argument("--env", default=DEFAULT_ENV, help="Pfad zur env-Datei mit FTPS-Zugangsdaten")
    parser.add_argument("--remote", default=REMOTE_BASE_DIR, help="Zielverzeichnis auf dem Webspace")
    parser.add_argument("--dry-run", action="store_true", help="Nichts schreiben, nur simulieren")
    parser.add_argument("--no-build", action="store_true", help="Zuvor keinen 'npm run build' ausführen")
    parser.add_argument("--force", action="store_true", help="Überschreibschutz für geschützte Dateien ignorieren")
    args = parser.parse_args()

    print("=" * 60)
    print("     SCIENTIA POTENTIA - DEPLOYING TO NETCUP FTPS (dm0.de/sci/)")
    print("=" * 60)

    # 1. Build ausführen falls erwünscht
    if not args.no_build:
        print("[DEPLOY] Running production build (npm run build)...")
        r = subprocess.run(["npm", "run", "build"], cwd=SCRIPT_DIR)
        if r.returncode != 0:
            print("[ERROR] Build failed. Deployment aborted.")
            sys.exit(1)

    if not os.path.exists(LOCAL_DIST) or not os.path.isdir(LOCAL_DIST):
        print(f"[ERROR] Local build directory '{LOCAL_DIST}' does not exist.")
        sys.exit(1)

    # 2. Zugangsdaten laden
    print(f"[DEPLOY] Reading FTPS credentials from: {args.env}")
    creds = load_env_credentials(args.env)
    host = resolve_ftp_host(creds["FTP_HOST"])
    user = creds["FTP_USER"]
    password = creds["FTP_PASS"]
    port = int(creds.get("FTP_PORT", "21"))

    # 3. Verbindung aufbauen
    ftps = None
    if not args.dry_run:
        print(f"[DEPLOY] Connecting to FTPS host: {host}:{port} as user: {user}...")
        try:
            # Standard-SSL-Kontext verifiziert das Server-Zertifikat inkl. Hostname —
            # ohne ihn akzeptierte FTP_TLS jedes Zertifikat (MITM-Risiko).
            ftps = ftplib.FTP_TLS(context=ssl.create_default_context())
            ftps.connect(host, port, timeout=15)
            ftps.login(user, password)
            ftps.prot_p()  # Verschlüsselt den Datenkanal (TLS)
            ftps.set_pasv(True)
            print("[DEPLOY] FTPS Connection established successfully!")
        except Exception as e:
            print(f"[ERROR] Connection failed: {e}")
            sys.exit(1)
    else:
        print(f"[DRY-RUN] Simulating connection to: {host}:{port} as user: {user}")

    # 4. Dateien rekursiv hochladen
    print(f"[DEPLOY] Commencing deployment to: {args.remote}")
    if not args.dry_run:
        mkdir_p(ftps, args.remote)

    total_files = 0
    skipped_files = 0
    failed_files = 0

    # Manifest der letzten erfolgreichen Uploads; --force lädt alles neu hoch.
    manifest = {} if args.force else load_manifest()
    new_manifest = dict(manifest)

    for root, dirs, files in os.walk(LOCAL_DIST):
        rel_path = os.path.relpath(root, LOCAL_DIST)
        if rel_path == ".":
            remote_dir = args.remote
        else:
            remote_dir = f"{args.remote}/{rel_path}".replace("\\", "/")

        if not args.dry_run:
            mkdir_p(ftps, remote_dir)

        for file in files:
            if file == ".DS_Store":
                skipped_files += 1
                continue

            local_file = os.path.join(root, file)
            remote_file = f"{remote_dir}/{file}"

            # Überschreibschutz für sensible Dateien
            is_protected = file in [".htaccess", ".htpasswd", "geodb.json"]
            if is_protected and not args.force and not args.dry_run:
                if remote_file_exists(ftps, remote_file):
                    print(f"[DEPLOY] [SKIP] Protected file already exists on server: {file}")
                    skipped_files += 1
                    continue

            # Hash-Skip: Inhalt ist identisch mit dem letzten erfolgreichen Upload
            # dieser Maschine -> nichts zu tun. Greift für ALLE Dateitypen.
            local_hash = sha256_of_file(local_file)
            if not args.force and manifest.get(remote_file) == local_hash:
                skipped_files += 1
                continue

            # Größen-Skip als Fallback für Mediendateien ohne Manifest-Eintrag
            # (z.B. erster Lauf nach Einführung des Manifests). Für Text/JSON
            # bewusst NICHT (gleiche Größe garantiert dort keinen gleichen Inhalt).
            is_media = any(m in remote_file.lower() for m in ["audio", "bilder", "images", "media"])
            if is_media and not args.force and not args.dry_run:
                if remote_file_exists(ftps, remote_file):
                    local_size = os.path.getsize(local_file)
                    remote_size = get_remote_size(ftps, remote_file)
                    if remote_size == local_size:
                        # Inhalt gilt als identisch -> künftig per Hash überspringen.
                        new_manifest[remote_file] = local_hash
                        skipped_files += 1
                        continue

            print(f"[DEPLOY] Uploading: {local_file} -> {remote_file}")
            try:
                upload_file(ftps, local_file, remote_file, dry_run=args.dry_run)
                total_files += 1
                if not args.dry_run:
                    new_manifest[remote_file] = local_hash
            except Exception as e:
                print(f"[ERROR] Failed uploading {local_file}: {e}")
                failed_files += 1

    if ftps:
        try:
            ftps.quit()
        except Exception:
            ftps.close()

    # Manifest sichern: nur tatsächlich gelungene Uploads wurden eingetragen,
    # fehlgeschlagene Dateien werden beim nächsten Lauf erneut versucht.
    if not args.dry_run:
        save_manifest(new_manifest)

    print("=" * 60)
    if args.dry_run:
        print(f"      [DRY-RUN] Simulierte Runden erfolgreich beendet ({skipped_files} übersprungen).")
    elif failed_files:
        # Teil-Deploy klar als Fehler melden (vorher: Exit 0 trotz Fehlschlägen).
        print(f"      DEPLOYMENT INCOMPLETE! {failed_files} upload(s) FAILED, {total_files} uploaded, {skipped_files} skipped.")
        print("=" * 60)
        sys.exit(1)
    else:
        print(f"      DEPLOYMENT SUCCESSFUL! Uploaded {total_files} files to Netcup ({skipped_files} skipped).")
    print("=" * 60)


if __name__ == "__main__":
    main()
