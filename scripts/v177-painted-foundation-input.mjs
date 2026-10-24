// Executes synchronously between the two original protocol-owned paint waits.
// Capture and step in one read, retaining deadlines outside the page where a
// stalled main thread cannot defer the timeout and then apply a late input.
export function stepV177PaintedFoundationInput({fighterId,previous,action}) {
  const qa=globalThis.__ASHFALL_BATTLE_QA__;
  if(!qa||!Number.isFinite(fighterId)||!Number.isFinite(previous)||typeof action!=='string')
    throw new Error('Invalid painted foundation input');
  const before=qa.getSnapshot().fighters.find(f=>f.id===fighterId)?.renderAudit;
  if(!before?.assetReady||!(before.renderSequence>previous))
    throw new Error('Foundation input requires its actual ready paint');
  // The old separate protocol read detached this snapshot before the input.
  // Retain that boundary even if the fixture reuses its render-audit object.
  const beforeRender=action.startsWith('hit-')?structuredClone(before):null;
  const sequence=before.renderSequence;
  qa.stepAnimationFoundationProof(fighterId,action,.06);
  return {previous:sequence,beforeRender};
}
