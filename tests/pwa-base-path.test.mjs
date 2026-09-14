import assert from "node:assert/strict";
import test from "node:test";

import { resolvePwaBaseUrl } from "../app/pwaBasePath.js";

function windowFixture(href, declaredBase = null) {
  const url = new URL(href);
  return {
    location: url,
    document: {
      querySelector(selector) {
        if (selector !== 'meta[name="github-pages-base"]' || !declaredBase) return null;
        return { getAttribute: () => declaredBase };
      },
    },
  };
}

test("nested V1 route keeps its pathname while sharing the application PWA root", () => {
  assert.equal(resolvePwaBaseUrl(windowFixture("https://example.test/Zombieee/v100")), "https://example.test/Zombieee/");
  assert.equal(resolvePwaBaseUrl(windowFixture("http://localhost:4177/v100/")), "http://localhost:4177/");
  assert.equal(resolvePwaBaseUrl(windowFixture("https://example.test/Zombieee/")), "https://example.test/Zombieee/");
});

test("Pages base metadata wins for a nested route and cannot escape the origin", () => {
  assert.equal(resolvePwaBaseUrl(windowFixture("https://example.test/Zombieee/v100/", "/Zombieee/")), "https://example.test/Zombieee/");
  assert.equal(resolvePwaBaseUrl(windowFixture("https://example.test/Zombieee/v100/", "https://other.test/")), "https://example.test/Zombieee/");
});
