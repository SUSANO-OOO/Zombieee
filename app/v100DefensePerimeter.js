import { v100DefenseStatus } from './v100DefenseObjectives.js';
export const V100_DEFENSE_PERIMETER_ART='/art/v100/mission-objects/defense-perimeter-states-v1.webp';
export const V100_DEFENSE_PERIMETER_STATES=Object.freeze(['perimeter','incoming','impact','success','failed']);
const columns=[0,392,770,1158,1535,1983],anchors=[203,578,962,1346,1749];
export function drawV100DefensePerimeter(context,game,stageObjects,x,y){
  const status=v100DefenseStatus(game.definition,game);if(!status)return false;
  const image=stageObjects['v100-defense-perimeter'];
  if(!image?.complete||!image.naturalWidth)throw new Error('Defense perimeter states must be decoded before battle starts');
  const index=V100_DEFENSE_PERIMETER_STATES.indexOf(status.phase),left=columns[index],width=columns[index+1]-left,scale=.28;
  context.save();context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
  context.drawImage(image,left,0,width,793,x+(left-anchors[index])*scale,y-540*scale,width*scale,793*scale);
  context.restore();return true;
}
