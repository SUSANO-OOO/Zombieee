export const IMAGE_LOAD_TIMEOUT_MS = 15_000;
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
    const decodeFailed = () => {
      finish(reject, imageLoadError("ImageDecodeError", `Image decode failed: ${src}`));
    };

    image.decoding = "async";
    image.onload = () => {
      clearTimeout(loadTimer);
      if (typeof image.decode !== "function") {
        ready();
        return;
      }
      decodeTimer = setTimeout(() => {
        finish(reject, imageLoadError(
          "ImageDecodeError",
          `Image decode timed out after ${decodeTimeoutMs}ms: ${src}`,
        ));
      }, decodeTimeoutMs);
      try {
        void Promise.resolve(image.decode()).then(ready, decodeFailed);
      } catch {
        decodeFailed();
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
