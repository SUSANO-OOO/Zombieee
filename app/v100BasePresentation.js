import { V100_RESCUE_CONTROL_STAGE } from "./v100RescueControl.js";
import { V100_STAGE_BY_ID } from "./v100Registry.js";

// R5 sends the armored vehicle to hospital after S4; S7 reunites the party.
// This presentation owner leaves the combat geometry, HP and support rules intact.
export const V100_RETREAT_DOOR_ART = "/art/v100/story-r5/objects/maintenance-retreat-door.webp";
export function v100BasePresentationFor(stageNumber) {
  if (stageNumber === V100_STAGE_BY_ID[V100_RESCUE_CONTROL_STAGE].number) {
    return Object.freeze({ onFoot: true, label: "制御区", healthLabel: "制御区耐久",
      barrageLabel: "援護射撃", assetPath: V100_RETREAT_DOOR_ART });
  }
  if (stageNumber === 17) {
    return Object.freeze({ onFoot: true, label: "避難口", healthLabel: "避難口耐久",
      barrageLabel: "援護射撃", assetPath: V100_RETREAT_DOOR_ART });
  }
  if (stageNumber === 25) {
    return Object.freeze({ onFoot: false, label: "医療物資", healthLabel: "医療物資の保全",
      barrageLabel: "車両砲撃", assetPath: null });
  }
  const onFoot = stageNumber === 5 || stageNumber === 6;
  return Object.freeze({ onFoot, label: onFoot ? "退路" : "装甲車両",
    healthLabel: onFoot ? "退路耐久" : "車両耐久",
    barrageLabel: onFoot ? "援護射撃" : "車両砲撃",
    assetPath: onFoot ? V100_RETREAT_DOOR_ART : null });
}
