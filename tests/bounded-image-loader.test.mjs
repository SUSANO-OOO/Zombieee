import assert from "node:assert/strict";
import test from "node:test";

import { loadImageWithTimeout } from "../app/boundedImageLoader.js";

function imageFixture({ naturalWidth = 128, decode = () => Promise.resolve(), onSource } = {}) {
  return {
    naturalWidth,
    decoding: "",
    onload: null,
    onerror: null,
    decode,
    removeAttribute() {},
    set src(value) {
      onSource?.(this, value);
    },
  };
}

test("a stalled decode falls back to the loaded image instead of failing", async () => {
  // The bytes have already arrived by the time decode() runs, so a browser that
  // stalls decoding must not turn a present asset into a missing one. The
  // naturalWidth guard covered below is what makes the fallback safe.
  //
  // 0.9.5.2 briefly made this reject instead. That contradicted the behaviour
  // 0.9.5.1 shipped and documented, and it failed the decode-hang scenario of
  // the published-site QA, where every critical asset became an error.
  let readyImage = null;
  const image = imageFixture({
    decode: () => new Promise(() => {}),
    onSource(candidate) {
      queueMicrotask(() => candidate.onload?.());
    },
  });
  const resolved = await loadImageWithTimeout({
    src: "/critical.webp",
    createImage: () => image,
    loadTimeoutMs: 50,
    decodeTimeoutMs: 10,
    onReady(candidate) {
      readyImage = candidate;
    },
  });
  assert.equal(resolved, image);
  assert.equal(readyImage, image);
});

test("a rejected decode also falls back to the loaded image", async () => {
  let readyImage = null;
  const image = imageFixture({
    decode: () => Promise.reject(new Error("unsupported image")),
    onSource(candidate) {
      queueMicrotask(() => candidate.onload?.());
    },
  });
  const resolved = await loadImageWithTimeout({
    src: "/unsupported.webp",
    createImage: () => image,
    loadTimeoutMs: 50,
    decodeTimeoutMs: 10,
    onReady(candidate) {
      readyImage = candidate;
    },
  });
  assert.equal(resolved, image);
  assert.equal(readyImage, image);
});

test("battle readiness strict mode blocks a rejected decode", async () => {
  const image = imageFixture({
    decode: () => Promise.reject(new Error("corrupt image")),
    onSource(candidate) {
      queueMicrotask(() => candidate.onload?.());
    },
  });
  await assert.rejects(
    loadImageWithTimeout({
      src: "/required-stage-object.webp",
      createImage: () => image,
      loadTimeoutMs: 50,
      decodeTimeoutMs: 10,
      requireDecode: true,
      onReady() {},
    }),
    (error) => error?.name === "ImageDecodeError" && /required-stage-object/u.test(error.message),
  );
});

test("battle readiness strict mode blocks a stalled decode", async () => {
  const image = imageFixture({
    decode: () => new Promise(() => {}),
    onSource(candidate) {
      queueMicrotask(() => candidate.onload?.());
    },
  });
  await assert.rejects(
    loadImageWithTimeout({
      src: "/required-support.webp",
      createImage: () => image,
      loadTimeoutMs: 50,
      decodeTimeoutMs: 10,
      requireDecode: true,
      onReady() {},
    }),
    (error) => error?.name === "ImageDecodeError" && /decode timeout/u.test(error.message),
  );
});

test("the decode fallback still refuses an image that carries no pixels", async () => {
  // The guard that makes falling back safe: a stalled decode on an image that
  // never actually loaded remains a failure.
  const image = imageFixture({
    naturalWidth: 0,
    decode: () => new Promise(() => {}),
    onSource(candidate) {
      queueMicrotask(() => candidate.onload?.());
    },
  });
  await assert.rejects(
    loadImageWithTimeout({
      src: "/empty.webp",
      createImage: () => image,
      loadTimeoutMs: 50,
      decodeTimeoutMs: 10,
      onReady() {},
    }),
    (error) => error?.name === "ImageLoadError" && /empty\.webp/u.test(error.message),
  );
});

test("image load timeout rejects with an explicit bounded error", async () => {
  await assert.rejects(
    loadImageWithTimeout({
      src: "/never-loads.webp",
      createImage: () => imageFixture(),
      loadTimeoutMs: 10,
      decodeTimeoutMs: 5,
      onReady() {},
    }),
    (error) => error?.name === "TimeoutError" && /never-loads/u.test(error.message),
  );
});

test("an aborted stale load cannot publish an image into a newer generation", async () => {
  const controller = new AbortController();
  let readyCount = 0;
  const promise = loadImageWithTimeout({
    src: "/stale.webp",
    signal: controller.signal,
    createImage: () => imageFixture(),
    loadTimeoutMs: 50,
    decodeTimeoutMs: 5,
    onReady() {
      readyCount += 1;
    },
  });
  controller.abort();
  await assert.rejects(promise, (error) => error?.name === "AbortError");
  assert.equal(readyCount, 0);
});

test("local QA fault injection is deterministic and never publishes a required image", async () => {
  let readyCount = 0;
  await assert.rejects(
    loadImageWithTimeout({
      src: "/required.webp",
      faultMode: "delay",
      createImage: () => imageFixture(),
      loadTimeoutMs: 10,
      onReady() { readyCount += 1; },
    }),
    (error) => error?.name === "TimeoutError",
  );
  assert.equal(readyCount, 0);
});
