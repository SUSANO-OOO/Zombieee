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
