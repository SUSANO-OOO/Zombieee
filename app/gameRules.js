export const COMMAND_MAX = 100;
export const COMMAND_REGEN = 3.5;
export const RAGE_MAX = 100;

// Keep all three tap targets above the landscape control deck.
export const LANE_Y = [250, 305, 360];
export const LANE_NAMES = ["TOP", "MID", "LOW"];

export const UNIT_CARDS = [
  { kind: "scout", name: "SCOUT", cost: 25, key: "1", desc: "FAST", deployCooldown: 8, hp: 80, speed: 27, damage: 11, range: 28, attackEvery: .62 },
  { kind: "ranger", name: "RANGER", cost: 45, key: "2", desc: "RANGED", deployCooldown: 11, hp: 70, speed: 20, damage: 20, range: 145, attackEvery: .82 },
  { kind: "brute", name: "BREAKER", cost: 70, key: "3", desc: "ARMORED", deployCooldown: 18, hp: 175, speed: 14, damage: 30, range: 28, attackEvery: 1.05 },
  { kind: "brawler", name: "BRAWLER", cost: 55, key: "4", desc: "FIGHTER", deployCooldown: 13, hp: 135, speed: 23, damage: 26, range: 30, attackEvery: .72 },
  { kind: "gunner", name: "GUNNER", cost: 60, key: "5", desc: "BURST", deployCooldown: 15, hp: 95, speed: 18, damage: 36, range: 92, attackEvery: 1.08 },
  { kind: "medic", name: "MEDIC", cost: 50, key: "6", desc: "SUPPORT", deployCooldown: 20, hp: 82, speed: 19, damage: 11, range: 118, attackEvery: .96 },
];

export const SUPPORT_DEFS = [
  { kind: "barrel", name: "IRON BARREL", cost: 20, key: "Z", desc: "PROXIMITY BLAST" },
  { kind: "medkit", name: "MEDKIT", cost: 25, key: "X", desc: "HEALING ZONE" },
  { kind: "molotov", name: "MOLOTOV", cost: 35, key: "C", desc: "BURN + SLOW" },
  { kind: "airstrike", name: "AIRSTRIKE", cost: 60, key: "Q", desc: "HEAVY STRIKE" },
];

export const MISSION_EVENTS = [
  { at: 0, wave: 1, label: "WAVE 1 — CONTACT", units: [["walker", 0], ["walker", 1], ["runner", 2]] },
  { at: 20, wave: 2, label: "WAVE 2 — SPLIT ATTACK", units: [["walker", 0], ["runner", 0], ["spitter", 1], ["walker", 1], ["walker", 2]] },
  { at: 42, wave: 3, label: "WAVE 3 — PRESSURE", units: [["runner", 0], ["walker", 0], ["runner", 1], ["walker", 1], ["runner", 2], ["walker", 2]] },
  { at: 60, wave: 4, label: "ELITE ENEMY — SHADE", units: [["shade", 0], ["runner", 0], ["walker", 1], ["spitter", 1], ["runner", 2]] },
  { at: 80, wave: 5, label: "WAVE 5 — BREAKERS", units: [["crusher", 0], ["walker", 0], ["spitter", 1], ["runner", 1], ["crusher", 2], ["walker", 2]] },
  { at: 103, wave: 6, label: "WAVE 6 — NO SAFE LANE", units: [["runner", 0], ["spitter", 0], ["walker", 1], ["crusher", 1], ["runner", 2], ["spitter", 2]] },
  { at: 123, wave: 7, label: "FINAL LINE — HOLD", units: [["crusher", 0], ["runner", 0], ["abomination", 1], ["walker", 1], ["crusher", 2], ["runner", 2]] },
  { at: 132, wave: 7, label: "WARNING — MASSIVE SIGNATURE", units: [] },
  { at: 138, wave: 8, label: "BOSS — TAKUYA / IRON JUDGE", units: [["walker", 0], ["takuya", 1], ["walker", 2]] },
  { at: 158, wave: 9, label: "INFECTED REINFORCEMENTS", units: [["runner", 0], ["spitter", 1], ["runner", 2]] },
  { at: 178, wave: 10, label: "TAKUYA — ENRAGED", bossOnly: true, units: [["crusher", 0], ["runner", 1], ["crusher", 2]] },
  { at: 210, wave: 11, label: "LAST CHANCE — BURN THE NEST", units: [["runner", 0], ["spitter", 0], ["runner", 1], ["crusher", 1], ["runner", 2], ["spitter", 2]] },
];

export function phaseAt(time) {
  if (time < 60) return 1;
  if (time < 138) return 2;
  return 3;
}

export function advanceCommand(command, seconds) {
  return Math.min(COMMAND_MAX, command + Math.max(0, seconds) * COMMAND_REGEN);
}

export function canDeploy({ running, paused, over, command, cost, cooldown }) {
  return Boolean(running && !paused && !over && command >= cost && cooldown <= 0);
}

export function rageReward(kind) {
  return ({ walker: 4, runner: 5, spitter: 8, crusher: 14, shade: 22, abomination: 20, takuya: 25, turned: 7 })[kind] ?? 4;
}

export function scrapReward(kind) {
  return ({ walker: 6, runner: 7, spitter: 10, crusher: 18, shade: 24, abomination: 40, takuya: 80, turned: 9 })[kind] ?? 6;
}

export function objectiveFor(phase, nestUnlocked) {
  if (phase === 1) return "HOLD ALL THREE LANES";
  if (phase === 2) return "PUSH TO THE CHECKPOINT";
  return nestUnlocked ? "DESTROY THE INFECTED NEST" : "ELIMINATE TAKUYA";
}

export function laneForY(y, current = 1, hysteresis = 5) {
  let candidate = 0;
  if (Math.abs(y - LANE_Y[1]) < Math.abs(y - LANE_Y[candidate])) candidate = 1;
  if (Math.abs(y - LANE_Y[2]) < Math.abs(y - LANE_Y[candidate])) candidate = 2;
  if (candidate === current) return current;
  return Math.abs(y - LANE_Y[candidate]) + hysteresis < Math.abs(y - LANE_Y[current]) ? candidate : current;
}

export function autonomousTargetScore({ distance, claims, capacity = 1, enemyX, isCurrent = false }) {
  const claimsFromOthers = Math.max(0, claims - (isCurrent ? 1 : 0));
  const excessClaims = Math.max(0, claimsFromOthers - capacity + 1);
  const crawlerThreat = enemyX < 300 ? 180 : enemyX < 420 ? 55 : 0;
  return distance + excessClaims * 82 - crawlerThreat;
}

export function interceptorTargetScore({ distance, claims, capacity = 1, isCurrent = false, rearward = 0 }) {
  const claimsFromOthers = Math.max(0, claims - (isCurrent ? 1 : 0));
  const excessClaims = Math.max(0, claimsFromOthers - capacity + 1);
  return distance + Math.max(0, rearward) * 2 + excessClaims * 96;
}

export function isCrawlerRouteBlocker({ enemyX, defenderX, defenderY, routeY, lookAhead = 105, corridor = 30 }) {
  const lead = enemyX - defenderX;
  return lead >= 0 && lead <= lookAhead && Math.abs(defenderY - routeY) <= corridor;
}
