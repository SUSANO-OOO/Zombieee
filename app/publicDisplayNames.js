const PUBLIC_CRAWLER_REPLACEMENTS = Object.freeze([
  ["大型移動拠点CRAWLER", "大型移動拠点"],
  [/CRAWLER\s+HP/giu, "移動拠点耐久"],
  [/CRAWLER/giu, "移動拠点"],
  [/クローラー/gu, "移動拠点"],
]);

/**
 * Maps the internal vehicle identifier to the producer-approved public term.
 * Save IDs, asset paths, scene IDs, and audio cue IDs remain untouched.
 */
export function publicDisplayText(value, { crawlerLabel = "移動拠点" } = {}) {
  if (value === null || value === undefined) return value;
  let text = String(value);
  // Operational banners use a spaced double slash between speaker and action.
  // Translate those text fragments separately from the path/ID guard below.
  if (text.includes(" // ")) return text.split(" // ").map((part) => publicDisplayText(part, { crawlerLabel })).join(" // ");
  // IDs and repository paths are semantic contracts, not player-facing copy.
  if (text.includes("/") || /^[a-z0-9]+(?:-[a-z0-9]+)+$/u.test(text)) return value;
  for (const [pattern, replacement] of PUBLIC_CRAWLER_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return crawlerLabel === "移動拠点" ? text : text.replaceAll("移動拠点", crawlerLabel);
}

export const PUBLIC_CRAWLER_LABEL = "移動拠点";
