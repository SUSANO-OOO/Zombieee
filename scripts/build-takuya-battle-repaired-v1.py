from pathlib import Path
import hashlib
import json

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/takuya-boss-sprites-v2.png"
OUT = ROOT / "public/art/v100/bosses/takuya-battle-repaired-v1.png"
METADATA = ROOT / "public/art/v100/bosses/takuya-battle-repaired-v1-metadata.json"
PROVENANCE = ROOT / "assets/source/v100/takuya/takuya-battle-repaired-v1.provenance.json"
CONTACT = ROOT / "outputs/completion/takuya-atlas-repaired-v1/contact-sheet.png"

RAW_W, RAW_H = 362, 724
CELL_W, CELL_H = 464, 757
GUTTER_X, GUTTER_Y = 16, 16
STATES = ("idle", "walk-a", "walk-b", "attack-a", "attack-b", "hit")
GROUND = [604, 609, 607, 606, 617, 608]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def connected_components(mask):
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    result = []
    for y, x in zip(*np.where(mask & ~seen)):
        if seen[y, x]:
            continue
        stack = [(int(y), int(x))]
        seen[y, x] = True
        points = []
        while stack:
            yy, xx = stack.pop()
            points.append((yy, xx))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = yy + dy, xx + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        ys = [p[0] for p in points]
        xs = [p[1] for p in points]
        result.append((points, (min(xs), min(ys), max(xs) + 1, max(ys) + 1)))
    return result


def crop_raw(atlas, index):
    return atlas.crop((index * RAW_W, 0, (index + 1) * RAW_W, RAW_H))


def runtime_cell(raw):
    cell = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    cell.alpha_composite(raw, (GUTTER_X, GUTTER_Y))
    return cell


def clear_left_spill(raw, max_y=None):
    alpha = np.array(raw)[:, :, 3] > 0
    removed = 0
    for points, bbox in connected_components(alpha):
        if bbox[0] == 0 and (max_y is None or bbox[1] < max_y):
            for y, x in points:
                raw.putpixel((x, y), (0, 0, 0, 0))
                removed += 1
    return removed


def authored_blade(raw):
    array = np.array(raw)
    alpha = array[:, :, 3]
    polygon = [(47, 483), (229, 381), (268, 443), (81, 550)]
    mask = Image.new("L", (RAW_W, RAW_H), 0)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    keep = (alpha > 0) & (np.array(mask) > 0)
    result = np.zeros_like(array)
    result[keep] = array[keep]
    return Image.fromarray(result, "RGBA"), int(keep.sum()), polygon


def visible_rect(cell):
    alpha = np.array(cell)[:, :, 3]
    ys, xs = np.where(alpha > 0)
    return [int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)]


def main():
    source = Image.open(SOURCE).convert("RGBA")
    source_hash = sha(SOURCE)
    raw = {state: crop_raw(source, index) for index, state in enumerate(STATES)}
    before = {state: runtime_cell(raw[state]) for state in STATES}
    cells = {state: before[state].copy() for state in STATES}
    changes = {}

    walk = raw["walk-a"]
    removed = clear_left_spill(walk, max_y=430)
    cells["walk-a"] = runtime_cell(walk)
    blade, blade_pixels, blade_polygon = authored_blade(raw["walk-b"])
    walk_b = raw["walk-b"]
    removed_walk_b = clear_left_spill(walk_b)
    cells["walk-b"] = runtime_cell(walk_b)
    changes["walk-b"] = {
        "removedLeftSpillPixels": removed_walk_b,
        "reason": "isolated floating fragment from preceding walk-a cell",
    }
    blade_layer = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    blade_layer.alpha_composite(blade, (GUTTER_X + 20, GUTTER_Y - 5))
    cells["walk-a"].alpha_composite(blade_layer)
    protection = Image.new("L", (CELL_W, CELL_H), 0)
    ImageDraw.Draw(protection).polygon(
        [(GUTTER_X + 270, GUTTER_Y + 327), (GUTTER_X + 323, GUTTER_Y + 327),
         (GUTTER_X + 339, GUTTER_Y + 372), (GUTTER_X + 322, GUTTER_Y + 399),
         (GUTTER_X + 286, GUTTER_Y + 401), (GUTTER_X + 271, GUTTER_Y + 380)],
        fill=255,
    )
    cell_array = np.array(cells["walk-a"])
    original_array = np.array(before["walk-a"])
    protection_array = np.array(protection) > 0
    cell_array[protection_array] = original_array[protection_array]
    cells["walk-a"] = Image.fromarray(cell_array, "RGBA")
    changes["walk-a"] = {
        "removedLeftSpillPixels": removed,
        "sourceBladePolygon": blade_polygon,
        "sourceBladePixels": blade_pixels,
        "translationPx": [20, -5],
        "handProtection": "exact source RGBA overwrite",
    }

    attack_a = raw["attack-a"]
    removed = clear_left_spill(attack_a)
    cells["attack-a"] = runtime_cell(attack_a)
    fragment = raw["attack-b"].crop((0, 25, 76, 145))
    cells["attack-a"].alpha_composite(fragment, (GUTTER_X + RAW_W, GUTTER_Y + 25))
    changes["attack-a"] = {
        "removedLeftSpillPixels": removed,
        "sourceCut": [0, 25, 76, 145],
        "translationPx": [GUTTER_X + RAW_W, GUTTER_Y + 25],
    }

    cells["attack-b"] = runtime_cell(raw["attack-b"])
    ab = np.array(cells["attack-b"])
    ab[GUTTER_Y + 25:GUTTER_Y + 145, GUTTER_X:GUTTER_X + 76] = 0
    cells["attack-b"] = Image.fromarray(ab, "RGBA")
    changes["attack-b"] = {"removedSourceCut": [0, 25, 76, 145]}

    atlas = Image.new("RGBA", (CELL_W * len(STATES), CELL_H), (0, 0, 0, 0))
    for index, state in enumerate(STATES):
        atlas.alpha_composite(cells[state], (index * CELL_W, 0))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT)

    rects = [visible_rect(cells[state]) for state in STATES]
    metadata = {
        "format": "nishijin-v100-takuya-repaired-motion-atlas",
        "version": 1,
        "path": "art/v100/bosses/takuya-battle-repaired-v1.png",
        "cellWidth": CELL_W,
        "cellHeight": CELL_H,
        "columns": len(STATES),
        "sourceWidth": RAW_W,
        "sourceHeight": RAW_H,
        "sourceOffset": {"x": GUTTER_X, "y": GUTTER_Y},
        "anchorX": 197 / 464,
        "groundAnchorPixels": GROUND,
        "states": list(STATES),
        "visibleRects": rects,
        "sourceSha256": source_hash,
        "atlasSha256": sha(OUT),
    }
    METADATA.parent.mkdir(parents=True, exist_ok=True)
    METADATA.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")

    CONTACT.parent.mkdir(parents=True, exist_ok=True)
    contact = Image.new("RGBA", (CELL_W * len(STATES), CELL_H), (44, 60, 82, 255))
    draw = ImageDraw.Draw(contact)
    for index, state in enumerate(STATES):
        contact.alpha_composite(cells[state], (index * CELL_W, 0))
        draw.text((index * CELL_W + 8, 8), state, fill=(255, 255, 255, 255))
    contact.save(CONTACT)

    PROVENANCE.parent.mkdir(parents=True, exist_ok=True)
    provenance = {
        "generator": "scripts/build-takuya-battle-repaired-v1.py",
        "source": {"path": "public/takuya-boss-sprites-v2.png", "sha256": source_hash},
        "output": {"path": str(OUT.relative_to(ROOT)).replace("\\", "/"), "sha256": sha(OUT)},
        "geometry": metadata,
        "changes": changes,
        "preserved": "raw body, face, clothing, feet and weapon RGB are retained except the explicit r3 blade transfer and attack spill repairs",
        "legacy": "public/art/v100/bosses/takuya-omega-battle-v1.png and v060 source remain untouched",
    }
    PROVENANCE.write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUT), "sha256": sha(OUT), "visibleRects": rects}, indent=2))


if __name__ == "__main__":
    main()
