#!/usr/bin/env python3
"""Build dedicated project-original weapon and ability cues for the 0.9.0 trio.

Every WAV master is deterministic synthesis from oscillators and seeded noise.
No recording, sample library, generated voice, or third-party service is used.
FFmpeg is used only to encode the masters to the repository MP3/OGG contract.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import shutil
import struct
import subprocess
import wave
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MASTER_DIR = ROOT / "reference" / "audio" / "v090-generated" / "masters"
OUTPUT_DIR = ROOT / "public" / "audio" / "v090" / "sfx"
PROVENANCE_PATH = ROOT / "reference" / "audio" / "v090-generated" / "provenance.json"
SAMPLE_RATE = 44_100

CUES = (
    "weapon-tky-plasma-blade",
    "ability-tky-light-blade-charge",
    "ability-tky-light-blade-release",
    "ability-tky-light-blade-impact",
    "weapon-mrs-chiha-grenade-launcher",
    "weapon-mrs-chiha-grenade-impact",
    "weapon-mrs-chiha-launcher-bash",
    "ability-mrs-chiha-salvo-ready",
    "ability-mrs-chiha-salvo-shot",
    "ability-mrs-chiha-salvo-impact",
    "ability-mrs-chiha-salvo-final",
    "weapon-musashi-dual-katana",
    "ability-musashi-cross-guard",
    "ability-musashi-counter",
)


def envelope(index: int, length: int, attack: float, release: float) -> float:
    attack_samples = max(1, round(attack * SAMPLE_RATE))
    release_samples = max(1, round(release * SAMPLE_RATE))
    return max(0.0, min(1.0, index / attack_samples, (length - 1 - index) / release_samples))


def lowpass(samples: list[float], cutoff: float) -> list[float]:
    alpha = 1.0 - math.exp(-2.0 * math.pi * cutoff / SAMPLE_RATE)
    output: list[float] = []
    previous = 0.0
    for sample in samples:
        previous += alpha * (sample - previous)
        output.append(previous)
    return output


def cue_family(cue_id: str) -> str:
    if "tky" in cue_id:
        return "plasma"
    if "mrs-chiha" in cue_id:
        return "launcher"
    return "katana"


def cue_duration(cue_id: str) -> float:
    if cue_id.endswith("charge") or cue_id.endswith("salvo-ready"):
        return .58
    if cue_id.endswith("release") or cue_id.endswith("counter") or cue_id.endswith("salvo-final"):
        return .46
    if cue_id.endswith("impact"):
        return .38
    return .30


def synthesize(cue_id: str) -> list[float]:
    duration = cue_duration(cue_id)
    length = round(duration * SAMPLE_RATE)
    seed = int(hashlib.sha256(cue_id.encode("utf-8")).hexdigest()[:16], 16)
    rng = random.Random(seed)
    raw_noise = [rng.uniform(-1.0, 1.0) for _ in range(length)]
    body_noise = lowpass(raw_noise, 1_500 if "impact" in cue_id else 3_600)
    family = cue_family(cue_id)
    samples: list[float] = []
    for index in range(length):
        time = index / SAMPLE_RATE
        progress = time / duration
        if family == "plasma":
            start_frequency = 220 if "charge" in cue_id else 720
            end_frequency = 1_760 if "charge" in cue_id else 310
            frequency = start_frequency + (end_frequency - start_frequency) * progress
            carrier = math.sin(2 * math.pi * frequency * time)
            shimmer = math.sin(2 * math.pi * (frequency * 2.03) * time)
            transient = body_noise[index] * math.exp(-time / (.055 if "impact" in cue_id else .12))
            signal = .52 * carrier + .18 * shimmer + .32 * transient
        elif family == "launcher":
            thump = math.sin(2 * math.pi * (76 + 42 * progress) * time) * math.exp(-time / .11)
            mechanism = math.sin(2 * math.pi * 1_480 * time) * math.exp(-max(0, time - .07) / .035)
            rotation = math.sin(2 * math.pi * (18 + progress * 6) * time * 2 * math.pi)
            blast = body_noise[index] * math.exp(-time / (.07 if "impact" in cue_id or "final" in cue_id else .035))
            signal = .44 * thump + .22 * mechanism + .14 * rotation + .42 * blast
        else:
            sweep_frequency = 2_900 - 2_050 * progress
            blade = math.sin(2 * math.pi * sweep_frequency * time)
            second_blade = math.sin(2 * math.pi * (sweep_frequency * 1.31) * max(0, time - .045))
            ring = math.sin(2 * math.pi * 3_420 * time) * math.exp(-time / .18)
            air = body_noise[index] * math.exp(-time / .065)
            signal = .30 * blade + .27 * second_blade + .28 * ring + .34 * air
        signal *= envelope(index, length, .0015, .07)
        samples.append(signal)
    peak = max(abs(sample) for sample in samples) or 1.0
    return [max(-1.0, min(1.0, sample * .84 / peak)) for sample in samples]


def write_wav(path: Path, samples: list[float]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = b"".join(struct.pack("<h", round(sample * 32_767)) for sample in samples)
    with wave.open(str(path), "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(SAMPLE_RATE)
        target.writeframes(pcm)


def find_ffmpeg(explicit: str | None) -> Path:
    candidates = [Path(explicit)] if explicit else []
    located = shutil.which("ffmpeg")
    if located:
        candidates.append(Path(located))
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise SystemExit("FFmpeg was not found. Pass --ffmpeg with an executable path.")


def encode(ffmpeg: Path, source: Path, target: Path, codec: str) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    command = [
        str(ffmpeg), "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(source), "-vn", "-ar", str(SAMPLE_RATE), "-ac", "1",
    ]
    command += ["-codec:a", "libmp3lame", "-b:a", "96k"] if codec == "mp3" else [
        "-codec:a", "libvorbis", "-q:a", "4",
    ]
    command.append(str(target))
    subprocess.run(command, check=True)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ffmpeg", help="Path to ffmpeg.exe")
    args = parser.parse_args()
    ffmpeg = find_ffmpeg(args.ffmpeg)
    records = []
    for cue_id in CUES:
        master = MASTER_DIR / f"{cue_id}.wav"
        mp3 = OUTPUT_DIR / f"{cue_id}.mp3"
        ogg = OUTPUT_DIR / f"{cue_id}.ogg"
        write_wav(master, synthesize(cue_id))
        encode(ffmpeg, master, mp3, "mp3")
        encode(ffmpeg, master, ogg, "ogg")
        records.append({
            "id": cue_id,
            "origin": "project-original deterministic synthesis; no sampled recording or voice",
            "source": {"path": master.relative_to(ROOT).as_posix(), "sha256": sha256(master)},
            "finals": [
                {"path": mp3.relative_to(ROOT).as_posix(), "sha256": sha256(mp3), "type": "audio/mpeg"},
                {"path": ogg.relative_to(ROOT).as_posix(), "sha256": sha256(ogg), "type": "audio/ogg"},
            ],
        })
    payload = {
        "version": 1,
        "generator": "scripts/build-v090-playable-audio.py",
        "sampleRate": SAMPLE_RATE,
        "policy": "Dedicated non-voice weapon and manual ability cues synthesized in-repository.",
        "cues": records,
    }
    PROVENANCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROVENANCE_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"built {len(records)} Version 0.9.0 playable cues with {ffmpeg}")


if __name__ == "__main__":
    main()
