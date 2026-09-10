import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { renderV100PlayerName } from "../app/v100Registry.js";
import { V100_ROLE_LABELS, v100RoleLabelFor } from "../app/v100Terminology.js";

const source = await readFile(new URL("../app/V100Campaign.tsx", import.meta.url), "utf8");

test("V1 player-facing role labels use Japanese semantics and never expose raw role IDs", () => {
  assert.deepEqual(V100_ROLE_LABELS, {
    skirmisher: "遊撃兵",
    frontline: "前衛",
    heavy: "重装兵",
    marksman: "射撃手",
    support: "支援兵",
    suppression: "制圧兵",
    engineer: "工兵",
  });
  for (const [roleId, label] of Object.entries(V100_ROLE_LABELS)) assert.equal(v100RoleLabelFor(roleId), label);
  assert.doesNotMatch(source, /EARLY ACCESS/u);
  assert.match(source, /v100RoleLabelFor\(unit\.role\)/u);
  assert.doesNotMatch(source, /\{unit\.role\}/u);
});

test("V1 story player-name rendering strips authoring emphasis without leaking templates", () => {
  assert.equal(renderV100PlayerName("**{{PLAYER_NAME}}** が作戦に入る", "LUNA"), "LUNA が作戦に入る");
  assert.doesNotMatch(renderV100PlayerName("**{{PLAYER_NAME}}**", "<pilot>"), /\{\{|\*\*/u);
});
