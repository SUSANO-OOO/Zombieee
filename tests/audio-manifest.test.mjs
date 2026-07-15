import assert from "node:assert/strict";
import test from "node:test";

import {
  AUDIO_CATEGORIES,
  EMPTY_AUDIO_MANIFEST,
  createAudioManifest,
  validateAudioManifest,
} from "../app/audioManifest.js";

function representativeManifest() {
  return {
    version: 1,
    assets: [
      ...AUDIO_CATEGORIES.map((category, index) => ({
        id: `${category}-${index}`,
        category,
        sources: [{ src: `/audio/${category}-${index}.ogg`, type: "audio/ogg" }],
        preload: index % 2 === 0 ? "scene" : "lazy",
        loop: category === "bgm" || category === "ambience",
        gain: 0.8,
        priority: 10 + index,
        cooldownMs: 25,
        maxInstances: 2,
      })),
      { id: "weapons-extra", category: "weapons", sources: [{ src: "/audio/weapons-extra.ogg" }] },
    ],
    pools: [{
      id: "weapon-variations",
      category: "weapons",
      assetIds: ["weapons-3", "weapons-extra"],
      strategy: "round-robin",
    }],
    aliases: [{
      id: "weapon-loop",
      targetId: "weapon-variations",
      loop: true,
      instanceKey: "weapon-loop",
      maxInstances: 1,
    }],
    scenes: [{
      id: "title",
      bgm: "bgm-0",
      ambience: ["ambience-1"],
      preload: ["ui-2", "weapon-loop"],
      crossfadeMs: 900,
    }],
  };
}

test("audio manifest exposes every production category without installing placeholder paths", () => {
  assert.deepEqual(AUDIO_CATEGORIES, [
    "bgm",
    "ambience",
    "ui",
    "weapons",
    "melee",
    "humanVoices",
    "monsters",
    "support",
  ]);
  assert.equal(EMPTY_AUDIO_MANIFEST.assets.length, 0);
  assert.equal(EMPTY_AUDIO_MANIFEST.pools.length, 0);
  assert.equal(EMPTY_AUDIO_MANIFEST.aliases.length, 0);
  assert.equal(EMPTY_AUDIO_MANIFEST.scenes.length, 0);
  assert.deepEqual(EMPTY_AUDIO_MANIFEST.assetById, {});
  assert.deepEqual(EMPTY_AUDIO_MANIFEST.aliasById, {});
});

test("audio manifest indexes immutable assets, variation pools, and scenes", () => {
  const manifest = createAudioManifest(representativeManifest());
  assert.equal(manifest.assetById["bgm-0"].loop, true);
  assert.equal(manifest.assetById["ui-2"].loop, false);
  assert.equal(manifest.poolById["weapon-variations"].avoidImmediateRepeat, true);
  assert.equal(manifest.aliasById["weapon-loop"].targetId, "weapon-variations");
  assert.equal(manifest.aliasById["weapon-loop"].category, "weapons");
  assert.equal(manifest.aliasById["weapon-loop"].loop, true);
  assert.equal(manifest.sceneById.title.crossfadeMs, 900);
  assert.equal(Object.isFrozen(manifest), true);
  assert.equal(Object.isFrozen(manifest.assets[0].sources[0]), true);
  assert.throws(() => manifest.assets.push({}), TypeError);
});

test("audio manifest rejects hotlinks, broken references, category mixing, and ambiguous ids", () => {
  const candidate = representativeManifest();
  candidate.assets[0].sources[0].src = "https://example.test/title.ogg";
  candidate.pools[0].assetIds = ["bgm-0", "missing"];
  candidate.pools.push({ id: "ui-2", category: "ui", assetIds: ["ui-2"] });
  candidate.aliases.push({ id: "weapons-extra", targetId: "missing" });
  candidate.scenes[0].ambience.push("ui-2");
  candidate.scenes[0].preload.push("missing-cue");
  const errors = validateAudioManifest(candidate);
  assert.equal(errors.some((error) => error.includes("repository-local")), true);
  assert.equal(errors.some((error) => error.includes("mixes weapons with bgm")), true);
  assert.equal(errors.some((error) => error.includes("unknown asset missing")), true);
  assert.equal(errors.some((error) => error.includes("shared by an asset and a pool")), true);
  assert.equal(errors.some((error) => error.includes("shared by an alias and an asset or pool")), true);
  assert.equal(errors.some((error) => error.includes("alias weapons-extra references unknown")), true);
  assert.equal(errors.some((error) => error.includes("ambience cue must use the ambience category")), true);
  assert.equal(errors.some((error) => error.includes("unknown cue missing-cue")), true);
  assert.throws(() => createAudioManifest(candidate), /Invalid audio manifest/);
});

test("audio manifest validates limits used by cooldown and polyphony control", () => {
  const candidate = representativeManifest();
  candidate.assets[0].gain = 9;
  candidate.assets[1].cooldownMs = -1;
  candidate.assets[2].maxInstances = 0;
  candidate.pools[0].strategy = "first-only";
  candidate.aliases[0].maxInstances = 0;
  candidate.scenes[0].crossfadeMs = 50000;
  const errors = validateAudioManifest(candidate);
  assert.equal(errors.some((error) => error.includes("gain must be between")), true);
  assert.equal(errors.some((error) => error.includes("cooldownMs must be between")), true);
  assert.equal(errors.some((error) => error.includes("maxInstances must be an integer")), true);
  assert.equal(errors.some((error) => error.includes("strategy is invalid")), true);
  assert.equal(errors.some((error) => error.includes("aliases[0].maxInstances must be an integer")), true);
  assert.equal(errors.some((error) => error.includes("crossfadeMs must be between")), true);
});
