export const MANUAL_ABILITY_SYMBOL_DICTIONARY = Object.freeze({
  ready: "発動可能",
  awaitingTarget: "対象待ち",
  targeting: "対象を選択",
  cooldown: "再準備中",
  active: "効果発生",
  legend: "隊員名の能力名をタップして発動",
});

export function manualAbilityVisibleStateFor({ available = false, targeting = false } = {}) {
  if (targeting) return MANUAL_ABILITY_SYMBOL_DICTIONARY.targeting;
  return available ? MANUAL_ABILITY_SYMBOL_DICTIONARY.ready : MANUAL_ABILITY_SYMBOL_DICTIONARY.awaitingTarget;
}
