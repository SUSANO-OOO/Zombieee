import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
source = Path(__file__).resolve().parents[1] / "scripts" / "ops-spindump-self-preflight.py"
spec = importlib.util.spec_from_file_location("owned_stackshot_worker", source)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)
prefix = "/cache/webkit-2380/"
ui = prefix + "Playwright.app/Contents/MacOS/Playwright"
gpu = prefix + "com.apple.WebKit.GPU.xpc/Contents/MacOS/com.apple.WebKit.GPU.Development"
web = prefix + "com.apple.WebKit.WebContent.xpc/Contents/MacOS/com.apple.WebKit.WebContent.Development"
rows = f"1 0 /sbin/launchd\n11 501 {ui}\n12 501 {gpu}\n13 501 {web}\n"


class OwnedWorkerTests(unittest.TestCase):
    def test_only_exact_owned_targets_are_selected(self):
        selected = worker.owned_targets(rows, 501, 11, 12, 13)
        self.assertEqual([selected[k]["pid"] for k in ("ui", "gpu", "webContent")], [11, 12, 13])

    def test_ambiguous_foreign_uid_wrong_pid_and_unpinned_targets_are_rejected(self):
        for bad, ids in [(rows + f"14 501 {web}\n", (11, 12, 13)),
                         (rows.replace("12 501", "12 0"), (11, 12, 13)),
                         (rows, (11, 999, 13)), (rows, (11, 12, 12)),
                         (rows.replace("/webkit-2380/", "/webkit-other/"), (11, 12, 13))]:
            with self.subTest(rows=bad, ids=ids), self.assertRaises(AssertionError):
                worker.owned_targets(bad, 501, *ids)

    def test_child_results_and_partial_timeout_output_are_preserved(self):
        argv = ["/usr/sbin/spindump", "123", "1", "10", "-onlyTarget"]
        for code in (0, 77):
            with patch.object(worker.subprocess, "run", return_value=subprocess.CompletedProcess(argv, code, "original stdout", "original stderr")) as call:
                result = worker.observe(argv, 4.5)
                self.assertEqual(result["code"], code)
                self.assertEqual(result["stderr"], "original stderr")
                self.assertFalse(result["timedOut"])
                self.assertEqual(call.call_args.kwargs["timeout"], 4.5)
        with patch.object(worker.subprocess, "run", side_effect=subprocess.TimeoutExpired(argv, 4.5, output=b"partial stdout", stderr=b"partial stderr")):
            result = worker.observe(argv, 4.5)
            self.assertTrue(result["timedOut"])
            self.assertIsNone(result["code"])
            self.assertEqual(result["stderr"], "partial stderr")

    def test_observer_failure_buffer_copy_is_bounded_and_never_changes_original_failure(self):
        name = "/var/tmp/spindump-stuck-stackshot.2026-10-27-08:23:49.4661.buf"
        data = b"original observer diagnostic"
        canonical = object()
        for uid, size, retained in ((0, len(data), True), (501, len(data), False), (0, 5 * 1024 * 1024, False)):
            with self.subTest(uid=uid, size=size), tempfile.TemporaryDirectory(prefix="owned-stackshot-test-") as temporary:
                out = Path(temporary).resolve()
                self.assertTrue(out.is_relative_to(Path(tempfile.gettempdir()).resolve()))
                source = SimpleNamespace(parent=SimpleNamespace(resolve=lambda: canonical), is_symlink=lambda: False,
                                         stat=lambda: SimpleNamespace(st_uid=uid, st_size=size), read_bytes=lambda: data)
                def paths(value):
                    if value == name:
                        return source
                    self.assertEqual(value, "/var/tmp")
                    return SimpleNamespace(resolve=lambda: canonical)
                record = {"collection": {"code": 75, "stderr": "Wrote stackshot to " + name + "\n"}}
                artifacts = []
                with patch.object(worker, "Path", side_effect=paths):
                    worker.retain_observer_failure(record, out, "collect", artifacts)
                self.assertEqual(record["collection"]["code"], 75)
                self.assertEqual(record["observerFailureEvidence"][0]["status"], "retained" if retained else "not-retained", record)
                if retained:
                    self.assertEqual(artifacts[0].read_bytes(), data)
                    self.assertFalse(record["observerFailureEvidence"][0]["targetContentVerified"])
                else:
                    self.assertEqual(artifacts, [])
        record = {"collection": {"code": 75, "stderr": "Wrote stackshot to /etc/passwd\n"}}
        with patch.object(worker, "Path", side_effect=AssertionError("Unapproved path must not be read")):
            worker.retain_observer_failure(record, Path(temporary), "collect", [])
        self.assertEqual(record["observerFailureEvidence"], [])


if __name__ == "__main__":
    unittest.main()
