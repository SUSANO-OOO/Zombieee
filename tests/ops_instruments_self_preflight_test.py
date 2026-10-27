import importlib.util
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

sys.dont_write_bytecode = True
source = Path(__file__).resolve().parents[1] / "scripts" / "ops-instruments-self-preflight.py"
spec = importlib.util.spec_from_file_location("instruments_self", source)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class InstrumentsSelfTests(unittest.TestCase):
    def test_success_and_failure_keep_original_child_results(self):
        for code in (0, 1):
            child = SimpleNamespace(pid=123, returncode=code, communicate=Mock(return_value=("stdout", "stderr")))
            with patch.object(worker.subprocess, "Popen", return_value=child) as start:
                result = worker.observe(["xcrun", "xctrace", "help"], 8)
                self.assertEqual(result["code"], code)
                self.assertEqual(result["stderr"], "stderr")
                self.assertFalse(result["timedOut"])
                self.assertTrue(start.call_args.kwargs["start_new_session"])

    def test_timeout_kills_only_owned_group_and_drains_before_returning(self):
        child = SimpleNamespace(pid=123, returncode=-9, communicate=Mock(side_effect=[subprocess.TimeoutExpired("xctrace", 10), ("partial", "timed out")]))
        kill = Mock()
        with patch.object(worker.subprocess, "Popen", return_value=child), patch.object(worker, "os", SimpleNamespace(getpgid=lambda pid: pid, killpg=kill)), patch.object(worker, "signal", SimpleNamespace(SIGKILL=9)):
            result = worker.observe(["xcrun", "xctrace", "record"], 10)
            kill.assert_called_once_with(123, 9)
            self.assertEqual(child.communicate.call_count, 2)
            self.assertTrue(result["timedOut"])
            self.assertEqual(result["stdout"], "partial")
            self.assertEqual(result["code"], -9)

    def test_foreign_group_is_not_signaled_and_owned_child_is_reaped(self):
        child = SimpleNamespace(pid=123, returncode=-9, kill=Mock(), communicate=Mock(side_effect=[subprocess.TimeoutExpired("xctrace", 10), ("partial", "stopped")]))
        kill = Mock()
        with patch.object(worker.subprocess, "Popen", return_value=child), patch.object(worker, "os", SimpleNamespace(getpgid=lambda pid: 456, killpg=kill)):
            result = worker.observe(["xcrun", "xctrace", "record"], 10)
            kill.assert_not_called()
            child.kill.assert_called_once()
            self.assertEqual(child.communicate.call_count, 2)
            self.assertTrue(result["timedOut"])


if __name__ == "__main__":
    unittest.main()
