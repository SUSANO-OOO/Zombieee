import {V100_PREPARATION_ART} from './v100PreparationArt.js';
import {v100EquipmentFor} from './v100Equipment.js';
// Reuse the accepted equipment objects as illustrations of temporary effects.
// This map does not grant/equip items or alter any upgrade value.
export const V100_SURVIVAL_UPGRADE_EQUIPMENT = Object.freeze({
  'assault-drill':'recoil-brace',
  'layered-armor':'reinforced-vest',
  'field-triage':'rescue-pouch',
  'range-calibration':'survey-scope',
  'rapid-redeployment':'tactical-field-radio',
  'crawler-field-repair':'tactical-supply-cache',
  'boss-breaker':'quick-loader',
});
export function v100SurvivalUpgradeArtworkStyle(upgradeId) {
  const item=v100EquipmentFor(V100_SURVIVAL_UPGRADE_EQUIPMENT[upgradeId]);
  if(!item)return {};
  return {'--v100-upgrade-art':"url('"+V100_PREPARATION_ART.equipment+"')",
    '--v100-upgrade-art-position':((item.artCell%5)*25)+'% '+(Math.floor(item.artCell/5)*100/3)+'%'};
}
