const freeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
};

const integer = (value, minimum, maximum, fallback = minimum) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(numeric)));
};

export const EQUIPMENT_SLOT_TYPES = freeze({
  PERSONAL: "personal",
  TACTICAL: "tactical",
});

export const EQUIPMENT_SOURCES = freeze({
  SUPPLY_SHOP: "supply-shop",
  SURVIVAL: "survival",
  BOSS: "boss",
});

export const EQUIPMENT_MAX_ENHANCEMENT = 5;
export const PERSONAL_EQUIPMENT_SLOTS = 2;
export const TACTICAL_EQUIPMENT_SLOTS = 2;

const definition = ({
  id,
  displayName,
  slotType,
  source,
  category,
  purchaseCaps = null,
  enhancementBaseCaps,
  effect,
  sourceHint,
}) => ({
  id,
  displayName,
  slotType,
  source,
  category,
  purchaseCaps,
  enhancementBaseCaps,
  effect,
  sourceHint,
  iconKey: id,
});

export const EQUIPMENT_CATALOG = freeze([
  definition({
    id: "field-machete",
    displayName: "作業用マチェット",
    slotType: "personal",
    source: "supply-shop",
    category: "weapon",
    purchaseCaps: 240,
    enhancementBaseCaps: 100,
    effect: { damageMultiplier: { base: .05, perEnhancement: .015 } },
    sourceHint: "補給所で購入",
  }),
  definition({
    id: "reinforced-vest",
    displayName: "補修防弾ベスト",
    slotType: "personal",
    source: "supply-shop",
    category: "armor",
    purchaseCaps: 280,
    enhancementBaseCaps: 115,
    effect: { hpMultiplier: { base: .08, perEnhancement: .02 } },
    sourceHint: "補給所で購入",
  }),
  definition({
    id: "quick-loader",
    displayName: "簡易ローダー",
    slotType: "personal",
    source: "supply-shop",
    category: "weapon",
    purchaseCaps: 320,
    enhancementBaseCaps: 125,
    effect: { attackEveryMultiplier: { base: -.05, perEnhancement: -.012 } },
    sourceHint: "補給所で購入",
  }),
  definition({
    id: "rescue-pouch",
    displayName: "救急処置ポーチ",
    slotType: "personal",
    source: "supply-shop",
    category: "medical",
    purchaseCaps: 260,
    enhancementBaseCaps: 105,
    effect: { healingMultiplier: { base: .08, perEnhancement: .025 } },
    sourceHint: "補給所で購入",
  }),
  definition({
    id: "survey-scope",
    displayName: "測距照準器",
    slotType: "personal",
    source: "supply-shop",
    category: "weapon",
    purchaseCaps: 340,
    enhancementBaseCaps: 130,
    effect: { rangeMultiplier: { base: .06, perEnhancement: .015 } },
    sourceHint: "補給所で購入",
  }),
  definition({
    id: "anti-slip-boots",
    displayName: "防滑戦闘靴",
    slotType: "personal",
    source: "supply-shop",
    category: "armor",
    purchaseCaps: 250,
    enhancementBaseCaps: 100,
    effect: { speedMultiplier: { base: .06, perEnhancement: .015 } },
    sourceHint: "補給所で購入",
  }),
  definition({
    id: "recoil-brace",
    displayName: "反動制御ブレース",
    slotType: "personal",
    source: "supply-shop",
    category: "weapon",
    purchaseCaps: 360,
    enhancementBaseCaps: 135,
    effect: {
      damageMultiplier: { base: .025, perEnhancement: .008 },
      rangeMultiplier: { base: .025, perEnhancement: .008 },
    },
    sourceHint: "補給所で購入",
  }),
  definition({
    id: "contamination-filter",
    displayName: "防染呼吸器",
    slotType: "personal",
    source: "supply-shop",
    category: "medical",
    purchaseCaps: 300,
    enhancementBaseCaps: 120,
    effect: { defenseFlat: { base: .025, perEnhancement: .007 } },
    sourceHint: "補給所で購入",
  }),
  definition({
    id: "survival-field-kit",
    displayName: "前線生存キット",
    slotType: "personal",
    source: "survival",
    category: "medical",
    enhancementBaseCaps: 165,
    effect: {
      hpMultiplier: { base: .05, perEnhancement: .015 },
      healingMultiplier: { base: .06, perEnhancement: .018 },
    },
    sourceHint: "Survival boss checkpoint報酬",
  }),
  definition({
    id: "survival-reinforced-plate",
    displayName: "前線増加装甲",
    slotType: "personal",
    source: "survival",
    category: "armor",
    enhancementBaseCaps: 180,
    effect: {
      hpMultiplier: { base: .06, perEnhancement: .018 },
      defenseFlat: { base: .02, perEnhancement: .006 },
    },
    sourceHint: "Survival boss checkpoint報酬",
  }),
  definition({
    id: "tactical-field-radio",
    displayName: "戦術無線機",
    slotType: "tactical",
    source: "supply-shop",
    category: "communications",
    purchaseCaps: 380,
    enhancementBaseCaps: 145,
    effect: { redeployMultiplier: { base: -.04, perEnhancement: -.01 } },
    sourceHint: "補給所で購入",
  }),
  definition({
    id: "tactical-supply-cache",
    displayName: "先行補給コンテナ",
    slotType: "tactical",
    source: "supply-shop",
    category: "communications",
    purchaseCaps: 420,
    enhancementBaseCaps: 155,
    effect: { startingEnergyFlat: { base: 8, perEnhancement: 2 } },
    sourceHint: "補給所で購入",
  }),
  definition({
    id: "tactical-trauma-station",
    displayName: "前線救護所",
    slotType: "tactical",
    source: "supply-shop",
    category: "medical",
    purchaseCaps: 400,
    enhancementBaseCaps: 150,
    effect: { healingMultiplier: { base: .06, perEnhancement: .018 } },
    sourceHint: "補給所で購入",
  }),
  definition({
    id: "tactical-barricade-kit",
    displayName: "防衛線補修キット",
    slotType: "tactical",
    source: "supply-shop",
    category: "armor",
    purchaseCaps: 440,
    enhancementBaseCaps: 160,
    effect: { baseHpMultiplier: { base: .08, perEnhancement: .02 } },
    sourceHint: "補給所で購入",
  }),
  definition({
    id: "tactical-flare-controller",
    displayName: "照明弾管制器",
    slotType: "tactical",
    source: "supply-shop",
    category: "communications",
    purchaseCaps: 410,
    enhancementBaseCaps: 150,
    effect: { supportGaugeFlat: { base: 7, perEnhancement: 2 } },
    sourceHint: "補給所で購入",
  }),
  definition({
    id: "boss-muscle-fiber",
    displayName: "過増殖筋繊維",
    slotType: "personal",
    source: "boss",
    category: "biological",
    enhancementBaseCaps: 210,
    effect: {
      damageMultiplier: { base: .07, perEnhancement: .018 },
      speedMultiplier: { base: .025, perEnhancement: .008 },
    },
    sourceHint: "固有boss報酬",
  }),
  definition({
    id: "boss-rail-spine",
    displayName: "軌道化脊柱片",
    slotType: "personal",
    source: "boss",
    category: "biological",
    enhancementBaseCaps: 220,
    effect: {
      rangeMultiplier: { base: .07, perEnhancement: .018 },
      attackEveryMultiplier: { base: -.025, perEnhancement: -.006 },
    },
    sourceHint: "固有boss報酬",
  }),
  definition({
    id: "boss-resonance-gland",
    displayName: "共鳴信号腺",
    slotType: "tactical",
    source: "boss",
    category: "biological",
    enhancementBaseCaps: 225,
    effect: {
      startingEnergyFlat: { base: 5, perEnhancement: 1 },
      supportGaugeFlat: { base: 5, perEnhancement: 1 },
    },
    sourceHint: "固有boss報酬",
  }),
  definition({
    id: "boss-mimic-larynx",
    displayName: "擬声器官",
    slotType: "tactical",
    source: "boss",
    category: "biological",
    enhancementBaseCaps: 230,
    effect: {
      redeployMultiplier: { base: -.03, perEnhancement: -.008 },
      healingMultiplier: { base: .035, perEnhancement: .01 },
    },
    sourceHint: "固有boss報酬",
  }),
  definition({
    id: "boss-ossified-core",
    displayName: "骨化循環核",
    slotType: "personal",
    source: "boss",
    category: "biological",
    enhancementBaseCaps: 235,
    effect: {
      hpMultiplier: { base: .07, perEnhancement: .02 },
      defenseFlat: { base: .025, perEnhancement: .007 },
    },
    sourceHint: "固有boss報酬",
  }),
]);

export const EQUIPMENT_BY_ID = freeze(Object.fromEntries(
  EQUIPMENT_CATALOG.map((entry) => [entry.id, entry]),
));

export function equipmentDefinition(equipmentId) {
  return EQUIPMENT_BY_ID[typeof equipmentId === "string" ? equipmentId : ""] ?? null;
}

export function normalizeEquipmentEnhancementLevels(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.freeze(Object.fromEntries(Object.entries(value)
    .filter(([equipmentId]) => Boolean(EQUIPMENT_BY_ID[equipmentId]))
    .map(([equipmentId, level]) => [
      equipmentId,
      integer(level, 0, EQUIPMENT_MAX_ENHANCEMENT, 0),
    ])
    .filter(([, level]) => level > 0)
    .sort(([left], [right]) => left.localeCompare(right))));
}

export function equipmentEnhancementLevel(levels, equipmentId) {
  return integer(levels?.[equipmentId], 0, EQUIPMENT_MAX_ENHANCEMENT, 0);
}

export function equipmentEnhancementCost(equipmentId, currentLevel) {
  const entry = equipmentDefinition(equipmentId);
  const level = equipmentEnhancementLevel({ [equipmentId]: currentLevel }, equipmentId);
  if (!entry || level >= EQUIPMENT_MAX_ENHANCEMENT) return null;
  return Math.round(entry.enhancementBaseCaps * (1 + level * .55) / 5) * 5;
}

const EMPTY_EFFECTS = freeze({
  damageMultiplier: 1,
  hpMultiplier: 1,
  rangeMultiplier: 1,
  attackEveryMultiplier: 1,
  speedMultiplier: 1,
  healingMultiplier: 1,
  defenseFlat: 0,
  redeployMultiplier: 1,
  startingEnergyFlat: 0,
  supportGaugeFlat: 0,
  baseHpMultiplier: 1,
});

export function aggregateEquipmentEffects(equipmentIds, enhancementLevels = {}) {
  const bonuses = Object.fromEntries(Object.keys(EMPTY_EFFECTS).map((key) => [key, 0]));
  const uniqueIds = [...new Set(Array.isArray(equipmentIds) ? equipmentIds : [])];
  for (const equipmentId of uniqueIds) {
    const entry = equipmentDefinition(equipmentId);
    if (!entry) continue;
    const level = equipmentEnhancementLevel(enhancementLevels, equipmentId);
    for (const [stat, tuning] of Object.entries(entry.effect)) {
      if (!Object.hasOwn(bonuses, stat)) continue;
      bonuses[stat] += Number(tuning.base) + Number(tuning.perEnhancement) * level;
    }
  }
  return freeze({
    damageMultiplier: Math.max(.25, 1 + bonuses.damageMultiplier),
    hpMultiplier: Math.max(.25, 1 + bonuses.hpMultiplier),
    rangeMultiplier: Math.max(.25, 1 + bonuses.rangeMultiplier),
    attackEveryMultiplier: Math.max(.4, 1 + bonuses.attackEveryMultiplier),
    speedMultiplier: Math.max(.5, 1 + bonuses.speedMultiplier),
    healingMultiplier: Math.max(.25, 1 + bonuses.healingMultiplier),
    defenseFlat: Math.max(0, Math.min(.35, bonuses.defenseFlat)),
    redeployMultiplier: Math.max(.5, 1 + bonuses.redeployMultiplier),
    startingEnergyFlat: Math.max(0, Math.round(bonuses.startingEnergyFlat)),
    supportGaugeFlat: Math.max(0, Math.round(bonuses.supportGaugeFlat)),
    baseHpMultiplier: Math.max(.5, 1 + bonuses.baseHpMultiplier),
  });
}

export function equipmentEffectSummary(equipmentId, enhancementLevel = 0) {
  const entry = equipmentDefinition(equipmentId);
  if (!entry) return "";
  const effects = aggregateEquipmentEffects([equipmentId], {
    [equipmentId]: enhancementLevel,
  });
  const labels = [];
  const percent = (value) => Math.round((value - 1) * 100 + 1e-9);
  if (effects.damageMultiplier !== 1) labels.push(`攻撃 ${percent(effects.damageMultiplier)}%`);
  if (effects.hpMultiplier !== 1) labels.push(`HP ${percent(effects.hpMultiplier)}%`);
  if (effects.rangeMultiplier !== 1) labels.push(`射程 ${percent(effects.rangeMultiplier)}%`);
  if (effects.attackEveryMultiplier !== 1) labels.push(`攻撃間隔 ${percent(effects.attackEveryMultiplier)}%`);
  if (effects.speedMultiplier !== 1) labels.push(`移動 ${percent(effects.speedMultiplier)}%`);
  if (effects.healingMultiplier !== 1) labels.push(`回復 ${percent(effects.healingMultiplier)}%`);
  if (effects.defenseFlat > 0) labels.push(`防御 +${Math.round(effects.defenseFlat * 1000) / 10}%`);
  if (effects.redeployMultiplier !== 1) labels.push(`再出撃 ${percent(effects.redeployMultiplier)}%`);
  if (effects.startingEnergyFlat > 0) labels.push(`初期指揮 +${effects.startingEnergyFlat}`);
  if (effects.supportGaugeFlat > 0) labels.push(`初期支援 +${effects.supportGaugeFlat}`);
  if (effects.baseHpMultiplier !== 1) labels.push(`防衛対象HP ${percent(effects.baseHpMultiplier)}%`);
  return labels.join(" / ");
}
