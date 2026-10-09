// Articulated locomotion uses the approved atlas pixels. No face, costume,
// weapon, source file or battle statistics are replaced.
const PAISEN = Object.freeze({ source: { x: 394, y: 0, w: 394, h: 757 },
  hip: [213, 376], knee: [251, 451], ankle: [280, 564], stance: .6, reach: 60 });
const FRAME_COUNT = 24, CELL_W = 197, CELL_H = 379;
const polygons = Object.freeze({
  thigh: [[182,353],[232,354],[247,377],[271,438],[252,460],[222,469],[207,440],[186,401]],
  calf: [[234,445],[269,442],[273,498],[293,550],[279,573],[267,566],[252,521]],
  foot: [[274,551],[291,550],[310,558],[342,571],[345,588],[271,602],[263,585],[263,565]],
  torso: [[135,98],[286,98],[282,204],[259,220],[253,270],[246,326],[250,370],[232,380],[193,370],[191,327],[177,284],[149,270],[145,235]],
  upperArm: [[151,270],[174,273],[185,289],[181,339],[159,343],[148,310]],
  forearm: [[158,328],[180,327],[183,367],[198,385],[194,403],[177,405],[165,384]],
  farArm: [[247,308],[267,327],[299,347],[306,363],[299,379],[283,378],[266,361],[252,347]],
});
const cycle = phase => ((Number(phase) || 0) % 1 + 1) % 1;
const length = (a,b) => Math.hypot(b[0]-a[0],b[1]-a[1]);
function kneeFor(hip,ankle,upper,lower) {
  const dx=ankle[0]-hip[0],dy=ankle[1]-hip[1],distance=Math.hypot(dx,dy);
  const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
  const bend=Math.sqrt(Math.max(0,upper*upper-along*along));
  return [hip[0]+dx/distance*along+dy/distance*bend,hip[1]+dy/distance*along-dx/distance*bend];
}
function footFor(phase) {
  const p=cycle(phase),{stance,reach}=PAISEN;
  if(p<=stance+1e-10)return {point:[210+reach*(1-2*Math.min(p,stance)/stance),564],planted:true};
  const t=(p-stance)/(1-stance),smooth=t*t*(3-2*t);
  return {point:[210+reach*(2*smooth-1),564-26*Math.sin(Math.PI*t)],planted:false};
}
export function v100PaisenWalkCycleDistance(renderScale) {
  return 2*PAISEN.reach*Math.max(.001,Number(renderScale)||.001)/PAISEN.stance;
}
export function v100PaisenWalkPose(phase) {
  const p=cycle(phase),rise=1-2*Math.cos(p*4*Math.PI),nearHip=[215,376+rise],farHip=[204,376+rise];
  const near=footFor(p),far=footFor(p+.5),upper=length(PAISEN.hip,PAISEN.knee),lower=length(PAISEN.knee,PAISEN.ankle);
  return {phase:p,rise,near:{...near,hip:nearHip,knee:kneeFor(nearHip,near.point,upper,lower)},
    far:{...far,hip:farHip,knee:kneeFor(farHip,far.point,upper,lower)},upper,lower};
}
export function v100HumanWalkPhase(runtime) {
  return Number(runtime?.locomotionPhase)||0;
}
export function v100UsesHumanWalk(kind,sample,{manualAbilityActive=false}={}) {
  // An attack may move the fighter while its limbs still own an attack pose.
  return kind==='brawler' && !manualAbilityActive
    && ['idle','move','start-move','stop-move','turn'].includes(sample?.requestedState);
}
function piece(ctx,image,name,sourceA,sourceB,targetA,targetB) {
  ctx.save();ctx.translate(targetA[0],targetA[1]);
  if(sourceB)ctx.rotate(Math.atan2(targetB[1]-targetA[1],targetB[0]-targetA[0])-Math.atan2(sourceB[1]-sourceA[1],sourceB[0]-sourceA[0]));
  ctx.translate(-sourceA[0],-sourceA[1]);ctx.beginPath();
  polygons[name].forEach(([x,y],index)=>index?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();
  const s=PAISEN.source;ctx.drawImage(image,s.x,s.y,s.w,s.h,0,0,s.w,s.h);ctx.restore();
}
function paintPose(ctx,image,pose) {
  const {near,far,rise,phase}=pose;
  const leg=(target)=>{
    piece(ctx,image,'thigh',PAISEN.hip,PAISEN.knee,target.hip,target.knee);
    piece(ctx,image,'calf',PAISEN.knee,PAISEN.ankle,target.knee,target.point);
    piece(ctx,image,'foot',PAISEN.ankle,null,target.point,null);
  };
  ctx.save();ctx.filter='brightness(.84)';leg(far);ctx.restore();
  const swing=Math.sin(phase*2*Math.PI)*.2;
  piece(ctx,image,'farArm',[247,308],[295,361],[247,308+rise],[247+Math.sin(swing)*60,374+rise]);
  leg(near);piece(ctx,image,'torso',[210,376],null,[210,376+rise],null);
  const shoulder=[170,276+rise],elbow=[170+Math.sin(-swing)*62,276+Math.cos(swing)*62+rise];
  const hand=[elbow[0]+Math.sin(.2-swing)*54,elbow[1]+Math.cos(.2-swing)*54];
  piece(ctx,image,'upperArm',[170,276],[169,335],shoulder,elbow);
  piece(ctx,image,'forearm',[169,335],[183,386],elbow,hand);
}
export function createV100HumanWalkRenderer({createCanvas=()=>document.createElement('canvas')}={}) {
  let cached=null,builds=0;
  const clear=()=>{if(cached){cached.canvas.width=0;cached.canvas.height=0;}cached=null;};
  function prepare(kind,image) {
    if(kind!=='brawler'||!image?.naturalWidth)return false;
    if(cached?.image===image)return true;
    clear();const canvas=createCanvas();canvas.width=CELL_W*6;canvas.height=CELL_H*4;
    const ctx=canvas.getContext('2d');if(!ctx)return false;
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    for(let index=0;index<FRAME_COUNT;index++){
      ctx.save();ctx.translate(index%6*CELL_W,Math.floor(index/6)*CELL_H);ctx.scale(CELL_W/PAISEN.source.w,CELL_H/PAISEN.source.h);
      paintPose(ctx,image,v100PaisenWalkPose(index/FRAME_COUNT));ctx.restore();
    }
    cached={image,canvas};builds++;return true;
  }
  function draw(ctx,image,kind,phase,dx,dy,dw,dh) {
    if(!prepare(kind,image))return false;
    const index=Math.floor(cycle(phase)*FRAME_COUNT)%FRAME_COUNT;
    ctx.drawImage(cached.canvas,index%6*CELL_W,Math.floor(index/6)*CELL_H,CELL_W,CELL_H,dx,dy,dw,dh);
    return true;
  }
  return Object.freeze({prepare,draw,clear,snapshot:()=>({entries:cached?1:0,bytes:cached?CELL_W*CELL_H*FRAME_COUNT*4:0,builds,frames:FRAME_COUNT})});
}
