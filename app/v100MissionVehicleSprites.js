export const V100_VEHICLE_STATE_ART=Object.freeze({
  transportStates:"/art/v100/mission-objects/transport-states-v1.webp",
  maintenanceStates:"/art/v100/mission-objects/maintenance-cart-states-v1.webp",
  destinationStates:"/art/v100/mission-objects/escort-destination-states-v1.webp",
});
const transportFrames=[[0,0,785,500,415,435],[785,0,751,500,1160,435],[0,500,785,524,410,900],[785,500,751,524,1150,900]];
const maintenanceFrames=[[0,0,627,627,312,475],[627,0,627,627,949,482],[0,627,627,627,314,1033],[627,627,627,627,946,1045]];
export function v100VehicleDamageState(runtime){
  const ratio=Math.max(0,runtime.integrity??0)/Math.max(1,runtime.maxIntegrity??1);
  return ratio<=0?3:ratio<.3?2:ratio<.6?1:0;
}
export function v100VehicleSprite(stageId,runtime){
  const maintenance=stageId==="stage-nishijin-station-tunnel-seal",index=v100VehicleDamageState(runtime);
  return{state:["intact","damaged","critical","destroyed"][index],index,
    assetKey:maintenance?"maintenanceStates":"transportStates",frame:(maintenance?maintenanceFrames:transportFrames)[index],
    scale:maintenance?120/607:204/697,width:maintenance?120:204};
}
export function drawV100VehicleSprite(context,image,sprite,x,y){
  const [left,top,width,height,anchorX,anchorY]=sprite.frame,scale=sprite.scale;
  context.drawImage(image,left,top,width,height,x+(left-anchorX)*scale,y+(top-anchorY)*scale,width*scale,height*scale);
}
export function v100EscortDestinationState(game){
  return game.stageMission.completed===true&&game.stageMission.integrity>0&&!game.stageMission.failed&&game.baseHp>0?1:0;
}
export function drawV100EscortDestination(context,game,image,x,y){
  const index=v100EscortDestinationState(game),left=index?900:0,width=index?874:900,anchorX=index?1265:535,scale=.1;
  context.drawImage(image,left,0,width,887,x+(left-anchorX)*scale,y-798*scale,width*scale,887*scale);
}
