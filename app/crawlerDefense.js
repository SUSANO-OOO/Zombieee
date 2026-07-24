const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

const TWO_RESPONDER_KINDS = new Set(["crusher", "abomination", "grappler"]);
const THREE_RESPONDER_KINDS = new Set(["takuya", "gate-eater"]);

/**
 * Exact runtime predicate shared by enemy attacks and ally threat discovery.
 * Target IDs are intentionally ignored: they are previous-decision state and
 * can be stale during the first AI decision after a CRAWLER deployment.
 */
export function isCrawlerAttackThreat({
  enemyX,
  enemyRange,
  baseX,
  rangePadding = 10,
  blockingObject = null,
  combatReady = true,
  hp = 1,
  contained = false,
} = {}) {
  if (combatReady === false || contained === true || finite(hp, 0) <= 0 || blockingObject) return false;
  const x = finite(enemyX, Number.POSITIVE_INFINITY);
  const range = Math.max(0, finite(enemyRange));
  const crawlerX = finite(baseX);
  return x >= crawlerX - 2 && x - crawlerX <= range + Math.max(0, finite(rangePadding, 10));
}

/**
 * Limits dog-piling while guaranteeing enough defenders for heavy threats.
 * Normal infected need one responder, heavy bodies two, and bosses three.
 */
export function crawlerDefenseResponderCapacity({ enemyKind } = {}) {
  const kind = String(enemyKind ?? "");
  if (THREE_RESPONDER_KINDS.has(kind)) return 3;
  if (TWO_RESPONDER_KINDS.has(kind)) return 2;
  return 1;
}

/**
 * A stale target ID must never reserve a scarce CRAWLER response slot.
 * A claimant counts only after it owns the explicit defense lock and is close
 * enough to be an actionable responder on the current route.
 */
export function isEffectiveCrawlerDefenseClaim({
  fighterTargetId = null,
  fighterDefenseTargetId = null,
  fighterHp = 1,
  fighterCombatReady = true,
  fighterX,
  fighterY,
  fighterRange,
  targetId = null,
  targetHp = 1,
  targetCombatReady = true,
  targetX,
  targetY,
  targetBodyRadius,
  canEngage = true,
  approachLeash = 220,
} = {}) {
  if (targetId === null || targetId === undefined
    || fighterTargetId !== targetId
    || fighterDefenseTargetId !== targetId
    || fighterCombatReady === false
    || targetCombatReady === false
    || finite(fighterHp, 0) <= 0
    || finite(targetHp, 0) <= 0
    || canEngage === false) return false;
  const distance = Math.hypot(
    finite(targetX) - finite(fighterX),
    finite(targetY) - finite(fighterY),
  );
  const actionableDistance = Math.max(
    Math.max(0, finite(approachLeash, 220)),
    Math.max(0, finite(fighterRange)) + Math.max(0, finite(targetBodyRadius)) + 72,
  );
  return distance <= actionableDistance;
}

export function shouldReleaseCrawlerDefenseTarget({
  lockedTargetId = null,
  candidates = [],
} = {}) {
  if (lockedTargetId === null || lockedTargetId === undefined) return false;
  const current = (Array.isArray(candidates) ? candidates : [])
    .find((candidate) => candidate?.id === lockedTargetId);
  return !current
    || current.alive === false
    || finite(current.hp, 0) <= 0
    || current.attackingCrawler !== true;
}
