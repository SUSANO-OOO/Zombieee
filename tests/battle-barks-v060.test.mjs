import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  APPROVED_BATTLE_BARK_LINES,
  BATTLE_BARK_CONFIG,
  CANONICAL_RANDOM_BATTLE_BARK_LINES,
  LOCAL_QA_BATTLE_BARK_LINES,
  RANDOM_BATTLE_BARK_TRIGGER_IDS,
  advanceBattleBarkRuntime,
  battleBarkSpeakerKey,
  createBattleBarkRuntime,
  queueBattleBark,
} from "../app/battleBarks.js";

const UNIT_KINDS = [
  "brawler",
  "ranger",
  "scout",
  "medic",
  "brute",
  "gunner",
  "crazy-king",
  "kumaverson",
  "babayaga",
];

test("all 44 canonical random battle lines are transcribed without deletion or paraphrase", async () => {
  const canonical = await readFile(new URL("../docs/SCENARIO_0.6.0_COMPLETE.md", import.meta.url), "utf8");
  const section = canonical.slice(
    canonical.indexOf("# 5. 戦闘中ランダム台詞"),
    canonical.indexOf("# 6. Codex実装用イベント構造"),
  );
  const canonicalTexts = [...section.matchAll(/^- .+：「(.+)」$/gm)].map((match) => match[1]);
  const implementedTexts = CANONICAL_RANDOM_BATTLE_BARK_LINES.map(({ text }) => text);

  assert.equal(canonicalTexts.length, 44);
  assert.equal(CANONICAL_RANDOM_BATTLE_BARK_LINES.length, 44);
  assert.deepEqual(implementedTexts, canonicalTexts);
  assert.equal(new Set(CANONICAL_RANDOM_BATTLE_BARK_LINES.map(({ id }) => id)).size, 44);
});

test("the random catalog covers all nine stable character IDs and only matching situations", () => {
  assert.deepEqual(new Set(CANONICAL_RANDOM_BATTLE_BARK_LINES.map(({ speakerKind }) => speakerKind)), new Set(UNIT_KINDS));
  assert.deepEqual(new Set(CANONICAL_RANDOM_BATTLE_BARK_LINES.map(({ trigger }) => trigger)), new Set(Object.values(RANDOM_BATTLE_BARK_TRIGGER_IDS)));
  for (const unitKind of UNIT_KINDS) {
    assert.ok(CANONICAL_RANDOM_BATTLE_BARK_LINES.some(({ speakerKind, trigger }) => speakerKind === unitKind && trigger === "deploy"));
  }
  assert.ok(CANONICAL_RANDOM_BATTLE_BARK_LINES.every((line) => APPROVED_BATTLE_BARK_LINES.includes(line)));

  const wrongSituation = queueBattleBark({
    runtime: createBattleBarkRuntime(),
    event: { trigger: "special-enemy", speakerKind: "brawler", speakerId: 10 },
  });
  assert.equal(wrongSituation.shown, false);
  assert.equal(wrongSituation.reason, "no-approved-line");
});

test("speaker cooldowns use stable unit IDs and cannot be bypassed by redeployment", () => {
  const initial = createBattleBarkRuntime();
  const first = queueBattleBark({
    runtime: initial,
    event: { trigger: "role-cue", speakerKind: "scout", speakerId: 101 },
    random: () => 0,
  });
  assert.equal(first.shown, true);
  assert.equal(first.bark.speakerId, "scout");
  assert.equal(first.runtime.speakerReadyAt.scout, BATTLE_BARK_CONFIG.speakerCooldown);
  assert.equal(first.runtime.speakerReadyAt[101], undefined);

  const inactive = advanceBattleBarkRuntime(first.runtime, 2);
  const redeployedSameCharacter = queueBattleBark({
    runtime: inactive,
    event: { trigger: "role-cue", speakerKind: "scout", speakerId: 999 },
    random: () => 0,
  });
  assert.equal(redeployedSameCharacter.shown, false);
  assert.equal(redeployedSameCharacter.reason, "speaker-cooldown");

  const differentCharacterSameTransientId = queueBattleBark({
    runtime: inactive,
    event: { trigger: "role-cue", speakerKind: "ranger", speakerId: 101 },
    random: () => 0,
  });
  assert.equal(differentCharacterSameTransientId.shown, true);
  assert.equal(differentCharacterSameTransientId.bark.speakerId, "ranger");
});

test("stable speaker keys prefer character or voice identity over transient instance IDs", () => {
  assert.equal(battleBarkSpeakerKey({ speakerKind: "crazy-king", speaker: "クレイジーキング" }, { speakerKind: "crazy-king", speakerId: 42 }), "crazy-king");
  assert.equal(battleBarkSpeakerKey({ voiceKind: "guide", speaker: "水城 奈々" }, { speakerKind: "crawler", speakerId: 42 }), "guide");
});

test("localhost QA role coverage mirrors the nine-unit roster", () => {
  const qaRoleKinds = LOCAL_QA_BATTLE_BARK_LINES
    .filter(({ trigger }) => trigger === "role-cue")
    .map(({ speakerKind }) => speakerKind);
  assert.deepEqual(qaRoleKinds, ["scout", "ranger", "brute", "brawler", "gunner", "medic", "crazy-king", "kumaverson", "babayaga"]);
  assert.equal(LOCAL_QA_BATTLE_BARK_LINES.length, 13);
});
