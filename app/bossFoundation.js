import { deepFreeze } from "./content/freeze.js";

export const BOSS_FOUNDATION_SCHEMA_VERSION = 1;

const phase = (phaseNumber, label, startsAtRatio) => ({
  phase: phaseNumber,
  label,
  startsAtRatio,
});

/**
 * Existing bosses are the first consumers of the 0.9.0 shared boss contract.
 * Kurome is the producer-approved reference slice for the remaining new bosses,
 * but stays isolated until its outbreak mission becomes the campaign consumer.
 */
export const BOSS_DEFINITIONS = deepFreeze([
  {
    id: "boss-takuya",
    enemyKind: "takuya",
    displayName: "TAKUYA",
    classification: "正体不明の変異種・異常感染者",
    hpBar: { color: "#cf5b39", accentColor: "#f0b650" },
    phases: [
      phase(1, "第1段階", 1),
      phase(2, "第2段階", .75),
      phase(3, "最終段階", .25),
    ],
    entrance: {
      warningLabel: "警告 // TAKUYA",
      cueId: "sfx-v070-takuya-entrance",
      fullBodyRequired: true,
    },
    attackTelegraph: {
      attackId: "iron-hammer-assault",
      displayName: "鉄槌強襲",
      kind: "ground-ellipse",
      warningSeconds: .85,
      radius: 118,
      finalPhaseRadius: 145,
      color: "#ff5e38",
      counterplay: "予告範囲外へ退避",
    },
    display: {
      sizeClass: "normal-boss",
      compactBodyHeight: 117,
      standardBodyHeight: 108,
      bodyBounds: { width: 94, height: 128 },
      footAnchor: { x: .5, y: .98 },
      shadow: { radiusX: 34, radiusY: 9 },
      hitboxRadius: 29,
    },
    combat: {
      attackRange: 38,
      statusResistance: { stun: .45, push: .2, slow: .65 },
      formChange: "enraged-at-half-hp",
      summonProfile: "infected-reinforcement",
      componentChange: null,
    },
    reward: { equipmentId: "boss-muscle-fiber", quantity: 1 },
    resultId: "boss-result-takuya",
    compendiumId: "boss-compendium-takuya",
    compendium: {
      title: "TAKUYA",
      summary: "鉄槌強襲と増援を用いる大型異常感染者。",
    },
  },
  {
    id: "boss-gate-eater",
    enemyKind: "gate-eater",
    displayName: "改札喰い",
    classification: "駅設備・研究容器融合大型特殊個体",
    hpBar: { color: "#c88536", accentColor: "#f0c46a" },
    phases: [
      phase(1, "第1段階", 1),
      phase(2, "第2段階", .75),
      phase(3, "最終段階", .25),
    ],
    entrance: {
      warningLabel: "警告 // 改札喰い",
      cueId: "sfx-v070-station-warning",
      fullBodyRequired: true,
    },
    attackTelegraph: {
      attackId: "ticket-gate-charge",
      displayName: "改札突進",
      kind: "lane-rectangle",
      warningSeconds: 1.15,
      laneHalfHeight: 31,
      color: "#e7b25b",
      counterplay: "予告laneから退避し側面を攻撃",
    },
    display: {
      sizeClass: "normal-boss",
      compactBodyHeight: 125,
      standardBodyHeight: 115,
      bodyBounds: { width: 126, height: 142 },
      footAnchor: { x: .5, y: .98 },
      shadow: { radiusX: 42, radiusY: 11 },
      hitboxRadius: 32,
    },
    combat: {
      attackRange: 42,
      statusResistance: { stun: .6, push: .12, slow: .72 },
      formChange: "containment-exposure",
      summonProfile: null,
      componentChange: "research-container-containment",
    },
    reward: { equipmentId: "boss-rail-spine", quantity: 1 },
    resultId: "boss-result-gate-eater",
    compendiumId: "boss-compendium-gate-eater",
    compendium: {
      title: "改札喰い",
      summary: "駅設備と融合し、予告後にlaneを突進する大型特殊個体。",
    },
  },
  {
    id: "boss-kurome-prototype",
    enemyKind: "kurome",
    displayName: "クロメ",
    workingName: false,
    prototypeStatus: "producer-approved",
    classification: "長距離追跡・視界撹乱型異常発生個体",
    hpBar: { color: "#38cddd", accentColor: "#d461ed" },
    phases: [
      phase(1, "第1段階", 1),
      phase(2, "第2段階", .65),
      phase(3, "最終段階", .3),
    ],
    entrance: {
      warningLabel: "警告 // クロメ",
      cueId: "enemy-takuya-attack",
      fullBodyRequired: true,
    },
    attackTelegraph: {
      attackId: "tracking-oculus",
      displayName: "追跡眼",
      kind: "tracking-ray",
      warningSeconds: 1.25,
      trackingSeconds: .82,
      beamHalfWidth: 18,
      finalPhaseBeamHalfWidth: 23,
      interferenceSeconds: 1.2,
      color: "#55e6ef",
      counterplay: "照準線から離脱",
    },
    display: {
      sizeClass: "giant-boss",
      compactBodyHeight: 146,
      standardBodyHeight: 133,
      bodyBounds: { width: 150, height: 170 },
      footAnchor: { x: .5, y: .98 },
      shadow: { radiusX: 46, radiusY: 11 },
      hitboxRadius: 36,
    },
    combat: {
      attackRange: 240,
      statusResistance: { stun: .66, push: .08, slow: .78 },
      formChange: "sensor-fin-expansion",
      summonProfile: null,
      componentChange: "oculus-tracking-lock",
    },
    reward: { equipmentId: "boss-resonance-gland", quantity: 1 },
    resultId: "boss-result-kurome-prototype",
    compendiumId: "boss-compendium-kurome-prototype",
    compendium: {
      title: "クロメ",
      summary: "照準を追従させ、固定後に長距離射線と局所的な視界撹乱を発生させる異常発生個体。",
      assetPath: "/art/v090-prototypes/bosses/kurome-compendium-candidate-r1.webp",
    },
  },
  {
    id: "boss-mother",
    enemyKind: "mother",
    displayName: "マザー",
    workingName: false,
    prototypeStatus: "producer-approved",
    classification: "増殖・戦場制圧型異常発生個体",
    hpBar: { color: "#8f5148", accentColor: "#d5a270" },
    phases: [
      phase(1, "第1段階", 1),
      phase(2, "増殖段階", .68),
      phase(3, "崩壊段階", .3),
    ],
    entrance: {
      warningLabel: "異常発生 // マザー",
      cueId: "boss-mother-entrance",
      fullBodyRequired: true,
    },
    attackTelegraph: {
      attackId: "brood-vault-eruption",
      displayName: "増殖室離床",
      kind: "brood-radial",
      warningSeconds: 1.1,
      radius: 128,
      color: "#9e6855",
      counterplay: "増殖範囲から離れ、召喚体を先に処理",
    },
    display: {
      sizeClass: "giant-boss",
      compactBodyHeight: 152,
      standardBodyHeight: 139,
      bodyBounds: { width: 196, height: 154 },
      footAnchor: { x: .5, y: .97 },
      shadow: { radiusX: 64, radiusY: 15 },
      hitboxRadius: 44,
    },
    combat: {
      attackRange: 78,
      statusResistance: { stun: .72, push: .05, slow: .82 },
      formChange: "brood-shutter-collapse",
      summonProfile: "brood-reinforcement",
      componentChange: "brood-vault-shutters",
    },
    reward: { equipmentId: "boss-ossified-core", quantity: 1 },
    resultId: "boss-result-mother",
    compendiumId: "boss-compendium-mother",
    compendium: {
      title: "マザー",
      summary: "増殖室そのものが歩行し、感染体を排出して戦場を狭める異常発生個体。",
      assetPath: "/art/v090/bosses/mother-compendium-r1.webp",
    },
  },
  {
    id: "boss-ooguchi",
    enemyKind: "ooguchi",
    displayName: "オオグチ",
    workingName: true,
    prototypeStatus: "producer-review-required",
    classification: "捕食・高速突進型異常発生個体",
    hpBar: { color: "#783a31", accentColor: "#d58858" },
    phases: [
      phase(1, "第1段階", 1),
      phase(2, "飢餓段階", .62),
      phase(3, "暴走段階", .26),
    ],
    entrance: {
      warningLabel: "異常発生 // オオグチ",
      cueId: "enemy-takuya-attack",
      fullBodyRequired: true,
    },
    attackTelegraph: {
      attackId: "predation-charge",
      displayName: "捕食突進",
      kind: "lane-rectangle",
      warningSeconds: 1.05,
      laneHalfHeight: 34,
      color: "#ba6249",
      counterplay: "突進laneを外し、停止後の側面を攻撃",
    },
    display: {
      sizeClass: "giant-boss",
      compactBodyHeight: 132,
      standardBodyHeight: 121,
      bodyBounds: { width: 204, height: 132 },
      footAnchor: { x: .5, y: .96 },
      shadow: { radiusX: 66, radiusY: 14 },
      hitboxRadius: 42,
    },
    combat: {
      attackRange: 52,
      statusResistance: { stun: .58, push: .08, slow: .68 },
      formChange: "jaw-shield-open",
      summonProfile: null,
      componentChange: "four-jaw-shields",
    },
    reward: { equipmentId: "boss-muscle-fiber", quantity: 1 },
    resultId: "boss-result-ooguchi",
    compendiumId: "boss-compendium-ooguchi",
    compendium: {
      title: "オオグチ（呼称仮）",
      summary: "四枚の顎殻を衝角として突進し、停止直後だけ中枢を露出する捕食個体。",
    },
  },
  {
    id: "boss-gairen",
    enemyKind: "gairen",
    displayName: "ガイレン",
    workingName: true,
    prototypeStatus: "producer-review-required",
    classification: "外殻展開・防御切替型異常発生個体",
    hpBar: { color: "#4f514c", accentColor: "#b69b68" },
    phases: [
      phase(1, "閉殻段階", 1),
      phase(2, "展開段階", .7),
      phase(3, "中枢露出", .28),
    ],
    entrance: {
      warningLabel: "異常発生 // ガイレン",
      cueId: "enemy-takuya-attack",
      fullBodyRequired: true,
    },
    attackTelegraph: {
      attackId: "shell-breaker-sweep",
      displayName: "外殻掃討",
      kind: "shell-sweep",
      warningSeconds: 1.15,
      radius: 104,
      color: "#93815f",
      counterplay: "正面を避け、外殻展開中に中枢へ集中攻撃",
    },
    display: {
      sizeClass: "giant-boss",
      compactBodyHeight: 156,
      standardBodyHeight: 143,
      bodyBounds: { width: 184, height: 176 },
      footAnchor: { x: .5, y: .98 },
      shadow: { radiusX: 61, radiusY: 15 },
      hitboxRadius: 46,
    },
    combat: {
      attackRange: 88,
      statusResistance: { stun: .8, push: .03, slow: .86 },
      formChange: "five-shell-deployment",
      summonProfile: null,
      componentChange: "armored-core-exposure",
    },
    reward: { equipmentId: "boss-rail-spine", quantity: 1 },
    resultId: "boss-result-gairen",
    compendiumId: "boss-compendium-gairen",
    compendium: {
      title: "ガイレン（呼称仮）",
      summary: "五枚の外殻で正面攻撃を遮断し、掃討動作で中枢を露出する歩行要塞。",
    },
  },
  {
    id: "boss-futago",
    enemyKind: "futago",
    displayName: "フタゴ",
    workingName: true,
    prototypeStatus: "producer-review-required",
    classification: "融合・分裂多段階型異常発生個体",
    hpBar: { color: "#6f4a50", accentColor: "#c58c8f" },
    phases: [
      phase(1, "融合段階", 1),
      phase(2, "裂開段階", .62),
      phase(3, "分裂段階", .24),
    ],
    entrance: {
      warningLabel: "異常発生 // フタゴ",
      cueId: "enemy-takuya-attack",
      fullBodyRequired: true,
    },
    attackTelegraph: {
      attackId: "fused-cross-strike",
      displayName: "融合交差撃",
      kind: "cross-strike",
      warningSeconds: 1.2,
      radius: 118,
      color: "#a06c70",
      counterplay: "交差中心から離れ、分裂後の片側を先に崩す",
    },
    display: {
      sizeClass: "giant-boss",
      compactBodyHeight: 151,
      standardBodyHeight: 138,
      bodyBounds: { width: 148, height: 178 },
      footAnchor: { x: .5, y: .98 },
      shadow: { radiusX: 49, radiusY: 12 },
      hitboxRadius: 39,
    },
    combat: {
      attackRange: 60,
      statusResistance: { stun: .64, push: .07, slow: .74 },
      formChange: "fused-body-split",
      summonProfile: null,
      componentChange: "paired-rib-seam",
    },
    reward: { equipmentId: "boss-mimic-larynx", quantity: 1 },
    resultId: "boss-result-futago",
    compendiumId: "boss-compendium-futago",
    compendium: {
      title: "フタゴ（呼称仮）",
      summary: "人間の残滓を強く残した融合体。体力低下で裂開し、二方向から交差攻撃を行う。",
    },
  },
]);

export const BOSS_DEFINITION_BY_ID = deepFreeze(Object.fromEntries(
  BOSS_DEFINITIONS.map((definition) => [definition.id, definition]),
));

export const BOSS_DEFINITION_BY_ENEMY_KIND = deepFreeze(Object.fromEntries(
  BOSS_DEFINITIONS.map((definition) => [definition.enemyKind, definition]),
));

export function bossDefinitionForId(id) {
  return BOSS_DEFINITION_BY_ID[id] ?? null;
}

export function bossDefinitionForEnemyKind(enemyKind) {
  return BOSS_DEFINITION_BY_ENEMY_KIND[enemyKind] ?? null;
}

export function isBossEnemyKind(enemyKind) {
  return bossDefinitionForEnemyKind(enemyKind) !== null;
}

export function bossCampaignEntry(enemyKind, overrides = {}) {
  const definition = bossDefinitionForEnemyKind(enemyKind);
  if (!definition) throw new RangeError(`Unknown boss enemy kind: ${String(enemyKind)}`);
  return deepFreeze({
    id: definition.id,
    bossId: definition.id,
    encounterId: overrides.encounterId ?? definition.id,
    enemyKind: definition.enemyKind,
    displayName: overrides.displayName ?? definition.displayName,
    classification: overrides.classification ?? definition.classification,
    entranceEventId: overrides.entranceEventId ?? null,
    resultId: definition.resultId,
    compendiumId: definition.compendiumId,
  });
}

export function bossPhaseForHp(hp, maxHp, enemyKind = null) {
  const ratio = Math.max(0, Number(hp) || 0) / Math.max(1, Number(maxHp) || 1);
  const phases = bossDefinitionForEnemyKind(enemyKind)?.phases
    ?? BOSS_DEFINITIONS[0].phases;
  const selected = [...phases]
    .sort((left, right) => left.startsAtRatio - right.startsAtRatio)
    .find((candidate) => ratio <= candidate.startsAtRatio)
    ?? phases[0];
  return deepFreeze({
    phase: selected.phase,
    label: selected.label,
  });
}

export function bossHudSnapshot(fighter) {
  const definition = bossDefinitionForEnemyKind(fighter?.kind);
  if (!definition
    || fighter?.side !== "zombie"
    || fighter?.combatReady === false
    || fighter?.contained === true
    || Number(fighter?.hp) <= 0) return null;
  const hp = Math.max(0, Number(fighter.hp) || 0);
  const maxHp = Math.max(1, Number(fighter.maxHp) || 1);
  return deepFreeze({
    bossId: definition.id,
    enemyKind: definition.enemyKind,
    displayName: definition.displayName,
    hp,
    maxHp,
    hpRatio: hp / maxHp,
    worldX: Number(fighter.x) || 0,
    phase: bossPhaseForHp(hp, maxHp, definition.enemyKind),
    hpBar: definition.hpBar,
  });
}

export function bossTelegraphSnapshot(fighter, { fallbackTargetX = 0 } = {}) {
  const definition = bossDefinitionForEnemyKind(fighter?.kind);
  if (!definition
    || fighter?.side !== "zombie"
    || fighter?.combatReady === false
    || fighter?.contained === true
    || Number(fighter?.hp) <= 0) return null;
  if (definition.enemyKind === "takuya" && Number(fighter.abilityWindup) > 0) {
    const finalPhase = Number(fighter.hp) / Math.max(1, Number(fighter.maxHp) || 1) <= .5;
    return deepFreeze({
      bossId: definition.id,
      attackId: definition.attackTelegraph.attackId,
      displayName: definition.attackTelegraph.displayName,
      kind: definition.attackTelegraph.kind,
      remainingSeconds: Math.max(0, Number(fighter.abilityWindup) || 0),
      radius: finalPhase
        ? definition.attackTelegraph.finalPhaseRadius
        : definition.attackTelegraph.radius,
      color: definition.attackTelegraph.color,
      counterplay: definition.attackTelegraph.counterplay,
    });
  }
  if (definition.enemyKind === "gate-eater" && fighter.stationAbility?.phase === "windup") {
    return deepFreeze({
      bossId: definition.id,
      attackId: definition.attackTelegraph.attackId,
      displayName: definition.attackTelegraph.displayName,
      kind: definition.attackTelegraph.kind,
      remainingSeconds: Math.max(0, Number(fighter.stationAbility.remainingSeconds) || 0),
      targetX: Number.isFinite(Number(fighter.stationAbility.targetX))
        ? Number(fighter.stationAbility.targetX)
        : Number(fallbackTargetX) || 0,
      laneHalfHeight: definition.attackTelegraph.laneHalfHeight,
      color: definition.attackTelegraph.color,
      counterplay: definition.attackTelegraph.counterplay,
    });
  }
  if (definition.enemyKind === "kurome"
    && ["tracking", "locked"].includes(fighter.stationAbility?.phase)) {
    return deepFreeze({
      bossId: definition.id,
      attackId: definition.attackTelegraph.attackId,
      displayName: definition.attackTelegraph.displayName,
      kind: definition.attackTelegraph.kind,
      remainingSeconds: Math.max(0, Number(fighter.stationAbility.remainingSeconds) || 0),
      originX: Number(fighter.x) || 0,
      originY: Number(fighter.y) || 0,
      targetX: Number.isFinite(Number(fighter.stationAbility.targetX))
        ? Number(fighter.stationAbility.targetX)
        : Number(fallbackTargetX) || 0,
      targetY: Number.isFinite(Number(fighter.stationAbility.targetY))
        ? Number(fighter.stationAbility.targetY)
        : Number(fighter.y) || 0,
      beamHalfWidth: Number(fighter.hp) / Math.max(1, Number(fighter.maxHp) || 1) <= .3
        ? definition.attackTelegraph.finalPhaseBeamHalfWidth
        : definition.attackTelegraph.beamHalfWidth,
      locked: fighter.stationAbility.phase === "locked",
      color: definition.attackTelegraph.color,
      counterplay: definition.attackTelegraph.counterplay,
    });
  }
  if (["mother", "ooguchi", "gairen", "futago"].includes(definition.enemyKind)
    && fighter.stationAbility?.phase === "warning") {
    return deepFreeze({
      bossId: definition.id,
      attackId: definition.attackTelegraph.attackId,
      displayName: definition.attackTelegraph.displayName,
      kind: definition.attackTelegraph.kind,
      remainingSeconds: Math.max(0, Number(fighter.stationAbility.remainingSeconds) || 0),
      originX: Number(fighter.x) || 0,
      originY: Number(fighter.y) || 0,
      targetX: Number.isFinite(Number(fighter.stationAbility.targetX))
        ? Number(fighter.stationAbility.targetX)
        : Number(fallbackTargetX) || 0,
      targetY: Number.isFinite(Number(fighter.stationAbility.targetY))
        ? Number(fighter.stationAbility.targetY)
        : Number(fighter.y) || 0,
      radius: Number(definition.attackTelegraph.radius) || 0,
      laneHalfHeight: Number(definition.attackTelegraph.laneHalfHeight) || 0,
      color: definition.attackTelegraph.color,
      counterplay: definition.attackTelegraph.counterplay,
    });
  }
  return null;
}

/**
 * Hostile boss bodies are a hard movement barrier. This is applied after the
 * normal intent step so a large frame cannot be crossed by a fast ally update.
 */
export function enforceBossBodyBarrier({
  mover,
  boss,
  padding = 0,
  previousX = mover?.x,
} = {}) {
  if (!mover || !boss
    || mover.side !== "human"
    || boss.side !== "zombie"
    || !isBossEnemyKind(boss.kind)
    || mover.combatReady === false
    || boss.combatReady === false
    || Number(mover.hp) <= 0
    || Number(boss.hp) <= 0
    || boss.contained === true) return deepFreeze({ blocked: false, x: Number(mover?.x) || 0 });
  const moverX = Number(mover.x) || 0;
  const bossX = Number(boss.x) || 0;
  const movementStartX = Number.isFinite(Number(previousX)) ? Number(previousX) : moverX;
  if (movementStartX >= bossX) return deepFreeze({ blocked: false, x: moverX });
  const verticalDistance = Math.abs((Number(mover.y) || 0) - (Number(boss.y) || 0));
  const combinedRadius = Math.max(0, Number(mover.bodyRadius) || 0)
    + Math.max(0, Number(boss.bodyRadius) || 0)
    + Math.max(0, Number(padding) || 0);
  const maximumX = bossX - Math.sqrt(Math.max(0, combinedRadius ** 2 - verticalDistance ** 2));
  if (verticalDistance >= combinedRadius || moverX <= maximumX) {
    return deepFreeze({ blocked: false, x: moverX });
  }
  return deepFreeze({
    blocked: true,
    x: maximumX,
    bossId: boss.id ?? null,
  });
}

export function bossResultRecord(fighter, { defeated = Number(fighter?.hp) <= 0 } = {}) {
  const definition = bossDefinitionForEnemyKind(fighter?.kind);
  if (!definition) return null;
  const hp = Math.max(0, Number(fighter?.hp) || 0);
  const maxHp = Math.max(1, Number(fighter?.maxHp) || 1);
  return deepFreeze({
    resultId: definition.resultId,
    bossId: definition.id,
    enemyKind: definition.enemyKind,
    displayName: definition.displayName,
    compendiumId: definition.compendiumId,
    defeated: defeated === true,
    remainingHp: hp,
    maxHp,
    phase: bossPhaseForHp(hp, maxHp, definition.enemyKind).phase,
    reward: definition.reward,
  });
}
