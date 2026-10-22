// Read-only preparation before the unchanged original measurement boundary.
// Actual in-window freshness still belongs to the original strict receipts.
export function readV177RangerPerformancePreparation({atlasPath}) {
  if(window.__V100_DEVICE_RAF__?.active)throw new Error('The original performance window is already active');
  const qa=window.__ASHFALL_BATTLE_QA__,snapshot=qa?.getSnapshot?.(),performanceBefore=qa?.getPerformanceSnapshot?.();
  if(!snapshot?.running||snapshot.over)throw new Error('S25 ended before the original performance window');
  const living=snapshot.fighters.filter(f=>f.hp>0),boss=living.some(f=>f.side==='zombie'&&f.kind==='mugarian-president-mutated');
  const boundary=performanceBefore?.rangerDrawBoundary;
  const rangers=living.filter(f=>f.side==='human'&&f.kind==='ranger');
  const painted=rangers.filter(f=>{
    const tail=f.renderAuditHistory?.at(-1),start=boundary?.actors?.find(a=>a.id===f.id),lower=tail?.jointWeightedLower;
    return tail?.renderKind==='ranger'&&tail.assetReady===true&&tail.jointAtlasPath===atlasPath
      &&tail.jointDrawSucceeded===true&&tail.jointWeightedLowerDrawSucceeded===true
      &&Number.isSafeInteger(tail.renderSequence)&&tail.renderSequence>0
      &&tail.renderSequence<=boundary?.renderSequence&&Number.isFinite(tail.jointPaintedAt)&&tail.jointPaintedAt<=boundary?.simulationTime
      &&start?.renderSequence===tail.renderSequence&&start.jointPaintedAt===tail.jointPaintedAt
      &&lower?.mode==='continuous-weighted-mesh'&&lower.parts===5&&lower.meshVertices===130&&lower.meshTriangles===192
      &&lower.coverageSamples===4&&lower.duplicateWithinPart===0&&lower.degenerate===0
      &&JSON.stringify(start.worldWeightedLower)===JSON.stringify(lower);
  });
  return {ready:boss&&painted.length>0,time:snapshot.time,bossPresent:boss,
    rangerIds:rangers.map(f=>f.id),paintedRangerIds:painted.map(f=>f.id)};
}
