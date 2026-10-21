// A leftward burst must stop at the front of a living body, including on the
// following tick. Testing only its centre let Souki advance into the body and
// then jump back to the same contact boundary over and over.
export function soukiBurstPhysicalX(runner, proposedX, fighters, rearBoundaryX) {
  return fighters
    .filter(candidate => candidate.side === 'human' && candidate.hp > 0
      && (candidate.anchorLane ?? candidate.lane) === (runner.anchorLane ?? runner.lane)
      && candidate.x <= runner.x
      && candidate.x + candidate.bodyRadius + runner.bodyRadius >= proposedX)
    .reduce((x, candidate) => Math.max(x, candidate.x + candidate.bodyRadius + runner.bodyRadius),
      Math.max(rearBoundaryX, proposedX));
}
