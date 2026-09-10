import {V100_VEHICLE_STATE_ART,v100VehicleSprite,drawV100VehicleSprite,drawV100EscortDestination} from "./v100MissionVehicleSprites.js";
export const V100_MISSION_VEHICLE_ART = Object.freeze({
  intact: "/art/v100/mission-objects/sealed-transport-intact-v1.webp",
  damaged: "/art/v100/mission-objects/sealed-transport-damaged-v1.webp",
  ...V100_VEHICLE_STATE_ART,
});

export const V100_MISSION_VEHICLES = Object.freeze({
  "stage-nishijin-station-tunnel-seal": Object.freeze({targetLabel:"保守台車",count:1}),
  "stage-research-freight-passage": Object.freeze({ targetLabel:"密閉搬送車", count:1 }),
  "stage-coastal-link-bridge": Object.freeze({ targetLabel:"証拠搬送車", count:1 }),
  "stage-bay-evacuation-yard": Object.freeze({ targetLabel:"冷蔵車列", count:3, destinationLabel:"封鎖地点" }),
});

const maskedStates = new WeakMap();
export function v100MissionVehicleImage(intact, damaged, damagedState) {
  if (!intact?.complete || !intact.naturalWidth) return null;
  if (!damagedState) return intact;
  if (!damaged?.complete || !damaged.naturalWidth) return null;
  let cached = maskedStates.get(damaged);
  if (cached?.mask === intact) return cached.canvas;
  const canvas = document.createElement("canvas");
  canvas.width = intact.naturalWidth; canvas.height = intact.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Authored vehicle mask canvas unavailable");
  context.drawImage(damaged,0,0,canvas.width,canvas.height);
  context.globalCompositeOperation = "destination-in";
  context.drawImage(intact,0,0);
  cached = {mask:intact,canvas}; maskedStates.set(damaged,cached);
  return canvas;
}

export const V100_VEHICLE_SOURCE_CROP = Object.freeze({x:134,y:145,width:1506,height:670});

export function drawV100MissionVehicles(context, game, stageObjects, x, y) {
  if (!game.definition.missionConfig.v100StageNumber) return false;
  const profile = V100_MISSION_VEHICLES[game.definition.stageId];
  if (!profile) return false;
  const ratio = Math.max(0,game.stageMission.integrity ?? 0) / Math.max(1,game.stageMission.maxIntegrity ?? 1);
  const sprite=v100VehicleSprite(game.definition.stageId,game.stageMission);
  const image=stageObjects[`v100-mission-vehicle-${sprite.assetKey}`],destination=stageObjects["v100-mission-vehicle-destinationStates"];
  if (!image?.complete||!image.naturalWidth||!destination?.complete||!destination.naturalWidth) throw new Error("The mission vehicle and destination must be decoded before battle starts");
  const width=sprite.width,height=game.definition.missionConfig.v100StageNumber===6?44:94;
  context.save();
  context.imageSmoothingEnabled=true;context.imageSmoothingQuality="high";
  const frontOffset=(profile.count-1)*75;
  drawV100EscortDestination(context,game,destination,game.definition.missionConfig.endX+frontOffset+width/2+8,y+(profile.count===3?32:0)+18);
  for(let index=0;index<profile.count;index++) {
    const offset=index-(profile.count-1)/2,px=x+offset*150,py=y+offset*32;
    context.fillStyle="rgba(0,0,0,.4)";context.beginPath();context.ellipse(px,py+3,width*.46,7,0,0,Math.PI*2);context.fill();
    drawV100VehicleSprite(context,image,sprite,px,py);
  }
  const span = profile.count === 3 ? 504 : width,barY=y-height-13-(profile.count===3?32:0);
  context.fillStyle="rgba(0,0,0,.75)";context.fillRect(x-span/2,barY,span,5);
  context.fillStyle=ratio<.3?"#e07a59":"#d5b85e";context.fillRect(x-span/2,barY,span*ratio,3);
  context.restore();
  return true;
}
