import ftplib
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

import deploy


class FakeFTPS:
    """Kleine speicherinterne FTPS-Gegenstelle für Deploy-Regressionstests."""

    def __init__(
        self,
        files=None,
        fail_upload_suffix=None,
        directories=None,
        checksum_commands=(),
        malformed_checksum_commands=(),
    ):
        self.files = dict(files or {})
        self.directories = set(directories if directories is not None else {"/", "/remote"})
        self.history = []
        self.fail_upload_suffix = fail_upload_suffix
        self.checksum_commands = {command.upper() for command in checksum_commands}
        self.malformed_checksum_commands = {
            command.upper() for command in malformed_checksum_commands
        }

    def voidcmd(self, command):
        self.history.append(("voidcmd", command))
        return "200"

    def size(self, path):
        self.history.append(("size", path))
        if path not in self.files:
            raise ftplib.error_perm("550 missing")
        return len(self.files[path])

    def sendcmd(self, command):
        self.history.append(("sendcmd", command))
        command_name, path = command.split(" ", 1)
        command_name = command_name.upper()
        if command_name not in self.checksum_commands:
            raise ftplib.error_perm("502 command not implemented")
        if path not in self.files:
            raise ftplib.error_perm("550 missing")
        if command_name in self.malformed_checksum_commands:
            return "213 no checksum here"
        algorithm = {"XSHA256": "sha256", "XMD5": "md5"}[command_name]
        return f"213 {hashlib.new(algorithm, self.files[path]).hexdigest()}"

    def cwd(self, path):
        self.history.append(("cwd", path))
        if path not in self.directories:
            raise ftplib.error_perm("550 missing directory")

    def mkd(self, path):
        self.history.append(("mkd", path))
        self.directories.add(path)

    def storbinary(self, command, file_handle):
        path = command.removeprefix("STOR ")
        self.history.append(("store", path))
        # Jeder Upload läuft über "<zielpfad>.uploading-<hex>"; der simulierte
        # Fehler soll trotzdem am gemeinten Zielpfad hängen.
        live_path = path.split(".uploading-")[0]
        if self.fail_upload_suffix and live_path.endswith(self.fail_upload_suffix):
            # Der Server hat bereits einen Teil angenommen, bevor die Verbindung
            # abbricht. Nur so beweist der Test den anschließenden DELETE-Pfad.
            self.files[path] = file_handle.read(4)
            raise OSError("simulated upload failure")
        self.files[path] = file_handle.read()

    def nlst(self, directory):
        self.history.append(("nlst", directory))
        if directory not in self.directories:
            raise ftplib.error_perm("550 missing directory")
        return [
            path for path in self.files
            if path.rsplit("/", 1)[0] == directory.rstrip("/")
        ]

    def retrbinary(self, command, callback):
        path = command.removeprefix("RETR ")
        self.history.append(("retrieve", path))
        if path not in self.files:
            raise ftplib.error_perm("550 missing")
        callback(self.files[path])

    def rename(self, source, target):
        self.history.append(("rename", source, target))
        if source not in self.files:
            raise ftplib.error_perm("550 missing")
        self.files[target] = self.files.pop(source)

    def delete(self, path):
        self.history.append(("delete", path))
        self.files.pop(path, None)


def stored_paths(ftps):
    """Alle STOR-Ziele in Reihenfolge — seit dem Atomic-Upload temporäre Pfade."""
    return [event[1] for event in ftps.history if event[0] == "store"]


def temporary_upload_of(ftps, live_path):
    """Der temporäre Uploadpfad, aus dem ``live_path`` per Rename entstanden ist."""
    return next(path for path in stored_paths(ftps) if path.startswith(f"{live_path}.uploading-"))


def metadata(content):
    return {"sha256": hashlib.sha256(content).hexdigest(), "size": len(content)}


def remote_manifest(files):
    manifest = {
        "version": deploy.MANIFEST_VERSION,
        "files": {path: metadata(content) for path, content in files.items()},
    }
    return deploy.manifest_bytes(manifest)


class DeployTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.dist = Path(self.temporary_directory.name) / "dist"
        (self.dist / "assets").mkdir(parents=True)

    def tearDown(self):
        self.temporary_directory.cleanup()

    def write_build(self, *, asset=b"new asset", index=b"new index"):
        (self.dist / "assets" / "app.js").write_bytes(asset)
        (self.dist / "index.html").write_bytes(index)

    def test_uploads_assets_before_atomic_entrypoint_and_manifest(self):
        self.write_build()
        ftps = FakeFTPS({"/remote/index.html": b"old index"})

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.failed, 0)
        self.assertEqual(ftps.files["/remote/assets/app.js"], b"new asset")
        self.assertEqual(ftps.files["/remote/index.html"], b"new index")
        stores = stored_paths(ftps)
        asset_position = stores.index(temporary_upload_of(ftps, "/remote/assets/app.js"))
        entrypoint_position = stores.index(temporary_upload_of(ftps, "/remote/index.html"))
        manifest_position = stores.index(
            temporary_upload_of(ftps, f"/remote/{deploy.REMOTE_MANIFEST_NAME}")
        )
        self.assertLess(asset_position, entrypoint_position)
        self.assertLess(entrypoint_position, manifest_position)
        self.assertIn(
            ("rename", temporary_upload_of(ftps, "/remote/index.html"), "/remote/index.html"),
            ftps.history,
        )

    def test_asset_failure_keeps_old_entrypoint_and_manifest(self):
        self.write_build()
        old_files = {"index.html": b"old index", "assets/app.js": b"old asset"}
        ftps = FakeFTPS(
            {
                "/remote/index.html": old_files["index.html"],
                f"/remote/{deploy.REMOTE_MANIFEST_NAME}": remote_manifest(old_files),
            },
            fail_upload_suffix="assets/app.js",
        )

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.failed, 1)
        self.assertEqual(result.not_attempted, 1)
        self.assertEqual(ftps.files["/remote/index.html"], b"old index")
        self.assertFalse(
            any(event[0] == "rename" and event[2] == "/remote/index.html" for event in ftps.history)
        )
        self.assertFalse(
            any(
                event[0] == "rename" and event[2] == f"/remote/{deploy.REMOTE_MANIFEST_NAME}"
                for event in ftps.history
            )
        )

    def test_matching_manifest_does_not_skip_a_missing_remote_file(self):
        self.write_build()
        declared_files = {"index.html": b"new index", "assets/app.js": b"new asset"}
        ftps = FakeFTPS(
            {
                "/remote/index.html": b"new index",
                f"/remote/{deploy.REMOTE_MANIFEST_NAME}": remote_manifest(declared_files),
            }
        )

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.failed, 0)
        self.assertEqual(ftps.files["/remote/assets/app.js"], b"new asset")
        self.assertTrue(temporary_upload_of(ftps, "/remote/assets/app.js"))

    def test_same_size_media_without_remote_hash_is_uploaded(self):
        self.write_build()
        media_directory = self.dist / "media"
        media_directory.mkdir()
        (media_directory / "sample.bin").write_bytes(b"new!")
        ftps = FakeFTPS({"/remote/media/sample.bin": b"old?"})

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.failed, 0)
        self.assertEqual(ftps.files["/remote/media/sample.bin"], b"new!")
        self.assertTrue(temporary_upload_of(ftps, "/remote/media/sample.bin"))

    def test_remote_manifest_and_size_allow_a_verified_skip(self):
        self.write_build()
        deployed_files = {"index.html": b"new index", "assets/app.js": b"new asset"}
        ftps = FakeFTPS(
            {
                "/remote/index.html": deployed_files["index.html"],
                "/remote/assets/app.js": deployed_files["assets/app.js"],
                f"/remote/{deploy.REMOTE_MANIFEST_NAME}": remote_manifest(deployed_files),
            }
        )

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.failed, 0)
        self.assertEqual(result.uploaded, 0)
        self.assertEqual(result.skipped, 2)
        stored_paths = [event[1] for event in ftps.history if event[0] == "store"]
        self.assertFalse(any(path.startswith("/remote/assets/app.js") for path in stored_paths))
        self.assertFalse(any(path.startswith("/remote/index.html.uploading-") for path in stored_paths))

    def test_skip_without_server_checksum_is_not_reported_as_verified(self):
        """Review-Fund 2026-08-25: Ohne XSHA256/XMD5 galt ein Skip als verifiziert.

        Der Skip bleibt richtig — ohne die Erweiterungen müsste sonst jeder Deploy
        alles neu hochladen. Er darf sich aber nicht als vom Server bestätigt
        ausgeben: Belegt sind nur Manifest und Größe.
        """
        self.write_build()
        deployed_files = {"index.html": b"new index", "assets/app.js": b"new asset"}
        ftps = FakeFTPS(
            {
                "/remote/index.html": deployed_files["index.html"],
                "/remote/assets/app.js": deployed_files["assets/app.js"],
                f"/remote/{deploy.REMOTE_MANIFEST_NAME}": remote_manifest(deployed_files),
            }
        )

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.skipped, 2)
        self.assertEqual(result.skipped_unverified, 2)

    def test_skip_with_server_checksum_counts_as_verified(self):
        self.write_build()
        deployed_files = {"index.html": b"new index", "assets/app.js": b"new asset"}
        ftps = FakeFTPS(
            {
                "/remote/index.html": deployed_files["index.html"],
                "/remote/assets/app.js": deployed_files["assets/app.js"],
                f"/remote/{deploy.REMOTE_MANIFEST_NAME}": remote_manifest(deployed_files),
            },
            checksum_commands={"XSHA256"},
        )

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.skipped, 2)
        self.assertEqual(result.skipped_unverified, 0)

    def test_server_checksum_reuploads_same_size_corruption_despite_manifest(self):
        """Ein passendes altes Manifest darf beschädigte Bytes nicht mehr verdecken."""
        self.write_build(asset=b"fresh")
        deployed_files = {"index.html": b"new index", "assets/app.js": b"fresh"}
        ftps = FakeFTPS(
            {
                "/remote/index.html": b"new index",
                "/remote/assets/app.js": b"stale",
                f"/remote/{deploy.REMOTE_MANIFEST_NAME}": remote_manifest(deployed_files),
            },
            checksum_commands={"XSHA256"},
        )

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.failed, 0)
        self.assertEqual(result.uploaded, 1)
        self.assertEqual(result.skipped, 1)
        self.assertEqual(ftps.files["/remote/assets/app.js"], b"fresh")
        self.assertTrue(temporary_upload_of(ftps, "/remote/assets/app.js"))

    def test_xmd5_is_used_when_xsha256_is_unavailable(self):
        self.write_build()
        deployed_files = {"index.html": b"new index", "assets/app.js": b"new asset"}
        ftps = FakeFTPS(
            {
                "/remote/index.html": deployed_files["index.html"],
                "/remote/assets/app.js": deployed_files["assets/app.js"],
                f"/remote/{deploy.REMOTE_MANIFEST_NAME}": remote_manifest(deployed_files),
            },
            checksum_commands={"XMD5"},
        )

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.failed, 0)
        self.assertEqual(result.uploaded, 0)
        self.assertEqual(result.skipped, 2)
        checksum_requests = [event[1] for event in ftps.history if event[0] == "sendcmd"]
        self.assertEqual(checksum_requests[0], "XSHA256 /remote/assets/app.js")
        self.assertEqual(checksum_requests[1], "XMD5 /remote/assets/app.js")
        self.assertEqual(checksum_requests[2], "XMD5 /remote/index.html")

    def test_disappearing_checksum_support_forces_remaining_uploads(self):
        """Ein einmal bestätigter Prüfsummenbefehl darf nicht still degradiert werden."""
        self.write_build()
        (self.dist / "assets" / "second.js").write_bytes(b"second")
        deployed_files = {
            "index.html": b"new index",
            "assets/app.js": b"new asset",
            "assets/second.js": b"second",
        }

        class DisappearingChecksumFTPS(FakeFTPS):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self.checksum_request_count = 0

            def sendcmd(self, command):
                self.checksum_request_count += 1
                if self.checksum_request_count > 1:
                    self.history.append(("sendcmd", command))
                    raise ftplib.error_perm("502 command no longer available")
                return super().sendcmd(command)

        ftps = DisappearingChecksumFTPS(
            {
                "/remote/index.html": deployed_files["index.html"],
                "/remote/assets/app.js": deployed_files["assets/app.js"],
                "/remote/assets/second.js": deployed_files["assets/second.js"],
                f"/remote/{deploy.REMOTE_MANIFEST_NAME}": remote_manifest(deployed_files),
            },
            checksum_commands={"XSHA256"},
        )

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.failed, 0)
        self.assertEqual(result.uploaded, 2)
        self.assertEqual(result.skipped, 1)
        self.assertEqual(result.skipped_unverified, 0)
        self.assertEqual(ftps.checksum_request_count, 2)
        self.assertTrue(temporary_upload_of(ftps, "/remote/assets/second.js"))
        self.assertTrue(temporary_upload_of(ftps, "/remote/index.html"))

    def test_malformed_server_checksum_forces_an_upload(self):
        self.write_build()
        deployed_files = {"index.html": b"new index", "assets/app.js": b"new asset"}
        ftps = FakeFTPS(
            {
                "/remote/index.html": deployed_files["index.html"],
                "/remote/assets/app.js": deployed_files["assets/app.js"],
                f"/remote/{deploy.REMOTE_MANIFEST_NAME}": remote_manifest(deployed_files),
            },
            checksum_commands={"XSHA256"},
            malformed_checksum_commands={"XSHA256"},
        )

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.failed, 0)
        self.assertEqual(result.uploaded, 2)
        self.assertEqual(result.skipped, 0)

    def test_assets_are_published_atomically_via_rename(self):
        """Auch Assets dürfen nie direkt auf ihren Live-Pfad geschrieben werden."""
        self.write_build()
        ftps = FakeFTPS({"/remote/assets/app.js": b"old asset"})

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.failed, 0)
        stored_paths = [event[1] for event in ftps.history if event[0] == "store"]
        # Kein STOR direkt auf den Live-Pfad; stattdessen temporäre Datei + Rename.
        self.assertNotIn("/remote/assets/app.js", stored_paths)
        temporary_asset = next(
            path for path in stored_paths if path.startswith("/remote/assets/app.js.uploading-")
        )
        self.assertIn(("rename", temporary_asset, "/remote/assets/app.js"), ftps.history)
        self.assertEqual(ftps.files["/remote/assets/app.js"], b"new asset")

    def test_failed_asset_upload_leaves_the_live_file_untouched(self):
        """Ein Abbruch beim Assetupload darf die alte Live-Datei nicht beschädigen."""
        self.write_build()
        ftps = FakeFTPS(
            {"/remote/assets/app.js": b"old asset"},
            fail_upload_suffix="app.js",
        )

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.failed, 1)
        self.assertEqual(ftps.files["/remote/assets/app.js"], b"old asset")
        # Die temporäre Datei wird nach dem Fehler wieder aufgeräumt.
        self.assertFalse(
            any(path.startswith("/remote/assets/app.js.uploading-") for path in ftps.files)
        )
        temporary_asset = next(
            event[1]
            for event in ftps.history
            if event[0] == "store" and event[1].startswith("/remote/assets/app.js.uploading-")
        )
        self.assertIn(("delete", temporary_asset), ftps.history)

    def test_keyboard_interrupt_removes_the_partial_temporary_upload(self):
        """Auch ein Benutzerabbruch durchläuft den Aufräumpfad von upload_atomic."""
        self.write_build()

        class InterruptingFTPS(FakeFTPS):
            def storbinary(self, command, file_handle):
                path = command.removeprefix("STOR ")
                self.history.append(("store", path))
                self.files[path] = file_handle.read(4)
                raise KeyboardInterrupt

        ftps = InterruptingFTPS()
        local_file = self.dist / "assets" / "app.js"

        with self.assertRaises(KeyboardInterrupt):
            deploy.upload_file(ftps, str(local_file), "/remote/assets/app.js")

        temporary_asset = temporary_upload_of(ftps, "/remote/assets/app.js")
        self.assertIn(("delete", temporary_asset), ftps.history)
        self.assertNotIn(temporary_asset, ftps.files)

    def test_root_remote_base_produces_absolute_targets(self):
        """Das gültige Ziel '/' darf keine relativen Pfade erzeugen."""
        self.write_build()
        ftps = FakeFTPS()

        result = deploy.deploy_dist(ftps, str(self.dist), "/")

        self.assertEqual(result.failed, 0)
        self.assertIn("/assets/app.js", ftps.files)
        self.assertIn("/index.html", ftps.files)
        self.assertTrue(all(path.startswith("/") for path in ftps.files))

    def test_remote_base_normalisation_rejects_unsafe_targets(self):
        self.assertEqual(deploy.normalise_remote_base("/"), "/")
        self.assertEqual(deploy.normalise_remote_base("/example.com/httpdocs/scientia/"), "/example.com/httpdocs/scientia")
        self.assertEqual(deploy.normalise_remote_base("//example.com//scientia"), "/example.com/scientia")
        self.assertEqual(deploy.normalise_remote_base("/example.com/./scientia"), "/example.com/scientia")
        # ".." wird bei absoluten Pfaden von normpath aufgelöst, nicht durchgereicht.
        self.assertEqual(deploy.normalise_remote_base("/example.com/../scientia"), "/scientia")
        for unsafe in ["sci", "./sci", "/remote ", " /remote", "", None]:
            with self.assertRaises(ValueError):
                deploy.normalise_remote_base(unsafe)

    def test_relative_remote_base_aborts_the_deployment(self):
        self.write_build()
        ftps = FakeFTPS()

        with self.assertRaises(ValueError):
            deploy.deploy_dist(ftps, str(self.dist), "sci")

        self.assertEqual(ftps.files, {})

    def test_missing_remote_base_aborts_without_creating_it(self):
        self.write_build()
        ftps = FakeFTPS(directories={"/"})

        with self.assertRaisesRegex(ValueError, "Remote-Ziel existiert nicht"):
            deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertNotIn(("mkd", "/remote"), ftps.history)
        self.assertEqual(stored_paths(ftps), [])

    def test_stale_temporary_uploads_are_removed_before_the_release(self):
        self.write_build()
        stale = "/remote/assets/app.js.uploading-abandoned"
        ftps = FakeFTPS(
            {stale: b"partial"},
            directories={"/", "/remote", "/remote/assets"},
        )

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.failed, 0)
        self.assertIn(("delete", stale), ftps.history)
        self.assertNotIn(stale, ftps.files)

    # ---- Release-Historie und Aufräumen abgelöster Dateien -----------------

    def test_manifest_carries_the_previous_release_in_its_history(self):
        """Der abgelöste Stand muss im neuen Manifest als jüngster Vorgänger stehen."""
        self.write_build()
        ftps = FakeFTPS()
        ftps.files[f"/remote/{deploy.REMOTE_MANIFEST_NAME}"] = json.dumps({
            "version": 2,
            "files": {"data/questions.old.json": {"sha256": "a" * 64, "size": 3}},
            "history": [],
        }).encode("utf-8")

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.failed, 0)
        self.assertEqual(result.manifest["version"], 2)
        self.assertEqual(result.manifest["history"][0], ["data/questions.old.json"])

    def test_superseded_data_files_survive_the_configured_number_of_releases(self):
        """Eine abgelöste Katalogdatei bleibt liegen, solange sie in der Historie steht."""
        self.write_build()
        stale = "data/questions_lingua.deadbeef.json"
        history = [[stale]] + [[f"data/other{index}.json"] for index in range(deploy.RELEASE_HISTORY_LENGTH - 2)]
        ftps = FakeFTPS({f"/remote/{stale}": b"alter Katalog"})
        ftps.files[f"/remote/{deploy.REMOTE_MANIFEST_NAME}"] = json.dumps({
            "version": 2, "files": {}, "history": history,
        }).encode("utf-8")

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.removed, 0)
        self.assertIn(f"/remote/{stale}", ftps.files)

    def test_data_file_is_removed_once_it_drops_out_of_the_history(self):
        """Fällt sie hinten heraus, wird sie gelöscht — kein Browser kann sie noch anfordern."""
        self.write_build()
        stale = "data/questions_lingua.deadbeef.json"
        # Die Historie ist voll; der abgelöste Stand rückt vorn ein und schiebt
        # den ältesten Eintrag mit dieser Datei heraus.
        history = [[f"data/keep{index}.json"] for index in range(deploy.RELEASE_HISTORY_LENGTH - 1)]
        history.append([stale])
        ftps = FakeFTPS({f"/remote/{stale}": b"alter Katalog"})
        ftps.files[f"/remote/{deploy.REMOTE_MANIFEST_NAME}"] = json.dumps({
            "version": 2, "files": {}, "history": history,
        }).encode("utf-8")

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.removed, 1)
        self.assertNotIn(f"/remote/{stale}", ftps.files)

    def test_a_file_still_in_the_current_release_is_never_removed(self):
        """Was der neue Stand selbst ausliefert, darf die Historie nicht abräumen."""
        self.write_build()
        history = [[f"data/keep{index}.json"] for index in range(deploy.RELEASE_HISTORY_LENGTH - 1)]
        history.append(["index.html", "assets/app.js"])
        ftps = FakeFTPS()
        ftps.files[f"/remote/{deploy.REMOTE_MANIFEST_NAME}"] = json.dumps({
            "version": 2, "files": {}, "history": history,
        }).encode("utf-8")

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.removed, 0)
        self.assertEqual(ftps.files["/remote/index.html"], b"new index")
        self.assertEqual(ftps.files["/remote/assets/app.js"], b"new asset")

    def test_nothing_is_removed_when_the_manifest_could_not_be_published(self):
        """Ohne veröffentlichtes Manifest führt der Server noch die alte Historie."""
        self.write_build()
        stale = "data/questions_lingua.deadbeef.json"
        history = [[f"data/keep{index}.json"] for index in range(deploy.RELEASE_HISTORY_LENGTH - 1)]
        history.append([stale])
        ftps = FakeFTPS(
            {f"/remote/{stale}": b"alter Katalog"},
            fail_upload_suffix=deploy.REMOTE_MANIFEST_NAME,
        )
        ftps.files[f"/remote/{deploy.REMOTE_MANIFEST_NAME}"] = json.dumps({
            "version": 2, "files": {}, "history": history,
        }).encode("utf-8")

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.failed, 1)
        self.assertEqual(result.removed, 0)
        self.assertIn(f"/remote/{stale}", ftps.files)

    def test_version_one_manifest_is_still_read_incrementally(self):
        """Der erste Lauf nach der Umstellung darf nicht alles neu hochladen."""
        self.write_build()
        ftps = FakeFTPS(
            {"/remote/assets/app.js": b"new asset", "/remote/index.html": b"old index"},
            checksum_commands=("XSHA256",),
        )
        ftps.files[f"/remote/{deploy.REMOTE_MANIFEST_NAME}"] = json.dumps({
            "version": 1,
            "files": {"assets/app.js": {
                "sha256": hashlib.sha256(b"new asset").hexdigest(), "size": len(b"new asset"),
            }},
        }).encode("utf-8")

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.failed, 0)
        # Das unveraenderte Asset wird uebersprungen, nur der Entrypoint geht hoch.
        self.assertEqual(result.uploaded, 1)
        self.assertEqual(result.manifest["history"][0], ["assets/app.js"])

    def test_broken_history_never_deletes_anything(self):
        """Eine unbrauchbare Historie kostet Speicher, aber niemals eine Datei."""
        self.write_build()
        ftps = FakeFTPS({"/remote/data/alt.json": b"alt"})
        ftps.files[f"/remote/{deploy.REMOTE_MANIFEST_NAME}"] = json.dumps({
            "version": 2, "files": {},
            "history": ["kein Array", {"auch": "nicht"}, ["/absolut/verboten", "../raus"]],
        }).encode("utf-8")

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.removed, 0)
        self.assertIn("/remote/data/alt.json", ftps.files)

    def test_each_remote_directory_is_prepared_only_once(self):
        self.write_build()
        (self.dist / "assets" / "second.js").write_bytes(b"second")
        ftps = FakeFTPS()

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.failed, 0)
        # Ein cwd kommt aus der Restesuche, ein weiteres aus mkdir_p. Der zweite
        # Assetupload darf keinen dritten Verzeichnis-Check auslösen.
        asset_cwds = [event for event in ftps.history if event == ("cwd", "/remote/assets")]
        self.assertEqual(len(asset_cwds), 2)

    def test_invalid_remote_manifest_never_becomes_hash_evidence(self):
        self.write_build()
        ftps = FakeFTPS(
            {
                "/remote/index.html": b"new index",
                "/remote/assets/app.js": b"new asset",
                f"/remote/{deploy.REMOTE_MANIFEST_NAME}": json.dumps(
                    {"/remote/assets/app.js": metadata(b"new asset")["sha256"]}
                ).encode("utf-8"),
            }
        )

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.failed, 0)
        self.assertTrue(temporary_upload_of(ftps, "/remote/assets/app.js"))


if __name__ == "__main__":
    unittest.main()
