import { V100_STAGE_BY_ID } from "./v100Registry.js";
import { V100_CORPORATE_CONTROLS } from "./v100CorporateControl.js";

export const V100_ASSAULT_OBJECT_ART=Object.freeze({
  stronghold:"/art/v100/mission-objects/boundary-gate-states-r1.webp",
  relay:"/art/v100/mission-objects/station-relay-states-v1.webp",
});
export function v100AssaultObjectProfile(stageId){
  const stage=V100_STAGE_BY_ID[stageId];
  if(!stage||!["assault","boss"].includes(stage.missionType)||V100_CORPORATE_CONTROLS[stageId]||stage.number===29)return null;
  return stage.number===4||stage.number===5?"relay":"stronghold";
}
export function v100AssaultObjectState(game){
  const ratio=Math.max(0,game.barricadeHp)/Math.max(1,game.barricadeMaxHp);
  return ratio<=0?3:ratio<=.35?2:ratio<=.7?1:0;
}
const frames={
  stronghold:{columns:[0,466,882,1260,1672],anchors:[258,674,1078,1462],height:941,baseline:932,visualHeight:180,halfWidth:38},
  relay:{columns:[0,543,1086,1629,2172],anchors:[270,813,1356,1899],height:724,baseline:540,visualHeight:140,halfWidth:54},
};
export function drawV100AssaultObject(context,game,stageObjects,barrier,laneCenters,drawImage=null){
  if(!game.definition.missionConfig?.v100StageNumber)return false;
  const profile=v100AssaultObjectProfile(game.definition.stageId);if(!profile)return false;
  const image=stageObjects[`v100-assault-${profile}`];
  if(!image?.complete||!image.naturalWidth)throw new Error("Assault objective states must be decoded before battle starts");
  const index=v100AssaultObjectState(game),frame=frames[profile],left=frame.columns[index],width=frame.columns[index+1]-left;
  // The gate and station machine use their own real-world proportions; they
  // should remain smaller than the armored vehicle in the phone viewport.
  const bottom=laneCenters[2]+38;
  const visualHeight=Math.min(frame.visualHeight,bottom-(laneCenters[0]-125));
  const scale=visualHeight/frame.baseline;
  const x=barrier.attackX+10,y=bottom;
  context.save();context.imageSmoothingEnabled=true;context.imageSmoothingQuality="high";
  context.fillStyle="rgba(0,0,0,.4)";context.beginPath();context.ellipse(x,y,frame.halfWidth,6,0,0,Math.PI*2);context.fill();
  if(game.barricadeHitFlash>0&&index<3){context.shadowColor="#ffc073";context.shadowBlur=12;}
  (drawImage??context.drawImage.bind(context))(image,left,0,width,frame.height,x+(left-frame.anchors[index])*scale,y-frame.baseline*scale,width*scale,frame.height*scale);
  if(!game.barricadeVulnerable&&index<3){
    const pulse=.45+.16*Math.sin(game.time*3.4);
    context.fillStyle=`rgba(88,197,204,${pulse*.12})`;
    context.fillRect(x-frame.halfWidth,y-visualHeight,frame.halfWidth*1.5,visualHeight);
    context.strokeStyle=`rgba(128,226,222,${pulse})`;
    context.lineWidth=2;
    context.beginPath();context.moveTo(x-frame.halfWidth,y-visualHeight+8);context.lineTo(x-frame.halfWidth,y-12);context.stroke();
  }
  context.restore();return true;
}
