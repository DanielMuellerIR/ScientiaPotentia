import ftplib
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

import deploy


class FakeFTPS:
    """Kleine speicherinterne FTPS-Gegenstelle für Deploy-Regressionstests."""

    def __init__(self, files=None, fail_upload_suffix=None):
        self.files = dict(files or {})
        self.directories = {"/", "/remote"}
        self.history = []
        self.fail_upload_suffix = fail_upload_suffix

    def voidcmd(self, command):
        self.history.append(("voidcmd", command))
        return "200"

    def size(self, path):
        self.history.append(("size", path))
        if path not in self.files:
            raise ftplib.error_perm("550 missing")
        return len(self.files[path])

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
        if self.fail_upload_suffix and path.endswith(self.fail_upload_suffix):
            raise OSError("simulated upload failure")
        self.files[path] = file_handle.read()

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
        stores = [event[1] for event in ftps.history if event[0] == "store"]
        asset_position = stores.index("/remote/assets/app.js")
        entrypoint_position = next(
            index for index, path in enumerate(stores) if path.startswith("/remote/index.html.uploading-")
        )
        manifest_position = next(
            index
            for index, path in enumerate(stores)
            if path.startswith(f"/remote/{deploy.REMOTE_MANIFEST_NAME}.uploading-")
        )
        self.assertLess(asset_position, entrypoint_position)
        self.assertLess(entrypoint_position, manifest_position)
        self.assertIn(
            ("rename", next(path for path in stores if path.startswith("/remote/index.html.uploading-")), "/remote/index.html"),
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
        self.assertIn(("store", "/remote/assets/app.js"), ftps.history)

    def test_same_size_media_without_remote_hash_is_uploaded(self):
        self.write_build()
        media_directory = self.dist / "media"
        media_directory.mkdir()
        (media_directory / "sample.bin").write_bytes(b"new!")
        ftps = FakeFTPS({"/remote/media/sample.bin": b"old?"})

        result = deploy.deploy_dist(ftps, str(self.dist), "/remote")

        self.assertEqual(result.failed, 0)
        self.assertEqual(ftps.files["/remote/media/sample.bin"], b"new!")
        self.assertIn(("store", "/remote/media/sample.bin"), ftps.history)

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
        self.assertFalse(any(path == "/remote/assets/app.js" for path in stored_paths))
        self.assertFalse(any(path.startswith("/remote/index.html.uploading-") for path in stored_paths))

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
        self.assertIn(("store", "/remote/assets/app.js"), ftps.history)


if __name__ == "__main__":
    unittest.main()
