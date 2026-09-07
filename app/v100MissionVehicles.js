export const V100_MISSION_VEHICLE_ART = Object.freeze({
  intact: "/art/v100/mission-objects/sealed-transport-intact-v1.webp",
  damaged: "/art/v100/mission-objects/sealed-transport-damaged-v1.webp",
});

export const V100_MISSION_VEHICLES = Object.freeze({
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
  const image = v100MissionVehicleImage(stageObjects["v100-mission-vehicle-intact"],stageObjects["v100-mission-vehicle-damaged"],ratio < .6);
  if (!image) throw new Error("The mission vehicle must be decoded before battle starts");
  const crop = V100_VEHICLE_SOURCE_CROP;
  const width = 204, height = width * crop.height / crop.width;
  context.save();
  for(let index=0;index<profile.count;index++) {
    const offset=index-(profile.count-1)/2,px=x+offset*150,py=y+offset*32;
    context.fillStyle="rgba(0,0,0,.4)";context.beginPath();context.ellipse(px,py+3,width*.46,7,0,0,Math.PI*2);context.fill();
    context.drawImage(image,crop.x,crop.y,crop.width,crop.height,px-width/2,py-height,width,height);
  }
  const span = profile.count === 3 ? 504 : width,barY=y-height-13-(profile.count===3?32:0);
  context.fillStyle="rgba(0,0,0,.75)";context.fillRect(x-span/2,barY,span,5);
  context.fillStyle=ratio<.3?"#e07a59":"#d5b85e";context.fillRect(x-span/2,barY,span*ratio,3);
  context.restore();
  return true;
}
