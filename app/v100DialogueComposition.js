// Keep a person's place while the conversation alternates. A third arrival
// replaces the least recently speaking person, not the current interlocutor.
export function v100DialogueSlots(nodes, nodeIndex) {
  const slots = { left: null, right: null };
  const lastSpoken = { left: -1, right: -1 };
  let location = null;
  for (let index = 0; index <= nodeIndex; index += 1) {
    const node = nodes[index];
    if (node?.sceneTag && node.sceneTag !== location) {
      slots.left = null; slots.right = null;
      lastSpoken.left = -1; lastSpoken.right = -1;
      location = node.sceneTag;
    }
    if (node?.kind !== "dialogue" || !node.portraitOwner) continue;
    let side = ["left", "right"].find(key => slots[key]?.portraitOwner === node.portraitOwner);
    if (!side) {
      const preferred = node.portraitKind === "right" || ["segawa", "red-panther-commander"].includes(node.portraitOwner) ? "right" : "left";
      side = !slots[preferred] ? preferred : !slots[preferred === "left" ? "right" : "left"]
        ? preferred === "left" ? "right" : "left" : lastSpoken.left <= lastSpoken.right ? "left" : "right";
    }
    slots[side] = node;
    lastSpoken[side] = index;
  }
  return slots;
}

// Stable R5 action beats stage only people present in that action. Radio
// voices, scene changes and unrelated narration never inherit silent speakers.
const actionSubjects = Object.freeze({
  "v100:event:s17:post": { 3: ["unit-mrs-chiha", "unit-babayaga"] },
  "v100:event:s22:post": { 0: ["unit-zakimiya"], 3: ["unit-zakimiya"], 5: ["unit-paisen", "unit-zakimiya"], 7: ["unit-zakimiya"] },
  "v100:event:s23:pre": { 10: ["unit-mrs-chiha", "unit-babayaga"] },
  "v100:event:s30:pre": { 18: ["unit-mrs-chiha", "unit-babayaga"] },
  "v100:event:epilogue": { 1: ["unit-tky", "unit-paisen"], 5: ["unit-tky", "unit-paisen"], 7: ["unit-zakimiya"], 11: ["unit-mrs-chiha", "unit-babayaga"], 16: ["guide-ikura", "unit-paisen"], 21: ["unit-kumaverson"] },
});
export function v100ActionPortraitSubjects(eventId, node, nodeIndex = null) {
  if (!["action", "player-action"].includes(node?.kind) || typeof node.text !== "string") return [];
  if (node.sourceDocument === 'STORY_SCRIPT_V100_PRODUCER_R9.md') return node.actionSubjects ?? [];
  return actionSubjects[eventId]?.[nodeIndex] ?? [];
}

// Source-image framing: Ikura has 134 px of transparent headroom in a
// 512 x 640 portrait; the three V1 authority portraits are full-body masters.
// These offsets change composition only and preserve the identity pixels.
export function v100PortraitFraming(owner) {
  if (owner === "guide-ikura") return { scale: "100%", shift: "-20.9375%", headroom: "10px" };
  if (["segawa", "mugarian-president", "red-panther-commander"].includes(owner)) return { scale: "210%", shift: "0%", headroom: "0px" };
  return { scale: "100%", shift: "0%", headroom: "0px" };
}
