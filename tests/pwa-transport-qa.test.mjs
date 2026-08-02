import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../scripts/pwa-transport-browser-smoke.mjs", import.meta.url), "utf8");

test("WebKit transport QA records capability-unavailable separately from decode success and failure", () => {
  assert.match(source, /status = "capability-unavailable"/);
  assert.match(source, /status = "decode-success"/);
  assert.match(source, /status = "decode-failure"/);
  assert.match(source, /"audio-context-unavailable", "decode-api-unavailable"/);
  assert.match(source, /bundle-length-mismatch/);
  assert.match(source, /slice-length-mismatch/);
  assert.match(source, /mime-mismatch/);
  assert.match(source, /hash-mismatch/);
});

test("only an explicit unavailable WebKit decode capability is exempted", () => {
  assert.match(source, /engineName === "webkit"\s*&& result\.audioDecode\.status === "capability-unavailable"/);
  assert.doesNotMatch(source, /engineName === "webkit"\s*&&\s*result\.audioDecode\.supported\s*&&\s*!result\.audioDecode\.decoded/);
  assert.match(source, /result\.audioDecode\.status !== "decode-success" && !headlessWebKitAudioException/);
});
