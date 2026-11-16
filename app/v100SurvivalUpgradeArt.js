import {V100_PREPARATION_ART} from './v100PreparationArt.js';
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
// Full original objects, including the radio antenna; no neighboring atlas art.
// inventory-atlas-r1.webp: 1280x1024, sha256 a426198839b80b54d42923e6e0a9d1e4e719611c84524fa2e81ff6c6753ce766.
export const V100_SURVIVAL_UPGRADE_CROPS = Object.freeze({
  "assault-drill":Object.freeze([278,261,211,235]),
  "layered-armor":Object.freeze([267,14,211,229]),
  "field-triage":Object.freeze([785,38,207,195]),
  "range-calibration":Object.freeze([1041,47,226,174]),
  "rapid-redeployment":Object.freeze([36,494,197,243]),
  "crawler-field-repair":Object.freeze([261,517,243,211]),
  "boss-breaker":Object.freeze([528,39,218,202]),
});
export function v100SurvivalUpgradeArtworkStyle(upgradeId) {
  const crop=V100_SURVIVAL_UPGRADE_CROPS[upgradeId];
  if(!crop)return {};
  const [x,y,width,height]=crop;
  return {'--v100-upgrade-art':"url('"+V100_PREPARATION_ART.equipment+"')",
    '--v100-upgrade-art-position':(x/(1280-width)*100)+'% '+(y/(1024-height)*100)+'%',
    '--v100-upgrade-art-size':(1280/width*100)+'% '+(1024/height*100)+'%',
    '--v100-upgrade-art-width':String(width/Math.max(width,height)),
    '--v100-upgrade-art-aspect':width+' / '+height};
}
