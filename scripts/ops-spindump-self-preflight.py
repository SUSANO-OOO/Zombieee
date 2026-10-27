"""Self-PID diagnostic only; the root worker directly kills/reaps its child."""
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import subprocess
import sys
import time


def observe(argv, timeout):
    started = time.monotonic()
    try:
        result = subprocess.run(argv, stdin=subprocess.DEVNULL, capture_output=True,
                                text=True, timeout=timeout, check=False)
        record = {"code": result.returncode, "stdout": result.stdout,
                  "stderr": result.stderr, "timedOut": False}
    except subprocess.TimeoutExpired as error:
        # subprocess.run kills its direct child and communicates to reap it.
        # This worker is root; it never kills a sudo wrapper instead.
        def text(value):
            return value.decode("utf-8", "replace") if isinstance(value, bytes) else value or ""
        record = {"code": None, "timedOut": True,
                  "stdout": text(error.stdout), "stderr": text(error.stderr)}
    return {"argv": argv, "limitSeconds": timeout,
            "elapsedSeconds": time.monotonic() - started, **record}


def worker(workspace, uid, gid, head, run_id):
    assert os.geteuid() == 0
    root = Path(workspace).resolve()
    assert Path.cwd().resolve() == root and root.stat().st_uid == uid and uid > 0
    assert re.fullmatch(r"[a-f0-9]{40}", head) and run_id.isdigit()
    actual = subprocess.check_output(["git", "-c", "safe.directory=" + str(root),
                                      "rev-parse", "HEAD"], text=True).strip()
    assert actual == head
    out = root / "outputs" / "ops-raw-self-preflight"
    assert out.is_dir() and out.resolve() == out and not out.is_symlink() and out.stat().st_uid == uid
    raw, parsed, receipt = out / "self.spindump", out / "self.txt", out / "report.json"
    assert not any(p.exists() for p in (raw, parsed, receipt))
    record = {"head": head, "run": run_id, "accepted": False, "diagnosticOnly": True,
              "targetIsThisRootWorkerOnly": True, "pid": os.getpid(),
              "gameStarted": False, "rawCollectionLimitSeconds": 4.5,
              "postprocessLimitSeconds": 15, "status": "starting"}
    try:
        argv = ["/usr/sbin/spindump", str(os.getpid()), "1", "10", "-onlyTarget",
                "-noText", "-noProcessingWhileSampling", "-timelimit", "4", "-o", str(raw)]
        record["collection"] = observe(argv, 4.5)
        if raw.exists():
            data = raw.read_bytes()
            record["raw"] = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
        assert not record["collection"]["timedOut"] and record["collection"]["code"] == 0
        assert 0 < record.get("raw", {}).get("bytes", 0) <= 4 * 1024 * 1024
        # Re-report the retained binary after live collection has ended. This
        # is not part of, or a replacement for, any game performance window.
        record["postprocess"] = observe(["/usr/sbin/spindump", "-i", str(raw),
                                         "-timeline", "-noBinary", "-o", str(parsed)], 15)
        assert hashlib.sha256(raw.read_bytes()).hexdigest() == record["raw"]["sha256"]
        assert not record["postprocess"]["timedOut"] and record["postprocess"]["code"] == 0
        data = parsed.read_bytes()
        assert 0 < len(data) <= 4 * 1024 * 1024
        record["parsed"] = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
        record["status"] = "self-preflight-complete"
    except Exception as error:
        record["status"] = "self-preflight-failed"
        record["error"] = repr(error)
        raise
    finally:
        receipt.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
        for file in (raw, parsed, receipt):
            if file.exists():
                assert not file.is_symlink()
                # Only these generated artifacts become readable by the
                # original workspace owner; no system permission is changed.
                os.chown(file, uid, gid)


def main():
    assert platform.system() == "Darwin" and platform.machine() == "arm64"
    if sys.argv[1:] and sys.argv[1] == "--worker":
        worker(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5], sys.argv[6])
        return
    for key, value in {"GITHUB_ACTIONS": "true", "RUNNER_ENVIRONMENT": "github-hosted",
                       "GITHUB_REPOSITORY": "SUSANO-OOO/Zombieee",
                       "GITHUB_EVENT_NAME": "workflow_dispatch",
                       "GITHUB_JOB": "observer-capabilities"}.items():
        assert os.environ[key] == value, key
    root = Path.cwd().resolve()
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    assert head == os.environ["V177_EXPECTED_HEAD_SHA"]
    (root / "outputs" / "ops-raw-self-preflight").mkdir(parents=True)
    # No parent timeout/SIGKILL is applied to sudo. The directly owning worker
    # enforces collection/postprocess deadlines and reaps every actual child.
    result = subprocess.run(["/usr/bin/sudo", "-n", "/usr/bin/python3", str(Path(__file__).resolve()),
                             "--worker", str(root), str(os.getuid()), str(os.getgid()),
                             head, os.environ["GITHUB_RUN_ID"]], check=False)
    raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
