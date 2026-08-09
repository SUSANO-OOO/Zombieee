import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import { EVENT_PORTRAIT_PROFILES } from "../app/visualProfiles.js";
import {
  PORTRAIT_DIALOGUE_OVERLAP_MAX_PX,
  PORTRAIT_DIALOGUE_OVERLAP_MIN_PX,
  portraitDialogueOverlapWithinContract,
} from "../scripts/issue156-remediation-contract.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VIEWPORTS = [
  { width: 844, height: 340 },
  { width: 844, height: 390 },
  { width: 1280, height: 720 },
];

async function alphaTop(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 8) return { y, height: info.height };
    }
  }
  throw new Error(`portrait has no visible pixels: ${file}`);
}

test("all 18 event portraits retain a safe head margin and authored face-center range", async () => {
  assert.equal(Object.keys(EVENT_PORTRAIT_PROFILES).length, 18);
  for (const [kind, profile] of Object.entries(EVENT_PORTRAIT_PROFILES)) {
    assert.equal(profile.crop, "auto 92%", `${kind}/crop`);
    assert.ok(profile.focusY >= .18 && profile.focusY <= .38, `${kind}/face-center`);
    const source = await alphaTop(path.join(ROOT, "public", profile.path));
    for (const viewport of VIEWPORTS) {
      const compact = viewport.width <= 900 && viewport.height <= 430;
      const portraitHeightRatio = compact && kind === "guide" ? .6
        : compact ? .68
          : kind === "guide" || kind === "radio" ? .74 : .7;
      const containerHeight = viewport.height * portraitHeightRatio;
      const renderedHeight = containerHeight * .92;
      const backgroundOffset = (containerHeight - renderedHeight) * profile.focusY;
      const headMargin = backgroundOffset + source.y / source.height * renderedHeight;
      assert.ok(headMargin >= 8,
        `${kind}/${viewport.width}x${viewport.height} head margin ${headMargin.toFixed(2)}px`);
    }
  }
});

test("dialogue typography and advance target keep mobile acceptance minima", async () => {
  const css = await readFile(path.join(ROOT, "app", "campaign.css"), "utf8");
  assert.match(css, /dialogue-name b[^}]*clamp\(14px,/u);
  assert.match(css, /dialogue-name small[^}]*font:800 12px/u);
  assert.match(css, /dialogue-text[^}]*clamp\(12px,/u);
  assert.match(css, /dialogue-box > em[^}]*min-width:44px[^}]*min-height:44px/u);
  assert.doesNotMatch(css, /dialogue-(?:text|name)[^}]*font(?:-size)?:[^;}]*(?:7px|9px)/u);
});

test("portrait torso overlap rejects both sides of the canonical 12-40px range", () => {
  assert.equal(PORTRAIT_DIALOGUE_OVERLAP_MIN_PX, 12);
  assert.equal(PORTRAIT_DIALOGUE_OVERLAP_MAX_PX, 40);
  assert.equal(portraitDialogueOverlapWithinContract(11.999), false, "less than 12px must fail");
  assert.equal(portraitDialogueOverlapWithinContract(12), true, "12px is inclusive");
  assert.equal(portraitDialogueOverlapWithinContract(40), true, "40px is inclusive");
  assert.equal(portraitDialogueOverlapWithinContract(40.001), false, "more than 40px must fail");
  assert.equal(portraitDialogueOverlapWithinContract(Number.NaN), false, "non-finite input must fail");
});
