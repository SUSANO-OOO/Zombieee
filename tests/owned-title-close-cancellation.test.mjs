import test from "node:test";
import assert from "node:assert/strict";
import { isOwnedTitleCloseCancellation } from "../scripts/owned-title-close-cancellation.mjs";

const url = "http://127.0.0.1:49123/audio/v100/score/horror.mp3";
function fixture() {
  return {
    failure: { kind: "request", text: "net::ERR_ABORTED", phase: "context-closing", at: 105, url,
      request: { id: "request-7", url, resourceType: "media", frame: "main", startedAt: 10 } },
    close: { captureComplete: true, runtimeErrorsBeforeClose: 0, pageWasOpen: true,
      unexpectedPageLoss: false, succeeded: true, error: null, startedAt: 100, completedAt: 110,
      pendingRequestIds: ["request-7"], expectedTitleUrl: url, titleMediaCount: 1,
      titleMedia: { src: url, observedAt: 99, paused: true, connected: false, error: null,
        rate: 1, nativeVolume: 0, gain: .0629 } },
  };
}

test("owned close accepts a stopped native title stream with a stale disconnected gain", () => {
  const { failure, close } = fixture();
  assert.equal(isOwnedTitleCloseCancellation(failure, close), true);
  close.titleMedia.nativeVolume = 1; close.titleMedia.gain = 0;
  assert.equal(isOwnedTitleCloseCancellation(failure, close), true);
});

const negative = [
  ["missing old-report observations", (f, c) => { delete f.at; delete c.titleMedia; }],
  ["runtime cancellation", f => { f.phase = "battle"; f.at = 90; }],
  ["GC diagnostic cancellation", f => { f.phase = "diagnostic-gc"; }],
  ["late cancellation", f => { f.at = 111; }],
  ["different media", f => { f.url = "http://127.0.0.1:49123/audio/other.mp3"; }],
  ["different request URL", f => { f.request.url += "?other"; }],
  ["unknown request", f => { f.request.id = "request-8"; }],
  ["already finished request", (f, c) => { c.pendingRequestIds = []; }],
  ["non-media request", f => { f.request.resourceType = "fetch"; }],
  ["different frame", f => { f.request.frame = "child"; }],
  ["request started after close", f => { f.request.startedAt = 101; }],
  ["incomplete image capture", (f, c) => { c.captureComplete = false; }],
  ["earlier runtime error", (f, c) => { c.runtimeErrorsBeforeClose = 1; }],
  ["page already closed", (f, c) => { c.pageWasOpen = false; }],
  ["independent page loss", (f, c) => { c.unexpectedPageLoss = true; }],
  ["context close failed", (f, c) => { c.succeeded = false; c.error = "close failed"; }],
  ["invalid close interval", (f, c) => { c.completedAt = 99; }],
  ["multiple title owners", (f, c) => { c.titleMediaCount = 2; }],
  ["different native media", (f, c) => { c.titleMedia.src += "?other"; }],
  ["playing media", (f, c) => { c.titleMedia.paused = false; }],
  ["still attached", (f, c) => { c.titleMedia.connected = true; }],
  ["decoder error", (f, c) => { c.titleMedia.error = "decode failed"; }],
  ["changed playback rate", (f, c) => { c.titleMedia.rate = 2; }],
  ["QA mute alone", (f, c) => { c.titleMedia.nativeVolume = 1; c.titleMedia.gain = .1; c.titleMedia.muted = true; c.titleMedia.hardwareGain = 0; }],
  ["native snapshot taken after close", (f, c) => { c.titleMedia.observedAt = 101; }],
  ["console error", f => { f.kind = "console"; }],
  ["different network error", f => { f.text = "net::ERR_CONNECTION_RESET"; }],
];
for (const [name, mutate] of negative) test(name + " remains a failure", () => {
  const { failure, close } = fixture(); mutate(failure, close);
  assert.equal(isOwnedTitleCloseCancellation(failure, close), false);
});
