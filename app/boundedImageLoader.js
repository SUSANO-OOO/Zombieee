// A single battle sheet is 1-2MB. From the published origin the largest one
// measured 11.5s on an ordinary home connection, and a phone on mobile data is
// slower still, so 15s was rejecting images that were merely large rather than
// genuinely stuck. This still bounds the wait; it just no longer calls a slow
// network a failure. Must stay below ASSET_LOAD_SESSION_DEADLINE_MS.
export const IMAGE_LOAD_TIMEOUT_MS = 30_000;
// Six Version 0.9.9.5 enemy atlases are 3360x896 RGBA sheets. WebKit's first
// decode on constrained CI and iPhone-class devices can legitimately exceed
// two seconds even when the response and image are valid. Keep the decode
// bounded, but align it with the same product deadline that already guards the
// enclosing asset session instead of manufacturing six deterministic failures.
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
  requireDecode = false,
  faultMode = null,
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
      // General-purpose callers preserve the compatibility fallback shipped in
      // 0.9.5.1. Battle readiness opts into requireDecode: those sources are a
      // closed semantic plan and may not mount gameplay after a decode failure.
      //
      // 0.9.5.2 changed both paths to reject instead. That contradicted the
      // behaviour 0.9.5.1 shipped and documented, and it is what the
      // decode-hang scenario in the published-site QA exists to catch.
      const failDecode = (reason) => finish(reject, imageLoadError(
        "ImageDecodeError",
        `Image decode failed: ${src}${reason?.message ? ` (${reason.message})` : ""}`,
      ));
      decodeTimer = setTimeout(
        requireDecode ? () => failDecode(new Error("decode timeout")) : ready,
        decodeTimeoutMs,
      );
      try {
        void Promise.resolve(image.decode()).then(ready, requireDecode ? failDecode : ready);
      } catch (error) {
        if (requireDecode) failDecode(error);
        else ready();
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
    if (faultMode === "delay") return;
    image.src = faultMode === "404"
      ? `/__qa_missing_${Date.now()}.png`
      : faultMode === "corrupt"
        ? "data:image/png;base64,bm90LWFuLWltYWdl"
        : src;
  });
}
