#!/usr/bin/env python3
"""Build deterministic, layered 0.7.0 story and station audio.

Every master is synthesized from periodic oscillators, deterministic spectral
noise, and transient envelopes. No recording, speech model, or third-party
sample is used. FFmpeg only encodes each project-original WAV master to the
iPhone-first MP3 and OGG alternatives consumed by the game manifest.
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
MASTER_DIR = ROOT / "reference" / "audio" / "v070-generated" / "masters"
OUTPUT_ROOT = ROOT / "public" / "audio" / "v070"
PROVENANCE_PATH = ROOT / "reference" / "audio" / "v070-generated" / "provenance.json"
SAMPLE_RATE = 44_100
SEED = 0xA5F070
FFMPEG_FALLBACKS = (
    Path(r"C:\Program Files (x86)\Digiarty\VideoProc Vlogger\ffmpeg.exe"),
)


ASSET_SPECS = {
    "music-v070-kumaya-daily": ("music", 8.0, True, ["warm-bass", "muted-plucks", "table-percussion", "room-air"]),
    "music-v070-crawler-life": ("music", 8.0, True, ["engine-pulse", "light-chords", "utensil-ticks", "radio-shimmer"]),
    "music-v070-stage2-tension": ("music", 8.0, True, ["low-pulse", "engine-rhythm", "metal-note", "wind-bed"]),
    "music-v070-stage3-approach": ("music", 8.0, True, ["sparse-bass", "slow-impact", "metal-scrape", "cold-wind"]),
    "music-v070-collapse-montage": ("music", 8.0, True, ["sub-rumble", "broken-percussion", "metal-harmonics", "city-noise"]),
    "music-v070-crawler-montage": ("music", 8.0, True, ["engine-bass", "frame-percussion", "minor-motif", "air-bed"]),
    "music-v070-crawler-briefing": ("music", 8.0, True, ["low-drum", "muted-pulse", "terminal-texture", "room-bed"]),
    "music-v070-station-gate": ("music", 8.0, True, ["tension-bass", "metal-pulse", "alarm-shadow", "noise-bed"]),
    "music-v070-station-platform": ("music", 8.0, True, ["machine-rhythm", "rail-clack", "transformer-bass", "high-tick"]),
    "music-v070-station-tunnel": ("music", 8.0, True, ["irregular-pulse", "electric-grit", "sub-drone", "metal-resonance"]),
    "music-v070-rescue": ("music", 4.2, False, ["warm-pad", "ascending-motif", "soft-impact", "air-tail"]),
    "music-v070-return": ("music", 8.0, True, ["engine-theme", "quiet-drum", "return-motif", "soft-noise"]),
    "music-v070-crawler-morning": ("music", 8.0, True, ["morning-chords", "crawler-theme", "table-percussion", "engine-bed"]),
    "ambience-v070-kumaya-daily-loop": ("ambience", 8.0, True, ["room-murmur", "dish-clinks", "television-hiss", "passing-cars"]),
    "ambience-v070-kumaya-crisis-loop": ("ambience", 8.0, True, ["stuck-horn", "crowd-alarm-texture", "glass-falls", "rainy-alley"]),
    "ambience-v070-rain-street-loop": ("ambience", 8.0, True, ["steady-rain", "sign-creak", "distant-infected", "drainage"]),
    "ambience-v070-stage2-engine-loop": ("ambience", 8.0, True, ["failing-engine", "sign-rattle", "crosswind", "distant-infected"]),
    "ambience-v070-medical-bay-loop": ("ambience", 8.0, True, ["crawler-engine", "medical-device", "ventilation", "tool-clinks"]),
    "ambience-v070-stage3-wind-loop": ("ambience", 8.0, True, ["cold-wind", "metal-sheet", "distant-heavy-breath", "debris"]),
    "ambience-v070-collapse-city-loop": ("ambience", 8.0, True, ["city-rumble", "distant-siren", "debris", "wind"]),
    "ambience-v070-crawler-ops-loop": ("ambience", 8.0, True, ["engine", "paper", "terminal", "distant-kitchen"]),
    "ambience-v070-crawler-canteen-loop": ("ambience", 8.0, True, ["engine", "dish-clinks", "room-murmur", "ventilation"]),
    "ambience-v070-radio-signal-loop": ("ambience", 6.0, True, ["radio-static", "data-pulse", "receiver-hum", "dropouts"]),
    "ambience-v070-station-gate-loop": ("ambience", 8.0, True, ["vent-fan", "water-drops", "distant-alarm", "metal-stress"]),
    "ambience-v070-station-platform-loop": ("ambience", 8.0, True, ["rail-groan", "transformer", "water", "tunnel-air"]),
    "ambience-v070-station-tunnel-loop": ("ambience", 8.0, True, ["discharge", "rail-vibration", "distant-horde", "electrical-room"]),
    "ambience-v070-station-seal-aftermath-loop": ("ambience", 6.0, True, ["breathing-air", "stopped-machine", "metal-cooling", "deep-room"]),
    "sfx-v070-takuya-entrance": ("sfx", 3.40, False, ["vehicle-metal-rip", "music-stop-gap", "heavy-footstep-1", "heavy-footstep-2", "heavy-footstep-3"]),
    "sfx-v070-station-warning": ("sfx", 1.25, False, ["alarm-fundamental", "alarm-harmonics", "relay-click", "noise-body"]),
    "sfx-v070-power-switch": ("sfx", 0.85, False, ["breaker-clunk", "electric-arc", "bus-hum", "cabinet-ring"]),
    "sfx-v070-cart-stall": ("sfx", 1.10, False, ["motor-decay", "wheel-clatter", "rail-ring", "friction"]),
    "sfx-v070-seal-engage": ("sfx", 1.70, False, ["hydraulic-drive", "door-rumble", "lock-clanks", "pressure-tail"]),
    "sfx-v070-machine-stop": ("sfx", 1.45, False, ["motor-spin-down", "contactor", "frame-rattle", "air-release"]),
    "sfx-v070-rescue-confirm": ("sfx", 0.95, False, ["warm-chord", "latch", "soft-noise", "short-tail"]),
    "sfx-v070-return-marker": ("sfx", 0.72, False, ["radio-chirp", "map-click", "static-tail", "low-confirm"]),
    "sfx-v070-terminal-confirm": ("sfx", 0.52, False, ["terminal-chord", "key-click", "data-noise", "room-tail"]),
}


def axis(duration: float) -> np.ndarray:
    length = max(1, round(duration * SAMPLE_RATE))
    return np.arange(length, dtype=np.float64) / SAMPLE_RATE


def periodic_sine(length: int, cycles: float, phase: float = 0.0) -> np.ndarray:
    return np.sin(math.tau * cycles * np.arange(length, dtype=np.float64) / length + phase)


def sweep(t: np.ndarray, start_hz: float, end_hz: float, phase: float = 0.0) -> np.ndarray:
    duration = max(1 / SAMPLE_RATE, len(t) / SAMPLE_RATE)
    slope = (end_hz - start_hz) / duration
    return np.sin(math.tau * (start_hz * t + 0.5 * slope * t * t) + phase)


def spectral_noise(rng: np.random.Generator, length: int, low: float, high: float, tilt: float = 0.0) -> np.ndarray:
    frequencies = np.fft.rfftfreq(length, 1 / SAMPLE_RATE)
    mask = (frequencies >= low) & (frequencies <= high)
    real = rng.normal(0.0, 1.0, len(frequencies))
    imag = rng.normal(0.0, 1.0, len(frequencies))
    weights = np.ones_like(frequencies)
    positive = frequencies > 0
    if tilt:
        weights[positive] = np.power(np.maximum(1.0, frequencies[positive] / max(1.0, low)), tilt)
    spectrum = (real + 1j * imag) * mask * weights
    spectrum[0] = 0
    signal = np.fft.irfft(spectrum, n=length)
    peak = float(np.max(np.abs(signal))) or 1.0
    return signal / peak


def envelope(length: int, attack: float = 0.01, release: float = 0.08) -> np.ndarray:
    result = np.ones(length, dtype=np.float64)
    attack_n = min(length, max(1, round(attack * SAMPLE_RATE)))
    release_n = min(length, max(1, round(release * SAMPLE_RATE)))
    result[:attack_n] *= np.linspace(0.0, 1.0, attack_n, endpoint=False)
    result[-release_n:] *= np.linspace(1.0, 0.0, release_n)
    return result


def decay(length: int, seconds: float) -> np.ndarray:
    return np.exp(-np.arange(length, dtype=np.float64) / max(1.0, seconds * SAMPLE_RATE))


def add_burst(target: np.ndarray, at: float, source: np.ndarray, gain: float = 1.0) -> None:
    start = max(0, round(at * SAMPLE_RATE))
    count = min(len(source), max(0, len(target) - start))
    if count:
        target[start : start + count] += source[:count] * gain


def tonal_burst(duration: float, frequencies: tuple[float, ...], decay_seconds: float, rng: np.random.Generator) -> np.ndarray:
    t = axis(duration)
    result = np.zeros(len(t), dtype=np.float64)
    for index, frequency in enumerate(frequencies):
        result += np.sin(math.tau * frequency * t + rng.uniform(0.0, math.tau)) * decay(len(t), decay_seconds / (1 + index * 0.16)) / (1 + index * 0.24)
    result += spectral_noise(rng, len(t), 180, 7_500, -0.18) * decay(len(t), decay_seconds * 0.42) * 0.28
    return result * envelope(len(t), 0.002, min(0.10, duration * 0.3))


def pulse_layer(length: int, duration: float, times: tuple[float, ...], frequency: float, rng: np.random.Generator, gain: float = 1.0) -> np.ndarray:
    result = np.zeros(length, dtype=np.float64)
    for index, at in enumerate(times):
        pulse = tonal_burst(0.22 + (index % 2) * 0.06, (frequency, frequency * 1.51, frequency * 2.03), 0.08, rng)
        add_burst(result, at % duration, pulse, gain)
    return result


def music_signal(cue_id: str, duration: float, rng: np.random.Generator) -> np.ndarray:
    t = axis(duration)
    length = len(t)
    low = periodic_sine(length, round(duration * 31), 0.2) * 0.24
    air = spectral_noise(rng, length, 120, 4_800, -0.35) * 0.10
    if cue_id == "music-v070-kumaya-daily":
        bass = periodic_sine(length, round(duration * 65.41), 0.25) * 0.14
        chords = sum(periodic_sine(length, round(duration * hz), index * 0.52) for index, hz in enumerate((130.81, 164.81, 196.0))) * 0.030
        plucks = pulse_layer(length, duration, (0.35, 1.35, 2.6, 3.6, 4.85, 5.85, 7.1), 392, rng, 0.065)
        table = pulse_layer(length, duration, (0.0, 2.0, 4.0, 6.0), 118, rng, 0.055)
        return bass + chords + plucks + table + air * 0.36
    if cue_id == "music-v070-crawler-life":
        engine = periodic_sine(length, round(duration * 45)) * 0.13 + periodic_sine(length, round(duration * 90)) * 0.045
        chords = sum(periodic_sine(length, round(duration * hz), index * 0.43) for index, hz in enumerate((98.0, 123.47, 146.83, 196.0))) * 0.026
        utensils = pulse_layer(length, duration, (0.55, 1.8, 3.15, 4.55, 5.8, 7.25), 760, rng, 0.045)
        shimmer = spectral_noise(rng, length, 1_100, 6_500, 0.08) * (0.45 + 0.55 * np.square(periodic_sine(length, 7))) * 0.028
        return engine + chords + utensils + shimmer + air * 0.28
    if cue_id == "music-v070-stage2-tension":
        pulse = periodic_sine(length, round(duration * 48)) * (0.55 + 0.45 * np.square(periodic_sine(length, 4))) * 0.18
        rhythm = pulse_layer(length, duration, (0.0, 1.5, 2.0, 3.5, 4.0, 5.5, 6.0, 7.5), 76, rng, 0.13)
        metal = periodic_sine(length, round(duration * 311), 0.9) * periodic_sine(length, 2) * 0.036
        return pulse + rhythm + metal + air * 0.68
    if cue_id == "music-v070-stage3-approach":
        bass = periodic_sine(length, round(duration * 37), 0.4) * 0.20
        impacts = pulse_layer(length, duration, (0.0, 2.0, 4.5, 6.5), 52, rng, 0.17)
        scrape = spectral_noise(rng, length, 620, 5_400, -0.08) * (0.35 + 0.65 * np.square(periodic_sine(length, 3))) * 0.055
        wind = spectral_noise(rng, length, 70, 2_000, -0.42) * 0.075
        return bass + impacts + scrape + wind
    if cue_id == "music-v070-collapse-montage":
        impacts = pulse_layer(length, duration, (0.1, 1.35, 2.9, 4.1, 6.55), 54, rng, 0.42)
        metal = periodic_sine(length, round(duration * 173), 1.2) * periodic_sine(length, 5) * 0.09
        return low * 1.25 + impacts + metal + air
    if cue_id == "music-v070-crawler-montage":
        engine = periodic_sine(length, round(duration * 46), 0.4) * 0.24 + periodic_sine(length, round(duration * 92), 0.8) * 0.10
        drums = pulse_layer(length, duration, tuple(np.arange(0.0, duration, 0.5)), 82, rng, 0.22)
        motif = sum(periodic_sine(length, round(duration * hz), index * 0.7) for index, hz in enumerate((110, 146.83, 164.81))) * 0.035
        return engine + drums + motif + air
    if cue_id == "music-v070-crawler-briefing":
        drums = pulse_layer(length, duration, (0.0, 1.0, 2.0, 3.5, 4.0, 5.0, 6.0, 7.5), 68, rng, 0.20)
        muted = periodic_sine(length, round(duration * 137)) * (0.5 + 0.5 * periodic_sine(length, 8)) * 0.045
        terminal = spectral_noise(rng, length, 1_200, 7_000, 0.1) * (0.5 + 0.5 * periodic_sine(length, 16)) * 0.035
        return low + drums + muted + terminal + air * 0.6
    if cue_id == "music-v070-station-gate":
        pulses = pulse_layer(length, duration, (0.0, 1.5, 2.0, 3.75, 4.0, 5.5, 6.0, 7.25), 72, rng, 0.26)
        alarm_shadow = periodic_sine(length, round(duration * 233)) * (0.5 + 0.5 * periodic_sine(length, 2)) * 0.035
        metal = periodic_sine(length, round(duration * 419), 1.7) * periodic_sine(length, 7) * 0.045
        return low * 1.15 + pulses + alarm_shadow + metal + air
    if cue_id == "music-v070-station-platform":
        rhythm = pulse_layer(length, duration, tuple(np.arange(0.0, duration, 0.4)), 96, rng, 0.20)
        rail = pulse_layer(length, duration, tuple(np.arange(0.2, duration, 0.8)), 310, rng, 0.12)
        transformer = periodic_sine(length, round(duration * 50)) * 0.22 + periodic_sine(length, round(duration * 100)) * 0.08
        ticks = spectral_noise(rng, length, 1_800, 8_000, 0.2) * (0.5 + 0.5 * periodic_sine(length, 20)) * 0.045
        return rhythm + rail + transformer + ticks + air * 0.65
    if cue_id == "music-v070-station-tunnel":
        irregular = pulse_layer(length, duration, (0.0, 0.7, 1.9, 2.25, 3.8, 5.15, 5.7, 7.1), 58, rng, 0.27)
        grit = spectral_noise(rng, length, 450, 7_500, 0.12) * (0.35 + 0.65 * np.square(periodic_sine(length, 11))) * 0.10
        resonance = periodic_sine(length, round(duration * 287), 0.6) * periodic_sine(length, 3) * 0.05
        return low * 1.35 + irregular + grit + resonance
    if cue_id == "music-v070-rescue":
        result = np.zeros(length, dtype=np.float64)
        notes = (146.83, 196.0, 246.94, 293.66)
        for index, note in enumerate(notes):
            start = index * 0.62
            note_t = axis(duration - start)
            chord = sum(np.sin(math.tau * note * ratio * note_t) / (harmonic + 1) for harmonic, ratio in enumerate((1.0, 1.5, 2.0)))
            add_burst(result, start, chord * envelope(len(note_t), 0.12, 0.65), 0.12)
        add_burst(result, 0.05, tonal_burst(0.45, (88, 176, 352), 0.18, rng), 0.20)
        return result + spectral_noise(rng, length, 180, 3_000, -0.5) * envelope(length, 0.2, 0.8) * 0.06
    if cue_id == "music-v070-return":
        engine = periodic_sine(length, round(duration * 43)) * 0.17 + periodic_sine(length, round(duration * 86)) * 0.07
        drums = pulse_layer(length, duration, (0.0, 2.0, 4.0, 6.0), 76, rng, 0.15)
        motif = sum(periodic_sine(length, round(duration * hz), index) for index, hz in enumerate((98, 123.47, 146.83, 196))) * 0.028
        return engine + drums + motif + air * 0.55
    chords = sum(periodic_sine(length, round(duration * hz), index * 0.45) for index, hz in enumerate((110, 138.59, 164.81, 220))) * 0.038
    theme = periodic_sine(length, round(duration * 293.66)) * (0.5 + 0.5 * periodic_sine(length, 4)) * 0.035
    table = pulse_layer(length, duration, (0.4, 1.9, 3.6, 5.2, 7.1), 640, rng, 0.07)
    return chords + theme + table + low * 0.7 + air * 0.45


def ambience_signal(cue_id: str, duration: float, rng: np.random.Generator) -> np.ndarray:
    t = axis(duration)
    length = len(t)
    room = spectral_noise(rng, length, 30, 2_400, -0.55) * 0.20
    if cue_id == "ambience-v070-kumaya-daily-loop":
        murmur = spectral_noise(rng, length, 170, 1_450, -0.22) * (0.72 + 0.28 * periodic_sine(length, 5)) * 0.12
        dishes = pulse_layer(length, duration, (0.3, 1.15, 2.7, 3.4, 5.1, 6.25, 7.4), 1_050, rng, 0.052)
        television = spectral_noise(rng, length, 950, 7_200, 0.08) * (0.42 + 0.58 * np.square(periodic_sine(length, 13))) * 0.033
        cars = pulse_layer(length, duration, (0.8, 4.9), 84, rng, 0.055)
        return murmur + dishes + television + cars + room * 0.28
    if cue_id == "ambience-v070-kumaya-crisis-loop":
        horn = periodic_sine(length, round(duration * 286)) * (0.65 + 0.35 * periodic_sine(length, 2)) * 0.12
        alarm_texture = spectral_noise(rng, length, 280, 2_800, -0.10) * (0.56 + 0.44 * np.square(periodic_sine(length, 5))) * 0.12
        glass = pulse_layer(length, duration, (0.25, 1.8, 3.05, 5.4, 7.0), 1_420, rng, 0.11)
        rain = spectral_noise(rng, length, 500, 8_000, 0.03) * 0.11
        return horn + alarm_texture + glass + rain + room * 0.32
    if cue_id == "ambience-v070-rain-street-loop":
        rain = spectral_noise(rng, length, 420, 8_500, 0.02) * 0.18
        drainage = spectral_noise(rng, length, 65, 900, -0.42) * 0.10
        sign = pulse_layer(length, duration, (0.6, 2.8, 5.2, 7.1), 330, rng, 0.07)
        infected = spectral_noise(rng, length, 90, 650, -0.26) * (0.62 + 0.38 * periodic_sine(length, 3)) * 0.065
        return rain + drainage + sign + infected
    if cue_id == "ambience-v070-stage2-engine-loop":
        engine = periodic_sine(length, round(duration * 41)) * 0.18 + periodic_sine(length, round(duration * 82)) * 0.055
        misfire = pulse_layer(length, duration, (0.9, 2.45, 4.2, 6.75), 74, rng, 0.10)
        sign = pulse_layer(length, duration, (1.5, 5.5), 380, rng, 0.06)
        wind = spectral_noise(rng, length, 80, 2_200, -0.32) * 0.10
        infected = spectral_noise(rng, length, 110, 720, -0.25) * (0.7 + 0.3 * periodic_sine(length, 2)) * 0.055
        return engine + misfire + sign + wind + infected
    if cue_id == "ambience-v070-medical-bay-loop":
        engine = periodic_sine(length, round(duration * 44)) * 0.12
        device = periodic_sine(length, round(duration * 880)) * (np.square(periodic_sine(length, 8)) > 0.91) * 0.032
        ventilation = spectral_noise(rng, length, 65, 1_100, -0.42) * 0.12
        tools = pulse_layer(length, duration, (0.45, 2.25, 4.8, 6.35), 940, rng, 0.045)
        return engine + device + ventilation + tools + room * 0.34
    if cue_id == "ambience-v070-stage3-wind-loop":
        wind = spectral_noise(rng, length, 45, 2_600, -0.34) * 0.18
        metal = pulse_layer(length, duration, (0.8, 3.5, 6.6), 295, rng, 0.085)
        breath = spectral_noise(rng, length, 75, 520, -0.30) * (0.45 + 0.55 * np.square(periodic_sine(length, 2))) * 0.10
        debris = pulse_layer(length, duration, (1.9, 5.1), 610, rng, 0.045)
        return wind + metal + breath + debris
    if cue_id == "ambience-v070-collapse-city-loop":
        siren = periodic_sine(length, round(duration * 310)) * (0.35 + 0.65 * periodic_sine(length, 1)) * 0.06
        debris = pulse_layer(length, duration, (0.4, 2.7, 5.3, 7.2), 145, rng, 0.12)
        return room * 1.3 + siren + debris + spectral_noise(rng, length, 180, 5_000, -0.25) * 0.08
    if cue_id == "ambience-v070-crawler-ops-loop":
        engine = periodic_sine(length, round(duration * 47)) * 0.18 + periodic_sine(length, round(duration * 94)) * 0.06
        paper = pulse_layer(length, duration, (0.8, 3.4, 6.1), 870, rng, 0.04)
        terminal = pulse_layer(length, duration, (1.25, 2.1, 4.7, 7.0), 1_420, rng, 0.045)
        kitchen = pulse_layer(length, duration, (2.8, 5.6), 620, rng, 0.04)
        return room * 0.55 + engine + paper + terminal + kitchen
    if cue_id == "ambience-v070-crawler-canteen-loop":
        engine = periodic_sine(length, round(duration * 45)) * 0.13
        dishes = pulse_layer(length, duration, (0.6, 1.1, 2.9, 4.4, 6.7, 7.3), 920, rng, 0.06)
        murmur = spectral_noise(rng, length, 180, 1_200, -0.2) * (0.7 + 0.3 * periodic_sine(length, 5)) * 0.11
        ventilation = spectral_noise(rng, length, 55, 700, -0.4) * 0.10
        return engine + dishes + murmur + ventilation
    if cue_id == "ambience-v070-radio-signal-loop":
        static = spectral_noise(rng, length, 420, 7_800, 0.05) * 0.18
        data = periodic_sine(length, round(duration * 740)) * (np.square(periodic_sine(length, 17)) > 0.62) * 0.045
        hum = periodic_sine(length, round(duration * 61)) * 0.09
        dropouts = 0.55 + 0.45 * np.square(periodic_sine(length, 3))
        return (static + data + hum) * dropouts
    if cue_id == "ambience-v070-station-gate-loop":
        fan = periodic_sine(length, round(duration * 58)) * 0.15 + spectral_noise(rng, length, 70, 700, -0.35) * 0.10
        drops = pulse_layer(length, duration, (0.35, 1.9, 3.1, 5.65, 7.4), 1_180, rng, 0.055)
        alarm = periodic_sine(length, round(duration * 255)) * (0.5 + 0.5 * periodic_sine(length, 1)) * 0.045
        metal = pulse_layer(length, duration, (2.5, 6.3), 360, rng, 0.07)
        return fan + drops + alarm + metal + room * 0.45
    if cue_id == "ambience-v070-station-platform-loop":
        rail = periodic_sine(length, round(duration * 73)) * periodic_sine(length, 2) * 0.11
        transformer = periodic_sine(length, round(duration * 50)) * 0.16 + periodic_sine(length, round(duration * 100)) * 0.05
        drops = pulse_layer(length, duration, (0.7, 2.2, 4.9, 7.1), 980, rng, 0.05)
        air = spectral_noise(rng, length, 40, 1_000, -0.48) * 0.14
        return rail + transformer + drops + air
    if cue_id == "ambience-v070-station-tunnel-loop":
        discharge = pulse_layer(length, duration, (0.25, 1.6, 2.05, 4.4, 5.9, 7.25), 720, rng, 0.09)
        rail = periodic_sine(length, round(duration * 42)) * 0.16
        horde = spectral_noise(rng, length, 70, 620, -0.3) * (0.7 + 0.3 * periodic_sine(length, 3)) * 0.13
        electrical = spectral_noise(rng, length, 300, 6_500, -0.05) * 0.08
        return discharge + rail + horde + electrical
    breath = spectral_noise(rng, length, 90, 1_200, -0.45) * (0.38 + 0.62 * np.square(periodic_sine(length, 3))) * 0.14
    stopped = periodic_sine(length, round(duration * 28)) * 0.045
    cooling = pulse_layer(length, duration, (1.0, 3.4, 5.2), 510, rng, 0.045)
    deep_room = spectral_noise(rng, length, 24, 320, -0.65) * 0.13
    return breath + stopped + cooling + deep_room


def sfx_signal(cue_id: str, duration: float, rng: np.random.Generator) -> np.ndarray:
    t = axis(duration)
    length = len(t)
    result = np.zeros(length, dtype=np.float64)
    if cue_id == "sfx-v070-takuya-entrance":
        rip_length = round(0.92 * SAMPLE_RATE)
        rip_t = axis(0.92)
        rip = spectral_noise(rng, rip_length, 120, 9_500, 0.16)
        rip *= envelope(rip_length, 0.008, 0.24)
        rip *= 0.34 + 0.66 * np.square(np.sin(math.tau * (8.0 + 14.0 * rip_t) * rip_t))
        add_burst(result, 0.0, rip, 0.46)
        add_burst(result, 0.08, sweep(rip_t, 1_650, 190) * envelope(rip_length, 0.01, 0.36), 0.20)
        for at, gain in ((1.12, 0.52), (1.91, 0.58), (2.72, 0.66)):
            foot = tonal_burst(0.52, (38, 61, 104, 210, 470), 0.17, rng)
            add_burst(result, at, foot * envelope(len(foot), 0.006, 0.34), gain)
        return result + spectral_noise(rng, length, 24, 280, -0.66) * envelope(length, 0.02, 0.24) * 0.07
    if cue_id == "sfx-v070-station-warning":
        result += sweep(t, 170, 235) * (0.55 + 0.45 * np.square(np.sin(math.tau * 4 * t))) * envelope(length, 0.02, 0.16) * 0.34
        result += np.sin(math.tau * 340 * t) * envelope(length, 0.01, 0.20) * 0.14
        add_burst(result, 0.02, tonal_burst(0.18, (620, 1_240, 2_480), 0.045, rng), 0.24)
        return result + spectral_noise(rng, length, 220, 5_800, -0.15) * envelope(length, 0.01, 0.18) * 0.10
    if cue_id == "sfx-v070-power-switch":
        add_burst(result, 0.0, tonal_burst(0.30, (105, 310, 780), 0.075, rng), 0.52)
        add_burst(result, 0.08, spectral_noise(rng, round(0.28 * SAMPLE_RATE), 500, 9_000, 0.18) * envelope(round(0.28 * SAMPLE_RATE), 0.002, 0.20), 0.22)
        result += sweep(t, 46, 58) * envelope(length, 0.08, 0.24) * 0.15
        add_burst(result, 0.31, tonal_burst(0.48, (420, 815, 1_610), 0.18, rng), 0.18)
        return result
    if cue_id == "sfx-v070-cart-stall":
        result += sweep(t, 115, 32) * envelope(length, 0.01, 0.20) * 0.26
        for at in (0.18, 0.29, 0.43, 0.67):
            add_burst(result, at, tonal_burst(0.30, (260, 610, 1_270), 0.10, rng), 0.22)
        return result + spectral_noise(rng, length, 90, 2_600, -0.35) * envelope(length, 0.01, 0.18) * 0.10
    if cue_id == "sfx-v070-seal-engage":
        result += sweep(t, 38, 54) * envelope(length, 0.03, 0.28) * 0.30
        result += spectral_noise(rng, length, 25, 1_100, -0.52) * envelope(length, 0.02, 0.30) * 0.22
        for at in (0.12, 0.62, 1.16):
            add_burst(result, at, tonal_burst(0.45, (72, 190, 430, 890), 0.16, rng), 0.32)
        return result
    if cue_id == "sfx-v070-machine-stop":
        result += sweep(t, 132, 24) * envelope(length, 0.01, 0.28) * 0.32
        result += sweep(t, 264, 48, 0.8) * envelope(length, 0.01, 0.24) * 0.11
        add_burst(result, 0.82, tonal_burst(0.42, (84, 290, 640), 0.13, rng), 0.36)
        add_burst(result, 1.0, spectral_noise(rng, round(0.42 * SAMPLE_RATE), 120, 3_800, -0.3) * envelope(round(0.42 * SAMPLE_RATE), 0.01, 0.28), 0.14)
        return result
    if cue_id == "sfx-v070-rescue-confirm":
        for index, note in enumerate((196.0, 246.94, 293.66)):
            note_t = axis(duration - index * 0.08)
            chord = (np.sin(math.tau * note * note_t) + 0.45 * np.sin(math.tau * note * 1.5 * note_t)) * decay(len(note_t), 0.34)
            add_burst(result, index * 0.08, chord * envelope(len(note_t), 0.01, 0.16), 0.13)
        add_burst(result, 0.03, tonal_burst(0.22, (520, 1_040, 2_080), 0.06, rng), 0.16)
        return result + spectral_noise(rng, length, 200, 3_500, -0.4) * envelope(length, 0.02, 0.20) * 0.05
    if cue_id == "sfx-v070-return-marker":
        result += sweep(t, 480, 720) * envelope(length, 0.01, 0.18) * 0.16
        result += np.sin(math.tau * 180 * t) * decay(length, 0.22) * envelope(length, 0.005, 0.12) * 0.14
        add_burst(result, 0.04, tonal_burst(0.18, (820, 1_640, 3_280), 0.045, rng), 0.16)
        return result + spectral_noise(rng, length, 450, 7_000, 0.04) * envelope(length, 0.005, 0.18) * 0.10
    result += (np.sin(math.tau * 620 * t) + 0.55 * np.sin(math.tau * 930 * t) + 0.28 * np.sin(math.tau * 1_860 * t)) * decay(length, 0.20) * envelope(length, 0.004, 0.10) * 0.12
    add_burst(result, 0.01, tonal_burst(0.14, (1_100, 2_200, 4_400), 0.03, rng), 0.13)
    return result + spectral_noise(rng, length, 900, 7_800, 0.1) * decay(length, 0.13) * envelope(length, 0.002, 0.10) * 0.07


def normalize(signal: np.ndarray, peak: float = 0.88) -> np.ndarray:
    signal = np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0)
    signal -= float(np.mean(signal))
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
    args = [
        str(ffmpeg), "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(source), "-map_metadata", "-1", "-fflags", "+bitexact",
        "-flags:a", "+bitexact", "-vn", "-ar", str(SAMPLE_RATE), "-ac", "1",
    ]
    if codec == "mp3":
        args += ["-codec:a", "libmp3lame", "-b:a", "112k", "-write_xing", "0"]
    else:
        args += ["-codec:a", "libvorbis", "-q:a", "4"]
    args.append(str(target))
    subprocess.run(args, check=True)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build_signal(cue_id: str, category: str, duration: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    if category == "music":
        return music_signal(cue_id, duration, rng)
    if category == "ambience":
        return ambience_signal(cue_id, duration, rng)
    return sfx_signal(cue_id, duration, rng)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ffmpeg", help="Path to ffmpeg.exe when it is not on PATH")
    args = parser.parse_args()
    ffmpeg = find_ffmpeg(args.ffmpeg)
    records = []
    for index, (cue_id, (folder, duration, loop, layers)) in enumerate(ASSET_SPECS.items()):
        signal = build_signal(cue_id, folder, duration, SEED + index * 7_919)
        master = MASTER_DIR / f"{cue_id}.wav"
        mp3 = OUTPUT_ROOT / folder / f"{cue_id}.mp3"
        ogg = OUTPUT_ROOT / folder / f"{cue_id}.ogg"
        write_wav(master, signal)
        encode(ffmpeg, master, mp3, "mp3")
        encode(ffmpeg, master, ogg, "ogg")
        records.append({
            "id": cue_id,
            "category": folder,
            "durationSeconds": duration,
            "loop": loop,
            "layers": layers,
            "simpleTone": False,
            "origin": "project-original deterministic layered synthesis; no sampled recording or generated voice",
            "source": {"path": master.relative_to(ROOT).as_posix(), "sha256": sha256(master)},
            "finals": [
                {"path": mp3.relative_to(ROOT).as_posix(), "sha256": sha256(mp3), "type": "audio/mpeg"},
                {"path": ogg.relative_to(ROOT).as_posix(), "sha256": sha256(ogg), "type": "audio/ogg"},
            ],
        })
    payload = {
        "version": 1,
        "generator": "scripts/build-v070-story-audio.py",
        "sampleRate": SAMPLE_RATE,
        "seed": SEED,
        "policy": (
            "Every 0.7.0 cue is a layered project-original master. "
            "No story-dialogue voiceover is generated; existing v060 battle voices are retained separately."
        ),
        "cues": records,
    }
    PROVENANCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROVENANCE_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"built {len(records)} layered 0.7.0 cues with {ffmpeg}")


if __name__ == "__main__":
    main()
