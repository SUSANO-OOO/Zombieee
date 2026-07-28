#!/usr/bin/env python3
"""Build dedicated project-original combat cues for Version 0.9.0.

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
    "weapon-mrs-chiha-launcher-retrieve",
    "weapon-mrs-chiha-launcher-aim",
    "weapon-mrs-chiha-grenade-flight",
    "weapon-mrs-chiha-launcher-stow",
    "ability-mrs-chiha-salvo-ready",
    "ability-mrs-chiha-salvo-cylinder",
    "ability-mrs-chiha-salvo-shot",
    "ability-mrs-chiha-salvo-impact",
    "ability-mrs-chiha-salvo-final",
    "weapon-musashi-dual-katana",
    "ability-musashi-cross-guard",
    "ability-musashi-counter",
    "weapon-mayo-bite",
    "ability-mayo-feral-start",
    "ability-mayo-feral-rush",
    "ability-mayo-feral-end",
    "voice-mayo-deploy",
    "voice-mayo-attack",
    "voice-mayo-hurt",
    "voice-mayo-retreat",
    "boss-mother-entrance",
    "boss-mother-brood-warning",
    "boss-mother-brood-eruption",
    "boss-ooguchi-entrance",
    "boss-ooguchi-charge-warning",
    "boss-ooguchi-charge-impact",
    "boss-gairen-entrance",
    "boss-gairen-shell-warning",
    "boss-gairen-shell-sweep",
    "boss-futago-entrance",
    "boss-futago-cross-warning",
    "boss-futago-cross-impact",
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
    if "mother" in cue_id:
        return "mother"
    if "ooguchi" in cue_id:
        return "ooguchi"
    if "gairen" in cue_id:
        return "gairen"
    if "futago" in cue_id:
        return "futago"
    if "tky" in cue_id:
        return "plasma"
    if "mrs-chiha" in cue_id:
        return "launcher"
    if "mayo" in cue_id:
        return "mayo"
    return "katana"


def cue_duration(cue_id: str) -> float:
    if cue_id.startswith("boss-") and cue_id.endswith("entrance"):
        return .86
    if cue_id.startswith("boss-") and cue_id.endswith("warning"):
        return .64
    if cue_id.startswith("boss-"):
        return .72
    if cue_id.endswith("charge") or cue_id.endswith("salvo-ready"):
        return .58
    if cue_id.endswith("release") or cue_id.endswith("counter") or cue_id.endswith("salvo-final"):
        return .46
    if cue_id.endswith("retrieve") or cue_id.endswith("stow"):
        return .24
    if cue_id.endswith("aim") or cue_id.endswith("cylinder"):
        return .20
    if cue_id.endswith("flight"):
        return .34
    if cue_id.endswith("impact"):
        return .38
    if cue_id.endswith("retreat") or cue_id.endswith("feral-end"):
        return .42
    return .30


def synthesize(cue_id: str) -> list[float]:
    duration = cue_duration(cue_id)
    length = round(duration * SAMPLE_RATE)
    seed = int(hashlib.sha256(cue_id.encode("utf-8")).hexdigest()[:16], 16)
    rng = random.Random(seed)
    raw_noise = [rng.uniform(-1.0, 1.0) for _ in range(length)]
    body_noise = lowpass(raw_noise, 1_500 if "impact" in cue_id else 3_600)
    organic_body = lowpass(raw_noise, 520)
    shell_noise = lowpass(raw_noise, 880)
    family = cue_family(cue_id)
    samples: list[float] = []
    for index in range(length):
        time = index / SAMPLE_RATE
        progress = time / duration
        if family == "mother":
            rumble_frequency = 38 + 18 * math.sin(progress * math.pi)
            rumble = math.sin(2 * math.pi * rumble_frequency * time)
            sub = math.sin(2 * math.pi * 23 * time)
            organic_noise = organic_body[index]
            if cue_id.endswith("warning"):
                pulse = .45 + .55 * max(0.0, math.sin(2 * math.pi * 4.2 * time))
                shell = math.sin(2 * math.pi * (118 + 64 * progress) * time)
                signal = pulse * (.5 * rumble + .3 * shell) + .28 * organic_noise
            elif cue_id.endswith("eruption"):
                crack_gate = (
                    math.exp(-((time - .08) / .018) ** 2)
                    + .82 * math.exp(-((time - .21) / .024) ** 2)
                    + .62 * math.exp(-((time - .37) / .03) ** 2)
                )
                crack = body_noise[index] * crack_gate
                organ = math.sin(2 * math.pi * (74 + 38 * progress) * time)
                signal = .42 * rumble + .23 * sub + .5 * crack + .28 * organ
            else:
                rise = min(1.0, progress * 2.1)
                shell = math.sin(2 * math.pi * (62 + 26 * progress) * time)
                signal = rise * (.46 * rumble + .24 * shell + .3 * organic_noise) + .2 * sub
        elif family == "ooguchi":
            charge = math.sin(2 * math.pi * (44 + 34 * progress) * time)
            jaw = math.sin(2 * math.pi * (112 - 46 * progress) * time)
            scrape = body_noise[index]
            if cue_id.endswith("warning"):
                pulse = .35 + .65 * max(0.0, math.sin(2 * math.pi * 5.1 * time))
                signal = pulse * (.46 * charge + .3 * jaw + .28 * scrape)
            elif cue_id.endswith("impact"):
                snap = math.exp(-time / .035)
                signal = .52 * charge + snap * (.72 * scrape + .36 * jaw)
            else:
                rise = min(1.0, progress * 2.4)
                signal = rise * (.48 * charge + .3 * jaw + .34 * organic_body[index])
        elif family == "gairen":
            shell = math.sin(2 * math.pi * (58 + 15 * math.sin(progress * math.pi)) * time)
            metal = math.sin(2 * math.pi * (420 + 710 * progress) * time)
            scrape = shell_noise[index]
            if cue_id.endswith("warning"):
                pulse = .42 + .58 * max(0.0, math.sin(2 * math.pi * 3.7 * time))
                signal = pulse * (.42 * shell + .28 * metal + .35 * scrape)
            elif cue_id.endswith("sweep"):
                sweep = math.sin(2 * math.pi * (1_100 - 760 * progress) * time)
                signal = .38 * shell + .36 * sweep + .46 * scrape
            else:
                signal = min(1.0, progress * 2.2) * (.5 * shell + .24 * metal + .36 * scrape)
        elif family == "futago":
            left_voice = math.sin(2 * math.pi * (82 + 24 * math.sin(time * 13)) * time)
            right_voice = math.sin(2 * math.pi * (91 + 21 * math.sin(time * 11 + .8)) * time)
            connective = organic_body[index]
            if cue_id.endswith("warning"):
                pulse = .38 + .62 * max(0.0, math.sin(2 * math.pi * 4.4 * time))
                signal = pulse * (.32 * left_voice + .32 * right_voice + .38 * connective)
            elif cue_id.endswith("impact"):
                cross = math.sin(2 * math.pi * (760 - 540 * progress) * time)
                signal = .3 * left_voice + .3 * right_voice + .36 * cross + .4 * body_noise[index]
            else:
                signal = min(1.0, progress * 2.3) * (
                    .38 * left_voice + .38 * right_voice + .34 * connective
                )
        elif family == "plasma":
            start_frequency = 220 if "charge" in cue_id else 720
            end_frequency = 1_760 if "charge" in cue_id else 310
            frequency = start_frequency + (end_frequency - start_frequency) * progress
            carrier = math.sin(2 * math.pi * frequency * time)
            shimmer = math.sin(2 * math.pi * (frequency * 2.03) * time)
            transient = body_noise[index] * math.exp(-time / (.055 if "impact" in cue_id else .12))
            signal = .52 * carrier + .18 * shimmer + .32 * transient
        elif family == "launcher":
            if cue_id.endswith("retrieve") or cue_id.endswith("stow"):
                direction = -1 if cue_id.endswith("stow") else 1
                slide = math.sin(2 * math.pi * (520 + direction * 260 * progress) * time)
                latch = math.sin(2 * math.pi * 1_680 * time) * (
                    math.exp(-((time - .035) / .012) ** 2)
                    + .65 * math.exp(-((time - .15) / .016) ** 2)
                )
                signal = .42 * slide + .48 * latch + .16 * shell_noise[index]
            elif cue_id.endswith("aim"):
                ratchet = max(0.0, math.sin(2 * math.pi * 18 * time))
                servo = math.sin(2 * math.pi * (330 + 240 * progress) * time)
                signal = .34 * servo + .38 * ratchet * shell_noise[index]
            elif cue_id.endswith("cylinder"):
                click_gate = max(0.0, math.sin(2 * math.pi * 27 * time)) ** 7
                rotation = math.sin(2 * math.pi * (112 + 38 * progress) * time)
                signal = .38 * rotation + .58 * click_gate * shell_noise[index]
            elif cue_id.endswith("flight"):
                whistle = math.sin(2 * math.pi * (1_180 - 470 * progress) * time)
                air = body_noise[index] * (.35 + .65 * math.sin(math.pi * progress))
                signal = .3 * whistle + .62 * air
            else:
                thump = math.sin(2 * math.pi * (76 + 42 * progress) * time) * math.exp(-time / .11)
                mechanism = math.sin(2 * math.pi * 1_480 * time) * math.exp(-max(0, time - .07) / .035)
                rotation = math.sin(2 * math.pi * (18 + progress * 6) * time * 2 * math.pi)
                blast = body_noise[index] * math.exp(-time / (.07 if "impact" in cue_id or "final" in cue_id else .035))
                signal = .44 * thump + .22 * mechanism + .14 * rotation + .42 * blast
        elif family == "katana":
            sweep_frequency = 2_900 - 2_050 * progress
            blade = math.sin(2 * math.pi * sweep_frequency * time)
            second_blade = math.sin(2 * math.pi * (sweep_frequency * 1.31) * max(0, time - .045))
            ring = math.sin(2 * math.pi * 3_420 * time) * math.exp(-time / .18)
            air = body_noise[index] * math.exp(-time / .065)
            signal = .30 * blade + .27 * second_blade + .28 * ring + .34 * air
        else:
            if "bite" in cue_id:
                jaw = math.sin(2 * math.pi * (210 - 90 * progress) * time) * math.exp(-time / .045)
                snap = body_noise[index] * math.exp(-time / .018)
                signal = .5 * jaw + .58 * snap
            elif "ability" in cue_id:
                infection = math.sin(2 * math.pi * (92 + 36 * math.sin(time * 18)) * time)
                pulse = math.sin(2 * math.pi * (320 + 740 * progress) * time)
                rasp = body_noise[index] * math.exp(-time / .16)
                signal = .38 * infection + .3 * pulse + .38 * rasp
            else:
                base = 780 if "deploy" in cue_id or "attack" in cue_id else 520
                yip = math.sin(2 * math.pi * (base + 160 * math.sin(time * 34)) * time)
                growl = math.sin(2 * math.pi * (115 + 28 * math.sin(time * 19)) * time)
                rasp = body_noise[index] * math.exp(-time / .11)
                signal = (.55 * yip if "deploy" in cue_id or "attack" in cue_id else .28 * yip) + .34 * growl + .24 * rasp
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
    parser.add_argument("--wav-only", action="store_true", help="Keep generated WAV finals when FFmpeg is unavailable")
    args = parser.parse_args()
    ffmpeg = None if args.wav_only else find_ffmpeg(args.ffmpeg)
    records = []
    for cue_id in CUES:
        master = MASTER_DIR / f"{cue_id}.wav"
        mp3 = OUTPUT_DIR / f"{cue_id}.mp3"
        ogg = OUTPUT_DIR / f"{cue_id}.ogg"
        final_wav = OUTPUT_DIR / f"{cue_id}.wav"
        write_wav(master, synthesize(cue_id))
        if ffmpeg:
            encode(ffmpeg, master, mp3, "mp3")
            encode(ffmpeg, master, ogg, "ogg")
        if not mp3.is_file() or not ogg.is_file():
            final_wav.parent.mkdir(parents=True, exist_ok=True)
            final_wav.write_bytes(master.read_bytes())
        encoded_finals = [
            {"path": mp3.relative_to(ROOT).as_posix(), "sha256": sha256(mp3), "type": "audio/mpeg"},
            {"path": ogg.relative_to(ROOT).as_posix(), "sha256": sha256(ogg), "type": "audio/ogg"},
        ] if mp3.is_file() and ogg.is_file() else [
            {"path": final_wav.relative_to(ROOT).as_posix(), "sha256": sha256(final_wav), "type": "audio/wav"},
        ]
        records.append({
            "id": cue_id,
            "origin": "project-original deterministic Chihuahua synthesis; no sampled recording or human voice"
            if cue_id.startswith("voice-mayo-")
            else "project-original deterministic synthesis; no sampled recording or voice",
            "source": {"path": master.relative_to(ROOT).as_posix(), "sha256": sha256(master)},
            "finals": encoded_finals,
        })
    payload = {
        "version": 1,
        "generator": "scripts/build-v090-playable-audio.py",
        "sampleRate": SAMPLE_RATE,
        "policy": "Dedicated weapon, manual ability, synthesized Chihuahua battle cues, and boss combat cues authored in-repository without sampled recordings or human voice.",
        "cues": records,
    }
    PROVENANCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROVENANCE_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"built {len(records)} Version 0.9.0 combat cues with {ffmpeg or 'WAV-only mode'}")


if __name__ == "__main__":
    main()
