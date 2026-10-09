#!/usr/bin/env python3
"""Create bounded V100 manual-VFX candidates from preserved RGBA sources.

Atlas processing changes alpha only in each cell's outer 25px via smoothstep;
RGB bytes are retained. Small props discard only alpha <= 1 during bbox trim,
then are padded and uniformly resized. The original source PNGs are copied
byte-for-byte into the report.
"""
from __future__ import annotations
import argparse, hashlib, json, math, shutil
from pathlib import Path
from PIL import Image, ImageDraw

SOURCES = {
    "lightblade-six-frames-r1": Path(r"C:/Users/okait/.codex/generated_images/01a079d3-063c-7401-963b-c507867eead5/exec-22e0426c-31a4-4dfb-a9ef-47e1bb2d56ea.png"),
    "countercut-six-frames-r1": Path(r"C:/Users/okait/.codex/generated_images/01a079d3-063c-7401-963b-c507867eead5/exec-77ac24d7-606b-4454-b061-e2612a3481b7.png"),
    "fire-whisky-projectile-r1": Path(r"C:/Users/okait/.codex/generated_images/01a079d3-063c-7401-963b-c507867eead5/exec-61f7e2bd-0b36-4913-9d8b-19fad271e563.png"),
    "grenade-projectile-r1": Path(r"C:/Users/okait/.codex/generated_images/01a079d3-063c-7401-963b-c507867eead5/exec-e0e6b008-6006-40b1-a011-e61ccd5e5b00.png"),
}
ATLAS = {
    "scout": Path("public/art/v070/characters/scout-battle-v1.png"),
    "tky": Path("public/art/v090/characters/tky-battle-r1.png"),
    "mrs-chiha": Path("public/art/v090/characters/mrs-chiha-battle-r1.png"),
    "miyamoto-musashi": Path("public/art/v090/characters/miyamoto-musashi-battle-r1.png"),
    "zakimiya": Path("public/art/v090/characters/zakimiya-battle-r1.png"),
}

def sha(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for b in iter(lambda: f.read(1024 * 1024), b""): h.update(b)
    return h.hexdigest()

def alpha_stats(img):
    a = img.getchannel("A")
    hist = a.histogram()
    return {"min": min(i for i, n in enumerate(hist) if n), "max": max(i for i, n in enumerate(hist) if n),
            "zero": hist[0], "nonzero": sum(hist[1:]), "opaque": hist[255]}

def save_webp(img, path):
    img.save(path, "WEBP", lossless=True, method=6)

def feather_atlas(img):
    if img.size != (1536, 1024): raise ValueError(f"expected 3x2 512 atlas, got {img.size}")
    px = img.load(); out = img.copy(); op = out.load()
    for y in range(img.height):
        for x in range(img.width):
            lx, ly = x % 512, y % 512
            d = min(lx, ly, 511 - lx, 511 - ly)
            if d < 25:
                t = max(0.0, min(1.0, d / 25.0))
                f = t * t * (3.0 - 2.0 * t)
                r, g, b, a = px[x, y]
                op[x, y] = (r, g, b, round(a * f))
    return out

def trim_pad_resize(img):
    bbox = img.getchannel("A").getbbox()
    if bbox is None: raise ValueError("source has no alpha")
    trimmed = img.crop(bbox)
    padded = Image.new("RGBA", (trimmed.width + 24, trimmed.height + 24), (0, 0, 0, 0))
    padded.alpha_composite(trimmed, (12, 12))
    scale = 128 / max(padded.size)
    size = (max(1, round(padded.width * scale)), max(1, round(padded.height * scale)))
    return padded.resize(size, Image.Resampling.LANCZOS), {"alphaBbox": list(bbox), "paddedSize": list(padded.size), "outputSize": list(size), "scale": scale}

def trim_pad_resize_alpha_threshold(img, threshold):
    mask = img.getchannel("A").point(lambda value: 255 if value > threshold else 0)
    bbox = mask.getbbox()
    if bbox is None: raise ValueError("source has no alpha above threshold")
    trimmed = img.crop(bbox)
    padded = Image.new("RGBA", (trimmed.width + 24, trimmed.height + 24), (0, 0, 0, 0))
    padded.alpha_composite(trimmed, (12, 12))
    scale = 128 / max(padded.size)
    size = (max(1, round(padded.width * scale)), max(1, round(padded.height * scale)))
    return padded.resize(size, Image.Resampling.LANCZOS), {"alphaBbox": list(bbox), "thresholdExclusive": threshold, "paddedSize": list(padded.size), "outputSize": list(size), "scale": scale, "discardedOnlyAlphaAtOrBelow": threshold}

def make_sample_sheet(images, out):
    thumb = 320; label = 36; pad = 20
    sheet = Image.new("RGBA", (2 * (thumb + pad) + pad, 2 * (thumb + label + pad) + pad), (18, 22, 28, 255))
    draw = ImageDraw.Draw(sheet)
    for i, (name, image) in enumerate(images):
        image.thumbnail((thumb, thumb), Image.Resampling.LANCZOS)
        x = pad + (i % 2) * (thumb + pad); y = pad + (i // 2) * (thumb + label + pad)
        sheet.alpha_composite(image, (x + (thumb - image.width) // 2, y + (thumb - image.height) // 2))
        draw.text((x, y + thumb + 4), name, fill=(240, 240, 240, 255))
    sheet.save(out)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--repo", type=Path, default=Path.cwd()); ap.add_argument("--out", type=Path, required=True); args = ap.parse_args()
    repo, out = args.repo.resolve(), args.out.resolve(); srcout = out / "sources"; crops = out / "inspection-crops"
    srcout.mkdir(parents=True, exist_ok=True); crops.mkdir(parents=True, exist_ok=True)
    public = repo / "public/art/v100/combat-vfx"; public.mkdir(parents=True, exist_ok=True)
    prov = {"algorithm": {"atlas": "per-cell outer25px smoothstep alpha only; RGB unchanged; central462px unchanged", "props": "discard only alpha<=1 for bbox trim, 12px transparent padding, uniform resize longest side128, Lanczos", "webp": "lossless=True method=6"}, "sources": [], "outputs": [], "crops": [], "lightbladePivotSourcePixels": [[105,340],[65,341],[58,344],[83,352],[79,353],[90,359]]}
    preview_images = []
    for name, path in SOURCES.items():
        src = Image.open(path).convert("RGBA")
        preserved = srcout / f"{name}.source.png"; shutil.copy2(path, preserved)
        rec = {"name": name, "sourcePath": str(path), "sourceHash": sha(path), "sourceBytes": path.stat().st_size, "sourceMode": Image.open(path).mode, "sourceSize": list(src.size), "sourceAlpha": alpha_stats(src), "preservedPath": str(preserved)}
        if "six-frames" in name:
            candidate = feather_atlas(src); dest = public / f"{name}.webp"; save_webp(candidate, dest)
            preview_images.append((name, candidate.copy()))
            rec.update({"outputPath": str(dest), "outputHash": sha(dest), "outputBytes": dest.stat().st_size, "outputSize": list(candidate.size), "outputAlpha": alpha_stats(candidate), "adoption": "candidate-pending-boundary-visual-review"})
        else:
            candidate, geom = trim_pad_resize_alpha_threshold(src, 1); dest = public / f"{name}.webp"; save_webp(candidate, dest)
            preview_images.append((name, candidate.copy()))
            rec.update({"outputPath": str(dest), "outputHash": sha(dest), "outputBytes": dest.stat().st_size, "outputSize": list(candidate.size), "outputAlpha": alpha_stats(candidate), "trim": geom, "adoption": "candidate-pending-runtime-review"})
        prov["sources"].append(rec)
    for name, rel in ATLAS.items():
        path = repo / rel; img = Image.open(path).convert("RGBA")
        atlasrec = {"name": name, "path": str(path), "hash": sha(path), "bytes": path.stat().st_size, "size": list(img.size), "cell": [480, 448], "states": {}}
        for state, idx in (("attack-a", 3), ("attack-b", 4)):
            for direction, row in (("right", 0), ("left", 1)):
                box = (idx * 480, row * 448, (idx + 1) * 480, (row + 1) * 448)
                dest = crops / f"{name}-{state}-{direction}.png"; img.crop(box).save(dest)
                atlasrec["states"][f"{state}-{direction}"] = {"sourceRect": [*box[:2], 480, 448], "cropPath": str(dest), "cropHash": sha(dest)}
        if name == "zakimiya": atlasrec["purpose"] = "actual-throwing-attack-a-b-both-directions"
        prov["crops"].append(atlasrec)
    light_src = Image.open(SOURCES["lightblade-six-frames-r1"]).convert("RGBA")
    light_rec = {"source": "lightblade-six-frames-r1", "cellSize": [512, 512], "cells": []}
    for row in range(2):
        for col in range(3):
            box = (col * 512, row * 512, (col + 1) * 512, (row + 1) * 512)
            dest = crops / f"lightblade-cell-r{row}c{col}.png"; light_src.crop(box).save(dest)
            light_rec["cells"].append({"row": row, "col": col, "sourceRect": [*box[:2], 512, 512], "cropPath": str(dest), "cropHash": sha(dest)})
    prov["lightbladeCells"] = light_rec
    sample_sheet = out / "processed-vfx-sample-sheet.png"
    make_sample_sheet(preview_images, sample_sheet)
    prov["sampleSheet"] = str(sample_sheet)
    (out / "provenance.json").write_text(json.dumps(prov, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"out": str(out), "outputs": [{"name": r["name"], "path": r["outputPath"], "bytes": r["outputBytes"], "hash": r["outputHash"]} for r in prov["sources"]]}, ensure_ascii=False))

if __name__ == "__main__": main()
