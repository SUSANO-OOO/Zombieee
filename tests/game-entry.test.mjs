import assert from "node:assert/strict";
import test from "node:test";
import { resolveGameEntry } from "../app/gameEntryPolicy.js";
import { LOCAL_QA_MODES } from "../app/localQa.js";
import { legacyQaUrl } from "../scripts/legacy-qa-url.mjs";

test("official and unqualified root always choose V1, even with legacy QA queries", () => {
  for (const host of ["susano-ooo.github.io", "example.com", "localhost.evil", "127.0.0.2", "", "[::1]"]) {
    for (const query of ["", "?qa=legacy", "?qa=endgame", "?qa=flow&screen=map"]) assert.equal(resolveGameEntry(host, query), "v100");
  }
  for (const host of ["localhost", "127.0.0.1"]) {
    for (const query of ["", "?safe=iphone-landscape", "?qa=unknown", "?qa=flow", "?qa=flow&screen=unknown", "?qa=legacy&qa=legacy", "?qa=endgame&qa=legacy", "?qa=mission&stage=1&state=wrong"]) assert.equal(resolveGameEntry(host, query), "v100", query);
  }
});

test("only explicit valid local legacy QA selects the legacy owner", () => {
  for (const host of ["localhost", "127.0.0.1"]) {
    for (const mode of ["legacy", ...LOCAL_QA_MODES]) assert.equal(resolveGameEntry(host, `?qa=${mode}`), "legacy");
    for (const query of ["?qa=flow&screen=map", "?qa=defense", "?qa=station&stage=4&state=start", "?qa=mission&stage=1&state=start"]) assert.equal(resolveGameEntry(host, query), "legacy", query);
  }
});

test("legacy navigation helper preserves the base origin and assets path without overriding QA", () => {
  const base = new URL("http://localhost:4321/Zombieee/?safe=iphone-landscape#entry");
  const result = new URL(legacyQaUrl(base));
  assert.equal(result.origin, base.origin); assert.equal(result.pathname, base.pathname); assert.equal(result.hash, base.hash);
  assert.equal(result.searchParams.get("safe"), "iphone-landscape"); assert.equal(result.searchParams.get("qa"), "legacy");
  assert.equal(base.searchParams.has("qa"), false);
  assert.equal(new URL("asset-manifest.json", result).href, "http://localhost:4321/Zombieee/asset-manifest.json");
  for (const input of ["https://susano-ooo.github.io/Zombieee/", "http://localhost.evil/", "http://localhost/?qa=endgame", "http://localhost/?qa="]) assert.throws(() => legacyQaUrl(input));
});
