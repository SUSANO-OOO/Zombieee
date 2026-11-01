import { MANUAL_ABILITY_REGISTRY, isManualAbilityReady } from './manualAbilities.js';
import { kuromeEmergencyEvadePlan, resolveKuromeBeam } from './kuromeBoss.js';

export const V100_BOSS_COUNTERPLAY_FALLBACK = '次の出撃は大技の後に';
const defense = [
  ['guardian', 'ガンテツの技で周囲を守ろう'],
  ['kumaverson', 'クマバーソンの技で踏ん張ろう'],
  ['miyamoto-musashi', 'ムサシの技で受け流そう'],
];
const areaKinds = new Set(['brute', 'crazy-king', 'zakimiya', 'tky', 'mrs-chiha']);
const attackKinds = new Set([...areaKinds, 'brawler', 'scout', 'ranger', 'babayaga']);

// Keep the actual ally tap clear of native skill buttons. Chromium touch
// adjustment can select a nearby button even when elementFromPoint is canvas.
// 44px padding also accounts for the icon's invisible 44px hit target.
export function v100BossCounterplayTapObstacles({fighters = [], transform} = {}) {
  if (!transform || ![transform.scale, transform.offsetX, transform.offsetY].every(Number.isFinite)
    || transform.scale <= 0) return [];
  const targetIds = new Set(fighters.filter(f => f.kind === 'kurome' && f.side === 'zombie' && f.hp > 0
    && f.combatReady && ['tracking','locked'].includes(f.stationAbility?.phase))
    .map(f => String(f.stationAbility.targetId)));
  return fighters.filter(f => targetIds.has(String(f.id)) && f.side === 'human' && f.hp > 0
    && f.combatReady && Number.isFinite(f.x) && Number.isFinite(f.y)).map(f => ({
    ownerId: null, x: transform.offsetX + f.x * transform.scale - 44,
    y: transform.offsetY + (f.y - 30) * transform.scale - 44, width: 88, height: 88,
  }));
}

// Read only the same availability observations used by the native skill buttons.
// No new target searches, input, cooldown, damage or save mutations are made.
export function v100BossCounterplayHint({ boss, telegraph, readyAbilities = [], fighters = [], laneCenters, beamOrigin } = {}) {
  if (!boss || !telegraph) return null;
  if (boss.kind === 'kurome') {
    const target = fighters.find(fighter => String(fighter.id) === String(boss.stationAbility?.targetId));
    // The action planner freezes its result, including nested runtime fields.
    // Keep that immutability from freezing any live combat-owned arrays.
    const plan = kuromeEmergencyEvadePlan({ runtime: structuredClone(boss.stationAbility), target,
      tap: target ? { x: target.x, y: target.y - 30 } : null, laneCenters });
    if (!plan.ok) return '次の出撃は照準の発射後に';
    if (boss.stationAbility.phase === 'locked' && Number.isFinite(beamOrigin?.x) && Number.isFinite(beamOrigin?.y)) {
      const beam = resolveKuromeBeam({ boss, runtime: { ...boss.stationAbility, phase: 'firing',
        originX: beamOrigin.x, originY: beamOrigin.y },
        candidates: [target], beamHalfWidth: telegraph.beamHalfWidth });
      if (!beam.hits.includes(String(target.id))) return '照準線を外れた。発射を待とう';
    }
    return '狙われた仲間をタップして回避';
  }
  const owners = new Map(fighters.map(fighter => [fighter.id, fighter]));
  const ready = readyAbilities.filter(row => {
    const owner = owners.get(row.id);
    return row.available === true && owner?.kind === row.kind && isManualAbilityReady(owner);
  });
  const enoughTime = kind => ready.some(row => row.kind === kind)
    && Number(telegraph.remainingSeconds) > MANUAL_ABILITY_REGISTRY[kind].windupSeconds + .1;
  // Defend before impact only when the skill can actually finish its wind-up.
  // The .1s margin covers the existing HUD sampling interval, not human reaction.
  for (const [kind, hint] of defense) if (enoughTime(kind)) return hint;
  if (enoughTime('medic')) return 'ナオの技で傷ついた仲間を回復';
  if (boss.kind === 'mother' && ready.some(row => areaKinds.has(row.kind))) return '増える敵へ範囲技を残しておこう';
  if (ready.some(row => attackKinds.has(row.kind))) {
    return boss.kind === 'gairen' ? '外殻が開いたら攻撃技で反撃' : '大技が終わったら攻撃技で反撃';
  }
  return V100_BOSS_COUNTERPLAY_FALLBACK;
}
