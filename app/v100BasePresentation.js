// R5 sends the armored vehicle to hospital after S4; S7 reunites the party.
// This presentation owner leaves the combat geometry, HP and support rules intact.
export const V100_RETREAT_DOOR_ART = "/art/v100/story-r5/objects/maintenance-retreat-door.webp";
export function v100BasePresentationFor(stageNumber) {
  const onFoot = stageNumber === 5 || stageNumber === 6;
  return Object.freeze({ onFoot, label: onFoot ? "退路" : "装甲車両",
    healthLabel: onFoot ? "退路耐久" : "車両耐久",
    barrageLabel: onFoot ? "援護射撃" : "車両砲撃",
    assetPath: onFoot ? V100_RETREAT_DOOR_ART : null });
}
