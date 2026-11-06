import { advanceCommand, COMMAND_MAX, UNIT_CARDS, requestDrumDetonation } from "./gameRules.js";

export const COMMAND_RECOVERY_SECONDS = 8;
export const COMMAND_RECOVERY_MAX_RATE = 9;
const HUMAN_WEAPONS = new Set(UNIT_CARDS.map(card => card.kind));

/** Already paid or freely operable world actions must resolve before recovery. */
export function commandRecoveryWorldActionPending({
  pendingWeaponHits = [], areaEffects = [], battlefieldObjects = [], fistWaves = null,
  airstrikePhase = "idle", crawlerPhase = "cooldown",
} = {}) {
  return pendingWeaponHits.some(hit => hit.attackObservation?.sourceSide
    ? hit.attackObservation.sourceSide === "human"
    : hit.weapon === "crawler" || HUMAN_WEAPONS.has(hit.weapon))
    || areaEffects.some(effect => effect.kind === "burn" && effect.phase === "active" && effect.remaining > 0
      && effect.amountPerSecond > 0 && (effect.sourceUnitKind || effect.sourceSupplyId > 0))
    || battlefieldObjects.some(supply => supply.kind === "drum"
      && supply.v100SupportId !== "support-explosive-drum" && !supply.detonationTriggered
      && (supply.phase === "dropping" || requestDrumDetonation(supply).ok))
    || (fistWaves?.pending ?? 0) > 0 || (fistWaves?.waves?.length ?? 0) > 0
    || airstrikePhase !== "idle"
    || (crawlerPhase !== "ready" && crawlerPhase !== "cooldown");
}

export function createCommandRecoveryRuntime() {
  return Object.freeze({ armed: false, active: false, used: false, remainingSeconds: 0, targetCommand: 0, rate: 0, additionalCommand: 0 });
}

// Call only for an actual combat defeat, not Mayo withdrawal or evacuation.
export function armCommandRecovery(runtime) {
  return runtime.used || runtime.active ? runtime : Object.freeze({ ...runtime, armed: true });
}

const stopped = runtime => runtime.active || runtime.armed
  ? Object.freeze({ ...runtime, armed: false, active: false, remainingSeconds: 0, rate: 0 }) : runtime;

/** One recovery per normal campaign battle; no resource is persisted or paid. */
export function advanceCommandRecovery({
  runtime = createCommandRecoveryRuntime(), command = 0, seconds = 0, baseRate = 3, mode = null,
  activeHumans = 0, queued = 0, enemies = 0, supportReady = false, playerAttackPending = false, cards = [],
} = {}) {
  const dt = Math.max(0, Number(seconds) || 0), rate = Math.max(0, Number(baseRate) || 0);
  const normal = state => ({ command: advanceCommand(command, dt, rate), runtime: state });
  if (dt === 0) return normal(runtime);
  if (mode !== "campaign" || activeHumans > 0 || queued > 0 || enemies <= 0) return normal(stopped(runtime));
  // A last projectile or an available support can still resolve this collapse.
  // Wait for that action before using the one recovery; do not lose it merely
  // because the defeated shooter's final projectile is still in flight.
  if (supportReady || playerAttackPending) return normal(runtime.active ? stopped(runtime) : runtime);
  if ((!runtime.armed && !runtime.active) || (runtime.used && !runtime.active) || rate <= 0) return normal(runtime);
  const valid = cards.filter(card => Number.isFinite(card?.cost) && card.cost > 0 && card.cost <= COMMAND_MAX
    && Number.isFinite(card?.cooldown) && card.cooldown >= 0);
  if (!valid.length) return normal(stopped(runtime));
  let state = runtime;
  if (!state.active) {
    const normalWait = Math.min(...valid.map(card => Math.max(card.cooldown, Math.max(0, card.cost - command) / rate)));
    const plans = valid.map(card => {
      const deficit = Math.max(0, card.cost - command), duration = Math.max(COMMAND_RECOVERY_SECONDS, card.cooldown);
      const recoveryRate = Math.min(COMMAND_RECOVERY_MAX_RATE, deficit / duration);
      return { cost: card.cost, duration, recoveryRate, wait: recoveryRate > 0 ? Math.max(card.cooldown, deficit / recoveryRate) : Infinity };
    }).filter(plan => plan.recoveryRate > rate && plan.wait + 1e-6 < normalWait)
      .sort((a, b) => a.wait - b.wait || a.cost - b.cost);
    // A cheaper member on a long withdrawal cooldown must not block another
    // member's comeback. Never grant reserves if any normal input returns sooner.
    const plan = plans[0];
    if (!plan) return normal(stopped(state));
    state = Object.freeze({ ...state, armed: false, active: true, used: true,
      remainingSeconds: plan.duration, targetCommand: plan.cost, rate: plan.recoveryRate });
  }
  if (command >= state.targetCommand || !valid.some(card => card.cost === state.targetCommand)) return normal(stopped(state));
  const boostedSeconds = Math.min(dt, state.remainingSeconds, Math.max(0, state.targetCommand - command) / state.rate);
  const boosted = advanceCommand(command, boostedSeconds, state.rate);
  const nextCommand = advanceCommand(boosted, dt - boostedSeconds, rate);
  const remainingSeconds = Math.max(0, state.remainingSeconds - boostedSeconds);
  const finished = remainingSeconds <= 1e-8 || boosted >= state.targetCommand - 1e-8;
  return { command: nextCommand, runtime: Object.freeze({ ...state,
    active: !finished, remainingSeconds: finished ? 0 : remainingSeconds,
    rate: finished ? 0 : state.rate,
    additionalCommand: state.additionalCommand + Math.max(0, state.rate - rate) * boostedSeconds }) };
}

/** Current quoted wait, including both regeneration and redeployment cooldown. */
export function commandDeploymentWait({ command, cost, cooldown = 0, baseRate = 3, recovery = null }) {
  const deficit = Math.max(0, cost - command);
  let resourceSeconds = baseRate > 0 ? deficit / baseRate : deficit > 0 ? Infinity : 0;
  if (recovery?.active && recovery.rate > baseRate && command < recovery.targetCommand) {
    const accelerated = Math.min(deficit, recovery.targetCommand - command, recovery.remainingSeconds * recovery.rate);
    resourceSeconds = accelerated / recovery.rate + (baseRate > 0 ? (deficit - accelerated) / baseRate : deficit > accelerated ? Infinity : 0);
  }
  return Math.max(0, cooldown, resourceSeconds);
}
