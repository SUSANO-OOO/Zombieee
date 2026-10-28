// Preserve source nodes and durable cursors. A page may contain one short
// exchange, but never swallow an authored sound, cut or location change.
import { v100EventPresentationFor } from './v100EventPresentation.js';
import { v100StoryExpressionFor } from './v100StoryDirection.js';
const length = node => Array.from(node?.text ?? '').length;
const phaseFor = id => id === 'v100:event:prologue' ? 'prologue' : id?.endsWith(':post') ? 'post' : 'event';
const eligibleEvent = id => id === 'v100:event:prologue' || /^v100:event:s\d{2}:(pre|post)$/u.test(id ?? '');
export function v100StoryPageFor(eventId, nodes, startIndex = 0) {
  const start = Math.max(0, Math.min(Math.max(0, nodes.length - 1), Math.floor(Number(startIndex) || 0)));
  let end = start;
  const first = nodes[start];
  if (eligibleEvent(eventId) && ['action','dialogue'].includes(first?.kind)) {
    const firstPresentation = v100EventPresentationFor({eventId,phase:phaseFor(eventId),node:first,nodeIndex:start});
    let characters = length(first);
    while (end + 1 < nodes.length && end - start < 2) {
      const next = nodes[end + 1];
      const nextPresentation = v100EventPresentationFor({eventId,phase:phaseFor(eventId),node:next,nodeIndex:end+1});
      if (!['action','dialogue'].includes(next.kind) || next.sceneTag !== first.sceneTag
        || firstPresentation.cueId || nextPresentation.cueId || firstPresentation.cinematic || nextPresentation.cinematic
        || ['backgroundPath','sceneLabel','sceneId','cutId','insertId'].some(key=>firstPresentation[key]!==nextPresentation[key])) break;
      if (first.kind === 'dialogue' && (next.kind !== 'dialogue' || !first.portraitOwner || !next.portraitOwner)) break;
      const owners=[first.portraitOwner,next.portraitOwner].filter(Boolean);
      if (owners.some(owner=>v100StoryExpressionFor(eventId,start,first,owner)!==v100StoryExpressionFor(eventId,end+1,next,owner))) break;
      const speakerCharacters=first.kind==='dialogue' ? Array.from(first.speaker??'').length+Array.from(next.speaker??'').length : 0;
      if (characters + length(next) + speakerCharacters > 90) break;
      end += 1; characters += length(next);
      if (next.kind === "dialogue") break;
    }
  }
  const displayed = nodes.slice(start, end + 1);
  const nodeIndex = end;
  return { startIndex: start, endIndex: end, nodeIndex, node: nodes[nodeIndex] ?? null,
    leadingNodes: displayed.slice(0, -1),
    // Existing playback evidence readers use this historical field name.
    leadingActions: displayed.slice(0, -1) };
}
