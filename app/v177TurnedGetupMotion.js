// Source-bound to the original walker/turned 15-part rig.
// No clocks, actors, world state, drawing, imports, I/O, or iterative knee search.
// The wrapper owns lifecycle and supplies alpha!=0 hulls from the same part PNGs.
const point = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
const multiply = (a, b) => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
];
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const smooth = (p) => { const t = Math.max(0, Math.min(1, p)); return t * t * (3 - 2 * t); };
const rigidAt = (pivot, target, angle) => {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c, s, -s, c, target[0] - c * pivot[0] + s * pivot[1], target[1] - s * pivot[0] - c * pivot[1]];
};
const clonePose = (pose) => Object.fromEntries(Object.entries(pose).map(([bone, matrix]) => [bone, [...matrix]]));
const blendKey = (p, keys, field) => {
  if (p <= keys[0].p) return keys[0][field];
  for (let i = 1; i < keys.length; i++) if (p <= keys[i].p) {
    const t = smooth((p - keys[i - 1].p) / (keys[i].p - keys[i - 1].p));
    return keys[i - 1][field] + (keys[i][field] - keys[i - 1][field]) * t;
  }
  return keys.at(-1)[field];
};
const firstAscendingRoot = (limit, radius, delta, lo, hi) => {
  if (limit >= radius || limit <= -radius) return Infinity;
  const base = Math.asin(limit / radius) - delta;
  let found = Infinity;
  for (let k = -1; k <= 1; k++) {
    const root = base + k * Math.PI * 2;
    if (root >= lo - 1e-12 && root <= hi + 1e-12) found = Math.min(found, root);
  }
  return found;
};

export function createTurnedGetupPoseSampler({ readyPose, waist, neck, floor, armConstraints, legConstraints, boneHulls }) {
  const ready = clonePose(readyPose), waistPoint = [...waist], neckPoint = [...neck];
  const hulls = Object.fromEntries(Object.entries(boneHulls).map(([bone, hull]) => [bone, hull.map(p => [...p])]));
  const bones = Object.keys(ready);
  if (bones.length !== 15 || !Number.isFinite(floor) || armConstraints.length !== 2 || legConstraints.length !== 2) {
    throw new Error('The rise requires the source-bound original 15-part walker/turned rig');
  }
  for (const bone of bones) if (ready[bone].length !== 6 || !ready[bone].every(Number.isFinite) || !hulls[bone]?.length) {
    throw new Error(`Invalid source matrix/hull for ${bone}`);
  }
  const compileChain = (constraint) => {
    const A = [...(constraint.hip ?? constraint.shoulder)], B = [...(constraint.knee ?? constraint.elbow)], C = [...(constraint.ankle ?? constraint.wrist)];
    return {
      upperBone: constraint.upperBone, lowerBone: constraint.lowerBone, effectorBone: constraint.effectorBone,
      A, B, C, upperLength: distance(A, B), lowerLength: distance(B, C),
      upperAngle: Math.atan2(B[1] - A[1], B[0] - A[0]), lowerAngle: Math.atan2(C[1] - B[1], C[0] - B[0]),
      bendSign: (B[0] - A[0]) * -(C[1] - A[1]) + (B[1] - A[1]) * (C[0] - A[0]) >= 0 ? 1 : -1,
    };
  };
  const arms = armConstraints.map(compileChain), legs = legConstraints.map(compileChain);
  if (arms[0].effectorBone !== 'arm-0-hand' || arms[1].effectorBone !== 'arm-1-hand' || legs[0].effectorBone !== 'leg-0-foot' || legs[1].effectorBone !== 'leg-1-foot') {
    throw new Error('Original near/far source chain order is required');
  }
  const down = (bone, pivot, angle) => {
    const relative = rigidAt(pivot, [0, 0], angle);
    let support = -Infinity;
    for (const q of hulls[bone]) support = Math.max(support, point(relative, q)[1]);
    return support;
  };
  const solve = (chain, parent, end, pose) => {
    const h = point(parent, chain.A), t = point(end, chain.C), dx = t[0] - h[0], dy = t[1] - h[1], d = Math.hypot(dx, dy);
    const a = chain.upperLength, b = chain.lowerLength;
    if (!(d > Math.abs(a - b) + 1e-8 && d < a + b - 1e-8)) throw new Error(`Unreachable original chain: ${chain.upperBone}`);
    const along = (a * a + d * d - b * b) / (2 * d), height = Math.sqrt(Math.max(0, a * a - along * along));
    const k = [h[0] + dx / d * along - dy / d * height * chain.bendSign, h[1] + dy / d * along + dx / d * height * chain.bendSign];
    pose[chain.upperBone] = rigidAt(chain.A, h, Math.atan2(k[1] - h[1], k[0] - h[0]) - chain.upperAngle);
    pose[chain.lowerBone] = rigidAt(chain.B, k, Math.atan2(t[1] - k[1], t[0] - k[0]) - chain.lowerAngle);
  };
  const farLeg = legs[0], plantedLeg = legs[1], foldedLowerAngle = -2.8;
  const kneeSupport = {
    lowerDown: down(farLeg.lowerBone, farLeg.B, foldedLowerAngle - farLeg.lowerAngle),
    upper: hulls[farLeg.upperBone].map(q => {
      const x = q[0] - farLeg.A[0], y = q[1] - farLeg.A[1];
      return [Math.hypot(x, y), Math.atan2(y, x) - farLeg.upperAngle];
    }),
  };
  const foldedAnkle = (pelvis) => {
    const h = point(pelvis, farLeg.A), lo = -.2, hi = 1.4;
    let theta = firstAscendingRoot(floor - h[1] - kneeSupport.lowerDown, farLeg.upperLength, 0, lo, hi);
    for (const [radius, delta] of kneeSupport.upper) theta = Math.min(theta, firstAscendingRoot(floor - h[1], radius, delta, lo, hi));
    if (!Number.isFinite(theta)) throw new Error('No analytic original knee support');
    const k = [h[0] + farLeg.upperLength * Math.cos(theta), h[1] + farLeg.upperLength * Math.sin(theta)];
    return [k[0] + farLeg.lowerLength * Math.cos(foldedLowerAngle), k[1] + farLeg.lowerLength * Math.sin(foldedLowerAngle)];
  };
  const recipes = {
    forward: {
      keys: [{ p: 0, y: 370, spine: 1.2, pelvis: 1.1 }, { p: .3, y: 346, spine: 1.13, pelvis: .5 }, { p: .6, y: 315, spine: .65, pelvis: .15 }, { p: 1, y: waistPoint[1], spine: 0, pelvis: 0 }],
      releases: [[.25, .5], [.25, .5]], xOffsets: [-8, 35],
    },
    back: {
      keys: [{ p: 0, y: 346.25, spine: -1.95, pelvis: -1.1 }, { p: .3, y: 340, spine: -1.2, pelvis: -.5 }, { p: .55, y: 328, spine: .16, pelvis: -.08 }, { p: .72, y: 294, spine: .18, pelvis: .08 }, { p: 1, y: waistPoint[1], spine: 0, pelvis: 0 }],
      releases: [[.18, .4], [.1, .26]], xOffsets: [-38, 35],
    },
  };
  for (const recipe of Object.values(recipes)) {
    const initialSpine = multiply(rigidAt(waistPoint, [waistPoint[0], recipe.keys[0].y], recipe.keys[0].spine), ready.spine);
    recipe.plantedX = arms.map((chain, i) => point(initialSpine, chain.A)[0] + recipe.xOffsets[i]);
  }
  const readyNeck = point(ready.head, neckPoint), readyFarAnkle = point(ready[farLeg.effectorBone], farLeg.C);
  const handReadyAngles = arms.map(chain => Math.atan2(ready[chain.effectorBone][1], ready[chain.effectorBone][0]));

  // Returns all 15 source-space bone matrices; wrapper must supply the full map
  // to BOTH resolvedJointPose.lower and .upper for capture/hit/stun readers.
  return function sampleTurnedGetupPose(progress, variant = 'forward', {reactionAmplitude=0} = {}) {
    if (!Number.isFinite(progress) || !Object.hasOwn(recipes, variant)) throw new Error('Finite progress and forward/back recipe required');
    const p = Math.max(0, Math.min(1, progress)), recipe = recipes[variant], keys = recipe.keys;
    if (p === 1) return clonePose(ready);
    const y = blendKey(p, keys, 'y'), spineAngle = blendKey(p, keys, 'spine'), pelvisAngle = blendKey(p, keys, 'pelvis');
    const pelvisDelta = rigidAt(waistPoint, [waistPoint[0], y], pelvisAngle), spineDelta = rigidAt(waistPoint, [waistPoint[0], y], spineAngle);
    const pose = { pelvis: multiply(pelvisDelta, ready.pelvis), spine: multiply(spineDelta, ready.spine) };
    pose.head = multiply(spineDelta, multiply(rigidAt(readyNeck, readyNeck, -.12 * (1 - smooth(p))), ready.head));
    const holdP = Math.min(p, .3), holdPelvis = multiply(rigidAt(waistPoint, [waistPoint[0], blendKey(holdP, keys, 'y')], blendKey(holdP, keys, 'pelvis')), ready.pelvis);
    const fold = foldedAnkle(holdPelvis), lift = smooth((p - .3) / .3), ankle = fold.map((n, i) => n + (readyFarAnkle[i] - n) * lift), footAngle = -Math.PI / 2 * (1 - lift);
    ankle[1] = Math.min(ankle[1], floor - down(farLeg.effectorBone, farLeg.C, footAngle));
    pose[farLeg.effectorBone] = rigidAt(farLeg.C, ankle, footAngle);
    solve(farLeg, pose.pelvis, pose[farLeg.effectorBone], pose);
    pose[plantedLeg.effectorBone] = [...ready[plantedLeg.effectorBone]];
    solve(plantedLeg, pose.pelvis, pose[plantedLeg.effectorBone], pose);
    for (let i = 0; i < arms.length; i++) {
      const chain = arms[i], [start, end] = recipe.releases[i], release = smooth((p - start) / (end - start));
      const angle = handReadyAngles[i] + Math.PI / 2 * (1 - release), handDown = down(chain.effectorBone, chain.C, angle);
      const ground = [recipe.plantedX[i], floor - handDown], neutral = point(multiply(spineDelta, ready[chain.effectorBone]), chain.C);
      const target = ground.map((n, j) => n + (neutral[j] - n) * release);
      target[1] = Math.min(target[1], floor - handDown);
      pose[chain.effectorBone] = rigidAt(chain.C, target, angle);
      solve(chain, pose.spine, pose[chain.effectorBone], pose);
    }
    // Recoil follows the current rise rather than holding an earlier painted
    // pose. The wrists and feet retain their contacts; only the upper body
    // leans and the original arm lengths solve back to the same wrists.
    const reaction=.016*Math.max(0,Math.min(1,reactionAmplitude))*smooth((1-p)/.15);
    if(reaction>0) {
      const pivot=point(pose.spine,waistPoint),delta=rigidAt(pivot,pivot,reaction);
      pose.spine=multiply(delta,pose.spine);pose.head=multiply(delta,pose.head);
      for(const chain of arms)solve(chain,pose.spine,pose[chain.effectorBone],pose);
    }
    return pose;
  };
}
