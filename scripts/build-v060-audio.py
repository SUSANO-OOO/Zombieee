#!/usr/bin/env python3
"""Build deterministic, project-original 0.6.0 newcomer audio.

The WAV masters are synthesized from mathematical waveforms and seeded noise;
no third-party recording is sampled. FFmpeg is used only to encode the same
master to the repository's iPhone-first MP3 and OGG fallback formats.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
MASTER_DIR = ROOT / "reference" / "audio" / "generated-masters-v1"
OUTPUT_DIR = ROOT / "public" / "audio" / "v060" / "sfx"
PROVENANCE_PATH = ROOT / "reference" / "audio" / "generated-audio-provenance-v1.json"
SAMPLE_RATE = 44_100
FFMPEG_FALLBACKS = (
    Path(r"C:\Program Files (x86)\Digiarty\VideoProc Vlogger\ffmpeg.exe"),
)


def time_axis(duration: float) -> np.ndarray:
    return np.arange(max(1, round(duration * SAMPLE_RATE)), dtype=np.float64) / SAMPLE_RATE


def envelope(length: int, attack: float = 0.01, release: float = 0.08) -> np.ndarray:
    env = np.ones(length, dtype=np.float64)
    attack_n = min(length, max(1, round(attack * SAMPLE_RATE)))
    release_n = min(length, max(1, round(release * SAMPLE_RATE)))
    env[:attack_n] *= np.linspace(0.0, 1.0, attack_n, endpoint=False)
    env[-release_n:] *= np.linspace(1.0, 0.0, release_n)
    return env


def exp_decay(length: int, seconds: float) -> np.ndarray:
    return np.exp(-np.arange(length, dtype=np.float64) / max(1.0, seconds * SAMPLE_RATE))


def lowpass(signal: np.ndarray, cutoff: float) -> np.ndarray:
    alpha = 1.0 - math.exp(-2.0 * math.pi * cutoff / SAMPLE_RATE)
    result = np.empty_like(signal)
    previous = 0.0
    for index, value in enumerate(signal):
        previous += alpha * (value - previous)
        result[index] = previous
    return result


def highpass(signal: np.ndarray, cutoff: float) -> np.ndarray:
    return signal - lowpass(signal, cutoff)


def noise(rng: np.random.Generator, length: int, low: float | None = None, high: float | None = None) -> np.ndarray:
    signal = rng.normal(0.0, 1.0, length)
    if high is not None:
        signal = lowpass(signal, high)
    if low is not None:
        signal = highpass(signal, low)
    peak = np.max(np.abs(signal)) or 1.0
    return signal / peak


def oscillator_from_frequency(frequency: np.ndarray, kind: str = "sine") -> np.ndarray:
    phase = 2.0 * math.pi * np.cumsum(frequency) / SAMPLE_RATE
    if kind == "saw":
        return 2.0 * ((phase / (2.0 * math.pi)) % 1.0) - 1.0
    if kind == "square":
        return np.sign(np.sin(phase))
    return np.sin(phase)


def burst(length: int, at: float, duration: float, source: np.ndarray) -> np.ndarray:
    result = np.zeros(length, dtype=np.float64)
    start = max(0, round(at * SAMPLE_RATE))
    count = min(len(source), max(0, length - start), max(1, round(duration * SAMPLE_RATE)))
    if count:
        result[start : start + count] += source[:count] * envelope(count, 0.002, min(0.08, duration * 0.65))
    return result


def resonant_metal(duration: float, frequencies: tuple[float, ...], decay: float, rng: np.random.Generator) -> np.ndarray:
    t = time_axis(duration)
    result = np.zeros(len(t), dtype=np.float64)
    for index, frequency in enumerate(frequencies):
        detune = 1.0 + rng.uniform(-0.008, 0.008)
        result += np.sin(2.0 * math.pi * frequency * detune * t + rng.uniform(0, math.tau)) * exp_decay(len(t), decay / (1.0 + index * 0.14))
    result /= max(1.0, len(frequencies) * 0.52)
    return result * envelope(len(t), 0.001, 0.06)


def chainsaw(duration: float, start_hz: float, end_hz: float, rng: np.random.Generator, attack: float = 0.02, release: float = 0.10) -> np.ndarray:
    t = time_axis(duration)
    frequency = np.linspace(start_hz, end_hz, len(t))
    motor = 0.50 * oscillator_from_frequency(frequency, "saw")
    motor += 0.25 * oscillator_from_frequency(frequency * 2.02, "square")
    motor += 0.12 * oscillator_from_frequency(frequency * 3.07, "sine")
    grit = noise(rng, len(t), low=350, high=5_800)
    chain_mod = 0.56 + 0.44 * np.square(np.sin(2.0 * math.pi * (frequency * 0.43) * t))
    result = (motor * 0.66 + grit * 0.34) * chain_mod
    return result * envelope(len(t), attack, release)


def voice_grunt(duration: float, base_hz: float, end_hz: float, roughness: float, rng: np.random.Generator, event: str) -> np.ndarray:
    t = time_axis(duration)
    pitch = np.linspace(base_hz, end_hz, len(t))
    vibrato = 1.0 + 0.018 * np.sin(2.0 * math.pi * (5.1 + rng.uniform(-0.4, 0.4)) * t)
    phase = 2.0 * math.pi * np.cumsum(pitch * vibrato) / SAMPLE_RATE
    source = np.zeros(len(t), dtype=np.float64)
    for harmonic in range(1, 9):
        source += np.sin(phase * harmonic + rng.uniform(-0.15, 0.15)) / (harmonic ** 1.18)
    formant = (
        0.40 * np.sin(2.0 * math.pi * 520 * t)
        + 0.20 * np.sin(2.0 * math.pi * 1_260 * t)
        + 0.10 * np.sin(2.0 * math.pi * 2_350 * t)
    )
    breath = noise(rng, len(t), low=280, high=4_800)
    syllable = 0.78 + 0.22 * np.sin(2.0 * math.pi * (2.1 if event == "death" else 3.4) * t - 0.7)
    result = (0.68 * source + 0.16 * formant + roughness * 0.28 * breath) * syllable
    if event == "hurt":
        result += burst(len(t), 0.0, 0.08, noise(rng, round(0.08 * SAMPLE_RATE), low=500, high=6_000)) * 0.30
    if event == "death":
        result *= np.linspace(1.0, 0.42, len(t))
    return result * envelope(len(t), 0.012, min(0.20, duration * 0.32))


def build_cues() -> dict[str, np.ndarray]:
    rng = np.random.default_rng(0xA5F060)
    cues: dict[str, np.ndarray] = {}

    start = chainsaw(1.05, 42, 122, rng, 0.015, 0.08)
    pull = burst(len(start), 0.01, 0.17, noise(rng, round(0.17 * SAMPLE_RATE), low=180, high=3_800))
    cues["weapon-chainsaw-start"] = start + pull * 0.30
    cues["weapon-chainsaw-idle-loop"] = chainsaw(0.80, 112, 112, rng, 0.045, 0.045)
    attack = chainsaw(0.46, 118, 176, rng, 0.008, 0.055)
    attack += burst(len(attack), 0.18, 0.20, noise(rng, round(0.20 * SAMPLE_RATE), low=700, high=8_000)) * 0.34
    cues["weapon-chainsaw-attack"] = attack
    flesh_t = time_axis(0.34)
    cues["weapon-chainsaw-flesh-hit"] = (
        np.sin(2.0 * math.pi * np.linspace(82, 46, len(flesh_t)) * flesh_t) * exp_decay(len(flesh_t), 0.10) * 0.58
        + noise(rng, len(flesh_t), low=140, high=2_400) * exp_decay(len(flesh_t), 0.075) * 0.42
    ) * envelope(len(flesh_t), 0.002, 0.06)
    hard = resonant_metal(0.48, (310, 690, 1_370, 2_620), 0.18, rng)
    hard += chainsaw(0.48, 135, 104, rng, 0.004, 0.12) * 0.28
    cues["weapon-chainsaw-hard-hit"] = hard
    cues["weapon-chainsaw-stop"] = chainsaw(0.78, 118, 31, rng, 0.005, 0.16)

    swing_t = time_axis(0.28)
    swing = highpass(noise(rng, len(swing_t), high=7_500), 650)
    swing *= np.sin(np.linspace(0.0, math.pi, len(swing_t))) ** 2
    cues["weapon-pan-swing"] = swing * 0.62
    pan_hit = resonant_metal(0.58, (515, 930, 1_760, 3_220), 0.22, rng)
    pan_hit += noise(rng, len(pan_hit), low=150, high=2_200) * exp_decay(len(pan_hit), 0.035) * 0.22
    cues["weapon-pan-hit"] = pan_hit
    pan_heavy = resonant_metal(0.72, (285, 575, 1_145, 2_280), 0.30, rng)
    pan_heavy += burst(len(pan_heavy), 0.055, 0.13, noise(rng, round(0.13 * SAMPLE_RATE), low=90, high=1_600)) * 0.38
    cues["weapon-pan-heavy-hit"] = pan_heavy
    pan_stun = resonant_metal(0.86, (760, 1_525, 2_305, 3_830), 0.36, rng)
    pan_stun *= 0.78 + 0.22 * np.sin(2.0 * math.pi * 7.5 * np.arange(len(pan_stun)) / SAMPLE_RATE)
    cues["weapon-pan-stun"] = pan_stun

    shot_t = time_axis(0.20)
    suppressed = noise(rng, len(shot_t), low=180, high=4_500) * exp_decay(len(shot_t), 0.024) * 0.48
    suppressed += np.sin(2.0 * math.pi * np.linspace(118, 58, len(shot_t)) * shot_t) * exp_decay(len(shot_t), 0.055) * 0.60
    cues["weapon-suppressed-pistol"] = suppressed * envelope(len(shot_t), 0.001, 0.035)
    suppressed_hit_t = time_axis(0.24)
    cues["weapon-suppressed-hit"] = (
        noise(rng, len(suppressed_hit_t), low=120, high=1_900) * exp_decay(len(suppressed_hit_t), 0.045) * 0.48
        + np.sin(2.0 * math.pi * 92 * suppressed_hit_t) * exp_decay(len(suppressed_hit_t), 0.07) * 0.34
    ) * envelope(len(suppressed_hit_t), 0.001, 0.05)
    reload_length = len(time_axis(0.62))
    reload_signal = np.zeros(reload_length, dtype=np.float64)
    for at, frequency, strength in ((0.04, 2_050, 0.55), (0.18, 1_120, 0.48), (0.39, 2_740, 0.62), (0.49, 760, 0.36)):
        click_t = time_axis(0.075)
        click = np.sin(2.0 * math.pi * frequency * click_t) * exp_decay(len(click_t), 0.016)
        click += noise(rng, len(click_t), low=1_000, high=8_500) * exp_decay(len(click_t), 0.012) * 0.22
        reload_signal += burst(reload_length, at, 0.075, click) * strength
    cues["weapon-suppressed-reload"] = reload_signal
    kill = np.zeros(len(time_axis(0.64)), dtype=np.float64)
    kill[: len(suppressed)] += suppressed * 0.82
    tail_t = time_axis(0.52)
    tail = (np.sin(2.0 * math.pi * 410 * tail_t) + 0.55 * np.sin(2.0 * math.pi * 615 * tail_t)) * exp_decay(len(tail_t), 0.20)
    kill += burst(len(kill), 0.11, 0.52, tail) * 0.20
    cues["weapon-special-kill"] = kill

    voice_profiles = {
        "crazy-king": (108.0, 80.0, 0.68),
        "kumaverson": (126.0, 101.0, 0.38),
        "babayaga": (151.0, 132.0, 0.20),
    }
    voice_events = {
        "deploy": (0.42, 1.06, 0.92),
        "attack": (0.30, 1.10, 0.96),
        "hurt": (0.34, 1.18, 0.76),
        "death": (0.82, 1.00, 0.55),
    }
    for character, (base, end, roughness) in voice_profiles.items():
        for event, (duration, start_scale, end_scale) in voice_events.items():
            cues[f"voice-{character}-{event}"] = voice_grunt(
                duration,
                base * start_scale,
                end * end_scale,
                roughness,
                rng,
                event,
            )

    return cues


def normalize(signal: np.ndarray, peak: float = 0.92) -> np.ndarray:
    signal = np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0)
    current = float(np.max(np.abs(signal))) or 1.0
    return np.clip(signal * (peak / current), -1.0, 1.0)


def write_wav(path: Path, signal: np.ndarray) -> None:
    pcm = (normalize(signal) * 32_767).astype("<i2")
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(SAMPLE_RATE)
        target.writeframes(pcm.tobytes())


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
    args = [str(ffmpeg), "-y", "-hide_banner", "-loglevel", "error", "-i", str(source), "-vn", "-ar", str(SAMPLE_RATE), "-ac", "1"]
    if codec == "mp3":
        args += ["-codec:a", "libmp3lame", "-b:a", "96k"]
    else:
        args += ["-codec:a", "libvorbis", "-q:a", "4"]
    args.append(str(target))
    subprocess.run(args, check=True)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ffmpeg", help="Path to ffmpeg.exe when it is not on PATH")
    args = parser.parse_args()
    ffmpeg = find_ffmpeg(args.ffmpeg)
    cues = build_cues()
    records = []
    for cue_id, signal in sorted(cues.items()):
        master = MASTER_DIR / f"{cue_id}.wav"
        mp3 = OUTPUT_DIR / f"{cue_id}.mp3"
        ogg = OUTPUT_DIR / f"{cue_id}.ogg"
        write_wav(master, signal)
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
        "generator": "scripts/build-v060-audio.py",
        "sampleRate": SAMPLE_RATE,
        "policy": "Every newcomer cue has a dedicated project-original WAV master and dedicated MP3/OGG finals.",
        "cues": records,
    }
    PROVENANCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROVENANCE_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"built {len(records)} dedicated newcomer cues with {ffmpeg}")


if __name__ == "__main__":
    main()
