// Keep a person's place while the conversation alternates. A third arrival
// replaces the least recently speaking person, not the current interlocutor.
export function v100DialogueSlots(nodes, nodeIndex) {
  const slots = { left: null, right: null };
  const lastSpoken = { left: -1, right: -1 };
  for (let index = 0; index <= nodeIndex; index += 1) {
    const node = nodes[index];
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

// Only these authored, on-screen actions name both spouses. Radio voices,
// scene changes and unrelated narration must not inherit silent speakers.
export function v100ActionPortraitSubjects(eventId, node) {
  if (node?.kind !== "action" || typeof node.text !== "string") return [];
  const reunion = eventId === "v100:event:s17:post" && node.text.startsWith("二人とも相手の腕を調べ、");
  const confession = eventId === "v100:event:s23:pre" && node.text === "ババヤガはカードではなく妻の顔を見る。";
  return reunion || confession ? ["unit-mrs-chiha", "unit-babayaga"] : [];
}

// Source-image framing: Ikura has 134 px of transparent headroom in a
// 512 x 640 portrait; the three V1 authority portraits are full-body masters.
// These offsets change composition only and preserve the identity pixels.
export function v100PortraitFraming(owner) {
  if (owner === "guide-ikura") return { scale: "100%", shift: "-20.9375%", headroom: "10px" };
  if (["segawa", "mugarian-president", "red-panther-commander"].includes(owner)) return { scale: "210%", shift: "0%", headroom: "0px" };
  return { scale: "100%", shift: "0%", headroom: "0px" };
}
