// Preserve every authored node and its saved cursor. Only short introductory
// action beats share a page with the following line in the same location.
export function v100StoryPageFor(eventId, nodes, startIndex = 0) {
  const start = Math.max(0, Math.min(Math.max(0, nodes.length - 1), Math.floor(Number(startIndex) || 0)));
  let end = start;
  const first = nodes[start];
  if (["v100:event:prologue", "v100:event:s01:pre"].includes(eventId) && first?.kind === "action") {
    let characters = Array.from(first.text ?? "").length;
    while (end + 1 < nodes.length && end - start < 2) {
      const next = nodes[end + 1];
      if (!["action", "dialogue"].includes(next.kind) || next.sceneTag !== first.sceneTag
        || first.cueId || next.cueId || next.cutId !== first.cutId || next.insertId !== first.insertId) break;
      const length = Array.from(next.text ?? "").length;
      if (characters + length > 90) break;
      end += 1; characters += length;
      if (next.kind === "dialogue") break;
    }
  }
  const displayed = nodes.slice(start, end + 1);
  const nodeIndex = end;
  return { startIndex: start, endIndex: end, nodeIndex, node: nodes[nodeIndex] ?? null,
    leadingActions: displayed.slice(0, -1) };
}
