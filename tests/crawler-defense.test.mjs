import assert from "node:assert/strict";
import test from "node:test";

import {
  crawlerDefenseResponderCapacity,
  isCrawlerAttackThreat,
  shouldReleaseCrawlerDefenseTarget,
} from "../app/crawlerDefense.js";

test("CRAWLER attack detection uses live geometry and ignores stale target IDs", () => {
  const actualAttack = {
    enemyX: 149,
    enemyRange: 34,
    baseX: 110,
    hp: 100,
    combatReady: true,
  };
  assert.equal(isCrawlerAttackThreat(actualAttack), true);
  assert.equal(isCrawlerAttackThreat({ ...actualAttack, targetId: 999, targetObjectId: 777 }), true);
  assert.equal(isCrawlerAttackThreat({ ...actualAttack, blockingObject: { id: 4 } }), false);
  assert.equal(isCrawlerAttackThreat({ ...actualAttack, enemyX: 155 }), false);
  assert.equal(isCrawlerAttackThreat({ ...actualAttack, combatReady: false }), false);
  assert.equal(isCrawlerAttackThreat({ ...actualAttack, hp: 0 }), false);
  assert.equal(isCrawlerAttackThreat({ ...actualAttack, contained: true }), false);
});

test("CRAWLER defense uses bounded responder capacities by threat class", () => {
  assert.equal(crawlerDefenseResponderCapacity({ enemyKind: "walker" }), 1);
  assert.equal(crawlerDefenseResponderCapacity({ enemyKind: "spitter" }), 1);
  assert.equal(crawlerDefenseResponderCapacity({ enemyKind: "crusher" }), 2);
  assert.equal(crawlerDefenseResponderCapacity({ enemyKind: "abomination" }), 2);
  assert.equal(crawlerDefenseResponderCapacity({ enemyKind: "gate-eater" }), 3);
  assert.equal(crawlerDefenseResponderCapacity({ enemyKind: "takuya" }), 3);
});

test("a defense lock releases as soon as the enemy stops attacking the CRAWLER", () => {
  assert.equal(shouldReleaseCrawlerDefenseTarget({
    lockedTargetId: 8,
    candidates: [{ id: 8, hp: 100, attackingCrawler: true }],
  }), false);
  assert.equal(shouldReleaseCrawlerDefenseTarget({
    lockedTargetId: 8,
    candidates: [{ id: 8, hp: 100, attackingCrawler: false }],
  }), true);
  assert.equal(shouldReleaseCrawlerDefenseTarget({
    lockedTargetId: 8,
    candidates: [],
  }), true);
});
