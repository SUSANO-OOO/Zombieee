#!/usr/bin/env python3
"""Build the 0.6.0 character and stage-overlay assets without mutating sources.

The versioned chroma-key files under ``reference/`` are immutable build inputs.
For the release build, first remove chroma with the ImageGen skill helper and
pass its output directory with ``--alpha-root``.  When that directory is not
provided, this script applies the same threshold values locally so the build is
still reproducible outside Codex.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from statistics import median

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
CHARACTER_INPUT = ROOT / "reference" / "characters" / "generated-working-v1"
STAGE_INPUT = ROOT / "reference" / "stage-objects" / "generated-working-v1"
STAGE_INPUT_V2 = ROOT / "reference" / "stage-objects" / "generated-working-v2"
PORTRAIT_INPUT = ROOT / "reference" / "characters" / "generated-working-v2" / "portraits"
CHARACTER_OUTPUT = ROOT / "public" / "art" / "v060" / "characters"
LEGACY_CHARACTER_OUTPUT = CHARACTER_OUTPUT / "legacy"
PORTRAIT_OUTPUT = CHARACTER_OUTPUT / "portraits"
STAGE_OUTPUT = ROOT / "public" / "art" / "v060" / "stage-objects"

SPRITE_CELL = (480, 448)
SPRITE_STATES = ("idle", "walk-a", "walk-b", "attack-a", "attack-b", "hit", "death")
LEGACY_PADDED_CELL = (394, 757)
LEGACY_INNER_CELL = (362, 725)
LEGACY_SPRITE_GUTTER = 16

STANDARD_LEGACY_CELL_EDGES = (0, 362, 724, 1086, 1448, 1810, 2172)
GUNNER_LEGACY_CELL_EDGES = (0, 361, 723, 1085, 1446, 1808, 2170)
LEGACY_SPRITE_SOURCES = {
    "brawler": {"filename": "brawler-sprites-v1.png", "edges": STANDARD_LEGACY_CELL_EDGES},
    "scout": {"filename": "scout-sprites-v2.png", "edges": STANDARD_LEGACY_CELL_EDGES},
    "ranger": {"filename": "ranger-sprites-v1.png", "edges": STANDARD_LEGACY_CELL_EDGES},
    "brute": {"filename": "breaker-sprites-v2.png", "edges": STANDARD_LEGACY_CELL_EDGES},
    "gunner": {"filename": "gunner-sprites-v1.png", "edges": GUNNER_LEGACY_CELL_EDGES},
    "medic": {"filename": "medic-sprites-v1.png", "edges": STANDARD_LEGACY_CELL_EDGES},
    "infected": {"filename": "infected-sprites-v1.png", "edges": STANDARD_LEGACY_CELL_EDGES},
    "spitter": {"filename": "spitter-sprites-v1.png", "edges": STANDARD_LEGACY_CELL_EDGES},
    "shade": {"filename": "shade-raider-sprites-v1.png", "edges": STANDARD_LEGACY_CELL_EDGES},
    "crusher": {"filename": "crusher-sprites-v1.png", "edges": STANDARD_LEGACY_CELL_EDGES},
    "takuya": {"filename": "takuya-boss-sprites-v2.png", "edges": STANDARD_LEGACY_CELL_EDGES},
}

CHARACTER_SOURCES = {
    "crazy-king": {
        "right": "crazy-king-atlas-right-chroma-v1.png",
        "alpha_right": "crazy-king-right.png",
    },
    "kumaverson": {
        "right": "kumaverson-atlas-right-chroma-v1.png",
        "alpha_right": "kumaverson-right.png",
    },
    "babayaga": {
        "right": "babayaga-atlas-right-chroma-v1.png",
        "left": "babayaga-atlas-left-chroma-v1.png",
        "alpha_right": "babayaga-right.png",
        "alpha_left": "babayaga-left.png",
    },
}

DEDICATED_PORTRAIT_SOURCES = {
    kind: f"{kind}-portrait-chroma-v2.png"
    for kind in (
        "brawler",
        "scout",
        "ranger",
        "medic",
        "brute",
        "gunner",
        "crazy-king",
        "kumaverson",
        "babayaga",
        "guide",
    )
}

STATIC_DRESSING_SOURCES = {
    "nishijin": "nishijin-static-dressing-chroma-v2.png",
    "sawara": "sawara-static-dressing-chroma-v2.png",
    "defense": "defense-static-dressing-chroma-v2.png",
}

STAGE_SOURCES = {
    "nishijin-shopping-street": {
        "source": "nishijin-shopping-street-objects-chroma-v1.png",
        "alpha": "nishijin-shopping-street.png",
        "grid": False,
        "boxes": (
            (0, 0, 418, 471),
            (418, 0, 836, 471),
            (836, 0, 1235, 471),
            (1250, 0, 1672, 471),
            (0, 471, 418, 941),
            (418, 471, 836, 941),
            (836, 471, 1254, 941),
        ),
        "objects": (
            "nishijin-wire-trap-intact-v1.png",
            "nishijin-wire-trap-sprung-v1.png",
            "nishijin-sign-intact-v1.png",
            "nishijin-sign-fallen-v1.png",
            "nishijin-fire-shutter-closed-v1.png",
            "nishijin-fire-shutter-open-v1.png",
            "nishijin-infection-node-active-v1.png",
        ),
    },
    "sawara-ward-office": {
        "source": "sawara-ward-office-objects-chroma-v1.png",
        "alpha": "sawara-ward-office.png",
        "grid": False,
        "boxes": (
            (0, 0, 418, 471),
            (430, 0, 900, 471),
            (900, 0, 1270, 471),
            (1300, 0, 1672, 471),
            (0, 471, 418, 941),
            (480, 471, 830, 941),
            (850, 471, 1254, 941),
        ),
        "objects": (
            "sawara-rescue-van-blocked-v1.png",
            "sawara-rescue-van-ready-v1.png",
            "sawara-rubble-blocking-v1.png",
            "sawara-rubble-cleared-v1.png",
            "sawara-shooting-window-lit-v1.png",
            "sawara-lunch-crate-sealed-v1.png",
            "sawara-lunch-crate-open-v1.png",
        ),
    },
    "nishijin-defense-line": {
        "source": "nishijin-defense-line-objects-chroma-v1.png",
        "alpha": "nishijin-defense-line.png",
        "grid": False,
        # The generator preserved seven isolated objects but distributed the
        # three lower-row nest states across the available width.  These boxes
        # are explicit source-audit data, not heuristic runtime slicing.
        "boxes": (
            (0, 0, 380, 500),
            (400, 0, 750, 500),
            (760, 250, 1210, 520),
            (1180, 180, 1672, 520),
            (0, 520, 480, 941),
            (480, 520, 1000, 941),
            (950, 520, 1500, 941),
        ),
        "objects": (
            "defense-transmitter-active-v1.png",
            "defense-transmitter-damaged-v1.png",
            "defense-spawn-marker-v1.png",
            "defense-infection-nest-dormant-v1.png",
            "defense-infection-nest-exposed-v1.png",
            "defense-infection-nest-damaged-v1.png",
            "defense-infection-nest-destroyed-v1.png",
        ),
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def local_chroma_remove(path: Path) -> Image.Image:
    """Apply the approved ImageGen helper's border/soft-matte/despill algorithm."""
    rgba = Image.open(path).convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size

    band = max(1, min(width, height, 6))
    step = max(1, min(width, height) // 256)
    samples: list[tuple[int, int, int]] = []
    for x in range(0, width, step):
        for y in range(band):
            samples.append(pixels[x, y][:3])
            samples.append(pixels[x, height - 1 - y][:3])
    for y in range(0, height, step):
        for x in range(band):
            samples.append(pixels[x, y][:3])
            samples.append(pixels[width - 1 - x, y][:3])
    key = tuple(int(round(median(sample[channel] for sample in samples))) for channel in range(3))
    key_max = max(key)
    spill_channels = [index for index, value in enumerate(key) if value >= key_max - 16 and value >= 128]
    non_spill = [index for index in range(3) if index not in spill_channels]

    def clamped(value: float) -> int:
        return max(0, min(255, int(round(value))))

    def dominance(rgb: tuple[int, int, int]) -> float:
        if not spill_channels:
            return 0.0
        key_strength = min(float(rgb[index]) for index in spill_channels) if len(spill_channels) > 1 else float(rgb[spill_channels[0]])
        non_key_strength = max((float(rgb[index]) for index in non_spill), default=0.0)
        return key_strength - non_key_strength

    for y in range(height):
        for x in range(width):
            red, green, blue, input_alpha = pixels[x, y]
            rgb = (red, green, blue)
            distance = max(abs(rgb[channel] - key[channel]) for channel in range(3))
            channel_dominance = dominance(rgb)
            key_like = distance <= 32 or not spill_channels or channel_dominance >= 16.0
            if key_like:
                if distance <= 12:
                    soft_alpha = 0
                elif distance >= 220:
                    soft_alpha = 255
                else:
                    ratio = (distance - 12.0) / (220.0 - 12.0)
                    smooth = ratio * ratio * (3.0 - 2.0 * ratio)
                    soft_alpha = clamped(255.0 * smooth)
                if channel_dominance <= 0:
                    dominance_alpha = 255
                else:
                    non_key_strength = max((float(rgb[index]) for index in non_spill), default=0.0)
                    denominator = max(1.0, float(key_max) - non_key_strength)
                    dominance_alpha = clamped((1.0 - min(1.0, channel_dominance / denominator)) * 255.0)
                output_alpha = min(soft_alpha, dominance_alpha)
            else:
                output_alpha = 0 if distance <= 12 else 255
            output_alpha = int(round(output_alpha * (input_alpha / 255.0)))
            if 0 < output_alpha <= 8:
                output_alpha = 0
            if output_alpha == 0:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            if key_like and output_alpha < 252 and spill_channels:
                channels = [float(red), float(green), float(blue)]
                anchor = max((channels[index] for index in non_spill), default=0.0)
                cap = max(0.0, anchor - 1.0)
                for index in spill_channels:
                    if channels[index] > cap:
                        channels[index] = cap
                red, green, blue = (clamped(value) for value in channels)
            pixels[x, y] = (red, green, blue, output_alpha)
    return rgba


def load_alpha(source: Path, alpha_root: Path | None, alpha_name: str) -> Image.Image:
    prepared = alpha_root / alpha_name if alpha_root else None
    if prepared and prepared.is_file():
        return Image.open(prepared).convert("RGBA")
    return local_chroma_remove(source)


def grid_cells(image: Image.Image) -> list[Image.Image]:
    width, height = image.size
    cells: list[Image.Image] = []
    for index in range(8):
        column = index % 4
        row = index // 4
        left = column * width // 4
        right = (column + 1) * width // 4
        top = row * height // 2
        bottom = (row + 1) * height // 2
        cells.append(image.crop((left, top, right, bottom)))
    return cells


def trim(image: Image.Image, gutter: int = 0) -> Image.Image:
    rgba = image.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("Expected visible pixels in an asset source cell")
    cropped = rgba.crop(bbox)
    if gutter <= 0:
        return cropped
    result = Image.new("RGBA", (cropped.width + gutter * 2, cropped.height + gutter * 2))
    result.alpha_composite(cropped, (gutter, gutter))
    return result


def fit(image: Image.Image, maximum: tuple[int, int]) -> Image.Image:
    if image.width <= maximum[0] and image.height <= maximum[1]:
        return image
    scale = min(maximum[0] / image.width, maximum[1] / image.height)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    return image.resize(size, Image.Resampling.LANCZOS)


def pack_character(kind: str, right: Image.Image, left: Image.Image | None) -> tuple[Path, Image.Image]:
    right_frames = [trim(cell) for cell in grid_cells(right)[:7]]
    if left is None:
        left_frames = [ImageOps.mirror(frame) for frame in right_frames]
    else:
        left_frames = [trim(cell) for cell in grid_cells(left)[:7]]

    cell_width, cell_height = SPRITE_CELL
    atlas = Image.new("RGBA", (cell_width * len(SPRITE_STATES), cell_height * 2))
    for row, frames in enumerate((right_frames, left_frames)):
        for column, frame in enumerate(frames):
            frame = fit(frame, (cell_width - 32, cell_height - 32))
            x = column * cell_width + (cell_width - frame.width) // 2
            y = row * cell_height + cell_height - 16 - frame.height
            atlas.alpha_composite(frame, (x, y))

    destination = CHARACTER_OUTPUT / f"{kind}-battle-v1.png"
    atlas.save(destination, "PNG", optimize=True)
    return destination, right_frames[0]


def build_legacy_sprite_atlases() -> list[Path]:
    """Isolate each immutable legacy source cell behind transparent padding."""
    outputs: list[Path] = []
    cell_width, cell_height = LEGACY_PADDED_CELL
    inner_width, inner_height = LEGACY_INNER_CELL
    for key, spec in LEGACY_SPRITE_SOURCES.items():
        source_path = ROOT / "public" / spec["filename"]
        source = Image.open(source_path).convert("RGBA")
        if source.width > inner_width * 6 or source.height > inner_height:
            raise ValueError(f"Legacy source exceeds audited packing bounds: {source_path}")
        edges = tuple(spec["edges"])
        if len(edges) != 7 or edges[0] != 0 or edges[-1] != source.width or any(right <= left for left, right in zip(edges, edges[1:])):
            raise ValueError(f"Legacy source has invalid audited cell edges: {source_path} {edges}")
        atlas = Image.new("RGBA", (cell_width * 6, cell_height))
        for index in range(6):
            left = edges[index]
            right = edges[index + 1]
            authored = source.crop((left, 0, right, source.height))
            x = index * cell_width + LEGACY_SPRITE_GUTTER + (inner_width - authored.width) // 2
            y = LEGACY_SPRITE_GUTTER + (inner_height - authored.height) // 2
            atlas.alpha_composite(authored, (x, y))
        destination = LEGACY_CHARACTER_OUTPUT / f"{key}-battle-gutter-v1.png"
        atlas.save(destination, "PNG", optimize=True)
        outputs.append(destination)
    return outputs


def make_portrait(subject: Image.Image, destination: Path) -> None:
    subject = trim(subject)
    upper = fit(subject, (480, 608))
    canvas = Image.new("RGBA", (512, 640))
    canvas.alpha_composite(upper, ((512 - upper.width) // 2, 640 - 16 - upper.height))
    canvas.save(destination, "WEBP", lossless=True, method=6)


def build_portraits(alpha_root: Path | None) -> list[Path]:
    outputs: list[Path] = []
    for kind, filename in DEDICATED_PORTRAIT_SOURCES.items():
        source = local_chroma_remove(PORTRAIT_INPUT / filename)
        destination = PORTRAIT_OUTPUT / f"{kind}-portrait-v2.webp"
        make_portrait(source, destination)
        outputs.append(destination)

    radio_source = CHARACTER_INPUT / "radio-terminal-chroma-v1.png"
    radio = load_alpha(radio_source, alpha_root, "radio-terminal.png")
    radio_destination = PORTRAIT_OUTPUT / "radio-terminal-portrait-v1.webp"
    make_portrait(radio, radio_destination)
    outputs.append(radio_destination)
    return outputs


def build_stage_objects(alpha_root: Path | None) -> list[Path]:
    outputs: list[Path] = []
    for spec in STAGE_SOURCES.values():
        source = STAGE_INPUT / str(spec["source"])
        rgba = load_alpha(source, alpha_root, str(spec["alpha"]))
        if spec["grid"]:
            cells = grid_cells(rgba)[:7]
        else:
            cells = [rgba.crop(box) for box in spec["boxes"]]
        for filename, cell in zip(spec["objects"], cells, strict=True):
            destination = STAGE_OUTPUT / filename
            trim(cell, gutter=16).save(destination, "PNG", optimize=True)
            outputs.append(destination)
    destroyed_source = local_chroma_remove(STAGE_INPUT_V2 / "nishijin-infection-node-destroyed-chroma-v2.png")
    destroyed_destination = STAGE_OUTPUT / "nishijin-infection-node-destroyed-v1.png"
    trim(destroyed_source, gutter=16).save(destroyed_destination, "PNG", optimize=True)
    outputs.append(destroyed_destination)
    for stage_key, filename in STATIC_DRESSING_SOURCES.items():
        dressing = local_chroma_remove(STAGE_INPUT_V2 / filename)
        dressing_destination = STAGE_OUTPUT / f"{stage_key}-static-dressing-v1.png"
        trim(dressing, gutter=16).save(dressing_destination, "PNG", optimize=True)
        outputs.append(dressing_destination)
    return outputs


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--alpha-root",
        type=Path,
        help="Directory of RGBA images made by remove_chroma_key.py; local fallback is used when omitted.",
    )
    parser.add_argument(
        "--legacy-only",
        action="store_true",
        help="Only rebuild the non-destructive transparent-gutter derivatives of legacy battle sheets.",
    )
    args = parser.parse_args()
    alpha_root = args.alpha_root.resolve() if args.alpha_root else None

    CHARACTER_OUTPUT.mkdir(parents=True, exist_ok=True)
    LEGACY_CHARACTER_OUTPUT.mkdir(parents=True, exist_ok=True)
    PORTRAIT_OUTPUT.mkdir(parents=True, exist_ok=True)
    STAGE_OUTPUT.mkdir(parents=True, exist_ok=True)

    outputs: list[Path] = build_legacy_sprite_atlases()
    if not args.legacy_only:
        for kind, spec in CHARACTER_SOURCES.items():
            right = load_alpha(CHARACTER_INPUT / spec["right"], alpha_root, spec["alpha_right"])
            left = None
            if "left" in spec:
                left = load_alpha(CHARACTER_INPUT / spec["left"], alpha_root, spec["alpha_left"])
            destination, _ = pack_character(kind, right, left)
            outputs.append(destination)

        outputs.extend(build_portraits(alpha_root))
        outputs.extend(build_stage_objects(alpha_root))

    report = {
        "source_policy": "read-only; no source or protected legacy sprite is modified",
        "sprite_cells": {
            "newcomer": {"width": SPRITE_CELL[0], "height": SPRITE_CELL[1]},
            "legacy_derived": {
                "width": LEGACY_PADDED_CELL[0],
                "height": LEGACY_PADDED_CELL[1],
                "gutter": LEGACY_SPRITE_GUTTER,
            },
        },
        "outputs": {
            str(path.relative_to(ROOT)).replace("\\", "/"): sha256(path)
            for path in sorted(outputs)
        },
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
