// Runs inside the hosted browser. A wall-clock delay alone does not guarantee
// that the newly spawned actor has reached its first native simulation/draw.
export function hasV177ContinuousDraw(proof) {
  const qa = window.__ASHFALL_BATTLE_QA__;
  if (!qa || !location.pathname.endsWith('/v100') || document.visibilityState !== 'visible') return false;
  const snapshot = qa.getSnapshot(), audit = qa.getEnemyFacingRuntimeAudit(proof.fighterId);
  const fighter = audit.fighter;
  return snapshot.running === true && snapshot.paused === false
    && fighter?.id === proof.fighterId && fighter.kind === proof.kind
    && fighter.renderKind === proof.renderKind
    && (fighter.v100TwinPart ?? null) === (proof.v100TwinPart ?? null)
    && fighter.hp > 0 && Number.isFinite(fighter.x)
    && audit.renderHistory.some(render => render.renderKind === proof.renderKind
      && render.assetReady === true && render.renderWidth > 0 && render.renderHeight > 0
      && (proof.renderKind!=='ranger'||render.jointWeightedLowerDrawSucceeded===true)
      && Number.isFinite(render.renderSequence) && render.renderSequence > 0);
}
