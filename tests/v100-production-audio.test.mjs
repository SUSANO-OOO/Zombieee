import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCTION_AUDIO_MANIFEST,
  V100_STAGE_AUDIO_CONTRACT,
  enemyCombatCueFor,
  enemyVoiceCue,
  sceneIdForScreen,
  sceneIdForStoryEvent,
} from "../app/productionAudio.js";
import { V100_STAGES } from "../app/v100Registry.js";
import { V100_STAGE_RUNTIME } from "../app/v100StageRuntime.js";

test("Stage 21-30 production audio owner exposes normal, pressure, pre, and post scenes", () => {
  const aliases = new Set(PRODUCTION_AUDIO_MANIFEST.aliases.map(({ id }) => id));
  for (const stage of V100_STAGES.filter(({ number }) => number > 20)) {
    const contract = V100_STAGE_AUDIO_CONTRACT[stage.id];
    const runtime = V100_STAGE_RUNTIME[stage.id];
    for (const phase of ["battle", "pressure", "pre", "post"]) {
      const sceneId = contract?.[phase];
      assert.equal(typeof sceneId, "string", `${stage.id}/${phase} scene id`);
      assert.ok(PRODUCTION_AUDIO_MANIFEST.sceneById[sceneId], `${stage.id}/${phase} manifest scene`);
      assert.equal(runtime.audio.scenes[phase], sceneId, `${stage.id}/${phase} runtime owner`);
    }
    assert.equal(sceneIdForScreen("battle", stage.id, { musicMode: "normal" }), contract.battle);
    assert.equal(sceneIdForScreen("battle", stage.id, { musicMode: "pressure" }), contract.pressure);
    assert.equal(sceneIdForStoryEvent(stage.eventIds.pre), contract.pre);
    assert.equal(sceneIdForStoryEvent(stage.eventIds.post), contract.post);
    assert.equal(sceneIdForStoryEvent(stage.eventIds.firstClearPost), contract.post);
    assert.equal(sceneIdForScreen("battle", stage.id, { musicMode: "boss" }), "boss");
  }
  assert.equal(aliases.size, PRODUCTION_AUDIO_MANIFEST.aliases.length);
});
test("V1 Red Panther and boss roles have distinct production cue identities without human-voice fallback", () => {
  const roleKinds = [
    "red-panther-knife",
    "red-panther-shield",
    "red-panther-smg",
    "red-panther-commander",
    "mugarian-president-mutated",
    "takuya-omega",
  ];
  for (const kind of roleKinds) {
    const cues = ["attack", "hurt", "death"].map((event) => enemyVoiceCue(kind, event));
    assert.ok(cues.every(Boolean), `${kind} attack/hurt/death`);
    assert.equal(new Set(cues).size, cues.length, `${kind} cue ids are distinct`);
    assert.ok(cues.every((cue) => cue.startsWith("enemy-")), `${kind} does not borrow human voice`);
    assert.ok(cues.every((cue) => PRODUCTION_AUDIO_MANIFEST.aliases.some(({ id }) => id === cue)), `${kind} aliases resolve`);
  }
  for (const event of ["entrance", "phase", "defeat"]) {
    const cue = enemyCombatCueFor("takuya-omega", event);
    assert.ok(cue);
    assert.ok(PRODUCTION_AUDIO_MANIFEST.aliases.some(({ id }) => id === cue));
  }
  assert.equal(enemyVoiceCue("not-registered", "attack"), null);
});
