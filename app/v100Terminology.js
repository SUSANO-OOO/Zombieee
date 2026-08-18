const V100_ROLE_LABELS = Object.freeze({
  skirmisher: "遊撃兵",
  frontline: "前衛",
  heavy: "重装兵",
  marksman: "射撃手",
  support: "支援兵",
  suppression: "制圧兵",
  engineer: "工兵",
});

export { V100_ROLE_LABELS };

export function v100RoleLabelFor(roleId) {
  return V100_ROLE_LABELS[roleId] ?? "隊員";
}
