import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  RELEASE_IDENTITY,
  RELEASE_LABEL,
  RELEASE_TAG,
  RELEASE_TITLE,
  RELEASE_VERSION,
} from "../app/releaseIdentity.js";

test("player-facing surfaces share one immutable Version 0.8.0 identity", async () => {
  assert.deepEqual(RELEASE_IDENTITY, {
    version: "0.8.0",
    tag: "v0.8.0",
    label: "Version 0.8.0",
    title: "西新世紀末物語｜アーリーアクセス版 0.8.0",
  });
  assert.equal(RELEASE_VERSION, "0.8.0");
  assert.equal(RELEASE_TAG, "v0.8.0");
  assert.equal(RELEASE_LABEL, "Version 0.8.0");
  assert.equal(RELEASE_TITLE, "西新世紀末物語｜アーリーアクセス版 0.8.0");

  const [layout, screens, game] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CampaignScreens.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8"),
  ]);
  const surfaces = `${layout}\n${screens}\n${game}`;
  assert.doesNotMatch(surfaces, /Version 0\.7\.[15]|アーリーアクセス版 0\.7\.5/);
  assert.match(layout, /title: RELEASE_TITLE/);
  assert.match(screens, /アーリーアクセス版　\{RELEASE_LABEL\}/);
  assert.match(game, /data-release-version=\{RELEASE_VERSION\}/);
  assert.match(game, /<em>\{RELEASE_LABEL\}<\/em>/);
});
