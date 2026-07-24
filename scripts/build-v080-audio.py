#!/usr/bin/env python3
"""Build the project-original Version 0.8.0 suppressed-carbine cue pool.

The two WAV masters are deterministic synthesis from oscillators and seeded
noise. No recording, sample library, generated voice, or third-party service is
used. FFmpeg only encodes those masters to the repository's MP3/OGG formats.
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
MASTER_DIR = ROOT / "reference" / "audio" / "v080-generated" / "masters"
OUTPUT_DIR = ROOT / "public" / "audio" / "v080" / "sfx"
PROVENANCE_PATH = ROOT / "reference" / "audio" / "v080-generated" / "provenance.json"
SAMPLE_RATE = 44_100
FFMPEG_FALLBACKS = (
    Path(r"C:\Program Files (x86)\Digiarty\VideoProc Vlogger\ffmpeg.exe"),
)


def envelope(index: int, length: int, attack: float, release: float) -> float:
    attack_samples = max(1, round(attack * SAMPLE_RATE))
    release_samples = max(1, round(release * SAMPLE_RATE))
    attack_gain = min(1.0, index / attack_samples)
    release_gain = min(1.0, (length - 1 - index) / release_samples)
    return max(0.0, min(attack_gain, release_gain))


def lowpass(samples: list[float], cutoff: float) -> list[float]:
    alpha = 1.0 - math.exp(-2.0 * math.pi * cutoff / SAMPLE_RATE)
    output: list[float] = []
    previous = 0.0
    for sample in samples:
        previous += alpha * (sample - previous)
        output.append(previous)
    return output


def synthesize(variation: int) -> list[float]:
    duration = 0.34 + variation * 0.012
    length = round(duration * SAMPLE_RATE)
    rng = random.Random(80_000 + variation)
    raw_noise = [rng.uniform(-1.0, 1.0) for _ in range(length)]
    muffled_noise = lowpass(raw_noise, 1_950 + variation * 110)
    air_noise = lowpass(raw_noise, 5_600)
    samples: list[float] = []
    for index in range(length):
        time = index / SAMPLE_RATE
        muzzle_decay = math.exp(-time / (0.026 + variation * 0.002))
        body_decay = math.exp(-time / (0.083 + variation * 0.004))
        action_time = max(0.0, time - (0.112 + variation * 0.004))
        action_decay = math.exp(-action_time / 0.034) if action_time > 0 else 0.0
        pressure = math.sin(2.0 * math.pi * (104 + variation * 7) * time) * body_decay
        bolt = (
            math.sin(2.0 * math.pi * 1_520 * action_time)
            + 0.55 * math.sin(2.0 * math.pi * 2_870 * action_time)
        ) * action_decay
        signal = (
            0.56 * muffled_noise[index] * muzzle_decay
            + 0.20 * air_noise[index] * math.exp(-time / 0.012)
            + 0.31 * pressure
            + 0.17 * bolt
        )
        signal *= envelope(index, length, 0.0008, 0.075)
        samples.append(signal)
    peak = max(abs(sample) for sample in samples) or 1.0
    return [max(-1.0, min(1.0, sample * 0.86 / peak)) for sample in samples]


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
    candidates.extend(FFMPEG_FALLBACKS)
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
    parser.add_argument("--ffmpeg", help="Path to ffmpeg.exe when it is not on PATH")
    args = parser.parse_args()
    ffmpeg = find_ffmpeg(args.ffmpeg)
    records = []
    for variation in (1, 2):
        cue_id = f"weapon-suppressed-carbine-{variation:02d}"
        master = MASTER_DIR / f"{cue_id}.wav"
        mp3 = OUTPUT_DIR / f"{cue_id}.mp3"
        ogg = OUTPUT_DIR / f"{cue_id}.ogg"
        write_wav(master, synthesize(variation))
        encode(ffmpeg, master, mp3, "mp3")
        encode(ffmpeg, master, ogg, "ogg")
        records.append({
            "id": cue_id,
            "origin": "project-original deterministic synthesis; no sampled recording",
            "source": {"path": master.relative_to(ROOT).as_posix(), "sha256": sha256(master)},
            "finals": [
                {"path": mp3.relative_to(ROOT).as_posix(), "sha256": sha256(mp3), "type": "audio/mpeg"},
                {"path": ogg.relative_to(ROOT).as_posix(), "sha256": sha256(ogg), "type": "audio/ogg"},
            ],
        })
    payload = {
        "version": 1,
        "generator": "scripts/build-v080-audio.py",
        "sampleRate": SAMPLE_RATE,
        "policy": "Dedicated suppressed-carbine pool; no sampled recording and no human or generated voice.",
        "cues": records,
    }
    PROVENANCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROVENANCE_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"built {len(records)} Version 0.8.0 suppressed-carbine cues with {ffmpeg}")


if __name__ == "__main__":
    main()
