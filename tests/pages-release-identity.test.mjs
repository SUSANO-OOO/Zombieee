import assert from "node:assert/strict";
import test from "node:test";

import { normalizeReleaseTitle } from "../scripts/pages-release-identity.mjs";

const oldTitle = "西新世紀末物語｜アーリーアクセス版 0.7.1";
const releaseTitle = "西新世紀末物語｜アーリーアクセス版 0.7.5";

test("normalizes both the rendered title and hydration payload", () => {
  const source = `<html><head><title>${oldTitle}</title></head><body><script>self.__flight={"children":"${oldTitle}"}</script></body></html>`;
  const normalized = normalizeReleaseTitle(source, "0.7.5");

  assert.equal(normalized.includes(oldTitle), false);
  assert.equal(normalized.match(new RegExp(releaseTitle, "gu"))?.length, 2);
  assert.match(normalized, new RegExp(`<title>${releaseTitle}</title>`, "u"));
});

test("supports preview identity without weakening the one-title invariant", () => {
  const normalized = normalizeReleaseTitle(`<title>${releaseTitle}</title><script>"${releaseTitle}"</script>`, "preview");
  assert.equal(normalized, "<title>西新世紀末物語｜アーリーアクセス版 preview</title><script>\"西新世紀末物語｜アーリーアクセス版 preview\"</script>");
});

test("normalizes an emergency four-component Hotfix title without leaving a suffix", () => {
  const hotfixTitle = "西新世紀末物語｜アーリーアクセス版 0.9.5.1";
  const normalized = normalizeReleaseTitle(`<title>${hotfixTitle}</title><script>"${hotfixTitle}"</script>`, "0.9.5.1");
  assert.equal(normalized, `<title>${hotfixTitle}</title><script>"${hotfixTitle}"</script>`);
});

test("fails closed for missing or ambiguous rendered titles", () => {
  assert.throws(() => normalizeReleaseTitle("<title>Unrelated</title>", "0.7.5"), /versioned product title/u);
  assert.throws(
    () => normalizeReleaseTitle(`<title>${oldTitle}</title><title>${oldTitle}</title>`, "0.7.5"),
    /Expected one rendered title/u,
  );
});
