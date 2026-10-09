#!/usr/bin/env python3
"""Preserve and inspect generated VFX sources plus legacy manual pose cells.

No pixels are edited in the preserved sources. The output contact sheet is an
inspection artifact only; no file under public/art is written by this script.
"""
from __future__ import annotations
import argparse, hashlib, json, shutil
from pathlib import Path
from statistics import mean
from PIL import Image, ImageDraw

ATLAS = {
    "tky": Path("public/art/v090/characters/tky-battle-r1.png"),
    "mrs-chiha": Path("public/art/v090/characters/mrs-chiha-battle-r1.png"),
    "miyamoto-musashi": Path("public/art/v090/characters/miyamoto-musashi-battle-r1.png"),
}
SOURCES = {
    "magenta-lightblade": Path(r"C:/Users/okait/.codex/generated_images/01a079d3-063c-7401-963b-c507867eead5/exec-22e0426c-31a4-4dfb-a9ef-47e1bb2d56ea.png"),
    "fire-whisky-bottle": Path(r"C:/Users/okait/.codex/generated_images/01a079d3-063c-7401-963b-c507867eead5/exec-61f7e2bd-0b36-4913-9d8b-19fad271e563.png"),
    "right-facing-grenade": Path(r"C:/Users/okait/.codex/generated_images/01a079d3-063c-7401-963b-c507867eead5/exec-e0e6b008-6006-40b1-a011-e61ccd5e5b00.png"),
    "steel-white-cross": Path(r"C:/Users/okait/.codex/generated_images/01a079d3-063c-7401-963b-c507867eead5/exec-77ac24d7-606b-4454-b061-e2612a3481b7.png"),
}

def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()

def channel_stats(img: Image.Image) -> dict:
    rgba = img.convert("RGBA")
    px = list(rgba.getdata())
    alpha = [p[3] for p in px]
    opaque = [p[:3] for p in px if p[3] > 0]
    return {
        "pixels": len(px),
        "alphaMin": min(alpha), "alphaMax": max(alpha),
        "alphaMean": round(mean(alpha), 6),
        "alphaZero": sum(a == 0 for a in alpha),
        "alphaNonzero": sum(a > 0 for a in alpha),
        "alphaOpaque": sum(a == 255 for a in alpha),
        "visibleRgbMin": [min(c[i] for c in opaque) for i in range(3)] if opaque else None,
        "visibleRgbMax": [max(c[i] for c in opaque) for i in range(3)] if opaque else None,
        "visibleRgbMean": [round(mean(c[i] for c in opaque), 6) for i in range(3)] if opaque else None,
    }

def border_pixels(img: Image.Image, margin: int = 25):
    rgba = img.convert("RGBA")
    w, h = rgba.size
    return [rgba.getpixel((x, y)) for y in range(h) for x in range(w)
            if x < margin or x >= w - margin or y < margin or y >= h - margin]

def pixel_stats(px) -> dict:
    alpha = [p[3] for p in px]
    visible = [p[:3] for p in px if p[3] > 0]
    return {
        "pixels": len(px), "alphaMin": min(alpha), "alphaMax": max(alpha),
        "alphaMean": round(mean(alpha), 6), "alphaZero": sum(a == 0 for a in alpha),
        "alphaNonzero": sum(a > 0 for a in alpha), "alphaOpaque": sum(a == 255 for a in alpha),
        "visibleRgbMin": [min(c[i] for c in visible) for i in range(3)] if visible else None,
        "visibleRgbMax": [max(c[i] for c in visible) for i in range(3)] if visible else None,
        "visibleRgbMean": [round(mean(c[i] for c in visible), 6) for i in range(3)] if visible else None,
    }

def source_record(name: str, path: Path, dest: Path) -> dict:
    shutil.copy2(path, dest)
    img = Image.open(path)
    record = {"name": name, "sourcePath": str(path), "preservedPath": str(dest),
              "sha256": sha(path), "bytes": path.stat().st_size,
              "mode": img.mode, "size": list(img.size), "full": channel_stats(img),
              "border25": pixel_stats(border_pixels(img))}
    # A grid is only asserted for the known 3x2 source; other sources are audited whole.
    if img.size == (1536, 1024):
        cells = []
        for row in range(2):
            for col in range(3):
                cell = img.crop((col * 512, row * 512, (col + 1) * 512, (row + 1) * 512))
                cells.append({"row": row, "col": col, "box": [col * 512, row * 512, 512, 512],
                              "full": channel_stats(cell), "border25": pixel_stats(border_pixels(cell))})
        record["grid"] = {"columns": 3, "rows": 2, "cell": [512, 512], "cells": cells}
    return record

def atlas_record(repo: Path, name: str, path: Path, sheet: Image.Image) -> dict:
    # Existing 7-state contracts are seven logical poses mapped to six source cells;
    # death is derived from hit, so attack-a/b remain source columns 3 and 4.
    cells = {}
    for state, index in (("attack-a", 3), ("attack-b", 4)):
        for direction, row in (("right", 0), ("left", 1)):
            box = [index * 480, row * 448, 480, 448]
            cells[f"{state}-{direction}"] = {"x": box[0], "y": box[1], "w": box[2], "h": box[3]}
    return {"name": name, "sourcePath": str(path), "sha256": sha(path), "bytes": path.stat().st_size,
            "mode": sheet.mode, "size": list(sheet.size), "logicalStates": 7,
            "sourceCells": 6, "cellLayout": "7 logical states; death derives from hit; 6 source columns x 2 rows",
            "cells": cells}

def make_sheet(repo: Path, out: Path, atlas_images: dict[str, Image.Image]):
    thumb_w, thumb_h = 240, 224
    label_h = 36
    pad = 18
    sheet = Image.new("RGBA", (3 * (thumb_w + pad) + pad, 4 * (thumb_h + label_h + pad) + pad), (18, 22, 28, 255))
    draw = ImageDraw.Draw(sheet)
    for name, img in atlas_images.items():
        col = {"tky": 0, "mrs-chiha": 1, "miyamoto-musashi": 2}[name]
        for state_row, (state, index) in enumerate((("attack-a", 3), ("attack-b", 4))):
            for direction_row, (direction, y) in enumerate((("right", 0), ("left", 448))):
                r = state_row * 2 + direction_row
                crop = img.crop((index * 480, y, (index + 1) * 480, y + 448)).convert("RGBA")
                crop.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
                x = pad + col * (thumb_w + pad)
                top = pad + r * (thumb_h + label_h + pad)
                sheet.alpha_composite(crop, (x + (thumb_w - crop.width)//2, top))
                draw.text((x, top + thumb_h + 4), f"{name} {state} {direction} x={index*480} y={y}", fill=(240, 240, 240, 255))
    sheet.save(out)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", type=Path, default=Path.cwd())
    ap.add_argument("--output-dir", type=Path, required=True)
    args = ap.parse_args()
    repo = args.repo.resolve(); out = args.output_dir.resolve(); source_out = out / "sources"
    source_out.mkdir(parents=True, exist_ok=True)
    records = {"sources": [], "atlases": [], "inspection": {}}
    for name, path in SOURCES.items():
        records["sources"].append(source_record(name, path, source_out / f"{name}.png"))
    atlas_images = {}
    for name, rel in ATLAS.items():
        path = repo / rel
        atlas_images[name] = Image.open(path).convert("RGBA")
        records["atlases"].append(atlas_record(repo, name, path, atlas_images[name]))
    sheet_path = out / "manual-attack-ab-inspection-sheet.png"
    make_sheet(repo, sheet_path, atlas_images)
    records["inspection"] = {"sheetPath": str(sheet_path), "states": ["attack-a", "attack-b"],
                              "directions": ["right", "left"], "cellWidth": 480, "cellHeight": 448,
                              "note": "7 logical states use 6 source columns; death is derived from hit."
                              }
    (out / "measurements.json").write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"outputDir": str(out), "measurements": str(out / "measurements.json"),
                      "sheet": str(sheet_path), "sources": [{"name": r["name"], "sha256": r["sha256"], "bytes": r["bytes"], "size": r["size"], "mode": r["mode"]} for r in records["sources"]]}, ensure_ascii=False))

if __name__ == "__main__":
    main()
