import assert from "node:assert/strict";
import test from "node:test";

import { publicDisplayText } from "../app/publicDisplayNames.js";

test("public vehicle wording uses the approved mobile-facing alias without changing semantic IDs", () => {
  const cases = new Map([
    ["CRAWLER", "移動拠点"],
    ["クローラー", "移動拠点"],
    ["CRAWLER HP", "移動拠点耐久"],
    ["CRAWLER大破", "移動拠点大破"],
    ["大型移動拠点CRAWLER", "大型移動拠点"],
    ["CRAWLER出入口の安全域です", "移動拠点出入口の安全域です"],
    ["CRAWLER作戦室", "移動拠点作戦室"],
    ["遠いCRAWLER", "遠い移動拠点"],
    ["感染防衛前線でCRAWLERを守り、5waveごとのboss checkpointを突破してください。", "感染防衛前線で移動拠点を守り、5waveごとのboss checkpointを突破してください。"],
  ]);
  for (const [input, expected] of cases) assert.equal(publicDisplayText(input), expected);
  assert.equal(publicDisplayText("crawler-door"), "crawler-door");
  assert.equal(publicDisplayText("/art/v099/crawler/crawler-command-base-closed-equipment-host-v1.png"), "/art/v099/crawler/crawler-command-base-closed-equipment-host-v1.png");
});
