import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { SPRITE_STATES, SPRITE_DIRECTIONS, spriteFrameFor, spriteBattleDisplaySizeFor, fitSpriteBattleDisplaySize } from "../app/spriteManifest.js";
import { requiredBattleAssetPlan } from "../app/battleAssetPlan.js";
import { V100_STAGES } from "../app/v100Registry.js";

test("both FUTAGO derivatives preserve every original alpha pixel exactly once, uniform body scale, and genuine death poses", async () => {
  const provenance = JSON.parse(await readFile("assets/source/v100/mission-completion/futago-sprite-provenance.json"));
  const hash = bytes => createHash("sha256").update(bytes).digest("hex");
  assert.equal(hash(await readFile(provenance.identityPath)), provenance.identitySha256);
  for (const atlas of provenance.atlases) {
    const source = await readFile(atlas.sourcePath), runtime = await readFile("public" + atlas.runtimePath);
    assert.equal(hash(source), atlas.sourceSha256); assert.equal(hash(runtime), atlas.runtimeSha256);
    const original = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const decoded = await sharp(runtime).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual(decoded.info, original.info);
    const { width, height } = decoded.info, coverage = new Uint8Array(width * height);
    const kind = `futago-separated-${atlas.part}`, scales = [];
    for (const direction of SPRITE_DIRECTIONS) for (const state of SPRITE_STATES) {
      const frame = spriteFrameFor(kind, state, direction);
      assert.equal(frame.flipX, false); assert.equal(frame.derivedFrom, undefined);
      assert.ok(Number.isFinite(frame.anchorX) && frame.anchorX > 0 && frame.anchorX < 1);
      assert.ok(Number.isFinite(frame.anchorY) && frame.anchorY > 0 && frame.anchorY < 1);
      const fitted = fitSpriteBattleDisplaySize(kind, frame, spriteBattleDisplaySizeFor(kind));
      scales.push(fitted.h / frame.h);
      let pixels = 0;
      for (const slice of frame.drawSlices) for (let y = frame.y + slice.y; y < frame.y + slice.y + slice.h; y++) for (let x = frame.x + slice.x; x < frame.x + slice.x + slice.w; x++) {
        const index = y * width + x;
        if (decoded.data[index * 4 + 3]) { coverage[index]++; pixels++; }
      }
      assert.ok(pixels > 10_000, `${kind}/${state}/${direction}: a complete authored body`);
      assert.ok(frame.drawSlices.length <= 32, "bounded native draw cost");
    }
    assert.ok(scales.every(scale => Math.abs(scale - scales[0]) < 1e-12), "walk, forward impact, hit and death keep one figure scale");
    for (let index = 0; index < coverage.length; index++) {
      const alpha = original.data[index * 4 + 3];
      assert.equal(decoded.data[index * 4 + 3], alpha, "lossless alpha");
      assert.equal(coverage[index], alpha ? 1 : 0, "no lost or duplicated original pose pixel");
      if (alpha) assert.deepEqual(decoded.data.subarray(index * 4, index * 4 + 4), original.data.subarray(index * 4, index * 4 + 4));
    }
  }
});

test("Stage24 prepares both individual atlases before the two-body battle; legacy plans retain the fused source", () => {
  const parameters = { stageId: V100_STAGES[23].id, enemyKinds: ["futago"], formationKinds: ["medic"] };
  const plan = requiredBattleAssetPlan(parameters);
  for (const part of ["a", "b"]) assert.ok(plan.sprites.some(sprite => sprite.kind === `futago-separated-${part}`));
  const legacy = requiredBattleAssetPlan({ ...parameters, includeV100Sprites: false });
  assert.ok(legacy.sprites.some(sprite => sprite.kind === "futago"));
  assert.ok(!legacy.sprites.some(sprite => sprite.kind.startsWith("futago-separated-")));
});
