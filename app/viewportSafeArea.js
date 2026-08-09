const VIEWPORT_SAFE_AREA_EDGES = Object.freeze(["top", "right", "bottom", "left"]);

const emptySafeArea = () => ({ top: 0, right: 0, bottom: 0, left: 0 });

function finiteCssPixels(value) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function clearViewportSafeAreaInlineOverride(root) {
  for (const edge of VIEWPORT_SAFE_AREA_EDGES) {
    root.style.removeProperty(`--app-viewport-safe-${edge}`);
  }
  delete root.dataset.safeAreaSource;
}

/**
 * Keeps production ownership in CSS env(safe-area-inset-*), while returning
 * resolved pixels to JS layout code. Local QA presets are the sole path that
 * writes the four custom properties inline.
 */
export function resolveViewportSafeArea({
  root,
  document,
  getComputedStyle,
  qaSafeArea = null,
}) {
  if (qaSafeArea) {
    const resolved = emptySafeArea();
    for (const edge of VIEWPORT_SAFE_AREA_EDGES) {
      resolved[edge] = finiteCssPixels(qaSafeArea[edge]);
      root.style.setProperty(`--app-viewport-safe-${edge}`, `${resolved[edge]}px`);
    }
    root.dataset.safeAreaSource = "local-qa-iphone-landscape";
    return Object.freeze(resolved);
  }

  clearViewportSafeAreaInlineOverride(root);
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.inset = "0";
  probe.style.paddingTop = "env(safe-area-inset-top, 0px)";
  probe.style.paddingRight = "env(safe-area-inset-right, 0px)";
  probe.style.paddingBottom = "env(safe-area-inset-bottom, 0px)";
  probe.style.paddingLeft = "env(safe-area-inset-left, 0px)";
  (document.body ?? root).appendChild(probe);
  try {
    const computed = getComputedStyle(probe);
    return Object.freeze({
      top: finiteCssPixels(computed.paddingTop),
      right: finiteCssPixels(computed.paddingRight),
      bottom: finiteCssPixels(computed.paddingBottom),
      left: finiteCssPixels(computed.paddingLeft),
    });
  } finally {
    probe.remove();
  }
}
