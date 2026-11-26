import { kuromeEmergencyEvadePlan, resolveKuromeBeam } from './kuromeBoss.js';

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

export function v100BossWarningText({ boss, telegraph, fighters = [], laneCenters, beamOrigin } = {}) {
  if (!boss || !telegraph) return null;
  const name = telegraph.displayName;
  if (boss.kind !== 'kurome') return name;
  const target = fighters.find(fighter => String(fighter.id) === String(boss.stationAbility?.targetId));
  // The planner freezes its inputs. The active battle still owns the original arrays.
  const plan = kuromeEmergencyEvadePlan({ runtime: structuredClone(boss.stationAbility), target,
    tap: target ? { x: target.x, y: target.y - 30 } : null, laneCenters });
  if (!plan.ok) return name;
  if (boss.stationAbility.phase === 'locked' && Number.isFinite(beamOrigin?.x) && Number.isFinite(beamOrigin?.y)) {
    const beam = resolveKuromeBeam({ boss, runtime: { ...boss.stationAbility, phase: 'firing',
      originX: beamOrigin.x, originY: beamOrigin.y }, candidates: [target], beamHalfWidth: telegraph.beamHalfWidth });
    if (!beam.hits.includes(String(target.id))) return name + '　射線外';
  }
  return name + '　狙われた仲間をタップして回避';
}
