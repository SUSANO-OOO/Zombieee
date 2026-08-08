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
export function publicDisplayText(value) {
  if (value === null || value === undefined) return value;
  let text = String(value);
  // IDs and repository paths are semantic contracts, not player-facing copy.
  if (text.includes("/") || /^[a-z0-9]+(?:-[a-z0-9]+)+$/u.test(text)) return value;
  for (const [pattern, replacement] of PUBLIC_CRAWLER_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

export const PUBLIC_CRAWLER_LABEL = "移動拠点";
