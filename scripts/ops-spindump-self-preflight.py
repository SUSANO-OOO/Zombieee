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


def validate_workspace(workspace, uid, head, run_id):
    assert os.geteuid() == 0
    root = Path(workspace).resolve()
    assert Path.cwd().resolve() == root and root.stat().st_uid == uid and uid > 0
    assert re.fullmatch(r"[a-f0-9]{40}", head) and run_id.isdigit()
    actual = subprocess.check_output(["git", "-c", "safe.directory=" + str(root),
                                      "rev-parse", "HEAD"], text=True).strip()
    assert actual == head
    return root


def worker(workspace, uid, gid, head, run_id):
    root = validate_workspace(workspace, uid, head, run_id)
    out = root / "outputs" / "ops-raw-self-preflight"
    assert out.is_dir() and out.resolve() == out and not out.is_symlink() and out.stat().st_uid == uid
    raw, parsed, receipt = out / "self.spindump", out / "self.txt", out / "report.json"
    assert not any(p.exists() or p.is_symlink() for p in (raw, parsed, receipt))
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


def owned_targets(stdout, uid, ui_pid, gpu_pid, web_pid):
    rows = []
    for line in stdout.splitlines():
        fields = line.strip().split(None, 2)
        if len(fields) == 3 and "/webkit-2380/" in fields[2]:
            rows.append({"pid": int(fields[0]), "uid": int(fields[1]), "comm": fields[2]})
    roles = {"ui": (ui_pid, "/Playwright.app/Contents/MacOS/Playwright"),
             "gpu": (gpu_pid, "/com.apple.WebKit.GPU.Development"),
             "webContent": (web_pid, "/com.apple.WebKit.WebContent.Development")}
    selected = {}
    assert len(set((ui_pid, gpu_pid, web_pid))) == 3
    for role, (pid, suffix) in roles.items():
        matches = [r for r in rows if r["comm"].endswith(suffix)]
        assert len(matches) == 1 and matches[0]["pid"] == pid and matches[0]["uid"] == uid
        selected[role] = matches[0]
    return selected


def retain_observer_failure(record, out, phase, artifacts):
    # Run40472718771 emitted this bounded diagnostic path before exiting75.
    # It is evidence about the observer, not a verified game-target stackshot.
    records = record["observerFailureEvidence"] = []
    paths = re.findall(r"Wrote stackshot to (/var/tmp/spindump-stuck-stackshot\.[0-9:.-]+\.buf)",
                       record.get("collection", record.get("postprocess", {})).get("stderr", ""))
    for index, name in enumerate(dict.fromkeys(paths)):
        entry = {"source": name, "targetContentVerified": False}
        records.append(entry)
        try:
            source = Path(name)
            assert source.parent.resolve() == Path("/var/tmp").resolve() and not source.is_symlink()
            info = source.stat()
            assert info.st_uid == 0 and 0 < info.st_size <= 4 * 1024 * 1024
            dest = out / f"0-native-{phase}-observer-{index}.buf"
            assert not dest.exists() and not dest.is_symlink()
            data = source.read_bytes()
            with dest.open("xb") as stream:
                stream.write(data)
            artifacts.append(dest)
            assert dest.read_bytes() == data
            entry.update({"file": dest.name, "bytes": len(data),
                          "sha256": hashlib.sha256(data).hexdigest(), "status": "retained"})
        except Exception as error:
            entry.update({"status": "not-retained", "error": repr(error)})


def owned_webkit_worker(workspace, uid, gid, head, run_id, phase, extra):
    root = validate_workspace(workspace, uid, head, run_id)
    out = root / "outputs" / "ops-f5-recorder-control"
    assert out.is_dir() and out.resolve() == out and out.stat().st_uid == uid
    raw, parsed = out / "0-native-stackshot.spindump", out / "0-native-stackshot.txt"
    collection = out / "0-native-stackshot-collection.json"
    receipt = collection if phase == "collect" else out / "0-native-stackshot-postprocess.json"
    assert phase in ("collect", "parse") and not receipt.exists() and not receipt.is_symlink()
    record = {"schema": "owned-webkit-stackshot/v1", "head": head, "run": run_id,
              "phase": phase, "accepted": False, "diagnosticOnly": True, "status": "starting"}
    artifacts = [receipt]
    try:
        if phase == "collect":
            ui_pid, gpu_pid, web_pid, deadline = map(int, extra)
            assert time.time() * 1000 < deadline
            result = subprocess.check_output(["/bin/ps", "-A", "-ww", "-o", "pid=,uid=,comm="], text=True, timeout=1.5)
            selected = owned_targets(result, uid, ui_pid, gpu_pid, web_pid)
            assert not raw.exists() and not raw.is_symlink()
            record.update({"targets": selected, "admissionDeadlineUnixMs": deadline})
            assert time.time() * 1000 < deadline, "No profiling may start after the parent case deadline"
            argv = ["/usr/sbin/spindump", str(gpu_pid), "1", "10", "-onlyTarget", "-proc", str(web_pid),
                    "-noText", "-noProcessingWhileSampling", "-noIPC", "-timelimit", "4", "-o", str(raw)]
            artifacts.append(raw)
            record["collection"] = observe(argv, 4.5)
            retain_observer_failure(record, out, phase, artifacts)
            if raw.exists():
                data = raw.read_bytes()
                record["raw"] = {"file": raw.name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
            assert not record["collection"]["timedOut"] and record["collection"]["code"] == 0
            assert 0 < record.get("raw", {}).get("bytes", 0) <= 4 * 1024 * 1024
            record["status"] = "raw-retained"
        else:
            source = json.loads(collection.read_text(encoding="utf-8"))
            assert source["schema"] == "owned-webkit-stackshot/v1" and source["phase"] == "collect" and source["accepted"] is False
            assert source["head"] == head and source["run"] == run_id and source["status"] == "raw-retained" and source["raw"]["file"] == raw.name
            assert raw.is_file() and not raw.is_symlink() and raw.stat().st_uid == uid and not parsed.exists() and not parsed.is_symlink()
            assert hashlib.sha256(raw.read_bytes()).hexdigest() == source["raw"]["sha256"]
            record["source"] = {"raw": source["raw"], "targets": source["targets"]}
            artifacts.append(parsed)
            record["postprocess"] = observe(["/usr/sbin/spindump", "-i", str(raw), "-timeline", "-noBinary", "-noIPC", "-o", str(parsed)], 15)
            retain_observer_failure(record, out, phase, artifacts)
            assert hashlib.sha256(raw.read_bytes()).hexdigest() == source["raw"]["sha256"]
            assert not record["postprocess"]["timedOut"] and record["postprocess"]["code"] == 0
            data = parsed.read_bytes()
            assert 0 < len(data) <= 4 * 1024 * 1024
            record["parsed"] = {"file": parsed.name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
            record["status"] = "raw-readback-complete"
    except Exception as error:
        record["status"] = "failed"
        record["error"] = repr(error)
        raise
    finally:
        receipt.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
        for file in artifacts:
            if file.exists():
                assert not file.is_symlink()
                os.chown(file, uid, gid)


def main():
    assert platform.system() == "Darwin" and platform.machine() == "arm64"
    if sys.argv[1:] and sys.argv[1] == "--worker":
        worker(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5], sys.argv[6])
        return
    if sys.argv[1:] and sys.argv[1] in ("--collect-worker", "--parse-worker"):
        owned_webkit_worker(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5], sys.argv[6],
                            "collect" if sys.argv[1] == "--collect-worker" else "parse", sys.argv[7:])
        return
    parse_owned = sys.argv[1:] == ["--parse-owned"]
    for key, value in {"GITHUB_ACTIONS": "true", "RUNNER_ENVIRONMENT": "github-hosted",
                       "GITHUB_REPOSITORY": "SUSANO-OOO/Zombieee",
                       "GITHUB_EVENT_NAME": "workflow_dispatch",
                       "GITHUB_JOB": "f5-recorder-control" if parse_owned else "observer-capabilities"}.items():
        assert os.environ[key] == value, key
    root = Path.cwd().resolve()
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    assert head == os.environ["V177_EXPECTED_HEAD_SHA"]
    if not parse_owned:
        (root / "outputs" / "ops-raw-self-preflight").mkdir(parents=True)
    # No parent timeout/SIGKILL is applied to sudo. The directly owning worker
    # enforces collection/postprocess deadlines and reaps every actual child.
    result = subprocess.run(["/usr/bin/sudo", "-n", "/usr/bin/python3", str(Path(__file__).resolve()),
                             "--parse-worker" if parse_owned else "--worker", str(root), str(os.getuid()), str(os.getgid()),
                             head, os.environ["GITHUB_RUN_ID"]], check=False)
    raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
