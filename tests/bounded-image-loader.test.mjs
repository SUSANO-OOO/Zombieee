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

test("decode timeout rejects with an explicit bounded decode error", async () => {
  let readyImage = null;
  const image = imageFixture({
    decode: () => new Promise(() => {}),
    onSource(candidate) {
      queueMicrotask(() => candidate.onload?.());
    },
  });
  await assert.rejects(
    loadImageWithTimeout({
      src: "/critical.webp",
      createImage: () => image,
      loadTimeoutMs: 50,
      decodeTimeoutMs: 10,
      onReady(candidate) {
        readyImage = candidate;
      },
    }),
    (error) => error?.name === "ImageDecodeError" && /critical\.webp/u.test(error.message),
  );
  assert.equal(readyImage, null);
});

test("decode rejection remains an explicit decode failure", async () => {
  const image = imageFixture({
    decode: () => Promise.reject(new Error("unsupported image")),
    onSource(candidate) {
      queueMicrotask(() => candidate.onload?.());
    },
  });
  await assert.rejects(
    loadImageWithTimeout({
      src: "/unsupported.webp",
      createImage: () => image,
      loadTimeoutMs: 50,
      decodeTimeoutMs: 10,
      onReady() {},
    }),
    (error) => error?.name === "ImageDecodeError" && /unsupported\.webp/u.test(error.message),
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
