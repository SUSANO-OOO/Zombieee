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

    def timeout_child(self, code=-9):
        child = SimpleNamespace(pid=123, returncode=None, kill=Mock())
        def communicate(**kwargs):
            if "timeout" in kwargs:
                raise subprocess.TimeoutExpired("xctrace", kwargs["timeout"])
            child.returncode = code
            return "partial", "stopped"
        child.communicate = Mock(side_effect=communicate)
        return child

    def test_timeout_kills_only_owned_group_and_drains_before_returning(self):
        child, kill = self.timeout_child(), Mock()
        with patch.object(worker.subprocess, "Popen", return_value=child), patch.object(worker, "os", SimpleNamespace(getpgid=lambda pid: pid, killpg=kill)), patch.object(worker, "signal", SimpleNamespace(SIGKILL=9)):
            result = worker.observe(["xcrun", "xctrace", "record"], 10)
            kill.assert_called_once_with(123, 9)
            self.assertEqual(child.communicate.call_count, 2)
            self.assertTrue(result["timedOut"])
            self.assertEqual(result["code"], -9)

    def test_foreign_group_is_not_signaled_and_owned_child_is_reaped(self):
        child, kill = self.timeout_child(), Mock()
        with patch.object(worker.subprocess, "Popen", return_value=child), patch.object(worker, "os", SimpleNamespace(getpgid=lambda pid: 456, killpg=kill)):
            result = worker.observe(["xcrun", "xctrace", "record"], 10)
            kill.assert_not_called()
            child.kill.assert_called_once()
            self.assertEqual(child.communicate.call_count, 2)
            self.assertTrue(result["timedOut"])

    def test_startup_observation_retains_the_original_timeout_and_child_output(self):
        clock, child, kill = SimpleNamespace(now=100), self.timeout_child(), Mock()
        def communicate(**kwargs):
            if "timeout" not in kwargs:
                child.returncode = -9
                return "partial", "stopped"
            if clock.now == 100:
                clock.now = 105
            else:
                clock.now = 110.1
            raise subprocess.TimeoutExpired("xctrace", kwargs["timeout"])
        child.communicate = Mock(side_effect=communicate)
        def snapshot(*args, **kwargs):
            clock.now = 105.2
            return subprocess.CompletedProcess(["ps"], 0, "123 42 501 00:05 S wait xctrace", "")
        with patch.object(worker.subprocess, "Popen", return_value=child), patch.object(worker.subprocess, "run", side_effect=snapshot) as ps, patch.object(worker.time, "monotonic", side_effect=lambda: clock.now), patch.object(worker, "os", SimpleNamespace(getpgid=lambda pid: pid, killpg=kill)), patch.object(worker, "signal", SimpleNamespace(SIGKILL=9)):
            result = worker.observe(["xcrun", "xctrace", "record"], 10, inspect_startup=True)
            self.assertTrue(result["timedOut"])
            self.assertEqual(result["code"], -9)
            self.assertEqual(result["startupObservation"]["pid"], 123)
            self.assertAlmostEqual(child.communicate.call_args_list[1].kwargs["timeout"], 4.8)
            self.assertLessEqual(ps.call_args.kwargs["timeout"], 1)
            kill.assert_called_once_with(123, 9)

    def test_startup_observer_failure_cannot_replace_a_successful_profile_result(self):
        clock, child = SimpleNamespace(now=100), self.timeout_child()
        def communicate(**kwargs):
            if clock.now == 100:
                clock.now = 105
                raise subprocess.TimeoutExpired("xctrace", 5)
            clock.now, child.returncode = 106.1, 0
            return "finished", ""
        child.communicate = Mock(side_effect=communicate)
        def snapshot(*args, **kwargs):
            clock.now = 106
            raise subprocess.TimeoutExpired("ps", 1)
        with patch.object(worker.subprocess, "Popen", return_value=child), patch.object(worker.subprocess, "run", side_effect=snapshot), patch.object(worker.time, "monotonic", side_effect=lambda: clock.now):
            result = worker.observe(["xcrun", "xctrace", "record"], 10, inspect_startup=True)
            self.assertEqual(result["code"], 0)
            self.assertFalse(result["timedOut"])
            self.assertIn("TimeoutExpired", result["startupObservation"]["error"])
            self.assertAlmostEqual(child.communicate.call_args_list[1].kwargs["timeout"], 4)

    def test_exhausted_budget_never_turns_a_late_zero_exit_into_success(self):
        for during_ps in (False, True):
            clock, child, kill = SimpleNamespace(now=100), self.timeout_child(0), Mock()
            def communicate(**kwargs):
                if during_ps and "timeout" in kwargs:
                    clock.now = 105
                    raise subprocess.TimeoutExpired("xctrace", 5)
                clock.now, child.returncode = 111, 0
                return "late output", ""
            def snapshot(*args, **kwargs):
                self.assertLessEqual(kwargs["timeout"], 1)
                clock.now = 111
                return subprocess.CompletedProcess(["ps"], 0, "owned child", "")
            child.communicate = Mock(side_effect=communicate)
            with self.subTest(during_ps=during_ps), patch.object(worker.subprocess, "Popen", return_value=child), patch.object(worker.subprocess, "run", side_effect=snapshot) as ps, patch.object(worker.time, "monotonic", side_effect=lambda: clock.now), patch.object(worker, "os", SimpleNamespace(getpgid=lambda pid: pid, killpg=kill)), patch.object(worker, "signal", SimpleNamespace(SIGKILL=9)):
                result = worker.observe(["xcrun", "xctrace", "record"], 10, inspect_startup=True)
                self.assertTrue(result["timedOut"])
                self.assertEqual(result["code"], 0)
                if during_ps:
                    kill.assert_called_once_with(123, 9)
                else:
                    kill.assert_not_called()
                    ps.assert_not_called()

    def test_exited_leader_is_not_reaped_before_pipe_holding_descendants_are_stopped(self):
        clock, child, closed = SimpleNamespace(now=100), self.timeout_child(0), SimpleNamespace(value=False)
        child.poll = Mock(side_effect=AssertionError("poll would reap the group leader too early"))
        def communicate(**kwargs):
            if "timeout" in kwargs:
                clock.now = 105 if clock.now == 100 else 110.1
                raise subprocess.TimeoutExpired("descendant holds stdout", kwargs["timeout"])
            self.assertTrue(closed.value, "must stop pipe-holding descendants before draining")
            child.returncode = 0
            return "retained child output", ""
        child.communicate = Mock(side_effect=communicate)
        def kill_group(pid, sig):
            self.assertEqual((pid, sig), (123, 9))
            closed.value = True
        def snapshot(*args, **kwargs):
            clock.now = 105.2
            return subprocess.CompletedProcess(["ps"], 0, "123 42 501 00:05 Z wait xctrace", "")
        with patch.object(worker.subprocess, "Popen", return_value=child), patch.object(worker.subprocess, "run", side_effect=snapshot), patch.object(worker.time, "monotonic", side_effect=lambda: clock.now), patch.object(worker, "os", SimpleNamespace(getpgid=lambda pid: pid, killpg=kill_group)), patch.object(worker, "signal", SimpleNamespace(SIGKILL=9)):
            result = worker.observe(["xcrun", "xctrace", "record"], 10, inspect_startup=True)
            self.assertTrue(result["timedOut"])
            self.assertEqual(result["code"], 0)
            self.assertEqual(result["stdout"], "retained child output")
            child.poll.assert_not_called()


if __name__ == "__main__":
    unittest.main()
