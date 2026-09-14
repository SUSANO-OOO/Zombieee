export const V100_CORPORATE_CONTROL_ART="/art/v100/mission-objects/corporate-control-states-v1.webp";
export const V100_LURE_CONTROL_ART="/art/v100/mission-objects/lure-control-states-v1.webp";
export const V100_CORPORATE_CONTROLS=Object.freeze({
  "stage-mugarian-logistics-hq":"誘引制御装置",
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
// Whole authored silhouettes with transparent gaps. The largest destruction
// frame remains within the battlefield and uses the same physical baseline.
const columns=[0,530,1030,1530,2172],anchors=[290,790,1300,1850];
export function drawV100CorporateControl(context,game,stageObjects,barrier,laneCenters){
  const label=V100_CORPORATE_CONTROLS[game.definition.stageId];if(!label)return false;
  const lure=game.definition.stageId==="stage-mugarian-logistics-hq";
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
