export const V100_CORPORATE_CONTROL_ART="/art/v100/mission-objects/corporate-control-states-v1.webp";
export const V100_LURE_CONTROL_ART="/art/v100/mission-objects/lure-control-states-v1.webp";
export const V100_LURE_CONTROL_STAGE = "stage-mugarian-logistics-hq";
export const V100_LURE_CONTROL_NAME = "音響誘導装置";
export const V100_LURE_CONTROL_OBJECTIVE = `${V100_LURE_CONTROL_NAME}を先に破壊`;

export function hasV100LureControl(definition) {
  return definition.stageId === V100_LURE_CONTROL_STAGE
    && definition.missionConfig?.v100StageNumber === 21;
}

export function v100LureControlReadout(game) {
  if (game.barricadeHp <= 0) return { stopped: true, status: "増援停止" };
  const signal = game.definition.timeline.find((event, index) =>
    index >= game.eventIndex && event.requiresActiveLure);
  if (!signal) return { stopped: false, status: "増援到着" };
  const seconds = Math.ceil(signal.at - game.time);
  return { stopped: false, status: seconds <= 0 ? "増援接近中" : `増援まで${seconds}秒` };
}

export function v100LureWaveBlocked(event, barricadeHp) {
  return event.requiresActiveLure === true && barricadeHp <= 0;
}

export function v100LureControlAim(game, requested, barrier, laneCenters) {
  if (!hasV100LureControl(game.definition) || game.barricadeHp <= 0) return null;
  // The painted base uses the lowest lane and the speaker stands above it.
  const center = { x: barrier.attackX + 10, y: laneCenters[2] };
  return Math.abs(requested.x - center.x) <= 44
    && requested.y >= center.y - 85 && requested.y <= center.y + 47 ? center : null;
}

export const V100_CORPORATE_CONTROLS=Object.freeze({
  [V100_LURE_CONTROL_STAGE]:V100_LURE_CONTROL_NAME,
  "stage-mugarian-special-operations-armory":"認証鍵制御盤",
  "stage-mugarian-tech-tower":"中央制御盤",
  "stage-mugarian-executive-lab":"研究室制御盤",
  "stage-segawa-private-lab":"研究室封鎖装置",
});
export function v100CorporateControlState(game){
  const ratio=Math.max(0,game.barricadeHp)/game.barricadeMaxHp;
  return ratio<=0?3:ratio<=.35?2:ratio<=.7?1:0;
}
export function v100CorporateControlLabel(definition){
  return definition.missionConfig?.v100StageNumber?V100_CORPORATE_CONTROLS[definition.stageId]??null:null;
}
export function v100CorporateControlCondition(game) {
  return ["健全","損傷","大破","破壊"][v100CorporateControlState(game)];
}
// Damage announcements name the same target as the existing objective HUD.
export function v100ObjectiveDamageLabel(game, damageState) {
  const target = game.researchCoreTargets ? "研究中枢の破壊目標" : v100CorporateControlLabel(game.definition) ?? "感染拠点";
  return `${target} // ${damageState}`;
}
// Whole authored silhouettes with transparent gaps. The largest destruction
// frame remains within the battlefield and uses the same physical baseline.
const columns=[0,530,1030,1530,2172],anchors=[290,790,1300,1850];
export function drawV100CorporateControl(context,game,stageObjects,barrier,laneCenters){
  const label=V100_CORPORATE_CONTROLS[game.definition.stageId];if(!label)return false;
  const lure=game.definition.stageId===V100_LURE_CONTROL_STAGE;
  const image=lure?stageObjects.lureControlStates:stageObjects.corporateControlStates;
  if(!image?.complete||!image.naturalWidth)throw new Error("Corporate control states must be decoded before battle starts");
  const frames=lure?[0,530,1060,1560,2172]:columns,origins=lure?[270,800,1310,1870]:anchors;
  const index=v100CorporateControlState(game),left=frames[index],width=frames[index+1]-left,scale=.22;
  const x=barrier.attackX+10,y=laneCenters[2]+42;
  context.save();context.imageSmoothingEnabled=true;context.imageSmoothingQuality="high";
  context.fillStyle="rgba(0,0,0,.4)";context.beginPath();context.ellipse(x,y,50,5,0,0,Math.PI*2);context.fill();
  if(game.barricadeHitFlash>0&&index<3){context.shadowColor="#ffd087";context.shadowBlur=12;}
  context.drawImage(image,left,0,width,724,x+(left-origins[index])*scale,y-712*scale,width*scale,724*scale);
  // The single existing HUD owns the readable name, HP and protection status.
  // Avoid a duplicate world label underneath that HUD on short screens.
  context.restore();return true;
}
