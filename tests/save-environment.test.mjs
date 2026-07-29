import test from "node:test";
import assert from "node:assert/strict";

import { describeSaveEnvironment } from "../app/saveEnvironment.js";

function locationFor(url) {
  return new URL(url);
}

test("save environment distinguishes formal Pages, localhost, loopback, LAN, and preview origins", () => {
  assert.deepEqual(
    describeSaveEnvironment(locationFor("https://susano-ooo.github.io/Zombieee/")),
    {
      kind: "github-pages",
      label: "正式公開・GitHub Pages",
      origin: "https://susano-ooo.github.io",
      storageScope: "このorigin専用",
      isolationNotice: "セーブはこのorigin専用です。localhost・LAN・GitHub Pagesとは自動共有されません。",
    },
  );
  assert.equal(describeSaveEnvironment(locationFor("http://localhost:4177/")).kind, "localhost");
  assert.equal(describeSaveEnvironment(locationFor("http://127.0.0.1:4177/")).kind, "loopback");
  assert.equal(describeSaveEnvironment(locationFor("http://192.168.1.20:4177/")).kind, "lan");
  assert.equal(describeSaveEnvironment(locationFor("https://preview.example.test/")).kind, "preview");
});

test("save environment does not label another GitHub Pages path as the formal release", () => {
  const environment = describeSaveEnvironment(
    locationFor("https://susano-ooo.github.io/another-project/"),
  );
  assert.equal(environment.kind, "preview");
  assert.equal(environment.origin, "https://susano-ooo.github.io");
});
