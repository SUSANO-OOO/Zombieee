// The clock is battle-local. It never advances the world clock, resources or
// cooldowns, and resets when the event, definition or battle time changes.
const clearWindows = new WeakMap();
const infectionStates = new Set(['dying', 'ally-corpse', 'infection-warning', 'generic-zombie']);
const infectionPending = game => (game.corpses ?? []).some(corpse => corpse.side === 'human'
  && !corpse.prevented && infectionStates.has(corpse.state));
const enemyPending = game => game.enemySpawn.pending.length > 0
  || game.fighters.some(fighter => fighter.side === 'zombie' && fighter.hp > 0);
const deployed = game => !(game.deployQueue?.length)
  && game.fighters.filter(fighter => fighter.side === 'human' && fighter.hp > 0 && fighter.combatReady).length >= 3;

export function campaignWaveReady(game, mission) {
  if (!Number.isFinite(mission.clearDelaySeconds)) return true;
  const delay = Math.max(0, mission.clearDelaySeconds);
  const previous = clearWindows.get(game);
  const sameEvent = previous?.definition === game.definition
    && previous?.index === game.eventIndex && game.time >= previous.time;
  const occupied = enemyPending(game) || infectionPending(game)
    || game.bossDefeatPending === true || game.bannerTime > 0;
  const since = occupied ? null : sameEvent && previous.since !== null ? previous.since : game.time;
  const requested = sameEvent && !occupied && previous.requested;
  clearWindows.set(game, { definition: game.definition, index: game.eventIndex, time: game.time, since, requested });
  // A single airstrike clearing the opening field does not mean the player
  // has deployed the frontline. Keep that preparation time unless the force
  // is already present or the player explicitly asks for the next contact.
  return since !== null && game.time - since >= delay
    && (game.time >= mission.at || deployed(game) || requested === true);
}

export function campaignWavePrompt(game) {
  const mission = game.definition.timeline?.[game.eventIndex];
  if (!Number.isFinite(mission?.clearDelaySeconds) || enemyPending(game)) return null;
  if (infectionPending(game)) return { label: '感染源を処理', canAdvance: false };
  const state = clearWindows.get(game);
  if (!state || state.index !== game.eventIndex || state.definition !== game.definition
    || state.since === null || game.time < state.time) return null;
  const remaining = Math.max(0, Math.ceil(mission.clearDelaySeconds - (game.time - state.since)));
  if (remaining) return { label: `次波まで${remaining}秒`, canAdvance: false };
  return { label: `準備 ${Math.max(0, Math.ceil(mission.at - game.time))}秒`, canAdvance: true };
}

export function requestCampaignWave(game) {
  if (!campaignWavePrompt(game)?.canAdvance) return false;
  const state = clearWindows.get(game);
  clearWindows.set(game, { ...state, requested: true });
  return true;
}

export function withClearDrivenAssaultWaves(timeline, missionType) {
  if (missionType !== 'assault') return timeline;
  return Object.freeze(timeline.map((event, index) => index === 0 ? event : Object.freeze({
    ...event,
    // Keep authored times as reference data, but do not make an empty field
    // wait for that timestamp. A living/queued previous wave always wins.
    clearDelaySeconds: 2.5,
  })));
}
