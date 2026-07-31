// A single battle sheet is 1-2MB. From the published origin the largest one
// measured 11.5s on an ordinary home connection, and a phone on mobile data is
// slower still, so 15s was rejecting images that were merely large rather than
// genuinely stuck. This still bounds the wait; it just no longer calls a slow
// network a failure. Must stay below ASSET_LOAD_SESSION_DEADLINE_MS.
export const IMAGE_LOAD_TIMEOUT_MS = 30_000;
export const IMAGE_DECODE_TIMEOUT_MS = 2_000;

function imageLoadError(name, message) {
  const error = new Error(message);
  error.name = name;
  return error;
}

export function loadImageWithTimeout({
  src,
  onReady,
  signal,
  createImage = () => new Image(),
  loadTimeoutMs = IMAGE_LOAD_TIMEOUT_MS,
  decodeTimeoutMs = IMAGE_DECODE_TIMEOUT_MS,
}) {
  return new Promise((resolve, reject) => {
    const image = createImage();
    let settled = false;
    let loadTimer = null;
    let decodeTimer = null;

    const cleanup = () => {
      clearTimeout(loadTimer);
      clearTimeout(decodeTimer);
      image.onload = null;
      image.onerror = null;
      signal?.removeEventListener?.("abort", abort);
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const ready = () => {
      if (!image.naturalWidth) {
        finish(reject, imageLoadError("ImageLoadError", `Image unavailable: ${src}`));
        return;
      }
      if (!signal?.aborted) onReady(image);
      finish(resolve, image);
    };
    const abort = () => {
      image.removeAttribute?.("src");
      finish(reject, imageLoadError("AbortError", `Image load cancelled: ${src}`));
    };

    image.decoding = "async";
    image.onload = () => {
      clearTimeout(loadTimer);
      if (typeof image.decode !== "function") {
        ready();
        return;
      }
      // A stalled or rejected decode() falls back to the load event rather than
      // failing the image. The bytes have already arrived by this point, and
      // ready() still refuses anything with no naturalWidth, so the fallback
      // cannot let a broken image through - it only stops a browser that is
      // slow or unwilling to decode from being treated as a missing asset.
      //
      // 0.9.5.2 changed both paths to reject instead. That contradicted the
      // behaviour 0.9.5.1 shipped and documented, and it is what the
      // decode-hang scenario in the published-site QA exists to catch.
      decodeTimer = setTimeout(ready, decodeTimeoutMs);
      try {
        void Promise.resolve(image.decode()).then(ready, ready);
      } catch {
        ready();
      }
    };
    image.onerror = () => {
      finish(reject, imageLoadError("ImageLoadError", `Image unavailable: ${src}`));
    };
    signal?.addEventListener?.("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    loadTimer = setTimeout(() => {
      image.removeAttribute?.("src");
      finish(reject, imageLoadError(
        "TimeoutError",
        `Image load timed out after ${loadTimeoutMs}ms: ${src}`,
      ));
    }, loadTimeoutMs);
    image.src = src;
  });
}
