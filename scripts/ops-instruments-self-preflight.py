"""One Instruments trace of this worker; never a game or foreign target."""
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import signal
import subprocess
import sys
import tarfile
import threading
import time


def observe(argv, timeout, inspect_startup=False):
    started = time.monotonic()
    child = subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, text=True, start_new_session=True)
    timed_out = False
    startup = None

    def remaining():
        seconds = started + timeout - time.monotonic()
        if seconds <= 0:
            raise subprocess.TimeoutExpired(argv, timeout)
        return seconds

    try:
        if inspect_startup:
            try:
                stdout, stderr = child.communicate(timeout=min(5, remaining()))
            except subprocess.TimeoutExpired:
                remaining()
                if child.returncode is None:
                    # The unreaped owned child cannot have its PID reused here.
                    try:
                        probe = subprocess.run(["/bin/ps", "-o", "pid,ppid,uid,etime,state,wchan,comm", "-p", str(child.pid)],
                                               capture_output=True, text=True, timeout=min(1, remaining()), check=False)
                        startup = {"pid": child.pid, "code": probe.returncode, "stdout": probe.stdout, "stderr": probe.stderr}
                    except Exception as probe_error:
                        startup = {"pid": child.pid, "error": repr(probe_error)}
                stdout, stderr = child.communicate(timeout=remaining())
            remaining()
        else:
            stdout, stderr = child.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        try:
            if child.returncode is None:
                if child.pid > 1 and os.getpgid(child.pid) == child.pid:
                    os.killpg(child.pid, signal.SIGKILL)
                else:
                    child.kill()
        except ProcessLookupError:
            pass
        stdout, stderr = child.communicate()
    return {"argv": argv, "limitSeconds": timeout, "elapsedSeconds": time.monotonic() - started,
            "code": child.returncode, "timedOut": timed_out, "stdout": stdout, "stderr": stderr,
            "startupObservation": startup}


def worker(workspace, uid, gid, head, run_id):
    root = Path(workspace).resolve()
    assert os.geteuid() == uid and uid > 0 and os.getgid() == gid
    assert Path.cwd().resolve() == root and root.stat().st_uid == uid
    assert re.fullmatch(r"[a-f0-9]{40}", head) and run_id == os.environ["GITHUB_RUN_ID"] and run_id.isdigit()
    assert subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip() == head
    out = root / "outputs" / "ops-instruments-self"
    assert out.is_dir() and out.resolve() == out and not out.is_symlink() and out.stat().st_uid == uid
    assert not any(out.iterdir())
    trace, archive, toc, receipt = out / "self.trace", out / "original.trace.tar.gz", out / "toc.xml", out / "report.json"
    report = {"head": head, "run": run_id, "accepted": False, "diagnosticOnly": True,
              "gameStarted": False, "targetIsThisWorkerOnly": True, "uid": uid, "sudoUsed": False, "pid": os.getpid(),
              "template": "System Trace", "requestedDurationSeconds": 1, "status": "starting"}
    report["targetExecutable"] = sys.executable
    report["targetSigning"] = observe(["/usr/bin/codesign", "--display", "--verbose=4", sys.executable], 3)
    report["targetEntitlements"] = observe(["/usr/bin/codesign", "--display", "--entitlements", ":-", sys.executable], 3)
    stop = threading.Event()

    def exercise():
        # Provide known runnable and sleeping intervals in the self-only trace.
        while not stop.is_set():
            until = time.monotonic() + .03
            while time.monotonic() < until:
                sum(range(250))
            stop.wait(.03)

    thread = threading.Thread(target=exercise, daemon=True)
    thread.start()
    try:
        report["collection"] = observe(["/usr/bin/xcrun", "xctrace", "record", "--template", "System Trace",
                                         "--attach", str(os.getpid()), "--time-limit", "1s", "--no-prompt",
                                         "--output", str(trace)], 10, inspect_startup=True)
        stop.set()
        thread.join()
        # Archive the original trace before any export/analysis can touch it.
        if trace.exists():
            with tarfile.open(archive, "w:gz", dereference=False) as tar:
                tar.add(trace, arcname="self.trace", recursive=True)
            data = archive.read_bytes()
            report["originalArchive"] = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
        c = report["collection"]
        assert c["code"] == 0 and not c["timedOut"] and report.get("originalArchive", {}).get("bytes", 0) > 0
        report["tocExport"] = observe(["/usr/bin/xcrun", "xctrace", "export", "--input", str(trace),
                                        "--toc", "--output", str(toc)], 15)
        p = report["tocExport"]
        assert p["code"] == 0 and not p["timedOut"] and toc.is_file() and toc.stat().st_size > 0
        assert hashlib.sha256(archive.read_bytes()).hexdigest() == report["originalArchive"]["sha256"]
        report["status"] = "self-trace-collected"
    except Exception as error:
        report["status"] = "self-trace-failed"
        report["error"] = repr(error)
        stop.set()
        thread.join()
        try:
            report["toolLogs"] = observe(["/usr/bin/log", "show", "--style", "compact", "--last", "30s",
                "--predicate", 'process == "xctrace" OR process == "DTServiceHub" OR process == "taskgated"',
                "--info", "--debug"], 5)
        except Exception as log_error:
            report["toolLogsError"] = repr(log_error)
        raise
    finally:
        stop.set()
        thread.join()
        receipt.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        # Outputs already belong to this ordinary runner. Do not recurse through
        # a trace's possible links or change any ownership/system permissions.
        for file in (archive, toc, receipt):
            if file.exists():
                assert not file.is_symlink() and file.parent.resolve() == out
                assert file.stat().st_uid == uid


def main():
    assert len(sys.argv) == 1 and platform.system() == "Darwin" and platform.machine() == "arm64" and os.geteuid() > 0
    for key, value in {"GITHUB_ACTIONS": "true", "RUNNER_ENVIRONMENT": "github-hosted",
                       "GITHUB_REPOSITORY": "SUSANO-OOO/Zombieee", "GITHUB_EVENT_NAME": "workflow_dispatch",
                       "GITHUB_JOB": "instruments-self"}.items():
        assert os.environ[key] == value
    root = Path.cwd().resolve()
    assert root == Path(os.environ["GITHUB_WORKSPACE"]).resolve()
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    assert re.fullmatch(r"[0-9a-f]{40}", head) and head == os.environ["V177_EXPECTED_HEAD_SHA"]
    out = root / "outputs" / "ops-instruments-self"
    out.mkdir(parents=True, exist_ok=False)
    worker(str(root), os.getuid(), os.getgid(), head, os.environ["GITHUB_RUN_ID"])


if __name__ == "__main__":
    main()
