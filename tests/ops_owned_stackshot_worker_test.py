import importlib.util
from pathlib import Path
import subprocess
import sys
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


if __name__ == "__main__":
    unittest.main()
