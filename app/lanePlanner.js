import { LANE_Y } from "./gameRules.js";

export const HUMAN_LANE_ORDER = Object.freeze([1, 0, 2]);

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const nonNegative = (value, fallback = 0) => Math.max(0, finite(value, fallback));

function isLane(value, laneCount = 3) {
  return Number.isInteger(value) && value >= 0 && value < laneCount;
}

function normalizedLaneOrder(laneOrder, laneCount) {
  const result = [];
  for (const lane of Array.isArray(laneOrder) ? laneOrder : []) {
    if (isLane(lane, laneCount) && !result.includes(lane)) result.push(lane);
  }
  for (let lane = 0; lane < laneCount; lane += 1) {
    if (!result.includes(lane)) result.push(lane);
  }
  return result;
}

function valueForLane(values, lane, fallback = 0) {
  if (values instanceof Map) return finite(values.get(lane), fallback);
  if (Array.isArray(values)) return finite(values[lane], fallback);
  if (values && typeof values === "object") return finite(values[lane], fallback);
  return fallback;
}

function compareIds(left, right) {
  if (typeof left === "number" && typeof right === "number") return left - right;
  const leftKey = `${typeof left}:${String(left)}`;
  const rightKey = `${typeof right}:${String(right)}`;
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}

function assignedLaneFor(unit, laneCount) {
  for (const candidate of [unit?.assignedLane, unit?.anchorLane]) {
    if (isLane(candidate, laneCount)) return candidate;
  }
  return null;
}

/**
 * Picks the least populated lane. Ties follow center, top, bottom so a stable
 * ID ordering produces 1, 0, 2, 1, 0, 2 for the first six survivors.
 */
export function chooseHumanDeploymentLane({
  laneCounts = [],
  laneOrder = HUMAN_LANE_ORDER,
  laneCount = 3,
} = {}) {
  const count = Math.max(1, Math.floor(nonNegative(laneCount, 3)));
  const order = normalizedLaneOrder(laneOrder, count);
  return order.reduce((choice, lane) => (
    valueForLane(laneCounts, lane) < valueForLane(laneCounts, choice) ? lane : choice
  ), order[0]);
}

function threatEntry(input, defaultTotal = 0) {
  if (Number.isFinite(input)) {
    const total = nonNegative(input);
    return { threatened: total > 0, critical: 0, imminent: 0, total };
  }
  const critical = nonNegative(input?.critical);
  const imminent = nonNegative(input?.imminent);
  const total = nonNegative(input?.total ?? input?.count, defaultTotal);
  return {
    threatened: input?.threatened === true || critical > 0 || imminent > 0 || total > 0,
    critical,
    imminent,
    total,
  };
}

function summarizeThreats(laneThreats, threats, laneCount) {
  const result = Array.from({ length: laneCount }, () => threatEntry(null));
  const merge = (lane, entry, defaultTotal = 0) => {
    if (!isLane(lane, laneCount)) return;
    const normalized = threatEntry(entry, defaultTotal);
    result[lane] = {
      threatened: result[lane].threatened || normalized.threatened,
      critical: result[lane].critical + normalized.critical,
      imminent: result[lane].imminent + normalized.imminent,
      total: result[lane].total + normalized.total,
    };
  };

  if (laneThreats instanceof Map) {
    for (const [lane, entry] of laneThreats) merge(lane, entry);
  } else if (Array.isArray(laneThreats)) {
    laneThreats.forEach((entry, index) => merge(isLane(entry?.lane, laneCount) ? entry.lane : index, entry));
  } else if (laneThreats && typeof laneThreats === "object") {
    for (let lane = 0; lane < laneCount; lane += 1) merge(lane, laneThreats[lane]);
  }

  for (const threat of Array.isArray(threats) ? threats : []) {
    if (!threat || threat.alive === false || (Number.isFinite(threat.hp) && threat.hp <= 0)) continue;
    const lane = isLane(threat.anchorLane, laneCount) ? threat.anchorLane : threat.lane;
    merge(lane, {
      threatened: true,
      critical: threat.critical === true || threat.severity === "critical" ? 1 : 0,
      imminent: threat.imminent === true || threat.severity === "imminent" ? 1 : 0,
      total: 1,
    });
  }
  return result;
}

function pressureDeficit(threats, counts) {
  return threats.reduce((deficit, threat, lane) => {
    const assigned = counts[lane];
    deficit[0] += threat.threatened && assigned === 0 ? 1 : 0;
    deficit[1] += Math.max(0, threat.critical - assigned);
    deficit[2] += Math.max(0, threat.imminent - assigned);
    deficit[3] += Math.max(0, threat.total - assigned);
    return deficit;
  }, [0, 0, 0, 0]);
}

function compareTuple(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = finite(left[index]) - finite(right[index]);
    if (difference !== 0) return difference;
  }
  return 0;
}

function assignmentIsEngaged(unit) {
  return unit?.engaged === true || unit?.targetId != null || unit?.targetObjectId != null;
}

function travelSecondsFor(unit, destinationLane, laneCenters) {
  const speed = nonNegative(unit?.laneSpeed);
  if (speed <= 0) return 0;
  const fromY = Number.isFinite(unit?.y)
    ? unit.y
    : laneCenters[isLane(unit?.lane, laneCenters.length) ? unit.lane : destinationLane];
  return Math.abs(laneCenters[destinationLane] - fromY) / speed;
}

/**
 * Builds or updates human lane assignments as one atomic squad decision.
 * Existing assignments are retained. At most one unengaged survivor may move
 * per due planning pass, and a threatened source lane is never emptied.
 */
export function planHumanLaneAssignments({
  units = [],
  laneThreats = [],
  threats = [],
  now = 0,
  nextPlanAt = 0,
  laneCenters = LANE_Y,
  laneOrder = HUMAN_LANE_ORDER,
  planInterval = 0.45,
  reassignmentCooldown = 0.8,
  settleGrace = 0.35,
} = {}) {
  const centers = Array.isArray(laneCenters) && laneCenters.length > 0 ? laneCenters : LANE_Y;
  const laneCount = centers.length;
  const order = normalizedLaneOrder(laneOrder, laneCount);
  const sortedUnits = (Array.isArray(units) ? units : [])
    .filter((unit) => unit && unit.id !== undefined && unit.alive !== false && !(Number.isFinite(unit.hp) && unit.hp <= 0))
    .slice()
    .sort((left, right) => compareIds(left.id, right.id));
  const seenIds = new Set();
  for (const unit of sortedUnits) {
    if (seenIds.has(unit.id)) throw new TypeError(`Duplicate unit id: ${String(unit.id)}`);
    seenIds.add(unit.id);
  }

  const counts = Array.from({ length: laneCount }, () => 0);
  const assignments = new Map();
  for (const unit of sortedUnits) {
    const lane = assignedLaneFor(unit, laneCount);
    if (lane === null) continue;
    assignments.set(unit.id, {
      id: unit.id,
      lane,
      nextLaneDecisionAt: nonNegative(unit.nextLaneDecisionAt),
    });
    counts[lane] += 1;
  }
  for (const unit of sortedUnits) {
    if (assignments.has(unit.id)) continue;
    const lane = chooseHumanDeploymentLane({ laneCounts: counts, laneOrder: order, laneCount });
    assignments.set(unit.id, { id: unit.id, lane, nextLaneDecisionAt: nonNegative(unit.nextLaneDecisionAt) });
    counts[lane] += 1;
  }

  const normalizedThreats = summarizeThreats(laneThreats, threats, laneCount);
  const deficitBefore = pressureDeficit(normalizedThreats, counts);
  const safeNow = nonNegative(now);
  const safeNextPlanAt = nonNegative(nextPlanAt);
  let selected = null;

  if (safeNow >= safeNextPlanAt && compareTuple(deficitBefore, [0, 0, 0, 0]) > 0) {
    const candidates = [];
    for (const unit of sortedUnits) {
      const assignment = assignments.get(unit.id);
      if (!assignment || assignmentIsEngaged(unit) || safeNow < assignment.nextLaneDecisionAt) continue;
      const fromLane = assignment.lane;
      if (normalizedThreats[fromLane].threatened && counts[fromLane] <= 1) continue;
      for (const toLane of order) {
        if (toLane === fromLane) continue;
        const projectedCounts = counts.slice();
        projectedCounts[fromLane] -= 1;
        projectedCounts[toLane] += 1;
        const projectedDeficit = pressureDeficit(normalizedThreats, projectedCounts);
        if (compareTuple(projectedDeficit, deficitBefore) >= 0) continue;
        candidates.push({ unit, fromLane, toLane, projectedCounts, projectedDeficit });
      }
    }
    candidates.sort((left, right) => compareTuple(left.projectedDeficit, right.projectedDeficit)
      || compareIds(left.unit.id, right.unit.id)
      || order.indexOf(left.toLane) - order.indexOf(right.toLane));
    selected = candidates[0] ?? null;
  }

  let deficitAfter = deficitBefore;
  const moves = [];
  if (selected) {
    const lockDuration = Math.max(
      nonNegative(reassignmentCooldown, 0.8),
      travelSecondsFor(selected.unit, selected.toLane, centers) + nonNegative(settleGrace, 0.35),
    );
    const nextLaneDecisionAt = safeNow + lockDuration;
    assignments.set(selected.unit.id, {
      id: selected.unit.id,
      lane: selected.toLane,
      nextLaneDecisionAt,
    });
    moves.push(Object.freeze({
      id: selected.unit.id,
      fromLane: selected.fromLane,
      toLane: selected.toLane,
      nextLaneDecisionAt,
    }));
    deficitAfter = selected.projectedDeficit;
  }

  const assignmentList = sortedUnits.map((unit) => Object.freeze({ ...assignments.get(unit.id) }));
  return Object.freeze({
    assignments: Object.freeze(assignmentList),
    moves: Object.freeze(moves),
    changed: moves.length > 0,
    deficitBefore: Object.freeze(deficitBefore.slice()),
    deficitAfter: Object.freeze(deficitAfter.slice()),
    nextPlanAt: safeNow >= safeNextPlanAt
      ? safeNow + nonNegative(planInterval, 0.45)
      : safeNextPlanAt,
  });
}

/** Derives the physical lane from Y while keeping the current lane in a boundary dead zone. */
export function laneForCenters({
  y,
  laneCenters = LANE_Y,
  currentLane = 1,
  hysteresis = 5,
} = {}) {
  const centers = Array.isArray(laneCenters) && laneCenters.length > 0 ? laneCenters : LANE_Y;
  const current = isLane(currentLane, centers.length) ? currentLane : 0;
  const position = finite(y, centers[current]);
  let candidate = 0;
  for (let lane = 1; lane < centers.length; lane += 1) {
    if (Math.abs(position - centers[lane]) < Math.abs(position - centers[candidate])) candidate = lane;
  }
  if (candidate === current) return current;
  return Math.abs(position - centers[candidate]) + nonNegative(hysteresis, 5) < Math.abs(position - centers[current])
    ? candidate
    : current;
}

/** Advances Y toward an assigned/committed lane without teleporting physical lane state. */
export function advanceTowardLane({
  y,
  destinationLane,
  currentLane = 1,
  laneCenters = LANE_Y,
  laneSpeed = 0,
  seconds = 0,
  settleTolerance = 1,
  hysteresis = 5,
} = {}) {
  const centers = Array.isArray(laneCenters) && laneCenters.length > 0 ? laneCenters : LANE_Y;
  const current = isLane(currentLane, centers.length) ? currentLane : 0;
  const destination = isLane(destinationLane, centers.length) ? destinationLane : current;
  const startY = finite(y, centers[current]);
  const targetY = centers[destination];
  const delta = targetY - startY;
  const tolerance = nonNegative(settleTolerance, 1);
  const maxStep = nonNegative(laneSpeed) * nonNegative(seconds);
  const reached = Math.abs(delta) <= tolerance || Math.abs(delta) <= maxStep;
  const nextY = reached ? targetY : startY + Math.sign(delta) * maxStep;
  return Object.freeze({
    y: nextY,
    lane: laneForCenters({ y: nextY, laneCenters: centers, currentLane: current, hysteresis }),
    destinationLane: destination,
    moveDirection: reached ? 0 : Math.sign(delta),
    reached,
  });
}

function routeCostFor(routeCosts, lane) {
  return valueForLane(routeCosts, lane, 0);
}

/**
 * Commits an enemy route independently from target-retarget timing. A route is
 * reconsidered only while idle, beyond the route gate, off cooldown, and fully
 * settled in its current committed lane. Equal/nearly equal costs retain it.
 */
export function chooseCommittedEnemyLane({
  currentLane = 1,
  physicalLane,
  x = 0,
  y,
  laneCenters = LANE_Y,
  routeCosts = [],
  now = 0,
  nextLaneDecisionAt = 0,
  hasTarget = false,
  targetId = null,
  hasObjectTarget = false,
  targetObjectId = null,
  inContact = false,
  minDecisionX = 520,
  routeCooldown = 0.8,
  switchMargin = 1,
  settleTolerance = 4,
  laneHysteresis = 5,
} = {}) {
  const centers = Array.isArray(laneCenters) && laneCenters.length > 0 ? laneCenters : LANE_Y;
  const committed = isLane(currentLane, centers.length) ? currentLane : 0;
  const safeNow = nonNegative(now);
  const safeNextDecisionAt = nonNegative(nextLaneDecisionAt);
  const positionY = finite(y, centers[committed]);
  const actualLane = isLane(physicalLane, centers.length)
    ? physicalLane
    : laneForCenters({ y: positionY, laneCenters: centers, currentLane: committed, hysteresis: laneHysteresis });
  const baseResult = (reason, lane = committed, changed = false, nextAt = safeNextDecisionAt) => Object.freeze({
    committedLane: lane,
    changed,
    reason,
    nextLaneDecisionAt: nextAt,
  });

  if (hasTarget || targetId != null || hasObjectTarget || targetObjectId != null || inContact) return baseResult("engaged");
  if (finite(x) <= finite(minDecisionX, 520)) return baseResult("before-route-gate");
  if (safeNow < safeNextDecisionAt) return baseResult("cooldown");
  if (actualLane !== committed || Math.abs(positionY - centers[committed]) > nonNegative(settleTolerance, 4)) {
    return baseResult("lane-transition");
  }

  const alternatives = centers
    .map((_, lane) => lane)
    .filter((lane) => lane !== committed)
    .sort((left, right) => routeCostFor(routeCosts, left) - routeCostFor(routeCosts, right) || left - right);
  const candidate = alternatives[0];
  const nextAt = safeNow + nonNegative(routeCooldown, 0.8);
  if (candidate === undefined
    || routeCostFor(routeCosts, candidate) + nonNegative(switchMargin, 1) >= routeCostFor(routeCosts, committed)) {
    return baseResult("retain-route", committed, false, nextAt);
  }
  return baseResult("lower-cost-route", candidate, true, nextAt);
}
