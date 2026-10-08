export const LANDSCAPE_BLOCK_QUERY = "(orientation: portrait)";

export function readLandscape(windowTarget = globalThis.window) {
  return !windowTarget.matchMedia(LANDSCAPE_BLOCK_QUERY).matches;
}
