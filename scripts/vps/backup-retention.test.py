import os
from pathlib import Path
import tempfile
import time
import unittest

source = Path(__file__).with_name("backup-demos.sh").read_text(encoding="utf-8")
embedded = source.split("<<'PY_RETENTION'\n", 1)[1].split("\nPY_RETENTION", 1)[0]
namespace = {"__name__": "backup_retention_under_test"}
exec(compile(embedded, "backup-demos.sh:retention", "exec"), namespace)
prune = namespace["prune_generated_backups"]


class RetentionTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="scalaris-backup-retention-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.old = time.time() - 20 * 24 * 60 * 60
        self.cutoff = time.time() - 14 * 24 * 60 * 60

    def snapshot(self, name, files):
        snapshot = self.root / name
        for relative in files:
            file = snapshot / relative
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text("synthetic backup fixture", encoding="utf-8")
        for entry in sorted(snapshot.rglob("*"), key=lambda item: len(item.parts), reverse=True):
            os.utime(entry, (self.old, self.old))
        os.utime(snapshot, (self.old, self.old))
        return snapshot

    def test_removes_complete_old_configuration_including_nested_routes(self):
        snapshot = self.snapshot("20200101T010101Z", ["gestudio.env", "pharmahome.commit", "calendario-servicios.commit", "gestudio-code-overlay.tar.gz", "gestudio-provision-helper.tar.gz", "gestudio-public-demo.tar.gz", "gestudio-code.SHA256SUMS", "caddy-sites/apps.caddy", "caddy-sites/demos/gestudio.routes"])
        prune(self.root, namespace["CONFIGURATION_FILES"], {"caddy-sites"}, self.cutoff)
        self.assertFalse(snapshot.exists())

    def test_removes_only_generated_gestudio_snapshots(self):
        old = self.snapshot("20200101T010101Z", ["database.dump", "receipts.tar.gz", "database.contents", "SHA256SUMS"])
        unexpected = self.snapshot("20200102T010101Z", ["database.dump", "operator-notes.txt"])
        unrelated = self.snapshot("manual-retained", ["database.dump"])
        prune(self.root, {"database.dump", "receipts.tar.gz", "database.contents", "SHA256SUMS"}, set(), self.cutoff)
        self.assertFalse(old.exists())
        self.assertTrue(unexpected.exists())
        self.assertTrue(unrelated.exists())

    def test_keeps_recently_modified_old_snapshot(self):
        snapshot = self.snapshot("20200101T010101Z", ["database.dump"])
        os.utime(snapshot / "database.dump", None)
        prune(self.root, {"database.dump"}, set(), self.cutoff)
        self.assertTrue(snapshot.exists())

    def test_keeps_new_snapshot_even_when_source_files_have_old_times(self):
        name = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
        snapshot = self.snapshot(name, ["gestudio.env"])
        prune(self.root, {"gestudio.env"}, set(), self.cutoff)
        self.assertTrue(snapshot.exists())

    def test_keeps_snapshot_with_symlink(self):
        snapshot = self.snapshot("20200101T010101Z", ["database.dump"])
        outside = self.root / "outside.txt"
        outside.write_text("keep", encoding="utf-8")
        try:
            (snapshot / "link").symlink_to(outside)
        except OSError as error:
            self.skipTest(f"Symlinks unavailable on this host: {error}")
        os.utime(snapshot, (self.old, self.old))
        prune(self.root, {"database.dump", "link"}, set(), self.cutoff)
        self.assertTrue(snapshot.exists())
        self.assertTrue(outside.exists())


if __name__ == "__main__":
    unittest.main()
