import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { V100_STORY_EVENTS } from "../app/v100StoryEvents.js";

const shotLabels = ["西新商店街", "早良区役所", "西新駅", "大学病院", "河口防潮門", "ムガリアン施設", "RED PANTHER装備庫", "ザキミヤ", "装甲車両", "TAKUYA撃破地点", "くまや"];

test("canonical end roll contains all eleven ordered shots, never the production instruction", () => {
  const credits = V100_STORY_EVENTS["v100:event:credits"];
  assert.deepEqual(credits.nodes.map(node => node.sceneLabel), shotLabels);
  assert.ok(credits.nodes.every(node => node.kind === "montage" && node.speaker === null && node.text.length > 0));
  assert.equal(credits.nodes[0].sourceLine, 2583);
  assert.equal(credits.nodes.at(-1).sourceLine, 2593);
  assert.ok(!V100_STORY_EVENTS["v100:event:ending"].nodes.some(node => node.sourceLine >= 2579));
  assert.ok(![...credits.nodes, ...V100_STORY_EVENTS["v100:event:ending"].nodes].some(node => node.text.includes("台詞は使わず")));
  assert.equal(V100_STORY_EVENTS["v100:event:epilogue"].nodes.at(-1).text, "西新世紀末物語");
});

test("generator preserves Markdown credits and titles and fails on a missing shot", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "v100-story-generator-"));
  const input = path.join(dir, "story.md");
  const output = path.join(dir, "events.js");
  const fixture = [
    "# PROLOGUE", "*Opening.*", "**■ TITLE**　Opening title", "# CHAPTER 1",
    ...Array.from({ length: 30 }, (_, i) => `## Stage ${i + 1}｜stage\n### 戦闘前\n*Before.*\n### 戦闘後\n*After.*`),
    "# ENDING", "*Ending action.*", "## エンドロール",
    "*台詞は使わず、既存背景と短い環境音で構成する。*",
    ...shotLabels.map((label, i) => `* **${label}：** Shot ${i + 1}.  `),
    "# EPILOGUE", "*Home again.*", "**■ TITLE**　西新世紀末物語", "**■ END**",
  ].join("\n");
  await writeFile(input, fixture);
  const run = () => spawnSync(process.execPath, ["scripts/generate-v100-story-events.mjs", input, output], { encoding: "utf8" });
  const positive = run();
  assert.equal(positive.status, 0, positive.stderr);
  const generated = await readFile(output, "utf8");
  const start = generated.indexOf("Object.freeze(") + "Object.freeze(".length;
  const end = generated.indexOf(");\n\nconst missing", start);
  const events = JSON.parse(generated.slice(start, end));
  assert.deepEqual(events["v100:event:credits"].nodes.map(node => node.text), shotLabels.map((_, i) => `Shot ${i + 1}.`));
  assert.equal(events["v100:event:ending"].nodes.length, 1);
  assert.equal(events["v100:event:prologue"].nodes.at(-1).kind, "title");
  assert.equal(events["v100:event:epilogue"].nodes.at(-1).kind, "title");
  await writeFile(input, fixture.replace("* **くまや：** Shot 11.  ", ""));
  const negative = run();
  assert.notEqual(negative.status, 0);
  assert.match(negative.stderr, /Expected all 11 canonical credits shots; got 10/u);
  assert.equal(await readFile(output, "utf8"), generated, "failed generation must preserve the previous output");
});
