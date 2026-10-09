// Authored against Producer R5 (2026-10-08). Stable event IDs and source-node
// indices bind staging to the screenplay; no dialogue-text guessing at runtime.
export const V100_MAIN_CAST = Object.freeze([
  "unit-kumaverson", "unit-babayaga", "unit-zakimiya", "unit-tky",
  "unit-mrs-chiha", "unit-paisen", "unit-mayo-chan",
]);
export const V100_EVENT_EXPRESSIONS = Object.freeze(["warm", "determined", "alarm", "grief"]);
export const V100_EVENT_PORTRAIT_PROFILES = Object.freeze({
  "unit-paisen":"paisen", "unit-kumaverson":"kumaverson", "unit-babayaga":"babayaga",
  "unit-zakimiya":"zakimiya", "unit-tky":"tky", "unit-mrs-chiha":"chiha",
  "unit-mayo-chan":"mayo", "unit-crazy-king":"king", "guide-ikura":"ikura",
  "unit-miyamoto-musashi":"musashi", "unit-hachi":"hachi", "unit-nao":"nao",
  "unit-mizuchi":"mizuchi", "unit-raider":"raider", "unit-monkey":"monkey",
  "unit-tatara":"tatara", "unit-gantetsu":"gantetsu", segawa:"segawa",
  "mugarian-president":"president", "red-panther-commander":"commander",
});
export const V100_R5_STORY_CUTS = Object.freeze(Object.fromEntries([
  "prologue-door-crisis", "chiha-confession", "ending-zakimiya-family", "zakimiya-c4-reunion",
  "epilogue-tky-receipt", "epilogue-main-table", "ending-tky-transport", "ending-medical-progress", "president-restrained-alive",
].map(name => [name, `/art/v100/story-r5/cuts/${name}.webp`])));

export function v100EventPortraitPath(owner, expression = "determined") {
  const profile = V100_EVENT_PORTRAIT_PROFILES[owner];
  return profile && V100_EVENT_EXPRESSIONS.includes(expression)
    ? `/art/v100/story-r5/portraits/${profile}-${expression}.webp` : null;
}

// Relief after rescue and grief after losses differ from combat preparation.
const soberPosts = new Set([3, 6, 10, 13, 18, 20, 25, 27, 29, 30]);
const alarmPres = new Set([3, 6, 10, 13, 18, 20, 25, 27, 29, 30]);
export function v100StoryExpressionFor(eventId, nodeIndex, node, owner = node?.portraitOwner) {
  const tag = node?.sceneTag;
  if (eventId === "v100:event:prologue") return tag === "daily" ? "warm"
    : tag === "crisis" || (tag === "escape" && nodeIndex < 36) ? "alarm" : "determined";
  if (eventId === "v100:event:epilogue") {
    if (owner === "unit-kumaverson" && [3, 18, 19, 22, 23, 24].includes(nodeIndex)) return "determined";
    if (owner === "unit-tky" && [1, 3, 4, 22, 23, 24].includes(nodeIndex)) return "determined";
    if (owner === "unit-zakimiya" && [8, 9].includes(nodeIndex)) return "alarm";
    if (owner === "unit-mrs-chiha" && nodeIndex >= 12 && nodeIndex <= 15) return "determined";
    if (owner === "unit-babayaga" && [12, 13, 14].includes(nodeIndex)) return "grief";
    return "warm";
  }
  if (eventId === "v100:event:ending") return tag === "dawn" ? "grief"
    : tag === "hospital" ? "warm" : tag === "signal" ? "determined"
      : owner === "unit-mrs-chiha" && nodeIndex < 19 ? "grief" : "warm";
  if (eventId === "v100:event:s17:post") return nodeIndex < 3 ? "alarm" : "warm";
  if (eventId === "v100:event:s06:post") return owner === "unit-babayaga" ? "alarm" : "determined";
  if (eventId === "v100:event:s22:post") return owner === "unit-zakimiya"
    ? nodeIndex < 5 ? "grief" : nodeIndex <= 10 ? "warm" : "determined" : "determined";
  if (eventId === "v100:event:s23:pre") {
    if (nodeIndex === 6) return "alarm";
    if (nodeIndex >= 16 || owner === "unit-kumaverson" || owner === "unit-paisen") return "determined";
    return "grief";
  }
  if (eventId === "v100:event:s25:post" && tag === "soup") return "warm";
  const match = /^v100:event:s(\d{2}):(pre|post)$/u.exec(String(eventId));
  if (match) return match[2] === "post" ? soberPosts.has(Number(match[1])) ? "grief" : "warm"
    : alarmPres.has(Number(match[1])) && nodeIndex < 4 ? "alarm" : "determined";
  return "determined";
}

const cues = Object.freeze({
  "v100:event:prologue": { 0:"door-open", 5:"dish", 10:"paper", 16:"latch", 20:"door-close", 23:"door-close", 28:"fabric", 32:"pan", 34:"glass", 39:"latch", 41:"door-close" },
  "v100:event:s17:post": { 3:"fabric" },
  "v100:event:s23:pre": { 6:"door-close", 10:"paper", 15:"fabric", 16:"latch" },
  "v100:event:ending": { 0:"door-close", 4:"footsteps", 14:"paper", 19:"latch" },
  "v100:event:epilogue": { 5:"dish", 11:"dish", 16:"fabric", 19:"paper", 25:"dish" },
});

export function v100StoryDirectionFor(eventId, nodeIndex, node) {
  let cut = null;
  if (eventId === "v100:event:prologue" && node?.sceneTag === "crisis" && nodeIndex >= 20 && nodeIndex <= 23) cut = "prologue-door-crisis";
  if (eventId === "v100:event:s23:pre" && nodeIndex >= 10 && nodeIndex <= 15) cut = "chiha-confession";
  if (eventId === "v100:event:s22:post" && nodeIndex >= 7 && nodeIndex <= 9) cut = "zakimiya-c4-reunion";
  if (eventId === "v100:event:s25:post" && nodeIndex <= 3) cut = "president-restrained-alive";
  if (eventId === "v100:event:ending" && node?.sceneTag === "dawn" && nodeIndex === 0) cut = "ending-tky-transport";
  if (eventId === "v100:event:ending" && node?.sceneTag === "hospital") cut = "ending-medical-progress";
  if (eventId === "v100:event:epilogue" && node?.kind !== "title") {
    if (nodeIndex >= 22 && nodeIndex <= 24) cut = "epilogue-tky-receipt";
    else if (nodeIndex === 0 || nodeIndex === 25) cut = "epilogue-main-table";
  }
  const cue = cues[eventId]?.[nodeIndex];
  return Object.freeze({ cut, backgroundPath: cut ? V100_R5_STORY_CUTS[cut] : null,
    cinematic: Boolean(cut), expression: v100StoryExpressionFor(eventId, nodeIndex, node),
    cueId: cue ? `v100-story-${cue}` : null });
}
